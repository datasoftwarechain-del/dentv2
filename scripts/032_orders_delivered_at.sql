-- ============================================================
-- 032 - Tracking de fecha exacta de entrega de la orden
-- ============================================================
-- Antes: la columna `invoices.delivery_date` se llenaba como snapshot
-- de `lab_orders.due_date` al momento en que la orden transicionaba a
-- ready/delivered (vía trigger auto_generate_invoice). Eso tenía dos
-- problemas:
--   1) Si la orden no tenía due_date al cambiar de estado, el snapshot
--      quedaba NULL para siempre (la columna ENTREGA del estado de
--      cuenta mostraba "−").
--   2) Editar lab_orders.due_date después de emitir la factura no
--      propagaba al snapshot — quedaba desincronizado.
--
-- Ahora: introducimos `lab_orders.delivered_at` como dato vivo: cuándo
-- la orden pasó a 'delivered'. Se setea automáticamente en BEFORE
-- UPDATE cuando status transiciona, y se limpia si se revierte.
--
-- La UI lee `lab_order.delivered_at` vía JOIN; `invoices.delivery_date`
-- queda en DB pero deja de usarse para la columna ENTREGA del listado.
--
-- Idempotente. Aplicar manualmente desde Supabase SQL Editor.
-- ============================================================

ALTER TABLE lab_orders
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

COMMENT ON COLUMN lab_orders.delivered_at IS
  'Fecha en que la orden pasó a estado delivered. NULL si nunca llegó a ese estado o si volvió atrás. Se setea/desetea automáticamente vía trigger según cambio de status.';

-- Backfill: las órdenes existentes con status='delivered' toman
-- updated_at como aproximación al momento real de entrega.
UPDATE lab_orders
SET delivered_at = updated_at
WHERE status = 'delivered'
  AND delivered_at IS NULL;

-- Trigger BEFORE UPDATE OF status:
--   - Setea delivered_at = NOW() cuando entra a 'delivered'.
--   - Limpia a NULL cuando sale de 'delivered' (revert intencional).
-- IS DISTINCT FROM maneja correctamente el caso OLD.status = NULL.
CREATE OR REPLACE FUNCTION set_delivered_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    NEW.delivered_at := NOW();
  END IF;

  IF OLD.status = 'delivered' AND NEW.status IS DISTINCT FROM 'delivered' THEN
    NEW.delivered_at := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_delivered_at ON lab_orders;
CREATE TRIGGER trigger_set_delivered_at
  BEFORE UPDATE OF status ON lab_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_delivered_at();
