/**
 * PROMO FIELD NORMALIZER
 * 
 * Converts legacy dinamis_* fields to canonical base fields.
 * 
 * CLASSIFICATION (LOCKED):
 * - Base fields (reward_type, max_reward_claim, etc) = Canonical source of truth
 * - dinamis_* = ALIAS → normalized to base (ONLY these get normalized)
 * - fixed_* = NOT alias (override, stays separate)
 * - global_* = NOT alias (context provider, stays separate)
 * - subcategory.* = NOT alias (scoped value, stays separate)
 * 
 * This module does NOT delete fields - it copies values to canonical locations
 * while preserving all original fields for backward compatibility.
 */

import type { PromoFormData } from '@/components/VOCDashboard/PromoFormWizard/types';

// ============================================
// LEGACY ALIASES (ONLY dinamis_* prefix)
// ============================================

/**
 * Mapping from legacy dinamis_* fields to canonical base fields.
 * Only dinamis_* fields are aliases - fixed_* and global_* are NOT.
 * 
 * NOTE: dinamis_max_claim_unlimited has no direct base equivalent,
 * so it's excluded from normalization (stays as-is).
 */
export const LEGACY_ALIASES: Record<string, keyof PromoFormData> = {
  // Reward Type
  'dinamis_reward_type': 'reward_type',
  
  // Reward Amount
  'dinamis_reward_amount': 'reward_amount',
  
  // Max Claim (note: unlimited flag has no base equivalent)
  'dinamis_max_claim': 'max_claim',
} as const;

// ============================================
// INERT VALUE HELPERS
// ============================================

/**
 * Check if a value is "inert" (empty/null/undefined/false/[])
 * Inert values should not overwrite existing canonical values
 */
export function isInert(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (value === '') return true;
  if (value === false) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'number' && isNaN(value)) return true;
  return false;
}

/**
 * Check if a value is "meaningful" (has actual data)
 */
export function hasMeaningfulValue(value: unknown): boolean {
  return !isInert(value);
}

// ============================================
// NORMALIZER FUNCTION
// ============================================

/**
 * Normalize legacy dinamis_* fields to canonical base fields.
 * 
 * RULES:
 * 1. Only dinamis_* fields are normalized (copied to base)
 * 2. Copy only if base field is inert AND legacy field has value
 * 3. Original dinamis_* fields are NOT deleted (backward compat)
 * 4. fixed_* and global_* are NEVER touched
 * 
 * @param data - Raw promo data (from storage or extraction)
 * @returns Normalized promo data with canonical fields populated
 */
export function normalizeToStandard<T extends Partial<PromoFormData>>(data: T): T {
  if (!data) return data;
  
  // Create a shallow copy to avoid mutating original
  const normalized = { ...data } as Record<string, unknown>;
  
  // Process each legacy alias
  for (const [legacyField, canonicalField] of Object.entries(LEGACY_ALIASES)) {
    const legacyValue = normalized[legacyField];
    const canonicalValue = normalized[canonicalField as string];
    
    // Copy legacy → canonical ONLY if:
    // 1. Legacy has meaningful value
    // 2. Canonical is inert (empty/null)
    if (hasMeaningfulValue(legacyValue) && isInert(canonicalValue)) {
      normalized[canonicalField as string] = legacyValue;
      // Dev-only audit log for detecting legacy data usage
      console.debug(`[Normalizer] ${legacyField} → ${canonicalField}`, { legacyValue });
    }
  }
  
  return normalized as T;
}

/**
 * Normalize an array of promo items
 */
export function normalizePromoArray<T extends Partial<PromoFormData>>(items: T[]): T[] {
  return items.map(item => normalizeToStandard(item));
}

// ============================================
// FIELD DOCUMENTATION
// ============================================

/**
 * Documentation of field roles for reference.
 * This is informational - not used in runtime logic.
 */
export const FIELD_ROLES = {
  // BASE FIELDS (canonical source of truth)
  base: [
    'reward_type',
    'reward_amount', 
    'max_claim',
    'max_claim_unlimited',
    'min_calculation',
    'min_deposit',
    'turnover_rule',
    'calculation_base',
    'calculation_method',
    'calculation_value',
  ],
  
  // LEGACY ALIASES (deprecated, normalize to base)
  legacy: [
    'dinamis_reward_type',
    'dinamis_reward_amount',
    'dinamis_max_claim',
    'dinamis_max_claim_unlimited',
  ],
  
  // OVERRIDE FIELDS (mode-specific, NOT aliases)
  override: [
    'fixed_reward_type',
    'fixed_calculation_base',
    'fixed_calculation_method',
    'fixed_calculation_value',
    'fixed_max_claim',
    'fixed_max_claim_unlimited',
    'fixed_min_calculation',
    'fixed_turnover_rule',
    'fixed_min_depo',
  ],
  
  // CONTEXT PROVIDERS (inheritance, NOT aliases)
  context: [
    'global_jenis_hadiah',
    'global_jenis_hadiah_enabled',
    'global_max_bonus',
    'global_max_bonus_enabled',
    'global_payout_direction',
    'global_payout_direction_enabled',
  ],
} as const;

/**
 * List of deprecated fields (for linting/audit purposes)
 */
export const DEPRECATED_FIELDS = Object.keys(LEGACY_ALIASES);
