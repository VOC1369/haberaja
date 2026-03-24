-- Bersihkan extra_config di semua row promo_kb:
-- Hapus field: created_at, updated_at, updated_by, dan semua key berawalan '_'
UPDATE public.promo_kb
SET extra_config = (
  SELECT jsonb_object_agg(key, value)
  FROM jsonb_each(extra_config)
  WHERE key NOT IN ('created_at', 'updated_at', 'updated_by')
    AND key NOT LIKE '\_%'
)
WHERE extra_config IS NOT NULL
  AND extra_config != '{}'::jsonb;