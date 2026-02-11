-- ============================================
-- Fix Invoice Trigger - Soporte para 'delivered' y 'ready'
-- ============================================

-- Actualizar función para generar facturas con 'ready' o 'delivered'
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
  -- Generar factura si:
  -- 1. Cambia a 'ready' O 'delivered'
  -- 2. No tenía este estado antes
  -- 3. No tiene factura ya asignada
  IF (NEW.status = 'ready' OR NEW.status = 'delivered')
     AND (OLD.status != 'ready' AND OLD.status != 'delivered')
     AND NEW.invoice_id IS NULL THEN

    -- Obtener información del paciente
    IF NEW.patient_id IS NOT NULL THEN
      SELECT
        COALESCE(first_name || ' ' || last_name, 'Sin paciente'),
        id
      INTO v_patient_name, v_patient_id
      FROM patients
      WHERE id = NEW.patient_id;
    END IF;

    -- Si no hay paciente asignado
    IF v_patient_name IS NULL OR v_patient_name = '' THEN
      v_patient_name := 'Sin paciente asignado';
      v_patient_id := NULL;
    END IF;

    -- Obtener tipos de trabajo de los items
    SELECT array_agg(DISTINCT work_type)
    INTO v_work_types
    FROM lab_order_items
    WHERE order_id = NEW.id AND work_type IS NOT NULL;

    -- Convertir array a string
    IF v_work_types IS NOT NULL AND array_length(v_work_types, 1) > 0 THEN
      v_work_type := array_to_string(v_work_types, ', ');
    ELSE
      v_work_type := 'Trabajo dental';
    END IF;

    -- Calcular total sumando items de la orden
    SELECT COALESCE(SUM(unit_price * quantity), 0)
    INTO v_total
    FROM lab_order_items
    WHERE order_id = NEW.id;

    -- Si no hay items con precio, usar default $500
    IF v_total = 0 THEN
      v_total := 500.00;
    END IF;

    -- Usar el mismo número de orden como número de factura
    v_invoice_number := NEW.order_number;

    -- Crear factura con todos los datos
    INSERT INTO invoices (
      invoice_number,
      lab_org_id,
      dentist_org_id,
      order_id,
      patient_name,
      patient_id,
      work_type,
      delivery_date,
      status,
      subtotal,
      tax_rate,
      tax_amount,
      total,
      due_date,
      notes,
      created_at,
      updated_at
    ) VALUES (
      v_invoice_number,
      NEW.lab_org_id,
      NEW.dentist_org_id,
      NEW.id,
      v_patient_name,
      v_patient_id,
      v_work_type,
      NEW.due_date,
      'pending',
      v_total,
      0,
      0,
      v_total,
      CURRENT_DATE + INTERVAL '30 days',
      'Factura generada automáticamente para orden ' || NEW.order_number,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_invoice_id;

    -- Vincular factura a la orden
    NEW.invoice_id := v_invoice_id;

    -- Log para debugging
    RAISE NOTICE 'Invoice % generated for order % - Patient: % - Work: %',
      v_invoice_number, NEW.order_number, v_patient_name, v_work_type;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear el trigger
DROP TRIGGER IF EXISTS trigger_auto_invoice ON lab_orders;

CREATE TRIGGER trigger_auto_invoice
  BEFORE UPDATE ON lab_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_invoice();

-- ============================================
-- Crear facturas para órdenes existentes sin factura
-- ============================================
DO $$
DECLARE
  v_order RECORD;
  v_invoice_id UUID;
  v_total DECIMAL(10,2);
  v_invoice_number TEXT;
  v_patient_name TEXT;
  v_patient_id UUID;
  v_work_type TEXT;
  v_work_types TEXT[];
  v_count INT := 0;
BEGIN
  -- Iterar sobre órdenes ready o delivered sin factura
  FOR v_order IN
    SELECT *
    FROM lab_orders
    WHERE (status = 'ready' OR status = 'delivered')
      AND invoice_id IS NULL
  LOOP
    -- Obtener información del paciente
    IF v_order.patient_id IS NOT NULL THEN
      SELECT
        COALESCE(first_name || ' ' || last_name, 'Sin paciente'),
        id
      INTO v_patient_name, v_patient_id
      FROM patients
      WHERE id = v_order.patient_id;
    ELSE
      v_patient_name := 'Sin paciente asignado';
      v_patient_id := NULL;
    END IF;

    -- Obtener tipos de trabajo
    SELECT array_agg(DISTINCT work_type)
    INTO v_work_types
    FROM lab_order_items
    WHERE order_id = v_order.id AND work_type IS NOT NULL;

    IF v_work_types IS NOT NULL AND array_length(v_work_types, 1) > 0 THEN
      v_work_type := array_to_string(v_work_types, ', ');
    ELSE
      v_work_type := 'Trabajo dental';
    END IF;

    -- Calcular total
    SELECT COALESCE(SUM(unit_price * quantity), 0)
    INTO v_total
    FROM lab_order_items
    WHERE order_id = v_order.id;

    IF v_total = 0 THEN
      v_total := 500.00;
    END IF;

    -- Generar número de factura
    v_invoice_number := v_order.order_number;

    -- Crear factura
    INSERT INTO invoices (
      invoice_number,
      lab_org_id,
      dentist_org_id,
      order_id,
      patient_name,
      patient_id,
      work_type,
      delivery_date,
      status,
      subtotal,
      tax_rate,
      tax_amount,
      total,
      due_date,
      notes,
      created_at,
      updated_at
    ) VALUES (
      v_invoice_number,
      v_order.lab_org_id,
      v_order.dentist_org_id,
      v_order.id,
      v_patient_name,
      v_patient_id,
      v_work_type,
      v_order.due_date,
      'pending',
      v_total,
      0,
      0,
      v_total,
      CURRENT_DATE + INTERVAL '30 days',
      'Factura generada para orden existente ' || v_order.order_number,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_invoice_id;

    -- Actualizar orden con invoice_id
    UPDATE lab_orders
    SET invoice_id = v_invoice_id,
        updated_at = NOW()
    WHERE id = v_order.id;

    v_count := v_count + 1;
    RAISE NOTICE 'Created invoice % for order %', v_invoice_number, v_order.order_number;
  END LOOP;

  RAISE NOTICE 'Total invoices created: %', v_count;
END $$;

-- ============================================
-- INSTRUCCIONES
-- ============================================
-- Este script:
-- 1. Actualiza el trigger para funcionar con 'ready' y 'delivered'
-- 2. Crea facturas para todas las órdenes existentes que no tienen factura
-- 3. Captura correctamente nombre de paciente y tipo de trabajo
