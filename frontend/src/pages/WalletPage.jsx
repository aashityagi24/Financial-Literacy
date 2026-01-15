import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { 
  Wallet, ArrowLeftRight, ArrowDown, ArrowUp, 
  Home, ChevronLeft, History, Target, Plus, Upload, Calendar
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
  const [uploadingImage, setUploadingImage] = useState(false);  
  const accountInfo = {
    spending: { 
      icon: '💳', 
      color: 'from-[#EE6C4D] to-[#FF8A6C]',
      description: 'Use this for your everyday purchases!',
      action: { label: 'Go to Store', path: '/store' }
    },
    savings: { 
      icon: '🐷', 
      color: 'from-[#06D6A0] to-[#42E8B3]',
      description: 'Save up for something special!',
      action: { label: 'Set Goal', path: '/quests' }
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
    if (!transferData.from_account || !transferData.to_account || !transferData.amount) {
      toast.error('Please fill in all fields');
      return;
    }
    
    if (transferData.from_account === transferData.to_account) {
      toast.error('Cannot transfer to the same account');
      return;
    }
    
    const amount = parseFloat(transferData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    try {
      await axios.post(`${API}/wallet/transfer`, {
        from_account: transferData.from_account,
        to_account: transferData.to_account,
        amount: amount,
        transaction_type: 'transfer',
        description: `Transfer from ${transferData.from_account} to ${transferData.to_account}`
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
  
  const contributeToGoal = async (goalId, amount) => {
    try {
      await axios.post(`${API}/child/savings-goals/${goalId}/contribute`, { amount });
      toast.success('Contribution added!');
      fetchWalletData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Contribution failed');
    }
  };
  
  const getTransactionIcon = (type) => {
    switch (type) {
      case 'deposit': return <ArrowDown className="w-4 h-4 text-[#06D6A0]" />;
      case 'withdrawal': return <ArrowUp className="w-4 h-4 text-[#EE6C4D]" />;
      case 'transfer': return <ArrowLeftRight className="w-4 h-4 text-[#3D5A80]" />;
      case 'purchase': return <span className="text-lg">🛒</span>;
      case 'reward': return <span className="text-lg">🎁</span>;
      case 'investment': return <span className="text-lg">📈</span>;
      default: return <ArrowLeftRight className="w-4 h-4" />;
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
    <div className="min-h-screen bg-[#E0FBFC]" data-testid="wallet-page">
      {/* Header */}
      <header className="bg-white border-b-3 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
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
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Welcome Banner - Explains what wallet is for */}
        <div className="p-5 mb-6 bg-gradient-to-r from-[#FFD23F] to-[#FFEB99] rounded-3xl border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557] animate-bounce-in">
          <h2 className="text-xl font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>
            💰 Welcome to Your Wallet!
          </h2>
          <p className="text-[#1D3557]/90 text-base leading-relaxed">
            This is like your very own <strong>digital piggy bank</strong>! Here you can see all the ₹ you&apos;ve earned from completing lessons and quests. 
            You have <strong>4 special jars</strong> to keep your money organized. You can also <strong>move money between jars</strong> using the Transfer button - 
            like putting coins from your spending jar into your savings jar!
          </p>
        </div>

        {/* Total Balance - Compact Design */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 p-4 bg-gradient-to-r from-[#3D5A80] to-[#5A7BA0] rounded-2xl border-3 border-[#1D3557]">
          <div className="text-white text-center sm:text-left">
            <p className="text-sm opacity-80">Total Balance</p>
            <p className="text-4xl font-bold" style={{ fontFamily: 'Fredoka' }}>
              ₹{wallet?.total_balance?.toFixed(0) || '0'}
            </p>
          </div>
          
          <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
            <DialogTrigger asChild>
              <button className="bg-[#FFD23F] text-[#1D3557] font-bold px-6 py-3 rounded-full border-3 border-white flex items-center gap-2 hover:scale-105 transition-transform shadow-lg">
                <ArrowLeftRight className="w-5 h-5" />
                Transfer Between Jars
              </button>
            </DialogTrigger>
            <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                  Move Money Between Jars
                </DialogTitle>
                <p className="text-base text-[#3D5A80] mt-1">Move your ₹ from one jar to another!</p>
              </DialogHeader>
              
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-bold text-[#1D3557] mb-2 block">From Account</label>
                  <Select 
                    value={transferData.from_account} 
                    onValueChange={(v) => setTransferData({...transferData, from_account: v})}
                  >
                    <SelectTrigger className="border-3 border-[#1D3557] rounded-xl">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {wallet?.accounts?.map((acc) => (
                        <SelectItem key={acc.account_type} value={acc.account_type}>
                          {accountInfo[acc.account_type]?.icon} {acc.account_type} (₹{acc.balance.toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-bold text-[#1D3557] mb-2 block">To Account</label>
                  <Select 
                    value={transferData.to_account} 
                    onValueChange={(v) => setTransferData({...transferData, to_account: v})}
                  >
                    <SelectTrigger className="border-3 border-[#1D3557] rounded-xl">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {wallet?.accounts?.filter(a => a.account_type !== transferData.from_account).map((acc) => (
                        <SelectItem key={acc.account_type} value={acc.account_type}>
                          {accountInfo[acc.account_type]?.icon} {acc.account_type} (₹{acc.balance.toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-bold text-[#1D3557] mb-2 block">Amount</label>
                  <Input 
                    type="number"
                    placeholder="Enter amount"
                    value={transferData.amount}
                    onChange={(e) => setTransferData({...transferData, amount: e.target.value})}
                    className="border-3 border-[#1D3557] rounded-xl"
                  />
                </div>
                
                <button
                  onClick={handleTransfer}
                  className="btn-primary w-full py-3 text-lg"
                >
                  Transfer
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Account Cards */}
        <h2 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>Your Accounts</h2>
        <div className="grid grid-cols-2 gap-4 mb-8">
          {wallet?.accounts?.map((account, index) => {
            const info = accountInfo[account.account_type];
            return (
              <div
                key={account.account_type}
                className={`p-5 rounded-2xl border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557] bg-gradient-to-br ${info?.color} text-white animate-bounce-in`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="text-3xl">{info?.icon}</div>
                  <p className="text-2xl font-bold" style={{ fontFamily: 'Fredoka' }}>₹{account.balance?.toFixed(0)}</p>
                </div>
                <p className="text-lg capitalize font-bold mb-1">{account.account_type}</p>
                <p className="text-sm opacity-90 mb-3">{info?.description}</p>
                <Link 
                  to={info?.action?.path || '/dashboard'}
                  className="block w-full py-2 bg-white/20 hover:bg-white/30 rounded-xl text-center text-base font-bold transition-colors border-2 border-white/30"
                >
                  {info?.action?.label} →
                </Link>
              </div>
            );
          })}
        </div>
        
        {/* Savings Goals Section */}
        <div className="card-playful p-6 mb-8 animate-bounce-in stagger-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-[#06D6A0]" />
              <h2 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>My Savings Goals</h2>
            </div>
            <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
              <DialogTrigger asChild>
                <button className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
                  <Plus className="w-4 h-4" /> New Goal
                </button>
              </DialogTrigger>
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
          </div>
          
          {savingsGoals.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-[#3D5A80] mb-2">No savings goals yet!</p>
              <p className="text-sm text-[#3D5A80]/70">Click &quot;New Goal&quot; to start saving for something special! 🌟</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {savingsGoals.map((goal) => {
                const progress = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
                const remaining = goal.target_amount - goal.current_amount;
                
                return (
                  <div 
                    key={goal.goal_id}
                    className={`p-4 rounded-2xl border-3 border-[#1D3557] ${goal.completed ? 'bg-[#06D6A0]/20' : 'bg-[#FFD23F]/20'}`}
                  >
                    <div className="flex gap-4">
                      {goal.image_url ? (
                        <img 
                          src={getAssetUrl(goal.image_url)} 
                          alt={goal.title}
                          className="w-16 h-16 rounded-xl border-2 border-[#1D3557] object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl border-2 border-[#1D3557] bg-[#E0FBFC] flex items-center justify-center text-3xl">
                          🎯
                        </div>
                      )}
                      
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-[#1D3557]">{goal.title}</h3>
                            {goal.description && (
                              <p className="text-xs text-[#3D5A80] mt-0.5">{goal.description}</p>
                            )}
                          </div>
                          {goal.completed && (
                            <span className="bg-[#06D6A0] text-white text-xs px-2 py-1 rounded-full font-bold">
                              ✓ Done!
                            </span>
                          )}
                        </div>
                        
                        <div className="mt-2">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-[#3D5A80]">₹{goal.current_amount?.toFixed(0)} saved</span>
                            <span className="font-bold text-[#1D3557]">₹{goal.target_amount?.toFixed(0)} goal</span>
                          </div>
                          <Progress value={progress} className="h-3" />
                          {!goal.completed && remaining > 0 && (
                            <p className="text-xs text-[#3D5A80] mt-1">₹{remaining.toFixed(0)} more to go!</p>
                          )}
                          {goal.deadline && (
                            <p className="text-xs text-[#EE6C4D] mt-1">
                              <Calendar className="w-3 h-3 inline mr-1" />
                              Target: {new Date(goal.deadline).toLocaleDateString()}
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
                // Determine the display amount and color
                let displayAmount = Math.abs(trans.amount || 0);
                let isPositive = false;
                let isNeutral = false;
                
                // Rewards and earnings are positive (money coming in)
                if (trans.transaction_type === 'reward' || trans.transaction_type === 'earning' || trans.transaction_type === 'deposit') {
                  isPositive = true;
                }
                // Purchases and withdrawals are negative (money going out)
                else if (trans.transaction_type === 'purchase' || trans.transaction_type === 'withdrawal') {
                  isPositive = false;
                }
                // Transfers are neutral (moving between accounts)
                else if (trans.transaction_type === 'transfer') {
                  isNeutral = true;
                }
                // Default: check if amount is already negative or if to_account exists
                else {
                  isPositive = trans.amount > 0 || trans.to_account !== null;
                }
                
                return (
                  <div 
                    key={trans.transaction_id}
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
    </div>
  );
}
