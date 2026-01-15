/**
 * ARCHETYPE DETECTOR v1.0 — Evidence-Based Classification
 * 
 * ARCHITECTURAL LOCK #2:
 * Detector = positive + negative + disqualifier scoring
 * 
 * FLOW:
 * 1. Patterns PROPOSE candidate archetypes (score calculation)
 * 2. Disqualifiers ELIMINATE candidates (hard reject)
 * 3. Invariants CONFIRM or REJECT final candidates
 * 4. Return highest scoring valid candidate, or UNKNOWN
 * 
 * RULES:
 * 1. NO guessing
 * 2. NO hardcoded defaults
 * 3. Return UNKNOWN if evidence insufficient
 * 4. Flag low confidence for review
 * 
 * VERSION: v1.0.0+2025-01-15 (LOCKED)
 */

import { 
  PromoArchetype, 
  ARCHETYPE_RULES, 
  getArchetypeRule,
  getAllArchetypes,
  type ArchetypeSemanticRule 
} from './promo-taxonomy';

// ============================================
// DETECTION RESULT INTERFACE
// ============================================

export interface ArchetypeDetectionResult {
  archetype: PromoArchetype;
  confidence: 'high' | 'medium' | 'low';
  score: number;
  evidence: string[];
  ambiguity_flags: string[];
  rejected_candidates: Array<{
    archetype: PromoArchetype;
    reason: string;
    score: number;
  }>;
}

interface CandidateArchetype {
  archetype: PromoArchetype;
  score: number;
  positive_matches: string[];
  negative_matches: string[];
  disqualified: boolean;
  disqualifier_reason?: string;
}

// ============================================
// SCORE WEIGHTS
// ============================================

const SCORE_WEIGHTS = {
  POSITIVE_CUE: 10,    // Each positive cue match
  NEGATIVE_CUE: -5,    // Each negative cue match (reduces score)
  DISQUALIFIER: -Infinity,  // Hard reject
  MIN_POSITIVE_FOR_HIGH: 2,  // Need 2+ positive cues for high confidence
  MIN_SCORE_FOR_CANDIDATE: 5,  // Minimum score to be considered
} as const;

// ============================================
// MAIN DETECTOR FUNCTION
// ============================================

/**
 * detectArchetype
 * 
 * Main detection function that:
 * 1. Calculates scores for each archetype based on cues
 * 2. Eliminates disqualified candidates
 * 3. Validates invariants for remaining candidates
 * 4. Returns highest scoring valid candidate or UNKNOWN
 */
export function detectArchetype(
  promoName: string,
  terms: string,
  extractedFields: Record<string, unknown> = {}
): ArchetypeDetectionResult {
  const combinedText = `${promoName} ${terms}`.toLowerCase();
  const candidates: CandidateArchetype[] = [];
  const evidence: string[] = [];
  const ambiguity_flags: string[] = [];
  const rejected_candidates: Array<{
    archetype: PromoArchetype;
    reason: string;
    score: number;
  }> = [];

  // ====================================
  // Step 1: Calculate scores for each archetype
  // ====================================
  for (const archetype of getAllArchetypes()) {
    const rule = getArchetypeRule(archetype);
    const candidate = calculateCandidateScore(archetype, rule, combinedText);
    
    if (candidate.disqualified) {
      rejected_candidates.push({
        archetype,
        reason: candidate.disqualifier_reason || 'Disqualified by pattern',
        score: candidate.score,
      });
    } else if (candidate.score >= SCORE_WEIGHTS.MIN_SCORE_FOR_CANDIDATE) {
      candidates.push(candidate);
      evidence.push(...candidate.positive_matches.map(m => `${archetype}: ${m}`));
    }
  }

  // ====================================
  // Step 2: Sort by score (highest first)
  // ====================================
  candidates.sort((a, b) => b.score - a.score);

  // ====================================
  // Step 3: Validate invariants for top candidates
  // ====================================
  for (const candidate of candidates) {
    const rule = getArchetypeRule(candidate.archetype);
    const invariantResult = validateHardInvariants(rule, extractedFields);
    
    if (invariantResult.valid) {
      // Found valid candidate!
      const confidence = calculateConfidence(candidate, invariantResult.softViolations);
      
      if (invariantResult.softViolations.length > 0) {
        ambiguity_flags.push(...invariantResult.softViolations);
      }
      
      return {
        archetype: candidate.archetype,
        confidence,
        score: candidate.score,
        evidence,
        ambiguity_flags,
        rejected_candidates,
      };
    } else {
      // Invariant violation - reject candidate
      rejected_candidates.push({
        archetype: candidate.archetype,
        reason: invariantResult.violations.join(', '),
        score: candidate.score,
      });
    }
  }

  // ====================================
  // Step 4: No valid candidates → UNKNOWN
  // ====================================
  if (candidates.length === 0) {
    ambiguity_flags.push('no_pattern_match');
  } else {
    ambiguity_flags.push('all_candidates_failed_invariants');
  }

  return {
    archetype: 'UNKNOWN',
    confidence: 'low',
    score: 0,
    evidence,
    ambiguity_flags,
    rejected_candidates,
  };
}

// ============================================
// SCORE CALCULATION
// ============================================

/**
 * calculateCandidateScore
 * 
 * Calculates score for an archetype based on:
 * - positive_cues: +10 each
 * - negative_cues: -5 each
 * - disqualifiers: -Infinity (hard reject)
 */
function calculateCandidateScore(
  archetype: PromoArchetype,
  rule: ArchetypeSemanticRule,
  text: string
): CandidateArchetype {
  const { detection_cues } = rule;
  let score = 0;
  const positive_matches: string[] = [];
  const negative_matches: string[] = [];
  let disqualified = false;
  let disqualifier_reason: string | undefined;

  // Check disqualifiers first (hard reject)
  for (const pattern of detection_cues.disqualifiers) {
    if (pattern.test(text)) {
      disqualified = true;
      disqualifier_reason = `Disqualified by pattern: ${pattern.source}`;
      break;
    }
  }

  if (disqualified) {
    return {
      archetype,
      score: -Infinity,
      positive_matches: [],
      negative_matches: [],
      disqualified: true,
      disqualifier_reason,
    };
  }

  // Calculate positive cues
  for (const pattern of detection_cues.positive_cues) {
    if (pattern.test(text)) {
      score += SCORE_WEIGHTS.POSITIVE_CUE;
      positive_matches.push(pattern.source);
    }
  }

  // Calculate negative cues (reduce score)
  for (const pattern of detection_cues.negative_cues) {
    if (pattern.test(text)) {
      score += SCORE_WEIGHTS.NEGATIVE_CUE;
      negative_matches.push(pattern.source);
    }
  }

  return {
    archetype,
    score,
    positive_matches,
    negative_matches,
    disqualified: false,
  };
}

// ============================================
// INVARIANT VALIDATION
// ============================================

interface InvariantValidationResult {
  valid: boolean;
  violations: string[];
  softViolations: string[];
}

/**
 * validateHardInvariants
 * 
 * Checks hard invariants (must block if violated).
 * Collects soft violations for flagging.
 */
function validateHardInvariants(
  rule: ArchetypeSemanticRule,
  fields: Record<string, unknown>
): InvariantValidationResult {
  const violations: string[] = [];
  const softViolations: string[] = [];

  for (const invariant of rule.invariants) {
    const fieldValue = fields[invariant.field];
    let violated = false;

    switch (invariant.condition) {
      case 'must_be':
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
      if (invariant.type === 'hard') {
        violations.push(invariant.error_message);
      } else {
        softViolations.push(invariant.error_message);
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    softViolations,
  };
}

// ============================================
// CONFIDENCE CALCULATION
// ============================================

/**
 * calculateConfidence
 * 
 * Determines confidence level based on:
 * - Number of positive matches
 * - Presence of soft violations
 * - Score magnitude
 */
function calculateConfidence(
  candidate: CandidateArchetype,
  softViolations: string[]
): 'high' | 'medium' | 'low' {
  const positiveCount = candidate.positive_matches.length;
  const negativeCount = candidate.negative_matches.length;

  // High: 2+ positive matches, no negatives, no soft violations
  if (
    positiveCount >= SCORE_WEIGHTS.MIN_POSITIVE_FOR_HIGH &&
    negativeCount === 0 &&
    softViolations.length === 0
  ) {
    return 'high';
  }

  // Low: Only 1 positive match OR soft violations
  if (positiveCount <= 1 || softViolations.length > 0) {
    return 'low';
  }

  // Medium: Everything else
  return 'medium';
}

// ============================================
// UTILITY: Quick archetype check
// ============================================

/**
 * isArchetype
 * 
 * Quick check if text matches a specific archetype.
 * Useful for simple validation.
 */
export function isArchetype(
  text: string,
  targetArchetype: PromoArchetype
): boolean {
  const result = detectArchetype(text, '', {});
  return result.archetype === targetArchetype;
}

/**
 * getTopArchetypeCandidates
 * 
 * Returns top N archetype candidates with scores.
 * Useful for debugging and UI hints.
 */
export function getTopArchetypeCandidates(
  promoName: string,
  terms: string,
  limit: number = 3
): Array<{ archetype: PromoArchetype; score: number; matches: string[] }> {
  const combinedText = `${promoName} ${terms}`.toLowerCase();
  const candidates: Array<{ archetype: PromoArchetype; score: number; matches: string[] }> = [];

  for (const archetype of getAllArchetypes()) {
    const rule = getArchetypeRule(archetype);
    const result = calculateCandidateScore(archetype, rule, combinedText);
    
    if (!result.disqualified && result.score > 0) {
      candidates.push({
        archetype,
        score: result.score,
        matches: result.positive_matches,
      });
    }
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ============================================
// VERSION
// ============================================

export const ARCHETYPE_DETECTOR_VERSION = 'v1.0.0+2025-01-15 (LOCKED)';
