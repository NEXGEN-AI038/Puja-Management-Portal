import { supabase } from '@/lib/supabase';
import { APP_URL } from '@/lib/supabase';

export type InviteResult =
  | { ok: true; mode: 'emailed' | 'existing' | 'saved'; message: string }
  | { ok: false; error: string };

/**
 * Invite someone to a committee. Uses the `invite-user` Edge Function (which emails a set-password link).
 * If the function has not been deployed yet, the invitation is still saved and the person can use "Sign up".
 */
export async function sendInvite(committeeId: string, email: string, role: string): Promise<InviteResult> {
  const clean = email.trim().toLowerCase();

  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: { committee_id: committeeId, email: clean, role, redirect_to: APP_URL },
  });

  if (!error && data?.status === 'invited') {
    return { ok: true, mode: 'emailed', message: `Invitation email sent to ${clean}. They will set a password from the link in that email.` };
  }
  if (!error && data?.status === 'existing') {
    return { ok: true, mode: 'existing', message: `${clean} already has an account. The committee will appear the next time they sign in.` };
  }

  // Real server-side refusals (permissions, validation) are shown as they are.
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === 'function' && ctx.status !== 404) {
    try {
      const body = await ctx.json();
      const msg: string = body?.message || 'Could not send the invitation.';
      if (/sending .*email|rate limit|not authorized|smtp/i.test(msg)) {
        return {
          ok: false,
          error: `The invitation was saved, but the email could not be sent (${msg}). Supabase's built-in email service only delivers to your own team members and is heavily rate-limited — connect a custom SMTP sender in Supabase (Project Settings → Authentication → SMTP Settings), then press "Invite admin" again to re-send.`,
        };
      }
      return { ok: false, error: msg };
    } catch { /* fall through to the fallback */ }
  }

  // Function not deployed / unreachable: save the invitation directly so nothing is lost.
  const { error: insErr } = await supabase.from('invitations').insert({ committee_id: committeeId, email: clean, role });
  if (insErr && insErr.code !== '23505') return { ok: false, error: insErr.message };
  return {
    ok: true,
    mode: 'saved',
    message: `Invitation saved, but the email service is not set up yet. Ask ${clean} to open the sign-in page, choose Sign up with this exact email, then confirm their email.`,
  };
}
