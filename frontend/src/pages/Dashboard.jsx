import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { 
  Wallet, Store, TrendingUp, Target, Trophy, 
  User, LogOut, Flame, Gift, Sparkles, Home as HomeIcon,
  ChevronRight, Star, BookOpen, Shield, GraduationCap, Users, Award, Handshake, BookMarked, Briefcase, Heart, IndianRupee, CalendarDays
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useFirstVisitAnimation } from '@/hooks/useFirstVisitAnimation';
import NotificationCenter from '@/components/NotificationCenter';
import ClassmatesSection from '@/components/ClassmatesSection';
import DashboardFooter from '@/components/DashboardFooter';
import { ChildHomework } from '@/components/ChildHomework';
import { getDefaultAvatar } from '@/utils/avatars';
import { STORE_ENABLED, STOCKS_ENABLED, LENDING_ENABLED } from '@/config/features';

export default function Dashboard({ user, setUser }) {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [streak, setStreak] = useState({ streak: 0, reward: 0 });
  const [quests, setQuests] = useState([]);
  const [badges, setBadges] = useState([]);
  const [badgeStats, setBadgeStats] = useState({ total: 0, earned: 0 });
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [myJobs, setMyJobs] = useState({ family_jobs: [], payday_jobs: [] });
  const [loading, setLoading] = useState(true);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [hasCalendarAccess, setHasCalendarAccess] = useState(false);
  const [hasClassroom, setHasClassroom] = useState(true);
  const [nextLesson, setNextLesson] = useState(null);
  const [nextLessonLoading, setNextLessonLoading] = useState(true);
  const [activeQuestCount, setActiveQuestCount] = useState(0);
  const [gardenSummary, setGardenSummary] = useState({ planted: 0, thirsty: 0, total: 0 });
  const showAnimations = useFirstVisitAnimation('dashboard');
  
  const gradeNames = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade'];
  const LESSON_TYPE_EMOJI = { worksheet: '📝', activity: '🎮', book: '📖', workbook: '📓', video: '🎬' };
  
  // Redirect non-child users to their respective dashboards
  useEffect(() => {
    if (user?.role === 'admin') {
      navigate('/admin', { replace: true });
    } else if (user?.role === 'teacher') {
      navigate('/teacher-dashboard', { replace: true });
    } else if (user?.role === 'parent') {
      navigate('/parent-dashboard', { replace: true });
    }
  }, [user, navigate]);
  
  useEffect(() => {
    // Don't fetch data if user is not a child (will be redirected)
    if (user?.role && user.role !== 'child') return;
    fetchDashboardData();
    handleDailyCheckin();
    // Learning-first hero (next lesson + daily goal) only applies to Grade K-3
    if ((user?.grade ?? 3) <= 3) {
      fetchNextLesson();
      if ((user?.grade ?? 3) >= 1 && (user?.grade ?? 3) <= 3) {
        fetchGardenSummary();
      }
    } else {
      setNextLessonLoading(false);
    }
  }, [user]);
  
  const fetchGardenSummary = async () => {
    try {
      const res = await axios.get(`${API}/garden/farm`);
      const plots = res.data?.plots || [];
      setGardenSummary({
        planted: plots.filter((p) => p.plant_id).length,
        thirsty: plots.filter((p) => ['water_needed', 'wilting'].includes(p.status)).length,
        total: plots.length,
      });
    } catch (error) {
      console.error('Failed to fetch garden summary:', error);
    }
  };
  
  const fetchNextLesson = async () => {
    try {
      const response = await axios.get(`${API}/content/next-lesson`);
      setNextLesson(response.data);
    } catch (error) {
      console.error('Failed to fetch next lesson:', error);
    } finally {
      setNextLessonLoading(false);
    }
  };
  
  const fetchDashboardData = async () => {
    try {
      const [walletRes, questsRes, badgesRes, goalsRes, jobsRes, calendarAccessRes] = await Promise.all([
        axios.get(`${API}/wallet`),
        axios.get(`${API}/child/quests-new`),
        axios.get(`${API}/badges`),
        axios.get(`${API}/child/savings-goals`),
        axios.get(`${API}/child/jobs`).catch(() => ({ data: { family_jobs: [], payday_jobs: [] } })),
        axios.get(`${API}/live-classes/access`).catch(() => ({ data: { has_access: false } }))
      ]);
      
      setWallet(walletRes.data);
      setHasCalendarAccess(!!calendarAccessRes.data?.has_access);
      // Filter out completed AND expired quests - check status, user_status, is_completed, has_earned, and is_expired
      const activeQuests = (questsRes.data || []).filter(q => 
        q.status !== 'approved' && 
        q.status !== 'completed' &&
        q.user_status !== 'completed' && 
        q.user_status !== 'expired' &&
        !q.is_completed && 
        !q.has_earned &&
        !q.is_expired
      );
      // Cap to 2 active quests on dashboard
      setActiveQuestCount(activeQuests.length);
      setQuests(activeQuests.slice(0, 2));
      // Get up to 8 badges (earned first, then unearned)
      const badgesList = badgesRes.data.badges?.slice(0, 8) || [];
      setBadges(badgesList);
      setBadgeStats({ total: badgesRes.data.total_badges || 0, earned: badgesRes.data.earned_count || 0 });
      
      // Set active savings goals (up to 2 for dashboard display)
      const activeGoals = (goalsRes.data || []).filter(g => !g.completed);
      setSavingsGoals(activeGoals);
      setMyJobs(jobsRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDailyCheckin = async () => {
    try {
      const response = await axios.post(`${API}/streak/checkin`);
      setStreak(response.data);
      if (response.data.reward > 0) {
        setShowStreakModal(true);
        setTimeout(() => setShowStreakModal(false), 3000);
      }
    } catch (error) {
      console.error('Checkin failed:', error);
    }
  };
  
  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`);
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
      navigate('/');
    }
  };
  
  // Dynamic nav items based on grade
  const grade = user?.grade ?? 3;
  const getInvestmentItem = () => {
    if (grade === 0) return null; // No investments for Kindergarten
    if (grade <= 3) return { icon: TrendingUp, label: 'My Garden', path: '/garden', color: '#228B22', emoji: '🌻' };
    if (!STOCKS_ENABLED) return null;
    return { icon: TrendingUp, label: 'Stocks', path: '/stock-market', color: '#10B981', emoji: '📈' };
  };
  
  // Lending is only for grades 4-5
  const getSpecialFeatureItem = () => {
    if (LENDING_ENABLED && grade >= 4) return { icon: Handshake, label: 'Lending', path: '/lending', color: '#F59E0B', emoji: '🤝' };
    return null; // No special feature for younger grades
  };
  
  const investmentItem = getInvestmentItem();
  const specialFeatureItem = getSpecialFeatureItem();
  
  const navItems = [
    // For Grade K-3 the "Learn" action already lives in the hero card above,
    // so the quick-nav tile is dropped there to avoid duplicating it.
    ...(grade > 3 ? [{ icon: BookOpen, label: 'Learn', path: '/learn', color: '#FFD23F' }] : []),
    { icon: Wallet, label: 'My Money', path: '/wallet', color: '#3D5A80' },
    ...(STORE_ENABLED ? [{ icon: Store, label: 'Store', path: '/store', color: '#EE6C4D' }] : []),
    investmentItem,
    { icon: Target, label: 'Quests', path: '/quests', color: '#9B5DE5' },
    { icon: BookMarked, label: 'Money Words', path: '/glossary', color: '#4A90A4' },
    hasCalendarAccess ? { icon: CalendarDays, label: 'Calendar', path: '/calendar', color: '#EF476F' } : null,
    specialFeatureItem,
  ].filter(Boolean); // Remove null items
  
  // Simplified nav cards for the Grade K-3 learning-first layout (each card is a
  // single-purpose entry point with a short, REAL subtitle reflecting live data —
  // replaces the old icon-tile grid).
  const myWalletBalance = wallet?.accounts?.find((a) => a.account_type === 'my_wallet')?.balance || 0;
  const investingBalance = wallet?.accounts?.find((a) => a.account_type === 'investing')?.balance || 0;
  
  const getInvestmentSubtitle = () => {
    if (!investmentItem) return '';
    if (investmentItem.label === 'My Garden') {
      if (gardenSummary.planted === 0) return 'Plant your first seed';
      if (gardenSummary.thirsty > 0) return `${gardenSummary.thirsty} plant${gardenSummary.thirsty > 1 ? 's' : ''} thirsty`;
      return 'All plants happy';
    }
    return investingBalance > 0 ? `₹${investingBalance.toFixed(0)} invested` : 'Watch it grow';
  };
  
  const lowGradeNavItems = [
    { emoji: '👛', label: 'My Money', path: '/wallet', color: '#D9A73C', subtitle: `₹${myWalletBalance.toFixed(0)} to spend` },
    investmentItem ? { emoji: investmentItem.label === 'My Garden' ? '🌱' : '📈', label: investmentItem.label, path: investmentItem.path, color: '#2F5D45', subtitle: getInvestmentSubtitle() } : null,
    { emoji: '🎯', label: 'Quests', path: '/quests', color: '#8B5CF6', subtitle: activeQuestCount > 0 ? `${activeQuestCount} quest${activeQuestCount > 1 ? 's' : ''} left` : 'Find your next quest' },
    { emoji: '💬', label: 'Money Words', path: '/glossary', color: '#A8453D', subtitle: 'Word of the day' },
  ].filter(Boolean);
  
  // Grade-based account configuration
  const getAccountColors = () => {
    const baseAccounts = {
      spending: { bg: 'bg-gradient-to-br from-[#EE6C4D] to-[#FF8A6C]', icon: '⚡', label: 'My XP', description: 'XP to spend on cool stuff' },
      my_wallet: { bg: 'bg-gradient-to-br from-[#0EA5E9] to-[#38BDF8]', icon: '₹', label: 'My Wallet', description: 'Real money you earned' },
      savings: { bg: 'bg-gradient-to-br from-[#EC4899] to-[#DB2777]', icon: '🐷', label: 'Piggy Bank', description: 'Money saved for later' },
      gifting: { bg: 'bg-gradient-to-br from-[#9B5DE5] to-[#B47EE5]', icon: '❤️', label: 'Giving', description: 'Money to help others' },
    };
    
    if (grade === 0) {
      // Kindergarten: No investing jar
      return baseAccounts;
    } else if (grade <= 2) {
      // Grade 1-2: My Garden jar
      return {
        ...baseAccounts,
        investing: { bg: 'bg-gradient-to-br from-[#228B22] to-[#32CD32]', icon: '🌱', label: 'My Garden', description: 'Money to grow plants' },
      };
    } else if (STOCKS_ENABLED) {
      // Grade 3+: Investing jar
      return {
        ...baseAccounts,
        investing: { bg: 'bg-gradient-to-br from-[#3D5A80] to-[#5A7BA0]', icon: '📈', description: 'Money that grows' },
      };
    }
    return baseAccounts;
  };
  
  const accountColors = getAccountColors();
  
  // Filter accounts based on grade
  const getFilteredAccounts = () => {
    if (!wallet?.accounts) return [];
    if (grade === 0 || (grade >= 3 && !STOCKS_ENABLED)) {
      // Kindergarten, or Grade 3+ while Stocks is hidden: remove investing account
      return wallet.accounts.filter(acc => acc.account_type !== 'investing');
    }
    return wallet.accounts;
  };
  
  const filteredAccounts = getFilteredAccounts();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
      </div>
    );
  }
  
  // Non-child users should not see this dashboard - show loading while redirecting
  if (user?.role && user.role !== 'child') {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <div className={`min-h-screen ${grade <= 3 ? 'bg-[#F1ECE2]' : 'bg-[#E0FBFC]'}`} data-testid="dashboard">
      {/* Streak Modal */}
      {showStreakModal && streak.reward > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`card-playful p-8 text-center animate-bounce-in ${streak.streak % 5 === 0 ? 'bg-gradient-to-br from-[#FFD23F] to-[#FF9F1C]' : 'bg-[#FFD23F]'}`}>
            <div className="text-6xl mb-4 animate-coin-spin">{streak.streak % 5 === 0 ? '🎉' : '🔥'}</div>
            <h2 className="text-3xl font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>
              Day {streak.streak} Streak!
            </h2>
            {streak.streak % 5 === 0 && (
              <p className="text-lg text-[#1D3557] mb-1 font-bold">🌟 5-Day Milestone Bonus! 🌟</p>
            )}
            <p className="text-xl text-[#1D3557]">You earned <strong>{streak.reward} XP</strong>!</p>
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className="bg-white border-b-3 border-[#1D3557]">
        <div className="container mx-auto px-4 py-1">
          <div className="flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center">
              <img 
                src="https://customer-assets.emergentagent.com/job_6e7204b4-e7e4-42b3-b74e-111b68302b75/artifacts/ul81dgc9_Friendly%20%27Money%20Matter%27%20Logo%20Design%20%281%29.png"
                alt="CoinQuest"
                className="h-36 w-auto object-contain -my-6"
              />
            </Link>
            
            <div className="flex items-center gap-4">
              {/* Admin link */}
              {user?.role === 'admin' && (
                <Link 
                  to="/admin" 
                  className="p-2 rounded-xl border-2 border-[#1D3557] bg-[#1D3557] hover:bg-[#3D5A80] transition-colors"
                  title="Admin Dashboard"
                  data-testid="admin-dashboard-link"
                >
                  <Shield className="w-5 h-5 text-white" />
                </Link>
              )}
              
              {/* Teacher dashboard link */}
              {user?.role === 'teacher' && (
                <Link 
                  to="/teacher-dashboard" 
                  className="p-2 rounded-xl border-2 border-[#1D3557] bg-[#EE6C4D] hover:bg-[#FF8A6C] transition-colors"
                  title="Teacher Dashboard"
                  data-testid="teacher-dashboard-link"
                >
                  <GraduationCap className="w-5 h-5 text-white" />
                </Link>
              )}
              
              {/* Parent dashboard link */}
              {user?.role === 'parent' && (
                <Link 
                  to="/parent-dashboard" 
                  className="p-2 rounded-xl border-2 border-[#1D3557] bg-[#06D6A0] hover:bg-[#42E8B3] transition-colors"
                  title="Parent Dashboard"
                  data-testid="parent-dashboard-link"
                >
                  <Users className="w-5 h-5 text-white" />
                </Link>
              )}
              
              {/* Streak indicator */}
              <div className="flex items-center gap-2 bg-[#FFD23F]/20 px-3 py-2 rounded-xl border-2 border-[#1D3557]">
                <Flame className="w-5 h-5 text-[#EE6C4D]" />
                <span className="font-bold text-[#1D3557]">{streak.streak || user?.streak_count || 0}</span>
              </div>
              
              {/* Total balance - removed, shown on dashboard */}
              
              {/* Notifications */}
              <NotificationCenter 
                onGiftRequestAction={async (requestId, action) => {
                  try {
                    await axios.post(`${API}/child/gift-requests/${requestId}/respond`, { action });
                    toast.success(action === 'accept' ? 'Gift sent!' : 'Request declined');
                    fetchDashboardData();
                  } catch (error) {
                    toast.error(error.response?.data?.detail || 'Failed to respond');
                  }
                }}
              />
              
              {/* Profile */}
              <Link to="/profile" className="flex items-center gap-2 hover:opacity-80">
                <img 
                  src={user?.picture || getDefaultAvatar(user?.role, user?.name)} 
                  alt={user?.name} 
                  className="w-10 h-10 rounded-full border-2 border-[#1D3557] object-cover"
                />
              </Link>
              
              <button
                data-testid="logout-btn"
                onClick={handleLogout}
                className="p-2 rounded-xl border-2 border-[#1D3557] hover:bg-[#EE6C4D]/20 transition-colors"
              >
                <LogOut className="w-5 h-5 text-[#1D3557]" />
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Welcome Section */}
        <div className={`mb-6 ${showAnimations ? 'animate-bounce-in' : ''}`}>
          <h1 className={`text-3xl md:text-4xl font-bold mb-1 ${grade <= 3 ? 'text-[#1A1A1A]' : 'text-[#1D3557]'}`} style={{ fontFamily: 'Fredoka' }}>
            Hey, {user?.name?.split(' ')[0]}! 👋
          </h1>
          <p className={`text-lg ${grade <= 3 ? 'text-[#6B6459]' : 'text-[#3D5A80]'}`}>
            {user?.grade !== null && user?.grade !== undefined ? gradeNames[user.grade] : 'Grade not set'} • {grade <= 3 ? "ready to learn about money?" : "Ready to learn about money?"}
          </p>
        </div>
        
        {/* Learning-first hero: next lesson + daily goal (Grade K-3 only) */}
        {grade <= 3 && (
          <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 ${showAnimations ? 'animate-bounce-in' : ''}`}>
            {/* Next Lesson Hero */}
            <div
              className="md:col-span-2 rounded-3xl p-6 bg-[#2F5D45] relative overflow-hidden flex items-center shadow-sm"
              data-testid="next-lesson-hero"
            >
              <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
              {nextLessonLoading ? (
                <div className="w-full h-24 flex items-center justify-center">
                  <div className="w-10 h-10 border-4 border-white/60 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : nextLesson?.content_id ? (
                <div className="flex items-center gap-6 w-full relative z-10">
                  <div className="w-24 h-24 rounded-2xl bg-[#F0E6CC] flex flex-col items-center justify-center flex-shrink-0 gap-1">
                    <span className="text-3xl">{LESSON_TYPE_EMOJI[nextLesson.content_type] || '📚'}</span>
                    <span className="text-[9px] font-bold text-[#8A7A52] tracking-wide">LESSON IMAGE</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-white/70 text-xs font-bold uppercase tracking-widest mb-1">
                      {nextLesson.is_new_user ? 'Your First Lesson' : "Today's Lesson"}
                    </span>
                    <h2 className="text-3xl font-bold text-white truncate mb-1" style={{ fontFamily: 'Fredoka' }} data-testid="next-lesson-title">
                      {nextLesson.title}
                    </h2>
                    <p className="text-sm text-white/70 mb-4">Earn {nextLesson.reward_coins} XP</p>
                    <Link
                      to={`/learn/topic/${nextLesson.subtopic_id}?highlight=${nextLesson.content_id}`}
                      data-testid="start-next-lesson-btn"
                      className="inline-flex items-center gap-2 bg-gradient-to-b from-[#E5B44E] to-[#CC9B34] text-[#2B2308] font-bold px-6 py-2.5 rounded-xl hover:brightness-105 transition-all"
                    >
                      {nextLesson.is_new_user ? 'Start Learning' : 'Continue Learning'}
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-6 w-full relative z-10">
                  <div className="w-24 h-24 rounded-2xl bg-[#F0E6CC] flex items-center justify-center flex-shrink-0 text-4xl">
                    🎉
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Fredoka' }} data-testid="next-lesson-title">
                      You've completed everything!
                    </h2>
                    <p className="text-sm text-white/70 mb-4">New lessons coming soon — great job learning!</p>
                    <Link
                      to="/learn"
                      data-testid="start-next-lesson-btn"
                      className="inline-flex items-center gap-2 bg-gradient-to-b from-[#E5B44E] to-[#CC9B34] text-[#2B2308] font-bold px-6 py-2.5 rounded-xl hover:brightness-105 transition-all"
                    >
                      Browse Learn
                    </Link>
                  </div>
                </div>
              )}
            </div>
            
            {/* Today's Goal Ring */}
            <div className="rounded-3xl p-5 bg-white shadow-sm flex items-center gap-4" data-testid="today-goal-card">
              {(() => {
                const completed = nextLesson?.completed_today || 0;
                const goal = nextLesson?.daily_goal || 3;
                const pct = Math.min(completed / goal, 1);
                const radius = 40;
                const circumference = 2 * Math.PI * radius;
                const offset = circumference * (1 - pct);
                return (
                  <svg width="88" height="88" viewBox="0 0 100 100" className="flex-shrink-0" data-testid="today-goal-ring">
                    <circle cx="50" cy="50" r={radius} fill="none" stroke="#F0E6CC" strokeWidth="10" />
                    <circle
                      cx="50" cy="50" r={radius} fill="none" stroke="#2F5D45" strokeWidth="10"
                      strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                      style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                    />
                    <text x="50" y="47" textAnchor="middle" fontSize="24" fontWeight="bold" fill="#1A1A1A">{completed}</text>
                    <text x="50" y="66" textAnchor="middle" fontSize="11" fill="#8A8378">of {goal}</text>
                  </svg>
                );
              })()}
              <div className="min-w-0">
                <h3 className="font-bold text-[#1A1A1A] text-lg" style={{ fontFamily: 'Fredoka' }}>Today's goal</h3>
                <p className="text-sm text-[#8A8378] mb-2" data-testid="today-goal-label">
                  {(nextLesson?.completed_today || 0) >= (nextLesson?.daily_goal || 3)
                    ? '3 lessons and today is done'
                    : `${(nextLesson?.daily_goal || 3) - (nextLesson?.completed_today || 0)} lesson${((nextLesson?.daily_goal || 3) - (nextLesson?.completed_today || 0)) > 1 ? 's' : ''} to go`}
                </p>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={`w-4 h-4 rounded-md ${i < (nextLesson?.completed_today || 0) ? 'bg-[#2F5D45]' : 'bg-[#F0E6CC]'}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Simplified nav cards + savings/jobs (Grade K-3 only) - matches the reference
            layout exactly: 4 nav cards, then exactly 2 detail cards. No extra rows. */}
        {grade <= 3 && (
          <>
            <ChildHomework variant="banner" />
            
            <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 ${showAnimations ? 'animate-bounce-in' : ''}`}>
              {lowGradeNavItems.map((item, index) => (
                <Link
                  key={item.path}
                  to={item.path}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm hover:-translate-y-0.5 transition-transform"
                  style={showAnimations ? { animationDelay: `${index * 0.05}s` } : {}}
                >
                  <div className="h-1.5" style={{ backgroundColor: item.color }} />
                  <div className="p-4">
                    <span className="text-2xl block mb-2">{item.emoji}</span>
                    <p className="font-bold text-[#1A1A1A]" style={{ fontFamily: 'Fredoka' }}>{item.label}</p>
                    <p className="text-sm text-[#8A8378] mt-0.5 truncate">{item.subtitle}</p>
                  </div>
                </Link>
              ))}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start mb-28">
              {/* Savings — simplified */}
              {savingsGoals.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center justify-between gap-4" data-testid="dashboard-savings-goal">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-14 h-14 rounded-xl bg-[#F0E6CC] flex items-center justify-center flex-shrink-0 text-2xl">
                      🎯
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-[#1A1A1A]" style={{ fontFamily: 'Fredoka' }}>What are you saving for?</h3>
                      <p className="text-sm text-[#8A8378] truncate">Pick something you want to buy and start saving.</p>
                    </div>
                  </div>
                  <Link to="/savings-goals" className="flex-shrink-0 border-2 border-[#1A1A1A] rounded-xl px-4 py-2 font-bold text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-colors">
                    Add a goal
                  </Link>
                </div>
              ) : (
                <Link to="/savings-goals" className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow" data-testid="dashboard-savings-goal">
                  {(() => {
                    const goal = savingsGoals[0];
                    const gp = Math.min(((goal.current_amount || 0) / goal.target_amount) * 100, 100);
                    return (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-bold text-[#1A1A1A] truncate" style={{ fontFamily: 'Fredoka' }}>
                            Saving for {goal.title}
                          </h3>
                          <span className="text-sm text-[#8A8378] flex-shrink-0">Goal 1 of {savingsGoals.length}</span>
                        </div>
                        <div className="h-3 rounded-full bg-[#F0E6CC] overflow-hidden">
                          <div className="h-full rounded-full bg-[#2F5D45]" style={{ width: `${Math.max(gp, 4)}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[#2F5D45] font-bold">₹{goal.current_amount?.toFixed(0) || 0} saved</span>
                          <span className="text-[#8A8378]">₹{(goal.target_amount - (goal.current_amount || 0)).toFixed(0)} to go</span>
                        </div>
                        <span className="text-sm font-bold text-[#2F5D45]">See all my goals →</span>
                      </>
                    );
                  })()}
                </Link>
              )}
              
              {/* Classroom leaderboard when the child is in a class, otherwise My Jobs */}
              {hasClassroom ? (
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <ClassmatesSection
                    giftingBalance={wallet?.accounts?.find((a) => a.account_type === 'gifting')?.balance || 0}
                    compact={true}
                    variant="leaderboard"
                    wallet={wallet}
                    grade={grade}
                    currentUserName={user?.name?.split(' ')[0]}
                    currentUserXp={wallet?.accounts?.find((a) => a.account_type === 'spending')?.balance || 0}
                    onRefresh={fetchDashboardData}
                    onClassroomStatusChange={setHasClassroom}
                  />
                </div>
              ) : (myJobs.family_jobs.length + myJobs.payday_jobs.length) === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-2">
                  <h3 className="font-bold text-[#1A1A1A]" style={{ fontFamily: 'Fredoka' }}>My jobs</h3>
                  <p className="text-sm text-[#8A8378]">Jobs are things you do to earn money. Add your first one.</p>
                  <Link to="/my-jobs" className="inline-flex mt-1 flex-shrink-0 border-2 border-[#1A1A1A] rounded-xl px-4 py-2 font-bold text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-colors w-fit">
                    Add a job
                  </Link>
                </div>
              ) : (
                <Link to="/my-jobs" className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-2.5 hover:shadow-md transition-shadow">
                  <h3 className="font-bold text-[#1A1A1A]" style={{ fontFamily: 'Fredoka' }}>My jobs</h3>
                  {myJobs.family_jobs.slice(0, 1).map((job) => (
                    <div key={job.job_id} className="flex items-center gap-2.5 text-sm">
                      <span className="text-lg">🐾</span>
                      <span className="text-[#1A1A1A] font-medium truncate flex-1">{job.activity}</span>
                    </div>
                  ))}
                  {myJobs.payday_jobs.slice(0, 2).map((job) => (
                    <div key={job.job_id} className="flex items-center gap-2.5 text-sm">
                      <span className="text-lg">💰</span>
                      <span className="text-[#1A1A1A] font-medium truncate flex-1">{job.activity}</span>
                      {job.payment_amount > 0 && <span className="font-bold text-[#2F5D45] flex-shrink-0">₹{job.payment_amount}</span>}
                    </div>
                  ))}
                </Link>
              )}
            </div>
            
            {/* Fixed bottom nav bar (Grade K-3 only) */}
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-lg px-2 py-2 flex items-center gap-1 z-40" data-testid="bottom-nav">
              {[
                { icon: HomeIcon, label: 'Home', path: '/dashboard' },
                { icon: BookOpen, label: 'Learn', path: '/learn' },
                { icon: Target, label: 'Quests', path: '/quests' },
                { icon: Wallet, label: 'Money', path: '/wallet' },
                { icon: Trophy, label: 'Rewards', path: '/achievements' },
              ].map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  data-testid={`bottom-nav-${item.label.toLowerCase()}`}
                  className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-full transition-colors ${
                    item.label === 'Home' ? 'bg-[#2F5D45] text-white' : 'text-[#8A8378] hover:bg-[#F1ECE2]'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px] font-bold">{item.label}</span>
                </Link>
              ))}
            </div>
          </>
        )}
        
        {/* Quick Navigation (Grade 4-5) */}
        {grade > 3 && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
          {navItems.map((item, index) => (
            <Link
              key={item.path}
              to={item.path}
              data-testid={`nav-${item.label.toLowerCase()}`}
              className={`card-playful p-4 text-center hover:scale-105 transition-transform ${showAnimations ? 'animate-bounce-in' : ''}`}
              style={showAnimations ? { animationDelay: `${index * 0.05}s` } : {}}
            >
              <div 
                className="w-12 h-12 mx-auto mb-2 rounded-xl border-2 border-[#1D3557] flex items-center justify-center"
                style={{ backgroundColor: item.color }}
              >
                <item.icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-bold text-[#1D3557]">{item.label}</span>
            </Link>
          ))}
        </div>
        )}
        
        {/* Homework assigned by teacher (Grade 4-5; shown above for Grade K-3) */}
        {grade > 3 && <ChildHomework />}
        
        {/* Three Card Layout - Money Jars, Savings Goal, Jobs (Grade 4-5 only) */}
        {grade > 3 && (
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 ${showAnimations ? 'animate-bounce-in stagger-2' : ''}`}>
          {/* Money Jars Card */}
          <div className="card-playful p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-[#1D3557] flex items-center gap-1.5" style={{ fontFamily: 'Fredoka' }}>
                <IndianRupee className="w-5 h-5" strokeWidth={2.5} /> My Money
              </h2>
              <Link to="/wallet" className="text-sm text-[#3D5A80] hover:text-[#1D3557]">
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="grid grid-cols-2 gap-2 flex-1">
              {filteredAccounts.map((account) => {
                const config = accountColors[account.account_type];
                const displayLabel = config?.label || account.account_type;
                
                // Define navigation path for each account type
                const getAccountPath = (type) => {
                  switch(type) {
                    case 'spending': return STORE_ENABLED ? '/store' : '/wallet';
                    case 'my_wallet': return '/my-wallet';
                    case 'savings': return '/savings-goals';
                    case 'gifting': return '/gifting';
                    case 'investing': return grade <= 2 ? '/garden' : '/stock-market';
                    default: return '/wallet';
                  }
                };
                
                return (
                  <Link
                    to={getAccountPath(account.account_type)}
                    key={account.account_type}
                    data-testid={`jar-${account.account_type}`}
                    className={`${config?.bg || 'bg-gray-400'} rounded-xl border-2 border-[#1D3557] p-3 text-white hover:scale-[1.02] transition-transform cursor-pointer`}
                  >
                    <div className="text-xl mb-1">{config?.icon}</div>
                    <p className="text-sm font-bold capitalize">{displayLabel}</p>
                    {/* Show Available balance for savings/investing, total for others */}
                    <p className="text-lg font-bold">
                      {(account.account_type === 'spending' || account.account_type === 'investing') ? '' : '₹'}
                      {(account.account_type === 'savings' || account.account_type === 'investing'
                        ? (account.available_balance ?? account.balance)
                        : account.balance
                      )?.toFixed(0)}
                      {(account.account_type === 'spending' || account.account_type === 'investing') ? ' XP' : ''}
                    </p>
                    {/* Show "Available" label for savings/investing */}
                    {(account.account_type === 'savings' || account.account_type === 'investing') && (
                      <p className="text-[10px] opacity-80">Available</p>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
          
          {/* Savings Goal Card */}
          <div className="card-playful p-4 flex flex-col" data-testid="dashboard-savings-goal">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-[#1D3557] flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
                <Target className="w-5 h-5 text-[#06D6A0]" />
                My Savings Goals
              </h2>
              <Link to="/savings-goals" className="text-sm text-[#3D5A80] hover:text-[#1D3557]">
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            
            {/* Total Savings Summary */}
            {savingsGoals.length > 0 && (
              <div className="bg-gradient-to-r from-[#06D6A0]/10 to-[#42E8B3]/10 rounded-xl p-3 mb-3 border border-[#06D6A0]/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#3D5A80]">Total Saved</span>
                  <span className="text-lg font-bold text-[#06D6A0]">
                    ₹{savingsGoals.reduce((sum, g) => sum + (g.current_amount || 0), 0).toFixed(0)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-[#3D5A80]">Across {savingsGoals.length} goal{savingsGoals.length > 1 ? 's' : ''}</span>
                  <span className="text-xs text-[#EE6C4D]">
                    ₹{savingsGoals.reduce((sum, g) => sum + (g.target_amount || 0), 0).toFixed(0)} total target
                  </span>
                </div>
              </div>
            )}
            
            {savingsGoals.length > 0 ? (
              <div className="flex-1 space-y-2">
                {savingsGoals.slice(0, 2).map((goal) => {
                  const gp = Math.min(((goal.current_amount || 0) / goal.target_amount) * 100, 100);
                  const gpCoin = `${Math.min(Math.max(gp, 4), 96)}%`;
                  return (
                  <Link key={goal.goal_id} to="/savings-goals" className="bg-[#F8F9FA] rounded-xl p-3 border border-[#E0E0E0] block hover:bg-[#E0FBFC] transition-colors">
                    <div className="flex gap-3 items-center mb-2">
                      {goal.image_url ? (
                        <img 
                          src={getAssetUrl(goal.image_url)} 
                          alt={goal.title}
                          className="w-10 h-10 rounded-lg border-2 border-[#1D3557] object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg border-2 border-[#1D3557] bg-[#FFD23F] flex items-center justify-center text-lg flex-shrink-0">
                          🎯
                        </div>
                      )}
                      <h3 className="font-bold text-[#1D3557] text-sm flex-1 truncate">{goal.title}</h3>
                    </div>
                    
                    <div className="goal-track compact mb-2" data-testid={`dash-goal-bar-${goal.goal_id}`}>
                      {[25, 50, 75].map((m) => (
                        <span key={m} className={`goal-milestone ${gp >= m ? 'reached' : ''}`} style={{ left: `${m}%` }} />
                      ))}
                      <div className={`goal-fill ${gp >= 100 ? 'is-complete' : ''}`} style={{ width: `${Math.max(gp, 4)}%` }} />
                      <span className="goal-coin" style={{ left: gpCoin }} role="img" aria-label="coin">🪙</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#06D6A0] font-bold">₹{goal.current_amount?.toFixed(0) || 0} saved</span>
                      <span className="text-[#EE6C4D] font-medium">₹{(goal.target_amount - (goal.current_amount || 0)).toFixed(0)} to go</span>
                      <span className="text-[#1D3557] font-bold flex items-center gap-1">
                        <Target className="w-3 h-3" />₹{goal.target_amount?.toFixed(0)}
                      </span>
                    </div>
                  </Link>
                  );
                })}
                {savingsGoals.length > 2 && (
                  <Link to="/savings-goals" className="text-xs text-center text-[#3D5A80] hover:text-[#1D3557] block">
                    +{savingsGoals.length - 2} more goals →
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
                <Target className="w-10 h-10 text-[#98C1D9] mb-2" />
                <p className="text-sm text-[#3D5A80]">No savings goal yet</p>
                <Link to="/savings-goals" className="text-sm font-bold text-[#06D6A0] hover:underline mt-1">
                  Set a Goal →
                </Link>
              </div>
            )}
          </div>
          
          {/* My Jobs Card */}
          <div className="card-playful p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-[#1D3557] flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
                <Briefcase className="w-5 h-5 text-[#3D5A80]" />
                My Jobs
              </h2>
              <Link to="/my-jobs" className="text-sm text-[#3D5A80] hover:text-[#1D3557]">
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            
            {(myJobs.family_jobs.length + myJobs.payday_jobs.length) === 0 ? (
              <div className="flex-1 space-y-2 py-1">
                <Link to="/my-jobs" className="flex items-center gap-2 bg-rose-50/60 rounded-lg p-2.5 border border-rose-100 hover:bg-rose-50 transition-colors">
                  <Heart className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#1D3557]">Family Jobs</p>
                    <p className="text-[10px] text-[#3D5A80]">Things I do as part of my family</p>
                  </div>
                </Link>
                <Link to="/my-jobs" className="flex items-center gap-2 bg-amber-50/60 rounded-lg p-2.5 border border-amber-100 hover:bg-amber-50 transition-colors">
                  <Briefcase className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#1D3557]">Payday Jobs</p>
                    <p className="text-[10px] text-[#3D5A80]">Extra tasks that earn me money</p>
                  </div>
                </Link>
                <Link to="/my-jobs" className="text-xs text-center text-[#06D6A0] hover:text-[#05C493] block font-bold mt-1">
                  Set up My Jobs →
                </Link>
              </div>
            ) : (
              <div className="flex-1 space-y-2">
                {myJobs.family_jobs.slice(0, 2).map((job) => (
                  <div key={job.job_id} className="bg-[#E0FBFC] rounded-lg p-2 border border-[#1D3557]/10 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-[#EE6C4D] flex-shrink-0" />
                    <span className="text-xs font-medium text-[#1D3557] truncate">{job.activity}</span>
                  </div>
                ))}
                {myJobs.payday_jobs.slice(0, 2).map((job) => (
                  <div key={job.job_id} className="bg-[#FFD23F]/15 rounded-lg p-2 border border-[#FFD23F]/30 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-[#1D3557] flex-shrink-0" />
                    <span className="text-xs font-medium text-[#1D3557] truncate">{job.activity}</span>
                    {job.payment_amount > 0 && <span className="text-xs font-bold text-[#06D6A0] ml-auto">₹{job.payment_amount}</span>}
                  </div>
                ))}
                <Link to="/my-jobs" className="text-xs text-center text-[#3D5A80] hover:text-[#1D3557] block font-bold">
                  Manage Jobs →
                </Link>
              </div>
            )}
          </div>
        </div>
        )}
        
        {/* Three Column Layout - Quests, Badges, Classroom (Grade 4-5 only) */}
        {grade > 3 && (
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {/* Active Quests - Compact */}
          <div className={`card-playful p-4 ${showAnimations ? 'animate-bounce-in stagger-3' : ''}`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                Active Quests
              </h2>
              <Link to="/quests" className="text-[#3D5A80] hover:text-[#1D3557]">
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            {quests.length === 0 ? (
              <p className="text-center text-[#3D5A80] py-3 text-sm">No active quests. <Link to="/quests" className="text-[#3D5A80] underline font-bold">Find some!</Link></p>
            ) : (
              <div className="space-y-2">
                {quests.map((quest) => (
                  <Link key={quest.quest_id} to="/quests" className="bg-[#E0FBFC] rounded-lg border border-[#1D3557]/20 p-2 block hover:bg-[#D0EFF2]">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-[#1D3557] text-sm truncate flex-1">{quest.title}</h3>
                      <span className="bg-[#FFD23F] text-[#1D3557] px-1.5 py-0.5 rounded text-xs font-bold ml-2">
                        +{quest.creator_type === 'parent' && quest.reward_type !== 'xp' 
                          ? `₹${quest.total_points || quest.reward_amount || 0}` 
                          : `${quest.total_points || quest.reward_amount || 0} XP`}
                      </span>
                    </div>
                    <Progress value={quest.progress || 0} className="h-1.5" />
                  </Link>
                ))}
              </div>
            )}
          </div>
          
          {/* My Badges - Compact */}
          <div className={`card-playful p-4 ${showAnimations ? 'animate-bounce-in stagger-4' : ''}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                  My Badges
                </h2>
                <span className="text-xs bg-[#FFD23F] text-[#1D3557] px-1.5 py-0.5 rounded-full font-bold">
                  {badgeStats.earned}/{badgeStats.total}
                </span>
              </div>
              <Link to="/achievements" className="text-[#3D5A80] hover:text-[#1D3557]">
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            {badges.length === 0 ? (
              <p className="text-center text-[#3D5A80] py-3 text-sm">Complete activities to earn badges!</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {badges.slice(0, 8).map((badge) => {
                  const hasImage = badge.image_url && badge.image_url.length > 0;
                  const imageUrl = hasImage ? getAssetUrl(badge.image_url) : null;
                  return (
                    <div key={badge.achievement_id} className={`text-center ${!badge.earned ? 'opacity-40' : ''}`} title={badge.name}>
                      <div className={`w-12 h-12 mx-auto rounded-lg border-2 flex items-center justify-center overflow-hidden ${
                        badge.earned ? 'bg-[#FFD23F] border-[#1D3557]' : 'bg-gray-200 border-gray-400 grayscale'
                      }`}>
                        {hasImage ? (
                          <img src={imageUrl} alt={badge.name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                        ) : (
                          <span className="text-lg">{badge.icon}</span>
                        )}
                      </div>
                      <p className={`text-[10px] font-bold mt-1 truncate ${badge.earned ? 'text-[#1D3557]' : 'text-gray-400'}`}>
                        {badge.name}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* My Classroom - Compact (hidden entirely if child isn't attached to a classroom) */}
          {hasClassroom && (
            <div className={`card-playful p-4 ${showAnimations ? 'animate-bounce-in stagger-5' : ''}`}>
              <ClassmatesSection 
                giftingBalance={wallet?.accounts?.find(a => a.account_type === 'gifting')?.balance || 0} 
                compact={true} 
                wallet={wallet}
                grade={grade}
                onRefresh={fetchDashboardData}
                onClassroomStatusChange={setHasClassroom}
              />
            </div>
          )}
        </div>
        )}
        
        {/* Lending Banner - only for grades 4-5 */}
        {LENDING_ENABLED && grade >= 4 && (
          <div className={`mt-8 ${showAnimations ? 'animate-bounce-in stagger-5' : ''}`}>
            <Link 
              to="/lending"
              className="block p-6 bg-gradient-to-r from-amber-500 to-orange-500 rounded-3xl border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557] hover:scale-[1.02] transition-transform"
            >
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-white rounded-2xl border-3 border-[#1D3557] flex items-center justify-center">
                  <Handshake className="w-8 h-8 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'Fredoka' }}>
                    Lending Center 🤝
                  </h3>
                  <p className="text-amber-100">Borrow & lend money to learn about loans and credit!</p>
                </div>
                <ChevronRight className="w-8 h-8 text-white" />
              </div>
            </Link>
          </div>
        )}
      </main>
      <DashboardFooter />
    </div>
  );
}
