import { PERSONA_BINDING_FIELDS, DROPPED_FIELDS, extractPersonaBindingFields, savePersonaBinding } from '@/lib/promo-persona-binding';
import { promoKB } from '@/lib/promo-storage';
import { generateUUID } from '@/lib/supabase-client';
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
 */
export const PKB_FIELD_WHITELIST = [
  // Identitas
  'client_id',
  'promo_name',
  'promo_type',
  'intent_category',
  'target_segment',
  'trigger_event',
  
  // Reward Config
  'reward_mode',
  'reward_type',
  'reward_amount',
  'min_requirement',
  'max_claim',
  'max_claim_unlimited',
  'turnover_rule',
  'turnover_rule_enabled',
  'claim_frequency',
  'claim_date_from',
  'claim_date_until',
  
  // Tier mode
  'promo_unit',
  'exp_mode',
  'lp_calc_method',
  'exp_calc_method',
  'lp_earn_basis',           // Basis perhitungan LP: 'turnover' | 'win' | 'lose' | 'deposit'
  'lp_earn_amount',          // Setiap [X] (unit sesuai basis)
  'lp_earn_point_amount',    // → mendapatkan [Y] LP
  'exp_formula',
  'lp_value',
  'exp_value',
  'tiers',
  'fast_exp_missions',
  'level_up_rewards',
  'vip_multiplier',
  
  // Distribution
  'reward_distribution',
  'distribution_day',
  'distribution_time',
  'distribution_date_from',
  'distribution_date_until',
  'distribution_time_enabled',
  'distribution_time_from',
  'distribution_time_until',
  'distribution_day_time_enabled',
  'custom_terms',
  'special_requirements',
  
  // Dinamis mode - NON-EXECUTABLE wrapper
  'formula_metadata',       // NEW: wrapper untuk fakta formula (base, method, value, period, timezone)
  'conversion_formula',     // Deskripsi tekstual (read-only untuk AI)
  'dinamis_min_claim',
  
  // Sub Kategori (Combo Promo)
  'has_subcategories',
  'subcategories',
  
  // Point Store Redeem Table
  'redeem_items',
  'redeem_jenis_reward',  // Global jenis reward untuk semua redeem items
  
  // Batasan & Akses
  'platform_access',
  'game_restriction',
  'game_types',
  'game_providers',
  'game_names',
  
  // Game Blacklist (Dinamis mode)
  'game_blacklist_enabled',
  'game_types_blacklist',
  'game_providers_blacklist',
  'game_names_blacklist',
  'game_exclusion_rules',
  
  'valid_from',
  'valid_until',
  'valid_until_unlimited',
  'status',
  'geo_restriction',
  'require_apk',
  'promo_risk_level', // Metadata deskriptif - level risiko komunikasi AI
  
  // Payment Method Context (NEW - for Deposit Pulsa, E-Wallet, Crypto, etc.)
  'deposit_method',
  'deposit_method_providers',
  'deposit_rate',
  
  // Admin Fee (untuk Referral Bonus)
  'admin_fee_enabled',
  'admin_fee_percentage',
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

export interface PromoFormData {
  // Step 1 - Identitas Promo
  client_id: string;
  promo_name: string;
  promo_type: string;
  intent_category: string;
  target_segment: string;
  trigger_event: string;

  // Step 2 - Konfigurasi Reward
  // Backend contract: 'formula' (UI displays as 'Dinamis')
  reward_mode: 'fixed' | 'tier' | 'formula';
  
  // Fixed mode
  reward_type: string;
  reward_amount: number;
  min_requirement: number;
  max_claim: number | null;  // null jika unlimited (canonical form)
  turnover_rule: string;
  turnover_rule_enabled: boolean;
  turnover_rule_custom: string;
  claim_frequency: string;
  claim_date_from: string;
  claim_date_until: string;

  // Tier mode
  tier_archetype?: 'tier_level' | 'tier_point_store';  // UI-gating only (optional for backward compat)
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
  
  // Periode Hitungan (untuk weekly/daily promo)
  calculation_period_start: string;  // 'senin', 'selasa', etc. atau '' (not extracted)
  calculation_period_end: string;    // 'senin', 'selasa', etc. atau '' (not extracted)
  distribution_date_from: string;
  distribution_date_until: string;
  distribution_time_enabled: boolean;
  distribution_time_from: string;
  distribution_time_until: string;
  distribution_day_time_enabled: boolean;
  custom_terms: string;
  special_requirements: string[];

  // Dinamis mode - UI helper fields (NOT saved to PKB directly)
  // These are used by form UI, then wrapped into formula_metadata for PKB
  calculation_base: string;
  calculation_method: string;
  calculation_value: number;
  minimum_base: number;
  minimum_base_enabled: boolean;
  
  // Dinamis mode - Reward (UI helper)
  dinamis_reward_type: string;
  dinamis_reward_amount: number;
  dinamis_max_claim: number;
  dinamis_max_claim_unlimited: boolean;
  dinamis_min_claim: number;
  dinamis_min_claim_enabled: boolean;
  
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

  // Step 4 - Template Pesan AI (saved to PersonaBinding, not PKB)
  response_template_offer: string;
  response_template_requirement: string;
  response_template_instruction: string;
  ai_guidelines: string;
  default_behavior: string;
  completion_steps: string;

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

// Redeem Item untuk Point Store (tier_point_store)
export interface RedeemItem {
  id: string;
  nama_hadiah: string;         // Contoh: "Credit Game 10.000"
  nilai_hadiah: number;        // Contoh: 10000
  biaya_lp: number;            // Contoh: 1000
  is_active?: boolean;         // Optional: toggle aktif/tidak
  note?: string;               // Optional: catatan internal
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
  
  // Bonus (Legacy - kept for backward compatibility)
  dinamis_reward_type: string;  // @deprecated - use reward_type instead
  dinamis_reward_amount: number;
  dinamis_max_claim: number;
  dinamis_max_claim_unlimited: boolean;
  dinamis_min_claim: number;
  dinamis_min_claim_enabled: boolean;
  
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
  
  // Normalize dinamis mode fields → PKB canonical form
  if (data.reward_mode === 'formula') {
    // 1. Construct formula_metadata wrapper (NON-EXECUTABLE)
    const formulaMetadata: FormulaMetadata = {
      base: (data.calculation_base || 'turnover') as FormulaMetadata['base'],
      method: (data.calculation_method || 'percentage') as FormulaMetadata['method'],
      value: data.calculation_value || 0,
    };
    
    // Add period from claim_frequency
    if (data.claim_frequency) {
      const periodMap: Record<string, string> = {
        'harian': 'daily',
        'mingguan': 'weekly',
        'bulanan': 'monthly',
        'sekali': 'once',
      };
      formulaMetadata.period = periodMap[data.claim_frequency] || data.claim_frequency;
    }
    
    // Default timezone
    formulaMetadata.timezone = 'GMT+7';
    
    pkbData.formula_metadata = formulaMetadata;
    
    // 2. Use min_requirement from minimum_base
    if (data.minimum_base && data.minimum_base_enabled) {
      pkbData.min_requirement = data.minimum_base;
    }
    
    // 3. Normalize max_claim: null jika unlimited (canonical form)
    pkbData.max_claim = data.dinamis_max_claim_unlimited ? null : (data.dinamis_max_claim || null);
    pkbData.max_claim_unlimited = data.dinamis_max_claim_unlimited;
    
    // 4. Use reward_type (bukan dinamis_reward_type duplikat)
    if (data.dinamis_reward_type) {
      pkbData.reward_type = data.dinamis_reward_type;
    }
  } else {
    // Non-formula modes: normalize max_claim jika unlimited
    if (data.max_claim === 0 && dataRecord.max_claim_unlimited) {
      pkbData.max_claim = null;
    }
  }
  
  return pkbData as Partial<PromoFormData>;
}

/**
 * Save promo draft with DUAL PAYLOAD strategy:
 * 1. PKB fields → saved to voc_promo_kb (Supabase)
 * 2. Persona/AI fields → saved to voc_promo_persona_bindings (separate storage)
 */
export async function savePromoDraft(promoData: PromoFormData, existingId?: string, updatedBy?: string): Promise<PromoItem> {
  // Also save persona binding separately
  const personaFields = extractPersonaBindingFields(promoData as unknown as Record<string, unknown>);
  
  if (existingId) {
    // Update existing
    const success = await promoKB.update(existingId, promoData);
    if (success) {
      savePersonaBinding(existingId, personaFields);
      const updated = await promoKB.getById(existingId);
      if (updated) return updated;
    }
    throw new Error('Failed to update promo');
  }
  
  // Create new
  const newPromo = await promoKB.add(promoData);
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

export async function getPromoById(id: string): Promise<PromoItem | undefined> {
  const promo = await promoKB.getById(id);
  return promo || undefined;
}

// Tier Archetype Options (UI-gating only, NOT business logic)
export const TIER_ARCHETYPE_OPTIONS = [
  { 
    value: 'tier_level' as const, 
    label: 'Sistem Level / Tier',
    description: 'Event berbasis level atau milestone (NALEN, VIP Upgrade)'
  },
  { 
    value: 'tier_point_store' as const, 
    label: 'Sistem Point (Loyalty / Experience)',
    description: 'Loyalty point atau experience redemption store'
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

export const PROMO_TYPES = [
  'Rollingan / Cashback',
  'Welcome Bonus',
  'Deposit Bonus',
  'Freechip',
  'Loyalty Point',
  'Event / Level Up',
  'Mini Game (Spin, Lucky Draw)',
  'Merchandise',
  'Referral Bonus',
  'Campaign / Informational'
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
export const TRIGGER_EVENTS = ['First Deposit', 'Login', 'Loss Streak', 'APK Download', 'Turnover', 'Mission Completed'];
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
  { value: '5x', label: '5x — Main 5 Kali' },
  { value: '8x', label: '8x — Main 8 Kali' },
  { value: 'custom', label: 'Custom — Tentukan Manual' },
];
export const CLAIM_FREQUENCIES = [
  { value: 'sekali', label: 'Sekali' },
  { value: 'harian', label: 'Harian' },
  { value: 'mingguan', label: 'Mingguan' },
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
export const CALCULATION_BASES = [
  { value: 'turnover', label: 'Turnover (TO)' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'win_loss', label: 'Win/Loss' },
  { value: 'bet_amount', label: 'Bet Amount' },
  { value: 'loyalty_point', label: 'Loyalty Point' },
  { value: 'experience_point', label: 'Experience Point' },
];

export const CALCULATION_METHODS = [
  { value: 'percentage', label: 'Persentase (%)' },
  { value: 'fixed', label: 'Fixed Amount' },
];

export const DINAMIS_REWARD_TYPES = [
  { value: 'freechip', label: 'Freechip' },
  { value: 'saldo', label: 'Saldo' },
  { value: 'cashback', label: 'Cashback' },
  { value: 'credit_game', label: 'Credit Game' },
  { value: 'lp', label: 'Loyalty Points' },
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
  reward_amount: 0,
  min_requirement: 0,
  max_claim: 0,  // UI default (akan jadi null di PKB jika unlimited)
  turnover_rule: '',
  turnover_rule_enabled: false,
  turnover_rule_custom: '',
  claim_frequency: '',
  claim_date_from: '',
  claim_date_until: '',
  tier_archetype: 'tier_level',  // Default: Level/Milestone Tier
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
  distribution_date_from: '',
  distribution_date_until: '',
  distribution_time_enabled: false,
  distribution_time_from: '',
  distribution_time_until: '',
  distribution_day_time_enabled: false,
  custom_terms: '',
  special_requirements: [],
  
  // Dinamis mode - UI helper fields
  calculation_base: '',
  calculation_method: '',
  calculation_value: 0,
  minimum_base: 0,
  minimum_base_enabled: true,
  dinamis_reward_type: '',
  dinamis_reward_amount: 0,
  dinamis_max_claim: 0,
  dinamis_max_claim_unlimited: false,
  dinamis_min_claim: 0,
  dinamis_min_claim_enabled: false,
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
  
  contact_channel_enabled: false,
  contact_channel: '',
  contact_link: '',

  // Global Jenis Hadiah, Max Bonus & Payout Direction (untuk Dinamis mode)
  global_jenis_hadiah_enabled: true,  // default ON - semua subcategory ikut global
  global_jenis_hadiah: '',
  global_max_bonus_enabled: true,     // default ON - semua subcategory ikut global
  global_max_bonus: 0,
  global_payout_direction_enabled: true,   // default ON - semua subcategory ikut global
  global_payout_direction: 'after',
  
  // Sub Kategori (Combo Promo)
  has_subcategories: false,
  subcategories: [],
  
  // Point Store Redeem Table
  redeem_items: [],
  redeem_jenis_reward: '',
  
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
  min_requirement: 50000,
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
  distribution_date_from: '',
  distribution_date_until: '',
  distribution_time_enabled: false,
  distribution_time_from: '',
  distribution_time_until: '',
  distribution_day_time_enabled: false,
  custom_terms: 'Bonus hanya berlaku untuk member baru; Minimal deposit Rp 50.000; Wajib klaim melalui Live Chat sebelum bermain',
  special_requirements: [],
  
  // Dinamis mode - UI helper fields
  calculation_base: 'deposit',
  calculation_method: 'percentage',
  calculation_value: 100,
  minimum_base: 50000,
  minimum_base_enabled: true,
  dinamis_reward_type: 'saldo',
  dinamis_reward_amount: 0,
  dinamis_max_claim: 2000000,
  dinamis_max_claim_unlimited: false,
  dinamis_min_claim: 0,
  dinamis_min_claim_enabled: false,
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
      dinamis_min_claim: 0,
      dinamis_min_claim_enabled: false,
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
      dinamis_min_claim: 0,
      dinamis_min_claim_enabled: false,
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
      dinamis_min_claim: 0,
      dinamis_min_claim_enabled: false,
    },
  ],
  
  // Point Store Redeem Table
  redeem_items: [],
  redeem_jenis_reward: '',

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
