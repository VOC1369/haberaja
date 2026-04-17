
-- ============================================
-- VOC PROMO KB — Clean Schema v3.1
-- Only 2 tables: promo_kb + promo_kb_audit_log
-- ============================================

-- 1. MAIN TABLE: promo_kb
CREATE TABLE public.promo_kb (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL DEFAULT 'Liveboard',
  promo_name TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_promo_kb_client_id ON public.promo_kb(client_id);
CREATE INDEX idx_promo_kb_status ON public.promo_kb(status);
CREATE INDEX idx_promo_kb_archetype ON public.promo_kb((payload->>'archetype'));
CREATE INDEX idx_promo_kb_created_at ON public.promo_kb(created_at DESC);

-- Enable RLS
ALTER TABLE public.promo_kb ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users full access (admin via login)
-- anon = NO ACCESS (player goes via edge function with service_role)
CREATE POLICY "authenticated_full_access_promo_kb"
  ON public.promo_kb
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 2. AUDIT LOG: promo_kb_audit_log
-- ============================================
CREATE TABLE public.promo_kb_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_kb_id UUID,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_payload JSONB,
  new_payload JSONB,
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_promo_kb_id ON public.promo_kb_audit_log(promo_kb_id);
CREATE INDEX idx_audit_changed_at ON public.promo_kb_audit_log(changed_at DESC);

ALTER TABLE public.promo_kb_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated read only (no client write — only via trigger)
CREATE POLICY "authenticated_read_audit_log"
  ON public.promo_kb_audit_log
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- 3. TRIGGER: auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_promo_kb_updated_at
  BEFORE UPDATE ON public.promo_kb
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- 4. TRIGGER: auto-log to audit
-- ============================================
CREATE OR REPLACE FUNCTION public.log_promo_kb_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user TEXT;
BEGIN
  -- Get user email from JWT if available
  v_user := COALESCE(
    (auth.jwt() ->> 'email'),
    'system'
  );

  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.promo_kb_audit_log (promo_kb_id, action, new_payload, changed_by)
    VALUES (NEW.id, 'INSERT', NEW.payload, v_user);
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.promo_kb_audit_log (promo_kb_id, action, old_payload, new_payload, changed_by)
    VALUES (NEW.id, 'UPDATE', OLD.payload, NEW.payload, v_user);
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.promo_kb_audit_log (promo_kb_id, action, old_payload, changed_by)
    VALUES (OLD.id, 'DELETE', OLD.payload, v_user);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_promo_kb_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.promo_kb
  FOR EACH ROW
  EXECUTE FUNCTION public.log_promo_kb_audit();
