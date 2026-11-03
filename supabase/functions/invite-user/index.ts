// Supabase Edge Function: invite-user
//
// Creates (or re-sends) an invitation and emails the person a link to set their password.
// - The caller must be signed in. The invitation row is inserted AS THE CALLER, so the existing
//   Row Level Security rules decide who may invite whom (platform admins, or Committee Admins
//   for their own committee). Nobody can invite into a committee they don't administer.
// - The email itself is sent with the service-role key, which never leaves the server.
//
// Deploy:  supabase functions deploy invite-user
// (SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided automatically.)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ROLES = ['Committee Admin', 'Treasurer', 'Event Manager', 'Volunteer', 'Auditor/Viewer', 'Community Member'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ message: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ message: 'Not signed in' }, 401);

  let body: { committee_id?: string; email?: string; role?: string; redirect_to?: string };
  try { body = await req.json(); } catch { return json({ message: 'Invalid request' }, 400); }

  const email = (body.email ?? '').trim().toLowerCase();
  const role = body.role ?? 'Volunteer';
  if (!body.committee_id || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ message: 'A committee and a valid email are required' }, 400);
  if (!ROLES.includes(role)) return json({ message: 'Invalid role' }, 400);

  // 1. Record the invitation as the caller (RLS enforces who is allowed to do this).
  const { error: invErr } = await userClient.from('invitations').insert({ committee_id: body.committee_id, email, role });
  if (invErr && invErr.code !== '23505') {
    // 23505 = a pending invitation already exists: fine, we simply re-send the email.
    return json({ message: invErr.code === '42501' ? 'You are not allowed to invite people to this committee' : invErr.message }, invErr.code === '42501' ? 403 : 400);
  }

  // 2. Email the invite link (service role, server side only).
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error: mailErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: body.redirect_to });
  if (mailErr) {
    if (/already|registered|exists/i.test(mailErr.message)) return json({ status: 'existing' });
    return json({ message: mailErr.message }, 400);
  }
  return json({ status: 'invited' });
});
