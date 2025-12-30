/**
 * Keyword Rules - Single Source of Truth
 * 
 * This module centralizes ALL keyword-based logic for:
 * - Category classification (A/B/C)
 * - Archetype detection (formula_based, event_table, referral, tiered_fixed)
 * - Default field values
 * 
 * VERSION: Update KEYWORD_OVERRIDE_VERSION in category-classifier.ts when modifying rules
 */

import type { PromoFormData } from '@/components/VOCDashboard/PromoFormWizard/types';

// ============================================
// TYPES
// ============================================

export type ProgramCategory = 'A' | 'B' | 'C';
export type RewardArchetype = 'formula_based' | 'event_table' | 'referral' | 'tiered_fixed';

export interface KeywordRule {
  id: string;
  name: string;
  patterns: RegExp[];
  category: ProgramCategory;
  archetype: RewardArchetype;
  reason: string;
  defaults: Partial<PromoFormData>;
}

// ============================================
// KEYWORD RULES (Ordered by priority)
// ============================================

export const KEYWORD_RULES: KeywordRule[] = [
  // ========================
  // CATEGORY A - Reward Program
  // ========================
  
  // Cashback (check before Rollingan to handle "Rollingan Cashback")
  {
    id: 'cashback',
    name: 'Cashback',
    patterns: [
      /cashback/i,
      /cash\s*back/i,
      /rebate/i,
    ],
    category: 'A',
    archetype: 'formula_based',
    reason: 'CASHBACK → Reward Program (loss-based)',
    defaults: {
      reward_mode: 'formula',
      calculation_base: 'loss',
      trigger_event: 'Turnover',
      target_segment: 'Semua',
      intent_category: 'Retention',
    },
  },
  
  // New Member / Welcome
  {
    id: 'welcome',
    name: 'Welcome Bonus',
    patterns: [
      /new\s*member/i,
      /member\s*baru/i,
      /welcome/i,
      /selamat\s*datang/i,
    ],
    category: 'A',
    archetype: 'formula_based',
    reason: 'NEW MEMBER → Bonus Instan',
    defaults: {
      reward_mode: 'formula',
      calculation_base: 'deposit',
      trigger_event: 'First Deposit',
      target_segment: 'Baru',
      intent_category: 'Acquisition',
    },
  },
  
  // Birthday
  {
    id: 'birthday',
    name: 'Birthday Bonus',
    patterns: [
      /birthday/i,
      /ulang\s*tahun/i,
      /ultah/i,
    ],
    category: 'A',
    archetype: 'formula_based',
    reason: 'BIRTHDAY → Bonus Instan',
    defaults: {
      reward_mode: 'fixed',
      trigger_event: 'Login',
      claim_frequency: 'tahunan',
      intent_category: 'Retention',
    },
  },
  
  // Rollingan (after Cashback check)
  {
    id: 'rollingan',
    name: 'Rollingan',
    patterns: [
      /rollingan/i,
      /roll(ing)?an/i,
    ],
    category: 'A',
    archetype: 'formula_based',
    reason: 'ROLLINGAN → Reward Program (turnover cashback)',
    defaults: {
      reward_mode: 'formula',
      calculation_base: 'turnover',
      trigger_event: 'Turnover',
      target_segment: 'Semua',
      intent_category: 'Retention',
      claim_frequency: 'mingguan',
    },
  },
  
  // Referral (commission-based)
  {
    id: 'referral',
    name: 'Referral Bonus',
    patterns: [
      /referral/i,
      /referal/i,
      /refferal/i,
      /ajak\s*teman/i,
      /ajak\s*team/i,
      /undang\s*teman/i,
      /invite\s*friend/i,
      /extra\s*cuan.*referral/i,
      /rekrut/i,
      /ref\s*bonus/i,
    ],
    category: 'A',
    archetype: 'referral',
    reason: 'REFERRAL → Reward Program (commission-based)',
    defaults: {
      reward_mode: 'formula',
      calculation_base: 'deposit',
      trigger_event: 'Referral',
      target_segment: 'Semua',
      intent_category: 'Acquisition',
      claim_frequency: 'unlimited',
    },
  },
  
  // ========================
  // CATEGORY B - Event Program
  // ========================
  
  // Lucky Spin / Mini Game
  {
    id: 'lucky_spin',
    name: 'Lucky Spin / Mini Game',
    patterns: [
      /lucky\s*spin/i,
      /mini\s*game/i,
      /roda\s*keberuntungan/i,
      /spin\s*the\s*wheel/i,
      /putar\s*roda/i,
    ],
    category: 'B',
    archetype: 'event_table',
    reason: 'LUCKY SPIN → Event Program',
    defaults: {
      reward_mode: 'fixed',
      trigger_event: 'Login',
      intent_category: 'Retention',
    },
  },
  
  // Tournament
  {
    id: 'tournament',
    name: 'Tournament',
    patterns: [
      /tournament/i,
      /turnamen/i,
      /kompetisi/i,
      /leaderboard/i,
      /ranking\s*event/i,
    ],
    category: 'B',
    archetype: 'event_table',
    reason: 'TOURNAMENT → Event Program',
    defaults: {
      reward_mode: 'tier',
      trigger_event: 'Mission Completed',
      intent_category: 'Retention',
    },
  },
  
  // Event / Level Up (generic event patterns)
  {
    id: 'event',
    name: 'Event / Level Up',
    patterns: [
      /scatter/i,
      /\bevent\b/i,
      /level\s*up/i,
      /naik\s*level/i,
      /milestone/i,
      /achievement/i,
      /kejar\s*level/i,
      /bonus\s*scatter/i,
      /hadiah\s*scatter/i,
      /\bmisi\b/i,
      /\bquest\b/i,
      /\bchallenge\b/i,
      /prize\s*(1st|2nd|3rd)/i,
    ],
    category: 'B',
    archetype: 'event_table',
    reason: 'EVENT → Event Program',
    defaults: {
      reward_mode: 'tier',
      trigger_event: 'Mission Completed',
      intent_category: 'Retention',
    },
  },
  
  // Point Store / Loyalty
  {
    id: 'point_store',
    name: 'Point Store / Loyalty',
    patterns: [
      /\bpoint\b/i,
      /\bredeem\b/i,
      /\btukar\b/i,
      /loyalty/i,
      /reward\s*point/i,
      /\bpoin\b/i,
      /penukaran/i,
    ],
    category: 'B',
    archetype: 'tiered_fixed',
    reason: 'POINT STORE → Loyalty Program',
    defaults: {
      reward_mode: 'tier',
      trigger_event: 'Turnover',
      target_segment: 'Semua',
      intent_category: 'Retention',
      claim_frequency: 'unlimited',
    },
  },
  
  // ========================
  // CATEGORY C - System Rule (Informational)
  // ========================
  
  {
    id: 'deposit_info',
    name: 'Deposit Info',
    patterns: [
      /tersedia\s*deposit/i,
      /deposit\s*pulsa/i,
      /info\s*deposit/i,
    ],
    category: 'C',
    archetype: 'formula_based',
    reason: 'DEPOSIT INFO → System Rule (informational)',
    defaults: {},
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Find matching keyword rule based on promo name and type
 * Returns the first matching rule (rules are ordered by priority)
 */
export function matchKeywordRule(
  promoName: string, 
  promoType?: string
): KeywordRule | null {
  const nameLower = promoName.toLowerCase();
  const typeLower = (promoType || '').toLowerCase();
  
  // Check promo_name first (higher priority)
  for (const rule of KEYWORD_RULES) {
    if (rule.patterns.some(pattern => pattern.test(nameLower))) {
      return rule;
    }
  }
  
  // Fallback to promo_type
  for (const rule of KEYWORD_RULES) {
    if (rule.patterns.some(pattern => pattern.test(typeLower))) {
      return rule;
    }
  }
  
  return null;
}

/**
 * Get category from keywords (returns null if no match)
 */
export function getCategoryFromKeywords(
  promoName: string, 
  promoType?: string
): ProgramCategory | null {
  const rule = matchKeywordRule(promoName, promoType);
  return rule?.category ?? null;
}

/**
 * Get archetype from keywords (returns null if no match)
 */
export function getArchetypeFromKeywords(
  promoName: string, 
  promoType?: string
): RewardArchetype | null {
  const rule = matchKeywordRule(promoName, promoType);
  return rule?.archetype ?? null;
}

/**
 * Get defaults from keywords (returns null if no match)
 */
export function getDefaultsFromKeywords(
  promoName: string, 
  promoType?: string
): Partial<PromoFormData> | null {
  const rule = matchKeywordRule(promoName, promoType);
  return rule?.defaults ?? null;
}

/**
 * Apply keyword override to LLM category
 * Returns the correct category and whether it was overridden
 */
export function applyKeywordOverride(
  llmCategory: ProgramCategory,
  promoName: string,
  promoType?: string
): { category: ProgramCategory; wasOverridden: boolean; overrideReason?: string } {
  const nameLower = promoName.toLowerCase();
  const typeLower = (promoType || '').toLowerCase();
  
  // Special case: promo_type contains BOTH cashback AND rollingan → don't override
  const hasCashbackInType = /cashback|cash\s*back|rebate/i.test(typeLower);
  const hasRollinganInType = /rollingan|roll(ing)?an/i.test(typeLower);
  if (hasCashbackInType && hasRollinganInType) {
    console.log('[KeywordRules] promo_type has both CASHBACK and ROLLINGAN, no override');
    return { category: llmCategory, wasOverridden: false };
  }
  
  // Check promo_name first (higher priority)
  for (const rule of KEYWORD_RULES) {
    if (rule.patterns.some(pattern => pattern.test(nameLower))) {
      if (llmCategory !== rule.category) {
        console.log(`[KeywordRules] Override: ${rule.id} in promo_name, forcing ${rule.category} (was ${llmCategory})`);
        return { category: rule.category, wasOverridden: true, overrideReason: rule.reason };
      }
      return { category: rule.category, wasOverridden: false };
    }
  }
  
  // Fallback to promo_type
  for (const rule of KEYWORD_RULES) {
    if (rule.patterns.some(pattern => pattern.test(typeLower))) {
      if (llmCategory !== rule.category) {
        console.log(`[KeywordRules] Override: ${rule.id} in promo_type, forcing ${rule.category} (was ${llmCategory})`);
        return { category: rule.category, wasOverridden: true, overrideReason: `${rule.reason} (from promo_type)` };
      }
      return { category: rule.category, wasOverridden: false };
    }
  }
  
  // No override needed
  return { category: llmCategory, wasOverridden: false };
}

// ============================================
// ARCHETYPE KEYWORD ARRAYS (for backward compat)
// These are derived from KEYWORD_RULES for modules that need string[] format
// ============================================

export const ARCHETYPE_KEYWORD_ARRAYS = {
  event_table: KEYWORD_RULES
    .filter(r => r.archetype === 'event_table')
    .flatMap(r => r.patterns.map(p => p.source.replace(/\\s\*/g, ' ').replace(/\\b/g, '').replace(/\\/g, '').toLowerCase())),
  tiered_fixed: KEYWORD_RULES
    .filter(r => r.archetype === 'tiered_fixed')
    .flatMap(r => r.patterns.map(p => p.source.replace(/\\s\*/g, ' ').replace(/\\b/g, '').replace(/\\/g, '').toLowerCase())),
  referral: KEYWORD_RULES
    .filter(r => r.archetype === 'referral')
    .flatMap(r => r.patterns.map(p => p.source.replace(/\\s\*/g, ' ').replace(/\\b/g, '').replace(/\\/g, '').toLowerCase())),
} as const;
