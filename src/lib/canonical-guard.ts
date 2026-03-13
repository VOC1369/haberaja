/**
 * Canonical Guard v2.1-FINAL
 * 
 * Master enforcement layer ensuring all JSON outputs strictly follow
 * the VOC Promo KB Canonical Contract v2.1-FINAL schema.
 * 
 * @version 2.1-FINAL
 * @status LOCKED
 * 
 * @todo UX DEBT: Add "Auto-Derived" badge in Step4Review UI
 * for fields listed in extra_config._derived_fields
 * Priority: Low (informational, non-blocking)
 */

import { 
  CanonicalPromoKB, 
  CANONICAL_INERT, 
  validateCanonicalPromo,
  consolidateGameExclusions,
  parseTurnoverMultiplier 
} from './canonical-promo-schema';

// ============================================================================
// CANONICAL EXPORT WHITELIST (52 FIELDS - SYNCED WITH CONTRACT v2.1-FINAL)
// ============================================================================

export const CANONICAL_EXPORT_WHITELIST = [
  // CORE IDENTITY (9)
  'schema_version',
  'client_id',
  'client_name',
  'promo_id',
  'promo_name',
  'promo_slug',
  'source_url',
  'status',
  'promo_summary',
  
  // TAXONOMY (3)
  'category',
  'mode',
  'tier_archetype',
  
  // INTENT & TRIGGER (4)
  'intent_category',
  'target_segment',
  'trigger_event',
  'trigger_min_value',
  
  // VALIDITY (3)
  'valid_from',
  'valid_until',
  'valid_until_unlimited',
  
  // REWARD CORE (6)
  'reward_type',
  'reward_amount',
  'reward_unit',
  'reward_is_percentage',
  'max_bonus',
  'max_bonus_unlimited',
  
  // CALCULATION (4)
  'calculation_basis',
  'min_calculation',
  'payout_direction',
  'conversion_formula',
  
  // CLAIM RULES (6)
  'min_deposit',
  'max_claim',
  'max_claim_unlimited',
  'claim_frequency',
  'claim_method',
  'claim_deadline_days',
  
  // TURNOVER / WD (3)
  'turnover_enabled',
  'turnover_multiplier',
  'min_withdraw_after_bonus',
  
  // DISTRIBUTION (3)
  'distribution_mode',
  'distribution_schedule',
  'distribution_note',
  
  // TIERS (2)
  'tier_count',
  'tiers',
  
  // GAME SCOPE (4)
  'game_scope',
  'game_types',
  'game_providers',
  'game_exclusions',
  
  // ACCESS & RESTRICTION (4)
  'platform_access',
  'geo_restriction',
  'require_apk',
  'one_account_rule',
  
  // RISK (2)
  'promo_risk_level',
  'anti_fraud_notes',
  
  // ESCAPE HATCH (3)
  'special_conditions',
  'custom_terms',
  'extra_config',
  
  // SUBCATEGORIES (2)
  'has_subcategories',
  'subcategories',
  
  // AUDIT (5)
  'created_at',
  'updated_at',
  'created_by',
  'extraction_confidence',
  'human_verified',
] as const;

export type CanonicalFieldName = typeof CANONICAL_EXPORT_WHITELIST[number];

// ============================================================================
// TAXONOMY RULES (LOCKED VALUES)
// ============================================================================

export const TAXONOMY_RULES = {
  category: ['reward', 'event', ''] as const,
  mode: ['fixed', 'dinamis', 'tier', ''] as const,
  tier_archetype: ['level', 'point_store', 'referral', 'formula', 'advanced', 'parlay', 'exchange_catalog', null] as const,
} as const;

export type CanonicalCategory = typeof TAXONOMY_RULES.category[number];
export type CanonicalMode = typeof TAXONOMY_RULES.mode[number];
export type CanonicalTierArchetype = typeof TAXONOMY_RULES.tier_archetype[number];

// ============================================================================
// HARD FAIL CONDITIONS
// ============================================================================

export interface HardFailResult {
  failed: boolean;
  reason: string;
}

/**
 * Check for hard fail conditions that should STOP output
 */
export function checkHardFail(data: Record<string, unknown>): HardFailResult {
  // 1. Missing schema_version
  if (!data.schema_version) {
    return { failed: true, reason: 'Missing schema_version field' };
  }
  
  // 2. mode = "tier" but tiers[] empty
  if (data.mode === 'tier') {
    const tiers = data.tiers as unknown[];
    if (!tiers || !Array.isArray(tiers) || tiers.length === 0) {
      return { failed: true, reason: 'mode = "tier" but tiers[] is empty' };
    }
  }
  
  // 3. Percentage reward without max_bonus or max_bonus_unlimited
  if (data.reward_unit === 'percent' || data.reward_unit === 'percentage') {
    const maxBonus = data.max_bonus as number | null;
    const maxBonusUnlimited = data.max_bonus_unlimited as boolean;
    if ((maxBonus === null || maxBonus === undefined) && !maxBonusUnlimited) {
      return { 
        failed: true, 
        reason: 'Percentage reward requires max_bonus or max_bonus_unlimited = true' 
      };
    }
  }
  
  // 4. Unknown field names (check for non-whitelisted fields)
  const unknownFields = Object.keys(data).filter(
    key => !CANONICAL_EXPORT_WHITELIST.includes(key as CanonicalFieldName)
  );
  if (unknownFields.length > 0) {
    return { 
      failed: true, 
      reason: `Unknown field(s) detected: ${unknownFields.join(', ')}` 
    };
  }
  
  // 5. Invalid taxonomy values
  if (data.category && !TAXONOMY_RULES.category.includes(data.category as CanonicalCategory)) {
    return { failed: true, reason: `Invalid category: ${data.category}` };
  }
  if (data.mode && !TAXONOMY_RULES.mode.includes(data.mode as CanonicalMode)) {
    return { failed: true, reason: `Invalid mode: ${data.mode}` };
  }
  if (data.tier_archetype !== null && data.tier_archetype !== undefined) {
    if (!TAXONOMY_RULES.tier_archetype.includes(data.tier_archetype as CanonicalTierArchetype)) {
      return { failed: true, reason: `Invalid tier_archetype: ${data.tier_archetype}` };
    }
  }
  
  return { failed: false, reason: '' };
}

// ============================================================================
// FIELD ENFORCEMENT HELPERS
// ============================================================================

/**
 * Strip UI-specific prefixes from field names
 */
export function stripUIPrefix(key: string): string {
  const prefixes = ['fixed_', 'dinamis_', 'global_', 'formula_'];
  for (const prefix of prefixes) {
    if (key.startsWith(prefix)) {
      return key.slice(prefix.length);
    }
  }
  return key;
}

/**
 * Check if a field should be moved to extra_config
 */
export function isEngineLogicField(key: string): boolean {
  const engineFields = [
    'formula_metadata',
    'calculation_steps',
    'payout_mechanics',
    'admin_fee_logic',
    'commission_calculator',
    'net_winlose',
    'commission_result',
  ];
  return engineFields.includes(key);
}

/**
 * Consolidate legacy game blacklist arrays into game_exclusions
 */
export function enforceGameExclusions(data: Record<string, unknown>): string[] {
  // If old format exists, consolidate
  const typesBlacklist = data.game_types_blacklist as string[] | undefined;
  const providersBlacklist = data.game_providers_blacklist as string[] | undefined;
  const namesBlacklist = data.game_names_blacklist as string[] | undefined;
  
  if (typesBlacklist || providersBlacklist || namesBlacklist) {
    return consolidateGameExclusions(typesBlacklist, providersBlacklist, namesBlacklist);
  }
  
  return (data.game_exclusions as string[]) || [];
}

// ============================================================================
// MAIN GUARD FUNCTION
// ============================================================================

export interface CanonicalGuardResult {
  valid: boolean;
  output: CanonicalPromoKB | null;
  errors: string[];
  warnings: string[];
}

/**
 * Main enforcement function that validates and transforms output
 * to strictly follow Canonical Contract v2.1-FINAL
 */
export function enforceCanonicalGuard(data: Record<string, unknown>): CanonicalGuardResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // STEP 1: Start with INERT baseline (full-shape)
  const output: Record<string, unknown> = { ...CANONICAL_INERT };
  
  // STEP 2: Move engine logic to extra_config
  const extraConfig: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    const canonicalKey = stripUIPrefix(key);
    
    // Move engine logic to extra_config
    if (isEngineLogicField(canonicalKey)) {
      extraConfig[canonicalKey] = value;
      continue;
    }
    
    // Only copy whitelisted fields
    if (CANONICAL_EXPORT_WHITELIST.includes(canonicalKey as CanonicalFieldName)) {
      output[canonicalKey] = value;
    } else {
      // Non-whitelisted field - check if it's just a prefixed version
      const strippedKey = stripUIPrefix(key);
      if (CANONICAL_EXPORT_WHITELIST.includes(strippedKey as CanonicalFieldName)) {
        output[strippedKey] = value;
      } else {
        warnings.push(`Skipped unknown field: ${key}`);
      }
    }
  }
  
  // Merge extra_config
  output.extra_config = {
    ...((output.extra_config as Record<string, unknown>) || {}),
    ...extraConfig,
  };
  
  // STEP 3: Ensure schema_version
  output.schema_version = '2.1';
  
  // STEP 4: Normalize turnover_multiplier to number
  if (typeof output.turnover_multiplier === 'string') {
    output.turnover_multiplier = parseTurnoverMultiplier(output.turnover_multiplier as string);
  }
  
  // STEP 5: Consolidate game exclusions
  output.game_exclusions = enforceGameExclusions(data);
  
  // STEP 6: Check hard fail conditions
  const hardFail = checkHardFail(output);
  if (hardFail.failed) {
    errors.push(`HARD FAIL: ${hardFail.reason}`);
    return {
      valid: false,
      output: null,
      errors,
      warnings,
    };
  }
  
  // STEP 7: Run validation
  const validation = validateCanonicalPromo(output as unknown as CanonicalPromoKB);
  errors.push(...validation.errors);
  warnings.push(...validation.warnings);
  
  return {
    valid: errors.length === 0,
    output: output as unknown as CanonicalPromoKB,
    errors,
    warnings,
  };
}

// ============================================================================
// CANONICAL OUTPUT PROMPT (for LLM injection)
// ============================================================================

export const CANONICAL_OUTPUT_PROMPT = `
🔒 CANONICAL OUTPUT RULES (NON-NEGOTIABLE):

1. ONLY output fields that exist in the Canonical Contract v2.1
2. ALWAYS output FULL-SHAPE JSON (every field must exist)
3. Use "", null, false, or [] for non-applicable fields
4. Ignore UI-specific prefixes (fixed_, dinamis_, global_, etc.)

❌ HARD FAIL CONDITIONS (STOP OUTPUT):
- Missing schema_version
- mode = "tier" but tiers[] empty
- Percentage reward without max_bonus or max_bonus_unlimited
- Unknown field name appears
- Engine logic placed outside extra_config

✅ TAXONOMY RULES (LOCKED VALUES):
- category: "reward" | "event" | ""
- mode: "fixed" | "dinamis" | "tier" | ""
- tier_archetype: "level" | "point" | "network" | null

🧩 TIER STRUCTURE (REQUIRED for mode = "tier"):
Each tier in tiers[] MUST follow:
{
  "tier_id": "",
  "tier_name": "",
  "tier_order": 1,
  "requirement_value": 0,
  "requirement_max": null,
  "reward_value": null,
  "reward_type": "",
  "turnover_multiplier": null,
  "extra": {}
}

🧯 ESCAPE HATCH:
- special_conditions[] → short textual requirements
- custom_terms → FULL S&K BACKUP
- extra_config → ALL advanced / engine logic

📦 OUTPUT FORMAT: JSON only, no explanation, no markdown
`;

// ============================================================================
// EXPORTS
// ============================================================================

export {
  validateCanonicalPromo,
  CANONICAL_INERT,
  type CanonicalPromoKB,
} from './canonical-promo-schema';
