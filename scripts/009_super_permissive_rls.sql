-- ============================================
-- Super Permissive RLS (Alternative to disabling)
-- ============================================
-- This keeps RLS enabled but makes policies very permissive
-- Better than disabling RLS completely
--
-- Execute this in Supabase SQL Editor

-- ============================================
-- 1. Drop ALL existing policies
-- ============================================

-- Organizations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'organizations')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON organizations';
    END LOOP;
END $$;

-- Patients
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'patients')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON patients';
    END LOOP;
END $$;

-- Lab dentist relations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'lab_dentist_relations')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON lab_dentist_relations';
    END LOOP;
END $$;

-- Lab orders
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'lab_orders')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON lab_orders';
    END LOOP;
END $$;

-- Lab order items
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'lab_order_items')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON lab_order_items';
    END LOOP;
END $$;

-- ============================================
-- 2. Create SUPER PERMISSIVE policies
-- ============================================

-- ORGANIZATIONS: Allow all operations for authenticated users
CREATE POLICY "allow_all_on_organizations"
ON organizations
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- PATIENTS: Allow all operations for authenticated users
CREATE POLICY "allow_all_on_patients"
ON patients
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- LAB_DENTIST_RELATIONS: Allow all operations for authenticated users
CREATE POLICY "allow_all_on_relations"
ON lab_dentist_relations
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- LAB_ORDERS: Allow all operations for authenticated users
CREATE POLICY "allow_all_on_orders"
ON lab_orders
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- LAB_ORDER_ITEMS: Allow all operations for authenticated users
CREATE POLICY "allow_all_on_order_items"
ON lab_order_items
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- 3. Ensure RLS is ENABLED
-- ============================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_dentist_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_order_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. Verify policies
-- ============================================
SELECT
  tablename,
  policyname,
  cmd,
  qual::text as using_expression,
  with_check::text as with_check_expression
FROM pg_policies
WHERE tablename IN ('organizations', 'patients', 'lab_dentist_relations', 'lab_orders', 'lab_order_items')
ORDER BY tablename;

-- ============================================
-- IMPORTANT NOTES
-- ============================================
--
-- These policies allow ALL authenticated users to do ANYTHING.
-- Security is now handled entirely by your application layer.
--
-- ✅ Pros:
-- - Manual order creation will work
-- - No RLS conflicts or recursion
-- - Simple and predictable
--
-- ⚠️ Cons:
-- - Any authenticated user can access any data
-- - Relies on application-level authorization
--
-- This is acceptable for:
-- - Single-tenant applications
-- - Trusted user environments
-- - Development/testing
--
-- For multi-tenant production, you'll need more restrictive policies.
--
-- ============================================
