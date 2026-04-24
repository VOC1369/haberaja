/**
 * PSEUDO ENGINE SCHEMA — ENUM REGISTRY
 *
 * Single source of truth untuk SEMUA enum di Json Schema Contract V.09.
 * 30+ enum group, 200+ value, brand-agnostic (kecuali GAME_PROVIDER & DEPOSIT_PROVIDER_*
 * yang memang vendor brand list).
 *
 * Dipakai oleh:
 *   - LLM extractor (tool calling schema)
 *   - Validator (per-engine field check)
 *   - Form UI (select options)
 *
 * NOTE: Beberapa enum punya `null` sebagai valid value — itu by design (Schema V.06 §6).
 */

// ============================================================
// IDENTITY ENGINE
// ============================================================
export const PROMO_TYPE = [
  "welcome_bonus", "deposit_bonus", "new_member_bonus", "cashback", "rollingan",
  "referral", "event_turnover_ladder", "event_ranking", "lucky_draw", "lucky_spin",
  "level_up", "loyalty_point", "merchandise", "freechip", "parlay_protection",
  "birthday_bonus", "extra_withdraw", "payment_discount", "mystery_number",
  "event_slot_specific", "freespin_bonus",
] as const;
export type PromoType = typeof PROMO_TYPE[number] | "";

export const TARGET_USER = ["new_member", "existing_member", "vip", "all_member"] as const;
export type TargetUser = typeof TARGET_USER[number] | "";

export const PROMO_MODE = ["single", "multi"] as const;
export type PromoMode = typeof PROMO_MODE[number] | "";

// ============================================================
// CLASSIFICATION ENGINE
// ============================================================
export const PROGRAM_CLASSIFICATION = ["A", "B", "C"] as const;
export type ProgramClassification = typeof PROGRAM_CLASSIFICATION[number] | "";

export const REVIEW_CONFIDENCE = ["high", "medium", "low"] as const;
export type ReviewConfidence = typeof REVIEW_CONFIDENCE[number] | "";

export const QUESTION_ANSWER = ["ya", "tidak"] as const;
export type QuestionAnswer = typeof QUESTION_ANSWER[number] | "";

// ============================================================
// TAXONOMY ENGINE
// ============================================================
export const MODE = ["fixed", "formula", "tier", "matrix"] as const;
export type TaxonomyMode = typeof MODE[number] | "";

export const TIER_ARCHETYPE = [
  "level", "user_choice_variants", "turnover_threshold_ladder",
  "loss_amount_range", "downline_count", "parlay_team_count",
  "stake_amount", "history_deposit_threshold", "point_store",
  "referral_tier", "exchange_catalog",
] as const;
export type TierArchetype = typeof TIER_ARCHETYPE[number] | null;

export const TURNOVER_BASIS = [
  "bonus_only", "deposit_only", "deposit_plus_bonus", "total_bet", "total_loss",
] as const;
export type TurnoverBasis = typeof TURNOVER_BASIS[number] | null;

// ============================================================
// PERIOD ENGINE
// ============================================================
export const CLAIM_FREQUENCY = [
  "once", "daily", "weekly", "monthly", "birthday", "on_trigger",
] as const;
export type ClaimFrequency = typeof CLAIM_FREQUENCY[number] | "";

export const DAY_OF_WEEK = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
] as const;
export type DayOfWeek = typeof DAY_OF_WEEK[number];

export const REWARD_DISTRIBUTION = [
  "immediate", "scheduled_day", "monthly_cycle", "on_request", "hourly_range",
] as const;
export type RewardDistribution = typeof REWARD_DISTRIBUTION[number] | "";

// ============================================================
// TIME WINDOW ENGINE
// ============================================================
export const TIMEZONE = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"] as const;
export type Timezone = typeof TIMEZONE[number] | "";

export const TIMEZONE_OFFSET = ["GMT+7", "GMT+8", "GMT+9"] as const;
export type TimezoneOffset = typeof TIMEZONE_OFFSET[number] | "";

// ============================================================
// TRIGGER ENGINE
// ============================================================
export const TRIGGER_EVENT = [
  "first_deposit", "deposit", "withdrawal", "turnover_reached", "loss_incurred",
  "game_event", "downline_activity", "app_install", "birthday_date",
  "level_up_achieved", "rank_position", "parlay_outcome", "random_draw",
  "referral_signup",
] as const;
export type TriggerEvent = typeof TRIGGER_EVENT[number] | "";

export const LOGIC_OPERATOR = ["AND", "OR", "XOR"] as const;
export type LogicOperator = typeof LOGIC_OPERATOR[number] | "";

export const CONDITION_OPERATOR = [
  "equals", "not_equals", "greater_than", "greater_than_or_equal",
  "less_than", "less_than_or_equal", "in_range", "contains",
] as const;
export type ConditionOperator = typeof CONDITION_OPERATOR[number] | "";

// ============================================================
// CLAIM ENGINE
// ============================================================
export const CLAIM_METHOD = [
  "auto", "manual_livechat", "manual_whatsapp", "manual_telegram",
  "in_app_button", "form_submission", "cs_approval",
] as const;
export type ClaimMethod = typeof CLAIM_METHOD[number] | "";

export const CLAIM_CHANNEL = [
  "livechat", "whatsapp", "telegram", "facebook", "website_form",
  "apk_redemption", "email", "phone_call",
] as const;
export type ClaimChannel = typeof CLAIM_CHANNEL[number];

// ============================================================
// PROOF ENGINE
// ============================================================
export const PROOF_TYPE = [
  "screenshot_win", "screenshot_bill", "screenshot_wd", "screenshot_deposit",
  "screenshot_apk", "foto_ktp", "foto_rekening", "parlay_ticket",
] as const;
export type ProofType = typeof PROOF_TYPE[number];

export const PROOF_DESTINATION = [
  "livechat", "whatsapp_official", "telegram_official", "telegram_group",
  "facebook_group", "facebook_official",
] as const;
export type ProofDestination = typeof PROOF_DESTINATION[number];

export const HASHTAG_REQUIREMENT = ["none", "specific_hashtag", "brand_praise"] as const;
export type HashtagRequirement = typeof HASHTAG_REQUIREMENT[number] | "";

// ============================================================
// PAYMENT ENGINE
// ============================================================
export const DEPOSIT_METHOD = ["bank", "ewallet", "pulsa", "qris", "crypto", "all"] as const;
export type DepositMethod = typeof DEPOSIT_METHOD[number] | "";

export const DEPOSIT_PROVIDER_EWALLET = [
  "DANA", "OVO", "GOPAY", "SHOPEEPAY", "LINKAJA", "SAKUKU", "JENIUS",
] as const;
export const DEPOSIT_PROVIDER_PULSA = [
  "TELKOMSEL", "XL", "INDOSAT", "TRI", "SMARTFREN", "AXIS",
] as const;
export const DEPOSIT_PROVIDER_BANK = [
  "BCA", "BNI", "BRI", "MANDIRI", "CIMB", "DANAMON", "PERMATA", "BTN", "MAYBANK",
] as const;

// ============================================================
// SCOPE ENGINE
// ============================================================
export const GAME_DOMAIN = [
  "slot", "casino", "live_casino", "sports", "sportsbook", "togel",
  "sabung_ayam", "e_lottery", "arcade", "mixed", "all",
] as const;
export type GameDomain = typeof GAME_DOMAIN[number] | "";

export const GAME_PROVIDER = [
  "Pragmatic Play", "PG Soft", "Habanero", "Spadegaming", "Microgaming",
  "Playtech", "Game Play", "Mega888", "IDN Slot", "CQ9", "Jili", "Joker Gaming",
  "Evolution Gaming", "Sexy Baccarat", "Pretty Gaming", "Pragmatic Casino",
  "Asia Gaming", "Allbet", "SBOBet", "CMD368", "Saba Sports", "SV388", "WS168",
] as const;

// ============================================================
// REWARD ENGINE
// ============================================================
export const CALCULATION_BASIS = [
  "deposit", "turnover", "loss", "win", "bet", "payout", "downline_winlose",
  "level_up_reward", "fixed", "rank_position", "stake_amount",
] as const;
export type CalculationBasis = typeof CALCULATION_BASIS[number] | null;

export const CALCULATION_METHOD = [
  "percentage", "fixed", "tiered", "matrix_lookup", "conditional",
] as const;
export type CalculationMethod = typeof CALCULATION_METHOD[number] | "";

export const PAYOUT_DIRECTION = ["upfront", "backend"] as const;
export type PayoutDirection = typeof PAYOUT_DIRECTION[number] | null;

export const REWARD_TYPE = [
  "physical", "cash", "credit_game", "voucher", "ticket", "lucky_spin",
  "discount", "freespin", "combo",
] as const;
export type RewardType = typeof REWARD_TYPE[number] | "";

export const VOUCHER_KIND = [
  "deposit_bonus", "lucky_spin_entry", "event_entry", "discount_code",
  "free_play", "cashback_voucher", "other",
] as const;
export type VoucherKind = typeof VOUCHER_KIND[number] | "";

// ============================================================
// LOYALTY ENGINE
// ============================================================
export const POINT_NAME = ["LP", "EXP", "XP", "COIN", "GEM"] as const;
export type PointName = typeof POINT_NAME[number] | "";

export const TIER_NAME = [
  "Bronze", "Silver", "Gold", "Platinum", "Diamond",
  "Starter", "VIP", "Elite", "Legend",
] as const;

// ============================================================
// VARIANT ENGINE
// ============================================================
export const TIER_DIMENSION = [
  "level", "turnover_threshold", "loss_amount_range", "downline_count",
  "parlay_team_count", "stake_amount", "history_deposit_threshold",
  "deposit_amount", "point_balance", "team_count", "bet_amount",
] as const;
export type TierDimension = typeof TIER_DIMENSION[number] | null;

export const TURNOVER_RULE_FORMAT = ["multiplier", "min_rupiah", "formula"] as const;
export type TurnoverRuleFormat = typeof TURNOVER_RULE_FORMAT[number] | null;

// ============================================================
// DEPENDENCY ENGINE
// ============================================================
export const STACKING_POLICY = [
  "no_stacking", "stack_with_whitelist", "stack_freely", "conditional_stack",
] as const;
export type StackingPolicy = typeof STACKING_POLICY[number] | "";

// ============================================================
// INVALIDATION ENGINE
// ============================================================
export const VOID_TRIGGER = [
  "bonus_hunter", "safety_bet", "invest", "ip_duplicate", "data_duplicate",
  "deposit_fraud", "hold_freespin", "multi_accounting", "self_referral",
  "account_change", "claim_timeout", "wrong_bank_info", "screenshot_missing",
  "game_category_violation", "cashout_partial",
] as const;
export type VoidTrigger = typeof VOID_TRIGGER[number];

export const VOID_ACTION = [
  "bonus_cancel", "full_balance_void", "winnings_void",
  "bonus_and_winnings_void", "account_suspend", "permanent_ban",
] as const;
export type VoidAction = typeof VOID_ACTION[number] | "";

export const PENALTY_TYPE = [
  "bonus_forfeit", "winnings_forfeit", "balance_forfeit",
  "full_forfeit", "account_restriction",
] as const;
export type PenaltyType = typeof PENALTY_TYPE[number] | "";

export const PENALTY_SCOPE = [
  "current_promo_only", "all_active_promos", "all_account_balance", "future_participation",
] as const;
export type PenaltyScope = typeof PENALTY_SCOPE[number] | "";

// ============================================================
// READINESS ENGINE — STATE MACHINE
// ============================================================
export const STATE = [
  "ai_draft", "reviewed", "finalized", "published", "archived",
] as const;
export type LifecycleState = typeof STATE[number];

export const VALIDATION_STATUS = [
  "draft", "ready", "needs_review", "rejected", "published",
] as const;
export type ValidationStatus = typeof VALIDATION_STATUS[number] | "";

export const QUALITY_FLAG = [
  "valid", "warning", "needs_review", "missing_required",
  "contradiction_detected", "ambiguity_detected", "evidence_insufficient",
] as const;
export type QualityFlag = typeof QUALITY_FLAG[number];

// ============================================================
// REASONING ENGINE
// ============================================================
export const PRIMARY_ACTION = [
  "deposit_to_bonus", "lose_to_cashback", "bet_to_rollingan",
  "refer_to_commission", "redeem_to_reward", "turnover_to_rank",
  "milestone_to_merchandise", "app_install_to_credit", "birthday_to_bonus",
] as const;
export type PrimaryAction = typeof PRIMARY_ACTION[number] | "";

export const REWARD_NATURE = [
  "monetary", "physical_goods", "credit_game",
  "access_right", "discount", "status_upgrade",
] as const;
export type RewardNature = typeof REWARD_NATURE[number] | "";

export const DISTRIBUTION_PATH = [
  "direct_to_balance", "to_bonus_wallet", "physical_shipping",
  "manual_disbursement", "apk_redemption", "event_drawing",
] as const;
export type DistributionPath = typeof DISTRIBUTION_PATH[number] | "";

export const VALUE_SHAPE = [
  "percentage_of_base", "fixed_amount", "tiered_escalating",
  "matrix_lookup", "random_draw", "ladder_milestone", "exchange_rate_based",
] as const;
export type ValueShape = typeof VALUE_SHAPE[number] | "";

// ============================================================
// MECHANICS ENGINE
// ============================================================
export const MECHANIC_TYPE = [
  "eligibility", "trigger", "calculation", "reward", "claim", "control",
  "invalidator", "distribution", "turnover", "dependency", "intent",
  "scope", "proof", "time_window",
] as const;
export type MechanicType = typeof MECHANIC_TYPE[number];

export const MECHANIC_SOURCE = [
  "llm_text_extraction", "llm_image_extraction", "llm_multimodal",
  "manual_entry", "operator_correction",
] as const;
export type MechanicSource = typeof MECHANIC_SOURCE[number] | "";

// ============================================================
// FIELD STATUS (provenance)
// ============================================================
export const FIELD_STATUS = [
  "explicit", "inferred", "derived", "unknown", "not_applicable",
] as const;
export type FieldStatus = typeof FIELD_STATUS[number] | "";

// ============================================================
// PROJECTION ENGINE (derived)
// ============================================================
export const INTENT_CATEGORY = [
  "acquisition", "retention", "reactivation", "engagement", "virality", "upsell",
] as const;
export type IntentCategory = typeof INTENT_CATEGORY[number] | "";

// ============================================================
// META ENGINE
// ============================================================
export const EXTRACTION_SOURCE = ["image", "text", "html", "multimodal"] as const;
export type ExtractionSource = typeof EXTRACTION_SOURCE[number] | "";

export const SOURCE_TYPE = ["website", "image_upload", "text_paste", "api_feed"] as const;
export type SourceType = typeof SOURCE_TYPE[number] | "";

// ============================================================
// RISK ENGINE
// ============================================================
export const PROMO_RISK_LEVEL = ["low", "medium", "high", "critical"] as const;
export type PromoRiskLevel = typeof PROMO_RISK_LEVEL[number] | "";

// ============================================================
// EXPORT BUNDLES (for prompt injection / form options)
// ============================================================
export const ENUM_BUNDLE = {
  PROMO_TYPE, TARGET_USER, PROMO_MODE,
  PROGRAM_CLASSIFICATION, REVIEW_CONFIDENCE, QUESTION_ANSWER,
  MODE, TIER_ARCHETYPE, TURNOVER_BASIS,
  CLAIM_FREQUENCY, DAY_OF_WEEK, REWARD_DISTRIBUTION,
  TIMEZONE, TIMEZONE_OFFSET,
  TRIGGER_EVENT, LOGIC_OPERATOR, CONDITION_OPERATOR,
  CLAIM_METHOD, CLAIM_CHANNEL,
  PROOF_TYPE, PROOF_DESTINATION, HASHTAG_REQUIREMENT,
  DEPOSIT_METHOD, DEPOSIT_PROVIDER_EWALLET, DEPOSIT_PROVIDER_PULSA, DEPOSIT_PROVIDER_BANK,
  GAME_DOMAIN, GAME_PROVIDER,
  CALCULATION_BASIS, CALCULATION_METHOD, PAYOUT_DIRECTION, REWARD_TYPE, VOUCHER_KIND,
  POINT_NAME, TIER_NAME,
  TIER_DIMENSION, TURNOVER_RULE_FORMAT,
  STACKING_POLICY,
  VOID_TRIGGER, VOID_ACTION, PENALTY_TYPE, PENALTY_SCOPE,
  STATE, VALIDATION_STATUS, QUALITY_FLAG,
  PRIMARY_ACTION, REWARD_NATURE, DISTRIBUTION_PATH, VALUE_SHAPE,
  MECHANIC_TYPE, MECHANIC_SOURCE,
  FIELD_STATUS,
  INTENT_CATEGORY,
  EXTRACTION_SOURCE, SOURCE_TYPE,
  PROMO_RISK_LEVEL,
} as const;
