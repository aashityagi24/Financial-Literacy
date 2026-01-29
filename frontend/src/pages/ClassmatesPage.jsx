import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { Users, Gift, Target, ChevronLeft, HandHeart } from 'lucide-react';
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

export default function ClassmatesPage({ user }) {
  const [classmates, setClassmates] = useState([]);
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedClassmate, setSelectedClassmate] = useState(null);
  const [showGiftDialog, setShowGiftDialog] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [giftForm, setGiftForm] = useState({ amount: '', message: '' });
  const [requestForm, setRequestForm] = useState({ amount: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [wallet, setWallet] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [classmatesRes, walletRes] = await Promise.all([
        axios.get(`${API}/child/classmates`),
        axios.get(`${API}/wallet`)
      ]);
      setClassmates(classmatesRes.data.classmates || []);
      setClassroom(classmatesRes.data.classroom);
      setWallet(walletRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const giftingBalance = wallet?.accounts?.find(a => a.account_type === 'gifting')?.balance || 0;

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
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send gift');
    } finally {
      setSubmitting(false);
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
        to_user_id: selectedClassmate.user_id,
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
      <div className="min-h-screen bg-gradient-to-b from-[#E0FBFC] to-[#98C1D9] flex items-center justify-center">
        <div className="text-center">
          <Users className="w-16 h-16 mx-auto text-[#3D5A80] animate-pulse mb-4" />
          <p className="text-[#1D3557] font-bold">Loading classmates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E0FBFC] to-[#98C1D9]">
      {/* Header */}
      <header className="bg-[#3D5A80] border-b-3 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="p-2 rounded-xl border-2 border-white hover:bg-white/20">
              <ChevronLeft className="w-5 h-5 text-white" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl border-3 border-[#1D3557] flex items-center justify-center">
                <Users className="w-6 h-6 text-[#3D5A80]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Fredoka' }}>My Classroom</h1>
                {classroom && <p className="text-sm text-white/80">{classroom.name}</p>}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {!classroom ? (
          <div className="card-playful p-8 text-center">
            <Users className="w-16 h-16 mx-auto text-[#98C1D9] mb-4" />
            <h2 className="text-xl font-bold text-[#1D3557] mb-2">No Classroom Yet</h2>
            <p className="text-[#3D5A80] mb-4">Join a classroom to see your classmates!</p>
            <Link to="/profile" className="btn-primary px-6 py-3 inline-block">
              Go to Profile to Join →
            </Link>
          </div>
        ) : classmates.length === 0 ? (
          <div className="card-playful p-8 text-center">
            <Users className="w-16 h-16 mx-auto text-[#98C1D9] mb-4" />
            <h2 className="text-xl font-bold text-[#1D3557] mb-2">No Classmates Yet</h2>
            <p className="text-[#3D5A80]">Share your classroom invite code with friends!</p>
          </div>
        ) : (
          <>
            {/* Stats Bar */}
            <div className="card-playful p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#1D3557]">{classmates.length}</p>
                  <p className="text-sm text-[#3D5A80]">Classmates</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#06D6A0]">₹{giftingBalance.toFixed(0)}</p>
                  <p className="text-sm text-[#3D5A80]">Your Gifting Jar</p>
                </div>
              </div>
            </div>

            {/* Classmates List */}
            <div className="space-y-4">
              {classmates.map((classmate) => (
                <div 
                  key={classmate.user_id}
                  className="card-playful p-4"
                >
                  <div className="flex items-start gap-4">
                    <img 
                      src={classmate.picture || 'https://via.placeholder.com/56'} 
                      alt={classmate.name}
                      className="w-14 h-14 rounded-full border-3 border-[#1D3557]"
                    />
                    <div className="flex-1">
                      <h3 className="font-bold text-[#1D3557] text-lg">{classmate.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-[#3D5A80] mt-1">
                        <span className="flex items-center gap-1">💰 ₹{classmate.total_balance?.toFixed(0)}</span>
                        <span className="flex items-center gap-1">📚 {classmate.lessons_completed} lessons</span>
                        <span className="flex items-center gap-1">🔥 {classmate.streak_count} streak</span>
                      </div>
                      
                      {/* Savings Goals */}
                      {classmate.savings_goals?.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-sm text-[#3D5A80] font-medium flex items-center gap-1">
                            <Target className="w-4 h-4" /> Saving for:
                          </p>
                          {classmate.savings_goals.map((goal, idx) => (
                            <div key={idx} className="bg-[#F8F9FA] rounded-xl p-3 border border-[#E0E0E0]">
                              <div className="flex items-center gap-2 mb-2">
                                {goal.image_url ? (
                                  <img src={getAssetUrl(goal.image_url)} alt="" className="w-8 h-8 rounded-lg object-cover border border-[#1D3557]" />
                                ) : (
                                  <span className="text-lg">🎯</span>
                                )}
                                <span className="font-medium text-[#1D3557] text-sm">{goal.title}</span>
                              </div>
                              <Progress 
                                value={Math.min(((goal.current_amount || 0) / goal.target_amount) * 100, 100)} 
                                className="h-2 mb-2" 
                              />
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[#06D6A0] font-bold">₹{goal.current_amount?.toFixed(0) || 0} saved</span>
                                <span className="text-[#1D3557] font-bold flex items-center gap-1">
                                  <Target className="w-3 h-3" />₹{goal.target_amount?.toFixed(0)}
                                </span>
                              </div>
                              {goal.deadline && (
                                <p className="text-xs text-[#3D5A80] mt-1">
                                  By {new Date(goal.deadline).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => {
                            setSelectedClassmate(classmate);
                            setShowGiftDialog(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-[#06D6A0] text-white text-sm font-bold rounded-xl hover:bg-[#05b88a]"
                        >
                          <Gift className="w-4 h-4" /> Give Gift
                        </button>
                        <button
                          onClick={() => {
                            setSelectedClassmate(classmate);
                            setShowRequestDialog(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-[#FFD23F] text-[#1D3557] text-sm font-bold rounded-xl hover:bg-[#FFE066]"
                        >
                          <HandHeart className="w-4 h-4" /> Ask for Gift
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

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
                disabled={submitting || !giftForm.amount}
                className="flex-1 btn-primary py-3 disabled:opacity-50"
              >
                {submitting ? 'Sending...' : 'Send Gift 🎁'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
