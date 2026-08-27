import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ArrowLeft, Rocket, Lightbulb, Users, Trophy, CalendarDays, Sparkles, Store, PiggyBank, Hammer,
  Video, Clock, GraduationCap, BookOpen, Layers, Mic, IndianRupee,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SiteHeader } from '@/components/SiteHeader';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { INDIA_STATES, getCitiesForState } from '@/data/indiaStatesCities';
import { trackMetaPixelPageView } from '@/utils/metaPixel';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const GRADE_LABELS = ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'];

const EMPTY_FORM = { parent_name: '', phone: '', email: '', child_name: '', child_grade: '', batch_id: '', state: '', city: '' };

const formatDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const highlights = [
  { icon: Lightbulb, title: "Idea to Pitch", description: "Kids dream up a business idea and learn to pitch it with confidence, just like real founders.", color: "#FFD23F" },
  { icon: Store, title: "Run a Mini Venture", description: "Simulate running a shop or venture — pricing, costs, profit — in a safe, game-based world.", color: "#EE6C4D" },
  { icon: Users, title: "Teamwork & Leadership", description: "Collaborate on group projects that build negotiation, leadership and communication skills.", color: "#06D6A0" },
  { icon: PiggyBank, title: "Smart Money Management", description: "Every founder starts with money basics. As kids grow, the focus shifts — from saving and earning, to deciding what to do with the profit they make.", color: "#3D5A80" },
];

// Age tracks. Grade numbers follow the platform-wide K=0..9 scale (backend
// content topics / live classes / Money Masters batches are tagged this way).
const TRACKS = [
  {
    id: 'kidpreneur',
    label: 'Kidpreneur',
    ageLabel: 'Ages 6–7',
    minGrade: 1,
    maxGrade: 2,
    description: "Money starts as a story: where it comes from, why we can't buy everything, and how saving in small jars turns a wish into a plan. Kids meet their first business idea through play.",
  },
  {
    id: 'youngpreneur',
    label: 'Youngpreneur',
    ageLabel: 'Ages 8–10',
    minGrade: 3,
    maxGrade: 5,
    description: "From pocket money to a plan: budgeting, smart spending choices, and the basics of running a mini venture — pricing a product, tracking costs and making a first real sale.",
  },
  {
    id: 'teenpreneur',
    label: 'Teenpreneur',
    ageLabel: 'Ages 11–14',
    minGrade: 6,
    maxGrade: 9,
    description: "Building a real founder mindset: market research, pitching to investors, managing a venture's finances, and the money habits (saving, investing, credit) that carry into adulthood.",
  },
];

const OVERVIEW_POINTS = [
  { icon: Users, title: "Group Sessions", description: "Learn financial literacy and entrepreneurship with a batch of peers." },
  { icon: Video, title: "Teacher-Led Sessions", description: "Real-time interaction and feedback from a dedicated instructor." },
  { icon: Clock, title: "60 Minutes Per Session", description: "Focused, deep-dive live classes that hold attention start to finish." },
  { icon: GraduationCap, title: "Small Batch Sizes", description: "Personal attention for every child in every live class." },
];

export default function EntrepreneurshipWorkshopPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [batches, setBatches] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState(TRACKS[0].id);
  const [trackDetailTab, setTrackDetailTab] = useState('overview');
  const [curriculumByTrack, setCurriculumByTrack] = useState({});
  const [curriculumLoading, setCurriculumLoading] = useState(false);

  useEffect(() => { trackMetaPixelPageView(); }, []);

  useEffect(() => {
    axios.get(`${API}/subscriptions/money-masters/public-batches`)
      .then((res) => setBatches(res.data || []))
      .catch(() => setBatches([]));
  }, []);

  useEffect(() => {
    if (searchParams.get('trial') === '1') {
      setForm(EMPTY_FORM);
      setDialogOpen(true);
      window.history.replaceState({}, '', '/entrepreneurship-workshop');
    }
  }, [searchParams]);

  const activeTrack = TRACKS.find((t) => t.id === selectedTrack);

  useEffect(() => {
    if (trackDetailTab !== 'lessons' || curriculumByTrack[selectedTrack]) return;
    setCurriculumLoading(true);
    axios.get(`${API}/subscriptions/money-masters/public-curriculum`, {
      params: { min_grade: activeTrack.minGrade, max_grade: activeTrack.maxGrade },
    })
      .then((res) => setCurriculumByTrack((p) => ({ ...p, [selectedTrack]: res.data || [] })))
      .catch(() => setCurriculumByTrack((p) => ({ ...p, [selectedTrack]: [] })))
      .finally(() => setCurriculumLoading(false));
  }, [trackDetailTab, selectedTrack]);

  const activeLessons = curriculumByTrack[selectedTrack];

  const batchesByGrade = GRADE_LABELS.map((label, grade) => ({
    grade, label, items: batches.filter((b) => (b.grades || []).includes(grade)),
  })).filter((g) => g.items.length > 0);

  const openTrialForm = (batch = null, grade = null) => {
    setForm({ ...EMPTY_FORM, batch_id: batch?.batch_id || '', child_grade: batch ? String(grade ?? batch.grades[0]) : '' });
    setDialogOpen(true);
  };

  const eligibleBatches = form.child_grade === '' ? batches : batches.filter((b) => (b.grades || []).includes(parseInt(form.child_grade)));

  const submitTrial = async () => {
    if (!form.parent_name.trim()) { toast.error('Please enter your name'); return; }
    if (!form.phone.trim() || form.phone.replace(/\D/g, '').length < 10) { toast.error('Please enter a valid phone number'); return; }
    if (!form.email.trim() || !form.email.includes('@')) { toast.error('Please enter a valid email'); return; }
    if (form.child_grade === '') { toast.error("Please select your child's grade"); return; }
    if (!form.state) { toast.error('Please select your state'); return; }
    if (!form.city) { toast.error('Please select your city'); return; }
    setSubmitting(true);
    try {
      await axios.post(`${API}/subscriptions/money-masters/trial-enquiry`, {
        parent_name: form.parent_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        child_name: form.child_name.trim(),
        child_grade: parseInt(form.child_grade),
        batch_id: form.batch_id || null,
        state: form.state,
        city: form.city,
      });
      toast.success("Trial request sent! Our team will reach out to you shortly.");
      setDialogOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E0FBFC]">
      <SiteHeader />
      {/* Hero */}
      <header className="relative overflow-hidden bg-[#5B21B6]">
        <div className="absolute top-24 right-16 w-16 h-16 bg-[#FFD23F] rounded-full opacity-40 animate-float stagger-2"></div>
        <div className="absolute bottom-16 left-1/5 w-12 h-12 bg-[#06D6A0] rounded-full opacity-40 animate-float stagger-3"></div>

        <div className="container mx-auto px-6 pb-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center py-10">
            <div className="animate-bounce-in">
              <span className="inline-block bg-[#FFD23F] text-[#1D3557] font-bold text-sm px-4 py-1.5 rounded-full border-2 border-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
                ENTREPRENEURSHIP WORKSHOP
              </span>
              <h1 className="text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight" style={{ fontFamily: 'Fredoka' }}>
                Turn Big Ideas Into <span className="text-[#FFD23F]">Real Ventures!</span>
              </h1>
              <p className="text-xl text-white/85 mb-8 leading-relaxed">
                Your child could be running a real business by the end of this. 30 live classes where they earn actual money, price their first product, pitch to real buyers, and make their first sale — no textbooks, just doing.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button
                  data-testid="book-trial-hero-btn"
                  onClick={() => openTrialForm()}
                  className="bg-[#FFD23F] text-[#1D3557] hover:bg-[#FFD23F]/90 font-bold px-8 py-6 text-xl rounded-full border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557] hover:-translate-y-1 transition-all"
                >
                  <Sparkles className="w-6 h-6 mr-2" /> Book a Free Trial
                </Button>
                <a
                  href="#batches"
                  className="bg-white/10 text-white font-bold px-8 py-4 text-xl rounded-full border-3 border-white/40 hover:bg-white/20 transition-all flex items-center gap-2"
                >
                  <CalendarDays className="w-6 h-6" /> See Batches
                </a>
              </div>
            </div>

            <div className="relative animate-bounce-in stagger-2 max-w-md mx-auto lg:mx-0 lg:max-w-none">
              <div className="card-playful p-6 bg-white">
                <div className="w-full aspect-square rounded-2xl border-3 border-[#1D3557] overflow-hidden">
                  <img
                    data-testid="workshop-hero-image"
                    src="/workshop-hero.png"
                    alt="Child selling handmade cookies to a customer"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Highlights */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
              What Your Child Will Build
            </h2>
            <p className="text-xl text-[#3D5A80]">A hands-on, business-mindset program alongside CoinQuest's money skills</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {highlights.map((h, index) => (
              <div key={index} className="card-playful p-6 animate-bounce-in" style={{ animationDelay: `${index * 0.1}s` }}>
                <div
                  className="w-16 h-16 rounded-2xl border-3 border-[#1D3557] shadow-[3px_3px_0px_0px_#1D3557] flex items-center justify-center mb-4"
                  style={{ backgroundColor: h.color }}
                >
                  <h.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>{h.title}</h3>
                <p className="text-[#3D5A80]">{h.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Age Tracks */}
      <section className="py-20 bg-[#1D3557]" data-testid="ew-tracks-section">
        <div className="container mx-auto px-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
            <div>
              <h2 className="text-4xl lg:text-5xl font-bold text-white mb-3" style={{ fontFamily: 'Fredoka' }}>
                Choose Your Child's Track
              </h2>
              <p className="text-lg text-[#98C1D9] max-w-xl">A journey that grows with your child — from first coins to first pitch.</p>
            </div>
            <div className="max-w-full overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0 sm:self-start">
              <div className="inline-flex bg-white/10 rounded-full p-1.5 gap-1 w-max" data-testid="ew-track-tabs">
                {TRACKS.map((t) => (
                  <button
                    key={t.id}
                    data-testid={`ew-track-tab-${t.id}`}
                    onClick={() => { setSelectedTrack(t.id); setTrackDetailTab('overview'); }}
                    className={`px-5 py-2.5 rounded-full font-bold text-sm transition-all whitespace-nowrap ${
                      selectedTrack === t.id ? 'bg-[#FFD23F] text-[#1D3557]' : 'text-[#98C1D9] hover:text-white'
                    }`}
                    style={{ fontFamily: 'Fredoka' }}
                  >
                    {t.label} <span className="opacity-70 font-normal">{t.ageLabel}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="card-playful bg-white p-6 sm:p-10" data-testid="ew-track-detail">
            <div className="flex items-center gap-4 mb-6">
              <span className="inline-block bg-[#5B21B6]/10 text-[#5B21B6] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">{activeTrack.ageLabel}</span>
              <div className="inline-flex bg-[#E0FBFC] rounded-full p-1 gap-1">
                {[['overview', 'Overview', BookOpen], ['lessons', 'Lessons', Layers]].map(([id, label, Icon]) => (
                  <button
                    key={id}
                    data-testid={`ew-track-detail-tab-${id}`}
                    onClick={() => setTrackDetailTab(id)}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
                      trackDetailTab === id ? 'bg-[#1D3557] text-white' : 'text-[#3D5A80]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />{label}
                  </button>
                ))}
              </div>
            </div>

            {trackDetailTab === 'overview' ? (
              <div>
                <h3 className="text-2xl lg:text-3xl font-bold text-[#1D3557] mb-3" style={{ fontFamily: 'Fredoka' }}>{activeTrack.label}</h3>
                <p className="text-[#3D5A80] text-lg max-w-3xl mb-8">{activeTrack.description}</p>
                <div className="grid sm:grid-cols-2 gap-6">
                  {OVERVIEW_POINTS.map((p, i) => (
                    <div key={i} className="flex items-start gap-4" data-testid={`ew-overview-point-${i}`}>
                      <div className="w-12 h-12 rounded-xl bg-[#06D6A0]/20 border-2 border-[#1D3557] flex items-center justify-center flex-shrink-0">
                        <p.icon className="w-6 h-6 text-[#1D3557]" strokeWidth={2.5} />
                      </div>
                      <div>
                        <h4 className="font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>{p.title}</h4>
                        <p className="text-sm text-[#3D5A80]">{p.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div data-testid="ew-lessons-panel">
                <h3 className="text-2xl lg:text-3xl font-bold text-[#1D3557] mb-1" style={{ fontFamily: 'Fredoka' }}>{activeTrack.label} Curriculum</h3>
                <p className="text-[#3D5A80] mb-6">Topics your child will explore in this track.</p>
                {curriculumLoading ? (
                  <div className="py-10 text-center text-[#3D5A80]">Loading lessons...</div>
                ) : !activeLessons || activeLessons.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-[#3D5A80]/30 rounded-2xl" data-testid="ew-lessons-empty">
                    <Layers className="w-10 h-10 mx-auto text-[#3D5A80]/50 mb-3" />
                    <p className="text-[#3D5A80] font-medium">Detailed lessons for this track are being added — check back soon!</p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-5">
                    {activeLessons.map((topic) => (
                      <div key={topic.topic_id} className="rounded-2xl border-2 border-[#1D3557]/15 p-5 bg-[#E0FBFC]/40" data-testid={`ew-lesson-topic-${topic.topic_id}`}>
                        <h4 className="font-bold text-[#1D3557] mb-1 flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
                          <span>{topic.icon || '📚'}</span>{topic.title}
                        </h4>
                        {topic.description && <p className="text-sm text-[#3D5A80] mb-3">{topic.description}</p>}
                        {topic.subtopics?.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {topic.subtopics.map((st) => (
                              <span key={st.topic_id} className="text-xs font-semibold bg-white text-[#5B21B6] border border-[#5B21B6]/30 px-3 py-1 rounded-full">{st.title}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Batches */}
      <section id="batches" className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl lg:text-5xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
              Open Batches by Grade
            </h2>
            <p className="text-xl text-[#3D5A80] max-w-2xl mx-auto">Each batch includes its curriculum content and all scheduled live classes — no separate purchase.</p>
          </div>

          {batchesByGrade.length === 0 ? (
            <div className="max-w-md mx-auto text-center card-playful p-8 bg-white" data-testid="ew-no-batches">
              <CalendarDays className="w-12 h-12 mx-auto text-[#3D5A80] mb-3" />
              <p className="text-[#3D5A80] font-medium">New batches are being scheduled — book a free trial and we'll notify you the moment one opens for your child's grade.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto" data-testid="ew-batches-grid">
              {batchesByGrade.flatMap((g) => g.items.map((b) => (
                <div key={b.batch_id} className="card-playful p-6 bg-white flex flex-col" data-testid={`ew-batch-card-${b.batch_id}`}>
                  <span className="inline-block self-start bg-[#5B21B6]/10 text-[#5B21B6] text-xs font-bold px-3 py-1 rounded-full mb-3">{g.label}</span>
                  <h3 className="text-lg font-bold text-[#1D3557] mb-1" style={{ fontFamily: 'Fredoka' }}>{b.name}</h3>
                  <p className="text-sm text-[#3D5A80] flex items-center gap-1 mb-4">
                    <CalendarDays className="w-4 h-4" /> {formatDate(b.start_date)} – {formatDate(b.end_date)}
                  </p>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-2xl font-bold text-[#5B21B6]" style={{ fontFamily: 'Fredoka' }}>₹{b.price.toLocaleString('en-IN')}</span>
                    <Button
                      data-testid={`ew-book-trial-${b.batch_id}`}
                      onClick={() => openTrialForm(b, g.grade)}
                      className="bg-[#1D3557] hover:bg-[#2D4A6F] text-white rounded-full"
                    >
                      Book Free Trial
                    </Button>
                  </div>
                </div>
              )))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="card-playful p-12 bg-[#5B21B6] text-center">
            <PiggyBank className="w-14 h-14 mx-auto text-[#FFD23F] mb-4" />
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6" style={{ fontFamily: 'Fredoka' }}>
              Ready to Build Something Big?
            </h2>
            <p className="text-xl text-white/85 mb-8 max-w-2xl mx-auto">
              Book a free trial class and see the Entrepreneurship Workshop in action.
            </p>
            <Button
              data-testid="ew-cta-book-trial-btn"
              onClick={() => openTrialForm()}
              className="bg-[#FFD23F] text-[#1D3557] hover:bg-[#FFD23F]/90 font-bold text-xl px-10 py-6 rounded-full border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557] hover:-translate-y-1 transition-all"
            >
              Book a Free Trial
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1D3557] py-8">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            <div className="flex flex-col items-center md:items-start">
              <img
                src="https://customer-assets.emergentagent.com/job_6e7204b4-e7e4-42b3-b74e-111b68302b75/artifacts/ul81dgc9_Friendly%20%27Money%20Matter%27%20Logo%20Design%20%281%29.png"
                alt="CoinQuest Logo"
                className="h-36 w-auto"
              />
            </div>
            <div className="flex flex-col items-center md:items-start gap-3">
              <h3 className="text-white font-bold text-lg" style={{ fontFamily: 'Fredoka' }}>Contact Us</h3>
              <a href="mailto:hello@coinquest.co.in" className="text-[#98C1D9] hover:text-white transition-colors">hello@coinquest.co.in</a>
              <a href="tel:+919924117051" className="text-[#98C1D9] hover:text-white transition-colors">+91 9924117051</a>
            </div>
            <div className="flex flex-col items-center md:items-end gap-3">
              <p className="text-[#98C1D9] text-sm text-center md:text-right mt-2">
                © Learners' Planet<br/>
                Educating kids in fun and interactive ways!
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* Book a Free Trial Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" data-testid="trial-enquiry-dialog">
          <DialogHeader>
            <DialogTitle className="text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Book a Free Trial</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              data-testid="trial-parent-name-input"
              placeholder="Your Name"
              value={form.parent_name}
              onChange={(e) => setForm((p) => ({ ...p, parent_name: e.target.value }))}
            />
            <Input
              data-testid="trial-phone-input"
              placeholder="Phone Number"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            />
            <Input
              data-testid="trial-email-input"
              type="email"
              placeholder="Email Address"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            />
            <Input
              data-testid="trial-child-name-input"
              placeholder="Child's Name (optional)"
              value={form.child_name}
              onChange={(e) => setForm((p) => ({ ...p, child_name: e.target.value }))}
            />
            <Select value={form.state} onValueChange={(v) => setForm((p) => ({ ...p, state: v, city: '' }))}>
              <SelectTrigger data-testid="trial-state-select"><SelectValue placeholder="State" /></SelectTrigger>
              <SelectContent>
                {INDIA_STATES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={form.city} onValueChange={(v) => setForm((p) => ({ ...p, city: v }))} disabled={!form.state}>
              <SelectTrigger data-testid="trial-city-select"><SelectValue placeholder={form.state ? 'City' : 'Select a state first'} /></SelectTrigger>
              <SelectContent>
                {getCitiesForState(form.state).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={form.child_grade} onValueChange={(v) => setForm((p) => ({ ...p, child_grade: v, batch_id: '' }))}>
              <SelectTrigger data-testid="trial-grade-select"><SelectValue placeholder="Child's Grade" /></SelectTrigger>
              <SelectContent>
                {GRADE_LABELS.map((label, idx) => (
                  <SelectItem key={idx} value={String(idx)}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.child_grade !== '' && (
              <Select value={form.batch_id} onValueChange={(v) => setForm((p) => ({ ...p, batch_id: v }))}>
                <SelectTrigger data-testid="trial-batch-select"><SelectValue placeholder={eligibleBatches.length ? 'Preferred Batch (optional)' : 'No open batches for this grade yet'} /></SelectTrigger>
                <SelectContent>
                  {eligibleBatches.map((b) => (
                    <SelectItem key={b.batch_id} value={b.batch_id}>{b.name} (₹{b.price.toLocaleString('en-IN')})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              data-testid="submit-trial-enquiry-btn"
              onClick={submitTrial}
              disabled={submitting}
              className="w-full bg-[#5B21B6] hover:bg-[#4C1D95] text-white mt-2"
            >
              {submitting ? 'Sending...' : 'Request Free Trial'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
