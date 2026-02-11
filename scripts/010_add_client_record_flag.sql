-- ============================================
-- Add Client Record Flag to Organizations
-- ============================================
-- This allows labs to create "passive" client records
-- that are NOT real system users, just internal tracking data
--
-- Execute this in Supabase SQL Editor

-- ============================================
-- 1. Add is_system_account column
-- ============================================

-- Add column with default TRUE (existing orgs are real system accounts)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS is_system_account BOOLEAN DEFAULT true NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN organizations.is_system_account IS
'TRUE = Real system user that can log in and use the platform. FALSE = Passive client record for internal lab tracking only (no login, no onboarding).';

-- ============================================
-- 2. Create index for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_organizations_is_system_account
ON organizations(is_system_account);

-- ============================================
-- 3. Update existing organizations to be system accounts
-- ============================================

-- All existing organizations should be marked as system accounts
UPDATE organizations
SET is_system_account = true
WHERE is_system_account IS NULL;

-- ============================================
-- 4. Create helper view for active organizations
-- ============================================

CREATE OR REPLACE VIEW active_organizations AS
SELECT * FROM organizations
WHERE is_system_account = true;

-- ============================================
-- 5. Create helper view for client records
-- ============================================

CREATE OR REPLACE VIEW client_records AS
SELECT * FROM organizations
WHERE is_system_account = false;

-- ============================================
-- 6. Verify changes
-- ============================================

SELECT
  id,
  name,
  type,
  is_system_account,
  created_at
FROM organizations
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- USAGE NOTES
-- ============================================
--
-- When creating a "real" organization (system user):
-- INSERT INTO organizations (name, type, is_system_account)
-- VALUES ('My Clinic', 'dentist', true);
--
-- When creating a "client record" (passive tracking):
-- INSERT INTO organizations (name, type, is_system_account)
-- VALUES ('Client Clinic', 'dentist', false);
--
-- Client records (is_system_account = false):
-- ✅ Can be used for orders and billing
-- ✅ Appear in lab's client lists
-- ✅ Can have patients associated
-- ❌ Cannot log in to the system
-- ❌ Do not trigger onboarding flow
-- ❌ No user accounts associated
--
-- ============================================
