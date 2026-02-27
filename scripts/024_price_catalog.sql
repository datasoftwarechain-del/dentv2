-- ============================================================
-- 024_price_catalog.sql
-- Catálogo de precios por organización
-- Sirve para laboratorios (arancel) y dentistas (servicios a pacientes)
-- ============================================================

-- 1. Tabla principal
CREATE TABLE IF NOT EXISTS price_catalog (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category    TEXT        NOT NULL DEFAULT 'General',
  name        TEXT        NOT NULL,
  base_price  NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- extras: [{name: string, price: number}]
  extras      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS price_catalog_org_idx        ON price_catalog(org_id);
CREATE INDEX IF NOT EXISTS price_catalog_org_active_idx ON price_catalog(org_id) WHERE is_active = true;

-- 3. RLS
ALTER TABLE price_catalog ENABLE ROW LEVEL SECURITY;

-- Solo los miembros de la org pueden gestionar su propio catálogo
CREATE POLICY "price_catalog_own_org_all"
  ON price_catalog
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id  = price_catalog.org_id
        AND org_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id  = price_catalog.org_id
        AND org_members.user_id = auth.uid()
    )
  );

-- 4. Trigger updated_at
CREATE OR REPLACE FUNCTION price_catalog_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS price_catalog_updated_at ON price_catalog;
CREATE TRIGGER price_catalog_updated_at
  BEFORE UPDATE ON price_catalog
  FOR EACH ROW EXECUTE FUNCTION price_catalog_set_updated_at();

-- 5. Agregar columnas a lab_order_items para rastrear el catálogo usado
ALTER TABLE lab_order_items
  ADD COLUMN IF NOT EXISTS catalog_item_id  UUID    REFERENCES price_catalog(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS selected_extras  JSONB   NOT NULL DEFAULT '[]'::jsonb;

-- catalog_item_id: referencia al ítem del catálogo que generó este trabajo
-- selected_extras: extras elegidos al crear la orden [{name, price}]
-- unit_price ya existía y ahora se auto-llena desde base_price + sum(extras seleccionados)
