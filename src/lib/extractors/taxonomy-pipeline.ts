/**
 * TAXONOMY PIPELINE v1.0 — SSoT Orchestrator
 * 
 * Single Source of Truth for mode, archetype, calculation_basis,
 * payout_direction, and reward_nature.
 * 
 * ⚠️ CRITICAL CONTRACT:
 * After this pipeline runs, NO other code may modify the 5 core fields.
 * Extractor = Evidence Collector (saksi)
 * Taxonomy = Judge (putusan final)
 * 
 * FLOW:
 * 1. Receive CleanedEvidence from evidence-cleaner
 * 2. Run archetype detector (scoring + invariants)
 * 3. Run invariant validator (hard throw vs downgrade)
 * 4. Run field derivation engine (5 inti + derived)
 * 5. Return TaxonomyDecision (LOCKED, immutable)
 * 
 * VERSION: v1.0.0+2025-01-22 (LOCKED)
 */

import { detectArchetype, type ArchetypeDetectionResult } from './archetype-detector';
import { validateFullPipeline, type ValidationResult } from './archetype-invariant-validator';
import { deriveFieldsForArchetype, type DerivedFieldsResult } from './field-derivation-engine';
import { type CleanedEvidence } from './evidence-cleaner';
import { type PromoArchetype } from './promo-taxonomy';
import { type CanonicalMode } from './promo-primitive-gate';

// ============================================
// TAXONOMY DECISION (SSoT OUTPUT)
// ============================================

export interface TaxonomyDecision {
  // ============================================
  // CORE DECISION — LOCKED AFTER THIS POINT
  // These 5 fields are the Single Source of Truth
  // ============================================
  archetype: PromoArchetype;
  confidence: 'high' | 'medium' | 'low';
  
  // 5 Core Locked Fields (SSoT)
  mode: CanonicalMode;
  calculation_basis: string | null;
  payout_direction: 'before' | 'after' | null;
  reward_nature: string;
  trigger_event: string;
  
  // ============================================
  // ADDITIONAL DERIVED FIELDS
  // These are derived from archetype rules
  // ============================================
  derivedFields: Record<string, unknown>;
  
  // ============================================
  // AUDIT TRAIL
  // For debugging and explainability
  // ============================================
  evidence_summary: string[];
  ambiguity_flags: string[];
  rejected_candidates: Array<{
    archetype: string;
    reason: string;
    score: number;
  }>;
  
  // ============================================
  // DECISION METADATA
  // ============================================
  taxonomy_version: string;
  decision_timestamp: string;
  detector_score: number;
  validation_passed: boolean;
}

// ============================================
// VERSION CONSTANT
// ============================================

export const TAXONOMY_PIPELINE_VERSION = '1.0.0';

// ============================================
// MAIN PIPELINE FUNCTION
// ============================================

/**
 * runTaxonomyPipeline
 * 
 * Main orchestrator that:
 * 1. Detects archetype from evidence
 * 2. Validates invariants
 * 3. Derives core and additional fields
 * 4. Returns immutable TaxonomyDecision
 * 
 * @param evidence - CleanedEvidence from evidence-cleaner
 * @returns TaxonomyDecision - Single Source of Truth
 */
export function runTaxonomyPipeline(evidence: CleanedEvidence): TaxonomyDecision {
  const timestamp = new Date().toISOString();
  
  // ====================================
  // Step 1: Detect Archetype
  // ====================================
  const detectionResult = detectArchetype(
    evidence.promoName,
    evidence.terms,
    mapEvidenceToFields(evidence)
  );
  
  // ====================================
  // Step 2: Validate Invariants
  // ====================================
  const validationResult = validateFullPipeline(
    detectionResult.archetype,
    mapEvidenceToFields(evidence)
  );
  
  // ====================================
  // Step 3: Derive Fields
  // ====================================
  const derivationResult = deriveFieldsForArchetype(
    validationResult.final_archetype,
    evidence.promoName,
    evidence.terms,
    mapEvidenceToFields(evidence)
  );
  
  // ====================================
  // Step 4: Extract Core Fields
  // ====================================
  const coreFields = extractCoreFields(derivationResult, evidence);
  
  // ====================================
  // Step 5: Build TaxonomyDecision
  // ====================================
  
  // Calculate confidence impact as numeric modifier
  const confidenceImpact = validationResult.confidence_impact === 'downgrade_to_low' ? -1 : 0;
  
  return {
    archetype: validationResult.final_archetype,
    confidence: calculateFinalConfidence(
      detectionResult.confidence,
      derivationResult.confidence,
      confidenceImpact
    ),
    
    // 5 Core Locked Fields
    mode: coreFields.mode,
    calculation_basis: coreFields.calculation_basis,
    payout_direction: coreFields.payout_direction,
    reward_nature: coreFields.reward_nature,
    trigger_event: coreFields.trigger_event,
    
    // Additional derived fields
    derivedFields: filterNonCoreFields(derivationResult.fields),
    
    // Audit trail
    evidence_summary: [
      ...detectionResult.evidence,
      ...derivationResult.derivation_log.map(l => `${l.field}: ${l.value} (${l.source})`),
    ],
    ambiguity_flags: [
      ...detectionResult.ambiguity_flags,
      ...derivationResult.ambiguity_flags,
      ...(validationResult.violations?.map(v => v.message) || []),
    ],
    rejected_candidates: detectionResult.rejected_candidates.map(c => ({
      archetype: c.archetype,
      reason: c.reason,
      score: c.score,
    })),
    
    // Metadata
    taxonomy_version: TAXONOMY_PIPELINE_VERSION,
    decision_timestamp: timestamp,
    detector_score: detectionResult.score,
    validation_passed: validationResult.valid,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Map CleanedEvidence to field record for detector/validator
 */
function mapEvidenceToFields(evidence: CleanedEvidence): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  
  // Map numeric values
  if (evidence.numericValues.reward_amount !== undefined) {
    fields.reward_amount = evidence.numericValues.reward_amount;
  }
  if (evidence.numericValues.min_deposit !== undefined) {
    fields.min_deposit = evidence.numericValues.min_deposit;
  }
  if (evidence.numericValues.max_bonus !== undefined) {
    fields.max_bonus = evidence.numericValues.max_bonus;
  }
  if (evidence.numericValues.turnover_multiplier !== undefined) {
    fields.turnover_multiplier = evidence.numericValues.turnover_multiplier;
  }
  
  // Map flags as hints
  if (evidence.flags.has_apk_keywords) {
    fields.require_apk = true;
  }
  if (evidence.flags.has_percentage_reward) {
    fields.reward_is_percentage = true;
  }
  if (evidence.flags.has_tier_structure) {
    fields.has_tiers = true;
  }
  if (evidence.flags.has_turnover_requirement) {
    fields.turnover_enabled = true;
  }
  
  return fields;
}

/**
 * Extract 5 core fields from derivation result
 */
function extractCoreFields(
  derivation: DerivedFieldsResult,
  evidence: CleanedEvidence
): {
  mode: CanonicalMode;
  calculation_basis: string | null;
  payout_direction: 'before' | 'after' | null;
  reward_nature: string;
  trigger_event: string;
} {
  const fields = derivation.fields;
  
  // Mode with fallback
  let mode: CanonicalMode = 'fixed';
  if (fields.mode === 'formula' || fields.mode === 'tier' || fields.mode === 'event') {
    mode = fields.mode as CanonicalMode;
  } else if (evidence.flags.has_percentage_reward) {
    mode = 'formula';
  } else if (evidence.flags.has_tier_structure) {
    mode = 'tier';
  }
  
  // Calculation basis
  let calculation_basis: string | null = null;
  if (typeof fields.calculation_basis === 'string' && fields.calculation_basis !== '') {
    calculation_basis = fields.calculation_basis;
  } else if (evidence.flags.has_loss_keywords) {
    calculation_basis = 'loss';
  } else if (evidence.flags.has_withdraw_keywords) {
    calculation_basis = 'withdraw';
  } else if (evidence.flags.has_deposit_keywords) {
    calculation_basis = 'deposit';
  }
  
  // Payout direction
  let payout_direction: 'before' | 'after' | null = null;
  if (fields.payout_direction === 'before' || fields.payout_direction === 'depan') {
    payout_direction = 'before';
  } else if (fields.payout_direction === 'after' || fields.payout_direction === 'belakang') {
    payout_direction = 'after';
  }
  
  // Reward nature
  let reward_nature = 'bonus';
  if (typeof fields.reward_nature === 'string' && fields.reward_nature !== '') {
    reward_nature = fields.reward_nature;
  } else if (evidence.flags.has_loss_keywords) {
    reward_nature = 'cashback';
  } else if (evidence.flags.has_referral_keywords) {
    reward_nature = 'referral';
  } else if (evidence.flags.has_lucky_spin || evidence.flags.has_competition) {
    reward_nature = 'event';
  }
  
  // Trigger event
  let trigger_event = 'Deposit';
  if (typeof fields.trigger_event === 'string' && fields.trigger_event !== '') {
    trigger_event = fields.trigger_event;
  } else if (evidence.flags.has_apk_keywords) {
    trigger_event = 'APK Download';
  } else if (evidence.flags.has_referral_keywords) {
    trigger_event = 'Referral';
  } else if (evidence.flags.has_withdraw_keywords) {
    trigger_event = 'Withdraw';
  } else if (evidence.flags.has_loss_keywords) {
    trigger_event = 'Loss';
  } else if (evidence.flags.has_login_trigger || evidence.flags.has_birthday_keywords) {
    trigger_event = 'Login';
  }
  
  return {
    mode,
    calculation_basis,
    payout_direction,
    reward_nature,
    trigger_event,
  };
}

/**
 * Calculate final confidence from multiple sources
 */
function calculateFinalConfidence(
  detectorConfidence: 'high' | 'medium' | 'low',
  derivationConfidence: 'high' | 'medium' | 'low',
  validationImpact: number
): 'high' | 'medium' | 'low' {
  const scores = { high: 3, medium: 2, low: 1 };
  
  // Average detector and derivation scores
  const baseScore = (scores[detectorConfidence] + scores[derivationConfidence]) / 2;
  
  // Apply validation impact
  const finalScore = baseScore + validationImpact;
  
  if (finalScore >= 2.5) return 'high';
  if (finalScore >= 1.5) return 'medium';
  return 'low';
}

/**
 * Filter out core fields from derived fields
 * (core fields are returned separately)
 */
function filterNonCoreFields(fields: Record<string, unknown>): Record<string, unknown> {
  const coreFieldNames = [
    'mode',
    'reward_mode',
    'calculation_basis',
    'payout_direction',
    'reward_nature',
    'trigger_event',
  ];
  
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!coreFieldNames.includes(key)) {
      result[key] = value;
    }
  }
  
  return result;
}

// ============================================
// CONFIDENCE GATE (for extractor integration)
// ============================================

/**
 * Check if taxonomy decision should be used or fallback to legacy
 * 
 * RULE: Only fallback on UNKNOWN + low confidence
 * All other cases → Taxonomy wins
 */
export function shouldUseTaxonomy(decision: TaxonomyDecision): boolean {
  // Only fallback on UNKNOWN archetype WITH low confidence
  if (decision.archetype === 'UNKNOWN' && decision.confidence === 'low') {
    return false;
  }
  
  // All other cases: taxonomy wins
  return true;
}

// ============================================
// LOCKED FIELD CONSTANTS
// ============================================

/**
 * Fields that are LOCKED after taxonomy decision
 * Extractor and downstream code MUST NOT modify these
 */
export const TAXONOMY_LOCKED_FIELDS = [
  'mode',
  'reward_mode',      // alias for mode
  'archetype',
  'calculation_basis',
  'payout_direction',
  'reward_nature',
  'trigger_event',
] as const;

export type TaxonomyLockedField = typeof TAXONOMY_LOCKED_FIELDS[number];
