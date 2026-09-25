-- 041 · Realtime para facturación: órdenes, facturas y libro mayor.
-- Una sentencia por línea (el SQL Editor pierde líneas al pegar bloques).
-- Idempotente: solo agrega la tabla a la publicación si no está.
-- REPLICA IDENTITY FULL para que el filtro por columna (lab_org_id / dentist_org_id) funcione también en UPDATE y DELETE.
ALTER TABLE public.lab_orders REPLICA IDENTITY FULL;
ALTER TABLE public.invoices REPLICA IDENTITY FULL;
ALTER TABLE public.ledger_movements REPLICA IDENTITY FULL;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'lab_orders') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.lab_orders; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'invoices') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ledger_movements') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.ledger_movements; END IF; END $$;
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' ORDER BY tablename;
