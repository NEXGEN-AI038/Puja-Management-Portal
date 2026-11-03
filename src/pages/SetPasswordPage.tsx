import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoginCarousel } from '@/components/LoginCarousel';
import { Lock } from 'lucide-react';

export function SetPasswordPage() {
  const { passwordSetup, completePasswordSetup, user } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const invite = passwordSetup === 'invite';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    window.location.hash = '/';
    completePasswordSetup();
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-900 p-6">
      <LoginCarousel />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white/95 p-8 text-stone-800 shadow-2xl backdrop-blur">
        <img src="/logo-green.png" alt="GD Solutions logo" className="mb-4 h-12 w-12" />
        <h1 className="text-xl font-semibold">{invite ? 'Welcome — set your password' : 'Choose a new password'}</h1>
        <p className="mt-1 text-sm text-stone-500">
          {invite ? 'Create a password to finish setting up your account' : 'Enter a new password for your account'}
          {user?.email ? <> (<span className="font-medium">{user.email}</span>)</> : null}.
        </p>
        {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <form onSubmit={submit} className="mt-5 space-y-4">
          <Input label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} icon={<Lock className="h-4 w-4" />} placeholder="At least 8 characters" />
          <Input label="Confirm password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} icon={<Lock className="h-4 w-4" />} />
          <Button type="submit" loading={loading} className="w-full">{invite ? 'Save password & continue' : 'Update password'}</Button>
        </form>
      </div>
    </div>
  );
}
