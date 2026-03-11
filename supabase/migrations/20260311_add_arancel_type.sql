-- Migración: agregar arancel_type a catálogo y a items de órdenes
-- Fecha: 2026-03-11
-- Aplicar manualmente en Supabase SQL Editor

-- ── 1. Agregar columna arancel_type en price_catalog ─────────────────────
ALTER TABLE price_catalog
  ADD COLUMN IF NOT EXISTS arancel_type TEXT
  CHECK (arancel_type IN (
    'simple',
    'plus_terminaciones',
    'plus_completas',
    'cubeta_individual',
    'protesis_completa_pack'
  ));

-- ── 2. Agregar columna arancel_type en lab_order_items ───────────────────
ALTER TABLE lab_order_items
  ADD COLUMN IF NOT EXISTS arancel_type TEXT
  CHECK (arancel_type IN (
    'simple',
    'plus_terminaciones',
    'plus_completas',
    'cubeta_individual',
    'protesis_completa_pack'
  ));

-- ── 3. Índice para filtrar por arancel en catálogo ───────────────────────
CREATE INDEX IF NOT EXISTS idx_price_catalog_arancel_type
  ON price_catalog (arancel_type)
  WHERE arancel_type IS NOT NULL;
