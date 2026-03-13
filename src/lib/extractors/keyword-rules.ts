/**
 * Keyword Rules - Single Source of Truth
 * 
 * ⚠️ DEPRECATION WARNING (2025-01-09):
 * This module is being deprecated in favor of Reasoning-First Architecture.
 * New code should use:
 * - promo-intent-reasoner.ts (Step-0 LLM reasoning)
 * - mechanic-router.ts (deterministic routing)
 * - arbitration-rules.ts (conflict resolution)
 * 
 * Keywords are NO LONGER used as fallback per CONTRACT OF THINKING v1.0.
 * See shouldUseKeywordFallback() below - it returns FALSE.
 * 
 * This module centralizes ALL keyword-based logic for:
 * - Category classification (A/B/C)
 * - Archetype detection (formula_based, event_table, referral, tiered_fixed)
 * - Default field values
 * 
 * VERSION: Update KEYWORD_OVERRIDE_VERSION in category-classifier.ts when modifying rules
 */

// ============================================
// CONTRACT OF THINKING v1.0 - FALLBACK GATE
// ============================================

/**
 * CONTRACT OF THINKING v1.0 - Section F
 * Keyword fallback is DISABLED.
 * 
 * This function returns FALSE to block all keyword fallback usage.
 * The Reasoning-First Architecture (promo-intent-reasoner.ts + mechanic-router.ts)
 * is the sole source of truth for mode, calculation_basis, and trigger_event.
 * 
 * TAXONOMY INTEGRATION v1.0:
 * - This module is now FALLBACK ONLY
 * - Called only when taxonomy returns UNKNOWN + low confidence
 * - See taxonomy-pipeline.ts for SSoT implementation
 * 
 * If this returns true, it means we're violating the contract.
 */
export function shouldUseKeywordFallback(): boolean {
  // DISABLED per Contract of Thinking v1.0
  // Reasoning-First Architecture is the source of truth
  // Keywords are only used for UI defaults and category classification
  return false;
}

/**
 * KEYWORD RULES MODE (v1.0)
 * Indicates the current operational mode of keyword rules.
 * 'fallback_only' = Only called when taxonomy returns UNKNOWN + low
 */
export const KEYWORD_RULES_MODE = 'fallback_only' as const;

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
      // ✅ Toggle defaults - Cashback = percentage-based
      fixed_calculation_value_enabled: true,
      fixed_max_claim_enabled: true,
      fixed_admin_fee_enabled: false,
      fixed_min_depo_enabled: false,
      fixed_min_calculation_enabled: true,
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
      // ✅ Toggle defaults - Welcome = deposit-based percentage
      fixed_calculation_value_enabled: true,
      fixed_max_claim_enabled: true,
      fixed_admin_fee_enabled: false,
      fixed_min_depo_enabled: true,
      // ⚠️ WD Turnover TIDAK auto-enable - harus eksplisit dari terms
      fixed_turnover_rule_enabled: false,
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
      // ✅ Toggle defaults - Deposit Bonus = percentage of deposit
      fixed_calculation_value_enabled: true,
      fixed_max_claim_enabled: true,
      fixed_admin_fee_enabled: false,
      fixed_min_depo_enabled: true,
      // ⚠️ WD Turnover TIDAK auto-enable - harus eksplisit dari terms
      fixed_turnover_rule_enabled: false,
    },
  },
  
  // Withdraw Bonus (WD Bonus)
  // ✅ ARCHITECTURE FIX: trigger_event = Withdraw (gate), calculation_base = FROM EVIDENCE
  // DO NOT hardcode calculation_base - let extraction determine from terms
  {
    id: 'withdraw_bonus',
    name: 'Withdraw Bonus',
    patterns: [
      // ✅ FIX: More flexible patterns to match "BONUS EXTRA WD 5%", "BONUS EXTRA WD 5% SETIAP HARI"
      /bonus\s*extra\s*(?:\d+%?\s*)?wd/i,         // "BONUS EXTRA WD", "BONUS EXTRA 5% WD", "BONUS EXTRA WD 5%"
      /extra\s*(?:\d+%?\s*)?wd/i,                  // "EXTRA WD", "EXTRA 5% WD"
      /bonus\s*(?:extra\s*)?(wd|withdraw)\s*\d/i,  // "BONUS WD 5%", "BONUS EXTRA WD 5%"
      /bonus\s*(extra\s*)?(wd|withdraw)/i,         // "BONUS WD", "BONUS EXTRA WD"
      /extra\s*(wd|withdraw)/i,                    // "EXTRA WD", "EXTRA WITHDRAW"
      /wd\s*bonus/i,                               // "WD BONUS"
      /bonus\s*penarikan/i,                        // "BONUS PENARIKAN"
    ],
    category: 'A',
    archetype: 'formula_based',
    reason: 'WITHDRAW BONUS → Reward Program (trigger=Withdraw, basis=from terms)',
    defaults: {
      promo_type: 'Withdraw Bonus',       // ✅ Force correct badge label
      reward_mode: 'formula',
      // ❌ REMOVED: calculation_base: 'withdraw' - this MUST come from evidence!
      trigger_event: 'Withdraw',          // ✅ Gate/trigger = when WD
      target_segment: 'Semua',
      intent_category: 'Retention',
      // ✅ Toggle defaults
      fixed_calculation_value_enabled: true,
      fixed_max_claim_enabled: true,
      fixed_admin_fee_enabled: false,
      fixed_min_depo_enabled: false,
      fixed_min_calculation_enabled: true,  // Minimal WD untuk eligible
      fixed_turnover_rule_enabled: true,    // Usually has TO requirement
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
      // ✅ Toggle defaults - Freechip = fixed nominal, no deposit requirement
      fixed_calculation_value_enabled: false,
      fixed_max_claim_enabled: false,
      fixed_admin_fee_enabled: false,
      fixed_min_depo_enabled: false,
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
      promo_type: 'Birthday Bonus',        // Override LLM default
      trigger_event: 'Login',              // Birthday = Login-based, not First Deposit
      claim_frequency: 'tahunan',
      intent_category: 'Retention',
      calculation_base: '',                // Birthday tidak pakai dasar perhitungan
      fixed_calculation_base: '',          // Form wizard field - juga kosong
      // ✅ Toggle defaults - Birthday = fixed nominal uang tunai
      fixed_calculation_value_enabled: false, // Nilai Bonus OFF (nominal eksplisit)
      fixed_max_claim_enabled: false,         // Max Bonus OFF (nominal sudah fix)
      fixed_admin_fee_enabled: false,         // Admin Fee OFF
      // NOTE: fixed_min_depo_enabled dan fixed_min_calculation_enabled
      // tidak di-set default karena bergantung pada terms (some have TO, some have historical)
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
      // ✅ Toggle defaults - Rollingan = percentage, biasanya unlimited
      fixed_calculation_value_enabled: true,
      fixed_max_claim_enabled: false,
      fixed_max_claim_unlimited: true,
      fixed_admin_fee_enabled: false,
      fixed_min_depo_enabled: false,
      fixed_min_calculation_enabled: true,
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
      // ✅ Toggle defaults - Referral = commission-based, unlimited
      fixed_calculation_value_enabled: true,
      fixed_max_claim_enabled: false,
      fixed_max_claim_unlimited: true,
      fixed_admin_fee_enabled: false,
      fixed_min_depo_enabled: false,
      fixed_min_calculation_enabled: false,
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
      // ✅ Toggle defaults - Lucky Spin = unit-based
      fixed_calculation_value_enabled: false,
      fixed_max_claim_enabled: false,
      fixed_admin_fee_enabled: false,
      fixed_min_depo_enabled: true, // Lucky Spin sering ada min depo
      // ✅ AUTO-CASCADE: Section 6 - Penukaran Hadiah / Lucky Spin
      // Non-prefixed (Dinamis mode)
      ticket_exchange_enabled: true,
      ticket_exchange_mode: 'lucky_spin' as const,
      // Prefixed (Fixed mode)
      fixed_ticket_exchange_enabled: true,
      fixed_ticket_exchange_mode: 'lucky_spin' as const,
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
      // ✅ Toggle defaults - Voucher = unit-based
      fixed_calculation_value_enabled: false,
      fixed_max_claim_enabled: false,
      fixed_admin_fee_enabled: false,
      fixed_min_depo_enabled: true,
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
      // ✅ Toggle defaults - Ticket = unit-based
      fixed_calculation_value_enabled: false,
      fixed_max_claim_enabled: false,
      fixed_admin_fee_enabled: false,
      fixed_min_depo_enabled: true,
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
  // NEW TAXONOMY RULES (Phase 1)
  // ========================
  
  // Togel Discount (bet_amount-based)
  {
    id: 'togel_discount',
    name: 'Togel Discount',
    patterns: [
      /diskon\s*togel/i,
      /togel\s*discount/i,
      /potongan\s*togel/i,
      /discount\s*\d+%.*togel/i,
    ],
    category: 'A',
    archetype: 'formula_based',
    reason: 'TOGEL DISCOUNT → Reward Program (bet_amount based)',
    defaults: {
      reward_mode: 'formula',
      calculation_base: 'bet_amount',
      trigger_event: 'Bet',
      promo_type: 'Togel Discount',
      target_segment: 'Semua',
      intent_category: 'Retention',
      fixed_calculation_value_enabled: true,
      fixed_max_claim_enabled: false,
    },
  },
  
  // ❌ DELETED: Duplicate bonus_withdraw rule - conflicts with withdraw_bonus (line 158)
  // The withdraw_bonus rule at line 158 handles ALL withdraw bonus patterns
  // This duplicate was causing incorrect tier mode detection
  // Removal date: 2025-01-13
  
  // Winstreak (streak-based)
  {
    id: 'winstreak',
    name: 'Winstreak Bonus',
    patterns: [
      /winstreak/i,
      /win\s*streak/i,
      /menang\s*beruntun/i,
      /kemenangan\s*beruntun/i,
    ],
    category: 'B',
    archetype: 'tiered_fixed',
    reason: 'WINSTREAK → Event Program (streak-based)',
    defaults: {
      reward_mode: 'tier',
      tier_archetype: 'level',
      trigger_event: 'Win',
      promo_type: 'Winstreak Bonus',
      intent_category: 'Retention',
    },
  },
  
  // Milestone Deposit (target-based)
  {
    id: 'milestone_deposit',
    name: 'Milestone Deposit',
    patterns: [
      /milestone/i,
      /target\s*deposit/i,
      /deposit\s*target/i,
      /total\s*deposit.*bonus/i,
    ],
    category: 'B',
    archetype: 'tiered_fixed',
    reason: 'MILESTONE → Event Program (target-based)',
    defaults: {
      reward_mode: 'tier',
      tier_archetype: 'level',
      trigger_event: 'Deposit',
      promo_type: 'Milestone Deposit',
      intent_category: 'Retention',
    },
  },
  
  // VIP Rebate (tier-based percentage)
  {
    id: 'vip_rebate',
    name: 'VIP Rebate',
    patterns: [
      /vip.*rebate/i,
      /rebate.*vip/i,
      /member.*rebate/i,
      /rebate.*tier/i,
    ],
    category: 'A',
    archetype: 'tiered_fixed',
    reason: 'VIP REBATE → Reward Program (tier-based percentage)',
    defaults: {
      reward_mode: 'tier',
      tier_archetype: 'formula',
      calculation_base: 'turnover',
      promo_type: 'VIP Rebate',
      intent_category: 'Retention',
    },
  },
  
  // Merchandise Reward (physical)
  {
    id: 'merchandise',
    name: 'Merchandise Reward',
    patterns: [
      /merchandise/i,
      /hadiah\s*fisik/i,
      /motor/i,
      /mobil/i,
      /iphone/i,
      /hp\s*gratis/i,
    ],
    category: 'A',
    archetype: 'formula_based',
    reason: 'MERCHANDISE → Reward Program (physical reward)',
    defaults: {
      reward_mode: 'fixed',
      trigger_event: 'Mission Completed',
      promo_type: 'Merchandise Reward',
      intent_category: 'Retention',
      fixed_reward_type: 'hadiah_fisik',
    },
  },
  
  // VIP Birthday (tier-based)
  {
    id: 'vip_birthday',
    name: 'VIP Birthday',
    patterns: [
      /vip.*birthday/i,
      /birthday.*vip/i,
      /ultah.*vip/i,
      /vip.*ulang\s*tahun/i,
    ],
    category: 'B',
    archetype: 'tiered_fixed',
    reason: 'VIP BIRTHDAY → Event Program (tier-based)',
    defaults: {
      reward_mode: 'tier',
      tier_archetype: 'level',
      trigger_event: 'Login',
      promo_type: 'VIP Birthday',
      intent_category: 'Retention',
      claim_frequency: 'tahunan',
    },
  },
  
  // Daily Login Reward
  {
    id: 'daily_login',
    name: 'Daily Login Reward',
    patterns: [
      /daily\s*login/i,
      /login\s*harian/i,
      /bonus\s*login/i,
      /login\s*reward/i,
    ],
    category: 'B',
    archetype: 'formula_based',
    reason: 'DAILY LOGIN → Event Program (fixed daily)',
    defaults: {
      reward_mode: 'fixed',
      trigger_event: 'Login',
      promo_type: 'Daily Login Reward',
      intent_category: 'Retention',
      claim_frequency: 'harian',
    },
  },
  
  // First Deposit Bonus (fixed event)
  {
    id: 'first_deposit',
    name: 'First Deposit Bonus',
    patterns: [
      /first\s*deposit/i,
      /deposit\s*pertama/i,
      /depo\s*pertama/i,
    ],
    category: 'B',
    archetype: 'formula_based',
    reason: 'FIRST DEPOSIT → Event Program (one-time fixed)',
    defaults: {
      reward_mode: 'fixed',
      trigger_event: 'First Deposit',
      promo_type: 'First Deposit Bonus',
      intent_category: 'Acquisition',
      claim_frequency: 'sekali',
    },
  },
  
  // Leaderboard Referral (rank-based)
  {
    id: 'leaderboard_referral',
    name: 'Leaderboard Referral',
    patterns: [
      /leaderboard.*referral/i,
      /referral.*leaderboard/i,
      /top.*referrer/i,
      /referral\s*race/i,
      /monthly.*referral.*race/i,
    ],
    category: 'B',
    archetype: 'event_table',
    reason: 'LEADERBOARD REFERRAL → Event Program (rank-based)',
    defaults: {
      reward_mode: 'tier',
      tier_archetype: 'tier_level',
      trigger_event: 'Mission Completed',
      promo_type: 'Leaderboard Referral',
      intent_category: 'Acquisition',
    },
  },
  
  // Prize Terbalik / Consolation (togel)
  {
    id: 'prize_terbalik',
    name: 'Prize Terbalik',
    patterns: [
      /prize\s*terbalik/i,
      /hadiah\s*terbalik/i,
      /consolation/i,
      /hadiah\s*hiburan/i,
    ],
    category: 'B',
    archetype: 'event_table',
    reason: 'PRIZE TERBALIK → Event Program (consolation)',
    defaults: {
      reward_mode: 'tier',
      trigger_event: 'Bet',
      promo_type: 'Prize Terbalik',
      intent_category: 'Retention',
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

// ============================================
// TAXONOMY FALLBACK ENTRY POINT
// Called only when taxonomy returns UNKNOWN + low confidence
// ============================================

/**
 * getKeywordFallbackDefaults
 * 
 * FALLBACK ONLY entry point for taxonomy integration.
 * Called when taxonomy returns UNKNOWN + low confidence.
 * 
 * @param promoName - Promo name from extraction
 * @param promoType - Promo type (optional)
 * @returns Keyword-based defaults as last resort, or null if no match
 */
export function getKeywordFallbackDefaults(
  promoName: string,
  promoType?: string
): Partial<PromoFormData> | null {
  // Only called when taxonomy returns UNKNOWN + low
  // Returns keyword-based defaults as last resort
  const rule = matchKeywordRule(promoName, promoType);
  return rule?.defaults || null;
}
