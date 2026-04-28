-- ============================================================
-- 029 - Purchases + Inventory + Movements
-- ============================================================
-- BLOQUE 6 of feat/billing-fixes-and-features.
--
-- ── NOTAS DE APLICACIÓN ─────────────────────────────────────
-- 1) Idempotente. CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT
--    EXISTS, DROP TRIGGER IF EXISTS / CREATE TRIGGER. Aplicar
--    manualmente desde Supabase SQL Editor.
--
-- 2) RLS rol-based para las tres tablas (mismo patrón que
--    price_catalog y client_price_overrides). Solo miembros de la
--    org del lab acceden a sus propias filas.
--
-- 3) inventory_movements deja la estructura preparada para vincular
--    movimientos a una compra (related_purchase_id) o a una orden
--    (related_order_id). Ambos NULL-ables. La lógica "al comprar
--    entra al stock" / "al usar en orden sale del stock" NO está
--    incluida — es BLOQUE futuro. Acá solo la tabla.
--
-- 4) purchases.category usa CHECK constraint con un set fijo:
--    materials, equipment, services, other. Si más adelante hace
--    falta agregar más, ALTER TABLE ... ADD CONSTRAINT.
-- ────────────────────────────────────────────────────────────

-- ─── purchases ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_org_id      UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_name   TEXT         NOT NULL,
  invoice_ref     TEXT,
  total           NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  purchase_date   DATE         NOT NULL DEFAULT CURRENT_DATE,
  category        TEXT         NOT NULL DEFAULT 'materials'
                  CHECK (category IN ('materials','equipment','services','other')),
  notes           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchases_org_idx       ON purchases (lab_org_id);
CREATE INDEX IF NOT EXISTS purchases_org_date_idx  ON purchases (lab_org_id, purchase_date DESC);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchases_lab_all" ON purchases;
CREATE POLICY "purchases_lab_all"
  ON purchases
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id  = purchases.lab_org_id
        AND org_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id  = purchases.lab_org_id
        AND org_members.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION purchases_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS purchases_updated_at ON purchases;
CREATE TRIGGER purchases_updated_at BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION purchases_set_updated_at();

COMMENT ON TABLE  purchases IS '[BLOQUE 6] Compras a proveedores del laboratorio. Lab-only.';
COMMENT ON COLUMN purchases.category IS 'materials | equipment | services | other';

-- ─── inventory_items ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_items (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_org_id      UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT         NOT NULL,
  unit            TEXT         NOT NULL DEFAULT 'unidad',
  current_stock   NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_stock       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  unit_cost       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  notes           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT inventory_items_org_name_unique UNIQUE (lab_org_id, name)
);

CREATE INDEX IF NOT EXISTS inventory_items_org_idx ON inventory_items (lab_org_id);
-- Partial index para alertas de bajo stock
CREATE INDEX IF NOT EXISTS inventory_items_low_stock_idx
  ON inventory_items (lab_org_id)
  WHERE current_stock < min_stock;

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_items_lab_all" ON inventory_items;
CREATE POLICY "inventory_items_lab_all"
  ON inventory_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id  = inventory_items.lab_org_id
        AND org_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id  = inventory_items.lab_org_id
        AND org_members.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION inventory_items_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS inventory_items_updated_at ON inventory_items;
CREATE TRIGGER inventory_items_updated_at BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION inventory_items_set_updated_at();

COMMENT ON TABLE  inventory_items IS '[BLOQUE 6] Materiales en stock del lab. UNIQUE(lab_org_id, name) evita duplicados de nombres dentro del mismo lab.';

-- ─── inventory_movements ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_movements (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_org_id          UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  inventory_item_id   UUID         NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  movement_type       TEXT         NOT NULL CHECK (movement_type IN ('in','out','adjust')),
  quantity            NUMERIC(12,2) NOT NULL,
  reason              TEXT,
  -- [BLOQUE 6] Vinculación opcional. Estructura lista; flujos automáticos
  -- (compra → entrada al stock, orden → salida del stock) NO implementados
  -- todavía. Pertenecen a un BLOQUE futuro.
  related_purchase_id UUID         REFERENCES purchases(id)  ON DELETE SET NULL,
  related_order_id    UUID         REFERENCES lab_orders(id) ON DELETE SET NULL,
  created_by          UUID         REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_movements_org_idx          ON inventory_movements (lab_org_id);
CREATE INDEX IF NOT EXISTS inventory_movements_item_idx         ON inventory_movements (inventory_item_id);
CREATE INDEX IF NOT EXISTS inventory_movements_purchase_idx     ON inventory_movements (related_purchase_id) WHERE related_purchase_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inventory_movements_order_idx        ON inventory_movements (related_order_id)    WHERE related_order_id    IS NOT NULL;

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_movements_lab_all" ON inventory_movements;
CREATE POLICY "inventory_movements_lab_all"
  ON inventory_movements
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id  = inventory_movements.lab_org_id
        AND org_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id  = inventory_movements.lab_org_id
        AND org_members.user_id = auth.uid()
    )
  );

COMMENT ON TABLE inventory_movements IS '[BLOQUE 6] Movimientos de stock (in/out/adjust). FKs a purchases y lab_orders están listas para flujos futuros, NO se usan en BLOQUE 6.';
