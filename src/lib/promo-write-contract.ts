/**
 * PROMO WRITE CONTRACT
 * 
 * Enforces explicit write intent to prevent accidental data corruption.
 * 
 * PROBLEM THIS SOLVES:
 * - UI might accidentally write to base field when user intended fixed override
 * - Edit operations without explicit target = audit log meaningless
 * - Effective value could be written back without user intent
 * 
 * GUARDRAILS:
 * 1. Write must specify target: 'base' | 'fixed' | 'subcategory'
 * 2. Write to 'fixed' only valid when reward_mode === 'fixed'
 * 3. Write to 'subcategory' must include subcategory index
 * 4. Validation fails = write blocked (not silent corruption)
 */

import type { PromoFormData, PromoSubCategory } from '@/components/VOCDashboard/PromoFormWizard/types';

// ============================================
// TYPES
// ============================================

/**
 * Target layer for write operation
 */
export type WriteTarget = 'base' | 'fixed' | 'subcategory';

/**
 * Explicit write intent for audit and validation
 */
export interface WriteIntent {
  /** Which layer is being modified */
  target: WriteTarget;
  /** Field name being modified */
  field: string;
  /** New value to write */
  value: unknown;
  /** Subcategory index (required when target = 'subcategory') */
  subcategoryIndex?: number;
  /** Optional: reason for the write (for audit log) */
  reason?: string;
}

/**
 * Result of write validation
 */
export interface WriteValidationResult {
  valid: boolean;
  error?: string;
  /** Which field would actually be written (e.g., 'fixed_max_claim' vs 'max_claim') */
  resolvedField?: string;
}

/**
 * Audit log entry for write operations
 */
export interface WriteAuditEntry {
  timestamp: string;
  intent: WriteIntent;
  previousValue: unknown;
  newValue: unknown;
  success: boolean;
  error?: string;
}

// ============================================
// FIELD MAPPING
// ============================================

/**
 * Map base field names to their fixed equivalents
 */
const FIXED_FIELD_MAP: Record<string, string> = {
  reward_type: 'fixed_reward_type',
  max_claim: 'fixed_max_claim',
  max_claim_unlimited: 'fixed_max_claim_unlimited',
  calculation_base: 'fixed_calculation_base',
  calculation_value: 'fixed_calculation_value',
  turnover_rule: 'fixed_turnover_rule',
  turnover_rule_enabled: 'fixed_turnover_rule_enabled',
  payout_direction: 'fixed_payout_direction',
  min_deposit: 'fixed_min_depo',
  min_deposit_enabled: 'fixed_min_depo_enabled',
};

/**
 * Fields that exist in subcategory context
 */
const SUBCATEGORY_FIELDS = new Set([
  'reward_type',
  'jenis_hadiah',
  'max_bonus',
  'max_bonus_unlimited',
  'max_bonus_same_as_global',
  'jenis_hadiah_same_as_global',
  'calculation_base',
  'calculation_value',
  'turnover_rule',
  'turnover_rule_enabled',
  'payout_direction',
  'payout_direction_same_as_global',
  'dinamis_reward_amount',
]);

// ============================================
// VALIDATION
// ============================================

/**
 * Validate a write intent before execution
 * 
 * @param data Current promo data
 * @param intent Write intent to validate
 * @returns Validation result with resolved field name
 */
export function validateWriteIntent(
  data: Partial<PromoFormData>,
  intent: WriteIntent
): WriteValidationResult {
  const { target, field, subcategoryIndex } = intent;

  // Rule 1: Write to 'fixed' only valid when reward_mode === 'fixed'
  if (target === 'fixed' && data.reward_mode !== 'fixed') {
    return {
      valid: false,
      error: `Cannot write to fixed_* field when reward_mode = '${data.reward_mode}'. Switch to fixed mode first.`,
    };
  }

  // Rule 2: Write to 'subcategory' requires index
  if (target === 'subcategory') {
    if (subcategoryIndex === undefined || subcategoryIndex < 0) {
      return {
        valid: false,
        error: 'Write to subcategory requires valid subcategoryIndex',
      };
    }
    
    // Check subcategory exists
    const subcategories = data.subcategories || [];
    if (subcategoryIndex >= subcategories.length) {
      return {
        valid: false,
        error: `Subcategory index ${subcategoryIndex} out of bounds (max: ${subcategories.length - 1})`,
      };
    }

    // Check field is valid for subcategory
    if (!SUBCATEGORY_FIELDS.has(field)) {
      return {
        valid: false,
        error: `Field '${field}' is not a valid subcategory field`,
      };
    }

    return {
      valid: true,
      resolvedField: `subcategories[${subcategoryIndex}].${field}`,
    };
  }

  // Rule 3: Resolve fixed field name
  if (target === 'fixed') {
    const fixedField = FIXED_FIELD_MAP[field];
    if (!fixedField) {
      return {
        valid: false,
        error: `No fixed equivalent for field '${field}'`,
      };
    }
    return {
      valid: true,
      resolvedField: fixedField,
    };
  }

  // Base write - direct field access
  return {
    valid: true,
    resolvedField: field,
  };
}

// ============================================
// WRITE APPLICATION
// ============================================

/**
 * Apply a validated write intent to promo data
 * 
 * IMPORTANT: This returns a new object, does not mutate input
 * 
 * @param data Current promo data
 * @param intent Validated write intent
 * @returns New promo data with write applied, or null if validation fails
 */
export function applyWriteIntent(
  data: Partial<PromoFormData>,
  intent: WriteIntent
): Partial<PromoFormData> | null {
  const validation = validateWriteIntent(data, intent);
  
  if (!validation.valid) {
    console.error('[WriteContract] Validation failed:', validation.error);
    return null;
  }

  const { target, field, value, subcategoryIndex } = intent;

  // Create shallow copy
  const updated = { ...data };

  if (target === 'subcategory' && subcategoryIndex !== undefined) {
    // Deep copy subcategories array
    const subcategories = [...(data.subcategories || [])];
    subcategories[subcategoryIndex] = {
      ...subcategories[subcategoryIndex],
      [field]: value,
    };
    updated.subcategories = subcategories;
    
    console.debug('[WriteContract] Applied:', {
      target,
      field: `subcategories[${subcategoryIndex}].${field}`,
      value,
    });
  } else if (target === 'fixed') {
    const resolvedField = FIXED_FIELD_MAP[field];
    if (resolvedField) {
      (updated as Record<string, unknown>)[resolvedField] = value;
      
      console.debug('[WriteContract] Applied:', {
        target,
        field: resolvedField,
        value,
      });
    }
  } else {
    // Base write
    (updated as Record<string, unknown>)[field] = value;
    
    console.debug('[WriteContract] Applied:', {
      target,
      field,
      value,
    });
  }

  return updated;
}

// ============================================
// HELPER: DETERMINE WRITE TARGET FROM CONTEXT
// ============================================

/**
 * Determine appropriate write target based on current promo state
 * 
 * This helps UI know which layer to write to based on mode and context
 * 
 * @param data Current promo data
 * @param field Field being edited
 * @param subcategoryIndex Optional subcategory context
 * @returns Recommended write target
 */
export function getWriteTarget(
  data: Partial<PromoFormData>,
  field: string,
  subcategoryIndex?: number
): WriteTarget {
  // If editing within subcategory context, target subcategory
  if (subcategoryIndex !== undefined && SUBCATEGORY_FIELDS.has(field)) {
    return 'subcategory';
  }

  // If in fixed mode and field has fixed equivalent, target fixed
  if (data.reward_mode === 'fixed' && FIXED_FIELD_MAP[field]) {
    return 'fixed';
  }

  // Default to base
  return 'base';
}

// ============================================
// AUDIT HELPERS
// ============================================

/**
 * Create audit entry for a write operation
 */
export function createWriteAuditEntry(
  intent: WriteIntent,
  previousValue: unknown,
  success: boolean,
  error?: string
): WriteAuditEntry {
  return {
    timestamp: new Date().toISOString(),
    intent,
    previousValue,
    newValue: intent.value,
    success,
    error,
  };
}
