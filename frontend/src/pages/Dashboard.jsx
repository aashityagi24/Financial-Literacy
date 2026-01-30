import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { 
  Coins, Wallet, Store, TrendingUp, Target, Trophy, 
  MessageCircle, User, LogOut, Flame, Gift, Sparkles,
  ChevronRight, Star, BookOpen, Shield, GraduationCap, Users, Award
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useFirstVisitAnimation } from '@/hooks/useFirstVisitAnimation';
import NotificationCenter from '@/components/NotificationCenter';
import ClassmatesSection from '@/components/ClassmatesSection';
import { getDefaultAvatar } from '@/utils/avatars';

export default function Dashboard({ user, setUser }) {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [streak, setStreak] = useState({ streak: 0, reward: 0 });
  const [quests, setQuests] = useState([]);
  const [badges, setBadges] = useState([]);
  const [badgeStats, setBadgeStats] = useState({ total: 0, earned: 0 });
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const showAnimations = useFirstVisitAnimation('dashboard');
  
  const gradeNames = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade'];
  
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
  }, [user]);
  
  const fetchDashboardData = async () => {
    try {
      const [walletRes, questsRes, badgesRes, goalsRes] = await Promise.all([
        axios.get(`${API}/wallet`),
        axios.get(`${API}/child/quests-new`),
        axios.get(`${API}/badges`),
        axios.get(`${API}/child/savings-goals`)
      ]);
      
      setWallet(walletRes.data);
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
      setQuests(activeQuests.slice(0, 2));
      // Get up to 8 badges (earned first, then unearned)
      const badgesList = badgesRes.data.badges?.slice(0, 8) || [];
      setBadges(badgesList);
      setBadgeStats({ total: badgesRes.data.total_badges || 0, earned: badgesRes.data.earned_count || 0 });
      
      // Set active savings goals (up to 2 for dashboard display)
      const activeGoals = (goalsRes.data || []).filter(g => !g.completed);
      setSavingsGoals(activeGoals);
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
    if (grade <= 2) return { icon: TrendingUp, label: 'Garden', path: '/garden', color: '#228B22', emoji: '🌻' };
    return { icon: TrendingUp, label: 'Stocks', path: '/stock-market', color: '#10B981', emoji: '📈' };
  };
  
  const investmentItem = getInvestmentItem();
  
  const navItems = [
    { icon: BookOpen, label: 'Learn', path: '/learn', color: '#FFD23F' },
    { icon: Wallet, label: 'Wallet', path: '/wallet', color: '#3D5A80' },
    { icon: Store, label: 'Store', path: '/store', color: '#EE6C4D' },
    investmentItem,
    { icon: Target, label: 'Quests', path: '/quests', color: '#9B5DE5' },
    { icon: MessageCircle, label: 'AI Buddy', path: '/chat', color: '#FFD23F' },
  ].filter(Boolean); // Remove null items
  
  // Grade-based account configuration
  const getAccountColors = () => {
    const baseAccounts = {
      spending: { bg: 'bg-gradient-to-br from-[#EE6C4D] to-[#FF8A6C]', icon: '💳', description: 'Money to buy things' },
      savings: { bg: 'bg-gradient-to-br from-[#06D6A0] to-[#42E8B3]', icon: '🐷', description: 'Money saved for later' },
      gifting: { bg: 'bg-gradient-to-br from-[#9B5DE5] to-[#B47EE5]', icon: '❤️', description: 'Money to help others' },
    };
    
    if (grade === 0) {
      // Kindergarten: No investing jar
      return baseAccounts;
    } else if (grade <= 2) {
      // Grade 1-2: Farming jar
      return {
        ...baseAccounts,
        investing: { bg: 'bg-gradient-to-br from-[#228B22] to-[#32CD32]', icon: '🌱', label: 'Farming', description: 'Money to grow plants' },
      };
    } else {
      // Grade 3+: Investing jar
      return {
        ...baseAccounts,
        investing: { bg: 'bg-gradient-to-br from-[#3D5A80] to-[#5A7BA0]', icon: '📈', description: 'Money that grows' },
      };
    }
  };
  
  const accountColors = getAccountColors();
  
  // Filter accounts based on grade
  const getFilteredAccounts = () => {
    if (!wallet?.accounts) return [];
    if (grade === 0) {
      // Kindergarten: Remove investing account
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
    <div className="min-h-screen bg-[#E0FBFC]" data-testid="dashboard">
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
            <p className="text-xl text-[#1D3557]">You earned <strong>₹{streak.reward}</strong>!</p>
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className="bg-white border-b-3 border-[#1D3557]">
        <div className="container mx-auto px-4 py-1">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center">
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
              
              {/* Total balance */}
              <div className="flex items-center gap-2 bg-[#06D6A0]/20 px-3 py-2 rounded-xl border-2 border-[#1D3557]">
                <Wallet className="w-5 h-5 text-[#06D6A0]" />
                <span className="font-bold text-[#1D3557]">₹{wallet?.total_balance?.toFixed(0) || 0}</span>
              </div>
              
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
        
        {/* Three Card Layout - Money Jars, Savings Goal, Classroom */}
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 ${showAnimations ? 'animate-bounce-in stagger-2' : ''}`}>
          {/* Money Jars Card */}
          <div className="card-playful p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                💰 My Money Jars
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
                    case 'spending': return '/store';
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
                      ₹{(account.account_type === 'savings' || account.account_type === 'investing'
                        ? (account.available_balance ?? account.balance)
                        : account.balance
                      )?.toFixed(0)}
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
                {savingsGoals.slice(0, 2).map((goal) => (
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
                    
                    <Progress value={Math.min(((goal.current_amount || 0) / goal.target_amount) * 100, 100)} className="h-2 mb-2" />
                    
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#06D6A0] font-bold">₹{goal.current_amount?.toFixed(0) || 0} saved</span>
                      <span className="text-[#EE6C4D] font-medium">₹{(goal.target_amount - (goal.current_amount || 0)).toFixed(0)} to go</span>
                      <span className="text-[#1D3557] font-bold flex items-center gap-1">
                        <Target className="w-3 h-3" />₹{goal.target_amount?.toFixed(0)}
                      </span>
                    </div>
                  </Link>
                ))}
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
          
          {/* Classroom Card */}
          <div className="card-playful p-4 flex flex-col">
            <ClassmatesSection 
              giftingBalance={wallet?.accounts?.find(a => a.account_type === 'gifting')?.balance || 0} 
              compact={true} 
              wallet={wallet}
              onRefresh={fetchDashboardData}
            />
          </div>
        </div>
        
        {/* Two Column Layout */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Active Quests */}
          <div className={`card-playful p-6 ${showAnimations ? 'animate-bounce-in stagger-3' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                Active Quests
              </h2>
              <Link to="/quests" className="text-[#3D5A80] hover:text-[#1D3557] flex items-center gap-1">
                See All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            
            {quests.length === 0 ? (
              <p className="text-center text-[#3D5A80] py-4">No active quests. <Link to="/quests" className="text-[#3D5A80] underline font-bold">Find some!</Link></p>
            ) : (
              <div className="space-y-3">
                {quests.map((quest) => (
                  <div key={quest.quest_id} className="bg-[#E0FBFC] rounded-xl border-2 border-[#1D3557] p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-[#1D3557]">{quest.title}</h3>
                        <p className="text-base text-[#3D5A80]">{quest.description}</p>
                      </div>
                      <span className="bg-[#FFD23F] text-[#1D3557] px-2 py-1 rounded-lg text-base font-bold">
                        +₹{quest.reward_amount}
                      </span>
                    </div>
                    <Progress value={quest.progress || 0} className="h-2" />
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* My Badges Section - 8 cute square cards */}
          <div className={`card-playful p-6 ${showAnimations ? 'animate-bounce-in stagger-4' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                  My Badges
                </h2>
                <span className="text-sm bg-[#FFD23F] text-[#1D3557] px-2 py-0.5 rounded-full font-bold">
                  {badgeStats.earned}/{badgeStats.total}
                </span>
              </div>
              <Link to="/achievements" className="text-[#3D5A80] hover:text-[#1D3557] flex items-center gap-1">
                See All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            
            {badges.length === 0 ? (
              <p className="text-center text-[#3D5A80] py-4">Complete activities to earn your first badge!</p>
            ) : (
              <div className="grid grid-cols-4 gap-3 gap-y-4">
                {badges.map((badge) => {
                  const hasImage = badge.image_url && badge.image_url.length > 0;
                  const imageUrl = hasImage ? getAssetUrl(badge.image_url) : null;
                  return (
                  <div 
                    key={badge.achievement_id} 
                    className={`text-center group cursor-pointer ${!badge.earned ? 'opacity-40' : ''}`}
                    title={`${badge.name} - ${badge.description}${hasImage ? ' (has image)' : ' (no image)'}`}
                  >
                    <div className={`w-12 h-12 mx-auto rounded-xl border-2 flex items-center justify-center overflow-hidden transition-all ${
                      badge.earned 
                        ? 'bg-[#FFD23F] border-[#1D3557] badge-earned group-hover:scale-110' 
                        : 'bg-gray-200 border-gray-400 grayscale'
                    }`}>
                      {hasImage ? (
                        <img 
                          src={imageUrl} 
                          alt={badge.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.error('Image failed to load:', imageUrl);
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="text-xl">{badge.icon}</span>
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
        </div>
        
        {/* AI Buddy Banner */}
        <div className={`mt-8 ${showAnimations ? 'animate-bounce-in stagger-5' : ''}`}>
          <Link 
            to="/chat"
            className="block p-6 bg-gradient-to-r from-[#3D5A80] to-[#5A7BA0] rounded-3xl border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557] hover:scale-[1.02] transition-transform"
          >
            <div className="flex items-center gap-6">
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
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
