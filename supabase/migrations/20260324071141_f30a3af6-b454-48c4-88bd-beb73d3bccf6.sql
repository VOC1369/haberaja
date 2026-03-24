
-- Grant full access to authenticated users on both tables
CREATE POLICY "Authenticated full access - promo_kb"
ON public.promo_kb
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated full access - audit"
ON public.promo_kb_audit_log
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
