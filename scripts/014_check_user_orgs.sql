-- Ver cuántas organizaciones tiene cada usuario
SELECT
  u.email,
  COUNT(om.org_id) as org_count,
  STRING_AGG(o.name || ' (' || o.type || ')', ', ') as organizations
FROM auth.users u
JOIN org_members om ON u.id = om.user_id
JOIN organizations o ON om.org_id = o.id
WHERE o.is_system_account = true
GROUP BY u.email
HAVING COUNT(om.org_id) > 1
ORDER BY org_count DESC;

-- Si hay usuarios con múltiples orgs, necesitamos decidir cuál usar
