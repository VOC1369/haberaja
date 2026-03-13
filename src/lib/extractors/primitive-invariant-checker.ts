/**
 * INVARIANT CHECKER v1.2 — CLEAN-ROOM READY
 * System-level assertion untuk mode-field consistency
 * 
 * ⚠️ FORBIDDEN: This file may NOT decide mode. ⚠️
 * Decision logic lives in promo-primitive-gate.ts ONLY.
 * 
 * PRINSIP: Jika gagal → THROW + LOG, bukan silent fix.
 * Ini bukan validasi UI, ini SYSTEM INVARIANT.
 * 
 * v1.2 CHANGES:
 * - RELAXED: Fixed mode CAN have turnover_enabled=true
 *   (for withdrawal requirement, NOT calculation basis)
 * - ADDED: Comment explaining TO for withdrawal vs calculation
 * 
 * PENGUATAN #3 dari arsitektur PROMO PRIMITIVE GATE v1.2
 * 
 * VERSION: v1.2.0+2025-01-14
 */

// ============================================
// INVARIANT CHECK RESULT
// ============================================

export interface InvariantCheckResult {
  valid: boolean;
  violations: string[];
}

// Production-safe logging: throttle to prevent log flood
let invariantViolationCount = 0;
const MAX_INVARIANT_LOGS = 20;

function logInvariantError(message: string): void {
  if (invariantViolationCount < MAX_INVARIANT_LOGS) {
    console.error(`[INVARIANT_CHECKER] ${message}`);
    invariantViolationCount++;
    
    if (invariantViolationCount === MAX_INVARIANT_LOGS) {
      console.warn('[INVARIANT_CHECKER] Max invariant logs reached. Further violations will be silent.');
    }
  }
}

// Reset counter (for testing purposes)
export function resetInvariantLogCounter(): void {
  invariantViolationCount = 0;
}

// ============================================
// MAIN INVARIANT CHECKER
// ============================================

/**
 * checkModeInvariants
 * 
 * Checks that mode-field combinations are logically consistent.
 * These are PHYSICS LAWS - violations indicate a bug, not user error.
 * 
 * INVARIANT RULES:
 * 
 * FIXED/EVENT MODE:
 * - calculation_basis MUST be null
 * - turnover_enabled MUST be false
 * - tier_count MUST be 0
 * 
 * FORMULA MODE:
 * - calculation_basis MUST NOT be null
 * - tier_count MUST be 0
 * 
 * TIER MODE:
 * - tier_count MUST be > 0
 * - subcategories OR tiers array MUST have items
 */
export function checkModeInvariants(
  mode: string,
  fields: Record<string, unknown>
): InvariantCheckResult {
  const violations: string[] = [];
  
  // Normalize mode (handle 'event' as alias for 'fixed')
  const normalizedMode = mode === 'event' ? 'fixed' : mode;
  
  // ====================================
  // FIXED MODE INVARIANTS
  // ====================================
  if (normalizedMode === 'fixed') {
    // calculation_basis MUST be null or empty
    // Fixed mode = no formula calculation
    if (fields.calculation_basis !== null && 
        fields.calculation_basis !== '' && 
        fields.calculation_basis !== undefined) {
      violations.push(
        `INVARIANT_VIOLATION: mode=${mode} MUST have calculation_basis=null, ` +
        `got "${fields.calculation_basis}"`
      );
    }
    
    // ================================================================
    // v1.2: RELAXED — turnover_enabled is ALLOWED for fixed mode
    // 
    // DESIGN NOTE: Fixed mode CAN have turnover requirement.
    // This is for WITHDRAWAL CONDITION, not CALCULATION BASIS.
    // 
    // Example: "Freechip APK, syarat TO 1x sebelum WD"
    // - mode = fixed (reward is given, not calculated)
    // - turnover_enabled = true (TO is withdrawal constraint)
    // - calculation_basis = null (no formula)
    // 
    // Semantic distinction:
    // - turnover for CALCULATION: mode MUST be formula
    // - turnover for WITHDRAWAL: mode can be fixed/event
    // 
    // Future consideration: Add withdrawal_turnover_required field
    // to semantically separate calculation vs withdrawal turnover.
    // ================================================================
    // REMOVED: turnover_enabled check for fixed mode
    
    // tier_count MUST be 0
    if (typeof fields.tier_count === 'number' && fields.tier_count > 0) {
      violations.push(
        `INVARIANT_VIOLATION: mode=${mode} MUST have tier_count=0, got ${fields.tier_count}`
      );
    }
  }
  
  // ====================================
  // FORMULA MODE INVARIANTS
  // ====================================
  if (normalizedMode === 'formula') {
    // calculation_basis MUST exist
    if (fields.calculation_basis === null || 
        fields.calculation_basis === '' || 
        fields.calculation_basis === undefined) {
      violations.push(
        `INVARIANT_VIOLATION: mode=formula MUST have calculation_basis, got null/empty`
      );
    }
    
    // tier_count MUST be 0
    if (typeof fields.tier_count === 'number' && fields.tier_count > 0) {
      violations.push(
        `INVARIANT_VIOLATION: mode=formula MUST have tier_count=0, got ${fields.tier_count}`
      );
    }
  }
  
  // ====================================
  // TIER MODE INVARIANTS
  // ====================================
  if (normalizedMode === 'tier') {
    // tier_count MUST be > 0
    if (typeof fields.tier_count === 'number' && fields.tier_count === 0) {
      violations.push(
        `INVARIANT_VIOLATION: mode=tier MUST have tier_count>0, got 0`
      );
    }
    
    // subcategories OR tiers array MUST have items
    const subcategories = fields.subcategories as unknown[] | undefined;
    const tiers = fields.tiers as unknown[] | undefined;
    const referral_tiers = fields.referral_tiers as unknown[] | undefined;
    
    const hasSubcategories = subcategories && subcategories.length > 0;
    const hasTiers = tiers && tiers.length > 0;
    const hasReferralTiers = referral_tiers && referral_tiers.length > 0;
    
    if (!hasSubcategories && !hasTiers && !hasReferralTiers) {
      violations.push(
        `INVARIANT_VIOLATION: mode=tier MUST have subcategories, tiers, or referral_tiers array with items`
      );
    }
  }
  
  return {
    valid: violations.length === 0,
    violations
  };
}

// ============================================
// ASSERTION MODE (throws in development)
// ============================================

/**
 * assertModeInvariants
 * 
 * Use in development/testing to catch invariant violations early.
 * In production, logs errors but doesn't throw.
 * 
 * @param mode - The canonical mode
 * @param fields - The promo data fields
 * @param context - Optional context string for logging
 */
export function assertModeInvariants(
  mode: string,
  fields: Record<string, unknown>,
  context?: string
): void {
  const result = checkModeInvariants(mode, fields);
  
  if (!result.valid) {
    const errorMessage = result.violations.join('\n');
    const contextStr = context ? ` (${context})` : '';
    
    logInvariantError(`${contextStr}\n${errorMessage}`);
    
    // In development: throw to surface issues early
    // Check for Vite DEV flag (browser-safe, no process dependency)
    const isDevelopment = import.meta.env?.DEV === true;
    
    if (isDevelopment) {
      throw new Error(`Invariant assertion failed${contextStr}:\n${errorMessage}`);
    }
  }
}

// ============================================
// INVARIANT FIXER (Production Fallback)
// ============================================

/**
 * fixInvariantViolations
 * 
 * Attempts to fix invariant violations by nullifying conflicting fields.
 * This is a LAST RESORT - violations should be prevented upstream.
 * 
 * Returns the fixed fields and logs what was changed.
 */
export function fixInvariantViolations(
  mode: string,
  fields: Record<string, unknown>
): Record<string, unknown> {
  const fixed = { ...fields };
  const normalizedMode = mode === 'event' ? 'fixed' : mode;
  
  // ====================================
  // FIX FIXED MODE VIOLATIONS
  // ====================================
  if (normalizedMode === 'fixed') {
    if (fixed.calculation_basis !== null && fixed.calculation_basis !== '') {
      logInvariantError(`AUTO_FIX: Nullifying calculation_basis for mode=${mode}`);
      fixed.calculation_basis = null;
    }
    
    if (fixed.turnover_enabled === true) {
      logInvariantError(`AUTO_FIX: Setting turnover_enabled=false for mode=${mode}`);
      fixed.turnover_enabled = false;
    }
    
    if (typeof fixed.tier_count === 'number' && fixed.tier_count > 0) {
      logInvariantError(`AUTO_FIX: Setting tier_count=0 for mode=${mode}`);
      fixed.tier_count = 0;
    }
  }
  
  // ====================================
  // FIX FORMULA MODE VIOLATIONS
  // ====================================
  if (normalizedMode === 'formula') {
    if (typeof fixed.tier_count === 'number' && fixed.tier_count > 0) {
      logInvariantError(`AUTO_FIX: Setting tier_count=0 for mode=formula`);
      fixed.tier_count = 0;
    }
    // Note: We can't auto-fix missing calculation_basis - that requires knowledge
  }
  
  // Note: Tier mode violations require human intervention (adding tiers)
  
  return fixed;
}

// ============================================
// GATE ASSERTION (v1.2.1 — FAIL-LOUD)
// ============================================

/**
 * assertModeFromGate
 * 
 * Ensures mode-calculation_basis consistency after Gate decision.
 * FAIL-LOUD: Throws in development if impossible state detected.
 * 
 * IMPOSSIBLE STATES:
 * - mode=formula + calculation_basis empty → THROW
 * - mode=fixed/event + calculation_basis present → THROW
 */
export function assertModeFromGate(
  mode: string,
  calculation_basis: string | null | undefined,
  source: string
): void {
  // Normalize mode
  const normalizedMode = mode === 'event' ? 'fixed' : mode;
  
  // IMPOSSIBLE STATE: formula without basis
  if (normalizedMode === 'formula' && (!calculation_basis || calculation_basis === '')) {
    const error = `[INVARIANT VIOLATION] ${source}: mode=formula but calculation_basis is empty. IMPOSSIBLE STATE.`;
    console.error(error);
    
    const isDevelopment = typeof process !== 'undefined' && 
      process.env?.NODE_ENV === 'development';
    
    if (isDevelopment) {
      throw new Error(error);
    }
  }
  
  // IMPOSSIBLE STATE: fixed/event with basis
  if (normalizedMode === 'fixed' && calculation_basis && calculation_basis !== '') {
    const error = `[INVARIANT VIOLATION] ${source}: mode=${mode} but calculation_basis=${calculation_basis}. IMPOSSIBLE STATE.`;
    console.error(error);
    
    const isDevelopment = typeof process !== 'undefined' && 
      process.env?.NODE_ENV === 'development';
    
    if (isDevelopment) {
      throw new Error(error);
    }
  }
}

// ============================================
// VERSION
// ============================================

export const INVARIANT_CHECKER_VERSION = 'v1.2.1+2025-01-14';
