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
 * ============================================================
 * VERSION CONTRACT (locked 2026-04-24, A.1)
 * ============================================================
 * The PK record carries FIVE distinct version-like fields. Each one
 * answers a different question. Do NOT collapse them.
 *
 *   governance_version  ("V.06")
 *     Authority: PK_REGISTRY (this file).
 *     Purpose:   Doctrine version — the rule/policy/governance
 *                cycle that governs review process, lifecycle,
 *                and "is this allowed" decisions.
 *     Bumps on: major doctrine cycle (V.06 → V.07).
 *
 *   domain_version  ("PK-06.0")
 *     Authority: PK_REGISTRY (this file).
 *     Purpose:   Domain schema version — structural shape of the
 *                PK record (engine count, top-level keys).
 *     Bumps on: any add/remove of an engine or top-level key.
 *
 *   _schema.version  ("1.1")
 *     Authority: PK_REGISTRY.spec_historical_alias (this file).
 *     Purpose:   Spec-historical alias from ARD V.06 §J. INFO ONLY.
 *                Validator MUST NOT treat this as runtime authority.
 *                May be dropped at doctrine V.07.
 *
 *   meta_engine.classification_engine.meta_block.prompt_version  ("v09")
 *     Authority: pk-extractor edge function (hardcoded).
 *     Purpose:   Extractor prompt + tool schema version used by the LLM.
 *     Bumps on: any system-prompt or tool-schema tune (independent
 *               of doctrine/domain).
 *
 *   meta_engine.schema_block.extractor  ("pk-extractor@claude-sonnet-4-5")
 *     Authority: extract-client.ts (post-extraction stamp).
 *     Purpose:   Extractor identity — pipeline name + LLM model used.
 *                Audit trail: "who generated this record".
 *     Bumps on: pipeline rename or LLM model swap.
 *
 * ============================================================
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
