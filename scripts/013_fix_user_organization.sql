-- ============================================
-- Fix User Organization Associations
-- ============================================
-- This script fixes users who are stuck without valid organizations

-- ============================================
-- PASO 1: Limpiar membresías incorrectas
-- ============================================

-- Eliminar membresías en organizaciones que son "client records"
-- Los usuarios NO deben ser miembros de registros de cliente
DELETE FROM org_members
WHERE org_id IN (
  SELECT id FROM organizations
  WHERE is_system_account = false
);

-- ============================================
-- PASO 2: Asegurar que organizaciones "lab" existentes sean cuentas del sistema
-- ============================================

-- Si hay organizaciones de tipo 'lab' que NO son system accounts,
-- probablemente deberían serlo (son labs reales del usuario)
UPDATE organizations
SET is_system_account = true
WHERE type = 'lab'
AND is_system_account = false;

-- Lo mismo para dentist organizations que tienen miembros
-- (si tienen miembros, son organizaciones reales, no client records)
UPDATE organizations
SET is_system_account = true
WHERE type = 'dentist'
AND is_system_account = false
AND id IN (
  SELECT DISTINCT org_id FROM org_members
);

-- ============================================
-- PASO 3: Encontrar tu organización de laboratorio
-- ============================================

-- Ver todas las organizaciones de tipo 'lab'
SELECT
  id,
  name,
  type,
  is_system_account,
  created_at,
  (SELECT COUNT(*) FROM org_members WHERE org_id = organizations.id) as member_count
FROM organizations
WHERE type = 'lab'
ORDER BY created_at;

-- ============================================
-- PASO 4: Verificar estado actual de usuarios
-- ============================================

-- Ver qué usuarios tienen organizaciones válidas
SELECT
  u.id,
  u.email,
  o.id as org_id,
  o.name as org_name,
  o.type,
  o.is_system_account,
  om.role
FROM auth.users u
LEFT JOIN org_members om ON u.id = om.user_id
LEFT JOIN organizations o ON om.org_id = o.id
WHERE o.is_system_account = true OR o.id IS NULL
ORDER BY u.email;

-- ============================================
-- PASO 5: Si necesitas re-asociar manualmente un usuario a una organización
-- ============================================

-- DESCOMENTA Y AJUSTA LOS IDs SEGÚN TU CASO:
--
-- INSERT INTO org_members (org_id, user_id, role)
-- VALUES (
--   '[REEMPLAZA_CON_ID_DE_TU_ORGANIZACION_LAB]',
--   '[REEMPLAZA_CON_TU_USER_ID]',
--   'owner'
-- )
-- ON CONFLICT (org_id, user_id) DO NOTHING;

-- ============================================
-- PASO 6: Verificación final
-- ============================================

-- Ver estado final de todas las organizaciones
SELECT
  o.id,
  o.name,
  o.type,
  o.is_system_account,
  COUNT(om.user_id) as member_count,
  STRING_AGG(om.role::text, ', ') as roles
FROM organizations o
LEFT JOIN org_members om ON o.id = om.org_id
GROUP BY o.id, o.name, o.type, o.is_system_account
ORDER BY o.type, o.name;

-- ============================================
-- RESULTADO ESPERADO:
-- ============================================
--
-- - Organizaciones 'lab': is_system_account = true, member_count >= 1
-- - Organizaciones 'dentist' con miembros: is_system_account = true
-- - Organizaciones 'dentist' sin miembros (client records): is_system_account = false
-- - Todos los usuarios deberían tener al menos una organización válida
--
-- ============================================
