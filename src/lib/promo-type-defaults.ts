/**
 * Promo Type Defaults System
 * 
 * Provides sensible defaults for each promo type that are applied
 * ONLY when fields are empty/default. Never overwrites AI extraction or user edits.
 */

import { PromoFormData } from '@/components/VOCDashboard/PromoFormWizard/types';

// ============================================
// PROMO TYPE DEFAULTS
// ============================================

export interface PromoTypeDefaultConfig {
  reward_mode?: 'fixed' | 'tier' | 'formula';
  tier_archetype?: 'tier_level' | 'tier_point_store' | 'tier_network';  // NEW: For tier mode
  calculation_base?: string;
  calculation_method?: string;
  turnover_rule_enabled?: boolean;
  turnover_rule?: string;
  game_restriction?: string;
  claim_frequency?: string;
  target_segment?: string;
  trigger_event?: string;
  intent_category?: string;
  // Payment method fields
  deposit_method?: 'bank' | 'pulsa' | 'ewallet' | 'crypto' | 'qris' | 'all';
  // Validity fields
  valid_until_unlimited?: boolean;
  geo_restriction?: string;
}

export const PROMO_TYPE_DEFAULTS: Record<string, PromoTypeDefaultConfig> = {
  // Rollingan (Turnover-based)
  'Rollingan / Cashback': {
    reward_mode: 'formula',
    calculation_base: 'turnover',
    calculation_method: 'percentage',
    turnover_rule_enabled: false,
    game_restriction: 'semua',
    claim_frequency: 'mingguan',
    intent_category: 'Retention',
    target_segment: 'Semua',
    trigger_event: 'Turnover',      // Rollingan = Turnover-based
    valid_until_unlimited: true,
    geo_restriction: 'indonesia',
  },
  
  // Cashback (Loss-based) - DISTINCT from Rollingan!
  'Cashback (Loss-based)': {
    reward_mode: 'formula',
    calculation_base: 'loss',       // ✅ Dihitung dari KEKALAHAN
    calculation_method: 'percentage',
    turnover_rule_enabled: false,   // Cashback tidak ada WD multiplier
    game_restriction: 'semua',
    claim_frequency: 'mingguan',
    intent_category: 'Retention',
    target_segment: 'Semua',
    trigger_event: 'Loss',          // ✅ WAJIB Loss, bukan Turnover!
    valid_until_unlimited: true,
    geo_restriction: 'indonesia',
  },
  
  // Welcome Bonus
  'Welcome Bonus': {
    reward_mode: 'formula',
    calculation_base: 'deposit',
    calculation_method: 'percentage',
    turnover_rule_enabled: true,
    turnover_rule: '8x',
    game_restriction: 'slots',
    claim_frequency: 'sekali',
    target_segment: 'Baru',
    trigger_event: 'First Deposit',
    intent_category: 'Acquisition',
  },
  
  // Deposit Bonus
  'Deposit Bonus': {
    reward_mode: 'formula',
    calculation_base: 'deposit',
    calculation_method: 'percentage',
    turnover_rule_enabled: true,
    turnover_rule: '5x',
    game_restriction: 'semua',
    claim_frequency: 'harian',
    intent_category: 'Retention',
  },
  
  // Freechip
  'Freechip': {
    reward_mode: 'fixed',
    turnover_rule_enabled: true,
    turnover_rule: '1x',
    game_restriction: 'semua',
    claim_frequency: 'sekali',
    intent_category: 'Acquisition',
  },
  
  // Loyalty Point
  'Loyalty Point': {
    reward_mode: 'tier',
    calculation_base: 'turnover',
    calculation_method: 'percentage',
    turnover_rule_enabled: false,
    game_restriction: 'semua',
    claim_frequency: 'unlimited',
    intent_category: 'Retention',
    target_segment: 'Semua',
    trigger_event: 'Turnover',      // Trigger by playing activity
    valid_until_unlimited: true,    // Loyalty biasanya ongoing
    geo_restriction: 'indonesia',
  },
  
  // Event / Level Up
  'Event / Level Up': {
    reward_mode: 'tier',
    turnover_rule_enabled: false,
    game_restriction: 'semua',
    claim_frequency: 'sekali',
    intent_category: 'Retention',
  },
  
  // Mini Game
  'Mini Game (Spin, Lucky Draw)': {
    reward_mode: 'fixed',
    turnover_rule_enabled: true,
    turnover_rule: '1x',
    game_restriction: 'semua',
    claim_frequency: 'harian',
    intent_category: 'Retention',
  },
  
  // Merchandise
  'Merchandise': {
    reward_mode: 'tier',
    turnover_rule_enabled: false,
    game_restriction: 'semua',
    claim_frequency: 'sekali',
    intent_category: 'VIP',
  },
  
  // Referral Bonus
  // KONTRAK: reward_mode = 'tier' + tier_archetype = 'tier_network'
  // Root fields (reward_type, reward_amount, max_claim) = INERT
  // Truth = referral_tiers[] array
  'Referral Bonus': {
    reward_mode: 'tier',                    // ✅ TIER MODE, bukan formula!
    // tier_archetype di-set di PromoTypeDefaultConfig + enforced di extraction
    turnover_rule_enabled: false,           // Referral tidak pakai turnover
    game_restriction: 'semua',
    claim_frequency: 'unlimited',
    target_segment: 'Semua',
    trigger_event: 'Downline Activity',     // Trigger by downline activity
    intent_category: 'Retention',           // Retention-focused
    valid_until_unlimited: true,
    geo_restriction: 'indonesia',
  },
  
  // Campaign / Informational
  'Campaign / Informational': {
    reward_mode: 'fixed',
    turnover_rule_enabled: false,
    game_restriction: 'semua',
    claim_frequency: 'sekali',
    intent_category: 'Acquisition',
  },
};

// ============================================
// DEPOSIT PULSA SUBCATEGORY DEFAULTS
// ============================================

/**
 * Special defaults for Deposit Pulsa (subcategory of Deposit Bonus)
 * Applied when pulsa-related keywords are detected
 */
export const DEPOSIT_PULSA_DEFAULTS: PromoTypeDefaultConfig & {
  deposit_method: 'pulsa';
  deposit_method_providers: string[];
  deposit_rate: number;
} = {
  reward_mode: 'formula',
  calculation_base: 'deposit',
  calculation_method: 'percentage',
  turnover_rule_enabled: true,
  turnover_rule: '5x',
  game_restriction: 'semua',
  claim_frequency: 'harian',
  intent_category: 'Retention',
  deposit_method: 'pulsa',
  deposit_method_providers: ['TELKOMSEL', 'XL', 'AXIS', 'INDOSAT', 'TRI', 'SMARTFREN'],
  deposit_rate: 100, // Default tanpa potongan
};

// ============================================
// DEFAULT VALUES (for comparison)
// ============================================

const DEFAULT_VALUES: Partial<PromoFormData> = {
  reward_mode: 'fixed',
  calculation_base: '',
  calculation_method: '',
  turnover_rule_enabled: false,
  turnover_rule: '',
  game_restriction: 'semua',
  claim_frequency: '',
  target_segment: '',
  trigger_event: '',
  intent_category: '',
  deposit_method: undefined,
  deposit_method_providers: undefined,
  deposit_rate: undefined,
  // Validity fields
  valid_until_unlimited: false,
  geo_restriction: '',
};

/**
 * Check if a field value is empty or has default value
 */
function isEmptyOrDefault(value: unknown, defaultValue: unknown): boolean {
  // Null or undefined
  if (value === null || value === undefined) return true;
  
  // Empty string
  if (value === '') return true;
  
  // Empty array
  if (Array.isArray(value) && value.length === 0) return true;
  
  // Same as default
  if (value === defaultValue) return true;
  
  return false;
}

/**
 * Apply promo type defaults to form data
 * ONLY fills empty/default fields - never overwrites AI extraction or user edits
 * 
 * @param currentData Current form data
 * @param promoType Selected promo type
 * @returns Updated form data with defaults applied to empty fields only
 */
export function applyPromoTypeDefaults(
  currentData: PromoFormData,
  promoType: string
): Partial<PromoFormData> {
  const defaults = PROMO_TYPE_DEFAULTS[promoType];
  
  if (!defaults) {
    // No defaults for this promo type
    return {};
  }
  
  const updates: Partial<PromoFormData> = {};
  
  // Apply each default only if current value is empty/default
  if (defaults.reward_mode && isEmptyOrDefault(currentData.reward_mode, DEFAULT_VALUES.reward_mode)) {
    updates.reward_mode = defaults.reward_mode;
  }
  
  if (defaults.calculation_base && isEmptyOrDefault(currentData.calculation_base, DEFAULT_VALUES.calculation_base)) {
    updates.calculation_base = defaults.calculation_base;
  }
  
  if (defaults.calculation_method && isEmptyOrDefault(currentData.calculation_method, DEFAULT_VALUES.calculation_method)) {
    updates.calculation_method = defaults.calculation_method;
  }
  
  if (defaults.turnover_rule_enabled !== undefined && isEmptyOrDefault(currentData.turnover_rule_enabled, DEFAULT_VALUES.turnover_rule_enabled)) {
    updates.turnover_rule_enabled = defaults.turnover_rule_enabled;
  }
  
  if (defaults.turnover_rule && isEmptyOrDefault(currentData.turnover_rule, DEFAULT_VALUES.turnover_rule)) {
    updates.turnover_rule = defaults.turnover_rule;
  }
  
  if (defaults.game_restriction && isEmptyOrDefault(currentData.game_restriction, DEFAULT_VALUES.game_restriction)) {
    updates.game_restriction = defaults.game_restriction;
  }
  
  if (defaults.claim_frequency && isEmptyOrDefault(currentData.claim_frequency, DEFAULT_VALUES.claim_frequency)) {
    updates.claim_frequency = defaults.claim_frequency;
  }
  
  if (defaults.target_segment && isEmptyOrDefault(currentData.target_segment, DEFAULT_VALUES.target_segment)) {
    updates.target_segment = defaults.target_segment;
  }
  
  if (defaults.trigger_event && isEmptyOrDefault(currentData.trigger_event, DEFAULT_VALUES.trigger_event)) {
    updates.trigger_event = defaults.trigger_event;
  }
  
  if (defaults.intent_category && isEmptyOrDefault(currentData.intent_category, DEFAULT_VALUES.intent_category)) {
    updates.intent_category = defaults.intent_category;
  }
  
  // Payment method defaults (only if not already set)
  if (defaults.deposit_method && isEmptyOrDefault(currentData.deposit_method, DEFAULT_VALUES.deposit_method)) {
    updates.deposit_method = defaults.deposit_method;
  }
  
  // Validity period defaults
  if (defaults.valid_until_unlimited !== undefined && 
      isEmptyOrDefault(currentData.valid_until_unlimited, DEFAULT_VALUES.valid_until_unlimited)) {
    updates.valid_until_unlimited = defaults.valid_until_unlimited;
  }
  
  if (defaults.geo_restriction && 
      isEmptyOrDefault(currentData.geo_restriction, DEFAULT_VALUES.geo_restriction)) {
    updates.geo_restriction = defaults.geo_restriction;
  }
  
  return updates;
}

/**
 * Detect if content suggests Deposit Pulsa promo
 * Used by AI extractor to apply pulsa-specific defaults
 */
export function detectDepositPulsaKeywords(content: string): boolean {
  const lowerContent = content.toLowerCase();
  
  const pulsaKeywords = [
    'deposit pulsa',
    'pulsa tanpa potongan',
    'rate pulsa',
    'via pulsa',
    'depo pulsa',
  ];
  
  const telcoNames = [
    'telkomsel',
    'xl',
    'axis',
    'indosat',
    'tri',
    'smartfren',
  ];
  
  // Check for pulsa keywords
  for (const keyword of pulsaKeywords) {
    if (lowerContent.includes(keyword)) return true;
  }
  
  // Check for multiple telco names (indicates pulsa promo)
  let telcoCount = 0;
  for (const telco of telcoNames) {
    if (lowerContent.includes(telco)) telcoCount++;
  }
  
  return telcoCount >= 2;
}

/**
 * Extract pulsa rate from content
 * "tanpa potongan" = 100
 * "potongan 10%" = 90
 */
export function extractPulsaRate(content: string): number {
  const lowerContent = content.toLowerCase();
  
  // Tanpa potongan = 100%
  if (lowerContent.includes('tanpa potongan') || lowerContent.includes('tanpa potong')) {
    return 100;
  }
  
  // Look for potongan percentage
  const potonganMatch = lowerContent.match(/potongan\s*(\d+)%/);
  if (potonganMatch) {
    const potongan = parseInt(potonganMatch[1], 10);
    return 100 - potongan;
  }
  
  // Look for rate percentage
  const rateMatch = lowerContent.match(/rate\s*(\d+)%/);
  if (rateMatch) {
    return parseInt(rateMatch[1], 10);
  }
  
  // Default to 100 if no specific rate found
  return 100;
}

/**
 * Extract telco operators from content
 */
export function extractTelcoOperators(content: string): string[] {
  const upperContent = content.toUpperCase();
  
  const allTelcos = ['TELKOMSEL', 'XL', 'AXIS', 'INDOSAT', 'TRI', 'SMARTFREN'];
  const found: string[] = [];
  
  for (const telco of allTelcos) {
    if (upperContent.includes(telco)) {
      found.push(telco);
    }
  }
  
  return found;
}
