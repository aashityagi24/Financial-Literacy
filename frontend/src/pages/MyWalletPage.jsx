import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { ChevronLeft, IndianRupee, ArrowDownCircle, ArrowUpCircle, Plus, Minus, Sparkles } from 'lucide-react';
import BackButton from '@/components/BackButton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

// Kid-friendly category picker for manual entries
const SPEND_CATEGORIES = [
  { key: 'toys', label: 'Toys', emoji: '🧸' },
  { key: 'food', label: 'Food & Snacks', emoji: '🍎' },
  { key: 'books', label: 'Books', emoji: '📚' },
  { key: 'games', label: 'Games', emoji: '🎮' },
  { key: 'clothes', label: 'Clothes', emoji: '👕' },
  { key: 'charity', label: 'Charity', emoji: '❤️' },
  { key: 'gift', label: 'A Gift', emoji: '🎁' },
  { key: 'other', label: 'Something Else', emoji: '💸' },
];

const INCOME_CATEGORIES = [
  { key: 'cash', label: 'Cash from Family', emoji: '💵' },
  { key: 'gift', label: 'A Gift', emoji: '🎁' },
  { key: 'found', label: 'Found Money', emoji: '🪙' },
  { key: 'chore', label: 'Extra Chore', emoji: '🧹' },
  { key: 'other', label: 'Something Else', emoji: '✨' },
];

// Icon + colour for each ledger entry
const entryVisual = (entry) => {
  const catEmoji = { toys: '🧸', food: '🍎', books: '📚', games: '🎮', clothes: '👕', charity: '❤️', gift: '🎁', cash: '💵', found: '🪙', chore: '🧹' };
  const typeEmoji = {
    chore_reward: '🧹', job_payment: '💼', allowance: '📅', gift_received: '🎁',
    parent_gift: '🎁', parent_reward: '⭐', parent_penalty: '⚠️', parent_settlement: '💵',
    manual_income: '✨', manual_spend: '🛍️',
  };
  return catEmoji[entry.category] || typeEmoji[entry.transaction_type] || (entry.direction === 'out' ? '🛍️' : '💰');
};

const formatDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

export default function MyWalletPage({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogType, setDialogType] = useState(null); // 'spend' | 'income' | null
  const [form, setForm] = useState({ amount: '', category: '', note: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/wallet/my-wallet`);
      setData(res.data);
    } catch (e) {
      toast.error('Could not load your wallet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openDialog = (type) => {
    setForm({ amount: '', category: '', note: '' });
    setDialogType(type);
  };

  const submitEntry = async () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      toast.error('Please enter how much');
      return;
    }
    if (!form.category) {
      toast.error('Please pick a reason');
      return;
    }
    if (dialogType === 'spend' && amount > (data?.balance || 0)) {
      toast.error("That's more than you have!");
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/wallet/my-wallet/entry`, {
        entry_type: dialogType,
        amount,
        category: form.category,
        note: form.note,
      });
      toast.success(dialogType === 'spend' ? 'Spending saved! 🛍️' : 'Money added! ✨');
      setDialogType(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not save entry');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#E0FBFC] to-[#98C1D9] flex items-center justify-center">
        <div className="text-center">
          <IndianRupee className="w-16 h-16 mx-auto text-[#0EA5E9] animate-pulse mb-4" />
          <p className="text-[#1D3557] font-bold">Loading your wallet...</p>
        </div>
      </div>
    );
  }

  const balance = data?.balance || 0;
  const entries = data?.entries || [];
  const categories = dialogType === 'spend' ? SPEND_CATEGORIES : INCOME_CATEGORIES;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E0FBFC] to-[#98C1D9]" data-testid="my-wallet-page">
      {/* Header */}
      <header className="bg-[#0EA5E9] border-b-3 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <BackButton className="p-2 rounded-xl border-2 border-white hover:bg-white/20" testId="my-wallet-back-btn">
              <ChevronLeft className="w-5 h-5 text-white" />
            </BackButton>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full border-2 border-white flex items-center justify-center">
                <IndianRupee className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Fredoka' }}>My Wallet</h1>
                <p className="text-sm text-white/80">Your real money story</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Balance card */}
        <div className="rounded-3xl p-6 bg-gradient-to-br from-[#0EA5E9] to-[#38BDF8] text-white shadow-lg border-3 border-[#1D3557] mb-5" data-testid="my-wallet-balance-card">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-bold opacity-90">Money I have now</span>
            <span className="text-[10px] uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">From parent</span>
          </div>
          <p className="text-5xl font-bold" style={{ fontFamily: 'Fredoka' }} data-testid="my-wallet-balance">
            ₹{Number(balance).toFixed(0)}
          </p>
          <div className="flex gap-4 mt-4">
            <div className="flex items-center gap-1.5 text-sm">
              <ArrowDownCircle className="w-4 h-4" />
              <span className="opacity-90">In this month:</span>
              <span className="font-bold">₹{Number(data?.month_in || 0).toFixed(0)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <ArrowUpCircle className="w-4 h-4" />
              <span className="opacity-90">Out:</span>
              <span className="font-bold">₹{Number(data?.month_out || 0).toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => openDialog('income')}
            className="py-3 font-bold rounded-2xl border-3 border-[#1D3557] bg-[#06D6A0] text-white hover:bg-[#05b88a] flex items-center justify-center gap-2 shadow-md hover:scale-[1.02] transition-transform"
            data-testid="add-income-btn"
          >
            <Plus className="w-5 h-5" /> I got money
          </button>
          <button
            onClick={() => openDialog('spend')}
            className="py-3 font-bold rounded-2xl border-3 border-[#1D3557] bg-[#EE6C4D] text-white hover:bg-[#e05a3b] flex items-center justify-center gap-2 shadow-md hover:scale-[1.02] transition-transform"
            data-testid="add-spend-btn"
          >
            <Minus className="w-5 h-5" /> I spent money
          </button>
        </div>

        {/* Ledger */}
        <h2 className="text-lg font-bold text-[#1D3557] mb-3 flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
          <Sparkles className="w-5 h-5 text-[#0EA5E9]" /> Money Story
        </h2>

        {entries.length === 0 ? (
          <div className="card-playful p-8 text-center">
            <div className="text-4xl mb-3">👛</div>
            <p className="text-[#1D3557] font-bold mb-1">No entries yet</p>
            <p className="text-sm text-[#3D5A80]">Money you earn and spend will show up here!</p>
          </div>
        ) : (
          <div className="space-y-2" data-testid="my-wallet-ledger">
            {entries.map((e) => {
              const isInfo = e.direction === 'info';
              const isIn = e.direction === 'in';
              return (
                <div
                  key={e.transaction_id}
                  className={`flex items-center gap-3 p-3 rounded-2xl border-2 bg-white ${isInfo ? 'border-dashed border-[#98C1D9]' : 'border-[#1D3557]/10'}`}
                  data-testid={`ledger-entry-${e.transaction_id}`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${isInfo ? 'bg-[#E0FBFC]' : isIn ? 'bg-[#06D6A0]/15' : 'bg-[#EE6C4D]/15'}`}>
                    {entryVisual(e)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#1D3557] truncate">{e.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[#3D5A80]">{formatDate(e.created_at)}</span>
                      {e.is_manual && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E0FBFC] text-[#3D5A80] font-semibold">by me</span>
                      )}
                      {!isInfo && isIn && e.settlement_status !== 'paid' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">waiting for payout</span>
                      )}
                    </div>
                  </div>
                  {isInfo ? (
                    <span className="text-sm font-bold text-[#3D5A80] shrink-0">💵 ₹{Number(e.amount).toFixed(0)}</span>
                  ) : (
                    <span className={`text-lg font-bold shrink-0 ${isIn ? 'text-[#06D6A0]' : 'text-[#EE6C4D]'}`} style={{ fontFamily: 'Fredoka' }}>
                      {isIn ? '+' : '−'}₹{Number(e.amount).toFixed(0)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add entry dialog */}
      <Dialog open={!!dialogType} onOpenChange={(o) => { if (!o) setDialogType(null); }}>
        <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              {dialogType === 'spend' ? '🛍️ I spent money' : '✨ I got money'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-1 block">How much? (₹)</label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="e.g., 50"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="border-3 border-[#1D3557] rounded-xl text-lg"
                data-testid="entry-amount-input"
              />
              {dialogType === 'spend' && (
                <p className="text-xs text-[#3D5A80] mt-1">You have ₹{Number(balance).toFixed(0)} to spend.</p>
              )}
            </div>

            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-2 block">
                {dialogType === 'spend' ? 'What did you buy?' : 'Where did it come from?'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setForm({ ...form, category: c.key })}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-left font-semibold text-sm transition-colors ${form.category === c.key ? 'border-[#0EA5E9] bg-[#0EA5E9]/10 text-[#1D3557]' : 'border-[#1D3557]/15 bg-white text-[#3D5A80] hover:bg-[#E0FBFC]'}`}
                    data-testid={`category-${c.key}`}
                  >
                    <span className="text-lg">{c.emoji}</span> {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-1 block">Add a note (optional)</label>
              <Input
                placeholder={dialogType === 'spend' ? 'e.g., Ice cream with friends' : 'e.g., Birthday money from Grandma'}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="border-3 border-[#1D3557] rounded-xl"
                data-testid="entry-note-input"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setDialogType(null)}
                className="flex-1 py-3 font-bold rounded-xl border-3 border-[#1D3557] bg-white text-[#1D3557] hover:bg-[#E0FBFC]"
              >
                Cancel
              </button>
              <button
                onClick={submitEntry}
                disabled={submitting}
                className="flex-1 btn-primary py-3 disabled:opacity-50"
                data-testid="entry-submit-btn"
              >
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
