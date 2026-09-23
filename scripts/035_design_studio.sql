-- ============================================================
-- 035_design_studio.sql
-- Estudio de Diseño Digital (CAD/CAM  -  servicios STL online)
-- ============================================================
-- OBJETIVO
--   Nueva línea de negocio: un equipo de diseño que recibe escaneos
--   intraorales de clientes (odontólogos, clínicas y LABORATORIOS),
--   diseña el caso en CAD y le devuelve el STL terminado.
--
-- POR QUÉ UNA VERTICAL APARTE Y NO lab_orders
--   1. El cliente puede ser un LABORATORIO. lab_dentist_relations
--      modela dentista<->laboratorio: un lab-cliente no entra ahí.
--   2. El ciclo es distinto: tiene ida y vuelta con el cliente
--      (client_review -> revision_requested -> in_design) que la
--      producción física no tiene.
--   3. Meterlo en lab_orders contaminaría el Kanban de producción,
--      el OTIF, la Rentabilidad y la facturación del laboratorio
--      con trabajo que nunca pasa por el taller.
--
-- QUÉ SÍ REUTILIZA
--   organizations  -  org_members + permisos  -  price_catalog (precios,
--   extras, overrides por cliente de 028, unit_cost de 033)  - 
--   invoices + ledger_movements  -  la UI y los helpers existentes.
--
-- NOVEDAD DE SEGURIDAD
--   Estas tablas nacen con RLS REAL por organización, no con el
--   USING(true) de 009. Un escaneo intraoral es dato clínico: el
--   bucket es PRIVADO y se sirve solo por signed URL.
--
-- APLICACIÓN
--   Idempotente. Correr manualmente desde el SQL Editor de Supabase.
-- ============================================================


-- ============================================================
-- 1. TIPO DE ORGANIZACION: design_studio
-- ============================================================
-- organizations.type es el ENUM org_type de 001_schema.sql. El valor
-- 'design_studio' se agrega en scripts/035a, que tiene que correrse
-- SOLO y confirmarse antes que esto: Postgres no deja usar un valor de
-- enum recien creado en la misma transaccion.
--
-- Esta linea es el guard. Si falla con "invalid input value for enum"
-- o "type org_type does not exist", falta correr 035a primero.

SELECT 'design_studio'::org_type AS tipo_de_organizacion_disponible;

-- La tabla tiene ADEMAS del enum una CHECK constraint (viene de
-- 20260311_portal_preview.sql). Hay que actualizarla igual, o el INSERT
-- de una org design_studio se rechaza aunque el enum ya lo acepte.
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_type_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_type_check
  CHECK (type IN ('dentist', 'lab', 'dentist_preview', 'design_studio'));


-- ============================================================
-- 2. RELACIÓN ESTUDIO <-> CLIENTE
-- ============================================================
-- Equivale a lab_dentist_relations pero SIN presuponer el tipo del
-- cliente: acá un laboratorio puede ser cliente del estudio.

CREATE TABLE IF NOT EXISTS design_studio_clients (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_org_id   UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_org_id   UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'suspended')),
  -- 'account'  = cuenta corriente, se factura y se cobra después (B2B actual)
  -- 'prepaid'  = tiene que estar pago antes de liberar el STL (reservado)
  payment_mode    TEXT        NOT NULL DEFAULT 'account'
                              CHECK (payment_mode IN ('account', 'prepaid')),
  -- Horas comprometidas de entrega. NULL = usa el default del servicio.
  turnaround_hours INTEGER,
  notes           TEXT,
  created_by      UUID        REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (studio_org_id, client_org_id)
);

CREATE INDEX IF NOT EXISTS design_studio_clients_studio_idx ON design_studio_clients(studio_org_id);
CREATE INDEX IF NOT EXISTS design_studio_clients_client_idx ON design_studio_clients(client_org_id);

COMMENT ON TABLE design_studio_clients IS
  'Clientes habilitados de un estudio de diseño. A diferencia de lab_dentist_relations, el cliente puede ser de cualquier tipo (dentist, lab o clínica).';


-- ============================================================
-- 3. CATÁLOGO: campos propios del servicio de diseño
-- ============================================================
-- Los 12 servicios de la lista viven en price_catalog con
-- category = 'Diseño Digital'. Así heredan precio, extras,
-- overrides por cliente (028) y unit_cost/margen (033) sin
-- escribir una línea nueva de facturación.

ALTER TABLE price_catalog
  ADD COLUMN IF NOT EXISTS design_service_code TEXT,
  -- Unidad de cobro: una corona se cobra por unidad, un All-on-X por arcada.
  ADD COLUMN IF NOT EXISTS billing_unit TEXT
      CHECK (billing_unit IN ('unit', 'tooth', 'arch', 'case')),
  -- Revisiones sin cargo incluidas. A partir de ahí se factura extra.
  ADD COLUMN IF NOT EXISTS included_revisions INTEGER NOT NULL DEFAULT 2,
  -- Plazo comprometido por defecto para este servicio.
  ADD COLUMN IF NOT EXISTS turnaround_hours INTEGER;

COMMENT ON COLUMN price_catalog.design_service_code IS
  'Código estable del servicio de diseño (ver lib/design/services.ts). NULL en los aranceles de laboratorio físico.';

CREATE INDEX IF NOT EXISTS price_catalog_design_service_idx
  ON price_catalog (org_id, design_service_code)
  WHERE design_service_code IS NOT NULL;


-- ============================================================
-- 4. ÓRDENES DE DISEÑO
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS design_order_number_seq START 1;

CREATE TABLE IF NOT EXISTS design_orders (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number     TEXT        NOT NULL UNIQUE,
  studio_org_id    UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_org_id    UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  status           TEXT        NOT NULL DEFAULT 'draft'
                               CHECK (status IN (
                                 'draft',              -- el cliente todavía la está armando
                                 'submitted',          -- enviada, esperando triage del estudio
                                 'needs_info',         -- escaneo ilegible / falta antagonista, etc.
                                 'assigned',           -- con diseñador asignado
                                 'in_design',          -- en CAD
                                 'internal_review',    -- QC interno antes de mostrarla
                                 'client_review',      -- STL entregado, el cliente debe aprobar
                                 'revision_requested', -- el cliente pidió cambios
                                 'approved',           -- aprobado por el cliente -> factura
                                 'delivered',          -- archivos finales liberados
                                 'cancelled'
                               )),
  priority         TEXT        NOT NULL DEFAULT 'normal'
                               CHECK (priority IN ('normal', 'urgent')),

  -- Referencia del caso. Deliberadamente NO es un FK a patients:
  -- el cliente puede ser un laboratorio que no tiene pacientes cargados,
  -- y minimizamos PII clínica cruzando organizaciones.
  patient_ref      TEXT,
  case_notes       TEXT,        -- indicaciones del cliente (visible para ambos)
  internal_notes   TEXT,        -- notas del estudio (NO visibles para el cliente)

  due_at           TIMESTAMPTZ, -- plazo comprometido
  submitted_at     TIMESTAMPTZ,
  assigned_to      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at      TIMESTAMPTZ,
  first_delivery_at TIMESTAMPTZ, -- primera vez que llegó a client_review (métrica de turnaround)
  approved_at      TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  cancelled_at     TIMESTAMPTZ,
  cancel_reason    TEXT,

  -- Contador de vueltas. Se compara contra included_revisions para
  -- decidir si la próxima revisión se cobra.
  revision_count   INTEGER     NOT NULL DEFAULT 0,

  invoice_id       UUID        REFERENCES invoices(id) ON DELETE SET NULL,

  created_by       UUID        REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS design_orders_studio_idx  ON design_orders(studio_org_id, status);
CREATE INDEX IF NOT EXISTS design_orders_client_idx  ON design_orders(client_org_id, status);
CREATE INDEX IF NOT EXISTS design_orders_assigned_idx ON design_orders(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS design_orders_due_idx     ON design_orders(due_at)
  WHERE status NOT IN ('delivered', 'cancelled');


-- --- Ítems: qué servicios se pidieron ------------------------
CREATE TABLE IF NOT EXISTS design_order_items (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  design_order_id  UUID        NOT NULL REFERENCES design_orders(id) ON DELETE CASCADE,
  -- Código del servicio elegido en el desplegable.
  service_code     TEXT        NOT NULL,
  -- Arancel del catálogo que fijó el precio. SET NULL si se borra el
  -- arancel: el precio ya quedó congelado en unit_price.
  catalog_item_id  UUID        REFERENCES price_catalog(id) ON DELETE SET NULL,
  description      TEXT,
  tooth_positions  TEXT[],
  arch             TEXT        CHECK (arch IN ('upper', 'lower', 'both')),
  quantity         INTEGER     NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price       NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit_cost        NUMERIC(10,2),  -- costo del diseñador, para margen
  selected_extras  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- true = línea generada por una revisión fuera de las incluidas
  is_revision_fee  BOOLEAN     NOT NULL DEFAULT false,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS design_order_items_order_idx ON design_order_items(design_order_id);


-- --- Archivos: escaneos de entrada y STL de salida -----------
CREATE TABLE IF NOT EXISTS design_order_files (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  design_order_id  UUID        NOT NULL REFERENCES design_orders(id) ON DELETE CASCADE,
  kind             TEXT        NOT NULL CHECK (kind IN (
                                 'input_scan',       -- escaneo intraoral del cliente (STL/PLY/DCM/zip)
                                 'input_reference',  -- foto, radiografía, PDF de indicaciones
                                 'output_design',    -- el STL diseñado (entregable)
                                 'output_preview',   -- render/captura para que el cliente mire sin bajarse el STL
                                 'annotation'        -- marcas de una revisión
                               )),
  -- Versión dentro del mismo kind. La revisión 2 de un output_design es version=2.
  version          INTEGER     NOT NULL DEFAULT 1,
  file_name        TEXT        NOT NULL,
  storage_path     TEXT        NOT NULL UNIQUE,
  mime_type        TEXT,
  file_size        BIGINT,
  checksum         TEXT,       -- sha256 opcional, para detectar subidas repetidas
  -- Compuerta de entrega: un output_design con is_released=false existe
  -- en el bucket pero el cliente NO puede firmarlo todavía. Es lo que
  -- permite el modo 'prepaid' sin mover archivos de lugar.
  is_released      BOOLEAN     NOT NULL DEFAULT false,
  uploaded_by      UUID        REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS design_order_files_order_idx ON design_order_files(design_order_id, kind);


-- --- Bitácora: cada cambio de estado y cada mensaje ----------
CREATE TABLE IF NOT EXISTS design_order_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  design_order_id  UUID        NOT NULL REFERENCES design_orders(id) ON DELETE CASCADE,
  type             TEXT        NOT NULL CHECK (type IN (
                                 'status_change', 'message', 'file_upload',
                                 'assignment', 'revision_request'
                               )),
  -- De qué lado del mostrador vino. Decide qué ve el cliente.
  actor_side       TEXT        NOT NULL CHECK (actor_side IN ('client', 'studio', 'system')),
  actor_id         UUID        REFERENCES auth.users(id),
  from_status      TEXT,
  to_status        TEXT,
  message          TEXT,
  -- true = nota interna del estudio, nunca se le muestra al cliente
  is_internal      BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS design_order_events_order_idx ON design_order_events(design_order_id, created_at DESC);


-- ============================================================
-- 5. FACTURACIÓN: enganche con invoices
-- ============================================================
-- Reutilizamos la tabla invoices tal cual está. Mapeo de columnas
-- heredadas (los nombres son legacy, la semántica es emisor/pagador):
--     invoices.lab_org_id     <- studio_org_id  (quien emite)
--     invoices.dentist_org_id <- client_org_id  (quien paga)
-- Así el estado de cuenta, el saldo, los pagos y el libro mayor
-- que ya existen funcionan sin tocarse.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS design_order_id UUID
  REFERENCES design_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS invoices_design_order_idx
  ON invoices(design_order_id) WHERE design_order_id IS NOT NULL;

COMMENT ON COLUMN invoices.design_order_id IS
  'Orden del estudio de diseño que originó la factura. Excluyente con order_id (producción física). En estas facturas lab_org_id es el estudio y dentist_org_id el cliente.';


-- ============================================================
-- 6. TRIGGERS
-- ============================================================

-- --- 6a. Numeración: DIS-000123 ------------------------------
CREATE OR REPLACE FUNCTION design_order_set_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'DIS-' || lpad(nextval('design_order_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS design_orders_set_number ON design_orders;
CREATE TRIGGER design_orders_set_number
  BEFORE INSERT ON design_orders
  FOR EACH ROW EXECUTE FUNCTION design_order_set_number();


-- --- 6b. Sellos de tiempo por cambio de estado ---------------
-- Un solo lugar donde vive "cuándo pasó qué". Las métricas de
-- turnaround se calculan sobre estas columnas, no sobre la bitácora.
CREATE OR REPLACE FUNCTION design_order_touch_timestamps()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'submitted' AND NEW.submitted_at IS NULL THEN
      NEW.submitted_at := now();
    END IF;

    -- Primera entrega al cliente: se sella una sola vez, las
    -- revisiones posteriores no la pisan.
    IF NEW.status = 'client_review' AND NEW.first_delivery_at IS NULL THEN
      NEW.first_delivery_at := now();
    END IF;

    -- Cada vuelta del cliente suma una revisión.
    IF NEW.status = 'revision_requested' AND OLD.status = 'client_review' THEN
      NEW.revision_count := OLD.revision_count + 1;
    END IF;

    IF NEW.status = 'approved'  AND NEW.approved_at  IS NULL THEN NEW.approved_at  := now(); END IF;
    IF NEW.status = 'delivered' AND NEW.delivered_at IS NULL THEN NEW.delivered_at := now(); END IF;
    IF NEW.status = 'cancelled' AND NEW.cancelled_at IS NULL THEN NEW.cancelled_at := now(); END IF;

    -- Reversión manual: si la orden vuelve para ATRÁS, el sello deja de
    -- ser cierto y se limpia. Avanzar no lo toca: approved -> delivered es
    -- el camino normal, y la fecha de aprobación es un hecho histórico que
    -- sostiene la métrica "aprobación -> entrega" y la auditoría de la factura.
    IF NEW.status NOT IN ('approved', 'delivered') THEN
      NEW.approved_at := NULL;
    END IF;
    IF NEW.status <> 'delivered' THEN NEW.delivered_at := NULL; END IF;
    IF NEW.status <> 'cancelled' THEN NEW.cancelled_at := NULL; END IF;

    IF NEW.assigned_to IS NOT NULL AND OLD.assigned_to IS NULL THEN
      NEW.assigned_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS design_orders_touch ON design_orders;
CREATE TRIGGER design_orders_touch
  BEFORE UPDATE ON design_orders
  FOR EACH ROW EXECUTE FUNCTION design_order_touch_timestamps();


-- --- 6c. Factura automática al aprobar -----------------------
-- Dispara en 'approved' (no en 'delivered'): el cliente ya dio el
-- OK, el trabajo está vendido. La entrega de archivos puede quedar
-- condicionada al pago sin bloquear la facturación.
--
-- A diferencia de auto_generate_invoice() de 016, acá NO hay
-- fallback de $500: si la orden no tiene ítems con precio es un
-- error de carga y preferimos que quede en $0 y se vea, antes que
-- inventar un número.
CREATE OR REPLACE FUNCTION design_order_auto_invoice()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_invoice_id UUID;
  v_total      NUMERIC(10,2);
  v_services   TEXT;
BEGIN
  IF NEW.status = 'approved'
     AND OLD.status IS DISTINCT FROM 'approved'
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

    -- El detalle que ve el CLIENTE en su factura. Se toma el nombre del
    -- arancel del catálogo ("Cubeta Individual"), no el código interno
    -- ("impression_tray"): una factura que dice el código es ilegible para
    -- quien la recibe y hace que el cliente llame a preguntar qué compró.
    SELECT string_agg(DISTINCT COALESCE(pc.name, doi.service_code), ', ')
      INTO v_services
      FROM design_order_items doi
      LEFT JOIN price_catalog pc ON pc.id = doi.catalog_item_id
     WHERE doi.design_order_id = NEW.id;

    INSERT INTO invoices (
      invoice_number, lab_org_id, dentist_org_id,
      design_order_id, patient_name, work_type,
      delivery_date, status,
      subtotal, tax_rate, tax_amount, total,
      due_date, notes, totals_strict,
      created_at, updated_at
    ) VALUES (
      NEW.order_number,
      NEW.studio_org_id,          -- emisor: el estudio
      NEW.client_org_id,          -- pagador: el cliente
      NEW.id,
      COALESCE(NEW.patient_ref, 'Sin referencia'),
      COALESCE(v_services, 'Diseño digital'),
      NEW.due_at,
      'pending',
      v_total, 0, 0, v_total,
      CURRENT_DATE + INTERVAL '30 days',
      'Factura del estudio de diseño para la orden ' || NEW.order_number,
      true,                       -- nace en modo estricto: se recalcula desde ítems
      now(), now()
    )
    RETURNING id INTO v_invoice_id;

    NEW.invoice_id := v_invoice_id;
    RAISE NOTICE 'Factura % generada para orden de diseño %', NEW.order_number, NEW.order_number;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS design_orders_auto_invoice ON design_orders;
CREATE TRIGGER design_orders_auto_invoice
  BEFORE UPDATE ON design_orders
  FOR EACH ROW EXECUTE FUNCTION design_order_auto_invoice();


-- ============================================================
-- 7. RLS REAL (no el USING(true) de 009)
-- ============================================================
-- Regla única: ves una orden de diseño si sos miembro del estudio
-- que la ejecuta O del cliente que la pidió. Nada más.

CREATE OR REPLACE FUNCTION is_org_member(p_org_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
     WHERE org_members.org_id  = p_org_id
       AND org_members.user_id = auth.uid()
       AND COALESCE(org_members.status, 'active') = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION can_access_design_order(p_order_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM design_orders d
     WHERE d.id = p_order_id
       AND (is_org_member(d.studio_org_id) OR is_org_member(d.client_org_id))
  );
$$;

ALTER TABLE design_studio_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_order_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_order_files    ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_order_events   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS design_studio_clients_access ON design_studio_clients;
CREATE POLICY design_studio_clients_access ON design_studio_clients
  FOR ALL TO authenticated
  USING      (is_org_member(studio_org_id) OR is_org_member(client_org_id))
  WITH CHECK (is_org_member(studio_org_id));

DROP POLICY IF EXISTS design_orders_access ON design_orders;
CREATE POLICY design_orders_access ON design_orders
  FOR ALL TO authenticated
  USING      (is_org_member(studio_org_id) OR is_org_member(client_org_id))
  WITH CHECK (is_org_member(studio_org_id) OR is_org_member(client_org_id));

DROP POLICY IF EXISTS design_order_items_access ON design_order_items;
CREATE POLICY design_order_items_access ON design_order_items
  FOR ALL TO authenticated
  USING      (can_access_design_order(design_order_id))
  WITH CHECK (can_access_design_order(design_order_id));

DROP POLICY IF EXISTS design_order_files_access ON design_order_files;
CREATE POLICY design_order_files_access ON design_order_files
  FOR ALL TO authenticated
  USING      (can_access_design_order(design_order_id))
  WITH CHECK (can_access_design_order(design_order_id));

-- La bitácora: el cliente no ve las notas internas del estudio.
DROP POLICY IF EXISTS design_order_events_access ON design_order_events;
CREATE POLICY design_order_events_access ON design_order_events
  FOR ALL TO authenticated
  USING (
    can_access_design_order(design_order_id)
    AND (
      is_internal = false
      OR EXISTS (
        SELECT 1 FROM design_orders d
         WHERE d.id = design_order_id AND is_org_member(d.studio_org_id)
      )
    )
  )
  WITH CHECK (can_access_design_order(design_order_id));


-- ============================================================
-- 8. STORAGE: bucket privado + políticas
-- ============================================================
-- Convención de ruta:  {design_order_id}/{kind}/{version}-{archivo}
-- El primer segmento es el UUID de la orden: sobre eso se resuelve
-- el permiso. El bucket es privado; se sirve con signed URL de
-- vida corta, nunca con getPublicUrl().

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'design-files', 'design-files', false,
  524288000,  -- 500 MB: un escaneo intraoral de arcada completa pesa
  NULL        -- MIME libre: los .stl/.ply/.dcm llegan como octet-stream
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS design_files_read   ON storage.objects;
CREATE POLICY design_files_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'design-files'
    AND can_access_design_order(((storage.foldername(name))[1])::UUID)
  );

DROP POLICY IF EXISTS design_files_insert ON storage.objects;
CREATE POLICY design_files_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'design-files'
    AND can_access_design_order(((storage.foldername(name))[1])::UUID)
  );

-- Borrado: solo el estudio. El cliente no puede hacer desaparecer
-- el escaneo que originó un trabajo ya facturado.
DROP POLICY IF EXISTS design_files_delete ON storage.objects;
CREATE POLICY design_files_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'design-files'
    AND EXISTS (
      SELECT 1 FROM design_orders d
       WHERE d.id = ((storage.foldername(name))[1])::UUID
         AND is_org_member(d.studio_org_id)
    )
  );


-- ============================================================
-- 9. VERIFICACION
-- ============================================================
-- Sin bloque DO: una consulta plana que cualquier editor ejecuta sin
-- tener que entender dollar-quoting. Tiene que devolver 5 tablas y
-- el bucket en privado.

SELECT
  (SELECT count(*) FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('design_studio_clients', 'design_orders',
                         'design_order_items', 'design_order_files',
                         'design_order_events')) AS tablas_creadas,
  5 AS tablas_esperadas,
  (SELECT count(*) FROM storage.buckets
    WHERE id = 'design-files' AND public = false) AS bucket_privado;
