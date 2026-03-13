/**
 * TIER RESOLVERS v1.0 — Phase 2
 *
 * Deterministic routing logic for archetype-specific tier resolution.
 * Covers: parlay, referral, exchange_catalog
 *
 * CONTRACT:
 * - Pure functions, no side effects
 * - Boundary-safe: null-aware for open-ended upper bounds
 * - Used by Danila runtime to answer player queries
 */

import type { UniversalTier } from './canonical-promo-schema';

// ============================================
// TYPES
// ============================================

export interface ExchangeCatalogItem {
  item_name: string;
  lp_required: number;
  reward_type: string;
  reward_amount: number | null;
  max_redeem_per_period?: number | null;
}

export interface ParlayTierResult {
  tier: UniversalTier | null;
  matched: boolean;
  reason: string;
}

export interface ReferralTierResult {
  tier: UniversalTier | null;
  matched: boolean;
  reason: string;
}

export interface CatalogQueryResult {
  affordable: ExchangeCatalogItem[];
  exact_match: ExchangeCatalogItem | null;
}

// ============================================
// PARLAY TIER RESOLVER
// ============================================

/**
 * Resolves which parlay tier applies for a given jumlah_tim (team count).
 * Tier dimension: 'team_count'
 *
 * Boundary rules:
 * - min_dimension_value: null → no lower bound (matches any count ≤ max)
 * - max_dimension_value: null → open upper bound (highest tier)
 * - Both null → wildcard tier (matches all)
 *
 * @example
 * resolveParalayTier(tiers, 8) → tier for "6-10 tim"
 */
export function resolveParalayTier(
  tiers: UniversalTier[],
  jumlah_tim: number
): ParlayTierResult {
  if (!tiers || tiers.length === 0) {
    return { tier: null, matched: false, reason: 'No tiers configured' };
  }

  const parlayTiers = tiers.filter(t => t.tier_dimension === 'team_count');
  if (parlayTiers.length === 0) {
    return { tier: null, matched: false, reason: 'No team_count tiers found' };
  }

  // Sort by min_dimension_value ascending so first match wins for overlapping configs
  const sorted = [...parlayTiers].sort((a, b) => {
    const aMin = a.min_dimension_value ?? 0;
    const bMin = b.min_dimension_value ?? 0;
    return aMin - bMin;
  });

  const matched = sorted.find(tier => {
    const minOk =
      tier.min_dimension_value === null || jumlah_tim >= tier.min_dimension_value;
    const maxOk =
      tier.max_dimension_value === null || jumlah_tim <= tier.max_dimension_value;
    return minOk && maxOk;
  }) ?? null;

  if (!matched) {
    return {
      tier: null,
      matched: false,
      reason: `No tier matches jumlah_tim=${jumlah_tim}`,
    };
  }

  return {
    tier: matched,
    matched: true,
    reason: `Matched tier "${matched.tier_name}" for ${jumlah_tim} tim`,
  };
}

/**
 * Calculate parlay payout using standard formula:
 * payout * (jumlah_tim / 100)
 * where payout is the base reward_value from the matched tier.
 */
export function calcParlayPayout(tier: UniversalTier, jumlah_tim: number): number | null {
  if (tier.reward_value === null) return null;
  return tier.reward_value * (jumlah_tim / 100);
}

// ============================================
// REFERRAL TIER RESOLVER
// ============================================

/**
 * Resolves which referral commission tier applies for a given active downline count.
 * Tier dimension: 'downline_count'
 *
 * @example
 * resolveReferralTier(tiers, 10) → tier for "10-14 downline"
 */
export function resolveReferralTier(
  tiers: UniversalTier[],
  active_downline: number
): ReferralTierResult {
  if (!tiers || tiers.length === 0) {
    return { tier: null, matched: false, reason: 'No tiers configured' };
  }

  const referralTiers = tiers.filter(t => t.tier_dimension === 'downline_count');
  if (referralTiers.length === 0) {
    return { tier: null, matched: false, reason: 'No downline_count tiers found' };
  }

  const sorted = [...referralTiers].sort((a, b) => {
    const aMin = a.min_dimension_value ?? 0;
    const bMin = b.min_dimension_value ?? 0;
    return aMin - bMin;
  });

  const matched = sorted.find(tier => {
    const minOk =
      tier.min_dimension_value === null || active_downline >= tier.min_dimension_value;
    const maxOk =
      tier.max_dimension_value === null || active_downline <= tier.max_dimension_value;
    return minOk && maxOk;
  }) ?? null;

  if (!matched) {
    return {
      tier: null,
      matched: false,
      reason: `No tier matches active_downline=${active_downline}`,
    };
  }

  return {
    tier: matched,
    matched: true,
    reason: `Matched tier "${matched.tier_name}" for ${active_downline} downline`,
  };
}

// ============================================
// EXCHANGE CATALOG RESOLVER
// ============================================

/**
 * Returns all catalog items affordable with given LP balance.
 * Sorted by lp_required ascending (cheapest first).
 */
export function getAffordableCatalogItems(
  catalog: ExchangeCatalogItem[],
  player_lp: number
): ExchangeCatalogItem[] {
  if (!catalog || catalog.length === 0) return [];
  return catalog
    .filter(item => item.lp_required <= player_lp)
    .sort((a, b) => a.lp_required - b.lp_required);
}

/**
 * Finds a specific catalog item by partial name match (case-insensitive).
 */
export function getCatalogItemByName(
  catalog: ExchangeCatalogItem[],
  item_name: string
): ExchangeCatalogItem | null {
  if (!catalog || !item_name) return null;
  const query = item_name.toLowerCase().trim();
  return (
    catalog.find(item => item.item_name.toLowerCase().includes(query)) ?? null
  );
}

/**
 * Full catalog query: returns affordable items AND exact match for a given name.
 * Convenience wrapper for Danila to answer "LP saya X, bisa tukar [item]?"
 */
export function queryCatalog(
  catalog: ExchangeCatalogItem[],
  player_lp: number,
  item_name?: string
): CatalogQueryResult {
  return {
    affordable: getAffordableCatalogItems(catalog, player_lp),
    exact_match: item_name ? getCatalogItemByName(catalog, item_name) : null,
  };
}

// ============================================
// LP EARN CALCULATOR
// ============================================

/**
 * Calculates LP earned from a given turnover amount.
 * earn_formula example: "1000 TO = 1 LP" → earn_per_unit=1, basis_unit=1000
 *
 * @param turnover - Player's total turnover
 * @param earn_per_unit - LP earned per basis_unit
 * @param basis_unit - Turnover amount per earn unit (e.g., 1000)
 */
export function calcLpEarned(
  turnover: number,
  earn_per_unit: number,
  basis_unit: number
): number {
  if (basis_unit <= 0) return 0;
  return Math.floor(turnover / basis_unit) * earn_per_unit;
}
