import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, KeyRound, ListChecks, LogIn } from 'lucide-react';
import PricingSection from '@/components/PricingSection';
import { trackMetaPixelPageView } from '@/utils/metaPixel';

const STEPS = [
  { icon: ListChecks, title: 'Choose a plan', text: 'Pick the duration and number of children' },
  { icon: CreditCard, title: 'Pay securely', text: 'Razorpay — cards, UPI, netbanking' },
  { icon: KeyRound, title: 'Set your password', text: 'Your account is created instantly' },
];

export default function RegisterPage() {
  const navigate = useNavigate();

  useEffect(() => {
    trackMetaPixelPageView();
  }, []);

  return (
    <div className="min-h-screen bg-[#FDF6E3]" data-testid="register-page">
      <div className="bg-gradient-to-br from-[#1D3557] via-[#2A4A6B] to-[#3D5A80] pb-14 pt-6">
        <div className="container mx-auto px-5 sm:px-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
            data-testid="register-back-home-btn"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Home</span>
          </button>

          <div className="mt-8 max-w-3xl">
            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight" style={{ fontFamily: 'Fredoka' }}>
              Create your CoinQuest account
            </h1>
            <p className="text-base md:text-lg text-[#E0FBFC] mt-4 max-w-xl">
              Registration takes under two minutes. Choose a plan below — your account is created right
              after payment, and you&apos;ll set your own password on the next screen.
            </p>
          </div>

          <div className="mt-10 grid sm:grid-cols-3 gap-4 max-w-4xl">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5"
                data-testid={`register-step-${i + 1}`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-8 h-8 rounded-xl bg-[#FFD23F] text-[#1D3557] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <step.icon className="w-5 h-5 text-[#FFD23F]" />
                </div>
                <p className="font-bold text-white">{step.title}</p>
                <p className="text-sm text-[#E0FBFC]/80 mt-1">{step.text}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate('/login')}
            className="mt-9 inline-flex items-center gap-2 text-[#FFD23F] hover:text-white font-semibold transition-colors"
            data-testid="register-go-to-login-btn"
          >
            <LogIn className="w-4 h-4" />
            Already registered? Login instead
          </button>
        </div>
      </div>

      <PricingSection />

      <div className="pb-16 text-center px-5">
        <p className="text-sm text-[#3D5A80]">
          Already have an account?{' '}
          <button
            onClick={() => navigate('/login')}
            className="font-bold text-[#1D3557] underline"
            data-testid="register-footer-login-link"
          >
            Login
          </button>
        </p>
      </div>
    </div>
  );
}
