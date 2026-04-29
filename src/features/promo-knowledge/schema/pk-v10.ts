/**
 * PKB_WOLFBRAIN V.10 — SCHEMA TYPES + INERT FACTORY
 *
 * Source of truth: WB_F1_Doctrine_Skeleton (V.10) + WB_F2_Field_Definitions (V.10).
 * Locked: 28 April 2026 by Habe Raja (Fux).
 * Extractor identity: wolfclaw@claude-sonnet-4-5
 *
 * ──────────────────────────────────────────────────────────────────────────
 * STATUS — STEP 1 / SCAFFOLDING ONLY
 * ──────────────────────────────────────────────────────────────────────────
 * This file is intentionally NOT imported anywhere yet. It is the foundation
 * for the V.10-native pk-extractor (Step 2) and the V.10 bridge (Step 3).
 *
 * Hard rules baked into this contract:
 *   1. Inert factory returns full-shape JSON with every engine present.
 *   2. All fields default to "" / null / [] / false — no auto-defaults
 *      ("dilarang hardcode" — F1 §8.1). AI fills based on promo content.
 *   3. `projection_engine` is DERIVED — extractor MUST NOT write directly.
 *   4. Authority order (F2 ATURAN KEBENARAN DATA):
 *        1. mechanics_engine.items[]   ← structural truth
 *        2. reasoning_engine           ← semantic truth
 *        3. taxonomy_engine            ← structural mode
 *        4. reward_engine flat fields  ← display summary only
 *        5. projection_engine          ← derived only
 *        6. validator                  ← integrity gate, never rewrites
 *        7. keyword signals            ← weak signal only, never decides
 *   5. Field naming follows F1 §8 — only names that exist in actual JSON.
 *      Legacy `_mechanics_v31` is FORBIDDEN. Use `mechanics_engine.items_block.items`.
 *
 * Versioning is fixed per V.10 lock:
 *   schema_block.schema_name    = "PKB_Wolfbrain"
 *   schema_block.schema_version = "V.10"
 *   schema_block.locked_at      = "2026-04-28"
 *   schema_block.created_by     = "habe_raja"
 *   schema_block.extractor      = "wolfclaw@claude-sonnet-4-5"
 *   classification_engine.meta_block.prompt_version = "V.10_2026-04-28"
 */

export const PK_V10_SCHEMA_NAME = "PKB_Wolfbrain" as const;
export const PK_V10_SCHEMA_VERSION = "V.10" as const;
export const PK_V10_LOCKED_AT = "2026-04-28" as const;
export const PK_V10_CREATED_BY = "habe_raja" as const;
export const PK_V10_EXTRACTOR = "wolfclaw@claude-sonnet-4-5" as const;
export const PK_V10_PROMPT_VERSION = "V.10_2026-04-28" as const;

// ──────────────────────────────────────────────────────────────────────────
// ENUM REGISTRIES (from F2 — Field Definitions V.10)
// All enums are exported as `as const` arrays so consumers can derive both
// the union type and a runtime list. They are NOT validated at write time
// here — validation belongs to a separate validator (later step).
// ──────────────────────────────────────────────────────────────────────────

export const PK_V10_FIELD_STATUS = [
  "explicit",
  "inferred",
  "derived",
  "propagated",
  "not_stated",
  "not_applicable",
] as const;
export type PkV10FieldStatus = (typeof PK_V10_FIELD_STATUS)[number];

export const PK_V10_PROGRAM_CLASSIFICATION = ["A", "B", "C"] as const;
export type PkV10ProgramClassification =
  (typeof PK_V10_PROGRAM_CLASSIFICATION)[number];

export const PK_V10_REVIEW_CONFIDENCE = ["high", "medium", "low"] as const;
export type PkV10ReviewConfidence = (typeof PK_V10_REVIEW_CONFIDENCE)[number];

export const PK_V10_TAXONOMY_MODE = [
  "fixed",
  "formula",
  "tier",
  "matrix",
] as const;
export type PkV10TaxonomyMode = (typeof PK_V10_TAXONOMY_MODE)[number];

export const PK_V10_TURNOVER_BASIS = [
  "bonus_only",
  "deposit_only",
  "deposit_plus_bonus",
  "total_bet",
  "total_loss",
] as const;
export type PkV10TurnoverBasis = (typeof PK_V10_TURNOVER_BASIS)[number];

export const PK_V10_VALIDITY_MODE = ["absolute", "relative"] as const;
export type PkV10ValidityMode = (typeof PK_V10_VALIDITY_MODE)[number];

export const PK_V10_VALIDITY_DURATION_UNIT = [
  "hours",
  "days",
  "weeks",
  "months",
] as const;
export type PkV10ValidityDurationUnit =
  (typeof PK_V10_VALIDITY_DURATION_UNIT)[number];

export const PK_V10_CLAIM_FREQUENCY = [
  "once",
  "daily",
  "weekly",
  "monthly",
  "on_trigger",
] as const;
export type PkV10ClaimFrequency = (typeof PK_V10_CLAIM_FREQUENCY)[number];

export const PK_V10_TIMEZONE = [
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
] as const;
export type PkV10Timezone = (typeof PK_V10_TIMEZONE)[number];

export const PK_V10_LOGIC_OPERATOR = ["AND", "OR", "XOR"] as const;
export type PkV10LogicOperator = (typeof PK_V10_LOGIC_OPERATOR)[number];

export const PK_V10_TRIGGER_EVENT = [
  "deposit",
  "loss_incurred",
  "first_deposit",
  "turnover_reached",
  "game_event",
  "apk_download",
  "lottery_result_match",
] as const;
export type PkV10TriggerEvent = (typeof PK_V10_TRIGGER_EVENT)[number];

export const PK_V10_DEPOSIT_METHOD = [
  "bank",
  "ewallet",
  "pulsa",
  "qris",
  "crypto",
  "all",
] as const;
export type PkV10DepositMethod = (typeof PK_V10_DEPOSIT_METHOD)[number];

export const PK_V10_GAME_DOMAIN = [
  "slot",
  "casino",
  "sportsbook",
  "togel",
  "all",
] as const;
export type PkV10GameDomain = (typeof PK_V10_GAME_DOMAIN)[number];

export const PK_V10_PLATFORM_ACCESS = [
  "web",
  "apk",
  "mobile",
  "all",
] as const;
export type PkV10PlatformAccess = (typeof PK_V10_PLATFORM_ACCESS)[number];

export const PK_V10_GEO_RESTRICTION = [
  "indonesia",
  "jakarta",
  "sea",
  "global",
] as const;
export type PkV10GeoRestriction = (typeof PK_V10_GEO_RESTRICTION)[number];

export const PK_V10_CALCULATION_METHOD = [
  "percentage",
  "fixed",
  "tiered",
  "matrix_lookup",
] as const;
export type PkV10CalculationMethod =
  (typeof PK_V10_CALCULATION_METHOD)[number];

export const PK_V10_CALCULATION_UNIT = ["percent", "fixed_idr"] as const;
export type PkV10CalculationUnit = (typeof PK_V10_CALCULATION_UNIT)[number];

export const PK_V10_PAYOUT_DIRECTION = ["upfront", "backend"] as const;
export type PkV10PayoutDirection = (typeof PK_V10_PAYOUT_DIRECTION)[number];

export const PK_V10_REWARD_TYPE = [
  "cash",
  "credit_game",
  "physical",
  "voucher",
] as const;
export type PkV10RewardType = (typeof PK_V10_REWARD_TYPE)[number];

export const PK_V10_LOYALTY_MODE = [
  "exp_store",
  "level_up",
  "both",
] as const;
export type PkV10LoyaltyMode = (typeof PK_V10_LOYALTY_MODE)[number];

export const PK_V10_STACKING_POLICY = [
  "no_stacking",
  "stack_with_whitelist",
  "stack_freely",
  "conditional_stack",
] as const;
export type PkV10StackingPolicy = (typeof PK_V10_STACKING_POLICY)[number];

export const PK_V10_INVALIDATOR_TRIGGER_TYPE = [
  "fraud",
  "violation",
  "operational",
] as const;
export type PkV10InvalidatorTriggerType =
  (typeof PK_V10_INVALIDATOR_TRIGGER_TYPE)[number];

export const PK_V10_PENALTY_SCOPE = [
  "current_promo_only",
  "all_active_promos",
  "all_account_balance",
] as const;
export type PkV10PenaltyScope = (typeof PK_V10_PENALTY_SCOPE)[number];

export const PK_V10_READINESS_STATE = [
  "draft",
  "ready",
  "published",
  "rejected",
] as const;
export type PkV10ReadinessState = (typeof PK_V10_READINESS_STATE)[number];

export const PK_V10_VALIDATION_STATUS = [
  "draft",
  "ready",
  "needs_review",
  "rejected",
] as const;
export type PkV10ValidationStatus = (typeof PK_V10_VALIDATION_STATUS)[number];

export const PK_V10_REWARD_NATURE = [
  "monetary",
  "physical_goods",
  "credit_game",
  "access_right",
] as const;
export type PkV10RewardNature = (typeof PK_V10_REWARD_NATURE)[number];

export const PK_V10_MECHANIC_TYPE = [
  "eligibility",
  "trigger",
  "calculation",
  "reward",
  "claim",
  "control",
  "invalidator",
  "distribution",
  "turnover",
  "dependency",
  "intent",
  "scope",
  "proof",
  "time_window",
] as const;
export type PkV10MechanicType = (typeof PK_V10_MECHANIC_TYPE)[number];

export const PK_V10_MECHANICS_SOURCE = [
  "llm_text",
  "llm_image",
  "llm_multimodal",
  "manual",
] as const;
export type PkV10MechanicsSource = (typeof PK_V10_MECHANICS_SOURCE)[number];

export const PK_V10_INTENT_CATEGORY = [
  "acquisition",
  "retention",
  "reactivation",
  "engagement",
] as const;
export type PkV10IntentCategory = (typeof PK_V10_INTENT_CATEGORY)[number];

export const PK_V10_RISK_LEVEL = [
  "low",
  "medium",
  "high",
  "critical",
] as const;
export type PkV10RiskLevel = (typeof PK_V10_RISK_LEVEL)[number];

export const PK_V10_EXTRACTION_SOURCE = [
  "plain_text",
  "html",
  "image",
  "pdf",
  "multimodal",
] as const;
export type PkV10ExtractionSource = (typeof PK_V10_EXTRACTION_SOURCE)[number];

export const PK_V10_SOURCE_TYPE = [
  "text_paste",
  "website",
  "image_upload",
  "pdf_upload",
] as const;
export type PkV10SourceType = (typeof PK_V10_SOURCE_TYPE)[number];

// ──────────────────────────────────────────────────────────────────────────
// COMPOSITE TYPES (open shapes — schema is "documentation only" per F2 §19)
// ──────────────────────────────────────────────────────────────────────────

export interface PkV10QuestionAnswer {
  answer: string; // "ya" | "tidak" | ""
  reasoning: string;
  evidence: string;
}

export interface PkV10TriggerCondition {
  field: string;
  operator: string;
  value: unknown;
  currency?: string;
}

export interface PkV10VoidCondition {
  trigger_name: string;
  trigger_type: string; // PkV10InvalidatorTriggerType when filled
  trigger_evidence: string;
  detection_method: string;
  consequence: string;
}

export interface PkV10MechanicItem {
  mechanic_id: string; // "M01", "M02", ...
  mechanic_type: string; // PkV10MechanicType when filled
  evidence: string;
  confidence: number | null; // 0..1
  ambiguity: boolean | null;
  activation_rule: Record<string, unknown> | null;
  data: Record<string, unknown>;
  // optional, written by AI when ambiguous:
  ambiguity_reason?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// ENGINE BLOCK SHAPES
// ──────────────────────────────────────────────────────────────────────────

export interface PkV10IdentityEngine {
  client_block: {
    client_id: string;
    client_id_field_status: string;
    client_name: string;
  };
  promo_block: {
    promo_name: string;
    promo_type: string;
    target_user: string;
    promo_mode: string; // "single" | "multi"
  };
}

export interface PkV10ClassificationEngine {
  result_block: {
    program_classification: string; // PkV10ProgramClassification when filled
    secondary_classifications: string[];
    review_confidence: string; // PkV10ReviewConfidence when filled
  };
  question_block: {
    q1: PkV10QuestionAnswer;
    q2: PkV10QuestionAnswer;
    q3: PkV10QuestionAnswer;
    q4: PkV10QuestionAnswer;
  };
  meta_block: {
    quality_flags: string[];
    evidence_count: number;
    override: boolean;
    prompt_version: string;
    latency_ms: number | null;
  };
}

export interface PkV10TaxonomyEngine {
  mode_block: {
    mode: string; // PkV10TaxonomyMode when filled
    tier_archetype: string | null;
  };
  logic_block: {
    conversion_formula: string;
    turnover_basis: string | null; // PkV10TurnoverBasis when filled
  };
}

export interface PkV10PeriodEngine {
  validity_block: {
    valid_from: string | null;
    valid_until: string | null;
    validity_mode: string; // PkV10ValidityMode when filled
    validity_duration_value: number | null;
    validity_duration_unit: string; // PkV10ValidityDurationUnit when filled
  };
  distribution_block: {
    claim_frequency: string; // PkV10ClaimFrequency when filled
    calculation_period: string;
    distribution_day: string;
  };
}

export interface PkV10TimeWindowSlot {
  enabled: boolean;
  start_time: string;
  end_time: string;
  days: string[];
}

export interface PkV10TimeWindowEngine {
  timezone_block: {
    timezone: string; // PkV10Timezone when filled
    offset: string;
  };
  claim_window_block: PkV10TimeWindowSlot;
  distribution_window_block: PkV10TimeWindowSlot;
  reset_block: {
    enabled: boolean;
    reset_time: string;
    reset_frequency: string;
  };
}

export interface PkV10TriggerEngine {
  primary_trigger_block: {
    trigger_event: string; // PkV10TriggerEvent when filled
    action: string;
    evidence: string;
  };
  trigger_rule_block: {
    rule_type: string;
    conditions: PkV10TriggerCondition[];
    logic_operator: string; // PkV10LogicOperator when filled
  };
  alternative_triggers_block: {
    or_conditions: PkV10TriggerCondition[];
    and_conditions: PkV10TriggerCondition[];
  };
}

export interface PkV10ClaimEngine {
  method_block: {
    claim_method: string;
    auto_credit: boolean;
  };
  channels_block: {
    channels: string[];
    priority_order: string[];
  };
  proof_requirement_block: {
    proof_required: boolean;
    proof_types: string[];
    proof_destinations: string[];
  };
  instruction_block: {
    claim_steps: string[];
    claim_url: string;
  };
}

export interface PkV10ProofEngine {
  social_proof_block: {
    platforms: string[];
    hashtags: string[];
    content_requirements: string[];
  };
  screenshot_proof_block: {
    ss_targets: string[];
    rules: string[];
  };
}

export interface PkV10PaymentEngine {
  deposit_block: {
    deposit_method: string; // PkV10DepositMethod when filled
    deposit_rate: number | null;
  };
  method_whitelist_block: {
    methods: string[];
    providers: string[];
  };
  method_blacklist_block: {
    methods: string[];
    providers: string[];
  };
}

export interface PkV10ScopeEngine {
  game_block: {
    game_domain: string; // PkV10GameDomain when filled
    markets: string[];
    eligible_providers: string[];
  };
  platform_block: {
    platform_access: string; // PkV10PlatformAccess when filled
    apk_required: boolean;
  };
  geo_block: {
    geo_restriction: string; // PkV10GeoRestriction when filled
  };
  blacklist_block: {
    types: string[];
    providers: string[];
    games: string[];
    rules: string[];
  };
}

export interface PkV10RewardEngine {
  event_block: {
    event_rewards: unknown[];
    prizes: unknown[];
  };
  requirement_block: {
    min_deposit: number | null;
    unlock_conditions: unknown[];
  };
  combo_reward_block: {
    combo_items: unknown[];
  };
  matrix_reward_block: {
    axis_x_label: string;
    axis_y_label: string;
    matrix_cells: unknown[];
  };
  conditional_reward_block: {
    conditions: unknown[];
    default_reward: Record<string, unknown> | null;
  };
  // FLAT FIELDS — display summary only (authority order #4).
  // Source of truth lives in mechanics_engine.items[].
  calculation_basis: string;
  calculation_method: string; // PkV10CalculationMethod when filled
  calculation_value: number | null;
  calculation_unit: string; // PkV10CalculationUnit when filled
  payout_direction: string; // PkV10PayoutDirection when filled
  reward_type: string; // PkV10RewardType when filled
  voucher_kind: string | null;
  max_reward: number | null;
  currency: string | null;
}

export interface PkV10LoyaltyEngine {
  mechanism_block: {
    point_name: string;
    earning_rule: string;
    loyalty_mode: string; // PkV10LoyaltyMode when filled
  };
  exchange_block: {
    exchange_groups: unknown[];
  };
  tier_block: {
    tier_system: unknown[];
  };
}

export interface PkV10VariantEngine {
  summary_block: {
    has_subcategories: boolean;
    expected_count: number | null;
  };
  items_block: {
    subcategories: unknown[];
  };
}

export interface PkV10DependencyEngine {
  exclusion_block: {
    mutually_exclusive_with: string[];
    can_combine_with: string[];
  };
  stacking_block: {
    stacking_allowed: boolean;
    stacking_policy: string; // PkV10StackingPolicy when filled
    rules: string[];
    max_concurrent: number | null;
  };
  prerequisite_block: {
    requires_promo: string[];
    requires_achievement: string[];
  };
}

export interface PkV10InvalidationEngine {
  // Per F1 skeleton — array of structured void condition objects.
  void_conditions_block: PkV10VoidCondition[];
  penalty_block: {
    void_action: string;
    penalty_type: string;
    penalty_scope: string; // PkV10PenaltyScope when filled
  };
  anti_fraud_block: {
    anti_fraud_rules: string[];
    detection_methods: string[];
  };
}

export interface PkV10TermsEngine {
  conditions_block: {
    terms_conditions: string[];
  };
  requirements_block: {
    special_requirements: string[];
  };
}

export interface PkV10ReadinessEngine {
  state_block: {
    state: string; // PkV10ReadinessState when filled
    state_changed_at: string;
    state_changed_by: string;
  };
  commit_block: {
    ready_to_commit: boolean;
  };
  validation_block: {
    is_structurally_complete: boolean;
    status: string; // PkV10ValidationStatus when filled
    warnings: string[];
  };
  observability_block: {
    ambiguity_flags: string[];
    contradiction_flags: string[];
    review_required: boolean;
  };
}

export interface PkV10ReasoningEngine {
  intent_block: {
    primary_action: string;
    reward_nature: string; // PkV10RewardNature when filled
    distribution_path: string;
    value_shape: string;
  };
  selection_block: {
    mechanic_type: string; // PkV10MechanicType when filled
    locked_fields: string[];
    invariant_violations: string[];
  };
}

export interface PkV10MechanicsEngine {
  source_block: {
    source: string; // PkV10MechanicsSource when filled
  };
  items_block: {
    items: PkV10MechanicItem[];
  };
}

/**
 * PROJECTION ENGINE — DERIVED ONLY.
 * Per F1 skeleton: "_description" inline marker. Extractor MUST NOT write
 * directly. Generated post-extraction by a deterministic projector (later).
 */
export interface PkV10ProjectionEngine {
  _description: string;
  summary_block: {
    promo_summary: string;
    main_trigger: string;
    main_reward_form: string;
    main_reward_percent: number | null;
    main_reward_value: number | null;
    main_reward_unit: string;
    max_bonus: number | null;
    min_base: number | null;
    payout_direction: string;
    turnover_multiplier: number | null;
    turnover_basis: string;
  };
  claim_summary_block: {
    primary_claim_method: string;
    primary_claim_platform: string;
    claim_channels: string[];
    auto_credit: boolean;
    proof_required: boolean;
    claim_frequency: string;
    distribution_day: string;
  };
  scope_summary_block: {
    game_domain: string;
    game_types: string[];
    game_providers: string[];
    game_exclusions: string[];
    platform_access: string;
    apk_required: boolean;
    geo_restriction: string;
    stacking_policy: string;
  };
  intent_summary_block: {
    intent_category: string; // PkV10IntentCategory when filled
    primary_action: string;
    reward_nature: string;
    distribution_path: string;
    value_shape: string;
    target_segment: string;
  };
}

export interface PkV10RiskEngine {
  level_block: {
    promo_risk_level: string; // PkV10RiskLevel when filled
  };
}

export interface PkV10MetaEngine {
  source_block: {
    source_url: string;
    raw_content: string;
    extraction_source: string; // PkV10ExtractionSource when filled
    source_type: string; // PkV10SourceType when filled
  };
  extraction_block: {
    has_rowspan_tables: boolean;
    html_was_normalized: boolean;
    client_id_source: string | null; // PkV10FieldStatus subset
    propagated_fields: string[];
    ambiguous_blacklists: number;
    extracted_at: string;
    classification_overridden: boolean;
    classification_override_reason: string;
    original_llm_category: string;
  };
  schema_block: {
    schema_name: typeof PK_V10_SCHEMA_NAME;
    schema_version: typeof PK_V10_SCHEMA_VERSION;
    locked_at: typeof PK_V10_LOCKED_AT;
    created_by: typeof PK_V10_CREATED_BY;
    status: "locked" | "draft";
    extractor: typeof PK_V10_EXTRACTOR;
  };
}

// ──────────────────────────────────────────────────────────────────────────
// ROOT RECORD
// ──────────────────────────────────────────────────────────────────────────

/**
 * PKB_Wolfbrain V.10 root record.
 *
 * `ai_confidence` keys are JSON paths (e.g. "reward_engine.currency"),
 * values are 0..1. Only filled for fields the AI is uncertain about.
 *
 * `_field_status` keys are JSON paths, values are PkV10FieldStatus.
 */
export interface PkV10Record {
  domain: "promo_knowledge";
  record_id: string;
  created_at: string;
  updated_at: string;

  identity_engine: PkV10IdentityEngine;
  classification_engine: PkV10ClassificationEngine;
  taxonomy_engine: PkV10TaxonomyEngine;
  period_engine: PkV10PeriodEngine;
  time_window_engine: PkV10TimeWindowEngine;
  trigger_engine: PkV10TriggerEngine;
  claim_engine: PkV10ClaimEngine;
  proof_engine: PkV10ProofEngine;
  payment_engine: PkV10PaymentEngine;
  scope_engine: PkV10ScopeEngine;
  reward_engine: PkV10RewardEngine;
  loyalty_engine: PkV10LoyaltyEngine;
  variant_engine: PkV10VariantEngine;
  dependency_engine: PkV10DependencyEngine;
  invalidation_engine: PkV10InvalidationEngine;
  terms_engine: PkV10TermsEngine;
  readiness_engine: PkV10ReadinessEngine;
  reasoning_engine: PkV10ReasoningEngine;
  mechanics_engine: PkV10MechanicsEngine;
  projection_engine: PkV10ProjectionEngine;
  risk_engine: PkV10RiskEngine;
  meta_engine: PkV10MetaEngine;

  ai_confidence: Record<string, number>;
  _field_status: Record<string, PkV10FieldStatus | string>;
}

// ──────────────────────────────────────────────────────────────────────────
// INERT FACTORY — full-shape, all fields blank
// ──────────────────────────────────────────────────────────────────────────

function emptyTimeWindowSlot(): PkV10TimeWindowSlot {
  return { enabled: false, start_time: "", end_time: "", days: [] };
}

function emptyQuestion(): PkV10QuestionAnswer {
  return { answer: "", reasoning: "", evidence: "" };
}

/**
 * Create a fully-shaped, INERT V.10 record.
 *
 * Hard rules (F1 §1, §4, §8.1):
 *   - Every engine present.
 *   - All values blank — no auto-defaults, no "smart" fills.
 *   - `readiness_engine.state_block.state` defaults to "draft" because that
 *     is the lifecycle starting state, not a business assumption (F1 §1).
 *   - `meta_engine.schema_block` carries V.10 identity stamps (locked).
 *   - `classification_engine.meta_block.prompt_version` carries V.10 stamp.
 *
 * @param recordId  required — caller generates UUID/ULID.
 * @param now       optional ISO timestamp; defaults to current time.
 */
export function createInertPkV10Record(
  recordId: string,
  now: string = new Date().toISOString(),
): PkV10Record {
  return {
    domain: "promo_knowledge",
    record_id: recordId,
    created_at: now,
    updated_at: now,

    identity_engine: {
      client_block: {
        client_id: "",
        client_id_field_status: "",
        client_name: "",
      },
      promo_block: {
        promo_name: "",
        promo_type: "",
        target_user: "",
        promo_mode: "",
      },
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
      social_proof_block: {
        platforms: [],
        hashtags: [],
        content_requirements: [],
      },
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
      matrix_reward_block: {
        axis_x_label: "",
        axis_y_label: "",
        matrix_cells: [],
      },
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
      state_block: {
        state: "draft",
        state_changed_at: now,
        state_changed_by: "",
      },
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

    risk_engine: {
      level_block: { promo_risk_level: "" },
    },

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
        extracted_at: "",
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

    ai_confidence: {},
    _field_status: {},
  };
}
