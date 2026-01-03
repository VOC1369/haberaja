/**
 * PROMO FIELD RESOLVER
 * 
 * Context-aware value resolution for promo fields.
 * Resolvers determine the "effective" value based on mode, context, and hierarchy.
 * 
 * ============================================
 * RESOLVER TRUTH HIERARCHY (FINAL - LOCKED)
 * ============================================
 * 
 * Priority order (highest to lowest):
 * 
 * 1. FIXED (explicit override)
 *    - Only applies when reward_mode === 'fixed'
 *    - Uses fixed_* prefix fields
 *    - Highest priority = user explicitly set this override
 * 
 * 2. SUBCATEGORY (scoped intent)
 *    - Only applies when editing within a subcategory context
 *    - Checks *_same_as_global flags to determine if using own value
 *    - Scoped to specific subcategory
 * 
 * 3. GLOBAL (context inheritance)
 *    - Uses global_* prefix fields
 *    - Applied when subcategory uses same_as_global = true
 *    - Provides consistent defaults across subcategories
 * 
 * 4. BASE (canonical source)
 *    - Direct field access (e.g., reward_type, max_claim)
 *    - The "ground truth" from extraction or manual entry
 * 
 * 5. LEGACY (dinamis_* fallback)
 *    - Deprecated fields preserved for backward compatibility
 *    - Will be normalized to base on read via promo-field-normalizer
 *    - Should badge as ORANGE in UI
 * 
 * ============================================
 * 
 * IMPORTANT:
 * - Resolvers are READ-ONLY - they do not modify data
 * - Used by UI to display effective values
 * - Used by export/AI to get final computed values
 * - NEVER use effective values for write-back without explicit user intent
 */

/**
 * Hierarchy order constant for documentation and validation
 */
export const RESOLVER_HIERARCHY_ORDER = [
  'fixed',
  'subcategory', 
  'global',
  'base',
  'legacy',
] as const;

import type { PromoFormData, PromoSubCategory } from '@/components/VOCDashboard/PromoFormWizard/types';
import { isInert } from './promo-field-normalizer';

// ============================================
// TIER_NETWORK (REFERRAL) TYPE GUARD
// ============================================
/**
 * Check if promo is a tier_network (Referral) promo
 * 
 * SEMANTIC CONTRACT:
 * - tier_network = Referral Bonus (multi-tier commission)
 * - Tier metric: min_downline (NOT nominal)
 * - Tier reward: commission_percentage (NOT reward_amount)
 * - Calculation: PROGRAM-LEVEL via referral_calculation_basis
 * - Admin fee: PROGRAM-LEVEL via referral_admin_fee_percentage
 * - Generic fields (calculation_*, admin_fee_*): MUST BE INERT
 */
export function isTierNetworkPromo(data: Partial<PromoFormData>): boolean {
  return data.reward_mode === 'tier' && data.tier_archetype === 'tier_network';
}

// ============================================
// REWARD TYPE RESOLVER
// ============================================

/**
 * Get effective reward type based on mode and context
 * 
 * Resolution order:
 * 1. Fixed mode: fixed_reward_type
 * 2. Subcategory (if provided): subcategory.reward_type
 * 3. Base field: reward_type (or dinamis_reward_type as fallback)
 */
export function getEffectiveRewardType(
  data: Partial<PromoFormData>,
  subcategory?: PromoSubCategory
): string {
  // ============================================
  // TIER MODE GUARD: Root fields are INERT
  // Truth is in tier arrays (referral_tiers, tiers, etc.)
  // ============================================
  if (data.reward_mode === 'tier') {
    // For tier_network (Referral), reward_type info is inside referral_tiers[]
    // Return empty string to indicate "read from tier array"
    return '';
  }
  
  // Fixed mode uses fixed_ prefix
  if (data.reward_mode === 'fixed') {
    if (!isInert(data.fixed_reward_type)) {
      return data.fixed_reward_type!;
    }
  }
  
  // Subcategory-specific (if provided and not following global)
  if (subcategory) {
    if (!subcategory.jenis_hadiah_same_as_global && !isInert(subcategory.reward_type)) {
      return subcategory.reward_type!;
    }
    // Check legacy jenis_hadiah
    if (!subcategory.jenis_hadiah_same_as_global && !isInert(subcategory.jenis_hadiah)) {
      return subcategory.jenis_hadiah;
    }
  }
  
  // Global toggle (for subcategories using global)
  if (data.global_jenis_hadiah_enabled && !isInert(data.global_jenis_hadiah)) {
    return data.global_jenis_hadiah!;
  }
  
  // Base field (canonical)
  if (!isInert(data.reward_type)) {
    return data.reward_type!;
  }
  
  // Legacy fallback
  if (!isInert(data.dinamis_reward_type)) {
    return data.dinamis_reward_type!;
  }
  
  return '';
}

// ============================================
// MAX CLAIM RESOLVER
// ============================================

/**
 * Get effective max claim value based on mode and context
 * 
 * Resolution order:
 * 1. Check unlimited flag first
 * 2. Fixed mode: fixed_max_claim
 * 3. Subcategory (if provided): subcategory.max_bonus
 * 4. Global toggle: global_max_bonus
 * 5. Base field: max_claim (or dinamis_max_claim as fallback)
 * 
 * Returns null if unlimited
 */
export function getEffectiveMaxClaim(
  data: Partial<PromoFormData>,
  subcategory?: PromoSubCategory
): number | null {
  // ============================================
  // TIER MODE GUARD: Root fields are INERT
  // Max claim concept doesn't apply to tier mode (especially referral)
  // ============================================
  if (data.reward_mode === 'tier') {
    return null; // No concept of max_claim for tier mode
  }
  
  // Fixed mode
  if (data.reward_mode === 'fixed') {
    if (data.fixed_max_claim_unlimited) return null;
    if (!isInert(data.fixed_max_claim)) {
      return data.fixed_max_claim!;
    }
  }
  
  // Subcategory-specific (if provided and not following global)
  if (subcategory) {
    if (subcategory.max_bonus_unlimited) return null;
    if (!subcategory.max_bonus_same_as_global && !isInert(subcategory.max_bonus)) {
      return subcategory.max_bonus;
    }
  }
  
  // Global toggle (for subcategories using global)
  if (data.global_max_bonus_enabled && !isInert(data.global_max_bonus)) {
    return data.global_max_bonus!;
  }
  
  // Base field - check unlimited first (dinamis mode only has dinamis_max_claim_unlimited)
  if (data.dinamis_max_claim_unlimited) {
    return null;
  }
  
  // Base field (canonical)
  if (!isInert(data.max_claim)) {
    return data.max_claim!;
  }
  
  // Legacy fallback
  if (!isInert(data.dinamis_max_claim)) {
    return data.dinamis_max_claim!;
  }
  
  return null;
}

/**
 * Source type for unlimited flag (for badging)
 */
export type UnlimitedSource = 'fixed' | 'subcategory' | 'base' | 'legacy';

/**
 * Result of unlimited check with source info
 */
export interface MaxClaimUnlimitedResult {
  isUnlimited: boolean;
  source: UnlimitedSource;
}

/**
 * Check if max claim is unlimited WITH SOURCE INFO
 * 
 * This is critical for badging legacy dinamis_max_claim_unlimited
 * which has no base equivalent and must be explicitly shown as ORANGE badge
 */
export function getMaxClaimUnlimitedWithSource(
  data: Partial<PromoFormData>,
  subcategory?: PromoSubCategory
): MaxClaimUnlimitedResult {
  // Fixed mode check first
  if (data.reward_mode === 'fixed') {
    if (data.fixed_max_claim_unlimited) {
      return { isUnlimited: true, source: 'fixed' };
    }
    // Fixed mode but not unlimited
    return { isUnlimited: false, source: 'fixed' };
  }
  
  // Subcategory check
  if (subcategory) {
    if (!subcategory.max_bonus_same_as_global) {
      return { 
        isUnlimited: !!subcategory.max_bonus_unlimited, 
        source: 'subcategory' 
      };
    }
  }
  
  // Base field check (max_claim_unlimited doesn't exist, so check legacy)
  // CRITICAL: dinamis_max_claim_unlimited has no base equivalent
  // This is the RED FLAG field that must be badged as LEGACY/ORANGE
  if (data.dinamis_max_claim_unlimited) {
    return { isUnlimited: true, source: 'legacy' };
  }
  
  // Default: not unlimited, source is base
  return { isUnlimited: false, source: 'base' };
}

/**
 * Check if max claim is unlimited (simple boolean version)
 * @deprecated Use getMaxClaimUnlimitedWithSource for proper badging
 */
export function isMaxClaimUnlimited(
  data: Partial<PromoFormData>,
  subcategory?: PromoSubCategory
): boolean {
  return getMaxClaimUnlimitedWithSource(data, subcategory).isUnlimited;
}

// ============================================
// CALCULATION BASE RESOLVER
// ============================================

/**
 * Get effective calculation base based on mode
 * 
 * Resolution order:
 * 1. tier_network guard: return empty (use referral_calculation_basis instead)
 * 2. Fixed mode: fixed_calculation_base
 * 3. Subcategory (if provided): subcategory.calculation_base
 * 4. Base field: calculation_base
 */
export function getEffectiveCalculationBase(
  data: Partial<PromoFormData>,
  subcategory?: PromoSubCategory
): string {
  // ============================================
  // TIER_NETWORK GUARD: Use referral_calculation_basis instead
  // Generic calculation_base is INERT for tier_network
  // ============================================
  if (isTierNetworkPromo(data)) {
    return ''; // INERT - truth is in referral_calculation_basis
  }
  
  if (data.reward_mode === 'fixed') {
    if (!isInert(data.fixed_calculation_base)) {
      return data.fixed_calculation_base!;
    }
  }
  
  if (subcategory && !isInert(subcategory.calculation_base)) {
    return subcategory.calculation_base;
  }
  
  return data.calculation_base || '';
}

// ============================================
// CALCULATION VALUE RESOLVER
// ============================================

/**
 * Get effective calculation value (percentage/amount) based on mode
 * 
 * tier_network: return null (use referral_tiers[].commission_percentage instead)
 */
export function getEffectiveCalculationValue(
  data: Partial<PromoFormData>,
  subcategory?: PromoSubCategory
): number | null {
  // ============================================
  // TIER_NETWORK GUARD: Use referral_tiers instead
  // Generic calculation_value is INERT for tier_network
  // ============================================
  if (isTierNetworkPromo(data)) {
    return null; // INERT - truth is in referral_tiers[].commission_percentage
  }
  
  if (data.reward_mode === 'fixed') {
    if (!isInert(data.fixed_calculation_value)) {
      return data.fixed_calculation_value!;
    }
  }
  
  if (subcategory && !isInert(subcategory.calculation_value)) {
    return subcategory.calculation_value;
  }
  
  return data.calculation_value ?? null;
}

// ============================================
// TURNOVER RULE RESOLVER
// ============================================

/**
 * Get effective turnover rule based on mode and context
 * 
 * tier_network: return empty (turnover rule not applicable for referral)
 */
export function getEffectiveTurnoverRule(
  data: Partial<PromoFormData>,
  subcategory?: PromoSubCategory
): string {
  // ============================================
  // TIER_NETWORK GUARD: Turnover not applicable for referral
  // ============================================
  if (isTierNetworkPromo(data)) {
    return ''; // INERT - referral doesn't use turnover rule
  }
  
  // Fixed mode
  if (data.reward_mode === 'fixed') {
    if (data.fixed_turnover_rule_enabled && !isInert(data.fixed_turnover_rule)) {
      return data.fixed_turnover_rule!;
    }
    return '';
  }
  
  // Subcategory-specific
  if (subcategory) {
    if (subcategory.turnover_rule_enabled && !isInert(subcategory.turnover_rule)) {
      return subcategory.turnover_rule;
    }
    return '';
  }
  
  // Base field
  if (data.turnover_rule_enabled && !isInert(data.turnover_rule)) {
    return data.turnover_rule!;
  }
  
  return '';
}

// ============================================
// PAYOUT DIRECTION RESOLVER
// ============================================

/**
 * Get effective payout direction based on mode and context
 */
export function getEffectivePayoutDirection(
  data: Partial<PromoFormData>,
  subcategory?: PromoSubCategory
): 'before' | 'after' {
  // Fixed mode
  if (data.reward_mode === 'fixed') {
    return data.fixed_payout_direction || 'before';
  }
  
  // Subcategory-specific
  if (subcategory) {
    if (!subcategory.payout_direction_same_as_global) {
      return subcategory.payout_direction || 'before';
    }
  }
  
  // Global toggle
  if (data.global_payout_direction_enabled) {
    return data.global_payout_direction || 'before';
  }
  
  return 'before';
}

// ============================================
// MIN DEPOSIT RESOLVER
// ============================================

/**
 * Get effective minimum deposit based on mode
 */
export function getEffectiveMinDeposit(
  data: Partial<PromoFormData>
): number | null {
  if (data.reward_mode === 'fixed') {
    if (data.fixed_min_depo_enabled && !isInert(data.fixed_min_depo)) {
      return data.fixed_min_depo!;
    }
  }
  
  if (!isInert(data.min_deposit)) {
    return data.min_deposit!;
  }
  
  return null;
}

// ============================================
// REWARD AMOUNT RESOLVER
// ============================================

/**
 * Get effective reward amount based on mode
 * 
 * tier_network: return null (use referral_tiers[].commission_percentage instead)
 */
export function getEffectiveRewardAmount(
  data: Partial<PromoFormData>,
  subcategory?: PromoSubCategory
): number | null {
  // ============================================
  // TIER_NETWORK GUARD: Use referral_tiers instead
  // Generic reward_amount is INERT for tier_network
  // ============================================
  if (isTierNetworkPromo(data)) {
    return null; // INERT - truth is in referral_tiers[].commission_percentage
  }
  
  if (data.reward_mode === 'fixed') {
    if (!isInert(data.reward_amount)) {
      return data.reward_amount!;
    }
  }
  
  if (subcategory && !isInert(subcategory.dinamis_reward_amount)) {
    return subcategory.dinamis_reward_amount;
  }
  
  if (!isInert(data.reward_amount)) {
    return data.reward_amount!;
  }
  
  if (!isInert(data.dinamis_reward_amount)) {
    return data.dinamis_reward_amount!;
  }
  
  return null;
}

// ============================================
// ADMIN FEE RESOLVER
// ============================================

/**
 * Get effective admin fee percentage
 * 
 * tier_network: return null (use referral_admin_fee_percentage instead)
 */
export function getEffectiveAdminFee(
  data: Partial<PromoFormData>
): number | null {
  // ============================================
  // TIER_NETWORK GUARD: Use referral_admin_fee_percentage instead
  // Generic admin_fee_percentage is INERT for tier_network
  // ============================================
  if (isTierNetworkPromo(data)) {
    return null; // INERT - truth is in referral_admin_fee_percentage
  }
  
  if (data.admin_fee_enabled && !isInert(data.admin_fee_percentage)) {
    return data.admin_fee_percentage!;
  }
  
  return null;
}
