import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { 
  Users, ChevronLeft, Plus, Gift, Target, Wallet, 
  Check, Clock, X, ChevronRight, Eye, Calendar, Trash2
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

export default function ParentDashboard({ user }) {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [chores, setChores] = useState([]);
  const [allowances, setAllowances] = useState([]);
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState(null);
  const [childProgress, setChildProgress] = useState(null);
  
  // Dialogs
  const [showLinkChild, setShowLinkChild] = useState(false);
  const [showCreateChore, setShowCreateChore] = useState(false);
  const [showGiveMoney, setShowGiveMoney] = useState(false);
  const [showAllowance, setShowAllowance] = useState(false);
  const [showSavingsGoal, setShowSavingsGoal] = useState(false);
  
  // Forms
  const [linkEmail, setLinkEmail] = useState('');
  const [choreForm, setChoreForm] = useState({ child_id: '', title: '', description: '', reward_amount: 5, frequency: 'once' });
  const [giveMoneyForm, setGiveMoneyForm] = useState({ child_id: '', amount: 10, reason: '' });
  const [allowanceForm, setAllowanceForm] = useState({ child_id: '', amount: 10, frequency: 'weekly' });
  const [goalForm, setGoalForm] = useState({ child_id: '', title: '', target_amount: 50 });
  
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
      const [dashRes, choresRes, allowRes, goalsRes] = await Promise.all([
        axios.get(`${API}/parent/dashboard`),
        axios.get(`${API}/parent/chores`),
        axios.get(`${API}/parent/allowances`),
        axios.get(`${API}/parent/savings-goals`)
      ]);
      setDashboard(dashRes.data);
      setChores(choresRes.data);
      setAllowances(allowRes.data);
      setSavingsGoals(goalsRes.data);
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
      await axios.post(`${API}/parent/chores`, choreForm);
      toast.success('Chore created!');
      setShowCreateChore(false);
      setChoreForm({ child_id: '', title: '', description: '', reward_amount: 5, frequency: 'once' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create chore');
    }
  };
  
  const handleApproveChore = async (choreId) => {
    try {
      await axios.post(`${API}/parent/chores/${choreId}/approve`);
      toast.success('Chore approved! Reward given.');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    }
  };
  
  const handleDeleteChore = async (choreId) => {
    try {
      await axios.delete(`${API}/parent/chores/${choreId}`);
      toast.success('Chore deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete chore');
    }
  };
  
  const handleGiveMoney = async () => {
    try {
      await axios.post(`${API}/parent/give-money`, giveMoneyForm);
      toast.success(`Gave $${giveMoneyForm.amount} to child!`);
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
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="p-2 rounded-xl border-2 border-white hover:bg-white/20">
              <ChevronLeft className="w-5 h-5 text-white" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl border-3 border-[#1D3557] flex items-center justify-center">
                <Users className="w-6 h-6 text-[#06D6A0]" />
              </div>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Fredoka' }}>Parent Dashboard</h1>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
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
                    <p className="text-sm text-[#3D5A80]">Enter your child's account email to link their account.</p>
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
                <p className="text-[#3D5A80]">Link your child's account to monitor their progress!</p>
              </div>
            ) : (
              <div className="grid gap-4 mb-6">
                {dashboard?.children?.map((child, index) => (
                  <div 
                    key={child.user_id}
                    className="card-playful p-5 cursor-pointer hover:scale-[1.01] transition-transform"
                    style={{ animationDelay: `${index * 0.05}s` }}
                    onClick={() => fetchChildProgress(child.user_id)}
                  >
                    <div className="flex items-center gap-4">
                      <img 
                        src={child.picture || 'https://via.placeholder.com/50'} 
                        alt={child.name}
                        className="w-14 h-14 rounded-full border-3 border-[#1D3557]"
                      />
                      <div className="flex-1">
                        <h3 className="font-bold text-[#1D3557] text-lg">{child.name}</h3>
                        <div className="flex items-center gap-4 text-sm text-[#3D5A80]">
                          <span>💰 ${child.total_balance?.toFixed(0)}</span>
                          <span>📚 {child.lessons_completed}/{child.total_lessons}</span>
                          {child.pending_chores > 0 && (
                            <span className="bg-[#EE6C4D] text-white px-2 py-0.5 rounded-full text-xs">
                              {child.pending_chores} chores waiting
                            </span>
                          )}
                        </div>
                        <Progress value={(child.lessons_completed / (child.total_lessons || 1)) * 100} className="h-2 mt-2" />
                      </div>
                      <ChevronRight className="w-5 h-5 text-[#3D5A80]" />
                    </div>
                  </div>
                ))}
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
                      <Select value={giveMoneyForm.child_id} onValueChange={(v) => setGiveMoneyForm({...giveMoneyForm, child_id: v})}>
                        <SelectTrigger className="border-3 border-[#1D3557]"><SelectValue placeholder="Select Child" /></SelectTrigger>
                        <SelectContent>
                          {dashboard?.children?.map((c) => (
                            <SelectItem key={c.user_id} value={c.user_id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input type="number" placeholder="Amount" value={giveMoneyForm.amount} onChange={(e) => setGiveMoneyForm({...giveMoneyForm, amount: parseFloat(e.target.value)})} className="border-3 border-[#1D3557]" />
                      <Input placeholder="Reason (optional)" value={giveMoneyForm.reason} onChange={(e) => setGiveMoneyForm({...giveMoneyForm, reason: e.target.value})} className="border-3 border-[#1D3557]" />
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
                      <Select value={choreForm.child_id} onValueChange={(v) => setChoreForm({...choreForm, child_id: v})}>
                        <SelectTrigger className="border-3 border-[#1D3557]"><SelectValue placeholder="Select Child" /></SelectTrigger>
                        <SelectContent>
                          {dashboard?.children?.map((c) => (
                            <SelectItem key={c.user_id} value={c.user_id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input placeholder="Chore Title" value={choreForm.title} onChange={(e) => setChoreForm({...choreForm, title: e.target.value})} className="border-3 border-[#1D3557]" />
                      <Textarea placeholder="Description (optional)" value={choreForm.description} onChange={(e) => setChoreForm({...choreForm, description: e.target.value})} className="border-3 border-[#1D3557]" />
                      <div className="grid grid-cols-2 gap-3">
                        <Input type="number" placeholder="Reward $" value={choreForm.reward_amount} onChange={(e) => setChoreForm({...choreForm, reward_amount: parseFloat(e.target.value)})} className="border-3 border-[#1D3557]" />
                        <Select value={choreForm.frequency} onValueChange={(v) => setChoreForm({...choreForm, frequency: v})}>
                          <SelectTrigger className="border-3 border-[#1D3557]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="once">One-time</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
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
                      <Select value={allowanceForm.child_id} onValueChange={(v) => setAllowanceForm({...allowanceForm, child_id: v})}>
                        <SelectTrigger className="border-3 border-[#1D3557]"><SelectValue placeholder="Select Child" /></SelectTrigger>
                        <SelectContent>
                          {dashboard?.children?.map((c) => (
                            <SelectItem key={c.user_id} value={c.user_id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input type="number" placeholder="Amount" value={allowanceForm.amount} onChange={(e) => setAllowanceForm({...allowanceForm, amount: parseFloat(e.target.value)})} className="border-3 border-[#1D3557]" />
                      <Select value={allowanceForm.frequency} onValueChange={(v) => setAllowanceForm({...allowanceForm, frequency: v})}>
                        <SelectTrigger className="border-3 border-[#1D3557]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="biweekly">Bi-weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
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
                      <Select value={goalForm.child_id} onValueChange={(v) => setGoalForm({...goalForm, child_id: v})}>
                        <SelectTrigger className="border-3 border-[#1D3557]"><SelectValue placeholder="Select Child" /></SelectTrigger>
                        <SelectContent>
                          {dashboard?.children?.map((c) => (
                            <SelectItem key={c.user_id} value={c.user_id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input placeholder="Goal Title (e.g., New Bike)" value={goalForm.title} onChange={(e) => setGoalForm({...goalForm, title: e.target.value})} className="border-3 border-[#1D3557]" />
                      <Input type="number" placeholder="Target Amount" value={goalForm.target_amount} onChange={(e) => setGoalForm({...goalForm, target_amount: parseFloat(e.target.value)})} className="border-3 border-[#1D3557]" />
                      <button onClick={handleCreateGoal} className="btn-primary w-full py-3">Create Goal</button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
            
            {/* Chores Pending Approval */}
            {chores.filter(c => c.status === 'completed').length > 0 && (
              <>
                <h2 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
                  Chores Waiting Approval
                </h2>
                <div className="space-y-3 mb-6">
                  {chores.filter(c => c.status === 'completed').map((chore) => (
                    <div key={chore.chore_id} className="card-playful p-4 bg-[#FFD23F]/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-[#1D3557]">{chore.title}</h4>
                          <p className="text-sm text-[#3D5A80]">{chore.child_name} • +${chore.reward_amount}</p>
                        </div>
                        <button onClick={() => handleApproveChore(chore.chore_id)} className="btn-primary px-4 py-2">
                          <Check className="w-4 h-4 mr-1 inline" /> Approve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            
            {/* All Chores */}
            {chores.length > 0 && (
              <>
                <h2 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>All Chores</h2>
                <div className="space-y-3 mb-6">
                  {chores.map((chore) => (
                    <div key={chore.chore_id} className="card-playful p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-[#1D3557]">{chore.title}</h4>
                            <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${choreStatusColors[chore.status]}`}>
                              {chore.status}
                            </span>
                          </div>
                          <p className="text-sm text-[#3D5A80]">{chore.child_name} • +${chore.reward_amount} • {chore.frequency}</p>
                        </div>
                        <button onClick={() => handleDeleteChore(chore.chore_id)} className="p-2 hover:bg-[#EE6C4D]/20 rounded-lg">
                          <Trash2 className="w-4 h-4 text-[#EE6C4D]" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            
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
                          <p className="text-sm text-[#3D5A80]">{goal.child_name}</p>
                        </div>
                        <span className={`font-bold ${goal.completed ? 'text-[#06D6A0]' : 'text-[#1D3557]'}`}>
                          ${goal.current_amount}/${goal.target_amount}
                        </span>
                      </div>
                      <Progress value={(goal.current_amount / goal.target_amount) * 100} className="h-2" />
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
                      src={childProgress.child.picture || 'https://via.placeholder.com/60'} 
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
                            {tx.to_account ? '+' : '-'}${tx.amount.toFixed(0)}
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
      </main>
    </div>
  );
}
