/**
 * PK-06.0 TYPES — derived from PSEUDO_ENGINE_SCHEMA_V06_SPEC.md
 *
 * Scope (Gate 1 first vertical slice):
 *   - Governance metadata (D-6) at top level
 *   - readiness_engine (state machine + observability) — required for lifecycle_state UX
 *   - claim_engine (first vertical slice — full strict types)
 *   - All other 21 engines: shape-permissive (Record<string, unknown>) for now,
 *     to keep the JSON full-shape (per ARD inert contract) without forcing
 *     premature type lock-in. They will be tightened in subsequent slices.
 *
 * Spec authority: Schema V.06 wins for field-level contract.
 */

// ============================================================
// CLAIM ENGINE — FULL STRICT TYPES (first vertical slice)
// ============================================================

/** Schema V.06 §6.7 */
export const CLAIM_METHOD_ENUM = [
  "auto",
  "manual_livechat",
  "manual_whatsapp",
  "manual_telegram",
  "in_app_button",
  "form_submission",
  "cs_approval",
] as const;
export type ClaimMethod = typeof CLAIM_METHOD_ENUM[number] | "";

/** Schema V.06 §6.7 */
export const CLAIM_CHANNEL_ENUM = [
  "livechat",
  "whatsapp",
  "telegram",
  "facebook",
  "website_form",
  "apk_redemption",
  "email",
  "phone_call",
] as const;
export type ClaimChannel = typeof CLAIM_CHANNEL_ENUM[number];

/** Schema V.06 §6.8 */
export const PROOF_TYPE_ENUM = [
  "screenshot_win",
  "screenshot_bill",
  "screenshot_wd",
  "screenshot_deposit",
  "screenshot_apk",
  "foto_ktp",
  "foto_rekening",
  "parlay_ticket",
] as const;
export type ProofType = typeof PROOF_TYPE_ENUM[number];

/** Schema V.06 §6.8 */
export const PROOF_DESTINATION_ENUM = [
  "livechat",
  "whatsapp_official",
  "telegram_official",
  "telegram_group",
  "facebook_group",
  "facebook_official",
] as const;
export type ProofDestination = typeof PROOF_DESTINATION_ENUM[number];

export interface ClaimMethodBlock {
  claim_method: ClaimMethod;
  auto_credit: boolean;
}

export interface ClaimChannelsBlock {
  channels: ClaimChannel[];
  priority_order: ClaimChannel[];
}

export interface ClaimProofRequirementBlock {
  proof_required: boolean;
  proof_types: ProofType[];
  proof_destinations: ProofDestination[];
}

export interface ClaimInstructionBlock {
  claim_steps: string[];
  claim_url: string;
}

export interface ClaimEngine {
  method_block: ClaimMethodBlock;
  channels_block: ClaimChannelsBlock;
  proof_requirement_block: ClaimProofRequirementBlock;
  instruction_block: ClaimInstructionBlock;
}

// ============================================================
// READINESS ENGINE — typed (state machine + observability)
// Schema V.06 §4.19
// ============================================================

export const LIFECYCLE_STATE_ENUM = [
  "ai_draft",
  "reviewed",
  "finalized",
  "published",
  "archived",
] as const;
export type LifecycleState = typeof LIFECYCLE_STATE_ENUM[number];

export const VALIDATION_STATUS_ENUM = [
  "draft",
  "ready",
  "needs_review",
  "rejected",
  "published",
] as const;
export type ValidationStatus = typeof VALIDATION_STATUS_ENUM[number] | "";

export interface ReadinessEngine {
  state_block: {
    state: LifecycleState;
    state_changed_at: string;
    state_changed_by: string;
  };
  commit_block: {
    ready_to_commit: boolean;
  };
  validation_block: {
    is_structurally_complete: boolean;
    status: ValidationStatus;
    warnings: string[];
  };
  observability_block: {
    ambiguity_flags: string[];
    contradiction_flags: string[];
    review_required: boolean;
  };
}

// ============================================================
// AI CONFIDENCE TRACKING (per-field, sparse map)
// Schema V.06 §6.19 — AI_CONFIDENCE 0..1
// Stored under extraction_block to keep top-level shape clean.
// ============================================================

/** Path-keyed confidence map. Key = JSON path like "claim_engine.method_block.claim_method". */
export type AiConfidenceMap = Record<string, number>;

// ============================================================
// PERMISSIVE ENGINES (not yet typed in this slice)
// ============================================================
type PermissiveEngine = Record<string, unknown>;

// ============================================================
// PROMO KNOWLEDGE RECORD (top-level shape)
// D-6: governance_version + domain_version + domain are MANDATORY.
// ============================================================

export interface PromoKnowledgeRecord {
  // ---- D-6 governance metadata (top-level, registry-injected, MANDATORY) ----
  governance_version: "V.06";
  domain_version: "PK-06.0";
  domain: "promo_knowledge";

  // ---- Spec-historical alias (info-only, not runtime authority) ----
  _schema: {
    version: string;
    locked_at: string;
    ref: string;
  };

  // ---- Per-record identity ----
  record_id: string; // generated, used as localStorage key
  created_at: string;
  updated_at: string;

  // ---- Engines: typed where in-slice, permissive otherwise ----
  identity_engine: PermissiveEngine;
  classification_engine: PermissiveEngine;
  taxonomy_engine: PermissiveEngine;
  period_engine: PermissiveEngine;
  time_window_engine: PermissiveEngine;
  trigger_engine: PermissiveEngine;

  /** ⭐ FIRST VERTICAL SLICE — fully typed */
  claim_engine: ClaimEngine;

  proof_engine: PermissiveEngine;
  payment_engine: PermissiveEngine;
  scope_engine: PermissiveEngine;
  reward_engine: PermissiveEngine;
  loyalty_engine: PermissiveEngine;
  variant_engine: PermissiveEngine;
  dependency_engine: PermissiveEngine;
  invalidation_engine: PermissiveEngine;
  terms_engine: PermissiveEngine;

  /** Typed — needed for lifecycle_state UX */
  readiness_engine: ReadinessEngine;

  reasoning_engine: PermissiveEngine;
  mechanics_engine: PermissiveEngine;
  projection_engine: PermissiveEngine;
  risk_engine: PermissiveEngine;
  meta_engine: PermissiveEngine;

  // ---- AI confidence map (per field path) ----
  ai_confidence: AiConfidenceMap;
}
