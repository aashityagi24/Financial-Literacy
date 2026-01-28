import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { 
  Users, ChevronLeft, Plus, Gift, Target, Wallet, 
  Check, Clock, X, ChevronRight, Eye, Calendar, Trash2,
  School, Megaphone, Store, LogOut, User, TrendingUp, TrendingDown,
  Sprout, LineChart, BookOpen, Award, CheckCircle, XCircle, History
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import NotificationCenter from '@/components/NotificationCenter';
import { getDefaultAvatar } from '@/utils/avatars';

const gradeLabels = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade'];

export default function ParentDashboard({ user }) {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [chores, setChores] = useState([]);
  const [rewardPenalties, setRewardPenalties] = useState([]);
  const [allowances, setAllowances] = useState([]);
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [childClassrooms, setChildClassrooms] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState(null);
  const [childProgress, setChildProgress] = useState(null);
  const [showChildInsights, setShowChildInsights] = useState(null);
  const [childInsights, setChildInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  
  // Dialogs
  const [showLinkChild, setShowLinkChild] = useState(false);
  const [showCreateChore, setShowCreateChore] = useState(false);
  const [showRewardPenalty, setShowRewardPenalty] = useState(false);
  const [showGiveMoney, setShowGiveMoney] = useState(false);
  const [showAllowance, setShowAllowance] = useState(false);
  const [showSavingsGoal, setShowSavingsGoal] = useState(false);
  const [activeRPTab, setActiveRPTab] = useState('chores'); // 'chores', 'rewards', 'penalties'
  
  // Forms
  const [linkEmail, setLinkEmail] = useState('');
  const [choreForm, setChoreForm] = useState({ 
    child_id: '', 
    title: '', 
    description: '', 
    reward_amount: 5, 
    frequency: 'one_time',
    weekly_days: [],
    monthly_date: 1
  });
  const [rpForm, setRpForm] = useState({
    child_id: '',
    title: '',
    description: '',
    amount: 5,
    category: 'reward'
  });
  const [giveMoneyForm, setGiveMoneyForm] = useState({ child_id: '', amount: 10, reason: '' });
  const [allowanceForm, setAllowanceForm] = useState({ child_id: '', amount: 10, frequency: 'weekly' });
  const [goalForm, setGoalForm] = useState({ child_id: '', title: '', target_amount: 50 });
  const [choreRequests, setChoreRequests] = useState([]);
  
  useEffect(() => {
    if (user?.role !== 'parent') {
      toast.error('Parent access required');
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user, navigate]);
  
  const fetchData = async () => {
    try {
      const [dashRes, choresRes, rpRes, allowRes, goalsRes, choreReqRes] = await Promise.all([
        axios.get(`${API}/parent/dashboard`),
        axios.get(`${API}/parent/chores-new`).catch(() => ({ data: [] })),
        axios.get(`${API}/parent/reward-penalty`).catch(() => ({ data: [] })),
        axios.get(`${API}/parent/allowances`),
        axios.get(`${API}/parent/savings-goals`),
        axios.get(`${API}/parent/chore-requests`).catch(() => ({ data: [] }))
      ]);
      setDashboard(dashRes.data);
      setChores(choresRes.data);
      setRewardPenalties(rpRes.data);
      setAllowances(allowRes.data);
      setSavingsGoals(goalsRes.data);
      setChoreRequests(choreReqRes.data);
      
      // Fetch classroom info for each child
      if (dashRes.data?.children) {
        const classroomData = {};
        await Promise.all(
          dashRes.data.children.map(async (child) => {
            try {
              const classRes = await axios.get(`${API}/parent/children/${child.user_id}/classroom`);
              classroomData[child.user_id] = classRes.data;
            } catch (err) {
              classroomData[child.user_id] = { has_classroom: false };
            }
          })
        );
        setChildClassrooms(classroomData);
      }
    } catch (error) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchChildProgress = async (childId) => {
    try {
      const response = await axios.get(`${API}/parent/children/${childId}/progress`);
      setChildProgress(response.data);
      setSelectedChild(childId);
    } catch (error) {
      toast.error('Failed to load child progress');
    }
  };
  
  const fetchChildInsights = async (child) => {
    if (!child?.user_id) return;
    setShowChildInsights(child);
    setInsightsLoading(true);
    try {
      const res = await axios.get(`${API}/parent/children/${child.user_id}/insights`);
      setChildInsights(res.data);
    } catch (error) {
      toast.error('Failed to load child insights');
      console.error(error);
    } finally {
      setInsightsLoading(false);
    }
  };
  
  const handleLinkChild = async () => {
    try {
      await axios.post(`${API}/parent/link-child`, { child_email: linkEmail });
      toast.success('Child linked successfully!');
      setShowLinkChild(false);
      setLinkEmail('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to link child');
    }
  };
  
  const handleCreateChore = async () => {
    try {
      await axios.post(`${API}/parent/chores-new`, choreForm);
      toast.success('Chore created!');
      setShowCreateChore(false);
      setChoreForm({ child_id: '', title: '', description: '', reward_amount: 5, frequency: 'one_time', weekly_days: [], monthly_date: 1 });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create chore');
    }
  };
  
  const handleValidateChore = async (requestId, action) => {
    try {
      await axios.post(`${API}/parent/chore-requests/${requestId}/validate`, { action });
      toast.success(action === 'approve' ? 'Chore approved! Reward sent.' : 'Chore rejected');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to validate chore');
    }
  };
  
  const handleDeleteChore = async (choreId) => {
    try {
      await axios.delete(`${API}/parent/chores-new/${choreId}`);
      toast.success('Chore deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete chore');
    }
  };
  
  const handleCreateRewardPenalty = async () => {
    try {
      await axios.post(`${API}/parent/reward-penalty`, rpForm);
      const isReward = rpForm.category === 'reward';
      toast.success(`${isReward ? 'Reward' : 'Penalty'} applied!`);
      setShowRewardPenalty(false);
      setRpForm({ child_id: '', title: '', description: '', amount: 5, category: 'reward' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to apply reward/penalty');
    }
  };
  
  const handleGiveMoney = async () => {
    try {
      await axios.post(`${API}/parent/give-money`, giveMoneyForm);
      toast.success(`Gave ₹${giveMoneyForm.amount} to child!`);
      setShowGiveMoney(false);
      setGiveMoneyForm({ child_id: '', amount: 10, reason: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed');
    }
  };
  
  const handleSetAllowance = async () => {
    try {
      await axios.post(`${API}/parent/allowance`, allowanceForm);
      toast.success('Allowance set up!');
      setShowAllowance(false);
      setAllowanceForm({ child_id: '', amount: 10, frequency: 'weekly' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed');
    }
  };
  
  const handleCancelAllowance = async (allowanceId) => {
    try {
      await axios.delete(`${API}/parent/allowances/${allowanceId}`);
      toast.success('Allowance cancelled');
      fetchData();
    } catch (error) {
      toast.error('Failed to cancel allowance');
    }
  };
  
  const handleCreateGoal = async () => {
    try {
      await axios.post(`${API}/parent/savings-goals`, goalForm);
      toast.success('Savings goal created!');
      setShowSavingsGoal(false);
      setGoalForm({ child_id: '', title: '', target_amount: 50 });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed');
    }
  };
  
  const choreStatusColors = {
    pending: 'bg-[#FFD23F]/20 text-[#1D3557]',
    completed: 'bg-[#3D5A80]/20 text-[#3D5A80]',
    approved: 'bg-[#06D6A0]/20 text-[#06D6A0]'
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
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#E0FBFC]" data-testid="parent-dashboard">
      {/* Header */}
      <header className="bg-[#06D6A0] border-b-3 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl border-3 border-[#1D3557] flex items-center justify-center">
                <Users className="w-6 h-6 text-[#06D6A0]" />
              </div>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Fredoka' }}>Parent Dashboard</h1>
            </div>
            <div className="flex items-center gap-3">
              <NotificationCenter />
              <div className="flex items-center gap-2 px-3 py-2 bg-white/20 rounded-xl">
                <User className="w-4 h-4 text-white" />
                <span className="text-sm font-medium text-white">{user?.name || 'Parent'}</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl border-2 border-white hover:bg-white/20 transition-colors"
                data-testid="parent-logout-btn"
              >
                <LogOut className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Quick Links - Shopping List & Learning Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Shopping List Link */}
          <Link 
            to="/parent/shopping-list" 
            className="block bg-gradient-to-r from-[#EE6C4D] to-[#FF8A6C] rounded-xl p-5 hover:shadow-lg transition-shadow border-3 border-[#1D3557]"
            data-testid="parent-shopping-link"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl border-3 border-[#1D3557] flex items-center justify-center">
                  <Store className="w-6 h-6 text-[#EE6C4D]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Shopping List</h3>
                  <p className="text-white/80 text-sm">Create shopping lists and assign chores</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-white" />
            </div>
          </Link>
          
          {/* Learning Content Link - Shows for first child or dropdown */}
          {dashboard?.children?.length > 0 && (
            <div className="bg-gradient-to-r from-[#FFD23F] to-[#FFEB99] rounded-xl p-5 border-3 border-[#1D3557]">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-12 h-12 bg-white rounded-xl border-3 border-[#1D3557] flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-[#FFD23F]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#1D3557]">Learning Content</h3>
                  <p className="text-[#1D3557]/80 text-sm">View lessons for your child&apos;s grade</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {dashboard.children.map((child) => (
                  <Link
                    key={child.user_id}
                    to={`/learn?grade=${child.grade}`}
                    className="flex items-center gap-2 bg-white hover:bg-[#1D3557] hover:text-white px-3 py-2 rounded-lg border-2 border-[#1D3557] text-[#1D3557] text-sm font-medium transition-colors"
                    data-testid={`learn-link-${child.user_id}`}
                  >
                    <span>{child.name}</span>
                    <span className="text-xs opacity-70">({gradeLabels[child.grade]})</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {!selectedChild ? (
          <>
            {/* Children Overview */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>My Children</h2>
              <Dialog open={showLinkChild} onOpenChange={setShowLinkChild}>
                <DialogTrigger asChild>
                  <button className="btn-primary px-4 py-2 flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Link Child
                  </button>
                </DialogTrigger>
                <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Link Child Account</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <p className="text-sm text-[#3D5A80]">Enter your child&apos;s account email to link their account.</p>
                    <Input 
                      type="email"
                      placeholder="Child's email" 
                      value={linkEmail} 
                      onChange={(e) => setLinkEmail(e.target.value)}
                      className="border-3 border-[#1D3557]"
                    />
                    <button onClick={handleLinkChild} className="btn-primary w-full py-3">Link Account</button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            
            {dashboard?.children?.length === 0 ? (
              <div className="card-playful p-8 text-center mb-6">
                <Users className="w-16 h-16 mx-auto text-[#98C1D9] mb-4" />
                <h3 className="text-xl font-bold text-[#1D3557] mb-2">No Children Linked</h3>
                <p className="text-[#3D5A80]">Link your child&apos;s account to monitor their progress!</p>
              </div>
            ) : (
              <div className="grid gap-4 mb-6">
                {dashboard?.children?.map((child, index) => {
                  const classroomInfo = childClassrooms[child.user_id];
                  return (
                    <div 
                      key={child.user_id}
                      className="card-playful p-5"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex items-center gap-4">
                        <img 
                          src={child.picture || getDefaultAvatar('child', child.name)} 
                          alt={child.name}
                          className="w-14 h-14 rounded-full border-3 border-[#1D3557]"
                        />
                        <div className="flex-1">
                          <h3 className="font-bold text-[#1D3557] text-lg">{child.name}</h3>
                          <p className="text-xs text-[#3D5A80]">{gradeLabels[child.grade] || 'Unknown Grade'}</p>
                          <div className="flex items-center gap-4 text-sm text-[#3D5A80] mt-1">
                            <span>💰 ₹{child.total_balance?.toFixed(0)}</span>
                            <span>📚 {child.lessons_completed}/{child.total_lessons}</span>
                            {child.pending_chores > 0 && (
                              <span className="bg-[#EE6C4D] text-white px-2 py-0.5 rounded-full text-xs">
                                {child.pending_chores} chores waiting
                              </span>
                            )}
                          </div>
                          <Progress value={(child.lessons_completed / (child.total_lessons || 1)) * 100} className="h-2 mt-2" />
                        </div>
                        <button
                          onClick={() => fetchChildInsights(child)}
                          className="p-2 rounded-lg hover:bg-[#E0FBFC] transition-colors"
                          data-testid={`view-child-insights-${child.user_id}`}
                          title="View detailed insights"
                        >
                          <Eye className="w-5 h-5 text-[#3D5A80]" />
                        </button>
                      </div>
                      
                      {/* Child's Classroom Section */}
                      {classroomInfo?.has_classroom && (
                        <div className="mt-4 pt-4 border-t border-[#1D3557]/20">
                          <div className="flex items-center gap-2 mb-2">
                            <School className="w-4 h-4 text-[#06D6A0]" />
                            <span className="font-bold text-[#1D3557] text-base">{child.name}&apos;s Classroom</span>
                          </div>
                          <div className="bg-[#06D6A0]/10 rounded-xl p-3 border-2 border-[#06D6A0]">
                            <p className="font-bold text-[#1D3557]">{classroomInfo.classroom?.name}</p>
                            <p className="text-sm text-[#3D5A80]">Teacher: {classroomInfo.teacher?.name}</p>
                          </div>
                          
                          {/* Announcements */}
                          {classroomInfo.announcements?.length > 0 && (
                            <div className="mt-3">
                              <div className="flex items-center gap-1 mb-2">
                                <Megaphone className="w-4 h-4 text-[#FFD23F]" />
                                <span className="text-sm font-medium text-[#3D5A80]">Announcements</span>
                              </div>
                              <div className="space-y-2 max-h-32 overflow-y-auto">
                                {classroomInfo.announcements.slice(0, 2).map((ann) => (
                                  <div key={ann.announcement_id} className="bg-[#FFD23F]/20 rounded-lg p-2 border border-[#FFD23F]">
                                    <p className="font-bold text-[#1D3557] text-sm">{ann.title}</p>
                                    <p className="text-xs text-[#3D5A80]">{ann.message}</p>
                                    <p className="text-xs text-[#3D5A80]/60 mt-1">
                                      {new Date(ann.created_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Quick Actions */}
            {dashboard?.children?.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                <Dialog open={showGiveMoney} onOpenChange={setShowGiveMoney}>
                  <DialogTrigger asChild>
                    <button className="card-playful p-4 text-center hover:bg-[#FFD23F]/10">
                      <Gift className="w-8 h-8 mx-auto text-[#FFD23F] mb-2" />
                      <span className="font-bold text-[#1D3557]">Give Money</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Give Money</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <label className="block text-sm font-bold text-[#1D3557] mb-1">Select Child *</label>
                        <Select value={giveMoneyForm.child_id} onValueChange={(v) => setGiveMoneyForm({...giveMoneyForm, child_id: v})}>
                          <SelectTrigger className="border-3 border-[#1D3557]"><SelectValue placeholder="Choose a child" /></SelectTrigger>
                          <SelectContent>
                            {dashboard?.children?.map((c) => (
                              <SelectItem key={c.user_id} value={c.user_id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-[#1D3557] mb-1">Amount (₹) *</label>
                        <Input type="number" placeholder="Enter amount in Rupees" value={giveMoneyForm.amount} onChange={(e) => setGiveMoneyForm({...giveMoneyForm, amount: parseFloat(e.target.value)})} className="border-3 border-[#1D3557]" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-[#1D3557] mb-1">Reason (Optional)</label>
                        <Input placeholder="e.g., Birthday gift, Good grades" value={giveMoneyForm.reason} onChange={(e) => setGiveMoneyForm({...giveMoneyForm, reason: e.target.value})} className="border-3 border-[#1D3557]" />
                      </div>
                      <button onClick={handleGiveMoney} className="btn-primary w-full py-3">Give Money</button>
                    </div>
                  </DialogContent>
                </Dialog>
                
                <Dialog open={showCreateChore} onOpenChange={setShowCreateChore}>
                  <DialogTrigger asChild>
                    <button className="card-playful p-4 text-center hover:bg-[#06D6A0]/10">
                      <Target className="w-8 h-8 mx-auto text-[#06D6A0] mb-2" />
                      <span className="font-bold text-[#1D3557]">Add Chore</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Create Chore</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <label className="block text-sm font-bold text-[#1D3557] mb-1">Select Child *</label>
                        <Select value={choreForm.child_id} onValueChange={(v) => setChoreForm({...choreForm, child_id: v})}>
                          <SelectTrigger className="border-3 border-[#1D3557]"><SelectValue placeholder="Choose a child" /></SelectTrigger>
                          <SelectContent>
                            {dashboard?.children?.map((c) => (
                              <SelectItem key={c.user_id} value={c.user_id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-[#1D3557] mb-1">Chore Title *</label>
                        <Input placeholder="e.g., Clean your room" value={choreForm.title} onChange={(e) => setChoreForm({...choreForm, title: e.target.value})} className="border-3 border-[#1D3557]" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-[#1D3557] mb-1">Description (Optional)</label>
                        <Textarea placeholder="Add more details about the chore" value={choreForm.description} onChange={(e) => setChoreForm({...choreForm, description: e.target.value})} className="border-3 border-[#1D3557]" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-bold text-[#1D3557] mb-1">Reward (₹) *</label>
                          <Input type="number" placeholder="Amount" value={choreForm.reward_amount} onChange={(e) => setChoreForm({...choreForm, reward_amount: parseFloat(e.target.value)})} className="border-3 border-[#1D3557]" />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-[#1D3557] mb-1">Frequency *</label>
                          <Select value={choreForm.frequency} onValueChange={(v) => setChoreForm({...choreForm, frequency: v})}>
                            <SelectTrigger className="border-3 border-[#1D3557]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="once">One-time</SelectItem>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="text-xs text-[#3D5A80]">Your child will need to complete this chore and request approval. You&apos;ll need to validate it before the reward is credited.</p>
                      <button onClick={handleCreateChore} className="btn-primary w-full py-3">Create Chore</button>
                    </div>
                  </DialogContent>
                </Dialog>
                
                <Dialog open={showAllowance} onOpenChange={setShowAllowance}>
                  <DialogTrigger asChild>
                    <button className="card-playful p-4 text-center hover:bg-[#3D5A80]/10">
                      <Calendar className="w-8 h-8 mx-auto text-[#3D5A80] mb-2" />
                      <span className="font-bold text-[#1D3557]">Allowance</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Set Up Allowance</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <label className="block text-sm font-bold text-[#1D3557] mb-1">Select Child *</label>
                        <Select value={allowanceForm.child_id} onValueChange={(v) => setAllowanceForm({...allowanceForm, child_id: v})}>
                          <SelectTrigger className="border-3 border-[#1D3557]"><SelectValue placeholder="Choose a child" /></SelectTrigger>
                          <SelectContent>
                            {dashboard?.children?.map((c) => (
                              <SelectItem key={c.user_id} value={c.user_id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-[#1D3557] mb-1">Allowance Amount (₹) *</label>
                        <Input type="number" placeholder="Enter amount per period" value={allowanceForm.amount} onChange={(e) => setAllowanceForm({...allowanceForm, amount: parseFloat(e.target.value)})} className="border-3 border-[#1D3557]" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-[#1D3557] mb-1">Frequency *</label>
                        <Select value={allowanceForm.frequency} onValueChange={(v) => setAllowanceForm({...allowanceForm, frequency: v})}>
                          <SelectTrigger className="border-3 border-[#1D3557]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="biweekly">Bi-weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <button onClick={handleSetAllowance} className="btn-primary w-full py-3">Set Allowance</button>
                    </div>
                  </DialogContent>
                </Dialog>
                
                <Dialog open={showSavingsGoal} onOpenChange={setShowSavingsGoal}>
                  <DialogTrigger asChild>
                    <button className="card-playful p-4 text-center hover:bg-[#EE6C4D]/10">
                      <Wallet className="w-8 h-8 mx-auto text-[#EE6C4D] mb-2" />
                      <span className="font-bold text-[#1D3557]">Savings Goal</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Create Savings Goal</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <label className="block text-sm font-bold text-[#1D3557] mb-1">Select Child *</label>
                        <Select value={goalForm.child_id} onValueChange={(v) => setGoalForm({...goalForm, child_id: v})}>
                          <SelectTrigger className="border-3 border-[#1D3557]"><SelectValue placeholder="Choose a child" /></SelectTrigger>
                          <SelectContent>
                            {dashboard?.children?.map((c) => (
                              <SelectItem key={c.user_id} value={c.user_id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-[#1D3557] mb-1">Goal Title *</label>
                        <Input placeholder="e.g., New Bike, Video Game" value={goalForm.title} onChange={(e) => setGoalForm({...goalForm, title: e.target.value})} className="border-3 border-[#1D3557]" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-[#1D3557] mb-1">Target Amount (₹) *</label>
                        <Input type="number" placeholder="How much to save" value={goalForm.target_amount} onChange={(e) => setGoalForm({...goalForm, target_amount: parseFloat(e.target.value)})} className="border-3 border-[#1D3557]" />
                      </div>
                      <button onClick={handleCreateGoal} className="btn-primary w-full py-3">Create Goal</button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
            
            {/* Rewards & Penalties Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                  Rewards & Penalties
                </h2>
                <Dialog open={showRewardPenalty} onOpenChange={setShowRewardPenalty}>
                  <DialogTrigger asChild>
                    <button className="btn-secondary flex items-center gap-2" data-testid="add-reward-penalty-btn">
                      <Plus className="w-4 h-4" />
                      Quick Reward/Penalty
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                        {rpForm.category === 'reward' ? '🌟 Give Reward' : '⚠️ Apply Penalty'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setRpForm({...rpForm, category: 'reward'})}
                          className={`flex-1 py-2 rounded-xl font-bold transition-colors ${
                            rpForm.category === 'reward' 
                              ? 'bg-[#06D6A0] text-white' 
                              : 'bg-gray-100 text-[#3D5A80] hover:bg-gray-200'
                          }`}
                        >
                          🌟 Reward
                        </button>
                        <button
                          onClick={() => setRpForm({...rpForm, category: 'penalty'})}
                          className={`flex-1 py-2 rounded-xl font-bold transition-colors ${
                            rpForm.category === 'penalty' 
                              ? 'bg-[#EE6C4D] text-white' 
                              : 'bg-gray-100 text-[#3D5A80] hover:bg-gray-200'
                          }`}
                        >
                          ⚠️ Penalty
                        </button>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-[#1D3557] mb-1">Select Child *</label>
                        <Select value={rpForm.child_id} onValueChange={(v) => setRpForm({...rpForm, child_id: v})}>
                          <SelectTrigger className="border-3 border-[#1D3557]">
                            <SelectValue placeholder="Choose child" />
                          </SelectTrigger>
                          <SelectContent>
                            {dashboard?.children?.map(c => (
                              <SelectItem key={c.user_id} value={c.user_id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-[#1D3557] mb-1">
                          {rpForm.category === 'reward' ? 'Reason for Reward *' : 'Reason for Penalty *'}
                        </label>
                        <Input 
                          placeholder={rpForm.category === 'reward' ? 'e.g., Reading a chapter' : 'e.g., Slamming the door'}
                          value={rpForm.title} 
                          onChange={(e) => setRpForm({...rpForm, title: e.target.value})} 
                          className="border-3 border-[#1D3557]" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-[#1D3557] mb-1">Description (optional)</label>
                        <Textarea 
                          placeholder="Add more details..." 
                          value={rpForm.description} 
                          onChange={(e) => setRpForm({...rpForm, description: e.target.value})} 
                          className="border-3 border-[#1D3557]" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-[#1D3557] mb-1">Amount (₹) *</label>
                        <Input 
                          type="number" 
                          min="1"
                          placeholder="Amount" 
                          value={rpForm.amount} 
                          onChange={(e) => setRpForm({...rpForm, amount: parseFloat(e.target.value) || 0})} 
                          className="border-3 border-[#1D3557]" 
                        />
                      </div>
                      <p className={`text-sm ${rpForm.category === 'reward' ? 'text-[#06D6A0]' : 'text-[#EE6C4D]'}`}>
                        {rpForm.category === 'reward' 
                          ? `🌟 This will ADD ₹${rpForm.amount || 0} to their spending wallet` 
                          : `⚠️ This will DEDUCT ₹${rpForm.amount || 0} from their spending wallet (can go negative)`
                        }
                      </p>
                      <button 
                        onClick={handleCreateRewardPenalty} 
                        className={`w-full py-3 rounded-xl font-bold text-white transition-colors ${
                          rpForm.category === 'reward' 
                            ? 'bg-[#06D6A0] hover:bg-[#05C090]' 
                            : 'bg-[#EE6C4D] hover:bg-[#DD5B3C]'
                        }`}
                        data-testid="submit-reward-penalty"
                      >
                        {rpForm.category === 'reward' ? '🌟 Give Reward' : '⚠️ Apply Penalty'}
                      </button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              
              {/* Tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setActiveRPTab('chores')}
                  className={`px-4 py-2 rounded-xl font-bold transition-colors ${
                    activeRPTab === 'chores' 
                      ? 'bg-[#3D5A80] text-white' 
                      : 'bg-gray-100 text-[#3D5A80] hover:bg-gray-200'
                  }`}
                >
                  📋 Active Chores ({chores.filter(c => c.status !== 'approved' && c.status !== 'completed').length})
                </button>
                <button
                  onClick={() => setActiveRPTab('rewards')}
                  className={`px-4 py-2 rounded-xl font-bold transition-colors ${
                    activeRPTab === 'rewards' 
                      ? 'bg-[#06D6A0] text-white' 
                      : 'bg-gray-100 text-[#3D5A80] hover:bg-gray-200'
                  }`}
                >
                  🌟 Rewards ({rewardPenalties.filter(r => r.category === 'reward').length})
                </button>
                <button
                  onClick={() => setActiveRPTab('penalties')}
                  className={`px-4 py-2 rounded-xl font-bold transition-colors ${
                    activeRPTab === 'penalties' 
                      ? 'bg-[#EE6C4D] text-white' 
                      : 'bg-gray-100 text-[#3D5A80] hover:bg-gray-200'
                  }`}
                >
                  ⚠️ Penalties ({rewardPenalties.filter(r => r.category === 'penalty').length})
                </button>
                <button
                  onClick={() => setActiveRPTab('history')}
                  className={`px-4 py-2 rounded-xl font-bold transition-colors ${
                    activeRPTab === 'history' 
                      ? 'bg-[#9B5DE5] text-white' 
                      : 'bg-gray-100 text-[#3D5A80] hover:bg-gray-200'
                  }`}
                >
                  <History className="w-4 h-4 inline mr-1" />
                  History ({chores.filter(c => c.status === 'approved' || c.status === 'completed').length})
                </button>
              </div>
              
              {/* Chores Tab - Active Only */}
              {activeRPTab === 'chores' && (
                <div className="space-y-3">
                  {chores.filter(c => c.status !== 'approved' && c.status !== 'completed').length === 0 ? (
                    <p className="text-center text-[#3D5A80] py-4">No active chores. Create one using the button above!</p>
                  ) : (
                    chores.filter(c => c.status !== 'approved' && c.status !== 'completed').map((chore) => {
                      const pendingRequest = choreRequests.find(r => r.chore_id === chore.chore_id && r.status === 'pending');
                      
                      return (
                        <div key={chore.chore_id} className={`card-playful p-4 ${pendingRequest ? 'border-2 border-[#FFD23F] bg-[#FFD23F]/10' : ''}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-[#1D3557]">{chore.title}</h4>
                                {pendingRequest ? (
                                  <span className="bg-[#06D6A0] text-white text-xs px-2 py-1 rounded-full font-bold">
                                    ✓ {chore.child_name} marked complete
                                  </span>
                                ) : chore.status === 'pending_approval' ? (
                                  <span className="bg-[#FFD23F] text-[#1D3557] text-xs px-2 py-1 rounded-full font-bold">
                                    ⏳ Awaiting Approval
                                  </span>
                                ) : (
                                  <span className="bg-[#3D5A80]/20 text-[#1D3557] text-xs px-2 py-1 rounded-full font-bold">
                                    📋 Active
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-[#3D5A80]">{chore.child_name} • +₹{chore.reward_amount} • {chore.frequency}</p>
                              
                              {chore.shopping_item_details && chore.shopping_item_details.length > 0 && (
                                <div className="mt-2 bg-[#E0FBFC] rounded-lg p-2">
                                  <p className="text-xs font-bold text-[#3D5A80] mb-1">🛒 Shopping List:</p>
                                  <ul className="text-xs text-[#1D3557] space-y-0.5">
                                    {chore.shopping_item_details.map((item, idx) => (
                                      <li key={idx} className={item.purchased ? 'line-through text-[#06D6A0]' : ''}>
                                        • {item.item_name} × {item.quantity} {item.purchased && '✓'}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {pendingRequest ? (
                                <>
                                  <button 
                                    onClick={() => handleValidateChore(pendingRequest.request_id, 'approve')}
                                    className="p-2 bg-[#06D6A0] hover:bg-[#05C090] rounded-lg text-white"
                                    title="Approve - Money will be credited"
                                  >
                                    <Check className="w-5 h-5" />
                                  </button>
                                  <button 
                                    onClick={() => handleValidateChore(pendingRequest.request_id, 'reject')}
                                    className="p-2 bg-[#EE6C4D] hover:bg-[#DD5B3C] rounded-lg text-white"
                                    title="Reject - Ask to try again"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </>
                              ) : (
                                <button onClick={() => handleDeleteChore(chore.chore_id)} className="p-2 hover:bg-[#EE6C4D]/20 rounded-lg">
                                  <Trash2 className="w-4 h-4 text-[#EE6C4D]" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
              
              {/* Rewards Tab */}
              {activeRPTab === 'rewards' && (
                <div className="space-y-3">
                  {rewardPenalties.filter(r => r.category === 'reward').length === 0 ? (
                    <p className="text-center text-[#3D5A80] py-4">No rewards given yet. Use &quot;Quick Reward/Penalty&quot; to give one!</p>
                  ) : (
                    rewardPenalties.filter(r => r.category === 'reward').map((record) => (
                      <div key={record.record_id} className="card-playful p-4 border-l-4 border-[#06D6A0]">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🌟</span>
                              <h4 className="font-bold text-[#1D3557]">{record.title}</h4>
                            </div>
                            <p className="text-sm text-[#3D5A80]">
                              {dashboard?.children?.find(c => c.user_id === record.child_id)?.name || 'Child'} • 
                              <span className="text-[#06D6A0] font-bold"> +₹{Math.abs(record.amount)}</span>
                            </p>
                            {record.description && <p className="text-xs text-[#3D5A80] mt-1">{record.description}</p>}
                            <p className="text-xs text-[#98C1D9] mt-1">{new Date(record.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              
              {/* Penalties Tab */}
              {activeRPTab === 'penalties' && (
                <div className="space-y-3">
                  {rewardPenalties.filter(r => r.category === 'penalty').length === 0 ? (
                    <p className="text-center text-[#3D5A80] py-4">No penalties applied yet.</p>
                  ) : (
                    rewardPenalties.filter(r => r.category === 'penalty').map((record) => (
                      <div key={record.record_id} className="card-playful p-4 border-l-4 border-[#EE6C4D]">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">⚠️</span>
                              <h4 className="font-bold text-[#1D3557]">{record.title}</h4>
                            </div>
                            <p className="text-sm text-[#3D5A80]">
                              {dashboard?.children?.find(c => c.user_id === record.child_id)?.name || 'Child'} • 
                              <span className="text-[#EE6C4D] font-bold"> -₹{Math.abs(record.amount)}</span>
                            </p>
                            {record.description && <p className="text-xs text-[#3D5A80] mt-1">{record.description}</p>}
                            <p className="text-xs text-[#98C1D9] mt-1">{new Date(record.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              
              {/* History Tab - Completed Chores */}
              {activeRPTab === 'history' && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-[#1D3557] mb-3">Completed Chores</h3>
                  {chores.filter(c => c.status === 'approved' || c.status === 'completed').length === 0 ? (
                    <p className="text-center text-[#3D5A80] py-4">No completed chores yet.</p>
                  ) : (
                    chores.filter(c => c.status === 'approved' || c.status === 'completed').map((chore) => (
                      <div key={chore.chore_id} className="card-playful p-4 opacity-80 bg-[#06D6A0]/10 border-l-4 border-[#06D6A0]">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">✅</span>
                              <h4 className="font-bold text-[#1D3557] line-through">{chore.title}</h4>
                            </div>
                            <p className="text-sm text-[#3D5A80]">
                              {chore.child_name} • <span className="text-[#06D6A0] font-bold">+₹{chore.reward_amount}</span> earned
                            </p>
                            <p className="text-xs text-[#98C1D9] mt-1">Completed • {chore.frequency}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  
                  <h3 className="text-lg font-bold text-[#1D3557] mb-3 mt-6">Reward & Penalty History</h3>
                  {rewardPenalties.length === 0 ? (
                    <p className="text-center text-[#3D5A80] py-4">No rewards or penalties applied yet.</p>
                  ) : (
                    rewardPenalties.map((record) => (
                      <div 
                        key={record.record_id} 
                        className={`card-playful p-4 opacity-80 border-l-4 ${
                          record.category === 'reward' ? 'border-[#06D6A0] bg-[#06D6A0]/10' : 'border-[#EE6C4D] bg-[#EE6C4D]/10'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{record.category === 'reward' ? '🌟' : '⚠️'}</span>
                              <h4 className="font-bold text-[#1D3557]">{record.title}</h4>
                            </div>
                            <p className="text-sm text-[#3D5A80]">
                              {dashboard?.children?.find(c => c.user_id === record.child_id)?.name || 'Child'} • 
                              <span className={record.category === 'reward' ? 'text-[#06D6A0] font-bold' : 'text-[#EE6C4D] font-bold'}>
                                {record.category === 'reward' ? '+' : '-'}₹{Math.abs(record.amount)}
                              </span>
                            </p>
                            {record.description && <p className="text-xs text-[#3D5A80] mt-1">{record.description}</p>}
                            <p className="text-xs text-[#98C1D9] mt-1">{new Date(record.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            
            {/* Allowances */}
            {allowances.length > 0 && (
              <>
                <h2 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>Active Allowances</h2>
                <div className="space-y-3 mb-6">
                  {allowances.map((allowance) => (
                    <div key={allowance.allowance_id} className="card-playful p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-[#1D3557]">{allowance.child_name}</h4>
                          <p className="text-sm text-[#3D5A80]">₹{allowance.amount} {allowance.frequency} • Next: {allowance.next_date}</p>
                        </div>
                        <button onClick={() => handleCancelAllowance(allowance.allowance_id)} className="text-[#EE6C4D] text-sm hover:underline">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            
            {/* Savings Goals */}
            {savingsGoals.length > 0 && (
              <>
                <h2 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>Savings Goals</h2>
                <div className="space-y-3">
                  {savingsGoals.map((goal) => (
                    <div key={goal.goal_id} className="card-playful p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-bold text-[#1D3557]">{goal.title}</h4>
                          <p className="text-sm text-[#3D5A80]">
                            {goal.child_name} • Created by {goal.created_by || 'Parent'}
                          </p>
                          {goal.deadline && (
                            <p className="text-xs text-[#3D5A80]">
                              📅 Target: {new Date(goal.deadline).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className={`font-bold ${goal.completed ? 'text-[#06D6A0]' : 'text-[#1D3557]'}`}>
                            ₹{goal.current_amount || 0}/₹{goal.target_amount}
                          </span>
                          {!goal.completed && goal.amount_to_go > 0 && (
                            <p className="text-xs text-[#3D5A80]">₹{goal.amount_to_go} to go</p>
                          )}
                        </div>
                      </div>
                      <Progress value={goal.progress_percent || (goal.current_amount / goal.target_amount) * 100} className="h-2" />
                      {goal.completed && <p className="text-xs text-[#06D6A0] mt-1">✓ Goal reached!</p>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {/* Child Progress View */}
            <button 
              onClick={() => { setSelectedChild(null); setChildProgress(null); }}
              className="text-[#3D5A80] mb-4 flex items-center gap-2 hover:text-[#1D3557]"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            
            {childProgress && (
              <>
                {/* Child Header */}
                <div className="card-playful p-6 mb-6 bg-gradient-to-r from-[#06D6A0] to-[#42E8B3] text-white">
                  <div className="flex items-center gap-4">
                    <img 
                      src={childProgress.child.picture || getDefaultAvatar('child', childProgress.child.name)} 
                      alt={childProgress.child.name}
                      className="w-16 h-16 rounded-full border-3 border-white"
                    />
                    <div>
                      <h2 className="text-2xl font-bold" style={{ fontFamily: 'Fredoka' }}>{childProgress.child.name}</h2>
                      <p className="opacity-90">🔥 {childProgress.streak} day streak</p>
                    </div>
                  </div>
                </div>
                
                {/* Wallet */}
                <h3 className="text-lg font-bold text-[#1D3557] mb-3" style={{ fontFamily: 'Fredoka' }}>Wallet</h3>
                <div className="grid grid-cols-4 gap-3 mb-6">
                  {childProgress.wallet.map((acc) => (
                    <div key={acc.account_type} className="card-playful p-3 text-center">
                      <p className="text-lg font-bold text-[#1D3557]">₹{acc.balance.toFixed(0)}</p>
                      <p className="text-xs text-[#3D5A80] capitalize">{acc.account_type}</p>
                    </div>
                  ))}
                </div>
                
                {/* Learning Progress */}
                <h3 className="text-lg font-bold text-[#1D3557] mb-3" style={{ fontFamily: 'Fredoka' }}>Learning Progress</h3>
                <div className="space-y-3 mb-6">
                  {childProgress.topic_progress.map((topic) => (
                    <div key={topic.topic} className="card-playful p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-[#1D3557]">{topic.icon} {topic.topic}</span>
                        <span className="text-sm text-[#3D5A80]">{topic.completed}/{topic.total}</span>
                      </div>
                      <Progress value={topic.total > 0 ? (topic.completed / topic.total) * 100 : 0} className="h-2" />
                    </div>
                  ))}
                </div>
                
                {/* Recent Activity */}
                <h3 className="text-lg font-bold text-[#1D3557] mb-3" style={{ fontFamily: 'Fredoka' }}>Recent Activity</h3>
                <div className="card-playful p-4">
                  {childProgress.transactions.length === 0 ? (
                    <p className="text-[#3D5A80] text-center">No recent activity</p>
                  ) : (
                    <div className="space-y-2">
                      {childProgress.transactions.slice(0, 5).map((tx) => (
                        <div key={tx.transaction_id} className="flex items-center justify-between py-2 border-b border-[#1D3557]/10 last:border-0">
                          <span className="text-sm text-[#3D5A80]">{tx.description}</span>
                          <span className={`font-bold ${tx.to_account ? 'text-[#06D6A0]' : 'text-[#EE6C4D]'}`}>
                            {tx.to_account ? '+' : '-'}₹{tx.amount.toFixed(0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
        
        {/* Child Insights Modal */}
        <Dialog open={!!showChildInsights} onOpenChange={() => { setShowChildInsights(null); setChildInsights(null); }}>
          <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#1D3557] flex items-center gap-3" style={{ fontFamily: 'Fredoka' }}>
                <img 
                  src={showChildInsights?.picture || getDefaultAvatar('child', showChildInsights?.name)} 
                  alt="" 
                  className="w-10 h-10 rounded-full border-2 border-[#1D3557]"
                />
                {showChildInsights?.name}&apos;s Insights
              </DialogTitle>
            </DialogHeader>
            
            {insightsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1D3557]"></div>
                <span className="ml-3 text-[#3D5A80]">Loading insights...</span>
              </div>
            ) : childInsights ? (
              <div className="space-y-6 mt-4">
                {/* Quick Stats Row */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-[#FFD23F]/20 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-[#1D3557]">₹{childInsights.wallet?.total_balance?.toFixed(0)}</p>
                    <p className="text-xs text-[#3D5A80]">Available Balance</p>
                  </div>
                  <div className="bg-[#06D6A0]/20 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-[#1D3557]">{childInsights.learning?.lessons_completed}</p>
                    <p className="text-xs text-[#3D5A80]">Lessons Done</p>
                  </div>
                  <div className="bg-[#EE6C4D]/20 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-[#1D3557]">{childInsights.child?.streak_count || 0}</p>
                    <p className="text-xs text-[#3D5A80]">Day Streak</p>
                  </div>
                  <div className="bg-[#3D5A80]/20 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-[#1D3557]">{childInsights.achievements?.badges_earned || 0}</p>
                    <p className="text-xs text-[#3D5A80]">Badges</p>
                  </div>
                </div>

                {/* Grade & Investment Info */}
                <div className="bg-[#98C1D9]/20 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-[#1D3557] font-medium">Grade: {gradeLabels[childInsights.child?.grade] || 'Unknown'}</span>
                  <span className="text-[#3D5A80] text-sm">
                    {childInsights.investment_type === 'garden' && '🌱 Money Garden available'}
                    {childInsights.investment_type === 'stocks' && '📈 Stock Market available'}
                    {!childInsights.investment_type && '📚 Learning focus (no investments yet)'}
                  </span>
                </div>

                {/* Money Jars - Balance & Spent */}
                <div className="bg-gradient-to-r from-[#FFD23F]/10 to-[#FFEB99]/10 rounded-xl p-4 border-2 border-[#FFD23F]/30">
                  <h4 className="font-bold text-[#1D3557] mb-3 flex items-center gap-2">
                    <Wallet className="w-5 h-5" /> Money Jars (Balance / Spent)
                  </h4>
                  <div className="grid grid-cols-4 gap-3">
                    {childInsights.wallet?.accounts?.map((acc) => {
                      const isSavings = acc.account_type === 'savings';
                      const savedInGoals = childInsights.wallet?.savings_in_goals || 0;
                      
                      return (
                        <div key={acc.account_type} className="bg-white rounded-lg p-3 border border-[#1D3557]/10">
                          <p className="text-xs text-[#3D5A80] capitalize mb-1">{acc.account_type}</p>
                          <p className="text-lg font-bold text-[#1D3557]">₹{acc.balance?.toFixed(0)}</p>
                          <p className="text-xs text-[#3D5A80]">available</p>
                          {isSavings ? (
                            <p className="text-xs mt-1">
                              <span className="text-green-600 font-medium">₹{savedInGoals?.toFixed(0)}</span>
                              <span className="text-[#3D5A80]"> in goals</span>
                            </p>
                          ) : (
                            <p className="text-xs mt-1">
                              <span className="text-red-500 font-medium">₹{acc.spent?.toFixed(0) || 0}</span>
                              <span className="text-[#3D5A80]"> spent</span>
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Savings Goals Detail */}
                  {childInsights.wallet?.savings_goals?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#1D3557]/10">
                      <p className="text-sm font-medium text-[#1D3557] mb-2">Savings Goals:</p>
                      <div className="space-y-2">
                        {childInsights.wallet.savings_goals.map((goal, i) => (
                          <div key={i} className="flex items-center justify-between text-sm bg-white rounded-lg p-2">
                            <span className="text-[#3D5A80]">{goal.title}</span>
                            <span className={goal.completed ? 'text-green-600' : 'text-[#1D3557]'}>
                              ₹{goal.current} / ₹{goal.target} {goal.completed && '✓'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-3 pt-3 border-t border-[#1D3557]/10 grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <span className="text-[#3D5A80]">Total Earned: </span>
                      <span className="font-bold text-green-600">₹{childInsights.transactions?.total_earned?.toFixed(0)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-red-500" />
                      <span className="text-[#3D5A80]">Total Spent: </span>
                      <span className="font-bold text-red-600">₹{childInsights.transactions?.total_spent?.toFixed(0)}</span>
                    </div>
                  </div>
                  
                  {/* Recent Activity - sorted newest first */}
                  {childInsights.transactions?.recent?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#1D3557]/10">
                      <h5 className="font-bold text-[#1D3557] text-sm mb-2">Recent Activity:</h5>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {childInsights.transactions.recent.slice(0, 5).map((tx, i) => (
                          <div key={i} className="flex items-center justify-between text-xs bg-white rounded p-2">
                            <span className="text-[#3D5A80] truncate max-w-[180px]">{tx.description || tx.transaction_type}</span>
                            <span className={tx.amount >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                              {tx.amount >= 0 ? '+' : ''}₹{Math.abs(tx.amount).toFixed(0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Chores & Quests */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#06D6A0]/10 rounded-xl p-4 border-2 border-[#06D6A0]/30">
                    <h4 className="font-bold text-[#1D3557] mb-3 flex items-center gap-2">
                      <Target className="w-5 h-5" /> Chores (From You)
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#3D5A80]">Assigned:</span>
                        <span className="font-bold text-[#1D3557]">{childInsights.chores?.total_assigned}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#3D5A80] flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" /> Completed:</span>
                        <span className="font-bold text-green-600">{childInsights.chores?.completed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#3D5A80] flex items-center gap-1"><Clock className="w-3 h-3 text-yellow-500" /> Pending:</span>
                        <span className="font-bold text-yellow-600">{childInsights.chores?.pending}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#3D5A80] flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" /> Rejected:</span>
                        <span className="font-bold text-red-600">{childInsights.chores?.rejected}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-[#EE6C4D]/10 rounded-xl p-4 border-2 border-[#EE6C4D]/30">
                    <h4 className="font-bold text-[#1D3557] mb-3 flex items-center gap-2">
                      <Gift className="w-5 h-5" /> Gift Activity
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#3D5A80]">Gifts Received:</span>
                        <span className="font-bold text-green-600">{childInsights.gifts?.received_count} (₹{childInsights.gifts?.received_total?.toFixed(0)})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#3D5A80]">Gifts Sent:</span>
                        <span className="font-bold text-[#EE6C4D]">{childInsights.gifts?.sent_count} (₹{childInsights.gifts?.sent_total?.toFixed(0)})</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-[#3D5A80]">Quests Completed:</span>
                        <span className="font-bold text-[#1D3557]">{childInsights.quests?.completed}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Investments - Based on Grade */}
                {childInsights.investment_type === 'garden' && childInsights.garden && (
                  <div className="bg-green-50 rounded-xl p-4 border-2 border-green-200">
                    <h4 className="font-bold text-[#1D3557] mb-3 flex items-center gap-2">
                      <Sprout className="w-5 h-5 text-green-600" /> Money Garden
                    </h4>
                    <div className="grid grid-cols-4 gap-3 text-sm">
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-[#1D3557]">{childInsights.garden.plots_owned}</p>
                        <p className="text-xs text-[#3D5A80]">Plots</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-[#1D3557]">₹{childInsights.garden.total_invested?.toFixed(0)}</p>
                        <p className="text-xs text-[#3D5A80]">Invested</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-green-600">₹{childInsights.garden.total_earned?.toFixed(0)}</p>
                        <p className="text-xs text-[#3D5A80]">Earned</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className={`text-lg font-bold ${childInsights.garden.profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {childInsights.garden.profit_loss >= 0 ? '+' : ''}₹{childInsights.garden.profit_loss?.toFixed(0)}
                        </p>
                        <p className="text-xs text-[#3D5A80]">P/L</p>
                      </div>
                    </div>
                  </div>
                )}

                {childInsights.investment_type === 'stocks' && childInsights.stocks && (
                  <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
                    <h4 className="font-bold text-[#1D3557] mb-3 flex items-center gap-2">
                      <LineChart className="w-5 h-5 text-blue-600" /> Stock Market
                    </h4>
                    <div className="grid grid-cols-4 gap-3 text-sm">
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-[#1D3557]">{childInsights.stocks.holdings_count}</p>
                        <p className="text-xs text-[#3D5A80]">Holdings</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-[#1D3557]">₹{childInsights.stocks.portfolio_value?.toFixed(0)}</p>
                        <p className="text-xs text-[#3D5A80]">Portfolio</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className={`text-lg font-bold ${childInsights.stocks.realized_gains >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {childInsights.stocks.realized_gains >= 0 ? '+' : ''}₹{childInsights.stocks.realized_gains?.toFixed(0)}
                        </p>
                        <p className="text-xs text-[#3D5A80]">Realized</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className={`text-lg font-bold ${childInsights.stocks.unrealized_gains >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {childInsights.stocks.unrealized_gains >= 0 ? '+' : ''}₹{childInsights.stocks.unrealized_gains?.toFixed(0)}
                        </p>
                        <p className="text-xs text-[#3D5A80]">Unrealized</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Learning Progress */}
                <div className="bg-[#3D5A80]/10 rounded-xl p-4 border-2 border-[#3D5A80]/30">
                  <h4 className="font-bold text-[#1D3557] mb-3 flex items-center gap-2">
                    <BookOpen className="w-5 h-5" /> Learning Progress
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#3D5A80]">Lessons Completed:</span>
                      <span className="font-bold">{childInsights.learning?.lessons_completed} / {childInsights.learning?.total_lessons}</span>
                    </div>
                    <Progress 
                      value={childInsights.learning?.completion_percentage} 
                      className="h-3"
                    />
                    <p className="text-center text-sm font-bold text-[#1D3557]">
                      {childInsights.learning?.completion_percentage}% Complete
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-[#3D5A80]">
                No insights available
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
