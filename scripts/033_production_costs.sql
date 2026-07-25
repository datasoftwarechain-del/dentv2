-- ============================================================
-- 033_production_costs.sql
-- Control de costos de producción (BLOQUE 7 — Rentabilidad)
-- ============================================================
-- OBJETIVO
--   Habilitar el cálculo de margen real (ganancia) por trabajo,
--   agregando el COSTO de producción junto al precio de venta.
--
-- DISEÑO — costo estándar por arancel
--   - price_catalog.unit_cost: cuánto le cuesta al laboratorio
--     producir ese ítem (materiales + mano de obra estimada).
--     El precio de venta ya vive en base_price. El margen es
--     base_price - unit_cost.
--   - lab_order_items.unit_cost: columna RESERVADA para "congelar"
--     el costo histórico al momento de crear/editar la orden (igual
--     que unit_price congela el precio). Nullable y SIN uso todavía:
--     la vista de Rentabilidad calcula el margen haciendo join en
--     vivo contra price_catalog.unit_cost. Se deja creada para no
--     requerir otra migración cuando se implemente el congelado.
--
-- NO MODIFICA NINGÚN COMPORTAMIENTO ACTUAL
--   Ambas columnas son additivas y con default/nullable. Ninguna
--   query, trigger o flujo existente las lee ni las escribe. La RLS
--   de las tablas queda intacta (price_catalog ya está scopeada por
--   org en 024; lab_order_items hereda su política vigente).
--
-- APLICACIÓN
--   Idempotente. Correr manualmente desde el SQL Editor de Supabase.
-- ============================================================

-- ─── Costo estándar por ítem del catálogo (arancel) ──────────
ALTER TABLE price_catalog
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN price_catalog.unit_cost IS
  'Costo de producción estimado del ítem (materiales + mano de obra). Margen = base_price - unit_cost. Solo visible con permisos financieros.';

-- ─── Costo congelado por línea de orden (reservado, sin uso) ──
ALTER TABLE lab_order_items
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(10,2);

COMMENT ON COLUMN lab_order_items.unit_cost IS
  'RESERVADO: costo histórico congelado al crear/editar la orden. Nullable. Aún no poblado — la vista de Rentabilidad usa join en vivo contra price_catalog.unit_cost.';

DO $$
BEGIN
  RAISE NOTICE '033_production_costs aplicado: price_catalog.unit_cost + lab_order_items.unit_cost';
END $$;
