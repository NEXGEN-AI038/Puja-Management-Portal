import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { APP_URL, initialAuthLinkError } from '@/lib/supabase';
import { LoginCarousel } from '@/components/LoginCarousel';
import { Mail, Lock, AlertCircle, ArrowLeft } from 'lucide-react';

type Mode = 'signin' | 'signup' | 'forgot';

export function AuthPage() {
  const { refreshProfile, refreshCommittees } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    initialAuthLinkError ? `${initialAuthLinkError}. Use "Forgot password?" to get a fresh link, or ask your administrator to re-send your invitation.` : ''
  );
  const [info, setInfo] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName }, emailRedirectTo: APP_URL },
        });
        if (error) throw error;
        if (data.session && data.user) {
          await supabase.from('profiles').upsert({ id: data.user.id, full_name: fullName });
          setInfo('Account created. You are now signed in.');
          await refreshProfile();
          await refreshCommittees();
        } else if (data.user) {
          // Email confirmation is on: no session yet. The profile is created automatically at first sign-in.
          setInfo('Account created. Check your email and click the confirmation link, then come back here and sign in.');
          setMode('signin');
          setPassword('');
        }
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: APP_URL });
        if (error) throw error;
        setInfo('Password reset link sent to your email.');
        setMode('signin');
      }
    } catch (err: any) {
      if (mode === 'signin' && /invalid login credentials/i.test(err.message || '')) {
        setError('Incorrect email or password. If you were invited and have not created a password yet, use the link in your invitation email, or choose "Sign up" with the same email address you were invited on.');
      } else if (/email not confirmed/i.test(err.message || '')) {
        setError('Please confirm your email first — click the link in the confirmation email we sent you.');
      } else {
        setError(err.message || 'An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-brand-900 text-white">
      <LoginCarousel />

      <div className="relative z-10 flex flex-1 flex-col lg:flex-row">
        {/* Brand copy */}
        <div className="flex flex-1 flex-col justify-between p-8 lg:p-14">
          <div className="flex items-center gap-3">
            <img src="/logo-white.png" alt="GD Solutions logo" className="h-12 w-12 drop-shadow" />
            <div>
              <p className="font-serif text-lg font-semibold leading-tight">Festival Management Platform</p>
              <p className="text-xs text-brand-100">Designed by <a href="https://www.gdsolutions.in" target="_blank" rel="noopener noreferrer" className="font-medium text-gold-300 underline-offset-2 hover:underline">GD Solutions</a></p>
            </div>
          </div>

          <div className="my-10 max-w-xl">
            <h1 className="mb-4 font-serif text-3xl font-semibold leading-tight [text-shadow:0_2px_12px_rgba(0,0,0,0.45)] lg:text-5xl">
              Manage your community celebrations with confidence
            </h1>
            <p className="mb-6 text-sm leading-relaxed text-brand-50 [text-shadow:0_1px_8px_rgba(0,0,0,0.5)] lg:text-base">
              One platform for all your Pujas, festivals and community events. Track budgets, coordinate volunteers,
              manage vendors and keep your committee organised.
            </p>
            <ul className="space-y-2 text-sm text-brand-50 [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">
              {['Multi-committee support with role-based access', 'Configurable modules for every event type', 'Budget tracking, vendor management and task coordination'].map((t) => (
                <li key={t} className="flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full bg-gold-400" />{t}</li>
              ))}
            </ul>
          </div>

          <div className="hidden h-2 lg:block" />
        </div>

        {/* Form */}
        <div className="flex items-center justify-center p-6 lg:w-[34rem] lg:p-12">
          <div className="w-full max-w-sm rounded-2xl bg-white/95 p-8 text-stone-800 shadow-2xl backdrop-blur">
          {mode === 'forgot' && (
            <button
              onClick={() => { setMode('signin'); setError(''); setInfo(''); }}
              className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 mb-6 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </button>
          )}

          <h2 className="text-2xl font-semibold text-stone-800 mb-1">
            {mode === 'signin' && 'Welcome back'}
            {mode === 'signup' && 'Create your account'}
            {mode === 'forgot' && 'Reset your password'}
          </h2>
          <p className="text-sm text-stone-500 mb-8">
            {mode === 'signin' && 'Sign in to manage your committees and events.'}
            {mode === 'signup' && 'Start organising your community celebrations.'}
            {mode === 'forgot' && 'Enter your email and we will send you a reset link.'}
          </p>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {info && (
            <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{info}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <Input
                label="Full name"
                name="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                required
              />
            )}
            <Input
              label="Email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              icon={<Mail className="h-4 w-4" />}
              required
            />
            {mode !== 'forgot' && (
              <Input
                label="Password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                icon={<Lock className="h-4 w-4" />}
                required
                minLength={6}
              />
            )}

            {mode === 'signin' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(''); setInfo(''); }}
                  className="text-xs text-stone-500 hover:text-brand-600 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" loading={loading}>
              {mode === 'signin' && 'Sign in'}
              {mode === 'signup' && 'Create account'}
              {mode === 'forgot' && 'Send reset link'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-stone-500">
            {mode === 'signin' && (
              <>
                Don't have an account?{' '}
                <button onClick={() => { setMode('signup'); setError(''); setInfo(''); }} className="font-medium text-brand-600 hover:text-brand-700 transition-colors">
                  Sign up
                </button>
              </>
            )}
            {mode === 'signup' && (
              <>
                Already have an account?{' '}
                <button onClick={() => { setMode('signin'); setError(''); setInfo(''); }} className="font-medium text-brand-600 hover:text-brand-700 transition-colors">
                  Sign in
                </button>
              </>
            )}
          </div>
          </div>
        </div>
      </div>

      <footer className="relative z-10 px-8 py-4 pr-40 text-xs text-brand-100">
        <p>
          &copy; {new Date().getFullYear()} Festival Management Platform. Designed by <a href="https://www.gdsolutions.in" target="_blank" rel="noopener noreferrer" className="font-medium text-gold-300 underline-offset-2 hover:underline">GD Solutions</a>
          {' · '}<a href="https://www.gdsolutions.in" target="_blank" rel="noopener noreferrer" className="font-medium text-gold-300 underline-offset-2 hover:underline">www.gdsolutions.in</a>
        </p>
      </footer>
    </div>
  );
}
