/**
 * INERT (empty-shape) factory for a fresh PK-06.0 record.
 * Adheres to Schema V.06 §12 JSON skeleton conventions:
 *   "" = field set, intentionally empty
 *   null = field not set / unknown
 *   [] = empty array, list concept exists
 *   false = boolean default
 *
 * Default lifecycle_state = "ai_draft" (Schema V.06 §12 line 1361).
 * Governance metadata injected from Registry (D-6).
 */

import { buildGovernanceMetadata, buildSchemaHistorical } from "../registry";
import type { PromoKnowledgeRecord, ClaimEngine, ReadinessEngine } from "./pk-06.0";

export function createInertClaimEngine(): ClaimEngine {
  return {
    method_block: {
      claim_method: "",
      auto_credit: false,
    },
    channels_block: {
      channels: [],
      priority_order: [],
    },
    proof_requirement_block: {
      proof_required: false,
      proof_types: [],
      proof_destinations: [],
    },
    instruction_block: {
      claim_steps: [],
      claim_url: "",
    },
  };
}

export function createInertReadinessEngine(): ReadinessEngine {
  return {
    state_block: {
      state: "ai_draft",
      state_changed_at: "",
      state_changed_by: "",
    },
    commit_block: {
      ready_to_commit: false,
    },
    validation_block: {
      is_structurally_complete: false,
      status: "",
      warnings: [],
    },
    observability_block: {
      ambiguity_flags: [],
      contradiction_flags: [],
      review_required: false,
    },
  };
}

/**
 * Generate a new PK-06.0 record with full inert shape and registry-injected
 * governance metadata. ID is required from caller (storage layer generates).
 */
export function createInertPromoKnowledgeRecord(record_id: string): PromoKnowledgeRecord {
  const now = new Date().toISOString();
  const gov = buildGovernanceMetadata();

  return {
    ...gov,
    _schema: buildSchemaHistorical(),

    record_id,
    created_at: now,
    updated_at: now,

    identity_engine: {
      client_block: { client_id: "", client_id_field_status: "", client_name: "" },
      promo_block: { promo_name: "", promo_type: "", target_user: "", promo_mode: "" },
    },
    classification_engine: {
      result_block: { program_classification: "", secondary_classifications: [], review_confidence: "" },
      question_block: {
        q1: { answer: "", reasoning: "", evidence: "" },
        q2: { answer: "", reasoning: "", evidence: "" },
        q3: { answer: "", reasoning: "", evidence: "" },
        q4: { answer: "", reasoning: "", evidence: "" },
      },
      meta_block: { quality_flags: [], evidence_count: 0, override: false, prompt_version: "", latency_ms: null },
    },
    taxonomy_engine: {
      mode_block: { mode: "", tier_archetype: null },
      logic_block: { conversion_formula: "", turnover_basis: null },
    },
    period_engine: {
      validity_block: { valid_from: "", valid_until: "" },
      distribution_block: { claim_frequency: "", calculation_period: "", distribution_day: "" },
    },
    time_window_engine: {
      timezone_block: { timezone: "", offset: "" },
      claim_window_block: {},
      distribution_window_block: {},
      reset_block: {},
    },
    trigger_engine: {
      primary_trigger_block: { trigger_event: "", action: "", evidence: "" },
      trigger_rule_block: { rule_type: "", conditions: [], logic_operator: "" },
      alternative_triggers_block: { or_conditions: [], and_conditions: [] },
    },

    claim_engine: createInertClaimEngine(),

    proof_engine: {
      social_proof_block: { platforms: [], hashtags: [], content_requirements: [] },
      screenshot_proof_block: { ss_targets: [], rules: [] },
    },
    payment_engine: {
      deposit_block: { deposit_method: "", deposit_rate: null },
      method_whitelist_block: { methods: [], providers: [] },
      method_blacklist_block: { methods: [], providers: [] },
    },
    scope_engine: {
      game_block: { game_domain: "", markets: [], eligible_providers: [] },
      blacklist_block: { types: [], providers: [], games: [], rules: [] },
    },
    reward_engine: {
      event_block: { event_rewards: [], prizes: [] },
      requirement_block: { min_deposit: null, unlock_conditions: [] },
      combo_reward_block: { combo_items: [] },
      matrix_reward_block: { axis_x_label: "", axis_y_label: "", matrix_cells: [] },
      conditional_reward_block: { conditions: [], default_reward: null },
    },
    loyalty_engine: {
      mechanism_block: { point_name: "", earning_rule: "" },
      exchange_block: { exchange_groups: [] },
      tier_block: { tier_system: [] },
    },
    variant_engine: {
      summary_block: { has_subcategories: false, expected_count: null },
      items_block: { subcategories: [] },
    },
    dependency_engine: {
      exclusion_block: { mutually_exclusive_with: [], can_combine_with: [] },
      stacking_block: { stacking_allowed: false, stacking_policy: "", rules: [], max_concurrent: null },
      prerequisite_block: { requires_promo: [], requires_achievement: [] },
    },
    invalidation_engine: {
      void_conditions_block: [],
      penalty_block: { void_action: "", penalty_type: "", penalty_scope: "" },
      anti_fraud_block: { anti_fraud_rules: [], detection_methods: [] },
    },
    terms_engine: {
      conditions_block: { terms_conditions: [] },
      requirements_block: { special_requirements: [] },
    },

    readiness_engine: createInertReadinessEngine(),

    reasoning_engine: {
      intent_block: { primary_action: "", reward_nature: "", distribution_path: "", value_shape: "" },
      selection_block: { mechanic_type: "", locked_fields: [], invariant_violations: [] },
    },
    mechanics_engine: {
      source_block: { source: "" },
      items_block: { items: [] },
    },
    projection_engine: {
      _description: "DERIVED ONLY. Generated post-extraction. Extractor must NOT write directly.",
      summary_block: {},
      claim_summary_block: {},
      scope_summary_block: {},
      intent_summary_block: {},
    },
    risk_engine: {
      level_block: { promo_risk_level: "" },
    },
    meta_engine: {
      source_block: { source_url: "", raw_content: "", extraction_source: "", source_type: "" },
      extraction_block: {
        has_rowspan_tables: false,
        html_was_normalized: false,
        client_id_source: null,
        propagated_fields: [],
        ambiguous_blacklists: 0,
        extracted_at: "",
        classification_overridden: false,
        classification_override_reason: "",
        original_llm_category: "",
      },
      schema_block: {
        schema_name: "Pseudo Engine Schema",
        schema_version: "1.1", // spec-historical alias, not runtime authority
        created_by: "habe_raja",
        status: "locked",
        evolved_from: "1.0",
        extractor: "",
      },
    },

    ai_confidence: {},
  };
}
