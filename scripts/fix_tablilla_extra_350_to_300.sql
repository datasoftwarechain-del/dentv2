-- Fix: extra embebido "Tablilla de dientes" cargado a 350 debe ser 300.
-- Afecta price_catalog cuyo JSONB `extras` contiene la tablilla vieja a 350
-- (típicamente "Terminación de 1 a 5" y otras prótesis).
-- Idempotente: el WHERE solo matchea filas que todavía tienen 350.

-- 1) Ver qué se va a cambiar ANTES de aplicar:
SELECT id, organization_id, name, extras
FROM price_catalog
WHERE extras @> '[{"name": "Tablilla de dientes", "price": 350}]';

-- 2) Aplicar el fix (descomentar para ejecutar):
-- UPDATE price_catalog
-- SET extras = (
--   SELECT jsonb_agg(
--     CASE
--       WHEN elem->>'name' = 'Tablilla de dientes'
--            AND (elem->>'price')::numeric = 350
--       THEN jsonb_set(elem, '{price}', '300')
--       ELSE elem
--     END
--   )
--   FROM jsonb_array_elements(extras) elem
-- )
-- WHERE extras @> '[{"name": "Tablilla de dientes", "price": 350}]';

-- NOTA: órdenes/facturas YA creadas guardan un snapshot en order_items.selected_extras
-- y NO se corrigen con esto. Para arreglar borradores sin facturar, ver script aparte.
