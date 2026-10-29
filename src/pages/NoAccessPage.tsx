import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Lock } from 'lucide-react';

export function NoAccessPage() {
  const { user, signOut, refreshCommittees } = useAuth();
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
          <Lock className="h-5 w-5 text-brand-700" />
        </div>
        <h1 className="mt-4 text-xl font-serif font-semibold text-stone-800">Access is by invitation</h1>
        <p className="mt-2 text-sm text-stone-500">
          {user?.email} isn&apos;t linked to any committee yet. Ask your committee administrator to invite this
          exact email address, then check again.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => window.location.reload()}>Check again</Button>
          <Button variant="ghost" onClick={signOut}>Sign out</Button>
        </div>
      </div>
    </div>
  );
}
