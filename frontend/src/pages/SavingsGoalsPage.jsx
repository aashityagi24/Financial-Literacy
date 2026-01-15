import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { Target, ChevronLeft, Plus, Check, Calendar, Wallet, ArrowLeftRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SavingsGoalsPage({ user }) {
  const [wallet, setWallet] = useState(null);
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Goal creation
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalForm, setGoalForm] = useState({
    title: '',
    description: '',
    target_amount: '',
    deadline: '',
    image: null
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Allocate to goal
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [allocateData, setAllocateData] = useState({ goal_id: '', amount: '' });
  
  // Transfer
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferData, setTransferData] = useState({ from_account: 'spending', amount: '' });

  const savingsBalance = wallet?.accounts?.find(a => a.account_type === 'savings')?.balance || 0;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [walletRes, goalsRes] = await Promise.all([
        axios.get(`${API}/wallet`),
        axios.get(`${API}/child/savings-goals`)
      ]);
      setWallet(walletRes.data);
      setSavingsGoals(goalsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setGoalForm({ ...goalForm, image: file });
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleCreateGoal = async () => {
    if (!goalForm.title || !goalForm.target_amount) {
      toast.error('Please enter a goal name and target amount');
      return;
    }

    setSubmitting(true);
    try {
      let imageUrl = null;
      
      // Upload image if provided
      if (goalForm.image) {
        const formData = new FormData();
        formData.append('file', goalForm.image);
        const uploadRes = await axios.post(`${API}/upload/goal-image`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        imageUrl = uploadRes.data.url;
      }

      await axios.post(`${API}/child/savings-goals`, {
        title: goalForm.title,
        description: goalForm.description,
        target_amount: parseFloat(goalForm.target_amount),
        deadline: goalForm.deadline || null,
        image_url: imageUrl
      });

      toast.success('Savings goal created! 🎯');
      setGoalOpen(false);
      setGoalForm({ title: '', description: '', target_amount: '', deadline: '', image: null });
      setImagePreview(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create goal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAllocateToGoal = async (goalId, amount) => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    if (parseFloat(amount) > savingsBalance) {
      toast.error('Not enough balance in savings');
      return;
    }

    try {
      await axios.post(`${API}/child/savings-goals/${goalId}/contribute`, {
        amount: parseFloat(amount)
      });
      
      toast.success('Money added to your goal! 🎯');
      setAllocateOpen(false);
      setAllocateData({ goal_id: '', amount: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add to goal');
    }
  };

  const handleQuickTransfer = async () => {
    const amount = parseFloat(transferData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    const fromBalance = wallet?.accounts?.find(a => a.account_type === transferData.from_account)?.balance || 0;
    if (amount > fromBalance) {
      toast.error(`Not enough in ${transferData.from_account} jar`);
      return;
    }
    
    try {
      await axios.post(`${API}/wallet/transfer`, {
        from_account: transferData.from_account,
        to_account: 'savings',
        amount: amount,
        transaction_type: 'transfer',
        description: `Quick transfer to savings`
      });
      
      toast.success('Transfer successful!');
      setShowTransfer(false);
      setTransferData({ from_account: 'spending', amount: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Transfer failed');
    }
  };

  const activeGoals = savingsGoals.filter(g => !g.completed);
  const completedGoals = savingsGoals.filter(g => g.completed);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#E0FBFC] to-[#98C1D9] flex items-center justify-center">
        <div className="text-center">
          <Target className="w-16 h-16 mx-auto text-[#06D6A0] animate-pulse mb-4" />
          <p className="text-[#1D3557] font-bold">Loading savings goals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E0FBFC] to-[#98C1D9]">
      {/* Header */}
      <header className="bg-[#06D6A0] border-b-3 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/wallet" className="p-2 rounded-xl border-2 border-white hover:bg-white/20">
                <ChevronLeft className="w-5 h-5 text-white" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl border-3 border-[#1D3557] flex items-center justify-center text-2xl">
                  🐷
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Fredoka' }}>My Savings Goals</h1>
                  <p className="text-sm text-white/80">Save up for something special!</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-white/20 px-4 py-2 rounded-xl border-2 border-white">
                <p className="text-sm text-white/80">Savings Balance</p>
                <p className="text-xl font-bold text-white">₹{savingsBalance.toFixed(0)}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setGoalOpen(true)}
            className="flex-1 btn-primary py-3 flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" /> New Goal
          </button>
          {activeGoals.length > 0 && savingsBalance > 0 && (
            <button
              onClick={() => setAllocateOpen(true)}
              className="flex-1 py-3 font-bold rounded-xl border-3 border-[#1D3557] bg-white text-[#1D3557] hover:bg-[#E0FBFC] flex items-center justify-center gap-2"
            >
              <Target className="w-5 h-5" /> Add to Goal
            </button>
          )}
          <button
            onClick={() => setShowTransfer(true)}
            className="py-3 px-4 font-bold rounded-xl border-3 border-[#1D3557] bg-[#FFD23F] text-[#1D3557] hover:bg-[#FFE066] flex items-center justify-center gap-2"
          >
            <ArrowLeftRight className="w-5 h-5" />
          </button>
        </div>

        {/* Active Goals */}
        {activeGoals.length === 0 && completedGoals.length === 0 ? (
          <div className="card-playful p-8 text-center">
            <Target className="w-16 h-16 mx-auto text-[#98C1D9] mb-4" />
            <h2 className="text-xl font-bold text-[#1D3557] mb-2">No Savings Goals Yet</h2>
            <p className="text-[#3D5A80] mb-4">Start saving for something you really want!</p>
            <button
              onClick={() => setGoalOpen(true)}
              className="btn-primary px-6 py-3"
            >
              Create Your First Goal 🎯
            </button>
          </div>
        ) : (
          <>
            {activeGoals.length > 0 && (
              <div className="mb-6">
                <h2 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
                  Active Goals ({activeGoals.length})
                </h2>
                <div className="space-y-4">
                  {activeGoals.map((goal) => {
                    const progress = Math.min(((goal.current_amount || 0) / goal.target_amount) * 100, 100);
                    const remaining = goal.target_amount - (goal.current_amount || 0);
                    
                    return (
                      <div key={goal.goal_id} className="card-playful p-5">
                        <div className="flex gap-4">
                          {goal.image_url ? (
                            <img 
                              src={getAssetUrl(goal.image_url)} 
                              alt={goal.title}
                              className="w-20 h-20 rounded-xl border-3 border-[#1D3557] object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-20 h-20 rounded-xl border-3 border-[#1D3557] bg-[#FFD23F] flex items-center justify-center text-4xl flex-shrink-0">
                              🎯
                            </div>
                          )}
                          
                          <div className="flex-1">
                            <h3 className="font-bold text-[#1D3557] text-lg">{goal.title}</h3>
                            {goal.description && (
                              <p className="text-sm text-[#3D5A80] mt-1">{goal.description}</p>
                            )}
                            
                            <div className="mt-3">
                              <Progress value={progress} className="h-3 mb-2" />
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-[#06D6A0] font-bold">₹{(goal.current_amount || 0).toFixed(0)} saved</span>
                                <span className="text-[#EE6C4D] font-medium">₹{remaining.toFixed(0)} to go</span>
                                <span className="text-[#1D3557] font-bold flex items-center gap-1">
                                  <Target className="w-4 h-4" />₹{goal.target_amount?.toFixed(0)}
                                </span>
                              </div>
                              {goal.deadline && (
                                <p className="text-sm text-[#3D5A80] mt-2 flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  Target: {new Date(goal.deadline).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            
                            {savingsBalance > 0 && (
                              <button
                                onClick={() => {
                                  setAllocateData({ goal_id: goal.goal_id, amount: '' });
                                  setAllocateOpen(true);
                                }}
                                className="mt-3 px-4 py-2 bg-[#06D6A0] text-white text-sm font-bold rounded-xl hover:bg-[#05b88a]"
                              >
                                Add Money 💰
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Completed Goals */}
            {completedGoals.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
                  🎉 Completed Goals ({completedGoals.length})
                </h2>
                <div className="space-y-4">
                  {completedGoals.map((goal) => (
                    <div key={goal.goal_id} className="card-playful p-5 bg-[#06D6A0]/10 border-[#06D6A0]">
                      <div className="flex gap-4 items-center">
                        {goal.image_url ? (
                          <img 
                            src={getAssetUrl(goal.image_url)} 
                            alt={goal.title}
                            className="w-16 h-16 rounded-xl border-3 border-[#06D6A0] object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl border-3 border-[#06D6A0] bg-[#06D6A0] flex items-center justify-center text-3xl">
                            ✅
                          </div>
                        )}
                        
                        <div className="flex-1">
                          <h3 className="font-bold text-[#1D3557] text-lg flex items-center gap-2">
                            {goal.title}
                            <span className="bg-[#06D6A0] text-white text-xs px-2 py-1 rounded-full">Complete!</span>
                          </h3>
                          <p className="text-sm text-[#3D5A80]">
                            Saved ₹{goal.target_amount?.toFixed(0)} 🎉
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Create Goal Dialog */}
      <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
        <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              <Target className="w-5 h-5 inline mr-2 text-[#06D6A0]" />
              Create Savings Goal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Image Upload */}
            <div className="text-center">
              <label className="cursor-pointer">
                {imagePreview ? (
                  <img src={imagePreview} alt="Goal" className="w-24 h-24 mx-auto rounded-xl border-3 border-[#1D3557] object-cover" />
                ) : (
                  <div className="w-24 h-24 mx-auto rounded-xl border-3 border-dashed border-[#3D5A80] flex items-center justify-center bg-[#E0FBFC]">
                    <span className="text-3xl">📷</span>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                <p className="text-xs text-[#3D5A80] mt-1">Tap to add photo</p>
              </label>
            </div>
            
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-1 block">What are you saving for?</label>
              <Input
                placeholder="e.g., New Bicycle, Video Game"
                value={goalForm.title}
                onChange={(e) => setGoalForm({...goalForm, title: e.target.value})}
                className="border-3 border-[#1D3557] rounded-xl"
              />
            </div>
            
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-1 block">Description (optional)</label>
              <Textarea
                placeholder="Tell us more about your goal!"
                value={goalForm.description}
                onChange={(e) => setGoalForm({...goalForm, description: e.target.value})}
                className="border-3 border-[#1D3557] rounded-xl"
                rows={2}
              />
            </div>
            
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-1 block">How much do you need? (₹)</label>
              <Input
                type="number"
                placeholder="e.g., 500"
                value={goalForm.target_amount}
                onChange={(e) => setGoalForm({...goalForm, target_amount: e.target.value})}
                className="border-3 border-[#1D3557] rounded-xl"
              />
            </div>
            
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-1 block">Target Date (optional)</label>
              <Input
                type="date"
                value={goalForm.deadline}
                onChange={(e) => setGoalForm({...goalForm, deadline: e.target.value})}
                className="border-3 border-[#1D3557] rounded-xl"
              />
            </div>
            
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setGoalOpen(false)}
                className="flex-1 py-3 font-bold rounded-xl border-3 border-[#1D3557] bg-white text-[#1D3557] hover:bg-[#E0FBFC]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGoal}
                disabled={submitting || !goalForm.title || !goalForm.target_amount}
                className="flex-1 btn-primary py-3 disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Goal 🎯'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Allocate to Goal Dialog */}
      <Dialog open={allocateOpen} onOpenChange={setAllocateOpen}>
        <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              <Target className="w-5 h-5 inline mr-2 text-[#06D6A0]" />
              Add to Goal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-[#06D6A0]/10 rounded-xl p-3 border-2 border-[#06D6A0]">
              <p className="text-sm text-[#1D3557]">
                Your Savings: <strong className="text-[#06D6A0]">₹{savingsBalance.toFixed(0)}</strong>
              </p>
            </div>
            
            {activeGoals.length > 1 && !allocateData.goal_id && (
              <div>
                <label className="text-sm font-bold text-[#1D3557] mb-1 block">Choose a Goal:</label>
                <Select 
                  value={allocateData.goal_id} 
                  onValueChange={(v) => setAllocateData({...allocateData, goal_id: v})}
                >
                  <SelectTrigger className="border-3 border-[#1D3557] rounded-xl">
                    <SelectValue placeholder="Select goal" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeGoals.map((goal) => (
                      <SelectItem key={goal.goal_id} value={goal.goal_id}>
                        {goal.title} (₹{(goal.target_amount - (goal.current_amount || 0)).toFixed(0)} left)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-1 block">Amount (₹)</label>
              <Input
                type="number"
                placeholder="How much to add?"
                value={allocateData.amount}
                onChange={(e) => setAllocateData({...allocateData, amount: e.target.value})}
                className="border-3 border-[#1D3557] rounded-xl"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => { setAllocateOpen(false); setAllocateData({ goal_id: '', amount: '' }); }}
                className="flex-1 py-3 font-bold rounded-xl border-3 border-[#1D3557] bg-white text-[#1D3557] hover:bg-[#E0FBFC]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const goalId = activeGoals.length === 1 ? activeGoals[0].goal_id : allocateData.goal_id;
                  handleAllocateToGoal(goalId, allocateData.amount);
                }}
                disabled={!allocateData.amount || parseFloat(allocateData.amount) > savingsBalance || (activeGoals.length > 1 && !allocateData.goal_id)}
                className="flex-1 btn-primary py-3 disabled:opacity-50"
              >
                Add to Goal 🎯
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Transfer Dialog */}
      <Dialog open={showTransfer} onOpenChange={setShowTransfer}>
        <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              <ArrowLeftRight className="w-5 h-5 inline mr-2" />
              Move Money to Savings
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-[#E0FBFC] rounded-xl p-3">
              <p className="text-sm text-[#3D5A80]">
                Your Savings: <strong className="text-[#06D6A0]">₹{savingsBalance.toFixed(0)}</strong>
              </p>
            </div>
            
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-1 block">Transfer from:</label>
              <Select 
                value={transferData.from_account} 
                onValueChange={(v) => setTransferData({...transferData, from_account: v})}
              >
                <SelectTrigger className="border-3 border-[#1D3557] rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spending">
                    🛒 Spending (₹{wallet?.accounts?.find(a => a.account_type === 'spending')?.balance?.toFixed(0) || 0})
                  </SelectItem>
                  <SelectItem value="investing">
                    📈 Investing (₹{wallet?.accounts?.find(a => a.account_type === 'investing')?.balance?.toFixed(0) || 0})
                  </SelectItem>
                  <SelectItem value="gifting">
                    🎁 Gifting (₹{wallet?.accounts?.find(a => a.account_type === 'gifting')?.balance?.toFixed(0) || 0})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-1 block">Amount (₹)</label>
              <Input
                type="number"
                placeholder="How much to move?"
                value={transferData.amount}
                onChange={(e) => setTransferData({...transferData, amount: e.target.value})}
                className="border-3 border-[#1D3557] rounded-xl"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowTransfer(false)}
                className="flex-1 py-3 font-bold rounded-xl border-3 border-[#1D3557] bg-white text-[#1D3557] hover:bg-[#E0FBFC]"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickTransfer}
                disabled={!transferData.amount}
                className="flex-1 btn-primary py-3 disabled:opacity-50"
              >
                Transfer
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
