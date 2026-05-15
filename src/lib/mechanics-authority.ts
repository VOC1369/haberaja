/**
 * mechanics-authority.ts — Authority Inversion Utilities v1.0
 * 
 * Two strictly separated functions:
 * 
 * 1. isMechanicsAuthoritative() — STRUCTURAL ONLY
 *    Decides: "Can we trust this mechanics array as input?"
 *    No domain reasoning. No semantic inference.
 * 
 * 2. deriveModeFromMechanics() — SEMANTIC
 *    Decides: "What mode and tier_archetype does this mechanics array describe?"
 *    Contains domain-specific reasoning.
 * 
 * RULE: Validity decides trust. Derivation decides meaning.
 *       Never mix the two.
 */

// ============================================
// 1. isMechanicsAuthoritative — STRUCTURAL ONLY
// ============================================

/**
 * Checks if a _mechanics_v31 array is structurally valid enough
 * to be trusted as the authority for mode/tier_archetype.
 * 
 * Checks ONLY structure:
 * - exists
 * - is array
 * - non-empty
 * - every node has mechanic_type (string)
 * - every node has data (object)
 * 
 * Does NOT check semantic content (no domain reasoning).
 */
export function isMechanicsAuthoritative(mechanics: unknown): mechanics is MechanicNode[] {
  if (!Array.isArray(mechanics) || mechanics.length === 0) return false;

  return mechanics.every(m =>
    typeof m === 'object' && m !== null &&
    typeof (m as Record<string, unknown>).mechanic_type === 'string' &&
    (m as Record<string, unknown>).mechanic_type !== '' &&
    typeof (m as Record<string, unknown>).data === 'object' &&
    (m as Record<string, unknown>).data !== null
  );
}

// ============================================
// 2. deriveModeFromMechanics — SEMANTIC
// ============================================

export interface MechanicsAuthority {
  mode: 'formula' | 'fixed' | 'tier';
  tier_archetype: string | null;
  source: 'mechanics_v31';
  reasoning: string;
}

interface MechanicNode {
  mechanic_type: string;
  data: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Derives mode and tier_archetype from a structurally valid mechanics array.
 * 
 * MUST only be called after isMechanicsAuthoritative() returns true.
 * 
 * Derivation rules:
 * - Has state mechanic with tiers[] → mode = 'tier'
 *   - tier_archetype read from data.tier_archetype first
 *   - fallback: storage_key === 'loyalty_point_balance' → 'point_store'
 *   - fallback: 'level' (safe default)
 * - Has calculation mechanic with formula → mode = 'formula'
 * - Otherwise → mode = 'fixed'
 */
export function deriveModeFromMechanics(mechanics: MechanicNode[]): MechanicsAuthority {
  const stateM = mechanics.find(m => m.mechanic_type === 'state');
  const calcM = mechanics.find(m => m.mechanic_type === 'calculation');

  const stateData = stateM?.data || {};
  const calcData = calcM?.data || {};

  // Check for tiers
  const hasTiers = Array.isArray(stateData.tiers) && (stateData.tiers as unknown[]).length > 0;

  if (hasTiers) {
    // Derive tier_archetype
    let tierArchetype: string;
    if (typeof stateData.tier_archetype === 'string' && stateData.tier_archetype) {
      // Explicit tier_archetype in state data — highest priority
      tierArchetype = stateData.tier_archetype;
    } else if (stateData.storage_key === 'loyalty_point_balance') {
      tierArchetype = 'point_store';
    } else {
      tierArchetype = 'level';
    }

    return {
      mode: 'tier',
      tier_archetype: tierArchetype,
      source: 'mechanics_v31',
      reasoning: `state.tiers[${(stateData.tiers as unknown[]).length}], archetype=${tierArchetype}`,
    };
  }

  // Check for formula calculation
  if (calcData.formula) {
    return {
      mode: 'formula',
      tier_archetype: null,
      source: 'mechanics_v31',
      reasoning: `calculation.formula="${calcData.formula}"`,
    };
  }

  // Default: fixed
  return {
    mode: 'fixed',
    tier_archetype: null,
    source: 'mechanics_v31',
    reasoning: 'no tiers, no formula → fixed',
  };
}
