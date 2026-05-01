/**
 * PKB_WOLFBRAIN V.10 — SCHEMA TYPES + INERT FACTORY
 *
 * Source of truth:
 *   - WB_F1_Doctrine_Skeleton (V.10) — engine structure
 *   - WB_F2_Field_Definitions  (V.10) — field semantics
 *   - WB_F3_Enum_Registry      (V.10) — locked 28 April 2026 — enum vocabulary
 *
 * Owner: Habe Raja (Fux), WOLFGANK.
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
 *   6. ENUM RULE (F3): values are vocabulary, NOT decision engines.
 *      - System values: snake_case
 *      - Financial providers (bank/ewallet/pulsa): UPPERCASE
 *      - Game providers: Title Case / official display name
 *      - No alias. One concept = one value. New values = habe_raja approval only.
 */

export const PK_V10_SCHEMA_NAME = "PKB_Wolfbrain" as const;
export const PK_V10_SCHEMA_VERSION = "V.10" as const;
export const PK_V10_LOCKED_AT = "2026-04-28" as const;
export const PK_V10_CREATED_BY = "habe_raja" as const;
export const PK_V10_EXTRACTOR = "wolfclaw@claude-sonnet-4-5" as const;
export const PK_V10_PROMPT_VERSION = "V.10_2026-04-28" as const;

// ──────────────────────────────────────────────────────────────────────────
// ENUM REGISTRIES — 1:1 from WB_F3_Enum_Registry V.10 (locked 2026-04-28)
//
// All enums are exported as `as const` arrays so consumers can derive both
// the union type and a runtime list. They are NOT validated at write time
// here — validation belongs to a separate validator (later step).
//
// DO NOT add values here without updating WB_F3 first (habe_raja approval).
// ──────────────────────────────────────────────────────────────────────────

// ─── 1.1 Identity Engine ──────────────────────────────────────────────────

export const PK_V10_PROMO_TYPE = [
  "welcome_bonus",
  "deposit_bonus",
  "new_member_bonus",
  "cashback",
  "rollingan",
  "referral",
  "event_turnover_ladder",
  "event_ranking",
  "lucky_draw",
  "lucky_spin",
  "level_up",
  "loyalty_point",
  "merchandise",
  "freechip",
  "parlay_protection",
  "birthday_bonus",
  "extra_withdraw",
  "payment_discount",
  "mystery_number",
  "event_slot_specific",
  "freespin_bonus",
] as const;
export type PkV10PromoType = (typeof PK_V10_PROMO_TYPE)[number];

export const PK_V10_TARGET_USER = [
  "new_member",
  "existing_member",
  "vip",
  "all_member",
] as const;
export type PkV10TargetUser = (typeof PK_V10_TARGET_USER)[number];

export const PK_V10_PROMO_MODE = ["single", "multi"] as const;
export type PkV10PromoMode = (typeof PK_V10_PROMO_MODE)[number];

/**
 * F3 §1.1 — `client_id_field_status` is a SCOPED registry, NOT the same as
 * the global `_field_status` registry (F3 §1.21).
 */
export const PK_V10_CLIENT_ID_FIELD_STATUS = [
  "explicit",
  "inferred",
  "propagated",
] as const;
export type PkV10ClientIdFieldStatus =
  (typeof PK_V10_CLIENT_ID_FIELD_STATUS)[number];

// ─── 1.2 Classification Engine ────────────────────────────────────────────

export const PK_V10_PROGRAM_CLASSIFICATION = ["A", "B", "C"] as const;
export type PkV10ProgramClassification =
  (typeof PK_V10_PROGRAM_CLASSIFICATION)[number];

export const PK_V10_REVIEW_CONFIDENCE = ["high", "medium", "low"] as const;
export type PkV10ReviewConfidence = (typeof PK_V10_REVIEW_CONFIDENCE)[number];

export const PK_V10_QUALITY_FLAGS = [
  "valid",
  "warning",
  "needs_review",
  "missing_required",
  "contradiction_detected",
  "ambiguity_detected",
  "evidence_insufficient",
] as const;
export type PkV10QualityFlag = (typeof PK_V10_QUALITY_FLAGS)[number];

export const PK_V10_QUESTION_ANSWER = ["ya", "tidak"] as const;
export type PkV10QuestionAnswerValue =
  (typeof PK_V10_QUESTION_ANSWER)[number];

// ─── 1.3 Taxonomy Engine ──────────────────────────────────────────────────

export const PK_V10_TAXONOMY_MODE = [
  "fixed",
  "formula",
  "tier",
  "matrix",
] as const;
export type PkV10TaxonomyMode = (typeof PK_V10_TAXONOMY_MODE)[number];

export const PK_V10_TIER_ARCHETYPE = [
  "level",
  "user_choice_variants",
  "turnover_threshold_ladder",
  "loss_amount_range",
  "downline_count",
  "parlay_team_count",
  "stake_amount",
  "history_deposit_threshold",
  "point_redemption",
  "referral_tier",
  "exchange_catalog",
] as const;
export type PkV10TierArchetype = (typeof PK_V10_TIER_ARCHETYPE)[number];

export const PK_V10_TURNOVER_BASIS = [
  "bonus_only",
  "deposit_only",
  "deposit_plus_bonus",
  "total_bet",
  "total_loss",
] as const;
export type PkV10TurnoverBasis = (typeof PK_V10_TURNOVER_BASIS)[number];

// ─── 1.4 Period Engine ────────────────────────────────────────────────────

export const PK_V10_CLAIM_FREQUENCY = [
  "once",
  "daily",
  "weekly",
  "monthly",
  "birthday",
  "on_trigger",
] as const;
export type PkV10ClaimFrequency = (typeof PK_V10_CLAIM_FREQUENCY)[number];

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

export const PK_V10_DISTRIBUTION_DAY = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type PkV10DistributionDay = (typeof PK_V10_DISTRIBUTION_DAY)[number];

// ─── 1.5 Time Window Engine ───────────────────────────────────────────────

export const PK_V10_TIMEZONE = [
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
] as const;
export type PkV10Timezone = (typeof PK_V10_TIMEZONE)[number];

export const PK_V10_OFFSET = ["GMT+7", "GMT+8", "GMT+9"] as const;
export type PkV10Offset = (typeof PK_V10_OFFSET)[number];

export const PK_V10_RESET_FREQUENCY = [
  "daily",
  "weekly",
  "monthly",
  "on_trigger",
] as const;
export type PkV10ResetFrequency = (typeof PK_V10_RESET_FREQUENCY)[number];

// ─── 1.6 Trigger Engine ───────────────────────────────────────────────────

export const PK_V10_TRIGGER_EVENT = [
  "first_deposit",
  "deposit",
  "withdrawal",
  "turnover_reached",
  "loss_incurred",
  "game_event",
  "downline_activity",
  "apk_download",
  "lottery_result_match",
  "birthday_date",
  "level_up_achieved",
  "rank_position",
  "parlay_outcome",
  "random_draw",
  "referral_signup",
] as const;
export type PkV10TriggerEvent = (typeof PK_V10_TRIGGER_EVENT)[number];

export const PK_V10_LOGIC_OPERATOR = ["AND", "OR", "XOR"] as const;
export type PkV10LogicOperator = (typeof PK_V10_LOGIC_OPERATOR)[number];

export const PK_V10_CONDITION_OPERATOR = [
  "equals",
  "not_equals",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "in_range",
  "contains",
] as const;
export type PkV10ConditionOperator =
  (typeof PK_V10_CONDITION_OPERATOR)[number];

// ─── 1.7 Claim Engine ─────────────────────────────────────────────────────

export const PK_V10_CLAIM_METHOD = [
  "auto",
  "manual_livechat",
  "manual_whatsapp",
  "manual_telegram",
  "in_app_button",
  "form_submission",
  "cs_approval",
] as const;
export type PkV10ClaimMethod = (typeof PK_V10_CLAIM_METHOD)[number];

export const PK_V10_CHANNELS = [
  "livechat",
  "whatsapp",
  "telegram",
  "facebook",
  "website_form",
  "apk_redemption",
  "email",
  "phone_call",
] as const;
export type PkV10Channel = (typeof PK_V10_CHANNELS)[number];

// ─── 1.8 Proof Engine ─────────────────────────────────────────────────────

export const PK_V10_PROOF_TYPES = [
  "screenshot_win",
  "screenshot_bill",
  "screenshot_wd",
  "screenshot_deposit",
  "screenshot_apk",
  "foto_ktp",
  "foto_rekening",
  "parlay_ticket",
] as const;
export type PkV10ProofType = (typeof PK_V10_PROOF_TYPES)[number];

export const PK_V10_PROOF_DESTINATIONS = [
  "livechat",
  "whatsapp_official",
  "telegram_official",
  "telegram_group",
  "facebook_group",
  "facebook_official",
] as const;
export type PkV10ProofDestination =
  (typeof PK_V10_PROOF_DESTINATIONS)[number];

// ─── 1.9 Payment Engine ───────────────────────────────────────────────────

export const PK_V10_DEPOSIT_METHOD = [
  "bank",
  "ewallet",
  "pulsa",
  "qris",
  "crypto",
  "all",
] as const;
export type PkV10DepositMethod = (typeof PK_V10_DEPOSIT_METHOD)[number];

/** F3 §1.9 — UPPERCASE (financial provider naming rule). */
export const PK_V10_PROVIDER_EWALLET = [
  "DANA",
  "OVO",
  "GOPAY",
  "SHOPEEPAY",
  "LINKAJA",
  "SAKUKU",
  "JENIUS",
] as const;
export type PkV10ProviderEwallet = (typeof PK_V10_PROVIDER_EWALLET)[number];

export const PK_V10_PROVIDER_PULSA = [
  "TELKOMSEL",
  "XL",
  "INDOSAT",
  "TRI",
  "SMARTFREN",
  "AXIS",
] as const;
export type PkV10ProviderPulsa = (typeof PK_V10_PROVIDER_PULSA)[number];

export const PK_V10_PROVIDER_BANK = [
  "BCA",
  "BNI",
  "BRI",
  "MANDIRI",
  "CIMB",
  "DANAMON",
  "PERMATA",
  "BTN",
  "MAYBANK",
] as const;
export type PkV10ProviderBank = (typeof PK_V10_PROVIDER_BANK)[number];

// ─── 1.10 Scope Engine ────────────────────────────────────────────────────

export const PK_V10_GAME_DOMAIN = [
  "slot",
  "casino",
  "live_casino",
  "sports",
  "sportsbook",
  "togel",
  "sabung_ayam",
  "e_lottery",
  "arcade",
  "mixed",
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

/**
 * F3 §1.10 — extensible. Title Case / official display name. Add new brands
 * via habe_raja approval only.
 */
export const PK_V10_GAME_PROVIDER = [
  "Pragmatic Play",
  "PG Soft",
  "Habanero",
  "Spadegaming",
  "Microgaming",
  "Playtech",
  "Evolution Gaming",
  "Sexy Baccarat",
  "SBOBet",
  "CMD368",
  "SV388",
  "WS168",
] as const;
export type PkV10GameProvider = (typeof PK_V10_GAME_PROVIDER)[number];

// ─── 1.11 Reward Engine ───────────────────────────────────────────────────

export const PK_V10_CALCULATION_BASIS = [
  "deposit",
  "turnover",
  "loss",
  "win",
  "bet",
  "payout",
  "downline_winlose",
  "level_up_reward",
  "fixed",
  "rank_position",
  "stake_amount",
] as const;
export type PkV10CalculationBasis =
  (typeof PK_V10_CALCULATION_BASIS)[number];

export const PK_V10_CALCULATION_METHOD = [
  "percentage",
  "fixed",
  "tiered",
  "matrix_lookup",
  "conditional",
] as const;
export type PkV10CalculationMethod =
  (typeof PK_V10_CALCULATION_METHOD)[number];

export const PK_V10_CALCULATION_UNIT = ["percent", "fixed_idr"] as const;
export type PkV10CalculationUnit = (typeof PK_V10_CALCULATION_UNIT)[number];

export const PK_V10_PAYOUT_DIRECTION = ["upfront", "backend"] as const;
export type PkV10PayoutDirection = (typeof PK_V10_PAYOUT_DIRECTION)[number];

export const PK_V10_REWARD_TYPE = [
  "physical",
  "cash",
  "credit_game",
  "voucher",
  "ticket",
  "lucky_spin",
  "discount",
  "freespin",
  "combo",
] as const;
export type PkV10RewardType = (typeof PK_V10_REWARD_TYPE)[number];

export const PK_V10_VOUCHER_KIND = [
  "deposit_bonus",
  "lucky_spin_entry",
  "event_entry",
  "discount_code",
  "free_play",
  "cashback_voucher",
  "other",
] as const;
export type PkV10VoucherKind = (typeof PK_V10_VOUCHER_KIND)[number];

// ─── 1.12 Loyalty Engine ──────────────────────────────────────────────────

export const PK_V10_POINT_NAME = [
  "LP",
  "EXP",
  "XP",
  "COIN",
  "GEM",
] as const;
export type PkV10PointName = (typeof PK_V10_POINT_NAME)[number];

export const PK_V10_LOYALTY_MODE = [
  "exp_store",
  "level_up",
  "both",
] as const;
export type PkV10LoyaltyMode = (typeof PK_V10_LOYALTY_MODE)[number];

/** F3 §1.12 — extensible per brand. */
export const PK_V10_TIER_NAME = [
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
  "Starter",
  "VIP",
  "Elite",
  "Legend",
] as const;
export type PkV10TierName = (typeof PK_V10_TIER_NAME)[number];

// ─── 1.13 Variant Engine ──────────────────────────────────────────────────

export const PK_V10_TIER_DIMENSION = [
  "level",
  "turnover_threshold",
  "loss_amount_range",
  "downline_count",
  "parlay_team_count",
  "stake_amount",
  "history_deposit_threshold",
  "deposit_amount",
  "point_balance",
  "team_count",
  "bet_amount",
] as const;
export type PkV10TierDimension = (typeof PK_V10_TIER_DIMENSION)[number];

// ─── 1.14 Dependency Engine ───────────────────────────────────────────────

export const PK_V10_STACKING_POLICY = [
  "no_stacking",
  "stack_with_whitelist",
  "stack_freely",
  "conditional_stack",
] as const;
export type PkV10StackingPolicy = (typeof PK_V10_STACKING_POLICY)[number];

// ─── 1.15 Invalidation Engine ─────────────────────────────────────────────

export const PK_V10_INVALIDATOR_TRIGGER_TYPE = [
  "fraud",
  "violation",
  "operational",
] as const;
export type PkV10InvalidatorTriggerType =
  (typeof PK_V10_INVALIDATOR_TRIGGER_TYPE)[number];

export const PK_V10_VOID_TRIGGER = [
  "bonus_hunter",
  "safety_bet",
  "invest",
  "ip_duplicate",
  "data_duplicate",
  "deposit_fraud",
  "hold_freespin",
  "multi_accounting",
  "self_referral",
  "account_change",
  "claim_timeout",
  "wrong_bank_info",
  "screenshot_missing",
  "game_category_violation",
  "cashout_partial",
] as const;
export type PkV10VoidTrigger = (typeof PK_V10_VOID_TRIGGER)[number];

export const PK_V10_VOID_ACTION = [
  "bonus_cancel",
  "full_balance_void",
  "winnings_void",
  "bonus_and_winnings_void",
  "account_suspend",
  "permanent_ban",
] as const;
export type PkV10VoidAction = (typeof PK_V10_VOID_ACTION)[number];

export const PK_V10_PENALTY_TYPE = [
  "bonus_forfeit",
  "winnings_forfeit",
  "balance_forfeit",
  "full_forfeit",
  "account_restriction",
] as const;
export type PkV10PenaltyType = (typeof PK_V10_PENALTY_TYPE)[number];

export const PK_V10_PENALTY_SCOPE = [
  "current_promo_only",
  "all_active_promos",
  "all_account_balance",
  "future_participation",
] as const;
export type PkV10PenaltyScope = (typeof PK_V10_PENALTY_SCOPE)[number];

// ─── 1.16 Readiness Engine ────────────────────────────────────────────────

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

// ─── 1.17 Reasoning Engine ────────────────────────────────────────────────

export const PK_V10_PRIMARY_ACTION = [
  "deposit_to_bonus",
  "lose_to_cashback",
  "bet_to_rollingan",
  "refer_to_commission",
  "redeem_to_reward",
  "turnover_to_rank",
  "milestone_to_merchandise",
  "app_install_to_credit",
  "birthday_to_bonus",
] as const;
export type PkV10PrimaryAction = (typeof PK_V10_PRIMARY_ACTION)[number];

export const PK_V10_REWARD_NATURE = [
  "monetary",
  "physical_goods",
  "credit_game",
  "access_right",
  "discount",
  "status_upgrade",
] as const;
export type PkV10RewardNature = (typeof PK_V10_REWARD_NATURE)[number];

export const PK_V10_DISTRIBUTION_PATH = [
  "direct_to_balance",
  "to_bonus_wallet",
  "physical_shipping",
  "manual_disbursement",
  "apk_redemption",
  "event_drawing",
] as const;
export type PkV10DistributionPath =
  (typeof PK_V10_DISTRIBUTION_PATH)[number];

export const PK_V10_VALUE_SHAPE = [
  "percentage_of_base",
  "fixed_amount",
  "tiered_escalating",
  "matrix_lookup",
  "random_draw",
  "ladder_milestone",
  "exchange_rate_based",
] as const;
export type PkV10ValueShape = (typeof PK_V10_VALUE_SHAPE)[number];

// ─── 1.18 Mechanics Engine ────────────────────────────────────────────────

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

// ─── 1.19 Meta Engine ─────────────────────────────────────────────────────

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

export const PK_V10_SCHEMA_STATUS = ["locked", "draft"] as const;
export type PkV10SchemaStatus = (typeof PK_V10_SCHEMA_STATUS)[number];

// ─── 1.20 Risk Engine ─────────────────────────────────────────────────────

export const PK_V10_RISK_LEVEL = [
  "low",
  "medium",
  "high",
  "critical",
] as const;
export type PkV10RiskLevel = (typeof PK_V10_RISK_LEVEL)[number];

// ─── 1.21 Field Status & Confidence ───────────────────────────────────────

export const PK_V10_FIELD_STATUS = [
  "explicit",
  "inferred",
  "derived",
  "propagated",
  "not_stated",
  "not_applicable",
] as const;
export type PkV10FieldStatus = (typeof PK_V10_FIELD_STATUS)[number];

export const PK_V10_INTENT_CATEGORY = [
  "acquisition",
  "retention",
  "reactivation",
  "engagement",
  "virality",
  "upsell",
] as const;
export type PkV10IntentCategory = (typeof PK_V10_INTENT_CATEGORY)[number];

// ──────────────────────────────────────────────────────────────────────────
// BAGIAN 2 — NULLABLE FIELDS (F3 §2)
//
// Field paths that are allowed to be `null`. Null is NOT an error — it means
// the data is unavailable, not applicable, or not stated by the promo.
// ──────────────────────────────────────────────────────────────────────────

export const PK_V10_NULLABLE_FIELDS = [
  "taxonomy_engine.mode_block.tier_archetype",
  "taxonomy_engine.logic_block.turnover_basis",
  "period_engine.validity_block.valid_from",
  "period_engine.validity_block.valid_until",
  "period_engine.validity_block.validity_duration_value",
  "reward_engine.requirement_block.min_deposit",
  "reward_engine.calculation_value",
  "reward_engine.max_reward",
  "reward_engine.voucher_kind",
  "payment_engine.deposit_block.deposit_rate",
  "classification_engine.meta_block.latency_ms",
  "variant_engine.summary_block.expected_count",
  "dependency_engine.stacking_block.max_concurrent",
  "meta_engine.extraction_block.client_id_source",
  "mechanics_engine.items[].ambiguity",
  "mechanics_engine.items[].activation_rule",
] as const;
export type PkV10NullableField = (typeof PK_V10_NULLABLE_FIELDS)[number];

// ──────────────────────────────────────────────────────────────────────────
// BAGIAN 3 — NUMERIC RANGES (F3 §3)
//
// Permitted numeric ranges per field. Validators use these — extractors
// must not silently clamp values, only refuse out-of-range inputs.
//
// Threshold ai_confidence untuk trigger pertanyaan ke Admin: < 0.7
// (sementara — belum diuji final).
// ──────────────────────────────────────────────────────────────────────────

export interface PkV10NumericRange {
  field: string;
  type: "float" | "integer";
  min: number;
  max: number | null; // null = unbounded
  notes: string;
}

export const PK_V10_NUMERIC_RANGES: readonly PkV10NumericRange[] = [
  {
    field: "ai_confidence",
    type: "float",
    min: 0.0,
    max: 1.0,
    notes: "1.0 = sangat yakin, 0.0 = tidak yakin sama sekali",
  },
  {
    field: "classification_engine.meta_block.evidence_count",
    type: "integer",
    min: 0,
    max: null,
    notes: "Jumlah bukti yang ditemukan",
  },
  {
    field: "reward_engine.calculation_value",
    type: "float",
    min: 0,
    max: 100,
    notes: "Untuk persentase. Untuk fixed, tidak ada batas",
  },
  {
    field: "reward_engine.max_reward",
    type: "integer",
    min: 0,
    max: null,
    notes: "Dalam satuan rupiah",
  },
  {
    field: "reward_engine.requirement_block.min_deposit",
    type: "integer",
    min: 0,
    max: null,
    notes: "Dalam satuan rupiah",
  },
  {
    field: "dependency_engine.stacking_block.max_concurrent",
    type: "integer",
    min: 1,
    max: null,
    notes: "Minimal 1 kalau diisi",
  },
  {
    field: "classification_engine.meta_block.latency_ms",
    type: "integer",
    min: 0,
    max: null,
    notes: "Dalam milidetik",
  },
  {
    field: "meta_engine.extraction_block.ambiguous_blacklists",
    type: "integer",
    min: 0,
    max: null,
    notes: "Jumlah blacklist ambigu",
  },
] as const;

export const PK_V10_AI_CONFIDENCE_QUESTION_THRESHOLD = 0.7 as const;

// ──────────────────────────────────────────────────────────────────────────
// BAGIAN 4 — REFERENCE MAPS / DISPLAY LABELS (F3 §4)
//
// Code → display label mappings. For UI and team communication only.
// These are NOT operational values — never branch logic on labels.
// ──────────────────────────────────────────────────────────────────────────

export const PK_V10_LABEL_PROGRAM_CLASSIFICATION: Record<
  PkV10ProgramClassification,
  string
> = {
  A: "Program Reward",
  B: "Program Event",
  C: "Aturan Sistem",
};

export const PK_V10_LABEL_READINESS_STATE: Record<
  PkV10ReadinessState,
  string
> = {
  draft: "Data Awal",
  ready: "Siap Tayang",
  published: "Sudah Tayang",
  rejected: "Ditolak",
};

export interface PkV10RiskLabelEntry {
  label: string;
  example: string;
}

export const PK_V10_LABEL_RISK_LEVEL: Record<
  PkV10RiskLevel,
  PkV10RiskLabelEntry
> = {
  low: { label: "Risiko Rendah", example: "Merchandise, freechip kecil" },
  medium: { label: "Risiko Sedang", example: "Cashback mingguan" },
  high: { label: "Risiko Tinggi", example: "Lucky draw hadiah besar" },
  critical: {
    label: "Risiko Kritis",
    example: "Lucky draw mobil, hadiah miliaran",
  },
};

export const PK_V10_LABEL_PAYOUT_DIRECTION: Record<
  PkV10PayoutDirection,
  string
> = {
  upfront: "Dibayar di Depan",
  backend: "Dibayar Setelah Main",
};

export const PK_V10_LABEL_MECHANIC_TYPE: Record<PkV10MechanicType, string> = {
  eligibility: "Syarat Klaim",
  trigger: "Pemicu",
  calculation: "Perhitungan",
  reward: "Reward",
  claim: "Cara Klaim",
  control: "Batas & Kontrol",
  invalidator: "Pembatalan",
  distribution: "Distribusi",
  turnover: "Turnover",
  dependency: "Ketergantungan",
  intent: "Tujuan Promo",
  scope: "Cakupan Game",
  proof: "Bukti",
  time_window: "Jendela Waktu",
};

// ──────────────────────────────────────────────────────────────────────────
// COMPOSITE TYPES (open shapes — schema is "documentation only" per F2 §19)
// ──────────────────────────────────────────────────────────────────────────

export interface PkV10QuestionAnswer {
  answer: string; // PkV10QuestionAnswerValue ("ya" | "tidak") when filled
  reasoning: string;
  evidence: string;
}

export interface PkV10TriggerCondition {
  field: string;
  operator: string; // PkV10ConditionOperator when filled
  value: unknown;
  currency?: string;
}

export interface PkV10VoidCondition {
  trigger_name: string; // PkV10VoidTrigger when filled
  trigger_type: string; // PkV10InvalidatorTriggerType when filled
  trigger_evidence: string;
  detection_method: string;
  consequence: string; // PkV10VoidAction when filled
}

// ──────────────────────────────────────────────────────────────────────────
// MECHANIC DATA DISCRIMINATORS (Phase 2 — typing tightening only)
//
// NOTE: These are *opt-in narrowing types* for consumers (selectors, UI).
// They do NOT change runtime shape. `PkV10MechanicItem.data` is still
// `Record<string, unknown>`. Consumers may cast based on `mechanic_type`:
//
//   const m: PkV10MechanicItem = ...;
//   if (m.mechanic_type === "calc") {
//     const data = m.data as PkV10MechanicCalcData;
//   }
//
// All fields are optional + nullable to reflect the inert/partial reality
// of AI-extracted data. No new fields are introduced — these only describe
// keys the extractor already produces today.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Calculation mechanic data shape (e.g. percentage / fixed-amount payout calc).
 * Use when `mechanic_type` indicates a calculation primitive.
 */
export interface PkV10MechanicCalcData {
  calculation_method?: string | null;
  calculation_value?: number | string | null;
  min_calculation?: number | string | null;
  max_calculation?: number | string | null;
  payout_direction?: string | null;
  evidence?: string | null;
  [key: string]: unknown;
}

/**
 * Reward mechanic data shape (e.g. bonus, freechip, cashback payout).
 * Use when `mechanic_type` indicates a reward primitive.
 */
export interface PkV10MechanicRewardData {
  reward_type?: string | null;
  reward_mode?: string | null;
  reward_amount?: number | string | null;
  reward_currency?: string | null;
  reward_unit?: string | null;
  evidence?: string | null;
  [key: string]: unknown;
}

/**
 * Turnover mechanic data shape (e.g. wagering / rollover requirement).
 * Use when `mechanic_type` indicates a turnover primitive.
 */
export interface PkV10MechanicTurnoverData {
  turnover_rule?: string | null;
  turnover_multiplier?: number | string | null;
  turnover_basis?: string | null;
  turnover_scope?: string | null;
  evidence?: string | null;
  [key: string]: unknown;
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
    client_id_field_status: string; // PkV10ClientIdFieldStatus when filled
    client_name: string;
  };
  promo_block: {
    promo_name: string;
    promo_type: string; // PkV10PromoType when filled
    target_user: string; // PkV10TargetUser when filled
    promo_mode: string; // PkV10PromoMode when filled
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
    quality_flags: string[]; // PkV10QualityFlag[] when filled
    evidence_count: number;
    override: boolean;
    prompt_version: string;
    latency_ms: number | null;
  };
}

export interface PkV10TaxonomyEngine {
  mode_block: {
    mode: string; // PkV10TaxonomyMode when filled
    tier_archetype: string | null; // PkV10TierArchetype when filled
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
    distribution_day: string; // PkV10DistributionDay when filled
  };
}

export interface PkV10TimeWindowSlot {
  enabled: boolean;
  start_time: string;
  end_time: string;
  days: string[]; // PkV10DistributionDay[] when filled
}

export interface PkV10TimeWindowEngine {
  timezone_block: {
    timezone: string; // PkV10Timezone when filled
    offset: string; // PkV10Offset when filled
  };
  claim_window_block: PkV10TimeWindowSlot;
  distribution_window_block: PkV10TimeWindowSlot;
  reset_block: {
    enabled: boolean;
    reset_time: string;
    reset_frequency: string; // PkV10ResetFrequency when filled
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
    claim_method: string; // PkV10ClaimMethod when filled
    auto_credit: boolean;
  };
  channels_block: {
    channels: string[]; // PkV10Channel[] when filled
    priority_order: string[];
  };
  proof_requirement_block: {
    proof_required: boolean;
    proof_types: string[]; // PkV10ProofType[] when filled
    proof_destinations: string[]; // PkV10ProofDestination[] when filled
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
    providers: string[]; // PkV10ProviderBank/Ewallet/Pulsa when filled
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
    eligible_providers: string[]; // PkV10GameProvider[] when filled
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
  calculation_basis: string; // PkV10CalculationBasis when filled
  calculation_method: string; // PkV10CalculationMethod when filled
  calculation_value: number | null;
  calculation_unit: string; // PkV10CalculationUnit when filled
  payout_direction: string; // PkV10PayoutDirection when filled
  reward_type: string; // PkV10RewardType when filled
  voucher_kind: string | null; // PkV10VoucherKind when filled
  max_reward: number | null;
  currency: string | null;
}

export interface PkV10LoyaltyEngine {
  mechanism_block: {
    point_name: string; // PkV10PointName when filled
    earning_rule: string;
    loyalty_mode: string; // PkV10LoyaltyMode when filled
  };
  exchange_block: {
    exchange_groups: unknown[];
  };
  tier_block: {
    tier_system: unknown[]; // entries may carry PkV10TierName
  };
}

export interface PkV10VariantEngine {
  summary_block: {
    has_subcategories: boolean;
    expected_count: number | null;
  };
  items_block: {
    subcategories: unknown[]; // entries may carry PkV10TierDimension
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
    void_action: string; // PkV10VoidAction when filled
    penalty_type: string; // PkV10PenaltyType when filled
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
    primary_action: string; // PkV10PrimaryAction when filled
    reward_nature: string; // PkV10RewardNature when filled
    distribution_path: string; // PkV10DistributionPath when filled
    value_shape: string; // PkV10ValueShape when filled
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
    payout_direction: string; // PkV10PayoutDirection when filled
    turnover_multiplier: number | null;
    turnover_basis: string; // PkV10TurnoverBasis when filled
  };
  claim_summary_block: {
    primary_claim_method: string; // PkV10ClaimMethod when filled
    primary_claim_platform: string;
    claim_channels: string[]; // PkV10Channel[] when filled
    auto_credit: boolean;
    proof_required: boolean;
    claim_frequency: string; // PkV10ClaimFrequency when filled
    distribution_day: string; // PkV10DistributionDay when filled
  };
  scope_summary_block: {
    game_domain: string; // PkV10GameDomain when filled
    game_types: string[];
    game_providers: string[]; // PkV10GameProvider[] when filled
    game_exclusions: string[];
    platform_access: string; // PkV10PlatformAccess when filled
    apk_required: boolean;
    geo_restriction: string; // PkV10GeoRestriction when filled
    stacking_policy: string; // PkV10StackingPolicy when filled
  };
  intent_summary_block: {
    intent_category: string; // PkV10IntentCategory when filled
    primary_action: string; // PkV10PrimaryAction when filled
    reward_nature: string; // PkV10RewardNature when filled
    distribution_path: string; // PkV10DistributionPath when filled
    value_shape: string; // PkV10ValueShape when filled
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
    client_id_source: string | null; // PkV10ClientIdFieldStatus subset
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
    status: PkV10SchemaStatus;
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
 * values are 0..1 (see PK_V10_NUMERIC_RANGES). Only filled for fields the
 * AI is uncertain about. Threshold for asking Admin: < 0.7.
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

    ai_confidence: {},
    _field_status: {},
  };
}
