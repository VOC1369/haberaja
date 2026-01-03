/**
 * Referral Tier Validator v1.0
 * 
 * DERIVED FIELD CONTRACT:
 * - winlose, cashback_deduction, fee_deduction, commission_percentage = RULE (source of truth)
 * - net_winlose, commission_result = DERIVED RULE (calculated from above)
 * 
 * Validator MUST:
 * 1. Recalculate derived fields from RULE fields
 * 2. Compare with stored values
 * 3. Return warnings for mismatches
 * 4. Auto-correct derived values
 * 
 * FORMULAS (LOCKED):
 * - net_winlose = winlose - cashback_deduction - fee_deduction
 * - commission_result = net_winlose * commission_percentage / 100
 */

import type { ReferralCommissionTier } from '@/components/VOCDashboard/PromoFormWizard/types';

export interface ReferralTierValidation {
  valid: boolean;
  warnings: string[];
  corrected: ReferralCommissionTier;
  corrections_applied: string[];
}

export interface ReferralTiersValidationResult {
  all_valid: boolean;
  tier_results: ReferralTierValidation[];
  total_warnings: string[];
  total_corrections: number;
}

/**
 * Validate a single referral tier and auto-correct derived fields
 */
export function validateReferralTier(tier: ReferralCommissionTier, tierIndex: number): ReferralTierValidation {
  const warnings: string[] = [];
  const corrections_applied: string[] = [];
  
  // Clone to avoid mutation
  const corrected: ReferralCommissionTier = { ...tier };
  
  // Get RULE values (source of truth)
  const winlose = tier.winlose ?? 0;
  const cashbackDeduction = tier.cashback_deduction ?? 0;
  const feeDeduction = tier.fee_deduction ?? 0;
  const commissionPercentage = tier.commission_percentage ?? 0;
  
  // Calculate expected DERIVED values
  const expectedNetWinlose = winlose - cashbackDeduction - feeDeduction;
  const expectedCommissionResult = Math.round(expectedNetWinlose * commissionPercentage / 100);
  
  // Check net_winlose consistency
  if (tier.net_winlose !== undefined && tier.net_winlose !== null) {
    if (tier.net_winlose !== expectedNetWinlose) {
      warnings.push(
        `Tier ${tierIndex + 1} (${tier.tier_label}): net_winlose mismatch - ` +
        `expected ${expectedNetWinlose.toLocaleString('id-ID')}, got ${tier.net_winlose.toLocaleString('id-ID')}`
      );
      corrections_applied.push(`net_winlose: ${tier.net_winlose} → ${expectedNetWinlose}`);
    }
  }
  
  // Check commission_result consistency
  if (tier.commission_result !== undefined && tier.commission_result !== null) {
    // Allow small tolerance for rounding (within 1)
    const diff = Math.abs(tier.commission_result - expectedCommissionResult);
    if (diff > 1) {
      warnings.push(
        `Tier ${tierIndex + 1} (${tier.tier_label}): commission_result mismatch - ` +
        `expected ${expectedCommissionResult.toLocaleString('id-ID')}, got ${tier.commission_result.toLocaleString('id-ID')}`
      );
      corrections_applied.push(`commission_result: ${tier.commission_result} → ${expectedCommissionResult}`);
    }
  }
  
  // Always set correct derived values
  corrected.net_winlose = expectedNetWinlose;
  corrected.commission_result = expectedCommissionResult;
  
  return {
    valid: warnings.length === 0,
    warnings,
    corrected,
    corrections_applied,
  };
}

/**
 * Validate all referral tiers in an array
 */
export function validateReferralTiers(tiers: ReferralCommissionTier[]): ReferralTiersValidationResult {
  if (!tiers || tiers.length === 0) {
    return {
      all_valid: true,
      tier_results: [],
      total_warnings: [],
      total_corrections: 0,
    };
  }
  
  const tier_results = tiers.map((tier, idx) => validateReferralTier(tier, idx));
  const all_valid = tier_results.every(r => r.valid);
  const total_warnings = tier_results.flatMap(r => r.warnings);
  const total_corrections = tier_results.reduce((sum, r) => sum + r.corrections_applied.length, 0);
  
  return {
    all_valid,
    tier_results,
    total_warnings,
    total_corrections,
  };
}

/**
 * Auto-correct all referral tiers and return corrected array
 */
export function autoCorrectReferralTiers(tiers: ReferralCommissionTier[]): {
  corrected_tiers: ReferralCommissionTier[];
  validation_result: ReferralTiersValidationResult;
} {
  const validation_result = validateReferralTiers(tiers);
  const corrected_tiers = validation_result.tier_results.map(r => r.corrected);
  
  if (validation_result.total_corrections > 0) {
    console.log(
      `[ReferralTierValidator] Auto-corrected ${validation_result.total_corrections} derived field(s):`,
      validation_result.total_warnings
    );
  }
  
  return {
    corrected_tiers,
    validation_result,
  };
}

/**
 * Check if all commission percentages are identical (potential extraction bug)
 * Returns true if this looks like the "all 5%" bug
 */
export function detectAllSameCommissionBug(tiers: ReferralCommissionTier[]): {
  detected: boolean;
  common_value: number | null;
  tier_count: number;
} {
  if (!tiers || tiers.length < 2) {
    return { detected: false, common_value: null, tier_count: tiers?.length || 0 };
  }
  
  const percentages = tiers.map(t => t.commission_percentage);
  const allSame = percentages.every(p => p === percentages[0]);
  
  if (allSame) {
    return {
      detected: true,
      common_value: percentages[0],
      tier_count: tiers.length,
    };
  }
  
  return { detected: false, common_value: null, tier_count: tiers.length };
}
