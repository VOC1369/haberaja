/**
 * Referral Tier Calculator v1.0
 * 
 * CALCULATOR CONTRACT (LOCKED):
 * This file is the ONLY place where DERIVED fields are calculated.
 * 
 * SEPARATION OF CONCERNS:
 * | Layer   | Responsibility           | Who              |
 * |---------|--------------------------|------------------|
 * | RULE    | Raw data from table      | Extractor        |
 * | FORMULA | Math rules (metadata)    | Extractor        |
 * | DERIVED | Calculated results       | Calculator ONLY  |
 * 
 * RULE OF AUTHORITY:
 * 1. Extractor ONLY saves RULE fields + FORMULA metadata
 * 2. Derived fields MUST be null during extraction
 * 3. This Calculator is the ONLY entity allowed to calculate derived
 * 4. LLM is NEVER trusted for business arithmetic
 * 
 * FORMULAS (LOCKED):
 * - net_winlose = winlose - cashback_deduction_amount - admin_fee_deduction_amount
 * - commission_result = net_winlose * commission_percentage / 100
 */

import type { ReferralCommissionTier } from '@/components/VOCDashboard/PromoFormWizard/types';

// ============================================
// FORMULA METADATA INTERFACE
// ============================================
export interface ReferralFormulaMetadata {
  type: 'referral_commission';
  calculation_basis: 'loss' | 'turnover';
  admin_fee_percentage: number; // Global admin fee percentage (e.g., 20)
  sequence: ('winlose' | 'cashback_deduction' | 'admin_fee' | 'commission')[];
}

// ============================================
// INPUT INTERFACE (FROM EXTRACTOR)
// ============================================
export interface ReferralTierInput {
  id: string;
  tier_label: string;
  
  // RULE fields (from extractor - source of truth)
  min_downline: number;
  commission_percentage: number;
  winlose?: number | null;
  cashback_deduction_amount?: number | null;
  admin_fee_deduction_amount?: number | null;
  
  // DERIVED fields (MUST be null from extractor)
  net_winlose?: number | null;
  commission_result?: number | null;
  
  // Audit metadata
  _rule_source?: 'table' | 'manual' | 'inferred';
  _commission_source?: string;
  _commission_fix_applied?: boolean;
}

// ============================================
// OUTPUT INTERFACE (AFTER CALCULATION)
// ============================================
export interface ReferralTierOutput extends Omit<ReferralTierInput, 'net_winlose' | 'commission_result'> {
  // DERIVED fields (calculated by this calculator)
  net_winlose: number;
  commission_result: number;
  
  // Calculator audit trail
  _calculated_by: 'calculator';
  _calculated_at: string;
}

// ============================================
// VALIDATION RESULT
// ============================================
export interface TierValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================
// VALIDATE TIER BEFORE CALCULATION
// ============================================
export function validateTierBeforeCalc(tier: ReferralTierInput, tierIndex: number): TierValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // RULE fields must exist
  if (tier.commission_percentage == null || tier.commission_percentage < 0) {
    errors.push(`Tier ${tierIndex + 1}: commission_percentage is required and must be >= 0`);
  }
  
  if (tier.min_downline == null || tier.min_downline < 0) {
    warnings.push(`Tier ${tierIndex + 1}: min_downline should be >= 0`);
  }
  
  // DERIVED fields MUST be null before calculation (sanity check)
  if (tier.net_winlose != null) {
    warnings.push(`Tier ${tierIndex + 1}: net_winlose was not null before calculation (was ${tier.net_winlose}). This may indicate extraction calculated it.`);
  }
  
  if (tier.commission_result != null) {
    warnings.push(`Tier ${tierIndex + 1}: commission_result was not null before calculation (was ${tier.commission_result}). This may indicate extraction calculated it.`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================
// CALCULATE A SINGLE TIER (DETERMINISTIC)
// ============================================
export function calculateReferralTier(
  tier: ReferralTierInput,
  _formula?: ReferralFormulaMetadata
): ReferralTierOutput {
  // Get RULE values with safe defaults
  const winlose = tier.winlose ?? 0;
  const cashbackDeduction = tier.cashback_deduction_amount ?? 0;
  const adminFeeDeduction = tier.admin_fee_deduction_amount ?? 0;
  const commissionPercentage = tier.commission_percentage ?? 0;
  
  // ============================================
  // DETERMINISTIC FORMULAS (LOCKED)
  // ============================================
  const net_winlose = winlose - cashbackDeduction - adminFeeDeduction;
  const commission_result = Math.round(net_winlose * commissionPercentage / 100);
  
  return {
    // Pass through all RULE fields
    id: tier.id,
    tier_label: tier.tier_label,
    min_downline: tier.min_downline,
    commission_percentage: tier.commission_percentage,
    winlose: tier.winlose,
    cashback_deduction_amount: tier.cashback_deduction_amount,
    admin_fee_deduction_amount: tier.admin_fee_deduction_amount,
    
    // CALCULATED DERIVED fields
    net_winlose,
    commission_result,
    
    // Preserve audit metadata
    _rule_source: tier._rule_source,
    _commission_source: tier._commission_source,
    _commission_fix_applied: tier._commission_fix_applied,
    
    // Calculator audit trail
    _calculated_by: 'calculator',
    _calculated_at: new Date().toISOString(),
  };
}

// ============================================
// CALCULATE ALL TIERS (BATCH)
// ============================================
export function calculateAllReferralTiers(
  tiers: ReferralCommissionTier[],
  formula?: ReferralFormulaMetadata
): ReferralCommissionTier[] {
  if (!tiers || tiers.length === 0) {
    return [];
  }
  
  // Validate all tiers first
  const allWarnings: string[] = [];
  tiers.forEach((tier, idx) => {
    // Map old field names to new field names if needed
    const mappedTier: ReferralTierInput = {
      ...tier,
      cashback_deduction_amount: (tier as any).cashback_deduction_amount ?? tier.cashback_deduction,
      admin_fee_deduction_amount: (tier as any).admin_fee_deduction_amount ?? tier.fee_deduction,
    };
    
    const validation = validateTierBeforeCalc(mappedTier, idx);
    allWarnings.push(...validation.warnings);
    
    if (!validation.valid) {
      console.error(`[ReferralCalculator] Validation failed for tier ${idx + 1}:`, validation.errors);
    }
  });
  
  if (allWarnings.length > 0) {
    console.log(`[ReferralCalculator] Validation warnings:`, allWarnings);
  }
  
  // Calculate all tiers
  return tiers.map((tier) => {
    // Map old field names to new field names for backward compatibility
    const inputTier: ReferralTierInput = {
      ...tier,
      cashback_deduction_amount: (tier as any).cashback_deduction_amount ?? tier.cashback_deduction,
      admin_fee_deduction_amount: (tier as any).admin_fee_deduction_amount ?? tier.fee_deduction,
    };
    
    const calculated = calculateReferralTier(inputTier, formula);
    
    // Map back to ReferralCommissionTier format (with both old and new field names)
    return {
      ...tier,
      // New field names
      cashback_deduction_amount: calculated.cashback_deduction_amount,
      admin_fee_deduction_amount: calculated.admin_fee_deduction_amount,
      // Keep old field names for backward compatibility
      cashback_deduction: calculated.cashback_deduction_amount,
      fee_deduction: calculated.admin_fee_deduction_amount,
      // DERIVED fields (calculated)
      net_winlose: calculated.net_winlose,
      commission_result: calculated.commission_result,
      // Audit trail
      _calculated_by: 'calculator' as const,
    } as ReferralCommissionTier;
  });
}

// ============================================
// HELPER: Check if tiers need calculation
// ============================================
export function tiersNeedCalculation(tiers: ReferralCommissionTier[]): boolean {
  if (!tiers || tiers.length === 0) return false;
  
  // If any tier has null derived fields, it needs calculation
  return tiers.some(tier => 
    tier.net_winlose == null || 
    tier.commission_result == null ||
    (tier as any)._calculated_by !== 'calculator'
  );
}

// ============================================
// EXPORT DEFAULT FORMULA METADATA
// ============================================
export function getDefaultReferralFormulaMetadata(
  calculationBasis: 'loss' | 'turnover' = 'loss',
  adminFeePercentage: number = 0
): ReferralFormulaMetadata {
  return {
    type: 'referral_commission',
    calculation_basis: calculationBasis,
    admin_fee_percentage: adminFeePercentage,
    sequence: ['winlose', 'cashback_deduction', 'admin_fee', 'commission'],
  };
}
