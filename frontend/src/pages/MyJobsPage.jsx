import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Briefcase, Heart, Clock, BookOpen, Check, Coins, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const FREQUENCIES = [
  { value: 'daily', label: 'Every day' },
  { value: 'twice_week', label: 'Twice a week' },
  { value: 'three_week', label: 'Three times a week' },
  { value: 'weekly', label: 'Once a week' },
  { value: 'as_needed', label: 'As needed' },
];

const renderMarkdown = (text) => {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('###')) {
      return <h3 key={i} className="text-[#1D3557] font-bold text-base mt-3 mb-1" style={{ fontFamily: 'Fredoka' }}>{line.replace(/^###\s*/, '')}</h3>;
    }
    // Replace inline **bold** with <strong>
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j} className="text-[#1D3557]">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
    if (line.trim()) return <p key={i} className="mb-1">{rendered}</p>;
    return null;
  });
};

export default function MyJobsPage({ user }) {
  const [familyJobs, setFamilyJobs] = useState([]);
  const [paydayJobs, setPaydayJobs] = useState([]);
  const [guidebook, setGuidebook] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [newJob, setNewJob] = useState({ activity: '', frequency: 'daily', job_type: 'family' });
  const [adding, setAdding] = useState(null);

  useEffect(() => { fetchJobs(); fetchGuide(); }, []);

  const fetchJobs = async () => {
    try {
      const res = await axios.get(`${API}/child/jobs`);
      setFamilyJobs(res.data.family_jobs);
      setPaydayJobs(res.data.payday_jobs);
    } catch (err) { console.error(err); }
  };

  const fetchGuide = async () => {
    try {
      const res = await axios.get(`${API}/jobs/guidebook`);
      setGuidebook(res.data.child_guide || '');
    } catch (err) { console.error(err); }
  };

  const handleAdd = async () => {
    if (!newJob.activity.trim()) { toast.error('Please enter an activity'); return; }
    try {
      await axios.post(`${API}/child/jobs`, {
        activity: newJob.activity,
        frequency: newJob.frequency,
        job_type: adding
      });
      toast.success('Job added!');
      setNewJob({ activity: '', frequency: 'daily', job_type: 'family' });
      setAdding(null);
      fetchJobs();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add job');
    }
  };

  const handleDelete = async (jobId) => {
    try {
      await axios.delete(`${API}/child/jobs/${jobId}`);
      toast.success('Job removed');
      fetchJobs();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Cannot delete');
    }
  };

  const getStatusBadge = (job) => {
    if (job.status === 'approved') return <span className="text-xs px-2 py-0.5 rounded-full bg-[#06D6A0] text-white font-bold">Approved</span>;
    if (job.status === 'rejected') return <span className="text-xs px-2 py-0.5 rounded-full bg-[#EE6C4D] text-white font-bold">Not approved</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full bg-[#FFD23F] text-[#1D3557] font-bold">Waiting for parent</span>;
  };

  const getFreqLabel = (val) => FREQUENCIES.find(f => f.value === val)?.label || val;

  const renderJobCard = (job) => (
    <div key={job.job_id} className="bg-white rounded-2xl border-2 border-[#1D3557]/15 p-4 flex items-start gap-3 shadow-sm hover:shadow-md transition-shadow" data-testid={`job-card-${job.job_id}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${job.job_type === 'family' ? 'bg-rose-50 border border-rose-200' : 'bg-amber-50 border border-amber-200'}`}>
        {job.job_type === 'family' ? <Heart className="w-5 h-5 text-rose-400" /> : <Coins className="w-5 h-5 text-amber-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-bold text-[#1D3557]">{job.activity}</h4>
          {getStatusBadge(job)}
        </div>
        <div className="flex items-center gap-2 mt-1 text-sm text-[#3D5A80]">
          <Clock className="w-3 h-3" />
          <span>{getFreqLabel(job.frequency)}</span>
          {job.job_type === 'payday' && job.payment_amount > 0 && (
            <span className="text-[#06D6A0] font-bold ml-2">₹{job.payment_amount}/week</span>
          )}
        </div>
      </div>
      {job.status === 'pending' || job.status === 'rejected' ? (
        <button onClick={() => handleDelete(job.job_id)} className="text-red-300 hover:text-red-500 flex-shrink-0 p-1" data-testid={`delete-job-${job.job_id}`}>
          <Trash2 className="w-4 h-4" />
        </button>
      ) : null}
    </div>
  );

  const renderAddForm = () => (
    <div className="bg-white rounded-2xl border-2 border-dashed border-[#3D5A80]/30 p-4 space-y-3">
      <Input
        placeholder={adding === 'family' ? "e.g. Keeping my room clean" : "e.g. Watering the plants"}
        value={newJob.activity}
        onChange={(e) => setNewJob(p => ({ ...p, activity: e.target.value }))}
        className="border-2 border-[#1D3557]/20 rounded-xl bg-[#F8FAFB]"
        data-testid="job-activity-input"
      />
      <Select value={newJob.frequency} onValueChange={(v) => setNewJob(p => ({ ...p, frequency: v }))}>
        <SelectTrigger className="border-2 border-[#1D3557]/20 rounded-xl bg-[#F8FAFB]" data-testid="job-frequency-select">
          <SelectValue placeholder="How often?" />
        </SelectTrigger>
        <SelectContent>
          {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Button onClick={handleAdd} className="bg-[#1D3557] hover:bg-[#2D4A6F] text-white rounded-xl" data-testid="job-add-btn">
          <Check className="w-4 h-4 mr-1" /> Add
        </Button>
        <Button variant="outline" onClick={() => setAdding(null)} className="rounded-xl">Cancel</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5F7FA] p-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/dashboard" className="text-[#3D5A80] hover:text-[#1D3557] p-1">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>My Jobs</h1>
        <button
          onClick={() => setShowGuide(!showGuide)}
          className={`ml-auto text-sm px-4 py-1.5 rounded-full font-bold flex items-center gap-1.5 transition-colors ${showGuide ? 'bg-[#1D3557] text-white' : 'bg-white text-[#3D5A80] border-2 border-[#1D3557]/20 hover:border-[#1D3557]/40'}`}
        >
          <BookOpen className="w-3.5 h-3.5" /> Guide
        </button>
      </div>

      {/* Guidebook */}
      {showGuide && (
        <div className="bg-white rounded-2xl border-2 border-[#1D3557]/10 p-5 mb-6 text-sm text-[#3D5A80] shadow-sm">
          {renderMarkdown(guidebook)}
        </div>
      )}

      {/* Intro */}
      <div className="bg-white rounded-2xl border-2 border-[#1D3557]/10 p-5 mb-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFD23F] flex items-center justify-center flex-shrink-0 border-2 border-[#1D3557]/10">
            <Star className="w-5 h-5 text-[#1D3557]" />
          </div>
          <div>
            <h2 className="font-bold text-[#1D3557] text-base mb-1" style={{ fontFamily: 'Fredoka' }}>What is a Job?</h2>
            <p className="text-sm text-[#3D5A80] leading-relaxed">
              A job is something you do regularly at home. Some jobs are things every family member does (Family Jobs), and some are extra tasks that earn you money (Payday Jobs). You can add up to 3 of each!
            </p>
          </div>
        </div>
      </div>

      {/* Family Jobs */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center">
            <Heart className="w-4 h-4 text-rose-400" />
          </div>
          <h2 className="text-lg font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Family Jobs</h2>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-500 font-bold border border-rose-200">{familyJobs.length}/3</span>
        </div>
        <p className="text-sm text-[#3D5A80] mb-3 ml-9">Things I do because I'm part of the family — no payment needed!</p>
        <div className="space-y-3">
          {familyJobs.map(renderJobCard)}
          {adding === 'family' && renderAddForm()}
          {familyJobs.length < 3 && adding !== 'family' && (
            <button
              onClick={() => setAdding('family')}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-rose-200 text-rose-400 font-bold flex items-center justify-center gap-2 hover:bg-rose-50/50 transition-colors"
              data-testid="add-family-job-btn"
            >
              <Plus className="w-4 h-4" /> Add Family Job
            </button>
          )}
        </div>
      </div>

      {/* Payday Jobs */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
            <Coins className="w-4 h-4 text-amber-500" />
          </div>
          <h2 className="text-lg font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Payday Jobs</h2>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-bold border border-amber-200">{paydayJobs.length}/3</span>
        </div>
        <p className="text-sm text-[#3D5A80] mb-3 ml-9">Extra tasks that earn me money every week</p>
        <div className="space-y-3">
          {paydayJobs.map(renderJobCard)}
          {adding === 'payday' && renderAddForm()}
          {paydayJobs.length < 3 && adding !== 'payday' && (
            <button
              onClick={() => setAdding('payday')}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-amber-200 text-amber-500 font-bold flex items-center justify-center gap-2 hover:bg-amber-50/50 transition-colors"
              data-testid="add-payday-job-btn"
            >
              <Plus className="w-4 h-4" /> Add Payday Job
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
