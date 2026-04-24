/**
 * EXTRACTOR CLIENT — bridge dari Edge Function `pk-extractor`
 * ke `PromoKnowledgeRecord` (Json Schema Draft V.09).
 *
 * Edge Function output: flat-ish per engine (sesuai tool schema sederhana).
 * Storage shape: nested `*_block` (sesuai inert.ts / Schema V.06 spec).
 *
 * Mapper ini menjembatani — tidak meng-invent data, hanya RESHAPE.
 * Field yang tidak ada di output edge function → kosong/null sesuai inert default.
 */

import { supabase } from "@/integrations/supabase/client";
import { createInertPromoKnowledgeRecord } from "../schema/inert";
import type { PromoKnowledgeRecord } from "../schema/pk-06.0";

export interface ExtractRequest {
  text: string;
  images: string[]; // data URLs or https URLs
  client_id_hint?: string;
}

export interface ExtractResponse {
  ok: boolean;
  record?: PromoKnowledgeRecord;
  raw_engines?: Record<string, unknown>;
  extraction_source?: "text" | "image" | "multimodal";
  model?: string;
  error?: string;
  message?: string;
}

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

type AnyObj = Record<string, unknown>;
const obj = (v: unknown): AnyObj => (v && typeof v === "object" ? (v as AnyObj) : {});
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const arr = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const bool = (v: unknown): boolean => v === true;
const numOrNull = (v: unknown): number | null =>
  typeof v === "number" && !Number.isNaN(v) ? v : null;
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/**
 * Reshape flat engines (dari LLM tool call) → nested *_block shape (sesuai inert).
 */
function mergeEnginesIntoRecord(
  base: PromoKnowledgeRecord,
  engines: AnyObj,
  extractionSource: string,
): PromoKnowledgeRecord {
  const ident = obj(engines.identity_engine);
  const identClient = obj(ident.client_block);
  const identPromo = obj(ident.promo_block);

  const cls = obj(engines.classification_engine);
  const clsResult = obj(cls.result_block);
  const clsQ = obj(cls.question_block);

  const tax = obj(engines.taxonomy_engine);
  const period = obj(engines.period_engine);
  const tw = obj(engines.time_window_engine);
  const trig = obj(engines.trigger_engine);
  const claim = obj(engines.claim_engine);
  const claimMethod = obj(claim.method_block);
  const claimChan = obj(claim.channels_block);
  const claimProof = obj(claim.proof_requirement_block);
  const claimInstr = obj(claim.instruction_block);
  const proof = obj(engines.proof_engine);
  const pay = obj(engines.payment_engine);
  const scope = obj(engines.scope_engine);
  const reward = obj(engines.reward_engine);
  const loyalty = obj(engines.loyalty_engine);
  const variant = obj(engines.variant_engine);
  const dep = obj(engines.dependency_engine);
  const inv = obj(engines.invalidation_engine);
  const terms = obj(engines.terms_engine);
  const reason = obj(engines.reasoning_engine);
  const mech = obj(engines.mechanics_engine);
  const proj = obj(engines.projection_engine);
  const risk = obj(engines.risk_engine);
  const notes = obj(engines.extraction_notes);

  const aiConfidence = obj(engines.ai_confidence) as Record<string, number>;
  const fieldStatus = obj(engines.field_status) as Record<string, string>;

  return {
    ...base,
    identity_engine: {
      client_block: {
        client_id: str(identClient.client_id),
        client_id_field_status: str(identClient.client_id_field_status),
        client_name: str(identClient.client_name),
      },
      promo_block: {
        promo_name: str(identPromo.promo_name),
        promo_type: str(identPromo.promo_type),
        target_user: str(identPromo.target_user),
        promo_mode: str(identPromo.promo_mode),
      },
    },
    classification_engine: {
      result_block: {
        program_classification: str(clsResult.program_classification),
        secondary_classifications: [],
        review_confidence: str(clsResult.review_confidence),
      },
      question_block: {
        q1: { answer: str(obj(clsQ.q1).answer), reasoning: str(obj(clsQ.q1).reasoning), evidence: "" },
        q2: { answer: str(obj(clsQ.q2).answer), reasoning: str(obj(clsQ.q2).reasoning), evidence: "" },
        q3: { answer: str(obj(clsQ.q3).answer), reasoning: str(obj(clsQ.q3).reasoning), evidence: "" },
        q4: { answer: str(obj(clsQ.q4).answer), reasoning: str(obj(clsQ.q4).reasoning), evidence: "" },
      },
      meta_block: { quality_flags: [], evidence_count: 0, override: false, prompt_version: "v09", latency_ms: null },
    },
    taxonomy_engine: {
      mode_block: { mode: str(tax.mode), tier_archetype: strOrNull(tax.tier_archetype) },
      logic_block: { conversion_formula: "", turnover_basis: strOrNull(tax.turnover_basis) },
    },
    period_engine: {
      validity_block: { valid_from: str(period.valid_from), valid_until: str(period.valid_until) },
      distribution_block: {
        claim_frequency: str(period.claim_frequency),
        calculation_period: str(period.calculation_period),
        distribution_day: str(period.distribution_day),
      },
    },
    time_window_engine: {
      timezone_block: { timezone: str(tw.timezone), offset: str(tw.offset) },
      claim_window_block: { open_ended: bool(tw.open_ended) },
      distribution_window_block: {},
      reset_block: {},
    },
    trigger_engine: {
      primary_trigger_block: { trigger_event: str(trig.trigger_event), action: "", evidence: "" },
      trigger_rule_block: {
        rule_type: "",
        conditions: arr<AnyObj>(trig.conditions).map((c) => ({
          field: str(c.field),
          operator: str(c.operator),
          value: c.value ?? null,
          currency: str(c.currency),
        })),
        logic_operator: str(trig.logic_operator),
      },
      alternative_triggers_block: { or_conditions: [], and_conditions: [] },
    },
    claim_engine: {
      method_block: {
        claim_method: str(claimMethod.claim_method),
        auto_credit: bool(claimMethod.auto_credit),
      },
      channels_block: {
        channels: arr<string>(claimChan.channels).filter((s) => typeof s === "string"),
        priority_order: arr<string>(claimChan.priority_order).filter((s) => typeof s === "string"),
      },
      proof_requirement_block: {
        proof_required: bool(claimProof.proof_required),
        proof_types: arr<string>(claimProof.proof_types).filter((s) => typeof s === "string"),
        proof_destinations: arr<string>(claimProof.proof_destinations).filter((s) => typeof s === "string"),
      },
      instruction_block: {
        claim_steps: arr<string>(claimInstr.claim_steps).filter((s) => typeof s === "string"),
        claim_url: str(claimInstr.claim_url),
      },
    },
    proof_engine: {
      social_proof_block: {
        platforms: [],
        hashtags: [],
        content_requirements: [],
      },
      screenshot_proof_block: {
        ss_targets: arr<string>(proof.proof_destinations),
        rules: [],
      },
    },
    payment_engine: {
      deposit_block: { deposit_method: str(pay.deposit_method), deposit_rate: null },
      method_whitelist_block: { methods: [], providers: arr<string>(pay.deposit_providers) },
      method_blacklist_block: { methods: [], providers: [] },
    },
    scope_engine: {
      game_block: {
        game_domain: str(scope.game_domain),
        markets: [],
        eligible_providers: arr<string>(scope.game_providers),
      },
      blacklist_block: {
        types: arr<string>(scope.blacklist_categories),
        providers: [],
        games: [],
        rules: [],
      },
    },
    reward_engine: {
      event_block: { event_rewards: [], prizes: [] },
      requirement_block: { min_deposit: numOrNull(reward.min_base), unlock_conditions: [] },
      combo_reward_block: { combo_items: [] },
      matrix_reward_block: { axis_x_label: "", axis_y_label: "", matrix_cells: [] },
      conditional_reward_block: { conditions: [], default_reward: null },
      // V.09 flat fields (added at top level of reward_engine for direct read)
      calculation_basis: strOrNull(reward.calculation_basis),
      calculation_method: str(reward.calculation_method),
      calculation_value: numOrNull(reward.calculation_value),
      calculation_unit: str(reward.calculation_unit),
      payout_direction: strOrNull(reward.payout_direction),
      reward_type: str(reward.reward_type),
      voucher_kind: strOrNull(reward.voucher_kind),
      max_reward: numOrNull(reward.max_reward),
      currency: str(reward.currency),
    } as AnyObj,
    loyalty_engine: {
      mechanism_block: {
        point_name: str(loyalty.point_name) || "",
        earning_rule: "",
      },
      exchange_block: { exchange_groups: [] },
      tier_block: { tier_system: loyalty.tier_name ? [{ tier_name: str(loyalty.tier_name) }] : [] },
    },
    variant_engine: {
      summary_block: {
        has_subcategories: arr(variant.variants).length > 0,
        expected_count: arr(variant.variants).length || null,
      },
      items_block: { subcategories: arr<AnyObj>(variant.variants) },
    },
    dependency_engine: {
      exclusion_block: { mutually_exclusive_with: [], can_combine_with: arr<string>(dep.stack_whitelist) },
      stacking_block: {
        stacking_allowed: str(dep.stacking_policy) !== "no_stacking" && str(dep.stacking_policy) !== "",
        stacking_policy: str(dep.stacking_policy),
        rules: [],
        max_concurrent: null,
      },
      prerequisite_block: { requires_promo: [], requires_achievement: [] },
    },
    invalidation_engine: {
      void_conditions_block: arr<string>(inv.void_triggers).map((t) => ({ trigger: t })),
      penalty_block: {
        void_action: arr<string>(inv.void_actions)[0] ?? "",
        penalty_type: str(inv.penalty_type),
        penalty_scope: str(inv.penalty_scope),
      },
      anti_fraud_block: { anti_fraud_rules: arr<string>(inv.void_triggers), detection_methods: [] },
    },
    terms_engine: {
      conditions_block: { terms_conditions: arr<string>(terms.raw_terms) },
      requirements_block: { special_requirements: [] },
    },
    readiness_engine: {
      state_block: {
        state: "ai_draft",
        state_changed_at: new Date().toISOString(),
        state_changed_by: "extractor:pk-extractor",
      },
      commit_block: { ready_to_commit: false },
      validation_block: {
        is_structurally_complete: true,
        status: "needs_review",
        warnings: arr<string>(notes.warnings),
      },
      observability_block: {
        ambiguity_flags: arr<string>(notes.ambiguity_flags),
        contradiction_flags: arr<string>(notes.contradiction_flags),
        review_required: true,
      },
    },
    reasoning_engine: {
      intent_block: {
        primary_action: str(reason.primary_action),
        reward_nature: str(reason.reward_nature),
        distribution_path: str(reason.distribution_path),
        value_shape: str(reason.value_shape),
      },
      selection_block: { mechanic_type: "", locked_fields: [], invariant_violations: [] },
    },
    mechanics_engine: {
      source_block: { source: str(mech.mechanic_source) || `llm_${extractionSource}_extraction` },
      items_block: {
        // Edge function sekarang output items[] dgn detail penuh
        // (mechanic_id, mechanic_type, evidence, confidence, ambiguity,
        //  ambiguity_reason, activation_rule, data). Pass-through apa adanya.
        items: arr<AnyObj>(mech.items),
      },
    },
    projection_engine: {
      // DERIVED — server (pk-extractor) sudah generate. Pass-through penuh.
      ...obj(proj),
    },
    risk_engine: {
      level_block: { promo_risk_level: str(risk.promo_risk_level) },
    },
    meta_engine: {
      ...base.meta_engine,
      source_block: {
        ...obj((base.meta_engine as AnyObj).source_block),
        extraction_source: extractionSource,
        source_type:
          extractionSource === "image" ? "image_upload"
            : extractionSource === "multimodal" ? "image_upload"
            : "text_paste",
      },
      extraction_block: {
        ...obj((base.meta_engine as AnyObj).extraction_block),
        extracted_at: new Date().toISOString(),
      },
      schema_block: {
        ...obj((base.meta_engine as AnyObj).schema_block),
        // A.4 — extractor identity stamp (pipeline@model). Authority: client-side bridge.
        extractor: "pk-extractor@claude-sonnet-4-5",
      },
    } as AnyObj,
    ai_confidence: aiConfidence,
    // attach field_status as sidecar (preserved through save)
    ...(Object.keys(fieldStatus).length > 0 ? { _field_status: fieldStatus } : {}),
  } as PromoKnowledgeRecord;
}

/**
 * Call edge function pk-extractor and return reshaped PromoKnowledgeRecord.
 */
export async function extractPromoV09(req: ExtractRequest): Promise<ExtractResponse> {
  if (!req.text?.trim() && (!req.images || req.images.length === 0)) {
    return { ok: false, error: "EMPTY_INPUT", message: "Isi text atau upload gambar dulu" };
  }

  const { data, error } = await supabase.functions.invoke("pk-extractor", {
    body: {
      text: req.text ?? "",
      images: req.images ?? [],
      client_id_hint: req.client_id_hint ?? "",
    },
  });

  if (error) {
    console.error("[extractPromoV09] invoke error:", error);
    return { ok: false, error: "INVOKE_ERROR", message: error.message ?? String(error) };
  }
  if (!data || data.error) {
    return {
      ok: false,
      error: data?.error ?? "UNKNOWN",
      message: data?.message ?? "Extractor gagal",
    };
  }

  const engines = obj(data.engines);
  const extractionSource = str(data.extraction_source) || "text";

  const base = createInertPromoKnowledgeRecord(genId());
  const merged = mergeEnginesIntoRecord(base, engines, extractionSource);

  return {
    ok: true,
    record: merged,
    raw_engines: engines,
    extraction_source: extractionSource as ExtractResponse["extraction_source"],
    model: str(data.model),
  };
}
