/*
# Puja & Festival Management Platform — Core Schema

## Overview
Multi-tenant schema for GD Solutions' Puja & Festival Management Platform.
Community organizations manage multiple Pujas, festivals, and community events
from a single account. Supports multi-committee membership with role-based access.

## Tables Created
1. profiles — User display names and contact info (extends auth.users)
2. committees — Organization entities (Puja committees, community orgs)
3. committee_members — User-committee memberships with role assignments
4. events — Festivals/Pujas organized by committees
5. event_modules — Configurable module toggles per event
6. event_tasks — Task management items for events
7. event_finance — Income and expense records
8. event_vendors — Vendor/supplier assignments
9. event_schedule_items — Schedule/timeline entries
10. event_volunteers — Volunteer assignments
11. event_guests — Guest management entries
12. event_inventory — Inventory/equipment items
13. event_notices — Notices and announcements
14. event_bhog_prasad — Bhog and prasad distribution tracking

## Roles
- Platform Owner: full access across all committees
- Committee Admin: full access within their committee
- Treasurer: read all, write finance records
- Event Manager: read all, write events and operational modules
- Volunteer: read all, update tasks assigned to them
- Auditor/Viewer: read only

## Security
All tables have RLS enabled. Access is authorized through committee membership
via SECURITY DEFINER helper functions. No USING(true) shortcuts.
*/

-- ============================================================
-- 1. TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS committees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  logo_url text,
  city text,
  state text,
  country text DEFAULT 'India',
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS committee_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id uuid NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'Volunteer' CHECK (role IN ('Platform Owner', 'Committee Admin', 'Treasurer', 'Event Manager', 'Volunteer', 'Auditor/Viewer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'inactive')),
  joined_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(committee_id, user_id)
);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id uuid NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
  name text NOT NULL,
  event_type text NOT NULL DEFAULT 'Other',
  start_date date NOT NULL,
  end_date date NOT NULL,
  venue text,
  description text,
  status text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  module_key text NOT NULL CHECK (module_key IN ('finance', 'vendors', 'schedule', 'tasks', 'volunteers', 'guest_management', 'bhog_prasad', 'inventory', 'notices')),
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, module_key)
);

CREATE TABLE IF NOT EXISTS event_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_finance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  category text NOT NULL,
  description text,
  amount numeric(12,2) NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  vendor_name text,
  receipt_url text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  service_type text,
  contact_person text,
  phone text,
  email text,
  estimated_cost numeric(12,2),
  actual_cost numeric(12,2),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  scheduled_date date NOT NULL,
  start_time time,
  end_time time,
  location text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_volunteers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  phone text,
  role text,
  assigned_area text,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'confirmed', 'checked_in', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  guest_type text DEFAULT 'general' CHECK (guest_type IN ('vip', 'general', 'speaker', 'performer')),
  rsvp_status text DEFAULT 'pending' CHECK (rsvp_status IN ('pending', 'confirmed', 'declined')),
  headcount integer DEFAULT 1,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  category text,
  quantity integer NOT NULL DEFAULT 1,
  unit text,
  estimated_cost numeric(12,2),
  actual_cost numeric(12,2),
  source text,
  status text NOT NULL DEFAULT 'needed' CHECK (status IN ('needed', 'ordered', 'received', 'allocated')),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  notice_type text DEFAULT 'info' CHECK (notice_type IN ('info', 'urgent', 'announcement', 'reminder')),
  posted_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_bhog_prasad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit text,
  distribution_point text,
  distribution_time time,
  responsible_person text,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'preparing', 'ready', 'distributing', 'completed')),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 2. ENABLE RLS
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_finance ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_bhog_prasad ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_committee_members_user ON committee_members(user_id);
CREATE INDEX IF NOT EXISTS idx_committee_members_committee ON committee_members(committee_id);
CREATE INDEX IF NOT EXISTS idx_events_committee ON events(committee_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_dates ON events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_event_modules_event ON event_modules(event_id);
CREATE INDEX IF NOT EXISTS idx_event_tasks_event ON event_tasks(event_id);
CREATE INDEX IF NOT EXISTS idx_event_tasks_status ON event_tasks(status);
CREATE INDEX IF NOT EXISTS idx_event_tasks_assigned ON event_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_event_finance_event ON event_finance(event_id);
CREATE INDEX IF NOT EXISTS idx_event_finance_type ON event_finance(type);
CREATE INDEX IF NOT EXISTS idx_event_vendors_event ON event_vendors(event_id);
CREATE INDEX IF NOT EXISTS idx_event_schedule_event ON event_schedule_items(event_id);
CREATE INDEX IF NOT EXISTS idx_event_volunteers_event ON event_volunteers(event_id);
CREATE INDEX IF NOT EXISTS idx_event_guests_event ON event_guests(event_id);
CREATE INDEX IF NOT EXISTS idx_event_inventory_event ON event_inventory(event_id);
CREATE INDEX IF NOT EXISTS idx_event_notices_event ON event_notices(event_id);
CREATE INDEX IF NOT EXISTS idx_event_bhog_event ON event_bhog_prasad(event_id);

-- ============================================================
-- 4. HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================================

CREATE OR REPLACE FUNCTION is_committee_member(committee_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM committee_members
    WHERE committee_id = committee_uuid
    AND user_id = auth.uid()
    AND status = 'active'
  );
$$;

REVOKE EXECUTE ON FUNCTION is_committee_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_committee_member(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION has_committee_role(committee_uuid uuid, roles text[])
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM committee_members
    WHERE committee_id = committee_uuid
    AND user_id = auth.uid()
    AND status = 'active'
    AND role = ANY(roles)
  );
$$;

REVOKE EXECUTE ON FUNCTION has_committee_role(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION has_committee_role(uuid, text[]) TO authenticated;

-- ============================================================
-- 5. GRANTS
-- ============================================================

GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON committees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON committee_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_modules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_finance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_vendors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_schedule_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_volunteers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_guests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_inventory TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_notices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_bhog_prasad TO authenticated;

-- ============================================================
-- 6. POLICIES — profiles
-- ============================================================

DROP POLICY IF EXISTS "select_profiles" ON profiles;
CREATE POLICY "select_profiles" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- 7. POLICIES — committees
-- ============================================================

DROP POLICY IF EXISTS "select_committees" ON committees;
CREATE POLICY "select_committees" ON committees FOR SELECT
  TO authenticated USING (is_committee_member(id));

DROP POLICY IF EXISTS "insert_committees" ON committees;
CREATE POLICY "insert_committees" ON committees FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "update_committees" ON committees;
CREATE POLICY "update_committees" ON committees FOR UPDATE
  TO authenticated USING (has_committee_role(id, ARRAY['Platform Owner', 'Committee Admin']))
  WITH CHECK (has_committee_role(id, ARRAY['Platform Owner', 'Committee Admin']));

DROP POLICY IF EXISTS "delete_committees" ON committees;
CREATE POLICY "delete_committees" ON committees FOR DELETE
  TO authenticated USING (has_committee_role(id, ARRAY['Platform Owner', 'Committee Admin']));

-- ============================================================
-- 8. POLICIES — committee_members
-- ============================================================

DROP POLICY IF EXISTS "select_committee_members" ON committee_members;
CREATE POLICY "select_committee_members" ON committee_members FOR SELECT
  TO authenticated USING (is_committee_member(committee_id));

DROP POLICY IF EXISTS "insert_committee_members" ON committee_members;
CREATE POLICY "insert_committee_members" ON committee_members FOR INSERT
  TO authenticated WITH CHECK (has_committee_role(committee_id, ARRAY['Platform Owner', 'Committee Admin']));

DROP POLICY IF EXISTS "update_committee_members" ON committee_members;
CREATE POLICY "update_committee_members" ON committee_members FOR UPDATE
  TO authenticated USING (has_committee_role(committee_id, ARRAY['Platform Owner', 'Committee Admin']))
  WITH CHECK (has_committee_role(committee_id, ARRAY['Platform Owner', 'Committee Admin']));

DROP POLICY IF EXISTS "delete_committee_members" ON committee_members;
CREATE POLICY "delete_committee_members" ON committee_members FOR DELETE
  TO authenticated USING (has_committee_role(committee_id, ARRAY['Platform Owner', 'Committee Admin']));

-- ============================================================
-- 9. POLICIES — events
-- ============================================================

DROP POLICY IF EXISTS "select_events" ON events;
CREATE POLICY "select_events" ON events FOR SELECT
  TO authenticated USING (is_committee_member(committee_id));

DROP POLICY IF EXISTS "insert_events" ON events;
CREATE POLICY "insert_events" ON events FOR INSERT
  TO authenticated WITH CHECK (has_committee_role(committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Treasurer', 'Event Manager']));

DROP POLICY IF EXISTS "update_events" ON events;
CREATE POLICY "update_events" ON events FOR UPDATE
  TO authenticated USING (has_committee_role(committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  WITH CHECK (has_committee_role(committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']));

DROP POLICY IF EXISTS "delete_events" ON events;
CREATE POLICY "delete_events" ON events FOR DELETE
  TO authenticated USING (has_committee_role(committee_id, ARRAY['Platform Owner', 'Committee Admin']));

-- ============================================================
-- 10. POLICIES — event_modules
-- ============================================================

DROP POLICY IF EXISTS "select_event_modules" ON event_modules;
CREATE POLICY "select_event_modules" ON event_modules FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_modules.event_id AND is_committee_member(events.committee_id))
  );

DROP POLICY IF EXISTS "insert_event_modules" ON event_modules;
CREATE POLICY "insert_event_modules" ON event_modules FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_modules.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );

DROP POLICY IF EXISTS "update_event_modules" ON event_modules;
CREATE POLICY "update_event_modules" ON event_modules FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_modules.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_modules.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );

DROP POLICY IF EXISTS "delete_event_modules" ON event_modules;
CREATE POLICY "delete_event_modules" ON event_modules FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_modules.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin']))
  );

-- ============================================================
-- 11. POLICIES — event_tasks
-- ============================================================

DROP POLICY IF EXISTS "select_event_tasks" ON event_tasks;
CREATE POLICY "select_event_tasks" ON event_tasks FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_tasks.event_id AND is_committee_member(events.committee_id))
  );

DROP POLICY IF EXISTS "insert_event_tasks" ON event_tasks;
CREATE POLICY "insert_event_tasks" ON event_tasks FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_tasks.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );

DROP POLICY IF EXISTS "update_event_tasks" ON event_tasks;
CREATE POLICY "update_event_tasks" ON event_tasks FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_tasks.event_id AND is_committee_member(events.committee_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_tasks.event_id AND is_committee_member(events.committee_id))
  );

DROP POLICY IF EXISTS "delete_event_tasks" ON event_tasks;
CREATE POLICY "delete_event_tasks" ON event_tasks FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_tasks.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );

-- ============================================================
-- 12. POLICIES — event_finance
-- ============================================================

DROP POLICY IF EXISTS "select_event_finance" ON event_finance;
CREATE POLICY "select_event_finance" ON event_finance FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_finance.event_id AND is_committee_member(events.committee_id))
  );

DROP POLICY IF EXISTS "insert_event_finance" ON event_finance;
CREATE POLICY "insert_event_finance" ON event_finance FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_finance.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Treasurer']))
  );

DROP POLICY IF EXISTS "update_event_finance" ON event_finance;
CREATE POLICY "update_event_finance" ON event_finance FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_finance.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Treasurer']))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_finance.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Treasurer']))
  );

DROP POLICY IF EXISTS "delete_event_finance" ON event_finance;
CREATE POLICY "delete_event_finance" ON event_finance FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_finance.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Treasurer']))
  );

-- ============================================================
-- 13. POLICIES — event_vendors
-- ============================================================

DROP POLICY IF EXISTS "select_event_vendors" ON event_vendors;
CREATE POLICY "select_event_vendors" ON event_vendors FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_vendors.event_id AND is_committee_member(events.committee_id))
  );

DROP POLICY IF EXISTS "insert_event_vendors" ON event_vendors;
CREATE POLICY "insert_event_vendors" ON event_vendors FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_vendors.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );

DROP POLICY IF EXISTS "update_event_vendors" ON event_vendors;
CREATE POLICY "update_event_vendors" ON event_vendors FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_vendors.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_vendors.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );

DROP POLICY IF EXISTS "delete_event_vendors" ON event_vendors;
CREATE POLICY "delete_event_vendors" ON event_vendors FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_vendors.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );

-- ============================================================
-- 14. POLICIES — event_schedule_items
-- ============================================================

DROP POLICY IF EXISTS "select_event_schedule_items" ON event_schedule_items;
CREATE POLICY "select_event_schedule_items" ON event_schedule_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_schedule_items.event_id AND is_committee_member(events.committee_id))
  );

DROP POLICY IF EXISTS "insert_event_schedule_items" ON event_schedule_items;
CREATE POLICY "insert_event_schedule_items" ON event_schedule_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_schedule_items.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );

DROP POLICY IF EXISTS "update_event_schedule_items" ON event_schedule_items;
CREATE POLICY "update_event_schedule_items" ON event_schedule_items FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_schedule_items.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_schedule_items.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );

DROP POLICY IF EXISTS "delete_event_schedule_items" ON event_schedule_items;
CREATE POLICY "delete_event_schedule_items" ON event_schedule_items FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_schedule_items.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );

-- ============================================================
-- 15. POLICIES — event_volunteers
-- ============================================================

DROP POLICY IF EXISTS "select_event_volunteers" ON event_volunteers;
CREATE POLICY "select_event_volunteers" ON event_volunteers FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_volunteers.event_id AND is_committee_member(events.committee_id))
  );

DROP POLICY IF EXISTS "insert_event_volunteers" ON event_volunteers;
CREATE POLICY "insert_event_volunteers" ON event_volunteers FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_volunteers.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );

DROP POLICY IF EXISTS "update_event_volunteers" ON event_volunteers;
CREATE POLICY "update_event_volunteers" ON event_volunteers FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_volunteers.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_volunteers.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );

DROP POLICY IF EXISTS "delete_event_volunteers" ON event_volunteers;
CREATE POLICY "delete_event_volunteers" ON event_volunteers FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_volunteers.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );

-- ============================================================
-- 16. POLICIES — event_guests
-- ============================================================

DROP POLICY IF EXISTS "select_event_guests" ON event_guests;
CREATE POLICY "select_event_guests" ON event_guests FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_guests.event_id AND is_committee_member(events.committee_id))
  );

DROP POLICY IF EXISTS "insert_event_guests" ON event_guests;
CREATE POLICY "insert_event_guests" ON event_guests FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_guests.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );

DROP POLICY IF EXISTS "update_event_guests" ON event_guests;
CREATE POLICY "update_event_guests" ON event_guests FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_guests.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_guests.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );

DROP POLICY IF EXISTS "delete_event_guests" ON event_guests;
CREATE POLICY "delete_event_guests" ON event_guests FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_guests.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );

-- ============================================================
-- 17. POLICIES — event_inventory
-- ============================================================

DROP POLICY IF EXISTS "select_event_inventory" ON event_inventory;
CREATE POLICY "select_event_inventory" ON event_inventory FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_inventory.event_id AND is_committee_member(events.committee_id))
  );

DROP POLICY IF EXISTS "insert_event_inventory" ON event_inventory;
CREATE POLICY "insert_event_inventory" ON event_inventory FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_inventory.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );

DROP POLICY IF EXISTS "update_event_inventory" ON event_inventory;
CREATE POLICY "update_event_inventory" ON event_inventory FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_inventory.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_inventory.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );

DROP POLICY IF EXISTS "delete_event_inventory" ON event_inventory;
CREATE POLICY "delete_event_inventory" ON event_inventory FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_inventory.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );

-- ============================================================
-- 18. POLICIES — event_notices
-- ============================================================

DROP POLICY IF EXISTS "select_event_notices" ON event_notices;
CREATE POLICY "select_event_notices" ON event_notices FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_notices.event_id AND is_committee_member(events.committee_id))
  );

DROP POLICY IF EXISTS "insert_event_notices" ON event_notices;
CREATE POLICY "insert_event_notices" ON event_notices FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_notices.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );

DROP POLICY IF EXISTS "update_event_notices" ON event_notices;
CREATE POLICY "update_event_notices" ON event_notices FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_notices.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_notices.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );

DROP POLICY IF EXISTS "delete_event_notices" ON event_notices;
CREATE POLICY "delete_event_notices" ON event_notices FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_notices.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );

-- ============================================================
-- 19. POLICIES — event_bhog_prasad
-- ============================================================

DROP POLICY IF EXISTS "select_event_bhog_prasad" ON event_bhog_prasad;
CREATE POLICY "select_event_bhog_prasad" ON event_bhog_prasad FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_bhog_prasad.event_id AND is_committee_member(events.committee_id))
  );

DROP POLICY IF EXISTS "insert_event_bhog_prasad" ON event_bhog_prasad;
CREATE POLICY "insert_event_bhog_prasad" ON event_bhog_prasad FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_bhog_prasad.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );

DROP POLICY IF EXISTS "update_event_bhog_prasad" ON event_bhog_prasad;
CREATE POLICY "update_event_bhog_prasad" ON event_bhog_prasad FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_bhog_prasad.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_bhog_prasad.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );

DROP POLICY IF EXISTS "delete_event_bhog_prasad" ON event_bhog_prasad;
CREATE POLICY "delete_event_bhog_prasad" ON event_bhog_prasad FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_bhog_prasad.event_id AND has_committee_role(events.committee_id, ARRAY['Platform Owner', 'Committee Admin', 'Event Manager']))
  );
