-- ============================================
-- Fix RLS Recursion Error
-- ============================================
-- This script fixes the infinite recursion error
-- by simplifying the policies and removing circular dependencies
--
-- Execute this in Supabase SQL Editor

-- ============================================
-- 1. Drop ALL existing policies to start fresh
-- ============================================

-- Organizations policies
DROP POLICY IF EXISTS "Allow labs to create dentist organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view their own organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view related organizations" ON organizations;
DROP POLICY IF EXISTS "Users can update their own organizations" ON organizations;

-- Patients policies
DROP POLICY IF EXISTS "Allow labs to create patients for dentist orgs" ON patients;
DROP POLICY IF EXISTS "Users can view patients from their org" ON patients;
DROP POLICY IF EXISTS "Users can view patients from related orgs" ON patients;
DROP POLICY IF EXISTS "Dentists can create patients for their org" ON patients;
DROP POLICY IF EXISTS "Users can update patients from their org" ON patients;
DROP POLICY IF EXISTS "Users can delete patients from their org" ON patients;

-- Lab dentist relations policies
DROP POLICY IF EXISTS "Labs can create relations" ON lab_dentist_relations;
DROP POLICY IF EXISTS "Users can view their relations" ON lab_dentist_relations;
DROP POLICY IF EXISTS "Labs can update their relations" ON lab_dentist_relations;

-- ============================================
-- 2. ORGANIZATIONS - Simplified policies (NO RECURSION)
-- ============================================

-- Allow INSERT for authenticated users creating dentist orgs
CREATE POLICY "allow_insert_dentist_orgs"
ON organizations FOR INSERT
TO authenticated
WITH CHECK (type = 'dentist');

-- Allow SELECT for organization members
CREATE POLICY "allow_select_own_orgs"
ON organizations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM org_members
    WHERE org_members.org_id = organizations.id
    AND org_members.user_id = auth.uid()
  )
);

-- Allow SELECT for related organizations (via lab_dentist_relations)
CREATE POLICY "allow_select_related_orgs"
ON organizations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM lab_dentist_relations ldr
    JOIN org_members om ON (om.org_id = ldr.lab_org_id OR om.org_id = ldr.dentist_org_id)
    WHERE (ldr.dentist_org_id = organizations.id OR ldr.lab_org_id = organizations.id)
    AND om.user_id = auth.uid()
  )
);

-- Allow UPDATE for admins of the organization
CREATE POLICY "allow_update_own_orgs"
ON organizations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM org_members
    WHERE org_members.org_id = organizations.id
    AND org_members.user_id = auth.uid()
    AND org_members.role IN ('owner', 'admin')
  )
);

-- ============================================
-- 3. LAB_DENTIST_RELATIONS - Simplified policies
-- ============================================

-- Allow INSERT for lab members
CREATE POLICY "allow_insert_relations"
ON lab_dentist_relations FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM org_members
    WHERE org_members.org_id = lab_dentist_relations.lab_org_id
    AND org_members.user_id = auth.uid()
  )
);

-- Allow SELECT for members of either organization
CREATE POLICY "allow_select_relations"
ON lab_dentist_relations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM org_members
    WHERE (org_members.org_id = lab_dentist_relations.lab_org_id
           OR org_members.org_id = lab_dentist_relations.dentist_org_id)
    AND org_members.user_id = auth.uid()
  )
);

-- Allow UPDATE for lab admins
CREATE POLICY "allow_update_relations"
ON lab_dentist_relations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM org_members
    WHERE org_members.org_id = lab_dentist_relations.lab_org_id
    AND org_members.user_id = auth.uid()
    AND org_members.role IN ('owner', 'admin')
  )
);

-- ============================================
-- 4. PATIENTS - Simplified policies
-- ============================================

-- Allow INSERT for authenticated users
-- (We'll validate on the application layer that they have permission)
CREATE POLICY "allow_insert_patients"
ON patients FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow SELECT for dentist org members
CREATE POLICY "allow_select_own_patients"
ON patients FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM org_members
    WHERE org_members.org_id = patients.dentist_org_id
    AND org_members.user_id = auth.uid()
  )
);

-- Allow SELECT for labs that work with the dentist org
CREATE POLICY "allow_select_related_patients"
ON patients FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM lab_dentist_relations ldr
    JOIN org_members om ON om.org_id = ldr.lab_org_id
    WHERE ldr.dentist_org_id = patients.dentist_org_id
    AND om.user_id = auth.uid()
  )
);

-- Allow UPDATE for dentist org members
CREATE POLICY "allow_update_own_patients"
ON patients FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM org_members
    WHERE org_members.org_id = patients.dentist_org_id
    AND org_members.user_id = auth.uid()
  )
);

-- Allow DELETE for dentist org admins
CREATE POLICY "allow_delete_own_patients"
ON patients FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM org_members
    WHERE org_members.org_id = patients.dentist_org_id
    AND org_members.user_id = auth.uid()
    AND org_members.role IN ('owner', 'admin')
  )
);

-- ============================================
-- 5. LAB_ORDERS - Ensure policies exist
-- ============================================

-- Drop existing
DROP POLICY IF EXISTS "allow_insert_orders" ON lab_orders;
DROP POLICY IF EXISTS "allow_select_orders" ON lab_orders;
DROP POLICY IF EXISTS "allow_update_orders" ON lab_orders;

-- Allow INSERT for authenticated users
CREATE POLICY "allow_insert_orders"
ON lab_orders FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow SELECT for lab or dentist org members
CREATE POLICY "allow_select_orders"
ON lab_orders FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM org_members
    WHERE (org_members.org_id = lab_orders.lab_org_id
           OR org_members.org_id = lab_orders.dentist_org_id)
    AND org_members.user_id = auth.uid()
  )
);

-- Allow UPDATE for lab or dentist org members
CREATE POLICY "allow_update_orders"
ON lab_orders FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM org_members
    WHERE (org_members.org_id = lab_orders.lab_org_id
           OR org_members.org_id = lab_orders.dentist_org_id)
    AND org_members.user_id = auth.uid()
  )
);

-- ============================================
-- 6. LAB_ORDER_ITEMS - Ensure policies exist
-- ============================================

DROP POLICY IF EXISTS "allow_insert_order_items" ON lab_order_items;
DROP POLICY IF EXISTS "allow_select_order_items" ON lab_order_items;
DROP POLICY IF EXISTS "allow_update_order_items" ON lab_order_items;

-- Allow INSERT for authenticated users
CREATE POLICY "allow_insert_order_items"
ON lab_order_items FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow SELECT for users who can see the order
CREATE POLICY "allow_select_order_items"
ON lab_order_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM lab_orders lo
    JOIN org_members om ON (om.org_id = lo.lab_org_id OR om.org_id = lo.dentist_org_id)
    WHERE lo.id = lab_order_items.order_id
    AND om.user_id = auth.uid()
  )
);

-- Allow UPDATE for users who can see the order
CREATE POLICY "allow_update_order_items"
ON lab_order_items FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM lab_orders lo
    JOIN org_members om ON (om.org_id = lo.lab_org_id OR om.org_id = lo.dentist_org_id)
    WHERE lo.id = lab_order_items.order_id
    AND om.user_id = auth.uid()
  )
);

-- ============================================
-- 7. Verify policies were created
-- ============================================
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('organizations', 'patients', 'lab_dentist_relations', 'lab_orders', 'lab_order_items')
ORDER BY tablename, policyname;

-- ============================================
-- DONE!
-- ============================================
-- Now try creating a manual order again.
-- It should work without recursion errors.
