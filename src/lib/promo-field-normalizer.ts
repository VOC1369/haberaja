/**
 * PROMO FIELD NORMALIZER
 * 
 * Converts legacy dinamis_* fields to canonical base fields.
 * Also handles turnover semantic migration (threshold vs multiplier separation).
 * Also handles v2.1 Canonical Contract field migrations.
 * 
 * CLASSIFICATION (LOCKED):
 * - Base fields (reward_type, max_reward_claim, etc) = Canonical source of truth
 * - dinamis_* = ALIAS → normalized to base (ONLY these get normalized)
 * - fixed_* = NOT alias (override, stays separate)
 * - global_* = NOT alias (context provider, stays separate)
 * - subcategory.* = NOT alias (scoped value, stays separate)
 * 
 * TURNOVER SEMANTIC CONTRACT:
 * - Threshold (qualify) = min_calculation / fixed_min_calculation
 * - Multiplier WD = turnover_rule / fixed_turnover_rule
 * - Large numeric values (> 100) in turnover_rule fields are MIGRATED to min_calculation
 * 
 * CANONICAL CONTRACT v2.1:
 * - turnover_rule (string "3x") → turnover_multiplier (number 3)
 * - turnover_rule_enabled → turnover_enabled
 * - max_claim → max_bonus (semantic shift)
 * - reward_distribution → distribution_mode
 * - game_restriction → game_scope (alias)
 * - special_requirements → special_conditions (alias)
 * 
 * This module does NOT delete fields - it copies values to canonical locations
 * while preserving all original fields for backward compatibility.
 */

import type { PromoFormData } from '@/components/VOCDashboard/PromoFormWizard/types';
import { migrateLegacyTurnoverData } from './promo-turnover-guard';

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

/**
 * Canonical Contract v2.1 rename mappings
 * Maps old field names to new canonical field names
 */
export const CANONICAL_RENAMES: Record<string, string> = {
  // Turnover semantic (string → number)
  'turnover_rule_enabled': 'turnover_enabled',
  
  // Distribution
  'reward_distribution': 'distribution_mode',
  
  // Game Scope
  'game_restriction': 'game_scope',
  
  // Special Conditions
  'special_requirements': 'special_conditions',
  
  // Classification
  'classification_confidence': 'extraction_confidence_legacy',
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
// TURNOVER MULTIPLIER PARSER
// ============================================

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

// ============================================
// NORMALIZER FUNCTION
// ============================================

/**
 * Normalize legacy dinamis_* fields to canonical base fields.
 * Also applies turnover semantic migration (threshold vs multiplier separation).
 * Also applies Canonical Contract v2.1 field migrations.
 * 
 * RULES:
 * 1. Only dinamis_* fields are normalized (copied to base)
 * 2. Copy only if base field is inert AND legacy field has value
 * 3. Original dinamis_* fields are NOT deleted (backward compat)
 * 4. fixed_* and global_* are NEVER touched (except turnover migration)
 * 5. Turnover migration: large values in turnover_rule → min_calculation
 * 6. Canonical v2.1: turnover_rule (string) → turnover_multiplier (number)
 * 
 * @param data - Raw promo data (from storage or extraction)
 * @returns Normalized promo data with canonical fields populated
 */
export function normalizeToStandard<T extends Partial<PromoFormData>>(data: T): T {
  if (!data) return data;
  
  // Create a shallow copy to avoid mutating original
  let normalized = { ...data } as Record<string, unknown>;
  
  // Step 1: Migrate legacy turnover data (threshold → multiplier separation)
  const { data: turnoverMigrated, migrated } = migrateLegacyTurnoverData(normalized as Partial<PromoFormData>);
  if (migrated) {
    console.log('[Normalizer] Applied turnover semantic migration');
    normalized = { ...turnoverMigrated } as Record<string, unknown>;
  }
  
  // Step 2: Process each legacy alias (dinamis_* → base)
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
  
  // Step 3: Apply Canonical v2.1 migrations
  normalized = applyCanonicalMigrations(normalized);
  
  return normalized as T;
}

/**
 * Apply Canonical Contract v2.1 field migrations
 */
function applyCanonicalMigrations(data: Record<string, unknown>): Record<string, unknown> {
  const migrated = { ...data };
  
  // V.APR.09: Set schema_version if not present
  if (!migrated.schema_version) {
    migrated.schema_version = 'V.APR.09';
  }
  
  // 3.2: Migrate turnover_rule (string) → turnover_multiplier (number)
  if (typeof migrated.turnover_rule === 'string' && migrated.turnover_rule) {
    const multiplier = parseTurnoverMultiplier(migrated.turnover_rule);
    if (multiplier !== null && isInert(migrated.turnover_multiplier)) {
      migrated.turnover_multiplier = multiplier;
      console.debug('[Normalizer] turnover_rule → turnover_multiplier', { from: migrated.turnover_rule, to: multiplier });
    }
  }
  
  // ============================================
  // 3.2B: TURNOVER CONSISTENCY BRIDGE (v1.1)
  // Ensures UI dropdown always has a value when toggle is ON
  // This bridges the gap between canonical (number) and UI (string) representations
  // ============================================
  const turnoverEnabled = migrated.turnover_enabled || migrated.turnover_rule_enabled;
  const turnoverRule = migrated.turnover_rule as string | undefined;
  const turnoverMultiplier = migrated.turnover_multiplier as number | undefined;
  
  if (turnoverEnabled) {
    // Case A: Toggle ON but rule empty, multiplier has value → populate rule
    if (isInert(turnoverRule) && turnoverMultiplier && turnoverMultiplier > 0) {
      migrated.turnover_rule = `${turnoverMultiplier}x`;
      console.debug('[Normalizer] Turnover Bridge: multiplier → rule', { 
        turnoverMultiplier, 
        newRule: migrated.turnover_rule 
      });
    }
    
    // Case B: Rule has raw number (e.g., "1") → normalize to "1x"
    if (typeof turnoverRule === 'string' && /^\d+$/.test(turnoverRule)) {
      migrated.turnover_rule = `${turnoverRule}x`;
      console.debug('[Normalizer] Turnover Bridge: normalized rule format', { 
        from: turnoverRule, 
        to: migrated.turnover_rule 
      });
    }
    
    // Case C: Rule has value but multiplier missing → parse and set multiplier
    if (typeof migrated.turnover_rule === 'string' && migrated.turnover_rule && isInert(migrated.turnover_multiplier)) {
      const parsed = parseTurnoverMultiplier(migrated.turnover_rule);
      if (parsed !== null) {
        migrated.turnover_multiplier = parsed;
      }
    }
  }
  
  // 3.3: Migrate turnover_rule_enabled → turnover_enabled
  if (migrated.turnover_rule_enabled !== undefined && migrated.turnover_enabled === undefined) {
    migrated.turnover_enabled = Boolean(migrated.turnover_rule_enabled);
  }
  
  // 3.4: Migrate max_claim → max_bonus (semantic shift for canonical output)
  if (hasMeaningfulValue(migrated.max_claim) && isInert(migrated.max_bonus)) {
    migrated.max_bonus = migrated.max_claim;
  }
  if (migrated.max_claim_unlimited && migrated.max_bonus_unlimited === undefined) {
    migrated.max_bonus_unlimited = migrated.max_claim_unlimited;
  }
  
  // 3.5: Migrate reward_distribution → distribution_mode
  if (hasMeaningfulValue(migrated.reward_distribution) && isInert(migrated.distribution_mode)) {
    migrated.distribution_mode = migrated.reward_distribution;
  }
  
  // 3.5b: Chance-based override — force setelah_syarat regardless
  // Lucky Spin, Gacha, dll → player claims after requirements, never "hari_tertentu"
  const promoName = String(migrated.promo_name || '').toLowerCase();
  const promoType = String(migrated.promo_type || '').toLowerCase();
  const chanceKeywords = ['lucky spin', 'lucky draw', 'gacha', 'spin', 'undian', 'wheel'];
  const isChanceBased = chanceKeywords.some(k => promoName.includes(k) || promoType.includes(k));
  if (isChanceBased && migrated.distribution_mode === 'hari_tertentu') {
    migrated.distribution_mode = 'setelah_syarat';
    console.debug('[Normalizer] Chance-based override: hari_tertentu → setelah_syarat', { promoName, promoType });
  }
  
  // 3.6: Derive category from program_classification
  if (migrated.program_classification && isInert(migrated.category)) {
    const classification = String(migrated.program_classification).toUpperCase();
    if (classification === 'A' || classification === 'B') {
      migrated.category = 'REWARD';
    } else if (classification === 'C') {
      migrated.category = 'EVENT';
    }
  }
  
  // 3.7: Consolidate game exclusions if blacklist arrays exist
  if (isInert(migrated.game_exclusions)) {
    const exclusions: string[] = [];
    const typesBlacklist = migrated.game_types_blacklist as string[] | undefined;
    const providersBlacklist = migrated.game_providers_blacklist as string[] | undefined;
    const namesBlacklist = migrated.game_names_blacklist as string[] | undefined;
    
    if (typesBlacklist?.length) {
      exclusions.push(...typesBlacklist.map(t => `type:${t}`));
    }
    if (providersBlacklist?.length) {
      exclusions.push(...providersBlacklist.map(p => `provider:${p}`));
    }
    if (namesBlacklist?.length) {
      exclusions.push(...namesBlacklist.map(n => `game:${n}`));
    }
    
    if (exclusions.length > 0) {
      migrated.game_exclusions = exclusions;
    }
  }
  
  // 3.8: Initialize extra_config if not present
  if (migrated.extra_config === undefined) {
    migrated.extra_config = {};
  }
  
  // 3.9: Initialize human_verified if not present
  if (migrated.human_verified === undefined) {
    migrated.human_verified = false;
  }
  
  return migrated;
}

// ============================================
// UI FIELD PREFIX STRIPPING
// ============================================

/**
 * Strip UI-specific prefixes for canonical export.
 * This function removes fixed_, dinamis_, global_, formula_ prefixes
 * to produce clean canonical field names.
 */
export function stripUIFieldPrefixes(data: Record<string, unknown>): Record<string, unknown> {
  const prefixes = ['fixed_', 'dinamis_', 'global_', 'formula_'];
  const output: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    let canonicalKey = key;
    
    for (const prefix of prefixes) {
      if (key.startsWith(prefix)) {
        canonicalKey = key.slice(prefix.length);
        break;
      }
    }
    
    // If the stripped key already exists, don't overwrite with prefixed version
    if (output[canonicalKey] === undefined || key === canonicalKey) {
      output[canonicalKey] = value;
    }
  }
  
  return output;
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
  
  // CANONICAL v2.1 FIELDS (new standard)
  canonical: [
    'schema_version',
    'category',
    'turnover_enabled',
    'turnover_multiplier',
    'max_bonus',
    'max_bonus_unlimited',
    'distribution_mode',
    'game_exclusions',
    'extra_config',
    'human_verified',
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
