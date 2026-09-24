-- ============================================================
-- 039_invoice_work_type_backfill_fix.sql
-- Completa el backfill de la 038 (42 facturas que quedaron)
-- ============================================================
-- POR QUE HIZO FALTA
--   El guard de la 038 comparaba work_type con una recomputacion exacta
--   y fallo en dos casos: el trigger viejo agregaba sobre el ENUM (orden
--   de declaracion: "protesis_removible, otro") y la recomputacion sobre
--   ::text (alfabetico); y las facturas cuyos items cambiaron despues de
--   emitirse ya no coincidian con nada.
--
-- EL GUARD CORRECTO
--   "Esta hecho SOLO de codigos de categoria". Una persona que edita la
--   descripcion escribe "Reparacion de urgencia", nunca
--   "protesis_removible, otro". Los codigos validos se toman de los
--   valores que de verdad existen en lab_order_items: no depende del
--   nombre del enum ni de su orden.
--
-- SE AUTORREPORTA
--   Es UNA sola sentencia que actualiza y devuelve cuantas facturas toco
--   y cuales. Un resultado de 0 significa que el guard no encontro nada,
--   no que "se aplico".
--
-- Idempotente. Requiere la 038 (usa lab_order_work_description).
-- ============================================================

WITH codigos AS (
  SELECT DISTINCT work_type::text AS codigo
    FROM lab_order_items
   WHERE work_type IS NOT NULL
),
candidatas AS (
  SELECT i.id, i.invoice_number
    FROM invoices i
   WHERE i.order_id IS NOT NULL
     AND i.work_type ~ '^[a-z_]+(, [a-z_]+)*$'
     -- todos los tokens son codigos reales de categoria
     AND NOT EXISTS (
           SELECT 1
             FROM unnest(string_to_array(i.work_type, ', ')) AS t(token)
            WHERE t.token NOT IN (SELECT codigo FROM codigos)
         )
     -- y hay un nombre de producto mejor que poner
     AND lab_order_work_description(i.order_id) IS DISTINCT FROM i.work_type
),
corregidas AS (
  UPDATE invoices i
     SET work_type  = lab_order_work_description(i.order_id),
         updated_at = now()
    FROM candidatas c
   WHERE i.id = c.id
  RETURNING c.invoice_number
)
SELECT count(*)                                   AS facturas_corregidas,
       string_agg(invoice_number, ', ' ORDER BY invoice_number) AS cuales
  FROM corregidas;
