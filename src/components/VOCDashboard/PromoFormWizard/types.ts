import { PERSONA_BINDING_FIELDS, DROPPED_FIELDS, extractPersonaBindingFields, savePersonaBinding } from '@/lib/promo-persona-binding';

// ============================================
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
  'lp_formula',
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
  promo_unit: 'lp' | 'exp' | 'hybrid';
  exp_mode: 'level_up' | 'exp_store' | 'both';
  lp_calc_method: string;
  exp_calc_method: string;
  lp_formula: string;
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

  // Step 4 - Template Pesan AI (saved to PersonaBinding, not PKB)
  response_template_offer: string;
  response_template_requirement: string;
  response_template_instruction: string;
  ai_guidelines: string;
  default_behavior: string;
  completion_steps: string;
}

export interface TierReward {
  id: string;
  minimal_point: number;
  reward: number | string;
  reward_type: 'fixed' | 'percentage';
  type: string;
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


// Sub Kategori (Combo Promo) - for Dinamis mode with multiple variants
export interface PromoSubCategory {
  id: string;
  name: string;  // Custom name for this sub-category
  
  // Dasar Perhitungan Bonus
  calculation_base: string;
  calculation_method: string;
  calculation_value: number;
  minimum_base: number;
  minimum_base_enabled: boolean;
  turnover_rule: string;
  turnover_rule_enabled: boolean;
  turnover_rule_custom: string;
  
  // Jenis Hadiah, Max Bonus & Payout Direction (dengan opsi ikut global)
  jenis_hadiah_same_as_global: boolean;
  jenis_hadiah: string;
  max_bonus_same_as_global: boolean;
  max_bonus: number;
  payout_direction_same_as_global: boolean;
  payout_direction: 'before' | 'after';
  
  // Permainan & Provider (Whitelist) - Multi-select arrays
  game_types: string[];
  game_providers: string[];
  game_names: string[];
  
  // Game Blacklist - Multi-select arrays
  game_blacklist_enabled: boolean;
  game_types_blacklist: string[];
  game_providers_blacklist: string[];
  game_names_blacklist: string[];
  game_exclusion_rules: string[];
  
  // Bonus (Legacy - kept for backward compatibility)
  dinamis_reward_type: string;
  dinamis_reward_amount: number;
  dinamis_max_claim: number;
  dinamis_max_claim_unlimited: boolean;
  dinamis_min_claim: number;
  dinamis_min_claim_enabled: boolean;
}

// Promo Item with metadata for storage
export interface PromoItem extends PromoFormData {
  id: string;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  updated_by?: string;
}

// LocalStorage helpers
const PROMO_STORAGE_KEY = 'voc_promo_drafts';

export function generatePromoId(): string {
  return `promo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function getPromoDrafts(): PromoItem[] {
  try {
    const data = localStorage.getItem(PROMO_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
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
 * 1. PKB fields → saved to voc_promo_drafts (main storage)
 * 2. Persona/AI fields → saved to voc_promo_persona_bindings (separate storage)
 */
export function savePromoDraft(promoData: PromoFormData, existingId?: string, updatedBy?: string): PromoItem {
  const drafts = getPromoDrafts();
  const now = new Date().toISOString();
  const adminName = updatedBy || "Admin";
  
  // Build PKB-clean payload (strips AI/persona fields)
  const pkbPayload = buildPKBPayload(promoData);
  
  // Also save persona binding separately
  const personaFields = extractPersonaBindingFields(promoData as unknown as Record<string, unknown>);
  
  let savedPromo: PromoItem;
  
  if (existingId) {
    // Update existing - increment version
    const index = drafts.findIndex(d => d.id === existingId);
    if (index !== -1) {
      drafts[index] = {
        ...drafts[index],
        ...pkbPayload,
        // Keep the full data for UI compatibility (backward compat)
        ...promoData,
        version: (drafts[index].version || 1) + 1,
        updated_at: now,
        updated_by: adminName,
      };
      localStorage.setItem(PROMO_STORAGE_KEY, JSON.stringify(drafts));
      savedPromo = drafts[index];
      
      // Save persona binding separately
      savePersonaBinding(existingId, personaFields);
      
      return savedPromo;
    }
  }
  
  // Create new
  const newId = generatePromoId();
  const newPromo: PromoItem = {
    ...promoData,
    ...pkbPayload,
    id: newId,
    version: 1,
    is_active: false,
    created_at: now,
    updated_at: now,
    updated_by: adminName,
  };
  drafts.push(newPromo);
  localStorage.setItem(PROMO_STORAGE_KEY, JSON.stringify(drafts));
  
  // Save persona binding separately
  savePersonaBinding(newId, personaFields);
  
  return newPromo;
}

export function duplicatePromo(promo: PromoItem): PromoItem {
  const drafts = getPromoDrafts();
  const now = new Date().toISOString();
  
  const newPromo: PromoItem = {
    ...promo,
    id: generatePromoId(),
    promo_name: `${promo.promo_name} (Copy)`,
    version: 1,
    is_active: false,
    status: 'draft',
    created_at: now,
    updated_at: now,
    updated_by: "Admin",
  };
  
  drafts.push(newPromo);
  localStorage.setItem(PROMO_STORAGE_KEY, JSON.stringify(drafts));
  return newPromo;
}

export function togglePromoActive(id: string): PromoItem | undefined {
  const drafts = getPromoDrafts();
  const index = drafts.findIndex(d => d.id === id);
  
  if (index !== -1) {
    drafts[index].is_active = !drafts[index].is_active;
    drafts[index].updated_at = new Date().toISOString();
    localStorage.setItem(PROMO_STORAGE_KEY, JSON.stringify(drafts));
    return drafts[index];
  }
  return undefined;
}

export function deletePromoDraft(id: string): boolean {
  const drafts = getPromoDrafts();
  const filtered = drafts.filter(d => d.id !== id);
  if (filtered.length !== drafts.length) {
    localStorage.setItem(PROMO_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  }
  return false;
}

export function getPromoById(id: string): PromoItem | undefined {
  const drafts = getPromoDrafts();
  return drafts.find(d => d.id === id);
}

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
  { value: 'e_sports', label: 'E-Sports' },
  { value: 'togel', label: 'Togel / Lottery (2D / 3D / 4D)' },
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
  promo_unit: 'lp',
  exp_mode: 'level_up',
  lp_calc_method: 'turnover',
  exp_calc_method: 'turnover',
  lp_formula: '',
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
  lp_formula: '',
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
      payout_direction_same_as_global: true,
      payout_direction: 'before',
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
      payout_direction_same_as_global: true,
      payout_direction: 'before',
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
      payout_direction_same_as_global: true,
      payout_direction: 'before',
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
 * Seed sample promos ke localStorage jika belum ada
 * @returns true jika data di-seed, false jika sudah ada data
 */
export function seedSamplePromos(): boolean {
  const existing = getPromoDrafts();
  if (existing.length > 0) {
    return false; // Already has data
  }
  
  const samplePromos: PromoItem[] = [SAMPLE_PROMO_WELCOME_BONUS];
  localStorage.setItem(PROMO_STORAGE_KEY, JSON.stringify(samplePromos));
  return true;
}

/**
 * Force clear dan seed sample promos ke localStorage
 * Digunakan untuk reset data ke sample awal
 */
export function forceSeedSamplePromos(): void {
  const samplePromos: PromoItem[] = [SAMPLE_PROMO_WELCOME_BONUS];
  localStorage.setItem(PROMO_STORAGE_KEY, JSON.stringify(samplePromos));
}
