-- ============================================================
-- 037_design_client_and_payment.sql
-- Cliente solo-diseno + cobro por adelantado
-- ============================================================
-- Requiere haber corrido 037a (solo) y que confirme.
--
-- QUE RESUELVE
--   1. Un cliente que pide un diseno por la web recibia una cuenta
--      'dentist', o sea el ERP completo gratis. Ahora recibe una cuenta
--      'design_client', que solo ve el modulo de diseno.
--   2. La factura se emitia al APROBAR, es decir despues de que el
--      equipo ya habia hecho el trabajo. Para un cliente de otro pais al
--      que no se le puede fiar, eso es al reves. Ahora, en modo prepago,
--      la orden pasa a 'awaiting_payment' al enviarse, se factura ahi
--      mismo, y no entra a la cola hasta que el pago este registrado.
--
-- Idempotente. Correr desde el SQL Editor de Supabase.
-- ============================================================


-- ============================================================
-- 1. GUARD
-- ============================================================
-- Si esto falla con "invalid input value for enum", falta correr 037a
-- solo y esperar a que confirme.

SELECT 'design_client'::org_type AS tipo_disponible;


-- ============================================================
-- 2. La CHECK constraint tiene que admitirlo
-- ============================================================
-- La tabla tiene el enum Y una CHECK que lista los valores (viene de
-- 20260311_portal_preview.sql). Sin actualizarla, el INSERT se rechaza
-- aunque el enum ya acepte el valor.

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_type_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_type_check
  CHECK (type IN ('dentist', 'lab', 'dentist_preview', 'design_studio', 'design_client'));


-- ============================================================
-- 3. Estado 'awaiting_payment' en las ordenes de diseno
-- ============================================================
-- La orden enviada por un cliente prepago espera plata, no un disenador.
-- Un estado propio lo dice; dejarla en 'submitted' haria que el tablero
-- muestre trabajo por asignar que en realidad nadie tiene que tocar.

ALTER TABLE design_orders DROP CONSTRAINT IF EXISTS design_orders_status_check;
ALTER TABLE design_orders ADD CONSTRAINT design_orders_status_check
  CHECK (status IN (
    'draft',
    'submitted',
    'awaiting_payment',
    'needs_info',
    'assigned',
    'in_design',
    'internal_review',
    'client_review',
    'revision_requested',
    'approved',
    'delivered',
    'cancelled'
  ));


-- ============================================================
-- 4. La factura se emite tambien al esperar pago
-- ============================================================
-- Misma funcion que antes, con dos cambios: dispara en
-- 'awaiting_payment' ademas de en 'approved', y el vencimiento de una
-- factura de prepago es inmediato — no tiene sentido dar 30 dias para
-- algo que bloquea el inicio del trabajo.

CREATE OR REPLACE FUNCTION design_order_auto_invoice()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_invoice_id UUID;
  v_total      NUMERIC(10,2);
  v_services   TEXT;
  v_prepago    BOOLEAN;
BEGIN
  IF NEW.status IN ('approved', 'awaiting_payment')
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.invoice_id IS NULL THEN

    SELECT COALESCE(SUM(
             (unit_price * quantity) + COALESCE((
               SELECT SUM(COALESCE((e->>'price')::NUMERIC, 0) * COALESCE((e->>'qty')::NUMERIC, 1))
               FROM jsonb_array_elements(selected_extras) e
             ), 0)
           ), 0)
      INTO v_total
      FROM design_order_items
     WHERE design_order_id = NEW.id;

    -- El detalle que ve el CLIENTE: el nombre del arancel del catalogo,
    -- no el codigo interno.
    SELECT string_agg(DISTINCT COALESCE(pc.name, doi.service_code), ', ')
      INTO v_services
      FROM design_order_items doi
      LEFT JOIN price_catalog pc ON pc.id = doi.catalog_item_id
     WHERE doi.design_order_id = NEW.id;

    v_prepago := (NEW.status = 'awaiting_payment');

    INSERT INTO invoices (
      invoice_number, lab_org_id, dentist_org_id,
      design_order_id, patient_name, work_type,
      delivery_date, status,
      subtotal, tax_rate, tax_amount, total,
      due_date, notes, totals_strict,
      created_at, updated_at
    ) VALUES (
      NEW.order_number,
      NEW.studio_org_id,
      NEW.client_org_id,
      NEW.id,
      COALESCE(NEW.patient_ref, 'Sin referencia'),
      COALESCE(v_services, 'Diseno digital'),
      NEW.due_at,
      'pending',
      v_total, 0, 0, v_total,
      CASE WHEN v_prepago THEN CURRENT_DATE ELSE CURRENT_DATE + INTERVAL '30 days' END,
      CASE WHEN v_prepago
        THEN 'Pago por adelantado de la orden ' || NEW.order_number ||
             '. El diseno empieza cuando se registre el pago.'
        ELSE 'Factura del estudio de diseno para la orden ' || NEW.order_number
      END,
      true,
      now(), now()
    )
    RETURNING id INTO v_invoice_id;

    NEW.invoice_id := v_invoice_id;
  END IF;

  RETURN NEW;
END;
$$;


-- ============================================================
-- 5. Al registrar el pago, la orden entra a la cola sola
-- ============================================================
-- Sin esto habria que acordarse de mover la orden a mano despues de
-- cobrar, y el caso que se olvida es justamente el del cliente que ya
-- pago y esta esperando.

CREATE OR REPLACE FUNCTION design_order_release_on_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'paid'
     AND OLD.status IS DISTINCT FROM 'paid'
     AND NEW.design_order_id IS NOT NULL THEN

    UPDATE design_orders
       SET status = 'submitted'
     WHERE id = NEW.design_order_id
       AND status = 'awaiting_payment';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_release_design_order ON invoices;
CREATE TRIGGER invoices_release_design_order
  AFTER UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION design_order_release_on_payment();


-- ============================================================
-- 6. VERIFICACION
-- ============================================================

SELECT
  (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'org_type' AND e.enumlabel = 'design_client') AS tipo_design_client,
  (SELECT count(*) FROM pg_constraint
    WHERE conname = 'design_orders_status_check'
      AND pg_get_constraintdef(oid) LIKE '%awaiting_payment%') AS estado_awaiting_payment,
  (SELECT count(*) FROM pg_trigger
    WHERE tgname = 'invoices_release_design_order') AS trigger_de_pago;
