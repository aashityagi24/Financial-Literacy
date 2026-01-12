import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { 
  Coins, Wallet, Store, TrendingUp, Target, Trophy, 
  MessageCircle, User, LogOut, Flame, Gift, Sparkles,
  ChevronRight, Star, BookOpen, Shield, GraduationCap, Users
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function Dashboard({ user, setUser }) {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [streak, setStreak] = useState({ streak: 0, reward: 0 });
  const [quests, setQuests] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [showAnimations, setShowAnimations] = useState(false);
  
  const gradeNames = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade'];
  
  useEffect(() => {
    // Check if this is the first visit this session
    const hasAnimated = sessionStorage.getItem('dashboard_animated');
    if (!hasAnimated) {
      setShowAnimations(true);
      sessionStorage.setItem('dashboard_animated', 'true');
    }
    
    fetchDashboardData();
    handleDailyCheckin();
  }, []);
  
  const fetchDashboardData = async () => {
    try {
      const [walletRes, questsRes, achievementsRes] = await Promise.all([
        axios.get(`${API}/wallet`),
        axios.get(`${API}/quests`),
        axios.get(`${API}/achievements`)
      ]);
      
      setWallet(walletRes.data);
      setQuests(questsRes.data.slice(0, 3));
      setAchievements(achievementsRes.data.filter(a => a.earned).slice(0, 4));
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
  
  const navItems = [
    { icon: BookOpen, label: 'Learn', path: '/learn', color: '#FFD23F' },
    { icon: Wallet, label: 'Wallet', path: '/wallet', color: '#3D5A80' },
    { icon: Store, label: 'Store', path: '/store', color: '#EE6C4D' },
    { icon: TrendingUp, label: 'Invest', path: '/investments', color: '#06D6A0' },
    { icon: Target, label: 'Quests', path: '/quests', color: '#9B5DE5' },
    { icon: MessageCircle, label: 'AI Buddy', path: '/chat', color: '#FFD23F' },
  ];
  
  const accountColors = {
    spending: { bg: 'bg-gradient-to-br from-[#EE6C4D] to-[#FF8A6C]', icon: '💳' },
    savings: { bg: 'bg-gradient-to-br from-[#06D6A0] to-[#42E8B3]', icon: '🐷' },
    investing: { bg: 'bg-gradient-to-br from-[#3D5A80] to-[#5A7BA0]', icon: '📈' },
    giving: { bg: 'bg-gradient-to-br from-[#9B5DE5] to-[#B47EE5]', icon: '❤️' },
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#E0FBFC]" data-testid="dashboard">
      {/* Streak Modal */}
      {showStreakModal && streak.reward > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card-playful p-8 text-center animate-bounce-in bg-[#FFD23F]">
            <div className="text-6xl mb-4 animate-coin-spin">🔥</div>
            <h2 className="text-3xl font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>
              Day {streak.streak} Streak!
            </h2>
            <p className="text-xl text-[#1D3557]">You earned <strong>{streak.reward} coins</strong>!</p>
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className="bg-white border-b-3 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FFD23F] rounded-xl border-3 border-[#1D3557] shadow-[2px_2px_0px_0px_#1D3557] flex items-center justify-center">
                <Coins className="w-6 h-6 text-[#1D3557]" />
              </div>
              <span className="text-xl font-bold text-[#1D3557] hidden sm:block" style={{ fontFamily: 'Fredoka' }}>PocketQuest</span>
            </div>
            
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
              
              {/* Total balance */}
              <div className="flex items-center gap-2 bg-[#06D6A0]/20 px-3 py-2 rounded-xl border-2 border-[#1D3557]">
                <Coins className="w-5 h-5 text-[#06D6A0]" />
                <span className="font-bold text-[#1D3557]">${wallet?.total_balance?.toFixed(0) || 0}</span>
              </div>
              
              {/* Profile */}
              <Link to="/profile" className="flex items-center gap-2 hover:opacity-80">
                <img 
                  src={user?.picture || 'https://via.placeholder.com/40'} 
                  alt={user?.name} 
                  className="w-10 h-10 rounded-full border-2 border-[#1D3557]"
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
        <div className={`mb-8 ${showAnimations ? 'animate-bounce-in' : ''}`}>
          <h1 className="text-3xl md:text-4xl font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>
            Hey, {user?.name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-lg text-[#3D5A80]">
            {user?.grade !== null && user?.grade !== undefined ? gradeNames[user.grade] : 'Grade not set'} • Ready to learn about money?
          </p>
        </div>
        
        {/* Quick Navigation */}
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
        
        {/* Wallet Overview */}
        <div className="card-playful p-6 mb-8 animate-bounce-in stagger-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              My Wallet
            </h2>
            <Link to="/wallet" className="text-[#3D5A80] hover:text-[#1D3557] flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {wallet?.accounts?.map((account) => (
              <div
                key={account.account_type}
                className={`${accountColors[account.account_type]?.bg} rounded-2xl border-3 border-[#1D3557] p-4 text-white`}
              >
                <div className="text-2xl mb-2">{accountColors[account.account_type]?.icon}</div>
                <p className="text-sm opacity-90 capitalize">{account.account_type}</p>
                <p className="text-2xl font-bold">${account.balance?.toFixed(0)}</p>
              </div>
            ))}
          </div>
        </div>
        
        {/* Two Column Layout */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Active Quests */}
          <div className="card-playful p-6 animate-bounce-in stagger-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                Active Quests
              </h2>
              <Link to="/quests" className="text-[#3D5A80] hover:text-[#1D3557] flex items-center gap-1">
                See All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            
            {quests.length === 0 ? (
              <div className="text-center py-8">
                <Target className="w-12 h-12 mx-auto text-[#98C1D9] mb-2" />
                <p className="text-[#3D5A80]">No active quests yet!</p>
                <Link to="/quests" className="btn-primary inline-block mt-3 px-4 py-2">
                  Find Quests
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {quests.map((quest) => (
                  <div key={quest.quest_id} className="bg-[#E0FBFC] rounded-xl border-2 border-[#1D3557] p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-[#1D3557]">{quest.title}</h3>
                        <p className="text-sm text-[#3D5A80]">{quest.description}</p>
                      </div>
                      <span className="bg-[#FFD23F] text-[#1D3557] px-2 py-1 rounded-lg text-sm font-bold">
                        +${quest.reward_amount}
                      </span>
                    </div>
                    <Progress value={quest.progress || 0} className="h-2" />
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Recent Achievements */}
          <div className="card-playful p-6 animate-bounce-in stagger-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                My Badges
              </h2>
              <Link to="/achievements" className="text-[#3D5A80] hover:text-[#1D3557] flex items-center gap-1">
                See All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            
            {achievements.length === 0 ? (
              <div className="text-center py-8">
                <Trophy className="w-12 h-12 mx-auto text-[#98C1D9] mb-2" />
                <p className="text-[#3D5A80]">Complete quests to earn badges!</p>
                <Link to="/quests" className="btn-primary inline-block mt-3 px-4 py-2">
                  Start a Quest
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {achievements.map((ach) => (
                  <div 
                    key={ach.achievement_id} 
                    className="text-center"
                    title={ach.name}
                  >
                    <div className="w-14 h-14 mx-auto bg-[#FFD23F] rounded-xl border-2 border-[#1D3557] flex items-center justify-center text-2xl badge-earned">
                      {ach.icon}
                    </div>
                    <p className="text-xs font-bold text-[#1D3557] mt-1 truncate">{ach.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* AI Buddy Banner */}
        <div className="mt-8 animate-bounce-in stagger-5">
          <Link 
            to="/chat"
            className="card-playful p-6 bg-gradient-to-r from-[#3D5A80] to-[#5A7BA0] flex items-center gap-6 hover:scale-[1.02] transition-transform"
          >
            <div className="w-16 h-16 bg-[#FFD23F] rounded-2xl border-3 border-white flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-[#1D3557]" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'Fredoka' }}>
                Chat with Money Buddy! 💬
              </h3>
              <p className="text-[#98C1D9]">Ask questions about saving, spending, and growing your money!</p>
            </div>
            <ChevronRight className="w-8 h-8 text-white" />
          </Link>
        </div>
      </main>
    </div>
  );
}
