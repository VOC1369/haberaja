/**
 * usePromoResolver Hook
 * 
 * READ-ONLY hook for displaying effective values based on context.
 * 
 * GUARDRAILS (LOCKED):
 * 1. READ-ONLY - Never modifies form state, only returns computed display values
 * 2. BASE VALUE VISIBLE - Returns both effective AND base values for comparison
 * 3. NO BYPASS OF NORMALIZER - Works with already-normalized data
 * 4. NO IMPLICIT WRITE-BACK - Never triggers onChange or updates state
 * 5. INHERITANCE CLARITY - Provides source info for badges/tooltips
 * 
 * USAGE:
 * - Call this hook with promo data to get effective values for display
 * - Use `isInherited` flags to show inheritance badges
 * - Form inputs should still bind to original fields (not effective values)
 */

import { useMemo } from 'react';
import type { PromoFormData, PromoSubCategory } from '@/components/VOCDashboard/PromoFormWizard/types';
import {
  getEffectiveRewardType,
  getEffectiveMaxClaim,
  isMaxClaimUnlimited,
  getEffectiveCalculationBase,
  getEffectiveCalculationValue,
  getEffectiveTurnoverRule,
  getEffectivePayoutDirection,
  getEffectiveMinDeposit,
  getEffectiveRewardAmount,
} from '@/lib/promo-field-resolver';
import { isInert } from '@/lib/promo-field-normalizer';

/**
 * Source of the resolved value
 */
export type ValueSource = 
  | 'base'           // From canonical base field
  | 'fixed'          // From fixed_* override
  | 'global'         // From global_* context
  | 'subcategory'    // From subcategory-specific value
  | 'legacy'         // From deprecated dinamis_* field
  | 'default';       // Fallback default value

/**
 * Resolved value with metadata for UI display
 */
export interface ResolvedValue<T> {
  /** The effective value to display */
  effective: T;
  /** The raw base value (for comparison) */
  base: T | null | undefined;
  /** Source of the effective value */
  source: ValueSource;
  /** True if effective ≠ base (show inheritance badge) */
  isInherited: boolean;
  /** Human-readable source label for tooltip */
  sourceLabel: string;
}

/**
 * Full resolved state for a promo
 */
export interface PromoResolvedState {
  rewardType: ResolvedValue<string>;
  maxClaim: ResolvedValue<number | null>;
  isMaxClaimUnlimited: boolean;
  calculationBase: ResolvedValue<string>;
  calculationValue: ResolvedValue<number | null>;
  turnoverRule: ResolvedValue<string>;
  payoutDirection: ResolvedValue<'before' | 'after'>;
  minDeposit: ResolvedValue<number | null>;
  rewardAmount: ResolvedValue<number | null>;
}

/**
 * Get human-readable source label
 */
function getSourceLabel(source: ValueSource, mode: string): string {
  switch (source) {
    case 'fixed':
      return 'Override (Fixed Mode)';
    case 'global':
      return 'Inherited from Global';
    case 'subcategory':
      return 'Set by Subcategory';
    case 'legacy':
      return 'Legacy (dinamis_*)';
    case 'default':
      return 'Default Value';
    case 'base':
    default:
      return mode === 'formula' ? 'Base (Dinamis)' : 'Base Value';
  }
}

/**
 * Determine the source of the reward type value
 */
function determineRewardTypeSource(
  data: Partial<PromoFormData>,
  subcategory?: PromoSubCategory
): ValueSource {
  if (data.reward_mode === 'fixed' && !isInert(data.fixed_reward_type)) {
    return 'fixed';
  }
  if (subcategory) {
    if (!subcategory.jenis_hadiah_same_as_global) {
      if (!isInert(subcategory.reward_type)) return 'subcategory';
      if (!isInert(subcategory.jenis_hadiah)) return 'subcategory';
    }
  }
  if (data.global_jenis_hadiah_enabled && !isInert(data.global_jenis_hadiah)) {
    return 'global';
  }
  if (!isInert(data.reward_type)) return 'base';
  if (!isInert(data.dinamis_reward_type)) return 'legacy';
  return 'default';
}

/**
 * Determine the source of the max claim value
 */
function determineMaxClaimSource(
  data: Partial<PromoFormData>,
  subcategory?: PromoSubCategory
): ValueSource {
  if (data.reward_mode === 'fixed') {
    if (data.fixed_max_claim_unlimited) return 'fixed';
    if (!isInert(data.fixed_max_claim)) return 'fixed';
  }
  if (subcategory) {
    if (subcategory.max_bonus_unlimited) return 'subcategory';
    if (!subcategory.max_bonus_same_as_global && !isInert(subcategory.max_bonus)) {
      return 'subcategory';
    }
  }
  if (data.global_max_bonus_enabled && !isInert(data.global_max_bonus)) {
    return 'global';
  }
  if (data.dinamis_max_claim_unlimited) return 'legacy';
  if (!isInert(data.max_claim)) return 'base';
  if (!isInert(data.dinamis_max_claim)) return 'legacy';
  return 'default';
}

/**
 * Read-only hook for resolving effective promo values
 * 
 * @param data - Promo form data (already normalized)
 * @param subcategory - Optional subcategory context
 * @returns Resolved values with inheritance metadata
 */
export function usePromoResolver(
  data: Partial<PromoFormData>,
  subcategory?: PromoSubCategory
): PromoResolvedState {
  return useMemo(() => {
    const mode = data.reward_mode || 'fixed';
    
    // Reward Type
    const effectiveRewardType = getEffectiveRewardType(data, subcategory);
    const baseRewardType = data.reward_type || '';
    const rewardTypeSource = determineRewardTypeSource(data, subcategory);
    
    // Max Claim
    const effectiveMaxClaim = getEffectiveMaxClaim(data, subcategory);
    const baseMaxClaim = data.max_claim ?? null;
    const maxClaimSource = determineMaxClaimSource(data, subcategory);
    const unlimitedFlag = isMaxClaimUnlimited(data, subcategory);
    
    // Calculation Base
    const effectiveCalcBase = getEffectiveCalculationBase(data, subcategory);
    const baseCalcBase = data.calculation_base || '';
    const calcBaseSource: ValueSource = 
      data.reward_mode === 'fixed' && !isInert(data.fixed_calculation_base) ? 'fixed' :
      subcategory && !isInert(subcategory.calculation_base) ? 'subcategory' :
      !isInert(data.calculation_base) ? 'base' : 'default';
    
    // Calculation Value
    const effectiveCalcValue = getEffectiveCalculationValue(data, subcategory);
    const baseCalcValue = data.calculation_value ?? null;
    const calcValueSource: ValueSource =
      data.reward_mode === 'fixed' && !isInert(data.fixed_calculation_value) ? 'fixed' :
      subcategory && !isInert(subcategory.calculation_value) ? 'subcategory' :
      !isInert(data.calculation_value) ? 'base' : 'default';
    
    // Turnover Rule
    const effectiveTurnover = getEffectiveTurnoverRule(data, subcategory);
    const baseTurnover = data.turnover_rule || '';
    const turnoverSource: ValueSource =
      data.reward_mode === 'fixed' && data.fixed_turnover_rule_enabled ? 'fixed' :
      subcategory && subcategory.turnover_rule_enabled ? 'subcategory' :
      data.turnover_rule_enabled ? 'base' : 'default';
    
    // Payout Direction
    const effectivePayout = getEffectivePayoutDirection(data, subcategory);
    const basePayout = 'before' as const;
    const payoutSource: ValueSource =
      data.reward_mode === 'fixed' ? 'fixed' :
      subcategory && !subcategory.payout_direction_same_as_global ? 'subcategory' :
      data.global_payout_direction_enabled ? 'global' : 'default';
    
    // Min Deposit
    const effectiveMinDepo = getEffectiveMinDeposit(data);
    const baseMinDepo = data.min_deposit ?? null;
    const minDepoSource: ValueSource =
      data.reward_mode === 'fixed' && data.fixed_min_depo_enabled ? 'fixed' :
      !isInert(data.min_deposit) ? 'base' : 'default';
    
    // Reward Amount
    const effectiveRewardAmt = getEffectiveRewardAmount(data, subcategory);
    const baseRewardAmt = data.reward_amount ?? null;
    const rewardAmtSource: ValueSource =
      subcategory && !isInert(subcategory.dinamis_reward_amount) ? 'subcategory' :
      !isInert(data.reward_amount) ? 'base' :
      !isInert(data.dinamis_reward_amount) ? 'legacy' : 'default';
    
    return {
      rewardType: {
        effective: effectiveRewardType,
        base: baseRewardType,
        source: rewardTypeSource,
        isInherited: rewardTypeSource !== 'base' && rewardTypeSource !== 'default',
        sourceLabel: getSourceLabel(rewardTypeSource, mode),
      },
      maxClaim: {
        effective: effectiveMaxClaim,
        base: baseMaxClaim,
        source: maxClaimSource,
        isInherited: maxClaimSource !== 'base' && maxClaimSource !== 'default',
        sourceLabel: getSourceLabel(maxClaimSource, mode),
      },
      isMaxClaimUnlimited: unlimitedFlag,
      calculationBase: {
        effective: effectiveCalcBase,
        base: baseCalcBase,
        source: calcBaseSource,
        isInherited: calcBaseSource !== 'base' && calcBaseSource !== 'default',
        sourceLabel: getSourceLabel(calcBaseSource, mode),
      },
      calculationValue: {
        effective: effectiveCalcValue,
        base: baseCalcValue,
        source: calcValueSource,
        isInherited: calcValueSource !== 'base' && calcValueSource !== 'default',
        sourceLabel: getSourceLabel(calcValueSource, mode),
      },
      turnoverRule: {
        effective: effectiveTurnover,
        base: baseTurnover,
        source: turnoverSource,
        isInherited: turnoverSource !== 'base' && turnoverSource !== 'default',
        sourceLabel: getSourceLabel(turnoverSource, mode),
      },
      payoutDirection: {
        effective: effectivePayout,
        base: basePayout,
        source: payoutSource,
        // Payout direction is inherited if set by fixed/global/subcategory (not default)
        isInherited: payoutSource !== 'default',
        sourceLabel: getSourceLabel(payoutSource, mode),
      },
      minDeposit: {
        effective: effectiveMinDepo,
        base: baseMinDepo,
        source: minDepoSource,
        isInherited: minDepoSource !== 'base' && minDepoSource !== 'default',
        sourceLabel: getSourceLabel(minDepoSource, mode),
      },
      rewardAmount: {
        effective: effectiveRewardAmt,
        base: baseRewardAmt,
        source: rewardAmtSource,
        isInherited: rewardAmtSource !== 'base' && rewardAmtSource !== 'default',
        sourceLabel: getSourceLabel(rewardAmtSource, mode),
      },
    };
  }, [data, subcategory]);
}
