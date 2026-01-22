/**
 * sanitizeByMode() — Final Safety Net v1.3
 * 
 * ⚠️ FORBIDDEN: This file may NOT decide mode. ⚠️
 * Decision logic lives in promo-primitive-gate.ts ONLY.
 * This file only ENFORCES mode-field consistency.
 * 
 * ⚠️ TAXONOMY INTEGRATION v1.3 ⚠️
 * If _taxonomy_decision exists, this file is READ-ONLY for 5 inti fields.
 * Taxonomy is the Single Source of Truth (SSoT).
 * 
 * TUJUAN: Menghapus impossible state tanpa menebak promo.
 * 
 * ATURAN INTI:
 * 1. Mode menentukan dunia (event/fixed/tier ≠ formula fields)
 * 2. 0 ≠ unknown (0 adalah DATA CORRUPTION)
 * 3. Event ≠ calculation
 * 4. APK in terms/name → require_apk = true (CONSTRAINT only, not mode override)
 * 
 * PROMO PRIMITIVE GATE v1.2 INTEGRATION:
 * - APK is a CONSTRAINT, not mode determinant
 * - Mode is determined upstream by Primitive Gate
 * - This function only enforces mode-field consistency
 * - Invariant violations are LOGGED, not silently fixed
 * 
 * v1.3 CHANGES (TAXONOMY INTEGRATION):
 * - Added _taxonomy_decision check
 * - READ-ONLY mode for 5 inti fields when taxonomy has decided
 * - Still performs zero normalization (safe)
 * - Still performs category guarantee (safe)
 * 
 * v1.2 CHANGES:
 * - RELAXED: turnover fields NOT stripped for fixed mode
 *   (turnover can be withdrawal requirement, not calculation)
 * 
 * IDEMPOTENT: Panggil 1x atau 10x → hasil sama
 * UNIVERSAL: Berlaku untuk semua promo, sekarang dan masa depan
 */

// ============================================
// NON_FORMULA_MODES — Future-proof constant
// Modes that MUST NOT carry formula/calculation fields
// ============================================
export const NON_FORMULA_MODES = ['event', 'fixed', 'tier'] as const;
export type NonFormulaMode = typeof NON_FORMULA_MODES[number];

// ============================================
// TAXONOMY PROTECTED FIELDS
// These fields are READ-ONLY when taxonomy has decided
// ============================================
export const TAXONOMY_PROTECTED_FIELDS = [
  'mode',
  'reward_mode',
  'calculation_basis',
  'payout_direction',
  'trigger_event',
] as const;

// Production-safe logging: throttle to prevent log flood
let invariantViolationCount = 0;
const MAX_INVARIANT_LOGS = 10;

function logInvariantViolation(message: string, data?: Record<string, unknown>): void {
  if (invariantViolationCount < MAX_INVARIANT_LOGS) {
    console.error(`[sanitizeByMode] INVARIANT VIOLATION: ${message}`, data || '');
    invariantViolationCount++;
    
    if (invariantViolationCount === MAX_INVARIANT_LOGS) {
      console.warn('[sanitizeByMode] Max invariant logs reached. Further violations will be silent.');
    }
  }
}

// Reset counter (for testing purposes)
export function resetInvariantLogCounter(): void {
  invariantViolationCount = 0;
}

/**
 * sanitizeByMode — Final Safety Net
 * 
 * Mematikan impossible state berdasarkan mode.
 * Tidak menebak promo. Tidak keyword-driven.
 * 
 * TAXONOMY INTEGRATION (v1.3):
 * If _taxonomy_decision exists, this function is READ-ONLY for 5 inti fields.
 * Only performs safe normalization (zero → null, category guarantee).
 * 
 * @param promo - Promo data object (any shape)
 * @returns Sanitized promo data with impossible states removed
 */
export function sanitizeByMode(promo: Record<string, unknown>): Record<string, unknown> {
  const out = { ...promo };
  
  // ============================================
  // TAXONOMY GUARD: Check if taxonomy has decided
  // If yes, we are READ-ONLY for 5 inti fields
  // ============================================
  const hasTaxonomyDecision = out._taxonomy_decision !== undefined;
  
  if (hasTaxonomyDecision) {
    // ============================================
    // TAXONOMY PATH: READ-ONLY for protected fields
    // Only perform safe normalizations
    // ============================================
    
    // SAFE: Zero normalization (0 → null)
    if (out.reward_amount === 0) out.reward_amount = null;
    if (out.max_bonus === 0) out.max_bonus = null;
    if (out.fixed_cash_reward_amount === 0) out.fixed_cash_reward_amount = null;
    if (out.min_calculation === 0) out.min_calculation = null;
    
    // SAFE: Category guarantee for event mode
    const mode = (out.reward_mode || out.mode) as string;
    if (!out.category && mode === 'event') {
      out.category = 'REWARD';
    }
    
    // DO NOT: Strip formula fields based on mode
    // DO NOT: Override trigger_event based on APK keywords
    // DO NOT: Modify any of the 5 inti fields
    
    return out;
  }
  
  // ============================================
  // LEGACY PATH: No taxonomy decision (fallback)
  // Full sanitization logic applies
  // ============================================
  // Support both reward_mode (form) and mode (canonical export)
  const mode = (out.reward_mode || out.mode) as string;
  const promoName = String(out.promo_name || '').toLowerCase();
  const terms = String(out.custom_terms || '').toLowerCase();

  // ============================================
  // 1. MODE-BASED HARD STRIP
  // Event/Fixed/Tier MUST NOT carry formula ghosts
  // ============================================
  if (NON_FORMULA_MODES.includes(mode as NonFormulaMode)) {
    // Formula calculation fields → null/empty
    out.calculation_basis = null;
    out.calculation_base = '';
    out.calculation_method = '';
    out.calculation_value = null;
    out.min_calculation = null;
    out.min_calculation_enabled = false;
    out.conversion_formula = '';
    
    // ================================================================
    // v1.2: RELAXED — turnover fields NOT stripped for fixed mode
    // 
    // DESIGN NOTE: Fixed mode CAN have turnover requirement.
    // This is for WITHDRAWAL CONDITION, not CALCULATION BASIS.
    // 
    // Example: "Freechip APK, syarat TO 1x sebelum WD"
    // - mode = fixed (reward is given, not calculated)
    // - turnover_enabled = true (TO is withdrawal constraint)
    // 
    // Only strip turnover for EVENT mode (truly no turnover concept)
    // ================================================================
    if (mode === 'event') {
      out.turnover_enabled = false;
      out.turnover_rule_enabled = false;
      out.turnover_multiplier = null;
      out.turnover_rule = '';
      
      // Deposit constraint → null (not applicable for event mode)
      out.min_deposit = null;
    }
    // For 'fixed' and 'tier', preserve turnover fields (withdrawal requirement)
    
    // Fixed mode prefixed fields → null/empty (calculation-related only)
    out.fixed_calculation_base = '';
    out.fixed_calculation_value = null;
    out.fixed_min_calculation = null;
    out.fixed_min_calculation_enabled = false;
    
    // ✅ V1.2: Payout direction → null/disabled for event mode only
    // Fixed mode CAN have payout direction (for manual claim flow)
    if (mode === 'event') {
      out.payout_direction = null;
      out.global_payout_direction_enabled = false;
      out.global_payout_direction = '';
    }
  }

  // ============================================
  // 2. VALUE SHAPE NORMALIZATION
  // 0 is NOT "unknown" — 0 is DATA CORRUPTION
  // ============================================
  
  // reward_amount=0 → null (zero reward is semantically invalid)
  if (out.reward_amount === 0) {
    out.reward_amount = null;
  }
  
  // max_bonus=0 → null (0 is never a valid business value)
  if (out.max_bonus === 0) {
    out.max_bonus = null;
  }
  
  // fixed_cash_reward_amount=0 → null
  if (out.fixed_cash_reward_amount === 0) {
    out.fixed_cash_reward_amount = null;
  }
  
  // calculation_value=0 in non-formula mode → null
  if (out.calculation_value === 0 && mode !== 'formula') {
    out.calculation_value = null;
  }
  
  // min_calculation=0 → null (no threshold is null, not 0)
  if (out.min_calculation === 0) {
    out.min_calculation = null;
  }

  // ============================================
  // 3. PERCENTAGE CONSISTENCY
  // reward_is_percentage=false → cannot have percent unit
  // ============================================
  if (out.reward_is_percentage === false) {
    if (out.reward_unit === 'percent') {
      out.reward_unit = 'fixed';
    }
  }

  // ============================================
  // 4. EVENT SAFETY GUARD
  // Event unlimited+0 is ambiguous → make finite
  // ============================================
  if (mode === 'event') {
    if (out.max_claim_unlimited === true && out.max_claim === 0) {
      out.max_claim_unlimited = false;
      out.max_claim = 1;
    }
  }

  // ============================================
  // 5. APK CONSTRAINT NORMALIZATION (Safety Net)
  // 
  // PROMO PRIMITIVE GATE v1.1 PRINCIPLE:
  // - APK is a CONSTRAINT, not mode determinant
  // - Mode is determined by Primitive Gate (task_domain × reward_nature)
  // - This function only sets require_apk = true as a constraint
  // - We do NOT override mode here (APK promos CAN be formula mode)
  // ============================================
  const isApkContext = 
    terms.includes('apk') || 
    terms.includes('aplikasi') ||
    terms.includes('pengguna apk') ||
    terms.includes('khusus apk') ||
    promoName.includes('apk') || 
    promoName.includes('download') ||
    promoName.includes('aplikasi');
  
  if (isApkContext || out.require_apk === true) {
    // APK is CONSTRAINT only - set the flag
    out.require_apk = true;
    
    // For event/fixed mode APK promos: trigger MUST be 'APK Download'
    // For formula mode APK promos (e.g., "Cashback 5% khusus APK"), 
    // trigger might be different (Deposit, Loss, etc.)
    if (mode === 'event' || mode === 'fixed') {
      out.trigger_event = 'APK Download';
    }
    // NOTE: We do NOT force mode to 'event' for APK promos anymore
    // Mode is determined by Primitive Gate based on reward_nature
  }

  // ============================================
  // 6. CATEGORY GUARANTEE (Post-routing safety net)
  // Event promos without category default to REWARD
  // ============================================
  if (!out.category && mode === 'event') {
    out.category = 'REWARD';
  }

  // ============================================
  // 7. FINAL INVARIANT ASSERTION
  // ABSOLUTE LAW: event can never have calculation_basis
  // Force-null instead of throw (fail-safe for production)
  // ============================================
  if (mode === 'event' && out.calculation_basis !== null && out.calculation_basis !== '') {
    logInvariantViolation('event_with_calculation', {
      promo_name: out.promo_name,
      calculation_basis: out.calculation_basis,
    });
    
    // Force correction (fail-safe)
    out.calculation_basis = null;
    out.calculation_base = '';
  }

  return out;
}
