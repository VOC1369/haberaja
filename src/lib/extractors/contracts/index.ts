/**
 * Mechanic Contract Registry
 * 
 * Each contract is a self-contained instruction block injected into the
 * LLM prompt ONLY when the pre-classifier detects the relevant mechanic.
 * 
 * Architecture:
 *   Pre-Classifier → detects suspected_mechanics[]
 *   Contract Injector → loads only relevant contracts
 *   LLM → receives base_prompt + injected_contracts (no bloat)
 */

export { LUCKY_SPIN_CONTRACT, LUCKY_SPIN_TITLE_PATTERNS, LUCKY_SPIN_BODY_PATTERNS } from './lucky-spin';
export { MERCHANDISE_CONTRACT, MERCHANDISE_TITLE_PATTERNS, MERCHANDISE_BODY_PATTERNS } from './merchandise';

// ============================================
// PRE-CLASSIFIER
// Hybrid: title pattern (high confidence) + body keyword count (medium confidence)
// Returns: list of mechanic slugs to inject
// ============================================

import {
  LUCKY_SPIN_TITLE_PATTERNS,
  LUCKY_SPIN_BODY_PATTERNS,
} from './lucky-spin';
import {
  MERCHANDISE_TITLE_PATTERNS,
  MERCHANDISE_BODY_PATTERNS,
} from './merchandise';

export type DetectedMechanic = 'lucky_spin' | 'merchandise';

interface ContractMatch {
  mechanic: DetectedMechanic;
  confidence: 'high' | 'medium' | 'low';
  matched_by: 'title' | 'body' | 'both';
}

/**
 * Pre-classify the promo content to detect which mechanic contracts to inject.
 * Uses title patterns (high confidence) + body keyword counting (medium confidence).
 * 
 * @param content - Full promo text content
 * @param titleHint - Optional: first ~200 chars or explicit title text
 * @returns Array of matched mechanics, sorted by confidence desc
 */
export function detectMechanicContracts(
  content: string,
  titleHint?: string
): ContractMatch[] {
  const matches: ContractMatch[] = [];
  
  // Use first 300 chars as title region if no explicit title hint
  const titleRegion = (titleHint || content.substring(0, 300)).toLowerCase();
  const fullText = content.toLowerCase();

  // ============================================
  // LUCKY SPIN detection
  // ============================================
  const luckySpinTitleMatch = LUCKY_SPIN_TITLE_PATTERNS.some(p => p.test(titleRegion));
  const luckySpinBodyMatches = LUCKY_SPIN_BODY_PATTERNS.filter(p => p.test(fullText)).length;

  if (luckySpinTitleMatch) {
    matches.push({
      mechanic: 'lucky_spin',
      confidence: 'high',
      matched_by: luckySpinBodyMatches >= 1 ? 'both' : 'title',
    });
  } else if (luckySpinBodyMatches >= 2) {
    matches.push({
      mechanic: 'lucky_spin',
      confidence: 'medium',
      matched_by: 'body',
    });
  }

  // ============================================
  // MERCHANDISE detection
  // ============================================
  const merchandiseTitleMatch = MERCHANDISE_TITLE_PATTERNS.some(p => p.test(titleRegion));
  const merchandiseBodyMatches = MERCHANDISE_BODY_PATTERNS.filter(p => p.test(fullText)).length;

  if (merchandiseTitleMatch) {
    matches.push({
      mechanic: 'merchandise',
      confidence: 'high',
      matched_by: merchandiseBodyMatches >= 1 ? 'both' : 'title',
    });
  } else if (merchandiseBodyMatches >= 2) {
    matches.push({
      mechanic: 'merchandise',
      confidence: 'medium',
      matched_by: 'body',
    });
  }

  // Sort: high > medium > low
  return matches.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.confidence] - order[b.confidence];
  });
}

// ============================================
// CONTRACT INJECTOR
// Builds the mechanic-specific section to append to base prompt
// ============================================

import { LUCKY_SPIN_CONTRACT } from './lucky-spin';
import { MERCHANDISE_CONTRACT } from './merchandise';

const CONTRACT_MAP: Record<DetectedMechanic, string> = {
  lucky_spin: LUCKY_SPIN_CONTRACT,
  merchandise: MERCHANDISE_CONTRACT,
};

/**
 * Build the contract injection block to append to the base prompt.
 * Only includes contracts for detected mechanics (max 2 to avoid bloat).
 * 
 * @param detected - Array from detectMechanicContracts()
 * @returns String to append to extraction prompt, or empty string if no match
 */
export function buildContractInjection(detected: ContractMatch[]): string {
  if (detected.length === 0) return '';

  // Inject max 2 contracts (primary + fallback if ambiguous)
  const toInject = detected.slice(0, 2);

  const blocks = toInject.map(match => {
    const contract = CONTRACT_MAP[match.mechanic];
    return `\n\n[KONTRAK INJECTED: ${match.mechanic.toUpperCase()} — confidence: ${match.confidence}, source: ${match.matched_by}]\n${contract}`;
  });

  return blocks.join('\n');
}
