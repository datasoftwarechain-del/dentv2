-- 042 · Equipo de diseño: postulaciones públicas ("soy diseñador") y envío de casos por email.
-- Una sentencia por línea (el SQL Editor pierde líneas al pegar bloques). Idempotente.
--
-- Modelo: el diseñador NO tiene cuenta en la app. Se postula desde la landing, el estudio
-- lo aprueba, y a partir de ahí aparece como destinatario del botón "Enviar por email" de
-- cada caso. Cuando el bot automatice el reparto, leerá esta misma tabla.
CREATE SEQUENCE IF NOT EXISTS designer_application_number_seq START 1;
CREATE TABLE IF NOT EXISTS design_applications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), application_number TEXT NOT NULL UNIQUE, studio_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved','rejected')), full_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, country TEXT NOT NULL DEFAULT 'UY', city TEXT, years_experience INT CHECK (years_experience IS NULL OR years_experience BETWEEN 0 AND 60), software TEXT[], specialties TEXT[], portfolio_url TEXT, notes TEXT, source TEXT NOT NULL DEFAULT 'landing', accepted_terms_at TIMESTAMPTZ NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, reviewed_at TIMESTAMPTZ, rejection_reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS design_applications_studio_status_idx ON design_applications(studio_org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS design_applications_email_idx ON design_applications(lower(email));
-- Un mismo email no puede quedar aprobado dos veces en el mismo estudio: el botón de envío
-- lista aprobados, y un duplicado mandaría el caso dos veces a la misma persona.
CREATE UNIQUE INDEX IF NOT EXISTS design_applications_approved_email_uq ON design_applications(studio_org_id, lower(email)) WHERE status = 'approved';
CREATE OR REPLACE FUNCTION design_application_set_number() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.application_number IS NULL OR NEW.application_number = '' THEN NEW.application_number := 'DIS-' || lpad(nextval('designer_application_number_seq')::TEXT, 5, '0'); END IF; RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS design_applications_set_number ON design_applications;
CREATE TRIGGER design_applications_set_number BEFORE INSERT ON design_applications FOR EACH ROW EXECUTE FUNCTION design_application_set_number();
CREATE OR REPLACE FUNCTION design_application_touch() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); IF NEW.status IN ('approved','rejected') AND OLD.status IS DISTINCT FROM NEW.status AND NEW.reviewed_at IS NULL THEN NEW.reviewed_at := now(); END IF; RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS design_applications_touch ON design_applications;
CREATE TRIGGER design_applications_touch BEFORE UPDATE ON design_applications FOR EACH ROW EXECUTE FUNCTION design_application_touch();
ALTER TABLE design_applications ENABLE ROW LEVEL SECURITY;
-- Sin policy de INSERT: el alta pública entra por service role desde /api/designer-applications,
-- igual que lab_requests. Así la landing no puede leer ni pisar postulaciones ajenas.
DROP POLICY IF EXISTS design_applications_select ON design_applications;
CREATE POLICY design_applications_select ON design_applications FOR SELECT TO authenticated USING (is_org_member(studio_org_id));
DROP POLICY IF EXISTS design_applications_update ON design_applications;
CREATE POLICY design_applications_update ON design_applications FOR UPDATE TO authenticated USING (is_org_member(studio_org_id)) WITH CHECK (is_org_member(studio_org_id));
-- Realtime: la bandeja del estudio se actualiza sola cuando entra una postulación (ver 041).
ALTER TABLE public.design_applications REPLICA IDENTITY FULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'design_applications') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.design_applications; END IF; END $$;
SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='design_applications') AS tabla_creada, (SELECT count(*) FROM pg_policies WHERE tablename='design_applications') AS policies, (SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='design_applications') AS en_realtime;
