import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import {
  ChevronLeft, Plus, Trash2, Edit2, Video, CalendarDays, PlayCircle, Radio
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CURRICULA = [
  { id: 'financial_literacy', name: 'Financial Literacy' },
  { id: 'money_entrepreneurship', name: 'Money Masters & Entrepreneurship' },
];
const GRADES = [
  { value: 0, label: 'Kindergarten' }, { value: 1, label: '1st Grade' }, { value: 2, label: '2nd Grade' },
  { value: 3, label: '3rd Grade' }, { value: 4, label: '4th Grade' }, { value: 5, label: '5th Grade' },
];
const IST = 'Asia/Kolkata';

const emptyForm = {
  title: '', brief: '', scheduled_at: '', duration_minutes: 60, meeting_link: '',
  recording_url: '', min_grade: 0, max_grade: 5, curricula: ['financial_literacy'], is_published: true,
};

// ISO (UTC) -> value for <input type="datetime-local"> in the browser's local tz
const isoToLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
};

export default function LiveClassesAdmin() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { fetchClasses(); }, []);

  const fetchClasses = async () => {
    try {
      const res = await axios.get(`${API}/admin/live-classes`);
      setClasses(res.data || []);
    } catch (e) {
      toast.error('Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowDialog(true); };
  const openEdit = (cls) => {
    setEditing(cls);
    setForm({
      title: cls.title || '', brief: cls.brief || '',
      scheduled_at: isoToLocalInput(cls.scheduled_at),
      duration_minutes: cls.duration_minutes || 60,
      meeting_link: cls.meeting_link || '', recording_url: cls.recording_url || '',
      min_grade: cls.min_grade ?? 0, max_grade: cls.max_grade ?? 5,
      curricula: cls.curricula?.length ? cls.curricula : ['financial_literacy'],
      is_published: cls.is_published !== false,
    });
    setShowDialog(true);
  };

  const toggleCurriculum = (id, checked) => {
    setForm(p => {
      const next = checked ? [...p.curricula, id] : p.curricula.filter(c => c !== id);
      if (!next.length) { toast.error('At least one curriculum is required'); return p; }
      return { ...p, curricula: next };
    });
  };

  const save = async () => {
    if (!form.title || !form.scheduled_at) { toast.error('Title and date/time are required'); return; }
    const payload = {
      ...form,
      duration_minutes: parseInt(form.duration_minutes) || 60,
      min_grade: parseInt(form.min_grade), max_grade: parseInt(form.max_grade),
      scheduled_at: new Date(form.scheduled_at).toISOString(),
    };
    try {
      if (editing) {
        await axios.put(`${API}/admin/live-classes/${editing.class_id}`, payload);
        toast.success('Class updated');
      } else {
        await axios.post(`${API}/admin/live-classes`, payload);
        toast.success('Class scheduled');
      }
      setShowDialog(false);
      fetchClasses();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save class');
    }
  };

  const remove = async (cls) => {
    if (!confirm(`Delete "${cls.title}"?`)) return;
    try {
      await axios.delete(`${API}/admin/live-classes/${cls.class_id}`);
      toast.success('Class deleted');
      fetchClasses();
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  const fmt = (iso) => new Date(iso).toLocaleString('en-IN', { timeZone: IST, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
  const gradeLabel = (g) => GRADES.find(x => x.value === g)?.label || g;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="p-2 rounded-full hover:bg-gray-100"><ChevronLeft className="w-6 h-6" /></Link>
            <div className="flex items-center gap-2">
              <CalendarDays className="w-7 h-7 text-[#EE6C4D]" />
              <div>
                <h1 className="text-xl font-bold text-gray-800">Live Classes</h1>
                <p className="text-sm text-gray-500">Schedule grade &amp; curriculum-specific sessions</p>
              </div>
            </div>
          </div>
          <Button onClick={openCreate} data-testid="add-class-btn"><Plus className="w-4 h-4 mr-1" /> Schedule Class</Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {loading ? (
          <p className="text-center py-16 text-gray-400">Loading…</p>
        ) : classes.length === 0 ? (
          <div className="text-center py-16">
            <Video className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No classes scheduled yet. Click "Schedule Class" to add one.</p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="admin-class-list">
            {classes.map(cls => (
              <div key={cls.class_id} className="bg-white rounded-xl border p-4 flex items-start justify-between gap-4" data-testid={`admin-class-${cls.class_id}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-gray-800">{cls.title}</h3>
                    {!cls.is_published && <span className="text-[10px] font-bold bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">DRAFT</span>}
                    {cls.recording_url && <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1"><PlayCircle className="w-3 h-3" /> Recording</span>}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{fmt(cls.scheduled_at)} · {cls.duration_minutes} min</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Grades {gradeLabel(cls.min_grade)}–{gradeLabel(cls.max_grade)} · {cls.curricula?.map(c => CURRICULA.find(x => x.id === c)?.name || c).join(', ')}
                  </p>
                  {cls.brief && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{cls.brief}</p>}
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => openEdit(cls)} data-testid={`edit-class-${cls.class_id}`}><Edit2 className="w-4 h-4" /></Button>
                  <Button variant="outline" size="sm" onClick={() => remove(cls)} className="text-red-600 hover:bg-red-50" data-testid={`delete-class-${cls.class_id}`}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Class' : 'Schedule a Class'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Title *</label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Intro to Saving Money" data-testid="class-title-input" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">What this class covers</label>
              <Textarea value={form.brief} onChange={e => setForm(p => ({ ...p, brief: e.target.value }))} rows={3} placeholder="A short brief for kids and parents" data-testid="class-brief-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Date &amp; time *</label>
                <Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))} data-testid="class-datetime-input" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Duration (min)</label>
                <Input type="number" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: e.target.value }))} data-testid="class-duration-input" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Meeting link (Zoom / Google Meet)</label>
              <Input value={form.meeting_link} onChange={e => setForm(p => ({ ...p, meeting_link: e.target.value }))} placeholder="https://meet.google.com/..." data-testid="class-link-input" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Recording link (add after class)</label>
              <Input value={form.recording_url} onChange={e => setForm(p => ({ ...p, recording_url: e.target.value }))} placeholder="YouTube / Drive / Vimeo URL" data-testid="class-recording-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Min grade</label>
                <Select value={String(form.min_grade)} onValueChange={v => setForm(p => ({ ...p, min_grade: parseInt(v) }))}>
                  <SelectTrigger data-testid="class-min-grade"><SelectValue /></SelectTrigger>
                  <SelectContent>{GRADES.map(g => <SelectItem key={g.value} value={String(g.value)}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Max grade</label>
                <Select value={String(form.max_grade)} onValueChange={v => setForm(p => ({ ...p, max_grade: parseInt(v) }))}>
                  <SelectTrigger data-testid="class-max-grade"><SelectValue /></SelectTrigger>
                  <SelectContent>{GRADES.map(g => <SelectItem key={g.value} value={String(g.value)}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Curriculum</label>
              <div className="flex flex-col gap-2 mt-1">
                {CURRICULA.map(c => (
                  <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer" data-testid={`class-curriculum-${c.id}`}>
                    <input type="checkbox" checked={form.curricula.includes(c.id)} onChange={e => toggleCurriculum(c.id, e.target.checked)} className="w-4 h-4 rounded" />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer" data-testid="class-published-toggle">
              <input type="checkbox" checked={form.is_published} onChange={e => setForm(p => ({ ...p, is_published: e.target.checked }))} className="w-4 h-4 rounded" />
              Published (visible to students &amp; parents)
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button onClick={save} disabled={!form.title || !form.scheduled_at} data-testid="save-class-btn">{editing ? 'Update' : 'Schedule'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
