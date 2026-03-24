-- Attach update_updated_at trigger to promo_kb
-- The function already exists, just needs to be wired to the table

CREATE TRIGGER update_promo_kb_updated_at
BEFORE UPDATE ON public.promo_kb
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Also attach to audit log table for completeness
CREATE TRIGGER update_promo_kb_audit_log_updated_at
BEFORE UPDATE ON public.promo_kb_audit_log
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();