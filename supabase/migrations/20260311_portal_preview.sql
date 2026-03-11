-- Portal Preview System
-- Adds dentist_preview org type and client_invitations table.
-- No "clients" table — dentist orgs from lab_dentist_relations are the "clients".
-- lab_orders gets a client_preview_org_id for linking preview org orders.

-- 1. Extend organizations type constraint to include dentist_preview
ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_type_check;
ALTER TABLE organizations
  ADD CONSTRAINT organizations_type_check
  CHECK (type IN ('dentist', 'lab', 'dentist_preview'));

-- 2. client_invitations: tracks portal access granted by a lab to a connected dentist
CREATE TABLE client_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dentist_org_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  preview_org_id  UUID REFERENCES organizations(id) ON DELETE SET NULL,
  invited_email   TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'active', 'converted', 'revoked')),
  converted_at    TIMESTAMPTZ,
  created_by      UUID NOT NULL REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lab_org_id, invited_email)
);

-- 3. Allow lab_orders to be linked to a preview org
ALTER TABLE lab_orders
  ADD COLUMN IF NOT EXISTS client_preview_org_id UUID
  REFERENCES organizations(id) ON DELETE SET NULL;

-- 4. Indexes for frequent lookups
CREATE INDEX idx_invitations_lab ON client_invitations(lab_org_id);
CREATE INDEX idx_invitations_dentist_org ON client_invitations(dentist_org_id);
CREATE INDEX idx_invitations_preview_org ON client_invitations(preview_org_id);

-- 5. RLS: allow authenticated users to read (app-level multi-tenancy like all other tables)
ALTER TABLE client_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated can read invitations"
  ON client_invitations FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "authenticated can insert invitations"
  ON client_invitations FOR INSERT
  TO authenticated
  WITH CHECK (true);
CREATE POLICY "authenticated can update invitations"
  ON client_invitations FOR UPDATE
  TO authenticated
  USING (true);
