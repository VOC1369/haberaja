/**
 * Field Classification Rules
 * 
 * PROPAGATABLE: Values that are logically shared across variants
 * VARIANT_SPECIFIC: Values that are unique per variant (NEVER auto-propagate)
 * 
 * This is the CORE SAFETY mechanism for multi-promo extraction.
 */

// ✅ SAFE TO PROPAGATE (shared values by nature)
export const PROPAGATABLE_FIELDS = [
  'min_deposit',
  'minimum_base',
  'min_base',
  'claim_frequency',
  'claim_limit',
  'period_start',
  'period_end',
  'target_user',
  'stackable',
  'platform_access',
] as const;

// ❌ NEVER AUTO-PROPAGATE (variant-specific by nature)
export const VARIANT_SPECIFIC_FIELDS = [
  'calculation_value',
  'calculation_rate',
  'calculation_base',
  'max_bonus',
  'max_reward',
  'turnover_multiplier',
  'turnover_rule',
  'provider',
  'provider_names',
  'game_providers',
  'game_type',
  'game_types',
  'game_names',
  'blacklist_games',
  'blacklist_providers',
  'payout_direction',
  'reward_type',
  'reward_amount',
] as const;

export type PropagatableField = typeof PROPAGATABLE_FIELDS[number];
export type VariantSpecificField = typeof VARIANT_SPECIFIC_FIELDS[number];

/**
 * Check if a field can be safely propagated from rowspan
 */
export const isPropagatableField = (field: string): boolean => {
  return PROPAGATABLE_FIELDS.includes(field as PropagatableField);
};

/**
 * Check if a field is variant-specific (never propagate)
 */
export const isVariantSpecificField = (field: string): boolean => {
  return VARIANT_SPECIFIC_FIELDS.includes(field as VariantSpecificField);
};
