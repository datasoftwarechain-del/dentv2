-- ============================================
-- TEMPORARY: Disable RLS for Manual Order Creation
-- ============================================
-- This script temporarily disables RLS on specific tables
-- to allow manual order creation to work.
--
-- ⚠️ WARNING: This is for development/testing only
-- We'll add proper policies later
--
-- Execute this in Supabase SQL Editor

-- ============================================
-- Option 1: Completely disable RLS (EASIEST)
-- ============================================

-- Disable RLS on organizations table
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;

-- Disable RLS on patients table
ALTER TABLE patients DISABLE ROW LEVEL SECURITY;

-- Disable RLS on lab_dentist_relations table
ALTER TABLE lab_dentist_relations DISABLE ROW LEVEL SECURITY;

-- Disable RLS on lab_orders table
ALTER TABLE lab_orders DISABLE ROW LEVEL SECURITY;

-- Disable RLS on lab_order_items table
ALTER TABLE lab_order_items DISABLE ROW LEVEL SECURITY;

-- ============================================
-- Verify RLS is disabled
-- ============================================
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('organizations', 'patients', 'lab_dentist_relations', 'lab_orders', 'lab_order_items')
ORDER BY tablename;

-- Should show rowsecurity = false for all tables

-- ============================================
-- IMPORTANT NOTES
-- ============================================
--
-- This disables ALL row-level security on these tables.
-- This means:
-- ✅ Manual order creation will work
-- ✅ All CRUD operations will work
-- ⚠️ No access control at database level
-- ⚠️ Relies entirely on application-level security
--
-- This is OK for development/testing with trusted users.
-- For production with multiple tenants, you'll need proper RLS.
--
-- To re-enable RLS later, run:
-- ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
-- (and add proper policies)
--
-- ============================================
