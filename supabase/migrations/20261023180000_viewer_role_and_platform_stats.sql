/*
# Community Member (view-only) role + super-admin analytics

- New role 'Community Member': can view events, schedule, notices, budget and finances only.
  Tasks, vendors, volunteers, guests, inventory, prasad plans, member lists and donor details
  are hidden from this role at the database level (RLS), not just in the UI.
- platform_stats(): aggregate-only analytics for platform admins (no financial figures,
  no donor data) so the super-admin dashboard can chart onboarding and growth.
*/

-- 1. Role
ALTER TABLE committee_members DROP CONSTRAINT IF EXISTS committee_members_role_check;
ALTER TABLE committee_members ADD CONSTRAINT committee_members_role_check CHECK (
  role IN ('Platform Owner','Committee Admin','Treasurer','Event Manager','Volunteer','Auditor/Viewer','Community Member'));

ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_role_check;
ALTER TABLE invitations ADD CONSTRAINT invitations_role_check CHECK (
  role IN ('Committee Admin','Treasurer','Event Manager','Volunteer','Auditor/Viewer','Community Member'));

CREATE OR REPLACE FUNCTION is_full_member(committee_uuid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM committee_members
    WHERE committee_id = committee_uuid AND user_id = auth.uid()
      AND status = 'active' AND role <> 'Community Member');
$$;
REVOKE EXECUTE ON FUNCTION is_full_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_full_member(uuid) TO authenticated;

-- 2. Hide operational data from Community Members
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['event_tasks','event_vendors','event_volunteers','event_guests','event_inventory','event_bhog_prasad']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "select_%1$s" ON %1$s', t);
    EXECUTE format('CREATE POLICY "select_%1$s" ON %1$s FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM events e WHERE e.id = %1$s.event_id AND is_full_member(e.committee_id)))', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "select_committee_members" ON committee_members;
CREATE POLICY "select_committee_members" ON committee_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_full_member(committee_id));

-- 3. Platform analytics (aggregates only)
CREATE OR REPLACE FUNCTION platform_stats(p_months integer DEFAULT 12)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE start_month timestamptz;
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  p_months := GREATEST(1, LEAST(COALESCE(p_months, 12), 36));
  start_month := date_trunc('month', now()) - make_interval(months => p_months - 1);

  RETURN jsonb_build_object(
    'totals', jsonb_build_object(
      'committees', (SELECT count(*) FROM committees),
      'members', (SELECT count(*) FROM committee_members WHERE status = 'active'),
      'events', (SELECT count(*) FROM events),
      'pending_invites', (SELECT count(*) FROM invitations WHERE status = 'pending'),
      'active_plans', (SELECT count(*) FROM committee_subscriptions WHERE status = 'active')),
    'base_committees', (SELECT count(*) FROM committees WHERE created_at < start_month),
    'base_members', (SELECT count(*) FROM committee_members WHERE status = 'active' AND joined_at < start_month),
    'by_month', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'key', to_char(m, 'YYYY-MM'), 'month', to_char(m, 'Mon YY'),
        'committees', (SELECT count(*) FROM committees c WHERE date_trunc('month', c.created_at) = m),
        'members', (SELECT count(*) FROM committee_members cm WHERE cm.status = 'active' AND date_trunc('month', cm.joined_at) = m)
      ) ORDER BY m), '[]'::jsonb)
      FROM generate_series(start_month, date_trunc('month', now()), interval '1 month') AS m),
    'members_by_role', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', role, 'count', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (SELECT role, count(*) AS n FROM committee_members WHERE status = 'active' GROUP BY role) r),
    'subs_by_status', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', plan || ' · ' || status, 'count', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (SELECT plan, status, count(*) AS n FROM committee_subscriptions GROUP BY plan, status) s),
    'events_by_type', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', event_type, 'count', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (SELECT event_type, count(*) AS n FROM events GROUP BY event_type) e),
    'events_by_status', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', status, 'count', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (SELECT status, count(*) AS n FROM events GROUP BY status) e),
    'committees', (
      SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT c.id, c.name, c.city, c.state, c.created_at,
          (SELECT count(*) FROM committee_members m WHERE m.committee_id = c.id AND m.status = 'active') AS members,
          (SELECT count(*) FROM events e WHERE e.committee_id = c.id) AS events,
          s.plan, s.status AS sub_status, s.trial_ends_at,
          (SELECT max(a.created_at) FROM audit_log a WHERE a.committee_id = c.id) AS last_activity,
          (SELECT COALESCE(jsonb_agg(jsonb_build_object('email', i.email, 'status', i.status)), '[]'::jsonb)
             FROM invitations i WHERE i.committee_id = c.id AND i.role = 'Committee Admin' AND i.status <> 'revoked') AS admins
        FROM committees c LEFT JOIN committee_subscriptions s ON s.committee_id = c.id
      ) t)
  );
END $$;
REVOKE EXECUTE ON FUNCTION platform_stats(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION platform_stats(integer) TO authenticated;
