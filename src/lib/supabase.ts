import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const envStatus = {
  urlSet: Boolean(supabaseUrl),
  urlValid: Boolean(supabaseUrl && /^https?:\/\//.test(supabaseUrl)),
  keySet: Boolean(supabaseAnonKey),
};

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && /^https?:\/\//.test(supabaseUrl)
);

// Fall back to inert placeholders so the app can render a setup screen instead of crashing.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl! : 'http://localhost:54321',
  isSupabaseConfigured ? supabaseAnonKey! : 'not-configured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: isSupabaseConfigured,
    },
  }
);
