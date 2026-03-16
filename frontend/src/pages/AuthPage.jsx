import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Eye, EyeOff, ArrowLeft, Mail, Lock, User, School, Shield,
  Sparkles, BookOpen, Coins, RefreshCw
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Generate a simple math captcha
const generateCaptcha = () => {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  const operators = ['+', '-'];
  const operator = operators[Math.floor(Math.random() * operators.length)];
  let answer;
  
  if (operator === '+') {
    answer = num1 + num2;
  } else {
    // Ensure positive result for subtraction
    const max = Math.max(num1, num2);
    const min = Math.min(num1, num2);
    answer = max - min;
    return { question: `${max} - ${min}`, answer };
  }
  
  return { question: `${num1} ${operator} ${num2}`, answer };
};

export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [identifier, setIdentifier] = useState(''); // email or username
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Captcha state
  const [captcha, setCaptcha] = useState(generateCaptcha());
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  
  // Regenerate captcha when switching to signup mode
  useEffect(() => {
    if (mode === 'signup') {
      setCaptcha(generateCaptcha());
      setCaptchaAnswer('');
    }
  }, [mode]);
  
  const refreshCaptcha = () => {
    setCaptcha(generateCaptcha());
    setCaptchaAnswer('');
  };

  const handleGoogleLogin = () => {
    window.location.href = `${BACKEND_URL}/api/auth/google/login`;
  };

  const handleCredentialsLogin = async (e) => {
    e.preventDefault();
    
    if (!identifier.trim() || !password.trim()) {
      toast.error('Please enter your credentials');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Try to determine login type based on identifier
      const isEmail = identifier.includes('@');
      
      // First try admin login if it looks like admin email
      if (isEmail && identifier.toLowerCase() === 'admin@learnersplanet.com') {
        const response = await axios.post(
          `${BACKEND_URL}/api/auth/admin-login`,
          { email: identifier, password },
          { withCredentials: true }
        );
        toast.success('Welcome back, Admin!');
        navigate('/admin');
        return;
      }
      
      // Try school login (username-based)
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
          // Not a school username, continue to try unified login
        }
      }
      
      // Try unified login (for users with password)
      const response = await axios.post(
        `${BACKEND_URL}/api/auth/login`,
        { identifier, password },
        { withCredentials: true }
      );
      
      const user = response.data.user;
      toast.success(`Welcome back, ${user.name}!`);
      
      // Redirect based on role
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'school') navigate('/school-dashboard');
      else if (user.role === 'teacher') navigate('/teacher-dashboard');
      else if (user.role === 'parent') navigate('/parent-dashboard');
      else navigate('/dashboard');
      
    } catch (error) {
      const message = error.response?.data?.detail || 'Invalid credentials';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    
    if (!name.trim() || !identifier.trim() || !password.trim()) {
      toast.error('Please fill all fields');
      return;
    }
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    // Validate captcha
    if (parseInt(captchaAnswer) !== captcha.answer) {
      toast.error('Incorrect captcha answer. Please try again.');
      refreshCaptcha();
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/auth/signup`,
        { 
          name,
          email: identifier,
          password 
        },
        { withCredentials: true }
      );
      
      toast.success('Account created! Please sign in.');
      setMode('login');
      setPassword('');
      setConfirmPassword('');
      setName('');
      setCaptchaAnswer('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create account');
      refreshCaptcha();
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
        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-white/70 hover:text-white mb-6 transition-colors"
          data-testid="back-to-landing-btn"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Home</span>
        </button>
        
        {/* Auth Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#FFD23F] to-[#FFEB99] p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-3 bg-white rounded-2xl flex items-center justify-center shadow-lg border-3 border-[#1D3557]">
              <Coins className="w-8 h-8 text-[#1D3557]" />
            </div>
            <h1 className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              {mode === 'login' ? 'Welcome Back!' : 'Join CoinQuest!'}
            </h1>
            <p className="text-[#1D3557]/70 mt-1">
              {mode === 'login' ? 'Sign in to continue your journey' : 'Create your account'}
            </p>
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
            
            {/* Divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white text-gray-500">or</span>
              </div>
            </div>
            
            {/* Credentials Form */}
            <form onSubmit={mode === 'login' ? handleCredentialsLogin : handleSignup} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="pl-10 h-12 border-2 border-gray-200 focus:border-[#1D3557] rounded-xl"
                      data-testid="signup-name-input"
                    />
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {mode === 'login' ? 'Email or Username' : 'Email Address'}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={mode === 'login' ? "email@example.com or username" : "email@example.com"}
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
              
              {mode === 'signup' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-10 h-12 border-2 border-gray-200 focus:border-[#1D3557] rounded-xl"
                      data-testid="auth-confirm-password-input"
                    />
                  </div>
                </div>
              )}
              
              {/* Captcha for signup */}
              {mode === 'signup' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Verify you're human
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-[#E0FBFC] to-[#F0F9FF] rounded-xl border-2 border-[#1D3557]/20">
                      <Shield className="w-5 h-5 text-[#1D3557]" />
                      <span className="text-lg font-bold text-[#1D3557]">
                        {captcha.question} = ?
                      </span>
                      <button
                        type="button"
                        onClick={refreshCaptcha}
                        className="ml-auto p-1 text-[#3D5A80] hover:text-[#1D3557] transition-colors"
                        title="Get new question"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                    <Input
                      type="number"
                      value={captchaAnswer}
                      onChange={(e) => setCaptchaAnswer(e.target.value)}
                      placeholder="?"
                      className="w-20 h-12 text-center text-lg font-bold border-2 border-[#1D3557]/30 focus:border-[#1D3557] rounded-xl"
                      data-testid="auth-captcha-input"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Solve the math problem above</p>
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
                    <span>{mode === 'login' ? 'Signing in...' : 'Creating account...'}</span>
                  </div>
                ) : (
                  mode === 'login' ? 'Sign In' : 'Create Account'
                )}
              </Button>
            </form>
            
            {/* Login Type Hints */}
            {mode === 'login' && (
              <div className="mt-4 p-3 bg-[#E0FBFC] rounded-xl">
                <p className="text-xs text-[#3D5A80] text-center">
                  <span className="font-medium">Tip:</span> Use your email for user accounts, 
                  or username for school portals
                </p>
              </div>
            )}
            
            {/* Toggle Mode */}
            <div className="mt-6 text-center">
              <p className="text-gray-600">
                {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
                <button
                  onClick={() => {
                    setMode(mode === 'login' ? 'signup' : 'login');
                    setPassword('');
                    setConfirmPassword('');
                  }}
                  className="ml-2 font-semibold text-[#1D3557] hover:underline"
                  data-testid="toggle-auth-mode-btn"
                >
                  {mode === 'login' ? 'Sign Up' : 'Sign In'}
                </button>
              </p>
            </div>
          </div>
        </div>
        
        {/* CoinQuest Branding */}
        <div className="text-center mt-6">
          <p className="text-white/60 text-sm">
            <Sparkles className="w-4 h-4 inline mr-1" />
            Learn money skills the fun way!
          </p>
        </div>
      </div>
    </div>
  );
}
