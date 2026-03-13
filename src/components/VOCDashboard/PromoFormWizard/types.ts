import { PERSONA_BINDING_FIELDS, DROPPED_FIELDS, extractPersonaBindingFields, savePersonaBinding } from '@/lib/promo-persona-binding';
import { promoKB } from '@/lib/promo-storage';
import { generateUUID } from '@/lib/supabase-client';
import { applyInertValuesToPayload } from '@/lib/extractors/field-applicability-map';
import { calculateAllReferralTiers, getDefaultReferralFormulaMetadata } from '@/lib/referral-tier-calculator';
import { sanitizeByMode } from '@/lib/sanitize-by-mode';
import { CANONICAL_EXPORT_WHITELIST } from '@/lib/canonical-guard';
// PKB FIELD WHITELIST
// ============================================

/**
 * Fields yang masuk ke PKB (Promo Knowledge Base)
 * Hanya field-field ini yang disimpan ke storage PKB
 * 
 * ARSITEKTUR:
 * - PKB = sumber fakta bisnis (read-only metadata)
 * - UI = presentation/derivation layer (field terpisah untuk form state)
 * - formula_metadata = wrapper non-executable untuk fakta promo (0.8%, etc)
 * 
 * NOTE: UI-only fields (has_subcategories, turnover_rule_enabled, game_blacklist_enabled)
 * are NOT included - only their data arrays/values are saved
 */
export const PKB_FIELD_WHITELIST = [
  // ===============================
  // SCHEMA VERSION (v2.1-FINAL)
  // ===============================
  'schema_version',
  
  // ===============================
  // CORE IDENTITY
  // ===============================
  'client_id',
  'client_name',            // NEW: canonical
  'promo_name',
  'promo_slug',             // NEW: canonical
  'source_url',             // NEW: canonical
  'promo_summary',          // NEW: canonical
  
  // ===============================
  // TAXONOMY
  // ===============================
  'promo_type',
  'category',               // NEW: 'REWARD' | 'EVENT' (replaces program_classification semantics)
  'reward_mode',            // alias: mode
  'tier_archetype',
  
  // ===============================
  // INTENT & TRIGGER
  // ===============================
  'intent_category',
  'target_segment',
  'trigger_event',
  'currency_scope',
  
  // ===============================
  // REWARD CORE
  // ===============================
  'reward_type',
  'reward_amount',
  'reward_unit',            // NEW: canonical
  'max_bonus',              // NEW: canonical (replaces max_claim semantic)
  'max_bonus_unlimited',    // NEW: canonical
  
  // ===============================
  // CALCULATION (DINAMIS)
  // ===============================
  'calculation_base',       // alias: calculation_basis
  'calculation_method',
  'calculation_value',
  'min_calculation',
  'conversion_formula',
  'formula_metadata',
  
  // ===============================
  // CLAIM RULES
  // ===============================
  'min_deposit',
  'max_claim',
  'max_claim_unlimited',
  'min_claim',
  'min_reward_claim',
  'claim_frequency',
  'claim_method',           // NEW: 'auto' | 'manual' | 'cs_request'
  'claim_deadline_days',    // NEW: canonical
  'claim_date_from',
  'claim_date_until',
  
  // ===============================
  // TURNOVER / WD (CANONICAL)
  // ===============================
  'turnover_enabled',       // NEW: canonical (replaces turnover_rule_enabled)
  'turnover_multiplier',    // NEW: canonical (number, replaces turnover_rule string)
  'turnover_rule',          // LEGACY: kept for backward compat
  
  // ===============================
  // DISTRIBUTION
  // ===============================
  'distribution_mode',      // NEW: canonical (replaces reward_distribution)
  'distribution_schedule',  // NEW: canonical
  'distribution_note',      // NEW: canonical
  'distribution_day',
  'distribution_time',
  'distribution_date_from',
  'distribution_date_until',
  'distribution_time_enabled',
  'distribution_time_from',
  'distribution_time_until',
  'distribution_day_time_enabled',
  
  // ===============================
  // PERIODE PERHITUNGAN
  // ===============================
  'calculation_period_start',
  'calculation_period_end',
  'calculation_period_note',
  
  // ===============================
  // TIERS (UNIVERSAL)
  // ===============================
  'tiers',
  'fast_exp_missions',
  'level_up_rewards',
  'vip_multiplier',
  
  // ===============================
  // POINT SYSTEM
  // ===============================
  'promo_unit',
  'exp_mode',
  'lp_calc_method',
  'exp_calc_method',
  'lp_earn_basis',
  'lp_earn_amount',
  'lp_earn_point_amount',
  'exp_formula',
  'lp_value',
  'exp_value',
  'redeem_items',
  'redeem_jenis_reward',
  
  // ===============================
  // REFERRAL
  // ===============================
  'referral_tiers',
  'referral_calculation_basis',
  'referral_admin_fee_enabled',
  'referral_admin_fee_percentage',
  
  // ===============================
  // GAME SCOPE
  // ===============================
  'game_restriction',       // alias: game_scope
  'game_types',
  'game_providers',
  'game_names',
  'game_exclusions',        // NEW: consolidated blacklist
  'game_types_blacklist',   // LEGACY
  'game_providers_blacklist', // LEGACY
  'game_names_blacklist',   // LEGACY
  'game_exclusion_rules',
  
  // ===============================
  // ACCESS & RESTRICTION
  // ===============================
  'platform_access',
  'geo_restriction',
  'require_apk',
  'one_account_rule',       // NEW: canonical
  
  // ===============================
  // VALIDITY
  // ===============================
  'valid_from',
  'valid_until',
  'valid_until_unlimited',
  'status',
  
  // ===============================
  // RISK
  // ===============================
  'promo_risk_level',
  'anti_fraud_notes',       // NEW: canonical
  
  // ===============================
  // ESCAPE HATCH
  // ===============================
  'special_requirements',   // alias: special_conditions
  'custom_terms',
  'extra_config',           // NEW: CRITICAL escape hatch
  
  // ===============================
  // ARCHETYPE PAYLOAD (v2.1 ADDITIVE)
  // ===============================
  'turnover_basis',
  'archetype_payload',
  'archetype_invariants',
  
  // ===============================
  // SUBCATEGORIES
  // ===============================
  'subcategories',
  
  // ===============================
  // PAYMENT METHOD
  // ===============================
  'deposit_method',
  'deposit_method_providers',
  'deposit_rate',
  
  // ===============================
  // AUDIT
  // ===============================
  'created_by',             // NEW: canonical
  'human_verified',         // NEW: canonical
  'extraction_confidence',  // alias for classification_confidence
] as const;

// ============================================
// FORMULA METADATA INTERFACE (NON-EXECUTABLE)
// ============================================

/**
 * FormulaMetadata: wrapper non-executable untuk fakta promo
 * - Dipakai UI untuk render ilustrasi
 * - Dipakai AI untuk menjelaskan aturan
 * - TIDAK dipakai backend klaim (human/system = final authority)
 */
export interface FormulaMetadata {
  base: 'turnover' | 'deposit' | 'win_loss' | 'bet_amount';
  method: 'percentage' | 'fixed' | 'tier';
  value: number;           // e.g., 0.8 untuk 0.8%
  period?: string;         // e.g., 'weekly', 'daily'
  timezone?: string;       // e.g., 'GMT+7'
}

// Re-export untuk digunakan di tempat lain
export { PERSONA_BINDING_FIELDS, DROPPED_FIELDS };

// ============================================
// INTERFACES
// ============================================

// Ticket Reward (Exchange Mode) - Section 6
export interface TicketReward {
  id: string;
  ticket: number;
  reward: string;
}

export interface PromoFormData {
  // ===============================
  // SCHEMA VERSION (v2.1-FINAL)
  // ===============================
  schema_version?: '2.1';
  
  // ===============================
  // CORE IDENTITY (Step 1)
  // ===============================
  client_id: string;
  client_name?: string;            // NEW: canonical
  promo_name: string;
  promo_slug?: string;             // NEW: canonical (auto-generated)
  source_url?: string;             // NEW: canonical
  promo_summary?: string;          // NEW: canonical
  promo_type: string;
  intent_category: string;
  target_segment: string;
  
  /**
   * TASK: Aksi pemicu paling awal yang mengubah state user menjadi ELIGIBLE.
   * 
   * SEMANTIC CONTRACT:
   * - Hanya berisi 1 aksi pemicu (BUKAN flow lengkap)
   * - Contoh: 'APK Download', 'Deposit', 'Loss', 'Referral'
   * - BUKAN: 'Download lalu login dan klaim'
   * 
   * Lihat `distribution_note` untuk detail flow klaim setelah eligible.
   * Ref: memory/features/extraction/task-vs-flow-semantic-contract-v1.md
   */
  trigger_event: string;
  currency_scope?: 'rupiah' | 'credit' | 'lp' | 'exp';
  
  // ===============================
  // TAXONOMY (CANONICAL)
  // ===============================
  category?: 'REWARD' | 'EVENT' | '';  // NEW: canonical (derived from program_classification)

  // Step 2 - Konfigurasi Reward
  // Backend contract: 'formula' (UI displays as 'Dinamis')
  reward_mode: 'fixed' | 'tier' | 'formula';
  
  // Fixed mode
  reward_type: string;
  reward_amount: number | null;  // null = inert (not applicable)
  min_deposit: number | null;    // null = inert (not applicable)
  max_claim: number | null;      // null = unlimited OR inert
  turnover_rule: string;
  turnover_rule_format?: 'multiplier' | 'min_rupiah';  // Semantic: multiplier (20x) vs min_rupiah (Rp)
  turnover_rule_enabled: boolean;
  turnover_rule_custom: string;
  claim_frequency: string;
  claim_date_from: string;
  claim_date_until: string;

  // Tier mode
  tier_archetype?: 'level' | 'point_store' | 'referral' | 'formula';  // UI-gating only (v2.2 — no prefix)
  tier_claim_mode?: 'otomatis' | 'manual';  // Mode claim untuk tier rewards
  promo_unit: 'lp' | 'exp' | 'hybrid';
  exp_mode: 'level_up' | 'exp_store' | 'both';
  lp_calc_method: string;
  exp_calc_method: string;
  // LP Earn Rule - structured (replaces free-text lp_formula)
  lp_earn_basis: 'turnover' | 'win' | 'lose' | 'deposit';  // Basis perhitungan LP
  lp_earn_amount: number;          // Setiap [X] (unit sesuai basis)
  lp_earn_point_amount: number;    // → mendapatkan [Y] LP
  exp_formula: string;
  lp_value: string;
  exp_value: string;
  tiers: TierReward[];
  fast_exp_missions: FastExpMission[];
  level_up_rewards: LevelUpReward[];
  
  // VIP Multiplier
  vip_multiplier: {
    enabled: boolean;
    min_daily_to: number;
    tiers: VipTier[];
  };

  reward_distribution: string;
  distribution_day: string;
  distribution_time: string;
  
  // Periode Hitungan (untuk weekly/daily promo) - EKSPLISIT
  calculation_period_start: string;  // 'senin', 'selasa', etc. atau '' (not extracted)
  calculation_period_end: string;    // 'senin', 'selasa', etc. atau '' (not extracted)
  calculation_period_note: string;   // Catatan periode untuk AI (e.g., "7 hari rolling, proses Selasa")
  distribution_date_from: string;
  distribution_date_until: string;
  distribution_time_enabled: boolean;
  distribution_time_from: string;
  distribution_time_until: string;
  distribution_day_time_enabled: boolean;
  custom_terms: string;
  special_requirements: string[];

  // =============================================
  // Fixed Mode - SEPARATE fields (prefix: fixed_)
  // =============================================
  fixed_reward_type: string;
  fixed_calculation_base: string;
  fixed_calculation_method: string;
  fixed_calculation_value?: number;
  fixed_max_claim?: number;
  fixed_max_claim_enabled: boolean;
  fixed_max_claim_unlimited: boolean;
  fixed_payout_direction: 'before' | 'after';
  fixed_admin_fee_enabled: boolean;
  fixed_admin_fee_percentage?: number;
  fixed_min_calculation_enabled: boolean;
  fixed_min_calculation?: number;
  fixed_calculation_value_enabled: boolean;
  fixed_physical_reward_name?: string;
  fixed_physical_reward_quantity?: number;
  fixed_cash_reward_amount?: number;
  fixed_turnover_rule_enabled: boolean;
  fixed_turnover_rule: string;
  fixed_turnover_rule_custom?: string;
  fixed_min_depo_enabled?: boolean;
  fixed_min_depo?: number;

  // =============================================
  // Dinamis mode - UI helper fields (NOT saved to PKB directly)
  // These are used by form UI, then wrapped into formula_metadata for PKB
  // =============================================
  calculation_base: string;
  calculation_method: string;
  calculation_value?: number | null;
  min_calculation: number | null;       // Dinamis mode: Min basis perhitungan (null = inert)
  min_calculation_enabled: boolean;
  
  // =============================================
  // Dinamis mode - Reward (UI helper)
  // @deprecated These fields are legacy aliases. Use base fields instead.
  // See: src/lib/promo-field-normalizer.ts for mapping.
  // =============================================
  /** @deprecated Use `reward_type` instead. Normalized on load. */
  dinamis_reward_type: string;
  /** @deprecated Use `reward_amount` instead. Normalized on load. */
  dinamis_reward_amount: number | null;
  /** @deprecated Use `max_claim` instead. Normalized on load. */
  dinamis_max_claim?: number | null;
  /** @deprecated No base equivalent. Check via isMaxClaimUnlimited() resolver. */
  dinamis_max_claim_unlimited: boolean;
  min_reward_claim: number | null;
  min_reward_claim_enabled: boolean;
  
  // Dinamis mode - Text description (goes to PKB)
  conversion_formula: string;
  
  // PKB OUTPUT: Non-executable formula metadata wrapper
  formula_metadata?: FormulaMetadata;

  // Step 2 - Batasan & Akses
  platform_access: string;
  game_restriction: string;
  
  // Step 3 - Permainan & Provider (Dinamis mode) - Multi-select arrays
  game_types: string[];
  game_providers: string[];
  game_names: string[];
  
  // Eligible Providers (extracted from "KATEGORI (PROVIDER1 & PROVIDER2)" pattern)
  // e.g., "SABUNG AYAM (SV388 & WS168)" → eligible_providers: ["SV388", "WS168"]
  eligible_providers?: string[];
  
  // Step 3 - Game Blacklist (Dinamis mode) - Multi-select arrays
  game_blacklist_enabled: boolean;
  game_types_blacklist: string[];
  game_providers_blacklist: string[];
  game_names_blacklist: string[];
  game_exclusion_rules: string[];
  
  valid_from: string;
  valid_until: string;
  valid_until_unlimited: boolean;
  status: 'active' | 'paused' | 'draft' | 'expired';
  geo_restriction: string;
  require_apk: boolean;
  promo_risk_level?: 'no' | 'low' | 'medium' | 'high'; // Enum value, bukan label UI
  
  // Payment Method Context (NEW - for Deposit Pulsa, E-Wallet, Crypto, etc.)
  // These are OPTIONAL fields - backward compatible with existing promos
  deposit_method?: 'bank' | 'pulsa' | 'ewallet' | 'crypto' | 'qris' | 'all';
  deposit_method_providers?: string[];  // e.g., ["TELKOMSEL", "XL"] or ["DANA", "OVO"] or ["USDT", "BTC"]
  deposit_rate?: number;                // Conversion rate: 100 = no fee, 90 = 10% fee

  // Admin Fee (hanya untuk promo_type = 'Referral Bonus')
  admin_fee_enabled: boolean;
  admin_fee_percentage: number | null;

  // Physical Reward (untuk Hadiah Fisik)
  physical_reward_name?: string;  // Nama hadiah fisik manual (contoh: "MITSUBISHI PAJERO SPORT DAKAR 2025")
  physical_reward_quantity?: number;  // Jumlah unit hadiah fisik (default: 1)
  
  // Cash Reward (untuk Uang Tunai)
  cash_reward_amount?: number;  // Nominal uang tunai (contoh: 50000000 = Rp 50.000.000)

  // =============================================
  // Universal Reward Fields (untuk semua jenis hadiah)
  // =============================================
  reward_quantity?: number | null;           // Jumlah reward (tiket, spin, unit fisik, dll)
  
  // Voucher / Ticket Fields
  voucher_kind?: string;                     // Jenis voucher ENUM - 'deposit' | 'lucky_spin' | 'event_entry' | 'discount' | 'free_play' | 'other'
  voucher_kind_custom?: string;              // Custom voucher kind (jika voucher_kind === 'other')
  voucher_valid_from?: string;               // Tanggal mulai berlaku voucher (date string, optional)
  voucher_valid_until?: string;              // Masa berakhir voucher (date string, optional)
  voucher_valid_unlimited?: boolean;         // Voucher tanpa kadaluwarsa (dynamic mode)
  
  // Lucky Spin Fields
  lucky_spin_enabled?: boolean;              // Flag untuk Lucky Spin reward
  lucky_spin_id?: string;                    // ID Lucky Spin
  lucky_spin_max_per_day?: number | null;    // Max spin per hari (optional)
  
  // Lucky Spin Validity Fields (Dynamic Mode)
  spin_validity_mode?: 'relative' | 'absolute';     // Mode waktu berlaku
  spin_validity_duration?: number;                  // Durasi (angka)
  spin_validity_unit?: 'hours' | 'days' | 'weeks' | 'months';  // Unit waktu
  spin_valid_from?: string;                         // Tanggal mulai (absolut)
  spin_valid_until?: string;                        // Tanggal berakhir (absolut)
  spin_valid_unlimited?: boolean;                   // Toggle unlimited (absolut)

  // Fixed Mode Variants
  fixed_spin_validity_mode?: 'relative' | 'absolute';
  fixed_spin_validity_duration?: number;
  fixed_spin_validity_unit?: 'hours' | 'days' | 'weeks' | 'months';
  fixed_spin_valid_from?: string;
  fixed_spin_valid_until?: string;
  fixed_spin_valid_unlimited?: boolean;

  // Voucher/Ticket Validity Fields (Dynamic Mode)
  voucher_validity_mode?: 'relative' | 'absolute';     // Mode waktu berlaku
  voucher_validity_duration?: number;                  // Durasi (angka)
  voucher_validity_unit?: 'hours' | 'days' | 'weeks' | 'months';  // Unit waktu
  // Note: voucher_valid_from, voucher_valid_until, voucher_valid_unlimited already exist

  // Fixed Mode Variants
  fixed_voucher_validity_mode?: 'relative' | 'absolute';
  fixed_voucher_validity_duration?: number;
  fixed_voucher_validity_unit?: 'hours' | 'days' | 'weeks' | 'months';

  fixed_reward_quantity?: number | null;
  fixed_voucher_kind?: string;               // Jenis voucher ENUM (fixed mode)
  fixed_voucher_kind_custom?: string;        // Custom voucher kind (fixed mode, jika voucher_kind === 'other')
  fixed_voucher_valid_from?: string;
  fixed_voucher_valid_until?: string;
  fixed_voucher_valid_unlimited?: boolean;   // Voucher tanpa kadaluwarsa (fixed mode)
  fixed_lucky_spin_enabled?: boolean;
  fixed_lucky_spin_id?: string;
  fixed_lucky_spin_max_per_day?: number | null;

  // =============================================
  // Section 6: Ticket Exchange / Lucky Spin (Optional)
  // =============================================
  ticket_exchange_enabled?: boolean;           // Master toggle
  ticket_exchange_mode?: 'voucher' | 'lucky_spin' | '';  // Mode selection
  ticket_rewards?: TicketReward[];             // Voucher/Ticket exchange table
  lucky_spin_rewards?: string[];               // Lucky spin prize list
  
  // Fixed Mode Variants
  fixed_ticket_exchange_enabled?: boolean;
  fixed_ticket_exchange_mode?: 'voucher' | 'lucky_spin' | '';
  fixed_ticket_rewards?: TicketReward[];
  fixed_lucky_spin_rewards?: string[];

  // Contact Channel
  contact_channel_enabled: boolean;
  contact_channel: string;
  contact_link: string;

  // Global Jenis Hadiah, Max Bonus & Payout Direction (untuk Dinamis mode - shared across subcategories)
  global_jenis_hadiah_enabled: boolean;  // Toggle ON = use global, OFF = subcategory set their own
  global_jenis_hadiah: string;
  global_max_bonus_enabled: boolean;     // Toggle ON = use global, OFF = subcategory set their own
  global_max_bonus: number;
  global_payout_direction_enabled: boolean;   // Toggle ON = use global, OFF = subcategory set their own
  global_payout_direction: 'before' | 'after';

  // Sub Kategori (Combo Promo) - for Dinamis mode
  has_subcategories: boolean;
  subcategories: PromoSubCategory[];

  // Point Store Redeem Table (untuk tier_point_store)
  redeem_items: RedeemItem[];
  redeem_jenis_reward: string;  // Global jenis reward untuk semua redeem items
  
  // Referral Commission Tiers (untuk tier_network)
  referral_tiers: ReferralCommissionTier[];
  referral_calculation_basis: string;     // dropdown value (turnover, deposit, win, loss, etc.)
  referral_admin_fee_enabled: boolean;    // toggle on/off
  referral_admin_fee_percentage: number;  // Admin fee percentage value

  // Step 4 - Template Pesan AI (saved to PersonaBinding, not PKB)
  response_template_offer: string;
  response_template_requirement: string;
  response_template_instruction: string;
  ai_guidelines: string;
  default_behavior: string;
  completion_steps: string;

  // ===============================
  // CANONICAL FIELDS (v2.1-FINAL)
  // ===============================
  
  // Trigger Canonical
  trigger_min_value?: number | null;        // NEW: v2.1 - minimum value to trigger promo
  
  // Reward Canonical
  reward_unit?: string;                    // NEW: 'percent' | 'fixed' | 'unit'
  max_bonus?: number | null;               // NEW: canonical (replaces max_claim semantic)
  max_bonus_unlimited?: boolean;           // NEW: canonical
  
  // Calculation Canonical
  payout_direction?: 'depan' | 'belakang' | null;  // NEW: v2.1 - reward direction (before/after turnover)
  
  // Claim Canonical
  claim_method?: 'auto' | 'manual' | 'cs_request' | '';  // NEW: canonical
  claim_deadline_days?: number | null;     // NEW: canonical
  
  // Turnover Canonical
  turnover_enabled?: boolean;              // NEW: canonical (replaces turnover_rule_enabled for output)
  turnover_multiplier?: number | null;     // NEW: canonical (number, replaces turnover_rule string)
  min_withdraw_after_bonus?: number | null; // NEW: v2.1 - min WD after bonus
  
  // Distribution Canonical
  distribution_mode?: string;              // NEW: canonical (replaces reward_distribution)
  distribution_schedule?: string;          // NEW: canonical
  distribution_note?: string;              // NEW: canonical
  
  // Game Scope Canonical
  game_exclusions?: string[];              // NEW: consolidated blacklist
  
  // Access Canonical
  one_account_rule?: boolean;              // NEW: canonical
  
  // Risk Canonical
  anti_fraud_notes?: string;               // NEW: canonical
  
  // Escape Hatch Canonical
  extra_config?: Record<string, unknown>;  // NEW: CRITICAL escape hatch
  
  // Archetype Payload (v2.1 ADDITIVE — SSoT: turnover_basis ROOT ONLY)
  turnover_basis?: 'bonus_only' | 'deposit_plus_bonus' | 'deposit_only' | null;
  archetype_payload?: Record<string, unknown>;
  archetype_invariants?: Record<string, unknown>;
  
  // Audit Canonical
  created_by?: string;                     // NEW: canonical
  human_verified?: boolean;                // NEW: canonical
  extraction_confidence?: number | null;   // NEW: canonical (numeric 0-1)

  // Classification metadata (from LLM classifier)
  program_classification?: 'A' | 'B' | 'C';
  classification_confidence?: 'high' | 'medium' | 'low';
  classification_override?: {
    from: string;
    to: string;
    reason: string;
    overridden_by: string;
    timestamp: string;
  };
  
  // =============================================
  // Phase 1A: Mode Auto-Detection Metadata
  // For UI to show "Auto-detected" badge & tooltip
  // =============================================
  _mode_auto_detected?: boolean;           // true if mode was auto-detected
  _mode_detection_reason?: string;         // Explanation for tooltip
  _raw_subcategories?: unknown[];          // Raw data for audit/debug (hidden from UI)
  
  // =============================================
  // Phase 1C/1D: Event/Policy Read-Only Display
  // Data extracted but not editable in wizard
  // =============================================
  _extracted_prizes?: Array<{
    rank: string | number;
    prize: string;
    value?: number;
    reward_type?: string;
    physical_reward_name?: string;
  }>;
  _extracted_exchange_table?: Array<{
    points: number;
    reward: string;
    value?: number;
  }>;
  
  // =============================================
  // NEW v2.2 FIELDS (ADDITIVE — Phase 2)
  // =============================================

  // Claim Evidence / Proof
  proof_required?: boolean;
  proof_type?: 'screenshot' | 'bill_share' | 'social_post' | 'none';
  proof_destination?: 'livechat' | 'whatsapp' | 'telegram' | 'facebook' | 'none';

  // Penalty
  penalty_type?: 'bonus_cancel' | 'full_balance_void' | null;

  // Claim URL & Platform
  claim_url?: string | null;
  claim_platform?: 'auto' | 'livechat' | 'whatsapp' | 'telegram' | 'form' | 'apk' | null;

  // Physical reward detail
  reward_item_description?: string | null;

  // =============================================
  // TAXONOMY PIPELINE v1.0 — SSoT Audit Trail
  // Attached by extractor for debugging/auditability
  // =============================================
  _taxonomy_decision?: {
    archetype: string;
    confidence: 'high' | 'medium' | 'low';
    version: string;
    timestamp?: string;
    evidence?: string[];
    ambiguity_flags?: string[];
  };
}


export interface TierReward {
  id: string;
  minimal_point: number;
  reward: number | string;
  reward_type: 'fixed' | 'percentage';
  type: string;  // Level name: "Silver", "Gold", etc.
  jenis_hadiah: string;  // "credit_game", "freechip", etc.
  physical_reward_name?: string;
  physical_reward_quantity?: number;  // Jumlah unit hadiah fisik
  cash_reward_amount?: number;  // Nominal uang tunai
  // Universal reward fields
  reward_quantity?: number | null;
  voucher_kind?: string;
  voucher_valid_until?: string;
  lucky_spin_enabled?: boolean;
  lucky_spin_id?: string;
  lucky_spin_max_per_day?: number | null;
}

export interface FastExpMission {
  id: string;
  activity: string;
  bonus_exp: number;
}

export interface LevelUpReward {
  id: string;
  tier: string;
  min_exp: number;
  reward: number | string;
  reward_type: 'fixed' | 'percentage';
  type: string;
}

export interface VipTier {
  id: string;
  name: string;
  bonus_percent: number;
}

// Redeem Item untuk Point Store (point_store)
export interface RedeemItem {
  id: string;
  nama_hadiah: string;         // Contoh: "Credit Game 10.000"
  nilai_hadiah: number;        // Contoh: 10000
  biaya_lp: number;            // Contoh: 1000
  is_active?: boolean;         // Optional: toggle aktif/tidak
  note?: string;               // Optional: catatan internal
}

// Referral Commission Tier untuk referral (Network Metric)
export interface ReferralCommissionTier {
  id: string;
  tier_label: string;          // Auto-generated: "Tier 1", "Tier 2", etc.
  
  // === RULE FIELDS: Threshold Kualifikasi Tier ===
  min_downline: number;              // Syarat: minimal downline aktif (≥)
  commission_percentage: number;     // Persentase komisi tier ini (e.g., 5 = 5%)
  
  // === RULE FIELDS: Calculation Values from Promo Table ===
  // ⚠️ SEMANTIC CONTRACT:
  // These values are FINAL RULES from the promo table, NOT samples!
  // If the table does NOT contain "misalkan" or "contoh",
  // these values are BINDING RULES.
  winlose?: number | null;                        // Winlose value (calculation basis)
  cashback_deduction_amount?: number | null;      // Cashback deduction (from WL)
  admin_fee_deduction_amount?: number | null;     // Admin fee deduction (from WL)
  // Legacy field names (for backward compatibility)
  cashback_deduction?: number | null;
  fee_deduction?: number | null;
  
  // === DERIVED FIELDS (CALCULATOR CONTRACT) ===
  // ⚠️ THESE MUST BE NULL AFTER EXTRACTION!
  // Only referral-tier-calculator.ts is allowed to calculate these.
  net_winlose?: number | null;           // = winlose - cashback_deduction - admin_fee_deduction
  commission_result?: number | null;     // = net_winlose * commission_percentage / 100
  
  // === AUDIT METADATA ===
  _rule_source?: 'table' | 'manual' | 'inferred';  // Source of RULE data
  _commission_source?: string;                      // How commission_percentage was determined
  _commission_fix_applied?: boolean;                // Was backstop applied?
  _calculated_by?: 'calculator';                    // Audit trail for derived fields
  }


// Sub Kategori (Combo Promo) - for Dinamis mode with multiple variants
export interface PromoSubCategory {
  id: string;
  name: string;  // Custom name for this sub-category
  
  // Canonical Reward Type (v1.0 - from APBE_ENUMS.reward_type)
  // Priority 1 for inferRewardType() - directly from AI extraction
  reward_type?: 'hadiah_fisik' | 'credit_game' | 'uang_tunai' | 'voucher' | 'other';
  
  // Dasar Perhitungan Bonus
  calculation_base: string;
  calculation_method: string;
  calculation_method_enabled: boolean;
  calculation_value: number;
  minimum_base: number;
  minimum_base_enabled: boolean;
  turnover_rule: string;
  turnover_rule_format?: 'multiplier' | 'min_rupiah';  // Semantic hint: multiplier (20x) vs min_rupiah (Rp 1.000.000)
  turnover_rule_enabled: boolean;
  turnover_rule_custom: string;
  
  // Jenis Hadiah, Max Bonus & Payout Direction (dengan opsi ikut global)
  jenis_hadiah_same_as_global: boolean;
  jenis_hadiah: string;  // @deprecated - use reward_type instead
  max_bonus_same_as_global: boolean;
  max_bonus: number;
  max_bonus_unlimited: boolean;
  payout_direction_same_as_global: boolean;
  payout_direction: 'before' | 'after';
  
  // Admin Fee (dengan opsi ikut global)
  admin_fee_same_as_global: boolean;
  admin_fee_enabled: boolean;
  admin_fee_percentage: number | null;
  
  // Permainan & Provider (Whitelist) - Multi-select arrays
  game_types: string[];
  game_providers: string[];
  game_names: string[];
  
  // Eligible Providers (extracted from "KATEGORI (PROVIDER1 & PROVIDER2)" pattern)
  eligible_providers?: string[];
  
  // Game Blacklist - Multi-select arrays
  game_blacklist_enabled: boolean;
  game_types_blacklist: string[];
  game_providers_blacklist: string[];
  game_names_blacklist: string[];
  game_exclusion_rules: string[];
  
  // =============================================
  // Bonus (Legacy - kept for backward compatibility)
  // @deprecated These subcategory fields are legacy aliases.
  // See: src/lib/promo-field-normalizer.ts for documentation.
  // =============================================
  /** @deprecated Use `reward_type` instead */
  dinamis_reward_type: string;
  /** @deprecated Use `reward_amount` in base or calculation_value in subcategory */
  dinamis_reward_amount: number;
  /** @deprecated Use max_bonus or resolver getEffectiveMaxClaim() */
  dinamis_max_claim: number;
  /** @deprecated Check via subcategory.max_bonus_unlimited */
  dinamis_max_claim_unlimited: boolean;
  min_reward_claim: number | null;       // Minimal bonus yang bisa dicairkan (payout threshold)
  min_reward_claim_enabled: boolean;
  
  // Physical Reward (untuk Hadiah Fisik)
  physical_reward_name?: string;  // Nama hadiah fisik manual
  physical_reward_quantity?: number;  // Jumlah unit hadiah fisik
  
  // Cash Reward (untuk Uang Tunai)
  cash_reward_amount?: number;  // Nominal uang tunai
}

// Promo Item with metadata for storage
export interface PromoItem extends PromoFormData {
  id: string;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  updated_by?: string;
  // NOTE: classification fields inherited from PromoFormData
}
// ============================================
// PROMO STORAGE FUNCTIONS (Supabase-backed via promo-storage.ts)
// ============================================

export function generatePromoId(): string {
  return generateUUID();
}

export async function getPromoDrafts(): Promise<PromoItem[]> {
  return promoKB.getAll();
}

/**
 * Build PKB-only payload by filtering to whitelisted fields
 * 
 * ARSITEKTUR:
 * - PKB = sumber fakta bisnis (read-only metadata)
 * - UI fields (calculation_base, calculation_value, etc) di-wrap ke formula_metadata
 * - formula_metadata = non-executable, untuk AI menjelaskan bukan menghitung
 * 
 * TAXONOMY PATCHES (v6.2):
 * 1. Normalize claim_frequency → English enum
 * 2. Auto-derive trigger_event dari calculation_base
 * 3. Add currency_scope field
 * 4. Remove UI-only fields from output
 * 
 * EXPORTED: untuk digunakan di Step4Review JSON preview
 */
export function buildPKBPayload(data: PromoFormData): Partial<PromoFormData> {
  const pkbData: Record<string, unknown> = {};
  const dataRecord = data as unknown as Record<string, unknown>;
  
  for (const field of PKB_FIELD_WHITELIST) {
    if (field in data && field !== 'formula_metadata') {
      pkbData[field] = dataRecord[field];
    }
  }
  
  // ============================================
  // PATCH 1: Normalize claim_frequency → English enum
  // ============================================
  const frequencyMap: Record<string, string> = {
    'harian': 'daily',
    'mingguan': 'weekly',
    'bulanan': 'monthly',
    'sekali': 'once',
    'per_transaksi': 'per_transaction',
  };
  if (data.claim_frequency) {
    pkbData.claim_frequency = frequencyMap[data.claim_frequency] || data.claim_frequency;
  }
  
  // ============================================
  // PATCH 3: Add currency_scope (derive from reward_type if not set)
  // ============================================
  if (!data.currency_scope) {
    const rewardType = data.dinamis_reward_type || data.reward_type || '';
    if (rewardType === 'credit_game') {
      pkbData.currency_scope = 'credit';
    } else if (rewardType === 'lp' || rewardType === 'loyalty_point') {
      pkbData.currency_scope = 'lp';
    } else if (rewardType === 'exp' || rewardType === 'experience') {
      pkbData.currency_scope = 'exp';
    } else {
      pkbData.currency_scope = 'rupiah'; // Default
    }
  }
  
  // Normalize dinamis mode fields → PKB canonical form
  if (data.reward_mode === 'formula') {
    // 1. Construct formula_metadata wrapper (NON-EXECUTABLE)
    const formulaMetadata: FormulaMetadata = {
      base: (data.calculation_base || 'turnover') as FormulaMetadata['base'],
      method: (data.calculation_method || 'percentage') as FormulaMetadata['method'],
      value: data.calculation_value || 0,
    };
    
    // Add period from claim_frequency (use normalized value)
    if (pkbData.claim_frequency) {
      formulaMetadata.period = pkbData.claim_frequency as string;
    }
    
    // Default timezone
    formulaMetadata.timezone = 'GMT+7';
    
    pkbData.formula_metadata = formulaMetadata;
    
    // ============================================
    // PATCH 2: Auto-derive trigger_event from calculation_base
    // ============================================
    const baseToTrigger: Record<string, string> = {
      'turnover': 'turnover',
      'deposit': 'deposit',
      'win_loss': 'win_loss',
      'loss': 'loss',
      'bet_amount': 'bet',
    };
    pkbData.trigger_event = baseToTrigger[data.calculation_base] || data.calculation_base || data.trigger_event || 'turnover';
    
    // 2. Min Calculation (Loss/TO/dll) - context dari calculation_base
    if (data.min_calculation && data.min_calculation_enabled) {
      pkbData.min_calculation = data.min_calculation;
    }
    
    // 3. Min Claim (bonus minimal yang bisa diklaim)
    if (data.min_reward_claim && data.min_reward_claim_enabled) {
      pkbData.min_claim = data.min_reward_claim;
    }
    
    // 4. Normalize max_claim: null jika unlimited (canonical form)
    pkbData.max_claim = data.dinamis_max_claim_unlimited ? null : (data.dinamis_max_claim || null);
    pkbData.max_claim_unlimited = data.dinamis_max_claim_unlimited;
    
    // 5. Use reward_type (bukan dinamis_reward_type duplikat)
    if (data.dinamis_reward_type) {
      pkbData.reward_type = data.dinamis_reward_type;
    }
  } else {
    // Fixed mode: use min_deposit
    if (data.min_deposit && data.min_deposit > 0) {
      pkbData.min_deposit = data.min_deposit;
    }
    
    // Non-formula modes: normalize max_claim jika unlimited
    if (data.max_claim === 0 && dataRecord.max_claim_unlimited) {
      pkbData.max_claim = null;
    }
  }
  
  // ============================================
  // LEGACY MIGRATION: Handle old field names for backward compatibility
  // ============================================
  if ((dataRecord as Record<string, unknown>).min_requirement && !pkbData.min_deposit) {
    pkbData.min_deposit = (dataRecord as Record<string, unknown>).min_requirement as number;
  }
  if ((dataRecord as Record<string, unknown>).minimum_base && !pkbData.min_calculation) {
    pkbData.min_calculation = (dataRecord as Record<string, unknown>).minimum_base as number;
  }
  
  // Legacy: split ambiguous "Rollingan / Cashback" into correct type
  if (pkbData.promo_type === 'Rollingan / Cashback') {
    const formulaBase = (pkbData.formula_metadata as FormulaMetadata)?.base || data.calculation_base;
    if (formulaBase === 'loss') {
      pkbData.promo_type = 'Cashback (Loss-based)';
    } else {
      pkbData.promo_type = 'Rollingan (Turnover-based)';
    }
  }
  
  // ============================================
  // PATCH 4: Clean up - remove empty blacklist arrays & UI-only remnants
  // ============================================
  // If blacklist arrays are empty, set to inert (empty array) - DON'T DELETE
  // Keep full-shape JSON for consistency
  // ============================================
  if (Array.isArray(pkbData.game_types_blacklist) && (pkbData.game_types_blacklist as string[]).length === 0) {
    pkbData.game_types_blacklist = [];
  }
  if (Array.isArray(pkbData.game_providers_blacklist) && (pkbData.game_providers_blacklist as string[]).length === 0) {
    pkbData.game_providers_blacklist = [];
  }
  if (Array.isArray(pkbData.game_names_blacklist) && (pkbData.game_names_blacklist as string[]).length === 0) {
    pkbData.game_names_blacklist = [];
  }
  
  // ============================================
  // PATCH 5: Normalize distribution_day → English enum
  // ============================================
  const dayMap: Record<string, string> = {
    'senin': 'monday',
    'selasa': 'tuesday',
    'rabu': 'wednesday',
    'kamis': 'thursday',
    'jumat': 'friday',
    'sabtu': 'saturday',
    'minggu': 'sunday',
    'setiap_hari': 'daily',
  };
  if (data.distribution_day) {
    pkbData.distribution_day = dayMap[data.distribution_day.toLowerCase()] || data.distribution_day;
  }
  
  // ============================================
  // PATCH 6: reward_distribution set to inert (NOT deleted)
  // ============================================
  // Claim mechanism (manual vs auto) is a RUNTIME decision controlled by UI toggle,
  // NOT part of promo data. Set to empty string (inert) instead of delete.
  pkbData.reward_distribution = "";
  
  // ============================================
  // PATCH 7: Normalize geo_restriction → lowercase
  // ============================================
  if (data.geo_restriction) {
    pkbData.geo_restriction = data.geo_restriction.toLowerCase();
  }
  
  // ============================================
  // PATCH 8: game_restriction set to inert if game_types[] has data
  // ============================================
  if (Array.isArray(pkbData.game_types) && (pkbData.game_types as string[]).length > 0) {
    pkbData.game_restriction = "";
  }
  
  // ============================================
  // PATCH 9: Set tier-only fields to INERT for non-tier modes
  // ARSITEKTUR: Full-shape JSON dengan inert values (BUKAN delete!)
  // ============================================
  if (data.reward_mode !== 'tier') {
    pkbData.promo_unit = "";
    pkbData.exp_mode = "";
    pkbData.lp_calc_method = "";
    pkbData.exp_calc_method = "";
    pkbData.lp_earn_basis = "";
    pkbData.lp_earn_amount = null;
    pkbData.lp_earn_point_amount = null;
    pkbData.exp_formula = "";
    pkbData.lp_value = "";
    pkbData.exp_value = "";
    pkbData.tiers = [];
    pkbData.fast_exp_missions = [];
    pkbData.level_up_rewards = [];
    pkbData.vip_multiplier = null;
    pkbData.redeem_items = [];
    pkbData.redeem_jenis_reward = "";
  }
  
  // ============================================
  // PATCH 10: Clean referral (Referral) - Set LP/EXP fields to INERT
  // ARSITEKTUR: Full-shape JSON dengan inert values (BUKAN delete!)
  // KONTRAK TIER MODE: Root fields (reward_type, reward_amount, max_claim) = INERT
  // Truth = referral_tiers[] array (BUKAN root fields!)
  // ============================================
  if (data.reward_mode === 'tier' && data.tier_archetype === 'referral') {
    // ============================================
    // CALCULATOR CONTRACT: Calculate DERIVED fields before save
    // Only referral-tier-calculator.ts is allowed to calculate these!
    // ============================================
    if (data.referral_tiers && data.referral_tiers.length > 0) {
      // Build formula metadata from promo data
      const calculationBasis = (data.referral_calculation_basis === 'loss' || data.referral_calculation_basis === 'turnover') 
        ? data.referral_calculation_basis 
        : 'loss';
      const formulaMetadata = getDefaultReferralFormulaMetadata(
        calculationBasis,
        data.referral_admin_fee_percentage || 0
      );
      
      // Calculate derived fields (ONLY place this happens!)
      const calculatedTiers = calculateAllReferralTiers(data.referral_tiers, formulaMetadata);
      pkbData.referral_tiers = calculatedTiers;
      
      console.log('[PKB] Referral tiers calculated by referral-tier-calculator.ts');
    }
    
    // ============================================
    // ROOT FIELDS = INERT (reward info ada di tier array)
    // ============================================
    pkbData.reward_type = "";              // ✅ INERT - truth is in referral_tiers[n] (empty string for consistency)
    pkbData.reward_amount = null;          // ✅ INERT - truth is in referral_tiers[n].commission_percentage
    pkbData.max_claim = null;              // ✅ INERT - no concept of max_claim for referral
    pkbData.max_claim_unlimited = true;    // ✅ SEMANTIC: Referral = unlimited claims (komisi per downline activity)
    
    // Referral TIDAK pakai LP/EXP system → set inert
    pkbData.promo_unit = "";
    pkbData.exp_mode = "";
    pkbData.lp_calc_method = "";
    pkbData.exp_calc_method = "";
    pkbData.lp_earn_basis = "";
    pkbData.lp_earn_amount = null;
    pkbData.lp_earn_point_amount = null;
    pkbData.exp_formula = "";
    pkbData.lp_value = "";
    pkbData.exp_value = "";
    pkbData.tiers = [];              // Referral pakai referral_tiers
    pkbData.fast_exp_missions = [];
    pkbData.level_up_rewards = [];
    pkbData.vip_multiplier = null;
    pkbData.redeem_items = [];
    pkbData.redeem_jenis_reward = "";
    
    // Clear global admin fee (gunakan referral_admin_fee_* saja) → set inert
    pkbData.admin_fee_enabled = false;
    pkbData.admin_fee_percentage = null;
    
    // Override trigger_event untuk Referral (konsisten)
    pkbData.trigger_event = 'Downline Activity';
    
    // Noise fields untuk Referral → set inert
    pkbData.min_deposit = null;
    pkbData.turnover_rule = "";
    pkbData.min_calculation = null;
    pkbData.min_reward_claim = null;
    
    // Fixed mode fields → set inert
    pkbData.fixed_reward_type = "";
    pkbData.fixed_calculation_value = null;
    pkbData.fixed_max_claim = null;
    
    // Formula metadata → set inert (referral bukan formula-based)
    pkbData.formula_metadata = undefined;
    pkbData.calculation_base = "";
    pkbData.calculation_method = "";
    pkbData.calculation_value = null;
    
    // Ensure tier_archetype is set
    pkbData.tier_archetype = 'referral';
  }
  
  // ============================================
  // PATCH 11B: level (Event Level Up / BONUS NALEN) Semantic Rules
  // Root calculation fields = INERT, truth is in tiers[] with minimal_point
  // ============================================
  if (data.tier_archetype === 'level') {
    console.log('[buildPKBPayload] Applying level (Event Level Up) semantic rules');
    
    // Event Level Up: Root calculation fields = INERT
    pkbData.min_deposit = null;          // Tidak ada min deposit per klaim (unlock via history)
    pkbData.turnover_rule = "";          // Tidak ada TO requirement
    pkbData.turnover_rule_enabled = false;
    pkbData.calculation_value = null;    // Truth is in tiers[]
    pkbData.calculation_base = "";
    pkbData.calculation_method = "";
    
    // Claim semantics
    pkbData.claim_frequency = "sekali";  // 1x per level naik
    pkbData.max_claim_unlimited = false;
    
    // Subcategories = INERT (data is in tiers[])
    pkbData.subcategories = [];
    pkbData.has_subcategories = false;
    
    // level_up_rewards = INERT (use tiers[] instead)
    pkbData.level_up_rewards = [];
    
    // Fixed mode fields = INERT
    pkbData.fixed_reward_type = "";
    pkbData.fixed_calculation_value = null;
    pkbData.fixed_max_claim = null;
    
    // Referral fields = INERT
    pkbData.referral_tiers = [];
    pkbData.referral_calculation_basis = "";
    pkbData.referral_admin_fee_enabled = false;
    pkbData.referral_admin_fee_percentage = null;
    
    // Ensure tier_archetype is set
    pkbData.tier_archetype = 'level';
  }
  
  // ============================================
  // PATCH 11C: point_store (LP/EXP Redeem) Semantic Rules
  // Root calculation fields = INERT, truth is in redeem_items[]
  // ============================================
  if (data.tier_archetype === 'point_store') {
    console.log('[buildPKBPayload] Applying point_store (LP Redeem) semantic rules');
    
    // Point Store: Root calculation fields = INERT
    pkbData.calculation_base = "";       // Truth is in lp_earn_* fields
    pkbData.calculation_value = null;
    pkbData.min_deposit = null;
    pkbData.turnover_rule = "";
    pkbData.min_calculation = null;
    
    // Fixed mode fields = INERT
    pkbData.fixed_reward_type = "";
    pkbData.fixed_calculation_value = null;
    pkbData.fixed_max_claim = null;
    
    // Referral fields = INERT
    pkbData.referral_tiers = [];
    pkbData.referral_calculation_basis = "";
    pkbData.referral_admin_fee_enabled = false;
    pkbData.referral_admin_fee_percentage = null;
    
    // tiers[] for level up = INERT (use redeem_items instead)
    pkbData.tiers = [];
    pkbData.level_up_rewards = [];
    
    // Ensure tier_archetype is set
    pkbData.tier_archetype = 'point_store';
  }
  
  // ============================================
  // PATCH 11D: formula (VIP Rebate/Cashback %) Semantic Rules
  // Tier percentage table = tiers[], with formula-based rewards per tier
  // ============================================
  if (data.tier_archetype === 'formula') {
    console.log('[buildPKBPayload] Applying formula (VIP % Table) semantic rules');
    
    // VIP Percentage: calculation_base stays (turnover/loss), truth in tiers[]
    // Each tier has different reward percentage based on VIP level
    
    // Fixed mode fields = INERT
    pkbData.fixed_reward_type = "";
    pkbData.fixed_calculation_value = null;
    pkbData.fixed_max_claim = null;
    
    // Referral fields = INERT
    pkbData.referral_tiers = [];
    pkbData.referral_calculation_basis = "";
    pkbData.referral_admin_fee_enabled = false;
    pkbData.referral_admin_fee_percentage = null;
    
    // Point store fields = INERT
    pkbData.redeem_items = [];
    pkbData.redeem_jenis_reward = "";
    pkbData.lp_earn_basis = "";
    pkbData.lp_earn_amount = null;
    pkbData.lp_earn_point_amount = null;
    
    // Ensure tier_archetype is set
    pkbData.tier_archetype = 'formula';
  }
  
  // ============================================
  // PATCH 11: Apply Field Applicability Rules (Final Guard)
  // ARSITEKTUR: promo_type → set non-applicable fields to inert
  // ============================================
  const finalPayload = applyInertValuesToPayload(
    pkbData as Record<string, unknown>,
    data.promo_type
  );
  
  return finalPayload as Partial<PromoFormData>;
}

// ============================================
// CANONICAL PAYLOAD BUILDER (v2.1-FINAL)
// ============================================

import { 
  CanonicalPromoKB, 
  UniversalTier, 
  CanonicalSubCategory,
  slugify,
  parseTurnoverMultiplier as parseMultiplier,
  mapToCategory,
  consolidateGameExclusions,
  validateCanonicalPromo,
  CANONICAL_INERT,
} from '@/lib/canonical-promo-schema';

/**
 * Build Canonical Promo KB payload (v2.1-FINAL schema)
 * This is the OUTPUT format for storage/export/API
 * 
 * DIFFERENCES from buildPKBPayload:
 * - Uses canonical field names (turnover_multiplier vs turnover_rule)
 * - Unified tiers[] array for all tier archetypes
 * - Consolidated game_exclusions[]
 * - Includes schema_version and audit fields
 */
export function buildCanonicalPayload(data: PromoFormData, promoId?: string): CanonicalPromoKB {
  // Start with inert baseline
  const canonical: CanonicalPromoKB = { ...CANONICAL_INERT };
  
  // ===============================
  // CORE IDENTITY
  // ===============================
  canonical.schema_version = '2.2';
  canonical.client_id = data.client_id || '';
  canonical.client_name = data.client_name || '';
  canonical.promo_id = promoId || generatePromoId();
  canonical.promo_name = data.promo_name || '';
  canonical.promo_slug = slugify(data.promo_name || '');
  canonical.source_url = data.source_url || '';
  canonical.status = data.status || 'draft';
  canonical.promo_summary = data.promo_summary || '';
  
  // ===============================
  // TAXONOMY
  // ===============================
  canonical.category = mapToCategory(data.program_classification) || (data.category as 'REWARD' | 'EVENT' | '') || '';
  canonical.mode = data.reward_mode || '';
  canonical.tier_archetype = data.tier_archetype || null;
  
  // ===============================
  // INTENT & TRIGGER
  // ===============================
  canonical.intent_category = data.intent_category || '';
  canonical.target_segment = data.target_segment || '';
  canonical.trigger_event = data.trigger_event || '';
  canonical.trigger_min_value = data.trigger_min_value ?? null;
  
  // ===============================
  // VALIDITY
  // ===============================
  canonical.valid_from = data.valid_from || '';
  canonical.valid_until = data.valid_until || '';
  canonical.valid_until_unlimited = data.valid_until_unlimited || false;
  
  // ===============================
  // REWARD CORE
  // ===============================
  canonical.reward_type = data.reward_type || data.dinamis_reward_type || data.fixed_reward_type || '';
  // ✅ FIX: For formula mode, reward_amount = calculation_value (the percentage)
  canonical.reward_amount = (() => {
    // Mode formula: percentage stored in calculation_value
    if (data.reward_mode === 'formula' && data.calculation_value) {
      return data.calculation_value;
    }
    // Mode fixed: use fixed_cash_reward_amount
    if (data.reward_mode === 'fixed' && data.fixed_cash_reward_amount) {
      return data.fixed_cash_reward_amount;
    }
    // Fallback
    return data.reward_amount ?? data.dinamis_reward_amount ?? null;
  })();
  canonical.reward_unit = data.reward_unit || (data.calculation_method === 'percentage' ? 'percent' : 'fixed');
  canonical.reward_is_percentage = data.calculation_method === 'percentage';
  canonical.max_bonus = data.max_bonus ?? data.max_claim ?? data.dinamis_max_claim ?? null;
  canonical.max_bonus_unlimited = data.max_bonus_unlimited ?? data.dinamis_max_claim_unlimited ?? data.fixed_max_claim_unlimited ?? false;
  
  // ===============================
  // CALCULATION
  // ===============================
  canonical.calculation_basis = data.calculation_base || '';
  // Fix 1: Archetype-aware default for point_store
  if (!canonical.calculation_basis && data.tier_archetype === 'point_store') {
    canonical.calculation_basis = 'loyalty_point';
  }
  canonical.min_calculation = data.min_calculation ?? null;
  canonical.payout_direction = (data.payout_direction as 'depan' | 'belakang') || null;
  canonical.conversion_formula = data.conversion_formula || '';
  // Fix 2: Auto-generate conversion_formula for point_store
  if (!canonical.conversion_formula && data.tier_archetype === 'point_store') {
    const basis = data.lp_earn_basis || 'turnover';
    const amount = data.lp_earn_amount || 1000;
    const points = data.lp_earn_point_amount || 1;
    canonical.conversion_formula = `IDR ${amount.toLocaleString('id-ID')} ${basis} = ${points} LP. LP ditukar sesuai tabel tier.`;
  }
  
  // ===============================
  // CLAIM RULES
  // ===============================
  canonical.min_deposit = (() => {
    // Explicit min_deposit takes priority
    if (data.min_deposit) return data.min_deposit;
    if (data.fixed_min_depo) return data.fixed_min_depo;
    
    // Auto-sync: For deposit-based promos, min_deposit = min_calculation
    const trigger = (data.trigger_event || '').toLowerCase();
    const calcBase = (data.calculation_base || '').toLowerCase();
    
    if ((trigger.includes('deposit') || calcBase === 'deposit') && data.min_calculation) {
      return data.min_calculation;
    }
    
    return null;
  })();
  canonical.max_claim = data.max_claim ?? null;
  // Fix 3: Prioritize canonical max_claim_unlimited over derived form fields
  canonical.max_claim_unlimited = (data as any).max_claim_unlimited ?? data.dinamis_max_claim_unlimited ?? data.fixed_max_claim_unlimited ?? false;
  canonical.claim_frequency = normalizeClaimFrequency(data.claim_frequency);
  canonical.claim_method = data.claim_method || '';
  canonical.claim_deadline_days = data.claim_deadline_days ?? null;
  
  // ===============================
  // TURNOVER / WD (CANONICAL)
  // ===============================
  const turnoverRule = data.reward_mode === 'fixed' ? data.fixed_turnover_rule : data.turnover_rule;
  const turnoverEnabled = data.reward_mode === 'fixed' ? data.fixed_turnover_rule_enabled : data.turnover_rule_enabled;
  
  canonical.turnover_enabled = data.turnover_enabled ?? turnoverEnabled ?? false;
  canonical.turnover_multiplier = data.turnover_multiplier ?? parseMultiplier(turnoverRule) ?? null;
  canonical.min_withdraw_after_bonus = data.min_withdraw_after_bonus ?? null;
  
  // ===============================
  // DISTRIBUTION
  // ===============================
  canonical.distribution_mode = data.distribution_mode || data.reward_distribution || '';
  canonical.distribution_schedule = data.distribution_day || '';
  canonical.distribution_note = data.distribution_note || '';
  
  // ===============================
  // TIERS (UNIVERSAL)
  // ===============================
  const unifiedTiers = unifyTiers(data);
  canonical.tier_count = unifiedTiers.length;
  canonical.tiers = unifiedTiers;
  
  // ===============================
  // GAME SCOPE
  // ===============================
  canonical.game_scope = data.game_restriction || '';
  canonical.game_types = data.game_types || [];
  canonical.game_providers = (() => {
    // Explicit providers take priority
    if (data.game_providers?.length > 0) return data.game_providers;
    
    // Default to ["Semua"] if no specific game scope restriction
    const scope = (data.game_restriction || '').toLowerCase();
    if (scope === 'semua' || scope === 'all_games' || scope === '' || scope === 'specific_game') {
      return ['Semua'];
    }
    
    return [];
  })();
  canonical.game_exclusions = data.game_exclusions || consolidateGameExclusions(
    data.game_types_blacklist,
    data.game_providers_blacklist,
    data.game_names_blacklist
  );
  
  // ===============================
  // ACCESS & RESTRICTION
  // ===============================
  canonical.platform_access = data.platform_access || '';
  if (data.require_apk && !['apk', 'apk_only'].includes(canonical.platform_access)) {
    canonical.platform_access = 'apk';
  }
  canonical.geo_restriction = data.geo_restriction || '';
  canonical.require_apk = data.require_apk || false;
  canonical.one_account_rule = data.one_account_rule || false;
  
  // ===============================
  // RISK
  // ===============================
  canonical.promo_risk_level = data.promo_risk_level || '';
  canonical.anti_fraud_notes = data.anti_fraud_notes || '';
  
  // ===============================
  // ESCAPE HATCH
  // ===============================
  canonical.special_conditions = data.special_requirements || (data as any).special_conditions || [];
  canonical.custom_terms = data.custom_terms || '';
  
  // Build extra_config with derived fields audit trail
  const baseExtraConfig = data.extra_config || {};
  const derivedFields: Record<string, { derived_from: string; source_value: unknown; result: unknown }> = {};
  
  // Track auto-derived trigger_event
  if (!data.trigger_event && canonical.trigger_event) {
    derivedFields.trigger_event = {
      derived_from: 'calculation_basis',
      source_value: data.calculation_base || '',
      result: canonical.trigger_event
    };
  }
  
  // Track auto-derived currency_scope (check via intent_category or reward_type)
  const inferredCurrencyScope = data.reward_type === 'lp' ? 'lp' : 
    data.reward_type === 'exp' ? 'exp' : 
    data.reward_type === 'credit_game' ? 'credit' : '';
  if (inferredCurrencyScope && !data.currency_scope) {
    derivedFields.currency_scope = {
      derived_from: 'reward_type',
      source_value: data.reward_type || data.fixed_reward_type || '',
      result: inferredCurrencyScope
    };
  }
  
  // Track auto-derived category
  if (canonical.category && !data.category) {
    derivedFields.category = {
      derived_from: 'program_classification',
      source_value: data.program_classification || '',
      result: canonical.category
    };
  }
  
  // Merge derived fields into extra_config if any
  canonical.extra_config = Object.keys(derivedFields).length > 0
    ? { ...baseExtraConfig, _derived_fields: derivedFields }
    : baseExtraConfig;
  
  // ===============================
  // v2.2 CLAIM & PROOF FIELDS
  // ===============================
  canonical.proof_required = data.proof_required ?? false;
  canonical.proof_type = data.proof_type ?? 'none';
  canonical.proof_destination = data.proof_destination ?? 'none';
  canonical.penalty_type = data.penalty_type ?? null;
  canonical.claim_url = data.claim_url ?? null;
  canonical.claim_platform = data.claim_platform ?? null;

  // ===============================
  // ARCHETYPE PAYLOAD (ADDITIVE LAYER)
  // Universal pass-through for ALL archetypes
  // ===============================
  canonical.turnover_basis = data.turnover_basis ?? null;
  canonical.archetype_payload = data.archetype_payload ?? {};
  canonical.archetype_invariants = data.archetype_invariants ?? {};
  
  // ===============================
  // SUBCATEGORIES
  // ===============================
  canonical.has_subcategories = data.has_subcategories || false;
  canonical.subcategories = canonicalizeSubcategories(data);
  
  // ===============================
  // AUDIT
  // ===============================
  canonical.created_at = '';  // Set by storage layer
  canonical.updated_at = '';  // Set by storage layer
  canonical.created_by = data.created_by || '';
  canonical.extraction_confidence = typeof data.extraction_confidence === 'number' 
    ? data.extraction_confidence 
    : (data.classification_confidence === 'high' ? 0.9 : data.classification_confidence === 'medium' ? 0.7 : 0.5);
  canonical.human_verified = data.human_verified || false;
  
  // ===============================
  // CANONICAL GUARD VALIDATION
  // Run validation and log warnings
  // ===============================
  const validation = validateCanonicalPromo(canonical);
  if (!validation.valid) {
    console.warn('[buildCanonicalPayload] Validation failed:', validation.errors);
  }
  if (validation.warnings.length > 0) {
    console.debug('[buildCanonicalPayload] Validation warnings:', validation.warnings);
  }
  
  // ===============================
  // FINAL SAFETY NET: sanitizeByMode()
  // Mematikan impossible state berdasarkan mode
  // This runs AFTER validation to fix any remaining issues
  // ===============================
  const sanitized = sanitizeByMode(canonical as unknown as Record<string, unknown>);
  
  // ===============================
  // FINAL WHITELIST FILTER
  // Strip any non-canonical fields that may have leaked through
  // ===============================
  const whitelistSet = new Set(CANONICAL_EXPORT_WHITELIST as readonly string[]);
  // Also allow archetype extension fields
  const allowedExtras = ['turnover_basis', 'archetype_payload', 'archetype_invariants'];
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(sanitized)) {
    if (whitelistSet.has(key) || allowedExtras.includes(key)) {
      filtered[key] = value;
    }
  }
  
  return filtered as unknown as CanonicalPromoKB;
}

/**
 * Helper: Normalize claim_frequency to Indonesian enum (canonical standard)
 */
function normalizeClaimFrequency(freq?: string): string {
  if (!freq) return '';
  const map: Record<string, string> = {
    // English → Indonesian (normalize to Indonesian)
    'daily': 'harian',
    'weekly': 'mingguan',
    'monthly': 'bulanan',
    'yearly': 'tahunan',
    'once': 'sekali',
    'per_transaction': 'per_transaksi',
    // Keep Indonesian as-is
    'harian': 'harian',
    'mingguan': 'mingguan',
    'bulanan': 'bulanan',
    'tahunan': 'tahunan',
    'sekali': 'sekali',
    'per_transaksi': 'per_transaksi',
  };
  return map[freq.toLowerCase()] || freq;
}

/**
 * Helper: Unify all tier types into canonical UniversalTier[]
 */
function unifyTiers(data: PromoFormData): UniversalTier[] {
  // referral = Referral
  if (data.tier_archetype === 'referral' && data.referral_tiers?.length) {
    return data.referral_tiers.map((t, i) => ({
      tier_id: t.id,
      tier_name: t.tier_label,
      tier_order: i + 1,
      requirement_value: t.min_downline,
      requirement_max: null,
      reward_value: t.commission_percentage,
      reward_type: 'percentage',
      turnover_multiplier: null,
      extra: { 
        winlose: t.winlose, 
        net_winlose: t.net_winlose,
        cashback_deduction_amount: t.cashback_deduction_amount,
        admin_fee_deduction_amount: t.admin_fee_deduction_amount,
      },
    }));
  }
  
  // point_store = LP Redeem
  if (data.tier_archetype === 'point_store' && data.redeem_items?.length) {
    return data.redeem_items.map((r, i) => ({
      tier_id: r.id,
      tier_name: r.nama_hadiah,
      tier_order: i + 1,
      requirement_value: r.biaya_lp,
      requirement_max: null,
      reward_value: r.nilai_hadiah,
      reward_type: 'fixed',
      turnover_multiplier: null,
      extra: { is_active: r.is_active, ...((r as any)._extra || {}) },
    }));
  }
  
  // Default: tier_level / tier_formula = Standard tiers
  if (data.tiers?.length) {
    return data.tiers.map((t, i) => ({
      tier_id: t.id,
      tier_name: t.type || `Tier ${i + 1}`,
      tier_order: i + 1,
      requirement_value: t.minimal_point,
      requirement_max: null,
      reward_value: typeof t.reward === 'number' ? t.reward : null,
      reward_type: t.reward_type || 'fixed',
      turnover_multiplier: null,
      extra: { 
        jenis_hadiah: t.jenis_hadiah,
        physical_reward_name: t.physical_reward_name,
        ...((t as any)._extra || {}),
      },
    }));
  }
  
  return [];
}

/**
 * Helper: Convert subcategories to canonical schema
 */
function canonicalizeSubcategories(data: PromoFormData): CanonicalSubCategory[] {
  if (!data.subcategories?.length) return [];
  
  return data.subcategories.map(sub => ({
    sub_id: sub.id,
    sub_name: sub.name,
    game_types: sub.game_types || [],
    game_providers: sub.game_providers || [],
    reward_amount: sub.calculation_value ?? null,
    reward_is_percentage: sub.calculation_method === 'percentage',
    max_bonus: sub.max_bonus_same_as_global ? (data.global_max_bonus ?? null) : (sub.max_bonus ?? null),
    min_deposit: sub.minimum_base_enabled ? (sub.minimum_base ?? null) : null,
    turnover_multiplier: sub.turnover_rule_enabled 
      ? parseMultiplier(sub.turnover_rule) 
      : null,
    payout_direction: (sub.payout_direction as 'depan' | 'belakang') || null,
    // v2.2 new fields — defaults for existing subcategories
    game_exclusions: [],
    conversion_formula: (sub as any).conversion_formula || '',
  }));
}

/**
 * Save promo draft with DUAL PAYLOAD strategy:
 * 1. PKB fields → saved to voc_promo_kb (Supabase)
 * 2. Persona/AI fields → saved to voc_promo_persona_bindings (separate storage)
 */
export async function savePromoDraft(promoData: PromoFormData, existingId?: string, updatedBy?: string): Promise<PromoItem> {
  // Also save persona binding separately
  const personaFields = extractPersonaBindingFields(promoData as unknown as Record<string, unknown>);

  // Guardrail: enforce semantic separation between TO threshold vs WD multiplier
  const { enforceTurnoverSemanticContract } = await import('@/lib/promo-turnover-guard');
  const guarded = enforceTurnoverSemanticContract(promoData);
  if (guarded.warnings.length > 0) {
    console.warn('[savePromoDraft] Turnover semantic guard applied:', guarded.warnings);
  }
  const dataToSave = guarded.data;

  if (existingId) {
    // Update existing
    const success = await promoKB.update(existingId, dataToSave);
    if (success) {
      savePersonaBinding(existingId, personaFields);
      const updated = await promoKB.getById(existingId);
      if (updated) return updated;
    }
    throw new Error('Failed to update promo');
  }

  // Create new
  const newPromo = await promoKB.add(dataToSave);
  savePersonaBinding(newPromo.id, personaFields);
  return newPromo;
}

export async function duplicatePromo(promo: PromoItem): Promise<PromoItem> {
  const newPromoData = {
    ...promo,
    promo_name: `${promo.promo_name} (Copy)`,
    status: 'draft' as const,
    is_active: false,
  };
  
  // Remove id so a new one is generated
  const { id, version, created_at, updated_at, ...dataWithoutMeta } = newPromoData;
  
  return promoKB.add(dataWithoutMeta as PromoFormData);
}

export async function togglePromoActive(id: string): Promise<PromoItem | undefined> {
  const promo = await promoKB.getById(id);
  if (!promo) return undefined;
  
  const success = await promoKB.update(id, { is_active: !promo.is_active } as Partial<PromoFormData>);
  if (success) {
    return promoKB.getById(id) as Promise<PromoItem | undefined>;
  }
  return undefined;
}

export async function deletePromoDraft(id: string): Promise<boolean> {
  return promoKB.delete(id);
}

/**
 * Normalize legacy/invalid promo data values
 * - Fixes reward_distribution: case-insensitive normalization to valid enum values
 * - Fixes reward_mode: detects inconsistency and corrects based on actual data
 * - Fixes calculation_base, calculation_method, claim_frequency: validates against enums
 */
export function normalizePromoData(data: Partial<PromoFormData>): Partial<PromoFormData> {
  let normalized = { ...data };
  const raw = data as Record<string, unknown>;
  
  // ============================================
  // 0. Canonical v2.1 Hydration — map canonical fields to form fields
  // ============================================

  // 0a. mode → reward_mode
  if (!normalized.reward_mode && raw.mode && typeof raw.mode === 'string') {
    normalized.reward_mode = raw.mode as PromoFormData['reward_mode'];
  }

  // 0b. tier_archetype normalization (short → full form value)
  if (normalized.tier_archetype) {
    const archetypeMap: Record<string, string> = {
      'point_store': 'tier_point_store',
      'level': 'tier_level',
      'network': 'tier_network',
      'formula': 'tier_formula',
    };
    const mapped = archetypeMap[normalized.tier_archetype] as PromoFormData['tier_archetype'];
    if (mapped) {
      normalized.tier_archetype = mapped;
    }
  }

  // 0c. category → program_classification
  if (!normalized.program_classification && raw.category && typeof raw.category === 'string') {
    const catMap: Record<string, string> = {
      'C': 'C', 'REWARD': 'A', 'EVENT': 'C', 'A': 'A', 'B': 'B',
    };
    normalized.program_classification = (catMap[raw.category.toUpperCase()] || '') as PromoFormData['program_classification'];
  }

  // 0d. promo_type inference from canonical context
  if (!normalized.promo_type) {
    const archetype = normalized.tier_archetype || '';
    const trigger = (normalized.trigger_event || '').toLowerCase();
    const calcBasis = (raw.calculation_basis as string || '').toLowerCase();
    
    if (archetype.includes('point_store') || calcBasis === 'loyalty_point') {
      normalized.promo_type = 'Loyalty Point';
    } else if (trigger === 'turnover' && normalized.reward_mode === 'tier') {
      normalized.promo_type = 'Event / Level Up';
    }
  }

  // 0e. promo_unit inference
  if (!normalized.promo_unit && (normalized.tier_archetype || '').includes('point_store')) {
    normalized.promo_unit = 'lp';
  }

  // 0f. tiers[] canonical → form conversion
  const tiers = (normalized as PromoFormData).tiers;
  if (tiers && Array.isArray(tiers) && tiers.length > 0) {
    const firstTier = tiers[0] as unknown as Record<string, unknown>;
    // Detect canonical format: has lp_required or requirement_value but no minimal_point
    if ((firstTier.lp_required !== undefined || firstTier.requirement_value !== undefined) && firstTier.minimal_point === undefined) {
      // Fix 5: Preserve rich tier fields (tier_group, max_claim_per_month, note, etc.) into extra
      (normalized as PromoFormData).tiers = (tiers as unknown as Record<string, unknown>[]).map((t) => {
        const KNOWN_KEYS = ['tier_id', 'id', 'tier_name', 'tier_order', 'lp_required', 'requirement_value',
          'requirement_max', 'reward_amount', 'reward_value', 'reward_type', 'turnover_multiplier', 'extra'];
        const extraFields: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(t)) {
          if (!KNOWN_KEYS.includes(k)) {
            extraFields[k] = v;
          }
        }
        return {
          id: String(t.tier_id || t.id || generateUUID()),
          type: (t.tier_name as string) || '',
          minimal_point: Number(t.lp_required ?? t.requirement_value ?? 0),
          reward: Number(t.reward_amount ?? t.reward_value ?? 0),
          reward_type: 'fixed' as const,
          jenis_hadiah: 'credit_game',
          _extra: { ...(t.extra as Record<string, unknown> || {}), ...extraFields },
        };
      }) as PromoFormData['tiers'];
    }
  }

  // 0g. redeem_items[] hydration for tier_point_store
  if ((normalized.tier_archetype || '').includes('point_store') && tiers && Array.isArray(tiers) && tiers.length > 0) {
    const existingRedeem = (normalized as PromoFormData).redeem_items;
    if (!existingRedeem || existingRedeem.length === 0) {
      const firstT = tiers[0] as unknown as Record<string, unknown>;
      if (firstT.lp_required !== undefined || firstT.requirement_value !== undefined) {
        (normalized as PromoFormData).redeem_items = (tiers as unknown as Record<string, unknown>[]).map((t) => {
          const KNOWN_KEYS = ['tier_id', 'id', 'tier_name', 'tier_order', 'lp_required', 'requirement_value',
            'requirement_max', 'reward_amount', 'reward_value', 'reward_type', 'turnover_multiplier', 'extra'];
          const extraFields: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(t)) {
            if (!KNOWN_KEYS.includes(k)) extraFields[k] = v;
          }
          return {
            id: String(t.tier_id || t.id || generateUUID()),
            nama_hadiah: (t.tier_name as string) || '',
            nilai_hadiah: Number(t.reward_amount ?? t.reward_value ?? 0),
            biaya_lp: Number(t.lp_required ?? t.requirement_value ?? 0),
            _extra: { ...(t.extra as Record<string, unknown> || {}), ...extraFields },
          };
        }) as PromoFormData['redeem_items'];
      }
    }
  }

  // 0h. claim_frequency canonical → form mapping
  if (normalized.claim_frequency) {
    const freqMap: Record<string, string> = {
      'monthly': 'bulanan', 'daily': 'harian', 'weekly': 'mingguan', 'once': 'sekali',
    };
    const mapped = freqMap[normalized.claim_frequency.toLowerCase()];
    if (mapped) normalized.claim_frequency = mapped;
  }

  // 0i. calculation_basis → calculation_base (round-trip preserve)
  if ((raw.calculation_basis as string) && !normalized.calculation_base) {
    normalized.calculation_base = raw.calculation_basis as string;
  }

  // 0j. conversion_formula preserve (ensure not stripped by normalizer)
  if ((raw.conversion_formula as string) && !normalized.conversion_formula) {
    normalized.conversion_formula = raw.conversion_formula as string;
  }

  // 0k. game_scope → game_restriction hydration
  if ((raw.game_scope as string) && !normalized.game_restriction) {
    const scopeMap: Record<string, string> = { 'all': 'semua', 'specific': 'tertentu' };
    normalized.game_restriction = scopeMap[(raw.game_scope as string).toLowerCase()] || (raw.game_scope as string);
  }

  // 0l. max_claim_unlimited → preserve as separate field (don't merge with dinamis_max_claim_unlimited)
  if (raw.max_claim_unlimited !== undefined) {
    (normalized as any).max_claim_unlimited = raw.max_claim_unlimited;
  }

  // ============================================
  // 1. Normalize reward_distribution (CASE-INSENSITIVE)
  // ============================================
  const validDistValues = ['setelah_syarat', 'otomatis_setelah_periode', 'hari_tertentu', 'tanggal_tertentu'];
  const rawDist = (normalized.reward_distribution || '').toLowerCase().trim();
  
  // Mapping for legacy/variant values
  const distMapping: Record<string, string> = {
    'langsung': 'setelah_syarat',
    'instant': 'setelah_syarat',
    'segera': 'setelah_syarat',
    'otomatis': 'setelah_syarat',
    'auto': 'setelah_syarat',
    'manual_cs': 'setelah_syarat',
    'mingguan': 'otomatis_setelah_periode',
    'harian': 'otomatis_setelah_periode',
    'bulanan': 'otomatis_setelah_periode',
    'after_period': 'otomatis_setelah_periode',
    'setelah periode': 'otomatis_setelah_periode',
    'hari tertentu': 'hari_tertentu',
    'tanggal tertentu': 'tanggal_tertentu',
  };
  
  if (!validDistValues.includes(rawDist)) {
    // Check if it maps to a valid value
    if (distMapping[rawDist]) {
      normalized.reward_distribution = distMapping[rawDist];
    } else if (normalized.distribution_day) {
      // Has specific day → hari_tertentu
      normalized.reward_distribution = 'hari_tertentu';
    } else if (normalized.claim_frequency && ['mingguan', 'bulanan', 'harian'].includes(normalized.claim_frequency.toLowerCase())) {
      // Periodic claim → otomatis_setelah_periode
      normalized.reward_distribution = 'otomatis_setelah_periode';
    } else {
      // Default fallback
      normalized.reward_distribution = 'setelah_syarat';
    }
  }
  
  // ============================================
  // 2. Normalize calculation_base
  // ============================================
  const validCalcBases = CALCULATION_BASES.map(c => c.value);
  if (normalized.calculation_base && !validCalcBases.includes(normalized.calculation_base)) {
    const lowerBase = normalized.calculation_base.toLowerCase().trim();
    const baseMapping: Record<string, string> = {
      'to': 'turnover',
      'depo': 'deposit',
      'dp': 'deposit',
      'menang': 'win',
      'kalah': 'loss',
      'kekalahan': 'loss',
      // iGaming contextual aliases - WINLOSE = LOSS (kekalahan player)
      'winloss': 'loss',
      'winlose': 'loss',
      'win_loss': 'loss',
      'win-loss': 'loss',
      // Withdraw-based
      'wd': 'withdraw',
      'penarikan': 'withdraw',
    };
    normalized.calculation_base = baseMapping[lowerBase] || 'turnover';
  }
  
  // ============================================
  // 3. Normalize calculation_method
  // ============================================
  const validCalcMethods = CALCULATION_METHODS.map(c => c.value);
  if (normalized.calculation_method && !validCalcMethods.includes(normalized.calculation_method)) {
    const lowerMethod = normalized.calculation_method.toLowerCase().trim();
    if (lowerMethod.includes('percent') || lowerMethod.includes('persen') || lowerMethod === '%') {
      normalized.calculation_method = 'percentage';
    } else {
      normalized.calculation_method = 'fixed';
    }
  }
  
  // ============================================
  // 4. Normalize claim_frequency
  // ============================================
  const validFreqs = CLAIM_FREQUENCIES.map(f => f.value);
  if (normalized.claim_frequency && !validFreqs.includes(normalized.claim_frequency)) {
    const lowerFreq = normalized.claim_frequency.toLowerCase().trim();
    const freqMapping: Record<string, string> = {
      'sekali': 'sekali_saja',
      'once': 'sekali_saja',
      'daily': 'harian',
      'weekly': 'mingguan',
      'monthly': 'bulanan',
    };
    normalized.claim_frequency = freqMapping[lowerFreq] || normalized.claim_frequency;
  }
  
  // ============================================
  // 4.5. Hydrate from JSON import fields
  // Maps alternative/canonical field names to form fields
  // ============================================

  // calculation_percentage → calculation_value + calculation_method
  if (!normalized.calculation_value && (normalized as any).calculation_percentage) {
    normalized.calculation_value = (normalized as any).calculation_percentage;
    if (!normalized.calculation_method) {
      normalized.calculation_method = 'percentage';
    }
  }

  // calculation_basis (canonical v2.1) → calculation_base (form field)
  if (!normalized.calculation_base && (normalized as any).calculation_basis) {
    const basisRaw = String((normalized as any).calculation_basis).toLowerCase();
    if (basisRaw.includes('turnover') || basisRaw.includes('slot_turnover')) {
      normalized.calculation_base = 'turnover';
    } else if (basisRaw.includes('loss')) {
      normalized.calculation_base = 'loss';
    } else if (basisRaw.includes('deposit')) {
      normalized.calculation_base = 'deposit';
    } else if (basisRaw.includes('withdraw')) {
      normalized.calculation_base = 'withdraw';
    } else {
      normalized.calculation_base = basisRaw;
    }
  }

  // archetype_invariants.mode_must_be → reward_mode
  const invariants = (normalized as any).archetype_invariants;
  if (invariants && typeof invariants === 'object') {
    if (invariants.mode_must_be && !normalized.reward_mode) {
      normalized.reward_mode = invariants.mode_must_be;
    }
    if (invariants.percentage_required && !normalized.calculation_method) {
      normalized.calculation_method = 'percentage';
    }
  }

  // archetype_payload → unpack to form fields
  const payload = (normalized as any).archetype_payload;
  if (payload && typeof payload === 'object') {
    if (payload.min_turnover_required && !normalized.min_calculation) {
      normalized.min_calculation = payload.min_turnover_required;
    }
    if (payload.calculation_percentage && !normalized.calculation_value) {
      normalized.calculation_value = payload.calculation_percentage;
    }
    if (payload.calculation_basis && !normalized.calculation_base) {
      normalized.calculation_base = String(payload.calculation_basis)
        .replace('slot_', '').toLowerCase();
    }
    if (payload.automatic_distribution !== undefined) {
      if (payload.automatic_distribution === true && !normalized.distribution_mode) {
        normalized.distribution_mode = 'setelah_syarat';
      }
    }
  }

  // Auto-activate toggles based on hydrated values
  if (normalized.min_calculation && normalized.min_calculation > 0) {
    (normalized as any).min_calculation_enabled = true;
  }

  // reward_type → dinamis_reward_type (form field for Dinamis mode)
  if (normalized.reward_type && !(normalized as any).dinamis_reward_type) {
    const rtLower = String(normalized.reward_type).toLowerCase();
    const rewardTypeMap: Record<string, string> = {
      'bonus': 'saldo',
      'saldo': 'saldo',
      'bonus_saldo': 'saldo',
      'free_spin': 'free_spin',
      'freespin': 'free_spin',
      'lucky_spin': 'lucky_spin',
      'voucher': 'voucher',
      'cashback': 'saldo',
      'uang_tunai': 'uang_tunai',
      'hadiah_fisik': 'hadiah_fisik',
    };
    const mapped = rewardTypeMap[rtLower];
    if (mapped) {
      (normalized as any).dinamis_reward_type = mapped;
    }
  }

  // max_bonus → dinamis_max_claim (form field for Dinamis mode)
  if (normalized.max_bonus && !(normalized as any).dinamis_max_claim) {
    (normalized as any).dinamis_max_claim = normalized.max_bonus;
  }
  if (normalized.max_bonus_unlimited) {
    (normalized as any).dinamis_max_claim_unlimited = true;
  }

  // ============================================
  // 5. Normalize reward_mode based on actual data context
  // ============================================
  
  // PRIORITY 1: Check for tier_network (Referral) first - this takes precedence!
  // Referral promos use referral_tiers, not standard tiers
  const referralTiers = (normalized as PromoFormData).referral_tiers;
  const tierArchetype = normalized.tier_archetype;

  if (tierArchetype === 'referral' || (referralTiers && referralTiers.length > 0)) {
    if (normalized.reward_mode !== 'tier') {
      console.log('[normalizePromoData] Fixing reward_mode: was', normalized.reward_mode, '→ tier (referral detected)');
      normalized.reward_mode = 'tier';
      normalized.tier_archetype = 'referral';
    }
  }
  // PRIORITY 2: Check for standard tiers (loyalty, level-up)
  else {
    const tiers = (normalized as PromoFormData).tiers;
    if (tiers && tiers.length > 0 && tiers.some(t => t.type || t.minimal_point)) {
      if (normalized.reward_mode !== 'tier') {
        console.log('[normalizePromoData] Fixing reward_mode: was', normalized.reward_mode, '→ tier');
        normalized.reward_mode = 'tier';
      }
    }
    // PRIORITY 3: Percentage + calculation_value → formula (dinamis)
    // Only if NOT a tier mode
    else if (normalized.calculation_method === 'percentage' && normalized.calculation_value) {
      if (normalized.reward_mode !== 'formula') {
        console.log('[normalizePromoData] Fixing reward_mode: was', normalized.reward_mode, '→ formula');
        normalized.reward_mode = 'formula';
      }
    }
  }
  
  // ============================================
  // 6. Normalize subcategories if present
  // ============================================
  const subcats = (normalized as PromoFormData).subcategories;
  if (subcats && Array.isArray(subcats)) {
    (normalized as PromoFormData).subcategories = subcats.map(sub => {
      const normalizedSub = { ...sub };
      
      // Normalize calculation_base in subcategory
      if (normalizedSub.calculation_base && !validCalcBases.includes(normalizedSub.calculation_base)) {
        const lowerBase = normalizedSub.calculation_base.toLowerCase().trim();
        normalizedSub.calculation_base = lowerBase === 'to' ? 'turnover' : 'turnover';
      }
      
      // Normalize calculation_method in subcategory
      if (normalizedSub.calculation_method && !validCalcMethods.includes(normalizedSub.calculation_method)) {
        normalizedSub.calculation_method = 'percentage';
      }
      
      // Normalize jenis_hadiah in subcategory
      const validHadiah = DINAMIS_REWARD_TYPES.map(d => d.value);
      if (normalizedSub.jenis_hadiah && !validHadiah.includes(normalizedSub.jenis_hadiah)) {
        normalizedSub.jenis_hadiah = 'credit_game'; // Safe default
      }
      
      return normalizedSub;
    });
  }
  
  // ============================================
  // 7. Normalize promo_type to exact PROMO_TYPES values
  // ============================================
  if (normalized.promo_type && !PROMO_TYPES.includes(normalized.promo_type)) {
    const lowerType = normalized.promo_type.toLowerCase();
    if (lowerType.includes('cashback') || lowerType.includes('loss')) {
      normalized.promo_type = 'Cashback (Loss-based)';
    } else if (lowerType.includes('rollingan') || lowerType.includes('turnover')) {
      normalized.promo_type = 'Rollingan (Turnover-based)';
    } else if (lowerType.includes('welcome')) {
      normalized.promo_type = 'Welcome Bonus';
    } else if (lowerType.includes('deposit')) {
      normalized.promo_type = 'Deposit Bonus';
    } else if (lowerType.includes('freechip')) {
      normalized.promo_type = 'Freechip';
    } else if (lowerType.includes('referral')) {
      normalized.promo_type = 'Referral Bonus';
    } else if (lowerType.includes('event') || lowerType.includes('level')) {
      normalized.promo_type = 'Event / Level Up';
    } else if (lowerType.includes('loyalty') || lowerType.includes('point')) {
      normalized.promo_type = 'Loyalty Point';
    } else {
      normalized.promo_type = 'Deposit Bonus'; // Safe fallback
    }
  }
  
  // ============================================
  // 8. Normalize intent_category
  // ============================================
  if (normalized.intent_category && !INTENT_CATEGORIES.includes(normalized.intent_category)) {
    const lowerIntent = normalized.intent_category.toLowerCase();
    const intentMapping: Record<string, string> = {
      'acquisition': 'Acquisition',
      'retention': 'Retention',
      'reactivation': 'Reactivation',
      'vip': 'VIP',
      'bonus_claim': 'Retention',
    };
    normalized.intent_category = intentMapping[lowerIntent] || 'Retention';
  }
  
  // ============================================
  // 9. Normalize target_segment
  // ============================================
  if (normalized.target_segment && !TARGET_SEGMENTS.includes(normalized.target_segment)) {
    const lowerSeg = normalized.target_segment.toLowerCase();
    const segmentMapping: Record<string, string> = {
      'all_users': 'Semua',
      'all': 'Semua',
      'new_member': 'Baru',
      'new': 'Baru',
      'baru': 'Baru',
      'existing': 'Existing',
      'vip_only': 'VIP',
      'vip': 'VIP',
      'dormant': 'Dormant',
    };
    normalized.target_segment = segmentMapping[lowerSeg] || 'Semua';
  }
  
  // ============================================
  // 10. Normalize trigger_event
  // ============================================
  if (normalized.trigger_event && !TRIGGER_EVENTS.includes(normalized.trigger_event)) {
    const lowerTrigger = normalized.trigger_event.toLowerCase().replace(/[_-]/g, ' ');
    const triggerMapping: Record<string, string> = {
      'first deposit': 'First Deposit',
      'deposit': 'First Deposit',
      'login': 'Login',
      'loss streak': 'Loss Streak',
      'apk download': 'APK Download',
      'turnover': 'Turnover',
      'mission completed': 'Mission Completed',
      'user request': 'First Deposit',
    };
    normalized.trigger_event = triggerMapping[lowerTrigger] || 'First Deposit';
  }
  
  // ============================================
  // 11. Normalize platform_access
  // ============================================
  const validPlatforms = PLATFORM_ACCESS.map(p => p.value);
  if (normalized.platform_access && !validPlatforms.includes(normalized.platform_access)) {
    const lowerPlatform = normalized.platform_access.toLowerCase();
    if (lowerPlatform === 'all' || lowerPlatform === 'semua') {
      normalized.platform_access = 'semua';
    } else if (lowerPlatform === 'web') {
      normalized.platform_access = 'web';
    } else if (lowerPlatform === 'apk' || lowerPlatform === 'apk_only') {
      normalized.platform_access = 'apk';
    } else if (lowerPlatform === 'mobile') {
      normalized.platform_access = 'mobile';
    } else {
      normalized.platform_access = 'semua';
    }
  }
  
  // ============================================
  // 12. Normalize geo_restriction — FALLBACK TO INDONESIA
  // ============================================
  const validGeos = GEO_RESTRICTIONS.map(g => g.value);
  if (!normalized.geo_restriction || !validGeos.includes(normalized.geo_restriction)) {
    const lowerGeo = (normalized.geo_restriction || '').toLowerCase().trim();
    if (lowerGeo === 'global') {
      normalized.geo_restriction = 'global';
    } else if (lowerGeo.includes('jakarta')) {
      normalized.geo_restriction = 'jakarta';
    } else if (lowerGeo.includes('asia')) {
      normalized.geo_restriction = 'asia_tenggara';
    } else {
      // Default fallback ke Indonesia
      normalized.geo_restriction = 'indonesia';
    }
  }
  
  // ============================================
  // 13. Normalize valid_until_unlimited — infer from valid_until
  // ============================================
  if (normalized.valid_until_unlimited === undefined) {
    normalized.valid_until_unlimited = !normalized.valid_until;
  }
  
  // ============================================
  // 14. Normalize dinamis_reward_type (PromoFormData level)
  // ============================================
  const validDinamisTypes = DINAMIS_REWARD_TYPES.map(d => d.value);
  if (normalized.dinamis_reward_type) {
    if (!validDinamisTypes.includes(normalized.dinamis_reward_type)) {
      const lowerType = normalized.dinamis_reward_type.toLowerCase().trim();
      // Direct mapping if lowercase version exists
      if (validDinamisTypes.includes(lowerType)) {
        normalized.dinamis_reward_type = lowerType;
      } else {
        // Fallback mapping for legacy values
        const typeMapping: Record<string, string> = {
          'freechip': 'freechip',
          'free chip': 'freechip',
          'free_chip': 'freechip',
          'cash': 'uang_tunai',
          'tunai': 'uang_tunai',
          'fisik': 'hadiah_fisik',
          'physical': 'hadiah_fisik',
          'credit': 'credit_game',
          'game_credit': 'credit_game',
          'bonus': 'saldo',
          'balance': 'saldo',
          'lp': 'lp',
          'loyalty': 'lp',
        };
        normalized.dinamis_reward_type = typeMapping[lowerType] || 'credit_game';
      }
    }
  }
  
  // ============================================
  // 13. Normalize turnover_rule format — CONTEXT-AWARE DETECTION
  // ============================================
  if (normalized.turnover_rule) {
    const rule = String(normalized.turnover_rule).trim();
    const numOnly = rule.replace(/[^0-9]/g, '');
    const numValue = Number(numOnly);
    
    // Context-aware detection:
    // 1. If >= 10000, almost certainly Rupiah misplaced (even 10.000x is absurd for multiplier)
    // 2. If calculation_base is 'turnover' and value >= 1000, likely min TO qualify
    const isLikelyRupiah = 
      numValue >= 10000 ||  // 10.000 or above = definitely Rupiah
      (normalized.calculation_base === 'turnover' && numValue >= 1000);  // 1000 + TO base = Rupiah
    
    if (isLikelyRupiah) {
      console.warn(`[normalizePromoData] Context-aware: Detected Rupiah in turnover_rule: ${rule}, moving to min_calculation`);
      // Move to min_calculation if not already set
      if (!normalized.min_calculation || normalized.min_calculation === 0) {
        normalized.min_calculation = numValue;
        normalized.min_calculation_enabled = true;
      }
      // Clear turnover_rule - it's not a WD multiplier
      normalized.turnover_rule = '';
      normalized.turnover_rule_enabled = false;
    } else if (normalized.turnover_rule_format === 'min_rupiah') {
      // If explicitly marked as min_rupiah, strip non-numeric
      normalized.turnover_rule = numOnly;
    }
    // For small valid multipliers, keep as-is
  }
  
  // Propagate turnover_rule_format from first subcategory if not set
  if (!normalized.turnover_rule_format && normalized.subcategories?.[0]?.turnover_rule_format) {
    normalized.turnover_rule_format = normalized.subcategories[0].turnover_rule_format;
  }
  
  // ============================================
  // 15. Normalize calculation_period_start / calculation_period_end
  // ============================================
  // Untuk promo periodic (mingguan, harian), pastikan period range valid
  const claimFreq = (normalized.claim_frequency || '').toLowerCase();
  
  if (claimFreq === 'mingguan' || claimFreq === 'bulanan') {
    const startDay = (normalized.calculation_period_start || '').toLowerCase().trim();
    const endDay = (normalized.calculation_period_end || '').toLowerCase().trim();
    
    // Case 1: Start exists but end is empty or same as start → fix to standard week
    if (startDay && (!endDay || startDay === endDay)) {
      console.log('[normalizePromoData] Fixing calculation_period_end:', endDay, '→ minggu');
      normalized.calculation_period_end = 'minggu';
      
      // Ensure start is set if it was empty
      if (!normalized.calculation_period_start) {
        normalized.calculation_period_start = 'senin';
      }
    }
    
    // Case 2: End exists but start is empty → default start to senin
    if (endDay && !startDay) {
      console.log('[normalizePromoData] Fixing calculation_period_start: empty → senin');
      normalized.calculation_period_start = 'senin';
    }
    
    // Case 3: Both empty but frequency is weekly/monthly → set standard week
    if (!startDay && !endDay) {
      console.log('[normalizePromoData] Setting default weekly period: senin → minggu');
      normalized.calculation_period_start = 'senin';
      normalized.calculation_period_end = 'minggu';
    }
  }
  
  // For harian (daily) frequency, ensure proper range if both missing
  if (claimFreq === 'harian') {
    const startDay = (normalized.calculation_period_start || '').toLowerCase().trim();
    const endDay = (normalized.calculation_period_end || '').toLowerCase().trim();
    
    // Default daily range: senin → minggu (all days active)
    if (!startDay && !endDay) {
      normalized.calculation_period_start = 'senin';
      normalized.calculation_period_end = 'minggu';
    }
  }
  
  return normalized;
}

// Legacy alias for backward compatibility
export const normalizeRewardDistribution = normalizePromoData;

export async function getPromoById(id: string): Promise<PromoItem | undefined> {
  const promo = await promoKB.getById(id);
  if (!promo) return undefined;
  
  // Normalize legacy values before returning
  const normalized = normalizePromoData(promo) as PromoItem;
  return normalized;
}

// Tier Archetype Options (UI-gating only, NOT business logic)
// Taxonomy: 4 Tier Archetypes v2.2 (no prefix)
export const TIER_ARCHETYPE_OPTIONS = [
  { 
    value: 'level' as const, 
    label: 'Sistem Level / Tier',
    description: 'Event berbasis level atau milestone (NALEN, VIP Upgrade, Winstreak)'
  },
  { 
    value: 'point_store' as const, 
    label: 'Sistem Point (LP/EXP)',
    description: 'Point exchange, redemption store (Loyalty Program)'
  },
  { 
    value: 'referral' as const, 
    label: 'Network Metric (Referral)',
    description: 'Commission berbasis jumlah downline (Referral Commission)'
  },
  { 
    value: 'formula' as const, 
    label: 'Tier Percentage',
    description: 'Persentase berbeda per VIP level (VIP Rebate, VIP Cashback, VIP Max Bonus)'
  },
] as const;

export type TierArchetype = typeof TIER_ARCHETYPE_OPTIONS[number]['value'];

// LP Earn Basis Options - untuk dropdown "Basis Perhitungan LP"
export const LP_EARN_BASIS_OPTIONS = [
  { value: 'turnover' as const, label: 'Turnover', unit: 'Turnover' },
  { value: 'win' as const, label: 'Kemenangan (Win)', unit: 'Kemenangan' },
  { value: 'lose' as const, label: 'Kekalahan Bersih (Net Loss)', unit: 'Kekalahan Bersih' },
  { value: 'deposit' as const, label: 'Deposit', unit: 'Deposit' },
] as const;

export type LpEarnBasis = typeof LP_EARN_BASIS_OPTIONS[number]['value'];

// FIX: Pisahkan Rollingan dan Cashback - ini adalah promo yang BERBEDA secara ontologi!
// - Cashback = kompensasi kekalahan (loss-based)
// - Rollingan = akumulasi turnover (turnover-based)
// - Withdraw Bonus = trigger saat WD, basis dari evidence (turnover/withdraw)
export const PROMO_TYPES = [
  'Cashback (Loss-based)',        // Kompensasi kekalahan
  'Rollingan (Turnover-based)',   // Akumulasi turnover
  'Welcome Bonus',
  'Deposit Bonus',
  'Withdraw Bonus',               // ✅ NEW: Bonus WD (trigger=Withdraw, basis=evidence)
  'Freechip',
  'Loyalty Point',
  'Event / Level Up',
  'Mini Game (Spin, Lucky Draw)',
  'Merchandise',
  'Referral Bonus',
  'Campaign / Informational',
  'Birthday Bonus',               // ✅ Bonus Ulang Tahun
  'Togel Discount',               // ✅ Togel-specific
];

// Deposit method options for payment-specific promos
export const DEPOSIT_METHODS = [
  { value: 'all', label: 'Semua Metode' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'pulsa', label: 'Pulsa' },
  { value: 'ewallet', label: 'E-Wallet (DANA, OVO, GOPAY)' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'qris', label: 'QRIS' },
] as const;

// Telco operators for pulsa deposits
export const TELCO_OPERATORS = [
  'TELKOMSEL',
  'XL', 
  'AXIS',
  'INDOSAT',
  'TRI',
  'SMARTFREN',
] as const;
export const INTENT_CATEGORIES = ['Acquisition', 'Retention', 'Reactivation', 'VIP'];
export const TARGET_SEGMENTS = ['Baru', 'Existing', 'VIP', 'Dormant', 'Semua'];
export const TRIGGER_EVENTS = [
  'First Deposit',    // Welcome Bonus, Deposit Bonus
  'Deposit',          // Next/Daily Deposit, Reload Bonus
  'Turnover',         // Rollingan, Rebate (TO-based)
  'Loss',             // Cashback (Loss-based)
  'Withdraw',         // Withdraw Bonus (WD-based)
  'Bet',              // Betting-triggered promos
  'Referral',         // Referral Bonus
  'Login',            // Daily Login Bonus
  'Claim',            // Manual claim promos
  'Mission Completed',// Event/Level Up promos
  'Loss Streak',      // Loss Streak protection
  'APK Download',     // APK promo
];
export const REWARD_TYPES = [
  { value: 'lp', label: 'Loyalty Points (LP)' },
  { value: 'exp', label: 'Experience Points (EXP)' },
  { value: 'freechip', label: 'Freechip' },
  { value: 'credit_game', label: 'Credit Game' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'cashback', label: 'Cashback' },
  { value: 'custom', label: 'Custom' },
  { value: 'hadiah_fisik', label: 'Hadiah Fisik' },
  { value: 'uang_tunai', label: 'Uang Tunai' },
];
export const TURNOVER_RULES = [
  { value: '0x', label: '0x — Tanpa Syarat Main' },
  { value: '1x', label: '1x — Main 1 Kali' },
  { value: '2x', label: '2x — Main 2 Kali' },
  { value: '3x', label: '3x — Main 3 Kali' },
  { value: '4x', label: '4x — Main 4 Kali' },
  { value: '5x', label: '5x — Main 5 Kali' },
  { value: '6x', label: '6x — Main 6 Kali' },
  { value: '7x', label: '7x — Main 7 Kali' },
  { value: '8x', label: '8x — Main 8 Kali' },
  { value: '10x', label: '10x — Main 10 Kali' },
  { value: '12x', label: '12x — Main 12 Kali' },
  { value: '15x', label: '15x — Main 15 Kali' },
  { value: '20x', label: '20x — Main 20 Kali' },
  { value: 'custom', label: 'Custom — Tentukan Manual' },
];
export const CLAIM_FREQUENCIES = [
  { value: 'sekali', label: 'Sekali' },
  { value: 'harian', label: 'Harian' },
  { value: 'mingguan', label: 'Mingguan' },
  { value: 'bulanan', label: 'Bulanan' },
  { value: 'unlimited', label: 'Unlimited' },
  { value: 'tanggal_tertentu', label: 'Tanggal Tertentu' },
];
export const LP_CALC_METHODS = [
  { value: 'turnover', label: 'Turnover' },
  { value: 'spin', label: 'Spin' },
  { value: 'winloss', label: 'Win/Loss' },
  { value: 'manual', label: 'Manual' },
  { value: 'custom', label: 'Custom' },
];
export const EXP_CALC_METHODS = [
  { value: 'turnover', label: 'Turnover' },
  { value: 'spin', label: 'Spin' },
  { value: 'winloss', label: 'Win/Loss' },
  { value: 'manual', label: 'Manual' },
  { value: 'custom', label: 'Custom' },
];
export const REWARD_DISTRIBUTIONS = [
  { value: 'setelah_syarat', label: 'Setelah Memenuhi Semua Syarat', helper: 'Bonus dikirim setelah semua syarat promo terpenuhi.' },
  { value: 'otomatis_setelah_periode', label: 'Otomatis Setelah Periode', helper: 'Bonus dikirim otomatis setelah periode perhitungan berakhir.' },
  { value: 'hari_tertentu', label: 'Hari & Jam Tertentu', helper: 'Bonus dikirim pada hari dan jam tertentu (contoh: Senin 00:00 WIB).' },
  { value: 'tanggal_tertentu', label: 'Tanggal Tertentu', helper: 'Bonus dikirim pada rentang tanggal spesifik.' },
];

// Spin Validity Presets & Units
export const SPIN_VALIDITY_PRESETS = [
  { label: '24 Jam', duration: 24, unit: 'hours' as const },
  { label: '7 Hari', duration: 7, unit: 'days' as const },
  { label: '30 Hari', duration: 30, unit: 'days' as const },
];

export const SPIN_VALIDITY_UNITS = [
  { value: 'hours', label: 'Jam' },
  { value: 'days', label: 'Hari' },
  { value: 'weeks', label: 'Minggu' },
  { value: 'months', label: 'Bulan' },
];

// Voucher Validity Presets & Units (same as Spin for consistency)
export const VOUCHER_VALIDITY_PRESETS = [
  { label: '24 Jam', duration: 24, unit: 'hours' as const },
  { label: '7 Hari', duration: 7, unit: 'days' as const },
  { label: '30 Hari', duration: 30, unit: 'days' as const },
];

export const VOUCHER_VALIDITY_UNITS = [
  { value: 'hours', label: 'Jam' },
  { value: 'days', label: 'Hari' },
  { value: 'weeks', label: 'Minggu' },
  { value: 'months', label: 'Bulan' },
];

export const PLATFORM_ACCESS = [
  { value: 'web', label: 'Web' },
  { value: 'apk', label: 'APK' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'semua', label: 'Semua' },
];
export const GAME_RESTRICTIONS = [
  { value: 'semua', label: 'Semua' },
  { value: 'slots', label: 'Slots' },
  { value: 'casino', label: 'Casino' },
  { value: 'poker', label: 'Poker' },
  { value: 'sports', label: 'Sports' },
  { value: 'sportsbook', label: 'Sportsbook' },
  { value: 'e_sports', label: 'E-Sports' },
  { value: 'togel', label: 'Togel / Lottery (2D / 3D / 4D)' },
  { value: 'sabung_ayam', label: 'Sabung Ayam' },
  { value: 'tembak_ikan', label: 'Tembak Ikan' },
  { value: 'arcade', label: 'Arcade' },
];

// Game Provider Options
export const GAME_PROVIDERS = [
  { value: 'semua', label: 'Semua Provider' },
  { value: 'pg_soft', label: 'PG SOFT' },
  { value: 'pragmatic_play', label: 'Pragmatic Play' },
  { value: 'spadegaming', label: 'Spadegaming' },
  { value: 'habanero', label: 'Habanero' },
  { value: 'microgaming', label: 'Microgaming' },
  { value: 'playtech', label: 'Playtech' },
  { value: 'evolution', label: 'Evolution Gaming' },
  { value: 'joker', label: 'Joker Gaming' },
  { value: 'cq9', label: 'CQ9' },
  { value: 'sv388', label: 'SV388' },
  { value: 'ws168', label: 'WS168' },
];

// Game Name Options
export const GAME_NAMES = [
  { value: 'semua', label: 'Semua Game' },
  { value: 'mahjong_wins', label: 'Mahjong Wins' },
  { value: 'spaceman', label: 'Spaceman' },
  { value: 'gates_olympus', label: 'Gates of Olympus' },
  { value: 'sweet_bonanza', label: 'Sweet Bonanza' },
  { value: 'starlight_princess', label: 'Starlight Princess' },
  { value: 'wild_bounty', label: 'Wild Bounty Showdown' },
  { value: 'candy_village', label: 'Candy Village' },
  { value: 'aztec_gems', label: 'Aztec Gems' },
];

export const CONTACT_CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'livechat', label: 'Live Chat' },
  { value: 'email', label: 'Email' },
];
export const GEO_RESTRICTIONS = [
  { value: 'indonesia', label: 'Indonesia' },
  { value: 'jakarta', label: 'Jakarta' },
  { value: 'asia_tenggara', label: 'Asia Tenggara' },
  { value: 'global', label: 'Global' },
];

// Promo Risk Level - Metadata deskriptif untuk kehati-hatian AI
// Jika tidak dipilih → fallback ke default APBE persona settings
export const PROMO_RISK_LEVELS = [
  { 
    value: 'no', 
    label: 'No Risk',
    helper: 'Promo informatif / non-finansial. AI boleh menjelaskan dengan santai.'
  },
  { 
    value: 'low', 
    label: 'Kecil',
    helper: 'Promo bernilai rendah. AI tetap hindari janji berlebihan.'
  },
  { 
    value: 'medium', 
    label: 'Menengah',
    helper: 'Promo dengan syarat tertentu. AI wajib gunakan bahasa kondisional dan arahkan ke dashboard akun.'
  },
  { 
    value: 'high', 
    label: 'Tinggi',
    helper: 'Promo bernilai finansial tinggi dan rawan dispute. AI dilarang menjanjikan hasil, tidak boleh menghitung bonus, dan wajib mengarahkan user ke CS.'
  },
];
export const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'draft', label: 'Draft' },
  { value: 'expired', label: 'Expired' },
];

// Dinamis Mode Options
// Taxonomy: All calculation bases for Category REWARD & EVENT
export const CALCULATION_BASES = [
  { value: 'turnover', label: 'Turnover (TO)' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'win', label: 'Win' },
  { value: 'loss', label: 'Loss' },
  { value: 'bet_amount', label: 'Bet Amount' },
  { value: 'loyalty_point', label: 'Loyalty Point' },
  { value: 'experience_point', label: 'Experience Point' },
  { value: 'level', label: 'Level' },           // NEW: VIP level-based
  { value: 'streak', label: 'Streak Count' },   // NEW: Winstreak, login streak
  { value: 'rank', label: 'Ranking' },          // NEW: Leaderboard, tournament
  { value: 'withdraw', label: 'Withdraw' },     // NEW: Bonus withdraw milestone
];

export const CALCULATION_METHODS = [
  { value: 'percentage', label: 'Persentase (%)' },
  { value: 'fixed', label: 'Fixed Amount' },
];

export const DINAMIS_REWARD_TYPES = [
  { value: 'saldo', label: 'Saldo' },
  { value: 'credit_game', label: 'Credit Game' },
  { value: 'cashback', label: 'Cashback' },
  { value: 'freechip', label: 'Freechip' },
  { value: 'lp', label: 'Loyalty Points' },
  { value: 'voucher', label: 'Voucher / Ticket' },
  { value: 'lucky_spin', label: 'Lucky Spin' },
  { value: 'hadiah_fisik', label: 'Hadiah Fisik' },
  { value: 'uang_tunai', label: 'Uang Tunai' },
];


import { DEFAULT_AI_GUIDELINES } from '@/lib/promo-guard-rules';

export const initialPromoData: PromoFormData = {
  client_id: '',
  promo_name: '',
  promo_type: '',
  intent_category: '',
  target_segment: '',
  trigger_event: '',
  reward_mode: 'fixed',
  reward_type: '',
  reward_amount: null,  // INERT: null instead of 0 (0 could be valid)
  min_deposit: null,    // INERT: null = not applicable
  max_claim: null,      // INERT: null = unlimited
  turnover_rule: '',    // INERT: empty string
  turnover_rule_enabled: false,
  turnover_rule_custom: '',
  claim_frequency: '',
  claim_date_from: '',
  claim_date_until: '',
  tier_archetype: 'level',  // Default: Level/Milestone Tier
  promo_unit: 'lp',
  exp_mode: 'level_up',
  lp_calc_method: 'turnover',
  exp_calc_method: 'turnover',
  lp_earn_basis: 'turnover',     // Default: Turnover
  lp_earn_amount: 1000,          // Setiap 1000
  lp_earn_point_amount: 1,       // → 1 LP
  exp_formula: '',
  lp_value: '',
  exp_value: '',
  tiers: [],
  fast_exp_missions: [],
  level_up_rewards: [],
  vip_multiplier: {
    enabled: false,
    min_daily_to: 0,
    tiers: [
      { id: '1', name: 'Bronze', bonus_percent: 0 },
      { id: '2', name: 'Silver', bonus_percent: 0 },
      { id: '3', name: 'Gold', bonus_percent: 0 },
      { id: '4', name: 'Platinum', bonus_percent: 0 },
      { id: '5', name: 'Diamond', bonus_percent: 0 },
    ],
  },
  reward_distribution: '',
  distribution_day: '',
  distribution_time: '',
  calculation_period_start: '',
  calculation_period_end: '',
  calculation_period_note: '',   // Catatan periode untuk AI
  distribution_date_from: '',
  distribution_date_until: '',
  distribution_time_enabled: false,
  distribution_time_from: '',
  distribution_time_until: '',
  distribution_day_time_enabled: false,
  custom_terms: '',
  special_requirements: [],
  
  // =============================================
  // Fixed Mode - SEPARATE fields (prefix: fixed_)
  // =============================================
  fixed_reward_type: '',
  fixed_calculation_base: '',
  fixed_calculation_method: '',
  fixed_calculation_value: undefined,
  fixed_max_claim: undefined,
  fixed_max_claim_enabled: true,
  fixed_max_claim_unlimited: false,
  fixed_payout_direction: 'after',
  fixed_admin_fee_enabled: false,
  fixed_admin_fee_percentage: undefined,
  fixed_min_calculation_enabled: false,
  fixed_min_calculation: undefined,
  fixed_calculation_value_enabled: true,
  fixed_physical_reward_name: '',
  fixed_physical_reward_quantity: 1,
  fixed_cash_reward_amount: undefined,
  fixed_turnover_rule_enabled: false,
  fixed_turnover_rule: '',
  fixed_turnover_rule_custom: '',
  fixed_min_depo_enabled: false,
  fixed_min_depo: undefined,

  // =============================================
  // Dinamis mode - UI helper fields
  // =============================================
  calculation_base: '',
  calculation_method: '',
  calculation_value: null,  // INERT: null instead of undefined
  min_calculation: null,    // INERT: null = not applicable
  min_calculation_enabled: false,
  dinamis_reward_type: '',
  dinamis_reward_amount: null,  // INERT: null
  dinamis_max_claim: null,      // INERT: null
  dinamis_max_claim_unlimited: false,
  min_reward_claim: null,       // INERT: null (payout threshold)
  min_reward_claim_enabled: false,
  conversion_formula: '',
  
  // PKB OUTPUT: formula_metadata tidak perlu initial value (optional, constructed saat save)
  formula_metadata: undefined,
  
  platform_access: 'semua',
  game_restriction: 'semua',
  game_types: [],
  game_providers: [],
  game_names: [],
  
  // Game Blacklist
  game_blacklist_enabled: false,
  game_types_blacklist: [],
  game_providers_blacklist: [],
  game_names_blacklist: [],
  game_exclusion_rules: [],
  valid_from: new Date().toISOString().split('T')[0],
  valid_until: '',
  valid_until_unlimited: false,
  status: 'draft',
  geo_restriction: 'indonesia',
  require_apk: false,
  promo_risk_level: undefined,  // OPTIONAL - gunakan enum value ('high'), bukan label ('tinggi')
  
  // Payment Method Context (NEW - for Deposit Pulsa, E-Wallet, Crypto, etc.)
  deposit_method: undefined,
  deposit_method_providers: undefined,
  deposit_rate: undefined,
  
  // Admin Fee (untuk Referral Bonus)
  admin_fee_enabled: false,
  admin_fee_percentage: null,
  
  // Physical Reward
  physical_reward_name: '',
  physical_reward_quantity: 1,  // Default 1 unit
  
  // Cash Reward
  cash_reward_amount: undefined,
  
  // Universal Reward Fields
  reward_quantity: null,
  voucher_kind: '',
  voucher_kind_custom: '',
  voucher_valid_from: '',
  voucher_valid_until: '',
  voucher_valid_unlimited: false,
  
  // Voucher Validity Fields (Dynamic Mode)
  voucher_validity_mode: 'relative',
  voucher_validity_duration: 24,
  voucher_validity_unit: 'hours',
  
  // Fixed Mode Variants for Voucher Validity
  fixed_voucher_validity_mode: 'relative',
  fixed_voucher_validity_duration: 24,
  fixed_voucher_validity_unit: 'hours',
  
  lucky_spin_enabled: false,
  lucky_spin_id: '',
  lucky_spin_max_per_day: null,
  
  // Lucky Spin Validity Fields (Dynamic Mode)
  spin_validity_mode: 'relative',
  spin_validity_duration: 24,
  spin_validity_unit: 'hours',
  spin_valid_from: '',
  spin_valid_until: '',
  spin_valid_unlimited: false,
  
  // Fixed Mode Variants
  fixed_spin_validity_mode: 'relative',
  fixed_spin_validity_duration: 24,
  fixed_spin_validity_unit: 'hours',
  fixed_spin_valid_from: '',
  fixed_spin_valid_until: '',
  fixed_spin_valid_unlimited: false,
  fixed_reward_quantity: null,
  fixed_voucher_kind: '',
  fixed_voucher_kind_custom: '',
  fixed_voucher_valid_from: '',
  fixed_voucher_valid_until: '',
  fixed_voucher_valid_unlimited: false,
  fixed_lucky_spin_enabled: false,
  fixed_lucky_spin_id: '',
  fixed_lucky_spin_max_per_day: null,
  
  // Section 6: Ticket Exchange / Lucky Spin (Optional)
  ticket_exchange_enabled: false,
  ticket_exchange_mode: '',
  ticket_rewards: [],
  lucky_spin_rewards: [],
  fixed_ticket_exchange_enabled: false,
  fixed_ticket_exchange_mode: '',
  fixed_ticket_rewards: [],
  fixed_lucky_spin_rewards: [],
  
  contact_channel_enabled: false,
  contact_channel: '',
  contact_link: '',

  // Global Jenis Hadiah, Max Bonus & Payout Direction (untuk Dinamis mode)
  global_jenis_hadiah_enabled: true,  // default ON - semua subcategory ikut global
  global_jenis_hadiah: '',
  global_max_bonus_enabled: true,     // default ON - semua subcategory ikut global
  global_max_bonus: null,             // INERT: null instead of 0
  global_payout_direction_enabled: true,   // default ON - semua subcategory ikut global
  global_payout_direction: 'after',
  
  // Sub Kategori (Combo Promo)
  has_subcategories: false,
  subcategories: [],
  
  // Point Store Redeem Table
  redeem_items: [],
  redeem_jenis_reward: '',
  
  // Referral Commission Tiers (untuk tier_network)
  referral_tiers: [],
  referral_calculation_basis: '',       // INERT: empty string (was 'loss' - should not have default)
  referral_admin_fee_enabled: false,    // INERT: false
  referral_admin_fee_percentage: null,  // INERT: null instead of 20
  
  response_template_offer: '',
  response_template_requirement: '',
  response_template_instruction: '',
  ai_guidelines: DEFAULT_AI_GUIDELINES,
  default_behavior: '',
  completion_steps: '',
};

// ============================================
// SAMPLE PROMO DATA (Reference: brikstacker.com)
// ============================================

/**
 * Sample promo Welcome Bonus New Member dengan 3 sub-kategori
 * Berdasarkan referensi: https://brikstacker.com/promotion/details/d7427226-06fe-4ee0-a457-b36857d0bf52
 */
export const SAMPLE_PROMO_WELCOME_BONUS: PromoItem = {
  // Identitas Promo
  id: 'sample_welcome_bonus_001',
  client_id: 'BRIKSTACKER',
  promo_name: 'Welcome Bonus New Member',
  promo_type: 'Welcome Bonus',
  intent_category: 'Acquisition',
  target_segment: 'Baru',
  trigger_event: 'First Deposit',
  
  // Reward Mode = Dinamis (formula)
  reward_mode: 'formula',
  
  // Fixed mode fields (not used but required by interface)
  reward_type: '',
  reward_amount: 0,
  min_deposit: 50000,  // Fixed mode: Min Deposit
  max_claim: null,
  turnover_rule: '8x',
  turnover_rule_enabled: true,
  turnover_rule_custom: '',
  claim_frequency: 'sekali',
  claim_date_from: '',
  claim_date_until: '',
  
  // Tier mode (not used)
  promo_unit: 'lp',
  exp_mode: 'level_up',
  lp_calc_method: 'turnover',
  exp_calc_method: 'turnover',
  lp_earn_basis: 'turnover',
  lp_earn_amount: 1000,
  lp_earn_point_amount: 1,
  exp_formula: '',
  lp_value: '',
  exp_value: '',
  tiers: [],
  fast_exp_missions: [],
  level_up_rewards: [],
  vip_multiplier: { enabled: false, min_daily_to: 0, tiers: [] },
  
  // Distribution
  reward_distribution: 'langsung',
  distribution_day: '',
  distribution_time: '',
  calculation_period_start: '',
  calculation_period_end: '',
  calculation_period_note: '',
  distribution_date_from: '',
  distribution_date_until: '',
  distribution_time_enabled: false,
  distribution_time_from: '',
  distribution_time_until: '',
  distribution_day_time_enabled: false,
  custom_terms: 'Bonus hanya berlaku untuk member baru; Minimal deposit Rp 50.000; Wajib klaim melalui Live Chat sebelum bermain',
  special_requirements: [],
  
  // Fixed Mode - SEPARATE fields (prefix: fixed_)
  fixed_reward_type: '',
  fixed_calculation_base: '',
  fixed_calculation_method: '',
  fixed_calculation_value: undefined,
  fixed_max_claim: undefined,
  fixed_max_claim_enabled: true,
  fixed_max_claim_unlimited: false,
  fixed_payout_direction: 'after',
  fixed_admin_fee_enabled: false,
  fixed_admin_fee_percentage: undefined,
  fixed_min_calculation_enabled: false,
  fixed_min_calculation: undefined,
  fixed_calculation_value_enabled: true,
  fixed_physical_reward_name: '',
  fixed_physical_reward_quantity: 1,
  fixed_cash_reward_amount: undefined,
  fixed_turnover_rule_enabled: false,
  fixed_turnover_rule: '',
  fixed_turnover_rule_custom: '',
  
  // Dinamis mode - UI helper fields
  calculation_base: 'deposit',
  calculation_method: 'percentage',
  calculation_value: 100,
  min_calculation: 50000,  // Dinamis mode: Min Calculation (formerly minimum_base)
  min_calculation_enabled: true,
  dinamis_reward_type: 'saldo',
  dinamis_reward_amount: 0,
  dinamis_max_claim: 2000000,
  dinamis_max_claim_unlimited: false,
  min_reward_claim: null,
  min_reward_claim_enabled: false,
  conversion_formula: 'Bonus = Deposit × 100% (maksimal sesuai kategori produk)',
  
  formula_metadata: {
    base: 'deposit',
    method: 'percentage',
    value: 100,
    period: 'once',
    timezone: 'GMT+7',
  },
  
  // Batasan & Akses
  platform_access: 'semua',
  game_restriction: 'tertentu',
  game_types: ['Slot', 'Casino', 'Sports'],
  game_providers: [],
  game_names: [],
  
  // Game Blacklist
  game_blacklist_enabled: false,
  game_types_blacklist: [],
  game_providers_blacklist: [],
  game_names_blacklist: [],
  game_exclusion_rules: [],
  
  // Validity
  valid_from: '2025-01-01',
  valid_until: '2025-12-31',
  valid_until_unlimited: false,
  status: 'active',
  geo_restriction: 'indonesia',
  require_apk: false,
  promo_risk_level: 'medium',
  
  // Admin Fee (untuk Referral Bonus)
  admin_fee_enabled: false,
  admin_fee_percentage: null,
  
  // Contact
  contact_channel_enabled: true,
  contact_channel: 'whatsapp',
  contact_link: 'https://wa.me/628123456789',
  
  // Global Settings (untuk sub-kategori)
  global_jenis_hadiah_enabled: true,
  global_jenis_hadiah: 'saldo',
  global_max_bonus_enabled: false,  // OFF - tiap varian beda max bonus
  global_max_bonus: 0,
  global_payout_direction_enabled: true,
  global_payout_direction: 'before',
  
  // Sub Kategori enabled
  has_subcategories: true,
  subcategories: [
    {
      id: 'sub_wbslt100',
      name: 'WBSLT100 — Slot 100%',
      calculation_base: 'deposit',
      calculation_method: 'percentage',
      calculation_method_enabled: true,
      calculation_value: 100,
      minimum_base: 50000,
      minimum_base_enabled: true,
      turnover_rule: '8x',
      turnover_rule_enabled: true,
      turnover_rule_custom: '',
      jenis_hadiah_same_as_global: true,
      jenis_hadiah: '',
      max_bonus_same_as_global: false,
      max_bonus: 2000000,
      max_bonus_unlimited: false,
      payout_direction_same_as_global: true,
      payout_direction: 'before',
      admin_fee_same_as_global: true,
      admin_fee_enabled: false,
      admin_fee_percentage: null,
      game_types: ['Slot'],
      game_providers: ['PG SOFT', 'Pragmatic Play', 'Spadegaming', 'Habanero'],
      game_names: [],
      game_blacklist_enabled: false,
      game_types_blacklist: [],
      game_providers_blacklist: [],
      game_names_blacklist: [],
      game_exclusion_rules: [],
      dinamis_reward_type: '',
      dinamis_reward_amount: 0,
      dinamis_max_claim: 0,
      dinamis_max_claim_unlimited: false,
      min_reward_claim: null,
      min_reward_claim_enabled: false,
    },
    {
      id: 'sub_wbcas50',
      name: 'WBCAS50 — Casino 50%',
      calculation_base: 'deposit',
      calculation_method: 'percentage',
      calculation_method_enabled: true,
      calculation_value: 50,
      minimum_base: 100000,
      minimum_base_enabled: true,
      turnover_rule: '10x',
      turnover_rule_enabled: true,
      turnover_rule_custom: '',
      jenis_hadiah_same_as_global: true,
      jenis_hadiah: '',
      max_bonus_same_as_global: false,
      max_bonus: 1000000,
      max_bonus_unlimited: false,
      payout_direction_same_as_global: true,
      payout_direction: 'before',
      admin_fee_same_as_global: true,
      admin_fee_enabled: false,
      admin_fee_percentage: null,
      game_types: ['Casino'],
      game_providers: ['Evolution Gaming', 'Pragmatic Play', 'Microgaming'],
      game_names: [],
      game_blacklist_enabled: false,
      game_types_blacklist: [],
      game_providers_blacklist: [],
      game_names_blacklist: [],
      game_exclusion_rules: [],
      dinamis_reward_type: '',
      dinamis_reward_amount: 0,
      dinamis_max_claim: 0,
      dinamis_max_claim_unlimited: false,
      min_reward_claim: null,
      min_reward_claim_enabled: false,
    },
    {
      id: 'sub_wbspt50',
      name: 'WBSPT50 — Sports 50%',
      calculation_base: 'deposit',
      calculation_method: 'percentage',
      calculation_method_enabled: true,
      calculation_value: 50,
      minimum_base: 100000,
      minimum_base_enabled: true,
      turnover_rule: '10x',
      turnover_rule_enabled: true,
      turnover_rule_custom: '',
      jenis_hadiah_same_as_global: true,
      jenis_hadiah: '',
      max_bonus_same_as_global: false,
      max_bonus: 1000000,
      max_bonus_unlimited: false,
      payout_direction_same_as_global: true,
      payout_direction: 'before',
      admin_fee_same_as_global: true,
      admin_fee_enabled: false,
      admin_fee_percentage: null,
      game_types: ['Sports'],
      game_providers: ['SBOBET', 'CMD368', 'Maxbet'],
      game_names: [],
      game_blacklist_enabled: false,
      game_types_blacklist: [],
      game_providers_blacklist: [],
      game_names_blacklist: [],
      game_exclusion_rules: [],
      dinamis_reward_type: '',
      dinamis_reward_amount: 0,
      dinamis_max_claim: 0,
      dinamis_max_claim_unlimited: false,
      min_reward_claim: null,
      min_reward_claim_enabled: false,
    },
  ],
  
  // Point Store Redeem Table
  redeem_items: [],
  redeem_jenis_reward: '',
  
  // Referral Commission Tiers (tier_network)
  referral_tiers: [],
  referral_calculation_basis: 'loss',  // Default: Loss/Winlose (iGaming Referral standard)
  referral_admin_fee_enabled: true,
  referral_admin_fee_percentage: 20,

  // AI Templates
  response_template_offer: '',
  response_template_requirement: '',
  response_template_instruction: '',
  ai_guidelines: '',
  default_behavior: '',
  completion_steps: '',
  
  // Metadata
  version: 1,
  is_active: true,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  updated_by: 'System',
};

/**
 * Seed sample promos ke database jika belum ada
 * @returns true jika data di-seed, false jika sudah ada data
 */
export async function seedSamplePromos(): Promise<boolean> {
  const existing = await getPromoDrafts();
  if (existing.length > 0) {
    return false; // Already has data
  }
  
  await promoKB.add(SAMPLE_PROMO_WELCOME_BONUS);
  return true;
}

/**
 * Force clear dan seed sample promos ke database
 * Digunakan untuk reset data ke sample awal
 */
export async function forceSeedSamplePromos(): Promise<void> {
  // Note: In Supabase mode, we just add the sample without clearing
  // Full clear would require additional implementation
  await promoKB.add(SAMPLE_PROMO_WELCOME_BONUS);
}
