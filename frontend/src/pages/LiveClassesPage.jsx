import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import {
  Calendar, ChevronLeft, Clock, Video, PlayCircle, Radio, CalendarDays
} from 'lucide-react';
import { useFirstVisitAnimation } from '@/hooks/useFirstVisitAnimation';

const IST = 'Asia/Kolkata';

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { timeZone: IST, weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-IN', { timeZone: IST, hour: 'numeric', minute: '2-digit', hour12: true });

const classStatus = (cls) => {
  const start = new Date(cls.scheduled_at).getTime();
  const end = start + (cls.duration_minutes || 60) * 60000;
  const now = Date.now();
  if (now < start) return 'upcoming';
  if (now <= end) return 'live';
  return 'past';
};

export default function LiveClassesPage({ user }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const showAnimations = useFirstVisitAnimation('calendar');

  useEffect(() => { fetchClasses(); }, []);

  const fetchClasses = async () => {
    try {
      const res = await axios.get(`${API}/live-classes`);
      setClasses(res.data || []);
      setError(false);
    } catch (e) {
      console.error('Failed to load classes:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const getBackLink = () => {
    if (user?.role === 'parent') return '/parent-dashboard';
    return '/dashboard';
  };

  const upcoming = classes.filter(c => classStatus(c) !== 'past');
  const past = classes
    .filter(c => classStatus(c) === 'past')
    .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at));

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F1FAFF] to-[#E7F3FA]">
      {/* Header */}
      <header className="bg-[#1D3557] text-white sticky top-0 z-20 shadow-md">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Link to={getBackLink()} className="p-2 rounded-full hover:bg-white/10 transition-colors" data-testid="calendar-back-btn">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-[#FFD23F]" />
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold leading-tight">Live Classes</h1>
              <p className="text-white/70 text-sm">Join live and catch up on recordings</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl">
        {loading ? (
          <div className="text-center py-16 text-[#1D3557]/60" data-testid="calendar-loading">Loading your classes…</div>
        ) : error ? (
          <div className="text-center py-16" data-testid="calendar-error">
            <p className="text-[#1D3557] font-semibold">We couldn't load your classes.</p>
            <button onClick={() => { setLoading(true); fetchClasses(); }} className="mt-3 px-4 py-2 rounded-xl bg-[#1D3557] text-white font-bold text-sm" data-testid="calendar-retry-btn">Try again</button>
          </div>
        ) : classes.length === 0 ? (
          <div className="text-center py-16" data-testid="calendar-empty">
            <div className="w-20 h-20 mx-auto rounded-full bg-[#FFD23F]/30 flex items-center justify-center mb-4">
              <Calendar className="w-10 h-10 text-[#1D3557]" />
            </div>
            <h2 className="text-lg font-bold text-[#1D3557]">No classes scheduled yet</h2>
            <p className="text-[#1D3557]/60 text-sm mt-1">Check back soon — your teacher will add live classes here.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Upcoming / Live */}
            <section data-testid="upcoming-classes">
              <h2 className="text-base font-bold text-[#1D3557] mb-3 flex items-center gap-2">
                <Radio className="w-5 h-5 text-[#EE6C4D]" /> Upcoming & Live
              </h2>
              {upcoming.length === 0 ? (
                <p className="text-sm text-[#1D3557]/50 bg-white/60 rounded-2xl p-4">No upcoming classes right now.</p>
              ) : (
                <div className="space-y-3">
                  {upcoming.map((cls, i) => {
                    const status = classStatus(cls);
                    const isLive = status === 'live';
                    return (
                      <div
                        key={cls.class_id}
                        className={`bg-white rounded-2xl border-2 ${isLive ? 'border-[#EE6C4D]' : 'border-[#1D3557]/10'} shadow-sm p-4 ${showAnimations ? 'animate-in fade-in slide-in-from-bottom-2' : ''}`}
                        style={showAnimations ? { animationDelay: `${i * 60}ms` } : {}}
                        data-testid={`class-card-${cls.class_id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="flex-shrink-0 w-14 text-center bg-[#3D5A80] text-white rounded-xl py-2">
                              <div className="text-[10px] uppercase tracking-wide opacity-80">{fmtDate(cls.scheduled_at).split(' ')[0]}</div>
                              <div className="text-lg font-extrabold leading-none">{new Date(cls.scheduled_at).toLocaleDateString('en-IN', { timeZone: IST, day: 'numeric' })}</div>
                              <div className="text-[10px] opacity-80">{new Date(cls.scheduled_at).toLocaleDateString('en-IN', { timeZone: IST, month: 'short' })}</div>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-[#1D3557] truncate">{cls.title}</h3>
                                {isLive && <span className="text-[10px] font-bold text-white bg-[#EE6C4D] px-2 py-0.5 rounded-full animate-pulse">LIVE NOW</span>}
                              </div>
                              <p className="text-xs text-[#1D3557]/60 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3.5 h-3.5" /> {fmtTime(cls.scheduled_at)} · {cls.duration_minutes || 60} min
                              </p>
                              {cls.brief && <p className="text-sm text-[#1D3557]/80 mt-2">{cls.brief}</p>}
                            </div>
                          </div>
                        </div>
                        {cls.meeting_link && (
                          <a
                            href={cls.meeting_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-white transition-colors ${isLive ? 'bg-[#EE6C4D] hover:bg-[#E05A3A]' : 'bg-[#06D6A0] hover:bg-[#05C493]'}`}
                            data-testid={`class-join-${cls.class_id}`}
                          >
                            <Video className="w-4 h-4" /> {isLive ? 'Join Now' : 'Join'}
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Past + recordings */}
            {past.length > 0 && (
              <section data-testid="past-classes">
                <h2 className="text-base font-bold text-[#1D3557] mb-3 flex items-center gap-2">
                  <PlayCircle className="w-5 h-5 text-[#9B5DE5]" /> Past Classes
                </h2>
                <div className="space-y-3">
                  {past.map((cls) => (
                    <div key={cls.class_id} className="bg-white/80 rounded-2xl border-2 border-[#1D3557]/10 p-4" data-testid={`class-card-${cls.class_id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-bold text-[#1D3557] truncate">{cls.title}</h3>
                          <p className="text-xs text-[#1D3557]/60 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3.5 h-3.5" /> {fmtDate(cls.scheduled_at)} · {fmtTime(cls.scheduled_at)}
                          </p>
                          {cls.brief && <p className="text-sm text-[#1D3557]/70 mt-2">{cls.brief}</p>}
                        </div>
                      </div>
                      {cls.recording_url ? (
                        <a
                          href={cls.recording_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-white bg-[#9B5DE5] hover:bg-[#8A4FD4] transition-colors"
                          data-testid={`class-recording-${cls.class_id}`}
                        >
                          <PlayCircle className="w-4 h-4" /> Watch Recording
                        </a>
                      ) : (
                        <p className="mt-3 text-xs text-[#1D3557]/40 italic">Recording coming soon</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
