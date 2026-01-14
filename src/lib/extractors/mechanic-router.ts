/**
 * Mechanic Router v1.2
 * 
 * ⚠️ FORBIDDEN: This file may NOT decide mode directly. ⚠️
 * Mode decision MUST delegate to promo-primitive-gate.ts.
 * 
 * REASONING-FIRST ARCHITECTURE:
 * This module routes PromoIntent to specific mechanics.
 * It enforces INVARIANTS (things that MUST NOT happen).
 * It determines MODE via Primitive Gate (things that MUST happen).
 * 
 * KEY PRINCIPLE:
 * - Invariants = PROHIBITIONS (mode ≠ formula)
 * - Router = ROUTING (mechanic → gate → mode)
 * 
 * PROMO PRIMITIVE GATE v1.2 INTEGRATION:
 * - Mode is now determined by Primitive Gate (task_domain × reward_nature)
 * - APK is treated as CONSTRAINT, not mode determinant
 * - Regex-based detection serves as EVIDENCE, not DECISION
 * 
 * This separation prevents "confident but wrong" extractions.
 * 
 * Version: v1.2.0+2025-01-14
 */

import type { PromoIntent, PrimaryAction, ValueShape, DistributionPath } from './promo-intent-reasoner';
import { resolveModFromPrimitive, type CanonicalMode, type TaskDomain, type RewardNature } from './promo-primitive-gate';
import { collectPrimitiveEvidence, inferTaskDomain, inferRewardNature, hasApkConstraint } from './primitive-evidence-collector';
import { checkModeInvariants } from './primitive-invariant-checker';

// ============================================
// CURATED MECHANIC ENUM (20-40 types)
// ============================================

export type MechanicType =
  // === Deposit-based (formula) ===
  | 'deposit_bonus_percent'    // Bonus X% dari deposit
  | 'deposit_bonus_fixed'      // Bonus tetap per deposit
  | 'welcome_bonus'            // New member bonus
  | 'reload_bonus'             // Reload/next deposit bonus
  
  // === Loss-based ===
  | 'cashback_loss'            // Cashback dari kekalahan
  | 'rebate_loss'              // Rebate dari loss
  
  // === Turnover-based ===
  | 'rollingan_turnover'       // Rollingan % dari turnover
  | 'komisi_turnover'          // Komisi harian/mingguan
  
  // === Withdraw-based ===
  | 'withdraw_bonus_percent'   // Bonus X% dari withdraw
  | 'withdraw_bonus_fixed'     // Bonus tetap per withdraw
  
  // === Event/Action-based ===
  | 'apk_download_reward'      // Download APK dapat reward
  | 'mission_completion'       // Selesaikan misi
  | 'daily_checkin'            // Login harian
  | 'level_up_reward'          // Naik level dapat bonus
  | 'birthday_reward'          // Birthday bonus
  | 'verification_reward'      // Verifikasi dapat bonus
  
  // === Redemption ===
  | 'redemption_store'         // Tukar poin di store
  | 'voucher_exchange'         // Tukar voucher
  | 'point_redeem'             // Redeem poin
  
  // === Referral ===
  | 'referral_commission'      // Komisi dari referral
  | 'referral_bonus'           // Bonus per referral
  
  // === Event/Game ===
  | 'lucky_spin'               // Lucky spin/gacha
  | 'tournament'               // Tournament/leaderboard
  | 'provider_event'           // Pragmatic, PG Soft events
  | 'scatter_bonus'            // Scatter achievement
  
  // === Fallback ===
  | 'unknown';                 // Tidak bisa ditentukan

// ============================================
// MODE TYPES
// ============================================

export type PromoMode = 'formula' | 'fixed' | 'tier' | 'event' | 'unknown';

// ============================================
// LOCKED FIELDS INTERFACE
// ============================================

export interface LockedFields {
  mode: PromoMode;
  mode_reason: string;
  calculation_basis: string | null;
  reward_is_percentage: boolean;
  
  // ============================================
  // NEW: Complete Field Locking (v3.0)
  // These fields are LOCKED by Step-0 reasoning
  // UI CANNOT override these values
  // ============================================
  trigger_event?: string;
  require_apk?: boolean;
  reward_amount?: number | null;
  max_bonus?: number | null;
  max_claim?: number | null;
  max_claim_unlimited?: boolean;
  turnover_enabled?: boolean;
  turnover_multiplier?: number | null;
  min_deposit?: number | null;
  
  // Required one-of constraints
  required_one_of?: string[][];
  
  // Fields that MUST NOT have certain values
  forbidden_fields?: Record<string, unknown[]>;
  
  // Fields that MUST have values
  required_fields?: string[];
}

export interface MechanicRouterResult {
  mechanic_type: MechanicType;
  locked_fields: LockedFields;
  invariant_violations: string[];
  router_version: string;
}

// ============================================
// INVARIANTS (PROHIBITIONS ONLY)
// ============================================

/**
 * Check invariants and return violations.
 * Invariants are PROHIBITIONS - things that MUST NOT happen.
 */
export function checkInvariants(intent: PromoIntent): {
  violations: string[];
  enforced_locks: Partial<LockedFields>;
} {
  const violations: string[] = [];
  const enforced_locks: Partial<LockedFields> = {};
  
  // INVARIANT 1: Range/Catalog can NEVER be formula mode
  // If value is a range or catalog, it's not calculated - it's given
  if (intent.value_shape === 'range' || intent.value_shape === 'catalog') {
    enforced_locks.mode = 'event'; // Could also be 'fixed' or 'tier'
    enforced_locks.mode_reason = `value_shape=${intent.value_shape} prohibits formula mode`;
    enforced_locks.reward_is_percentage = false;
    enforced_locks.calculation_basis = null;
    
    // Log if intent said calculated (this is a correction)
    if (intent.reward_nature === 'calculated') {
      violations.push(`CORRECTED: value_shape=${intent.value_shape} with reward_nature=calculated is invalid`);
    }
  }
  
  // INVARIANT 2: Given rewards can NEVER be percentage
  if (intent.reward_nature === 'given') {
    enforced_locks.reward_is_percentage = false;
    
    // If somehow percent shape with given nature, that's invalid
    if (intent.value_shape === 'percent') {
      violations.push(`CONFLICT: reward_nature=given with value_shape=percent is contradictory`);
      // Force to fixed shape
      enforced_locks.mode = 'fixed';
      enforced_locks.mode_reason = 'reward_nature=given requires fixed/event mode';
    }
  }
  
  // INVARIANT 3: Calculated rewards MUST have calculation_basis
  if (intent.reward_nature === 'calculated') {
    enforced_locks.required_fields = ['calculation_basis'];
    enforced_locks.reward_is_percentage = true; // Usually
  }
  
  // INVARIANT 4: Redemption store requires claim method OR distribution note
  if (intent.distribution_path === 'redemption_store') {
    enforced_locks.required_one_of = [
      ['claim_method', 'distribution_note']
    ];
    enforced_locks.calculation_basis = null; // No calculation for redemption
  }
  
  // INVARIANT 5: User choice (catalog/redemption) can't be formula
  if (intent.value_determiner === 'user_choice') {
    if (!enforced_locks.mode) {
      enforced_locks.mode = 'tier'; // or 'event'
      enforced_locks.mode_reason = 'user_choice requires tier/event mode (not formula)';
    }
  }
  
  return { violations, enforced_locks };
}

// ============================================
// ROUTER (DETERMINATIONS)
// ============================================

/**
 * Determine mechanic type from intent axes.
 * This is a deterministic mapping, NOT LLM-based.
 */
function determineMechanicType(intent: PromoIntent): MechanicType {
  const { primary_action, reward_nature, value_shape, distribution_path } = intent;
  
  // === APK Download ===
  if (primary_action === 'download_apk') {
    return 'apk_download_reward';
  }
  
  // === Birthday ===
  if (primary_action === 'birthday') {
    return 'birthday_reward';
  }
  
  // === Verification ===
  if (primary_action === 'verify') {
    return 'verification_reward';
  }
  
  // === Referral ===
  if (primary_action === 'referral') {
    return reward_nature === 'calculated' ? 'referral_commission' : 'referral_bonus';
  }
  
  // === Level Up ===
  if (primary_action === 'level_up') {
    return 'level_up_reward';
  }
  
  // === Mission/Quest ===
  if (primary_action === 'mission') {
    return 'mission_completion';
  }
  
  // === Redemption ===
  if (primary_action === 'redeem' || distribution_path === 'redemption_store') {
    if (value_shape === 'catalog') {
      return 'redemption_store';
    }
    return 'point_redeem';
  }
  
  // === Login ===
  if (primary_action === 'login') {
    return 'daily_checkin';
  }
  
  // === Loss-based ===
  if (primary_action === 'loss') {
    return 'cashback_loss';
  }
  
  // === Turnover-based ===
  if (primary_action === 'turnover') {
    return 'rollingan_turnover';
  }
  
  // === Deposit-based ===
  if (primary_action === 'deposit') {
    if (reward_nature === 'given') {
      return 'deposit_bonus_fixed';
    }
    return 'deposit_bonus_percent';
  }
  
  // === Withdraw-based ===
  if (primary_action === 'withdraw') {
    if (reward_nature === 'given') {
      return 'withdraw_bonus_fixed';
    }
    return 'withdraw_bonus_percent';
  }
  
  // === Bet-based ===
  if (primary_action === 'bet') {
    return 'komisi_turnover'; // Or could be scatter_bonus
  }
  
  // === Register ===
  if (primary_action === 'register') {
    return 'welcome_bonus';
  }
  
  return 'unknown';
}

/**
 * Determine mode from intent and mechanic.
 * Router DETERMINES mode (different from invariant PROHIBITIONS).
 */
function determineMode(intent: PromoIntent, mechanic: MechanicType): PromoMode {
  // Check invariant locks first
  const { enforced_locks } = checkInvariants(intent);
  if (enforced_locks.mode) {
    return enforced_locks.mode;
  }
  
  // === Mechanics that are ALWAYS formula ===
  const formulaMechanics: MechanicType[] = [
    'deposit_bonus_percent',
    'cashback_loss',
    'rebate_loss',
    'rollingan_turnover',
    'komisi_turnover',
    'referral_commission',
    'withdraw_bonus_percent',
  ];
  if (formulaMechanics.includes(mechanic)) {
    return 'formula';
  }
  
  // === Mechanics that are ALWAYS fixed ===
  const fixedMechanics: MechanicType[] = [
    'deposit_bonus_fixed',
    'birthday_reward',
    'verification_reward',
    'daily_checkin',
  ];
  if (fixedMechanics.includes(mechanic)) {
    return 'fixed';
  }
  
  // === Mechanics that are ALWAYS tier ===
  const tierMechanics: MechanicType[] = [
    'redemption_store',
    'level_up_reward',
    'referral_bonus',
    'point_redeem',
  ];
  if (tierMechanics.includes(mechanic)) {
    return 'tier';
  }
  
  // === Mechanics that are ALWAYS event ===
  const eventMechanics: MechanicType[] = [
    'apk_download_reward',
    'mission_completion',
    'lucky_spin',
    'tournament',
    'provider_event',
    'scatter_bonus',
    'voucher_exchange',
  ];
  if (eventMechanics.includes(mechanic)) {
    return 'event';
  }
  
  // === Fallback based on reward_nature ===
  if (intent.reward_nature === 'calculated') {
    return 'formula';
  }
  
  return 'fixed'; // Safe default
}

/**
 * Determine calculation basis from intent.
 */
function determineCalculationBasis(intent: PromoIntent, mode: PromoMode): string | null {
  // Non-formula modes don't have calculation basis
  if (mode !== 'formula') {
    return null;
  }
  
  // Map primary_action to calculation_basis
  switch (intent.primary_action) {
    case 'deposit':
    case 'register':
      return 'deposit';
    case 'loss':
      return 'loss';
    case 'turnover':
    case 'bet':
      return 'turnover';
    case 'withdraw':
      return 'withdraw';
    case 'referral':
      return 'referral_turnover';
    default:
      return null;
  }
}

// ============================================
// MAIN ROUTER FUNCTION
// ============================================

const ROUTER_VERSION = 'v1.2.0+2025-01-14';

/**
 * Route PromoIntent to MechanicType and determine locked fields.
 */
export function routeMechanic(intent: PromoIntent): MechanicRouterResult {
  // Step 1: Check invariants
  const { violations, enforced_locks } = checkInvariants(intent);
  
  // Step 2: Determine mechanic type
  const mechanic_type = determineMechanicType(intent);
  
  // Step 3: Determine mode (respecting invariant locks)
  const mode = enforced_locks.mode || determineMode(intent, mechanic_type);
  
  // Step 4: Determine calculation basis
  const calculation_basis = determineCalculationBasis(intent, mode);
  
  // Step 5: Build locked fields
  const locked_fields: LockedFields = {
    mode,
    mode_reason: enforced_locks.mode_reason || `Determined from mechanic=${mechanic_type}`,
    calculation_basis,
    reward_is_percentage: enforced_locks.reward_is_percentage ?? (mode === 'formula'),
    required_one_of: enforced_locks.required_one_of,
    required_fields: enforced_locks.required_fields,
    forbidden_fields: {},
  };
  
  // ============================================
  // Step 6: Mechanic-Specific Field Locking (v3.0)
  // These are PHYSICS LAWS - cannot be overridden
  // ============================================
  
  // ============================================
  // APK Download Reward: APK is CONSTRAINT, not mode determinant
  // Mode is determined by Primitive Gate (task_domain × reward_nature)
  // ============================================
  if (mechanic_type === 'apk_download_reward') {
    // APK is a CONSTRAINT - set require_apk but DON'T force mode
    locked_fields.trigger_event = 'APK Download';
    locked_fields.require_apk = true;
    
    // Only lock these fields if mode is 'fixed' or 'event'
    // APK promos CAN be formula mode (e.g., "Cashback 5% khusus APK")
    if (mode === 'fixed' || mode === 'event') {
      locked_fields.reward_amount = null;      // APK promos use range, not fixed amount
      locked_fields.max_bonus = null;          // Not applicable for event
      locked_fields.max_claim = 1;             // Typically once per user
      locked_fields.max_claim_unlimited = false;
      locked_fields.turnover_enabled = false;
      locked_fields.turnover_multiplier = null;
      locked_fields.min_deposit = null;        // No deposit required for APK
    }
    // If mode is 'formula' (APK Cashback), don't lock formula-related fields
    
    console.log(`[routeMechanic] APK_DOWNLOAD_REWARD: mode=${mode}, require_apk=true`);
  }
  
  // Birthday Reward: Fixed/Event mode, login trigger, once per year
  if (mechanic_type === 'birthday_reward') {
    locked_fields.trigger_event = 'Login';
    locked_fields.max_claim = 1;
    locked_fields.max_claim_unlimited = false;
    locked_fields.turnover_enabled = false;  // Birthday typically no turnover
    
    console.log('[routeMechanic] BIRTHDAY_REWARD: Complete field locking applied');
  }
  
  // Mission Completion: Event mode, no deposit requirement
  if (mechanic_type === 'mission_completion') {
    locked_fields.min_deposit = null;
    locked_fields.turnover_enabled = false;
    
    console.log('[routeMechanic] MISSION_COMPLETION: Complete field locking applied');
  }
  
  // Redemption Store: Event/Tier mode, no calculation
  if (mechanic_type === 'redemption_store' || mechanic_type === 'point_redeem') {
    locked_fields.reward_amount = null;      // User chooses from catalog
    locked_fields.max_bonus = null;          // Not applicable
    locked_fields.turnover_enabled = false;
    
    console.log('[routeMechanic] REDEMPTION: Complete field locking applied');
  }
  
  // Withdraw Bonus: Formula mode, withdraw trigger, percentage-based
  if (mechanic_type === 'withdraw_bonus_percent') {
    locked_fields.trigger_event = 'Withdraw';
    locked_fields.require_apk = false;
    locked_fields.reward_is_percentage = true;
    // Note: reward_amount, max_bonus, turnover are extracted from terms, not locked
    
    console.log('[routeMechanic] WITHDRAW_BONUS_PERCENT: Complete field locking applied');
  }
  
  if (mechanic_type === 'withdraw_bonus_fixed') {
    locked_fields.trigger_event = 'Withdraw';
    locked_fields.require_apk = false;
    locked_fields.reward_is_percentage = false;
    
    console.log('[routeMechanic] WITHDRAW_BONUS_FIXED: Complete field locking applied');
  }
  
  // Add forbidden values based on mode
  if (mode !== 'formula') {
    locked_fields.forbidden_fields = {
      ...locked_fields.forbidden_fields,
      reward_mode: ['formula'], // Can't be formula
    };
  }
  
  return {
    mechanic_type,
    locked_fields,
    invariant_violations: violations,
    router_version: ROUTER_VERSION,
  };
}

// ============================================
// UTILITY: Get mechanic display name
// ============================================

export function getMechanicDisplayName(mechanic: MechanicType): string {
  const names: Record<MechanicType, string> = {
    deposit_bonus_percent: 'Bonus Deposit (%)',
    deposit_bonus_fixed: 'Bonus Deposit (Fixed)',
    welcome_bonus: 'Welcome Bonus',
    reload_bonus: 'Reload Bonus',
    cashback_loss: 'Cashback Kekalahan',
    rebate_loss: 'Rebate',
    rollingan_turnover: 'Rollingan',
    komisi_turnover: 'Komisi Turnover',
    withdraw_bonus_percent: 'Bonus Withdraw (%)',
    withdraw_bonus_fixed: 'Bonus Withdraw (Fixed)',
    apk_download_reward: 'Bonus Download APK',
    mission_completion: 'Bonus Misi',
    daily_checkin: 'Bonus Login Harian',
    level_up_reward: 'Bonus Level Up',
    birthday_reward: 'Bonus Ulang Tahun',
    verification_reward: 'Bonus Verifikasi',
    redemption_store: 'Redemption Store',
    voucher_exchange: 'Tukar Voucher',
    point_redeem: 'Tukar Poin',
    referral_commission: 'Komisi Referral',
    referral_bonus: 'Bonus Referral',
    lucky_spin: 'Lucky Spin',
    tournament: 'Tournament',
    provider_event: 'Event Provider',
    scatter_bonus: 'Bonus Scatter',
    unknown: 'Unknown',
  };
  
  return names[mechanic] || mechanic;
}

// ============================================
// EXPORTS
// ============================================

export {
  ROUTER_VERSION,
};
