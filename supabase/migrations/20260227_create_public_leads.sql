-- Migration: create public_leads table
-- Execute this in Supabase Studio → SQL Editor
-- Created: 2026-02-27

CREATE TABLE IF NOT EXISTS public_leads (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL,
  name          TEXT,
  phone         TEXT,
  role          TEXT        CHECK (role IN ('dentist', 'lab', 'clinic', 'other')),
  message       TEXT,
  source        TEXT        NOT NULL DEFAULT 'newsletter'
                            CHECK (source IN ('newsletter', 'chat')),
  wants_contact BOOLEAN     NOT NULL DEFAULT false,
  status        TEXT        NOT NULL DEFAULT 'new'
                            CHECK (status IN ('new', 'contacted', 'qualified', 'unsubscribed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata      JSONB       DEFAULT '{}'
);

-- Unique constraint for upsert deduplication
ALTER TABLE public_leads
  ADD CONSTRAINT public_leads_email_source_key UNIQUE (email, source);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS leads_email_idx      ON public_leads (email);
CREATE INDEX IF NOT EXISTS leads_source_idx     ON public_leads (source);
CREATE INDEX IF NOT EXISTS leads_status_idx     ON public_leads (status);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON public_leads (created_at DESC);

-- Enable RLS (rows only accessible via service role from API)
ALTER TABLE public_leads ENABLE ROW LEVEL SECURITY;

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
