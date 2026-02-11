-- ============================================
-- Fix RLS Permissions for Manual Order Entry
-- ============================================
-- This script fixes Row Level Security policies to allow:
-- 1. Labs to create dentist organizations (clinics)
-- 2. Labs to create patients for those clinics
-- 3. Labs to create lab-dentist relations
--
-- Execute this in Supabase SQL Editor

-- ============================================
-- 1. Enable RLS on tables (if not already enabled)
-- ============================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_dentist_relations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. ORGANIZATIONS - Allow labs to create dentist orgs
-- ============================================

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow labs to create dentist organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view their own organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view related organizations" ON organizations;
DROP POLICY IF EXISTS "Users can update their own organizations" ON organizations;

-- Policy: Users can view their own organizations
CREATE POLICY "Users can view their own organizations"
ON organizations FOR SELECT
USING (
  id IN (
    SELECT org_id FROM org_members
    WHERE user_id = auth.uid()
  )
);

-- Policy: Users can view organizations they have relations with
CREATE POLICY "Users can view related organizations"
ON organizations FOR SELECT
USING (
  -- Labs can see their related dentist orgs
  id IN (
    SELECT dentist_org_id FROM lab_dentist_relations
    WHERE lab_org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  )
  OR
  -- Dentists can see their related labs
  id IN (
    SELECT lab_org_id FROM lab_dentist_relations
    WHERE dentist_org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  )
);

-- Policy: Labs can create dentist organizations
CREATE POLICY "Allow labs to create dentist organizations"
ON organizations FOR INSERT
WITH CHECK (
  -- Only allow creating dentist type organizations
  type = 'dentist'
  AND
  -- User must be a member of a lab organization
  EXISTS (
    SELECT 1 FROM org_members om
    JOIN organizations o ON o.id = om.org_id
    WHERE om.user_id = auth.uid()
    AND o.type = 'lab'
  )
);

-- Policy: Users can update their own organizations
CREATE POLICY "Users can update their own organizations"
ON organizations FOR UPDATE
USING (
  id IN (
    SELECT org_id FROM org_members
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

-- ============================================
-- 3. PATIENTS - Allow labs to create patients for dentist orgs
-- ============================================

DROP POLICY IF EXISTS "Allow labs to create patients for dentist orgs" ON patients;
DROP POLICY IF EXISTS "Users can view patients from their org" ON patients;
DROP POLICY IF EXISTS "Users can view patients from related orgs" ON patients;
DROP POLICY IF EXISTS "Users can update patients from their org" ON patients;
DROP POLICY IF EXISTS "Users can delete patients from their org" ON patients;

-- Policy: Users can view patients from their own organization
CREATE POLICY "Users can view patients from their org"
ON patients FOR SELECT
USING (
  dentist_org_id IN (
    SELECT org_id FROM org_members
    WHERE user_id = auth.uid()
  )
);

-- Policy: Labs can view patients from related dentist orgs
CREATE POLICY "Users can view patients from related orgs"
ON patients FOR SELECT
USING (
  dentist_org_id IN (
    SELECT dentist_org_id FROM lab_dentist_relations
    WHERE lab_org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  )
);

-- Policy: Dentists can create patients for their own org
CREATE POLICY "Dentists can create patients for their org"
ON patients FOR INSERT
WITH CHECK (
  dentist_org_id IN (
    SELECT org_id FROM org_members
    WHERE user_id = auth.uid()
  )
);

-- Policy: Labs can create patients for dentist orgs they work with
CREATE POLICY "Allow labs to create patients for dentist orgs"
ON patients FOR INSERT
WITH CHECK (
  -- Lab can create patients for any dentist org they have a relation with
  -- OR for newly created dentist orgs (no relation yet, but will be created)
  dentist_org_id IN (
    SELECT dentist_org_id FROM lab_dentist_relations
    WHERE lab_org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  )
  OR
  -- Allow creation for new dentist orgs (relation will be created immediately after)
  EXISTS (
    SELECT 1 FROM org_members om
    JOIN organizations o ON o.id = om.org_id
    WHERE om.user_id = auth.uid()
    AND o.type = 'lab'
  )
);

-- Policy: Users can update patients from their org
CREATE POLICY "Users can update patients from their org"
ON patients FOR UPDATE
USING (
  dentist_org_id IN (
    SELECT org_id FROM org_members
    WHERE user_id = auth.uid()
  )
);

-- Policy: Users can delete patients from their org
CREATE POLICY "Users can delete patients from their org"
ON patients FOR DELETE
USING (
  dentist_org_id IN (
    SELECT org_id FROM org_members
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

-- ============================================
-- 4. LAB_DENTIST_RELATIONS - Allow labs to create relations
-- ============================================

DROP POLICY IF EXISTS "Labs can create relations" ON lab_dentist_relations;
DROP POLICY IF EXISTS "Users can view their relations" ON lab_dentist_relations;
DROP POLICY IF EXISTS "Labs can update their relations" ON lab_dentist_relations;

-- Policy: Users can view relations for their organizations
CREATE POLICY "Users can view their relations"
ON lab_dentist_relations FOR SELECT
USING (
  lab_org_id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid()
  )
  OR
  dentist_org_id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid()
  )
);

-- Policy: Labs can create relations with dentist orgs
CREATE POLICY "Labs can create relations"
ON lab_dentist_relations FOR INSERT
WITH CHECK (
  lab_org_id IN (
    SELECT org_id FROM org_members
    WHERE user_id = auth.uid()
  )
);

-- Policy: Labs can update their relations
CREATE POLICY "Labs can update their relations"
ON lab_dentist_relations FOR UPDATE
USING (
  lab_org_id IN (
    SELECT org_id FROM org_members
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

-- ============================================
-- 5. Verify policies were created
-- ============================================
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('organizations', 'patients', 'lab_dentist_relations')
ORDER BY tablename, policyname;

-- ============================================
-- INSTRUCTIONS
-- ============================================
--
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Click "New Query"
-- 3. Copy and paste this entire script
-- 4. Click "Run" (or Ctrl+Enter)
-- 5. Check output to verify policies were created
-- 6. Try creating a manual order again
--
-- ============================================
-- TESTING
-- ============================================
--
-- After running this script, test:
-- 1. Create manual order with new clinic
-- 2. Create manual order with new clinic + new patient
-- 3. Verify all data is created correctly
--
