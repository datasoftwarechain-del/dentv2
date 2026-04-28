-- ============================================================
-- 028 - Client Price Overrides (aranceles personalizados por cliente)
-- ============================================================
-- BLOQUE 4 of feat/billing-fixes-and-features.
--
-- ── NOTAS DE APLICACIÓN ─────────────────────────────────────
-- 1) Idempotente. CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
--    DROP TRIGGER IF EXISTS / CREATE TRIGGER. Aplicar manualmente desde
--    Supabase SQL Editor cuando estés listo. Sin esto el endpoint y la
--    UI van a fallar con "table does not exist".
--
-- 2) Override SOLO al base_price del catalog_item. Los extras del
--    price_catalog mantienen su precio general para todos los clientes
--    (decisión de scope cerrada por el dueño del proyecto). Si en el
--    futuro hace falta override de extras, será un script nuevo con
--    otra tabla — no modificar esta para agregar esa columna.
--
-- 3) UNIQUE en (lab_org_id, dentist_org_id, catalog_item_id) garantiza
--    un solo override por terna. La operación de "limpiar override"
--    desde la UI es DELETE de la fila, no UPDATE a NULL.
--
-- 4) Las órdenes/facturas ya emitidas NO se ven afectadas. El override
--    solo aplica al unit_price prellenado al CREAR un item nuevo. El
--    valor queda snapshoteado en lab_order_items.unit_price y la orden
--    histórica preserva su precio aunque el override cambie después.
--
-- 5) RLS: mismo patrón que price_catalog (rol-based, miembro de la
--    org del lab). Distinto del USING(true) del resto del proyecto
--    porque el catálogo ya tenía RLS estricto. Mantener consistencia.
-- ────────────────────────────────────────────────────────────

-- 1. Tabla principal
CREATE TABLE IF NOT EXISTS client_price_overrides (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_org_id      UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dentist_org_id  UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  catalog_item_id UUID         NOT NULL REFERENCES price_catalog(id) ON DELETE CASCADE,
  custom_price    NUMERIC(10,2) NOT NULL CHECK (custom_price >= 0),
  notes           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT client_price_overrides_unique
    UNIQUE (lab_org_id, dentist_org_id, catalog_item_id)
);

-- 2. Índices para queries frecuentes
-- a) Lookup batch al crear orden/factura: filtrá por lab+dentist y traé todo.
CREATE INDEX IF NOT EXISTS client_price_overrides_lookup_idx
  ON client_price_overrides (lab_org_id, dentist_org_id);

-- b) Cleanup al borrar un catalog_item.
CREATE INDEX IF NOT EXISTS client_price_overrides_catalog_idx
  ON client_price_overrides (catalog_item_id);

-- 3. RLS — solo los miembros del lab que emitió el override
ALTER TABLE client_price_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_price_overrides_lab_all"
  ON client_price_overrides
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id  = client_price_overrides.lab_org_id
        AND org_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id  = client_price_overrides.lab_org_id
        AND org_members.user_id = auth.uid()
    )
  );

-- 4. Trigger updated_at
CREATE OR REPLACE FUNCTION client_price_overrides_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS client_price_overrides_updated_at ON client_price_overrides;
CREATE TRIGGER client_price_overrides_updated_at
  BEFORE UPDATE ON client_price_overrides
  FOR EACH ROW
  EXECUTE FUNCTION client_price_overrides_set_updated_at();

-- 5. Comments para documentación in-DB
COMMENT ON TABLE client_price_overrides IS
  '[BLOQUE 4] Aranceles personalizados por cliente del lab. Override del base_price del catálogo SOLO. Los extras siguen el precio general. Las órdenes ya emitidas no se recalculan — el override aplica al unit_price prellenado al crear nuevos items.';

COMMENT ON COLUMN client_price_overrides.custom_price IS
  'Reemplaza price_catalog.base_price para esta combinación (lab, dentist, item). NO afecta los extras del catálogo.';
