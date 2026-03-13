/**
 * Referral Tier Validator v2.0
 * 
 * VALIDATOR CONTRACT (PURE VALIDATOR - NO CALCULATION):
 * This file is ONLY for validation. All calculations are done by referral-tier-calculator.ts
 * 
 * SEPARATION OF CONCERNS:
 * | Layer   | Responsibility           | Who              |
 * |---------|--------------------------|------------------|
 * | RULE    | Raw data from table      | Extractor        |
 * | FORMULA | Math rules (metadata)    | Extractor        |
 * | DERIVED | Calculated results       | Calculator ONLY  |
 * 
 * This validator:
 * 1. Validates that RULE fields exist and are valid
 * 2. Validates that DERIVED fields are null BEFORE calculation (sanity check)
 * 3. Delegates all calculation to referral-tier-calculator.ts
 */

import type { ReferralCommissionTier } from '@/components/VOCDashboard/PromoFormWizard/types';
import { calculateAllReferralTiers } from './referral-tier-calculator';

// ============================================
// VALIDATION INTERFACES
// ============================================
export interface ReferralTierValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  tier_index: number;
}

export interface ReferralTiersValidationResult {
  all_valid: boolean;
  tier_results: ReferralTierValidation[];
  total_errors: string[];
  total_warnings: string[];
}

// ============================================
// VALIDATE RULE FIELDS EXIST (BEFORE CALCULATION)
// ============================================
export function validateReferralTierRules(tier: ReferralCommissionTier, tierIndex: number): ReferralTierValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // === REQUIRED RULE FIELDS ===
  if (tier.commission_percentage == null) {
    errors.push(`Tier ${tierIndex + 1}: commission_percentage is required`);
  } else if (tier.commission_percentage < 0 || tier.commission_percentage > 100) {
    errors.push(`Tier ${tierIndex + 1}: commission_percentage must be between 0 and 100`);
  }
  
  if (tier.min_downline == null) {
    warnings.push(`Tier ${tierIndex + 1}: min_downline is not set`);
  } else if (tier.min_downline < 0) {
    errors.push(`Tier ${tierIndex + 1}: min_downline must be >= 0`);
  }
  
  // === OPTIONAL RULE FIELDS (warn if missing for calculation) ===
  if (tier.winlose == null) {
    warnings.push(`Tier ${tierIndex + 1}: winlose is not set (will default to 0 for calculation)`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    tier_index: tierIndex,
  };
}

// ============================================
// VALIDATE DERIVED FIELDS ARE NULL (PRE-CALCULATION CHECK)
// ============================================
export function validateDerivedFieldsAreNull(tier: ReferralCommissionTier, tierIndex: number): ReferralTierValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // DERIVED fields MUST be null before calculation
  // If they're not null, it means extractor calculated them (violation of contract)
  if (tier.net_winlose != null) {
    warnings.push(
      `Tier ${tierIndex + 1}: net_winlose was ${tier.net_winlose} (should be null before calculation). ` +
      `This indicates extraction may have violated the Calculator Contract.`
    );
  }
  
  if (tier.commission_result != null) {
    warnings.push(
      `Tier ${tierIndex + 1}: commission_result was ${tier.commission_result} (should be null before calculation). ` +
      `This indicates extraction may have violated the Calculator Contract.`
    );
  }
  
  return {
    valid: true, // Not blocking - just warnings
    errors,
    warnings,
    tier_index: tierIndex,
  };
}

// ============================================
// VALIDATE ALL REFERRAL TIERS (BEFORE CALCULATION)
// ============================================
export function validateReferralTiersBeforeCalc(tiers: ReferralCommissionTier[]): ReferralTiersValidationResult {
  if (!tiers || tiers.length === 0) {
    return {
      all_valid: true,
      tier_results: [],
      total_errors: [],
      total_warnings: [],
    };
  }
  
  const tier_results: ReferralTierValidation[] = [];
  
  tiers.forEach((tier, idx) => {
    // Validate RULE fields
    const ruleValidation = validateReferralTierRules(tier, idx);
    
    // Validate DERIVED fields are null
    const derivedValidation = validateDerivedFieldsAreNull(tier, idx);
    
    // Combine results
    tier_results.push({
      valid: ruleValidation.valid && derivedValidation.valid,
      errors: [...ruleValidation.errors, ...derivedValidation.errors],
      warnings: [...ruleValidation.warnings, ...derivedValidation.warnings],
      tier_index: idx,
    });
  });
  
  const all_valid = tier_results.every(r => r.valid);
  const total_errors = tier_results.flatMap(r => r.errors);
  const total_warnings = tier_results.flatMap(r => r.warnings);
  
  // Log warnings if any
  if (total_warnings.length > 0) {
    console.log('[ReferralValidator] Pre-calculation warnings:', total_warnings);
  }
  
  return {
    all_valid,
    tier_results,
    total_errors,
    total_warnings,
  };
}

// ============================================
// DETECT ALL-SAME COMMISSION BUG
// ============================================
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
    console.warn(
      `[ReferralValidator] All-same commission bug detected: all ${tiers.length} tiers have ${percentages[0]}%`
    );
    return {
      detected: true,
      common_value: percentages[0],
      tier_count: tiers.length,
    };
  }
  
  return { detected: false, common_value: null, tier_count: tiers.length };
}

// ============================================
// LEGACY COMPATIBILITY: autoCorrectReferralTiers
// This now delegates to the calculator
// ============================================
export function autoCorrectReferralTiers(tiers: ReferralCommissionTier[]): {
  corrected_tiers: ReferralCommissionTier[];
  validation_result: ReferralTiersValidationResult;
} {
  // Import calculator dynamically to avoid circular dependency
  const { calculateAllReferralTiers } = require('./referral-tier-calculator');
  
  const validation_result = validateReferralTiersBeforeCalc(tiers);
  const corrected_tiers = calculateAllReferralTiers(tiers);
  
  console.log('[ReferralValidator] Delegated calculation to referral-tier-calculator.ts');
  
  return {
    corrected_tiers,
    validation_result,
  };
}
