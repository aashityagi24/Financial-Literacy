import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Check, Users, User, ChevronDown, CreditCard, Shield, Clock, School, Phone, Mail, MapPin, Briefcase } from 'lucide-react';
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
  const [selectedDuration, setSelectedDuration] = useState('6_months');
  const [numChildren, setNumChildren] = useState(1);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({ name: '', email: '', phone: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSchoolEnquiry, setShowSchoolEnquiry] = useState(false);
  const [schoolForm, setSchoolForm] = useState({
    school_name: '', city: '', person_name: '', designation: '', contact_number: '', email: '', grades: []
  });
  const [submittingEnquiry, setSubmittingEnquiry] = useState(false);

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
  
  const calcTotal = (plan, children) => {
    if (!plan) return 0;
    let total = plan.base_price;
    const cp = plan.child_prices || [];
    for (let i = 1; i < children; i++) {
      total += (cp[i - 1] || 0);
    }
    return total;
  };
  
  const totalPrice = calcTotal(currentPlan, numChildren);

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

  const captureLeadQuietly = (form, leadStatus) => {
    if (form.email?.trim()) {
      axios.post(`${API}/subscriptions/capture-lead`, {
        name: form.name, email: form.email, phone: form.phone,
        plan_type: selectedPlanType, duration: selectedDuration, num_children: numChildren,
        lead_status: leadStatus,
      }).catch(() => {});
    }
  };

  const handleCheckoutClose = (open) => {
    if (!open && checkoutForm.email?.trim()) {
      captureLeadQuietly(checkoutForm, 'form_closed');
    }
    setShowCheckout(open);
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
    captureLeadQuietly(checkoutForm, 'form_submitted');
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

      if (!order_id || !key_id) {
        toast.error('Payment gateway configuration error. Please contact support.');
        setIsProcessing(false);
        return;
      }

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
      const detail = err.response?.data?.detail || err.message || 'Unknown error';
      toast.error(`Failed to initiate payment: ${detail}`);
      setIsProcessing(false);
    }
  };

  const handleSchoolEnquiry = async () => {
    if (!schoolForm.school_name.trim()) { toast.error('School name is required'); return; }
    if (!schoolForm.person_name.trim()) { toast.error('Contact person name is required'); return; }
    if (!schoolForm.contact_number.trim() || schoolForm.contact_number.replace(/\D/g, '').length < 10) { toast.error('Valid contact number is required'); return; }
    if (!schoolForm.email.trim() || !schoolForm.email.includes('@')) { toast.error('Valid email is required'); return; }
    
    setSubmittingEnquiry(true);
    try {
      await axios.post(`${API}/admin/school-enquiry`, schoolForm);
      toast.success('Enquiry submitted! Our team will reach out to you shortly.');
      setShowSchoolEnquiry(false);
      setSchoolForm({ school_name: '', city: '', person_name: '', designation: '', contact_number: '', email: '', grades: [] });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit enquiry');
    } finally {
      setSubmittingEnquiry(false);
    }
  };

  const toggleGrade = (grade) => {
    setSchoolForm(prev => ({
      ...prev,
      grades: prev.grades.includes(grade) ? prev.grades.filter(g => g !== grade) : [...prev.grades, grade]
    }));
  };

  return (
    <section id="pricing" className="py-16 bg-white" data-testid="pricing-section">
      <div className="container mx-auto px-6">
        <div className="text-center mb-8">
          <h2 className="text-4xl lg:text-5xl font-bold text-[#1D3557] mb-3" style={{ fontFamily: 'Fredoka' }}>
            Choose Your Plan
          </h2>
          <p className="text-base text-[#3D5A80] max-w-xl mx-auto">
            Start your child's financial literacy journey today.
          </p>
        </div>

        {/* Plan Type Toggle */}
        <div className="flex justify-center mb-5">
          <div className="inline-flex bg-[#E0FBFC] rounded-full p-1 border-2 border-[#1D3557]">
            <button
              data-testid="plan-type-single"
              onClick={() => setSelectedPlanType('single_parent')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all ${
                selectedPlanType === 'single_parent'
                  ? 'bg-[#1D3557] text-white shadow-lg'
                  : 'text-[#1D3557] hover:bg-white/50'
              }`}
            >
              <User className="w-4 h-4" />
              Single Parent Login
            </button>
            <button
              data-testid="plan-type-two"
              onClick={() => setSelectedPlanType('two_parents')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all ${
                selectedPlanType === 'two_parents'
                  ? 'bg-[#1D3557] text-white shadow-lg'
                  : 'text-[#1D3557] hover:bg-white/50'
              }`}
            >
              <Users className="w-4 h-4" />
              Dual Parent Login
            </button>
          </div>
        </div>

        {/* Plan Subtitle */}
        <p className="text-center text-sm font-semibold tracking-wide text-[#3D5A80] uppercase mb-6">
          {selectedPlanType === 'single_parent' ? '1' : '2'} Parent Login{selectedPlanType === 'two_parents' ? 's' : ''} &middot; Base 1 Child Included
        </p>

        {/* Duration Cards with Tiered Pricing */}
        <div className="grid md:grid-cols-4 gap-5 max-w-5xl mx-auto">
          {DURATION_ORDER.map((dur) => {
            const plan = plans[selectedPlanType]?.[dur];
            if (!plan) return null;
            const price = plan.base_price;
            const isPopular = dur === '6_months';
            const isSelected = selectedDuration === dur;
            const isYear = dur === '1_year';
            const cp = plan.child_prices || [];
            const perDay = (price / (plan.duration_days || 1)).toFixed(1);
            const durLabel = {
              '1_day': { name: '1 Day', tag: 'Try it', tagColor: 'bg-[#E0FBFC] text-[#3D5A80]' },
              '1_month': { name: '1 Month', tag: '', tagColor: '' },
              '6_months': { name: '6 Months', tag: 'Best value', tagColor: 'bg-[#E0FBFC] text-[#3D5A80]' },
              '1_year': { name: '1 Year', tag: 'Max saving', tagColor: 'bg-[#D1FAE5] text-[#166534]' },
            }[dur];

            return (
              <div key={dur} className="flex flex-col">
                <div
                  data-testid={`plan-card-${dur}`}
                  onClick={() => setSelectedDuration(dur)}
                  className={`relative cursor-pointer rounded-2xl overflow-hidden flex flex-col border-2 transition-all duration-200 bg-white ${
                    isPopular && isSelected
                      ? 'border-[#1D3557] shadow-[3px_3px_0px_0px_#1D3557]'
                      : isSelected
                      ? 'border-[#06D6A0] shadow-[3px_3px_0px_0px_#06D6A0]'
                      : 'border-[#1D3557]/15 hover:border-[#1D3557]/40 shadow-sm hover:shadow-md'
                  }`}
                >
                  <div className="px-5 pt-5 pb-0">
                    {/* Title row */}
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>{durLabel.name}</h3>
                      {durLabel.tag && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${durLabel.tagColor}`}>{durLabel.tag}</span>
                      )}
                    </div>

                    {/* Base price */}
                    <p className="text-4xl font-bold text-[#1D3557] mb-0.5" style={{ fontFamily: 'Fredoka' }}>
                      ₹{price.toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-gray-500 mb-3">
                      ₹{perDay}/day &middot; includes 1 child
                    </p>

                    <hr className="border-[#1D3557]/10 mb-3" />

                    {/* Additional children pricing */}
                    <p className="text-sm font-bold text-[#1D3557] mb-2">Additional children</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {cp.map((childPrice, idx) => (
                        <span key={idx} className="text-xs bg-[#F1F5F9] text-[#475569] px-2.5 py-1 rounded-full font-medium border border-[#E2E8F0]">
                          {idx + 2}{idx === 0 ? 'nd' : idx === 1 ? 'rd' : 'th'}: ₹{childPrice.toLocaleString('en-IN')}
                        </span>
                      ))}
                    </div>
                    {plan.extra_child_per_day > 0 && (
                      <p className="text-[10px] text-gray-400 mb-3">Per extra child/day: ₹{plan.extra_child_per_day}</p>
                    )}
                  </div>

                  {/* Button area */}
                  <div className="mt-auto px-5 pb-5 pt-2">
                    <button
                      data-testid={`buy-now-${dur}`}
                      onClick={(e) => { e.stopPropagation(); setSelectedDuration(dur); handleBuyNow(); }}
                      className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
                        isPopular
                          ? 'bg-[#FFD23F] text-[#1D3557] hover:bg-[#FFE066]'
                          : 'bg-[#06D6A0] text-white hover:bg-[#05C090]'
                      }`}
                    >
                      Buy Now
                    </button>
                  </div>

                  {/* Selected checkmark */}
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5">
                      <div className="w-6 h-6 bg-[#06D6A0] rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-4 mt-5 text-xs text-[#3D5A80]">
          <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Secure Payment</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Instant Access</span>
        </div>

        {/* School Enquiry CTA */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-3 bg-gradient-to-r from-[#1D3557] to-[#3D5A80] rounded-2xl px-8 py-4 shadow-lg">
            <School className="w-6 h-6 text-[#FFD23F]" />
            <div className="text-left">
              <p className="text-white font-bold text-sm" style={{ fontFamily: 'Fredoka' }}>Looking for a School Plan?</p>
              <p className="text-[#E0FBFC] text-xs">We offer special pricing for schools & institutions</p>
            </div>
            <button
              data-testid="school-enquiry-btn"
              onClick={() => setShowSchoolEnquiry(true)}
              className="ml-2 bg-[#FFD23F] text-[#1D3557] font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-[#FFE066] transition-colors shadow-md"
            >
              Enquire Now
            </button>
          </div>
        </div>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={handleCheckoutClose}>
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
                <span className="font-bold text-[#1D3557]">{currentPlan?.duration_label}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[#3D5A80]">Children</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      data-testid={`checkout-children-${n}`}
                      onClick={() => setNumChildren(n)}
                      className={`w-7 h-7 rounded-full font-bold text-xs transition-all ${
                        numChildren === n
                          ? 'bg-[#1D3557] text-white'
                          : 'bg-white text-[#1D3557] border border-[#1D3557]/20'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              {numChildren > 1 && (
                <div className="text-[10px] text-[#3D5A80] mb-1 space-y-0.5">
                  <div className="flex justify-between"><span>Base (1 child)</span><span>₹{(currentPlan?.base_price || 0).toLocaleString('en-IN')}</span></div>
                  {(currentPlan?.child_prices || []).slice(0, numChildren - 1).map((cp, i) => (
                    <div key={i} className="flex justify-between"><span>{i + 2}{i === 0 ? 'nd' : i === 1 ? 'rd' : 'th'} child</span><span>₹{cp.toLocaleString('en-IN')}</span></div>
                  ))}
                </div>
              )}
              <hr className="border-[#1D3557]/10 my-1.5" />
              <div className="flex justify-between font-bold text-[#1D3557]">
                <span>Total</span>
                <span>₹{totalPrice.toLocaleString('en-IN')}</span>
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

      {/* School Enquiry Dialog */}
      <Dialog open={showSchoolEnquiry} onOpenChange={setShowSchoolEnquiry}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1D3557] flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
              <School className="w-5 h-5 text-[#EE6C4D]" />
              School Subscription Enquiry
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-1 block">
                School Name <span className="text-red-500">*</span>
              </label>
              <Input
                data-testid="enquiry-school-name"
                placeholder="Enter school name"
                value={schoolForm.school_name}
                onChange={(e) => setSchoolForm(prev => ({ ...prev, school_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-1 block flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> City <span className="text-xs text-gray-400 font-normal">(optional)</span>
              </label>
              <Input
                data-testid="enquiry-city"
                placeholder="City"
                value={schoolForm.city}
                onChange={(e) => setSchoolForm(prev => ({ ...prev, city: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-1 block">
                Contact Person Name <span className="text-red-500">*</span>
              </label>
              <Input
                data-testid="enquiry-person-name"
                placeholder="Full name"
                value={schoolForm.person_name}
                onChange={(e) => setSchoolForm(prev => ({ ...prev, person_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-1 block flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5" /> Designation <span className="text-xs text-gray-400 font-normal">(optional)</span>
              </label>
              <Input
                data-testid="enquiry-designation"
                placeholder="e.g. Principal, Coordinator"
                value={schoolForm.designation}
                onChange={(e) => setSchoolForm(prev => ({ ...prev, designation: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-1 block flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> Contact Number <span className="text-red-500">*</span>
              </label>
              <Input
                data-testid="enquiry-phone"
                type="tel"
                placeholder="+91 9XXXXXXXXX"
                value={schoolForm.contact_number}
                onChange={(e) => setSchoolForm(prev => ({ ...prev, contact_number: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-1 block flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" /> Email <span className="text-red-500">*</span>
              </label>
              <Input
                data-testid="enquiry-email"
                type="email"
                placeholder="email@school.com"
                value={schoolForm.email}
                onChange={(e) => setSchoolForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-1 block">
                Grades Interested In <span className="text-xs text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="flex gap-2 mt-1">
                {[{ key: 'kindergarten', label: 'Kindergarten' }, { key: 'grade_1', label: 'Grade 1' }, { key: 'grade_2', label: 'Grade 2' }].map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    data-testid={`enquiry-grade-${key}`}
                    onClick={() => toggleGrade(key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                      schoolForm.grades.includes(key)
                        ? 'bg-[#1D3557] text-white border-[#1D3557]'
                        : 'bg-white text-[#1D3557] border-[#1D3557]/30 hover:border-[#1D3557]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              data-testid="submit-enquiry-btn"
              onClick={handleSchoolEnquiry}
              disabled={submittingEnquiry}
              className="w-full py-5 text-lg font-bold bg-[#EE6C4D] hover:bg-[#D95A3D] text-white rounded-xl"
            >
              {submittingEnquiry ? 'Submitting...' : 'Submit Enquiry'}
            </Button>
            <p className="text-xs text-center text-gray-500">
              Our team will get in touch with you within 24 hours.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
