-- Fix search_path mutable warning pada kedua functions

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_promo_kb_audit()
RETURNS trigger
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