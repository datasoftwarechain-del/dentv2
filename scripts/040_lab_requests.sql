-- ============================================================
-- 040_lab_requests.sql
-- Solicitudes web de fresado e impresion (landing -> laboratorio)
-- ============================================================
-- OBJETIVO
--   Las cards de "Fresado CAM" e "Impresion 3D" de la landing mandan a
--   un formulario publico. Lo que llega NO es una orden todavia: es una
--   SOLICITUD que el laboratorio revisa y convierte en lab_orders con
--   el boton "Convertir en orden", eligiendo a que clinica (existente
--   o nueva) se la asigna.
--
-- POR QUE UNA TABLA DE SOLICITUDES Y NO INSERTAR EN lab_orders
--   1. lab_orders exige dentist_org_id. El visitante no tiene org y no
--      queremos crearle una cuenta ERP por pedir una corona (037 ya
--      resolvio ese problema del lado del diseno).
--   2. Un desconocido no puede escribir en el Kanban de produccion: la
--      cola del taller se llenaria de spam y de pedidos incompletos.
--   3. La conversion es una decision humana: precio, clinica, material.
--
-- ALCANCE
--   Solo Uruguay. El API rechaza otros paises con 422 y ofrece el
--   diseno digital como alternativa. La columna country queda igual
--   por si se abre otro pais.
--
-- SEGURIDAD
--   RLS real (no el USING(true) de 009): solo miembros del laboratorio
--   receptor leen y actualizan. El INSERT publico lo hace el servidor
--   con service role, nunca el navegador. El STL va a un bucket
--   PRIVADO propio ('lab-request-files'), no al 'case-files' publico.
--
-- APLICACION
--   Idempotente. Correr desde el SQL Editor de Supabase. No usa DO.
-- ============================================================


-- ============================================================
-- 1. TABLA
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS lab_request_number_seq START 1;

CREATE TABLE IF NOT EXISTS lab_requests (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number    TEXT        NOT NULL UNIQUE,
  lab_org_id        UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  status            TEXT        NOT NULL DEFAULT 'pending_review'
                                CHECK (status IN (
                                  'pending_review',  -- llego, nadie la miro
                                  'converting',      -- cerrojo mientras se crea la orden
                                  'converted',       -- ya es una lab_order
                                  'rejected'         -- descartada (spam, fuera de alcance, etc.)
                                )),

  -- --- quien pide (profesional, NUNCA datos del paciente) ---------
  professional_name TEXT        NOT NULL,
  email             TEXT        NOT NULL,
  phone             TEXT,
  clinic_name       TEXT        NOT NULL,
  country           TEXT        NOT NULL DEFAULT 'UY',
  department        TEXT,       -- departamento (Montevideo, Canelones...)
  city              TEXT,
  address           TEXT,       -- direccion de entrega del trabajo

  -- --- que pide -----------------------------------------------------
  product_key       TEXT        NOT NULL,   -- key de content/servicios.ts (zirconio, pmma, modelos...)
  catalog_name      TEXT,                   -- nombre del item de price_catalog al momento de pedir
  catalog_item_id   UUID        REFERENCES price_catalog(id) ON DELETE SET NULL,
  material          TEXT,
  quantity          INT         NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 99),
  tooth_positions   TEXT[],
  shade             TEXT,
  urgency           TEXT        NOT NULL DEFAULT 'normal'
                                CHECK (urgency IN ('normal', 'urgent')),
  patient_ref       TEXT,                   -- codigo interno del profesional, no el nombre
  notes             TEXT,

  -- --- archivo ------------------------------------------------------
  -- 'none'     : el profesional no adjunto nada (ej: "ya tengo caso")
  -- 'pending'  : declaro un archivo pero la subida no se confirmo
  -- 'uploaded' : el objeto existe en el bucket, verificado por el server
  file_status       TEXT        NOT NULL DEFAULT 'none'
                                CHECK (file_status IN ('none', 'pending', 'uploaded')),
  file_name         TEXT,
  file_size         BIGINT,
  storage_path      TEXT,                   -- lab-request-files/{request_id}/{file}
  existing_case_ref TEXT,                   -- "ya tengo un caso con ustedes": numero de orden

  -- --- anti-abuso ---------------------------------------------------
  -- El navegador genera una clave por formulario. Un doble clic manda
  -- la misma clave y el UNIQUE devuelve la misma solicitud.
  idempotency_key   TEXT        NOT NULL UNIQUE,
  source            TEXT        NOT NULL DEFAULT 'landing',
  accepted_terms_at TIMESTAMPTZ NOT NULL,

  -- --- conversion ---------------------------------------------------
  lab_order_id      UUID        REFERENCES lab_orders(id)     ON DELETE SET NULL,
  dentist_org_id    UUID        REFERENCES organizations(id)  ON DELETE SET NULL,
  reviewed_by       UUID        REFERENCES auth.users(id)     ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  rejection_reason  TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lab_requests_lab_status_idx
  ON lab_requests(lab_org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS lab_requests_email_idx
  ON lab_requests(lower(email));


-- ============================================================
-- 2. TRIGGERS
-- ============================================================

-- Numero correlativo: SOL-000001. Va por secuencia y no por "max + 1"
-- como lab_orders, asi dos solicitudes simultaneas no chocan.
CREATE OR REPLACE FUNCTION lab_request_set_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.request_number IS NULL OR NEW.request_number = '' THEN
    NEW.request_number := 'SOL-' || lpad(nextval('lab_request_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lab_requests_set_number ON lab_requests;
CREATE TRIGGER lab_requests_set_number
  BEFORE INSERT ON lab_requests
  FOR EACH ROW EXECUTE FUNCTION lab_request_set_number();

CREATE OR REPLACE FUNCTION lab_request_touch()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  -- Sello de revision: la primera vez que sale de pending_review.
  IF NEW.status IN ('converted', 'rejected') AND OLD.status <> NEW.status
     AND NEW.reviewed_at IS NULL THEN
    NEW.reviewed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lab_requests_touch ON lab_requests;
CREATE TRIGGER lab_requests_touch
  BEFORE UPDATE ON lab_requests
  FOR EACH ROW EXECUTE FUNCTION lab_request_touch();


-- ============================================================
-- 3. RLS
-- ============================================================
-- is_org_member() viene de 035_design_studio.sql (SECURITY DEFINER).
-- Si esto falla con "function is_org_member does not exist", falta 035.

ALTER TABLE lab_requests ENABLE ROW LEVEL SECURITY;

-- Lectura y actualizacion: solo el laboratorio receptor.
-- INSERT y DELETE no tienen policy a proposito: el alta la hace el
-- servidor con service role (bypassa RLS) y borrar no es una accion
-- del negocio (se rechaza, queda el rastro).
DROP POLICY IF EXISTS lab_requests_select ON lab_requests;
CREATE POLICY lab_requests_select ON lab_requests
  FOR SELECT TO authenticated
  USING (is_org_member(lab_org_id));

DROP POLICY IF EXISTS lab_requests_update ON lab_requests;
CREATE POLICY lab_requests_update ON lab_requests
  FOR UPDATE TO authenticated
  USING      (is_org_member(lab_org_id))
  WITH CHECK (is_org_member(lab_org_id));


-- ============================================================
-- 4. BUCKET PRIVADO
-- ============================================================
-- El profesional sube por URL firmada de subida (la emite el servidor
-- con service role, vale 2 horas y no necesita policy de INSERT). El
-- laboratorio descarga por URL firmada de lectura.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lab-request-files', 'lab-request-files', false,
  209715200,  -- 200 MB: un STL de arcada pesa, un ZIP de varios mas
  NULL        -- .stl/.ply/.zip llegan como octet-stream
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS lab_request_files_read ON storage.objects;
CREATE POLICY lab_request_files_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'lab-request-files'
    AND EXISTS (
      SELECT 1 FROM lab_requests r
       WHERE r.id = ((storage.foldername(name))[1])::UUID
         AND is_org_member(r.lab_org_id)
    )
  );

DROP POLICY IF EXISTS lab_request_files_delete ON storage.objects;
CREATE POLICY lab_request_files_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'lab-request-files'
    AND EXISTS (
      SELECT 1 FROM lab_requests r
       WHERE r.id = ((storage.foldername(name))[1])::UUID
         AND is_org_member(r.lab_org_id)
    )
  );


-- ============================================================
-- 5. VERIFICACION
-- ============================================================
-- Tiene que devolver 1 tabla, 2 policies, 1 bucket privado.

SELECT
  (SELECT count(*) FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'lab_requests') AS tabla_creada,
  (SELECT count(*) FROM pg_policies
    WHERE tablename = 'lab_requests') AS policies,
  (SELECT count(*) FROM storage.buckets
    WHERE id = 'lab-request-files' AND public = false) AS bucket_privado;
