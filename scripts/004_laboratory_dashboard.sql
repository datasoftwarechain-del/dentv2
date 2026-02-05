-- ============================================
-- Laboratory Dashboard - Database Extensions
-- ============================================
-- Este script extiende el schema existente de DentLab Pro
-- para soportar auto-generación de facturas y tracking de laboratorio

-- 1. Agregar campo invoice_id a lab_orders
-- ============================================
ALTER TABLE lab_orders 
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id);

CREATE INDEX IF NOT EXISTS idx_lab_orders_invoice ON lab_orders(invoice_id);

-- 2. Agregar campo paid_at a invoices (si no existe)
-- ============================================
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- 3. Función para auto-generar factura cuando orden se completa
-- ============================================
CREATE OR REPLACE FUNCTION auto_generate_invoice()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id UUID;
  v_total DECIMAL(10,2);
  v_invoice_number TEXT;
BEGIN
  -- Solo generar factura si:
  -- 1. Cambia a 'ready' (listo para entrega)
  -- 2. No tenía este estado antes
  -- 3. No tiene factura ya asignada
  IF NEW.status = 'ready' 
     AND OLD.status != 'ready' 
     AND NEW.invoice_id IS NULL THEN
    
    -- Calcular total sumando items de la orden
    SELECT COALESCE(SUM(unit_price * quantity), 0)
    INTO v_total
    FROM lab_order_items
    WHERE order_id = NEW.id;
    
    -- Si no hay items con precio, usar default $500
    IF v_total = 0 THEN
      v_total := 500.00;
    END IF;
    
    -- Generar número de factura
    v_invoice_number := 'INV-' || LPAD(nextval('invoice_number_seq')::TEXT, 6, '0');
    
    -- Crear factura
    INSERT INTO invoices (
      invoice_number,
      lab_org_id,
      dentist_org_id,
      order_id,
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
      'pending',
      v_total,
      0,
      0,
      v_total,
      CURRENT_DATE + INTERVAL '30 days',
      'Auto-generated for order ' || NEW.order_number,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_invoice_id;
    
    -- Vincular factura a la orden
    NEW.invoice_id := v_invoice_id;
    
    -- Log para debugging
    RAISE NOTICE 'Auto-generated invoice % for order %', v_invoice_number, NEW.order_number;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Crear trigger
-- ============================================
DROP TRIGGER IF EXISTS trigger_auto_invoice ON lab_orders;

CREATE TRIGGER trigger_auto_invoice
  BEFORE UPDATE ON lab_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_invoice();

-- 5. Vista para estadísticas del dashboard (opcional, mejora performance)
-- ============================================
CREATE OR REPLACE VIEW lab_dashboard_stats AS
SELECT
  lab_org_id,
  COUNT(*) FILTER (WHERE status IN ('in_production', 'quality_check')) as orders_in_progress,
  COUNT(*) FILTER (WHERE status = 'ready') as orders_ready,
  COUNT(*) FILTER (WHERE status = 'delivered') as orders_delivered,
  COUNT(*) FILTER (WHERE due_date <= CURRENT_DATE + 2 
                   AND status IN ('in_production', 'quality_check')) as orders_urgent,
  COUNT(*) FILTER (WHERE due_date = CURRENT_DATE 
                   AND status IN ('in_production', 'quality_check')) as orders_due_today
FROM lab_orders
WHERE status NOT IN ('cancelled', 'draft')
  AND created_at >= CURRENT_DATE - INTERVAL '365 days'
GROUP BY lab_org_id;

-- 6. Grant permissions para la vista
-- ============================================
GRANT SELECT ON lab_dashboard_stats TO authenticated;

-- ============================================
-- INSTRUCTIONS
-- ============================================
-- Para ejecutar este script:
-- 1. Ir a Supabase Dashboard > SQL Editor
-- 2. Pegar este contenido completo
-- 3. Click en "Run"
-- 4. Verificar que no hay errores
--
-- Para probar:
-- UPDATE lab_orders SET status = 'ready' WHERE id = '<algún-orden-id>';
-- SELECT * FROM invoices WHERE order_id = '<algún-orden-id>';
