/**
 * PROMO PATTERN TAXONOMY v1.0 — LOCKED
 * Single Source of Truth for all promo logic
 * 
 * ⚠️ THIS IS THE BRAIN OF THE SYSTEM ⚠️
 * All UI, Extractor, Validator MUST obey this taxonomy.
 * 
 * ABSOLUTE RULES:
 * 1. NO per-promo logic
 * 2. NO guessing
 * 3. Evidence-based reasoning only
 * 4. UNKNOWN = flag for review, NOT guess
 * 
 * 4 ARCHITECTURAL LOCKS:
 * 1. ARCHETYPE_RULES = constraints (locked/derived/optional), not set value
 * 2. Detector = positive + negative + disqualifier scoring
 * 3. Invariant conflict → UNKNOWN (not throw), except impossible state
 * 4. UI = archetype-driven rendering, not mode-driven
 * 
 * VERSION: v1.0.0+2025-01-15 (LOCKED)
 */

import type { CanonicalMode } from './promo-primitive-gate';

// ============================================
// CANONICAL ARCHETYPE ENUM (11 types)
// ============================================

export type PromoArchetype =
  | 'DEPOSIT_BONUS'      // trigger=Deposit, basis=deposit, payout=variable
  | 'WITHDRAW_BONUS'     // trigger=Withdraw, basis=withdraw|turnover
  | 'CASHBACK'           // trigger=Loss, basis=loss, payout=after
  | 'ROLLINGAN'          // trigger=Turnover, basis=turnover
  | 'REFERRAL'           // trigger=Referral, mode=tier
  | 'PLATFORM_REWARD'    // trigger=APK/Registration, mode=fixed
  | 'TEMPORAL_REWARD'    // trigger=Birthday/Anniversary, mode=fixed
  | 'COMPETITION'        // trigger=milestone, mode=tier
  | 'LUCKY_DRAW'         // reward_nature=chance, mode=fixed
  | 'ACCESS_REWARD'      // trigger=VIP/unlock, mode=fixed|tier
  | 'UNKNOWN';           // Cannot classify → flag for review

// ============================================
// FIELD CONSTRAINT TYPES
// ============================================

export type FieldConstraintType = 'must_be' | 'must_not_be' | 'one_of' | 'from_evidence';

export interface LockedFieldConstraint {
  value: unknown;
  reason: string;
}

export interface DerivedFieldConstraint {
  derive_from: 'evidence' | 'terms' | 'subcategory';
  allowed_values?: unknown[];
  default_if_missing?: unknown;
  confidence_if_missing: 'low' | 'medium' | 'high';
  ambiguity_flag?: string;
}

// ============================================
// ARCHETYPE INVARIANT
// ============================================

export interface ArchetypeInvariant {
  field: string;
  condition: 'must_be' | 'must_not_be' | 'must_exist' | 'must_not_exist';
  value?: unknown;
  error_message: string;
  type: 'hard' | 'soft';  // hard = block, soft = downgrade confidence
}

// ============================================
// ARCHETYPE DETECTION CUES
// 3-tier evidence: positive, negative, disqualifier
// ============================================

export interface ArchetypeDetectionCues {
  positive_cues: RegExp[];    // Adds score
  negative_cues: RegExp[];    // Reduces score
  disqualifiers: RegExp[];    // Hard reject (score = -Infinity)
}

// ============================================
// ARCHETYPE SEMANTIC RULE (LOCK #1)
// Uses constraints, not fixed values
// ============================================

export interface ArchetypeSemanticRule {
  archetype: PromoArchetype;
  display_name: string;
  
  // ============================================
  // LOCKED FIELDS (always true for this archetype)
  // ============================================
  locked_fields: {
    trigger_event?: LockedFieldConstraint;
    mode?: LockedFieldConstraint;
    calculation_basis?: LockedFieldConstraint | null;  // null = explicitly no basis
    payout_direction?: LockedFieldConstraint;
    require_apk?: LockedFieldConstraint;
    turnover_enabled?: LockedFieldConstraint;
  };
  
  // ============================================
  // DERIVED FIELDS (from evidence with constraints)
  // ============================================
  derived_fields: {
    mode?: DerivedFieldConstraint;
    calculation_basis?: DerivedFieldConstraint;
    payout_direction?: DerivedFieldConstraint;
    reward_amount?: DerivedFieldConstraint;
    max_bonus?: DerivedFieldConstraint;
    turnover_multiplier?: DerivedFieldConstraint;
    min_deposit?: DerivedFieldConstraint;
    trigger_event?: DerivedFieldConstraint;
  };
  
  // ============================================
  // OPTIONAL FIELDS (may or may not exist)
  // ============================================
  optional_fields: string[];
  
  // ============================================
  // INVARIANTS (hard = block, soft = flag)
  // ============================================
  invariants: ArchetypeInvariant[];
  
  // ============================================
  // DETECTION CUES (positive/negative/disqualifier)
  // ============================================
  detection_cues: ArchetypeDetectionCues;
  
  // ============================================
  // FIELD APPLICABILITY (for UI rendering)
  // ============================================
  applicable_fields: string[];
  not_applicable_fields: string[];
  
  // ============================================
  // PAYLOAD CONTRACT (for lifecycle-heavy archetypes)
  // ============================================
  payload_contract?: {
    required_keys: string[];
    optional_keys: string[];
  };
}

// ============================================
// ARCHETYPE RULES — THE BRAIN
// ============================================

export const ARCHETYPE_RULES: Record<PromoArchetype, ArchetypeSemanticRule> = {
  // ============================================
  // DEPOSIT_BONUS
  // ============================================
  DEPOSIT_BONUS: {
    archetype: 'DEPOSIT_BONUS',
    display_name: 'Bonus Deposit',
    
    locked_fields: {
      trigger_event: { value: 'Deposit', reason: 'Deposit-based promo' },
      // Mode NOT locked - can be fixed (50rb) or formula (10%)
    },
    
    derived_fields: {
      mode: {
        derive_from: 'evidence',
        allowed_values: ['fixed', 'formula', 'tier'],
        default_if_missing: 'formula',
        confidence_if_missing: 'medium',
        ambiguity_flag: 'mode_not_determined',
      },
      calculation_basis: {
        derive_from: 'evidence',
        allowed_values: ['deposit'],
        default_if_missing: 'deposit',
        confidence_if_missing: 'medium',
      },
      payout_direction: {
        derive_from: 'terms',
        allowed_values: ['before', 'after'],
        default_if_missing: 'before',
        confidence_if_missing: 'medium',
      },
    },
    
    optional_fields: [
      'max_bonus', 'min_deposit', 'turnover_multiplier', 
      'claim_frequency', 'game_providers', 'game_exclusions',
    ],
    
    invariants: [
      {
        field: 'trigger_event',
        condition: 'must_be',
        value: 'Deposit',
        error_message: 'DEPOSIT_BONUS trigger must be Deposit',
        type: 'hard',
      },
    ],
    
    detection_cues: {
      positive_cues: [
        /bonus\s*deposit/i,
        /deposit\s*bonus/i,
        /bonus\s*\d+%/i,
        /welcome\s*bonus/i,
        /new\s*member/i,
        /first\s*deposit/i,
        /next\s*deposit/i,
        /reload\s*bonus/i,
      ],
      negative_cues: [
        /cashback/i,
        /rollingan/i,
        /referral/i,
        /withdraw|wd/i,
        /apk|download/i,
      ],
      disqualifiers: [
        /birthday|ultah/i,
        /lucky\s*spin/i,
      ],
    },
    
    applicable_fields: [
      'calculation_basis', 'calculation_value', 'min_deposit',
      'turnover_multiplier', 'max_bonus', 'claim_frequency',
      'payout_direction', 'game_providers',
    ],
    not_applicable_fields: [
      'referral_tiers', 'lucky_spin_rewards', 'tier_count',
      'require_apk', 'physical_reward_name',
    ],
  },

  // ============================================
  // WITHDRAW_BONUS
  // ============================================
  WITHDRAW_BONUS: {
    archetype: 'WITHDRAW_BONUS',
    display_name: 'Bonus Withdraw',
    
    locked_fields: {
      trigger_event: { value: 'Withdraw', reason: 'Withdraw-triggered promo' },
      // Mode NOT locked - can be fixed or formula
    },
    
    derived_fields: {
      mode: {
        derive_from: 'evidence',
        allowed_values: ['fixed', 'formula'],
        default_if_missing: 'formula',
        confidence_if_missing: 'medium',
      },
      calculation_basis: {
        derive_from: 'evidence',
        allowed_values: ['withdraw', 'turnover'],
        default_if_missing: null,  // MUST be from evidence, no default
        confidence_if_missing: 'low',
        ambiguity_flag: 'missing_calculation_evidence',
      },
      payout_direction: {
        derive_from: 'evidence',
        allowed_values: ['before', 'after'],
        default_if_missing: 'after',  // WD usually after
        confidence_if_missing: 'medium',
      },
    },
    
    optional_fields: [
      'max_bonus', 'min_calculation', 'turnover_multiplier',
    ],
    
    invariants: [
      {
        field: 'trigger_event',
        condition: 'must_be',
        value: 'Withdraw',
        error_message: 'WITHDRAW_BONUS trigger must be Withdraw',
        type: 'hard',
      },
      // SOFT: calculation_basis should exist (not hard block)
      {
        field: 'calculation_basis',
        condition: 'must_exist',
        error_message: 'WITHDRAW_BONUS calculation_basis should be from evidence',
        type: 'soft',  // Downgrade confidence, don't block
      },
    ],
    
    detection_cues: {
      positive_cues: [
        /bonus\s*(extra\s*)?(wd|withdraw)/i,
        /extra\s*(wd|withdraw)/i,
        /wd\s*bonus/i,
        /withdraw\s*\d+%/i,
        /bonus\s*penarikan/i,
      ],
      negative_cues: [
        /deposit/i,
        /cashback/i,
        /rollingan/i,
        /apk/i,
      ],
      disqualifiers: [
        /referral/i,
        /birthday/i,
        /lucky\s*spin/i,
      ],
    },
    
    applicable_fields: [
      'calculation_basis', 'calculation_value', 'min_calculation',
      'turnover_multiplier', 'max_bonus', 'payout_direction',
    ],
    not_applicable_fields: [
      'min_deposit', 'referral_tiers', 'lucky_spin_rewards',
      'require_apk', 'physical_reward_name',
    ],
  },

  // ============================================
  // CASHBACK
  // ============================================
  CASHBACK: {
    archetype: 'CASHBACK',
    display_name: 'Cashback',
    
    locked_fields: {
      trigger_event: { value: 'Loss', reason: 'Loss-based calculation' },
      calculation_basis: { value: 'loss', reason: 'Cashback = loss-based' },
      payout_direction: { value: 'after', reason: 'Loss must occur first' },
      turnover_enabled: { value: false, reason: 'Cashback has no WD requirement' },
    },
    
    derived_fields: {
      mode: {
        derive_from: 'evidence',
        allowed_values: ['formula'],
        default_if_missing: 'formula',
        confidence_if_missing: 'high',
      },
    },
    
    optional_fields: [
      'max_bonus', 'min_calculation', 'claim_frequency', 'game_providers',
    ],
    
    invariants: [
      {
        field: 'trigger_event',
        condition: 'must_be',
        value: 'Loss',
        error_message: 'CASHBACK trigger must be Loss',
        type: 'hard',
      },
      {
        field: 'calculation_basis',
        condition: 'must_be',
        value: 'loss',
        error_message: 'CASHBACK basis must be loss',
        type: 'hard',
      },
      {
        field: 'payout_direction',
        condition: 'must_be',
        value: 'after',
        error_message: 'CASHBACK payout must be after (loss must occur first)',
        type: 'hard',
      },
    ],
    
    detection_cues: {
      positive_cues: [
        /cashback/i,
        /cash\s*back/i,
        /kekalahan/i,
        /loss\s*\d+%/i,
      ],
      negative_cues: [
        /deposit/i,
        /withdraw/i,
        /rollingan/i,
        /apk/i,
      ],
      disqualifiers: [
        /referral/i,
        /lucky\s*spin/i,
        /turnover\s*bonus/i,  // Rollingan, not cashback
      ],
    },
    
    applicable_fields: [
      'calculation_basis', 'calculation_value', 'min_calculation',
      'max_bonus', 'claim_frequency', 'game_providers',
    ],
    not_applicable_fields: [
      'min_deposit', 'turnover_multiplier', 'referral_tiers',
      'require_apk', 'payout_direction',  // Always 'after'
    ],
  },

  // ============================================
  // ROLLINGAN
  // ============================================
  ROLLINGAN: {
    archetype: 'ROLLINGAN',
    display_name: 'Rollingan / Turnover',
    
    locked_fields: {
      trigger_event: { value: 'Turnover', reason: 'Turnover-based calculation' },
      calculation_basis: { value: 'turnover', reason: 'Rollingan = turnover-based' },
      turnover_enabled: { value: false, reason: 'Rollingan has no additional WD requirement' },
    },
    
    derived_fields: {
      mode: {
        derive_from: 'evidence',
        allowed_values: ['formula'],
        default_if_missing: 'formula',
        confidence_if_missing: 'high',
      },
      payout_direction: {
        derive_from: 'terms',
        allowed_values: ['before', 'after'],
        default_if_missing: 'after',
        confidence_if_missing: 'medium',
      },
    },
    
    optional_fields: [
      'max_bonus', 'min_calculation', 'claim_frequency', 'game_providers',
    ],
    
    invariants: [
      {
        field: 'trigger_event',
        condition: 'must_be',
        value: 'Turnover',
        error_message: 'ROLLINGAN trigger must be Turnover',
        type: 'hard',
      },
      {
        field: 'calculation_basis',
        condition: 'must_be',
        value: 'turnover',
        error_message: 'ROLLINGAN basis must be turnover',
        type: 'hard',
      },
    ],
    
    detection_cues: {
      positive_cues: [
        /rollingan/i,
        /turnover\s*bonus/i,
        /komisi\s*turnover/i,
        /bonus\s*to\b/i,
      ],
      negative_cues: [
        /deposit/i,
        /withdraw/i,
        /cashback/i,
        /loss|kekalahan/i,
      ],
      disqualifiers: [
        /referral/i,
        /lucky\s*spin/i,
        /birthday/i,
      ],
    },
    
    applicable_fields: [
      'calculation_basis', 'calculation_value', 'min_calculation',
      'max_bonus', 'claim_frequency', 'game_providers', 'payout_direction',
    ],
    not_applicable_fields: [
      'min_deposit', 'turnover_multiplier', 'referral_tiers',
      'require_apk',
    ],
  },

  // ============================================
  // REFERRAL
  // ============================================
  REFERRAL: {
    archetype: 'REFERRAL',
    display_name: 'Referral / Ajak Teman',
    
    locked_fields: {
      trigger_event: { value: 'Referral', reason: 'Referral action' },
      // Mode is usually tier (multiple downline levels)
    },
    
    derived_fields: {
      mode: {
        derive_from: 'evidence',
        allowed_values: ['tier', 'fixed'],
        default_if_missing: 'tier',
        confidence_if_missing: 'high',
      },
      calculation_basis: {
        derive_from: 'evidence',
        allowed_values: ['referral_turnover', 'referral_loss'],
        default_if_missing: 'referral_turnover',
        confidence_if_missing: 'medium',
      },
    },
    
    optional_fields: [
      'referral_tiers', 'referral_admin_fee_percentage',
      'referral_calculation_basis', 'max_bonus',
    ],
    
    invariants: [
      {
        field: 'trigger_event',
        condition: 'must_be',
        value: 'Referral',
        error_message: 'REFERRAL trigger must be Referral',
        type: 'hard',
      },
    ],
    
    detection_cues: {
      positive_cues: [
        /referral/i,
        /referal/i,
        /ajak\s*teman/i,
        /komisi\s*referral/i,
        /bonus\s*member\s*baru/i,
        /downline/i,
      ],
      negative_cues: [
        /deposit\s*bonus/i,
        /cashback/i,
        /rollingan/i,
      ],
      disqualifiers: [
        /lucky\s*spin/i,
        /birthday/i,
        /apk\s*download/i,
      ],
    },
    
    applicable_fields: [
      'referral_tiers', 'referral_calculation_basis',
      'referral_admin_fee_percentage', 'claim_frequency',
    ],
    not_applicable_fields: [
      'min_deposit', 'turnover_multiplier', 'max_bonus',
      'calculation_basis', 'payout_direction', 'require_apk',
    ],
  },

  // ============================================
  // PLATFORM_REWARD (APK Download, Registration)
  // ============================================
  PLATFORM_REWARD: {
    archetype: 'PLATFORM_REWARD',
    display_name: 'Platform Reward (APK/Registrasi)',
    
    locked_fields: {
      // trigger_event NOT locked - can be APK Download or Registration
      require_apk: { value: true, reason: 'Platform reward requires APK' },
      calculation_basis: null,  // Explicitly no basis
      turnover_enabled: { value: false, reason: 'Platform rewards have no turnover' },
    },
    
    derived_fields: {
      mode: {
        derive_from: 'evidence',
        allowed_values: ['fixed', 'formula'],  // APK can be formula (APK Cashback)
        default_if_missing: 'fixed',
        confidence_if_missing: 'high',
      },
      trigger_event: {
        derive_from: 'evidence',
        allowed_values: ['APK Download', 'Registration'],
        default_if_missing: 'APK Download',
        confidence_if_missing: 'medium',
      },
    },
    
    optional_fields: [
      'reward_amount', 'max_claim', 'distribution_note',
    ],
    
    invariants: [
      // Mode=fixed is NOT an invariant - APK can be formula (e.g., APK Cashback 5%)
      // Only enforce when evidence shows fixed reward
      {
        field: 'require_apk',
        condition: 'must_be',
        value: true,
        error_message: 'PLATFORM_REWARD must have require_apk=true',
        type: 'hard',
      },
    ],
    
    detection_cues: {
      positive_cues: [
        /download\s*apk/i,
        /apk\s*bonus/i,
        /freechip\s*apk/i,
        /bonus\s*registrasi/i,
        /new\s*member\s*bonus/i,
        /install\s*aplikasi/i,
        /via\s*aplikasi/i,
        /khusus\s*apk/i,
      ],
      negative_cues: [
        /deposit/i,
        /withdraw/i,
        /cashback/i,
        /rollingan/i,
      ],
      disqualifiers: [
        /referral/i,
        /birthday/i,
        /lucky\s*spin/i,
        /level\s*up/i,
      ],
    },
    
    applicable_fields: [
      'reward_amount', 'max_claim', 'claim_method',
      'distribution_note', 'require_apk',
    ],
    not_applicable_fields: [
      'calculation_basis', 'calculation_value', 'turnover_multiplier',
      'min_deposit', 'referral_tiers', 'payout_direction',
    ],
  },

  // ============================================
  // TEMPORAL_REWARD (Birthday, Anniversary)
  // ============================================
  TEMPORAL_REWARD: {
    archetype: 'TEMPORAL_REWARD',
    display_name: 'Temporal Reward (Birthday/Anniversary)',
    
    locked_fields: {
      trigger_event: { value: 'Login', reason: 'Temporal rewards triggered by login' },
      // Mode can be fixed or formula depending on reward structure
    },
    
    derived_fields: {
      mode: {
        derive_from: 'evidence',
        allowed_values: ['fixed', 'formula'],
        default_if_missing: 'fixed',
        confidence_if_missing: 'high',
      },
    },
    
    optional_fields: [
      'reward_amount', 'max_claim', 'claim_frequency',
      'special_requirements', 'min_calculation',
    ],
    
    invariants: [
      // No hard invariants - temporal rewards are flexible
    ],
    
    detection_cues: {
      positive_cues: [
        /birthday/i,
        /ultah/i,
        /ulang\s*tahun/i,
        /anniversary/i,
        /hari\s*jadi/i,
        /imlek/i,
        /lebaran/i,
        /natal/i,
      ],
      negative_cues: [
        /deposit/i,
        /withdraw/i,
        /cashback/i,
        /apk/i,
      ],
      disqualifiers: [
        /referral/i,
        /rollingan/i,
        /turnover\s*event/i,
      ],
    },
    
    applicable_fields: [
      'reward_amount', 'max_claim', 'claim_frequency',
      'special_requirements', 'min_calculation',
    ],
    not_applicable_fields: [
      'calculation_basis', 'turnover_multiplier', 'referral_tiers',
      'require_apk', 'payout_direction',
    ],
  },

  // ============================================
  // COMPETITION (Tournament, Leaderboard)
  // ============================================
  COMPETITION: {
    archetype: 'COMPETITION',
    display_name: 'Competition / Tournament',
    
    locked_fields: {
      // Mode locked to tier (multiple prize tiers)
      mode: { value: 'tier', reason: 'Competition has multiple prize tiers' },
    },
    
    derived_fields: {
      trigger_event: {
        derive_from: 'evidence',
        allowed_values: ['Milestone', 'Turnover', 'Bet'],
        default_if_missing: 'Milestone',
        confidence_if_missing: 'medium',
      },
      calculation_basis: {
        derive_from: 'evidence',
        allowed_values: ['turnover', 'bet', null],
        default_if_missing: 'turnover',
        confidence_if_missing: 'medium',
      },
    },
    
    optional_fields: [
      'tiers', 'tier_count', 'physical_reward_name',
      'cash_reward_amount', 'event_period',
    ],
    
    invariants: [
      {
        field: 'mode',
        condition: 'must_be',
        value: 'tier',
        error_message: 'COMPETITION mode must be tier',
        type: 'hard',
      },
      {
        field: 'tier_count',
        condition: 'must_exist',
        error_message: 'COMPETITION must have tier_count > 0',
        type: 'soft',  // Flag if missing, don't block
      },
    ],
    
    detection_cues: {
      positive_cues: [
        /tournament/i,
        /turnamen/i,
        /leaderboard/i,
        /event\s*turnover/i,
        /hadiah\s*(mobil|motor|hp)/i,
        /grand\s*prize/i,
        /juara\s*\d+/i,
      ],
      negative_cues: [
        /deposit\s*bonus/i,
        /cashback/i,
        /referral/i,
      ],
      disqualifiers: [
        /lucky\s*spin/i,
        /birthday/i,
        /apk\s*download/i,
      ],
    },
    
    applicable_fields: [
      'tiers', 'tier_count', 'physical_reward_name',
      'cash_reward_amount', 'event_period', 'trigger_event',
      'archetype_payload', 'archetype_invariants', 'turnover_basis',
    ],
    not_applicable_fields: [
      'calculation_value', 'min_deposit', 'turnover_multiplier',
      'referral_tiers', 'require_apk',
    ],
    payload_contract: {
      required_keys: ['event_period', 'prize_structure'],
      optional_keys: ['leaderboard_rules', 'reset_rules', 'claim_channels', 'notes'],
    },
  },

  // ============================================
  // LUCKY_DRAW (Lucky Spin, Gacha, Raffle)
  // ============================================
  LUCKY_DRAW: {
    archetype: 'LUCKY_DRAW',
    display_name: 'Lucky Draw / Spin',
    
    locked_fields: {
      mode: { value: 'fixed', reason: 'Chance-based rewards are not calculated' },
      calculation_basis: null,  // No calculation for chance
    },
    
    derived_fields: {
      trigger_event: {
        derive_from: 'evidence',
        allowed_values: ['Deposit', 'Event', 'Login'],
        default_if_missing: 'Event',
        confidence_if_missing: 'medium',
      },
    },
    
    optional_fields: [
      'lucky_spin_rewards', 'lucky_spin_max_per_day',
      'reward_quantity', 'claim_method',
    ],
    
    invariants: [
      {
        field: 'mode',
        condition: 'must_be',
        value: 'fixed',
        error_message: 'LUCKY_DRAW mode must be fixed (chance-based)',
        type: 'hard',
      },
      {
        field: 'calculation_basis',
        condition: 'must_not_exist',
        error_message: 'LUCKY_DRAW cannot have calculation_basis',
        type: 'hard',
      },
    ],
    
    detection_cues: {
      positive_cues: [
        /lucky\s*spin/i,
        /gacha/i,
        /raffle/i,
        /undian/i,
        /wheel/i,
        /free\s*spin/i,
        /tiket\s*spin/i,
      ],
      negative_cues: [
        /deposit\s*bonus/i,
        /cashback/i,
        /rollingan/i,
        /referral/i,
      ],
      disqualifiers: [
        /birthday/i,
        /apk\s*download/i,
        /withdraw\s*bonus/i,
      ],
    },
    
    applicable_fields: [
      'lucky_spin_rewards', 'lucky_spin_max_per_day',
      'reward_quantity', 'claim_method', 'min_deposit',
      'archetype_payload', 'archetype_invariants', 'turnover_basis',
    ],
    not_applicable_fields: [
      'calculation_basis', 'calculation_value', 'turnover_multiplier',
      'referral_tiers', 'payout_direction',
    ],
    payload_contract: {
      required_keys: ['daily_reset_time', 'claim_window', 'deposit_requirement', 'spin_limit', 'collection_mechanic'],
      optional_keys: ['claim_channels', 'notes'],
    },
  },

  // ============================================
  // ACCESS_REWARD (VIP, Level Up, Unlock)
  // ============================================
  ACCESS_REWARD: {
    archetype: 'ACCESS_REWARD',
    display_name: 'Access Reward (VIP/Level Up)',
    
    locked_fields: {
      // Mode depends on structure - can be fixed (single) or tier (multiple)
    },
    
    derived_fields: {
      mode: {
        derive_from: 'evidence',
        allowed_values: ['fixed', 'tier'],
        default_if_missing: 'fixed',
        confidence_if_missing: 'medium',
        ambiguity_flag: 'access_mode_unclear',
      },
      trigger_event: {
        derive_from: 'evidence',
        allowed_values: ['Level Up', 'VIP Unlock', 'Login'],
        default_if_missing: 'Level Up',
        confidence_if_missing: 'medium',
      },
    },
    
    optional_fields: [
      'tiers', 'tier_count', 'reward_amount',
      'min_calculation', 'special_requirements',
    ],
    
    invariants: [
      // No hard invariants - access rewards are flexible
    ],
    
    detection_cues: {
      positive_cues: [
        /level\s*up/i,
        /naik\s*level/i,
        /vip\s*bonus/i,
        /unlock\s*reward/i,
        /milestone/i,
      ],
      negative_cues: [
        /deposit\s*bonus/i,
        /cashback/i,
        /referral/i,
        /lucky\s*spin/i,
      ],
      disqualifiers: [
        /birthday/i,
        /apk\s*download/i,
        /withdraw\s*bonus/i,
      ],
    },
    
    applicable_fields: [
      'tiers', 'tier_count', 'reward_amount',
      'min_calculation', 'special_requirements', 'trigger_event',
    ],
    not_applicable_fields: [
      'calculation_basis', 'turnover_multiplier', 'referral_tiers',
      'require_apk', 'payout_direction',
    ],
  },

  // ============================================
  // UNKNOWN (Fallback - flag for review)
  // ============================================
  UNKNOWN: {
    archetype: 'UNKNOWN',
    display_name: 'Unknown (Perlu Review)',
    
    locked_fields: {},  // No locked fields
    
    derived_fields: {},  // No derived fields
    
    optional_fields: [],  // All fields optional
    
    invariants: [],  // No invariants
    
    detection_cues: {
      positive_cues: [],
      negative_cues: [],
      disqualifiers: [],
    },
    
    applicable_fields: [],
    not_applicable_fields: [],
  },
};

// ============================================
// TAXONOMY VERSION
// ============================================

export const TAXONOMY_VERSION = 'v1.0.0+2025-01-15 (LOCKED)';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get archetype rule by archetype type
 */
export function getArchetypeRule(archetype: PromoArchetype): ArchetypeSemanticRule {
  return ARCHETYPE_RULES[archetype];
}

/**
 * Get all archetype types (excluding UNKNOWN)
 */
export function getAllArchetypes(): PromoArchetype[] {
  return Object.keys(ARCHETYPE_RULES).filter(
    a => a !== 'UNKNOWN'
  ) as PromoArchetype[];
}

/**
 * Get display name for archetype
 */
export function getArchetypeDisplayName(archetype: PromoArchetype): string {
  return ARCHETYPE_RULES[archetype]?.display_name || archetype;
}

/**
 * Stable O(1) lookup for payload contract by archetype string.
 * Returns null if archetype not found or has no contract.
 */
export function getPayloadContract(archetype: string): { required_keys: string[]; optional_keys: string[] } | null {
  const rule = ARCHETYPE_RULES[archetype as PromoArchetype];
  return rule?.payload_contract ?? null;
}
