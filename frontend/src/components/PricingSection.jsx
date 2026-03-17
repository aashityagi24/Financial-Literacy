import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Check, Users, User, ChevronDown, CreditCard, Shield, Clock, Star } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const RAZORPAY_KEY = process.env.REACT_APP_RAZORPAY_KEY_ID;

const DURATION_ORDER = ['1_day', '1_month', '6_months', '1_year'];
const DURATION_LABELS = {
  '1_day': { short: '1 Day', tag: 'Try it out' },
  '1_month': { short: '1 Month', tag: 'Most Popular' },
  '6_months': { short: '6 Months', tag: 'Save 17%' },
  '1_year': { short: '1 Year', tag: 'Best Value' },
};

export default function PricingSection() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState(null);
  const [planMeta, setPlanMeta] = useState(null);
  const [selectedPlanType, setSelectedPlanType] = useState('single_parent');
  const [selectedDuration, setSelectedDuration] = useState('1_month');
  const [numChildren, setNumChildren] = useState(1);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({ name: '', email: '', phone: '' });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await axios.get(`${API}/subscriptions/plans`);
        setPlans(res.data.plans);
        setPlanMeta(res.data.plan_types);
      } catch (err) {
        console.error('Failed to fetch plans:', err);
      }
    };
    fetchPlans();
  }, []);

  if (!plans || !planMeta) return null;

  const currentPlan = plans[selectedPlanType]?.[selectedDuration];
  const totalPrice = currentPlan
    ? currentPlan.base_price + Math.max(0, numChildren - 1) * currentPlan.per_child_price
    : 0;

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (document.getElementById('razorpay-script')) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.id = 'razorpay-script';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleBuyNow = () => {
    setShowCheckout(true);
  };

  const handlePayment = async () => {
    if (!checkoutForm.name.trim() || !checkoutForm.email.trim() || !checkoutForm.phone.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    if (!checkoutForm.email.includes('@')) {
      toast.error('Please enter a valid email');
      return;
    }
    if (checkoutForm.phone.replace(/\D/g, '').length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setIsProcessing(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error('Payment gateway failed to load. Please try again.');
        setIsProcessing(false);
        return;
      }

      // Create order
      const orderRes = await axios.post(`${API}/subscriptions/create-order`, {
        plan_type: selectedPlanType,
        duration: selectedDuration,
        num_children: numChildren,
        subscriber_name: checkoutForm.name,
        subscriber_email: checkoutForm.email,
        subscriber_phone: checkoutForm.phone,
      });

      const { order_id, amount, currency, key_id } = orderRes.data;

      const options = {
        key: key_id || RAZORPAY_KEY,
        amount,
        currency,
        name: 'CoinQuest',
        description: `${planMeta[selectedPlanType].label} - ${DURATION_LABELS[selectedDuration].short}`,
        order_id,
        handler: async (response) => {
          try {
            await axios.post(`${API}/subscriptions/verify-payment`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success('Payment successful! You can now sign in with Google.');
            setShowCheckout(false);
            setCheckoutForm({ name: '', email: '', phone: '' });
            navigate('/login');
          } catch (err) {
            toast.error('Payment verification failed. Please contact support.');
          }
        },
        prefill: {
          name: checkoutForm.name,
          email: checkoutForm.email,
          contact: checkoutForm.phone,
        },
        theme: { color: '#1D3557' },
        modal: {
          ondismiss: () => setIsProcessing(false),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        toast.error(`Payment failed: ${response.error.description}`);
        setIsProcessing(false);
      });
      rzp.open();
    } catch (err) {
      toast.error('Failed to initiate payment. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <section id="pricing" className="py-20 bg-white" data-testid="pricing-section">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl lg:text-5xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
            Choose Your Plan
          </h2>
          <p className="text-lg text-[#3D5A80] max-w-2xl mx-auto">
            Start your child's financial literacy journey today. Pick a plan that works for your family.
          </p>
        </div>

        {/* Plan Type Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-[#E0FBFC] rounded-full p-1.5 border-2 border-[#1D3557]">
            <button
              data-testid="plan-type-single"
              onClick={() => setSelectedPlanType('single_parent')}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${
                selectedPlanType === 'single_parent'
                  ? 'bg-[#1D3557] text-white shadow-lg'
                  : 'text-[#1D3557] hover:bg-white/50'
              }`}
            >
              <User className="w-4 h-4" />
              Single Parent
            </button>
            <button
              data-testid="plan-type-two"
              onClick={() => setSelectedPlanType('two_parents')}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${
                selectedPlanType === 'two_parents'
                  ? 'bg-[#1D3557] text-white shadow-lg'
                  : 'text-[#1D3557] hover:bg-white/50'
              }`}
            >
              <Users className="w-4 h-4" />
              Two Parents
            </button>
          </div>
        </div>

        {/* Children Selector */}
        <div className="flex justify-center mb-10">
          <div className="flex items-center gap-3 bg-[#FFF3E0] rounded-full px-6 py-3 border-2 border-[#EE6C4D]/40">
            <span className="text-sm font-bold text-[#1D3557]">Number of Children:</span>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  data-testid={`children-count-${n}`}
                  onClick={() => setNumChildren(n)}
                  className={`w-9 h-9 rounded-full font-bold text-sm transition-all ${
                    numChildren === n
                      ? 'bg-[#EE6C4D] text-white shadow-md scale-110'
                      : 'bg-white text-[#1D3557] hover:bg-[#EE6C4D]/20 border border-[#1D3557]/20'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Duration Cards */}
        <div className="grid md:grid-cols-4 gap-4 max-w-5xl mx-auto mb-8">
          {DURATION_ORDER.map((dur) => {
            const plan = plans[selectedPlanType]?.[dur];
            if (!plan) return null;
            const price = plan.base_price + Math.max(0, numChildren - 1) * plan.per_child_price;
            const isSelected = selectedDuration === dur;
            const isPopular = dur === '1_month';

            return (
              <div
                key={dur}
                data-testid={`plan-card-${dur}`}
                onClick={() => setSelectedDuration(dur)}
                className={`relative cursor-pointer rounded-2xl border-3 p-6 transition-all duration-200 ${
                  isSelected
                    ? 'bg-[#1D3557] text-white border-[#FFD23F] shadow-[6px_6px_0px_0px_#FFD23F] scale-[1.02]'
                    : 'bg-white text-[#1D3557] border-[#1D3557] hover:shadow-[4px_4px_0px_0px_#1D3557] hover:-translate-y-1'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FFD23F] text-[#1D3557] text-xs font-bold px-3 py-1 rounded-full border-2 border-[#1D3557]">
                    <Star className="w-3 h-3 inline mr-1" />
                    Popular
                  </div>
                )}
                <div className="text-center">
                  <p className={`text-sm font-medium mb-1 ${isSelected ? 'text-[#FFD23F]' : 'text-[#3D5A80]'}`}>
                    {DURATION_LABELS[dur].short}
                  </p>
                  <p className="text-3xl font-bold mb-1" style={{ fontFamily: 'Fredoka' }}>
                    ₹{price.toLocaleString('en-IN')}
                  </p>
                  <p className={`text-xs ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
                    {dur === '1_day' ? 'one-time' : `for ${DURATION_LABELS[dur].short.toLowerCase()}`}
                  </p>
                  {numChildren > 1 && (
                    <p className={`text-xs mt-2 ${isSelected ? 'text-[#FFD23F]/80' : 'text-[#EE6C4D]'}`}>
                      Base ₹{plan.base_price} + {numChildren - 1} extra child{numChildren > 2 ? 'ren' : ''}
                    </p>
                  )}
                </div>
                {isSelected && (
                  <div className="absolute top-3 right-3">
                    <div className="w-6 h-6 bg-[#06D6A0] rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary + Buy Button */}
        <div className="max-w-md mx-auto text-center">
          <div className="bg-[#E0FBFC] rounded-2xl border-2 border-[#1D3557]/20 p-6 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-[#3D5A80]">{planMeta[selectedPlanType].label}</span>
              <span className="text-sm font-medium text-[#1D3557]">{DURATION_LABELS[selectedDuration].short}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-[#3D5A80]">
                {planMeta[selectedPlanType].max_parents} Parent{planMeta[selectedPlanType].max_parents > 1 ? 's' : ''} + {numChildren} Child{numChildren > 1 ? 'ren' : ''}
              </span>
            </div>
            <div className="border-t border-[#1D3557]/20 pt-3 mt-3">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-[#1D3557]">Total</span>
                <span className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                  ₹{totalPrice.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
          <Button
            data-testid="buy-now-btn"
            onClick={handleBuyNow}
            className="w-full py-6 text-lg font-bold bg-[#06D6A0] hover:bg-[#05C090] text-white rounded-xl border-2 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557] hover:-translate-y-1 transition-all"
          >
            <CreditCard className="w-5 h-5 mr-2" />
            Buy Now - ₹{totalPrice.toLocaleString('en-IN')}
          </Button>
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-[#3D5A80]">
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Secure Payment</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Instant Access</span>
          </div>
        </div>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              Complete Your Purchase
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-[#E0FBFC] rounded-xl p-4 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-[#3D5A80]">{planMeta[selectedPlanType].label}</span>
                <span className="font-bold text-[#1D3557]">{DURATION_LABELS[selectedDuration].short}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#3D5A80]">{numChildren} Child{numChildren > 1 ? 'ren' : ''}</span>
                <span className="font-bold text-[#1D3557]">₹{totalPrice.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-1 block">Full Name</label>
              <Input
                data-testid="checkout-name"
                placeholder="Enter your full name"
                value={checkoutForm.name}
                onChange={(e) => setCheckoutForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-1 block">Email (use the same email for Google Sign-In)</label>
              <Input
                data-testid="checkout-email"
                type="email"
                placeholder="your.email@gmail.com"
                value={checkoutForm.email}
                onChange={(e) => setCheckoutForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-1 block">Phone Number</label>
              <Input
                data-testid="checkout-phone"
                type="tel"
                placeholder="+91 9XXXXXXXXX"
                value={checkoutForm.phone}
                onChange={(e) => setCheckoutForm(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>

            <Button
              data-testid="proceed-to-pay-btn"
              onClick={handlePayment}
              disabled={isProcessing}
              className="w-full py-5 text-lg font-bold bg-[#1D3557] hover:bg-[#2D4A6F] text-white rounded-xl"
            >
              {isProcessing ? 'Processing...' : `Pay ₹${totalPrice.toLocaleString('en-IN')}`}
            </Button>
            <p className="text-xs text-center text-gray-500">
              After payment, sign in with Google using the email above to access CoinQuest.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
