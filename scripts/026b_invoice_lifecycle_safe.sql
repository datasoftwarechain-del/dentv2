-- ============================================================
-- 026b - Invoice lifecycle (versión SEGURA, idempotente)
-- ============================================================
-- Reemplaza al script original 026_invoice_number_matches_order.sql
-- (ese queda untracked como referencia, no debe ejecutarse).
--
-- ── NOTAS DE APLICACIÓN ─────────────────────────────────────
-- 1) Este archivo crece a medida que avanzan los bloques de la rama
--    feat/billing-fixes-and-features. Acumula cambios SQL del lifecycle
--    de facturas (numeración, columna totals_strict, trigger
--    auto_generate_invoice, etc.). Aplicar de una sola vez al final.
--
-- 2) ESTE SCRIPT NO DEBE EJECUTARSE hasta confirmación explícita del
--    dueño del proyecto. Aplicar manualmente desde Supabase SQL Editor.
--    Las facturas viejas (114 con order_id, todas alineadas) son fuente
--    de verdad histórica — nada las puede pisar.
--
-- 3) BLOQUE 3 (delete factura) agregará al final de este archivo:
--    - Columna invoice_voided_at en lab_orders.
--    - Guarda en auto_generate_invoice contra re-emisión post-delete.
--    Esos cambios se diseñan en BLOQUE 3, no antes.
--
-- 4) Cambios incluidos hasta el momento:
--    - [BLOQUE 1] ALTER TABLE invoices ADD COLUMN totals_strict BOOLEAN.
--    - [BLOQUE 1] generate_invoice_number respeta invoice_number manual.
--    - [BLOQUE 1] auto_generate_invoice setea totals_strict=true en INSERT.
--    - El UPDATE retroactivo del 026 original NO está incluido.
--
-- 5) Importante para BLOQUE 1: la columna totals_strict debe aplicarse
--    ANTES de que el código nuevo escriba en invoices con ese campo.
--    Si todavía no aplicaste el ALTER TABLE, las nuevas facturas creadas
--    por la API o por el trigger fallarán con "column does not exist".
--    Coordinar deploy + apply.
-- ────────────────────────────────────────────────────────────

-- ─── [BLOQUE 1] Columna totals_strict ────────────────────────
-- Las 114 facturas existentes quedan en false (default).
-- Las facturas nuevas (creadas por el código actualizado o el trigger)
-- se insertan con true → su total/subtotal son recalculables desde items.
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS totals_strict BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN invoices.totals_strict IS
  'true = subtotal/total son recalculables desde lab_order_items + extras. false = factura histórica, montos persistidos son fuente de verdad y no deben recalcularse.';

-- Mantener disponible el formato FAC para facturas manuales
CREATE SEQUENCE IF NOT EXISTS fac_number_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION next_fac_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'FAC-' || TO_CHAR(NOW(), 'YYMM') || '-' || LPAD(nextval('fac_number_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Asignar número según contexto al insertar facturas
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  v_order_number TEXT;
BEGIN
  -- Respetar números seteados manualmente (no pisar si ya viene con valor)
  IF NEW.invoice_number IS NOT NULL AND NEW.invoice_number <> '' THEN
    RETURN NEW;
  END IF;

  IF NEW.order_id IS NOT NULL THEN
    SELECT order_number INTO v_order_number
    FROM lab_orders
    WHERE id = NEW.order_id;

    IF v_order_number IS NOT NULL AND v_order_number <> '' THEN
      NEW.invoice_number := v_order_number;
      RETURN NEW;
    END IF;
  END IF;

  NEW.invoice_number := next_fac_number();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger de auto-factura desde órdenes listas/entregadas
CREATE OR REPLACE FUNCTION auto_generate_invoice()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id UUID;
  v_total DECIMAL(10,2);
  v_invoice_number TEXT;
  v_patient_name TEXT;
  v_patient_id UUID;
  v_work_type TEXT;
  v_work_types TEXT[];
BEGIN
  IF (NEW.status = 'ready' OR NEW.status = 'delivered')
     AND (OLD.status != 'ready' AND OLD.status != 'delivered')
     AND NEW.invoice_id IS NULL THEN

    IF NEW.patient_id IS NOT NULL THEN
      SELECT COALESCE(first_name || ' ' || last_name, 'Sin paciente'), id
      INTO v_patient_name, v_patient_id
      FROM patients
      WHERE id = NEW.patient_id;
    END IF;

    IF v_patient_name IS NULL OR v_patient_name = '' THEN
      v_patient_name := 'Sin paciente asignado';
      v_patient_id := NULL;
    END IF;

    SELECT array_agg(DISTINCT work_type)
    INTO v_work_types
    FROM lab_order_items
    WHERE order_id = NEW.id AND work_type IS NOT NULL;

    IF v_work_types IS NOT NULL AND array_length(v_work_types, 1) > 0 THEN
      v_work_type := array_to_string(v_work_types, ', ');
    ELSE
      v_work_type := 'Trabajo dental';
    END IF;

    -- Total = Σ(unit_price × quantity) + Σ(extras.price × extras.qty × quantity_item).
    -- Los extras viven en lab_order_items.selected_extras (JSONB).
    SELECT COALESCE(SUM(
      (unit_price * quantity) +
      COALESCE((
        SELECT SUM((e->>'price')::numeric * COALESCE((e->>'qty')::numeric, 1))
        FROM jsonb_array_elements(COALESCE(selected_extras, '[]'::jsonb)) e
      ), 0) * quantity
    ), 0)
    INTO v_total
    FROM lab_order_items
    WHERE order_id = NEW.id;

    IF v_total = 0 THEN
      v_total := 500.00;
    END IF;

    v_invoice_number := NEW.order_number;

    INSERT INTO invoices (
      invoice_number,
      lab_org_id, dentist_org_id, order_id,
      patient_name, patient_id, work_type,
      delivery_date, status,
      subtotal, tax_rate, tax_amount, total,
      due_date, notes,
      totals_strict,
      created_at, updated_at
    ) VALUES (
      v_invoice_number,
      NEW.lab_org_id, NEW.dentist_org_id, NEW.id,
      v_patient_name, v_patient_id, v_work_type,
      NEW.due_date, 'pending',
      v_total, 0, 0, v_total,
      CURRENT_DATE + INTERVAL '30 days',
      'Orden ' || NEW.order_number,
      true,  -- [BLOQUE 1] facturas auto-emitidas son recalculables desde items
      NOW(), NOW()
    )
    RETURNING id INTO v_invoice_id;

    NEW.invoice_id := v_invoice_id;

    RAISE NOTICE 'Factura % generada para orden %', v_invoice_number, NEW.order_number;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_invoice ON lab_orders;
CREATE TRIGGER trigger_auto_invoice
  BEFORE UPDATE ON lab_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_invoice();

-- NOTA: El UPDATE retroactivo del script original (alinear histórico)
-- fue eliminado intencionalmente. NO se renumera ninguna factura existente.
