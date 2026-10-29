/*
# Phase 2 — Onboarding fix, platform admin, audit trail, finance hardening, subscriptions

## Fixes
- Committee creation was blocked by RLS (creator could not add themselves as the first admin).
  Replaced with an atomic SECURITY DEFINER function: create_committee().
- Committee Admins could previously assign the 'Platform Owner' role. Now only platform admins can.

## New
- platform_admins, is_platform_admin()
- audit_log (insert-only via trigger; readable by Committee Admin, Treasurer, Auditor)
- event_finance: payment method, reference no., void instead of delete, gateway-ready columns
- event_budgets, event_contributions (donations + sponsorships)
- committee_subscriptions (plan, status, trial, limits)
- event_modules now accepts 'budget' and 'donations'
*/

-- ============================================================
-- 1. PLATFORM ADMINS
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON platform_admins TO authenticated;

DROP POLICY IF EXISTS "select_own_platform_admin" ON platform_admins;
CREATE POLICY "select_own_platform_admin" ON platform_admins FOR SELECT
  TO authenticated USING (user_id = auth.uid());
-- No client write policies: platform admins are added via SQL / service role only.

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_platform_admin() TO authenticated;

-- ============================================================
-- 2. SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS committee_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id uuid NOT NULL UNIQUE REFERENCES committees(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial', 'starter', 'standard', 'premium')),
  status text NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled')),
  trial_ends_at timestamptz DEFAULT (now() + interval '30 days'),
  current_period_end timestamptz,
  max_events integer,
  max_members integer,
  provider text,
  provider_subscription_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE committee_subscriptions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON committee_subscriptions TO authenticated;

DROP POLICY IF EXISTS "select_subscriptions" ON committee_subscriptions;
CREATE POLICY "select_subscriptions" ON committee_subscriptions FOR SELECT
  TO authenticated USING (is_committee_member(committee_id) OR is_platform_admin());

DROP POLICY IF EXISTS "platform_manage_subscriptions" ON committee_subscriptions;
CREATE POLICY "platform_manage_subscriptions" ON committee_subscriptions FOR ALL
  TO authenticated USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- ============================================================
-- 3. ATOMIC COMMITTEE CREATION (fixes onboarding)
-- ============================================================
CREATE OR REPLACE FUNCTION create_committee(
  p_name text, p_description text DEFAULT NULL, p_city text DEFAULT NULL, p_state text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN RAISE EXCEPTION 'Committee name is required'; END IF;

  INSERT INTO committees (name, description, city, state, created_by)
  VALUES (trim(p_name), p_description, p_city, p_state, auth.uid())
  RETURNING id INTO new_id;

  INSERT INTO committee_members (committee_id, user_id, role, status)
  VALUES (new_id, auth.uid(), 'Committee Admin', 'active');

  INSERT INTO committee_subscriptions (committee_id) VALUES (new_id);
  RETURN new_id;
END $$;
REVOKE EXECUTE ON FUNCTION create_committee(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_committee(text, text, text, text) TO authenticated;

-- Direct inserts no longer allowed; committees are created only through create_committee().
DROP POLICY IF EXISTS "insert_committees" ON committees;

DROP POLICY IF EXISTS "select_committees" ON committees;
CREATE POLICY "select_committees" ON committees FOR SELECT
  TO authenticated USING (is_committee_member(id) OR is_platform_admin());

-- ============================================================
-- 4. ROLE-ESCALATION FIX ON committee_members
-- ============================================================
DROP POLICY IF EXISTS "insert_committee_members" ON committee_members;
CREATE POLICY "insert_committee_members" ON committee_members FOR INSERT
  TO authenticated WITH CHECK (
    has_committee_role(committee_id, ARRAY['Platform Owner', 'Committee Admin'])
    AND (role <> 'Platform Owner' OR is_platform_admin())
  );

DROP POLICY IF EXISTS "update_committee_members" ON committee_members;
CREATE POLICY "update_committee_members" ON committee_members FOR UPDATE
  TO authenticated USING (has_committee_role(committee_id, ARRAY['Platform Owner', 'Committee Admin']))
  WITH CHECK (
    has_committee_role(committee_id, ARRAY['Platform Owner', 'Committee Admin'])
    AND (role <> 'Platform Owner' OR is_platform_admin())
  );

-- ============================================================
-- 5. EVENT MODULES — add budget + donations
-- ============================================================
ALTER TABLE event_modules DROP CONSTRAINT IF EXISTS event_modules_module_key_check;
ALTER TABLE event_modules ADD CONSTRAINT event_modules_module_key_check CHECK (
  module_key IN ('finance','vendors','schedule','tasks','volunteers','guest_management',
                 'bhog_prasad','inventory','notices','budget','donations')
);

-- ============================================================
-- 6. FINANCE HARDENING (manual cash/bank/UPI now, gateway-ready)
-- ============================================================
ALTER TABLE event_finance
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash', 'bank', 'upi', 'cheque', 'online', 'other')),
  ADD COLUMN IF NOT EXISTS reference_no text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'void')),
  ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_payment_id text;

ALTER TABLE event_finance DROP CONSTRAINT IF EXISTS event_finance_amount_positive;
ALTER TABLE event_finance ADD CONSTRAINT event_finance_amount_positive CHECK (amount > 0);

-- Financial records are never hard-deleted; they are voided (and audited).
DROP POLICY IF EXISTS "delete_event_finance" ON event_finance;
REVOKE DELETE ON event_finance FROM authenticated;

-- ============================================================
-- 7. BUDGETS
-- ============================================================
CREATE TABLE IF NOT EXISTS event_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category text NOT NULL,
  planned_amount numeric(12,2) NOT NULL CHECK (planned_amount >= 0),
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (event_id, category)
);
CREATE INDEX IF NOT EXISTS idx_event_budgets_event ON event_budgets(event_id);
ALTER TABLE event_budgets ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_budgets TO authenticated;

CREATE POLICY "select_event_budgets" ON event_budgets FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM events e WHERE e.id = event_budgets.event_id AND is_committee_member(e.committee_id)));
CREATE POLICY "insert_event_budgets" ON event_budgets FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM events e WHERE e.id = event_budgets.event_id
          AND has_committee_role(e.committee_id, ARRAY['Platform Owner','Committee Admin','Treasurer'])));
CREATE POLICY "update_event_budgets" ON event_budgets FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM events e WHERE e.id = event_budgets.event_id
          AND has_committee_role(e.committee_id, ARRAY['Platform Owner','Committee Admin','Treasurer'])))
  WITH CHECK (
  EXISTS (SELECT 1 FROM events e WHERE e.id = event_budgets.event_id
          AND has_committee_role(e.committee_id, ARRAY['Platform Owner','Committee Admin','Treasurer'])));
CREATE POLICY "delete_event_budgets" ON event_budgets FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM events e WHERE e.id = event_budgets.event_id
          AND has_committee_role(e.committee_id, ARRAY['Platform Owner','Committee Admin','Treasurer'])));

-- ============================================================
-- 8. DONATIONS & SPONSORSHIPS
-- ============================================================
CREATE TABLE IF NOT EXISTS event_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'donation' CHECK (kind IN ('donation', 'sponsorship')),
  contributor_name text NOT NULL,
  phone text,
  email text,
  address text,
  sponsor_tier text,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('pledged', 'received', 'void')),
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','bank','upi','cheque','online','other')),
  reference_no text,
  receipt_no text,
  received_on date DEFAULT CURRENT_DATE,
  notes text,
  finance_id uuid REFERENCES event_finance(id),
  provider text,
  provider_payment_id text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_contributions_event ON event_contributions(event_id);
ALTER TABLE event_contributions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON event_contributions TO authenticated;  -- no DELETE: void instead

-- Donor personal details: visible to finance-facing roles only.
CREATE POLICY "select_event_contributions" ON event_contributions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM events e WHERE e.id = event_contributions.event_id
          AND has_committee_role(e.committee_id, ARRAY['Platform Owner','Committee Admin','Treasurer','Auditor/Viewer'])));
CREATE POLICY "insert_event_contributions" ON event_contributions FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM events e WHERE e.id = event_contributions.event_id
          AND has_committee_role(e.committee_id, ARRAY['Platform Owner','Committee Admin','Treasurer'])));
CREATE POLICY "update_event_contributions" ON event_contributions FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM events e WHERE e.id = event_contributions.event_id
          AND has_committee_role(e.committee_id, ARRAY['Platform Owner','Committee Admin','Treasurer'])))
  WITH CHECK (
  EXISTS (SELECT 1 FROM events e WHERE e.id = event_contributions.event_id
          AND has_committee_role(e.committee_id, ARRAY['Platform Owner','Committee Admin','Treasurer'])));

-- ============================================================
-- 9. AUDIT TRAIL
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  committee_id uuid,          -- intentionally no FK: history survives deletions
  event_id uuid,
  actor_id uuid,
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_committee_time ON audit_log(committee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_log(table_name, record_id);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON audit_log FROM authenticated, anon;
GRANT SELECT ON audit_log TO authenticated;

CREATE POLICY "select_audit_log" ON audit_log FOR SELECT TO authenticated USING (
  committee_id IS NOT NULL
  AND has_committee_role(committee_id, ARRAY['Platform Owner','Committee Admin','Treasurer','Auditor/Viewer']));

CREATE OR REPLACE FUNCTION audit_row_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rec jsonb; cid uuid; eid uuid; rid uuid;
BEGIN
  rec := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  rid := (rec->>'id')::uuid;

  IF TG_TABLE_NAME = 'events' THEN
    eid := rid; cid := (rec->>'committee_id')::uuid;
  ELSIF TG_TABLE_NAME = 'committees' THEN
    cid := rid;
  ELSIF rec ? 'committee_id' THEN
    cid := (rec->>'committee_id')::uuid;
  ELSIF rec ? 'event_id' THEN
    eid := (rec->>'event_id')::uuid;
    SELECT committee_id INTO cid FROM events WHERE id = eid;
  END IF;

  INSERT INTO audit_log (committee_id, event_id, actor_id, table_name, record_id, action, old_data, new_data)
  VALUES (cid, eid, auth.uid(), TG_TABLE_NAME, rid, TG_OP,
          CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
          CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END $$;
REVOKE EXECUTE ON FUNCTION audit_row_change() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['committees','committee_members','events','event_modules',
                           'event_finance','event_budgets','event_contributions',
                           'event_vendors','committee_subscriptions']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON %I
                    FOR EACH ROW EXECUTE FUNCTION audit_row_change()', t, t);
  END LOOP;
END $$;

-- Backfill subscriptions for committees created before this migration
INSERT INTO committee_subscriptions (committee_id)
SELECT id FROM committees ON CONFLICT (committee_id) DO NOTHING;
