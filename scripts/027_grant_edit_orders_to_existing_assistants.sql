-- ============================================================
-- 027 - Grant edit_orders=true a colaboradores existentes con create_orders
-- ============================================================
--
-- ── NOTAS DE APLICACIÓN ─────────────────────────────────────
-- Qué hace:
--   Para cada org_member con role='collaborator' que ya tiene
--   permissions.create_orders = true pero todavía NO tiene
--   permissions.edit_orders = true, lo actualiza a true.
--   Mitiga el efecto del cambio introducido en BLOQUE 1.5, donde
--   el preset 'assistant' empezó a incluir edit_orders=true pero
--   los colaboradores ya guardados en DB no se sincronizan
--   automáticamente — sin esta migración pueden seguir creando
--   órdenes pero pierden la capacidad de editarlas hasta que un
--   admin les asigne edit_orders manualmente.
--
-- Por qué NO se ejecuta automáticamente:
--   La regla del proyecto es "no migrar retroactivamente datos
--   de colaboradores sin decisión explícita del dueño". Este
--   script existe como atajo opcional; vos decidís cuándo
--   aplicarlo desde Supabase SQL Editor. Si preferís que cada
--   admin re-elija el preset 'assistant' a mano para sus
--   colaboradores, no corras este script.
--
-- Qué NO hace (deliberado):
--   - NO toca delete_orders. Ese flag fue introducido como fix
--     de seguridad lateral en BLOQUE 1.5: antes, cualquier
--     colaborador con create_orders podía borrar órdenes (bug).
--     Ahora borrar requiere delete_orders explícito y NO se
--     auto-concede. Ningún script de migración debe revertir ese
--     corte. Si querés conceder delete_orders a alguien, hacelo
--     una persona a la vez desde la UI de Configuración.
--   - NO toca otros flags nuevos del BLOQUE 1.5 (manage_billing,
--     view_pricing_admin, view_purchases, etc.). Quedan en false
--     por default y se conceden caso por caso.
--
-- Idempotencia:
--   La WHERE clause filtra los que ya tienen edit_orders=true,
--   así que correr el script más de una vez no vuelve a tocar
--   esas filas. La segunda corrida reportará 0 migrados.
--
-- Reporte:
--   El último SELECT devuelve una sola fila con el número de
--   colaboradores efectivamente migrados en esta ejecución.
-- ────────────────────────────────────────────────────────────

WITH affected AS (
  UPDATE org_members
  SET permissions = jsonb_set(
    COALESCE(permissions, '{}'::jsonb),
    '{edit_orders}',
    'true'::jsonb,
    true   -- create_missing: si la clave no existe, la crea
  )
  WHERE role = 'collaborator'
    AND permissions->>'create_orders' = 'true'
    AND (permissions->>'edit_orders' IS NULL
         OR permissions->>'edit_orders' <> 'true')
  RETURNING id
)
SELECT COUNT(*) AS migrated_collaborators
FROM affected;
