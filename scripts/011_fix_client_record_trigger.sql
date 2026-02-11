-- ============================================
-- Fix Organization Creation Trigger
-- ============================================
-- Prevents auto-adding user as owner for client records
-- Only adds user as owner for real system accounts
--
-- Execute this in Supabase SQL Editor

-- ============================================
-- 1. Drop existing trigger
-- ============================================

DROP TRIGGER IF EXISTS on_org_created ON organizations;

-- ============================================
-- 2. Recreate function with is_system_account check
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER AS $$
BEGIN
  -- Only add creator as owner if this is a real system account
  -- Client records (is_system_account = false) should NOT have members
  IF NEW.is_system_account = true THEN
    INSERT INTO public.org_members (org_id, user_id, role)
    VALUES (NEW.id, auth.uid(), 'owner');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. Recreate trigger
-- ============================================

CREATE TRIGGER on_org_created
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

-- ============================================
-- 4. Clean up any incorrect memberships
-- ============================================

-- Remove memberships from client records (passive organizations)
-- Users should NOT be members of organizations that are just client records
DELETE FROM org_members
WHERE org_id IN (
  SELECT id FROM organizations
  WHERE is_system_account = false
);

-- ============================================
-- 5. Verify changes
-- ============================================

-- Check that client records have no members
SELECT
  o.id,
  o.name,
  o.type,
  o.is_system_account,
  COUNT(om.user_id) as member_count
FROM organizations o
LEFT JOIN org_members om ON o.id = om.org_id
WHERE o.is_system_account = false
GROUP BY o.id, o.name, o.type, o.is_system_account;

-- Should show 0 members for all client records

-- ============================================
-- SUMMARY
-- ============================================
--
-- This fix ensures that:
--
-- When creating a REAL organization (is_system_account = true):
-- ✅ User is automatically added as owner (normal behavior)
-- ✅ Organization requires onboarding/setup
-- ✅ Users can log in and use the system
--
-- When creating a CLIENT RECORD (is_system_account = false):
-- ✅ User is NOT added as member (passive tracking only)
-- ✅ No onboarding required
-- ✅ Used only for lab's internal client tracking
-- ✅ Can still create orders, invoices, etc.
--
-- ============================================
