/**
 * PROMO KNOWLEDGE — SCHEMA REGISTRY
 *
 * Single source of truth for governance metadata (D-6 mandatory).
 * Every PK JSON written to storage MUST carry these three fields at top-level,
 * injected from this registry — NEVER hardcoded elsewhere.
 *
 * Spec reference: ARD V.06.4 §J (Version Governance)
 *                 PSEUDO_ENGINE_SCHEMA_V06_SPEC.md
 *
 * Note on dual-layer governance:
 *   - Runtime authority  → governance_version + domain_version + domain (THIS file)
 *   - Spec-historical    → _schema.version "1.1" preserved as legacy alias (info-only)
 *   Validator treats _schema.version mismatch as info, NOT error.
 */

export const PK_REGISTRY = {
  governance_version: "V.06",
  domain_version: "PK-06.0",
  domain: "promo_knowledge",
  schema_ref: "pseudo-engine-schema-v06-spec.md",
  spec_historical_alias: "1.1", // do NOT use as runtime authority
  locked_at: "2026-04-24",
} as const;

export type GovernanceMetadata = {
  governance_version: typeof PK_REGISTRY.governance_version;
  domain_version: typeof PK_REGISTRY.domain_version;
  domain: typeof PK_REGISTRY.domain;
};

/**
 * Build the canonical governance metadata block.
 * Use this anywhere you need to inject D-6 fields.
 */
export function buildGovernanceMetadata(): GovernanceMetadata {
  return {
    governance_version: PK_REGISTRY.governance_version,
    domain_version: PK_REGISTRY.domain_version,
    domain: PK_REGISTRY.domain,
  };
}

/**
 * Spec-historical _schema block (legacy alias preserved for fidelity to Schema V.06 §4.2).
 */
export function buildSchemaHistorical() {
  return {
    version: PK_REGISTRY.spec_historical_alias,
    locked_at: PK_REGISTRY.locked_at,
    ref: PK_REGISTRY.schema_ref,
  };
}
