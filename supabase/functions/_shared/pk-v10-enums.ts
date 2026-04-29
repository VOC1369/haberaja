/**
 * PKB_WOLFBRAIN V.10 — SHARED ENUM REGISTRY (edge-safe)
 *
 * This file is a 1:1 mirror of PK_V10_* constants from
 *   src/features/promo-knowledge/schema/pk-v10.ts
 *
 * It exists because Supabase Edge Functions (Deno) cannot import from `src/`.
 * Single source of truth = WB_F3_Enum_Registry V.10 (locked 2026-04-28).
 *
 * RULES:
 *   - This file contains ONLY constants. No types, no interfaces, no factory.
 *   - Whenever pk-v10.ts changes, mirror that change here.
 *   - Do NOT add values here without updating WB_F3 first.
 */

export const PK_V10_SCHEMA_NAME = "PKB_Wolfbrain";
export const PK_V10_SCHEMA_VERSION = "V.10";
export const PK_V10_LOCKED_AT = "2026-04-28";
export const PK_V10_CREATED_BY = "habe_raja";
export const PK_V10_EXTRACTOR = "wolfclaw@claude-sonnet-4-5";
export const PK_V10_PROMPT_VERSION = "V.10_2026-04-28";

// ─── 1.1 Identity Engine ──────────────────────────────────────────────────
export const PK_V10_PROMO_TYPE = [
  "welcome_bonus", "deposit_bonus", "new_member_bonus", "cashback", "rollingan",
  "referral", "event_turnover_ladder", "event_ranking", "lucky_draw", "lucky_spin",
  "level_up", "loyalty_point", "merchandise", "freechip", "parlay_protection",
  "birthday_bonus", "extra_withdraw", "payment_discount", "mystery_number",
  "event_slot_specific", "freespin_bonus",
];

export const PK_V10_TARGET_USER = ["new_member", "existing_member", "vip", "all_member"];
export const PK_V10_PROMO_MODE = ["single", "multi"];
export const PK_V10_CLIENT_ID_FIELD_STATUS = ["explicit", "inferred", "propagated"];

// ─── 1.2 Classification Engine ────────────────────────────────────────────
export const PK_V10_PROGRAM_CLASSIFICATION = ["A", "B", "C"];
export const PK_V10_REVIEW_CONFIDENCE = ["high", "medium", "low"];
export const PK_V10_QUALITY_FLAGS = [
  "valid", "warning", "needs_review", "missing_required",
  "contradiction_detected", "ambiguity_detected", "evidence_insufficient",
];
export const PK_V10_QUESTION_ANSWER = ["ya", "tidak"];

// ─── 1.3 Taxonomy Engine ──────────────────────────────────────────────────
export const PK_V10_TAXONOMY_MODE = ["fixed", "formula", "tier", "matrix"];
export const PK_V10_TIER_ARCHETYPE = [
  "level", "user_choice_variants", "turnover_threshold_ladder", "loss_amount_range",
  "downline_count", "parlay_team_count", "stake_amount", "history_deposit_threshold",
  "point_redemption", "referral_tier", "exchange_catalog",
];
export const PK_V10_TURNOVER_BASIS = [
  "bonus_only", "deposit_only", "deposit_plus_bonus", "total_bet", "total_loss",
];

// ─── 1.4 Period Engine ────────────────────────────────────────────────────
export const PK_V10_CLAIM_FREQUENCY = ["once", "daily", "weekly", "monthly", "birthday", "on_trigger"];
export const PK_V10_VALIDITY_MODE = ["absolute", "relative"];
export const PK_V10_VALIDITY_DURATION_UNIT = ["hours", "days", "weeks", "months"];
export const PK_V10_DISTRIBUTION_DAY = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];

// ─── 1.5 Time Window Engine ───────────────────────────────────────────────
export const PK_V10_TIMEZONE = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"];
export const PK_V10_OFFSET = ["GMT+7", "GMT+8", "GMT+9"];
export const PK_V10_RESET_FREQUENCY = ["daily", "weekly", "monthly", "on_trigger"];

// ─── 1.6 Trigger Engine ───────────────────────────────────────────────────
export const PK_V10_TRIGGER_EVENT = [
  "first_deposit", "deposit", "withdrawal", "turnover_reached", "loss_incurred",
  "game_event", "downline_activity", "apk_download", "lottery_result_match",
  "birthday_date", "level_up_achieved", "rank_position", "parlay_outcome",
  "random_draw", "referral_signup",
];
export const PK_V10_LOGIC_OPERATOR = ["AND", "OR", "XOR"];
export const PK_V10_CONDITION_OPERATOR = [
  "equals", "not_equals", "greater_than", "greater_than_or_equal",
  "less_than", "less_than_or_equal", "in_range", "contains",
];

// ─── 1.7 Claim Engine ─────────────────────────────────────────────────────
export const PK_V10_CLAIM_METHOD = [
  "auto", "manual_livechat", "manual_whatsapp", "manual_telegram",
  "in_app_button", "form_submission", "cs_approval",
];
export const PK_V10_CHANNELS = [
  "livechat", "whatsapp", "telegram", "facebook", "website_form",
  "apk_redemption", "email", "phone_call",
];

// ─── 1.8 Proof Engine ─────────────────────────────────────────────────────
export const PK_V10_PROOF_TYPES = [
  "screenshot_win", "screenshot_bill", "screenshot_wd", "screenshot_deposit",
  "screenshot_apk", "foto_ktp", "foto_rekening", "parlay_ticket",
];
export const PK_V10_PROOF_DESTINATIONS = [
  "livechat", "whatsapp_official", "telegram_official", "telegram_group",
  "facebook_group", "facebook_official",
];

// ─── 1.9 Payment Engine ───────────────────────────────────────────────────
export const PK_V10_DEPOSIT_METHOD = ["bank", "ewallet", "pulsa", "qris", "crypto", "all"];
export const PK_V10_PROVIDER_EWALLET = [
  "DANA", "OVO", "GOPAY", "SHOPEEPAY", "LINKAJA", "SAKUKU", "JENIUS",
];
export const PK_V10_PROVIDER_PULSA = ["TELKOMSEL", "XL", "INDOSAT", "TRI", "SMARTFREN", "AXIS"];
export const PK_V10_PROVIDER_BANK = [
  "BCA", "BNI", "BRI", "MANDIRI", "CIMB", "DANAMON", "PERMATA", "BTN", "MAYBANK",
];

// ─── 1.10 Scope Engine ────────────────────────────────────────────────────
export const PK_V10_GAME_DOMAIN = [
  "slot", "casino", "live_casino", "sports", "sportsbook", "togel",
  "sabung_ayam", "e_lottery", "arcade", "mixed", "all",
];
export const PK_V10_PLATFORM_ACCESS = ["web", "apk", "mobile", "all"];
export const PK_V10_GEO_RESTRICTION = ["indonesia", "jakarta", "sea", "global"];
export const PK_V10_GAME_PROVIDER = [
  "Pragmatic Play", "PG Soft", "Habanero", "Spadegaming", "Microgaming",
  "Playtech", "Evolution Gaming", "Sexy Baccarat", "SBOBet", "CMD368",
  "SV388", "WS168",
];

// ─── 1.11 Reward Engine ───────────────────────────────────────────────────
export const PK_V10_CALCULATION_BASIS = [
  "deposit", "turnover", "loss", "win", "bet", "payout",
  "downline_winlose", "level_up_reward", "fixed", "rank_position", "stake_amount",
];
export const PK_V10_CALCULATION_METHOD = [
  "percentage", "fixed", "tiered", "matrix_lookup", "conditional",
];
export const PK_V10_CALCULATION_UNIT = ["percent", "fixed_idr"];
export const PK_V10_PAYOUT_DIRECTION = ["upfront", "backend"];
export const PK_V10_REWARD_TYPE = [
  "physical", "cash", "credit_game", "voucher", "ticket",
  "lucky_spin", "discount", "freespin", "combo",
];
export const PK_V10_VOUCHER_KIND = [
  "deposit_bonus", "lucky_spin_entry", "event_entry", "discount_code",
  "free_play", "cashback_voucher", "other",
];

// ─── 1.12 Loyalty Engine ──────────────────────────────────────────────────
export const PK_V10_POINT_NAME = ["LP", "EXP", "XP", "COIN", "GEM"];
export const PK_V10_LOYALTY_MODE = ["exp_store", "level_up", "both"];
export const PK_V10_TIER_NAME = [
  "Bronze", "Silver", "Gold", "Platinum", "Diamond",
  "Starter", "VIP", "Elite", "Legend",
];

// ─── 1.13 Variant Engine ──────────────────────────────────────────────────
export const PK_V10_TIER_DIMENSION = [
  "level", "turnover_threshold", "loss_amount_range", "downline_count",
  "parlay_team_count", "stake_amount", "history_deposit_threshold",
  "deposit_amount", "point_balance", "team_count", "bet_amount",
];

// ─── 1.14 Dependency Engine ───────────────────────────────────────────────
export const PK_V10_STACKING_POLICY = [
  "no_stacking", "stack_with_whitelist", "stack_freely", "conditional_stack",
];

// ─── 1.15 Invalidation Engine ─────────────────────────────────────────────
export const PK_V10_INVALIDATOR_TRIGGER_TYPE = ["fraud", "violation", "operational"];
export const PK_V10_VOID_TRIGGER = [
  "bonus_hunter", "safety_bet", "invest", "ip_duplicate", "data_duplicate",
  "deposit_fraud", "hold_freespin", "multi_accounting", "self_referral",
  "account_change", "claim_timeout", "wrong_bank_info", "screenshot_missing",
  "game_category_violation", "cashout_partial",
];
export const PK_V10_VOID_ACTION = [
  "bonus_cancel", "full_balance_void", "winnings_void",
  "bonus_and_winnings_void", "account_suspend", "permanent_ban",
];
export const PK_V10_PENALTY_TYPE = [
  "bonus_forfeit", "winnings_forfeit", "balance_forfeit",
  "full_forfeit", "account_restriction",
];
export const PK_V10_PENALTY_SCOPE = [
  "current_promo_only", "all_active_promos", "all_account_balance", "future_participation",
];

// ─── 1.16 Readiness Engine ────────────────────────────────────────────────
export const PK_V10_READINESS_STATE = ["draft", "ready", "published", "rejected"];
export const PK_V10_VALIDATION_STATUS = ["draft", "ready", "needs_review", "rejected"];

// ─── 1.17 Reasoning Engine ────────────────────────────────────────────────
export const PK_V10_PRIMARY_ACTION = [
  "deposit_to_bonus", "lose_to_cashback", "bet_to_rollingan", "refer_to_commission",
  "redeem_to_reward", "turnover_to_rank", "milestone_to_merchandise",
  "app_install_to_credit", "birthday_to_bonus",
];
export const PK_V10_REWARD_NATURE = [
  "monetary", "physical_goods", "credit_game", "access_right", "discount", "status_upgrade",
];
export const PK_V10_DISTRIBUTION_PATH = [
  "direct_to_balance", "to_bonus_wallet", "physical_shipping",
  "manual_disbursement", "apk_redemption", "event_drawing",
];
export const PK_V10_VALUE_SHAPE = [
  "percentage_of_base", "fixed_amount", "tiered_escalating", "matrix_lookup",
  "random_draw", "ladder_milestone", "exchange_rate_based",
];

// ─── 1.18 Mechanics Engine ────────────────────────────────────────────────
export const PK_V10_MECHANIC_TYPE = [
  "eligibility", "trigger", "calculation", "reward", "claim", "control",
  "invalidator", "distribution", "turnover", "dependency", "intent",
  "scope", "proof", "time_window",
];
export const PK_V10_MECHANICS_SOURCE = ["llm_text", "llm_image", "llm_multimodal", "manual"];

// ─── 1.19 Meta Engine ─────────────────────────────────────────────────────
export const PK_V10_EXTRACTION_SOURCE = ["plain_text", "html", "image", "pdf", "multimodal"];
export const PK_V10_SOURCE_TYPE = ["text_paste", "website", "image_upload", "pdf_upload"];
export const PK_V10_SCHEMA_STATUS = ["locked", "draft"];

// ─── 1.20 Risk Engine ─────────────────────────────────────────────────────
export const PK_V10_RISK_LEVEL = ["low", "medium", "high", "critical"];

// ─── 1.21 Field Status & Confidence ───────────────────────────────────────
export const PK_V10_FIELD_STATUS = [
  "explicit", "inferred", "derived", "propagated", "not_stated", "not_applicable",
];
export const PK_V10_INTENT_CATEGORY = [
  "acquisition", "retention", "reactivation", "engagement", "virality", "upsell",
];

export const PK_V10_AI_CONFIDENCE_QUESTION_THRESHOLD = 0.7;

// ──────────────────────────────────────────────────────────────────────────
// Convenience map for tool-schema enum injection (path → const list)
// ──────────────────────────────────────────────────────────────────────────
export const ENUMS = {
  promo_type: PK_V10_PROMO_TYPE,
  target_user: PK_V10_TARGET_USER,
  promo_mode: PK_V10_PROMO_MODE,
  client_id_field_status: PK_V10_CLIENT_ID_FIELD_STATUS,
  program_classification: PK_V10_PROGRAM_CLASSIFICATION,
  review_confidence: PK_V10_REVIEW_CONFIDENCE,
  quality_flag: PK_V10_QUALITY_FLAGS,
  question_answer: PK_V10_QUESTION_ANSWER,
  taxonomy_mode: PK_V10_TAXONOMY_MODE,
  tier_archetype: PK_V10_TIER_ARCHETYPE,
  turnover_basis: PK_V10_TURNOVER_BASIS,
  claim_frequency: PK_V10_CLAIM_FREQUENCY,
  validity_mode: PK_V10_VALIDITY_MODE,
  validity_duration_unit: PK_V10_VALIDITY_DURATION_UNIT,
  distribution_day: PK_V10_DISTRIBUTION_DAY,
  timezone: PK_V10_TIMEZONE,
  offset: PK_V10_OFFSET,
  reset_frequency: PK_V10_RESET_FREQUENCY,
  trigger_event: PK_V10_TRIGGER_EVENT,
  logic_operator: PK_V10_LOGIC_OPERATOR,
  condition_operator: PK_V10_CONDITION_OPERATOR,
  claim_method: PK_V10_CLAIM_METHOD,
  channel: PK_V10_CHANNELS,
  proof_type: PK_V10_PROOF_TYPES,
  proof_destination: PK_V10_PROOF_DESTINATIONS,
  deposit_method: PK_V10_DEPOSIT_METHOD,
  game_domain: PK_V10_GAME_DOMAIN,
  platform_access: PK_V10_PLATFORM_ACCESS,
  geo_restriction: PK_V10_GEO_RESTRICTION,
  game_provider: PK_V10_GAME_PROVIDER,
  calculation_basis: PK_V10_CALCULATION_BASIS,
  calculation_method: PK_V10_CALCULATION_METHOD,
  calculation_unit: PK_V10_CALCULATION_UNIT,
  payout_direction: PK_V10_PAYOUT_DIRECTION,
  reward_type: PK_V10_REWARD_TYPE,
  voucher_kind: PK_V10_VOUCHER_KIND,
  point_name: PK_V10_POINT_NAME,
  loyalty_mode: PK_V10_LOYALTY_MODE,
  tier_name: PK_V10_TIER_NAME,
  tier_dimension: PK_V10_TIER_DIMENSION,
  stacking_policy: PK_V10_STACKING_POLICY,
  invalidator_trigger_type: PK_V10_INVALIDATOR_TRIGGER_TYPE,
  void_trigger: PK_V10_VOID_TRIGGER,
  void_action: PK_V10_VOID_ACTION,
  penalty_type: PK_V10_PENALTY_TYPE,
  penalty_scope: PK_V10_PENALTY_SCOPE,
  readiness_state: PK_V10_READINESS_STATE,
  validation_status: PK_V10_VALIDATION_STATUS,
  primary_action: PK_V10_PRIMARY_ACTION,
  reward_nature: PK_V10_REWARD_NATURE,
  distribution_path: PK_V10_DISTRIBUTION_PATH,
  value_shape: PK_V10_VALUE_SHAPE,
  mechanic_type: PK_V10_MECHANIC_TYPE,
  mechanics_source: PK_V10_MECHANICS_SOURCE,
  extraction_source: PK_V10_EXTRACTION_SOURCE,
  source_type: PK_V10_SOURCE_TYPE,
  schema_status: PK_V10_SCHEMA_STATUS,
  risk_level: PK_V10_RISK_LEVEL,
  field_status: PK_V10_FIELD_STATUS,
  intent_category: PK_V10_INTENT_CATEGORY,
};
