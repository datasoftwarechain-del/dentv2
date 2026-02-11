-- Migration: Fix due_date column to store both date and time
-- Changes due_date from DATE to TIMESTAMPTZ to preserve time information

-- Step 1: Drop ALL views that depend on due_date
DROP VIEW IF EXISTS lab_dashboard_stats;
DROP VIEW IF EXISTS lab_late_deliveries;

-- Step 2: Change column type for lab_orders table
ALTER TABLE lab_orders
  ALTER COLUMN due_date TYPE TIMESTAMPTZ USING due_date::TIMESTAMPTZ;

-- Step 3: Change column type for invoices table (if it has due_date)
ALTER TABLE invoices
  ALTER COLUMN due_date TYPE TIMESTAMPTZ USING due_date::TIMESTAMPTZ;

-- Step 4: Update existing records to set a default time (18:00) for dates without time
-- This preserves the date but adds a reasonable default time
UPDATE lab_orders
SET due_date = due_date + INTERVAL '18 hours'
WHERE due_date IS NOT NULL
  AND EXTRACT(HOUR FROM due_date) = 0
  AND EXTRACT(MINUTE FROM due_date) = 0;

-- Step 5: Recreate lab_dashboard_stats view
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

GRANT SELECT ON lab_dashboard_stats TO authenticated;

-- Step 6: Recreate lab_late_deliveries view
CREATE OR REPLACE VIEW lab_late_deliveries AS
SELECT
  lo.id as order_id,
  lo.order_number,
  lo.lab_org_id,
  lo.dentist_org_id,
  lo.due_date,
  lo.updated_at as delivered_at,
  lo.status,
  DATE_PART('day', lo.updated_at - lo.due_date) as days_late,
  d.name as dentist_org_name
FROM lab_orders lo
JOIN organizations d ON d.id = lo.dentist_org_id
WHERE lo.status = 'delivered'
  AND lo.updated_at > lo.due_date;

GRANT SELECT ON lab_late_deliveries TO authenticated;

-- Step 7: Add comments to document the change
COMMENT ON COLUMN lab_orders.due_date IS 'Delivery due date and time (stores full timestamp with timezone)';
COMMENT ON COLUMN invoices.due_date IS 'Invoice due date and time (stores full timestamp with timezone)';
