import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { 
  Wallet, ArrowLeftRight, ArrowDown, ArrowUp, 
  Home, ChevronLeft, History, Target, Plus, Upload, Calendar, Check
} from 'lucide-react';
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

export default function WalletPage({ user }) {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [transferOpen, setTransferOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [transferData, setTransferData] = useState({
    from_account: '',
    to_account: '',
    amount: ''
  });
  const [goalForm, setGoalForm] = useState({
    title: '',
    description: '',
    image_url: '',
    target_amount: '',
    deadline: ''
  });
  const [allocateData, setAllocateData] = useState({
    goal_id: '',
    amount: ''
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const accountInfo = {
    spending: { 
      icon: '🛒', 
      color: 'from-[#EE6C4D] to-[#FF8A6C]',
      description: 'Use this to buy things!',
      action: { label: 'Go Shopping', path: '/store' }
    },
    savings: { 
      icon: '🐷', 
      color: 'from-[#06D6A0] to-[#42E8B3]',
      description: 'Save up for something special!',
      action: { label: 'Set Goal', onClick: 'openGoal' }
    },
    investing: { 
      icon: '📈', 
      color: 'from-[#3D5A80] to-[#5A7BA0]',
      description: 'Grow your money over time!',
      action: { label: 'Go Invest', path: '/investments' }
    },
    giving: { 
      icon: '❤️', 
      color: 'from-[#9B5DE5] to-[#B47EE5]',
      description: 'Share with others who need it!',
      action: { label: 'Give ₹', path: '/quests' }
    },
  };
  
  useEffect(() => {
    fetchWalletData();
  }, []);
  
  const fetchWalletData = async () => {
    try {
      const [walletRes, transRes, goalsRes] = await Promise.all([
        axios.get(`${API}/wallet`),
        axios.get(`${API}/wallet/transactions`),
        axios.get(`${API}/child/savings-goals`)
      ]);
      setWallet(walletRes.data);
      setTransactions(transRes.data);
      setSavingsGoals(goalsRes.data || []);
    } catch (error) {
      toast.error('Failed to load wallet');
    } finally {
      setLoading(false);
    }
  };
  
  const handleTransfer = async () => {
    const amount = parseFloat(transferData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    if (transferData.from_account === transferData.to_account) {
      toast.error('Cannot transfer to same account');
      return;
    }
    
    try {
      await axios.post(`${API}/wallet/transfer`, {
        from_account: transferData.from_account,
        to_account: transferData.to_account,
        amount: amount
      });
      
      toast.success('Transfer successful!');
      setTransferOpen(false);
      setTransferData({ from_account: '', to_account: '', amount: '' });
      fetchWalletData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Transfer failed');
    }
  };
  
  const uploadGoalImage = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    setUploadingImage(true);
    try {
      const res = await axios.post(`${API}/upload/goal-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setGoalForm(prev => ({ ...prev, image_url: res.data.url }));
      toast.success('Image uploaded!');
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };
  
  const handleCreateGoal = async () => {
    if (!goalForm.title || !goalForm.target_amount) {
      toast.error('Please enter a name and target amount');
      return;
    }
    
    const target = parseFloat(goalForm.target_amount);
    if (isNaN(target) || target <= 0) {
      toast.error('Please enter a valid target amount');
      return;
    }
    
    try {
      await axios.post(`${API}/child/savings-goals`, {
        title: goalForm.title,
        description: goalForm.description || null,
        image_url: goalForm.image_url || null,
        target_amount: target,
        deadline: goalForm.deadline || null
      });
      
      toast.success('Savings goal created! 🎯');
      setGoalOpen(false);
      setGoalForm({ title: '', description: '', image_url: '', target_amount: '', deadline: '' });
      fetchWalletData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create goal');
    }
  };
  
  const handleAllocateToGoal = async () => {
    if (!allocateData.goal_id || !allocateData.amount) {
      toast.error('Please select a goal and enter an amount');
      return;
    }
    
    const amount = parseFloat(allocateData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    try {
      await axios.post(`${API}/child/savings-goals/${allocateData.goal_id}/contribute`, {
        amount: amount
      });
      
      toast.success('Money added to your goal! 🎯');
      setAllocateOpen(false);
      setAllocateData({ goal_id: '', amount: '' });
      fetchWalletData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add to goal');
    }
  };
  
  const handleAllocateToGoalWithId = async (goalId, amountStr) => {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    try {
      await axios.post(`${API}/child/savings-goals/${goalId}/contribute`, {
        amount: amount
      });
      
      toast.success('Money added to your goal! 🎯');
      setAllocateOpen(false);
      setAllocateData({ goal_id: '', amount: '' });
      fetchWalletData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add to goal');
    }
  };
  
  const getTransactionIcon = (type) => {
    switch(type) {
      case 'deposit': return <ArrowDown className="w-4 h-4 text-[#06D6A0]" />;
      case 'withdrawal': return <ArrowUp className="w-4 h-4 text-[#EE6C4D]" />;
      case 'transfer': return <ArrowLeftRight className="w-4 h-4 text-[#3D5A80]" />;
      case 'purchase': return <span className="text-sm">🛒</span>;
      case 'reward': return <span className="text-sm">⭐</span>;
      case 'earning': return <span className="text-sm">💰</span>;
      default: return <ArrowLeftRight className="w-4 h-4" />;
    }
  };
  
  const totalBalance = wallet?.accounts?.reduce((sum, acc) => sum + (acc.balance || 0), 0) || 0;
  const savingsBalance = wallet?.accounts?.find(a => a.account_type === 'savings')?.balance || 0;
  const activeGoals = savingsGoals.filter(g => !g.completed);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#E0FBFC]" data-testid="wallet-page">
      {/* Header */}
      <header className="bg-white border-b-3 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="p-2 rounded-xl border-2 border-[#1D3557] hover:bg-[#E0FBFC]">
                <ChevronLeft className="w-5 h-5 text-[#1D3557]" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#FFD23F] rounded-xl border-3 border-[#1D3557] flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-[#1D3557]" />
                </div>
                <h1 className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>My Wallet</h1>
              </div>
            </div>
            
            <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
              <DialogTrigger asChild>
                <button className="btn-primary px-4 py-2 flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4" /> Move Money
                </button>
              </DialogTrigger>
              <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                    Move Money Between Jars
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="text-sm font-bold text-[#1D3557] mb-2 block">From:</label>
                    <Select value={transferData.from_account} onValueChange={(v) => setTransferData({...transferData, from_account: v})}>
                      <SelectTrigger className="border-3 border-[#1D3557] rounded-xl">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {wallet?.accounts?.map(acc => (
                          <SelectItem key={acc.account_type} value={acc.account_type}>
                            {accountInfo[acc.account_type]?.icon} {acc.account_type} (₹{acc.balance?.toFixed(0)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-bold text-[#1D3557] mb-2 block">To:</label>
                    <Select value={transferData.to_account} onValueChange={(v) => setTransferData({...transferData, to_account: v})}>
                      <SelectTrigger className="border-3 border-[#1D3557] rounded-xl">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {wallet?.accounts?.map(acc => (
                          <SelectItem key={acc.account_type} value={acc.account_type}>
                            {accountInfo[acc.account_type]?.icon} {acc.account_type} (₹{acc.balance?.toFixed(0)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-bold text-[#1D3557] mb-2 block">Amount (₹):</label>
                    <Input 
                      type="number" 
                      min="1"
                      value={transferData.amount}
                      onChange={(e) => setTransferData({...transferData, amount: e.target.value})}
                      className="border-3 border-[#1D3557] rounded-xl"
                      placeholder="Enter amount"
                    />
                  </div>
                  
                  <button onClick={handleTransfer} className="btn-primary w-full py-3">
                    Transfer
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Total Balance */}
        <div className="card-playful p-6 mb-6 bg-gradient-to-r from-[#FFD23F] to-[#FFEB99] animate-bounce-in">
          <div className="text-center">
            <p className="text-[#1D3557] font-medium mb-1">Total Balance</p>
            <p className="text-5xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              ₹{totalBalance.toFixed(0)}
            </p>
            <p className="text-sm text-[#1D3557]/70 mt-2">Across all your money jars</p>
          </div>
        </div>
        
        {/* My Savings Goals Section - NOW ABOVE ACCOUNTS */}
        <div className="card-playful p-6 mb-6 animate-bounce-in stagger-1">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-6 h-6 text-[#06D6A0]" />
              <h2 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>My Savings Goals</h2>
            </div>
            <div className="flex gap-2">
              {activeGoals.length > 0 && savingsBalance > 0 && (
                <button 
                  onClick={() => setAllocateOpen(true)}
                  className="px-3 py-2 text-sm bg-[#06D6A0] text-white rounded-xl border-2 border-[#1D3557] hover:bg-[#05B588] flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add to Goal
                </button>
              )}
              <button 
                onClick={() => setGoalOpen(true)}
                className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> New Goal
              </button>
            </div>
          </div>
          
          {savingsGoals.length === 0 ? (
            <div className="text-center py-8 bg-[#FFD23F]/10 rounded-2xl border-2 border-dashed border-[#FFD23F]">
              <Target className="w-12 h-12 mx-auto text-[#FFD23F] mb-3" />
              <p className="text-[#1D3557] font-bold mb-1">No savings goals yet!</p>
              <p className="text-sm text-[#3D5A80] mb-4">What do you want to save for?</p>
              <button 
                onClick={() => setGoalOpen(true)}
                className="btn-primary px-6 py-2"
              >
                Create My First Goal! 🎯
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {savingsGoals.map((goal) => {
                const progress = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
                const remaining = goal.target_amount - goal.current_amount;
                
                return (
                  <div 
                    key={goal.goal_id}
                    className={`p-4 rounded-2xl border-3 border-[#1D3557] ${goal.completed ? 'bg-[#06D6A0]/20' : 'bg-gradient-to-r from-[#FFD23F]/20 to-[#FFEB99]/20'}`}
                  >
                    <div className="flex gap-4">
                      {goal.image_url ? (
                        <img 
                          src={getAssetUrl(goal.image_url)} 
                          alt={goal.title}
                          className="w-20 h-20 rounded-xl border-3 border-[#1D3557] object-cover"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-xl border-3 border-[#1D3557] bg-[#FFD23F] flex items-center justify-center text-4xl">
                          🎯
                        </div>
                      )}
                      
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-[#1D3557] text-lg">{goal.title}</h3>
                            {goal.description && (
                              <p className="text-base text-[#3D5A80] mt-0.5">{goal.description}</p>
                            )}
                          </div>
                          {goal.completed && (
                            <span className="bg-[#06D6A0] text-white text-sm px-3 py-1 rounded-full font-bold flex items-center gap-1">
                              <Check className="w-4 h-4" /> Goal Reached!
                            </span>
                          )}
                        </div>
                        
                        <div className="mt-3">
                          <div className="flex justify-between text-base mb-1">
                            <span className="text-[#3D5A80] font-medium">₹{goal.current_amount?.toFixed(0)} saved</span>
                            <span className="font-bold text-[#1D3557]">₹{goal.target_amount?.toFixed(0)} goal</span>
                          </div>
                          <Progress value={progress} className="h-4" />
                          {!goal.completed && remaining > 0 && (
                            <p className="text-base text-[#EE6C4D] mt-2 font-medium">
                              ₹{remaining.toFixed(0)} more to reach your goal!
                            </p>
                          )}
                          {goal.deadline && (
                            <p className="text-sm text-[#3D5A80] mt-1 flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              Target date: {new Date(goal.deadline).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Account Cards */}
        <h2 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>Your Money Jars</h2>
        <div className="grid grid-cols-2 gap-4 mb-8">
          {wallet?.accounts?.map((acc, index) => {
            const info = accountInfo[acc.account_type];
            return (
              <div 
                key={acc.account_type} 
                className={`card-playful p-4 bg-gradient-to-br ${info?.color} text-white animate-bounce-in`}
                style={{ animationDelay: `${0.1 * (index + 2)}s` }}
              >
                <div className="text-3xl mb-2">{info?.icon}</div>
                <p className="capitalize text-lg font-bold">{acc.account_type}</p>
                <p className="text-2xl font-bold" style={{ fontFamily: 'Fredoka' }}>₹{acc.balance?.toFixed(0)}</p>
                <p className="text-base opacity-90 mt-1">{info?.description}</p>
                {info?.action && (
                  info.action.onClick === 'openGoal' ? (
                    <button 
                      onClick={() => setGoalOpen(true)}
                      className="mt-3 w-full py-2 bg-white/20 hover:bg-white/30 rounded-xl text-lg font-bold"
                    >
                      {info.action.label}
                    </button>
                  ) : (
                    <Link 
                      to={info.action.path}
                      className="mt-3 block w-full py-2 bg-white/20 hover:bg-white/30 rounded-xl text-lg font-bold text-center"
                    >
                      {info.action.label}
                    </Link>
                  )
                )}
              </div>
            );
          })}
        </div>
        
        {/* Transaction History */}
        <div className="card-playful p-6 animate-bounce-in stagger-3">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-[#3D5A80]" />
            <h2 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Recent Activity</h2>
          </div>
          
          {transactions.length === 0 ? (
            <p className="text-center text-[#3D5A80] py-4">No transactions yet. Complete quests to start earning!</p>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 10).map((trans, index) => {
                let displayAmount = Math.abs(trans.amount || 0);
                let isPositive = false;
                let isNeutral = false;
                
                if (trans.transaction_type === 'reward' || trans.transaction_type === 'earning' || trans.transaction_type === 'deposit') {
                  isPositive = true;
                } else if (trans.transaction_type === 'purchase' || trans.transaction_type === 'withdrawal') {
                  isPositive = false;
                } else if (trans.transaction_type === 'transfer') {
                  isNeutral = true;
                } else {
                  isPositive = trans.amount > 0 || trans.to_account !== null;
                }
                
                return (
                  <div 
                    key={trans.transaction_id || index}
                    className="flex items-center justify-between bg-[#E0FBFC] rounded-xl p-3 border-2 border-[#1D3557]/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl border-2 border-[#1D3557] flex items-center justify-center">
                        {getTransactionIcon(trans.transaction_type)}
                      </div>
                      <div>
                        <p className="font-bold text-[#1D3557]">{trans.description}</p>
                        <p className="text-xs text-[#3D5A80]">
                          {new Date(trans.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className={`font-bold ${
                      isNeutral ? 'text-[#3D5A80]' : 
                      isPositive ? 'text-[#06D6A0]' : 'text-[#EE6C4D]'
                    }`}>
                      {isNeutral ? '↔' : isPositive ? '+' : '-'}₹{displayAmount.toFixed(0)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      
      {/* Create Goal Dialog */}
      <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
        <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              Create Savings Goal 🎯
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {/* Goal Image */}
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-2 block">Picture of what you&apos;re saving for</label>
              <div className="flex items-center gap-4">
                {goalForm.image_url && (
                  <img 
                    src={getAssetUrl(goalForm.image_url)} 
                    alt="Goal" 
                    className="w-20 h-20 rounded-xl border-3 border-[#1D3557] object-cover"
                  />
                )}
                <input 
                  type="file" 
                  id="goal-image" 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => e.target.files[0] && uploadGoalImage(e.target.files[0])}
                />
                <button
                  onClick={() => document.getElementById('goal-image')?.click()}
                  disabled={uploadingImage}
                  className="flex items-center gap-2 px-4 py-2 bg-[#E0FBFC] text-[#1D3557] rounded-xl border-2 border-[#1D3557] hover:bg-[#98C1D9]"
                >
                  <Upload className="w-4 h-4" />
                  {uploadingImage ? 'Uploading...' : 'Upload Image'}
                </button>
              </div>
            </div>
            
            {/* Goal Name */}
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-2 block">What are you saving for? *</label>
              <Input 
                value={goalForm.title}
                onChange={(e) => setGoalForm({...goalForm, title: e.target.value})}
                placeholder="e.g., New bicycle, Video game, Trip to zoo"
                className="border-3 border-[#1D3557] rounded-xl"
              />
            </div>
            
            {/* Description */}
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-2 block">Why do you want it?</label>
              <Textarea 
                value={goalForm.description}
                onChange={(e) => setGoalForm({...goalForm, description: e.target.value})}
                placeholder="Tell us why this is important to you!"
                rows={2}
                className="border-3 border-[#1D3557] rounded-xl"
              />
            </div>
            
            {/* Target Amount */}
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-2 block">How much does it cost? (₹) *</label>
              <Input 
                type="number"
                min="1"
                value={goalForm.target_amount}
                onChange={(e) => setGoalForm({...goalForm, target_amount: e.target.value})}
                placeholder="e.g., 500"
                className="border-3 border-[#1D3557] rounded-xl"
              />
            </div>
            
            {/* Deadline */}
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-2 block">
                <Calendar className="w-4 h-4 inline mr-1" /> When do you want it by?
              </label>
              <Input 
                type="date"
                value={goalForm.deadline}
                onChange={(e) => setGoalForm({...goalForm, deadline: e.target.value})}
                min={new Date().toISOString().split('T')[0]}
                className="border-3 border-[#1D3557] rounded-xl"
              />
            </div>
            
            <button
              onClick={handleCreateGoal}
              className="btn-primary w-full py-3 text-lg"
            >
              Create My Goal! 🎯
            </button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Allocate to Goal Dialog */}
      <Dialog open={allocateOpen} onOpenChange={setAllocateOpen}>
        <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              Add Money to Goal 💰
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="bg-[#E0FBFC] rounded-xl p-4 text-center border-2 border-[#1D3557]">
              <p className="text-sm text-[#3D5A80]">Your Savings Balance</p>
              <p className="text-3xl font-bold text-[#1D3557]">₹{savingsBalance.toFixed(0)}</p>
            </div>
            
            {activeGoals.length === 1 ? (
              <div className="p-4 bg-[#FFD23F]/20 rounded-xl border-2 border-[#1D3557]">
                <p className="font-bold text-[#1D3557]">{activeGoals[0].title}</p>
                <p className="text-sm text-[#3D5A80]">
                  ₹{activeGoals[0].current_amount?.toFixed(0)} / ₹{activeGoals[0].target_amount?.toFixed(0)}
                </p>
              </div>
            ) : (
              <div>
                <label className="text-sm font-bold text-[#1D3557] mb-2 block">Which goal?</label>
                <Select value={allocateData.goal_id} onValueChange={(v) => setAllocateData({...allocateData, goal_id: v})}>
                  <SelectTrigger className="border-3 border-[#1D3557] rounded-xl">
                    <SelectValue placeholder="Select a goal" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeGoals.map(goal => (
                      <SelectItem key={goal.goal_id} value={goal.goal_id}>
                        {goal.title} (₹{goal.current_amount?.toFixed(0)} / ₹{goal.target_amount?.toFixed(0)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-2 block">How much to add? (₹)</label>
              <Input 
                type="number"
                min="1"
                max={savingsBalance}
                value={allocateData.amount}
                onChange={(e) => setAllocateData({...allocateData, amount: e.target.value})}
                placeholder={`Max: ₹${savingsBalance.toFixed(0)}`}
                className="border-3 border-[#1D3557] rounded-xl"
              />
            </div>
            
            <button
              onClick={() => {
                // For single goal, auto-select it before submitting
                const goalId = activeGoals.length === 1 ? activeGoals[0].goal_id : allocateData.goal_id;
                if (!goalId) {
                  toast.error('Please select a goal');
                  return;
                }
                // Set the goal_id and submit
                const finalData = { ...allocateData, goal_id: goalId };
                setAllocateData(finalData);
                // Call with the correct goal_id
                handleAllocateToGoalWithId(goalId, allocateData.amount);
              }}
              disabled={!allocateData.amount || parseFloat(allocateData.amount) > savingsBalance}
              className="btn-primary w-full py-3 text-lg disabled:opacity-50"
            >
              Add to My Goal! 🎯
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
