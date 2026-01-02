/**
 * OpenAI Promo Extractor v4.2 — BLACKLIST PARSING FIX
 * 
 * FIXES APPLIED:
 * - Phase 1: Max Bonus & Turnover Rule prioritas TABEL (explicit)
 * - Phase 2: Confidence Assignment hierarchy yang jelas
 * - Phase 3: Smart Conflict Resolution (S&K silent = gunakan tabel)
 * - Phase 4: Blacklist Extraction Rules + PARSING FIX
 *   → "di slot: [GAMES]" = "di slot:" adalah header, [GAMES] adalah blacklist
 *   → Pisahkan games[] (nama spesifik) vs rules[] (aturan umum)
 * - Phase 5: Updated JSON Example dengan nilai explicit
 * 
 * ATURAN MUTLAK:
 * 1. Terms & Conditions = HUKUM TERTINGGI (jika ada konflik)
 * 2. TABLE = EXPLICIT source (jangan abaikan nilai tabel)
 * 3. S&K SILENT + Tabel ADA = gunakan tabel dengan "explicit"
 * 4. 7 confidence levels: explicit, explicit_from_terms, derived, unknown, ambiguous, missing, not_applicable
 */

import { getOpenAIKey, IS_DEV_MODE } from './config/openai.dev';
import { generateUUID } from './supabase-client';
import { enforceFieldApplicability } from './extractors/field-applicability-map';

// ============= CONFIDENCE LEVELS (EXPANDED + NOT_APPLICABLE) =============
export type ConfidenceLevel = 
  | 'explicit'           // tertulis jelas di halaman
  | 'explicit_from_terms' // dari S&K (source of truth tertinggi)
  | 'derived'            // inferensi logis ringan
  | 'unknown'            // tidak ada data
  | 'ambiguous'          // tidak jelas, butuh review
  | 'missing'            // field tidak ditemukan sama sekali
  | 'not_applicable';    // field tidak relevan untuk tipe promo ini

// ============= REWARD ARCHETYPE SYSTEM =============
// System-derived field - NOT user editable, NOT shown as input field
export type RewardArchetype = 
  | 'formula_based'    // Rollingan, Cashback, Deposit Bonus, Welcome Bonus
  | 'event_table'      // Scatter bonus, Level up, Achievement, Milestone
  | 'tiered_fixed'     // Point redemption, Loyalty tiers
  | 'referral';        // Referral bonus

// ============= REWARD DIMENSION SYSTEM (v2 - Context-Aware Field Resolution) =============
// Replaces rigid archetype-based field status with dimension-based resolution
export type RewardNature = 'bonus' | 'cashback' | 'referral' | 'reward' | 'event';
export type CalculationBasis = 'deposit' | 'turnover' | 'loss' | 'win' | 'level' | 'none';
export type DistributionType = 'instant' | 'periodic' | 'on_demand' | 'milestone';

export interface RewardDimensions {
  reward_nature: RewardNature;
  calculation_basis: CalculationBasis;
  payout_direction: 'depan' | 'belakang';
  distribution_type: DistributionType;
}

// ============= GAME DOMAIN SYSTEM (v1) =============
// System-derived - NOT user editable
export type GameDomain = 'slot' | 'casino' | 'togel' | 'sports' | 'general';

// Togel event reward structure
export interface TogelEventReward {
  prize_rank: string;      // "2nd", "3rd"
  digit_type: string;      // "3D", "4D"
  market?: string;         // "Singapore", "Hongkong" (optional)
  reward_amount: number;   // 20000, 200000
}

// Enhanced Prize structure with reward type detection
export interface ExtractedPrize {
  rank: string;
  prize: string;
  value: number | null;
  reward_type?: 'hadiah_fisik' | 'uang_tunai' | 'credit_game' | 'voucher' | 'other';
  physical_reward_name?: string;
  physical_reward_quantity?: number;
  cash_reward_amount?: number;
}

// Detect reward type from prize description with fallback pattern matching
export function detectRewardType(prize: string | undefined, physicalName?: string, cashAmount?: number): 'hadiah_fisik' | 'uang_tunai' | 'credit_game' {
  // PRIORITY 1: Explicit physical name or cash amount
  if (physicalName && physicalName.trim().length > 0) {
    return 'hadiah_fisik';
  }
  if (cashAmount && cashAmount > 0) {
    return 'uang_tunai';
  }
  
  // PRIORITY 2: Fallback - detect from prize description string
  const prizeText = (prize || '').toLowerCase();
  
  // Physical prize patterns (brand names, products)
  if (/pajero|veloz|xmax|pcx|honda|yamaha|suzuki|toyota|mitsubishi|emas antam|iphone|macbook|laptop|samsung|oppo|vivo|realme|xiaomi|motor|mobil|sepeda|tv|kulkas|ac|mesin cuci/i.test(prizeText)) {
    return 'hadiah_fisik';
  }
  
  // Cash patterns
  if (/uang tunai|cash|hadiah uang|tunai sebesar|uang sebesar/i.test(prizeText)) {
    return 'uang_tunai';
  }
  
  // Default: credit game
  return 'credit_game';
}

// Level Up / Event Unlock Condition (progress gate, NOT financial requirement)
export interface UnlockCondition {
  from_tier?: string;        // "Bronze", "Level 1"
  to_tier?: string;          // "Silver", "Level 2"
  condition_text: string;    // Full condition text for display
  condition_type: 'history_deposit' | 'previous_level' | 'cumulative_turnover' | 'other';
}

// Patterns to detect unlock conditions (NOT min_deposit!)
export const UNLOCK_CONDITION_PATTERNS = [
  /history\s*deposit\s*(rp\.?\s*[\d.,]+)/i,
  /telah\s*mencapai\s*level/i,
  /syarat\s*naik\s*level/i,
  /tier\s*\w+\s*(ke|to)\s*\w+\s*wajib/i,
  /sebelum(nya)?\s*(harus|wajib)/i,
  /total\s*deposit\s*(rp\.?\s*[\d.,]+)/i,
  /akumulasi\s*(deposit|turnover)/i,
  /untuk\s*naik\s*(ke\s*)?(level|tier)/i,
];

// Field applicability status per archetype
export type FieldStatus = 'required' | 'optional' | 'not_applicable';

// ============================================
// ARCHETYPE DETECTION (delegated to keyword-rules.ts)
// ============================================
import { getArchetypeFromKeywords, KEYWORD_RULES } from './extractors/keyword-rules';

// Game domain detection patterns
const DOMAIN_PATTERNS = {
  togel: [
    /togel|lottery|lotre/i,
    /\b[234]d\b/i,
    /pasaran/i,
    /prize\s*(1st|2nd|3rd|first|second|third)/i,
    /singapore|hongkong|sydney|cambodia|china|taiwan/i,
    /angka\s*(jitu|main|mati)/i,
  ],
  sports: [
    /sportsbook|taruhan\s*bola|handicap|over\s*under|parlay/i
  ],
  casino: [
    /live\s*casino|baccarat|roulette|blackjack|sic\s*bo/i
  ],
  slot: [
    /\bslot\b|pragmatic|pg\s*soft|habanero|spadegaming/i
  ]
} as const;

// ============= CLIENT/BRAND DETECTION =============
// Import modular extractors
import { 
  extractClientId as extractClientIdModular,
  type ClientIdResult,
  extractBlacklistFromSK,
  extractBlacklist,
  type BlacklistResult,
  parseTableWithRowspan,
  applySharedValues,
  extractTablesFromHtml,
  PROPAGATABLE_FIELDS,
  isPropagatableField,
  normalizeHtmlTables,
  hasRowspanTables,
  needsNormalization,
  // LLM Classifier exports
  classifyContent,
  type ProgramCategory,
  type ClassificationConfidence,
  type ClassificationResult,
  type ClassificationOverride,
  type QAnswer,
  type QualityFlag,
  getCategoryName,
  applyKeywordOverrides,
} from './extractors';

// Re-export classification types for external use
export type { 
  ProgramCategory, 
  ClassificationConfidence, 
  ClassificationResult, 
  ClassificationOverride,
  QAnswer,
  QualityFlag 
};
export { classifyContent, getCategoryName };

// Known brand patterns for auto-detection (legacy - kept for backward compat)
const KNOWN_BRANDS = [
  'CITRA77', 'SLOT25', 'WIN25', 'WG77', 'SLOT88', 'WIN88', 'MEGA88',
  'MAJU77', 'HOKI77', 'ZEUS77', 'NAGA77', 'RAJA77', 'SULTAN77',
  // Add more known client brands as needed
];

/**
 * Extract client_id (brand/website) from promo content
 * Uses modular extractor with enhanced patterns
 */
export function extractClientId(content: string): { client_id: string | null; confidence: ConfidenceLevel } {
  const result = extractClientIdModular(content);
  return {
    client_id: result.client_id,
    confidence: result.confidence,
  };
}

// Domain-aware defaults
interface DomainDefaults {
  metode: 'percentage' | 'fixed';
  dasar: 'deposit' | 'turnover' | 'bet_amount';
  jenis_game: string;
}

const DOMAIN_DEFAULTS: Record<GameDomain, DomainDefaults> = {
  togel: {
    metode: 'fixed',           // NEVER percentage for togel
    dasar: 'bet_amount',       // NEVER deposit for togel
    jenis_game: 'Togel',
  },
  slot: {
    metode: 'percentage',
    dasar: 'deposit',
    jenis_game: 'Slot',
  },
  casino: {
    metode: 'percentage',
    dasar: 'turnover',
    jenis_game: 'Live Casino',
  },
  sports: {
    metode: 'percentage',
    dasar: 'bet_amount',
    jenis_game: 'Sportsbook',
  },
  general: {
    metode: 'fixed',           // Safe default
    dasar: 'deposit',          // Safe default
    jenis_game: 'Semua',       // No assumption
  },
};

// Detect game domain from promo data (SYSTEM-DERIVED)
export function detectGameDomain(data: { promo_name?: string; terms_conditions?: string[] }): GameDomain {
  const text = `${data.promo_name || ''} ${(data.terms_conditions || []).join(' ')}`.toLowerCase();
  
  // Togel/Lottery patterns (highest priority for specificity)
  if (DOMAIN_PATTERNS.togel.some(p => p.test(text))) {
    return 'togel';
  }
  
  // Sports patterns
  if (DOMAIN_PATTERNS.sports.some(p => p.test(text))) {
    return 'sports';
  }
  
  // Casino patterns
  if (DOMAIN_PATTERNS.casino.some(p => p.test(text))) {
    return 'casino';
  }
  
  // Slot patterns (only if explicitly mentioned)
  if (DOMAIN_PATTERNS.slot.some(p => p.test(text))) {
    return 'slot';
  }
  
  // DEFAULT = GENERAL (not slot!) - prevents slot bias
  return 'general';
}

// Get domain defaults
export function getDomainDefaults(domain: GameDomain): DomainDefaults {
  return DOMAIN_DEFAULTS[domain];
}

// Detect archetype from promo data (SYSTEM-DERIVED - not user input)
export function detectRewardArchetype(data: { promo_name?: string; promo_type?: string }): RewardArchetype {
  const name = data.promo_name || '';
  const type = data.promo_type || '';
  
  // Use centralized keyword rules
  const archetype = getArchetypeFromKeywords(name, type);
  if (archetype) {
    return archetype;
  }
  
  // Default: formula-based (rollingan, cashback, deposit bonus, etc)
  return 'formula_based';
}

// Field status matrix per archetype
const FIELD_STATUS_MATRIX: Record<RewardArchetype, Record<string, FieldStatus>> = {
  formula_based: {
    calculation_value: 'required',
    turnover_rule: 'required',
    payout_direction: 'required',
    max_bonus: 'optional',
    minimum_base: 'optional',
  },
  event_table: {
    calculation_value: 'not_applicable',
    turnover_rule: 'not_applicable',
    payout_direction: 'optional',
    max_bonus: 'optional',
    minimum_base: 'optional',  // Changed: Event can have min_deposit requirement
  },
  tiered_fixed: {
    calculation_value: 'not_applicable',
    turnover_rule: 'not_applicable',
    payout_direction: 'required',
    max_bonus: 'optional',
    minimum_base: 'optional',
  },
  referral: {
    calculation_value: 'optional',
    turnover_rule: 'not_applicable',
    payout_direction: 'required',
    max_bonus: 'optional',
    minimum_base: 'not_applicable',  // Referral: tidak ada threshold nominal (WINLOSE di tabel = SAMPLE, bukan rule)
    min_downline: 'required',        // Referral: threshold tier = jumlah downline aktif
    sample_winlose: 'optional',      // Referral: data simulasi dari tabel (jika ada)
  },
};

// Get field status for archetype (exported for UI use) - LEGACY, use resolveFieldApplicability for new code
export function getFieldStatus(field: string, archetype: RewardArchetype): FieldStatus {
  return FIELD_STATUS_MATRIX[archetype]?.[field] || 'optional';
}

// ============= DIMENSION-BASED FIELD APPLICABILITY RESOLVER (v2) =============
// Context-aware field resolution based on reward dimensions, not rigid archetypes

/**
 * Detect reward dimensions from extracted promo data
 * Returns dimension object for context-aware field applicability
 */
export function detectRewardDimensions(data: { promo_name?: string; promo_type?: string; subcategories?: ExtractedPromoSubCategory[] }): RewardDimensions {
  const promoType = (data.promo_type || '').toLowerCase();
  const promoName = (data.promo_name || '').toLowerCase();
  const combined = promoType + ' ' + promoName;
  const calcBase = data.subcategories?.[0]?.calculation_base || '';
  const payoutDir = data.subcategories?.[0]?.payout_direction || 'belakang';
  
  // Detect reward_nature
  let reward_nature: RewardNature = 'bonus';
  if (/cashback|rebate|rollingan|turnover\s*bonus|komisi/i.test(combined)) {
    reward_nature = 'cashback';
  } else if (/referral|ajak\s*teman|referal/i.test(combined)) {
    reward_nature = 'referral';
  } else if (/event|level|naik|milestone|leaderboard|tournament|lucky\s*spin|gacha/i.test(combined)) {
    reward_nature = 'event';
  } else if (/loyalty|point|redeem|merchandise/i.test(combined)) {
    reward_nature = 'reward';
  }
  
  // Detect calculation_basis
  let calculation_basis: CalculationBasis = 'deposit';
  if (calcBase === 'win_loss' || /loss|kekalahan/i.test(combined)) {
    calculation_basis = 'loss';
  } else if (calcBase === 'turnover' || /rollingan|turnover/i.test(combined)) {
    calculation_basis = 'turnover';
  } else if (/level|tier/i.test(combined)) {
    calculation_basis = 'level';
  } else if (/win|kemenangan/i.test(combined)) {
    calculation_basis = 'win';
  }
  
  // Detect distribution_type
  let distribution_type: DistributionType = 'instant';
  if (/mingguan|weekly|bulanan|monthly/i.test(combined)) {
    distribution_type = 'periodic';
  } else if (/claim|redeem|klaim/i.test(combined)) {
    distribution_type = 'on_demand';
  } else if (/level|milestone|naik/i.test(combined)) {
    distribution_type = 'milestone';
  }
  
  return {
    reward_nature,
    calculation_basis,
    payout_direction: payoutDir as 'depan' | 'belakang',
    distribution_type,
  };
}

/**
 * Resolve field applicability based on reward dimensions
 * Returns field status map (required/optional/not_applicable)
 */
export function resolveFieldApplicability(dims: RewardDimensions): Record<string, FieldStatus> {
  const result: Record<string, FieldStatus> = {
    calculation_value: 'required',
    turnover_rule: 'required',
    payout_direction: 'required',
    max_bonus: 'optional',
    minimum_base: 'optional',
  };
  
  // RULE 1: Cashback/Rebate + loss-based = NO turnover requirement
  if (dims.reward_nature === 'cashback' && dims.calculation_basis === 'loss') {
    result.turnover_rule = 'not_applicable';
    result.max_bonus = 'optional'; // Often unlimited
  }
  
  // RULE 2: Cashback + turnover-based (rollingan) = NO turnover requirement
  if (dims.reward_nature === 'cashback' && dims.calculation_basis === 'turnover') {
    result.turnover_rule = 'not_applicable';
    result.max_bonus = 'optional';
  }
  
  // RULE 3: Referral = NO minimum_base (threshold = min_downline, not nominal)
  if (dims.reward_nature === 'referral') {
    result.minimum_base = 'not_applicable';
    result.turnover_rule = 'not_applicable';
  }
  
  // RULE 4: Event/Milestone = NO calculation_value
  if (dims.reward_nature === 'event') {
    result.calculation_value = 'not_applicable';
    result.turnover_rule = 'not_applicable';
  }
  
  // RULE 5: Reward/Loyalty = NO turnover
  if (dims.reward_nature === 'reward') {
    result.turnover_rule = 'not_applicable';
    result.calculation_value = 'not_applicable';
  }
  
  return result;
}

// Promo types yang tidak memiliki konsep turnover (legacy - kept for backward compat)
export const PROMO_TYPES_WITHOUT_TURNOVER = [
  'point_reward',
  'cashback',
  'redeem',
  'merchandise',
  'loyalty_point',
  'referral',
  'combo',  // Multi-tier promos biasanya tanpa TO
  // UI promo type names
  'Loyalty Point',
  'Merchandise',
  'Campaign / Informational',
  'Event / Level Up',
  'Rollingan / Cashback',
  'Referral Bonus',
] as const;

// Keywords di promo NAME yang mengindikasikan turnover exempt
export const TURNOVER_EXEMPT_NAME_KEYWORDS = /event|level\s*up|naik\s*level|milestone|kejar\s*level/i;

// Telco operators for deposit pulsa detection
export const TELCO_OPERATORS = ['TELKOMSEL', 'XL', 'AXIS', 'INDOSAT', 'TRI', 'SMARTFREN'] as const;

// Deposit pulsa detection keywords
export const DEPOSIT_PULSA_KEYWORDS = [
  'deposit pulsa',
  'pulsa tanpa potongan',
  'rate pulsa',
  'via pulsa',
  'depo pulsa',
] as const;

// ============= SUB KATEGORI (VARIAN) =============
export interface ExtractedPromoSubCategory {
  sub_name: string;
  
  // Core Calculation (WAJIB)
  calculation_base: 'deposit' | 'turnover' | 'win_loss' | 'bet_amount';
  calculation_method: 'percentage' | 'fixed' | 'threshold';
  calculation_value: number;       // e.g., 100 (untuk 100%)
  minimum_base: number;            // e.g., 50000 - eligibility threshold
  max_bonus: number | null;        // null = unlimited (explicit_from_terms)
  min_claim?: number | null;       // NEW: payout threshold (min bonus untuk dicairkan)
  payout_threshold?: number | null; // Alias for min_claim
  turnover_rule: number;           // e.g., 20 (untuk 20x)
  turnover_rule_format?: 'multiplier' | 'min_rupiah';  // Semantic hint: multiplier (20x) vs min_rupiah (Rp 1.000.000)
  payout_direction: 'depan' | 'belakang';
  
  // NEW: Jenis Hadiah Detection (v1.1)
  reward_type?: 'hadiah_fisik' | 'uang_tunai' | 'credit_game' | 'voucher' | 'other';
  physical_reward_name?: string;   // e.g., "MITSUBISHI PAJERO SPORT 2025"
  physical_reward_quantity?: number; // e.g., 2 (untuk "2 unit")
  cash_reward_amount?: number;     // e.g., 15000000 (untuk Rp 15.000.000)
  
  // Game Scope
  game_types: string[];            // e.g., ["sabung_ayam"] or ["ALL"]
  eligible_providers: string[];    // e.g., ["SV388", "WS168"] - providers yang eligible
  game_providers: string[];        // e.g., ["ALL"] or ["Pragmatic Play", "PG Soft"]
  game_names: string[];
  
  // Blacklist per Sub (default behavior)
  blacklist: {
    enabled: boolean;
    types: string[];       // e.g., ["Slot"] - game types blacklist
    providers: string[];   // e.g., ["Pragmatic Play"]
    games: string[];       // e.g., ["HEROES", "SPACEMAN"]
    rules: string[];       // e.g., ["Semua slot 3 line", "Old game slot"]
  };
  
  // NEW: Enhanced blacklist with confidence tracking
  blacklist_confidence?: 'explicit' | 'derived' | 'ambiguous' | 'none';
  blacklist_note?: string; // Explains why blacklist is/isn't applicable
  
  // NEW: Source tracking for propagated fields
  minimum_base_source?: 'explicit' | 'propagated_from_rowspan';
  
  // Confidence per field (WAJIB)
  confidence: {
    calculation_value: ConfidenceLevel;
    minimum_base: ConfidenceLevel;
    max_bonus: ConfidenceLevel;
    min_claim?: ConfidenceLevel;  // NEW: confidence for payout threshold
    turnover_rule: ConfidenceLevel;
    payout_direction: ConfidenceLevel;
    game_types: ConfidenceLevel;
    game_providers: ConfidenceLevel;
  };
}

// ============= PARENT PROMO (PAYUNG) =============
// Parent TIDAK BOLEH punya nilai numerik (bonus, min, TO, payout)
export interface ExtractedPromo {
  // Parent Info ONLY
  promo_name: string;
  promo_type: 'combo' | 'welcome_bonus' | 'deposit_bonus' | 'cashback' | 'rollingan' | 'referral' | string;
  target_user: 'new_member' | 'all' | 'vip' | string;
  promo_mode: 'single' | 'multi';  // KRITIS: single atau multi-variant
  
  // Client/Brand Identification (auto-detected)
  client_id?: string;              // e.g., "CITRA77", "SLOT25"
  client_id_confidence?: ConfidenceLevel;
  
  // ============================================
  // LLM CLASSIFIER METADATA (v1.0.0+2025-12-21)
  // Category calculated in CODE, not by LLM
  // ============================================
  program_classification?: ProgramCategory;
  program_classification_name?: string;
  classification_confidence?: ClassificationConfidence;
  classification_q1?: QAnswer;
  classification_q2?: QAnswer;
  classification_q3?: QAnswer;
  classification_q4?: QAnswer;
  quality_flags?: QualityFlag[];
  evidence_count?: number;
  classification_override?: ClassificationOverride;
  classifier_prompt_version?: string;
  classifier_latency_ms?: number;
  
  // Dates
  valid_from?: string;
  valid_until?: string;
  
  // Claim & Distribution (NEW - extracted fields)
  claim_frequency?: string;   // 'mingguan', 'harian', 'bulanan', 'sekali'
  calculation_period_start?: string;  // 'senin', 'selasa', etc.
  calculation_period_end?: string;    // 'senin', 'selasa', etc.
  distribution_day?: string;  // 'senin', 'selasa', etc.
  reward_distribution?: string; // 'Langsung', 'hari_tertentu'
  
  // Payment Method Context (NEW - for Deposit Pulsa, E-Wallet, Crypto, etc.)
  deposit_method?: 'bank' | 'pulsa' | 'ewallet' | 'crypto' | 'qris' | 'all';
  deposit_method_providers?: string[];  // e.g., ["TELKOMSEL", "XL"] or ["DANA", "OVO"]
  deposit_rate?: number;                // 100 = tanpa potongan, 90 = potongan 10%
  
  // Game Domain Detection (v1) - SYSTEM-DERIVED
  game_domain?: GameDomain;             // Auto-detected from content
  applicable_markets?: string[];        // For togel: ["Singapore", "Hongkong", ...]
  event_rewards?: TogelEventReward[];   // For event_table archetype (togel prizes)
  
  // Enhanced Prize structure for Category B (Event)
  prizes?: ExtractedPrize[];            // For leaderboard/tournament with mixed reward types
  
  // Event-specific fields (Category B)
  min_deposit?: number | null;          // Minimal deposit untuk participate (e.g., 50000 for Lucky Spin)
  min_deposit_note?: string | null;     // Note like "Untuk 1 Tiket"
  
  // Level Up / Event Unlock Conditions (progress gates, NOT financial requirements)
  // These are NOT min_deposit! They are tier progression conditions
  unlock_conditions?: UnlockCondition[];
  
  // Loyalty Mechanism (Category C - Policy)
  loyalty_mechanism?: {
    point_name?: string;        // "LP", "EXP", "XP"
    earning_rule?: string;      // e.g., "1000 TO = 1 LP"
    exchange_table?: Array<{
      points: number;
      reward: string;
      reward_type?: 'hadiah_fisik' | 'uang_tunai' | 'credit_game';
      physical_reward_name?: string;
      physical_reward_quantity?: number;
      cash_reward_amount?: number;
    }>;
    tier_system?: Array<{
      tier_name: string;
      requirement: string;
    }>;
  };
  
  // Eligible providers (extracted from "KATEGORI (PROVIDER1 & PROVIDER2)" pattern)
  eligible_providers?: string[];  // e.g., ["SV388", "WS168"]
  
  // Global blacklist — HANYA jika eksplisit "berlaku untuk semua"
  global_blacklist: {
    enabled: boolean;
    is_explicit: boolean;  // true = eksplisit tertulis, false = derived
    types: string[];       // e.g., ["Slot"] - game types blacklist
    providers: string[];
    games: string[];
    rules: string[];
  };
  
  // Sub-categories (VARIAN)
  has_subcategories: boolean;
  subcategories: ExtractedPromoSubCategory[];
  expected_subcategory_count: number;  // Jumlah baris tabel yang terdeteksi
  
  // General terms
  terms_conditions: string[];
  claim_method?: string;
  
  // Metadata
  source_url?: string;
  raw_content?: string;
  
  // NEW: Extraction source marker for image confidence downgrade
  _extraction_source?: 'url' | 'html' | 'image';
  
  // NEW: Extraction metadata for debugging and audit
  _extraction_meta?: {
    has_rowspan_tables: boolean;
    html_was_normalized: boolean;
    client_id_source: string | null;
    propagated_fields: string[];
    ambiguous_blacklists: number;
    extracted_at: string;
    // Classification override metadata (for image extraction)
    classification_overridden?: boolean;
    classification_override_reason?: string;
    original_llm_category?: string;
  };
  
  // Validation Status
  validation: {
    is_structurally_complete: boolean;  // true if no warnings
    status: 'draft' | 'ready';  // Simplified: no more draft_blocked
    warnings: string[];  // All issues are warnings, not blocking errors
  };
  
  ready_to_commit: boolean;  // SELALU false sampai user confirm
}

// ============= VALIDATION =============
export interface ValidationResult {
  is_structurally_complete: boolean;  // true if no warnings (all fields filled)
  status: 'draft' | 'ready';  // Simplified: no more draft_blocked
  warnings: string[];  // All issues are warnings (informational)
  can_commit: boolean;  // Always true - user can always proceed
}

const REQUIRED_SUB_FIELDS = [
  'calculation_value',
  'minimum_base', 
  'turnover_rule',
  'payout_direction'
] as const;

// Note: max_bonus is NOT in required fields because null = unlimited is valid

// Note: max_bonus is NOT in required fields because null = unlimited is valid

export function validateExtractedPromo(data: ExtractedPromo): ValidationResult {
  const warnings: string[] = [];
  
  // PHASE 1: Detect reward dimensions (context-aware) AND archetype (legacy compat)
  const dimensions = detectRewardDimensions(data);
  const fieldApplicability = resolveFieldApplicability(dimensions);
  const archetype = detectRewardArchetype(data); // Keep for legacy UI
  
  // Rule 1: Multi-variant tapi hanya 1 sub → WARNING (not blocking)
  if (data.promo_mode === 'multi' && data.subcategories.length < 2) {
    warnings.push(`Promo multi-variant tapi hanya ${data.subcategories.length} sub kategori terdeteksi — dapat diedit manual`);
  }
  
  // Rule 2: Mismatch jumlah sub dengan expected → WARNING
  if (data.expected_subcategory_count > 0 && data.subcategories.length !== data.expected_subcategory_count) {
    warnings.push(`Jumlah sub kategori (${data.subcategories.length}) tidak sesuai dengan baris tabel (${data.expected_subcategory_count}) — dapat diedit manual`);
  }
  
  // Rule 3: Check setiap sub kategori with DIMENSION-AWARE validation
  data.subcategories.forEach((sub, idx) => {
    const subLabel = sub.sub_name || `Sub ${idx + 1}`;
    
    // Fields to validate - use dimension-based applicability
    const fieldsToCheck = ['calculation_value', 'turnover_rule', 'payout_direction'];
    
    fieldsToCheck.forEach(field => {
      // Use dimension-aware field status (new system)
      const status = fieldApplicability[field] || 'optional';
      const value = sub[field as keyof ExtractedPromoSubCategory];
      const isEmpty = value === undefined || value === null || (typeof value === 'string' && value === '');
      
      // ONLY warn if REQUIRED and empty
      // not_applicable → SKIP completely, no warning
      // optional → SKIP warning even if empty
      if (status === 'required' && isEmpty) {
        warnings.push(`${subLabel}: "${field}" tidak terdeteksi — dapat diisi manual`);
      }
    });
    
    // SWAP Detection - Only for bonus + deposit-based (standard deposit/welcome bonus)
    // Skip for cashback/rebate (different field semantics)
    if (dimensions.reward_nature === 'bonus' && dimensions.calculation_basis === 'deposit') {
      // Check minimum_base === max_bonus (likely extraction error)
      if (sub.minimum_base != null && sub.max_bonus != null && sub.minimum_base === sub.max_bonus) {
        warnings.push(`${subLabel}: Min Deposit (Rp ${sub.minimum_base.toLocaleString('id-ID')}) sama dengan Max Bonus — perlu verifikasi`);
      }
      
      // SWAP Detection Warning - minimum_base tinggi + max_bonus null = likely swapped
      if (sub.minimum_base != null && sub.minimum_base >= 100000 && sub.max_bonus === null) {
        warnings.push(`${subLabel}: Min Deposit tinggi tapi Max Bonus null — kemungkinan field tertukar`);
      }
    }
    
    // Max Bonus Warning - Skip for cashback (often unlimited by design)
    // Only warn for bonus types where max_bonus matters
    if (dimensions.reward_nature !== 'cashback' && dimensions.reward_nature !== 'event' && dimensions.reward_nature !== 'reward') {
      if (sub.max_bonus === null) {
        if (sub.confidence?.max_bonus === 'explicit_from_terms') {
          // Valid - explicitly unlimited from terms, just info (but don't warn)
          // Remove this warning - it's noise for user
        } else if (sub.confidence?.max_bonus !== 'explicit' && sub.confidence?.max_bonus !== 'not_applicable') {
          warnings.push(`${subLabel}: Max bonus tidak terdeteksi — dapat diisi manual`);
        }
      }
    }
    
    // Check confidence — only for REQUIRED fields based on dimension applicability
    fieldsToCheck.forEach(field => {
      const status = fieldApplicability[field] || 'optional';
      
      // Skip confidence check for not_applicable fields
      if (status === 'not_applicable') return;
      
      const conf = sub.confidence?.[field as keyof typeof sub.confidence];
      if (conf && status === 'required') {
        // explicit dan explicit_from_terms = trusted sources
        if (conf === 'explicit' || conf === 'explicit_from_terms') {
          // OK - trusted source
        } 
        // not_applicable = ALLOW (field memang tidak berlaku untuk tipe promo ini)
        else if (conf === 'not_applicable') {
          // OK - field tidak relevan
        }
        else if (conf === 'ambiguous' || conf === 'missing') {
          warnings.push(`${subLabel}: "${field}" perlu review (${conf}) — dapat diisi manual`);
        } else if (conf === 'unknown') {
          warnings.push(`${subLabel}: "${field}" tidak ditemukan — dapat diisi manual`);
        } else if (conf === 'derived') {
          warnings.push(`${subLabel}: "${field}" adalah hasil parsing — mohon verifikasi`);
        }
      }
    });
    
    // Check game_providers confidence for "ALL" special case
    if (sub.game_providers?.includes('ALL') && sub.confidence?.game_providers !== 'explicit_from_terms') {
      warnings.push(`${subLabel}: "Semua provider" sebaiknya diverifikasi dari S&K`);
    }
  });
  
  // Rule 4: Global blacklist tanpa eksplisit → warning
  if (data.global_blacklist?.enabled && !data.global_blacklist.is_explicit) {
    warnings.push('Global blacklist tidak eksplisit tertulis — mohon verifikasi');
  }
  
  // Simplified status: ready if no warnings, draft if has warnings
  // User can always proceed regardless of status
  const status: 'draft' | 'ready' = warnings.length > 0 ? 'draft' : 'ready';
  
  return {
    is_structurally_complete: warnings.length === 0,  // True only if all fields filled
    status,
    warnings,
    can_commit: true  // ALWAYS true - user can always proceed
  };
}

// ============= EXTRACTION PROMPT v2 (SOURCE OF TRUTH HIERARCHY) =============
const EXTRACTION_PROMPT = `Kamu adalah Promo Knowledge Extractor (Pseudo Knowledge).
Tugas kamu HANYA mengekstrak dan memetakan promo ke schema Knowledge Base internal.
Kamu BUKAN pembuat promo, BUKAN penebak, dan DILARANG mengisi asumsi.

🧠 PRINSIP WAJIB (NON-NEGOTIABLE)

1️⃣ SOURCE OF TRUTH HIERARCHY (WAJIB TAAT)
Urutan kebenaran absolut:
1. Syarat & Ketentuan (Terms & Conditions) → HUKUM TERTINGGI
2. Tabel promo utama
3. Highlight / badge / banner
4. Meta / SEO / visual lain

📐 CONFLICT RESOLUTION (SMART RULES - PHASE 3 FIX)
1. S&K dan Tabel SAMA → gunakan nilai, confidence = "explicit"
2. S&K dan Tabel BERBEDA → S&K menang, confidence = "explicit_from_terms"
3. S&K SILENT, Tabel ADA → gunakan nilai tabel, confidence = "explicit"
4. Tabel SILENT, S&K ADA → gunakan S&K, confidence = "explicit_from_terms"
5. KEDUANYA SILENT → null, confidence = "unknown"

❌ JANGAN set null hanya karena S&K tidak menyebut field tersebut
✅ Null HANYA jika: explicit "unlimited" ATAU tidak ada data sama sekali

2️⃣ ANTI-HALLUCINATION RULE
❌ DILARANG:
- Menyimpulkan data yang tidak tertulis
- Mengisi default "masuk akal"
- Mengambil provider / max bonus dari visual jika S&K berbeda

Jika data tidak eksplisit:
- value = null
- confidence = "unknown"

🧩 RULE EKSTRAKSI KHUSUS (KRITIKAL)

📋 ATURAN MULTIPLE TABLES (SANGAT PENTING):
Banyak promo memiliki LEBIH DARI SATU TABEL dalam satu halaman.
Contoh: Loyalty Point sering memiliki:
- Tabel 1: "Paket Penukaran Reguler" (hadiah kecil)
- Tabel 2: "Hadiah Utama/Eksklusif" (hadiah besar)

⚠️ INSTRUKSI WAJIB:
1. SCAN seluruh dokumen untuk menemukan SEMUA tabel yang relevan
2. EXTRACT semua rows dari SETIAP tabel yang ditemukan
3. GABUNGKAN semua hasil ke dalam SATU array subcategories
4. JANGAN berhenti setelah tabel pertama!
5. JANGAN skip tabel manapun!

CONTOH:
Jika dokumen memiliki:
- Tabel 1 dengan 4 rows (CREDIT GAME 5K, 10K, 15K, 20K)
- Tabel 2 dengan 7 rows (CREDIT GAME 25K, 50K, 100K, 200K, 500K, 1M, 2.5M)

Maka subcategories HARUS berisi 11 items total, bukan hanya 4 atau 7!

❌ JANGAN hanya extract tabel pertama
❌ JANGAN skip rows dari tabel manapun
✅ WAJIB gabungkan SEMUA rows dari SEMUA tabel

📊 ATURAN PARSE TABEL:
Jika source data adalah TABEL dengan format:
| NO | NAMA/ITEM/CREDIT GAME | VALUE |
|----|-----------------------|-------|
| 1  | Item Pertama          | 100   |
| 2  | Item Kedua            | 200   |

MAKA:
- sub_name = ambil dari kolom NAMA/ITEM (kolom ke-2), BUKAN dari kolom NO (kolom ke-1)
- calculation_value = ambil dari kolom VALUE (kolom ke-3)
- JANGAN PERNAH menggunakan row number "1", "2", "3" sebagai nama varian!

🔹 Max Bonus — WAJIB AMBIL DARI KOLOM TABEL (PHASE 1+ FIX - CRITICAL)

ATURAN UTAMA (WAJIB):
- Untuk SETIAP row di tabel promo, kamu WAJIB extract nilai Max Bonus dari kolom yang sesuai.
- Jika cell Max Bonus di tabel berisi nilai numerik → JANGAN PERNAH set null.
- Nilai numerik di tabel = "explicit".

PETUNJUK KOLOM (umum di situs ID):
- Judul kolom bisa: "Max Bonus", "Maks Bonus", "Maksimal Bonus", "Max (Rp)", "Max Bonus (Rp)", "Max. Bonus".
- Jika di tabel tertulis "Rp 800.000" → max_bonus = 800000.

URUTAN PRIORITAS:
1) Jika TABEL menampilkan nilai numerik pada kolom Max Bonus untuk row tersebut:
   → "max_bonus": angka
   → "confidence.max_bonus": "explicit"

2) Jika S&K EKSPLISIT menyebut untuk row/varian itu "Unlimited" / "Tanpa batas" / "Tidak ada batas maksimum":
   → "max_bonus": null
   → "confidence.max_bonus": "explicit_from_terms"

3) HANYA jika tidak ada di tabel DAN tidak ada di S&K:
   → "max_bonus": null
   → "confidence.max_bonus": "unknown"

❌ JANGAN gunakan aturan S&K "unlimited" untuk semua varian jika tidak eksplisit
❌ JANGAN set null jika ada angka di tabel
✅ S&K silent + tabel ada angka = pakai angka tabel

🔹 Minimum Base (Min Deposit) — WAJIB BEDAKAN DARI MAX BONUS (SUPER CRITICAL!)

⚠️⚠️⚠️ PERBEDAAN KRITIS (HARUS DIPAHAMI):
- minimum_base = SYARAT MINIMAL deposit/turnover untuk IKUT promo (kolom "Min Deposit", "Min. DP", "Minimal Deposit")
- max_bonus = BATAS MAKSIMAL bonus yang bisa DIDAPAT (kolom "Max Bonus", "Maks Bonus")

INI DUA FIELD BERBEDA! JANGAN PERNAH TUKAR ATAU COPY!

⚠️⚠️⚠️ ANTI-SWAP RULE (SUPER CRITICAL - SERING TERJADI ERROR INI!):

PATTERN SALAH yang SERING TERJADI:
Tabel HANYA punya kolom "Max Bonus" TANPA kolom "Min Deposit"
→ AI SALAH: menaruh nilai Max Bonus ke minimum_base, lalu set max_bonus = null ❌

CONTOH TABEL (TANPA KOLOM MIN DEPOSIT):
| Bonus | Max Bonus |
| 50%   | Rp 800.000 |
| 30%   | Rp 15.000.000 |

OUTPUT SALAH (JANGAN!):
{
  "minimum_base": 800000,  ← SALAH! Ini nilai dari kolom Max Bonus!
  "max_bonus": null        ← SALAH! Harusnya 800000!
}

OUTPUT BENAR:
{
  "minimum_base": null,    ← Tidak ada kolom Min Deposit
  "max_bonus": 800000      ← Dari kolom Max Bonus
}

CHECK SEBELUM OUTPUT (WAJIB!):
1. Cari kolom dengan kata "Min" / "Minimal" / "Minimum" → ITU minimum_base
2. Cari kolom dengan kata "Max" / "Maks" / "Maksimal" → ITU max_bonus
3. Jika HANYA ada kolom Max, maka minimum_base = null!
4. JANGAN PERNAH taruh nilai Max ke field minimum_base!

⚠️⚠️⚠️ VALIDATION CHECK (WAJIB!):
Jika minimum_base == max_bonus untuk SATU varian, itu 99% PARSING ERROR!
- Biasanya minimum_base << max_bonus (JAUH lebih kecil)
- Contoh BENAR: minimum_base = 50.000, max_bonus = 1.000.000
- Contoh SALAH: minimum_base = 800.000, max_bonus = 800.000 ❌

CONTOH TABEL DENGAN KOLOM MIN DEPOSIT:
| Bonus | Min Deposit | Max Bonus |
| 100%  | Rp 50.000   | Rp 1.000.000 |
| 50%   | Rp 500.000  | Rp 800.000 |

OUTPUT BENAR:
Varian 1: "minimum_base": 50000, "max_bonus": 1000000 ✅
Varian 2: "minimum_base": 500000, "max_bonus": 800000 ✅

CONTOH TABEL TANPA KOLOM MIN DEPOSIT:
| Bonus | Max Bonus |
| 50%   | Rp 800.000 |
| 30%   | Rp 15.000.000 |

OUTPUT BENAR (NULL untuk minimum_base):
Varian 1: "minimum_base": null, "max_bonus": 800000, "confidence.minimum_base": "unknown" ✅
Varian 2: "minimum_base": null, "max_bonus": 15000000, "confidence.minimum_base": "unknown" ✅

❌❌❌ OUTPUT SALAH (JANGAN PERNAH!):
Varian 1: "minimum_base": 800000, "max_bonus": null ← SWAP ERROR!
Varian 2: "minimum_base": 15000000, "max_bonus": null ← SWAP ERROR!

PETUNJUK KOLOM minimum_base (umum di situs ID):
- DEPOSIT: "Min Deposit", "Min. DP", "Minimal Deposit", "Min Depo", "Syarat Deposit", "Minimal DP"
- CASHBACK/REBATE: "Minimal Kekalahan", "Min Loss", "Minimal WL", "Win/Loss Minimum", "Syarat Kekalahan"
⚠️ JANGAN MASUKKAN "Minimal Turnover" di sini! Itu untuk turnover_rule!

PETUNJUK KOLOM turnover_rule (KHUSUS ROLLINGAN/REBATE):
- "Minimal Turnover", "Min TO", "Syarat TO", "Minimal Bet"
- "Minimal turnover 1.000.000" → turnover_rule: "1000000" (LANGSUNG ANGKA!)
- "Min TO 500rb" → turnover_rule: "500000" (LANGSUNG ANGKA!)

URUTAN PRIORITAS:
1) Jika TABEL menampilkan kolom Min Deposit dengan nilai → extract nilai tersebut
2) Jika S&K menyebut "minimal deposit Rp X" → extract nilai X
3) Jika cell Min Deposit berisi "-" atau kosong → minimum_base = null, confidence = "unknown"
4) Jika TIDAK ADA kolom Min Deposit sama sekali → minimum_base = null, confidence = "unknown"

❌❌❌ ATURAN KERAS:
- JANGAN PERNAH copy nilai max_bonus ke minimum_base!
- JANGAN PERNAH set minimum_base = max_bonus jika tidak ada data!
- Jika tidak ada data Min Deposit → SET NULL, BUKAN copy dari field lain!
- Jika minimum_base punya nilai TAPI max_bonus null → KEMUNGKINAN SWAP ERROR!


🔹 CASHBACK/REBATE: "Minimal Kekalahan" ≠ "Max Bonus" (SUPER CRITICAL!)

⚠️⚠️⚠️ UNTUK CASHBACK/REBATE PROMO — PERBEDAAN KRITIS:

Ada 2 field yang SERING SALAH MAPPING untuk promo cashback:

1️⃣ minimum_base (Minimum Syarat Kualifikasi)
   Keyword di source: 
   - "minimal kekalahan", "min loss", "minimum WL", "minimal kalah"
   - "minimal turnover", "min TO", "minimal bet"
   Artinya: Player harus punya kekalahan/turnover MINIMAL segini untuk QUALIFY dapat bonus
   
2️⃣ max_bonus (Maksimal Bonus / Cap)
   Keyword di source: 
   - "maksimal bonus", "max bonus", "bonus maksimal", "tidak lebih dari"
   - "maksimum cashback", "max cashback"
   Artinya: Bonus yang didapat TIDAK BISA lebih dari nilai ini

⚠️ ATURAN KERAS CASHBACK:
- "Minimal kekalahan Rp500.000" → minimum_base: 500000, BUKAN max_bonus!
- "Maksimal bonus Rp500.000" → max_bonus: 500000
- Jika source TIDAK menyebut "maksimal bonus" / "max bonus" → set max_bonus: null (UNLIMITED)
- Jika source TIDAK menyebut "minimal kekalahan" / "min loss" → set minimum_base: null

❌ CONTOH MAPPING SALAH:
Source: "Minimal kekalahan Rp500.000"
Output: { "max_bonus": 500000 }
→ INI SALAH! "Minimal kekalahan" bukan "max bonus"!

✅ CONTOH MAPPING BENAR:
Source: "Minimal kekalahan Rp500.000. Tidak ada batas maksimum bonus."
Output: { 
  "minimum_base": 500000,
  "max_bonus": null,
  "max_bonus_explicit": false
}

✅ CONTOH MAPPING BENAR:
Source: "Minimal kekalahan Rp500.000. Maksimal bonus Rp1.000.000."
Output: { 
  "minimum_base": 500000,
  "max_bonus": 1000000,
  "max_bonus_explicit": true
}

✅ CONTOH MAPPING BENAR:
Source: "Cashback 5% tanpa syarat minimal kekalahan. Maks bonus Rp 2.000.000."
Output: { 
  "minimum_base": null,
  "max_bonus": 2000000,
  "max_bonus_explicit": true
}

🔹 max_bonus_explicit FLAG (CRITICAL!)
Output WAJIB include field "max_bonus_explicit":
- "max_bonus_explicit": true  → JIKA source EKSPLISIT menyebut "maksimal bonus" / "max bonus"
- "max_bonus_explicit": false → JIKA tidak ada penyebutan maksimal bonus (unlimited)
- INI PENTING untuk Summary Page agar tidak menampilkan "max bonus" palsu!

🔴 THRESHOLD ONTOLOGY (CRITICAL - JANGAN BINGUNG!)

Ada 3 jenis threshold yang BERBEDA TOTAL:

1️⃣ eligibility_threshold (minimum_base):
   - Syarat IKUT promo / QUALIFY
   - Keywords: "minimal turnover", "minimal kekalahan", "minimal deposit untuk ikut"
   - "Minimal win/loss Rp500.000 untuk ikut promo"
   - "Hanya berlaku untuk player dengan kekalahan min Rp1.000.000"
   
2️⃣ calculation_base:
   - DASAR perhitungan bonus
   - "Bonus 0.5% dari win-loss" → calculation_base: "winloss"
   - BUKAN threshold, ini BASE!
   
3️⃣ payout_threshold (min_claim):
   - Syarat CAIRKAN bonus yang sudah dihitung
   - Keywords: "minimal bonus yang bisa dicairkan", "min claim", "bonus tidak bisa diklaim jika kurang dari"
   - "Minimal bonus yang bisa dicairkan Rp1.000"
   - "Bonus < Rp1.000 tidak dapat diklaim"
   
⚠️⚠️⚠️ ATURAN ONTOLOGY KERAS:
- JANGAN map "min bonus cair" ke minimum_base!
- JANGAN map "syarat ikut promo" ke min_claim!
- minimum_base = eligibility (syarat IKUT)
- min_claim = payout threshold (syarat CAIR)

❌ CONTOH MAPPING SALAH:
Source: "Bonus 0.5% dari win-loss. Minimal bonus yang bisa dicairkan Rp1.000"
Output: { "minimum_base": 1000 }
→ INI SALAH! "Minimal bonus cair" bukan "syarat ikut promo"!

✅ CONTOH MAPPING BENAR:
Source: "Bonus 0.5% dari win-loss. Minimal bonus yang bisa dicairkan Rp1.000"
Output: { 
  "minimum_base": null,
  "min_claim": 1000
}

✅ CONTOH MAPPING BENAR (keduanya ada):
Source: "Minimal kekalahan Rp500.000 untuk ikut promo. Minimal bonus yang bisa dicairkan Rp1.000"
Output: { 
  "minimum_base": 500000,
  "min_claim": 1000
}

🔹 calculation_base untuk CASHBACK (CRITICAL!)
Untuk promo CASHBACK berbasis kekalahan (loss):
- calculation_base: "winloss" atau "win_loss" (BUKAN "turnover"!)
- Keywords trigger: "cashback", "kekalahan", "loss", "kalah", "win/loss"
- Jika source menyebut "cashback X% dari kekalahan" → calculation_base = "winloss"


🔹 claim_frequency EXTRACTION (CASHBACK/REBATE - CRITICAL!)

Keywords untuk detect claim_frequency:
- "mingguan" / "per minggu" / "weekly" → 'mingguan'
- "harian" / "per hari" / "daily" → 'harian'  
- "bulanan" / "per bulan" / "monthly" → 'bulanan'
- "sekali" / "one time" → 'sekali'

⚠️ ATURAN KHUSUS:
- Untuk CASHBACK & REBATE yang menyebut "periode" atau "dihitung dari" → hampir pasti 'mingguan' atau 'harian'
- JANGAN default ke 'sekali' untuk cashback!
- Jika promo tipe cashback/rebate/rollingan DAN tidak disebut frekuensi → default 'mingguan'


🔹 Periode Hitungan & Hari Pembagian (CASHBACK/REBATE - CRITICAL!)

Untuk promo periodic (mingguan, harian), extract:

1️⃣ calculation_period_start & calculation_period_end
   Keyword: "periode hitungan", "dihitung dari hari", "berlaku hari X s/d Y"
   Contoh: "Periode hitungan berlaku hari Senin s/d Minggu"
   → calculation_period_start: "senin"
   → calculation_period_end: "minggu"

2️⃣ distribution_day
   Keyword: "dibagikan", "dikirim", "otomatis setiap hari", "bonus akan dikirim setiap"
   Contoh: "Bonus akan dibagikan secara otomatis setiap hari SELASA"
   → distribution_day: "selasa"
   → reward_distribution: "hari_tertentu"

⚠️ ATURAN:
- Jika source menyebut hari spesifik → extract sebagai lowercase (senin, selasa, dst)
- Jika source tidak menyebut hari → set sebagai null (JANGAN hardcode "senin-minggu"!)
- JANGAN infer "senin-minggu" jika tidak eksplisit disebutkan!


🔹 Turnover Rule — PRIORITAS TABEL (PHASE 1 FIX)
URUTAN PRIORITAS:
1. Jika TABEL menampilkan nilai turnover (e.g., "8x", "TO 10x", "20 kali"):
   → Extract nilai numerik
   → "turnover_rule": 8
   → "confidence.turnover_rule": "explicit"

2. Jika S&K menyebut nilai turnover:
   → Extract nilai dari S&K
   → "confidence.turnover_rule": "explicit_from_terms"

3. Jika S&K dan Tabel keduanya silent:
   → "turnover_rule": null
   → "confidence.turnover_rule": "unknown"

❌ JANGAN mark "derived" jika nilai tertulis di tabel
✅ Tabel dengan nilai = EXPLICIT

🔹 Game Category Naming (CRITICAL - JANGAN OUTPUT ENGLISH TERMS!)

Output game category dalam format Indonesia/platform standard:
- "sabung_ayam" (BUKAN "cockfight"!)
- "tembak_ikan" (BUKAN "fish_shooting" atau "fish shooting"!)
- "togel" (BUKAN "lottery"!)
- "sportsbook", "slot", "casino", "arcade" (keep as-is)

⚠️ JANGAN PERNAH output English terms untuk game Indonesia!
Pattern:
- Source menyebut "SABUNG AYAM" → game_types: ["sabung_ayam"]
- Source menyebut "Tembak Ikan" → game_types: ["tembak_ikan"]
- Source menyebut "Togel" → game_types: ["togel"]

🔹 eligible_providers (CRITICAL - BATASAN ELIGIBILITY!)

Extract provider/platform names dari source text.

Pattern extraction:
- Source: "produk SABUNG AYAM (SV388 & WS168)"
  → game_types: ["sabung_ayam"]
  → eligible_providers: ["SV388", "WS168"]

- Source: "SLOT dari Pragmatic Play dan PG Soft"
  → game_types: ["slot"]
  → eligible_providers: ["Pragmatic Play", "PG Soft"]

- Source: "semua permainan SPORTSBOOK" (no specific provider mentioned)
  → game_types: ["sportsbook"]
  → eligible_providers: []

⚠️ Provider names adalah BATASAN ELIGIBILITY - jangan skip!
⚠️ Preserve original casing untuk provider names (SV388, bukan sv388)

🔹 Game Provider
Jika S&K menyebut:
- "Semua provider slot"
- "Berlaku untuk semua provider"
- "Seluruh provider"

➡️ WAJIB:
"game_providers": ["ALL"]
"confidence.game_providers": "explicit_from_terms"

❌ Jangan override dengan daftar provider visual.
❌ Jangan list provider satu-satu jika S&K bilang "semua"

🔹 Rollingan Promo (⚠️ CRITICAL FIELD MAPPING!)
Ciri-ciri rollingan:
- calculation_base = "turnover"
- payout_direction = "belakang"
- turnover_rule = "[angka]" JIKA ada syarat "Minimal turnover" (LANGSUNG ANGKA, TANPA PREFIX!)

⚠️⚠️⚠️ KHUSUS ROLLINGAN — MAPPING FIELD KRITIS:
- "Minimal turnover 1.000.000" → turnover_rule: "1000000" (BUKAN minimum_base!)
- "Min TO 500rb" → turnover_rule: "500000" (BUKAN minimum_base!)
- Rollingan biasanya TIDAK PUNYA min deposit! (minimum_base = null)
- minimum_base untuk Rollingan HANYA jika ada "Minimal DEPOSIT" explicit

JANGAN BINGUNG (ROLLINGAN):
- "Minimal deposit untuk ikut" → minimum_base ✅
- "Minimal turnover untuk ikut" → turnover_rule: "1000000" ✅ (BUKAN minimum_base!)
- "Syarat TO 1jt" → turnover_rule: "1000000" ✅ (LANGSUNG ANGKA!)

🔹 Welcome Bonus / Deposit Bonus
Ciri-ciri:
- calculation_base = "deposit"
- payout_direction = "depan" (diberikan sebelum main)
- turnover_rule = dari tabel/S&K (biasanya 5x-20x)

🔹 Mini Game (Spin, Lucky Draw) — PROMO TYPE DETECTION
KEYWORDS yang menunjukkan Mini Game:
- "spin", "lucky spin", "daily spin", "free spin" (bukan free spin bonus)
- "lucky draw", "gacha", "undian"
- "wheel", "roda keberuntungan"

JIKA terdeteksi keywords di atas:
- promo_type: "Mini Game" (Title Case)
❌ JANGAN set sebagai "Welcome Bonus" atau "Deposit Bonus"

🔹 Event / Level Up — PROMO TYPE DETECTION  
KEYWORDS yang menunjukkan Event/Level Up:
- "event", "level up", "kejar level", "naik level"
- "milestone", "achievement", "misi"
- "challenge", "tantangan"

JIKA terdeteksi keywords di atas:
- promo_type: "Event Level Up" (Title Case, tanpa underscore)
❌ JANGAN set sebagai "combo" atau "welcome_bonus"

🔹 UNLOCK CONDITION ≠ MIN DEPOSIT (LEVEL UP PROMO - KRITIKAL!)

⚠️⚠️⚠️ PERBEDAAN KRITIS UNTUK EVENT / LEVEL UP:
Unlock condition (syarat naik level) adalah PROGRESS GATE, BUKAN syarat finansial per klaim.

PATTERN UNLOCK CONDITION (JANGAN map ke min_deposit!):
- "History Deposit Rp 100.000" → UNLOCK CONDITION untuk naik tier
- "Telah mencapai level sebelumnya" → UNLOCK CONDITION  
- "Syarat naik level: total deposit X" → UNLOCK CONDITION
- "Tier Bronze ke Silver wajib X" → UNLOCK CONDITION
- "Total deposit Rp X untuk naik ke Level Y" → UNLOCK CONDITION
- "Akumulasi turnover X" → UNLOCK CONDITION

⚠️ JIKA promo adalah Event / Level Up DAN ada pola unlock condition di atas:
1. JANGAN masukkan ke minimum_base (min_deposit)!
2. JANGAN masukkan ke turnover_rule!
3. Masukkan ke terms_conditions[] sebagai catatan syarat
4. Set minimum_base = null, confidence.minimum_base = "not_applicable"
5. Set turnover_rule = null, confidence.turnover_rule = "not_applicable"

CONTOH PARSING:
Input: "KEJAR LEVEL UP DAPET UANG!
Level 1 → Rp 50.000
Level 2 → Rp 100.000  
Level 3 → Rp 200.000
Syarat: History deposit Rp 100.000 untuk setiap level"

OUTPUT BENAR:
{
  "promo_type": "Event Level Up",
  "subcategories": [
    { "sub_name": "Level 1", "max_bonus": 50000, "minimum_base": null, "turnover_rule": null, 
      "confidence": { "minimum_base": "not_applicable", "turnover_rule": "not_applicable" } },
    { "sub_name": "Level 2", "max_bonus": 100000, ... },
    { "sub_name": "Level 3", "max_bonus": 200000, ... }
  ],
  "terms_conditions": ["Syarat naik level: History deposit Rp 100.000 untuk setiap level"]
}

OUTPUT SALAH (❌ JANGAN!):
{
  "subcategories": [
    { "sub_name": "Level 1", "minimum_base": 100000 } ← SALAH! Ini unlock condition!
  ]
}

❌ ATURAN KERAS untuk Event / Level Up:
- minimum_base selalu null (tidak ada syarat deposit per klaim)
- turnover_rule selalu null (hadiah level langsung diberikan)
- "History deposit X" masuk ke terms_conditions, BUKAN minimum_base

🔹 Max Bonus vs Max Claim — PERBEDAAN KRITIS!

⚠️⚠️⚠️ WAJIB BEDAKAN:
- "Max Bonus" / "Maksimal Bonus" = JUMLAH RUPIAH maksimal yang bisa didapat
  → Masukkan ke field: max_bonus (angka dalam Rupiah)
  
- "Max Claim" / "Maksimal Claim" / "Maks Klaim" = FREKUENSI/JUMLAH KALI bisa claim
  → Masukkan ke field: claim_limit_per_day atau mention di terms_conditions
  → JANGAN masukkan ke max_bonus!

CONTOH PARSING:
Input: "Maksimal Claim 10 Tiket per hari"
Output BENAR: terms_conditions: ["Maksimal claim 10 tiket per hari"]
Output SALAH: max_bonus: 10 ❌ (INI BUKAN RUPIAH!)

Input: "Max Bonus Rp 500.000"
Output BENAR: max_bonus: 500000 ✅


🔹 REFERRAL BONUS MULTI-TIER (KRITIKAL!)

Pattern Referral dengan Tier berbasis Downline:
Referral promo SERING memiliki struktur tier berdasarkan JUMLAH DOWNLINE AKTIF.

CONTOH TABEL REFERRAL:
| DOWNLINE | WINLOSE | COMMISION | CASHBACK | FEE 20% | WINLOSE BERSIH | KOMISI |
| 5 ID     | 10.000.000 | 300.000 | 700.000 | -2.000.000 | 8.500.000 | 5%  |
| 10 ID    | 50.000.000 | ... | ... | ... | ... | 10% |
| 15 ID    | 100.000.000 | ... | ... | ... | ... | 15% |

ATURAN PARSING REFERRAL:
1. Jika ada tabel dengan kolom DOWNLINE + KOMISI (persentase berbeda per tier):
   - promo_mode = "multi"
   - SETIAP ROW = 1 subcategory
   
2. sub_name = "Komisi X%" atau "Tier X ID" (dari nilai persentase/downline)

3. calculation_value = nilai KOMISI (persentase) per tier
   - 5 ID → 5%
   - 10 ID → 10%
   - 15 ID → 15%

4. ⚠️ DATA TABEL PROMO (BUKAN RULE!) - Extract semua nilai dari tabel:
   - sample_winlose = nilai WINLOSE
   - sample_cashback = nilai CASHBACK
   - sample_commission_deduction = nilai COMMISION (potongan komisi)
   - sample_net_winlose = nilai WINLOSE BERSIH
   - sample_commission_result = nilai KOMISI Rp (hasil akhir)
   - referral_admin_fee_percentage = FEE % (dari header atau kolom, contoh: 20)
   - Ini FAKTA DI TABEL PROMO → WAJIB diekstrak SEMUA jika ada
   - TAPI BUKAN RULE/THRESHOLD!

5. minimum_base = null (TIDAK ADA threshold winlose eksplisit untuk referral)
   - Kolom WINLOSE di tabel = CONTOH SIMULASI, bukan syarat kualifikasi!
   - Threshold tier sebenarnya = min_downline (5, 10, 15 ID)

6. Tambahkan metadata tier di terms_conditions:
   - "Tier 5%: Minimal 5 ID aktif"
   - "Tier 10%: Minimal 10 ID aktif"
   - "Tabel angka (WINLOSE, FEE, dll) adalah contoh simulasi perhitungan"

OUTPUT FORMAT REFERRAL MULTI-TIER:
{
  "promo_name": "EXTRA CUAN! REFERRAL UP TO 15%",
  "promo_type": "Referral Bonus",
  "promo_mode": "multi",
  "has_subcategories": true,
  "expected_subcategory_count": 3,
  "subcategories": [
    {
      "sub_name": "Komisi 5%",
      "calculation_base": "loss",
      "calculation_method": "percentage",
      "calculation_value": 5,
      "minimum_base": null,
      "min_downline": 5,
      "sample_winlose": 10000000,
      "sample_cashback": 700000,
      "sample_commission_deduction": 300000,
      "sample_net_winlose": 8500000,
      "sample_commission_result": 425000,
      "max_bonus": null,
      "turnover_rule": null,
      "payout_direction": "belakang",
      "game_types": ["ALL"],
      "confidence": {
        "calculation_value": "explicit",
        "minimum_base": "not_applicable",
        "min_downline": "explicit",
        "sample_winlose": "explicit",
        "turnover_rule": "not_applicable"
      }
    },
    {
      "sub_name": "Komisi 10%",
      "calculation_base": "loss",
      "calculation_method": "percentage",
      "calculation_value": 10,
      "minimum_base": null,
      "min_downline": 10,
      "sample_winlose": 50000000,
      "sample_cashback": 3000000,
      "sample_commission_deduction": 1500000,
      "sample_net_winlose": 42500000,
      "sample_commission_result": 4250000,
      "confidence": {
        "calculation_value": "explicit",
        "minimum_base": "not_applicable",
        "min_downline": "explicit",
        "sample_winlose": "explicit"
      }
    },
    {
      "sub_name": "Komisi 15%",
      "calculation_base": "loss",
      "calculation_method": "percentage",
      "calculation_value": 15,
      "minimum_base": null,
      "min_downline": 15,
      "sample_winlose": 100000000,
      "sample_cashback": 7000000,
      "sample_commission_deduction": 3500000,
      "sample_net_winlose": 85000000,
      "sample_commission_result": 12750000,
      "confidence": {
        "calculation_value": "explicit",
        "minimum_base": "not_applicable",
        "min_downline": "explicit",
        "sample_winlose": "explicit"
      }
    }
  ],
  "terms_conditions": [
    "Tier 5%: Minimal 5 ID aktif",
    "Tier 10%: Minimal 10 ID aktif",
    "Tier 15%: Minimal 15 ID aktif",
    "Hitungan komisi: Winlose - Commision - Cashback - Admin Fee 20% = hasil x persentase",
    "Admin Fee: 20%",
    "Tabel angka (WINLOSE, CASHBACK, FEE) adalah contoh simulasi perhitungan, bukan syarat kualifikasi"
  ]
}

⚠️ ATURAN KERAS REFERRAL:
- JANGAN merge tier menjadi 1 varian!
- JANGAN skip tier apapun dari tabel!
- 3 baris dengan KOMISI berbeda = 3 subcategories!
- minimum_base = null (TIDAK ada threshold nominal eksplisit!)
- sample_winlose = nilai WINLOSE dari tabel (ini SAMPLE DATA, bukan rule!)
- Kolom WINLOSE/CASHBACK/FEE di tabel = SIMULASI PERHITUNGAN, bukan syarat!
- Threshold tier = min_downline SAJA (5, 10, 15 ID)
- turnover_rule = null (not_applicable untuk referral)
- payout_direction = "belakang" (komisi dihitung setelah downline bermain)
- calculation_base = "loss" (iGaming Asia: WINLOSE = kekalahan player = loss)

INDUSTRY DEFAULTS (isi jika tidak eksplisit disebut):
- calculation_base = "loss" (bukan "winloss" - itu bukan valid enum!)
- payout_direction = "belakang" (suggested)
- Admin Fee biasanya 20% → catat di terms_conditions


🚫 BLACKLIST EXTRACTION (PHASE 4 - GAME DIKECUALIKAN)

⚠️ PARSING KRITIS — PATTERN INDONESIA:
Contoh: "BONUS tidak di perbolehkan bermain di slot: HEROES, MONEY ROLL, GOLDEN BEAUTY"

PARSING BENAR:
- "di slot:" = HEADER/KATEGORI (bukan yang di-blacklist!)
- Setelah ":" = LIST GAMES yang di-blacklist
- Extract: games = ["HEROES", "MONEY ROLL", "GOLDEN BEAUTY"]

❌ SALAH: blacklist.games = ["slot"] 
✅ BENAR: blacklist.games = ["HEROES", "MONEY ROLL", "GOLDEN BEAUTY"]

PATTERN YANG HARUS DIPARSING:
1. "tidak di perbolehkan bermain di [kategori]: [GAME1], [GAME2]..."
   → [kategori] = header, [GAME1], [GAME2] = blacklisted games
   
2. "Kecuali: [GAME1], [GAME2]..."
   → Extract games setelah ":"
   
3. "Game yang tidak berlaku: [list]"
   → Extract list games
   
4. "Semua yang 3 Gambar / 3 Line / 1 Line" atau "Old game slot"
   → Ini adalah RULES, bukan nama game spesifik
   → Masukkan ke blacklist.rules[]

OUTPUT FORMAT:
"blacklist": {
  "enabled": true,
  "games": ["HEROES", "MONEY ROLL", "GOLDEN BEAUTY", "BRONCO SPIRIT", "SPACEMAN", "Master Chen's Fortune", "Prosperity Lion", "Card Games"],
  "providers": [],
  "rules": ["Semua yang 3 Gambar / 3 Line / 1 Line", "Old game slot"]
}

ATURAN PEMISAHAN:
- games[] = Nama game SPESIFIK (proper nouns, capitalized)
- providers[] = Nama provider jika disebut eksplisit dikecualikan
- rules[] = Aturan UMUM/KATEGORI (3 Line, Old game, RTP > 97%, etc.)

Jika TIDAK ADA pengecualian disebut:
"blacklist": {
  "enabled": false,
  "providers": [],
  "games": [],
  "rules": []
}

🧬 COMBO / MULTI VARIANT RULE
Jika tabel berisi >1 baris data promo:
- promo_mode = "multi"
- Setiap baris = 1 subcategory
- has_subcategories = true
- expected_subcategory_count = jumlah baris tabel

❌ Jangan digabung menjadi 1 varian
❌ Jangan disederhanakan
✅ 6 baris tabel = 6 subcategories

🧠 CONFIDENCE TAG — ATURAN ASSIGNMENT (PHASE 2 FIX - KRITIKAL!)

| Sumber Data            | Confidence Level      | Contoh                            |
|------------------------|-----------------------|-----------------------------------|
| Kolom/baris TABEL      | "explicit"            | Tabel: "Max Bonus: 1jt"           |
| Teks dalam S&K         | "explicit_from_terms" | S&K: "Maksimal bonus 1 juta"      |
| Inferensi dari konteks | "derived"             | Welcome → payout "depan" (umum)   |
| Tidak ada data         | "unknown"             | Field tidak disebut sama sekali   |
| Tidak relevan          | "not_applicable"      | Turnover untuk cashback           |
| Data tidak jelas       | "ambiguous"           | "Bonus besar" tanpa angka         |
| Field wajib kosong     | "missing"             | Kolom mandatory tidak ada         |

⚠️ KRITIS: 
- Data yang TERLIHAT di TABEL = "explicit", BUKAN "derived"
- Data yang TERLIHAT di S&K = "explicit_from_terms"
- "derived" HANYA untuk inferensi logis (BUKAN data tertulis)
- Jika tabel punya nilai, WAJIB extract dengan confidence "explicit"

🔹 TURNOVER RULE — CONTEXT AWARENESS (NOT_APPLICABLE)
Jika promo_type adalah salah satu dari:
- "Loyalty Point"
- "Rollingan Cashback"
- "Merchandise"
- "Referral Bonus"
- "Campaign Informational"
- "Event Level Up"

DAN turnover_rule tidak ditemukan di konten:

➡️ WAJIB:
"turnover_rule": null
"confidence.turnover_rule": "not_applicable"

❌ JANGAN set "missing" atau "unknown"
✅ Promo jenis ini memang TIDAK memiliki konsep turnover

📐 FORMAT ANGKA INDONESIA (KRITIS!)
- Indonesia menggunakan TITIK sebagai pemisah ribuan
- "25.000" = 25000 (dua puluh lima ribu), BUKAN 25
- "1.000.000" = 1000000 (satu juta)
- "50.000" = 50000 (lima puluh ribu)
- JANGAN PERNAH mengartikan titik sebagai desimal dalam konteks Rupiah
- Semua nilai monetary HARUS dalam format angka bulat tanpa titik

📱 DEPOSIT PULSA DETECTION (NEW - PHASE 6)

KEYWORDS yang menunjukkan Deposit Pulsa:
- "deposit pulsa", "pulsa tanpa potongan", "rate pulsa", "via pulsa", "depo pulsa"
- Nama operator: "TELKOMSEL", "XL", "AXIS", "INDOSAT", "TRI", "SMARTFREN"

JIKA terdeteksi deposit pulsa:
- promo_type: "Deposit Bonus" (subcategory: pulsa)
- deposit_method: "pulsa"
- deposit_method_providers: ["TELKOMSEL", "XL", ...] — HANYA operator yang disebutkan
- deposit_rate: 100 jika "tanpa potongan", atau (100 - potongan_persen) jika ada potongan

⚠️ KRITIS — OPERATOR BUKAN GAME PROVIDER:
- TELKOMSEL, XL, AXIS, INDOSAT, TRI, SMARTFREN = operator PULSA
- JANGAN masukkan ke game_providers[]
- Masukkan ke deposit_method_providers[]

CONTOH PARSING:
Input: "Deposit Pulsa TELKOMSEL & XL tanpa potongan"
Output:
{
  "promo_type": "Deposit Bonus",
  "deposit_method": "pulsa",
  "deposit_method_providers": ["TELKOMSEL", "XL"],
  "deposit_rate": 100
}

Input: "Deposit via pulsa potongan 10%"
Output:
{
  "deposit_method": "pulsa",
  "deposit_rate": 90
}

🎁 JENIS HADIAH DETECTION (CRITICAL untuk Event/Leaderboard!)

ATURAN UTAMA:
Untuk promo EVENT/TURNOVER/LEADERBOARD dengan tabel hadiah per tier,
kamu WAJIB mendeteksi jenis hadiah dari deskripsi kolom HADIAH.

PATTERN DETECTION:

1️⃣ HADIAH FISIK (reward_type: "hadiah_fisik"):
   Keyword: nama produk, merek kendaraan, elektronik, perhiasan
   Contoh:
   - "MITSUBISHI PAJERO SPORT DAKAR 2025" → hadiah_fisik
   - "EMAS ANTAM 150 Gram" → hadiah_fisik  
   - "IPHONE 17 PRO MAX" → hadiah_fisik
   - "Honda Vario 150 2025" → hadiah_fisik
   - "TOYOTA VELOZ", "YAMAHA XMAX", "PCX 160" → hadiah_fisik
   
   OUTPUT:
   "reward_type": "hadiah_fisik",
   "physical_reward_name": "[NAMA PRODUK PERSIS DARI SOURCE]"

2️⃣ UANG TUNAI (reward_type: "uang_tunai"):
   Keyword: "Uang Tunai", "Hadiah Uang Tunai sebesar Rp", "Cash", "Hadiah Uang"
   Contoh:
   - "Hadiah Uang Tunai sebesar Rp. 15.000.000,-" → uang_tunai
   - "Uang Tunai Rp 7.000.000" → uang_tunai
   - "Cash Prize 10 Juta" → uang_tunai
   
   OUTPUT:
   "reward_type": "uang_tunai",
   "cash_reward_amount": 15000000  // Angka tanpa titik

3️⃣ CREDIT GAME (default):
   Jika tidak cocok pattern 1 atau 2
   Contoh: "Bonus 2.500.000", "Freechip 500K", "Kredit 1jt"
   
   OUTPUT:
   "reward_type": "credit_game"

⚠️ PENTING untuk EVENT TURNOVER:
- calculation_method = "threshold" (BUKAN "percentage"!)
- calculation_value = angka threshold (750000000000 untuk "750 Miliar")
- max_bonus = nominal hadiah
- reward_type dan physical_reward_name TETAP WAJIB di-extract terpisah!

CONTOH Event Turnover:
| Target Turnover | Hadiah |
| 750 Miliar | MITSUBISHI PAJERO SPORT |
| 5 Miliar | Uang Tunai Rp 15.000.000 |

Parsing:
[
  {
    "sub_name": "Pencapaian TurnOver 750 Miliar",
    "calculation_base": "turnover",
    "calculation_method": "threshold",
    "calculation_value": 750000000000,
    "max_bonus": null,
    "reward_type": "hadiah_fisik",
    "physical_reward_name": "MITSUBISHI PAJERO SPORT"
  },
  {
    "sub_name": "Pencapaian TurnOver 5 Miliar", 
    "calculation_base": "turnover",
    "calculation_method": "threshold",
    "calculation_value": 5000000000,
    "max_bonus": 15000000,
    "reward_type": "uang_tunai",
    "cash_reward_amount": 15000000
  }
]

🧾 OUTPUT FORMAT (STRICT JSON)
Output HARUS:
- Valid JSON
- TANPA komentar
- TANPA teks tambahan
- Field lengkap walau null

Return HANYA JSON valid tanpa markdown code block.

FORMAT OUTPUT (PHASE 6 - UPDATED WITH DEPOSIT METHOD):
{
  "promo_name": "nama promo utama",
  "promo_type": "Welcome Bonus|Deposit Bonus|Rollingan Cashback|Referral Bonus|Event Level Up|Mini Game|Freechip|Loyalty Point|Merchandise|Campaign Informational",
  "target_user": "new_member|all|vip",
  "promo_mode": "single|multi",
  "valid_from": "YYYY-MM-DD atau null",
  "valid_until": "YYYY-MM-DD atau null",
  "claim_frequency": "mingguan|harian|bulanan|sekali",
  "calculation_period_start": "senin|selasa|...|minggu|null",
  "calculation_period_end": "senin|selasa|...|minggu|null",
  "distribution_day": "senin|selasa|...|minggu|null",
  "reward_distribution": "Langsung|hari_tertentu",
  "deposit_method": "bank|pulsa|ewallet|crypto|qris|all atau null",
  "deposit_method_providers": ["TELKOMSEL", "XL"] atau null,
  "deposit_rate": 100 atau null,
  "has_subcategories": true,
  "expected_subcategory_count": 6,
  "subcategories": [
    {
      "sub_name": "SLOT 100%",
      "calculation_base": "deposit",
      "calculation_method": "percentage|fixed|threshold",
      "calculation_value": 100,
      "minimum_base": 50000,
      "max_bonus": 1000000,
      "max_bonus_explicit": true,
      "min_claim": 1000,
      "turnover_rule": 8,
      "payout_direction": "depan",
      "game_types": ["slot"],
      "eligible_providers": ["Pragmatic Play", "PG Soft"],
      "game_providers": ["ALL"],
      "game_names": [],
      "blacklist": {
        "enabled": true,
        "providers": [],
        "games": ["Super Mega Win", "Old Slot 3 Line"],
        "rules": ["Game dengan RTP > 97% tidak berlaku"]
      },
      "reward_type": "hadiah_fisik|uang_tunai|credit_game",
      "physical_reward_name": "MITSUBISHI PAJERO SPORT 2025|null",
      "cash_reward_amount": 15000000,
      "confidence": {
        "calculation_value": "explicit",
        "minimum_base": "explicit",
        "max_bonus": "explicit",
        "min_claim": "explicit",
        "turnover_rule": "explicit",
        "payout_direction": "explicit",
        "game_types": "derived",
        "game_providers": "explicit_from_terms",
        "reward_type": "explicit|derived"
      }
    }
  ],
  "global_blacklist": {
    "enabled": false,
    "is_explicit": false,
    "providers": [],
    "games": [],
    "rules": []
  },
  "terms_conditions": ["syarat dari S&K"],
  "claim_method": "cara klaim",
  "ready_to_commit": false,
  "validation": {
    "is_valid": true,
    "errors": [],
    "warnings": []
  }
}

JIKA PROMO SINGLE (tidak ada tabel multi-varian):
- promo_mode: "single"
- has_subcategories: true (tetap, dengan 1 sub)
- expected_subcategory_count: 1
- subcategories: [satu object dengan semua field]

🛑 FINAL CHECK SEBELUM SUBMIT (WAJIB):
1) Hitung kira-kira jumlah DATA ROWS dari semua tabel (bukan header).
2) Pastikan jumlah item di subcategories MENCERMINKAN jumlah data rows yang kamu extract.
3) Jika dokumen punya 2 tabel, kamu WAJIB gabungkan hasil keduanya.

Jika jumlah subcategories terlihat kurang dari jumlah rows yang ada di tabel → KAMU BELUM SELESAI. Jangan submit.

Catatan khusus Loyalty Point 2 tabel:
- Tabel "Paket Penukaran": biasanya 4 rows
- Tabel "Hadiah Utama": biasanya 7 rows
- TOTAL WAJIB: 11 subcategories (jika memang ada 11 rows di dokumen)

Return HANYA JSON valid tanpa markdown code block.`;

// ============= IMAGE EXTRACTION WITH VISION (GPT-4o) =============

/**
 * Force confidence downgrade for image extraction
 * CRITICAL: All numeric fields from image extraction = "derived"
 */
function forceConfidenceDowngradeForImage(promo: ExtractedPromo): ExtractedPromo {
  // Mark source as image
  promo._extraction_source = 'image';
  
  // Downgrade all numeric field confidences
  if (promo.subcategories) {
    promo.subcategories = promo.subcategories.map(sub => {
      const updatedConfidence = { ...sub.confidence };
      
      // Force numeric fields to "derived" max (not "explicit")
      if (updatedConfidence.minimum_base === 'explicit') {
        updatedConfidence.minimum_base = 'derived';
      }
      if (updatedConfidence.max_bonus === 'explicit') {
        updatedConfidence.max_bonus = 'derived';
      }
      if (updatedConfidence.turnover_rule === 'explicit') {
        updatedConfidence.turnover_rule = 'derived';
      }
      if (updatedConfidence.calculation_value === 'explicit') {
        updatedConfidence.calculation_value = 'derived';
      }
      
      return { ...sub, confidence: updatedConfidence };
    });
  }
  
  return promo;
}

/**
 * Extract promo from image using GPT-4o Vision
 * 
 * CRITICAL: 
 * - Uses gpt-4o (NOT gpt-4o-mini) for vision capability
 * - All numeric confidence downgraded to "derived"
 */
export async function extractPromoFromImage(base64Image: string): Promise<ExtractedPromo> {
  if (!base64Image) {
    throw new Error("Image data tidak boleh kosong");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${getOpenAIKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o", // WAJIB gpt-4o untuk vision capability
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${EXTRACTION_PROMPT}

⚠️ INSTRUKSI KHUSUS UNTUK IMAGE EXTRACTION:
Karena ini dari screenshot/image, SEMUA field numerik WAJIB menggunakan:
- confidence: "derived" (BUKAN "explicit")

Alasan: OCR dari image bisa salah baca. User akan verify via edit command jika perlu.

Kecuali jika:
- Angka sangat besar dan jelas terbaca
- Format tabel sangat clean dan high-resolution

Jika ragu, gunakan "derived" atau "unknown".

Ekstrak informasi promo dari screenshot berikut. Perhatikan tabel, angka, dan syarat & ketentuan yang terlihat.`
            },
            {
              type: "image_url",
              image_url: {
                url: base64Image,
                detail: "high" // High detail untuk baca tabel/angka kecil
              }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API Error: ${response.status}`);
  }

  const data = await response.json();
  const resultText = data.choices?.[0]?.message?.content || "";

  // Parse JSON dari response
  try {
    let cleanJson = resultText.trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
    }
    
    const parsed = JSON.parse(cleanJson) as ExtractedPromo;
    parsed.raw_content = "[Image extraction]";
    parsed.ready_to_commit = false;
    
    // Auto-extract client_id if not provided by AI (ISOLATED try/catch)
    // HOTFIX: Don't fail entire extraction if client_id extraction fails
    if (!parsed.client_id && parsed.terms_conditions?.length) {
      try {
        const termsText = parsed.terms_conditions.join(' ');
        const { client_id, confidence } = extractClientId(termsText);
        if (client_id) {
          parsed.client_id = client_id;
          parsed.client_id_confidence = confidence;
        }
      } catch (clientIdError) {
        // Non-fatal: client_id extraction failed but don't fail the entire extraction
        console.warn('[extractPromoFromImage] Client ID extraction failed:', clientIdError);
        // Continue without client_id - user can add manually
      }
    }
    
    // Ensure defaults
    if (!parsed.global_blacklist) {
      parsed.global_blacklist = { enabled: false, is_explicit: false, types: [], providers: [], games: [], rules: [] };
    }
    if (!parsed.subcategories) {
      parsed.subcategories = [];
    }
    if (!parsed.terms_conditions) {
      parsed.terms_conditions = [];
    }
    if (parsed.expected_subcategory_count === undefined) {
      parsed.expected_subcategory_count = parsed.subcategories.length;
    }
    
    // Ensure each subcategory has blacklist and confidence
    parsed.subcategories = parsed.subcategories.map(sub => ({
      ...sub,
      blacklist: sub.blacklist || { enabled: false, types: [], providers: [], games: [], rules: [] },
      confidence: sub.confidence || {
        calculation_value: 'derived',
        minimum_base: 'derived',
        max_bonus: 'derived',
        turnover_rule: 'derived',
        payout_direction: 'derived',
        game_types: 'derived',
        game_providers: 'derived'
      }
    }));
    
    // ============================================
    // IMAGE EXTRACTION: RUN CLASSIFIER + KEYWORD OVERRIDE
    // Same logic as extractPromoFromContent for consistency
    // ============================================
    
    // Step 1: Try LLM Classification (using promo details as proxy content)
    let classificationResult: ClassificationResult | null = null;
    const proxyContent = [
      parsed.promo_name || '',
      parsed.promo_type || '',
      ...(parsed.terms_conditions || [])
    ].join('\n');

    if (proxyContent.length > 50) {
      try {
        console.log('[extractPromoFromImage] Running LLM Classification...');
        classificationResult = await classifyContent(proxyContent);
        console.log('[extractPromoFromImage] Classification result:', {
          category: classificationResult.category,
          confidence: classificationResult.confidence
        });
      } catch (classifyError) {
        console.warn('[extractPromoFromImage] Classification failed, using keyword-only:', classifyError);
      }
    }

    // Step 2: Apply keyword override (ALWAYS - even if classification failed)
    const baseCategory = classificationResult?.category || 'A'; // Default A if no classification
    const { category: finalCategory, wasOverridden, overrideReason } = applyKeywordOverrides(
      baseCategory,
      parsed.promo_name || '',
      parsed.promo_type
    );

    // Step 3: Merge classification metadata
    parsed.program_classification = finalCategory;
    parsed.program_classification_name = getCategoryName(finalCategory);
    
    // CRITICAL: If keyword override applied, force HIGH confidence
    // Keyword rules are deterministic and authoritative for Referral, Rollingan, etc.
    if (wasOverridden) {
      parsed.classification_confidence = 'high';
      parsed.quality_flags = ['valid']; // Clear LLM quality flags
      console.log('[extractPromoFromImage] Keyword override applied → forcing HIGH confidence');
    } else {
      parsed.classification_confidence = classificationResult?.confidence || 'medium';
      parsed.quality_flags = classificationResult?.quality_flags || [];
    }
    
    parsed.classification_q1 = classificationResult?.q1;
    parsed.classification_q2 = classificationResult?.q2;
    parsed.classification_q3 = classificationResult?.q3;
    parsed.classification_q4 = classificationResult?.q4;

    // Track override metadata (extend existing meta or create with defaults)
    if (wasOverridden) {
      const existingMeta = parsed._extraction_meta || {
        has_rowspan_tables: false,
        html_was_normalized: false,
        client_id_source: null,
        propagated_fields: [],
        ambiguous_blacklists: 0,
        extracted_at: new Date().toISOString(),
      };
      parsed._extraction_meta = {
        ...existingMeta,
        classification_overridden: true,
        classification_override_reason: overrideReason,
        original_llm_category: baseCategory,
      };
    }

    console.log('[extractPromoFromImage] Final classification:', {
      category: finalCategory,
      wasOverridden,
      overrideReason: overrideReason || 'none'
    });

    // CRITICAL: Force confidence downgrade for image source
    const downgraded = forceConfidenceDowngradeForImage(parsed);
    
    // Run validation
    const validationResult = validateExtractedPromo(downgraded);
    downgraded.validation = {
      is_structurally_complete: validationResult.is_structurally_complete,
      status: validationResult.status,
      warnings: validationResult.warnings
    };
    
    return downgraded;
  } catch (parseError) {
    console.error("Failed to parse OpenAI Vision response:", resultText);
    throw new Error("Gagal parsing hasil ekstraksi dari image. Response bukan JSON valid.");
  }
}

function countApproxTableDataRows(html: string): { tableCount: number; trCount: number; estimatedDataRows: number } {
  const tableCount = (html.match(/<table\b/gi) || []).length;
  const trCount = (html.match(/<tr\b[^>]*>/gi) || []).length;

  // Heuristic: assume ~1 header row per table
  const estimatedDataRows = Math.max(0, trCount - tableCount);
  return { tableCount, trCount, estimatedDataRows };
}

export async function extractPromoFromContent(content: string, sourceUrl?: string): Promise<ExtractedPromo> {
  if (!content.trim()) {
    throw new Error("Konten tidak boleh kosong");
  }

  // ============================================
  // STEP 0: PRE-PROCESS - Normalize HTML tables
  // This MUST happen BEFORE AI extraction
  // ============================================
  let normalizedContent = content;
  let hadRowspan = false;

  if (needsNormalization(content)) {
    hadRowspan = hasRowspanTables(content);
    normalizedContent = normalizeHtmlTables(content);
    console.log('[Extractor] Pre-processed HTML: rowspan/colspan tables normalized');
  }

  // ============================================
  // STEP 0.25: PRE-COUNT TABLE ROWS (ANTI LAZY COMPLETION)
  // ============================================
  const rowCount = countApproxTableDataRows(normalizedContent);
  console.log('[Extractor] Table row estimate:', rowCount);

  const extractionPromptWithCount = `${EXTRACTION_PROMPT}\n\n⚠️ DOKUMEN INI TERDETEKSI MEMILIKI ~${rowCount.estimatedDataRows} DATA ROWS (perkiraan dari HTML).\nWAJIB: subcategories harus mencakup SEMUA rows yang relevan dari SEMUA tabel (jangan berhenti di tengah tabel).`;

  // ============================================
  // STEP 0.5: RUN LLM CLASSIFIER (CONTRACT OF TRUTH)
  // LLM answers Q1-Q4, category calculated in CODE
  // ============================================
  let classificationResult: ClassificationResult | null = null;
  try {
    console.log('[Extractor] Starting LLM Classification...');
    classificationResult = await classifyContent(normalizedContent);
    console.log('[Extractor] Classification complete:', {
      category: classificationResult.category,
      name: classificationResult.category_name,
      confidence: classificationResult.confidence,
      quality_flags: classificationResult.quality_flags,
    });
  } catch (classifyError) {
    console.warn('[Extractor] Classification failed, falling back to legacy extraction:', classifyError);
    // Non-fatal: continue with legacy extraction without classification
  }

  // ============================================
  // STEP 1: AI Extraction - NOW RECEIVES CLEAN HTML
  // AI will see tables with ALL cells filled (no "-" for rowspan)
  // ============================================
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${getOpenAIKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: extractionPromptWithCount },
        { role: "user", content: `Ekstrak informasi promo dari konten berikut:\n\n${normalizedContent}` }
      ],
      temperature: 0.1,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API Error: ${response.status}`);
  }

  const data = await response.json();
  const resultText = data.choices?.[0]?.message?.content || "";

  // Parse JSON dari response
  try {
    let cleanJson = resultText.trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
    }
    
    const parsed = JSON.parse(cleanJson) as ExtractedPromo;
    parsed.raw_content = content.substring(0, 1000);
    parsed.source_url = sourceUrl;
    parsed.ready_to_commit = false;
    
    // Auto-extract client_id if not provided by AI (ISOLATED try/catch)
    // HOTFIX: Don't fail entire extraction if client_id extraction fails
    if (!parsed.client_id) {
      try {
        const { client_id, confidence } = extractClientId(content);
        if (client_id) {
          parsed.client_id = client_id;
          parsed.client_id_confidence = confidence;
          console.log(`[extractPromoFromContent] Auto-detected client_id: ${client_id} (${confidence})`);
        }
      } catch (clientIdError) {
        // Non-fatal: client_id extraction failed but don't fail the entire extraction
        console.warn('[extractPromoFromContent] Client ID extraction failed:', clientIdError);
        // Continue without client_id - user can add manually
      }
    }
    
    // Ensure defaults
    if (!parsed.global_blacklist) {
      parsed.global_blacklist = { enabled: false, is_explicit: false, types: [], providers: [], games: [], rules: [] };
    }
    if (!parsed.subcategories) {
      parsed.subcategories = [];
    }
    if (!parsed.terms_conditions) {
      parsed.terms_conditions = [];
    }
    if (parsed.expected_subcategory_count === undefined) {
      parsed.expected_subcategory_count = parsed.subcategories.length;
    }
    
    // Phase 3: Debug logging - raw AI extraction response
    console.log("=== RAW AI EXTRACTION RESPONSE ===");
    console.log("Subcategories count:", parsed.subcategories?.length || 0);
    parsed.subcategories?.forEach((sub: any, idx: number) => {
      console.log(`Varian ${idx + 1} (${sub.sub_name}):`, {
        minimum_base: sub.minimum_base,
        max_bonus: sub.max_bonus,
        are_they_equal: sub.minimum_base != null && sub.max_bonus != null && sub.minimum_base === sub.max_bonus ? "⚠️ SAME VALUE - LIKELY ERROR" : "✅ Different"
      });
    });
    
    // Phase 4: Post-processing - auto-fix obvious extraction errors
    // Fix 1: If minimum_base === max_bonus, it's 99% a parsing error (AI copied wrong field)
    parsed.subcategories = parsed.subcategories?.map((sub: any) => {
      if (sub.minimum_base != null && sub.max_bonus != null && sub.minimum_base === sub.max_bonus) {
        console.warn(`⚠️ AUTO-FIX Varian "${sub.sub_name}": minimum_base (${sub.minimum_base}) === max_bonus — setting minimum_base to null`);
        return {
          ...sub,
          minimum_base: null,
          confidence: {
            ...sub.confidence,
            minimum_base: "unknown" as ConfidenceLevel
          }
        };
      }
      return sub;
    }) || [];
    
    // ============================================
    // HELPER: Strip HTML tags for pattern matching
    // rawText harus plain text agar regex bisa match
    // ============================================
    const stripHtmlTags = (html: string): string => {
      return html
        .replace(/<[^>]*>/g, ' ')      // Replace HTML tags with space
        .replace(/&nbsp;/gi, ' ')       // Replace &nbsp; entities
        .replace(/&amp;/gi, '&')        // Replace &amp; entities
        .replace(/&lt;/gi, '<')         // Replace &lt; entities
        .replace(/&gt;/gi, '>')         // Replace &gt; entities
        .replace(/&quot;/gi, '"')       // Replace &quot; entities
        .replace(/\s+/g, ' ')           // Collapse multiple spaces
        .trim();
    };

    const rawText = stripHtmlTags(content || '').toLowerCase();
    
    // ============================================
    // FIX 2: SMART MISMAP DETECTION (Epistemic Authority Contract)
    // Detect "minimal kekalahan" mapped to max_bonus instead of minimum_base
    // ============================================
    const hasMinLossKeyword = /minimal\s*(kekalahan|loss|kalah)|min\s*(loss|kalah|wl)/i.test(rawText);
    const hasMaxBonusKeyword = /maks(imal|imum)?\s*bonus|max\s*bonus|bonus\s*maks/i.test(rawText);
    const isCashbackPromo = /cashback|rebate/i.test(parsed.promo_name || '') || /cashback|rebate/i.test(parsed.promo_type || '');
    
    parsed.subcategories = parsed.subcategories?.map((sub: any) => {
      // Pattern: Source has "minimal kekalahan" but NOT "maksimal bonus"
      // AND max_bonus is filled but minimum_base is empty/null
      // → This is a MISMAP! "Minimal kekalahan" was wrongly assigned to max_bonus
      const isMismap = 
        hasMinLossKeyword && 
        !hasMaxBonusKeyword && 
        sub.max_bonus !== null && 
        sub.max_bonus > 0 &&
        (sub.minimum_base === null || sub.minimum_base === undefined || sub.minimum_base === 0);
      
      if (isMismap) {
        console.warn(`⚠️ MISMAP DETECTED "${sub.sub_name}": "minimal kekalahan" wrongly mapped to max_bonus=${sub.max_bonus}. Swapping to minimum_base...`);
        return {
          ...sub,
          minimum_base: sub.max_bonus,          // Move to correct field
          max_bonus: null,                       // Clear incorrect field
          max_bonus_explicit: false,             // Mark as NOT explicit (no cap)
          confidence: {
            ...sub.confidence,
            minimum_base: sub.confidence?.max_bonus || 'derived',
            max_bonus: 'unknown'                 // No max bonus declared
          }
        };
      }
      return sub;
    }) || [];
    
    // ============================================
    // FIX 3: Force calculation_base = 'winloss' for cashback promos
    // ============================================
    if (isCashbackPromo && hasMinLossKeyword) {
      console.log('[Extractor] Cashback + "kekalahan" detected → forcing calculation_base = "winloss"');
      parsed.subcategories = parsed.subcategories?.map((sub: any) => {
        if (!sub.calculation_base || sub.calculation_base === 'turnover' || sub.calculation_base === 'deposit') {
          return {
            ...sub,
            calculation_base: 'winloss'
          };
        }
        return sub;
      }) || [];
    }
    
    // ============================================
    // FIX 3B: Force calculation_base = 'turnover' for ROLLINGAN promos
    // ROLLINGAN is ALWAYS turnover-based (total betting volume, NOT win/loss)
    // This overrides LLM confusion between "Win/Loss" and "Turnover"
    // ============================================
    const isRollinganPromo = /rollingan|roll(ing)?an/i.test(parsed.promo_name || '') || 
                             /rollingan/i.test(parsed.promo_type || '');

    if (isRollinganPromo) {
      console.log('[Extractor] ROLLINGAN detected → forcing calculation_base = "turnover"');
      parsed.subcategories = parsed.subcategories?.map((sub: any) => {
        let updatedSub = { ...sub };
        
        // Fix calculation_base
        if (sub.calculation_base !== 'turnover') {
          console.log(`[Extractor] Fixing ${sub.sub_name}: ${sub.calculation_base} → turnover`);
          updatedSub.calculation_base = 'turnover';
          updatedSub.confidence = {
            ...updatedSub.confidence,
            calculation_base: 'derived'
          };
        }
        
        // ⚠️ FIX ROLLINGAN FIELD CONFUSION: minimum_base filled but turnover_rule empty
        // "Minimal turnover X" was likely misassigned to minimum_base
        const hasMinTurnoverPattern = /minimal\s+turnover|min\s*to\b|syarat\s+to\b/i.test(rawText);
        const hasMinDepositPattern = /minimal\s+deposit|min\s+deposit|min\s*dp\b/i.test(rawText);
        
        if (hasMinTurnoverPattern && !hasMinDepositPattern && 
            sub.minimum_base !== null && sub.minimum_base > 0 && 
            (!sub.turnover_rule || sub.turnover_rule === null)) {
          console.warn(`⚠️ ROLLINGAN MISMAP DETECTED "${sub.sub_name}": minimum_base=${sub.minimum_base} but turnover_rule empty. Swapping...`);
          // Langsung angka, tanpa prefix "min"
          updatedSub.turnover_rule = String(sub.minimum_base).replace(/x$/i, '');
          updatedSub.minimum_base = null;
          updatedSub.confidence = {
            ...updatedSub.confidence,
            minimum_base: 'not_applicable',
            turnover_rule: 'derived'
          };
        }
        
        // Sanitize turnover_rule: hapus "x" dan "min " prefix jika ada
        if (updatedSub.turnover_rule && typeof updatedSub.turnover_rule === 'string') {
          updatedSub.turnover_rule = updatedSub.turnover_rule
            .replace(/^min\s+/i, '')  // Hapus "min " prefix
            .replace(/x$/i, '');       // Hapus trailing "x"
        }
        
        // Set turnover_rule_format based on calculation_base (single source of truth)
        // Rollingan/Cashback uses turnover as base → min_rupiah format
        // Deposit bonus uses deposit as base → multiplier format
        updatedSub.turnover_rule_format = updatedSub.calculation_base === 'turnover' 
          ? 'min_rupiah' 
          : 'multiplier';
        
        return updatedSub;
      }) || [];
    }
    
    // ============================================
    // FIX 3C: REFERRAL MULTI-TIER DETECTION
    // Referral promos with different commission rates per downline tier
    // Each tier should be a separate subcategory
    // ============================================
    const isReferralPromo = /referral|ref\s*bonus|ajak\s*teman|undang|invite|rekrut/i.test(parsed.promo_name || '') || 
                            /referral/i.test(parsed.promo_type || '');

    if (isReferralPromo) {
      console.log('[Extractor] REFERRAL promo detected → checking multi-tier structure');
      
      // Check if there are multiple percentage values in the content (indicates multi-tier)
      const commissionMatches = rawText.match(/(\d+)\s*%/g);
      const uniqueCommissions = commissionMatches 
        ? [...new Set(commissionMatches.map(m => parseInt(m)))].filter(v => v > 0 && v <= 100)
        : [];
      
      console.log('[Extractor] Found commission percentages:', uniqueCommissions);
      
      // Check for downline tier patterns
      const hasDownlineTiers = /(\d+)\s*(id|member|downline)/i.test(rawText);
      
      // If we have multiple unique commissions and downline tiers but only 1 subcategory
      if (uniqueCommissions.length > 1 && hasDownlineTiers && parsed.subcategories?.length === 1) {
        console.log('[Extractor] Multi-tier referral detected but only 1 subcategory → expanding tiers');
        
        // Extract tier data from raw text
        const tierPattern = /(\d+)\s*(id|member|downline)[^%]*?(\d+)\s*%/gi;
        const tiers: Array<{ downline: number; commission: number }> = [];
        let match;
        
        while ((match = tierPattern.exec(rawText)) !== null) {
          tiers.push({
            downline: parseInt(match[1]),
            commission: parseInt(match[3])
          });
        }
        
        // Also try reverse pattern: commission first, then downline
        const reverseTierPattern = /(\d+)\s*%[^ID]*?(\d+)\s*(id|member|downline)/gi;
        while ((match = reverseTierPattern.exec(rawText)) !== null) {
          const tier = {
            downline: parseInt(match[2]),
            commission: parseInt(match[1])
          };
          // Only add if not already present
          if (!tiers.some(t => t.downline === tier.downline && t.commission === tier.commission)) {
            tiers.push(tier);
          }
        }
        
        // Sort by commission/downline
        tiers.sort((a, b) => a.commission - b.commission);
        
        if (tiers.length > 1) {
          console.log('[Extractor] Extracted referral tiers:', tiers);
          
          const baseSub = parsed.subcategories[0];
          parsed.subcategories = tiers.map(tier => ({
            ...baseSub,
            sub_name: `Komisi ${tier.commission}%`,
            calculation_base: 'win_loss' as const,  // Use correct type
            calculation_method: 'percentage' as const,
            calculation_value: tier.commission,
            minimum_base: null,
            turnover_rule: null,
            payout_direction: 'belakang' as const,
            confidence: {
              ...baseSub.confidence,
              calculation_value: 'derived' as ConfidenceLevel,
              minimum_base: 'not_applicable' as ConfidenceLevel,
              turnover_rule: 'not_applicable' as ConfidenceLevel
            }
          }));
          
          parsed.promo_mode = 'multi';
          parsed.has_subcategories = true;
          parsed.expected_subcategory_count = tiers.length;
          
          // Add tier requirements to terms_conditions
          const tierTerms = tiers.map(t => `Tier ${t.commission}%: Minimal ${t.downline} ID aktif`);
          parsed.terms_conditions = [
            ...(parsed.terms_conditions || []),
            ...tierTerms
          ];
        }
      }
      
      // Force correct field values for all referral subcategories
      parsed.subcategories = parsed.subcategories?.map((sub: any) => ({
        ...sub,
        calculation_base: sub.calculation_base || 'win_loss',
        payout_direction: 'belakang',
        minimum_base: null,
        turnover_rule: null,
        confidence: {
          ...sub.confidence,
          minimum_base: 'not_applicable',
          turnover_rule: 'not_applicable'
        }
      })) || [];
    }
    
    // ============================================
    // FIX 4A: PAYOUT THRESHOLD MISMAP DETECTION (SUBCATEGORY MODE)
    // Detect "minimal bonus yang bisa dicairkan" wrongly mapped to minimum_base
    // Should be: min_claim (payout threshold)
    // ============================================
    const payoutPatterns = [
      /minimal\s+bonus\s+(yang\s+)?bisa\s+dicairkan/i,
      /min(imal)?\s+claim/i,
      /min(imal)?\s+klaim/i,
      /bonus\s*<\s*Rp?\s*[\d.,]+\s+tidak\s+(dapat|bisa)\s+dicairkan/i,
      /minimal\s+pencairan/i,
      /minimal\s+bonus\s+cair/i,
      /bonus\s+(minimal|minimum)\s+yang\s+(dapat|bisa)\s+di(cairkan|klaim)/i,
    ];

    const eligibilityPatterns = [
      /minimal\s+(kekalahan|loss|turnover|deposit|to)\s+(untuk\s+)?(ikut|join|dapat|kualifikasi)/i,
      /minimal\s+(win.?loss|wl)\s+(untuk\s+)?(ikut|join|dapat|kualifikasi)/i,
      /syarat\s+minimal\s+(kekalahan|turnover|deposit)/i,
      /min(imum)?\s+(kekalahan|loss|deposit)\s+Rp/i,
    ];

    const hasPayoutPattern = payoutPatterns.some(p => p.test(rawText));
    const hasEligibilityPattern = eligibilityPatterns.some(p => p.test(rawText));

    // FIX 4A: Subcategory mode mismap detection
    parsed.subcategories = parsed.subcategories?.map((sub: any) => {
      const isPotentialMismap = 
        hasPayoutPattern && 
        !hasEligibilityPattern && 
        (sub.minimum_base !== null && sub.minimum_base > 0) &&
        (sub.min_claim === null || sub.min_claim === undefined || sub.min_claim === 0);
      
      if (isPotentialMismap) {
        console.warn(`⚠️ PAYOUT MISMAP (SUBCAT) "${sub.sub_name}": Moving minimum_base=${sub.minimum_base} to min_claim`);
        return {
          ...sub,
          min_claim: sub.minimum_base,
          minimum_base: null,
          confidence: {
            ...sub.confidence,
            min_claim: sub.confidence?.minimum_base || 'explicit',
            minimum_base: 'unknown'
          }
        };
      }
      return sub;
    }) || [];

    // ============================================
    // FIX 4B: PAYOUT THRESHOLD MISMAP DETECTION (SINGLE PROMO MODE)
    // For single-variant promos, check subcategories[0] (the only variant)
    // This supplements FIX 4A which already handles all subcategories
    // ============================================
    if (!parsed.has_subcategories && parsed.subcategories?.length === 1) {
      const singleSub = parsed.subcategories[0];
      const isPotentialMismap = 
        hasPayoutPattern && 
        !hasEligibilityPattern && 
        (singleSub.minimum_base !== null && singleSub.minimum_base > 0) &&
        (singleSub.min_claim === null || singleSub.min_claim === undefined || singleSub.min_claim === 0);
      
      if (isPotentialMismap) {
        console.warn(`⚠️ PAYOUT MISMAP (SINGLE MODE): Moving minimum_base=${singleSub.minimum_base} to min_claim`);
        parsed.subcategories[0] = {
          ...singleSub,
          min_claim: singleSub.minimum_base,
          minimum_base: 0,  // Use 0 instead of null for type safety
          confidence: {
            ...singleSub.confidence,
            min_claim: singleSub.confidence?.minimum_base || 'explicit',
            minimum_base: 'unknown'
          }
        };
      }
    }
    
    // ============================================
    // FIX 5: EVENT MIN_DEPOSIT MAPPING (Category B)
    // Event promos have min_deposit at parent level, map to minimum_base
    // ============================================
    if (parsed.program_classification === 'B' || /lucky.*spin|tournament|undian|leaderboard|spin.*wheel/i.test(parsed.promo_name || '')) {
      if (parsed.min_deposit && parsed.min_deposit > 0) {
        console.log(`[Extractor] Event min_deposit detected: ${parsed.min_deposit} → mapping to minimum_base`);
        
        // If single-variant or no subcategories, create one with min_deposit
        if (!parsed.subcategories || parsed.subcategories.length === 0) {
          parsed.subcategories = [{
            sub_name: parsed.promo_name || 'Default',
            calculation_base: 'deposit',
            calculation_method: 'fixed',
            calculation_value: 0,
            minimum_base: parsed.min_deposit,
            max_bonus: null,
            turnover_rule: null,
            payout_direction: 'depan',
            game_types: [],
            game_providers: [],
            game_names: [],
            eligible_providers: [],
            blacklist: { enabled: false, types: [], providers: [], games: [], rules: [] },
            confidence: {
              calculation_value: 'unknown',
              minimum_base: 'explicit',
              max_bonus: 'unknown',
              turnover_rule: 'unknown',
              payout_direction: 'unknown',
              game_types: 'unknown',
              game_providers: 'unknown'
            }
          }];
        } else {
          // Propagate min_deposit to all subcategories that don't have minimum_base
          parsed.subcategories = parsed.subcategories.map(sub => ({
            ...sub,
            minimum_base: sub.minimum_base || parsed.min_deposit,
            confidence: {
              ...sub.confidence,
              minimum_base: sub.minimum_base ? sub.confidence?.minimum_base : 'derived'
            }
          }));
        }
      }
    }

    // ============================================
    // FIX 6: ENFORCE REWARD_TYPE BY PROMO_TYPE (POST-EXTRACTION)
    // Cashback/Rebate/Rollingan MUST be credit_game
    // This is the FINAL override before validation
    // ============================================
    const FORCE_CREDIT_GAME_PROMO_TYPES = ['cashback', 'rebate', 'rollingan', 'turnover_bonus'];
    const normalizedPromoType = (parsed.promo_type || '').toLowerCase().replace(/[-_\s]/g, '');
    const isForceCreditGamePromo = FORCE_CREDIT_GAME_PROMO_TYPES.some(t => 
      normalizedPromoType.includes(t.replace(/[-_\s]/g, ''))
    );
    
    if (isForceCreditGamePromo) {
      console.log(`[Extractor] FORCE reward_type: ${parsed.promo_type} → credit_game for all subcategories`);
      
      // Check for explicit cash withdrawal patterns (ONLY exception)
      const hasCashWithdrawal = /tarik\s+tunai\s+langsung|withdraw\s+langsung|transfer\s+bank\s+langsung|wd\s+langsung/i.test(rawText);
      
      if (!hasCashWithdrawal) {
        // Override all subcategories to credit_game
        parsed.subcategories = parsed.subcategories?.map((sub: any) => {
          if (sub.reward_type !== 'credit_game') {
            console.log(`[Extractor] Override ${sub.sub_name}: ${sub.reward_type || 'undefined'} → credit_game`);
          }
          return {
            ...sub,
            reward_type: 'credit_game',
          };
        }) || [];
        
        // Also set at root level if exists
        if ((parsed as any).reward_type && (parsed as any).reward_type !== 'credit_game') {
          console.log(`[Extractor] Override root reward_type: ${(parsed as any).reward_type} → credit_game`);
          (parsed as any).reward_type = 'credit_game';
        }
      } else {
        console.log(`[Extractor] ${parsed.promo_type} has explicit cash withdrawal → keeping uang_tunai`);
      }
    }

    // Ensure each subcategory has blacklist and confidence
    parsed.subcategories = parsed.subcategories.map(sub => ({
      ...sub,
      blacklist: sub.blacklist || { enabled: false, types: [], providers: [], games: [], rules: [] },
      confidence: sub.confidence || {
        calculation_value: 'missing',
        minimum_base: 'missing',
        max_bonus: 'missing',
        turnover_rule: 'missing',
        payout_direction: 'missing',
        game_types: 'missing',
        game_providers: 'missing'
      }
    }));
    
    // Run validation
    const validationResult = validateExtractedPromo(parsed);
    parsed.validation = {
      is_structurally_complete: validationResult.is_structurally_complete,
      status: validationResult.status,
      warnings: validationResult.warnings
    };
    
    // Track pre-processing metadata
    parsed._extraction_meta = {
      ...parsed._extraction_meta,
      has_rowspan_tables: hadRowspan,
      html_was_normalized: hadRowspan,
    };
    
    // ============================================
    // STEP FINAL: MERGE CLASSIFICATION METADATA
    // ============================================
    if (classificationResult) {
      // Apply keyword override to ensure consistency for known promo types
      const { category: finalCategory, wasOverridden, overrideReason } = applyKeywordOverrides(
        classificationResult.category,
        parsed.promo_name || '',
        parsed.promo_type
      );
      
      parsed.program_classification = finalCategory;
      parsed.program_classification_name = getCategoryName(finalCategory);
      parsed.classification_confidence = classificationResult.confidence;
      parsed.classification_q1 = classificationResult.q1;
      parsed.classification_q2 = classificationResult.q2;
      parsed.classification_q3 = classificationResult.q3;
      parsed.classification_q4 = classificationResult.q4;
      parsed.quality_flags = classificationResult.quality_flags;
      parsed.evidence_count = classificationResult.evidence_count;
      parsed.classifier_prompt_version = classificationResult.classifier_prompt_version;
      parsed.classifier_latency_ms = classificationResult.latency_ms;
      
      // Track if override was applied
      if (wasOverridden) {
        (parsed._extraction_meta as Record<string, unknown>).classification_overridden = true;
        (parsed._extraction_meta as Record<string, unknown>).classification_override_reason = overrideReason;
        (parsed._extraction_meta as Record<string, unknown>).original_llm_category = classificationResult.category;
      }
      
      // Store keyword override version for session invalidation
      (parsed as unknown as Record<string, unknown>)._keyword_override_version = 
        (await import('./extractors/category-classifier')).KEYWORD_OVERRIDE_VERSION;
      
      console.log('[Extractor] Classification metadata merged:', {
        category: parsed.program_classification,
        wasOverridden,
        overrideReason: overrideReason || 'none',
        confidence: parsed.classification_confidence,
        quality_flags: parsed.quality_flags,
      });
    }
    
    // DERIVE ready_to_commit from validation - never hardcode
    parsed.ready_to_commit = validationResult.status === 'ready' && validationResult.warnings.length === 0;
    
    return parsed;
  } catch (parseError) {
    console.error("Failed to parse OpenAI response:", resultText);
    throw new Error("Gagal parsing hasil ekstraksi. Response bukan JSON valid.");
  }
}

// CORS proxy fallback list
const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

// Helper untuk fetch URL via CORS proxy dengan fallback
export async function fetchUrlContent(url: string): Promise<string> {
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxyFn = CORS_PROXIES[i];
    try {
      const proxyUrl = proxyFn(url);
      console.log(`Trying CORS proxy ${i + 1}/${CORS_PROXIES.length}...`);
      
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        console.warn(`Proxy ${i + 1} returned status ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const content = data.contents || data || "";
      
      // Validasi konten adalah HTML yang valid (bukan error page)
      if (content && content.length > 500 && content.includes('<')) {
        console.log(`✅ CORS proxy ${i + 1} berhasil, content length: ${content.length}`);
        return content;
      }
      
      console.warn(`Proxy ${i + 1} returned invalid content (length: ${content.length})`);
    } catch (e) {
      console.warn(`Proxy ${i + 1} failed:`, e);
      continue;
    }
  }
  
  throw new Error("Semua CORS proxy gagal. Silakan paste konten HTML manual.");
}

// Helper untuk format currency
export function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}jt`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}rb`;
  }
  return value.toString();
}

// Helper untuk get confidence badge color (EXPANDED + NOT_APPLICABLE)
export function getConfidenceBadgeColor(confidence: ConfidenceLevel): string {
  switch (confidence) {
    case 'explicit': 
      return 'bg-success/20 text-success border-success/40';
    case 'explicit_from_terms': 
      return 'bg-emerald-600/20 text-emerald-400 border-emerald-600/40'; // Darker green = S&K source
    case 'derived': 
      return 'bg-button-hover/20 text-button-hover border-button-hover/40';
    case 'unknown': 
      return 'bg-slate-500/20 text-slate-400 border-slate-500/40'; // Gray = no data
    case 'ambiguous': 
      return 'bg-warning/20 text-warning border-warning/40';
    case 'missing': 
      return 'bg-destructive/20 text-destructive border-destructive/40';
    case 'not_applicable': 
      return 'bg-muted text-muted-foreground border-border'; // Neutral gray = field tidak relevan
    default: 
      return 'bg-muted text-muted-foreground';
  }
}

// Helper untuk format confidence label (Title Case + Indonesian for not_applicable)
export function formatConfidenceLabel(confidence: ConfidenceLevel): string {
  const labels: Record<ConfidenceLevel, string> = {
    'explicit': 'Explicit',
    'explicit_from_terms': 'From Terms',
    'derived': 'Derived',
    'unknown': 'Unknown',
    'ambiguous': 'Ambiguous',
    'missing': 'Missing',
    'not_applicable': 'Tidak Berlaku',
  };
  return labels[confidence] || confidence;
}

// Helper untuk get status badge
export function getStatusBadgeStyle(status: 'draft' | 'ready'): string {
  switch (status) {
    case 'ready': return 'bg-success/20 text-success border-success/40';
    case 'draft': return 'bg-blue-500/20 text-blue-400 border-blue-500/40';  // Info style, not warning
    default: return 'bg-muted text-muted-foreground';
  }
}

export function getStatusLabel(status: 'draft' | 'ready'): string {
  switch (status) {
    case 'ready': return 'Siap Digunakan';
    case 'draft': return 'Perlu Review';
    default: return 'Unknown';
  }
}

// ============= MAPPING TO PROMO FORM DATA =============
import type { PromoFormData, PromoSubCategory } from '@/components/VOCDashboard/PromoFormWizard/types';

/**
 * Ensure calculation_base is semantically consistent with promo_type.
 * This is a defensive layer to catch LLM extraction errors.
 * 
 * RULES:
 * - Cashback (Loss-based) → calculation_base MUST be 'loss' or 'winloss'
 * - Rollingan (Turnover-based) → calculation_base MUST be 'turnover'
 * - Deposit Bonus → calculation_base MUST be 'deposit'
 */
function ensureCalculationBaseConsistency(data: PromoFormData): PromoFormData {
  const lowerType = data.promo_type?.toLowerCase() || '';
  const result = { ...data };
  
  // Cashback = Loss-based
  if (lowerType.includes('cashback') && lowerType.includes('loss')) {
    if (result.calculation_base !== 'loss' && result.calculation_base !== 'winloss' && result.calculation_base !== 'win_loss') {
      console.log(`[SemanticFix] Cashback (Loss-based) requires loss-based calculation. Fixing: ${result.calculation_base} → winloss`);
      result.calculation_base = 'winloss';
    }
    // Also fix subcategories
    if (result.subcategories?.length) {
      result.subcategories = result.subcategories.map((sub: PromoSubCategory) => ({
        ...sub,
        calculation_base: sub.calculation_base === 'turnover' ? 'winloss' : sub.calculation_base
      }));
    }
  }
  
  // Rollingan = Turnover-based
  if (lowerType.includes('rollingan')) {
    if (result.calculation_base !== 'turnover') {
      console.log(`[SemanticFix] Rollingan (Turnover-based) requires turnover. Fixing: ${result.calculation_base} → turnover`);
      result.calculation_base = 'turnover';
    }
    // Also fix subcategories
    if (result.subcategories?.length) {
      result.subcategories = result.subcategories.map((sub: PromoSubCategory) => ({
        ...sub,
        calculation_base: sub.calculation_base === 'loss' || sub.calculation_base === 'winloss' ? 'turnover' : sub.calculation_base
      }));
    }
  }
  
  // Deposit Bonus = Deposit-based
  if (lowerType.includes('deposit') && lowerType.includes('bonus')) {
    if (result.calculation_base !== 'deposit') {
      console.log(`[SemanticFix] Deposit Bonus requires deposit base. Fixing: ${result.calculation_base} → deposit`);
      result.calculation_base = 'deposit';
    }
  }
  
  return result;
}

/**
 * Maps ExtractedPromo to PromoFormData for form/storage use.
 * 
 * IMPORTANT: This mapper MUST be pure.
 * - Do not introduce side effects
 * - Do not read from global/external state  
 * - Must produce consistent output for the same input
 * 
 * This function is used inside useMemo and relies on referential stability.
 */
export function mapExtractedToPromoFormData(extracted: ExtractedPromo): PromoFormData {
  // Map promo type to exact PROMO_TYPES values
  const promoTypeMap: Record<string, string> = {
    'combo': 'Rollingan (Turnover-based)',
    'welcome_bonus': 'Welcome Bonus',
    'deposit_bonus': 'Deposit Bonus',
    'cashback': 'Cashback (Loss-based)',
    'rollingan': 'Rollingan (Turnover-based)',
    'referral': 'Referral Bonus',
    'event_level_up': 'Event / Level Up',
    'mini_game': 'Mini Game (Spin, Lucky Draw)',
    'freechip': 'Freechip',
    'loyalty_point': 'Loyalty Point',
    'merchandise': 'Merchandise',
    'campaign': 'Campaign / Informational',
  };

  // Map target user to exact TARGET_SEGMENTS values
  const targetUserMap: Record<string, string> = {
    'new_member': 'Baru',
    'all': 'Semua',
    'all_users': 'Semua',
    'vip': 'VIP',
    'vip_only': 'VIP',
    'existing': 'Existing',
    'dormant': 'Dormant',
  };

  // Map intent category to exact INTENT_CATEGORIES values
  const intentCategoryMap: Record<string, string> = {
    'acquisition': 'Acquisition',
    'retention': 'Retention',
    'reactivation': 'Reactivation',
    'vip': 'VIP',
    'bonus_claim': 'Retention',  // Fallback mapping
  };

  // Map trigger event to exact TRIGGER_EVENTS values
  const triggerEventMap: Record<string, string> = {
    'first_deposit': 'First Deposit',
    'deposit': 'First Deposit',
    'login': 'Login',
    'loss_streak': 'Loss Streak',
    'apk_download': 'APK Download',
    'turnover': 'Turnover',
    'mission_completed': 'Mission Completed',
    'user_request': 'First Deposit',  // Fallback for generic trigger
  };

  // Helper to map game providers (handle "ALL" special case)
  const mapGameProviders = (providers: string[]): string[] => {
    if (providers?.includes('ALL')) {
      return ['Semua'];
    }
    return providers || [];
  };

  // Map subcategories with reward type detection
  const subcategories: PromoSubCategory[] = extracted.subcategories.map((sub, idx) => {
    // Detect reward type with fallback pattern matching
    const detectedRewardType = sub.reward_type || detectRewardType(
      sub.sub_name,
      sub.physical_reward_name,
      sub.cash_reward_amount
    );
    
    // Map reward type to UI dropdown value
    const mapRewardTypeToUI = (type: string): string => {
      switch (type) {
        case 'hadiah_fisik': return 'hadiah_fisik';
        case 'uang_tunai': return 'uang_tunai';
        case 'credit_game': return 'credit_game';
        case 'voucher': return 'voucher';
        default: return 'Freechip';
      }
    };
    
    return {
      id: `sub_${Date.now()}_${idx}`,
      name: sub.sub_name || `Varian ${idx + 1}`,
      
      // Dasar Perhitungan
      calculation_base: sub.calculation_base || 'deposit',
      calculation_method: sub.calculation_method || 'percentage',
      calculation_method_enabled: true,
      calculation_value: sub.calculation_value || 0,
      minimum_base: sub.minimum_base || 0,
      minimum_base_enabled: sub.minimum_base > 0,
      turnover_rule: sub.turnover_rule ? `${sub.turnover_rule}x` : '0x',
      turnover_rule_enabled: sub.turnover_rule > 0,
      turnover_rule_custom: '',
      
      // Jenis Hadiah & Max Bonus - NOW WITH DETECTION
      jenis_hadiah_same_as_global: false, // Each sub can have different reward type
      jenis_hadiah: mapRewardTypeToUI(detectedRewardType),
      physical_reward_name: sub.physical_reward_name || '',
      physical_reward_quantity: sub.physical_reward_quantity || 1,
      cash_reward_amount: sub.cash_reward_amount || undefined,
      max_bonus_same_as_global: false, // Each sub has its own max
      // Handle null max_bonus = unlimited
      max_bonus: sub.max_bonus ?? 0,
      max_bonus_unlimited: sub.max_bonus === null,
      // Only use global if payout_direction is not specified
      payout_direction_same_as_global: !sub.payout_direction,
      payout_direction: sub.payout_direction === 'depan' ? 'before' : 'after',
      
      // Admin Fee (default ikut global)
      admin_fee_same_as_global: true,
      admin_fee_enabled: false,
      admin_fee_percentage: null,
      
      // Game whitelist (handle "ALL")
      game_types: sub.game_types?.includes('ALL') ? ['Semua'] : (sub.game_types || []),
      eligible_providers: sub.eligible_providers || [],  // ← NEW: provider names yang eligible
      game_providers: mapGameProviders(sub.game_providers),
      game_names: sub.game_names || [],
      
      // Game blacklist - Auto-enable if any array has content
      game_blacklist_enabled: sub.blacklist?.enabled || 
        (sub.blacklist?.types?.length || 0) > 0 ||
        (sub.blacklist?.providers?.length || 0) > 0 ||
        (sub.blacklist?.games?.length || 0) > 0 ||
        (sub.blacklist?.rules?.length || 0) > 0,
      game_types_blacklist: sub.blacklist?.types || [],
      game_providers_blacklist: sub.blacklist?.providers || [],
      game_names_blacklist: sub.blacklist?.games || [],
      game_exclusion_rules: sub.blacklist?.rules || [],
      
      // Legacy fields - NOW WITH DETECTION
      dinamis_reward_type: mapRewardTypeToUI(detectedRewardType),
      dinamis_reward_amount: 0,
      dinamis_max_claim: sub.max_bonus ?? 0,
      // null max_bonus = unlimited
      dinamis_max_claim_unlimited: sub.max_bonus === null,
      // 🔒 ONTOLOGY FIX: Map min_claim (payout threshold) ke dinamis_min_claim
      // dinamis_min_claim = minimal bonus untuk DICAIRKAN (bukan syarat kualifikasi)
      // minimum_base = syarat minimal untuk IKUT promo (eligibility)
      // Ini adalah 2 field BERBEDA!
      dinamis_min_claim: sub.min_claim || sub.payout_threshold || 0,
      dinamis_min_claim_enabled: !!(sub.min_claim || sub.payout_threshold),
    };
  });

  // Check if any subcategory has unlimited max_bonus
  const hasUnlimitedMaxBonus = extracted.subcategories.some(sub => sub.max_bonus === null);

  // ============================================
  // TRIGGER EVENT DEFAULT HELPER
  // Context-aware trigger based on promo type
  // ============================================
  const getTriggerEventDefault = (promoType: string): string => {
    const lowerType = promoType?.toLowerCase() || '';
    // ✅ FIX: Cashback = Loss-based, Rollingan = Turnover-based
    if (lowerType.includes('cashback')) return 'Loss';
    if (lowerType.includes('rollingan') || lowerType.includes('rebate')) return 'Turnover';
    if (lowerType.includes('referral')) return 'Referral';
    if (lowerType.includes('loyalty')) return 'Turnover';
    if (lowerType.includes('event') || lowerType.includes('level')) return 'Mission Completed';
    return 'First Deposit';  // Default for deposit-based promos
  };

  // ============================================
  // REWARD DISTRIBUTION NORMALIZER
  // Maps extracted values to valid REWARD_DISTRIBUTIONS enum values
  // ============================================
  const normalizeRewardDistribution = (): string => {
    const raw = extracted.reward_distribution?.toLowerCase()?.trim() || '';
    const hasDistributionDay = !!extracted.distribution_day;
    const claimFreq = extracted.claim_frequency?.toLowerCase() || '';
    const promoType = extracted.promo_type?.toLowerCase() || '';
    
    // Priority 1: Explicit distribution_day → 'hari_tertentu'
    if (hasDistributionDay) {
      return 'hari_tertentu';
    }
    
    // Priority 2: Direct matches from extraction
    // Map various LLM outputs to canonical enum values
    const mapping: Record<string, string> = {
      // Setelah Syarat
      'setelah_syarat': 'setelah_syarat',
      'setelah syarat': 'setelah_syarat',
      'langsung': 'setelah_syarat',  // ← FIX: "Langsung" maps to setelah_syarat
      'instant': 'setelah_syarat',
      'segera': 'setelah_syarat',
      'otomatis': 'setelah_syarat',
      'auto': 'setelah_syarat',
      
      // Otomatis Setelah Periode
      'otomatis_setelah_periode': 'otomatis_setelah_periode',
      'otomatis setelah periode': 'otomatis_setelah_periode',
      'after_period': 'otomatis_setelah_periode',
      'setelah periode': 'otomatis_setelah_periode',
      'mingguan': 'otomatis_setelah_periode',
      'harian': 'otomatis_setelah_periode',
      'bulanan': 'otomatis_setelah_periode',
      
      // Hari Tertentu
      'hari_tertentu': 'hari_tertentu',
      'hari tertentu': 'hari_tertentu',
      'tiap hari': 'hari_tertentu',
      
      // Tanggal Tertentu
      'tanggal_tertentu': 'tanggal_tertentu',
      'tanggal tertentu': 'tanggal_tertentu',
      'rentang tanggal': 'tanggal_tertentu',
    };
    
    if (mapping[raw]) {
      return mapping[raw];
    }
    
    // Priority 3: Infer from claim_frequency for periodic promos
    if (['mingguan', 'harian', 'bulanan'].includes(claimFreq)) {
      return 'otomatis_setelah_periode';
    }
    
    // Priority 4: Infer from promo_type
    // Rollingan/Cashback = periodic = otomatis_setelah_periode
    if (['cashback', 'rebate', 'rollingan', 'rollingan cashback', 'rollingan / cashback'].includes(promoType)) {
      return 'otomatis_setelah_periode';
    }
    
    // Default: setelah_syarat (most neutral for non-periodic promos)
    return 'setelah_syarat';
  };

  // ============================================
  // PHASE 1A: SMART MODE DETECTION
  // Logika: Single-variant + stateless = Fixed
  // Stateless = tidak ada time-window berbeda, tidak ada kondisi kompleks
  // ============================================
  
  type DetectedRewardMode = 'formula' | 'fixed' | 'tier';
  
  const detectRewardMode = (): { mode: DetectedRewardMode; auto_detected: boolean; reason: string } => {
    // Case 1: Tier mode (Category C Loyalty - Phase 2, skip for now)
    // if (extracted.program_classification === 'C' && extracted.loyalty_mechanism?.exchange_table) {
    //   return { mode: 'tier', auto_detected: true, reason: 'Category C dengan exchange table' };
    // }
    
    // Case 2: Fixed mode detection
    // Kriteria: Single subcategory + stateless (scalar, no complex conditions)
    if (subcategories.length === 1) {
      const sub = extracted.subcategories[0];
      
      // Check for statelessness:
      // - calculation_method must be scalar (percentage/fixed, not threshold)
      // - turnover_rule exists (scalar multiplier)
      // - no time-window variations (single variant implies this)
      // - high confidence on key fields
      const isStateless = 
        sub.calculation_method !== 'threshold' && // threshold = conditional, not scalar
        (sub.calculation_value != null) &&        // has a value
        (sub.turnover_rule != null) &&            // has TO rule (can be 0)
        !extracted.unlock_conditions?.length;     // no complex unlock gates
      
      // Confidence check: only auto-detect if key fields have good confidence
      const hasHighConfidence = 
        sub.confidence?.calculation_value && 
        ['explicit', 'derived'].includes(sub.confidence.calculation_value);
      
      if (isStateless && hasHighConfidence) {
        return { 
          mode: 'fixed', 
          auto_detected: true, 
          reason: 'Single-variant promo dengan nilai stateless dan confidence tinggi'
        };
      }
    }
    
    // Default: Formula (dinamis) mode
    return { 
      mode: 'formula', 
      auto_detected: subcategories.length > 1, 
      reason: subcategories.length > 1 
        ? 'Multi-variant promo dengan subcategories' 
        : 'Default mode atau kondisi tidak memenuhi Fixed'
    };
  };
  
  const modeDetection = detectRewardMode();
  
  // ============================================
  // REFERRAL MULTI-TIER DETECTION & MAPPING
  // Convert subcategories[] → referral_tiers[] for Referral promos
  // ============================================
  const isReferralMultiTier = 
    /referral|referal|refferal|ajak.*teman|ajak.*team/i.test(extracted.promo_type || '') && 
    extracted.subcategories?.length > 1;

  // Helper: Extract min_downline from terms or pattern
  const extractMinDownline = (
    sub: typeof extracted.subcategories[0], 
    terms: string[] | undefined,
    tierIndex: number
  ): number => {
    // Pattern 1: Check sub's name for downline pattern "Tier 5 ID"
    const nameMatch = sub.sub_name?.match(/(\d+)\s*(id|member|downline)/i);
    if (nameMatch) return parseInt(nameMatch[1]);
    
    // Pattern 2: Check global terms for tier-specific pattern "Tier X%: minimal Y ID"
    const tierTerms = terms?.find(t => 
      t.includes(`${sub.calculation_value}%`) && 
      /(\d+)\s*(id|member|downline)/i.test(t)
    );
    if (tierTerms) {
      const match = tierTerms.match(/(\d+)\s*(id|member|downline)/i);
      if (match) return parseInt(match[1]);
    }
    
    // Pattern 3: Auto-increment fallback (5, 10, 15...)
    return (tierIndex + 1) * 5;
  };

  // Build referral_tiers if this is a referral multi-tier promo
  let referralTiers: Array<{
    id: string;
    tier_label: string;
    min_downline: number;
    commission_percentage: number;
  }> = [];
  
  if (isReferralMultiTier) {
    console.log('[Referral Mapping] Detected multi-tier referral, converting subcategories to referral_tiers');
    referralTiers = extracted.subcategories.map((sub, idx) => ({
      id: generateUUID(),
      tier_label: sub.sub_name || `Tier ${idx + 1}`,
      min_downline: extractMinDownline(sub, extracted.terms_conditions, idx),
      commission_percentage: sub.calculation_value || 0,
      // ALL SAMPLE DATA from promo table (NOT rules!)
      // Fallback to minimum_base for backward compatibility with old extractions
      sample_winlose: (sub as any).sample_winlose || sub.minimum_base || undefined,
      sample_cashback: (sub as any).sample_cashback || undefined,
      sample_commission_deduction: (sub as any).sample_commission_deduction || undefined,
      sample_net_winlose: (sub as any).sample_net_winlose || undefined,
      sample_commission_result: (sub as any).sample_commission_result || undefined,
    }));
  }
  
  // ✅ SEMANTIC SANITIZATION: Prevent Rupiah from becoming WD multiplier
  subcategories.forEach((sub) => {
    if (typeof sub.turnover_rule === 'number' || typeof sub.turnover_rule === 'string') {
      const numValue = typeof sub.turnover_rule === 'number' 
        ? sub.turnover_rule 
        : Number(String(sub.turnover_rule).replace(/[^0-9]/g, ''));
      
      // If turnover_rule >= 1000 and base is 'turnover', it's min qualify, not WD multiplier
      if (numValue >= 1000 && sub.calculation_base === 'turnover') {
        console.warn(`[Semantic Fix] Moving turnover_rule ${numValue} to minimum_base (base=turnover)`);
        sub.minimum_base = Math.max(sub.minimum_base || 0, numValue);
        sub.turnover_rule = '0';
        sub.turnover_rule_enabled = false;
      }
      // General rule: any value >= 10000 is almost certainly Rupiah
      else if (numValue >= 10000) {
        console.warn(`[Semantic Fix] Large turnover_rule ${numValue} detected, treating as min qualify`);
        sub.minimum_base = Math.max(sub.minimum_base || 0, numValue);
        sub.turnover_rule = '0';
        sub.turnover_rule_enabled = false;
      }
    }
  });
  
  // Build base PromoFormData
  const promoData: PromoFormData = {
    // Step 1 - Identitas (with exact enum value mappings)
    client_id: extracted.client_id || '',  // Auto-detected from content
    promo_name: extracted.promo_name || 'Promo Baru',
    promo_type: promoTypeMap[extracted.promo_type?.toLowerCase()] || extracted.promo_type || 'Deposit Bonus',
    intent_category: 'Retention',  // Default - not extracted from source
    target_segment: targetUserMap[extracted.target_user?.toLowerCase()] || 'Semua',
    trigger_event: getTriggerEventDefault(extracted.promo_type || ''),  // Context-aware default

    // Step 2 - Reward Mode (NOW WITH AUTO-DETECTION)
    reward_mode: modeDetection.mode,
    
    // Metadata for UI to show auto-detection badge
    _mode_auto_detected: modeDetection.auto_detected,
    _mode_detection_reason: modeDetection.reason,
    
    // Keep raw subcategories for audit/debug (hidden from UI)
    _raw_subcategories: extracted.subcategories,
    
    // Fixed mode defaults - using INERT VALUES (null, not 0)
    reward_type: 'freechip',  // lowercase to match enum
    reward_amount: null,      // ✅ FIX: null = inert (not 0)
    min_deposit: null,        // ✅ FIX: null = inert (not 0)
    max_claim: null,
    // ✅ FIX: turnover_rule default "" (inert), not "0x"
    turnover_rule: subcategories[0]?.turnover_rule || '',
    turnover_rule_enabled: subcategories[0]?.turnover_rule_enabled ?? (subcategories[0]?.turnover_rule && subcategories[0]?.turnover_rule !== '' && subcategories[0]?.turnover_rule !== '0x'),
    turnover_rule_custom: subcategories[0]?.turnover_rule_custom || '',
    // claim_frequency dari extracted, atau infer dari promo_type
    claim_frequency: extracted.claim_frequency || 
      (['cashback', 'rebate', 'rollingan', 'rollingan cashback'].includes(extracted.promo_type?.toLowerCase() || '') 
        ? 'mingguan' 
        : 'sekali'),
    claim_date_from: '',
    claim_date_until: '',

    // Fixed Mode - SEPARATE fields (prefix: fixed_)
    // Phase 1B: Map from subcategories[0] when mode is 'fixed'
    fixed_reward_type: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? ((extracted.subcategories[0].reward_type || 'credit_game').toLowerCase())
      : '',
    fixed_calculation_base: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? (extracted.subcategories[0].calculation_base || 'deposit')
      : '',
    fixed_calculation_method: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? (extracted.subcategories[0].calculation_method || 'percentage')
      : '',
    fixed_calculation_value: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? extracted.subcategories[0].calculation_value
      : undefined,
    fixed_max_claim: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? (extracted.subcategories[0].max_bonus ?? undefined)
      : undefined,
    fixed_max_claim_unlimited: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? extracted.subcategories[0].max_bonus === null
      : false,
    fixed_payout_direction: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? (extracted.subcategories[0].payout_direction === 'depan' ? 'before' : 'after')
      : 'after',
    fixed_admin_fee_enabled: false,
    fixed_admin_fee_percentage: undefined,
    fixed_min_calculation_enabled: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? (extracted.subcategories[0].minimum_base || 0) > 0
      : false,
    fixed_min_calculation: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? extracted.subcategories[0].minimum_base
      : undefined,
    fixed_physical_reward_name: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? (extracted.subcategories[0].physical_reward_name || '')
      : '',
    fixed_physical_reward_quantity: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? (extracted.subcategories[0].physical_reward_quantity || 1)
      : 1,
    fixed_cash_reward_amount: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? extracted.subcategories[0].cash_reward_amount
      : undefined,
    fixed_turnover_rule_enabled: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? (extracted.subcategories[0].turnover_rule || 0) > 0
      : false,
    fixed_turnover_rule: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? `${extracted.subcategories[0].turnover_rule || 0}x`
      : '',
    fixed_turnover_rule_custom: '',

    // Tier mode defaults
    promo_unit: 'lp',
    exp_mode: 'level_up',
    lp_calc_method: 'fixed',
    exp_calc_method: 'fixed',
    lp_earn_basis: 'turnover',
    lp_earn_amount: 1000,
    lp_earn_point_amount: 1,
    exp_formula: '',
    lp_value: '',
    exp_value: '',
    tiers: [],
    fast_exp_missions: [],
    level_up_rewards: [],
    vip_multiplier: {
      enabled: false,
      min_daily_to: 0,
      tiers: [],
    },

    // Distribution - normalized to valid REWARD_DISTRIBUTIONS enum values
    reward_distribution: normalizeRewardDistribution(),  // ✅ FIX: Use normalizer instead of raw 'Langsung'
    distribution_day: extracted.distribution_day || '',
    distribution_time: '',
    
    // Periode Hitungan (untuk weekly/daily promo) - from extracted
    calculation_period_start: extracted.calculation_period_start || '',
    calculation_period_end: extracted.calculation_period_end || '',
    calculation_period_note: '',  // Generated at runtime if needed
    distribution_date_from: '',
    distribution_date_until: '',
    distribution_time_enabled: false,
    distribution_time_from: '',
    distribution_time_until: '',
    distribution_day_time_enabled: false,
    custom_terms: extracted.terms_conditions?.join('; ') || '',
    special_requirements: [],

    // Dinamis mode - from first subcategory as base
    calculation_base: subcategories[0]?.calculation_base || 'deposit',
    calculation_method: subcategories[0]?.calculation_method || 'percentage',
    calculation_value: subcategories[0]?.calculation_value || 0,
    min_calculation: subcategories[0]?.minimum_base || 0,  // Renamed from minimum_base
    min_calculation_enabled: (subcategories[0]?.minimum_base || 0) > 0,
    
    // ✅ FIX: Map dinamis_reward_type from first subcategory (was hardcoded to 'Freechip')
    dinamis_reward_type: (subcategories[0]?.jenis_hadiah || subcategories[0]?.dinamis_reward_type || 'credit_game').toLowerCase(),  // lowercase to match DINAMIS_REWARD_TYPES
    dinamis_reward_amount: 0,
    dinamis_max_claim: subcategories[0]?.max_bonus || 0,
    dinamis_max_claim_unlimited: hasUnlimitedMaxBonus,
    // ✅ ONTOLOGY FIX: Read payout threshold from subcategory BEFORE it gets emptied
    // Truth must flow from extraction → mapping → UI
    // dinamis_min_claim = payout threshold ("minimal bonus yang bisa dicairkan")
    // DO NOT confuse with minimum_base = eligibility threshold ("minimal kekalahan")
    // Use nullish coalescing (??) not logical OR (||) to preserve explicit 0 values
    dinamis_min_claim: subcategories[0]?.dinamis_min_claim ?? 0,
    dinamis_min_claim_enabled: (subcategories[0]?.dinamis_min_claim ?? 0) > 0,
    conversion_formula: '',

    // Step 2 - Batasan & Akses
    platform_access: 'semua',
    game_restriction: 'specific_game',
    game_types: subcategories[0]?.game_types || [],
    eligible_providers: extracted.eligible_providers || subcategories[0]?.eligible_providers || [],  // ← NEW
    game_providers: subcategories[0]?.game_providers || [],
    game_names: subcategories[0]?.game_names || [],
    
    // Blacklist from global - Auto-enable if any array has content
    game_blacklist_enabled: extracted.global_blacklist?.enabled || 
      (extracted.global_blacklist?.types?.length || 0) > 0 ||
      (extracted.global_blacklist?.providers?.length || 0) > 0 ||
      (extracted.global_blacklist?.games?.length || 0) > 0 ||
      (extracted.global_blacklist?.rules?.length || 0) > 0,
    game_types_blacklist: extracted.global_blacklist?.types || [],
    game_providers_blacklist: extracted.global_blacklist?.providers || [],
    game_names_blacklist: extracted.global_blacklist?.games || [],
    game_exclusion_rules: extracted.global_blacklist?.rules || [],
    
    valid_from: extracted.valid_from || new Date().toISOString().split('T')[0],
    valid_until: extracted.valid_until || '',
    valid_until_unlimited: !extracted.valid_until,
    status: 'draft',
    geo_restriction: 'indonesia',  // Default wilayah Indonesia
    require_apk: false,
    promo_risk_level: 'medium',

    // Admin Fee (untuk Referral Bonus)
    admin_fee_enabled: false,
    admin_fee_percentage: null,

    // Contact Channel
    contact_channel_enabled: false,
    contact_channel: '',
    contact_link: '',

    // Global settings for subcategories
    global_jenis_hadiah_enabled: true,
    global_jenis_hadiah: 'Freechip',
    global_max_bonus_enabled: false,
    global_max_bonus: 0,
    global_payout_direction_enabled: true,
    global_payout_direction: subcategories[0]?.payout_direction === 'before' ? 'before' : 'after',

    // Subcategories
    has_subcategories: extracted.has_subcategories && subcategories.length > 1,
    subcategories: subcategories.length > 1 ? subcategories : [],
    
    // Point Store Redeem Table
    redeem_items: [],
    redeem_jenis_reward: '',
    
    // Referral Commission Tiers (tier_network)
    // If multi-tier referral detected, use converted referral_tiers and set tier_archetype
    referral_tiers: referralTiers,
    // ✅ FIX: referral_calculation_basis ONLY for referral promos, otherwise INERT ("")
    referral_calculation_basis: isReferralMultiTier ? (() => {
      const firstSubBasis = subcategories[0]?.calculation_base;
      // Map to valid referral basis enum
      if (firstSubBasis === 'loss' || firstSubBasis === 'winloss' || firstSubBasis === 'win_loss') {
        return 'loss';  // Normalize winloss variants to 'loss'
      }
      if (firstSubBasis === 'turnover') return 'turnover';
      if (firstSubBasis === 'deposit') return 'deposit';
      // Default untuk Referral iGaming Asia = loss
      return 'loss';
    })() : '',  // ✅ INERT: "" for non-referral promos
    referral_admin_fee_enabled: isReferralMultiTier,
    referral_admin_fee_percentage: isReferralMultiTier ? 20 : null,  // ✅ INERT: null for non-referral
    
    // Override for referral multi-tier: switch to tier mode with tier_network archetype
    ...(isReferralMultiTier && {
      reward_mode: 'tier' as const,
      tier_archetype: 'tier_network' as const,
      has_subcategories: false,  // Disable combo subcategories mode
      subcategories: [],         // Clear generic subcategories
    }),

    // Step 4 - AI Templates (empty defaults)
    response_template_offer: '',
    response_template_requirement: '',
    response_template_instruction: '',
    ai_guidelines: '',
    default_behavior: '',
    completion_steps: '',

    // Classification metadata (from LLM classifier)
    program_classification: extracted.program_classification,
    classification_confidence: extracted.classification_confidence,
    classification_override: extracted.classification_override,
  };

  // ============================================
  // SEMANTIC CONSISTENCY ENFORCEMENT
  // Ensure calculation_base matches promo_type semantics
  // ============================================
  const ensuredPromoData = ensureCalculationBaseConsistency(promoData);

  // ============================================
  // FIELD APPLICABILITY ENFORCEMENT (Final Layer)
  // Set non-applicable fields to inert values based on promo_type
  // ARSITEKTUR: Full-shape JSON dengan inert values, BUKAN delete!
  // ============================================
  const { data: enforcedData, inerted_fields } = enforceFieldApplicability(
    ensuredPromoData as unknown as Record<string, unknown>,
    ensuredPromoData.promo_type
  );
  
  if (inerted_fields.length > 0) {
    console.log(`[mapExtractedToPromoFormData] Applied inert values to ${inerted_fields.length} fields:`, 
      inerted_fields.map(f => `${f.field}: ${JSON.stringify(f.from)} → ${JSON.stringify(f.to)}`));
  }

  return enforcedData as unknown as PromoFormData;
}
