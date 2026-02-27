-- ============================================================
-- 025 - Nuevo formato de número de factura: FAC-YYMM-NNNN
-- Reemplaza el ORD-timestamp-random que se copiaba de la orden
-- ============================================================

-- Crear secuencia para el nuevo formato (global, no por mes)
CREATE SEQUENCE IF NOT EXISTS fac_number_seq START WITH 1 INCREMENT BY 1;

-- ── Función auxiliar para generar el número ─────────────────
CREATE OR REPLACE FUNCTION next_fac_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'FAC-' || TO_CHAR(NOW(), 'YYMM') || '-' || LPAD(nextval('fac_number_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ── Actualizar generate_invoice_number (inserts directos) ───
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.invoice_number := next_fac_number();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Actualizar auto_generate_invoice (trigger en lab_orders) ─
CREATE OR REPLACE FUNCTION auto_generate_invoice()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id    UUID;
  v_total         DECIMAL(10,2);
  v_invoice_number TEXT;
  v_patient_name  TEXT;
  v_patient_id    UUID;
  v_work_type     TEXT;
  v_work_types    TEXT[];
BEGIN
  -- Solo generar si cambia a 'ready' o 'delivered' y aún no tiene factura
  IF (NEW.status = 'ready' OR NEW.status = 'delivered')
     AND (OLD.status != 'ready' AND OLD.status != 'delivered')
     AND NEW.invoice_id IS NULL THEN

    -- Datos del paciente
    IF NEW.patient_id IS NOT NULL THEN
      SELECT COALESCE(first_name || ' ' || last_name, 'Sin paciente'), id
        INTO v_patient_name, v_patient_id
        FROM patients
       WHERE id = NEW.patient_id;
    END IF;

    IF v_patient_name IS NULL OR v_patient_name = '' THEN
      v_patient_name := 'Sin paciente asignado';
      v_patient_id   := NULL;
    END IF;

    -- Tipos de trabajo del pedido
    SELECT array_agg(DISTINCT work_type)
      INTO v_work_types
      FROM lab_order_items
     WHERE order_id = NEW.id AND work_type IS NOT NULL;

    IF v_work_types IS NOT NULL AND array_length(v_work_types, 1) > 0 THEN
      v_work_type := array_to_string(v_work_types, ', ');
    ELSE
      v_work_type := 'Trabajo dental';
    END IF;

    -- Total de la orden
    SELECT COALESCE(SUM(unit_price * quantity), 0)
      INTO v_total
      FROM lab_order_items
     WHERE order_id = NEW.id;

    IF v_total = 0 THEN
      v_total := 500.00;
    END IF;

    -- Nuevo número corto: FAC-YYMM-NNNN
    v_invoice_number := next_fac_number();

    INSERT INTO invoices (
      invoice_number,
      lab_org_id, dentist_org_id, order_id,
      patient_name, patient_id, work_type,
      delivery_date, status,
      subtotal, tax_rate, tax_amount, total,
      due_date, notes,
      created_at, updated_at
    ) VALUES (
      v_invoice_number,
      NEW.lab_org_id, NEW.dentist_org_id, NEW.id,
      v_patient_name, v_patient_id, v_work_type,
      NEW.due_date, 'pending',
      v_total, 0, 0, v_total,
      CURRENT_DATE + INTERVAL '30 days',
      'Orden ' || NEW.order_number,
      NOW(), NOW()
    )
    RETURNING id INTO v_invoice_id;

    NEW.invoice_id := v_invoice_id;

    RAISE NOTICE 'Factura % generada para orden % (paciente: %, trabajo: %)',
      v_invoice_number, NEW.order_number, v_patient_name, v_work_type;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear el trigger (por si acaso)
DROP TRIGGER IF EXISTS trigger_auto_invoice ON lab_orders;
CREATE TRIGGER trigger_auto_invoice
  BEFORE UPDATE ON lab_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_invoice();

-- ── Opcional: normalizar facturas existentes con formato feo ─
-- (solo las que tienen el patrón ORD-{13dígitos}-{alfanumerico})
-- Ejecuta solo si querés limpiar datos históricos.
--
-- UPDATE invoices
--    SET invoice_number = next_fac_number()
--  WHERE invoice_number ~ '^ORD-[0-9]{13}-[A-Z0-9]+$';
