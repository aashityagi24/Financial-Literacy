import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Briefcase, Heart, Clock, BookOpen, Check } from 'lucide-react';
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

export default function MyJobsPage({ user }) {
  const [familyJobs, setFamilyJobs] = useState([]);
  const [paydayJobs, setPaydayJobs] = useState([]);
  const [guidebook, setGuidebook] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [newJob, setNewJob] = useState({ activity: '', frequency: 'daily', job_type: 'family' });
  const [adding, setAdding] = useState(null); // 'family' | 'payday' | null

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
    <div key={job.job_id} className="bg-white rounded-xl border-2 border-[#1D3557] p-4 flex items-start gap-3" data-testid={`job-card-${job.job_id}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${job.job_type === 'family' ? 'bg-[#E0FBFC]' : 'bg-[#FFD23F]/30'}`}>
        {job.job_type === 'family' ? <Heart className="w-5 h-5 text-[#EE6C4D]" /> : <Briefcase className="w-5 h-5 text-[#1D3557]" />}
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
        <button onClick={() => handleDelete(job.job_id)} className="text-red-400 hover:text-red-600 flex-shrink-0" data-testid={`delete-job-${job.job_id}`}>
          <Trash2 className="w-4 h-4" />
        </button>
      ) : null}
    </div>
  );

  const renderAddForm = () => (
    <div className="bg-[#F8F9FA] rounded-xl border-2 border-dashed border-[#3D5A80] p-4 space-y-3">
      <Input
        placeholder={adding === 'family' ? "e.g. Keeping my room clean" : "e.g. Watering the plants"}
        value={newJob.activity}
        onChange={(e) => setNewJob(p => ({ ...p, activity: e.target.value }))}
        className="border-2 border-[#1D3557]/30"
        data-testid="job-activity-input"
      />
      <Select value={newJob.frequency} onValueChange={(v) => setNewJob(p => ({ ...p, frequency: v }))}>
        <SelectTrigger className="border-2 border-[#1D3557]/30" data-testid="job-frequency-select">
          <SelectValue placeholder="How often?" />
        </SelectTrigger>
        <SelectContent>
          {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Button onClick={handleAdd} className="bg-[#06D6A0] hover:bg-[#05C493] text-white" data-testid="job-add-btn">
          <Check className="w-4 h-4 mr-1" /> Add
        </Button>
        <Button variant="outline" onClick={() => setAdding(null)}>Cancel</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E0FBFC] to-[#C1E8F0] p-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/dashboard" className="text-[#3D5A80] hover:text-[#1D3557]">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>My Jobs</h1>
        <button onClick={() => setShowGuide(!showGuide)} className="ml-auto text-sm px-3 py-1 rounded-full bg-[#3D5A80] text-white font-bold flex items-center gap-1">
          <BookOpen className="w-3 h-3" /> Guide
        </button>
      </div>

      {showGuide && (
        <div className="bg-white rounded-2xl border-2 border-[#1D3557] p-5 mb-6 prose prose-sm max-w-none text-[#3D5A80]">
          {guidebook.split('\n').map((line, i) => {
            if (line.startsWith('###')) return <h3 key={i} className="text-[#1D3557] font-bold text-lg mt-3 mb-1" style={{ fontFamily: 'Fredoka' }}>{line.replace(/^###\s*/, '')}</h3>;
            if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-bold text-[#1D3557] mt-2">{line.replace(/\*\*/g, '')}</p>;
            if (line.trim()) return <p key={i} className="mb-1">{line}</p>;
            return null;
          })}
        </div>
      )}

      {/* Family Jobs */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Heart className="w-5 h-5 text-[#EE6C4D]" />
          <h2 className="text-lg font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Family Jobs</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#EE6C4D]/20 text-[#EE6C4D] font-bold">{familyJobs.length}/3</span>
        </div>
        <p className="text-sm text-[#3D5A80] mb-3">Things I do because I am part of the family</p>
        <div className="space-y-3">
          {familyJobs.map(renderJobCard)}
          {adding === 'family' && renderAddForm()}
          {familyJobs.length < 3 && adding !== 'family' && (
            <button
              onClick={() => setAdding('family')}
              className="w-full py-3 rounded-xl border-2 border-dashed border-[#EE6C4D]/40 text-[#EE6C4D] font-bold flex items-center justify-center gap-2 hover:bg-[#EE6C4D]/5"
              data-testid="add-family-job-btn"
            >
              <Plus className="w-4 h-4" /> Add Family Job
            </button>
          )}
        </div>
      </div>

      {/* Payday Jobs */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="w-5 h-5 text-[#1D3557]" />
          <h2 className="text-lg font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Payday Jobs</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#FFD23F]/40 text-[#1D3557] font-bold">{paydayJobs.length}/3</span>
        </div>
        <p className="text-sm text-[#3D5A80] mb-3">Extra jobs that earn me money every week</p>
        <div className="space-y-3">
          {paydayJobs.map(renderJobCard)}
          {adding === 'payday' && renderAddForm()}
          {paydayJobs.length < 3 && adding !== 'payday' && (
            <button
              onClick={() => setAdding('payday')}
              className="w-full py-3 rounded-xl border-2 border-dashed border-[#FFD23F]/60 text-[#1D3557] font-bold flex items-center justify-center gap-2 hover:bg-[#FFD23F]/10"
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
