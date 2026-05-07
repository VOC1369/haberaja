-- Phase 3B: promo_knowledge canonical table for V.10.1
CREATE TABLE public.promo_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  client_name TEXT,
  promo_name TEXT NOT NULL,
  promo_type TEXT,
  promo_mode TEXT,
  schema_name TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  state TEXT,
  validation_status TEXT,
  review_required BOOLEAN NOT NULL DEFAULT true,
  is_published BOOLEAN NOT NULL DEFAULT false,
  record_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  published_by TEXT
);

-- Indexes
CREATE INDEX idx_promo_knowledge_client_published
  ON public.promo_knowledge(client_id, is_published);
CREATE INDEX idx_promo_knowledge_schema_version
  ON public.promo_knowledge(schema_version);
CREATE INDEX idx_promo_knowledge_state
  ON public.promo_knowledge(state);
CREATE INDEX idx_promo_knowledge_updated_at
  ON public.promo_knowledge(updated_at DESC);

-- RLS
ALTER TABLE public.promo_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access_promo_knowledge"
  ON public.promo_knowledge
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- updated_at trigger (reuse existing public.update_updated_at)
CREATE TRIGGER trg_promo_knowledge_updated_at
  BEFORE UPDATE ON public.promo_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();