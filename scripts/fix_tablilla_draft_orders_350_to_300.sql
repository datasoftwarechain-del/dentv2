-- Fix: snapshot "Tablilla de dientes" a 350 en items de órdenes AÚN NO FACTURADAS.
-- "Sin facturar" = lab_orders.invoice_id IS NULL (la factura se auto-genera al
-- pasar a ready/delivered leyendo lab_order_items.selected_extras — ver 026b).
-- Las órdenes ya facturadas (invoice_id NOT NULL) NO se tocan.
-- Idempotente: el WHERE solo matchea items que todavía tienen 350.

-- 1) Ver qué items se van a cambiar ANTES de aplicar:
SELECT li.id, li.order_id, o.status, li.selected_extras
FROM lab_order_items li
JOIN lab_orders o ON o.id = li.order_id
WHERE o.invoice_id IS NULL
  AND li.selected_extras @> '[{"name": "Tablilla de dientes", "price": 350}]';

-- 2) Aplicar el fix (descomentar para ejecutar):
-- UPDATE lab_order_items li
-- SET selected_extras = (
--   SELECT jsonb_agg(
--     CASE
--       WHEN elem->>'name' = 'Tablilla de dientes'
--            AND (elem->>'price')::numeric = 350
--       THEN jsonb_set(elem, '{price}', '300')
--       ELSE elem
--     END
--   )
--   FROM jsonb_array_elements(li.selected_extras) elem
-- )
-- FROM lab_orders o
-- WHERE li.order_id = o.id
--   AND o.invoice_id IS NULL
--   AND li.selected_extras @> '[{"name": "Tablilla de dientes", "price": 350}]';
