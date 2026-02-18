-- =============================================
-- 022_patient_invoices.sql
-- Facturas que las clínicas/dentistas emiten a sus pacientes
-- =============================================

-- Sequence for patient invoice numbers
CREATE SEQUENCE IF NOT EXISTS patient_invoice_number_seq START WITH 1 INCREMENT BY 1;

-- Patient invoices table
CREATE TABLE IF NOT EXISTS patient_invoices (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number    TEXT        UNIQUE NOT NULL DEFAULT 'PF-' || LPAD(nextval('patient_invoice_number_seq')::TEXT, 6, '0'),
  dentist_org_id    UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_id        UUID        REFERENCES patients(id) ON DELETE SET NULL,
  patient_name      TEXT,       -- denormalized for display
  description       TEXT        NOT NULL,
  items             JSONB       DEFAULT '[]'::jsonb,
  subtotal          DECIMAL(10,2) NOT NULL DEFAULT 0,
  total             DECIMAL(10,2) NOT NULL DEFAULT 0,
  status            TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  due_date          DATE,
  paid_at           TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_patient_invoices_dentist_org ON patient_invoices(dentist_org_id);
CREATE INDEX IF NOT EXISTS idx_patient_invoices_patient    ON patient_invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_invoices_status     ON patient_invoices(status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_patient_invoice_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_patient_invoice_updated_at ON patient_invoices;
CREATE TRIGGER trg_patient_invoice_updated_at
  BEFORE UPDATE ON patient_invoices
  FOR EACH ROW EXECUTE FUNCTION update_patient_invoice_updated_at();

-- RLS
ALTER TABLE patient_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_invoices_select" ON patient_invoices;
CREATE POLICY "patient_invoices_select" ON patient_invoices
  FOR SELECT USING (
    dentist_org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "patient_invoices_insert" ON patient_invoices;
CREATE POLICY "patient_invoices_insert" ON patient_invoices
  FOR INSERT WITH CHECK (
    dentist_org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "patient_invoices_update" ON patient_invoices;
CREATE POLICY "patient_invoices_update" ON patient_invoices
  FOR UPDATE USING (
    dentist_org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "patient_invoices_delete" ON patient_invoices;
CREATE POLICY "patient_invoices_delete" ON patient_invoices
  FOR DELETE USING (
    dentist_org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );
