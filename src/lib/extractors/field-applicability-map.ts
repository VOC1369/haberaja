/**
 * Field Applicability Map v1.0
 * 
 * ARSITEKTUR: Full-Shape JSON dengan Inert Values
 * 
 * PRINSIP:
 * 1. Setiap promo HARUS memiliki semua key JSON yang identik (full-shape)
 * 2. Field yang tidak applicable di-set ke nilai INERT, BUKAN dihapus
 * 3. Summary = cermin jujur dari form state (tidak ada auto-fix)
 * 
 * INERT VALUES:
 * - number → null (BUKAN 0, karena 0 bisa valid)
 * - string → "" (empty string)
 * - boolean → false
 * - array → []
 * - object → null (untuk optional objects)
 */

// ============================================
// INERT VALUE DEFINITIONS
// ============================================

/**
 * Standard inert values per field name
 * Field tidak applicable harus di-set ke nilai ini, BUKAN dihapus
 */
export const INERT_VALUES: Record<string, unknown> = {
  // === Numbers → null (BUKAN 0!) ===
  min_deposit: null,
  max_claim: null,
  min_calculation: null,
  reward_amount: null,
  referral_admin_fee_percentage: null,
  calculation_value: null,
  fixed_calculation_value: null,
  fixed_max_claim: null,
  fixed_min_calculation: null,
  fixed_admin_fee_percentage: null,
  fixed_min_depo: null,
  fixed_cash_reward_amount: null,
  dinamis_max_claim: null,
  min_reward_claim: null,         // Standardized from dinamis_min_claim
  dinamis_reward_amount: null,
  global_max_bonus: null,
  lp_earn_amount: null,
  lp_earn_point_amount: null,
  admin_fee_percentage: null,
  // Universal Reward Fields
  reward_quantity: null,
  fixed_reward_quantity: null,
  lucky_spin_max_per_day: null,
  fixed_lucky_spin_max_per_day: null,
  
  // === Strings → "" ===
  turnover_rule: "",
  turnover_rule_custom: "",
  referral_calculation_basis: "",
  calculation_base: "",
  calculation_method: "",
  fixed_calculation_base: "",
  fixed_calculation_method: "",
  fixed_reward_type: "",
  fixed_turnover_rule: "",
  fixed_turnover_rule_custom: "",
  conversion_formula: "",
  exp_formula: "",
  lp_value: "",
  exp_value: "",
  promo_unit: "",
  exp_mode: "",
  lp_calc_method: "",
  exp_calc_method: "",
  lp_earn_basis: "",
  redeem_jenis_reward: "",
  dinamis_reward_type: "",
  // Voucher & Lucky Spin
  voucher_kind: "",
  voucher_valid_until: "",
  fixed_voucher_kind: "",
  fixed_voucher_valid_until: "",
  lucky_spin_id: "",
  fixed_lucky_spin_id: "",
  
  // === Booleans → false ===
  turnover_rule_enabled: false,
  referral_admin_fee_enabled: false,
  fixed_turnover_rule_enabled: false,
  fixed_admin_fee_enabled: false,
  fixed_min_calculation_enabled: false,
  fixed_max_claim_unlimited: false,
  fixed_min_depo_enabled: false,
  min_calculation_enabled: false,
  dinamis_max_claim_unlimited: false,
  min_reward_claim_enabled: false,   // Standardized from dinamis_min_claim_enabled
  admin_fee_enabled: false,
  has_subcategories: false,
  // Lucky Spin
  lucky_spin_enabled: false,
  fixed_lucky_spin_enabled: false,
  
  // === Arrays → [] ===
  referral_tiers: [],
  tiers: [],
  subcategories: [],
  redeem_items: [],
  fast_exp_missions: [],
  level_up_rewards: [],
  
  // === Objects → null ===
  formula_metadata: null,
  vip_multiplier: null,
};

// ============================================
// FIELD APPLICABILITY RULES PER PROMO TYPE
// ============================================

export interface FieldApplicabilityRule {
  applicable: string[];      // Fields yang RELEVAN untuk promo type ini
  not_applicable: string[];  // Fields yang TIDAK RELEVAN → set ke inert value
}

/**
 * Master mapping: promo_type → field applicability
 * 
 * ATURAN:
 * - Field di `applicable`: tetap apa adanya dari form
 * - Field di `not_applicable`: di-set ke INERT value (null/""/false/[])
 * - Field tidak di kedua list: tetap apa adanya (default behavior)
 */
export const FIELD_APPLICABILITY_MAP: Record<string, FieldApplicabilityRule> = {
  // ============================================
  // CASHBACK (Loss-based) — Rebate dari kekalahan
  // ============================================
  'Cashback (Loss-based)': {
    applicable: [
      'calculation_base', 'calculation_value', 'min_calculation', 'min_calculation_enabled',
      'claim_frequency', 'distribution_day', 'max_claim', 'subcategories', 'has_subcategories',
      'dinamis_reward_type', 'dinamis_max_claim', 'dinamis_max_claim_unlimited',
      'formula_metadata', 'conversion_formula',
    ],
    not_applicable: [
      // Deposit/Turnover Rule — Cashback tidak punya WD requirement
      'min_deposit', 'turnover_rule', 'turnover_rule_enabled', 'turnover_rule_custom',
      // Referral fields — bukan referral promo
      'referral_tiers', 'referral_calculation_basis', 'referral_admin_fee_enabled', 'referral_admin_fee_percentage',
      // Tier/LP/EXP fields — bukan tier mode
      'tiers', 'redeem_items', 'promo_unit', 'exp_mode', 'lp_calc_method', 'exp_calc_method',
      'lp_earn_basis', 'lp_earn_amount', 'lp_earn_point_amount', 'exp_formula', 'lp_value', 'exp_value',
      'fast_exp_missions', 'level_up_rewards', 'vip_multiplier', 'redeem_jenis_reward',
      // Fixed mode fields — Cashback biasanya dinamis/formula
      'fixed_reward_type', 'fixed_calculation_base', 'fixed_calculation_method', 'fixed_calculation_value',
      'fixed_max_claim', 'fixed_max_claim_unlimited', 'fixed_admin_fee_enabled', 'fixed_admin_fee_percentage',
      'fixed_min_calculation', 'fixed_min_calculation_enabled', 'fixed_turnover_rule', 'fixed_turnover_rule_enabled',
      'fixed_min_depo', 'fixed_min_depo_enabled',
    ],
  },

  // ============================================
  // ROLLINGAN (Turnover-based) — Rebate dari turnover
  // ============================================
  'Rollingan (Turnover-based)': {
    applicable: [
      'calculation_base', 'calculation_value', 'min_calculation', 'min_calculation_enabled',
      'claim_frequency', 'distribution_day', 'max_claim', 'subcategories', 'has_subcategories',
      'dinamis_reward_type', 'dinamis_max_claim', 'dinamis_max_claim_unlimited',
      'formula_metadata', 'conversion_formula',
    ],
    not_applicable: [
      // Sama dengan Cashback — tidak ada WD requirement
      'min_deposit', 'turnover_rule', 'turnover_rule_enabled', 'turnover_rule_custom',
      // Referral fields
      'referral_tiers', 'referral_calculation_basis', 'referral_admin_fee_enabled', 'referral_admin_fee_percentage',
      // Tier/LP/EXP fields
      'tiers', 'redeem_items', 'promo_unit', 'exp_mode', 'lp_calc_method', 'exp_calc_method',
      'lp_earn_basis', 'lp_earn_amount', 'lp_earn_point_amount', 'exp_formula', 'lp_value', 'exp_value',
      'fast_exp_missions', 'level_up_rewards', 'vip_multiplier', 'redeem_jenis_reward',
      // Fixed mode fields
      'fixed_reward_type', 'fixed_calculation_base', 'fixed_calculation_method', 'fixed_calculation_value',
      'fixed_max_claim', 'fixed_max_claim_unlimited', 'fixed_admin_fee_enabled', 'fixed_admin_fee_percentage',
      'fixed_min_calculation', 'fixed_min_calculation_enabled', 'fixed_turnover_rule', 'fixed_turnover_rule_enabled',
      'fixed_min_depo', 'fixed_min_depo_enabled',
    ],
  },

  // ============================================
  // ROLLINGAN / CASHBACK (Combo variant)
  // ============================================
  'Rollingan / Cashback': {
    applicable: [
      'calculation_base', 'calculation_value', 'min_calculation', 'min_calculation_enabled',
      'claim_frequency', 'distribution_day', 'max_claim', 'subcategories', 'has_subcategories',
      'dinamis_reward_type', 'dinamis_max_claim', 'dinamis_max_claim_unlimited',
      'formula_metadata', 'conversion_formula',
    ],
    not_applicable: [
      'min_deposit', 'turnover_rule', 'turnover_rule_enabled', 'turnover_rule_custom',
      'referral_tiers', 'referral_calculation_basis', 'referral_admin_fee_enabled', 'referral_admin_fee_percentage',
      'tiers', 'redeem_items', 'promo_unit', 'exp_mode', 'lp_calc_method', 'exp_calc_method',
      'lp_earn_basis', 'lp_earn_amount', 'lp_earn_point_amount', 'exp_formula', 'lp_value', 'exp_value',
      'fast_exp_missions', 'level_up_rewards', 'vip_multiplier', 'redeem_jenis_reward',
      'fixed_reward_type', 'fixed_calculation_base', 'fixed_calculation_method', 'fixed_calculation_value',
      'fixed_max_claim', 'fixed_max_claim_unlimited', 'fixed_admin_fee_enabled', 'fixed_admin_fee_percentage',
      'fixed_min_calculation', 'fixed_min_calculation_enabled', 'fixed_turnover_rule', 'fixed_turnover_rule_enabled',
      'fixed_min_depo', 'fixed_min_depo_enabled',
    ],
  },

  // ============================================
  // REFERRAL BONUS — Commission dari downline
  // ============================================
  'Referral Bonus': {
    applicable: [
      'referral_tiers', 'referral_calculation_basis',
      'referral_admin_fee_enabled', 'referral_admin_fee_percentage',
    ],
    not_applicable: [
      // Deposit/WD fields — Referral tidak pakai deposit/turnover rule
      'min_deposit', 'turnover_rule', 'turnover_rule_enabled', 'turnover_rule_custom',
      'min_calculation', 'min_calculation_enabled',
      // Calculation fields — Referral pakai commission tier, bukan calculation
      'calculation_value', 'calculation_base', 'calculation_method',
      // Subcategories — Referral pakai referral_tiers, bukan subcategories
      'subcategories', 'has_subcategories',
      // Tier/LP/EXP fields — Referral bukan tier mode biasa
      'tiers', 'redeem_items', 'promo_unit', 'exp_mode', 'lp_calc_method', 'exp_calc_method',
      'lp_earn_basis', 'lp_earn_amount', 'lp_earn_point_amount', 'exp_formula', 'lp_value', 'exp_value',
      'fast_exp_missions', 'level_up_rewards', 'vip_multiplier', 'redeem_jenis_reward',
      // Dinamis fields
      'dinamis_reward_type', 'dinamis_reward_amount', 'dinamis_max_claim', 'dinamis_max_claim_unlimited',
      'min_reward_claim', 'min_reward_claim_enabled', 'conversion_formula', 'formula_metadata',
      // Fixed mode fields
      'fixed_reward_type', 'fixed_calculation_base', 'fixed_calculation_method', 'fixed_calculation_value',
      'fixed_max_claim', 'fixed_max_claim_unlimited', 'fixed_admin_fee_enabled', 'fixed_admin_fee_percentage',
      'fixed_min_calculation', 'fixed_min_calculation_enabled', 'fixed_turnover_rule', 'fixed_turnover_rule_enabled',
      'fixed_min_depo', 'fixed_min_depo_enabled',
    ],
  },

  // ============================================
  // WELCOME BONUS — First deposit bonus
  // ============================================
  'Welcome Bonus': {
    applicable: [
      'min_deposit', 'reward_amount', 'turnover_rule', 'turnover_rule_enabled', 'max_claim',
      'subcategories', 'has_subcategories',
      'fixed_reward_type', 'fixed_calculation_base', 'fixed_calculation_method', 'fixed_calculation_value',
      'fixed_max_claim', 'fixed_max_claim_unlimited', 'fixed_turnover_rule', 'fixed_turnover_rule_enabled',
      'fixed_min_depo', 'fixed_min_depo_enabled',
    ],
    not_applicable: [
      // Referral fields
      'referral_tiers', 'referral_calculation_basis', 'referral_admin_fee_enabled', 'referral_admin_fee_percentage',
      // Tier/LP/EXP fields
      'tiers', 'redeem_items', 'promo_unit', 'exp_mode', 'lp_calc_method', 'exp_calc_method',
      'lp_earn_basis', 'lp_earn_amount', 'lp_earn_point_amount', 'exp_formula', 'lp_value', 'exp_value',
      'fast_exp_missions', 'level_up_rewards', 'vip_multiplier', 'redeem_jenis_reward',
    ],
  },

  // ============================================
  // DEPOSIT BONUS — Recurring deposit bonus
  // ============================================
  'Deposit Bonus': {
    applicable: [
      'min_deposit', 'reward_amount', 'turnover_rule', 'turnover_rule_enabled', 'max_claim',
      'subcategories', 'has_subcategories',
      'fixed_reward_type', 'fixed_calculation_base', 'fixed_calculation_method', 'fixed_calculation_value',
      'fixed_max_claim', 'fixed_max_claim_unlimited', 'fixed_turnover_rule', 'fixed_turnover_rule_enabled',
      'fixed_min_depo', 'fixed_min_depo_enabled',
    ],
    not_applicable: [
      'referral_tiers', 'referral_calculation_basis', 'referral_admin_fee_enabled', 'referral_admin_fee_percentage',
      'tiers', 'redeem_items', 'promo_unit', 'exp_mode', 'lp_calc_method', 'exp_calc_method',
      'lp_earn_basis', 'lp_earn_amount', 'lp_earn_point_amount', 'exp_formula', 'lp_value', 'exp_value',
      'fast_exp_missions', 'level_up_rewards', 'vip_multiplier', 'redeem_jenis_reward',
    ],
  },

  // ============================================
  // LOYALTY POINT — Point-based reward system
  // ============================================
  'Loyalty Point': {
    applicable: [
      'lp_earn_basis', 'lp_earn_amount', 'lp_earn_point_amount',
      'redeem_items', 'redeem_jenis_reward', 'tiers',
      'promo_unit', 'lp_calc_method', 'lp_value',
    ],
    not_applicable: [
      // Referral fields
      'referral_tiers', 'referral_calculation_basis', 'referral_admin_fee_enabled', 'referral_admin_fee_percentage',
      // Turnover/Deposit rules
      'turnover_rule', 'turnover_rule_enabled', 'turnover_rule_custom', 'min_deposit',
      // Calculation fields (LP pakai earn rule, bukan calculation)
      'calculation_value', 'calculation_base', 'calculation_method', 'min_calculation', 'min_calculation_enabled',
      // Subcategories
      'subcategories', 'has_subcategories',
      // Fixed mode
      'fixed_reward_type', 'fixed_calculation_base', 'fixed_calculation_method', 'fixed_calculation_value',
      'fixed_max_claim', 'fixed_max_claim_unlimited', 'fixed_admin_fee_enabled', 'fixed_admin_fee_percentage',
      'fixed_min_calculation', 'fixed_min_calculation_enabled', 'fixed_turnover_rule', 'fixed_turnover_rule_enabled',
      'fixed_min_depo', 'fixed_min_depo_enabled',
      // Dinamis mode
      'dinamis_reward_type', 'dinamis_reward_amount', 'dinamis_max_claim', 'dinamis_max_claim_unlimited',
      'min_reward_claim', 'min_reward_claim_enabled', 'conversion_formula', 'formula_metadata',
    ],
  },

  // ============================================
  // EVENT / LEVEL UP — Milestone-based rewards
  // ============================================
  'Event / Level Up': {
    applicable: [
      'tiers', 'exp_mode', 'fast_exp_missions', 'level_up_rewards',
      'exp_calc_method', 'exp_formula', 'exp_value', 'promo_unit',
    ],
    not_applicable: [
      // Referral fields
      'referral_tiers', 'referral_calculation_basis', 'referral_admin_fee_enabled', 'referral_admin_fee_percentage',
      // Turnover/Deposit rules
      'turnover_rule', 'turnover_rule_enabled', 'turnover_rule_custom', 'min_deposit',
      // Calculation fields
      'calculation_value', 'calculation_base', 'calculation_method', 'min_calculation', 'min_calculation_enabled',
      // Subcategories
      'subcategories', 'has_subcategories',
      // Redeem/LP fields (Event pakai EXP, bukan LP)
      'redeem_items', 'redeem_jenis_reward', 'lp_calc_method', 'lp_earn_basis', 'lp_earn_amount', 'lp_earn_point_amount', 'lp_value',
      // Fixed mode
      'fixed_reward_type', 'fixed_calculation_base', 'fixed_calculation_method', 'fixed_calculation_value',
      'fixed_max_claim', 'fixed_max_claim_unlimited', 'fixed_admin_fee_enabled', 'fixed_admin_fee_percentage',
      'fixed_min_calculation', 'fixed_min_calculation_enabled', 'fixed_turnover_rule', 'fixed_turnover_rule_enabled',
      'fixed_min_depo', 'fixed_min_depo_enabled',
      // Dinamis mode
      'dinamis_reward_type', 'dinamis_reward_amount', 'dinamis_max_claim', 'dinamis_max_claim_unlimited',
      'min_reward_claim', 'min_reward_claim_enabled', 'conversion_formula', 'formula_metadata',
    ],
  },
};

// ============================================
// HELPER: Get Inert Value for a Field
// ============================================

/**
 * Get the appropriate inert value for a field
 * Falls back to pattern-based inference if not in explicit mapping
 */
export function getInertValue(fieldName: string): unknown {
  // Priority 1: Explicit mapping
  if (fieldName in INERT_VALUES) {
    return INERT_VALUES[fieldName];
  }
  
  // Priority 2: Pattern-based inference
  if (fieldName.endsWith('_enabled')) return false;
  if (fieldName.endsWith('_unlimited')) return false;
  if (fieldName.endsWith('_percentage') || fieldName.endsWith('_amount') || fieldName.endsWith('_value')) return null;
  if (fieldName.endsWith('_tiers') || fieldName.endsWith('_items') || fieldName.endsWith('_missions') || fieldName.endsWith('_rewards')) return [];
  if (fieldName.endsWith('_rule') || fieldName.endsWith('_custom') || fieldName.endsWith('_type') || fieldName.endsWith('_base') || fieldName.endsWith('_method')) return "";
  
  // Default: null for unknown fields
  return null;
}

// ============================================
// MAIN FUNCTION: Enforce Field Applicability
// ============================================

export interface ApplicabilityResult {
  data: Record<string, unknown>;
  inerted_fields: Array<{ field: string; from: unknown; to: unknown }>;
}

/**
 * Enforce field applicability rules on promo data
 * 
 * PENTING: Fungsi ini TIDAK menghapus field, hanya SET ke inert value!
 * Ini memastikan JSON shape tetap konsisten.
 * 
 * @param data - Raw promo data (PromoFormData atau Record)
 * @param promoType - Tipe promo untuk menentukan applicability
 * @returns Data dengan field non-applicable di-set ke inert values
 */
export function enforceFieldApplicability(
  data: Record<string, unknown>,
  promoType: string
): ApplicabilityResult {
  const result = { ...data };
  const inerted_fields: Array<{ field: string; from: unknown; to: unknown }> = [];
  
  console.log(`[FieldApplicability] Processing promo_type: "${promoType}"`);
  
  // Get applicability rule for this promo type
  const rule = FIELD_APPLICABILITY_MAP[promoType];
  
  if (!rule) {
    // No specific rule for this promo_type - return as-is
    console.warn(`[FieldApplicability] NO RULE FOUND for: "${promoType}"`);
    console.log(`[FieldApplicability] Available types:`, Object.keys(FIELD_APPLICABILITY_MAP));
    return { data: result, inerted_fields };
  }
  
  // Process each non-applicable field
  for (const fieldName of rule.not_applicable) {
    if (fieldName in result) {
      const originalValue = result[fieldName];
      const inertValue = getInertValue(fieldName);
      
      // Only log and track if value actually changes
      if (!isValueEqual(originalValue, inertValue)) {
        inerted_fields.push({
          field: fieldName,
          from: originalValue,
          to: inertValue,
        });
      }
      
      // Always set to inert value
      result[fieldName] = inertValue;
    }
  }
  
  if (inerted_fields.length > 0) {
    console.log(`[FieldApplicability] Set ${inerted_fields.length} fields to inert for "${promoType}":`, 
      inerted_fields.map(f => f.field));
  }
  
  return { data: result, inerted_fields };
}

/**
 * Helper: Check if two values are equal (for logging purposes)
 */
function isValueEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null && b === null) return true;
  if (a === undefined && b === null) return true; // Treat undefined as null-equivalent
  if (Array.isArray(a) && Array.isArray(b) && a.length === 0 && b.length === 0) return true;
  return false;
}

// ============================================
// EXPORT: Apply to buildPKBPayload
// ============================================

/**
 * Apply inert values to PKB payload based on promo_type
 * Used as secondary guard in buildPKBPayload()
 */
export function applyInertValuesToPayload(
  pkbData: Record<string, unknown>,
  promoType: string
): Record<string, unknown> {
  const { data } = enforceFieldApplicability(pkbData, promoType);
  return data;
}
