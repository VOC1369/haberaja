
-- Drop the old constraint that only allows lowercase values
-- but trigger sends TG_OP = 'INSERT'/'UPDATE'/'DELETE' (uppercase)
ALTER TABLE public.promo_kb_audit_log 
DROP CONSTRAINT IF EXISTS promo_kb_audit_log_action_check;

-- Add new constraint that accepts TG_OP uppercase values
ALTER TABLE public.promo_kb_audit_log 
ADD CONSTRAINT promo_kb_audit_log_action_check 
CHECK (action = ANY (ARRAY[
  'INSERT'::text, 'UPDATE'::text, 'DELETE'::text,
  'create'::text, 'update'::text, 'delete'::text, 
  'approve'::text, 'reject'::text
]));
