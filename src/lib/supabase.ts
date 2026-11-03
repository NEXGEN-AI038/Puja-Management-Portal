import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Read BEFORE the client starts: supabase-js strips the token from the URL once it has used it.
const linkParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.hash.replace(/^#\/?/, '') : '');
/** 'invite' | 'recovery' | 'signup' | … when the user arrived from an emailed link. */
export const initialAuthLinkType = linkParams.get('type');
/** Set when the emailed link was invalid or expired. */
export const initialAuthLinkError = linkParams.get('error_description')?.replace(/\+/g, ' ') ?? null;

/**
 * Where emailed links (confirm email, reset password, invitations) send people back to.
 * Defaults to the address the app is currently running on; set VITE_APP_URL to force a fixed address.
 */
export const APP_URL = (
  (import.meta.env.VITE_APP_URL as string | undefined) || (typeof window !== 'undefined' ? window.location.origin : '')
).replace(/\/$/, '');

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
