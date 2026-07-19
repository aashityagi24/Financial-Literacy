import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Lock, Mail, User, Phone, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Post-payment auto-sign-in / signup page.
 *
 * Landing conditions (all reached via `/complete-signup?order_id=…` after
 * Razorpay verify-payment succeeds):
 *   1. `new`                  → user completes name + phone + password → /auth/signup → session issued
 *   2. `exists_no_password`   → user (Google-only) sets a password → /auth/signup → password attached + session issued
 *   3. `exists_with_password` → user just enters their password → /auth/login → session issued
 *
 * Every path ends in a session_token being stored in localStorage and the
 * user landing on /parent-dashboard.
 */
export default function CompleteSignupPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const orderId = params.get('order_id');

  const [ctx, setCtx] = useState(null); // { email, name, phone, account_status }
  const [loadingCtx, setLoadingCtx] = useState(true);
  const [form, setForm] = useState({ name: '', phone: '', password: '', confirm: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!orderId) {
      toast.error('Missing order reference');
      navigate('/');
      return;
    }
    (async () => {
      try {
        const { data } = await axios.get(`${API}/subscriptions/post-payment-context?order_id=${orderId}`);
        setCtx(data);
        setForm(f => ({ ...f, name: data.name || '', phone: data.phone || '' }));
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Could not verify your payment. Please try signing in.');
        navigate('/login');
      } finally {
        setLoadingCtx(false);
      }
    })();
  }, [orderId, navigate]);

  const storeSessionAndGo = (session_token, user) => {
    localStorage.setItem('session_token', session_token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${session_token}`;
    toast.success(`Welcome, ${user?.name || 'friend'}! 🎉`);
    // Small delay so the toast is visible before the route swap
    setTimeout(() => navigate('/parent-dashboard'), 600);
  };

  const submit = async () => {
    if (!form.password || form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (ctx.account_status !== 'exists_with_password' && form.password !== form.confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setSubmitting(true);
    try {
      if (ctx.account_status === 'exists_with_password') {
        // Just sign in
        const { data } = await axios.post(`${API}/auth/login`, {
          identifier: ctx.email,
          password: form.password,
        });
        storeSessionAndGo(data.session_token, data.user);
      } else {
        // Create account (or attach password to Google-only account)
        const { data } = await axios.post(`${API}/auth/signup`, {
          email: ctx.email,
          name: form.name || ctx.name,
          phone: form.phone || ctx.phone,
          password: form.password,
        });
        storeSessionAndGo(data.session_token, data.user);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not complete sign-in');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingCtx) {
    return (
      <div className="min-h-screen bg-[#F1FAEE] flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-[#1D3557]">
          <Loader2 className="w-5 h-5 animate-spin" />
          Confirming your payment…
        </div>
      </div>
    );
  }

  if (!ctx) return null;

  const isNew = ctx.account_status === 'new';
  const isAttach = ctx.account_status === 'exists_no_password';
  const isSignin = ctx.account_status === 'exists_with_password';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E0FBFC] via-[#F1FAEE] to-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-3xl border-3 border-[#1D3557] shadow-xl p-8" data-testid="complete-signup-card">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#06D6A0]/20 text-[#06D6A0] mb-3">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
            Payment received!
          </h1>
          <p className="text-sm text-[#3D5A80] mt-1 flex items-center justify-center gap-1">
            <Sparkles className="w-4 h-4" />
            {isSignin ? 'Welcome back — sign in to continue' : isAttach ? 'One quick step to secure your account' : 'Let’s set up your account'}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[#E0FBFC] text-sm text-[#1D3557]">
            <Mail className="w-4 h-4" />
            <span className="font-medium">{ctx.email}</span>
          </div>

          {isNew && (
            <>
              <div>
                <label className="block text-xs font-medium text-[#1D3557] mb-1">Your Name</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    className="pl-9 border-3 border-[#1D3557]"
                    placeholder="Full name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    data-testid="complete-signup-name"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#1D3557] mb-1">Mobile</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    className="pl-9 border-3 border-[#1D3557]"
                    placeholder="10-digit mobile"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    data-testid="complete-signup-phone"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-[#1D3557] mb-1">
              {isSignin ? 'Your Password' : 'Choose a Password'}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="password"
                className="pl-9 border-3 border-[#1D3557]"
                placeholder={isSignin ? 'Enter your existing password' : 'Minimum 6 characters'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                data-testid="complete-signup-password"
              />
            </div>
          </div>

          {!isSignin && (
            <div>
              <label className="block text-xs font-medium text-[#1D3557] mb-1">Confirm Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  type="password"
                  className="pl-9 border-3 border-[#1D3557]"
                  placeholder="Re-enter password"
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  data-testid="complete-signup-confirm"
                />
              </div>
            </div>
          )}

          <Button
            onClick={submit}
            disabled={submitting}
            className="w-full bg-[#1D3557] hover:bg-[#1D3557]/90 text-white py-3 rounded-xl font-bold"
            data-testid="complete-signup-submit"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {isSignin ? 'Sign In & Continue' : isAttach ? 'Set Password & Continue' : 'Create Account & Continue'}
          </Button>

          {isSignin && (
            <p className="text-xs text-center text-[#3D5A80]">
              Forgot your password? <a href="/forgot-password" className="underline font-medium">Reset it</a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
