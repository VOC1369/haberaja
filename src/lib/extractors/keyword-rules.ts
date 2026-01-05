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
      trigger_event: 'Loss',  // ✅ Cashback = Loss-based, NOT Turnover!
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
  
  // Deposit Bonus
  {
    id: 'deposit_bonus',
    name: 'Deposit Bonus',
    patterns: [
      /bonus\s*deposit/i,
      /deposit\s*bonus/i,
      /bonus\s*\d+%/i,
      /extra\s*deposit/i,
      /double\s*deposit/i,
      /next\s*deposit/i,
    ],
    category: 'A',
    archetype: 'formula_based',
    reason: 'DEPOSIT BONUS → Reward Program (deposit-based)',
    defaults: {
      reward_mode: 'formula',
      calculation_base: 'deposit',
      trigger_event: 'Deposit',
      target_segment: 'Semua',
      intent_category: 'Retention',
    },
  },
  
  // Freechip / Freebet
  {
    id: 'freechip',
    name: 'Freechip / Freebet',
    patterns: [
      /freechip/i,
      /free\s*chip/i,
      /freebet/i,
      /free\s*bet/i,
      /chip\s*gratis/i,
      /bonus\s*harian/i,
    ],
    category: 'A',
    archetype: 'formula_based',
    reason: 'FREECHIP → Reward Program (instant bonus)',
    defaults: {
      reward_mode: 'fixed',
      trigger_event: 'Login',
      target_segment: 'Semua',
      intent_category: 'Retention',
      claim_frequency: 'harian',
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
      /spin\s*gratis/i,
      /free\s*spin/i,
      /spin\s*harian/i,
    ],
    category: 'B',
    archetype: 'event_table',
    reason: 'LUCKY SPIN → Event Program',
    defaults: {
      reward_mode: 'fixed',
      trigger_event: 'Login',
      intent_category: 'Retention',
      fixed_reward_type: 'lucky_spin',
      fixed_lucky_spin_enabled: true,
    },
  },
  
  // Voucher / Kupon
  {
    id: 'voucher',
    name: 'Voucher / Kupon',
    patterns: [
      /voucher/i,
      /kupon/i,
    ],
    category: 'B',
    archetype: 'event_table',
    reason: 'VOUCHER → Event Program',
    defaults: {
      reward_mode: 'fixed',
      trigger_event: 'Deposit',
      intent_category: 'Retention',
      fixed_reward_type: 'voucher',
    },
  },
  
  // Ticket / Undian
  {
    id: 'ticket',
    name: 'Ticket / Undian',
    patterns: [
      /ticket/i,
      /tiket/i,
      /undian/i,
      /lottery/i,
    ],
    category: 'B',
    archetype: 'event_table',
    reason: 'TICKET → Event Program',
    defaults: {
      reward_mode: 'fixed',
      trigger_event: 'Deposit',
      intent_category: 'Retention',
      fixed_reward_type: 'ticket',
    },
  },
  
  // Provider Tournament (Pragmatic, PG Soft, etc.)
  {
    id: 'provider_tournament',
    name: 'Provider Tournament',
    patterns: [
      /pragmatic/i,
      /drops\s*(and|&|\+)\s*wins/i,
      /provider\s*tournament/i,
      /pg\s*soft/i,
      /habanero\s*race/i,
      /microgaming/i,
      /spade\s*gaming/i,
    ],
    category: 'B',
    archetype: 'event_table',
    reason: 'PROVIDER TOURNAMENT → Event Program (external)',
    defaults: {
      reward_mode: 'tier',
      trigger_event: 'Mission Completed',
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
  
  // Event Multiplier / MaxWin
  {
    id: 'event_multiplier',
    name: 'Event Multiplier / MaxWin',
    patterns: [
      /maxwin/i,
      /max\s*win/i,
      /multiplier\s*\d+x/i,
      /target\s*kemenangan/i,
      /spaceman.*\d+x/i,
      /aviator.*\d+x/i,
      /bonus\s*multiplier/i,
      /big\s*win/i,
      /mega\s*win/i,
    ],
    category: 'B',
    archetype: 'event_table',
    reason: 'EVENT MULTIPLIER → Event Program (target-based)',
    defaults: {
      reward_mode: 'tier',
      trigger_event: 'Mission Completed',
      intent_category: 'Retention',
    },
  },
  
  // Mystery / Random Bonus
  {
    id: 'mystery_bonus',
    name: 'Mystery / Random Bonus',
    patterns: [
      /mystery/i,
      /random\s*bonus/i,
      /surprise/i,
      /kejutan/i,
      /rahasia/i,
      /misteri/i,
    ],
    category: 'B',
    archetype: 'event_table',
    reason: 'MYSTERY BONUS → Event Program (random)',
    defaults: {
      reward_mode: 'fixed',
      trigger_event: 'Login',
      intent_category: 'Retention',
    },
  },
  
  // Streak / Combo / Daily Check-in
  {
    id: 'streak_bonus',
    name: 'Streak / Combo Bonus',
    patterns: [
      /streak/i,
      /combo/i,
      /beruntun/i,
      /daily\s*login/i,
      /check.?in/i,
      /hadir\s*setiap\s*hari/i,
      /absen/i,
      /consecutive/i,
    ],
    category: 'B',
    archetype: 'tiered_fixed',
    reason: 'STREAK BONUS → Event Program (accumulative)',
    defaults: {
      reward_mode: 'tier',
      trigger_event: 'Login',
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
