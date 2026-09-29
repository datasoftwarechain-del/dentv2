-- 043 · Reparto automático de casos (Fase 1 de PLAN_BOT_DISENADORES.md).
-- Una sentencia por línea (el SQL Editor pierde líneas al pegar bloques). Idempotente.
--
-- Solo esquema: no hay lógica de bot todavía. Lo que habilita es que el reparto
-- pueda ser IDEMPOTENTE (el índice único parcial de más abajo) y REINTENTABLE
-- (attempt + los timestamps de la línea de tiempo).
--
-- Disponibilidad y tarifa del diseñador. rate_per_case se guarda desde ahora aunque
-- la liquidación no exista: el día que se encare, el histórico ya está completo y se
-- puede pagar hacia atrás. Agregarla después obligaría a reconstruirlo a mano.
ALTER TABLE design_applications ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE design_applications ADD COLUMN IF NOT EXISTS max_concurrent INT NOT NULL DEFAULT 3 CHECK (max_concurrent BETWEEN 1 AND 50);
ALTER TABLE design_applications ADD COLUMN IF NOT EXISTS notify_email TEXT;
ALTER TABLE design_applications ADD COLUMN IF NOT EXISTS last_assigned_at TIMESTAMPTZ;
ALTER TABLE design_applications ADD COLUMN IF NOT EXISTS rate_per_case NUMERIC(10,2) CHECK (rate_per_case IS NULL OR rate_per_case >= 0);
-- A quién le mandó el caso el bot. NO se reusa assigned_to: esa apunta a auth.users
-- y significa "qué persona del estudio lo tiene", que es otra cosa.
ALTER TABLE design_orders ADD COLUMN IF NOT EXISTS assigned_application_id UUID REFERENCES design_applications(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS design_orders_assigned_application_idx ON design_orders(assigned_application_id) WHERE assigned_application_id IS NOT NULL;
-- El despacho: una fila por intento de mandarle un caso a un diseñador.
-- studio_org_id está desnormalizado a propósito para que la RLS no tenga que
-- joinear con design_orders en cada fila.
CREATE TABLE IF NOT EXISTS design_dispatches (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), design_order_id UUID NOT NULL REFERENCES design_orders(id) ON DELETE CASCADE, application_id UUID NOT NULL REFERENCES design_applications(id) ON DELETE RESTRICT, studio_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','accepted','declined','delivered','expired','failed')), token_hash TEXT NOT NULL UNIQUE, token_expires_at TIMESTAMPTZ NOT NULL, attempt INT NOT NULL DEFAULT 1 CHECK (attempt BETWEEN 1 AND 20), selection_reason TEXT, email_provider_id TEXT, failure_reason TEXT, sent_at TIMESTAMPTZ NOT NULL DEFAULT now(), reminded_at TIMESTAMPTZ, accepted_at TIMESTAMPTZ, delivered_at TIMESTAMPTZ, expired_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
-- LA garantía de idempotencia: un caso no puede estar despachado a dos diseñadores
-- a la vez. Si el webhook y el cron disparan juntos, el segundo choca acá y no manda.
CREATE UNIQUE INDEX IF NOT EXISTS design_dispatches_one_open_per_order_uq ON design_dispatches(design_order_id) WHERE status IN ('sent','accepted');
CREATE INDEX IF NOT EXISTS design_dispatches_studio_status_idx ON design_dispatches(studio_org_id, status, sent_at DESC);
CREATE INDEX IF NOT EXISTS design_dispatches_application_idx ON design_dispatches(application_id, status);
-- Barrido de vencimientos: busca abiertos cuyo token ya venció.
CREATE INDEX IF NOT EXISTS design_dispatches_expiry_idx ON design_dispatches(token_expires_at) WHERE status IN ('sent','accepted');
CREATE OR REPLACE FUNCTION design_dispatch_touch() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' AND NEW.accepted_at IS NULL THEN NEW.accepted_at := now(); END IF; IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' AND NEW.delivered_at IS NULL THEN NEW.delivered_at := now(); END IF; IF NEW.status = 'expired' AND OLD.status IS DISTINCT FROM 'expired' AND NEW.expired_at IS NULL THEN NEW.expired_at := now(); END IF; RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS design_dispatches_touch ON design_dispatches;
CREATE TRIGGER design_dispatches_touch BEFORE UPDATE ON design_dispatches FOR EACH ROW EXECUTE FUNCTION design_dispatch_touch();
ALTER TABLE design_dispatches ENABLE ROW LEVEL SECURITY;
-- Sin policy de INSERT ni de DELETE: los despachos los crea el bot por service role.
-- El estudio los ve y puede cerrarlos a mano desde la bandeja de excepciones.
DROP POLICY IF EXISTS design_dispatches_select ON design_dispatches;
CREATE POLICY design_dispatches_select ON design_dispatches FOR SELECT TO authenticated USING (is_org_member(studio_org_id));
DROP POLICY IF EXISTS design_dispatches_update ON design_dispatches;
CREATE POLICY design_dispatches_update ON design_dispatches FOR UPDATE TO authenticated USING (is_org_member(studio_org_id)) WITH CHECK (is_org_member(studio_org_id));
-- Realtime: la cola y la bandeja de excepciones se actualizan solas (ver 041).
ALTER TABLE public.design_dispatches REPLICA IDENTITY FULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'design_dispatches') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.design_dispatches; END IF; END $$;
SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='design_dispatches') AS tabla, (SELECT count(*) FROM pg_policies WHERE tablename='design_dispatches') AS policies, (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='design_applications' AND column_name IN ('is_available','max_concurrent','notify_email','last_assigned_at','rate_per_case')) AS columnas_postulacion, (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='design_orders' AND column_name='assigned_application_id') AS columna_orden;
