-- ============================================
-- Enhanced Invoice Data - Captura completa de información
-- ============================================
-- Este script mejora el sistema de facturación para incluir
-- todos los datos necesarios en cada factura

-- 1. Agregar campos a la tabla invoices
-- ============================================
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS patient_name TEXT,
ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS work_type TEXT,
ADD COLUMN IF NOT EXISTS delivery_date TIMESTAMPTZ;

-- Crear índices para performance
CREATE INDEX IF NOT EXISTS idx_invoices_patient_id ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_delivery_date ON invoices(delivery_date);

-- 2. Actualizar función de auto-generación con datos completos
-- ============================================
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
  -- Solo generar factura si:
  -- 1. Cambia a 'ready' (listo para entrega)
  -- 2. No tenía este estado antes
  -- 3. No tiene factura ya asignada
  IF NEW.status = 'ready'
     AND OLD.status != 'ready'
     AND NEW.invoice_id IS NULL THEN

    -- Obtener información del paciente
    SELECT
      COALESCE(first_name || ' ' || last_name, 'Sin paciente'),
      id
    INTO v_patient_name, v_patient_id
    FROM patients
    WHERE id = NEW.patient_id;

    -- Si no hay paciente asignado
    IF v_patient_name IS NULL THEN
      v_patient_name := 'Sin paciente asignado';
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
      NEW.due_date, -- Fecha de entrega estimada
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

-- 3. Recrear el trigger
-- ============================================
DROP TRIGGER IF EXISTS trigger_auto_invoice ON lab_orders;

CREATE TRIGGER trigger_auto_invoice
  BEFORE UPDATE ON lab_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_invoice();

-- 4. Actualizar facturas existentes con datos faltantes (opcional)
-- ============================================
-- Este bloque actualiza facturas que ya existen pero no tienen los nuevos campos
DO $$
DECLARE
  v_invoice RECORD;
  v_patient_name TEXT;
  v_patient_id UUID;
  v_work_type TEXT;
  v_work_types TEXT[];
BEGIN
  -- Iterar sobre facturas sin patient_name
  FOR v_invoice IN
    SELECT i.id, i.order_id, lo.patient_id, lo.due_date
    FROM invoices i
    JOIN lab_orders lo ON lo.id = i.order_id
    WHERE i.patient_name IS NULL
  LOOP
    -- Obtener información del paciente
    IF v_invoice.patient_id IS NOT NULL THEN
      SELECT
        COALESCE(first_name || ' ' || last_name, 'Sin paciente'),
        id
      INTO v_patient_name, v_patient_id
      FROM patients
      WHERE id = v_invoice.patient_id;
    ELSE
      v_patient_name := 'Sin paciente asignado';
      v_patient_id := NULL;
    END IF;

    -- Obtener tipos de trabajo
    SELECT array_agg(DISTINCT work_type)
    INTO v_work_types
    FROM lab_order_items
    WHERE order_id = v_invoice.order_id AND work_type IS NOT NULL;

    IF v_work_types IS NOT NULL AND array_length(v_work_types, 1) > 0 THEN
      v_work_type := array_to_string(v_work_types, ', ');
    ELSE
      v_work_type := 'Trabajo dental';
    END IF;

    -- Actualizar factura
    UPDATE invoices
    SET
      patient_name = v_patient_name,
      patient_id = v_patient_id,
      work_type = v_work_type,
      delivery_date = v_invoice.due_date,
      updated_at = NOW()
    WHERE id = v_invoice.id;

    RAISE NOTICE 'Updated invoice % with patient data', v_invoice.id;
  END LOOP;
END $$;

-- 5. Crear vista de facturas con toda la información
-- ============================================
CREATE OR REPLACE VIEW invoices_complete AS
SELECT
  i.*,
  lo.order_number,
  lo.status as order_status,
  lo.created_at as order_created_at,
  p.first_name as patient_first_name,
  p.last_name as patient_last_name,
  d_org.name as dentist_org_name,
  l_org.name as lab_org_name
FROM invoices i
LEFT JOIN lab_orders lo ON lo.id = i.order_id
LEFT JOIN patients p ON p.id = i.patient_id
LEFT JOIN organizations d_org ON d_org.id = i.dentist_org_id
LEFT JOIN organizations l_org ON l_org.id = i.lab_org_id;

GRANT SELECT ON invoices_complete TO authenticated;

-- ============================================
-- INSTRUCCIONES
-- ============================================
-- Para ejecutar:
-- 1. Copiar todo el contenido
-- 2. Ir a Supabase Dashboard > SQL Editor
-- 3. Pegar y ejecutar
-- 4. Verificar que no hay errores
--
-- Las facturas nuevas tendrán automáticamente:
-- - Número de factura = número de orden
-- - Nombre del paciente
-- - Tipo(s) de trabajo
-- - Fecha de entrega
