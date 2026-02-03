-- DentLab MVP Database Schema
-- Multi-tenant SaaS for Dental Labs and Dentists

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE org_type AS ENUM ('lab', 'dentist');
CREATE TYPE org_member_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE order_status AS ENUM (
  'draft',
  'received',
  'missing_info',
  'in_production',
  'quality_check',
  'ready',
  'delivered',
  'cancelled'
);
CREATE TYPE order_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE work_type AS ENUM (
  'corona_metal_ceramica',
  'corona_zirconia',
  'corona_emax',
  'puente_fijo',
  'protesis_removible',
  'protesis_total',
  'implante_corona',
  'carilla',
  'incrustacion',
  'ferula',
  'retenedor',
  'reparacion',
  'otro'
);
CREATE TYPE invoice_status AS ENUM ('draft', 'pending', 'paid', 'cancelled');
CREATE TYPE ledger_type AS ENUM ('charge', 'payment', 'adjustment');
CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');

-- ============================================
-- TABLES
-- ============================================

-- Organizations (Labs and Dentist Clinics)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type org_type NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  tax_id TEXT,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Organization Members
CREATE TABLE org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role org_member_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- Lab-Dentist Relationships (which labs work with which dentists)
CREATE TABLE lab_dentist_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dentist_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lab_org_id, dentist_org_id)
);

-- Patients (belong to dentist organizations)
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dentist_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  date_of_birth DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Appointments
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dentist_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 30,
  status appointment_status DEFAULT 'scheduled',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Lab Orders
CREATE TABLE lab_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL,
  dentist_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lab_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  status order_status DEFAULT 'received',
  priority order_priority DEFAULT 'normal',
  due_date DATE,
  estimated_delivery DATE,
  notes TEXT,
  internal_notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create sequence for order numbers
CREATE SEQUENCE order_number_seq START 1000;

-- Lab Order Items
CREATE TABLE lab_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
  work_type work_type NOT NULL,
  material TEXT,
  shade TEXT,
  tooth_positions TEXT[], -- Array of tooth numbers
  quantity INT DEFAULT 1,
  unit_price DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Order Files (STL, photos, X-rays, etc.)
CREATE TABLE order_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INT,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Order Messages (Chat per order)
CREATE TABLE order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  sender_org_id UUID NOT NULL REFERENCES organizations(id),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Order Status History (Timeline)
CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
  from_status order_status,
  to_status order_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL,
  lab_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dentist_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id UUID REFERENCES lab_orders(id) ON DELETE SET NULL,
  status invoice_status DEFAULT 'pending',
  subtotal DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  pdf_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create sequence for invoice numbers
CREATE SEQUENCE invoice_number_seq START 1000;

-- Invoice Lines
CREATE TABLE invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INT DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  order_item_id UUID REFERENCES lab_order_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ledger Movements (Account statements)
CREATE TABLE ledger_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dentist_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  type ledger_type NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  balance DECIMAL(10,2) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_org_members_user ON org_members(user_id);
CREATE INDEX idx_org_members_org ON org_members(org_id);
CREATE INDEX idx_patients_org ON patients(dentist_org_id);
CREATE INDEX idx_appointments_org ON appointments(dentist_org_id);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_scheduled ON appointments(scheduled_at);
CREATE INDEX idx_lab_orders_dentist ON lab_orders(dentist_org_id);
CREATE INDEX idx_lab_orders_lab ON lab_orders(lab_org_id);
CREATE INDEX idx_lab_orders_status ON lab_orders(status);
CREATE INDEX idx_lab_orders_due_date ON lab_orders(due_date);
CREATE INDEX idx_order_items_order ON lab_order_items(order_id);
CREATE INDEX idx_order_files_order ON order_files(order_id);
CREATE INDEX idx_order_messages_order ON order_messages(order_id);
CREATE INDEX idx_invoices_lab ON invoices(lab_org_id);
CREATE INDEX idx_invoices_dentist ON invoices(dentist_org_id);
CREATE INDEX idx_ledger_lab ON ledger_movements(lab_org_id);
CREATE INDEX idx_ledger_dentist ON ledger_movements(dentist_org_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get user's organization IDs and types
CREATE OR REPLACE FUNCTION get_user_orgs(uid UUID)
RETURNS TABLE(org_id UUID, org_type org_type, role org_member_role) AS $$
BEGIN
  RETURN QUERY
  SELECT om.org_id, o.type, om.role
  FROM org_members om
  JOIN organizations o ON o.id = om.org_id
  WHERE om.user_id = uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user belongs to organization
CREATE OR REPLACE FUNCTION user_belongs_to_org(uid UUID, oid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM org_members WHERE user_id = uid AND org_id = oid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's lab org IDs
CREATE OR REPLACE FUNCTION get_user_lab_orgs(uid UUID)
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT om.org_id
  FROM org_members om
  JOIN organizations o ON o.id = om.org_id
  WHERE om.user_id = uid AND o.type = 'lab';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's dentist org IDs
CREATE OR REPLACE FUNCTION get_user_dentist_orgs(uid UUID)
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT om.org_id
  FROM org_members om
  JOIN organizations o ON o.id = om.org_id
  WHERE om.user_id = uid AND o.type = 'dentist';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-assign creator as org owner
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_org_created
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

-- Generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'OT-' || LPAD(nextval('order_number_seq')::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON lab_orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
  EXECUTE FUNCTION generate_order_number();

-- Generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.invoice_number := 'INV-' || LPAD(nextval('invoice_number_seq')::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
  EXECUTE FUNCTION generate_invoice_number();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_lab_orders_updated_at
  BEFORE UPDATE ON lab_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_dentist_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_movements ENABLE ROW LEVEL SECURITY;

-- Organizations: Users can see orgs they belong to
CREATE POLICY "org_select" ON organizations FOR SELECT
  USING (user_belongs_to_org(auth.uid(), id));

CREATE POLICY "org_insert" ON organizations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "org_update" ON organizations FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM org_members 
    WHERE user_id = auth.uid() AND org_id = id AND role IN ('owner', 'admin')
  ));

-- Org Members: Users can see members of their orgs
CREATE POLICY "org_members_select" ON org_members FOR SELECT
  USING (user_belongs_to_org(auth.uid(), org_id));

CREATE POLICY "org_members_insert" ON org_members FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM org_members 
    WHERE user_id = auth.uid() AND org_id = org_members.org_id AND role IN ('owner', 'admin')
  ));

CREATE POLICY "org_members_delete" ON org_members FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.user_id = auth.uid() AND om.org_id = org_members.org_id AND om.role IN ('owner', 'admin')
  ));

-- Lab-Dentist Relations
CREATE POLICY "lab_dentist_select" ON lab_dentist_relations FOR SELECT
  USING (
    user_belongs_to_org(auth.uid(), lab_org_id) OR 
    user_belongs_to_org(auth.uid(), dentist_org_id)
  );

CREATE POLICY "lab_dentist_insert" ON lab_dentist_relations FOR INSERT
  WITH CHECK (user_belongs_to_org(auth.uid(), lab_org_id));

-- Patients: Dentists can manage their patients
CREATE POLICY "patients_select" ON patients FOR SELECT
  USING (user_belongs_to_org(auth.uid(), dentist_org_id));

CREATE POLICY "patients_insert" ON patients FOR INSERT
  WITH CHECK (user_belongs_to_org(auth.uid(), dentist_org_id));

CREATE POLICY "patients_update" ON patients FOR UPDATE
  USING (user_belongs_to_org(auth.uid(), dentist_org_id));

CREATE POLICY "patients_delete" ON patients FOR DELETE
  USING (user_belongs_to_org(auth.uid(), dentist_org_id));

-- Appointments: Dentists can manage their appointments
CREATE POLICY "appointments_select" ON appointments FOR SELECT
  USING (user_belongs_to_org(auth.uid(), dentist_org_id));

CREATE POLICY "appointments_insert" ON appointments FOR INSERT
  WITH CHECK (user_belongs_to_org(auth.uid(), dentist_org_id));

CREATE POLICY "appointments_update" ON appointments FOR UPDATE
  USING (user_belongs_to_org(auth.uid(), dentist_org_id));

CREATE POLICY "appointments_delete" ON appointments FOR DELETE
  USING (user_belongs_to_org(auth.uid(), dentist_org_id));

-- Lab Orders: Both lab and dentist can view
CREATE POLICY "orders_select" ON lab_orders FOR SELECT
  USING (
    user_belongs_to_org(auth.uid(), lab_org_id) OR 
    user_belongs_to_org(auth.uid(), dentist_org_id)
  );

CREATE POLICY "orders_insert" ON lab_orders FOR INSERT
  WITH CHECK (user_belongs_to_org(auth.uid(), dentist_org_id));

CREATE POLICY "orders_update_dentist" ON lab_orders FOR UPDATE
  USING (user_belongs_to_org(auth.uid(), dentist_org_id))
  WITH CHECK (status IN ('draft', 'received'));

CREATE POLICY "orders_update_lab" ON lab_orders FOR UPDATE
  USING (user_belongs_to_org(auth.uid(), lab_org_id));

-- Order Items
CREATE POLICY "order_items_select" ON lab_order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM lab_orders o 
    WHERE o.id = order_id 
    AND (user_belongs_to_org(auth.uid(), o.lab_org_id) OR user_belongs_to_org(auth.uid(), o.dentist_org_id))
  ));

CREATE POLICY "order_items_insert" ON lab_order_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM lab_orders o 
    WHERE o.id = order_id AND user_belongs_to_org(auth.uid(), o.dentist_org_id)
  ));

CREATE POLICY "order_items_update" ON lab_order_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM lab_orders o 
    WHERE o.id = order_id 
    AND (user_belongs_to_org(auth.uid(), o.lab_org_id) OR user_belongs_to_org(auth.uid(), o.dentist_org_id))
  ));

CREATE POLICY "order_items_delete" ON lab_order_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM lab_orders o 
    WHERE o.id = order_id AND user_belongs_to_org(auth.uid(), o.dentist_org_id)
    AND o.status IN ('draft', 'received')
  ));

-- Order Files
CREATE POLICY "order_files_select" ON order_files FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM lab_orders o 
    WHERE o.id = order_id 
    AND (user_belongs_to_org(auth.uid(), o.lab_org_id) OR user_belongs_to_org(auth.uid(), o.dentist_org_id))
  ));

CREATE POLICY "order_files_insert" ON order_files FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM lab_orders o 
    WHERE o.id = order_id 
    AND (user_belongs_to_org(auth.uid(), o.lab_org_id) OR user_belongs_to_org(auth.uid(), o.dentist_org_id))
  ));

CREATE POLICY "order_files_delete" ON order_files FOR DELETE
  USING (uploaded_by = auth.uid());

-- Order Messages
CREATE POLICY "order_messages_select" ON order_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM lab_orders o 
    WHERE o.id = order_id 
    AND (user_belongs_to_org(auth.uid(), o.lab_org_id) OR user_belongs_to_org(auth.uid(), o.dentist_org_id))
  ));

CREATE POLICY "order_messages_insert" ON order_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() 
    AND user_belongs_to_org(auth.uid(), sender_org_id)
    AND EXISTS (
      SELECT 1 FROM lab_orders o 
      WHERE o.id = order_id 
      AND (user_belongs_to_org(auth.uid(), o.lab_org_id) OR user_belongs_to_org(auth.uid(), o.dentist_org_id))
    )
  );

-- Order Status History
CREATE POLICY "order_history_select" ON order_status_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM lab_orders o 
    WHERE o.id = order_id 
    AND (user_belongs_to_org(auth.uid(), o.lab_org_id) OR user_belongs_to_org(auth.uid(), o.dentist_org_id))
  ));

CREATE POLICY "order_history_insert" ON order_status_history FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM lab_orders o 
    WHERE o.id = order_id 
    AND (user_belongs_to_org(auth.uid(), o.lab_org_id) OR user_belongs_to_org(auth.uid(), o.dentist_org_id))
  ));

-- Invoices
CREATE POLICY "invoices_select" ON invoices FOR SELECT
  USING (
    user_belongs_to_org(auth.uid(), lab_org_id) OR 
    user_belongs_to_org(auth.uid(), dentist_org_id)
  );

CREATE POLICY "invoices_insert" ON invoices FOR INSERT
  WITH CHECK (user_belongs_to_org(auth.uid(), lab_org_id));

CREATE POLICY "invoices_update" ON invoices FOR UPDATE
  USING (user_belongs_to_org(auth.uid(), lab_org_id));

-- Invoice Lines
CREATE POLICY "invoice_lines_select" ON invoice_lines FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM invoices i 
    WHERE i.id = invoice_id 
    AND (user_belongs_to_org(auth.uid(), i.lab_org_id) OR user_belongs_to_org(auth.uid(), i.dentist_org_id))
  ));

CREATE POLICY "invoice_lines_insert" ON invoice_lines FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM invoices i 
    WHERE i.id = invoice_id AND user_belongs_to_org(auth.uid(), i.lab_org_id)
  ));

-- Ledger Movements
CREATE POLICY "ledger_select" ON ledger_movements FOR SELECT
  USING (
    user_belongs_to_org(auth.uid(), lab_org_id) OR 
    user_belongs_to_org(auth.uid(), dentist_org_id)
  );

CREATE POLICY "ledger_insert" ON ledger_movements FOR INSERT
  WITH CHECK (user_belongs_to_org(auth.uid(), lab_org_id));

-- ============================================
-- STORAGE BUCKET
-- ============================================

-- Note: Run this in Supabase Dashboard or via API
-- INSERT INTO storage.buckets (id, name, public) VALUES ('order_files', 'order_files', false);

-- Storage policies for order_files bucket would be:
-- CREATE POLICY "order_files_storage_select" ON storage.objects FOR SELECT
--   USING (bucket_id = 'order_files' AND (storage.foldername(name))[1] IN (
--     SELECT id::text FROM lab_orders WHERE user_belongs_to_org(auth.uid(), lab_org_id) OR user_belongs_to_org(auth.uid(), dentist_org_id)
--   ));
