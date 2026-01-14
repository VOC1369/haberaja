/**
 * PROMO PRIMITIVE GATE v1.2 — CLEAN-ROOM READY
 * Single Source of Truth untuk Mode Decision
 * 
 * ⚠️ THIS IS THE ONLY FILE THAT DECIDES MODE ⚠️
 * All other files must import and use resolveModFromPrimitive()
 * 
 * PRINSIP: Mode ditentukan oleh LOGIKA (task_domain + reward_nature),
 * BUKAN keyword. Regex hanya sebagai EVIDENCE.
 * 
 * ARCHITECTURE:
 * - Evidence Collector → gathers hints (regex)
 * - Primitive Gate → decides mode (logic) ← YOU ARE HERE
 * - Invariant Checker → enforces consistency (assertion)
 * 
 * DECISION TABLE COVERAGE: 20/20 (100%)
 * - 17 explicit rules
 * - 3 via early returns (chance, tiered, default)
 * 
 * VERSION: v1.2.0+2025-01-14
 */

// ============================================
// TASK TYPES
// ============================================

export type TaskType = 'action' | 'moment' | 'state';

// ============================================
// TASK DOMAIN (Penguatan #1: +access)
// ============================================

/**
 * task_domain represents the SEMANTIC CONTEXT of the trigger.
 * 
 * - platform: Install, download, register (platform access)
 * - financial: Deposit, withdraw, turnover, loss (money movement)
 * - gameplay: Bet, spin, scatter, win (game actions)
 * - temporal: Birthday, anniversary, daily (time-based)
 * - access: VIP unlock, room access, privilege (permission changes)
 */
export type TaskDomain = 
  | 'platform'   // Install, download, register
  | 'financial'  // Deposit, withdraw, turnover, loss
  | 'gameplay'   // Bet, spin, scatter, win
  | 'temporal'   // Birthday, anniversary, daily
  | 'access';    // VIP unlock, room access, privilege, redemption store

// ============================================
// REWARD NATURE (Penguatan #2: +chance)
// ============================================

/**
 * reward_nature represents HOW the reward value is determined.
 * 
 * - fixed: Nilai tetap, tidak dihitung
 * - calculated: Hasil perhitungan (%, dari basis)
 * - tiered: Berbeda per threshold
 * - chance: Non-deterministik (lucky spin, raffle, lottery)
 */
export type RewardNature = 
  | 'fixed'      // Nilai tetap, tidak dihitung
  | 'calculated' // Hasil perhitungan (%, dari basis)
  | 'tiered'     // Berbeda per threshold
  | 'chance';    // Non-deterministik (lucky spin, raffle, lottery)

// ============================================
// CANONICAL MODE
// ============================================

/**
 * CanonicalMode is the SINGLE source of truth for mode naming.
 * 
 * Mapping:
 * - 'fixed' = event, instant (UI alias)
 * - 'formula' = dinamis (UI alias)
 * - 'tier' = tier
 */
export type CanonicalMode = 'fixed' | 'formula' | 'tier';

// ============================================
// PROMO PRIMITIVE INTERFACE
// ============================================

export interface PromoPrimitive {
  task_type: TaskType;
  task_domain: TaskDomain;
  state_change: string;
  reward_nature: RewardNature;
}

// ============================================
// PRIMITIVE GATE RESULT
// ============================================

export interface PrimitiveGateResult {
  mode: CanonicalMode;
  constraints: {
    require_apk?: boolean;
    trigger_event?: string;
  };
  reasoning: string;
}

// ============================================
// HARD MAPPING - Tidak Ada Keyword
// Ini adalah DECISION TABLE yang locked.
// ============================================

/**
 * resolveModFromPrimitive
 * 
 * THE BRAIN OF THE GATE.
 * Maps task_domain × reward_nature → mode.
 * 
 * DECISION TABLE:
 * | task_domain | reward_nature | → mode   | Example |
 * |-------------|---------------|----------|---------|
 * | platform    | fixed         | fixed    | APK Freechip |
 * | platform    | calculated    | formula  | APK Cashback 5% |
 * | financial   | fixed         | fixed    | Bonus Deposit 50rb |
 * | financial   | calculated    | formula  | Bonus Deposit 10% |
 * | financial   | tiered        | tier     | Event Turnover Mobil |
 * | gameplay    | calculated    | formula  | Rollingan 0.5% |
 * | temporal    | fixed         | fixed    | Birthday Bonus |
 * | access      | fixed         | fixed    | VIP Unlock Reward |
 * | access      | tiered        | tier     | VIP Level Up Tiers |
 * | any         | chance        | fixed    | Lucky Spin, Raffle |
 */
export function resolveModFromPrimitive(primitive: PromoPrimitive): PrimitiveGateResult {
  const { task_domain, reward_nature } = primitive;
  
  // ====================================
  // RULE 0: CHANCE → Always fixed
  // Lucky spin, raffle, lottery = no calculation
  // Non-deterministic rewards are not calculated
  // ====================================
  if (reward_nature === 'chance') {
    return {
      mode: 'fixed',
      constraints: {},
      reasoning: 'reward_nature=chance → mode=fixed (non-deterministic reward)'
    };
  }
  
  // ====================================
  // RULE 1: TIERED → Always tier mode
  // Multiple thresholds = tier structure
  // ====================================
  if (reward_nature === 'tiered') {
    return {
      mode: 'tier',
      constraints: {},
      reasoning: 'reward_nature=tiered → mode=tier'
    };
  }
  
  // ====================================
  // RULE 2: FINANCIAL + CALCULATED → formula
  // Deposit %, Cashback %, WD %, Rollingan
  // Money-based calculations = formula mode
  // ====================================
  if (task_domain === 'financial' && reward_nature === 'calculated') {
    return {
      mode: 'formula',
      constraints: {},
      reasoning: 'task_domain=financial + reward_nature=calculated → mode=formula'
    };
  }
  
  // ====================================
  // RULE 2B: FINANCIAL + FIXED → fixed (EXPLICIT v1.2)
  // Bonus Deposit 50rb (fixed amount, not %)
  // Freechip WD 10rb (fixed amount)
  // Cashback 100rb flat (not calculated)
  // ====================================
  if (task_domain === 'financial' && reward_nature === 'fixed') {
    return {
      mode: 'fixed',
      constraints: {},
      reasoning: 'task_domain=financial + reward_nature=fixed → mode=fixed (EXPLICIT: not fallback)'
    };
  }
  
  // ====================================
  // RULE 3: PLATFORM + FIXED → fixed
  // APK Download, Install, Register bonus
  // Platform actions with fixed rewards
  // ====================================
  if (task_domain === 'platform' && reward_nature === 'fixed') {
    return {
      mode: 'fixed',
      constraints: {},
      reasoning: 'task_domain=platform + reward_nature=fixed → mode=fixed'
    };
  }
  
  // ====================================
  // RULE 3B: PLATFORM + CALCULATED → formula
  // APK Cashback 5% (calculated on deposit/loss)
  // Platform constraint with financial calculation
  // ====================================
  if (task_domain === 'platform' && reward_nature === 'calculated') {
    return {
      mode: 'formula',
      constraints: {},
      reasoning: 'task_domain=platform + reward_nature=calculated → mode=formula'
    };
  }
  
  // ====================================
  // RULE 4: TEMPORAL + FIXED → fixed
  // Birthday, Anniversary, Daily
  // Time-based rewards are usually fixed
  // ====================================
  if (task_domain === 'temporal' && reward_nature === 'fixed') {
    return {
      mode: 'fixed',
      constraints: {},
      reasoning: 'task_domain=temporal + reward_nature=fixed → mode=fixed'
    };
  }
  
  // ====================================
  // RULE 4B: TEMPORAL + CALCULATED → formula
  // Anniversary cashback, birthday % bonus
  // ====================================
  if (task_domain === 'temporal' && reward_nature === 'calculated') {
    return {
      mode: 'formula',
      constraints: {},
      reasoning: 'task_domain=temporal + reward_nature=calculated → mode=formula'
    };
  }
  
  // ====================================
  // RULE 5: ACCESS + ANY → depends on reward_nature
  // VIP level, room unlock, privilege
  // ====================================
  if (task_domain === 'access') {
    if (reward_nature === 'calculated') {
      return {
        mode: 'formula',
        constraints: {},
        reasoning: 'task_domain=access + reward_nature=calculated → mode=formula'
      };
    }
    return {
      mode: 'fixed',
      constraints: {},
      reasoning: 'task_domain=access + reward_nature=fixed → mode=fixed'
    };
  }
  
  // ====================================
  // RULE 6: GAMEPLAY + ANY
  // Bet bonus, scatter, tournament
  // ====================================
  if (task_domain === 'gameplay') {
    if (reward_nature === 'calculated') {
      return {
        mode: 'formula',
        constraints: {},
        reasoning: 'task_domain=gameplay + reward_nature=calculated → mode=formula'
      };
    }
    return {
      mode: 'fixed',
      constraints: {},
      reasoning: 'task_domain=gameplay + reward_nature=fixed → mode=fixed'
    };
  }
  
  // ====================================
  // DEFAULT: Fixed (conservative fallback)
  // When in doubt, don't assume calculation
  // ====================================
  return {
    mode: 'fixed',
    constraints: {},
    reasoning: 'Default fallback to fixed mode'
  };
}

// ============================================
// CANONICAL MODE CONSTANTS
// ============================================

export const MODE_CANONICAL = {
  FIXED: 'fixed',
  FORMULA: 'formula',
  TIER: 'tier',
} as const;

// ============================================
// UI DISPLAY NAMES (for display only)
// ============================================

export const MODE_DISPLAY: Record<CanonicalMode, string> = {
  'fixed': 'Fixed / Event',
  'formula': 'Dinamis',
  'tier': 'Tier',
};

// ============================================
// VERSION
// ============================================

export const PRIMITIVE_GATE_VERSION = 'v1.2.0+2025-01-14';
