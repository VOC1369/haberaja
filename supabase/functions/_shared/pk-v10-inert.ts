/**
 * PKB_WOLFBRAIN V.10 — INERT FACTORY + MERGE + FIELD-STATUS (edge-safe)
 *
 * Mirror of `createInertPkV10Record` from src/features/promo-knowledge/schema/pk-v10.ts.
 * Plus server-side helpers used by pk-extractor:
 *   - mergeIntoInert()      → deep-merge LLM partial output into full-shape inert record
 *   - computeFieldStatus()  → tag every leaf path: explicit / inferred / not_stated
 *
 * NO V.09 conversion. NO silent fallback. Output is always full-shape PkV10Record.
 *
 * F1 §8.1 doctrine: full-shape JSON, blank defaults, no auto-fill.
 */

import {
  PK_V10_SCHEMA_NAME,
  PK_V10_SCHEMA_VERSION,
  PK_V10_LOCKED_AT,
  PK_V10_CREATED_BY,
  PK_V10_EXTRACTOR,
  PK_V10_PROMPT_VERSION,
} from "./pk-v10-enums.ts";

export type AnyObj = Record<string, unknown>;

// ──────────────────────────────────────────────────────────────────────────
// INERT FACTORY
// ──────────────────────────────────────────────────────────────────────────

function emptyTimeWindowSlot() {
  return { enabled: false, start_time: "", end_time: "", days: [] as string[] };
}
function emptyQuestion() {
  return { answer: "", reasoning: "", evidence: "" };
}

export function createInertPkV10Record(
  recordId: string,
  now: string = new Date().toISOString(),
): AnyObj {
  return {
    domain: "promo_knowledge",
    record_id: recordId,
    created_at: now,
    updated_at: now,

    identity_engine: {
      client_block: { client_id: "", client_id_field_status: "", client_name: "" },
      promo_block: { promo_name: "", promo_type: "", target_user: "", promo_mode: "" },
    },

    classification_engine: {
      result_block: {
        program_classification: "",
        secondary_classifications: [],
        review_confidence: "",
      },
      question_block: {
        q1: emptyQuestion(),
        q2: emptyQuestion(),
        q3: emptyQuestion(),
        q4: emptyQuestion(),
      },
      meta_block: {
        quality_flags: [],
        evidence_count: 0,
        override: false,
        prompt_version: PK_V10_PROMPT_VERSION,
        latency_ms: null,
      },
    },

    taxonomy_engine: {
      mode_block: { mode: "", tier_archetype: null },
      logic_block: { conversion_formula: "", turnover_basis: null },
    },

    period_engine: {
      validity_block: {
        valid_from: null,
        valid_until: null,
        validity_mode: "",
        validity_duration_value: null,
        validity_duration_unit: "",
      },
      distribution_block: {
        claim_frequency: "",
        calculation_period: "",
        distribution_day: "",
      },
    },

    time_window_engine: {
      timezone_block: { timezone: "", offset: "" },
      claim_window_block: emptyTimeWindowSlot(),
      distribution_window_block: emptyTimeWindowSlot(),
      reset_block: { enabled: false, reset_time: "", reset_frequency: "" },
    },

    trigger_engine: {
      primary_trigger_block: { trigger_event: "", action: "", evidence: "" },
      trigger_rule_block: { rule_type: "", conditions: [], logic_operator: "" },
      alternative_triggers_block: { or_conditions: [], and_conditions: [] },
    },

    claim_engine: {
      method_block: { claim_method: "", auto_credit: false },
      channels_block: { channels: [], priority_order: [] },
      proof_requirement_block: {
        proof_required: false,
        proof_types: [],
        proof_destinations: [],
      },
      instruction_block: { claim_steps: [], claim_url: "" },
    },

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
      platform_block: { platform_access: "", apk_required: false },
      geo_block: { geo_restriction: "" },
      blacklist_block: { types: [], providers: [], games: [], rules: [] },
    },

    reward_engine: {
      event_block: { event_rewards: [], prizes: [] },
      requirement_block: { min_deposit: null, unlock_conditions: [] },
      combo_reward_block: { combo_items: [] },
      matrix_reward_block: { axis_x_label: "", axis_y_label: "", matrix_cells: [] },
      conditional_reward_block: { conditions: [], default_reward: null },
      calculation_basis: "",
      calculation_method: "",
      calculation_value: null,
      calculation_unit: "",
      payout_direction: "",
      reward_type: "",
      voucher_kind: null,
      max_reward: null,
      currency: null,
    },

    loyalty_engine: {
      mechanism_block: { point_name: "", earning_rule: "", loyalty_mode: "" },
      exchange_block: { exchange_groups: [] },
      tier_block: { tier_system: [] },
    },

    variant_engine: {
      summary_block: { has_subcategories: false, expected_count: null },
      items_block: { subcategories: [] },
    },

    dependency_engine: {
      exclusion_block: { mutually_exclusive_with: [], can_combine_with: [] },
      stacking_block: {
        stacking_allowed: false,
        stacking_policy: "",
        rules: [],
        max_concurrent: null,
      },
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

    readiness_engine: {
      state_block: { state: "draft", state_changed_at: now, state_changed_by: "" },
      commit_block: { ready_to_commit: false },
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
    },

    reasoning_engine: {
      intent_block: {
        primary_action: "",
        reward_nature: "",
        distribution_path: "",
        value_shape: "",
      },
      selection_block: {
        mechanic_type: "",
        locked_fields: [],
        invariant_violations: [],
      },
    },

    mechanics_engine: {
      source_block: { source: "" },
      items_block: { items: [] },
    },

    projection_engine: {
      _description:
        "DERIVED ONLY. Generated post-extraction. Extractor must NOT write directly.",
      summary_block: {
        promo_summary: "",
        main_trigger: "",
        main_reward_form: "",
        main_reward_percent: null,
        main_reward_value: null,
        main_reward_unit: "",
        max_bonus: null,
        min_base: null,
        payout_direction: "",
        turnover_multiplier: null,
        turnover_basis: "",
      },
      claim_summary_block: {
        primary_claim_method: "",
        primary_claim_platform: "",
        claim_channels: [],
        auto_credit: false,
        proof_required: false,
        claim_frequency: "",
        distribution_day: "",
      },
      scope_summary_block: {
        game_domain: "",
        game_types: [],
        game_providers: [],
        game_exclusions: [],
        platform_access: "",
        apk_required: false,
        geo_restriction: "",
        stacking_policy: "",
      },
      intent_summary_block: {
        intent_category: "",
        primary_action: "",
        reward_nature: "",
        distribution_path: "",
        value_shape: "",
        target_segment: "",
      },
    },

    risk_engine: { level_block: { promo_risk_level: "" } },

    meta_engine: {
      source_block: {
        source_url: "",
        raw_content: "",
        extraction_source: "",
        source_type: "",
      },
      extraction_block: {
        has_rowspan_tables: false,
        html_was_normalized: false,
        client_id_source: null,
        propagated_fields: [],
        ambiguous_blacklists: 0,
        extracted_at: now,
        classification_overridden: false,
        classification_override_reason: "",
        original_llm_category: "",
      },
      schema_block: {
        schema_name: PK_V10_SCHEMA_NAME,
        schema_version: PK_V10_SCHEMA_VERSION,
        locked_at: PK_V10_LOCKED_AT,
        created_by: PK_V10_CREATED_BY,
        status: "locked",
        extractor: PK_V10_EXTRACTOR,
      },
    },

    ai_confidence: {} as Record<string, number>,
    _field_status: {} as Record<string, string>,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// MERGE — deep-merge LLM partial output into full-shape inert record
//
// Rules (F1 §8.1):
//   - inert is the skeleton. LLM output overlays it.
//   - If LLM omits a path → inert default stays (blank).
//   - If LLM provides null/undefined for a value → inert default stays.
//   - If LLM provides "" / [] / false → respected (those are valid blanks).
//   - Arrays are REPLACED (not concatenated).
//   - Objects are RECURSED (not replaced) so partial sub-blocks merge cleanly.
// ──────────────────────────────────────────────────────────────────────────

function isPlainObject(v: unknown): v is AnyObj {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function mergeIntoInert(inert: AnyObj, llm: AnyObj): AnyObj {
  const out: AnyObj = { ...inert };
  for (const key of Object.keys(inert)) {
    const inertVal = inert[key];
    const llmVal = (llm as AnyObj)[key];

    if (llmVal === undefined || llmVal === null) {
      out[key] = inertVal;
      continue;
    }

    if (isPlainObject(inertVal) && isPlainObject(llmVal)) {
      out[key] = mergeIntoInert(inertVal, llmVal);
      continue;
    }

    out[key] = llmVal;
  }
  // Allow LLM to add arbitrary keys to ai_confidence / _field_status maps.
  if (isPlainObject(llm.ai_confidence)) {
    out.ai_confidence = { ...(out.ai_confidence as AnyObj), ...llm.ai_confidence };
  }
  if (isPlainObject(llm._field_status)) {
    out._field_status = { ...(out._field_status as AnyObj), ...llm._field_status };
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// FIELD STATUS — tag every leaf path
//
// Default semantics:
//   - LLM provided a non-blank value for path → keep LLM-supplied status if
//     valid, else default to "explicit".
//   - LLM provided blank ("" / null / [] / 0 for non-bool) → "not_stated".
//   - Booleans: always "explicit" (LLM committed to a value).
//   - Schema-stamp & lifecycle fields (meta_engine.schema_block.*,
//     readiness_engine.state_block.state) → "explicit" (system-set).
//
// Threshold for Admin question (V10.1 backlog): ai_confidence < 0.7
// → status MAY be downgraded to "inferred" if confidence map says so.
// ──────────────────────────────────────────────────────────────────────────

const VALID_FIELD_STATUS = new Set([
  "explicit", "inferred", "derived", "propagated", "not_stated", "not_applicable",
]);

function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function walkLeaves(obj: unknown, prefix: string, out: Map<string, unknown>): void {
  if (Array.isArray(obj)) {
    if (obj.length === 0) { out.set(prefix, obj); return; }
    obj.forEach((item, i) => walkLeaves(item, `${prefix}[${i}]`, out));
    return;
  }
  if (isPlainObject(obj)) {
    if (Object.keys(obj).length === 0) { out.set(prefix, obj); return; }
    for (const k of Object.keys(obj)) {
      walkLeaves(obj[k], prefix ? `${prefix}.${k}` : k, out);
    }
    return;
  }
  out.set(prefix, obj);
}

const SYSTEM_EXPLICIT_PATHS = new Set([
  "domain",
  "record_id",
  "created_at",
  "updated_at",
  "readiness_engine.state_block.state",
  "readiness_engine.state_block.state_changed_at",
  "classification_engine.meta_block.prompt_version",
  "meta_engine.schema_block.schema_name",
  "meta_engine.schema_block.schema_version",
  "meta_engine.schema_block.locked_at",
  "meta_engine.schema_block.created_by",
  "meta_engine.schema_block.status",
  "meta_engine.schema_block.extractor",
  "meta_engine.extraction_block.extracted_at",
]);

export function computeFieldStatus(
  record: AnyObj,
  llmFieldStatus: Record<string, unknown>,
  aiConfidence: Record<string, number>,
  threshold = 0.7,
): Record<string, string> {
  const leaves = new Map<string, unknown>();
  // Walk only domain engines, skip the two metadata maps themselves.
  for (const key of Object.keys(record)) {
    if (key === "ai_confidence" || key === "_field_status") continue;
    walkLeaves(record[key], key, leaves);
  }

  const out: Record<string, string> = {};
  for (const [path, val] of leaves) {
    // 1. System-set paths
    if (SYSTEM_EXPLICIT_PATHS.has(path)) {
      out[path] = "explicit";
      continue;
    }

    // 2. LLM-supplied status wins if valid
    const llmStatus = llmFieldStatus[path];
    if (typeof llmStatus === "string" && VALID_FIELD_STATUS.has(llmStatus)) {
      out[path] = llmStatus;
      continue;
    }

    // 3. Derive from value
    if (isBlank(val)) {
      out[path] = "not_stated";
      continue;
    }

    // 4. Booleans are always an explicit choice
    if (typeof val === "boolean") {
      out[path] = "explicit";
      continue;
    }

    // 5. Confidence-based downgrade
    const conf = aiConfidence[path];
    if (typeof conf === "number" && conf < threshold) {
      out[path] = "inferred";
      continue;
    }

    out[path] = "explicit";
  }

  return out;
}
