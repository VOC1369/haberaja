-- ================================================================
-- MIGRATION: Universal Promo Ontology v3.1
-- DROP legacy flat-column schema, CREATE new JSONB-based schema
-- ================================================================

DROP TABLE IF EXISTS promo_kb_audit_log CASCADE;
DROP TABLE IF EXISTS promo_kb CASCADE;

-- ================================================================
-- CREATE promo_kb v3.1
-- ================================================================

CREATE TABLE promo_kb (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core identity (flat for easy indexing & querying)
  promo_id text NOT NULL,
  client_id text NOT NULL,
  client_name text,
  promo_name text NOT NULL,
  promo_slug text,
  status text NOT NULL DEFAULT 'draft',
  source_url text,
  source_text_hash text,

  -- Validity
  valid_from date,
  valid_until date,
  valid_until_unlimited boolean NOT NULL DEFAULT true,

  -- Access
  geo_restriction text NOT NULL DEFAULT 'indonesia',
  platform_access text NOT NULL DEFAULT 'semua',
  promo_risk_level text NOT NULL DEFAULT 'medium',

  -- v3.1 JSONB COLUMNS
  mechanics jsonb NOT NULL DEFAULT '[]'::jsonb,

  adjudication jsonb NOT NULL DEFAULT '{"status":"pending","adjudication_rules_version":"v1","priority_order":["numeric_value","explicit_formula","example_calculation","textual_description","marketing_language"],"conflicts":[],"ambiguities":[],"confidence_adjustments":[],"blocked_mechanics":[]}'::jsonb,

  canonical_projection jsonb NOT NULL DEFAULT '{}'::jsonb,

  query_hints jsonb NOT NULL DEFAULT '{"confidence_threshold_tegas":0.8,"confidence_threshold_disclaimer":0.5,"confidence_threshold_escalate":0.4,"escalation_target":"human_cs","answer_language":"id","answer_tone":"friendly_professional"}'::jsonb,

  meta jsonb NOT NULL DEFAULT '{"schema_version":"3.1","human_verified":false,"overall_extraction_confidence":0,"schema_evolved_from":"2.2"}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT promo_kb_promo_id_client_unique UNIQUE (promo_id, client_id)
);

CREATE INDEX idx_promo_kb_client_id ON promo_kb(client_id);
CREATE INDEX idx_promo_kb_status ON promo_kb(status);
CREATE INDEX idx_promo_kb_promo_id ON promo_kb(promo_id);
CREATE INDEX idx_promo_kb_created_at ON promo_kb(created_at DESC);
CREATE INDEX idx_promo_kb_mechanics ON promo_kb USING GIN(mechanics);
CREATE INDEX idx_promo_kb_canonical ON promo_kb USING GIN(canonical_projection);

-- ================================================================
-- CREATE promo_kb_audit_log
-- ================================================================

CREATE TABLE promo_kb_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id text NOT NULL,
  client_id text NOT NULL,
  action text NOT NULL,
  changed_by text,
  changed_at timestamptz DEFAULT now(),
  old_data jsonb,
  new_data jsonb,
  notes text
);

CREATE INDEX idx_audit_promo_id ON promo_kb_audit_log(promo_id);
CREATE INDEX idx_audit_changed_at ON promo_kb_audit_log(changed_at DESC);

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE promo_kb ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_kb_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access - promo_kb"
  ON promo_kb FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Anon full access - promo_kb"
  ON promo_kb FOR ALL TO anon
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access - audit"
  ON promo_kb_audit_log FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Anon read audit"
  ON promo_kb_audit_log FOR SELECT TO anon
  USING (true);

-- ================================================================
-- TRIGGERS
-- ================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER promo_kb_updated_at
  BEFORE UPDATE ON promo_kb
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.log_promo_kb_audit()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.promo_kb_audit_log (promo_id, client_id, action, changed_by, changed_at, old_data, new_data)
  VALUES (
    COALESCE(NEW.promo_id, OLD.promo_id),
    COALESCE(NEW.client_id, OLD.client_id),
    TG_OP,
    auth.uid()::text,
    now(),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER promo_kb_audit
  AFTER INSERT OR UPDATE OR DELETE ON promo_kb
  FOR EACH ROW EXECUTE FUNCTION public.log_promo_kb_audit();