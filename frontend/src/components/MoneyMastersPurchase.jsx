import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Rocket, CalendarDays, Check } from 'lucide-react';
import { API } from '@/App';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const RAZORPAY_KEY = process.env.REACT_APP_RAZORPAY_KEY_ID;
const GRADE_LABELS = ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'];

const formatDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const loadRazorpayScript = () => new Promise((resolve) => {
  if (document.getElementById('razorpay-script')) { resolve(true); return; }
  const script = document.createElement('script');
  script.id = 'razorpay-script';
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.onload = () => resolve(true);
  script.onerror = () => resolve(false);
  document.body.appendChild(script);
});

export function MoneyMastersPurchase({ children, user }) {
  const [open, setOpen] = useState(false);
  const [myBatches, setMyBatches] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [paying, setPaying] = useState(null); // batch_id being paid

  const fetchMyBatches = async () => {
    try {
      const res = await axios.get(`${API}/subscriptions/money-masters/my-batches`);
      setMyBatches(res.data || []);
    } catch { /* silent — non-critical for dashboard */ }
  };

  useEffect(() => { fetchMyBatches(); }, []);

  useEffect(() => {
    if (!selectedChildId) { setBatches([]); return; }
    setLoadingBatches(true);
    axios.get(`${API}/subscriptions/money-masters/batches?child_id=${selectedChildId}`)
      .then((res) => setBatches(res.data || []))
      .catch(() => setBatches([]))
      .finally(() => setLoadingBatches(false));
  }, [selectedChildId]);

  const activeForChild = (childId) => myBatches.find(
    (s) => s.child_user_ids?.includes(childId) && s.payment_status === 'completed' && s.is_active && new Date(s.end_date) > new Date()
  );

  const buyBatch = async (batch) => {
    setPaying(batch.batch_id);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error('Payment gateway failed to load. Please try again.');
        setPaying(null);
        return;
      }
      const orderRes = await axios.post(`${API}/subscriptions/money-masters/create-order`, {
        batch_id: batch.batch_id,
        child_id: selectedChildId,
      });
      const { order_id, amount, currency, key_id } = orderRes.data;
      const options = {
        key: key_id || RAZORPAY_KEY,
        amount,
        currency,
        name: 'CoinQuest — Money Masters',
        description: batch.name,
        order_id,
        handler: async (response) => {
          try {
            await axios.post(`${API}/subscriptions/verify-payment`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success('Money Masters unlocked! Refresh to see the new content.');
            setOpen(false);
            fetchMyBatches();
          } catch {
            toast.error('Payment verification failed. Please contact support.');
          } finally {
            setPaying(null);
          }
        },
        theme: { color: '#7C3AED' },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        modal: { ondismiss: () => setPaying(null) },
      };
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        toast.error(`Payment failed: ${response.error.description}`);
        setPaying(null);
      });
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start payment');
      setPaying(null);
    }
  };

  if (!children?.length) return null;

  return (
    <>
      <div className="bg-gradient-to-r from-[#7C3AED] to-[#5B21B6] rounded-xl p-4 mb-5 text-white" data-testid="money-masters-promo-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
            <Rocket className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm">Money Masters & Entrepreneurship</p>
            <p className="text-xs text-white/80">A standalone module — curriculum + live classes, sold in dated batches. No other plan needed.</p>
          </div>
          <Button
            data-testid="open-money-masters-dialog-btn"
            size="sm"
            onClick={() => { setOpen(true); setSelectedChildId(children[0]?.user_id || ''); }}
            className="bg-white text-[#5B21B6] hover:bg-white/90 whitespace-nowrap"
          >
            View Batches
          </Button>
        </div>
        {myBatches.filter((s) => s.payment_status === 'completed' && s.is_active && new Date(s.end_date) > new Date()).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {myBatches.filter((s) => s.payment_status === 'completed' && s.is_active && new Date(s.end_date) > new Date()).map((s) => (
              <span key={s.subscription_id} className="text-[10px] bg-white/15 px-2 py-1 rounded-full" data-testid={`mm-active-badge-${s.subscription_id}`}>
                <Check className="w-3 h-3 inline mr-1" />{s.child_name}: {s.batch_name} (till {formatDate(s.end_date)})
              </span>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg" data-testid="money-masters-dialog">
          <DialogHeader>
            <DialogTitle className="text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Money Masters & Entrepreneurship</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-1 block">Choose Child</label>
              <Select value={selectedChildId} onValueChange={setSelectedChildId}>
                <SelectTrigger data-testid="mm-child-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {children.map((c) => (
                    <SelectItem key={c.user_id} value={c.user_id}>{c.name} — {GRADE_LABELS[c.grade] || `Grade ${c.grade}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedChildId && activeForChild(selectedChildId) && (
              <div className="bg-[#D1FAE5] border border-[#06D6A0]/30 rounded-lg p-3 text-sm text-[#166534]" data-testid="mm-already-active-notice">
                Already enrolled in <strong>{activeForChild(selectedChildId).batch_name}</strong> until {formatDate(activeForChild(selectedChildId).end_date)}.
              </div>
            )}

            {loadingBatches ? (
              <p className="text-sm text-gray-400 text-center py-4">Loading batches...</p>
            ) : batches.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4" data-testid="mm-no-batches">No open batches for this grade right now — check back soon.</p>
            ) : (
              <div className="space-y-2">
                {batches.map((b) => (
                  <div key={b.batch_id} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between" data-testid={`mm-batch-card-${b.batch_id}`}>
                    <div>
                      <p className="font-bold text-[#1D3557] text-sm">{b.name}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <CalendarDays className="w-3 h-3" /> {formatDate(b.start_date)} – {formatDate(b.end_date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#5B21B6]">₹{b.price.toLocaleString('en-IN')}</p>
                      <Button
                        data-testid={`mm-buy-btn-${b.batch_id}`}
                        size="sm"
                        disabled={!!paying || !!activeForChild(selectedChildId)}
                        onClick={() => buyBatch(b)}
                        className="mt-1 bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
                      >
                        {paying === b.batch_id ? 'Processing...' : 'Buy'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
