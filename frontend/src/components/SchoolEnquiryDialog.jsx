import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { School, Phone, Mail, MapPin, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const EMPTY_SCHOOL_FORM = {
  school_name: '', city: '', person_name: '', designation: '', contact_number: '', email: '', grades: [],
};

export function SchoolEnquiryDialog({ open, onOpenChange }) {
  const [schoolForm, setSchoolForm] = useState(EMPTY_SCHOOL_FORM);
  const [submittingEnquiry, setSubmittingEnquiry] = useState(false);

  const toggleGrade = (grade) => {
    setSchoolForm((prev) => ({
      ...prev,
      grades: prev.grades.includes(grade) ? prev.grades.filter((g) => g !== grade) : [...prev.grades, grade],
    }));
  };

  const handleSchoolEnquiry = async () => {
    if (!schoolForm.school_name.trim()) { toast.error('School name is required'); return; }
    if (!schoolForm.person_name.trim()) { toast.error('Contact person name is required'); return; }
    if (!schoolForm.contact_number.trim() || schoolForm.contact_number.replace(/\D/g, '').length < 10) { toast.error('Valid contact number is required'); return; }
    if (!schoolForm.email.trim() || !schoolForm.email.includes('@')) { toast.error('Valid email is required'); return; }

    setSubmittingEnquiry(true);
    try {
      await axios.post(`${API}/admin/school-enquiry`, schoolForm);
      toast.success('Enquiry submitted! Our team will reach out to you shortly.');
      onOpenChange(false);
      setSchoolForm(EMPTY_SCHOOL_FORM);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit enquiry');
    } finally {
      setSubmittingEnquiry(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#1D3557] flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
            <School className="w-5 h-5 text-[#EE6C4D]" />
            School Subscription Enquiry
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold text-[#1D3557] mb-1 block">
              School Name <span className="text-red-500">*</span>
            </label>
            <Input
              data-testid="enquiry-school-name"
              placeholder="Enter school name"
              value={schoolForm.school_name}
              onChange={(e) => setSchoolForm((prev) => ({ ...prev, school_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-bold text-[#1D3557] mb-1 block flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> City <span className="text-xs text-gray-400 font-normal">(optional)</span>
            </label>
            <Input
              data-testid="enquiry-city"
              placeholder="City"
              value={schoolForm.city}
              onChange={(e) => setSchoolForm((prev) => ({ ...prev, city: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-bold text-[#1D3557] mb-1 block">
              Contact Person Name <span className="text-red-500">*</span>
            </label>
            <Input
              data-testid="enquiry-person-name"
              placeholder="Full name"
              value={schoolForm.person_name}
              onChange={(e) => setSchoolForm((prev) => ({ ...prev, person_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-bold text-[#1D3557] mb-1 block flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5" /> Designation <span className="text-xs text-gray-400 font-normal">(optional)</span>
            </label>
            <Input
              data-testid="enquiry-designation"
              placeholder="e.g. Principal, Coordinator"
              value={schoolForm.designation}
              onChange={(e) => setSchoolForm((prev) => ({ ...prev, designation: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-bold text-[#1D3557] mb-1 block flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" /> Contact Number <span className="text-red-500">*</span>
            </label>
            <Input
              data-testid="enquiry-phone"
              type="tel"
              placeholder="+91 9XXXXXXXXX"
              value={schoolForm.contact_number}
              onChange={(e) => setSchoolForm((prev) => ({ ...prev, contact_number: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-bold text-[#1D3557] mb-1 block flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" /> Email <span className="text-red-500">*</span>
            </label>
            <Input
              data-testid="enquiry-email"
              type="email"
              placeholder="email@school.com"
              value={schoolForm.email}
              onChange={(e) => setSchoolForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-bold text-[#1D3557] mb-1 block">
              Grades Interested In <span className="text-xs text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="flex gap-2 mt-1">
              {[{ key: 'kindergarten', label: 'Kindergarten' }, { key: 'grade_1', label: 'Grade 1' }, { key: 'grade_2', label: 'Grade 2' }].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  data-testid={`enquiry-grade-${key}`}
                  onClick={() => toggleGrade(key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                    schoolForm.grades.includes(key)
                      ? 'bg-[#1D3557] text-white border-[#1D3557]'
                      : 'bg-white text-[#1D3557] border-[#1D3557]/30 hover:border-[#1D3557]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Button
            data-testid="submit-enquiry-btn"
            onClick={handleSchoolEnquiry}
            disabled={submittingEnquiry}
            className="w-full py-5 text-lg font-bold bg-[#EE6C4D] hover:bg-[#D95A3D] text-white rounded-xl"
          >
            {submittingEnquiry ? 'Submitting...' : 'Submit Enquiry'}
          </Button>
          <p className="text-xs text-center text-gray-500">
            Our team will get in touch with you within 24 hours.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
