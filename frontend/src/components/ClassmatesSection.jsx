import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { Users, Gift, Target, ChevronRight, Send, HandHeart, ArrowLeftRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { getDefaultAvatar } from '@/utils/avatars';
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

export default function ClassmatesSection({ giftingBalance, compact = false, wallet, onRefresh }) {
  const [classmates, setClassmates] = useState([]);
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedClassmate, setSelectedClassmate] = useState(null);
  const [showGiftDialog, setShowGiftDialog] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [giftForm, setGiftForm] = useState({ amount: '', message: '' });
  const [requestForm, setRequestForm] = useState({ amount: '', reason: '' });
  const [transferData, setTransferData] = useState({ from_account: 'spending', amount: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchClassmates();
  }, []);

  const fetchClassmates = async () => {
    try {
      const res = await axios.get(`${API}/child/classmates`);
      setClassmates(res.data.classmates || []);
      setClassroom(res.data.classroom);
    } catch (error) {
      console.error('Failed to fetch classmates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGiftMoney = async () => {
    if (!giftForm.amount || parseFloat(giftForm.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (parseFloat(giftForm.amount) > giftingBalance) {
      toast.error('Not enough balance in your Gifting jar');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/child/gift-money`, {
        to_user_id: selectedClassmate.user_id,
        amount: parseFloat(giftForm.amount),
        message: giftForm.message
      });
      toast.success(`Gift sent to ${selectedClassmate.name}! 🎁`);
      setShowGiftDialog(false);
      setGiftForm({ amount: '', message: '' });
      setSelectedClassmate(null);
      if (onRefresh) onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send gift');
    } finally {
      setSubmitting(false);
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
        to_account: 'gifting',
        amount: amount,
        transaction_type: 'transfer',
        description: `Quick transfer for gifting`
      });
      
      toast.success('Transfer successful!');
      setShowTransfer(false);
      setTransferData({ from_account: 'spending', amount: '' });
      if (onRefresh) onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Transfer failed');
    }
  };

  const handleRequestGift = async () => {
    if (!requestForm.amount || parseFloat(requestForm.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/child/request-gift`, {
        recipient_id: selectedClassmate.user_id,
        amount: parseFloat(requestForm.amount),
        reason: requestForm.reason
      });
      toast.success(`Request sent to ${selectedClassmate.name}! 💝`);
      setShowRequestDialog(false);
      setRequestForm({ amount: '', reason: '' });
      setSelectedClassmate(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={compact ? "flex flex-col h-full" : "card-playful p-6 animate-pulse"}>
        {compact && (
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              <Users className="w-5 h-5 inline mr-2" />
              My Classroom
            </h2>
          </div>
        )}
        <div className="space-y-2 flex-1">
          <div className="h-16 bg-[#E0FBFC] rounded"></div>
          <div className="h-16 bg-[#E0FBFC] rounded"></div>
        </div>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className={compact ? "flex flex-col h-full" : "card-playful p-6 text-center"}>
        {compact && (
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              <Users className="w-5 h-5 inline mr-2" />
              My Classroom
            </h2>
          </div>
        )}
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <Users className={`${compact ? 'w-10 h-10' : 'w-12 h-12'} mx-auto text-[#98C1D9] mb-2`} />
          <h3 className={`${compact ? 'text-sm' : 'text-lg'} font-bold text-[#1D3557] mb-1`} style={{ fontFamily: 'Fredoka' }}>No Classroom Yet</h3>
          <p className="text-xs text-[#3D5A80]">Join a classroom to see your classmates!</p>
          <p className="text-xs text-[#3D5A80] mt-1">Profile → Join Class</p>
        </div>
      </div>
    );
  }

  // Compact view for dashboard card
  if (compact) {
    return (
      <>
        <div className="flex flex-col h-full" data-testid="classmates-section">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              <Users className="w-5 h-5 inline mr-2" />
              My Classroom
            </h2>
            <Link to="/classmates" className="text-sm text-[#3D5A80] hover:text-[#1D3557]">
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {classmates.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center py-2">
              <p className="text-sm text-[#3D5A80]">No classmates yet</p>
            </div>
          ) : (
            <div className="space-y-2 flex-1 overflow-y-auto">
              {classmates.slice(0, 5).map((classmate) => (
                <div 
                  key={classmate.user_id}
                  className="bg-[#E0FBFC] rounded-lg p-2 border border-[#1D3557]/20"
                >
                  <div className="flex items-center gap-2">
                    <img 
                      src={classmate.picture || 'https://via.placeholder.com/32'} 
                      alt={classmate.name}
                      className="w-8 h-8 rounded-full border border-[#1D3557]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#1D3557] text-sm truncate">{classmate.name}</p>
                      <div className="flex gap-2 text-xs text-[#3D5A80]">
                        <span>₹{classmate.total_balance?.toFixed(0)}</span>
                        <span>📚{classmate.lessons_completed}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setSelectedClassmate(classmate);
                          setShowGiftDialog(true);
                        }}
                        className="p-1.5 bg-[#06D6A0] text-white rounded-lg hover:bg-[#05b88a]"
                        title="Give Gift"
                      >
                        <Gift className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {classmates.length > 5 && (
                <Link to="/classmates" className="text-xs text-center text-[#3D5A80] hover:text-[#1D3557] block">
                  +{classmates.length - 5} more classmates →
                </Link>
              )}
            </div>
          )}
        </div>
        
        {/* Keep dialogs */}
        {renderDialogs()}
      </>
    );
  }

  // Helper function to render dialogs
  function renderDialogs() {
    return (
      <>
        {/* Gift Money Dialog */}
        <Dialog open={showGiftDialog} onOpenChange={setShowGiftDialog}>
          <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                <Gift className="w-5 h-5 inline mr-2 text-[#06D6A0]" />
                Give a Gift to {selectedClassmate?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="bg-[#FFD23F]/20 rounded-xl p-3 border-2 border-[#FFD23F]">
                <p className="text-sm text-[#1D3557]">
                  Your Gifting Jar: <strong>₹{giftingBalance?.toFixed(0) || 0}</strong>
                </p>
                {giftingBalance < 10 && wallet && (
                  <button
                    onClick={() => setShowTransfer(true)}
                    className="mt-2 w-full py-2 bg-[#FFD23F] text-[#1D3557] text-sm font-bold rounded-lg hover:bg-[#FFE066] flex items-center justify-center gap-2"
                  >
                    <ArrowLeftRight className="w-4 h-4" /> Move money to Gifting Jar
                  </button>
                )}
              </div>
              
              <div>
                <label className="text-sm font-bold text-[#1D3557] mb-1 block">Amount (₹)</label>
                <Input
                  type="number"
                  placeholder="How much?"
                  value={giftForm.amount}
                  onChange={(e) => setGiftForm({...giftForm, amount: e.target.value})}
                  className="border-3 border-[#1D3557] rounded-xl"
                />
              </div>
              
              <div>
                <label className="text-sm font-bold text-[#1D3557] mb-1 block">Message (optional)</label>
                <Textarea
                  placeholder="Write a nice message!"
                  value={giftForm.message}
                  onChange={(e) => setGiftForm({...giftForm, message: e.target.value})}
                  className="border-3 border-[#1D3557] rounded-xl"
                  rows={2}
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowGiftDialog(false)}
                  className="flex-1 py-3 font-bold rounded-xl border-3 border-[#1D3557] bg-white text-[#1D3557] hover:bg-[#E0FBFC]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGiftMoney}
                  disabled={submitting || !giftForm.amount || parseFloat(giftForm.amount) > giftingBalance}
                  className="flex-1 btn-primary py-3 disabled:opacity-50"
                >
                  {submitting ? 'Sending...' : 'Send Gift 🎁'}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Quick Transfer Dialog */}
        {wallet && (
          <Dialog open={showTransfer} onOpenChange={setShowTransfer}>
            <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                  <ArrowLeftRight className="w-5 h-5 inline mr-2" />
                  Move Money to Gifting Jar
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="bg-[#E0FBFC] rounded-xl p-3">
                  <p className="text-sm text-[#3D5A80]">
                    Your Gifting Jar: <strong className="text-[#06D6A0]">₹{giftingBalance?.toFixed(0) || 0}</strong>
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
                      <SelectItem value="savings">
                        💰 Savings (₹{wallet?.accounts?.find(a => a.account_type === 'savings')?.balance?.toFixed(0) || 0})
                      </SelectItem>
                      <SelectItem value="investing">
                        📈 Investing (₹{wallet?.accounts?.find(a => a.account_type === 'investing')?.balance?.toFixed(0) || 0})
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
        )}

        {/* Request Gift Dialog */}
        <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
          <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                <HandHeart className="w-5 h-5 inline mr-2 text-[#FFD23F]" />
                Ask {selectedClassmate?.name} for a Gift
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-[#3D5A80]">
                They'll get a notification and can choose to help you out! 💝
              </p>
              
              <div>
                <label className="text-sm font-bold text-[#1D3557] mb-1 block">Amount (₹)</label>
                <Input
                  type="number"
                  placeholder="How much do you need?"
                  value={requestForm.amount}
                  onChange={(e) => setRequestForm({...requestForm, amount: e.target.value})}
                  className="border-3 border-[#1D3557] rounded-xl"
                />
              </div>
              
              <div>
                <label className="text-sm font-bold text-[#1D3557] mb-1 block">Reason (optional)</label>
                <Textarea
                  placeholder="Tell them why you need it!"
                  value={requestForm.reason}
                  onChange={(e) => setRequestForm({...requestForm, reason: e.target.value})}
                  className="border-3 border-[#1D3557] rounded-xl"
                  rows={2}
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRequestDialog(false)}
                  className="flex-1 py-3 font-bold rounded-xl border-3 border-[#1D3557] bg-white text-[#1D3557] hover:bg-[#E0FBFC]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestGift}
                  disabled={submitting || !requestForm.amount}
                  className="flex-1 btn-primary py-3 disabled:opacity-50"
                >
                  {submitting ? 'Sending...' : 'Send Request 💝'}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Full view (non-compact)
  return (
    <>
      <div className="card-playful p-6" data-testid="classmates-section">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
            <Users className="w-5 h-5 inline mr-2" />
            My Classroom
          </h2>
          <span className="text-sm text-[#3D5A80] bg-[#E0FBFC] px-3 py-1 rounded-full">
            {classroom.name}
          </span>
        </div>

        {classmates.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-[#3D5A80]">No other classmates yet. Share the invite code!</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {classmates.map((classmate) => (
              <div 
                key={classmate.user_id}
                className="bg-[#E0FBFC] rounded-xl p-4 border-2 border-[#1D3557]/20 hover:border-[#1D3557] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <img 
                    src={classmate.picture || 'https://via.placeholder.com/48'} 
                    alt={classmate.name}
                    className="w-12 h-12 rounded-full border-2 border-[#1D3557]"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-[#1D3557]">{classmate.name}</h4>
                    <div className="flex items-center gap-3 text-sm text-[#3D5A80] mt-1">
                      <span>💰 ₹{classmate.total_balance?.toFixed(0)}</span>
                      <span>📚 {classmate.lessons_completed} lessons</span>
                      <span>🔥 {classmate.streak_count}</span>
                    </div>
                    
                    {/* Savings Goals */}
                    {classmate.savings_goals?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-[#3D5A80] font-medium flex items-center gap-1">
                          <Target className="w-3 h-3" /> Saving for:
                        </p>
                        {classmate.savings_goals.slice(0, 2).map((goal, idx) => (
                          <div key={idx} className="bg-white/50 rounded-lg p-2 mt-1">
                            <div className="flex items-center gap-2">
                              {goal.image_url ? (
                                <img src={getAssetUrl(goal.image_url)} alt="" className="w-6 h-6 rounded object-cover" />
                              ) : (
                                <span className="text-sm">🎯</span>
                              )}
                              <span className="text-xs font-medium text-[#1D3557] truncate">{goal.title}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-[#3D5A80] mt-1">
                              <span>₹{goal.current_amount?.toFixed(0) || 0} / ₹{goal.target_amount?.toFixed(0)}</span>
                              {goal.deadline && (
                                <span>By {new Date(goal.deadline).toLocaleDateString()}</span>
                              )}
                            </div>
                            <Progress 
                              value={Math.min(((goal.current_amount || 0) / goal.target_amount) * 100, 100)} 
                              className="h-1 mt-1" 
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => {
                          setSelectedClassmate(classmate);
                          setShowGiftDialog(true);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#06D6A0] text-white text-xs font-bold rounded-lg hover:bg-[#05b88a]"
                      >
                        <Gift className="w-3 h-3" /> Give Gift
                      </button>
                      <button
                        onClick={() => {
                          setSelectedClassmate(classmate);
                          setShowRequestDialog(true);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#FFD23F] text-[#1D3557] text-xs font-bold rounded-lg hover:bg-[#FFE066]"
                      >
                        <HandHeart className="w-3 h-3" /> Ask for Gift
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {renderDialogs()}
    </>
  );
}
