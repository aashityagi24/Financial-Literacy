import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Briefcase, Heart, Clock, BookOpen, Check, Coins, Star, X, Sparkles } from 'lucide-react';
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

const FAMILY_EXAMPLES = ['Keeping my room clean', 'Setting the table', 'Putting clothes away', 'Feeding the pet'];
const PAYDAY_EXAMPLES = ['Watering plants', 'Cleaning the car', 'Helping with dishes', 'Organizing shelves'];

const renderMarkdown = (text) => {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('###')) {
      return <h3 key={i} className="text-white font-bold text-base mt-3 mb-1" style={{ fontFamily: 'Fredoka' }}>{line.replace(/^###\s*/, '')}</h3>;
    }
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j} className="text-white">{part.slice(2, -2)}</strong>;
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
  const [newJob, setNewJob] = useState({ activity: '', frequency: 'daily' });
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
      setNewJob({ activity: '', frequency: 'daily' });
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
    if (job.status === 'approved') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#06D6A0] text-white font-bold tracking-wide uppercase">Approved</span>;
    if (job.status === 'rejected') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EE6C4D] text-white font-bold tracking-wide uppercase">Not approved</span>;
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FFD23F] text-[#1D3557] font-bold tracking-wide uppercase">Pending</span>;
  };

  const getFreqLabel = (val) => FREQUENCIES.find(f => f.value === val)?.label || val;

  const renderJobCard = (job) => (
    <div key={job.job_id} className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 flex items-start gap-3 shadow-sm border border-white/50" data-testid={`job-card-${job.job_id}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${job.job_type === 'family' ? 'bg-[#EE6C4D]' : 'bg-[#FFD23F]'}`}>
        {job.job_type === 'family' ? <Heart className="w-4 h-4 text-white" /> : <Coins className="w-4 h-4 text-[#1D3557]" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-bold text-[#1D3557] text-sm">{job.activity}</h4>
          {getStatusBadge(job)}
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-[#3D5A80]">
          <Clock className="w-3 h-3" />
          <span>{getFreqLabel(job.frequency)}</span>
          {job.job_type === 'payday' && job.payment_amount > 0 && (
            <span className="text-[#06D6A0] font-bold ml-1">₹{job.payment_amount}/week</span>
          )}
        </div>
      </div>
      {(job.status === 'pending' || job.status === 'rejected') && (
        <button onClick={() => handleDelete(job.job_id)} className="text-[#1D3557]/30 hover:text-[#EE6C4D] flex-shrink-0 p-1 transition-colors" data-testid={`delete-job-${job.job_id}`}>
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  const renderAddForm = (type) => {
    const examples = type === 'family' ? FAMILY_EXAMPLES : PAYDAY_EXAMPLES;
    const accentColor = type === 'family' ? '#EE6C4D' : '#FFD23F';
    const accentBg = type === 'family' ? 'bg-[#EE6C4D]' : 'bg-[#FFD23F]';

    return (
      <div className="bg-white rounded-2xl p-5 shadow-md border-2 border-[#1D3557]/10 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-[#1D3557] text-sm" style={{ fontFamily: 'Fredoka' }}>
            New {type === 'family' ? 'Family' : 'Payday'} Job
          </h4>
          <button onClick={() => setAdding(null)} className="text-[#3D5A80] hover:text-[#1D3557] p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <Input
          placeholder="What will you do?"
          value={newJob.activity}
          onChange={(e) => setNewJob(p => ({ ...p, activity: e.target.value }))}
          className="border-2 border-[#1D3557]/15 rounded-xl h-11 text-sm focus:border-[#1D3557]/40"
          data-testid="job-activity-input"
          autoFocus
        />

        {/* Quick suggestions */}
        {!newJob.activity && (
          <div className="flex flex-wrap gap-1.5">
            {examples.map((ex) => (
              <button
                key={ex}
                onClick={() => setNewJob(p => ({ ...p, activity: ex }))}
                className="text-xs px-3 py-1.5 rounded-full bg-[#1D3557]/5 text-[#3D5A80] hover:bg-[#1D3557]/10 hover:text-[#1D3557] transition-colors font-medium"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        <Select value={newJob.frequency} onValueChange={(v) => setNewJob(p => ({ ...p, frequency: v }))}>
          <SelectTrigger className="border-2 border-[#1D3557]/15 rounded-xl h-11 text-sm" data-testid="job-frequency-select">
            <SelectValue placeholder="How often?" />
          </SelectTrigger>
          <SelectContent>
            {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Button
          onClick={handleAdd}
          className={`w-full ${accentBg} hover:opacity-90 ${type === 'family' ? 'text-white' : 'text-[#1D3557]'} rounded-xl h-11 font-bold text-sm`}
          data-testid="job-add-btn"
        >
          <Check className="w-4 h-4 mr-2" /> Add {type === 'family' ? 'Family' : 'Payday'} Job
        </Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#E0FBFC] flex flex-col">
      {/* Header area */}
      <div className="bg-[#1D3557] px-4 pt-4 pb-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <Link to="/dashboard" className="text-white/60 hover:text-white p-1 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Fredoka' }}>My Jobs</h1>
            <button
              onClick={() => setShowGuide(!showGuide)}
              className={`ml-auto text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 transition-all ${showGuide ? 'bg-white text-[#1D3557]' : 'bg-white/15 text-white/90 hover:bg-white/25'}`}
            >
              <BookOpen className="w-3 h-3" /> Guide
            </button>
          </div>

          {/* Guidebook */}
          {showGuide && (
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 mb-4 text-sm text-white/80 border border-white/10">
              {renderMarkdown(guidebook)}
            </div>
          )}

          {/* Intro */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FFD23F] flex items-center justify-center flex-shrink-0">
                <Star className="w-4 h-4 text-[#1D3557]" />
              </div>
              <div>
                <h2 className="font-bold text-white text-sm mb-0.5" style={{ fontFamily: 'Fredoka' }}>What is a Job?</h2>
                <p className="text-xs text-white/70 leading-relaxed">
                  A job is something you do regularly at home. Some jobs are for the family (no pay), and some earn you money. You can add up to 3 of each!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="bg-[#E0FBFC] rounded-t-[2rem] -mt-4 px-4 pt-6 pb-8 flex-1">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Family Jobs Section */}
          <div className="bg-gradient-to-br from-[#FFF1EE] to-[#FFE4DE] rounded-2xl p-5 border border-[#EE6C4D]/15" data-testid="family-jobs-section">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-[#EE6C4D] flex items-center justify-center">
                <Heart className="w-3.5 h-3.5 text-white" />
              </div>
              <h2 className="text-base font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Family Jobs</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EE6C4D]/15 text-[#EE6C4D] font-bold">{familyJobs.length}/3</span>
            </div>
            <p className="text-xs text-[#3D5A80] mb-3 ml-9">Things I do because I'm part of the family — no pay needed!</p>

            <div className="space-y-2">
              {familyJobs.map(renderJobCard)}

              {adding === 'family' ? (
                renderAddForm('family')
              ) : (
                familyJobs.length < 3 && (
                  <button
                    onClick={() => { setAdding('family'); setNewJob({ activity: '', frequency: 'daily' }); }}
                    className="w-full py-3 rounded-xl border-2 border-dashed border-[#EE6C4D]/30 text-[#EE6C4D] font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/60 transition-colors"
                    data-testid="add-family-job-btn"
                  >
                    <Plus className="w-4 h-4" /> Add Family Job
                  </button>
                )
              )}
            </div>
          </div>

          {/* Payday Jobs Section */}
          <div className="bg-gradient-to-br from-[#FFF9E6] to-[#FFF3CC] rounded-2xl p-5 border border-[#FFD23F]/20" data-testid="payday-jobs-section">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-[#FFD23F] flex items-center justify-center">
                <Coins className="w-3.5 h-3.5 text-[#1D3557]" />
              </div>
              <h2 className="text-base font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Payday Jobs</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FFD23F]/30 text-[#B8860B] font-bold">{paydayJobs.length}/3</span>
            </div>
            <p className="text-xs text-[#3D5A80] mb-3 ml-9">Extra tasks that earn me money every week</p>

            <div className="space-y-2">
              {paydayJobs.map(renderJobCard)}

              {adding === 'payday' ? (
                renderAddForm('payday')
              ) : (
                paydayJobs.length < 3 && (
                  <button
                    onClick={() => { setAdding('payday'); setNewJob({ activity: '', frequency: 'daily' }); }}
                    className="w-full py-3 rounded-xl border-2 border-dashed border-[#FFD23F]/50 text-[#B8860B] font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/60 transition-colors"
                    data-testid="add-payday-job-btn"
                  >
                    <Plus className="w-4 h-4" /> Add Payday Job
                  </button>
                )
              )}
            </div>
          </div>

          {/* Tip card at bottom */}
          <div className="bg-[#1D3557]/5 rounded-2xl p-4 flex items-start gap-3 border border-[#1D3557]/8">
            <Sparkles className="w-5 h-5 text-[#3D5A80] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-[#3D5A80] leading-relaxed">
                <strong className="text-[#1D3557]">Tip:</strong> Talk to your parents about which jobs you'd like to do. Family jobs teach responsibility, and payday jobs help you earn and save!
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
