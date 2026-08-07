import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { ChevronLeft, IndianRupee, ArrowDownCircle, ArrowUpCircle, Plus, Minus, Sparkles, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { MoneyBreakdownChart } from '@/components/MoneyBreakdownChart';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

// The three ways to USE money
const USE_BUCKETS = [
  { key: 'spend', label: 'Spend', emoji: '🛍️', hint: 'Buy something', color: '#EE6C4D' },
  { key: 'save', label: 'Save', emoji: '🐷', hint: 'Keep for later', color: '#06D6A0' },
  { key: 'give', label: 'Give', emoji: '❤️', hint: 'Help others', color: '#9B5DE5' },
];

const CATEGORIES = {
  spend: [
    { key: 'toys', label: 'Toys', emoji: '🧸' },
    { key: 'food', label: 'Food & Snacks', emoji: '🍎' },
    { key: 'books', label: 'Books', emoji: '📚' },
    { key: 'games', label: 'Games', emoji: '🎮' },
    { key: 'clothes', label: 'Clothes', emoji: '👕' },
    { key: 'gift', label: 'A Gift', emoji: '🎁' },
    { key: 'other', label: 'Something Else', emoji: '✨' },
  ],
  save: [
    { key: 'goal', label: 'A Big Goal', emoji: '🎯' },
    { key: 'later', label: 'For Later', emoji: '🔮' },
    { key: 'emergency', label: 'Emergency', emoji: '🚨' },
    { key: 'other', label: 'Just Saving', emoji: '🐷' },
  ],
  give: [
    { key: 'charity', label: 'Charity', emoji: '❤️' },
    { key: 'friend', label: 'A Friend', emoji: '🧑‍🤝‍🧑' },
    { key: 'family', label: 'Family', emoji: '👪' },
    { key: 'other', label: 'Something Else', emoji: '✨' },
  ],
  income: [
    { key: 'cash', label: 'Cash from Family', emoji: '💵' },
    { key: 'gift', label: 'A Gift', emoji: '🎁' },
    { key: 'found', label: 'Found Money', emoji: '🪙' },
    { key: 'other', label: 'Something Else', emoji: '✨' },
  ],
};

const entryVisual = (entry) => {
  const catEmoji = { toys: '🧸', food: '🍎', books: '📚', games: '🎮', clothes: '👕', charity: '❤️', gift: '🎁', cash: '💵', found: '🪙', goal: '🎯', later: '🔮', emergency: '🚨', friend: '🧑‍🤝‍🧑', family: '👪', piggybank: '🐷', giving: '💝' };
  const typeEmoji = {
    chore_reward: '🧹', job_payment: '💼', allowance: '📅', gift_received: '🎁',
    parent_gift: '🎁', parent_reward: '⭐', parent_penalty: '⚠️', parent_settlement: '💵',
    manual_income: '✨', manual_spend: '🛍️', wallet_save: '🐷', wallet_give: '❤️', savings_contribution: '🎯',
  };
  return catEmoji[entry.category] || typeEmoji[entry.transaction_type] || (entry.direction === 'out' ? '🛍️' : '💰');
};

const formatDate = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  catch { return ''; }
};

export default function MyWalletPage({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [goals, setGoals] = useState([]);
  // dialog: null | { mode: 'use' | 'income', bucket: null | 'spend'|'save'|'give' }
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({ amount: '', category: '', note: '' });
  const [submitting, setSubmitting] = useState(false);
  // edit/delete
  const [editEntry, setEditEntry] = useState(null); // the entry being edited
  const [editForm, setEditForm] = useState({ amount: '', note: '' });
  const [deletingId, setDeletingId] = useState(null);

  const fetchData = async (p = page) => {
    try {
      const res = await axios.get(`${API}/wallet/my-wallet?page=${p}&page_size=10`);
      setData(res.data);
    } catch (e) {
      toast.error('Could not load your wallet');
    } finally {
      setLoading(false);
    }
  };

  const fetchGoals = async () => {
    try {
      const res = await axios.get(`${API}/child/savings-goals`);
      setGoals((res.data || []).filter((g) => !g.completed));
    } catch (e) { /* silent */ }
  };

  useEffect(() => { fetchData(page); /* eslint-disable-next-line */ }, [page]);
  useEffect(() => { fetchGoals(); }, []);

  const openUse = () => { setForm({ amount: '', category: '', note: '' }); setDialog({ mode: 'use', bucket: null }); };
  const openIncome = () => { setForm({ amount: '', category: '', note: '' }); setDialog({ mode: 'income', bucket: null }); };

  const activeBucket = dialog?.mode === 'income' ? 'income' : dialog?.bucket;
  const categories = activeBucket ? CATEGORIES[activeBucket] : [];

  const submitEntry = async () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { toast.error('Please enter how much'); return; }
    if (!form.category) { toast.error('Please pick a reason'); return; }
    const entryType = dialog.mode === 'income' ? 'income' : dialog.bucket;
    if (entryType !== 'income' && amount > (data?.balance || 0)) { toast.error("That's more than you have!"); return; }
    setSubmitting(true);
    try {
      const payload = { entry_type: entryType, amount, category: form.category, note: form.note };
      if (entryType === 'save') {
        // form.category holds 'piggybank' or a goal_id
        if (form.category !== 'piggybank') {
          payload.goal_id = form.category;
          payload.category = 'goal';
        } else {
          payload.category = 'piggybank';
        }
      }
      await axios.post(`${API}/wallet/my-wallet/entry`, payload);
      const msg = { spend: 'Spending saved! 🛍️', save: 'Saved! 🐷', give: 'Given! ❤️', income: 'Money added! ✨' }[entryType];
      toast.success(msg);
      setDialog(null);
      setPage(1);
      fetchData(1);
      fetchGoals();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not save entry');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (entry) => {
    if (!window.confirm('Undo this entry? Your money will go back.')) return;
    setDeletingId(entry.transaction_id);
    try {
      await axios.delete(`${API}/wallet/my-wallet/entry/${entry.transaction_id}`);
      toast.success('Entry removed');
      fetchData(page);
      fetchGoals();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not undo');
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (entry) => {
    setEditEntry(entry);
    setEditForm({ amount: String(entry.amount), note: entry.title || '' });
  };

  const submitEdit = async () => {
    const amount = parseFloat(editForm.amount);
    if (!amount || amount <= 0) { toast.error('Please enter a valid amount'); return; }
    setSubmitting(true);
    try {
      await axios.put(`${API}/wallet/my-wallet/entry/${editEntry.transaction_id}`, {
        amount, note: editForm.note,
      });
      toast.success('Entry fixed! ✏️');
      setEditEntry(null);
      fetchData(page);
      fetchGoals();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not fix entry');
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
  const totalPages = data?.total_pages || 1;

  const dialogTitle = dialog?.mode === 'income'
    ? '✨ I got money'
    : dialog?.bucket
      ? `${USE_BUCKETS.find(b => b.key === dialog.bucket)?.emoji} I want to ${dialog.bucket}`
      : '💰 I used money';

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

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Left column: balance, actions, chart */}
          <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-6">
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
            onClick={openIncome}
            className="py-3 font-bold rounded-2xl border-3 border-[#1D3557] bg-[#06D6A0] text-white hover:bg-[#05b88a] flex items-center justify-center gap-2 shadow-md hover:scale-[1.02] transition-transform"
            data-testid="add-income-btn"
          >
            <Plus className="w-5 h-5" /> I got money
          </button>
          <button
            onClick={openUse}
            className="py-3 font-bold rounded-2xl border-3 border-[#1D3557] bg-[#EE6C4D] text-white hover:bg-[#e05a3b] flex items-center justify-center gap-2 shadow-md hover:scale-[1.02] transition-transform"
            data-testid="use-money-btn"
          >
            <Minus className="w-5 h-5" /> I used money
          </button>
        </div>

        {/* Chart */}
        <div>
          <h2 className="text-lg font-bold text-[#1D3557] mb-3 flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
            📊 Where my money went
          </h2>
          <MoneyBreakdownChart breakdown={data?.breakdown} />
        </div>
          </div>

          {/* Right column: money story */}
          <div className="lg:col-span-7">
        {/* Ledger */}
        <h2 className="text-lg font-bold text-[#1D3557] mb-3 flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
          <Sparkles className="w-5 h-5 text-[#0EA5E9]" /> Money Story
        </h2>

        {entries.length === 0 ? (
          <div className="card-playful p-8 text-center">
            <div className="text-4xl mb-3">👛</div>
            <p className="text-[#1D3557] font-bold mb-1">No entries yet</p>
            <p className="text-sm text-[#3D5A80]">Money you earn and use will show up here!</p>
          </div>
        ) : (
          <>
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
                      <span className="text-sm font-bold text-[#3D5A80] shrink-0">₹{Number(e.amount).toFixed(0)}</span>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-lg font-bold ${isIn ? 'text-[#06D6A0]' : 'text-[#EE6C4D]'}`} style={{ fontFamily: 'Fredoka' }}>
                          {isIn ? '+' : '−'}₹{Number(e.amount).toFixed(0)}
                        </span>
                        {e.is_manual && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEdit(e)}
                              className="p-1.5 rounded-lg text-[#3D5A80] hover:bg-[#E0FBFC] hover:text-[#0EA5E9] transition-colors"
                              title="Fix this entry"
                              data-testid={`edit-entry-${e.transaction_id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(e)}
                              disabled={deletingId === e.transaction_id}
                              className="p-1.5 rounded-lg text-[#3D5A80] hover:bg-red-50 hover:text-[#EE6C4D] transition-colors disabled:opacity-40"
                              title="Undo this entry"
                              data-testid={`delete-entry-${e.transaction_id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-5" data-testid="my-wallet-pagination">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 rounded-xl border-2 border-[#1D3557] bg-white font-bold text-[#1D3557] disabled:opacity-40 flex items-center gap-1"
                  data-testid="wallet-prev-page"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <span className="text-sm font-bold text-[#1D3557]" data-testid="wallet-page-indicator">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-4 py-2 rounded-xl border-2 border-[#1D3557] bg-white font-bold text-[#1D3557] disabled:opacity-40 flex items-center gap-1"
                  data-testid="wallet-next-page"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
          </div>
        </div>
      </main>

      {/* Add/Use dialog */}
      <Dialog open={!!dialog} onOpenChange={(o) => { if (!o) setDialog(null); }}>
        <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              {dialogTitle}
            </DialogTitle>
          </DialogHeader>

          {/* Step 1 for "use": pick Spend / Save / Give */}
          {dialog?.mode === 'use' && !dialog?.bucket ? (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-[#3D5A80]">What do you want to do with your money?</p>
              <p className="text-xs text-[#3D5A80]">You have ₹{Number(balance).toFixed(0)}.</p>
              <div className="grid grid-cols-1 gap-3">
                {USE_BUCKETS.map((b) => (
                  <button
                    key={b.key}
                    onClick={() => { setForm({ amount: '', category: '', note: '' }); setDialog({ mode: 'use', bucket: b.key }); }}
                    className="flex items-center gap-3 p-4 rounded-2xl border-3 text-left hover:scale-[1.01] transition-transform"
                    style={{ borderColor: b.color, background: `${b.color}12` }}
                    data-testid={`bucket-${b.key}`}
                  >
                    <span className="text-3xl">{b.emoji}</span>
                    <div>
                      <p className="font-bold text-[#1D3557] text-lg">{b.label}</p>
                      <p className="text-xs text-[#3D5A80]">{b.hint}</p>
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setDialog(null)}
                className="w-full py-3 font-bold rounded-xl border-3 border-[#1D3557] bg-white text-[#1D3557] hover:bg-[#E0FBFC] mt-1"
              >
                Cancel
              </button>
            </div>
          ) : (
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
                {dialog?.mode !== 'income' && (
                  <p className="text-xs text-[#3D5A80] mt-1">You have ₹{Number(balance).toFixed(0)} to use.</p>
                )}
              </div>

              <div>
                <label className="text-sm font-bold text-[#1D3557] mb-2 block">
                  {dialog?.mode === 'income' ? 'Where did it come from?'
                    : dialog?.bucket === 'spend' ? 'What did you buy?'
                    : dialog?.bucket === 'save' ? 'Where should it go?'
                    : 'Who did you help?'}
                </label>
                {dialog?.bucket === 'save' ? (
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => setForm({ ...form, category: 'piggybank' })}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-left font-semibold text-sm transition-colors ${form.category === 'piggybank' ? 'border-[#06D6A0] bg-[#06D6A0]/10 text-[#1D3557]' : 'border-[#1D3557]/15 bg-white text-[#3D5A80] hover:bg-[#E0FBFC]'}`}
                      data-testid="save-target-piggybank"
                    >
                      <span className="text-lg">🐷</span> General Piggy Bank
                    </button>
                    {goals.map((g) => {
                      const pct = g.target_amount ? Math.min(Math.round(((g.current_amount || 0) / g.target_amount) * 100), 100) : 0;
                      return (
                        <button
                          key={g.goal_id}
                          onClick={() => setForm({ ...form, category: g.goal_id })}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-left font-semibold text-sm transition-colors ${form.category === g.goal_id ? 'border-[#06D6A0] bg-[#06D6A0]/10 text-[#1D3557]' : 'border-[#1D3557]/15 bg-white text-[#3D5A80] hover:bg-[#E0FBFC]'}`}
                          data-testid={`save-target-goal-${g.goal_id}`}
                        >
                          <span className="text-lg">🎯</span>
                          <span className="flex-1 truncate">{g.title}</span>
                          <span className="text-xs text-[#3D5A80]">{pct}%</span>
                        </button>
                      );
                    })}
                    {goals.length === 0 && (
                      <p className="text-xs text-[#3D5A80]">No goals yet — money goes to your Piggy Bank.</p>
                    )}
                  </div>
                ) : (
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
                )}
              </div>

              <div>
                <label className="text-sm font-bold text-[#1D3557] mb-1 block">Add a note (optional)</label>
                <Input
                  placeholder="e.g., Ice cream with friends"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="border-3 border-[#1D3557] rounded-xl"
                  data-testid="entry-note-input"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => dialog?.mode === 'use' ? setDialog({ mode: 'use', bucket: null }) : setDialog(null)}
                  className="flex-1 py-3 font-bold rounded-xl border-3 border-[#1D3557] bg-white text-[#1D3557] hover:bg-[#E0FBFC]"
                >
                  {dialog?.mode === 'use' ? 'Back' : 'Cancel'}
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
          )}
        </DialogContent>
      </Dialog>

      {/* Edit entry dialog */}
      <Dialog open={!!editEntry} onOpenChange={(o) => { if (!o) setEditEntry(null); }}>
        <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-md" data-testid="edit-entry-dialog">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              ✏️ Fix this entry
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-1 block">How much? (₹)</label>
              <Input
                type="number"
                inputMode="numeric"
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                className="border-3 border-[#1D3557] rounded-xl text-lg"
                data-testid="edit-amount-input"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-1 block">Note</label>
              <Input
                value={editForm.note}
                onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                className="border-3 border-[#1D3557] rounded-xl"
                data-testid="edit-note-input"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setEditEntry(null)}
                className="flex-1 py-3 font-bold rounded-xl border-3 border-[#1D3557] bg-white text-[#1D3557] hover:bg-[#E0FBFC]"
              >
                Cancel
              </button>
              <button
                onClick={submitEdit}
                disabled={submitting}
                className="flex-1 btn-primary py-3 disabled:opacity-50"
                data-testid="edit-submit-btn"
              >
                {submitting ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
