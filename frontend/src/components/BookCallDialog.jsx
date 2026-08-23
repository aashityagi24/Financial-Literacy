import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { PhoneCall } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const GRADE_LABELS = ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'];
const EMPTY_FORM = { name: '', phone: '', email: '', program: '', audience: '', child_grade: '' };
const INDIAN_PHONE_RE = /^[6-9]\d{9}$/;

export function BookCallButton({ className, label = 'Book a Call' }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Please enter your name'); return; }
    const digits = form.phone.replace(/\D/g, '').replace(/^91/, '');
    if (!INDIAN_PHONE_RE.test(digits)) { toast.error('Enter a valid 10-digit Indian mobile number'); return; }
    if (!form.email.trim() || !form.email.includes('@')) { toast.error('Please enter a valid email'); return; }
    if (!form.program) { toast.error('Please select a program'); return; }
    if (!form.audience) { toast.error('Please select parent or school'); return; }
    if (form.child_grade === '') { toast.error("Please select the child's grade"); return; }
    setSubmitting(true);
    try {
      await axios.post(`${API}/subscriptions/call-request`, {
        name: form.name.trim(),
        phone: digits,
        email: form.email.trim(),
        program: form.program,
        audience: form.audience,
        child_grade: parseInt(form.child_grade),
      });
      toast.success("Request received! Our team will call you shortly.");
      setOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        data-testid="book-call-btn"
        onClick={() => setOpen(true)}
        className={className}
      >
        <PhoneCall className="w-4 h-4 mr-2 inline" /> {label}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" data-testid="book-call-dialog">
          <DialogHeader>
            <DialogTitle className="text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Book a Call</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              data-testid="call-name-input"
              placeholder="Your Name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <Input
              data-testid="call-phone-input"
              placeholder="10-digit Mobile Number"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            />
            <Input
              data-testid="call-email-input"
              type="email"
              placeholder="Email Address"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            />
            <Select value={form.program} onValueChange={(v) => setForm((p) => ({ ...p, program: v }))}>
              <SelectTrigger data-testid="call-program-select"><SelectValue placeholder="Interested Program" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="workshop">Entrepreneurship Workshop</SelectItem>
                <SelectItem value="platform">Financial Literacy Platform</SelectItem>
              </SelectContent>
            </Select>
            <Select value={form.audience} onValueChange={(v) => setForm((p) => ({ ...p, audience: v }))}>
              <SelectTrigger data-testid="call-audience-select"><SelectValue placeholder="I am a..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="parent">Parent</SelectItem>
                <SelectItem value="school">School</SelectItem>
              </SelectContent>
            </Select>
            <Select value={form.child_grade} onValueChange={(v) => setForm((p) => ({ ...p, child_grade: v }))}>
              <SelectTrigger data-testid="call-grade-select"><SelectValue placeholder="Child's Grade" /></SelectTrigger>
              <SelectContent>
                {GRADE_LABELS.map((label, idx) => (
                  <SelectItem key={idx} value={String(idx)}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              data-testid="submit-call-request-btn"
              onClick={submit}
              disabled={submitting}
              className="w-full bg-[#EE6C4D] hover:bg-[#D95A3C] text-white mt-2"
            >
              {submitting ? 'Sending...' : 'Request a Call'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
