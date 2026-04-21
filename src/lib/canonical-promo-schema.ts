/**
 * CANONICAL PROMO KB SCHEMA v2.1-FINAL (LOCKED)
 * 
 * Satu schema konsisten, flat, CSV-friendly, Lovable-safe,
 * berlaku untuk ribuan promo & klien, tanpa schema drift.
 * 
 * PRINSIP KUNCI:
 * 1. Canonical = pengetahuan promo, bukan engine
 * 2. Eligibility ≠ Calculation
 * 3. 1 field = 1 makna
 * 4. Semua ekspansi → extra_config
 * 5. Full S&K → custom_terms (JSONB3 backup)
 * 6. Tidak ada field turunan / hasil hitung
 * 7. Full-shape JSON (field boleh inert)
 */

// ============================================
// CANONICAL INTERFACES
// ============================================

/**
 * Universal Tier structure for all tier-based promos
 * Works for: level, point_store, referral, formula — v2.2
 */
export interface UniversalTier {
  tier_id: string;
  tier_name: string;
  tier_order: number;
  requirement_value: number;
  requirement_max?: number | null;
  reward_value: number | null;
  reward_type: string;
  turnover_multiplier?: number | null;

  // === NEW v2.2 ===
  tier_dimension?: 'level' | 'downline_count' | 'team_count' | 'deposit_amount' | 'turnover_amount' | 'point_balance' | null;
  min_dimension_value?: number | null;
  max_dimension_value?: number | null;
  special_conditions?: string[];        // default: []

  extra: Record<string, unknown>;       // Escape hatch per-tier
}

/**
 * Canonical Subcategory structure — v2.2
 */
export interface CanonicalSubCategory {
  sub_id: string;
  sub_name: string;
  game_types: string[];
  game_providers: string[];
  reward_amount: number | null;
  reward_is_percentage: boolean;
  max_bonus: number | null;
  min_deposit: number | null;
  turnover_multiplier: number | null;
  payout_direction: 'depan' | 'belakang' | null;

  // === NEW v2.2 ===
  subcategory_code?: string | null;
  game_exclusions: string[];            // default: []
  conversion_formula: string;           // mandatory for mechanic promos
}

/**
 * Canonical Promo KB Schema v2.1-FINAL
 * This is the OUTPUT schema for storage/export/API
 */
export interface CanonicalPromoKB {
  schema_version: '2.1' | '2.2' | 'V.APR.09';

  // ===============================
  // CORE IDENTITY
  // ===============================
  client_id: string;
  client_name: string;
  promo_id: string;
  promo_name: string;
  promo_slug: string;
  source_url: string;
  status: 'active' | 'paused' | 'draft' | 'expired';
  promo_summary: string;

  // ===============================
  // TAXONOMY (KONTRAK UTAMA)
  // ===============================
  category: 'REWARD' | 'EVENT' | '';
  mode: 'fixed' | 'tier' | 'formula' | '';
  tier_archetype: 'level' | 'point_store' | 'referral' | 'formula' | 'advanced' | 'parlay' | 'exchange_catalog' | null;

  // ===============================
  // INTENT & TRIGGER
  // ===============================
  intent_category: string;
  target_segment: string;
  trigger_event: string;
  trigger_min_value: number | null;

  // ===============================
  // VALIDITY
  // ===============================
  valid_from: string;
  valid_until: string;
  valid_until_unlimited: boolean;

  // ===============================
  // REWARD CORE
  // ===============================
  reward_type: string;
  reward_amount: number | null;
  reward_unit: string;
  reward_is_percentage: boolean;
  max_bonus: number | null;
  max_bonus_unlimited: boolean;

  // ===============================
  // CALCULATION (DINAMIS SAJA)
  // ===============================
  calculation_basis: string;
  min_calculation: number | null;
  payout_direction: 'depan' | 'belakang' | null;
  conversion_formula: string;

  // ===============================
  // CLAIM RULES
  // ===============================
  min_deposit: number | null;
  max_claim: number | null;
  max_claim_unlimited: boolean;
  claim_frequency: string;
  claim_method: 'auto' | 'manual' | 'cs_request' | '';
  claim_deadline_days: number | null;

  // ===============================
  // TURNOVER / WD
  // ===============================
  turnover_enabled: boolean;
  turnover_multiplier: number | null;
  min_withdraw_after_bonus: number | null;

  // ===============================
  // DISTRIBUTION
  // ===============================
  distribution_mode: string;
  distribution_schedule: string;
  distribution_note: string;

  // ===============================
  // TIERS (UNIVERSAL ARRAY)
  // ===============================
  /**
   * Validator hint - NOT source of truth.
   * Actual tier count should be derived from tiers.length.
   * Used for quick sanity checks without parsing full array.
   * Auto-derived from tiers.length in buildCanonicalPayload().
   */
  tier_count: number;
  tiers: UniversalTier[];

  // ===============================
  // GAME SCOPE
  // ===============================
  game_scope: string;
  game_types: string[];
  game_providers: string[];
  game_exclusions: string[];

  // ===============================
  // ACCESS & RESTRICTION
  // ===============================
  platform_access: string;
  geo_restriction: string;
  require_apk: boolean;
  one_account_rule: boolean;

  // ===============================
  // RISK
  // ===============================
  promo_risk_level: string;
  anti_fraud_notes: string;

  // ===============================
  // ESCAPE HATCH (FINAL)
  // ===============================
  special_conditions: string[];
  custom_terms: string;
  extra_config: Record<string, unknown>;

  // ===============================
  // NEW v2.2 FIELDS (ADDITIVE)
  // ===============================
  reward_item_description?: string | null;
  claim_url?: string | null;
  claim_platform?: 'auto' | 'livechat' | 'whatsapp' | 'telegram' | 'form' | 'apk' | 'dashboard' | null;
  proof_required?: boolean;
  proof_type?: 'screenshot' | 'bill_share' | 'social_post' | 'none';
  proof_destination?: 'livechat' | 'whatsapp' | 'telegram' | 'facebook' | 'none';
  penalty_type?: 'bonus_cancel' | 'full_balance_void' | null;

  // ===============================
  // ARCHETYPE PAYLOAD (ADDITIVE — SSoT SAFE)
  // ===============================
  turnover_basis: 'bonus_only' | 'deposit_plus_bonus' | 'deposit_only' | null;
  archetype_payload: Record<string, unknown>;
  archetype_invariants: Record<string, unknown>;

  // ===============================
  // SUBCATEGORIES (COMBO PROMO)
  // ===============================
  has_subcategories: boolean;
  subcategories: CanonicalSubCategory[];

  // ===============================
  // AUDIT
  // ===============================
  created_at: string;
  updated_at: string;
  created_by: string;
  extraction_confidence: number | null;
  human_verified: boolean;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate URL-safe slug from promo name
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parse turnover multiplier from string to number
 * "3x" → 3, "10x" → 10, "" → null
 */
export function parseTurnoverMultiplier(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  
  const match = String(value).match(/^(\d+)x?$/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Map program_classification to canonical category
 */
export function mapToCategory(programClassification?: string): 'REWARD' | 'EVENT' | '' {
  if (!programClassification) return '';
  
  const classification = programClassification.toUpperCase();
  if (classification === 'A' || classification === 'B') {
    return 'REWARD';
  }
  if (classification === 'C') {
    return 'EVENT';
  }
  return '';
}

/**
 * Consolidate game blacklists into single game_exclusions array
 */
export function consolidateGameExclusions(
  typesBlacklist?: string[],
  providersBlacklist?: string[],
  namesBlacklist?: string[]
): string[] {
  const exclusions: string[] = [];
  
  if (typesBlacklist?.length) {
    exclusions.push(...typesBlacklist.map(t => `type:${t}`));
  }
  if (providersBlacklist?.length) {
    exclusions.push(...providersBlacklist.map(p => `provider:${p}`));
  }
  if (namesBlacklist?.length) {
    exclusions.push(...namesBlacklist.map(n => `game:${n}`));
  }
  
  return exclusions;
}

/**
 * Inert value for CanonicalPromoKB (empty/null baseline)
 */
export const CANONICAL_INERT: CanonicalPromoKB = {
  schema_version: 'V.APR.09',
  
  // Core Identity
  client_id: '',
  client_name: '',
  promo_id: '',
  promo_name: '',
  promo_slug: '',
  source_url: '',
  status: 'draft',
  promo_summary: '',
  
  // Taxonomy
  category: '',
  mode: '',
  tier_archetype: null,
  
  // Intent & Trigger
  intent_category: '',
  target_segment: '',
  trigger_event: '',
  trigger_min_value: null,
  
  // Validity
  valid_from: '',
  valid_until: '',
  valid_until_unlimited: false,
  
  // Reward Core
  reward_type: '',
  reward_amount: null,
  reward_unit: '',
  reward_is_percentage: false,
  max_bonus: null,
  max_bonus_unlimited: false,
  
  // Calculation
  calculation_basis: '',
  min_calculation: null,
  payout_direction: null,
  conversion_formula: '',
  
  // Claim Rules
  min_deposit: null,
  max_claim: null,
  max_claim_unlimited: false,
  claim_frequency: '',
  claim_method: '',
  claim_deadline_days: null,
  
  // Turnover / WD
  turnover_enabled: false,
  turnover_multiplier: null,
  min_withdraw_after_bonus: null,
  
  // Distribution
  distribution_mode: '',
  distribution_schedule: '',
  distribution_note: '',
  
  // Tiers
  tier_count: 0,
  tiers: [],
  
  // Game Scope
  game_scope: '',
  game_types: [],
  game_providers: [],
  game_exclusions: [],
  
  // Access & Restriction
  platform_access: '',
  geo_restriction: '',
  require_apk: false,
  one_account_rule: false,
  
  // Risk
  promo_risk_level: '',
  anti_fraud_notes: '',
  
  // Escape Hatch
  special_conditions: [],
  custom_terms: '',
  extra_config: {},
  
  // New v2.2 fields
  reward_item_description: null,
  claim_url: null,
  claim_platform: null,
  proof_required: false,
  proof_type: 'none',
  proof_destination: 'none',
  penalty_type: null,
  
  // Archetype Payload
  turnover_basis: null,
  archetype_payload: {},
  archetype_invariants: {},
  
  // Subcategories
  has_subcategories: false,
  subcategories: [],
  
  // Audit
  created_at: '',
  updated_at: '',
  created_by: '',
  extraction_confidence: null,
  human_verified: false,
};

// ============================================
// VALIDATION RULES (from Validator Matrix)
// ============================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate canonical promo against Validator Matrix rules
 */
export function validateCanonicalPromo(promo: CanonicalPromoKB): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // HARD FAIL: mode=tier & tiers kosong
  if (promo.mode === 'tier' && promo.tiers.length === 0) {
    errors.push('Mode tier memerlukan tiers[] tidak boleh kosong');
  }
  
  // HARD FAIL: reward_unit=percent & max_bonus kosong (kecuali unlimited)
  if (promo.reward_unit === 'percent' && promo.max_bonus === null && !promo.max_bonus_unlimited) {
    errors.push('Reward persentase memerlukan max_bonus atau max_bonus_unlimited');
  }
  
  // REWARD Mode Validation
  if (promo.category === 'REWARD') {
    if (promo.mode === 'fixed') {
      if (promo.reward_amount === null) {
        warnings.push('Fixed mode sebaiknya memiliki reward_amount');
      }
      if (promo.tiers.length > 0) {
        errors.push('Fixed mode tidak boleh memiliki tiers[]');
      }
    }
    
    if (promo.mode === 'formula') {
      if (!promo.calculation_basis) {
        warnings.push('Dinamis mode sebaiknya memiliki calculation_basis');
      }
      if (promo.tiers.length > 0) {
        errors.push('Dinamis mode tidak boleh memiliki tiers[]');
      }
    }
    
    if (promo.mode === 'tier') {
      if (!promo.tier_archetype) {
        errors.push('Tier mode memerlukan tier_archetype');
      }
    }
  }
  
  // EVENT Mode Validation
  if (promo.category === 'EVENT') {
    if (!promo.trigger_event) {
      warnings.push('Event promo sebaiknya memiliki trigger_event');
    }
  }
  
  // ============================================
  // ARCHETYPE PAYLOAD VALIDATION (SSoT + Completeness)
  // ============================================
  
  // Rule 1 — ERROR: SSoT violation — turnover_basis in payload (4 patterns)
  const payload = promo.archetype_payload || {};
  const payloadStr = JSON.stringify(payload);
  
  if ('turnover_basis' in payload) {
    errors.push('SSoT violation: turnover_basis ditemukan di archetype_payload (harus di root)');
  }
  if ((payload as Record<string, unknown>).withdraw_rule && 
      typeof (payload as Record<string, unknown>).withdraw_rule === 'object' &&
      'turnover_basis' in ((payload as Record<string, unknown>).withdraw_rule as Record<string, unknown>)) {
    errors.push('SSoT violation: turnover_basis ditemukan di archetype_payload.withdraw_rule');
  }
  if ((payload as Record<string, unknown>).turnover && 
      typeof (payload as Record<string, unknown>).turnover === 'object' &&
      'basis' in ((payload as Record<string, unknown>).turnover as Record<string, unknown>)) {
    errors.push('SSoT violation: turnover basis ditemukan di archetype_payload.turnover.basis');
  }
  if ((payload as Record<string, unknown>).post_reward_rules && 
      typeof (payload as Record<string, unknown>).post_reward_rules === 'object' &&
      'turnover_basis' in ((payload as Record<string, unknown>).post_reward_rules as Record<string, unknown>)) {
    errors.push('SSoT violation: turnover_basis ditemukan di archetype_payload.post_reward_rules');
  }
  
  // Rule 2 — WARNING: Ambiguous TO basis
  if (promo.turnover_enabled === true && promo.turnover_basis === null) {
    warnings.push('Ambiguous TO basis: turnover_enabled=true tapi turnover_basis=null');
  }
  
  // Rule 3 — WARNING: Lifecycle-heavy archetype with empty payload
  const LIFECYCLE_HEAVY: string[] = ['LUCKY_DRAW', 'COMPETITION'];
  const resolvedArchetype = (
    (promo.extra_config as Record<string, unknown>)?._taxonomy_decision as Record<string, unknown> | undefined
  )?.archetype as string | undefined
    ?? ((promo.extra_config as Record<string, unknown>)?._taxonomy as Record<string, unknown> | undefined)?.archetype as string | undefined
    ?? null;
  
  if (resolvedArchetype && LIFECYCLE_HEAVY.includes(resolvedArchetype) && Object.keys(payload).length === 0) {
    warnings.push(`Archetype ${resolvedArchetype} lifecycle-heavy tapi archetype_payload kosong`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
