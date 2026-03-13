/**
 * FIELD DERIVATION ENGINE v1.0
 * 
 * Derives field values from evidence based on archetype constraints.
 * 
 * FLOW:
 * 1. Apply locked fields (always true for archetype)
 * 2. Derive conditional fields from evidence
 * 3. Set optional field defaults if missing
 * 4. Return derived fields with confidence
 * 
 * VERSION: v1.0.0+2025-01-15 (LOCKED)
 */

import { 
  PromoArchetype, 
  ARCHETYPE_RULES, 
  getArchetypeRule,
  type LockedFieldConstraint,
  type DerivedFieldConstraint
} from './promo-taxonomy';
import { collectPrimitiveEvidence, inferRewardNature } from './primitive-evidence-collector';
import type { CanonicalMode } from './promo-primitive-gate';

// ============================================
// DERIVATION RESULT TYPES
// ============================================

export interface DerivedFieldsResult {
  fields: Record<string, unknown>;
  locked_fields: string[];
  derived_fields: string[];
  confidence: 'high' | 'medium' | 'low';
  ambiguity_flags: string[];
  derivation_log: DerivationLogEntry[];
}

export interface DerivationLogEntry {
  field: string;
  source: 'locked' | 'derived' | 'default' | 'evidence' | 'existing';
  value: unknown;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

// ============================================
// EVIDENCE EXTRACTION PATTERNS
// ============================================

const EVIDENCE_PATTERNS = {
  // Mode detection
  mode_formula: [
    /\d+\s*%/,           // Percentage
    /dari\s*(deposit|turnover|loss)/i,
  ],
  mode_fixed: [
    /freechip/i,
    /\brp\.?\s*[\d.,]+\b/i,  // Fixed amount
    /bonus\s*[\d.,]+[km]?\b/i,
  ],
  mode_tier: [
    /\btier\b/i,
    /tingkat\s+\d/i,
    /level\s+\d/i,
    /tier\s*\d/i,
    /level\s*\d+\s*[→=:]/i,
    /bronze|silver|gold|platinum/i,
    /deposit\s+(rp\s*)?\d.*bonus\s*\d+%.*\n.*deposit\s*(rp\s*)?\d.*bonus\s*\d+%/is,
    /[-•]\s*(rp\s*)?\d[\d.,]+\s*[–-]\s*(rp\s*)?\d[\d.,]+.*:\s*bonus\s*\d+%/i,
  ],

  // Calculation basis
  basis_deposit: [/deposit/i, /depo/i],
  basis_loss: [/loss/i, /kekalahan/i, /cashback/i],
  basis_turnover: [/turnover/i, /rollingan/i, /to\b/i],
  basis_withdraw: [/withdraw/i, /wd\b/i, /penarikan/i],

  // Payout direction
  payout_before: [/sebelum\s*(wd|withdraw|to)/i, /depan/i],
  payout_after: [/setelah\s*(wd|withdraw|to)/i, /belakang/i],

  // Trigger events
  trigger_apk: [/download\s*apk/i, /apk/i, /aplikasi/i],
  trigger_deposit: [/deposit/i, /depo/i],
  trigger_withdraw: [/withdraw/i, /wd\b/i],
  trigger_login: [/login/i, /masuk/i],
  trigger_referral: [/referral/i, /ajak\s*teman/i],
  trigger_birthday: [/birthday/i, /ultah/i],
};

// ============================================
// MAIN DERIVATION FUNCTION
// ============================================

/**
 * deriveFieldsForArchetype
 * 
 * Main function to derive field values based on archetype and evidence.
 */
export function deriveFieldsForArchetype(
  archetype: PromoArchetype,
  promoName: string,
  terms: string,
  existingFields: Record<string, unknown> = {}
): DerivedFieldsResult {
  const rule = getArchetypeRule(archetype);
  const combinedText = `${promoName} ${terms}`;
  
  const result: DerivedFieldsResult = {
    fields: { ...existingFields },
    locked_fields: [],
    derived_fields: [],
    confidence: 'high',
    ambiguity_flags: [],
    derivation_log: [],
  };

  if (!rule || archetype === 'UNKNOWN') {
    result.confidence = 'low';
    result.ambiguity_flags.push('unknown_archetype');
    return result;
  }

  // ====================================
  // Step 1: Apply locked fields
  // ====================================
  for (const [fieldName, constraint] of Object.entries(rule.locked_fields)) {
    if (constraint !== null && constraint !== undefined) {
      const lockedConstraint = constraint as LockedFieldConstraint;
      result.fields[fieldName] = lockedConstraint.value;
      result.locked_fields.push(fieldName);
      result.derivation_log.push({
        field: fieldName,
        source: 'locked',
        value: lockedConstraint.value,
        confidence: 'high',
        reason: lockedConstraint.reason,
      });
    } else if (constraint === null) {
      // Explicitly null = field should not exist
      result.fields[fieldName] = null;
      result.locked_fields.push(fieldName);
      result.derivation_log.push({
        field: fieldName,
        source: 'locked',
        value: null,
        confidence: 'high',
        reason: 'Explicitly null for this archetype',
      });
    }
  }

  // ====================================
  // Step 2: Derive conditional fields from evidence
  // ====================================
  for (const [fieldName, constraint] of Object.entries(rule.derived_fields)) {
    if (!constraint) continue;
    
    const derivedConstraint = constraint as DerivedFieldConstraint;
    const derivedValue = deriveFieldValue(
      fieldName,
      derivedConstraint,
      combinedText,
      existingFields
    );

    if (derivedValue.value !== undefined) {
      result.fields[fieldName] = derivedValue.value;
      result.derived_fields.push(fieldName);
      result.derivation_log.push({
        field: fieldName,
        source: derivedValue.source,
        value: derivedValue.value,
        confidence: derivedValue.confidence,
        reason: derivedValue.reason,
      });

      // Update overall confidence
      if (derivedValue.confidence === 'low') {
        result.confidence = 'low';
      } else if (derivedValue.confidence === 'medium' && result.confidence === 'high') {
        result.confidence = 'medium';
      }

      // Add ambiguity flag if specified
      if (derivedConstraint.ambiguity_flag && derivedValue.source === 'default') {
        result.ambiguity_flags.push(derivedConstraint.ambiguity_flag);
      }
    }
  }

  return result;
}

// ============================================
// FIELD VALUE DERIVATION
// ============================================

interface DerivedValue {
  value: unknown;
  source: 'evidence' | 'default' | 'existing';
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * deriveFieldValue
 * 
 * Derives a single field value from evidence or defaults.
 */
function deriveFieldValue(
  fieldName: string,
  constraint: DerivedFieldConstraint,
  text: string,
  existingFields: Record<string, unknown>
): DerivedValue {
  const lowerText = text.toLowerCase();

  // Check existing value first
  if (existingFields[fieldName] !== undefined && existingFields[fieldName] !== null) {
    return {
      value: existingFields[fieldName],
      source: 'existing',
      confidence: 'high',
      reason: 'Using existing value',
    };
  }

  // Try to derive from evidence
  const evidenceValue = deriveFromEvidence(fieldName, constraint, lowerText);
  if (evidenceValue !== undefined) {
    return {
      value: evidenceValue,
      source: 'evidence',
      confidence: 'high',
      reason: `Derived from evidence pattern`,
    };
  }

  // Use default if available
  if (constraint.default_if_missing !== undefined) {
    return {
      value: constraint.default_if_missing,
      source: 'default',
      confidence: constraint.confidence_if_missing,
      reason: `Using default (no evidence found)`,
    };
  }

  // No value found
  return {
    value: undefined,
    source: 'default',
    confidence: 'low',
    reason: 'No evidence or default available',
  };
}

/**
 * deriveFromEvidence
 * 
 * Attempts to extract field value from text evidence.
 */
function deriveFromEvidence(
  fieldName: string,
  constraint: DerivedFieldConstraint,
  text: string
): unknown | undefined {
  const allowedValues = constraint.allowed_values || [];

  switch (fieldName) {
    case 'mode':
      // Check for formula indicators
      if (EVIDENCE_PATTERNS.mode_formula.some(p => p.test(text))) {
        if (allowedValues.includes('formula')) return 'formula';
      }
      // Check for tier indicators
      if (EVIDENCE_PATTERNS.mode_tier.some(p => p.test(text))) {
        if (allowedValues.includes('tier')) return 'tier';
      }
      // Check for fixed indicators
      if (EVIDENCE_PATTERNS.mode_fixed.some(p => p.test(text))) {
        if (allowedValues.includes('fixed')) return 'fixed';
      }
      return undefined;

    case 'calculation_basis':
      if (EVIDENCE_PATTERNS.basis_withdraw.some(p => p.test(text))) {
        if (allowedValues.includes('withdraw')) return 'withdraw';
      }
      if (EVIDENCE_PATTERNS.basis_loss.some(p => p.test(text))) {
        if (allowedValues.includes('loss')) return 'loss';
      }
      if (EVIDENCE_PATTERNS.basis_turnover.some(p => p.test(text))) {
        if (allowedValues.includes('turnover')) return 'turnover';
      }
      if (EVIDENCE_PATTERNS.basis_deposit.some(p => p.test(text))) {
        if (allowedValues.includes('deposit')) return 'deposit';
      }
      return undefined;

    case 'payout_direction':
      if (EVIDENCE_PATTERNS.payout_before.some(p => p.test(text))) {
        if (allowedValues.includes('before')) return 'before';
      }
      if (EVIDENCE_PATTERNS.payout_after.some(p => p.test(text))) {
        if (allowedValues.includes('after')) return 'after';
      }
      return undefined;

    case 'trigger_event':
      if (EVIDENCE_PATTERNS.trigger_apk.some(p => p.test(text))) {
        if (allowedValues.includes('APK Download')) return 'APK Download';
      }
      if (EVIDENCE_PATTERNS.trigger_birthday.some(p => p.test(text))) {
        if (allowedValues.includes('Login')) return 'Login';  // Birthday uses Login trigger
      }
      if (EVIDENCE_PATTERNS.trigger_referral.some(p => p.test(text))) {
        if (allowedValues.includes('Referral')) return 'Referral';
      }
      if (EVIDENCE_PATTERNS.trigger_deposit.some(p => p.test(text))) {
        if (allowedValues.includes('Deposit')) return 'Deposit';
      }
      if (EVIDENCE_PATTERNS.trigger_withdraw.some(p => p.test(text))) {
        if (allowedValues.includes('Withdraw')) return 'Withdraw';
      }
      if (EVIDENCE_PATTERNS.trigger_login.some(p => p.test(text))) {
        if (allowedValues.includes('Login')) return 'Login';
      }
      return undefined;

    default:
      return undefined;
  }
}

// ============================================
// APPLY LOCKED FIELDS (UTILITY)
// ============================================

/**
 * applyLockedFields
 * 
 * Applies only the locked fields from an archetype to existing data.
 * Useful for ensuring constraints are never violated.
 */
export function applyLockedFields(
  archetype: PromoArchetype,
  existingFields: Record<string, unknown>
): Record<string, unknown> {
  const rule = getArchetypeRule(archetype);
  if (!rule || archetype === 'UNKNOWN') {
    return existingFields;
  }

  const result = { ...existingFields };

  for (const [fieldName, constraint] of Object.entries(rule.locked_fields)) {
    if (constraint !== null && constraint !== undefined) {
      const lockedConstraint = constraint as LockedFieldConstraint;
      result[fieldName] = lockedConstraint.value;
    } else if (constraint === null) {
      result[fieldName] = null;
    }
  }

  return result;
}

// ============================================
// GET FIELD APPLICABILITY
// ============================================

/**
 * getFieldApplicability
 * 
 * Returns which fields are applicable for an archetype.
 * Used by UI to show/hide fields.
 */
export function getFieldApplicability(
  archetype: PromoArchetype
): {
  applicable: string[];
  not_applicable: string[];
  optional: string[];
} {
  const rule = getArchetypeRule(archetype);
  if (!rule) {
    return { applicable: [], not_applicable: [], optional: [] };
  }

  return {
    applicable: rule.applicable_fields,
    not_applicable: rule.not_applicable_fields,
    optional: rule.optional_fields,
  };
}

// ============================================
// VERSION
// ============================================

export const FIELD_DERIVATION_VERSION = 'v1.0.0+2025-01-15 (LOCKED)';
