import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Eye, EyeOff, ArrowLeft, Mail, Lock, UserPlus,
  Sparkles, Coins, X, AlertCircle
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PricingSection from '@/components/PricingSection';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function AuthPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [noAccount, setNoAccount] = useState(false);
  const [showSubscriptionPopup, setShowSubscriptionPopup] = useState(false);
  const [subscriptionMessage, setSubscriptionMessage] = useState('');

  // Pre-fill the remembered identifier (email/username) to reduce login friction
  useEffect(() => {
    const saved = localStorage.getItem('remembered_identifier');
    if (saved) {
      setIdentifier(saved);
      setRememberMe(true);
    }
  }, []);

  const handleGoogleLogin = () => {
    window.location.href = `${BACKEND_URL}/api/auth/google/login`;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setNoAccount(false);

    if (!identifier.trim() || !password.trim()) {
      toast.error('Please enter your credentials');
      return;
    }

    setIsLoading(true);

    // Remember (or forget) the identifier for next time — never store the password
    if (rememberMe) {
      localStorage.setItem('remembered_identifier', identifier.trim());
    } else {
      localStorage.removeItem('remembered_identifier');
    }

    try {
      const isEmail = identifier.includes('@');

      if (isEmail && identifier.toLowerCase() === 'admin@learnersplanet.com') {
        await axios.post(
          `${BACKEND_URL}/api/auth/admin-login`,
          { email: identifier, password },
          { withCredentials: true }
        );
        toast.success('Welcome back, Admin!');
        navigate('/admin');
        return;
      }

      // School portals log in with a username
      if (!isEmail) {
        try {
          const response = await axios.post(
            `${BACKEND_URL}/api/auth/school-login`,
            { username: identifier, password },
            { withCredentials: true }
          );
          toast.success('School login successful!');
          navigate('/school-dashboard', { state: { school: response.data.school } });
          return;
        } catch (schoolError) {
          // Not a school username — fall through to unified login
        }
      }

      const response = await axios.post(
        `${BACKEND_URL}/api/auth/login`,
        { identifier, password },
        { withCredentials: true }
      );

      const user = response.data.user;
      toast.success(`Welcome back, ${user.name}!`);

      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'school') navigate('/school-dashboard');
      else if (user.role === 'teacher') navigate('/teacher-dashboard');
      else if (user.role === 'parent') navigate('/parent-dashboard');
      else navigate('/dashboard');

    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.detail || 'Invalid credentials';
      if (status === 404) {
        // The identifier has no account at all — guide them to Register
        setNoAccount(true);
      } else if (status === 403) {
        setSubscriptionMessage(message);
        setShowSubscriptionPopup(true);
      } else {
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1D3557] via-[#2A4A6B] to-[#3D5A80] flex items-center justify-center p-4">
      {/* Background Decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-72 h-72 bg-[#FFD23F]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#06D6A0]/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/4 w-48 h-48 bg-[#EE6C4D]/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-white/70 hover:text-white mb-6 transition-colors"
          data-testid="back-to-landing-btn"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Home</span>
        </button>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-[#FFD23F] to-[#FFEB99] p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-3 bg-white rounded-2xl flex items-center justify-center shadow-lg border-3 border-[#1D3557]">
              <Coins className="w-8 h-8 text-[#1D3557]" />
            </div>
            <h1 className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              Welcome Back!
            </h1>
            <p className="text-[#1D3557]/70 mt-1">Login to continue your journey</p>
          </div>

          <div className="p-6">
            {/* Google SSO Button */}
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all mb-4"
              data-testid="google-signin-btn"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="font-medium text-gray-700">Continue with Google</span>
            </button>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white text-gray-500">or</span>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Email or Username
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="text"
                    value={identifier}
                    onChange={(e) => { setIdentifier(e.target.value); setNoAccount(false); }}
                    placeholder="email@example.com or username"
                    className="pl-10 h-12 border-2 border-gray-200 focus:border-[#1D3557] rounded-xl"
                    data-testid="auth-identifier-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 pr-10 h-12 border-2 border-gray-200 focus:border-[#1D3557] rounded-xl"
                    data-testid="auth-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none" data-testid="remember-me-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-2 border-gray-300 cursor-pointer accent-[#1D3557]"
                  data-testid="remember-me-checkbox"
                />
                <span className="text-sm font-medium text-gray-600">Remember me</span>
              </label>

              {/* No account found — route the user into the Register flow */}
              {noAccount && (
                <div className="rounded-xl border-2 border-[#EE6C4D]/40 bg-[#FFF3E0] p-4" data-testid="no-account-alert">
                  <div className="flex gap-2.5">
                    <AlertCircle className="w-5 h-5 text-[#EE6C4D] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-[#1D3557] text-sm">You don&apos;t have an account yet</p>
                      <p className="text-sm text-[#3D5A80] mt-1">
                        We couldn&apos;t find an account for <span className="font-semibold">{identifier}</span>.
                        Register by choosing a plan — it only takes a couple of minutes.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => navigate('/register')}
                    className="w-full mt-3 h-11 bg-[#EE6C4D] hover:bg-[#D85B3D] text-white font-bold rounded-xl"
                    data-testid="no-account-register-btn"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Register now
                  </Button>
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-[#1D3557] hover:bg-[#2A4A6B] text-white font-semibold rounded-xl shadow-md transition-all"
                data-testid="auth-submit-btn"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Logging in...</span>
                  </div>
                ) : 'Login'}
              </Button>
            </form>

            <div className="mt-4 p-3 bg-[#E0FBFC] rounded-xl">
              <p className="text-xs text-[#3D5A80] text-center">
                <span className="font-medium">Tip:</span> Use your email for parent, child & teacher accounts,
                or your username for school portals
              </p>
            </div>

            <div className="mt-6 text-center">
              <p className="text-gray-600">
                New to CoinQuest?
                <button
                  onClick={() => navigate('/register')}
                  className="ml-2 font-semibold text-[#1D3557] hover:underline"
                  data-testid="go-to-register-btn"
                >
                  Register
                </button>
              </p>
            </div>
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-white/60 text-sm">
            <Sparkles className="w-4 h-4 inline mr-1" />
            Learn money skills the fun way!
          </p>
        </div>
      </div>

      {/* Subscription Required Popup */}
      {showSubscriptionPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" data-testid="subscription-popup-overlay">
          <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto relative shadow-2xl">
            <div className="sticky top-0 z-10 bg-gradient-to-r from-[#EE6C4D] to-[#FF8A6C] px-6 py-4 rounded-t-3xl flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Fredoka' }}>
                  Subscription Required
                </h2>
                <p className="text-white/90 text-sm mt-0.5">{subscriptionMessage}</p>
              </div>
              <button
                onClick={() => setShowSubscriptionPopup(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                data-testid="close-subscription-popup"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="p-2">
              <PricingSection />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
