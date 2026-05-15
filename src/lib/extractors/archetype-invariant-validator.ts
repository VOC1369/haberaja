/**
 * ARCHETYPE INVARIANT VALIDATOR v1.0
 * 
 * ARCHITECTURAL LOCK #3:
 * Invariant conflict → UNKNOWN (not throw), except impossible state
 * 
 * TWO LEVELS OF VALIDATION:
 * 1. IMPOSSIBLE_STATES → throw Error (schema-level violations)
 * 2. MISCLASSIFICATION_CONFLICTS → downgrade to UNKNOWN (archetype violations)
 * 
 * VERSION: v1.0.0+2025-01-15 (LOCKED)
 */

import { PromoArchetype, ARCHETYPE_RULES, getArchetypeRule } from './promo-taxonomy';
import type { CanonicalMode } from './promo-primitive-gate';

// ============================================
// VALIDATION RESULT TYPES
// ============================================

export interface ValidationResult {
  valid: boolean;
  type: 'valid' | 'impossible_state' | 'misclassification';
  violations: ValidationViolation[];
  corrected_archetype?: PromoArchetype;
  corrected_fields?: Record<string, unknown>;
}

export interface ValidationViolation {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  type: 'impossible_state' | 'misclassification';
}

// ============================================
// IMPOSSIBLE STATES (SCHEMA-LEVEL)
// These MUST throw - they represent broken data
// ============================================

const IMPOSSIBLE_STATE_RULES: Array<{
  check: (fields: Record<string, unknown>) => boolean;
  message: string;
  field: string;
}> = [
  // 1. mode=tier AND tier_count <= 0
  {
    check: (f) => f.mode === 'tier' && (!f.tier_count || (f.tier_count as number) <= 0),
    message: 'mode=tier requires tier_count > 0',
    field: 'tier_count',
  },
  // 2. reward_amount < 0 (negative reward)
  {
    check: (f) => typeof f.reward_amount === 'number' && f.reward_amount < 0,
    message: 'reward_amount cannot be negative',
    field: 'reward_amount',
  },
  // 3. max_bonus < 0 (negative max)
  {
    check: (f) => typeof f.max_bonus === 'number' && f.max_bonus < 0,
    message: 'max_bonus cannot be negative',
    field: 'max_bonus',
  },
  // 4. turnover_multiplier < 0 (negative multiplier)
  {
    check: (f) => typeof f.turnover_multiplier === 'number' && f.turnover_multiplier < 0,
    message: 'turnover_multiplier cannot be negative',
    field: 'turnover_multiplier',
  },
  // 5. calculation_value > 100 for percentage (impossible percentage)
  {
    check: (f) => f.reward_is_percentage === true && typeof f.calculation_value === 'number' && f.calculation_value > 100,
    message: 'percentage calculation_value cannot exceed 100%',
    field: 'calculation_value',
  },
];

// ============================================
// GLOBAL INVARIANTS (CROSS-ARCHETYPE)
// These apply regardless of archetype
// ============================================

const GLOBAL_INVARIANT_RULES: Array<{
  check: (fields: Record<string, unknown>) => boolean;
  message: string;
  field: string;
}> = [
  // 1. calculation_basis = withdraw → payout_direction = after
  {
    check: (f) => f.calculation_basis === 'withdraw' && f.payout_direction !== 'after' && f.payout_direction !== undefined,
    message: 'calculation_basis=withdraw requires payout_direction=after',
    field: 'payout_direction',
  },
  // 2. reward_nature = chance → mode = fixed
  {
    check: (f) => f.reward_nature === 'chance' && f.mode !== 'fixed',
    message: 'reward_nature=chance requires mode=fixed',
    field: 'mode',
  },
  // 3. trigger_event = APK Download → calculation_basis should be null
  // (NOT a hard rule - APK Cashback is allowed)
  // REMOVED per architectural decision - APK can have calculation_basis
];

// ============================================
// MAIN VALIDATION FUNCTIONS
// ============================================

/**
 * validateImpossibleStates
 * 
 * Checks for schema-level impossible states.
 * These SHOULD throw in development mode.
 */
export function validateImpossibleStates(
  fields: Record<string, unknown>
): ValidationResult {
  const violations: ValidationViolation[] = [];

  for (const rule of IMPOSSIBLE_STATE_RULES) {
    if (rule.check(fields)) {
      violations.push({
        field: rule.field,
        message: rule.message,
        severity: 'error',
        type: 'impossible_state',
      });
    }
  }

  if (violations.length > 0) {
    // In development, throw error
    if (import.meta.env?.DEV || import.meta.env?.MODE === 'development') {
      const messages = violations.map(v => v.message).join('; ');
      console.error('[INVARIANT VIOLATION] Impossible state detected:', messages);
      throw new Error(`[IMPOSSIBLE STATE] ${messages}`);
    }

    return {
      valid: false,
      type: 'impossible_state',
      violations,
    };
  }

  return {
    valid: true,
    type: 'valid',
    violations: [],
  };
}

/**
 * validateGlobalInvariants
 * 
 * Checks global invariants that apply across all archetypes.
 * Returns misclassification result, NOT throw.
 */
export function validateGlobalInvariants(
  fields: Record<string, unknown>
): ValidationResult {
  const violations: ValidationViolation[] = [];

  for (const rule of GLOBAL_INVARIANT_RULES) {
    if (rule.check(fields)) {
      violations.push({
        field: rule.field,
        message: rule.message,
        severity: 'warning',
        type: 'misclassification',
      });
    }
  }

  return {
    valid: violations.length === 0,
    type: violations.length > 0 ? 'misclassification' : 'valid',
    violations,
  };
}

/**
 * validateArchetypeInvariants
 * 
 * Checks invariants specific to an archetype.
 * Returns misclassification result for soft violations.
 * Throws for impossible states.
 */
export function validateArchetypeInvariants(
  archetype: PromoArchetype,
  fields: Record<string, unknown>
): ValidationResult {
  const rule = getArchetypeRule(archetype);
  if (!rule) {
    return {
      valid: false,
      type: 'misclassification',
      violations: [{
        field: 'archetype',
        message: `Unknown archetype: ${archetype}`,
        severity: 'error',
        type: 'misclassification',
      }],
      corrected_archetype: 'UNKNOWN',
    };
  }

  const violations: ValidationViolation[] = [];

  for (const invariant of rule.invariants) {
    const fieldValue = fields[invariant.field];
    let violated = false;

    switch (invariant.condition) {
      case 'must_be':
        // Only check if field has a value
        if (fieldValue !== undefined && fieldValue !== invariant.value) {
          violated = true;
        }
        break;

      case 'must_not_be':
        if (fieldValue === invariant.value) {
          violated = true;
        }
        break;

      case 'must_exist':
        if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
          violated = true;
        }
        break;

      case 'must_not_exist':
        if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
          violated = true;
        }
        break;
    }

    if (violated) {
      violations.push({
        field: invariant.field,
        message: invariant.error_message,
        severity: invariant.type === 'hard' ? 'error' : 'warning',
        type: invariant.type === 'hard' ? 'impossible_state' : 'misclassification',
      });
    }
  }

  // Separate hard and soft violations
  const hardViolations = violations.filter(v => v.type === 'impossible_state');
  const softViolations = violations.filter(v => v.type === 'misclassification');

  // Hard violations → throw in dev mode
  if (hardViolations.length > 0) {
    if (import.meta.env?.DEV || import.meta.env?.MODE === 'development') {
      const messages = hardViolations.map(v => v.message).join('; ');
      console.error(`[INVARIANT VIOLATION] ${archetype}:`, messages);
      // Don't throw for archetype invariants - downgrade to UNKNOWN instead
    }

    return {
      valid: false,
      type: 'misclassification',
      violations,
      corrected_archetype: 'UNKNOWN',
    };
  }

  // Soft violations → valid but flagged
  if (softViolations.length > 0) {
    return {
      valid: true,  // Still valid, but flagged
      type: 'valid',
      violations: softViolations,
    };
  }

  return {
    valid: true,
    type: 'valid',
    violations: [],
  };
}

/**
 * validateFullPipeline
 * 
 * Complete validation pipeline:
 * 1. Check impossible states (throw if found)
 * 2. Check global invariants
 * 3. Check archetype invariants
 * 
 * Returns UNKNOWN archetype if any misclassification detected.
 */
export function validateFullPipeline(
  archetype: PromoArchetype,
  fields: Record<string, unknown>
): ValidationResult & { 
  final_archetype: PromoArchetype;
  confidence_impact: 'none' | 'downgrade_to_low';
} {
  // Step 1: Impossible states
  const impossibleResult = validateImpossibleStates(fields);
  if (!impossibleResult.valid) {
    return {
      ...impossibleResult,
      final_archetype: 'UNKNOWN',
      confidence_impact: 'downgrade_to_low',
    };
  }

  // Step 2: Global invariants
  const globalResult = validateGlobalInvariants(fields);
  
  // Step 3: Archetype invariants
  const archetypeResult = validateArchetypeInvariants(archetype, fields);

  // Merge violations
  const allViolations = [
    ...globalResult.violations,
    ...archetypeResult.violations,
  ];

  // Determine final archetype
  let final_archetype = archetype;
  let confidence_impact: 'none' | 'downgrade_to_low' = 'none';

  if (!archetypeResult.valid) {
    final_archetype = archetypeResult.corrected_archetype || 'UNKNOWN';
    confidence_impact = 'downgrade_to_low';
  } else if (!globalResult.valid) {
    // Global invariant violation → downgrade confidence but keep archetype
    confidence_impact = 'downgrade_to_low';
  }

  return {
    valid: archetypeResult.valid && globalResult.valid,
    type: allViolations.length > 0 ? 'misclassification' : 'valid',
    violations: allViolations,
    final_archetype,
    confidence_impact,
  };
}

// ============================================
// UTILITY: Handle invariant violation
// ============================================

/**
 * handleInvariantViolation
 * 
 * Centralized handler for invariant violations.
 * Returns corrected state instead of throwing.
 * 
 * ARCHITECTURAL LOCK #3:
 * - Impossible states → throw (in dev)
 * - Misclassifications → downgrade to UNKNOWN
 */
export function handleInvariantViolation(
  violation: ValidationViolation,
  currentArchetype: PromoArchetype,
  fields: Record<string, unknown>
): {
  action: 'throw' | 'downgrade' | 'flag';
  corrected_archetype?: PromoArchetype;
  corrected_fields?: Record<string, unknown>;
  message: string;
} {
  if (violation.type === 'impossible_state') {
    return {
      action: 'throw',
      message: `[IMPOSSIBLE STATE] ${violation.message}`,
    };
  }

  // Misclassification → downgrade to UNKNOWN
  return {
    action: 'downgrade',
    corrected_archetype: 'UNKNOWN',
    message: `[MISCLASSIFICATION] ${violation.message}`,
  };
}

// ============================================
// VERSION
// ============================================

export const INVARIANT_VALIDATOR_VERSION = 'v1.0.0+2025-01-15 (LOCKED)';
