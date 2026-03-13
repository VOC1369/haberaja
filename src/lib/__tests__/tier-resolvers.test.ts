/**
 * TIER RESOLVERS TEST SUITE — Phase 2
 *
 * Tests: resolveParalayTier, resolveReferralTier, getAffordableCatalogItems,
 *        getCatalogItemByName, queryCatalog
 *
 * All boundary cases are explicitly tested.
 * CI GATE: ALL tests must pass.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveParalayTier,
  calcParlayPayout,
  resolveReferralTier,
  getAffordableCatalogItems,
  getCatalogItemByName,
  queryCatalog,
  calcLpEarned,
  type ExchangeCatalogItem,
} from '../tier-resolvers';
import type { UniversalTier } from '../canonical-promo-schema';

// ============================================
// FIXTURES
// ============================================

/**
 * Parlay tiers:
 * Tier 1: 2-5 tim  → reward_value = 10000
 * Tier 2: 6-10 tim → reward_value = 25000
 * Tier 3: 11+  tim → reward_value = 50000 (no upper bound)
 */
const PARLAY_TIERS: UniversalTier[] = [
  {
    tier_id: 'p1',
    tier_name: '2-5 Tim',
    tier_order: 1,
    requirement_value: 2,
    reward_value: 10000,
    reward_type: 'credit_game',
    tier_dimension: 'team_count',
    min_dimension_value: 2,
    max_dimension_value: 5,
    special_conditions: [],
    extra: {},
  },
  {
    tier_id: 'p2',
    tier_name: '6-10 Tim',
    tier_order: 2,
    requirement_value: 6,
    reward_value: 25000,
    reward_type: 'credit_game',
    tier_dimension: 'team_count',
    min_dimension_value: 6,
    max_dimension_value: 10,
    special_conditions: [],
    extra: {},
  },
  {
    tier_id: 'p3',
    tier_name: '11+ Tim',
    tier_order: 3,
    requirement_value: 11,
    reward_value: 50000,
    reward_type: 'credit_game',
    tier_dimension: 'team_count',
    min_dimension_value: 11,
    max_dimension_value: null, // open upper bound
    special_conditions: [],
    extra: {},
  },
];

/**
 * Referral tiers:
 * Tier 1: 1-4   downline → 1% commission
 * Tier 2: 5-9   downline → 1.5% commission
 * Tier 3: 10-14 downline → 2% commission
 * Tier 4: 15+   downline → 2.5% commission (no upper bound)
 */
const REFERRAL_TIERS: UniversalTier[] = [
  {
    tier_id: 'r1',
    tier_name: 'Tier 1',
    tier_order: 1,
    requirement_value: 1,
    reward_value: 1,
    reward_type: 'percentage',
    tier_dimension: 'downline_count',
    min_dimension_value: 1,
    max_dimension_value: 4,
    special_conditions: [],
    extra: { commission_percentage: 1 },
  },
  {
    tier_id: 'r2',
    tier_name: 'Tier 2',
    tier_order: 2,
    requirement_value: 5,
    reward_value: 1.5,
    reward_type: 'percentage',
    tier_dimension: 'downline_count',
    min_dimension_value: 5,
    max_dimension_value: 9,
    special_conditions: [],
    extra: { commission_percentage: 1.5 },
  },
  {
    tier_id: 'r3',
    tier_name: 'Tier 3',
    tier_order: 3,
    requirement_value: 10,
    reward_value: 2,
    reward_type: 'percentage',
    tier_dimension: 'downline_count',
    min_dimension_value: 10,
    max_dimension_value: 14,
    special_conditions: [],
    extra: { commission_percentage: 2 },
  },
  {
    tier_id: 'r4',
    tier_name: 'Tier 4',
    tier_order: 4,
    requirement_value: 15,
    reward_value: 2.5,
    reward_type: 'percentage',
    tier_dimension: 'downline_count',
    min_dimension_value: 15,
    max_dimension_value: null, // open upper bound
    special_conditions: [],
    extra: { commission_percentage: 2.5 },
  },
];

const CATALOG: ExchangeCatalogItem[] = [
  { item_name: 'Credit Game 10.000', lp_required: 500, reward_type: 'credit_game', reward_amount: 10000, max_redeem_per_period: 5 },
  { item_name: 'Credit Game 25.000', lp_required: 1000, reward_type: 'credit_game', reward_amount: 25000, max_redeem_per_period: 3 },
  { item_name: 'Pulsa 50.000',       lp_required: 2500, reward_type: 'pulsa',       reward_amount: 50000, max_redeem_per_period: 2 },
  { item_name: 'iPhone 16 Pro',      lp_required: 50000, reward_type: 'hadiah_fisik', reward_amount: null, max_redeem_per_period: 1 },
];

// ============================================
// PARLAY TIER RESOLVER TESTS
// ============================================

describe('resolveParalayTier', () => {
  describe('Lower tier boundary', () => {
    it('2 tim → Tier 1 (exact lower bound)', () => {
      const result = resolveParalayTier(PARLAY_TIERS, 2);
      expect(result.matched).toBe(true);
      expect(result.tier?.tier_id).toBe('p1');
    });

    it('5 tim → Tier 1 (exact upper bound)', () => {
      const result = resolveParalayTier(PARLAY_TIERS, 5);
      expect(result.matched).toBe(true);
      expect(result.tier?.tier_id).toBe('p1');
    });
  });

  describe('Middle tier boundary', () => {
    it('6 tim → Tier 2 (exact lower bound)', () => {
      const result = resolveParalayTier(PARLAY_TIERS, 6);
      expect(result.matched).toBe(true);
      expect(result.tier?.tier_id).toBe('p2');
    });

    it('8 tim → Tier 2 (mid range)', () => {
      const result = resolveParalayTier(PARLAY_TIERS, 8);
      expect(result.matched).toBe(true);
      expect(result.tier?.tier_id).toBe('p2');
    });

    it('10 tim → Tier 2 (exact upper bound)', () => {
      const result = resolveParalayTier(PARLAY_TIERS, 10);
      expect(result.matched).toBe(true);
      expect(result.tier?.tier_id).toBe('p2');
    });
  });

  describe('Open-ended upper tier', () => {
    it('11 tim → Tier 3 (exact lower bound of open tier)', () => {
      const result = resolveParalayTier(PARLAY_TIERS, 11);
      expect(result.matched).toBe(true);
      expect(result.tier?.tier_id).toBe('p3');
    });

    it('20 tim → Tier 3 (far above last explicit bound)', () => {
      const result = resolveParalayTier(PARLAY_TIERS, 20);
      expect(result.matched).toBe(true);
      expect(result.tier?.tier_id).toBe('p3');
    });
  });

  describe('Edge cases', () => {
    it('1 tim → no match (below all tiers)', () => {
      const result = resolveParalayTier(PARLAY_TIERS, 1);
      expect(result.matched).toBe(false);
      expect(result.tier).toBeNull();
    });

    it('empty tiers → no match', () => {
      const result = resolveParalayTier([], 8);
      expect(result.matched).toBe(false);
    });

    it('tiers without team_count dimension → no match', () => {
      const wrongTiers: UniversalTier[] = [
        { ...PARLAY_TIERS[0], tier_dimension: 'level' },
      ];
      const result = resolveParalayTier(wrongTiers, 8);
      expect(result.matched).toBe(false);
    });
  });
});

describe('calcParlayPayout', () => {
  it('should calculate payout correctly: 25000 * (8/100) = 2000', () => {
    const tier = PARLAY_TIERS[1]; // reward_value = 25000
    expect(calcParlayPayout(tier, 8)).toBeCloseTo(2000);
  });

  it('should return null if reward_value is null', () => {
    const nullTier: UniversalTier = { ...PARLAY_TIERS[0], reward_value: null };
    expect(calcParlayPayout(nullTier, 8)).toBeNull();
  });
});

// ============================================
// REFERRAL TIER RESOLVER TESTS
// ============================================

describe('resolveReferralTier', () => {
  describe('Tier 1 boundary (1-4)', () => {
    it('4 downline → Tier 1 (upper boundary)', () => {
      const result = resolveReferralTier(REFERRAL_TIERS, 4);
      expect(result.matched).toBe(true);
      expect(result.tier?.tier_id).toBe('r1');
    });
  });

  describe('Tier 2 boundary (5-9)', () => {
    it('5 downline → Tier 2 (exact lower bound)', () => {
      const result = resolveReferralTier(REFERRAL_TIERS, 5);
      expect(result.matched).toBe(true);
      expect(result.tier?.tier_id).toBe('r2');
    });

    it('9 downline → Tier 2 (upper boundary)', () => {
      const result = resolveReferralTier(REFERRAL_TIERS, 9);
      expect(result.matched).toBe(true);
      expect(result.tier?.tier_id).toBe('r2');
    });
  });

  describe('Tier 3 boundary (10-14)', () => {
    it('10 downline → Tier 3 (exact lower bound)', () => {
      const result = resolveReferralTier(REFERRAL_TIERS, 10);
      expect(result.matched).toBe(true);
      expect(result.tier?.tier_id).toBe('r3');
    });

    it('14 downline → Tier 3 (upper boundary)', () => {
      const result = resolveReferralTier(REFERRAL_TIERS, 14);
      expect(result.matched).toBe(true);
      expect(result.tier?.tier_id).toBe('r3');
    });
  });

  describe('Tier 4 open-ended (15+)', () => {
    it('15 downline → Tier 4 (exact lower bound)', () => {
      const result = resolveReferralTier(REFERRAL_TIERS, 15);
      expect(result.matched).toBe(true);
      expect(result.tier?.tier_id).toBe('r4');
    });

    it('16 downline → Tier 4 (above minimum)', () => {
      const result = resolveReferralTier(REFERRAL_TIERS, 16);
      expect(result.matched).toBe(true);
      expect(result.tier?.tier_id).toBe('r4');
    });

    it('100 downline → Tier 4 (far beyond explicit bound)', () => {
      const result = resolveReferralTier(REFERRAL_TIERS, 100);
      expect(result.matched).toBe(true);
      expect(result.tier?.tier_id).toBe('r4');
    });
  });

  describe('Edge cases', () => {
    it('0 downline → no match', () => {
      const result = resolveReferralTier(REFERRAL_TIERS, 0);
      expect(result.matched).toBe(false);
    });

    it('empty tiers → no match', () => {
      const result = resolveReferralTier([], 10);
      expect(result.matched).toBe(false);
    });
  });
});

// ============================================
// EXCHANGE CATALOG TESTS
// ============================================

describe('getAffordableCatalogItems', () => {
  it('1000 LP → can afford 2 items (10k and 25k credit)', () => {
    const result = getAffordableCatalogItems(CATALOG, 1000);
    expect(result).toHaveLength(2);
    expect(result[0].item_name).toContain('10.000');
    expect(result[1].item_name).toContain('25.000');
  });

  it('499 LP → cannot afford anything', () => {
    const result = getAffordableCatalogItems(CATALOG, 499);
    expect(result).toHaveLength(0);
  });

  it('500 LP → exactly 1 item (Credit Game 10.000)', () => {
    const result = getAffordableCatalogItems(CATALOG, 500);
    expect(result).toHaveLength(1);
    expect(result[0].item_name).toContain('10.000');
  });

  it('50000 LP → all 4 items', () => {
    const result = getAffordableCatalogItems(CATALOG, 50000);
    expect(result).toHaveLength(4);
  });

  it('should sort cheapest first', () => {
    const result = getAffordableCatalogItems(CATALOG, 50000);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].lp_required).toBeLessThanOrEqual(result[i + 1].lp_required);
    }
  });

  it('empty catalog → empty result', () => {
    expect(getAffordableCatalogItems([], 10000)).toHaveLength(0);
  });
});

describe('getCatalogItemByName', () => {
  it('exact match (case-insensitive)', () => {
    const result = getCatalogItemByName(CATALOG, 'credit game 10.000');
    expect(result).not.toBeNull();
    expect(result?.lp_required).toBe(500);
  });

  it('partial match', () => {
    const result = getCatalogItemByName(CATALOG, 'pulsa');
    expect(result).not.toBeNull();
    expect(result?.item_name).toContain('Pulsa');
  });

  it('no match → null', () => {
    const result = getCatalogItemByName(CATALOG, 'lamborghini');
    expect(result).toBeNull();
  });

  it('empty name → null', () => {
    expect(getCatalogItemByName(CATALOG, '')).toBeNull();
  });
});

describe('queryCatalog', () => {
  it('should return affordable items AND exact match', () => {
    const result = queryCatalog(CATALOG, 1000, 'pulsa');
    // LP 1000: can afford 10k (500 LP) and 25k (1000 LP), not pulsa (2500 LP)
    expect(result.affordable).toHaveLength(2);
    // Pulsa costs 2500 LP, but exact_match still returns it (separate lookup)
    expect(result.exact_match).not.toBeNull();
    expect(result.exact_match?.item_name).toContain('Pulsa');
  });

  it('no item_name → exact_match is null', () => {
    const result = queryCatalog(CATALOG, 1000);
    expect(result.exact_match).toBeNull();
  });
});

// ============================================
// LP EARN CALCULATOR TESTS
// ============================================

describe('calcLpEarned', () => {
  it('1000 TO = 1 LP rule: 5000 TO → 5 LP', () => {
    expect(calcLpEarned(5000, 1, 1000)).toBe(5);
  });

  it('should floor (no partial LP)', () => {
    // 1500 TO with 1000 basis → floor(1.5) = 1 LP
    expect(calcLpEarned(1500, 1, 1000)).toBe(1);
  });

  it('basis_unit = 0 → returns 0 (division guard)', () => {
    expect(calcLpEarned(5000, 1, 0)).toBe(0);
  });

  it('0 turnover → 0 LP', () => {
    expect(calcLpEarned(0, 1, 1000)).toBe(0);
  });
});
