-- ============================================================
-- 039_invoice_work_type_backfill_fix.sql
-- Completa el backfill de la 038 (42 facturas que quedaron)
-- ============================================================
-- POR QUE HIZO FALTA
--   El guard de la 038 comparaba work_type con una recomputacion
--   exacta de lo que escribio el trigger viejo. Fallo en dos casos:
--     1. El trigger viejo hacia array_agg(DISTINCT work_type) sobre el
--        ENUM, que ordena por posicion de declaracion ("protesis_removible,
--        otro"). La recomputacion lo hacia sobre ::text, alfabetico
--        ("otro, protesis_removible"). 31 facturas no coincidieron.
--     2. Si se agrego un item DESPUES de facturar, el valor guardado ya
--        no es igual a la agregacion actual. 11 facturas mas.
--
-- EL GUARD CORRECTO
--   No "es igual a lo que recomputo" sino "esta hecho SOLO de codigos
--   del enum work_type". Una persona que edita la descripcion escribe
--   "Reparacion de urgencia sin cargo", nunca "protesis_removible, otro".
--   Ese patron identifica lo que escribio la maquina sin depender del
--   orden ni de que los items no hayan cambiado.
--
-- Idempotente. Requiere la 038 (usa lab_order_work_description).
-- ============================================================

-- ─── 1. Backfill: todo lo que sea puro codigo de enum ───────
-- Cada token separado por ', ' tiene que ser un valor valido del enum.
-- El primer test descarta rapido por forma; el segundo confirma que
-- cada token existe en el enum, para no tocar un texto libre que por
-- casualidad sea minusculas con guiones bajos.

UPDATE invoices i
   SET work_type = lab_order_work_description(i.order_id),
       updated_at = now()
 WHERE i.order_id IS NOT NULL
   AND i.work_type ~ '^[a-z_]+(, [a-z_]+)*$'
   AND NOT EXISTS (
         SELECT 1
           FROM unnest(string_to_array(i.work_type, ', ')) AS t(token)
          WHERE t.token NOT IN (SELECT enumlabel FROM pg_enum e
                                  JOIN pg_type ty ON ty.oid = e.enumtypid
                                 WHERE ty.typname = 'work_type')
       )
   AND lab_order_work_description(i.order_id) IS DISTINCT FROM i.work_type;


-- ─── 2. Verificacion ────────────────────────────────────────
-- Tiene que quedar en 0, salvo facturas cuyos items no tienen ningun
-- arancel de catalogo (para esas no hay nombre mejor que la categoria).

SELECT
  (SELECT count(*) FROM invoices i
    WHERE i.order_id IS NOT NULL
      AND i.work_type ~ '^[a-z_]+(, [a-z_]+)*$') AS aun_con_codigo_enum,
  (SELECT count(*) FROM invoices i
    WHERE i.order_id IS NOT NULL
      AND i.work_type ~ '^[a-z_]+(, [a-z_]+)*$'
      AND NOT EXISTS (SELECT 1 FROM lab_order_items loi
                       WHERE loi.order_id = i.order_id
                         AND loi.catalog_item_id IS NOT NULL)) AS de_esas_sin_catalogo;
