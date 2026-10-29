/*
# Invite-only access + super admin

- Super admin: sourav.mukherjee@gdsolutions.in (promoted automatically once that email is confirmed)
- Only platform admins can create committees; they name the first Committee Admin by email
- Committee Admins invite their peers (invitations table); invites are claimed automatically
  when the invited person signs in with a CONFIRMED email address
- Uninvited users get no access (no committee, no ability to create one)

SECURITY NOTE: keep "Confirm email" ENABLED in Supabase Auth. Invitations and super-admin
promotion are bound to an email address, so that address must be verified.
*/

CREATE TABLE IF NOT EXISTS platform_admin_emails (email text PRIMARY KEY CHECK (email = lower(email)));
ALTER TABLE platform_admin_emails ENABLE ROW LEVEL SECURITY;   -- no policies, no grants: internal only
REVOKE ALL ON platform_admin_emails FROM authenticated, anon;
INSERT INTO platform_admin_emails (email) VALUES ('sourav.mukherjee@gdsolutions.in') ON CONFLICT DO NOTHING;

-- Promote immediately if that account already exists and is confirmed
INSERT INTO platform_admins (user_id)
SELECT id FROM auth.users
WHERE lower(email) = 'sourav.mukherjee@gdsolutions.in' AND email_confirmed_at IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id uuid NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'Volunteer'
    CHECK (role IN ('Committee Admin', 'Treasurer', 'Event Manager', 'Volunteer', 'Auditor/Viewer')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  invited_by uuid DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_invitations_pending
  ON invitations (committee_id, lower(email)) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations (lower(email));
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON invitations TO authenticated;

DROP POLICY IF EXISTS "select_invitations" ON invitations;
CREATE POLICY "select_invitations" ON invitations FOR SELECT TO authenticated USING (
  is_platform_admin() OR has_committee_role(committee_id, ARRAY['Committee Admin']));

DROP POLICY IF EXISTS "insert_invitations" ON invitations;
CREATE POLICY "insert_invitations" ON invitations FOR INSERT TO authenticated WITH CHECK (
  status = 'pending'
  AND (is_platform_admin() OR has_committee_role(committee_id, ARRAY['Committee Admin'])));

DROP POLICY IF EXISTS "update_invitations" ON invitations;
CREATE POLICY "update_invitations" ON invitations FOR UPDATE TO authenticated
  USING (is_platform_admin() OR has_committee_role(committee_id, ARRAY['Committee Admin']))
  WITH CHECK (status IN ('pending', 'revoked')
              AND (is_platform_admin() OR has_committee_role(committee_id, ARRAY['Committee Admin'])));

DROP TRIGGER IF EXISTS trg_audit_invitations ON invitations;
CREATE TRIGGER trg_audit_invitations AFTER INSERT OR UPDATE OR DELETE ON invitations
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- Claim pending invitations (and super-admin status) for the signed-in, email-confirmed user
CREATE OR REPLACE FUNCTION claim_invitations()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u_email text; confirmed timestamptz; meta_name text; inv record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  SELECT lower(email), email_confirmed_at, raw_user_meta_data->>'full_name'
    INTO u_email, confirmed, meta_name FROM auth.users WHERE id = auth.uid();
  IF u_email IS NULL OR confirmed IS NULL THEN RETURN; END IF;

  INSERT INTO profiles (id, full_name) VALUES (auth.uid(), COALESCE(meta_name, ''))
    ON CONFLICT (id) DO NOTHING;

  IF EXISTS (SELECT 1 FROM platform_admin_emails WHERE email = u_email) THEN
    INSERT INTO platform_admins (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  END IF;

  FOR inv IN SELECT * FROM invitations WHERE status = 'pending' AND lower(email) = u_email LOOP
    INSERT INTO committee_members (committee_id, user_id, role, status)
      VALUES (inv.committee_id, auth.uid(), inv.role, 'active')
      ON CONFLICT (committee_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active';
    UPDATE invitations SET status = 'accepted', accepted_at = now() WHERE id = inv.id;
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION claim_invitations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION claim_invitations() TO authenticated;

-- create_committee: platform admins only; the first Committee Admin is named by email
DROP FUNCTION IF EXISTS create_committee(text, text, text, text);
CREATE OR REPLACE FUNCTION create_committee(
  p_name text, p_admin_email text, p_description text DEFAULT NULL,
  p_city text DEFAULT NULL, p_state text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'Only platform administrators can create committees'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN RAISE EXCEPTION 'Committee name is required'; END IF;
  IF p_admin_email IS NULL OR position('@' in p_admin_email) = 0 THEN RAISE EXCEPTION 'A valid admin email is required'; END IF;

  INSERT INTO committees (name, description, city, state, created_by)
    VALUES (trim(p_name), p_description, p_city, p_state, auth.uid()) RETURNING id INTO new_id;
  INSERT INTO committee_subscriptions (committee_id) VALUES (new_id);
  INSERT INTO invitations (committee_id, email, role) VALUES (new_id, lower(trim(p_admin_email)), 'Committee Admin');
  RETURN new_id;
END $$;
REVOKE EXECUTE ON FUNCTION create_committee(text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_committee(text, text, text, text, text) TO authenticated;
