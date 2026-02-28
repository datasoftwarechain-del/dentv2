-- Migration: Add collaborator support to org_members
-- Adds permissions (JSONB), status, display_name, and invited_by columns.
-- Existing rows get defaults: status='active', permissions={}, display_name=NULL.

ALTER TABLE org_members
  ADD COLUMN IF NOT EXISTS permissions   JSONB    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status        TEXT     NOT NULL DEFAULT 'active'
    CONSTRAINT org_members_status_check CHECK (status IN ('active', 'suspended')),
  ADD COLUMN IF NOT EXISTS display_name  TEXT,
  ADD COLUMN IF NOT EXISTS invited_by    UUID     REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for looking up members by org quickly (used in every API auth-check)
CREATE INDEX IF NOT EXISTS idx_org_members_org_id  ON org_members (org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON org_members (user_id);

-- Backfill: mark existing rows as 'admin' if they don't have a role set
UPDATE org_members SET role = 'admin' WHERE role IS NULL OR role = '';

COMMENT ON COLUMN org_members.permissions   IS 'JSON object of CollaboratorPermissions flags. Empty ({}) means no restrictions (admin).';
COMMENT ON COLUMN org_members.status        IS 'active | suspended — suspended users cannot log in but data is preserved.';
COMMENT ON COLUMN org_members.display_name  IS 'Optional display name override for the collaborator (e.g. "María – Recepción").';
COMMENT ON COLUMN org_members.invited_by    IS 'auth.users.id of the admin who created this collaborator account.';
