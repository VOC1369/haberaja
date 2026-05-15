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
 *
 * ─── PHASE C1-A — V.10.2 ADDITIVE (15 Mei 2026) ──────────────────────────
 * OFFICIAL SCHEMA AUTHORITY = V.10.2 (per F3_Enum_Registry V.10.2)
 * CURRENT EXTRACTOR RUNTIME = V.10.1 (PK_V10_SCHEMA_VERSION unchanged)
 * MIGRATION STATUS = C1A_EDGE_VOCABULARY_ADDITIVE_ONLY
 *
 * Per F3 V.10.2 changelog: "Backward compatibility: Strictly additive —
 * semua enum V.10.1 tetap berlaku." Every value present in V.10.1 stays.
 * V.10.2 contributions appended in-place; brand-new V.10.2 enums added
 * as new exports below + wired into ENUMS map.
 *
 * NOT TOUCHED in C1-A:
 *   - PK_V10_SCHEMA_VERSION (still V.10.1)
 *   - src/features/promo-knowledge/schema/enums.ts (FE)
 *   - extractor logic / tool schema / FormWizard / livechat
 *   - No rename, no removal of any existing value
 * ─────────────────────────────────────────────────────────────────────────
 */

export const PK_V10_SCHEMA_NAME = "PKB_Wolfbrain";
export const PK_V10_SCHEMA_VERSION = "V.10.1";
export const PK_V10_BASE_LOCKED_AT = "2026-04-28";
export const PK_V10_RELEASED_AT = "2026-05-04";
export const PK_V10_CREATED_BY = "habe_raja";
export const PK_V10_OWNER =
  "Habe Raja — Wolfbrain / Promo Knowledge Base";
export const PK_V10_EXTRACTOR = "wolfclaw@claude-sonnet-4-5";
export const PK_V10_PROMPT_VERSION = "V.10.1_2026-05-04";
export const PK_V10_AMENDMENT_TYPE = "minor";
export const PK_V10_AMENDMENT_REASON =
  "Naming cleanup, duplicate removal, variant field-level clarification";
/** @deprecated retained for backward import compatibility — use PK_V10_BASE_LOCKED_AT */
export const PK_V10_LOCKED_AT = PK_V10_BASE_LOCKED_AT;

// ─── 1.1 Identity Engine ──────────────────────────────────────────────────
export const PK_V10_PROMO_TYPE = [
  "welcome_bonus", "deposit_bonus", "new_member_bonus", "cashback", "rollingan",
  "referral", "event_turnover_ladder", "event_ranking", "lucky_draw", "lucky_spin",
  "level_up", "loyalty_point", "merchandise", "freechip", "parlay_protection",
  "birthday_bonus", "extra_withdraw", "payment_discount", "mystery_number",
  "event_slot_specific", "freespin_bonus",
  // V.10.2 additive
  "event_sports_specific", "withdraw_bonus", "apk_signup_bonus",
  "weekend_special", "tier_upgrade_event",
];

export const PK_V10_TARGET_USER = [
  "new_member", "existing_member", "vip", "all_member",
  // V.10.2 additive
  "referrer", "downline",
];
export const PK_V10_PROMO_MODE = ["single", "multi"];
export const PK_V10_CLIENT_ID_FIELD_STATUS = ["explicit", "inferred", "propagated"];
// V.10.2 NEW
export const PK_V10_CLIENT_ID_CONFIDENCE = ["high", "medium", "low"];

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
  // V.10.2 additive
  "parlay_lose_count", "deposit_amount_tier", "winstreak_count", "rank_position",
];
export const PK_V10_TURNOVER_BASIS = [
  "bonus_only", "deposit_only", "deposit_plus_bonus", "total_bet", "total_loss",
];
// V.10.2 NEW (tier_threshold_block)
export const PK_V10_TIER_THRESHOLD_BASIS = [
  "deposit", "turnover", "loss", "downline_count", "team_count",
  "stake", "point_balance", "level",
];
export const PK_V10_TIER_THRESHOLD_UNIT = [
  "idr", "percent", "count", "multiplier", "points",
];
export const PK_V10_TIER_THRESHOLD_REWARD_UNIT = [
  "percent", "idr", "multiplier", "points", "items",
];

// ─── 1.4 Period Engine ────────────────────────────────────────────────────
export const PK_V10_CLAIM_FREQUENCY = [
  "once", "daily", "weekly", "monthly", "birthday", "on_trigger",
  // V.10.2 additive
  "quarterly", "yearly", "per_match", "per_event", "lifetime",
];
export const PK_V10_VALIDITY_MODE = [
  "absolute", "relative",
  // V.10.2 additive
  "unlimited",
];
export const PK_V10_VALIDITY_DURATION_UNIT = [
  "hours", "days", "weeks", "months",
  // V.10.2 additive
  "years",
];
export const PK_V10_DISTRIBUTION_DAY = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];
// V.10.2 NEW
export const PK_V10_CALCULATION_PERIOD = [
  "daily", "weekly", "monthly", "quarterly", "yearly", "custom",
];
export const PK_V10_SCHEDULE_VARIANT_TYPE = [
  "day_of_week", "time_of_day", "date_range", "weekday_weekend", "custom",
];

// ─── 1.5 Time Window Engine ───────────────────────────────────────────────
export const PK_V10_TIMEZONE = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"];
export const PK_V10_OFFSET = ["GMT+7", "GMT+8", "GMT+9"];
export const PK_V10_RESET_FREQUENCY = ["daily", "weekly", "monthly", "on_trigger"];
// V.10.2 NEW (alias of distribution_day for time_window blocks)
export const PK_V10_TIME_WINDOW_DAYS = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];

// ─── 1.6 Trigger Engine ───────────────────────────────────────────────────
export const PK_V10_TRIGGER_EVENT = [
  "first_deposit", "deposit", "withdrawal", "turnover_reached", "loss_incurred",
  "game_event", "downline_activity", "apk_download", "lottery_result_match",
  "birthday_date", "level_up_achieved", "rank_position", "parlay_outcome",
  "random_draw", "referral_signup",
  // V.10.2 additive
  "downline_bet_placed", "ticket_drawn", "match_result", "red_card_event",
  "scatter_hit", "multiplier_hit", "goal_scored", "corner_kick",
];
export const PK_V10_LOGIC_OPERATOR = ["AND", "OR", "XOR"];
export const PK_V10_CONDITION_OPERATOR = [
  "equals", "not_equals", "greater_than", "greater_than_or_equal",
  "less_than", "less_than_or_equal", "in_range", "contains",
];
// V.10.2 NEW
export const PK_V10_RULE_TYPE = [
  "simple", "compound", "sequential", "conditional", "threshold", "recurring",
];
export const PK_V10_TRIGGER_ACTION = [
  "auto_credit", "manual_claim", "auto_calculate",
  "notify_user", "trigger_event_window", "trigger_draw",
];

// ─── 1.7 Claim Engine ─────────────────────────────────────────────────────
export const PK_V10_CLAIM_METHOD = [
  "auto", "manual_livechat", "manual_whatsapp", "manual_telegram",
  "in_app_button", "form_submission", "cs_approval",
  // V.10.2 additive
  "referral_menu", "loyalty_menu", "event_menu",
];
export const PK_V10_CHANNELS = [
  "livechat", "whatsapp", "telegram", "facebook", "website_form",
  "apk_redemption", "email", "phone_call",
  // V.10.2 additive
  "in_app_menu",
];
// V.10.2 NEW (claim_gate_block.*)
export const PK_V10_CLAIM_DEADLINE_UNIT = ["hours", "days", "weeks", "months"];
export const PK_V10_CLAIM_DEADLINE_ANCHOR = [
  "deposit", "withdraw", "event_result", "level_up", "claim",
  "signup", "birthday", "prize_announcement", "match_end", "period_end",
];
export const PK_V10_CLAIM_LIMIT_PERIOD = [
  "daily", "weekly", "monthly", "yearly",
  "per_event", "per_match", "lifetime",
];
export const PK_V10_CLAIM_LIMIT_SCOPE = [
  "per_user", "per_event", "per_match", "per_promo",
  "per_account", "lifetime_per_user", "account_wide",
];
export const PK_V10_CLAIM_RESET_FREQUENCY = [
  "daily", "weekly", "monthly", "never", "on_trigger",
];
export const PK_V10_ACTIVE_USER_PERIOD_UNIT = ["hours", "days", "weeks", "months"];
export const PK_V10_HISTORY_DEPOSIT_PERIOD_UNIT = ["hours", "days", "weeks", "months"];

// ─── 1.8 Proof Engine ─────────────────────────────────────────────────────
export const PK_V10_PROOF_TYPES = [
  "screenshot_win", "screenshot_bill", "screenshot_wd", "screenshot_deposit",
  "screenshot_apk", "foto_ktp", "foto_rekening", "parlay_ticket",
  // V.10.2 additive
  "screenshot_share", "foto_kk", "video_share", "referral_link_screenshot",
];
export const PK_V10_PROOF_DESTINATIONS = [
  "livechat", "whatsapp_official", "telegram_official", "telegram_group",
  "facebook_group", "facebook_official",
  // V.10.2 additive
  "in_app_upload",
];
// V.10.2 NEW
export const PK_V10_SOCIAL_PROOF_SHARE_TARGET_GROUP_TYPE = [
  "own_timeline", "public_group", "private_group",
  "official_group", "multiple_groups", "story", "reel",
];
export const PK_V10_SCREENSHOT_PROOF_SS_TARGETS = [
  "deposit_receipt", "withdrawal_receipt", "win_screen", "loss_screen",
  "game_screen", "bill_screen", "apk_install_screen",
  "referral_link_screen", "share_post_screen", "account_balance_screen",
];

// ─── 1.9 Payment Engine ───────────────────────────────────────────────────
export const PK_V10_DEPOSIT_METHOD = ["bank", "ewallet", "pulsa", "qris", "crypto", "all"];
export const PK_V10_PROVIDER_EWALLET = [
  "DANA", "OVO", "GOPAY", "SHOPEEPAY", "LINKAJA", "SAKUKU", "JENIUS",
];
export const PK_V10_PROVIDER_PULSA = ["TELKOMSEL", "XL", "INDOSAT", "TRI", "SMARTFREN", "AXIS"];
export const PK_V10_PROVIDER_BANK = [
  "BCA", "BNI", "BRI", "MANDIRI", "CIMB", "DANAMON", "PERMATA", "BTN", "MAYBANK",
  // V.10.2 additive
  "BSI", "OCBC", "PANIN", "BTPN", "MEGA", "BJB",
];
// V.10.2 NEW
export const PK_V10_PROVIDER_QRIS = ["QRIS"];
export const PK_V10_PROVIDER_CRYPTO = ["USDT", "BTC", "ETH"];

// ─── 1.10 Scope Engine ────────────────────────────────────────────────────
export const PK_V10_GAME_DOMAIN = [
  "slot", "casino", "live_casino", "sports", "sportsbook", "togel",
  "sabung_ayam", "e_lottery", "arcade", "mixed", "all",
];
export const PK_V10_PLATFORM_ACCESS = [
  "web", "apk", "mobile", "all",
  // V.10.2 additive
  "desktop_only",
];
export const PK_V10_GEO_RESTRICTION = [
  "indonesia", "jakarta", "sea", "global",
  // V.10.2 additive
  "custom",
];
export const PK_V10_GAME_PROVIDER = [
  "Pragmatic Play", "PG Soft", "Habanero", "Spadegaming", "Microgaming",
  "Playtech", "Evolution Gaming", "Sexy Baccarat", "SBOBet", "CMD368",
  "SV388", "WS168",
  // V.10.2 additive
  "Pretty Gaming", "Joker Gaming", "NoLimit City", "Live22", "Mega888",
  "GamePlay", "Hot Game", "Yggdrasil", "ION Casino", "SA Gaming",
  "Big Gaming", "AE Sexy", "Asia Gaming", "NextSpin", "Slot88",
];
// V.10.2 NEW
export const PK_V10_GAME_TYPES = [
  "slot", "casino_live", "casino_table", "sports_match", "sports_parlay",
  "togel_4d", "togel_3d", "togel_2d", "togel_other",
  "arcade", "e_lottery", "sabung_ayam",
  "mahjong", "poker", "domino", "fish_hunter",
];
export const PK_V10_BET_TYPES = [
  "single_bet", "mix_parlay", "parlay", "HDP", "OU", "1x2",
  "correct_score", "half_time", "full_time", "both_team_score",
  "total_goal", "asian_handicap", "european_handicap",
];
export const PK_V10_MATCH_TYPES = ["FT", "HT", "both"];
export const PK_V10_MARKET_TYPES = [
  "4D", "3D", "2D", "permainan_lainnya",
  "colok_bebas", "colok_naga", "colok_jitu", "shio",
  "silang_homo", "besar_kecil", "genap_ganjil", "all_markets",
];
export const PK_V10_BLACKLIST_TYPES = [
  "provider", "game", "bet_type", "market_type", "game_category", "turnover_source",
];
export const PK_V10_ODDS_CONSTRAINT_APPLIES_TO_BET_TYPES = [
  "single_bet", "mix_parlay", "HDP", "OU", "1x2", "all_bet_types",
];
export const PK_V10_BET_CONFIGURATION_REQUIRED_MARKET_SEGMENTS = [
  "sportsbook", "casino", "slot", "live_casino", "e_lottery",
  "togel", "arcade", "specific_provider", "specific_game",
];

// ─── 1.11 Reward Engine ───────────────────────────────────────────────────
export const PK_V10_CALCULATION_BASIS = [
  "deposit", "turnover", "loss", "win", "bet", "payout",
  "downline_winlose", "level_up_reward", "fixed", "rank_position", "stake_amount",
  // V.10.2 additive
  "bet_amount", "withdraw_amount", "downline_bet", "downline_turnover",
  "downline_loss", "first_deposit", "event_outcome", "unit_count",
];
export const PK_V10_CALCULATION_METHOD = [
  "percentage", "fixed", "tiered", "matrix_lookup", "conditional",
  // V.10.2 additive
  "per_unit", "random_draw", "formula_multi_deduction",
];
export const PK_V10_CALCULATION_UNIT = [
  "percent", "fixed_idr",
  // V.10.2 additive
  "multiplier", "points", "items",
];
export const PK_V10_PAYOUT_DIRECTION = ["upfront", "backend"];
export const PK_V10_REWARD_TYPE = [
  // V.10.1 vocabulary preserved (no removal/rename allowed in C1-A)
  "physical", "cash", "credit_game", "voucher", "ticket",
  "lucky_spin", "discount", "freespin", "combo",
  // V.10.2 additive (per F3 V.10.2)
  "bonus_credit", "free_chip", "free_spin", "merchandise",
  "points", "status_upgrade", "percentage_rebate",
];
export const PK_V10_VOUCHER_KIND = [
  "deposit_bonus", "lucky_spin_entry", "event_entry", "discount_code",
  "free_play", "cashback_voucher", "other",
  // V.10.2 additive
  "shopping_voucher", "travel_voucher", "gadget_voucher",
];
// V.10.2 NEW (currency — extensible ISO 4217)
export const PK_V10_CURRENCY = [
  "IDR", "THB", "VND", "MYR", "SGD", "USD", "PHP", "KHR",
];
// V.10.2 NEW (reward sub-blocks)
export const PK_V10_REWARD_TABLE_TYPE = [
  "turnover_ladder", "cashback_tier", "welcome_combo", "level_reward",
  "parlay_team_count_table", "parlay_lose_count_table", "parlay_lose_half_count_table",
  "streak_ladder", "ranking_prize_table", "event_prize_table",
  "achievement_reward", "referral_tier_table", "loyalty_redemption_table",
];
export const PK_V10_REWARD_TABLE_BASIS = [
  "turnover", "deposit", "loss", "win", "bet",
  "team_count", "win_count", "lose_count", "streak_count",
  "winstreak_count", "losestreak_count",
  "downline_count", "stake_amount", "rank_position", "loyalty_points",
];
export const PK_V10_REWARD_TABLE_THRESHOLD_UNIT = [
  "idr", "count", "percent", "points", "multiplier",
];
export const PK_V10_REWARD_TABLE_TRIGGER_COUNT_UNIT = [
  "matches", "days", "parlay_legs", "spins", "events",
  "red_cards", "goals", "scatter_hits",
  "consecutive_wins", "consecutive_losses",
];
export const PK_V10_REWARD_TABLE_REWARD_TYPE = [
  "cash", "bonus_credit", "free_chip", "voucher",
  "merchandise", "ticket", "points", "combo",
];
export const PK_V10_REWARD_TABLE_REWARD_UNIT = [
  "idr", "percent", "items", "points", "multiplier",
];
export const PK_V10_REWARD_TABLE_REWARD_BASIS = [
  "fixed", "stake_multiplier", "deposit_multiplier",
  "loss_percentage", "ranking_position", "random",
];
export const PK_V10_MATRIX_REWARD_TYPE = [
  "symbol_count_reward", "stake_x_symbol", "stake_x_multiplier",
  "symbol_combination", "stake_x_team_count",
  "multiplier_x_reward", "event_count_x_stake", "custom",
];
export const PK_V10_MATRIX_REWARD_BASIS = [
  "fixed", "stake_multiplier", "percent_of_stake",
  "percent_of_loss", "random",
];
export const PK_V10_UNIT_REWARD_TRIGGER_UNIT = [
  "red_card", "yellow_card", "corner_kick", "goal",
  "scatter", "multiplier_hit", "free_spin",
  "win_count", "loss_count", "referral_count", "deposit_count",
];
export const PK_V10_UNIT_REWARD_VALUE_UNIT = [
  "idr", "percent", "points", "items", "multiplier",
];

// ─── 1.11.bis Reward Form (Step 6.3) ──────────────────────────────────────
export const PK_V10_REWARD_FORM = [
  "spin_token",
  "voucher_code",
  "cashback",
  "physical_item",
  "freespin_token",
  "credit_game",
  "mystery_reward",
];

// ─── 1.12 Ticket Engine (V.10.2 NEW) ──────────────────────────────────────
export const PK_V10_TICKET_SOURCE = [
  "deposit_amount", "play_count", "turnover_threshold",
  "manual_grant", "event_participation", "referral_count", "loyalty_redemption",
];
export const PK_V10_TICKET_VALIDITY_DURATION_UNIT = [
  "hours", "days", "weeks", "months",
];
export const PK_V10_TICKET_PAYMENT_METHOD_EXCLUSION = [
  "ewallet", "pulsa", "qris", "crypto",
  "specific_bank", "specific_ewallet",
];
export const PK_V10_DRAW_TYPE = [
  "random", "fixed_winner", "top_n", "lottery_match",
  "weighted_random", "participation_based", "ranking_based",
];
export const PK_V10_DRAW_FREQUENCY = [
  "once", "daily", "weekly", "monthly", "quarterly", "yearly",
  "on_event_end", "on_threshold_reached",
];

// ─── 1.13 Loyalty Engine ──────────────────────────────────────────────────
export const PK_V10_POINT_NAME = [
  "LP", "EXP", "XP", "COIN", "GEM",
  // V.10.2 additive
  "TOKEN", "STAR",
];
export const PK_V10_LOYALTY_MODE = ["exp_store", "level_up", "both"];
export const PK_V10_TIER_NAME = [
  "Bronze", "Silver", "Gold", "Platinum", "Diamond",
  "Starter", "VIP", "Elite", "Legend",
  // V.10.2 additive
  "Member", "Pemula", "Pejuang", "Master", "Sultan", "Crazy Rich",
];
// V.10.2 NEW
export const PK_V10_LOYALTY_EARNING_RULE = [
  "turnover_based", "bet_based", "deposit_based",
  "loss_based", "event_based", "manual_grant",
];
export const PK_V10_LOYALTY_RESET_PERIOD = [
  "never", "daily", "weekly", "monthly",
  "quarterly", "yearly", "on_promotion",
];
export const PK_V10_EXCHANGE_CLAIM_LIMIT_PERIOD = [
  "daily", "weekly", "monthly", "yearly",
  "lifetime", "per_event", "unlimited",
];
export const PK_V10_EXCHANGE_REWARD_TYPE = [
  "cash", "bonus_credit", "free_chip", "voucher",
  "merchandise", "ticket", "status_upgrade", "discount",
];
export const PK_V10_EXCHANGE_VOUCHER_KIND = [
  "deposit_bonus", "lucky_spin_entry", "event_entry", "discount_code",
  "free_play", "cashback_voucher", "shopping_voucher",
  "travel_voucher", "gadget_voucher", "other",
];

// ─── 1.14 Referral Engine (V.10.2 NEW) ────────────────────────────────────
export const PK_V10_REFERRAL_TYPE = [
  "single_tier", "multi_tier", "lifetime", "one_time", "recurring",
  "downline_loss_based", "downline_bet_based", "downline_winlose_based",
];
export const PK_V10_COMMISSION_BASIS = [
  "downline_bet", "downline_loss", "downline_winlose", "downline_turnover",
  "first_deposit", "net_winlose", "referral_signup",
];
export const PK_V10_COMMISSION_UNIT = ["percent", "fixed_idr", "multiplier"];
export const PK_V10_DOWNLINE_PERIOD_UNIT = ["hours", "days", "weeks", "months"];
export const PK_V10_REFERRAL_ELIGIBLE_GAME_TYPES = [
  "slot", "casino", "live_casino", "sports", "togel",
  "arcade", "e_lottery", "sabung_ayam", "all",
];
export const PK_V10_COMMISSION_RULE_GAME_TYPE = [
  "slot", "casino", "live_casino", "sports", "togel",
  "arcade", "e_lottery", "sabung_ayam", "mixed", "all",
];
export const PK_V10_COMMISSION_RULE_BASIS = [
  "downline_bet", "downline_loss", "downline_winlose", "downline_turnover",
  "first_deposit", "net_winlose",
];
export const PK_V10_COMMISSION_RULE_RATE_UNIT = ["percent", "fixed_idr", "multiplier"];
export const PK_V10_DEPOSIT_BASIS_ANCHOR = [
  "first_deposit", "total_deposit", "period_deposit", "none",
];
export const PK_V10_DEDUCTION_TYPE = [
  "commission", "cashback", "admin_fee", "tax", "bonus_received", "fee_other",
];
export const PK_V10_REFERRAL_DISTRIBUTION_FREQUENCY = [
  "daily", "weekly", "monthly", "quarterly", "yearly", "on_request",
];

// ─── 1.15 Result Event Engine (V.10.2 NEW) ────────────────────────────────
export const PK_V10_RESULT_SOURCE = [
  "togel", "lottery", "sports_match", "game_event", "casino_result", "slot_event",
];
export const PK_V10_RESULT_SOURCE_MARKETS = [
  "Sydney", "HK", "Singapore", "Macau",
  "Bullseye", "PCSO", "Magnum4D", "all_togel_markets",
];
export const PK_V10_MATCH_TARGET = [
  "account_number", "member_id", "phone_number",
  "username", "birthdate", "bank_account_last_digits", "custom_input",
];
export const PK_V10_MATCH_POSITION = [
  "last_4", "last_3", "last_2", "first_4", "first_3",
  "exact", "middle", "any_position",
];
export const PK_V10_MATCH_LOGIC = [
  "exact", "partial", "any_order", "contains",
  "prefix", "suffix", "range_match",
];
export const PK_V10_PRIZE_TIER = [
  "main", "consolation",
  "tier_1", "tier_2", "tier_3", "tier_4", "tier_5",
  "participation", "grand_prize", "runner_up",
];

// ─── 1.16 Fulfillment Engine (V.10.2 NEW) ─────────────────────────────────
export const PK_V10_SHIPPING_PERIOD_ANCHOR = [
  "prize_announcement", "claim_approval",
  "event_end", "period_end", "month_end", "custom",
];
export const PK_V10_SHIPPING_PERIOD_UNIT = ["hours", "days", "weeks", "months"];
export const PK_V10_SHIPPING_METHOD = [
  "internal_logistics", "third_party_courier", "pickup_at_office",
  "digital_delivery", "mail", "specific_courier",
];
export const PK_V10_TAX_BORNE_BY = ["operator", "member", "shared"];
export const PK_V10_RECIPIENT_DATA_REQUIRED = [
  "full_name", "address", "phone", "email", "ktp_id", "bank_account",
];

// ─── 1.17 Variant Engine ──────────────────────────────────────────────────
export const PK_V10_TIER_DIMENSION = [
  "level", "turnover_threshold", "loss_amount_range", "downline_count",
  "parlay_team_count", "stake_amount", "history_deposit_threshold",
  "deposit_amount", "point_balance", "team_count", "bet_amount",
];
// V.10.2 NEW
export const PK_V10_VARIANT_TURNOVER_RULE_FORMAT = [
  "multiplier", "min_rupiah", "both", "none",
];

// ─── 1.18 Dependency Engine ───────────────────────────────────────────────
export const PK_V10_STACKING_POLICY = [
  "no_stacking", "stack_with_whitelist", "stack_freely", "conditional_stack",
];

// ─── 1.19 Invalidation Engine ─────────────────────────────────────────────
export const PK_V10_INVALIDATOR_TRIGGER_TYPE = ["fraud", "violation", "operational"];
export const PK_V10_VOID_TRIGGER = [
  "bonus_hunter", "safety_bet", "invest", "ip_duplicate", "data_duplicate",
  "deposit_fraud", "hold_freespin", "multi_accounting", "self_referral",
  "account_change", "claim_timeout", "wrong_bank_info", "screenshot_missing",
  "game_category_violation", "cashout_partial",
  // V.10.2 additive
  "late_share", "fake_proof", "manipulated_screenshot",
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
  // V.10.2 additive
  "permanent",
];
// V.10.2 NEW (typed void_conditions_block)
export const PK_V10_VOID_CONDITION_TYPE = [
  "fraud", "violation", "operational",
  "technical", "eligibility", "timing", "behavior",
];
export const PK_V10_VOID_CONDITION_SCOPE = [
  "bonus_only", "winnings_only", "full_balance",
  "per_promo", "account_wide", "deposit_amount",
];

// ─── 1.20 Readiness Engine ────────────────────────────────────────────────
export const PK_V10_READINESS_STATE = [
  "draft", "ready", "published", "rejected",
  // V.10.2 additive
  "deprecated",
];
export const PK_V10_VALIDATION_STATUS = [
  "draft", "ready", "needs_review", "rejected",
  // V.10.2 additive
  "passed", "warning",
];

// ─── 1.21 Reasoning Engine ────────────────────────────────────────────────
export const PK_V10_PRIMARY_ACTION = [
  "deposit_to_bonus", "lose_to_cashback", "bet_to_rollingan", "refer_to_commission",
  "redeem_to_reward", "turnover_to_rank", "milestone_to_merchandise",
  "app_install_to_credit", "birthday_to_bonus",
  // V.10.2 additive
  "withdraw_to_bonus", "result_match_to_prize", "level_up_to_reward",
  "event_participation_to_prize", "referral_commission_earning",
];
export const PK_V10_REWARD_NATURE = [
  "monetary", "physical_goods", "credit_game", "access_right", "discount", "status_upgrade",
  // V.10.2 additive
  "commission", "points",
];
export const PK_V10_DISTRIBUTION_PATH = [
  "direct_to_balance", "to_bonus_wallet", "physical_shipping",
  "manual_disbursement", "apk_redemption", "event_drawing",
  // V.10.2 additive
  "ticket_drawing", "loyalty_exchange", "referral_commission_credit",
];
export const PK_V10_VALUE_SHAPE = [
  "percentage_of_base", "fixed_amount", "tiered_escalating", "matrix_lookup",
  "random_draw", "ladder_milestone", "exchange_rate_based",
  // V.10.2 additive
  "per_unit_accumulative", "multi_deduction_formula",
];

// ─── 1.22 Mechanics Engine ────────────────────────────────────────────────
export const PK_V10_MECHANIC_TYPE = [
  "eligibility", "trigger", "calculation", "reward", "claim", "control",
  "invalidator", "distribution", "turnover", "dependency", "intent",
  "scope", "proof", "time_window",
  // V.10.2 additive
  "fulfillment", "result_match", "referral", "loyalty", "ticket",
];
export const PK_V10_MECHANICS_SOURCE = ["llm_text", "llm_image", "llm_multimodal", "manual"];

// ─── 1.23 Projection Engine (V.10.2 NEW) ──────────────────────────────────
export const PK_V10_SUMMARY_SKIPPED_REASON = [
  "insufficient_data", "record_not_promo", "extraction_error",
  "manual_skip", "ambiguous_evidence", "classification_failed",
];
export const PK_V10_TARGET_SEGMENT = [
  "new_member", "existing_member", "vip", "all_member",
  "high_roller", "casual_player",
  "sports_bettor", "slot_player", "togel_player",
  "referrer", "churned_member",
];

// ─── 1.24 Risk Engine ─────────────────────────────────────────────────────
export const PK_V10_RISK_LEVEL = ["low", "medium", "high", "critical"];

// ─── 1.20.bis Mechanics Data Conventions (Step 5C) ────────────────────────
export const PK_V10_EXTERNAL_SYSTEM = [
  "spin_engine", "voucher_system", "freespin_engine", "ticket_system", "none",
];
export const PK_V10_TIME_WINDOW_SCOPE = [
  "reward_validity", "claim_window", "promo_period",
];
export const PK_V10_REDEMPTION_METHOD = ["auto", "manual", "claim_required"];

// ─── 1.25 Meta Engine ─────────────────────────────────────────────────────
export const PK_V10_EXTRACTION_SOURCE = ["plain_text", "html", "image", "pdf", "multimodal"];
export const PK_V10_SOURCE_TYPE = [
  "text_paste", "website", "image_upload", "pdf_upload",
  // V.10.2 additive
  "api_import",
];
export const PK_V10_SCHEMA_STATUS = [
  "locked", "draft",
  // V.10.2 additive (lifecycle)
  "candidate_locked", "review_pending", "deprecated",
];
// V.10.2 NEW
export const PK_V10_SCHEMA_AMENDMENT_TYPE = [
  "patch", "minor_substantive", "major_minor_version",
  "major_schema_expansion", "major_breaking",
];
export const PK_V10_RECORD_TYPE = ["promo", "site_policy", "informational"];
export const PK_V10_UNMODELED_EVIDENCE_REVIEW_STATUS = [
  "pending", "under_review", "promoted", "rejected", "permanent",
];

// ─── 1.26 Field Status & Confidence ───────────────────────────────────────
export const PK_V10_FIELD_STATUS = [
  "explicit", "inferred", "derived", "propagated", "not_stated", "not_applicable",
];
export const PK_V10_INTENT_CATEGORY = [
  "acquisition", "retention", "reactivation", "engagement", "virality", "upsell",
  // V.10.2 additive
  "brand_awareness", "member_reward",
];

export const PK_V10_AI_CONFIDENCE_QUESTION_THRESHOLD = 0.7;

// ──────────────────────────────────────────────────────────────────────────
// Convenience map for tool-schema enum injection (path → const list)
// ──────────────────────────────────────────────────────────────────────────
export const ENUMS = {
  // V.10.1 keys (unchanged)
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
  external_system: PK_V10_EXTERNAL_SYSTEM,
  time_window_scope: PK_V10_TIME_WINDOW_SCOPE,
  redemption_method: PK_V10_REDEMPTION_METHOD,
  reward_form: PK_V10_REWARD_FORM,

  // V.10.2 NEW keys (additive)
  client_id_confidence: PK_V10_CLIENT_ID_CONFIDENCE,
  tier_threshold_basis: PK_V10_TIER_THRESHOLD_BASIS,
  tier_threshold_unit: PK_V10_TIER_THRESHOLD_UNIT,
  tier_threshold_reward_unit: PK_V10_TIER_THRESHOLD_REWARD_UNIT,
  calculation_period: PK_V10_CALCULATION_PERIOD,
  schedule_variant_type: PK_V10_SCHEDULE_VARIANT_TYPE,
  time_window_days: PK_V10_TIME_WINDOW_DAYS,
  rule_type: PK_V10_RULE_TYPE,
  trigger_action: PK_V10_TRIGGER_ACTION,
  claim_deadline_unit: PK_V10_CLAIM_DEADLINE_UNIT,
  claim_deadline_anchor: PK_V10_CLAIM_DEADLINE_ANCHOR,
  claim_limit_period: PK_V10_CLAIM_LIMIT_PERIOD,
  claim_limit_scope: PK_V10_CLAIM_LIMIT_SCOPE,
  claim_reset_frequency: PK_V10_CLAIM_RESET_FREQUENCY,
  active_user_period_unit: PK_V10_ACTIVE_USER_PERIOD_UNIT,
  history_deposit_period_unit: PK_V10_HISTORY_DEPOSIT_PERIOD_UNIT,
  social_proof_share_target_group_type: PK_V10_SOCIAL_PROOF_SHARE_TARGET_GROUP_TYPE,
  screenshot_proof_ss_targets: PK_V10_SCREENSHOT_PROOF_SS_TARGETS,
  provider_qris: PK_V10_PROVIDER_QRIS,
  provider_crypto: PK_V10_PROVIDER_CRYPTO,
  game_types: PK_V10_GAME_TYPES,
  bet_types: PK_V10_BET_TYPES,
  match_types: PK_V10_MATCH_TYPES,
  market_types: PK_V10_MARKET_TYPES,
  blacklist_types: PK_V10_BLACKLIST_TYPES,
  odds_constraint_applies_to_bet_types: PK_V10_ODDS_CONSTRAINT_APPLIES_TO_BET_TYPES,
  bet_configuration_required_market_segments: PK_V10_BET_CONFIGURATION_REQUIRED_MARKET_SEGMENTS,
  currency: PK_V10_CURRENCY,
  reward_table_type: PK_V10_REWARD_TABLE_TYPE,
  reward_table_basis: PK_V10_REWARD_TABLE_BASIS,
  reward_table_threshold_unit: PK_V10_REWARD_TABLE_THRESHOLD_UNIT,
  reward_table_trigger_count_unit: PK_V10_REWARD_TABLE_TRIGGER_COUNT_UNIT,
  reward_table_reward_type: PK_V10_REWARD_TABLE_REWARD_TYPE,
  reward_table_reward_unit: PK_V10_REWARD_TABLE_REWARD_UNIT,
  reward_table_reward_basis: PK_V10_REWARD_TABLE_REWARD_BASIS,
  matrix_reward_type: PK_V10_MATRIX_REWARD_TYPE,
  matrix_reward_basis: PK_V10_MATRIX_REWARD_BASIS,
  unit_reward_trigger_unit: PK_V10_UNIT_REWARD_TRIGGER_UNIT,
  unit_reward_value_unit: PK_V10_UNIT_REWARD_VALUE_UNIT,
  ticket_source: PK_V10_TICKET_SOURCE,
  ticket_validity_duration_unit: PK_V10_TICKET_VALIDITY_DURATION_UNIT,
  ticket_payment_method_exclusion: PK_V10_TICKET_PAYMENT_METHOD_EXCLUSION,
  draw_type: PK_V10_DRAW_TYPE,
  draw_frequency: PK_V10_DRAW_FREQUENCY,
  loyalty_earning_rule: PK_V10_LOYALTY_EARNING_RULE,
  loyalty_reset_period: PK_V10_LOYALTY_RESET_PERIOD,
  exchange_claim_limit_period: PK_V10_EXCHANGE_CLAIM_LIMIT_PERIOD,
  exchange_reward_type: PK_V10_EXCHANGE_REWARD_TYPE,
  exchange_voucher_kind: PK_V10_EXCHANGE_VOUCHER_KIND,
  referral_type: PK_V10_REFERRAL_TYPE,
  commission_basis: PK_V10_COMMISSION_BASIS,
  commission_unit: PK_V10_COMMISSION_UNIT,
  downline_period_unit: PK_V10_DOWNLINE_PERIOD_UNIT,
  referral_eligible_game_types: PK_V10_REFERRAL_ELIGIBLE_GAME_TYPES,
  commission_rule_game_type: PK_V10_COMMISSION_RULE_GAME_TYPE,
  commission_rule_basis: PK_V10_COMMISSION_RULE_BASIS,
  commission_rule_rate_unit: PK_V10_COMMISSION_RULE_RATE_UNIT,
  deposit_basis_anchor: PK_V10_DEPOSIT_BASIS_ANCHOR,
  deduction_type: PK_V10_DEDUCTION_TYPE,
  referral_distribution_frequency: PK_V10_REFERRAL_DISTRIBUTION_FREQUENCY,
  result_source: PK_V10_RESULT_SOURCE,
  result_source_markets: PK_V10_RESULT_SOURCE_MARKETS,
  match_target: PK_V10_MATCH_TARGET,
  match_position: PK_V10_MATCH_POSITION,
  match_logic: PK_V10_MATCH_LOGIC,
  prize_tier: PK_V10_PRIZE_TIER,
  shipping_period_anchor: PK_V10_SHIPPING_PERIOD_ANCHOR,
  shipping_period_unit: PK_V10_SHIPPING_PERIOD_UNIT,
  shipping_method: PK_V10_SHIPPING_METHOD,
  tax_borne_by: PK_V10_TAX_BORNE_BY,
  recipient_data_required: PK_V10_RECIPIENT_DATA_REQUIRED,
  variant_turnover_rule_format: PK_V10_VARIANT_TURNOVER_RULE_FORMAT,
  void_condition_type: PK_V10_VOID_CONDITION_TYPE,
  void_condition_scope: PK_V10_VOID_CONDITION_SCOPE,
  summary_skipped_reason: PK_V10_SUMMARY_SKIPPED_REASON,
  target_segment: PK_V10_TARGET_SEGMENT,
  schema_amendment_type: PK_V10_SCHEMA_AMENDMENT_TYPE,
  record_type: PK_V10_RECORD_TYPE,
  unmodeled_evidence_review_status: PK_V10_UNMODELED_EVIDENCE_REVIEW_STATUS,
};
