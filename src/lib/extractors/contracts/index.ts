/**
 * Mechanic Contract Registry — v2.0 (Taxonomy-Driven)
 *
 * ARCHITECTURE CHANGE (v2.0):
 * ❌ OLD: detectMechanicContracts(rawContent: string) — scanned raw text directly
 * ✅ NEW: detectMechanicContracts(mechanicType: string, archetypeHint?: string)
 *         — receives mechanic type from taxonomy/mechanic-router output
 *
 * WHY:
 * Contract injection MUST follow taxonomy output, not raw text keywords.
 * Keywords may be evidence; they are NOT decision-makers.
 * The mechanicType is already resolved by the Primitive Gate + Mechanic Router
 * before this function is called.
 *
 * FLOW:
 *   Primitive Gate → Mechanic Router → mechanicType
 *   → detectMechanicContracts(mechanicType)
 *   → inject only the relevant contract
 *   → LLM receives base_prompt + injected_contracts
 */

export { LUCKY_SPIN_CONTRACT } from './lucky-spin';
export { MERCHANDISE_CONTRACT } from './merchandise';
export { ROLLINGAN_CONTRACT } from './rollingan';
export { REFERRAL_CONTRACT } from './referral';

import { LUCKY_SPIN_CONTRACT } from './lucky-spin';
import { MERCHANDISE_CONTRACT } from './merchandise';
import { ROLLINGAN_CONTRACT } from './rollingan';
import { REFERRAL_CONTRACT } from './referral';

// ============================================
// CONTRACT MATCH TYPE
// ============================================

export interface ContractMatch {
  mechanic: string;
  confidence: 'high';           // Always high — source is taxonomy, not heuristic
  source: 'mechanic_type';      // Always mechanic_type — never raw text scan
  contract: string;
}

// ============================================
// CONTRACT REGISTRY
// Add new mechanic contracts here as system grows.
// Key = MechanicType value from mechanic-router.ts
// ============================================

const CONTRACT_REGISTRY: Record<string, string> = {
  lucky_spin: LUCKY_SPIN_CONTRACT,
  merchandise_reward: MERCHANDISE_CONTRACT,
};

// ============================================
// CONTRACT DETECTOR — Taxonomy-Driven
//
// Receives mechanicType already resolved by:
//   Primitive Gate → Mechanic Router → MechanicType
//
// Does NOT scan raw text. Does NOT use regex on content.
// Keyword evidence was already consumed upstream.
// ============================================

/**
 * Detect which mechanic contract to inject based on taxonomy output.
 *
 * @param mechanicType - MechanicType from mechanic-router.ts (e.g. 'lucky_spin')
 * @param archetypeHint - Optional PromoArchetype for secondary contract lookup
 * @returns Array of ContractMatch (max 1-2), empty if no contract registered
 */
export function detectMechanicContracts(
  mechanicType: string,
  archetypeHint?: string
): ContractMatch[] {
  const matches: ContractMatch[] = [];

  // Primary lookup: mechanicType → contract
  const primaryContract = CONTRACT_REGISTRY[mechanicType];
  if (primaryContract) {
    matches.push({
      mechanic: mechanicType,
      confidence: 'high',
      source: 'mechanic_type',
      contract: primaryContract,
    });
  }

  // Secondary lookup: archetypeHint as fallback
  // Only inject if not already covered by primary and archetype has a mapped contract.
  // Example: LUCKY_DRAW archetype → lucky_spin contract (if mechanicType is 'unknown')
  if (archetypeHint && matches.length === 0) {
    const archetypeToMechanic: Record<string, string> = {
      LUCKY_DRAW: 'lucky_spin',
    };
    const mappedMechanic = archetypeToMechanic[archetypeHint];
    if (mappedMechanic) {
      const fallbackContract = CONTRACT_REGISTRY[mappedMechanic];
      if (fallbackContract) {
        matches.push({
          mechanic: mappedMechanic,
          confidence: 'high',
          source: 'mechanic_type',
          contract: fallbackContract,
        });
      }
    }
  }

  return matches;
}

// ============================================
// CONTRACT INJECTOR
// Builds the mechanic-specific block to append to base prompt.
// ============================================

/**
 * Build the contract injection block to append to the extraction prompt.
 *
 * @param detected - Array from detectMechanicContracts()
 * @returns String to append to extraction prompt, or empty string if no match
 */
export function buildContractInjection(detected: ContractMatch[]): string {
  if (detected.length === 0) return '';

  const blocks = detected.map(match =>
    `\n\n[KONTRAK INJECTED: ${match.mechanic.toUpperCase()} — confidence: ${match.confidence}, source: ${match.source}]\n${match.contract}`
  );

  return blocks.join('\n');
}
