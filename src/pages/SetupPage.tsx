import { Database } from 'lucide-react';
import { envStatus } from '@/lib/supabase';

export function SetupPage() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600">
          <Database className="h-5 w-5 text-white" />
        </div>
        <h1 className="mt-4 text-2xl font-serif font-semibold text-stone-800">Connect Supabase to get started</h1>
        <p className="mt-2 text-sm text-stone-500">
          This app needs a Supabase project. Complete these steps, then restart the dev server.
        </p>
        <ol className="mt-5 space-y-3 text-sm text-stone-700 list-decimal pl-5">
          <li>Create a project at supabase.com.</li>
          <li>
            In the SQL Editor, run the two files in <code className="rounded bg-stone-100 px-1">supabase/migrations</code>, in
            filename order.
          </li>
          <li>
            Copy <code className="rounded bg-stone-100 px-1">.env.example</code> to{' '}
            <code className="rounded bg-stone-100 px-1">.env</code> and fill in your Project URL and anon key
            (Project Settings → API).
          </li>
          <li>Stop and restart <code className="rounded bg-stone-100 px-1">npm run dev</code>.</li>
        </ol>
        <div className="mt-6 rounded-lg bg-stone-50 p-4 text-xs text-stone-600 space-y-1">
          <p className="font-medium text-stone-700">What the app can see right now</p>
          <p>VITE_SUPABASE_URL: {envStatus.urlSet ? (envStatus.urlValid ? 'found' : 'found but must start with https://') : 'NOT FOUND'}</p>
          <p>VITE_SUPABASE_ANON_KEY: {envStatus.keySet ? 'found' : 'NOT FOUND'}</p>
          <p className="pt-1 text-stone-500">
            If either says NOT FOUND: the file must be named exactly <code>.env</code> (not <code>.env.txt</code> or{' '}
            <code>.env.example</code>), sit next to <code>package.json</code>, use these exact names with no spaces or
            quotes around the values, and the dev server must be restarted.
          </p>
        </div>
      </div>
    </div>
  );
}
