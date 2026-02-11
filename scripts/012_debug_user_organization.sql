-- ============================================
-- Debug User Organization Issue
-- ============================================
-- This script helps identify and fix user organization issues

-- ============================================
-- 1. Ver todas las organizaciones y sus miembros
-- ============================================

SELECT
  o.id,
  o.name,
  o.type,
  o.is_system_account,
  o.created_at,
  COUNT(om.user_id) as member_count,
  STRING_AGG(u.email::text, ', ') as member_emails
FROM organizations o
LEFT JOIN org_members om ON o.id = om.org_id
LEFT JOIN auth.users u ON om.user_id = u.id
GROUP BY o.id, o.name, o.type, o.is_system_account, o.created_at
ORDER BY o.created_at DESC;

-- ============================================
-- 2. Ver organizaciones de tipo 'lab'
-- ============================================

SELECT
  o.id,
  o.name,
  o.type,
  o.is_system_account,
  COUNT(om.user_id) as member_count
FROM organizations o
LEFT JOIN org_members om ON o.id = om.org_id
WHERE o.type = 'lab'
GROUP BY o.id, o.name, o.type, o.is_system_account
ORDER BY o.created_at DESC;

-- ============================================
-- 3. Ver qué organizaciones están asociadas a cada usuario
-- ============================================

SELECT
  u.id as user_id,
  u.email,
  o.id as org_id,
  o.name as org_name,
  o.type as org_type,
  o.is_system_account,
  om.role
FROM auth.users u
LEFT JOIN org_members om ON u.id = om.user_id
LEFT JOIN organizations o ON om.org_id = o.id
ORDER BY u.email, o.name;

-- ============================================
-- 4. Encontrar usuarios sin organización válida
-- ============================================

SELECT
  u.id,
  u.email,
  u.created_at
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1
  FROM org_members om
  JOIN organizations o ON om.org_id = o.id
  WHERE om.user_id = u.id
  AND o.is_system_account = true
);

-- ============================================
-- 5. Ver membresías en organizaciones que son "client records"
-- ============================================

SELECT
  u.email,
  o.name as org_name,
  o.type,
  o.is_system_account,
  om.role
FROM org_members om
JOIN auth.users u ON om.user_id = u.id
JOIN organizations o ON om.org_id = o.id
WHERE o.is_system_account = false;

-- Si aparecen registros aquí, son membresías incorrectas que deben eliminarse
