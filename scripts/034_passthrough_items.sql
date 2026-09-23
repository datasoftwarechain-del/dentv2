-- ============================================================
-- 034_passthrough_items.sql
-- Aranceles tercerizados ("facturación muerta")
-- ============================================================
-- OBJETIVO
--   Marcar los aranceles que el laboratorio factura al cliente pero
--   sobre los que NO gana nada, porque el trabajo es tercerizado y el
--   costo es el 100% del precio (caso testigo: "Esqueleto de cromo").
--
--   Estos ítems inflan el total facturado del mes sin aportar margen.
--   El flag permite descontarlos de las métricas de gestión SIN dejar
--   de cobrárselos al cliente.
--
-- QUÉ CAMBIA Y QUÉ NO
--   ✅ Cambia: las tarjetas "Este Mes" / "Mes Anterior" del dashboard
--      de Facturación pasan a mostrar el neto (sin tercerizados), con
--      el monto tercerizado desglosado abajo.
--   ✅ Cambia: la pestaña Rentabilidad imputa costo = ingreso a estos
--      ítems, así dejan de figurar con 100% de margen cuando todavía
--      no se cargó su unit_cost.
--   ❌ NO cambia: la factura del cliente. El ítem se sigue cobrando
--      exactamente igual. invoices.total, el estado de cuenta, el saldo
--      y el libro mayor quedan intactos.
--   ❌ NO cambia: nada retroactivo en lab_order_items. El flag se lee
--      en vivo desde price_catalog vía catalog_item_id, así que aplica
--      igual a las facturas ya emitidas sin tocarles el total.
--
-- RELACIÓN CON 033 (unit_cost)
--   Son complementarios. unit_cost sirve para el margen real de los
--   trabajos propios; is_passthrough es el atajo para los tercerizados,
--   donde por definición margen = 0 y no hace falta cargar el costo.
--   Si algún día cargás unit_cost = base_price en el cromo, el
--   resultado es el mismo: el flag solo evita tener que hacerlo.
--
-- APLICACIÓN
--   Idempotente. Correr manualmente desde el SQL Editor de Supabase.
-- ============================================================

-- ─── 1. Flag en el catálogo ──────────────────────────────────
ALTER TABLE price_catalog
  ADD COLUMN IF NOT EXISTS is_passthrough BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN price_catalog.is_passthrough IS
  'true = trabajo tercerizado sin margen ("facturación muerta"). Se cobra al cliente igual, pero se descuenta de las métricas de gestión (Este Mes / Mes Anterior) y se imputa costo = ingreso en Rentabilidad. NO afecta invoices.total ni el saldo del cliente.';

-- ─── 2. Índice parcial: son pocos ítems sobre muchos ─────────
CREATE INDEX IF NOT EXISTS price_catalog_passthrough_idx
  ON price_catalog (org_id) WHERE is_passthrough = true;

-- ─── 3. Marcar el caso testigo: esqueleto de cromo ───────────
-- Idempotente: si ya está marcado no hace nada. Ajustá el patrón o
-- desmarcá desde Ajustes → Catálogo de precios si hace falta.
UPDATE price_catalog
   SET is_passthrough = true
 WHERE name ILIKE '%cromo%'
   AND is_passthrough = false;

DO $$
DECLARE v_count INTEGER;
BEGIN
  SELECT count(*) INTO v_count FROM price_catalog WHERE is_passthrough = true;
  RAISE NOTICE '034_passthrough_items aplicado: % arancel(es) marcados como tercerizados.', v_count;
END $$;
