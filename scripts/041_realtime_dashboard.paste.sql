-- 041 · Realtime para el dashboard: órdenes, facturas, libro mayor, solicitudes web y órdenes de diseño.
-- Una sentencia por línea (el SQL Editor pierde líneas al pegar bloques).
-- Idempotente: solo agrega la tabla a la publicación si no está.
-- REPLICA IDENTITY FULL para que el filtro por columna (lab_org_id / dentist_org_id / studio_org_id / client_org_id) funcione también en UPDATE y DELETE.
ALTER TABLE public.lab_orders REPLICA IDENTITY FULL;
ALTER TABLE public.invoices REPLICA IDENTITY FULL;
ALTER TABLE public.ledger_movements REPLICA IDENTITY FULL;
ALTER TABLE public.lab_requests REPLICA IDENTITY FULL;
ALTER TABLE public.design_orders REPLICA IDENTITY FULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'lab_orders') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.lab_orders; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'invoices') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ledger_movements') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.ledger_movements; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'lab_requests') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.lab_requests; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'design_orders') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.design_orders; END IF; END $$;
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' ORDER BY tablename;
