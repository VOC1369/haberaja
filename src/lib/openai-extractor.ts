/**
 * OpenAI Promo Extractor v4.2 — BLACKLIST PARSING FIX
 * 
 * ⛔ MODE DECISION FORBIDDEN HERE
 * This file may NOT assign: mode, reward_mode, category
 * Mode decisions live ONLY in: promo-primitive-gate.ts
 * Violation = Architecture breach
 * 
 * SIGNAL CONTRACT: docs/architecture/promo-primitive-gate.signal-contract.md
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
import { getDefaultsFromKeywords } from './extractors/keyword-rules';
import { sanitizeByMode, NON_FORMULA_MODES } from './sanitize-by-mode';
import { normalizeExtractedPromo, type ExtractionSource } from './extractors/post-extraction-normalizer';

// NEW: Reasoning-First Architecture imports (v2.0)
import { 
  reasonPromoIntent, 
  calculateIntentConfidence, 
  detectIntentConflicts,
  type PromoIntent 
} from './extractors/promo-intent-reasoner';
import { 
  routeMechanic, 
  checkInvariants, 
  getMechanicDisplayName,
  type MechanicRouterResult,
  type LockedFields,
  type PromoMode
} from './extractors/mechanic-router';
import { 
  arbitrate, 
  formatConflicts,
  type ArbitrationResult,
  type ArbitrationInput
} from './extractors/arbitration-rules';

// ============================================
// PROMO PRIMITIVE GATE v1.2.1 — SINGLE SOURCE OF TRUTH
// Mode decisions ONLY come from this gate.
// ============================================
import { 
  resolveModFromPrimitive, 
  type PromoPrimitive,
  type CanonicalMode,
  PRIMITIVE_GATE_VERSION
} from './extractors/promo-primitive-gate';
import { 
  collectPrimitiveEvidence, 
  inferTaskDomain, 
  inferRewardNature,
  hasApkConstraint,
  inferPrimitivesWithConfidence
} from './extractors/primitive-evidence-collector';
import { assertModeFromGate } from './extractors/primitive-invariant-checker';

// ============================================
// TAXONOMY PIPELINE v1.0 — SSoT INTEGRATION
// Taxonomy is the JUDGE, Extractor is the WITNESS
// ============================================
import { 
  cleanEvidence, 
  type CleanedEvidence 
} from './extractors/evidence-cleaner';
import { 
  runTaxonomyPipeline, 
  shouldUseTaxonomy,
  TAXONOMY_LOCKED_FIELDS,
  type TaxonomyDecision 
} from './extractors/taxonomy-pipeline';
import { getPayloadContract, type PromoArchetype } from './extractors/promo-taxonomy';

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
    minimum_base: 'not_applicable',  // Referral: tidak ada threshold nominal (WINLOSE di tabel = ATURAN FINAL)
    min_downline: 'required',        // Referral: threshold tier = jumlah downline aktif
    winlose: 'optional',             // Referral: ATURAN FINAL dari tabel promo (bukan sample!)
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
  } else if (/event|level|naik|milestone|leaderboard|tournament|lucky\s*spin|gacha|download|apk|freechip|freebet|aplikasi/i.test(combined)) {
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
  
  // RULE 4: Event/Milestone/APK Download = NO calculation fields
  if (dims.reward_nature === 'event') {
    result.calculation_value = 'not_applicable';
    result.turnover_rule = 'not_applicable';
    result.payout_direction = 'not_applicable';
    result.minimum_base = 'not_applicable';
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

// ============================================
// REFERRAL CUSTOM_TERMS CLEANER
// ============================================
/**
 * Clean custom_terms from tier logic and formula calculations for Referral promos
 * 
 * ARSITEKTUR:
 * - custom_terms = HANYA legal/narasi/larangan/hak & kewajiban
 * - TIDAK BOLEH ada angka tier, %, rumus, atau syarat kuantitatif
 * - Truth = referral_tiers[] array (structured data)
 * 
 * Patterns removed:
 * - "Tier X%: Minimal Y ID aktif"
 * - "Hitungan komisi: [formula]"
 * - "Admin Fee: X%"
 * - "Tabel angka [simulasi]"
 */
export function cleanReferralCustomTerms(terms: string): string {
  if (!terms) return '';
  
  const patternsToRemove = [
    // Tier qualification patterns
    /Tier\s*\d+%?:?\s*Minimal\s*\d+\s*ID\s*aktif;?\s*/gi,
    /Tier\s*\d+%?\s*[-–:]\s*[^;]+;?\s*/gi,  // "Tier 5% - xxx"
    
    // Formula and calculation patterns
    /Hitungan\s*komisi:?\s*[^;]+;?\s*/gi,
    /Winlose\s*[-–]\s*Comm?ision\s*[-–]\s*[^;]+;?\s*/gi,  // Formula: Winlose - Commission - etc
    
    // Admin fee patterns
    /Admin\s*Fee:?\s*\d+%?;?\s*/gi,
    
    // Table column header patterns (keep data in structured fields, not custom_terms)
    /Tabel\s*angka[^;]+;?\s*/gi,
    /WINLOSE,?\s*CASHBACK,?\s*FEE[^;]*;?\s*/gi,
  ];
  
  let cleaned = terms;
  for (const pattern of patternsToRemove) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // Cleanup artifacts
  cleaned = cleaned
    .replace(/;\s*;/g, ';')           // Double semicolons
    .replace(/^\s*;\s*/, '')          // Leading semicolon
    .replace(/;\s*$/, '')             // Trailing semicolon
    .replace(/\s+/g, ' ')             // Multiple spaces
    .trim();
  
  return cleaned;
}

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
  reward_type?: 'hadiah_fisik' | 'uang_tunai' | 'credit_game' | 'voucher' | 'ticket' | 'lucky_spin' | 'other';
  physical_reward_name?: string;   // e.g., "MITSUBISHI PAJERO SPORT 2025"
  physical_reward_quantity?: number; // e.g., 2 (untuk "2 unit")
  cash_reward_amount?: number;     // e.g., 15000000 (untuk Rp 15.000.000)
  
  // Voucher / Ticket / Lucky Spin specific fields (v1.2)
  reward_quantity?: number;          // e.g., 10 (untuk "10 tiket per hari")
  voucher_kind?: string;             // 'deposit' | 'lucky_spin' | 'event_entry' | 'discount' | 'free_play' | 'other'
  voucher_valid_from?: string;       // YYYY-MM-DD
  voucher_valid_until?: string;      // YYYY-MM-DD
  voucher_valid_unlimited?: boolean; // true = tidak ada kadaluwarsa
  lucky_spin_id?: string;            // ID dari lucky spin yang terkait
  lucky_spin_max_per_day?: number;   // Max spin per hari
  
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
  special_requirements?: string[];  // ✅ NEW: Syarat eligibility khusus (birthday, payout split, etc.)
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
  
  // NEW: Reasoning-First Architecture v2.0 audit trail
  _reasoning_v2?: {
    promo_intent?: {
      primary_action?: string;
      reward_nature?: string;
      distribution_path?: string;
      value_shape?: string;
      intent_evidence?: string[];
      confidence?: number;
    };
    mechanic_selection?: {
      mechanic_type?: string;
      locked_fields?: {
        mode?: string;
        calculation_basis?: string | null;
        reward_is_percentage?: boolean;
        trigger_event?: string;
        require_apk?: boolean;
      };
      invariant_violations?: string[];
    };
    arbitration?: {
      conflicts?: Array<{
        field: string;
        q1q4_value: unknown;
        step0_value: unknown;
        winner: string;
        reason: string;
      }>;
      needs_human_review?: boolean;
    };
  };
  
  // Root-level extraction fields (P1/P2 — from prompt fix)
  conversion_formula?: string;
  turnover_basis?: 'bonus_only' | 'deposit_plus_bonus' | 'deposit_only' | null;
  mode?: 'fixed' | 'formula' | 'tier';
  tier_archetype?: string | null;

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
| 1-4 ID   | 10.000.000 | 300.000 | 700.000 | -2.000.000 | 8.500.000 | 5%  |
| 5-9 ID   | 50.000.000 | ... | ... | ... | ... | 10% |
| 10+ ID   | 100.000.000 | ... | ... | ... | ... | 15% |

⚠️ PERBEDAAN KRITIS: min_downline vs calculation_value — JANGAN CAMPUR!
┌─────────────────────────────────────────────────────────────────────────┐
│  min_downline     = JUMLAH DOWNLINE MINIMUM untuk masuk tier ini        │
│                     Ambil dari BATAS BAWAH range downline di kolom      │
│                     Contoh: "1-4 ID" → min_downline = 1                │
│                     Contoh: "5-9 ID" → min_downline = 5                │
│                     Contoh: "10+ ID" → min_downline = 10               │
│                                                                         │
│  calculation_value = PERSENTASE KOMISI yang diterima per tier          │
│                     Ambil dari kolom KOMISI                            │
│                     Contoh: "5%" → calculation_value = 5               │
│                     Contoh: "10%" → calculation_value = 10             │
│                     Contoh: "15%" → calculation_value = 15             │
│                                                                         │
│  ❌ SALAH: min_downline = 5 untuk tier komisi 5%                       │
│  ✅ BENAR: min_downline = 1, calculation_value = 5 untuk "1-4 ID: 5%" │
└─────────────────────────────────────────────────────────────────────────┘

ATURAN PARSING REFERRAL:
1. Jika ada tabel dengan kolom DOWNLINE + KOMISI (persentase berbeda per tier):
   - promo_mode = "multi"
   - SETIAP ROW = 1 subcategory
   
2. sub_name = "Komisi X%" atau "Tier X ID" (dari nilai persentase/downline)

3. calculation_value = nilai KOMISI (persentase) per tier — BUKAN jumlah downline!
   - "1-4 ID aktif: komisi 5%" → calculation_value = 5
   - "5-9 ID aktif: komisi 10%" → calculation_value = 10
   - "10+ ID aktif: komisi 15%" → calculation_value = 15

4. ⚠️ ATURAN FINAL DARI TABEL PROMO - Extract semua nilai dari tabel:
   - winlose = nilai WINLOSE (ATURAN FINAL, bukan sample!)
   - cashback_deduction = nilai CASHBACK
   - fee_deduction = nilai COMMISION (potongan komisi)
   - net_winlose = nilai WINLOSE BERSIH
   - commission_result = nilai KOMISI Rp (hasil akhir)
   - referral_admin_fee_percentage = FEE % (dari header atau kolom, contoh: 20)
   
   ⚠️ KONTRAK SEMANTIK KUNCI:
   Jika tabel TIDAK mengandung kata "misalkan" atau "contoh",
   maka SEMUA ANGKA di tabel adalah ATURAN FINAL PROMO yang mengikat.
   Referral Bonus TIDAK PERNAH menggunakan "misalkan" - tabel = HUKUM!

5. minimum_base = null (TIDAK ADA threshold winlose eksplisit untuk referral)
   - Kolom WINLOSE di tabel = ATURAN FINAL perhitungan, bukan syarat kualifikasi
   - Threshold tier sebenarnya = min_downline (batas bawah range downline)

6. Tambahkan metadata tier di terms_conditions:
   - "Tier 5%: Minimal 1 ID aktif (range 1-4)"
   - "Tier 10%: Minimal 5 ID aktif (range 5-9)"
   - "Tier 15%: Minimal 10 ID aktif (range 10+)"

OUTPUT FORMAT REFERRAL MULTI-TIER (CORRECT):
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
      "min_downline": 1,
      "max_downline": 4,
      "winlose": 10000000,
      "cashback_deduction": 700000,
      "fee_deduction": 300000,
      "net_winlose": 8500000,
      "commission_result": 425000,
      "max_bonus": null,
      "turnover_rule": null,
      "payout_direction": "belakang",
      "game_types": ["ALL"],
      "confidence": {
        "calculation_value": "explicit",
        "minimum_base": "not_applicable",
        "min_downline": "explicit",
        "winlose": "explicit",
        "turnover_rule": "not_applicable"
      }
    },
    {
      "sub_name": "Komisi 10%",
      "calculation_base": "loss",
      "calculation_method": "percentage",
      "calculation_value": 10,
      "minimum_base": null,
      "min_downline": 5,
      "max_downline": 9,
      "winlose": 50000000,
      "cashback_deduction": 3000000,
      "fee_deduction": 1500000,
      "net_winlose": 42500000,
      "commission_result": 4250000,
      "confidence": {
        "calculation_value": "explicit",
        "minimum_base": "not_applicable",
        "min_downline": "explicit",
        "winlose": "explicit"
      }
    },
    {
      "sub_name": "Komisi 15%",
      "calculation_base": "loss",
      "calculation_method": "percentage",
      "calculation_value": 15,
      "minimum_base": null,
      "min_downline": 10,
      "max_downline": null,
      "winlose": 100000000,
      "cashback_deduction": 7000000,
      "fee_deduction": 3500000,
      "net_winlose": 85000000,
      "commission_result": 12750000,
      "confidence": {
        "calculation_value": "explicit",
        "minimum_base": "not_applicable",
        "min_downline": "explicit",
        "winlose": "explicit"
      }
    }
  ],
  "terms_conditions": [
    "Tier 5%: Minimal 1 ID aktif (range 1-4)",
    "Tier 10%: Minimal 5 ID aktif (range 5-9)",
    "Tier 15%: Minimal 10 ID aktif (range 10+)",
    "Hitungan komisi: Winlose - Commision - Cashback - Admin Fee 20% = hasil x persentase",
    "Admin Fee: 20%"
  ]
}

⚠️ ATURAN KERAS REFERRAL:
- JANGAN merge tier menjadi 1 varian!
- JANGAN skip tier apapun dari tabel!
- 3 baris dengan KOMISI berbeda = 3 subcategories!
- minimum_base = null (TIDAK ada threshold nominal eksplisit!)
- winlose = nilai WINLOSE dari tabel (ini ATURAN FINAL, bukan sample!)
- Kolom WINLOSE/CASHBACK/FEE di tabel = FORMULA RESMI PROMO!
- min_downline = BATAS BAWAH range downline (1 untuk tier pertama, BUKAN nilai commission %)
- max_downline = BATAS ATAS range downline (null untuk tier terakhir "10+" / open-ended)
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

🔢 MODE DETECTION (P4 — WAJIB BACA SEBELUM OUTPUT)

Tentukan mode berdasarkan STRUKTUR MEKANIK promo:

"mode": 
  "tier"    → ada MULTIPLE LEVEL reward dengan requirement berbeda
              Contoh: deposit 100rb bonus 20%, deposit 500rb bonus 30%
              Contoh: 5 downline komisi 5%, 10 downline komisi 10%
  "formula" → SATU formula kalkulasi berlaku untuk semua
              Contoh: bonus 100% dari deposit (flat percentage)
              Contoh: rollingan 0.8% dari total turnover
              Contoh: cashback 5% dari kekalahan
  "fixed"   → reward FLAT tanpa kalkulasi apapun
              Contoh: freebet Rp 50.000 langsung
              Contoh: freechip Rp 100.000 tanpa syarat kalkulasi

⚠️ ATURAN KERAS:
- Jika promo punya TIER LEVELS → mode WAJIB "tier", BUKAN "formula"
- tier_archetype WAJIB diisi jika mode = "tier":
  • Reward dibedakan oleh LEVEL DEPOSIT → tier_archetype: "level"
  • Reward dibedakan oleh JUMLAH DOWNLINE → tier_archetype: "referral"
  • Reward dibedakan oleh JUMLAH TIM PARLAY → tier_archetype: "parlay"
  • Reward dibedakan oleh SALDO POIN → tier_archetype: "point_store"
- tier_archetype = null jika mode ≠ "tier"

📐 TURNOVER BASIS (P2 — WAJIB DIISI jika turnover_enabled = true)

turnover_basis: Basis kalkulasi requirement turnover.
  "bonus_only"        → TO dihitung dari nilai BONUS saja
                        Contoh: "bonus 100rb, TO 8x = wajib TO 800rb"
  "deposit_only"      → TO dihitung dari nilai DEPOSIT saja
                        Contoh: "deposit 500rb, TO 5x = wajib TO 2.5jt"
  "deposit_plus_bonus"→ TO dihitung dari DEPOSIT + BONUS (paling umum)
                        Contoh: "deposit 500rb + bonus 500rb, TO 5x = wajib TO 5jt"
  null                → jika turnover_enabled = false atau tidak ada syarat turnover

🔣 CONVERSION FORMULA (P1 — WAJIB DIISI jika ada mechanic kalkulasi)

conversion_formula: String formula kalkulasi reward utama.
  Contoh deposit bonus:  "min(deposit * 100%, 500000)"
  Contoh rollingan:      "total_turnover * 0.8%"
  Contoh referral tier:  "net_winlose_downline * komisi%"
  Contoh cashback:       "total_loss * cashback%"
  Contoh tier deposit:   "deposit * reward_percentage"
  "" (string kosong) HANYA jika promo benar-benar tidak ada mechanic kalkulasi (misal freebet flat)

🧾 OUTPUT FORMAT (STRICT JSON)
Output HARUS:
- Valid JSON
- TANPA komentar
- TANPA teks tambahan
- Field lengkap walau null

Return HANYA JSON valid tanpa markdown code block.

FORMAT OUTPUT (PHASE 7 - UPDATED WITH MODE + TIER DIMENSION + FORMULA):
{
  "promo_name": "nama promo utama",
  "promo_type": "Welcome Bonus|Deposit Bonus|Withdraw Bonus|Cashback|Rollingan|Referral Bonus|Event Level Up|Mini Game|Freechip|Loyalty Point|Merchandise|Campaign Informational|Birthday Bonus",
  "target_user": "new_member|all|vip",
  "promo_mode": "single|multi",
  "mode": "fixed|formula|tier",
  "tier_archetype": "level|referral|parlay|point_store|null",
  "conversion_formula": "total_turnover * 0.8%",
  "turnover_basis": "bonus_only|deposit_only|deposit_plus_bonus|null",
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
      "tier_dimension": "level|downline_count|team_count|deposit_amount|turnover_amount|point_balance|null",
      "min_dimension_value": 1,
      "max_dimension_value": 4,
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

⚠️ ATURAN tier_dimension PER SUBCATEGORY (P3):
- Jika tier_archetype = "referral" → tier_dimension WAJIB "downline_count"
  min_dimension_value = jumlah downline minimum tier ini
  max_dimension_value = jumlah downline maximum tier ini (null jika tier tertinggi)
- Jika tier_archetype = "level" → tier_dimension WAJIB "level"
  min_dimension_value = nomor level minimum (misal: 1)
  max_dimension_value = nomor level maximum (null jika level tertinggi)
- Jika tier_archetype = "parlay" → tier_dimension = "team_count"
- Jika mode ≠ "tier" → tier_dimension = null, min/max_dimension_value = null

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
 * - Supports HYBRID mode: Image + Text context for best results
 * 
 * @param base64Image - Base64 encoded image data
 * @param textContext - Optional text context (S&K) for hybrid extraction
 */
export async function extractPromoFromImage(
  base64Image: string,
  textContext?: string
): Promise<ExtractedPromo> {
  if (!base64Image) {
    throw new Error("Image data tidak boleh kosong");
  }

  const isHybrid = textContext && textContext.trim().length > 50;
  
  // Build content parts dynamically
  const contentParts: Array<{type: string; text?: string; image_url?: {url: string; detail: string}}> = [];

  // 1. Add text context FIRST if hybrid mode (TEXT = source of truth)
  if (isHybrid) {
    contentParts.push({
      type: "text",
      text: `🔒 KONTEKS TEXT DARI USER (SUMBER KEBENARAN):
---
${textContext!.trim()}
---

⚠️ ATURAN HYBRID EXTRACTION:
1. TEXT MENANG jika ada konflik dengan Image
2. Gunakan TEXT untuk: min_calculation, turnover_rule, terms_conditions, angka %
3. Gunakan IMAGE untuk: layout tabel, struktur subcategory, judul promo
4. Data inti TANPA suffix (%, x, Rp) - UI yang menambahkan nanti`
    });
  }

  // 2. Add main extraction prompt
  contentParts.push({
    type: "text",
    text: `${EXTRACTION_PROMPT}

⚠️ INSTRUKSI KHUSUS - MODE: ${isHybrid ? 'HYBRID (Image + Text)' : 'IMAGE ONLY'}

${isHybrid ? `
🔒 PRIORITAS HYBRID:
- Angka (Min WD, TO, %) → AMBIL DARI TEXT CONTEXT DI ATAS
- Layout & struktur → AMBIL DARI IMAGE
- Jika konflik → TEXT MENANG TANPA DEBAT
- confidence: "explicit" untuk data dari text
` : `
Karena ini IMAGE-ONLY, SEMUA field numerik WAJIB menggunakan:
- confidence: "derived" (BUKAN "explicit")
Alasan: OCR dari image bisa salah baca.
`}

Ekstrak informasi promo dari screenshot berikut. Perhatikan tabel, angka, dan syarat & ketentuan yang terlihat.`
  });

  // 3. Add image
  contentParts.push({
    type: "image_url",
    image_url: {
      url: base64Image,
      detail: "high" // High detail untuk baca tabel/angka kecil
    }
  });

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
          content: contentParts
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
    
    // ============================================
    // CANONICAL GUARD - POST-EXTRACTION ENFORCEMENT (IMAGE)
    // Same as content extraction for consistency
    // ============================================
    try {
      const { enforceCanonicalGuard } = await import('./canonical-guard');
      const guardResult = enforceCanonicalGuard(downgraded as unknown as Record<string, unknown>);
      
      if (!guardResult.valid) {
        console.warn('[extractPromoFromImage] CANONICAL GUARD warnings:', guardResult.errors);
        (downgraded._extraction_meta as Record<string, unknown>).canonical_guard_warnings = guardResult.errors;
      }
    } catch (guardError) {
      console.warn('[extractPromoFromImage] Canonical guard failed (non-fatal):', guardError);
    }
    
    // Tag extraction source for normalizer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (downgraded as any)._source_type = 'image';
    
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
  // STEP -1: REJECT GATE (L1 rule-based → L2 LLM lightweight)
  // Discard garbage input BEFORE spending classifier tokens.
  // L1 = instant regex, L2 = gpt-4o-mini with 120-token cap.
  // ============================================
  const { runRejectGate } = await import('./reject-gate');
  const rejectResult = await runRejectGate(content);
  if (!rejectResult.valid && rejectResult.reason !== 'L2_ERROR_PASS') {
    const msg = rejectResult.reason === 'L1_NO_PROMO_SIGNAL'
      ? 'Input tidak mengandung sinyal promo yang cukup (butuh angka + kata kunci reward + mechanic)'
      : rejectResult.reason === 'L1_TOO_SHORT'
      ? 'Input terlalu pendek untuk diekstrak sebagai promo'
      : `Input ditolak oleh validator: ${rejectResult.l2_reason ?? rejectResult.reason}`;
    throw new Error(`[REJECT_GATE] ${msg}`);
  }
  console.log(`[Extractor] RejectGate PASS (level=${rejectResult.level}, hint=${rejectResult.promo_type_hint ?? 'n/a'})`);

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
  // STEP 0.75: PROMO INTENT REASONING (Reasoning-First Architecture v2.0)
  // LLM answers 6 core questions BEFORE extraction
  // This determines mechanic type and locked fields
  // ============================================
  let promoIntent: PromoIntent | null = null;
  let mechanicResult: MechanicRouterResult | null = null;

  try {
    console.log('[Extractor] Starting Step-0.75: Promo Intent Reasoning...');
    promoIntent = await reasonPromoIntent(normalizedContent);
    
    console.log('[Extractor] Promo Intent Result:', {
      primary_action: promoIntent.primary_action,
      reward_nature: promoIntent.reward_nature,
      distribution_path: promoIntent.distribution_path,
      value_shape: promoIntent.value_shape,
      confidence: promoIntent.confidence,
      evidence_count: promoIntent.intent_evidence.length,
    });
    
    // Route to mechanic and get locked fields
    mechanicResult = routeMechanic(promoIntent);
    console.log('[Extractor] Mechanic Router Result:', {
      mechanic_type: mechanicResult.mechanic_type,
      mode: mechanicResult.locked_fields.mode,
      calculation_basis: mechanicResult.locked_fields.calculation_basis,
      reward_is_percentage: mechanicResult.locked_fields.reward_is_percentage,
      invariant_violations: mechanicResult.invariant_violations,
    });
    
  } catch (intentError) {
    console.warn('[Extractor] Intent reasoning failed, continuing with legacy flow:', intentError);
    // Non-fatal: continue without Step-0.75 (fallback to legacy behavior)
  }

  // ============================================
  // STEP 0.85: ARBITRATION - Resolve conflicts between Q1-Q4 and Step-0
  // Step-0 WINS for operational fields (mode, calculation_basis, reward_is_percentage)
  // Q1-Q4 WINS for classification fields (category, intent_category, UI routing)
  // ============================================
  let arbitrationResult: ArbitrationResult | null = null;

  if (classificationResult && promoIntent && mechanicResult) {
    try {
      arbitrationResult = arbitrate({
        classification: classificationResult,
        intent: promoIntent,
        mechanic: mechanicResult,
      });
      
      console.log('[Extractor] Arbitration Result:', {
        final_mode: arbitrationResult.mode,
        final_calc_basis: arbitrationResult.calculation_basis,
        mechanic_type: arbitrationResult.mechanic_type,
        conflicts: arbitrationResult.conflicts.length,
        needs_human_review: arbitrationResult.needs_human_review,
      });
    } catch (arbError) {
      console.warn('[Extractor] Arbitration failed:', arbError);
    }
  }

  // ============================================
  // BUILD LOCKED FIELDS CONTEXT FOR LLM
  // This guides the LLM, but code will override after extraction
  // ============================================
  let lockedFieldsContext = '';
  if (mechanicResult?.locked_fields) {
    const locks = mechanicResult.locked_fields;
    lockedFieldsContext = `

⚠️ FIELD TERKUNCI OLEH SISTEM (Reasoning-First Architecture v2.0):
Sistem telah menentukan tipe mekanik promo ini berdasarkan reasoning.

- mechanic_type: ${mechanicResult.mechanic_type} (${getMechanicDisplayName(mechanicResult.mechanic_type)})
- mode: ${locks.mode} (${locks.mode_reason})
- calculation_basis: ${locks.calculation_basis === null ? 'NULL (tidak ada kalkulasi)' : locks.calculation_basis}
- reward_is_percentage: ${locks.reward_is_percentage}

⚠️ PENTING: Jangan mengubah nilai field di atas. Fokus pada ekstraksi field lainnya.
Field yang TERKUNCI akan di-override oleh sistem setelah extraction.`;
  }

  const enhancedPromptWithLocks = `${extractionPromptWithCount}${lockedFieldsContext}`;

  // ============================================
  // STEP 1: AI Extraction - NOW RECEIVES CLEAN HTML + LOCKED FIELDS CONTEXT
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
        { role: "system", content: enhancedPromptWithLocks },
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
    
    // ============================================
    // STEP POST-EXTRACTION: APPLY LOCKED FIELDS (CODE ENFORCED)
    // This is the HARD OVERRIDE from Reasoning-First Architecture v2.0
    // These values override LLM output regardless of what LLM returned
    // ============================================
    if (mechanicResult?.locked_fields) {
      const locks = mechanicResult.locked_fields;
      
      console.log('[Extractor] Applying LOCKED FIELDS from Reasoning-First Architecture...');
      
      // Override promo_mode (mode)
      if (locks.mode !== undefined) {
        const oldMode = (parsed as any).promo_mode || (parsed as any).reward_mode;
        (parsed as any).promo_mode = locks.mode;
        (parsed as any).reward_mode = locks.mode; // Legacy alias
        console.log(`[Extractor] LOCKED mode: ${oldMode} → ${locks.mode}`);
      }
      
      // Override calculation_basis / calculation_base
      if (locks.calculation_basis !== undefined) {
        const oldCalcBasis = (parsed as any).calculation_base || (parsed as any).calculation_basis;
        (parsed as any).calculation_base = locks.calculation_basis;
        (parsed as any).calculation_basis = locks.calculation_basis;
        
        // Also apply to subcategories
        parsed.subcategories = parsed.subcategories?.map((sub: any) => ({
          ...sub,
          calculation_base: locks.calculation_basis,
          confidence: {
            ...sub.confidence,
            calculation_base: locks.calculation_basis === null ? 'not_applicable' : 'derived'
          }
        })) || [];
        
        console.log(`[Extractor] LOCKED calculation_basis: ${oldCalcBasis} → ${locks.calculation_basis}`);
      }
      
      // Override reward_is_percentage
      if (locks.reward_is_percentage !== undefined) {
        const oldIsPercentage = (parsed as any).reward_is_percentage;
        (parsed as any).reward_is_percentage = locks.reward_is_percentage;
        
        // Also update calculation_method in subcategories
        parsed.subcategories = parsed.subcategories?.map((sub: any) => ({
          ...sub,
          calculation_method: locks.reward_is_percentage ? 'percentage' : 'fixed'
        })) || [];
        
        console.log(`[Extractor] LOCKED reward_is_percentage: ${oldIsPercentage} → ${locks.reward_is_percentage}`);
      }
      
      // Store mechanic_type for display/audit
      (parsed as any).mechanic_type = mechanicResult.mechanic_type;
      (parsed as any).mechanic_display_name = getMechanicDisplayName(mechanicResult.mechanic_type);
      
      // ========================================
      // SPECIAL: APK DOWNLOAD PROMO OVERRIDES
      // If mechanic is apk_download_reward, enforce specific fields
      // ========================================
      if (mechanicResult.mechanic_type === 'apk_download_reward') {
        console.log('[Extractor] APK Download promo detected → applying special overrides');
        
        // require_apk MUST be true
        (parsed as any).require_apk = true;
        
        // trigger_event MUST be APK related
        if (!(parsed as any).trigger_event || (parsed as any).trigger_event === 'Login') {
          (parsed as any).trigger_event = 'Download APK';
        }
        
        // calculation_basis MUST be null (no formula)
        (parsed as any).calculation_base = null;
        (parsed as any).calculation_basis = null;
        
        // ✅ GATE-BASED: Mode comes from primitive gate
        // APK is CONSTRAINT, NOT mode determinant
        // Mode is NOT changed here - Gate already decided correctly
        // (Removed hardcoded override to 'event')
        
        console.log('[Extractor] APK overrides applied:', {
          require_apk: true,
          trigger_event: (parsed as any).trigger_event,
          mode: (parsed as any).promo_mode,
        });
      }
      
      // ========================================
      // SPECIAL: BIRTHDAY PROMO OVERRIDES
      // ========================================
      if (mechanicResult.mechanic_type === 'birthday_reward') {
        (parsed as any).trigger_event = 'Birthday';
        console.log('[Extractor] Birthday promo → trigger_event = Birthday');
      }
      
      // ========================================
      // SPECIAL: FREECHIP / VOUCHER OVERRIDES
      // ========================================
      if (['voucher_exchange', 'point_redeem'].includes(mechanicResult.mechanic_type)) {
        (parsed as any).calculation_base = null;
        (parsed as any).calculation_basis = null;
        console.log('[Extractor] Voucher/Point promo → calculation_basis = null');
      }
    }
    
    // ============================================
    // STEP: SET HUMAN REVIEW FLAG FROM REASONING
    // Based on confidence and arbitration results
    // ============================================
    if (promoIntent && promoIntent.confidence < 0.6) {
      parsed.ready_to_commit = false;
      (parsed as any).needs_human_review = true;
      (parsed as any).review_reason = `Intent confidence too low: ${promoIntent.confidence.toFixed(2)}`;
      console.log('[Extractor] LOW CONFIDENCE → needs human review');
    }
    
    if (arbitrationResult?.needs_human_review) {
      parsed.ready_to_commit = false;
      (parsed as any).needs_human_review = true;
      (parsed as any).review_reason = arbitrationResult.review_reason;
      console.log('[Extractor] ARBITRATION → needs human review:', arbitrationResult.review_reason);
    }
    
    // ============================================
    // STEP: STORE AUDIT TRAIL DIRECTLY ON ExtractedPromo
    // For debugging, transparency, and use by mapExtractedToPromoFormData
    // ============================================
    (parsed as any)._reasoning_v2 = {
      promo_intent: promoIntent ? {
        primary_action: promoIntent.primary_action,
        reward_nature: promoIntent.reward_nature,
        value_determiner: promoIntent.value_determiner,
        time_scope: promoIntent.time_scope,
        distribution_path: promoIntent.distribution_path,
        value_shape: promoIntent.value_shape,
        intent_evidence: promoIntent.intent_evidence,
        confidence: promoIntent.confidence,
        reasoner_version: promoIntent.reasoner_version,
      } : null,
      mechanic_selection: mechanicResult ? {
        mechanic_type: mechanicResult.mechanic_type,
        locked_fields: mechanicResult.locked_fields,
        invariant_violations: mechanicResult.invariant_violations,
        router_version: mechanicResult.router_version,
      } : null,
      arbitration: arbitrationResult ? {
        mode: arbitrationResult.mode,
        calculation_basis: arbitrationResult.calculation_basis,
        mechanic_type: arbitrationResult.mechanic_type,
        conflicts: arbitrationResult.conflicts,
        needs_human_review: arbitrationResult.needs_human_review,
        review_reason: arbitrationResult.review_reason,
        arbitration_version: arbitrationResult.arbitration_version,
      } : null,
    };

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
    
    // NOTE: Canonical guard intentionally NOT run here.
    // This function returns raw LLM output (ExtractedPromo) — tiers[] and other
    // form fields are only populated AFTER mapExtractedToPromoFormData().
    // Running the guard here produces false alarms (e.g. "mode=tier but tiers[] empty").
    // Guard should be run on buildCanonicalPayload() output instead.
    
    // Tag extraction source for normalizer (HTML/text detection)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (parsed as any)._source_type = content.includes('<html') || content.includes('<table') ? 'html' : 'text';
    
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
 * Build CleanedEvidence from ExtractedPromo for Taxonomy Pipeline
 * This feeds the taxonomy SSoT
 */
function buildCleanedEvidence(extracted: ExtractedPromo): CleanedEvidence {
  const promoName = extracted.promo_name || '';
  const terms = [
    ...(extracted.terms_conditions || []),
    extracted.promo_type || '',
    ...(extracted.subcategories?.map(s => s.sub_name || '') || [])
  ].join(' ');
  
  return cleanEvidence(promoName, terms);
}

/**
 * Merge taxonomy decision with existing data
 * Taxonomy fields are LOCKED — cannot be overridden
 */
function mergeWithTaxonomyLock(
  taxonomyDecision: TaxonomyDecision,
  existingData: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...existingData };
  
  // === LOCKED FIELDS FROM TAXONOMY (SSoT) ===
  result.reward_mode = taxonomyDecision.mode;
  result.mode = taxonomyDecision.mode; // Alias
  
  if (taxonomyDecision.calculation_basis) {
    result.calculation_base = taxonomyDecision.calculation_basis;
    result.calculation_basis = taxonomyDecision.calculation_basis;
  }
  
  if (taxonomyDecision.payout_direction) {
    result.payout_direction = taxonomyDecision.payout_direction === 'before' 
      ? 'depan' 
      : 'belakang';
    result.global_payout_direction = taxonomyDecision.payout_direction;
  }
  
  if (taxonomyDecision.trigger_event) {
    result.trigger_event = taxonomyDecision.trigger_event;
  }
  
  // === AUDIT TRAIL ===
  result._taxonomy_decision = {
    archetype: taxonomyDecision.archetype,
    confidence: taxonomyDecision.confidence,
    version: taxonomyDecision.taxonomy_version,
    timestamp: taxonomyDecision.decision_timestamp,
    evidence: taxonomyDecision.evidence_summary,
    ambiguity_flags: taxonomyDecision.ambiguity_flags,
  };
  
  // === APPLY ADDITIONAL DERIVED FIELDS ===
  for (const [key, value] of Object.entries(taxonomyDecision.derivedFields)) {
    // Skip locked fields (already applied)
    if (!TAXONOMY_LOCKED_FIELDS.includes(key as typeof TAXONOMY_LOCKED_FIELDS[number])) {
      result[key] = value;
    }
  }
  
  return result;
}

// ============================================
// UNIVERSAL ENRICHMENT HELPERS v1.0
// Shared functions for ALL archetypes — pattern-based, not hardcoded per promo
// ============================================

type TurnoverBasisResult = {
  basis: 'bonus_only' | 'deposit_plus_bonus' | 'deposit_only' | null;
  has_turnover: boolean;
  ambiguity: boolean;
};

/**
 * Universal turnover basis detection from extracted fields + terms text.
 * Works for ALL archetypes: Lucky Draw, Competition, Deposit Bonus, Cashback, Referral, etc.
 */
function detectTurnoverBasis(
  extracted: ExtractedPromo,
  termsText: string,
): TurnoverBasisResult {
  // turnover_rule lives on subcategories, not parent
  const subTurnover = extracted.subcategories?.some(
    (s) => s.turnover_rule != null && s.turnover_rule > 0
  );
  const hasTurnover = !!(
    subTurnover ||
    /turn\s*over|turnover|to\s*x?\s*\d|syarat\s*to\b/i.test(termsText)
  );

  if (!hasTurnover) {
    return { basis: null, has_turnover: false, ambiguity: false };
  }

  // Try to resolve basis from terms evidence
  if (/deposit\s*\+?\s*bonus/i.test(termsText)) {
    return { basis: 'deposit_plus_bonus', has_turnover: true, ambiguity: false };
  }
  if (/bonus\s*saja|hanya\s*bonus|from\s*bonus\s*only/i.test(termsText)) {
    return { basis: 'bonus_only', has_turnover: true, ambiguity: false };
  }
  if (/deposit\s*saja|hanya\s*deposit|deposit\s*only/i.test(termsText)) {
    return { basis: 'deposit_only', has_turnover: true, ambiguity: false };
  }

  // Pattern: "Bonus RpX → TO = RpX × N" (basis = bonus amount, not deposit)
  if (/bonus\s*(?:dari\s*)?(?:lucky\s*spin\s*)?rp[\d.,]+\s*[→\->]+\s*(?:turn\s*over|to)\s*(?:yang\s*)?/i.test(termsText) ||
      /(?:turn\s*over|to)\s*=\s*(?:bonus|rp[\d.,]+)\s*[×x]\s*\d/i.test(termsText)) {
    return { basis: 'bonus_only', has_turnover: true, ambiguity: false };
  }

  // TO exists but basis not determinable → flag ambiguity
  return { basis: null, has_turnover: true, ambiguity: true };
}

/**
 * Universal claim channel extraction from terms text + extracted claim_method.
 * Works for ALL archetypes — channels are not exclusive to any single promo type.
 */
function extractClaimChannels(
  termsText: string,
  extracted: ExtractedPromo,
): string[] {
  const channels: string[] = [];
  if (/telegram/i.test(termsText)) channels.push('telegram');
  if (/livechat|live\s*chat/i.test(termsText)) channels.push('livechat');
  if (/whatsapp|wa\b/i.test(termsText)) channels.push('whatsapp');
  if (/\bline\b/i.test(termsText)) channels.push('line');
  if (/\bcs\b|customer\s*service/i.test(termsText)) channels.push('customer_service');
  if (extracted.claim_method) {
    const cm = extracted.claim_method;
    if (/telegram/i.test(cm)) channels.push('telegram');
    if (/livechat|live\s*chat/i.test(cm)) channels.push('livechat');
    if (/whatsapp|wa\b/i.test(cm)) channels.push('whatsapp');
    if (/\bline\b/i.test(cm)) channels.push('line');
    if (/\bcs\b|customer\s*service/i.test(cm)) channels.push('customer_service');
  }
  return [...new Set(channels)];
}

/**
 * Universal proof requirement extraction from terms text.
 * Works for ALL archetypes — proof requirements are cross-promo.
 */
function extractProofRequirements(termsText: string): string[] {
  const proofs: string[] = [];
  if (/screenshot\s*(?:hadiah|prize|kemenangan|winning)/i.test(termsText)) {
    proofs.push('screenshot_prize');
  } else if (/screenshot\s*(?:deposit|setor)/i.test(termsText)) {
    proofs.push('screenshot_deposit');
  } else if (/screenshot|bukti|ss\b|foto\s*bukti|proof/i.test(termsText)) {
    proofs.push('screenshot_general');
  }
  return proofs;
}

/**
 * Universal deposit requirement extraction with accumulative detection.
 * Works for ALL archetypes that have deposit requirements.
 */
function extractDepositRequirement(
  extracted: ExtractedPromo,
  termsText: string,
): { amount: number; note: string | null; is_accumulative: boolean } | null {
  const amount = extracted.min_deposit ?? extracted.subcategories?.[0]?.minimum_base ?? null;
  if (amount == null) return null;

  const isAccumulative = /akumulatif|kumulatif|accumulated|akumulasi/i.test(termsText);
  const note = extracted.min_deposit_note || null;

  return { amount, note, is_accumulative: isAccumulative };
}

// ============================================
// ARCHETYPE PAYLOAD BUILDER v2.0
// Uses shared enrichment helpers — universal for ALL archetypes
// ============================================

/**
 * Build archetype_payload from ExtractedPromo for any archetype with a payload_contract.
 * Returns { archetype_payload, turnover_basis, archetype_invariants } or null if not applicable.
 */
function buildArchetypePayloadFromExtracted(
  extracted: ExtractedPromo,
  archetype: string,
): { 
  archetype_payload: Record<string, unknown>; 
  turnover_basis: 'bonus_only' | 'deposit_plus_bonus' | 'deposit_only' | null;
  archetype_invariants: Record<string, unknown>;
} | null {
  const contract = getPayloadContract(archetype);
  if (!contract) return null;

  const termsText = (extracted.terms_conditions || []).join(' ');
  const sub0 = extracted.subcategories?.[0];

  // === SHARED ENRICHMENT (applied to ALL archetypes) ===
  const turnoverResult = detectTurnoverBasis(extracted, termsText);
  const claimChannels = extractClaimChannels(termsText, extracted);
  const proofRequired = extractProofRequirements(termsText);
  const depositRequirement = extractDepositRequirement(extracted, termsText);

  if (archetype === 'LUCKY_DRAW') {
    // --- Extract spin_limit ---
    const spinLimit = sub0?.lucky_spin_max_per_day ?? (() => {
      const m = termsText.match(/(?:maksimal|max)\s*(?:claim|klaim|spin)?\s*(\d+)/i);
      return m ? parseInt(m[1], 10) : null;
    })();

    // --- Extract daily_reset_time from terms ---
    const resetMatch = termsText.match(
      /(?:di\s*)?reset\s*(?:pada\s*)?(?:pukul|jam)\s*(\d{1,2}[:.]\d{2})/i
    ) || termsText.match(
      /(?:dimulai|mulai)\s*(?:pukul|jam)?\s*(\d{1,2}[:.]\d{2})/i
    ) || termsText.match(
      /(?:pukul|jam)\s*(\d{1,2}[:.]\d{2})\s*(?:wib|wit|wita)/i
    );
    const dailyResetTime = resetMatch 
      ? resetMatch[1].replace('.', ':') + (/wib/i.test(termsText) ? ' WIB' : '')
      : null;

    // --- Extract claim_window ---
    const windowTimeMatch = termsText.match(/(?:berlaku|valid|klaim)\s*(?:hingga|sampai|s\.?d\.?)\s*(\d{1,2}[:.]\d{2})/i);
    const claimWindow = windowTimeMatch 
      ? { end: windowTimeMatch[1].replace('.', ':') } 
      : /(?:diklaim|klaim)\s*(?:di\s*)?(?:akhir|penghujung)\s*hari/i.test(termsText)
        ? { end: 'end_of_day' }
        : /(?:hari\s*yang\s*sama|same\s*day)/i.test(termsText)
          ? { end: 'same_day' }
          : null;

    // --- Collection mechanic ---
    const collectionMechanic = sub0?.reward_type === 'lucky_spin' ? 'spin' 
      : sub0?.reward_type === 'ticket' ? 'ticket_collect'
      : 'spin';

    // --- Collection requirement (hybrid spin + collect) ---
    let collectionRequirement: Record<string, unknown> | null = null;
    const collectMatch = termsText.match(
      /(?:kumpulkan|mengumpulkan|collect)\s*(\d+)\s*(?:gambar|image|item)/i
    );
    if (collectMatch) {
      const count = parseInt(collectMatch[1], 10);
      const periodMatch = termsText.match(
        /(?:batas\s*waktu|dalam|within)\s*[:.]?\s*(\d+)\s*(bulan|hari|minggu|month|day|week)/i
      );
      
      // Extract eligible reward items (e.g., "Handphone, Laptop, & Emas")
      const rewardItemsMatch = termsText.match(
        /(?:gambar\s*(?:dari\s*)?(?:lucky\s*spin\s*)?seperti)\s*([^.;]+)/i
      );
      const eligibleRewards = rewardItemsMatch 
        ? rewardItemsMatch[1]
            .split(/[,&]/)
            .map(s => s.trim().toLowerCase())
            .filter(Boolean)
        : [];
      
      // Detect "yang sama" = require same image
      const requireSame = /gambar\s*(?:yang\s*)?sama/i.test(termsText);
      
      collectionRequirement = {
        same_image_count: count,
        collection_period: periodMatch 
          ? `${periodMatch[1]}_${periodMatch[2].replace('bulan','month').replace('hari','day').replace('minggu','week')}` 
          : null,
        require_same_image: requireSame,
        eligible_rewards: eligibleRewards.length > 0 ? eligibleRewards : undefined,
        reward_condition: `${count}_identical_images`,
      };
    }

    const payload: Record<string, unknown> = {
      spin_limit: spinLimit,
      deposit_requirement: depositRequirement,
      daily_reset_time: dailyResetTime,
      claim_window: claimWindow,
      collection_mechanic: collectionMechanic,
      collection_requirement: collectionRequirement,
    };

    // Shared enrichment fields
    if (claimChannels.length > 0) payload.claim_channels = claimChannels;
    if (proofRequired.length > 0) payload.proof_required = proofRequired;
    if (turnoverResult.ambiguity) payload.turnover_ambiguity = true;

    return {
      archetype_payload: payload,
      turnover_basis: turnoverResult.basis,
      archetype_invariants: {
        mode_must_be: 'fixed',
        no_calculation_basis: true,
      },
    };
  }

  if (archetype === 'COMPETITION') {
    // --- Event period ---
    const eventPeriod: Record<string, unknown> = {
      valid_from: extracted.valid_from || null,
      valid_until: extracted.valid_until || null,
    };

    // --- Prize structure from extracted prizes ---
    const prizeStructure: unknown[] = [];
    if (extracted.prizes?.length) {
      for (const p of extracted.prizes) {
        prizeStructure.push({
          rank: p.rank,
          prize: p.prize,
          value: p.value,
          reward_type: p.reward_type || detectRewardType(p.prize, p.physical_reward_name, p.cash_reward_amount),
        });
      }
    } else if (extracted.subcategories?.length > 1) {
      for (const sub of extracted.subcategories) {
        prizeStructure.push({
          rank: sub.sub_name,
          prize: sub.physical_reward_name || `${sub.max_bonus || sub.calculation_value}`,
          value: sub.cash_reward_amount || sub.max_bonus || sub.calculation_value,
          reward_type: sub.reward_type || 'credit_game',
        });
      }
    }

    const payload: Record<string, unknown> = {
      event_period: eventPeriod,
      prize_structure: prizeStructure,
      deposit_requirement: depositRequirement,
    };

    // Optional keys
    const resetMatch = termsText.match(/(?:reset|dimulai)\s*(?:setiap)?\s*(senin|selasa|rabu|kamis|jumat|sabtu|minggu|harian|mingguan)/i);
    if (resetMatch) {
      payload.reset_rules = { frequency: resetMatch[1].toLowerCase() };
    }

    // Shared enrichment fields
    if (claimChannels.length > 0) payload.claim_channels = claimChannels;
    if (proofRequired.length > 0) payload.proof_required = proofRequired;
    if (turnoverResult.ambiguity) payload.turnover_ambiguity = true;

    return {
      archetype_payload: payload,
      turnover_basis: turnoverResult.basis,
      archetype_invariants: {
        mode_must_be: 'tier',
        tier_count_min: 1,
      },
    };
  }

  // === GENERIC ARCHETYPE FALLBACK ===
  // For any archetype with a payload_contract but no specific handler above,
  // still populate shared enrichment fields
  const payload: Record<string, unknown> = {
    deposit_requirement: depositRequirement,
  };
  if (claimChannels.length > 0) payload.claim_channels = claimChannels;
  if (proofRequired.length > 0) payload.proof_required = proofRequired;
  if (turnoverResult.ambiguity) payload.turnover_ambiguity = true;

  return {
    archetype_payload: payload,
    turnover_basis: turnoverResult.basis,
    archetype_invariants: {},
  };
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
export function mapExtractedToPromoFormData(extracted: ExtractedPromo, source?: ExtractionSource): PromoFormData {
  // ============================================
  // TAXONOMY PIPELINE v1.0 — SINGLE SOURCE OF TRUTH
  // Runs BEFORE any other mode/field logic
  // ============================================
  const taxonomyEvidence = buildCleanedEvidence(extracted);
  const taxonomyDecision = runTaxonomyPipeline(taxonomyEvidence);
  const useTaxonomy = shouldUseTaxonomy(taxonomyDecision);
  
  console.log('[TAXONOMY PIPELINE]', {
    archetype: taxonomyDecision.archetype,
    confidence: taxonomyDecision.confidence,
    mode: taxonomyDecision.mode,
    useTaxonomy,
    calculation_basis: taxonomyDecision.calculation_basis,
  });

  // ============================================
  // PRIORITY 0: Extract locked fields from Reasoning-First Architecture
  // These OVERRIDE all other sources (keyword defaults, LLM extraction)
  // ============================================
  const reasoningV2 = extracted._reasoning_v2;
  
  // Cast to LockedFields type to access all fields including v3.0 additions
  const lockedFields = reasoningV2?.mechanic_selection?.locked_fields as LockedFields | undefined;
  const mechanicType = reasoningV2?.mechanic_selection?.mechanic_type;
  
  // Detect extraction source if not provided
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractionSource: ExtractionSource = source || 
    ((extracted as any)._source_type as ExtractionSource) || 
    'html';  // Default to 'html' as it's most common
  
  // Log if locked fields exist
  if (lockedFields) {
    console.log('[mapExtractedToPromoFormData] Using locked fields from Reasoning-First:', {
      mode: lockedFields.mode,
      calculation_basis: lockedFields.calculation_basis,
      trigger_event: lockedFields.trigger_event,
      require_apk: lockedFields.require_apk,
      mechanic_type: mechanicType,
      source: extractionSource,
    });
  }
  
  // Log if locked fields exist
  if (lockedFields) {
    console.log('[mapExtractedToPromoFormData] Using locked fields from Reasoning-First:', {
      mode: lockedFields.mode,
      calculation_basis: lockedFields.calculation_basis,
      trigger_event: lockedFields.trigger_event,
      require_apk: lockedFields.require_apk,
      mechanic_type: mechanicType,
      source: extractionSource,
    });
  }


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
    // ✅ Withdraw Bonus synonyms for badge display
    'withdraw bonus': 'Withdraw Bonus',
    'bonus withdraw': 'Withdraw Bonus',
    'bonus wd': 'Withdraw Bonus',
    'extra wd': 'Withdraw Bonus',
    'bonus extra wd': 'Withdraw Bonus',
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
    'download_apk': 'Download APK',  // Added for Step-0 output
    'turnover': 'Turnover',
    'withdraw': 'Withdraw',          // Added for withdraw-based promos
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

  // ============================================
  // APK MIN/MAX BONUS RANGE PARSER (v1.2)
  // Extracts min/max bonus from subcategory names like "Credit Game 5rb", "20K"
  // ============================================
  const parseIDRFromText = (text: string | undefined): number | null => {
    if (!text) return null;
    
    // Patterns: 5K, 5rb, 5ribu, Rp 5.000, Rp5000, 20rb, 20K, 5 ribu, 20 rb
    const patterns = [
      /(?:rp\.?\s*)?([0-9.,]+)\s*(?:rb|ribu|k)/i,           // 5rb, 5K, Rp 5rb
      /(?:rp\.?\s*)([0-9]{1,3}(?:[.,][0-9]{3})+)/i,         // Rp 5.000, Rp20.000
      /(?:rp\.?\s*)([0-9]{4,})/i,                            // Rp5000, Rp20000
      /([0-9]+)\s*(?:ribu|rb|k)/i,                           // 5 ribu, 20 rb
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let numStr = match[1].replace(/\./g, '').replace(/,/g, '');
        let amount = parseInt(numStr, 10);
        
        // Handle shorthand: if pattern includes rb/ribu/k suffix, multiply by 1000
        if (/rb|ribu|k/i.test(match[0]) && amount < 1000) {
          amount *= 1000;
        }
        // Handle missing thousands (small numbers like 5 or 20 assume *1000)
        else if (amount <= 100 && /rb|ribu|k/i.test(text)) {
          amount *= 1000;
        }
        
        if (amount > 0 && amount < 100_000_000) {  // Sanity check: max 100jt
          return amount;
        }
      }
    }
    
    return null;
  };

  // ============================================
  // APK PROMO DETECTION (for range extraction)
  // ============================================
  const promoNameLower = (extracted.promo_name || '').toLowerCase();
  const termsLower = (extracted.terms_conditions || []).join(' ').toLowerCase();
  const isApkLikePromo = 
    lockedFields?.trigger_event === 'APK Download' ||
    lockedFields?.require_apk === true ||
    /apk|download|aplikasi|freechip|freebet/i.test(promoNameLower) ||
    /apk|download|aplikasi/i.test(termsLower);

  // ============================================
  // EXTRACT APK BONUS RANGE (if applicable)
  // Parses amounts from subcategory names to compute min/max
  // ============================================
  let apkBonusRange: { min: number | null; max: number | null } = { min: null, max: null };
  
  if (isApkLikePromo && extracted.subcategories?.length > 0) {
    const parsedAmounts: number[] = [];
    
    extracted.subcategories.forEach(sub => {
      // Try to parse from sub_name
      const fromName = parseIDRFromText(sub.sub_name);
      if (fromName) parsedAmounts.push(fromName);
      
      // Also try from max_bonus if it exists
      if (sub.max_bonus && sub.max_bonus > 0) {
        parsedAmounts.push(sub.max_bonus);
      }
      
      // Try from cash_reward_amount
      if (sub.cash_reward_amount && sub.cash_reward_amount > 0) {
        parsedAmounts.push(sub.cash_reward_amount);
      }
    });
    
    // Also scan terms for range patterns: "5K-20K", "5rb sampai 20rb"
    const rangePattern = /([0-9]+)\s*(?:k|rb|ribu)?\s*[-–~sampai]\s*([0-9]+)\s*(?:k|rb|ribu)?/i;
    const rangeMatch = (promoNameLower + ' ' + termsLower).match(rangePattern);
    if (rangeMatch) {
      let minVal = parseInt(rangeMatch[1], 10);
      let maxVal = parseInt(rangeMatch[2], 10);
      // Assume thousands if small
      if (minVal <= 100) minVal *= 1000;
      if (maxVal <= 100) maxVal *= 1000;
      parsedAmounts.push(minVal, maxVal);
    }
    
    if (parsedAmounts.length > 0) {
      apkBonusRange = {
        min: Math.min(...parsedAmounts),
        max: Math.max(...parsedAmounts),
      };
      console.log('[APK Range Parser] Extracted bonus range:', apkBonusRange);
    }
  }

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
      // ✅ V1.2.1: APK Fixed promos use "fixed" method, not percentage
      calculation_method: (() => {
        if (isApkLikePromo && lockedFields?.mode === 'fixed') return 'fixed';
        return sub.calculation_method || 'percentage';
      })(),
      calculation_method_enabled: true,
      // ✅ V1.2.1: For APK Fixed promos, populate calculation_value from parsed name
      calculation_value: (() => {
        // Priority 1: Explicit from LLM
        if (sub.calculation_value && sub.calculation_value > 0) return sub.calculation_value;
        
        // Priority 2: For APK Fixed promos, use parsed reward amount
        if (isApkLikePromo && lockedFields?.mode === 'fixed') {
          const parsed = parseIDRFromText(sub.sub_name);
          if (parsed && parsed > 0) return parsed;
        }
        
        return 0;
      })(),
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
      // ✅ V1.2: APK promo - parse max_bonus from sub_name if not explicit
      max_bonus: (() => {
        // Priority 1: Explicit max_bonus from LLM
        if (sub.max_bonus && sub.max_bonus > 0) return sub.max_bonus;
        
        // Priority 2: For APK promos, parse from sub_name
        if (isApkLikePromo) {
          const parsed = parseIDRFromText(sub.sub_name);
          if (parsed && parsed > 0) return parsed;
        }
        
        return 0;
      })(),
      // ✅ V1.2: APK promos should NOT be unlimited if we parsed a range
      max_bonus_unlimited: (() => {
        // For APK promos with parsed range, NOT unlimited
        if (isApkLikePromo && apkBonusRange.max !== null) {
          return false;
        }
        return sub.max_bonus === null;
      })(),
      // ✅ V1.2: APK promos have NO payout direction
      payout_direction_same_as_global: isApkLikePromo ? true : !sub.payout_direction,
      payout_direction: isApkLikePromo ? 'after' : (sub.payout_direction === 'depan' ? 'before' : 'after'),
      
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
      // ✅ V1.2: APK promo - parse max from sub_name if not explicit
      dinamis_max_claim: (() => {
        if (sub.max_bonus && sub.max_bonus > 0) return sub.max_bonus;
        if (isApkLikePromo) {
          const parsed = parseIDRFromText(sub.sub_name);
          if (parsed && parsed > 0) return parsed;
        }
        return 0;
      })(),
      // ✅ V1.2: APK promos should NOT be unlimited if we parsed a range
      dinamis_max_claim_unlimited: (() => {
        if (isApkLikePromo && apkBonusRange.max !== null) {
          return false;
        }
        return sub.max_bonus === null;
      })(),
      // 🔒 ONTOLOGY FIX: Map min_claim (payout threshold) ke min_reward_claim
      // min_reward_claim = minimal bonus untuk DICAIRKAN (bukan syarat kualifikasi)
      // minimum_base = syarat minimal untuk IKUT promo (eligibility)
      // Ini adalah 2 field BERBEDA!
      min_reward_claim: sub.min_claim || sub.payout_threshold || null,  // ✅ null instead of 0
      min_reward_claim_enabled: !!(sub.min_claim || sub.payout_threshold),
    };
  });

  // Check if any subcategory has unlimited max_bonus
  // ✅ V1.2: APK promos with parsed range are NOT unlimited
  const hasUnlimitedMaxBonus = isApkLikePromo && apkBonusRange.max !== null 
    ? false 
    : extracted.subcategories.some(sub => sub.max_bonus === null);

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
    
    // Priority 0: Chance-based promos = always setelah_syarat
    // Lucky Spin, Gacha, dll → player claims after meeting requirements
    // Never "hari_tertentu" or "otomatis_setelah_periode"
    const chanceTypes = ['lucky spin', 'lucky draw', 'gacha', 'spin', 'undian', 'wheel'];
    if (chanceTypes.some(t => promoType.includes(t))) {
      return 'setelah_syarat';
    }
    
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
  // PROMO PRIMITIVE GATE v1.2.1 — SINGLE SOURCE OF TRUTH
  // Mode ONLY comes from this gate (or Taxonomy if high/medium confidence)
  // ============================================
  
  const getGateDecision = (): { 
    mode: CanonicalMode; 
    constraints: { require_apk?: boolean }; 
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
  } => {
    // ============================================
    // TAXONOMY WINS (if not UNKNOWN + low)
    // ============================================
    if (useTaxonomy) {
      console.log('[GATE] Using TAXONOMY decision (SSoT)', {
        archetype: taxonomyDecision.archetype,
        mode: taxonomyDecision.mode,
        confidence: taxonomyDecision.confidence,
      });
      return {
        mode: taxonomyDecision.mode,
        constraints: { 
          require_apk: taxonomyEvidence.flags.has_apk_keywords 
        },
        confidence: taxonomyDecision.confidence,
        reasoning: `Taxonomy: ${taxonomyDecision.archetype} (${taxonomyDecision.confidence})`
      };
    }
    
    // ============================================
    // FALLBACK: Legacy Primitive Gate (UNKNOWN + low only)
    // ============================================
    console.log('[GATE] FALLBACK to legacy (taxonomy returned UNKNOWN + low)');
    
    // Build raw promo content for evidence collection
    const promoContent = [
      extracted.promo_name || '',
      extracted.promo_type || '',
      ...(extracted.terms_conditions || []),
      ...(extracted.subcategories?.map(s => s.sub_name || '') || [])
    ].join(' ');
    
    // Step 1: Collect evidence (regex as hints)
    const evidence = collectPrimitiveEvidence(promoContent);
    
    // Step 2: Infer primitives with confidence
    const inference = inferPrimitivesWithConfidence(evidence, promoContent);
    
    // Step 3: Build primitive for gate
    const primitive: PromoPrimitive = {
      task_type: 'action',
      task_domain: inference.task_domain,
      state_change: '',
      reward_nature: inference.reward_nature
    };
    
    // Step 4: Get gate decision (THE ONLY MODE DECISION)
    const gateResult = resolveModFromPrimitive(primitive);
    
    // Step 5: Get APK constraint
    const require_apk = hasApkConstraint(evidence);
    
    // Log for debugging
    console.log(`[PRIMITIVE GATE ${PRIMITIVE_GATE_VERSION}]`, {
      task_domain: inference.task_domain,
      reward_nature: inference.reward_nature,
      mode: gateResult.mode,
      require_apk,
      confidence: inference.confidence,
      reasoning: gateResult.reasoning
    });
    
    return {
      mode: gateResult.mode,
      constraints: { 
        ...gateResult.constraints,
        require_apk 
      },
      confidence: inference.confidence,
      reasoning: gateResult.reasoning
    };
  };
  
  const gateDecision = getGateDecision();
  
  // ============================================
  // BACKWARDS COMPATIBILITY: Create modeDetection from Gate
  // Legacy code uses modeDetection.mode, modeDetection.auto_detected, modeDetection.reason
  // ============================================
  type DetectedRewardMode = 'formula' | 'fixed' | 'tier';
  
  const modeDetection: { mode: DetectedRewardMode; auto_detected: boolean; reason: string } = {
    mode: gateDecision.mode as DetectedRewardMode,
    auto_detected: true, // Gate always auto-detects
    reason: gateDecision.reasoning
  };

  // ============================================
  // PROMO PRIMITIVE GATE v1.2.1 — MODE FROM GATE ONLY
  // Mode comes ONLY from Gate, not from detectRewardMode or lockedFields
  // ============================================
  let initialMode = gateDecision.mode as string;
  
  // Update lockedFields with Gate decision (Gate overrides any previous mode)
  if (lockedFields) {
    lockedFields.mode = gateDecision.mode as any;
    if (gateDecision.constraints.require_apk) {
      (lockedFields as any).require_apk = true;
    }
  }
  
  // ============================================
  // INVARIANT ASSERTION: Fail-Loud if impossible state
  // Build full fallback chain for calculation_basis before asserting.
  // ============================================
  const calculationBasisForAssertion = 
    lockedFields?.calculation_basis || 
    taxonomyDecision.calculation_basis ||
    extracted.subcategories?.[0]?.calculation_base ||
    (extracted as any).calculation_basis ||
    null;

  // Guard: if Gate says formula but NO basis found anywhere, downgrade to fixed
  // This means Gate misfired (e.g. formula keyword without a real basis).
  if (initialMode === 'formula' && !calculationBasisForAssertion) {
    console.warn(
      '[mapExtractedToPromoFormData] Gate returned formula but calculation_basis is empty — ' +
      'downgrading to fixed to prevent IMPOSSIBLE STATE.'
    );
    initialMode = 'fixed';
    if (lockedFields) {
      lockedFields.mode = 'fixed' as any;
    }
  }

  assertModeFromGate(initialMode, calculationBasisForAssertion, 'mapExtractedToPromoFormData');
  
  const skipFormulaDefaults = NON_FORMULA_MODES.includes(initialMode as typeof NON_FORMULA_MODES[number]);
  
  // ============================================
  // LOGGING C: DIAGNOSTIC OUTPUT
  // ============================================
  console.log('[mapExtractedToPromoFormData] DIAGNOSIS:', {
    initialMode,
    skipFormulaDefaults,
    lockedTrigger: lockedFields?.trigger_event,
    lockedMode: lockedFields?.mode,
    gateDecisionMode: gateDecision.mode,
    gateConfidence: gateDecision.confidence
  });
  
  if (skipFormulaDefaults) {
    console.log('[mapExtractedToPromoFormData] Mode is', initialMode, '— skipping formula defaults');
  }
  
  // ============================================
  // REFERRAL MULTI-TIER DETECTION & MAPPING
  // Convert subcategories[] → referral_tiers[] for Referral promos
  // ============================================
  const isReferralMultiTier = 
    /referral|referal|refferal|ajak.*teman|ajak.*team/i.test(extracted.promo_type || '') && 
    extracted.subcategories?.length > 1;
  
  // ============================================
  // EVENT LEVEL UP / TURNOVER DETECTION
  // Detect promos like "BONUS NALEN", "Kejar Level", "Level Up Event", "Event Turnover"
  // ============================================
  const isEventLevelUp = 
    /level\s*up|nalen|kejar\s*level|naik\s*level|event\s*level|event\s*turnover|turnover\s*slot/i.test(extracted.promo_type || '') ||
    /level\s*up|nalen|kejar\s*level|naik\s*level|event\s*turnover|turnover\s*slot/i.test(extracted.promo_name || '');
  
  if (isEventLevelUp) {
    console.log('[Event Level Up / Turnover] Detected milestone-based promo, will map to tiers[]');
  }

  // ============================================
  // EVENT LUCKY SPIN PRIZE DETECTION (POST-PROCESSING)
  // Lucky Spin dengan hadiah fisik/credit = Dinamis + Voucher, BUKAN Lucky Spin Tiket
  // Ini adalah "undian hadiah" bukan "tiket spin"
  // ============================================
  const hasMultipleSubcategories = extracted.subcategories && extracted.subcategories.length > 1;
  const hasNonSpinRewards = extracted.subcategories?.some(sub =>
    sub.reward_type === 'hadiah_fisik' ||
    sub.reward_type === 'credit_game' ||
    sub.reward_type === 'uang_tunai' ||
    /honda|iphone|samsung|emas|motor|mobil|laptop|xiaomi|pajero|yamaha|vespa|oppo|vivo|realme/i.test(sub.sub_name || '') ||
    /honda|iphone|samsung|emas|motor|mobil|laptop|xiaomi|pajero|yamaha|vespa|oppo|vivo|realme/i.test(sub.physical_reward_name || '')
  );
  
  // Jika promo "lucky spin" tapi punya subcategories dengan hadiah fisik/credit:
  // Ini adalah EVENT LUCKY SPIN (undian hadiah), bukan LUCKY SPIN TIKET
  const isLuckySpinPromo = /lucky\s*spin|spin\s*gratis|free\s*spin|spin\s*harian/i.test(extracted.promo_name || '');
  
  // ============================================
  // ❌ FIX v1.2.1: APK promos are NEVER Lucky Spin Prize
  // OLD (ILLEGAL): isEventLuckySpinPrize = hasMultipleSubcategories && hasNonSpinRewards
  // This incorrectly treated APK Freechip (2 varian) as Lucky Spin Prize
  // ============================================
  const isApkPromo = 
    gateDecision.constraints.require_apk === true ||
    /apk|download|aplikasi|freechip|freebet/i.test(extracted.promo_name || '');
  
  // ✅ FIX: Only Lucky Spin promos can be Event Lucky Spin Prize
  // REQUIRED: isLuckySpinPromo + Gate-approved + NOT APK
  const isEventLuckySpinPrize = 
    !isApkPromo &&                              // GUARD: APK promos excluded
    isLuckySpinPromo &&                         // MUST be Lucky Spin promo
    gateDecision.mode === 'formula' &&          // Gate-approved only
    hasMultipleSubcategories && 
    hasNonSpinRewards;
  
  if (isApkPromo && hasMultipleSubcategories) {
    console.log('[Event Lucky Spin Prize] BLOCKED: APK promo with multiple variants is NOT Lucky Spin Prize');
  }
  
  if (isEventLuckySpinPrize) {
    console.log('[Event Lucky Spin Prize] Detected prize table event (Lucky Spin + Gate-approved formula)');
  }
  
  // ============================================
  // LUCKY SPIN PRIZE LIST EXTRACTION (Section 6 Auto-Cascade)
  // Extract hadiah fisik dari subcategories untuk Section 6 lucky_spin_rewards
  // ============================================
  let luckySpinRewards: string[] = [];
  
  if (isLuckySpinPromo || isEventLuckySpinPrize) {
    // Extract prize list from subcategories or prizes
    const extractPrizeList = () => {
      const prizes: string[] = [];
      
      // Source 1: From subcategories - ALL reward types for Lucky Spin
      // Lucky Spin prizes include: hadiah fisik, credit game, uang tunai
      extracted.subcategories?.forEach(sub => {
        // Priority 1: Physical reward with name
        if (sub.physical_reward_name) {
          const qty = sub.physical_reward_quantity || 1;
          prizes.push(`${qty} ${sub.physical_reward_name.toUpperCase()}`);
        } 
        // Priority 2: Credit game rewards (from sub_name or cash_reward_amount)
        else if (sub.reward_type === 'credit_game') {
          if (sub.sub_name) {
            // Format: "Credit Game Rp 5.000.000" -> keep as is
            prizes.push(sub.sub_name.toUpperCase());
          } else if (sub.cash_reward_amount && sub.cash_reward_amount > 0) {
            prizes.push(`CREDIT GAME RP ${sub.cash_reward_amount.toLocaleString('id-ID')}`);
          }
        }
        // Priority 3: Cash/uang tunai rewards
        else if (sub.cash_reward_amount && sub.cash_reward_amount > 0) {
          prizes.push(`SALDO RP ${sub.cash_reward_amount.toLocaleString('id-ID')}`);
        } 
        // Priority 4: Physical reward from sub_name
        else if (sub.reward_type === 'hadiah_fisik' && sub.sub_name) {
          const qty = sub.physical_reward_quantity || 1;
          prizes.push(`${qty} ${sub.sub_name.toUpperCase()}`);
        }
        // Priority 5: Uang tunai with sub_name
        else if (sub.reward_type === 'uang_tunai' && sub.sub_name) {
          prizes.push(sub.sub_name.toUpperCase());
        }
        // Priority 6: Any other sub with sub_name (catch-all for Lucky Spin prizes)
        else if (sub.sub_name && isLuckySpinPromo) {
          prizes.push(sub.sub_name.toUpperCase());
        }
      });
      
      // Source 2: From prizes array (Category B events)
      extracted.prizes?.forEach(prize => {
        if (prize.physical_reward_name) {
          const qty = prize.physical_reward_quantity || 1;
          prizes.push(`${qty} ${prize.physical_reward_name.toUpperCase()}`);
        } else if (prize.reward_type === 'uang_tunai' && prize.cash_reward_amount) {
          prizes.push(`UANG TUNAI RP ${prize.cash_reward_amount.toLocaleString('id-ID')}`);
        } else if (prize.reward_type === 'credit_game') {
          if (prize.prize) {
            prizes.push(prize.prize.toUpperCase());
          } else if (prize.cash_reward_amount) {
            prizes.push(`CREDIT GAME RP ${prize.cash_reward_amount.toLocaleString('id-ID')}`);
          }
        } else if (prize.reward_type === 'hadiah_fisik' && prize.prize) {
          prizes.push(`1 ${prize.prize.toUpperCase()}`);
        } else if (prize.prize && isLuckySpinPromo) {
          // Catch-all for any prize in Lucky Spin context
          prizes.push(prize.prize.toUpperCase());
        }
      });
      
      // Source 3: Pattern detection from terms_conditions
      const termsText = extracted.terms_conditions?.join(' ') || '';
      const prizePatterns = [
        /(\d+)\s*(?:unit|pcs|buah)?\s*(honda|yamaha|iphone|samsung|emas|motor|mobil|laptop|xiaomi|pajero|vespa|oppo|vivo|realme)[^,;.]*/gi,
        /grand\s*prize[:\s]+([^,;.]+)/gi,
        /hadiah\s*(?:utama|pertama|1st)[:\s]+([^,;.]+)/gi,
      ];
      
      prizePatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(termsText)) !== null) {
          const prizeText = match[0].replace(/grand\s*prize[:\s]+|hadiah\s*(?:utama|pertama|1st)[:\s]+/gi, '').trim();
          if (prizeText && !prizes.some(p => p.toLowerCase().includes(prizeText.toLowerCase().substring(0, 10)))) {
            prizes.push(prizeText.toUpperCase());
          }
        }
      });
      
      return prizes;
    };
    
    luckySpinRewards = extractPrizeList();
    
    if (luckySpinRewards.length > 0) {
      console.log('[Lucky Spin Prize] Extracted prize list for Section 6:', luckySpinRewards);
    }
  }

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

  // ============================================
  // REFERRAL COMMISSION BACKSTOP (FIX FOR NONDETERMINISTIC BUG)
  // Multi-source fallback to ensure commission_percentage is correct
  // ============================================
  /**
   * Extract commission percentage with multi-source fallback
   * PRIORITY ORDER (LOCKED):
   * 1. sub.calculation_value (if unique across tiers)
   * 2. sub.sub_name (extract "Komisi X%" pattern)
   * 3. terms_conditions (extract "Tier X%: minimal Y ID" pattern)
   * 4. Fallback: return null (requires manual review)
   */
  const extractCommissionPercent = (
    sub: typeof extracted.subcategories[0],
    terms: string[] | undefined,
    allSubs: typeof extracted.subcategories,
    tierIndex: number
  ): { value: number; source: 'calculation_value' | 'sub_name' | 'terms' | 'fallback' } => {
    // Source 1: sub.calculation_value - but only if NOT all-same
    const allCalcValues = allSubs.map(s => s.calculation_value);
    const allSame = allCalcValues.length > 1 && allCalcValues.every(v => v === allCalcValues[0]);
    
    if (!allSame && sub.calculation_value && sub.calculation_value > 0) {
      return { value: sub.calculation_value, source: 'calculation_value' };
    }
    
    // Source 2: Extract from sub_name (e.g., "Komisi 10%", "Tier 15%")
    const namePercentMatch = sub.sub_name?.match(/(\d+(?:[.,]\d+)?)\s*%/);
    if (namePercentMatch) {
      const percent = parseFloat(namePercentMatch[1].replace(',', '.'));
      console.log(`[Referral Backstop] Tier ${tierIndex + 1}: Using percent from sub_name: ${percent}%`);
      return { value: percent, source: 'sub_name' };
    }
    
    // Source 3: Extract from terms_conditions
    if (terms && terms.length > 0) {
      // Look for patterns like "Tier 10%:" or "Komisi 15%"
      for (const term of terms) {
        const termMatch = term.match(/(?:tier|komisi|commission)\s*(\d+(?:[.,]\d+)?)\s*%/i);
        if (termMatch) {
          const percent = parseFloat(termMatch[1].replace(',', '.'));
          // Check if this matches the tier index (5, 10, 15... pattern)
          const expectedPercent = (tierIndex + 1) * 5;
          if (percent === expectedPercent) {
            console.log(`[Referral Backstop] Tier ${tierIndex + 1}: Using percent from terms: ${percent}%`);
            return { value: percent, source: 'terms' };
          }
        }
      }
    }
    
    // Source 4: If all-same detected, try to infer from tier position (5, 10, 15 pattern)
    if (allSame) {
      const inferredPercent = (tierIndex + 1) * 5;
      console.warn(`[Referral Backstop] Tier ${tierIndex + 1}: All-same bug detected (${allCalcValues[0]}%). Inferring: ${inferredPercent}%`);
      return { value: inferredPercent, source: 'fallback' };
    }
    
    // Final fallback: use calculation_value as-is
    return { value: sub.calculation_value || 0, source: 'calculation_value' };
  };

  // ============================================
  // LEVEL UP REWARD HELPER: Extract unlock_condition
  // This is NOT min_deposit - it's the cumulative threshold to unlock the tier
  // ============================================
  const extractUnlockCondition = (
    sub: typeof extracted.subcategories[0],
    terms: string[] | undefined,
    tierIndex: number
  ): number => {
    // Source 1: Check if sub has explicit unlock value
    if ((sub as any).unlock_condition || (sub as any).unlock_value) {
      return (sub as any).unlock_condition || (sub as any).unlock_value;
    }
    
    // Source 2: Extract from sub_name (e.g., "Level 1 - Deposit 100rb")
    const depositMatch = sub.sub_name?.match(/(?:deposit|depo|history)\s*(?:rp\.?\s*)?([\d.,]+)/i);
    if (depositMatch) {
      const numStr = depositMatch[1].replace(/\./g, '').replace(',', '');
      const num = parseInt(numStr);
      // Handle "rb" suffix (ribu = thousands)
      if (sub.sub_name?.toLowerCase().includes('rb')) {
        return num * 1000;
      }
      return num > 1000 ? num : num * 1000; // Assume thousands if small
    }
    
    // Source 3: Extract from terms_conditions (Pattern: "History Deposit Rp X")
    if (terms && terms.length > 0) {
      for (const term of terms) {
        const historyMatch = term.match(/history\s*deposit\s*(?:rp\.?\s*)?([\d.,]+)/i);
        if (historyMatch) {
          const numStr = historyMatch[1].replace(/\./g, '').replace(',', '');
          const baseValue = parseInt(numStr);
          // If it's a per-tier condition, multiply by tier index
          return baseValue * (tierIndex + 1);  // Cumulative progression
        }
      }
    }
    
    // Fallback: infer from tier position (common pattern: 100k, 200k, 500k, 1M)
    const COMMON_MILESTONES = [100000, 200000, 500000, 1000000, 2500000, 5000000, 10000000, 25000000];
    return COMMON_MILESTONES[tierIndex] || (tierIndex + 1) * 100000;
  };
  
  // ============================================
  // BUILD TIERS ARRAY (for Event Level Up promos)
  // Uses existing tiers[] structure with minimal_point for unlock condition
  // ============================================
  let eventLevelUpTiers: Array<{
    id: string;
    type: string;
    minimal_point: number;
    reward: number;
    reward_type: 'fixed' | 'percentage';
    jenis_hadiah: string;
    physical_reward_name?: string;
    physical_reward_quantity?: number;
    cash_reward_amount?: number;
  }> = [];
  
  if (isEventLevelUp && extracted.subcategories?.length > 0) {
    console.log('[Event Level Up Mapping] Converting subcategories to tiers[]');
    
    eventLevelUpTiers = extracted.subcategories.map((sub, idx) => {
      const unlockValue = extractUnlockCondition(sub, extracted.terms_conditions, idx);
      const rewardValue = sub.max_bonus || sub.calculation_value || (sub as any).reward || 0;
      
      // Detect reward type: hadiah_fisik, uang_tunai, or credit_game
      const rawRewardType = ((sub as any).reward_type || (sub as any).jenis_hadiah || '').toLowerCase();
      let jenisHadiah = rawRewardType || 'credit_game';
      
      // ✅ NEW: Auto-detect physical rewards from sub_name patterns
      const subName = (sub.sub_name || '').toLowerCase();
      const physicalPatterns = /pajero|veloz|xmax|pcx|honda|yamaha|suzuki|toyota|mitsubishi|emas|iphone|samsung|motor|mobil|laptop/i;
      const cashPatterns = /^rp[\s.,]*\d+|uang\s*tunai|cash/i;
      
      if (physicalPatterns.test(subName)) {
        jenisHadiah = 'hadiah_fisik';
      } else if (cashPatterns.test(subName) || (rewardValue > 0 && !sub.physical_reward_name)) {
        jenisHadiah = 'uang_tunai';
      }
      
      return {
        id: generateUUID(),
        type: sub.sub_name || `Level ${idx + 1}`,
        minimal_point: unlockValue,  // Progress gate (unlock condition)
        reward: typeof rewardValue === 'number' ? rewardValue : 0,
        reward_type: 'fixed' as const,
        jenis_hadiah: jenisHadiah,
        // ✅ NEW: Include physical reward fields for hadiah_fisik
        physical_reward_name: sub.physical_reward_name || (jenisHadiah === 'hadiah_fisik' ? sub.sub_name : undefined),
        physical_reward_quantity: sub.physical_reward_quantity || (jenisHadiah === 'hadiah_fisik' ? 1 : undefined),
        // ✅ NEW: Include cash reward fields for uang_tunai
        cash_reward_amount: sub.cash_reward_amount || (jenisHadiah === 'uang_tunai' ? rewardValue : undefined),
      };
    });
    
    console.log(`[Event Level Up] Mapped ${eventLevelUpTiers.length} tiers:`, 
      eventLevelUpTiers.map(t => `${t.type}: unlock=${t.minimal_point}, reward=${t.reward}, jenis=${t.jenis_hadiah}`));
  }

  // Build referral_tiers if this is a referral multi-tier promo
  let referralTiers: Array<{
    id: string;
    tier_label: string;
    min_downline: number;
    commission_percentage: number;
    winlose?: number;
    cashback_deduction?: number;
    fee_deduction?: number;
    net_winlose?: number;
    commission_result?: number;
    _commission_source?: string;
    _commission_fix_applied?: boolean;
  }> = [];
  
  if (isReferralMultiTier) {
    console.log('[Referral Mapping] Detected multi-tier referral, converting subcategories to referral_tiers');
    
    // Pre-check: detect all-same bug
    const calcValues = extracted.subcategories.map(s => s.calculation_value);
    const hasAllSameBug = calcValues.length > 1 && calcValues.every(v => v === calcValues[0]);
    if (hasAllSameBug) {
      console.warn(`[Referral Mapping] WARNING: All-same commission bug detected (all tiers = ${calcValues[0]}%). Applying backstop.`);
    }
    
    referralTiers = extracted.subcategories.map((sub, idx) => {
      const commissionResult = extractCommissionPercent(sub, extracted.terms_conditions, extracted.subcategories, idx);
      
      return {
        id: generateUUID(),
        tier_label: sub.sub_name || `Tier ${idx + 1}`,
        min_downline: extractMinDownline(sub, extracted.terms_conditions, idx),
        commission_percentage: commissionResult.value,
        
        // === RULE FIELDS (from promo table - source of truth) ===
        winlose: (sub as any).winlose || sub.minimum_base || undefined,
        // Use new field names with backward compatibility
        cashback_deduction_amount: (sub as any).cashback_deduction || undefined,
        admin_fee_deduction_amount: (sub as any).fee_deduction || undefined,
        // Keep old field names for backward compatibility
        cashback_deduction: (sub as any).cashback_deduction || undefined,
        fee_deduction: (sub as any).fee_deduction || undefined,
        
        // === DERIVED FIELDS = NULL (CALCULATOR CONTRACT) ===
        // These fields MUST be null after extraction!
        // They will be calculated ONLY by referral-tier-calculator.ts before save.
        net_winlose: null,
        commission_result: null,
        
        // === AUDIT METADATA ===
        _rule_source: 'table' as const,
        _commission_source: commissionResult.source,
        _commission_fix_applied: commissionResult.source !== 'calculation_value',
      };
    });
    
    console.log('[Extractor] Referral tiers extracted with DERIVED fields set to null (Calculator Contract)');
  }

  // ============================================
  // DEPOSIT BONUS TIER CONVERTER
  // Convert subcategories[] → depositTiers[] when mode=tier and tier_archetype=level
  // ============================================
  // DEPOSIT BONUS TIER CONVERTER — Structural Evidence (NOT mode-dependent)
  //
  // Root cause of previous bug: initialMode could be 'fixed' even when the
  // promo is structurally a tier (mechanic_type='rollingan_turnover' from
  // arbitration conflict collapses tier→fixed in gateDecision.mode).
  //
  // Fix: detect via STRUCTURAL EVIDENCE only:
  //   1. has_subcategories=true AND subcategories.length > 0
  //   2. deposit signal: promo_type includes 'deposit' OR each sub has minimum_base
  //   3. NOT referral or level-up path
  // If triggered, also rescue initialMode → 'tier' so downstream fields align.
  // ============================================
  console.log('[DepositTierDebug]', {
    subcategories_length: extracted.subcategories?.length,
    promo_type: extracted.promo_type,
    archetype: taxonomyDecision.archetype,
    isReferralMultiTier,
    isEventLevelUp,
  });

  const hasDepositSubcategoryEvidence =
    extracted.subcategories?.length > 0 &&
    (
      extracted.promo_type?.toLowerCase().includes('deposit') ||
      taxonomyDecision.archetype === 'DEPOSIT_BONUS' ||
      // All subcategories have minimum_base (deposit threshold pattern)
      extracted.subcategories.every((s: any) => s.minimum_base !== undefined)
    ) &&
    !isReferralMultiTier &&
    !isEventLevelUp;

  const isDepositBonusTier = hasDepositSubcategoryEvidence
    && (extracted.subcategories?.length ?? 0) >= 2   // must have 2+ distinct deposit levels
    && extracted.mode === 'tier';                      // LLM must explicitly detect as tier

  // TierReward shape (legacy) — used by tiers[] in PromoFormData
  let depositBonusTiers: import('../components/VOCDashboard/PromoFormWizard/types').TierReward[] = [];

  if (isDepositBonusTier) {
    // Rescue: if gate returned 'fixed' due to arbitration conflict, upgrade to 'tier'
    // CRITICAL: Must also patch gateDecision.mode AND taxonomyDecision.mode so that:
    //   1. HARD GUARD (line ~6347) does not throw "ARCHITECTURE VIOLATION"
    //   2. Taxonomy lock (line ~6391) does not re-override back to 'fixed'
    if (initialMode !== 'tier') {
      console.warn(
        `[Deposit Tier Converter] Gate returned mode='${initialMode}' but structural evidence says tier. Rescuing → 'tier'.`,
        { promo_type: extracted.promo_type, subcategoryCount: extracted.subcategories.length }
      );
      initialMode = 'tier';
    }
    // Patch gateDecision so HARD GUARD passes
    (gateDecision as any).mode = 'tier';
    // Patch taxonomyDecision so final taxonomy lock doesn't override back to 'fixed'
    (taxonomyDecision as any).mode = 'tier';
    if (lockedFields) {
      (lockedFields as any).mode = 'tier';
    }

    console.log('[Deposit Tier Converter] Converting subcategories to depositBonusTiers[]', {
      subcategoryCount: extracted.subcategories.length,
      archetype: taxonomyDecision.archetype,
      mode: initialMode,
    });

    depositBonusTiers = extracted.subcategories.map((sub: any, index: number) => {
      // Parse minimum from tier_name for open-ended tiers (e.g. "Deposit Rp 2jt ke atas" → 2000000)
      const parsedMinFromName = (() => {
        const name = sub.sub_name || '';
        const match = name.match(/(?:rp\.?\s*)?(\d+(?:[.,]\d+)*)\s*(?:rb|jt|juta|ribu|k\b)/i);
        if (!match) return null;
        let val = parseFloat(match[1].replace(',', '.'));
        if (/jt|juta/i.test(name.slice(name.indexOf(match[0])))) val *= 1_000_000;
        else if (/rb|ribu|k\b/i.test(name.slice(name.indexOf(match[0])))) val *= 1_000;
        return isNaN(val) ? null : val;
      })();
      const minVal = sub.minimum_base ?? parsedMinFromName ?? null;

      // Parse min from next tier's name too — needed when next tier minimum_base is null
      // e.g. "Deposit Rp 2jt ke atas" → 2000000
      const nextSub = extracted.subcategories[index + 1];
      const nextParsedMin = (() => {
        if (!nextSub) return null;
        // Only trust minimum_base if it's a positive number (0 is invalid boundary)
        if (nextSub.minimum_base != null && nextSub.minimum_base > 0) return nextSub.minimum_base;
        const name = nextSub.sub_name || '';
        const match = name.match(/(?:rp\.?\s*)?(\d+(?:[.,]\d+)*)\s*(?:rb|jt|juta|ribu|k\b)/i);
        if (!match) return null;
        let val = parseFloat(match[1].replace(',', '.'));
        if (/jt|juta/i.test(name.slice(name.indexOf(match[0])))) val *= 1_000_000;
        else if (/rb|ribu|k\b/i.test(name.slice(name.indexOf(match[0])))) val *= 1_000;
        return isNaN(val) ? null : val;
      })();

      return {
        id: generateUUID(),
        type: sub.sub_name || `Tier ${index + 1}`,
        // Use parsed min from name as fallback for open-ended last tiers (minimum_base: null)
        minimal_point: minVal ?? 0,
        reward: sub.calculation_value ?? 0,
        reward_type: 'percentage' as const,
        jenis_hadiah: 'credit_game',  // deposit bonus default
        // Store tier boundary metadata in extra fields
        _tier_order: index + 1,
        _requirement_max: nextParsedMin,
        _turnover_multiplier: sub.turnover_rule ? String(sub.turnover_rule) : null,
        // Force deposit_amount for all deposit tiers — LLM often sends "level" incorrectly
        _tier_dimension: 'deposit_amount',
        _min_dimension_value: minVal,
        _max_dimension_value: nextParsedMin,
      };
    });

    console.log(`[Deposit Tier Converter] Mapped ${depositBonusTiers.length} deposit tiers`);
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
    // ✅ Apply keyword-based overrides for promo_type, trigger_event
    client_id: extracted.client_id || '',  // Auto-detected from content
    promo_name: extracted.promo_name || 'Promo Baru',
    promo_type: (() => {
      // Priority 1: Keyword-based override (Birthday, Lucky Spin, etc.)
      const keywordDefaults = getDefaultsFromKeywords(extracted.promo_name, extracted.promo_type);
      if (keywordDefaults?.promo_type) {
        console.log('[Extractor] Using keyword promo_type override:', keywordDefaults.promo_type);
        return keywordDefaults.promo_type as string;
      }
      // Priority 2: LLM extracted → map to enum
      return promoTypeMap[extracted.promo_type?.toLowerCase()] || extracted.promo_type || 'Deposit Bonus';
    })(),
    intent_category: (() => {
      const keywordDefaults = getDefaultsFromKeywords(extracted.promo_name, extracted.promo_type);
      return (keywordDefaults?.intent_category as string) || 'Retention';
    })(),
    target_segment: targetUserMap[extracted.target_user?.toLowerCase()] || 'Semua',
    trigger_event: (() => {
      // PRIORITY 0: Locked fields from Reasoning-First Architecture (HIGHEST)
      if (lockedFields?.trigger_event) {
        console.log('[Extractor] Using LOCKED trigger_event from Step-0:', lockedFields.trigger_event);
        return triggerEventMap[lockedFields.trigger_event.toLowerCase()] || lockedFields.trigger_event;
      }
      // Priority 1: Keyword-based override (Birthday → Login, Referral → Referral)
      const keywordDefaults = getDefaultsFromKeywords(extracted.promo_name, extracted.promo_type);
      if (keywordDefaults?.trigger_event) {
        console.log('[Extractor] Using keyword trigger_event override:', keywordDefaults.trigger_event);
        return keywordDefaults.trigger_event as string;
      }
      // Priority 2: Default based on promo_type
      return getTriggerEventDefault(extracted.promo_type || '');
    })(),
    // Step 2 - Reward Mode (AUTO-DETECTED + BACKSTOP OVERRIDES)
    // IMPORTANT: use `initialMode` (post-Backstop B) so Withdraw+% cannot be forced into "fixed" by a wrong lockedFields.mode.
    reward_mode: initialMode as DetectedRewardMode,

    // Metadata for UI to show auto-detection badge
    _mode_auto_detected: modeDetection.auto_detected,
    _mode_detection_reason: modeDetection.reason,
    
    // Keep raw subcategories for audit/debug (hidden from UI)
    _raw_subcategories: extracted.subcategories,
    
    // Fixed mode defaults - using INERT VALUES (null, not 0)
    reward_type: 'freechip',  // lowercase to match enum
    // ✅ V1.2: APK promo - use min from range as reward_amount (Min Bonus)
    reward_amount: isApkLikePromo && apkBonusRange.min ? apkBonusRange.min : null,
    // ✅ V1.2: APK promo - use max from range as max_bonus
    max_bonus: isApkLikePromo && apkBonusRange.max ? apkBonusRange.max : null,
    // ✅ FIX: Guard min_deposit - JANGAN map historical eligibility sebagai min_deposit!
    // "Total Turnover X bulan terakhir" = eligibility, BUKAN min_deposit
    min_deposit: (() => {
      const rawMinDeposit = extracted.min_deposit;
      if (rawMinDeposit === null || rawMinDeposit === undefined) return null;
      
      // Check if this "min_deposit" is actually a historical eligibility requirement
      // by looking for patterns in terms_conditions
      const termsText = (extracted.terms_conditions || []).join(' ').toLowerCase();
      
      // More robust patterns - capture various ways historical eligibility is written
      const hasHistoricalEligibility = 
        /turnover.*bulan/i.test(termsText) ||           // "turnover ... bulan"
        /dalam\s*\d+\s*bulan/i.test(termsText) ||       // "dalam 3 bulan"
        /\d+\s*bulan\s*terakhir/i.test(termsText) ||    // "3 bulan terakhir"
        /aktif.*bulan/i.test(termsText) ||               // "aktif dalam X bulan"
        /periode.*bulan/i.test(termsText) ||             // "periode X bulan"
        /total\s*turnover/i.test(termsText);             // "total turnover" (usually historical)
      
      // Detect Birthday promo more broadly
      const promoName = (extracted.promo_name || '').toLowerCase();
      const isBirthdayPromo = 
        /birthday|ulang\s*tahun|ultah|bday|ulangtahun/i.test(promoName) ||
        /birthday|ulang\s*tahun/i.test(termsText);
      
      // If detected as Birthday promo with historical turnover, nullify min_deposit
      // and move to special_requirements instead
      if (isBirthdayPromo && hasHistoricalEligibility) {
        console.log('[Extractor] Birthday promo detected with historical eligibility - nullifying min_deposit');
        return null;
      }
      
      return rawMinDeposit;
    })(),
    max_claim: null,
    // ✅ FIX: turnover_rule default "" (inert), not "0x"
    // ✅ ENHANCED: Extract turnover multiplier from terms for formula mode
    // ✅ V1.1: Use initialMode (post-Backstop B) instead of lockedFields.mode
    turnover_rule: (() => {
      // PRIORITY 0: Check if this is a formula mode with turnover in terms
      // ✅ Use initialMode (which includes Backstop B corrections) for gating
      if (initialMode === 'formula') {
        const termsText = (extracted.terms_conditions || []).join(' ').toLowerCase();
        // Pattern: "TO x 1", "syarat main 3x", "kelipatan 5x"
        // ✅ ROBUST TO REGEX: Handles many variations
        // "TO x 1", "to x1", "minimal to x 1", "dengan to x 1", "syarat main 3x", "1x TO"
        const multiplierPatterns = [
          /(?:to|turnover|syarat\s*main)\s*(?:x|kali)?\s*(\d+)/i,
          /(\d+)\s*(?:x|kali)\s*(?:to|turnover)/i,
          /kelipatan\s*(\d+)/i,
          /minimal\s*(?:to|turnover)\s*(?:x|kali)?\s*(\d+)/i,    // ✅ "minimal to x 1"
          /dengan\s*(?:to|turnover)\s*x?\s*(\d+)/i,              // ✅ "dengan to x 1"
          /(?:to|turnover)\s*x\s*(\d+)/i,                        // ✅ "to x 1" exact
          /(?:claim|wd)\s*dengan\s*(?:minimal|min)?\s*(?:to|turnover)?\s*x?\s*(\d+)/i, // ✅ "claim dengan minimal to x1"
          /dapat\s*(?:wd|withdraw|claim).*?(?:to|turnover)\s*x?\s*(\d+)/i, // ✅ "dapat wd... to x 1"
        ];
        for (const pattern of multiplierPatterns) {
          const match = termsText.match(pattern);
          if (match) {
            const n = Number(match[1]);
            if (n > 0 && n <= 100) {
              console.log('[Extractor] Extracted turnover multiplier for formula mode (initialMode check):', `${n}x`);
              return `${n}x`;
            }
          }
        }
      }
      // PRIORITY 1: Subcategory extraction with normalization
      const subRule = subcategories[0]?.turnover_rule || '';
      // Normalize: "1" → "1x", "TO x 1" → "1x"
      if (subRule && /^\d+$/.test(subRule)) {
        return `${subRule}x`;
      }
      return subRule;
    })(),
    turnover_rule_enabled: (() => {
      // PRIORITY 0: Check if this is a formula mode with turnover in terms
      // ✅ Use initialMode (which includes Backstop B corrections) for gating
      if (initialMode === 'formula') {
        const termsText = (extracted.terms_conditions || []).join(' ').toLowerCase();
        // ✅ ROBUST TO REGEX: Same patterns as turnover_rule
        const multiplierPatterns = [
          /(?:to|turnover|syarat\s*main)\s*(?:x|kali)?\s*(\d+)/i,
          /(\d+)\s*(?:x|kali)\s*(?:to|turnover)/i,
          /kelipatan\s*(\d+)/i,
          /minimal\s*(?:to|turnover)\s*(?:x|kali)?\s*(\d+)/i,
          /dengan\s*(?:to|turnover)\s*x?\s*(\d+)/i,
          /(?:to|turnover)\s*x\s*(\d+)/i,
          /(?:claim|wd)\s*dengan\s*(?:minimal|min)?\s*(?:to|turnover)?\s*x?\s*(\d+)/i,
          /dapat\s*(?:wd|withdraw|claim).*?(?:to|turnover)\s*x?\s*(\d+)/i,
        ];
        for (const pattern of multiplierPatterns) {
          const match = termsText.match(pattern);
          if (match) {
            const n = Number(match[1]);
            if (n > 0 && n <= 100) {
              console.log('[Extractor] Enabling turnover_rule for formula mode (initialMode check)');
              return true;
            }
          }
        }
      }
      // PRIORITY 1: Subcategory extraction
      return subcategories[0]?.turnover_rule_enabled ?? (subcategories[0]?.turnover_rule && subcategories[0]?.turnover_rule !== '' && subcategories[0]?.turnover_rule !== '0x');
    })(),
    turnover_rule_custom: subcategories[0]?.turnover_rule_custom || '',
    // claim_frequency - PRIORITY: Birthday=tahunan, then keyword defaults, then LLM
    claim_frequency: (() => {
      const promoName = (extracted.promo_name || '').toLowerCase();
      const isBirthdayPromo = /birthday|ulang\s*tahun|ultah|bday|ulangtahun/i.test(promoName);
      
      // ✅ PRIORITY 1: Birthday = tahunan (yearly)
      if (isBirthdayPromo) {
        console.log('[Extractor] Birthday promo = claim_frequency: tahunan');
        return 'tahunan';
      }
      
      // ✅ PRIORITY 2: "HARIAN" in promo name = daily
      if (/harian|daily|setiap\s*hari/i.test(promoName)) {
        console.log('[Extractor] HARIAN in promo name = claim_frequency: harian');
        return 'harian';
      }
      
      // ✅ PRIORITY 3: "MINGGUAN" in promo name = weekly
      if (/mingguan|weekly|setiap\s*minggu/i.test(promoName)) {
        console.log('[Extractor] MINGGUAN in promo name = claim_frequency: mingguan');
        return 'mingguan';
      }
      
      // PRIORITY 4: LLM extracted
      if (extracted.claim_frequency) return extracted.claim_frequency;
      
      // PRIORITY 5: Infer dari promo_type
      if (['cashback', 'rebate', 'rollingan', 'rollingan cashback'].includes(extracted.promo_type?.toLowerCase() || '')) {
        return 'mingguan';
      }
      
      return 'sekali';
    })(),
    claim_date_from: '',
    claim_date_until: '',

    // Fixed Mode - SEPARATE fields (prefix: fixed_)
    // Phase 1B: Map from subcategories[0] when mode is 'fixed'
    // ✅ Uses keyword-rules.ts as single source of truth for auto-detection
    fixed_reward_type: (() => {
      if (modeDetection.mode !== 'fixed' || !extracted.subcategories[0]) return '';
      
      const termsText = (extracted.terms_conditions || []).join(' ').toLowerCase();
      const promoName = (extracted.promo_name || '').toLowerCase();
      const isBirthdayPromo = /birthday|ulang\s*tahun|ultah|bday|ulangtahun/i.test(promoName);
      
      // ✅ ENHANCED: Expanded "withdrawable" pattern detection (covers "Withdraw 50%", "WD 50%")
      const canWithdraw = 
        /bisa\s*(di)?\s*wd/i.test(termsText) ||
        /bisa\s*(di)?\s*tarik/i.test(termsText) ||
        /dapat\s*(di)?\s*(wd|withdraw|tarik)/i.test(termsText) ||
        /withdraw\s*\d+%/i.test(termsText) ||           // "Withdraw 50%"
        /wd\s*\d+%/i.test(termsText) ||                  // "WD 50%"
        /withdraw(?:able)?/i.test(termsText) ||
        /uang\s*tunai/i.test(termsText) ||
        /bonus\s*tunai/i.test(termsText) ||
        /saldo\s*(utama|real)/i.test(termsText) ||
        /masuk\s*(ke)?\s*saldo/i.test(termsText) ||
        /dicairkan|cair/i.test(termsText);
      
      // Birthday promo with withdrawable evidence = Uang Tunai
      if (isBirthdayPromo && canWithdraw) {
        console.log('[Extractor] Birthday + WD evidence = uang_tunai');
        return 'uang_tunai';
      }
      
      // Birthday + fixed nominal without explicit credit_game restriction = default Uang Tunai
      const hasCreditGameRestriction = /credit\s*game|bonus\s*main|dalam\s*game/i.test(termsText);
      const hasFixedNominal = (extracted.subcategories[0]?.calculation_value || 0) > 0;
      if (isBirthdayPromo && hasFixedNominal && !hasCreditGameRestriction) {
        console.log('[Extractor] Birthday + fixed nominal = uang_tunai (default)');
        return 'uang_tunai';
      }
      
      // Source 1: LLM extracted reward_type (trust if specific)
      const extractedType = extracted.subcategories[0].reward_type?.toLowerCase();
      if (extractedType && !['credit_game', 'other', ''].includes(extractedType)) {
        return extractedType;
      }
      
      // Source 2: Use keyword-rules (single source of truth)
      const keywordDefaults = getDefaultsFromKeywords(extracted.promo_name, extracted.promo_type);
      if (keywordDefaults?.fixed_reward_type) {
        console.log('[Extractor] Using keyword-rules for fixed_reward_type:', keywordDefaults.fixed_reward_type);
        return keywordDefaults.fixed_reward_type as string;
      }
      
      return extractedType || 'credit_game';
    })(),
    fixed_calculation_base: (() => {
      // PRIORITY 0: Locked fields from Reasoning-First Architecture
      // If calculation_basis is explicitly null, return empty string (no calculation needed)
      if (lockedFields?.calculation_basis === null) {
        console.log('[Extractor] Using LOCKED calculation_basis: null → empty string');
        return '';
      }
      if (lockedFields?.calculation_basis) {
        console.log('[Extractor] Using LOCKED calculation_basis:', lockedFields.calculation_basis);
        return lockedFields.calculation_basis;
      }
      
      if (modeDetection.mode !== 'fixed' && !lockedFields?.mode) return '';
      // If mode is 'event', no calculation basis needed
      if (lockedFields?.mode === 'event') {
        console.log('[Extractor] Mode is "event" → no calculation_basis needed');
        return '';
      }
      
      const promoName = (extracted.promo_name || '').toLowerCase();
      const termsText = (extracted.terms_conditions || []).join(' ').toLowerCase();
      const isBirthdayPromo = /birthday|ulang\s*tahun|ultah|bday|ulangtahun/i.test(promoName);
      
      // ✅ DECOUPLED DETECTION: Check TO pattern WITHOUT historical guard
      // Historical eligibility goes to special_requirements[], doesn't block calculation_base
      const hasAnyTOPattern = 
        /min(?:imal|imum)?\s*(?:to|turnover)\s*(?:rp\.?|idr)?[\s:]*[0-9.,]+/i.test(termsText) ||
        /syarat\s*to\s*(?:rp\.?|idr)?[\s:]*[0-9.,]+/i.test(termsText) ||
        /total\s*to\s*(?:rp\.?|idr)?[\s:]*[0-9.,]+/i.test(termsText);
      
      // ✅ Birthday + ANY TO pattern = turnover (terms sets base, historical handled separately)
      if (isBirthdayPromo && hasAnyTOPattern) {
        console.log('[Extractor] Birthday + TO pattern = turnover');
        return 'turnover';
      }
      
      // ✅ Birthday WITHOUT any TO = empty (manual eligibility)
      if (isBirthdayPromo) {
        console.log('[Extractor] Birthday promo (no TO pattern) - calculation_base empty');
        return '';
      }
      
      // ✅ STEP 4: Keyword defaults for non-Birthday
      const keywordDefaults = getDefaultsFromKeywords(extracted.promo_name, extracted.promo_type);
      if (keywordDefaults?.fixed_calculation_base) {
        return keywordDefaults.fixed_calculation_base as string;
      }
      
      // ✅ STEP 5: LLM extraction
      const llmBase = extracted.subcategories[0]?.calculation_base?.toLowerCase();
      if (llmBase && ['turnover', 'deposit', 'loss', 'winlose', 'bet'].includes(llmBase)) {
        return llmBase;
      }
      
      // ✅ STEP 6: General heuristic for non-Birthday (detect "minimum TO X" pattern)
      const turnoverPattern = 
        /min(?:imal|imum)?\s*(?:to|turnover)\s*(?:rp\.?)?[\s:]?\d/i.test(termsText) ||
        /syarat\s*to\s*(?:rp\.?)?[\s:]?\d/i.test(termsText) ||
        /total\s*to\s*(?:rp\.?)?[\s:]?\d/i.test(termsText);
      
      if (turnoverPattern) {
        console.log('[Extractor] Detected turnover-based eligibility from terms');
        return 'turnover';
      }
      
      // Fallback: deposit
      return 'deposit';
    })(),
    fixed_calculation_method: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? (extracted.subcategories[0].calculation_method || 'percentage')
      : '',
    fixed_calculation_value: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? extracted.subcategories[0].calculation_value
      : undefined,
    fixed_max_claim: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? (extracted.subcategories[0].max_bonus ?? undefined)
      : undefined,
    // ✅ Fixed Mode - Max Bonus toggle (TITLE-FIRST DETECTION)
    fixed_max_claim_enabled: (() => {
      if (modeDetection.mode !== 'fixed') return false;
      
      // PRIORITY 1: Keyword-based defaults (promo title = detector utama!)
      const keywordDefaults = getDefaultsFromKeywords(extracted.promo_name, extracted.promo_type);
      if (keywordDefaults?.fixed_max_claim_enabled !== undefined) {
        console.log('[Extractor] Using keyword-rules for fixed_max_claim_enabled:', keywordDefaults.fixed_max_claim_enabled);
        return keywordDefaults.fixed_max_claim_enabled;
      }
      
      // PRIORITY 2: Reward type detection (fallback)
      const rewardType = extracted.subcategories[0]?.reward_type?.toLowerCase() || '';
      if (['uang_tunai', 'hadiah_fisik', 'cash', 'physical', 'lucky_spin', 'voucher', 'ticket'].includes(rewardType)) {
        return false; // Fixed nominal / unit = no max bonus needed
      }
      
      // Default true untuk mode fixed lainnya
      return true;
    })(),
    fixed_max_claim_unlimited: (() => {
      if (modeDetection.mode !== 'fixed') return false;
      
      // PRIORITY 1: Keyword-based defaults
      const keywordDefaults = getDefaultsFromKeywords(extracted.promo_name, extracted.promo_type);
      if (keywordDefaults?.fixed_max_claim_unlimited !== undefined) {
        console.log('[Extractor] Using keyword-rules for fixed_max_claim_unlimited:', keywordDefaults.fixed_max_claim_unlimited);
        return keywordDefaults.fixed_max_claim_unlimited;
      }
      
      // PRIORITY 2: LLM extraction
      return extracted.subcategories[0]?.max_bonus === null;
    })(),
    // ✅ Fixed Mode - Payout Direction (WD context detection)
    fixed_payout_direction: (() => {
      if (modeDetection.mode !== 'fixed' || !extracted.subcategories[0]) return 'after';
      
      const termsText = (extracted.terms_conditions || []).join(' ').toLowerCase();
      
      // ✅ Detect "WD X% sebelum/dulu" pattern = BEFORE turnover
      const wdBeforePattern = 
        /(?:wd|withdraw)\s*\d+%/i.test(termsText) ||     // "WD 50%" implies partial withdraw first
        /bisa\s*(?:di)?wd.*?(?:sisa|sisanya)/i.test(termsText) || // "bisa WD...sisanya" = partial WD
        /withdraw.*?(?:sisa|sisanya)/i.test(termsText);
      
      if (wdBeforePattern) {
        console.log('[Extractor] WD pattern detected = payout_direction: before');
        return 'before';
      }
      
      // Fallback to LLM extraction
      const llmDirection = extracted.subcategories[0].payout_direction;
      if (llmDirection === 'depan') return 'before';
      if (llmDirection === 'belakang') return 'after';
      
      return 'after'; // default
    })(),
    // ✅ Fixed Mode - Admin Fee toggle (TITLE-FIRST DETECTION)
    fixed_admin_fee_enabled: (() => {
      if (modeDetection.mode !== 'fixed') return false;
      
      // PRIORITY 1: Keyword-based defaults
      const keywordDefaults = getDefaultsFromKeywords(extracted.promo_name, extracted.promo_type);
      if (keywordDefaults?.fixed_admin_fee_enabled !== undefined) {
        console.log('[Extractor] Using keyword-rules for fixed_admin_fee_enabled:', keywordDefaults.fixed_admin_fee_enabled);
        return keywordDefaults.fixed_admin_fee_enabled;
      }
      
      // Default: OFF
      return false;
    })(),
    fixed_admin_fee_percentage: undefined,
    // ✅ Fixed Mode - Nilai Bonus toggle (TITLE-FIRST DETECTION)
    fixed_calculation_value_enabled: (() => {
      if (modeDetection.mode !== 'fixed') return false;
      
      // PRIORITY 1: Keyword-based defaults (promo title = detector utama!)
      const keywordDefaults = getDefaultsFromKeywords(extracted.promo_name, extracted.promo_type);
      if (keywordDefaults?.fixed_calculation_value_enabled !== undefined) {
        console.log('[Extractor] Using keyword-rules for fixed_calculation_value_enabled:', keywordDefaults.fixed_calculation_value_enabled);
        return keywordDefaults.fixed_calculation_value_enabled;
      }
      
      // PRIORITY 2: Reward type detection (fallback)
      const rewardType = extracted.subcategories[0]?.reward_type?.toLowerCase() || '';
      // Auto-OFF untuk Uang Tunai, Hadiah Fisik, dan unit-based rewards
      if (['uang_tunai', 'hadiah_fisik', 'cash', 'physical', 'lucky_spin', 'voucher', 'ticket'].includes(rewardType)) {
        return false;
      }
      
      // Default ON untuk reward type lain yang memerlukan kalkulasi
      return true;
    })(),
    // ✅ Fixed Mode - Min Calculation toggle (TITLE-FIRST + TERMS OVERRIDE)
    fixed_min_calculation_enabled: (() => {
      if (modeDetection.mode !== 'fixed') return false;
      
      const termsText = (extracted.terms_conditions || []).join(' ').toLowerCase();
      const promoName = (extracted.promo_name || '').toLowerCase();
      const isBirthdayPromo = /birthday|ulang\s*tahun|ultah|bday|ulangtahun/i.test(promoName);
      
      // ✅ Check for explicit TO threshold (regardless of historical context)
      const hasTOThreshold = 
        /(?:total\s*)?(?:to|turnover)\s*(?:minimal|min\.?)?\s*(?:rp\.?|idr)?[\s:]*[0-9.,]+/i.test(termsText);
      
      // Guard: Historical eligibility patterns
      const hasHistoricalEligibility = 
        /turnover.*bulan/i.test(termsText) ||
        /dalam\s*\d+\s*bulan/i.test(termsText) ||
        /\d+\s*bulan\s*terakhir/i.test(termsText);
      
      // ✅ Birthday + explicit TO threshold = ENABLE (regardless of historical context)
      if (isBirthdayPromo && hasTOThreshold) {
        console.log('[Extractor] Birthday + explicit TO threshold = enabling fixed_min_calculation');
        return true;
      }
      
      // Historical WITHOUT explicit threshold = disable
      if (isBirthdayPromo && hasHistoricalEligibility && !hasTOThreshold) {
        console.log('[Extractor] Birthday + historical WITHOUT threshold = disabling');
        return false;
      }
      
      // PRIORITY 1: Keyword-based defaults
      const keywordDefaults = getDefaultsFromKeywords(extracted.promo_name, extracted.promo_type);
      if (keywordDefaults?.fixed_min_calculation_enabled !== undefined) {
        console.log('[Extractor] Using keyword-rules for fixed_min_calculation_enabled:', keywordDefaults.fixed_min_calculation_enabled);
        return keywordDefaults.fixed_min_calculation_enabled;
      }
      
      // PRIORITY 2: LLM value or pattern detection
      const llmValue = extracted.subcategories[0]?.minimum_base;
      if (llmValue && llmValue > 0) return true;
      
      // Check pattern "Minimum TO Rp X"
      if (hasTOThreshold) return true;
      
      return false;
    })(),
    fixed_min_calculation: (() => {
      if (modeDetection.mode !== 'fixed') return undefined;
      
      const termsText = (extracted.terms_conditions || []).join(' ').toLowerCase();
      const promoName = (extracted.promo_name || '').toLowerCase();
      const isBirthdayPromo = /birthday|ulang\s*tahun|ultah|bday|ulangtahun/i.test(promoName);
      
      // ✅ Birthday + explicit TO threshold = EXTRACT VALUE (regardless of historical)
      const toThresholdMatch = termsText.match(
        /(?:total\s*)?(?:to|turnover)\s*(?:minimal|min\.?)?\s*(?:rp\.?|idr)?[\s:]*([0-9.,]+)\s*(?:jt|juta|rb|ribu|k)?/i
      );
      
      if (isBirthdayPromo && toThresholdMatch) {
        const rawNum = toThresholdMatch[1].replace(/[.,]/g, '');
        let amount = parseInt(rawNum, 10);
        
        // Handle shorthand & Indonesian format
        const suffix = toThresholdMatch[0].toLowerCase();
        if (/jt|juta/i.test(suffix) && amount < 1000) amount *= 1_000_000;
        else if (/rb|ribu|k/i.test(suffix) && amount < 10000) amount *= 1000;
        else if (amount < 10000) amount *= 1_000_000; // assume juta if small number
        
        console.log('[Extractor] Birthday TO threshold extracted:', amount);
        return amount;
      }
      
      // Source 1: LLM extracted minimum_base
      const llmValue = extracted.subcategories[0]?.minimum_base;
      if (llmValue && llmValue > 0) return llmValue;
      
      // Source 2: Pattern extraction - "Minimum TO Rp 5.000.000"
      const minTOPattern = /min(?:imal|imum)?\s*(?:to|turnover)\s*(?:rp\.?|idr)?[\s:]*([0-9.,]+)\s*(?:jt|juta|rb|ribu|k)?/i;
      const toMatch = termsText.match(minTOPattern);
      if (toMatch) {
        const rawNum = toMatch[1].replace(/[.,]/g, '');
        let amount = parseInt(rawNum, 10);
        
        // Handle shorthand: "5jt" = 5_000_000, "500rb" = 500_000
        const suffix = toMatch[0].toLowerCase();
        if (/jt|juta/i.test(suffix) && amount < 1000) amount *= 1_000_000;
        else if (/rb|ribu|k/i.test(suffix) && amount < 10000) amount *= 1000;
        else if (amount < 10000) amount *= 1_000_000; // assume juta if small number
        
        console.log('[Extractor] Extracted minimum TO from terms:', amount);
        return amount;
      }
      
      return undefined;
    })(),
    fixed_physical_reward_name: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? (extracted.subcategories[0].physical_reward_name || '')
      : '',
    fixed_physical_reward_quantity: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? (extracted.subcategories[0].physical_reward_quantity || 1)
      : 1,
    fixed_cash_reward_amount: (() => {
      if (modeDetection.mode !== 'fixed') return undefined;
      
      const promoName = (extracted.promo_name || '').toLowerCase();
      const isBirthdayPromo = /birthday|ulang\s*tahun|ultah|bday|ulangtahun/i.test(promoName);
      
      // Source 1: Direct cash_reward_amount
      let rawAmount = extracted.subcategories[0]?.cash_reward_amount;
      
      // ✅ Source 2: Fallback to max_bonus for Birthday + uang_tunai
      if (!rawAmount && isBirthdayPromo) {
        const termsText = (extracted.terms_conditions || []).join(' ').toLowerCase();
        const canWithdraw = 
          /bisa\s*(di)?\s*wd/i.test(termsText) ||
          /withdraw\s*\d+%/i.test(termsText) ||
          /wd\s*\d+%/i.test(termsText) ||
          /dicairkan|cair/i.test(termsText);
        
        if (canWithdraw) {
          const maxBonus = extracted.subcategories[0]?.max_bonus;
          if (maxBonus && maxBonus > 0) {
            console.log('[Extractor] Birthday: using max_bonus as cash_reward_amount:', maxBonus);
            rawAmount = maxBonus;
          }
        }
      }
      
      if (!rawAmount) return undefined;
      
      // GUARD: Birthday promo biasanya max Rp 500.000
      // Jika > 1.000.000 → kemungkinan parsing error (x1000)
      if (isBirthdayPromo && rawAmount > 1000000) {
        console.warn('[Extractor] Birthday cash_reward_amount suspiciously high:', rawAmount);
        // Attempt correction: divide by 1000 if it looks like x1000 error
        if (rawAmount % 1000 === 0 && rawAmount >= 10000000) {
          const corrected = rawAmount / 1000;
          console.log('[Extractor] Correcting cash_reward_amount x1000 error:', rawAmount, '→', corrected);
          return corrected;
        }
      }
      
      return rawAmount;
    })(),
    // ✅ Fixed Mode - Turnover Rule toggle (MULTIPLIER-ONLY DETECTION)
    // SEMANTIC CONTRACT - NON-NEGOTIABLE:
    // - turnover_rule = kelipatan sebelum WD (multiplier, e.g. 3x, 5x) → MAX 100
    // - minimum TO qualify (e.g. Rp 5.000.000) MUST go to fixed_min_calculation, NOT turnover_rule
    // - THRESHOLD MUST NEVER auto-enable this toggle
    fixed_turnover_rule_enabled: (() => {
      if (modeDetection.mode !== 'fixed') return false;

      // DO NOT use keyword defaults for WD toggle - must be explicit from terms
      // This prevents SS01 bug where WD was auto-enabled by promo type

      // ONLY enable if we find EXPLICIT multiplier pattern in terms (3x, 5x, etc)
      const termsText = extracted.terms_conditions?.join(' ') || '';
      const multiplierPatterns = [
        /(?:turnover|to|syarat\s*to|syarat\s*wd)\s*(\d+)\s*[xX]/i,
        /(\d+)\s*[xX]\s*(?:turnover|to|wd)/i,
        /turnover\s*(\d+)\s*kali/i,
        /syarat\s*(?:main|wd).*?(\d+)\s*(?:[xX]|kali)/i,
        /kelipatan\s*(\d+)/i,
        /(\d+)\s*kali\s*(?:main|lipat)/i,
      ];

      for (const pattern of multiplierPatterns) {
        const match = termsText.match(pattern);
        if (match) {
          const n = Number(match[1]);
          // GUARD: Only valid multipliers (1-100), NOT thresholds
          if (Number.isFinite(n) && n > 0 && n <= 100) {
            console.log('[Extractor] Found explicit WD multiplier, enabling toggle:', n);
            return true;
          }
        }
      }

      // LLM extracted turnover_rule - GUARD: only if it looks like a multiplier
      const extractedTO = extracted.subcategories[0]?.turnover_rule;
      if (extractedTO) {
        const extractedStr = String(extractedTO).toLowerCase();
        const extractedNum = Number(extractedStr.replace(/[^0-9]/g, ''));
        // Only enable if it's a small number (multiplier range)
        if (extractedNum > 0 && extractedNum <= 100) return true;
        // If > 100, this is a threshold - DO NOT enable WD
        if (extractedNum > 100) {
          console.log('[Extractor] Detected threshold in turnover_rule, NOT enabling WD:', extractedNum);
          return false;
        }
      }

      return false;
    })(),
    fixed_turnover_rule: (() => {
      if (modeDetection.mode !== 'fixed') return '';

      // Source 1: LLM extracted turnover_rule (guard: multiplier-only)
      const extractedTO = extracted.subcategories[0]?.turnover_rule;
      if (extractedTO) {
        const extractedStr = String(extractedTO).toLowerCase();
        const extractedNum = Number(extractedStr.replace(/[^0-9]/g, ''));
        // Only accept if it's a valid multiplier (1-100)
        if (extractedNum > 0 && extractedNum <= 100) return `${extractedNum}x`;
        // If > 100, this is a threshold - DO NOT store here
        if (extractedNum > 100) {
          console.log('[Extractor] Threshold value rejected from turnover_rule:', extractedNum);
          return '';
        }
      }

      // Source 2: Expanded pattern detection from terms (multiplier-only)
      const termsText = extracted.terms_conditions?.join(' ') || '';
      const patterns = [
        /(?:turnover|to|syarat\s*to)\s*(\d+)\s*[xX]/i,
        /(\d+)\s*[xX]\s*(?:turnover|to)/i,
        /turnover\s*(\d+)\s*kali/i,
        /syarat\s*(?:main|wd).*?(\d+)\s*(?:[xX]|kali)/i,
        /kelipatan\s*(\d+)/i,
      ];

      for (const pattern of patterns) {
        const match = termsText.match(pattern);
        if (match) {
          const n = Number(match[1]);
          // Guard: if number is huge, it's almost certainly Rupiah threshold (NOT a multiplier)
          if (!Number.isFinite(n) || n <= 0 || n > 100) continue;
          console.log('[Extractor] Detected turnover multiplier from terms:', `${n}x`);
          return `${n}x`;
        }
      }

      return '';
    })(),
    fixed_turnover_rule_custom: '',
    
    // ✅ Fixed Mode - Min Depo toggle (TITLE-FIRST + TERMS OVERRIDE)
    fixed_min_depo_enabled: (() => {
      if (modeDetection.mode !== 'fixed') return false;
      
      const termsText = (extracted.terms_conditions || []).join(' ').toLowerCase();
      const promoName = (extracted.promo_name || '').toLowerCase();
      const isBirthdayPromo = /birthday|ulang\s*tahun|ultah|bday|ulangtahun/i.test(promoName);
      
      // Check for historical eligibility patterns
      const hasHistoricalEligibility = 
        /turnover.*bulan/i.test(termsText) ||
        /dalam\s*\d+\s*bulan/i.test(termsText) ||
        /\d+\s*bulan\s*terakhir/i.test(termsText) ||
        /total\s*turnover/i.test(termsText);
      
      // Check for IMMEDIATE TO requirement (mutual exclusive with min_depo)
      const hasImmediateTORequirement = 
        /min(?:imal|imum)?\s*(?:to|turnover)\s*(?:rp\.?|idr)?[\s:]*[0-9.,]+/i.test(termsText) &&
        !hasHistoricalEligibility;
      
      // If using TO eligibility, disable min_depo (mutual exclusive)
      if (hasImmediateTORequirement) {
        console.log('[Extractor] Using TO eligibility = disable min_depo');
        return false;
      }
      
      // Birthday + Historical = disable min_depo (move to special_requirements)
      if (isBirthdayPromo && hasHistoricalEligibility) {
        console.log('[Extractor] Birthday promo with historical eligibility - disabling fixed_min_depo');
        return false;
      }
      
      // PRIORITY 1: Keyword-based defaults
      const keywordDefaults = getDefaultsFromKeywords(extracted.promo_name, extracted.promo_type);
      if (keywordDefaults?.fixed_min_depo_enabled !== undefined) {
        console.log('[Extractor] Using keyword-rules for fixed_min_depo_enabled:', keywordDefaults.fixed_min_depo_enabled);
        return keywordDefaults.fixed_min_depo_enabled;
      }
      
      // PRIORITY 2: LLM value
      const rawMinDeposit = extracted.min_deposit || extracted.subcategories[0]?.minimum_base;
      return rawMinDeposit && rawMinDeposit > 0;
    })(),
    
    fixed_min_depo: (() => {
      if (modeDetection.mode !== 'fixed') return null;
      
      const rawMinDeposit = extracted.min_deposit || extracted.subcategories[0]?.minimum_base;
      if (!rawMinDeposit || rawMinDeposit <= 0) return null;
      
      // Same guard logic as fixed_min_depo_enabled
      const termsText = (extracted.terms_conditions || []).join(' ').toLowerCase();
      const hasHistoricalEligibility = 
        /turnover.*bulan/i.test(termsText) ||
        /dalam\s*\d+\s*bulan/i.test(termsText) ||
        /\d+\s*bulan\s*terakhir/i.test(termsText) ||
        /total\s*turnover/i.test(termsText);
      
      const promoName = (extracted.promo_name || '').toLowerCase();
      const isBirthdayPromo = /birthday|ulang\s*tahun|ultah|bday|ulangtahun/i.test(promoName);
      
      if (isBirthdayPromo && hasHistoricalEligibility) {
        console.log('[Extractor] Birthday promo - nullifying fixed_min_depo, value goes to special_requirements');
        return null; // Block mapping
      }
      
      return rawMinDeposit;
    })(),
    
    // Fixed Mode - Voucher / Ticket / Lucky Spin fields (WAJIB DIISI dari extraction)
    fixed_reward_quantity: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? (extracted.subcategories[0].reward_quantity || 1)
      : 1,
    fixed_voucher_kind: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? (extracted.subcategories[0].voucher_kind || '')
      : '',
    fixed_voucher_kind_custom: '',
    fixed_voucher_valid_from: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? (extracted.subcategories[0].voucher_valid_from || '')
      : '',
    fixed_voucher_valid_until: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? (extracted.subcategories[0].voucher_valid_until || '')
      : '',
    fixed_voucher_valid_unlimited: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? (extracted.subcategories[0].voucher_valid_unlimited || false)
      : false,
    // ✅ Lucky Spin Max Per Day - also check max_bonus for unit-based rewards
    fixed_lucky_spin_max_per_day: (() => {
      if (modeDetection.mode !== 'fixed') return null;
      
      // Source 1: LLM extracted lucky_spin_max_per_day
      const directValue = extracted.subcategories[0]?.lucky_spin_max_per_day;
      if (directValue != null) return directValue;
      
      // Source 2: For Lucky Spin, max_bonus often represents max claims
      const rewardType = extracted.subcategories[0]?.reward_type?.toLowerCase();
      if (['lucky_spin', 'ticket', 'voucher'].includes(rewardType || '')) {
        const maxBonus = extracted.subcategories[0]?.max_bonus;
        if (maxBonus != null && maxBonus > 0) {
          console.log('[Extractor] Using max_bonus as max_per_day for unit reward:', maxBonus);
          return maxBonus;
        }
      }
      
      // Source 3: Pattern detection from terms ("Maksimal Claim X")
      const termsText = extracted.terms_conditions?.join(' ') || '';
      const maxClaimPattern = /(?:maksimal|max)\s*(?:claim|klaim)?\s*(\d+)/i;
      const match = termsText.match(maxClaimPattern);
      if (match) {
        console.log('[Extractor] Detected max_per_day from terms:', match[1]);
        return parseInt(match[1], 10);
      }
      
      return null;
    })(),
    // ✅ Uses keyword-rules.ts for auto-enable detection
    fixed_lucky_spin_enabled: (() => {
      if (modeDetection.mode !== 'fixed') return false;
      
      // Source 1: LLM extracted reward_type
      const extractedType = extracted.subcategories[0]?.reward_type?.toLowerCase();
      if (extractedType === 'lucky_spin') return true;
      
      // Source 2: Use keyword-rules
      const keywordDefaults = getDefaultsFromKeywords(extracted.promo_name, extracted.promo_type);
      return keywordDefaults?.fixed_lucky_spin_enabled ?? false;
    })(),
    fixed_lucky_spin_id: modeDetection.mode === 'fixed' && extracted.subcategories[0]
      ? (extracted.subcategories[0].lucky_spin_id || '')
      : '',
    
    // ✅ Lucky Spin Validity - map "Reset Harian" pattern
    fixed_spin_validity_mode: (() => {
      if (modeDetection.mode !== 'fixed') return 'relative' as const;
      
      // Check terms for validity patterns
      const termsText = extracted.terms_conditions?.join(' ') || '';
      
      // Pattern: "Reset Setiap Hari", "Reset harian", "Daily reset"
      const resetPattern = /reset\s*(setiap\s*)?hari|harian|daily\s*reset/i;
      if (resetPattern.test(termsText)) {
        return 'relative' as const;
      }
      
      return 'relative' as const; // Default to relative
    })(),
    fixed_spin_validity_duration: (() => {
      if (modeDetection.mode !== 'fixed') return 24;
      
      const termsText = extracted.terms_conditions?.join(' ') || '';
      
      // Pattern: "Reset Setiap Hari" = 24 hours
      const resetPattern = /reset\s*(setiap\s*)?hari|harian|daily\s*reset/i;
      if (resetPattern.test(termsText)) {
        return 24;
      }
      
      // Try to extract hours pattern: "berlaku 24 jam", "valid 48 hours"
      const hoursPattern = /(?:berlaku|valid)\s*(\d+)\s*(?:jam|hours?)/i;
      const match = termsText.match(hoursPattern);
      if (match) return parseInt(match[1], 10);
      
      return 24; // Default
    })(),
    fixed_spin_validity_unit: 'hours' as const,

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
    // ============================================
    // REFERRAL CUSTOM_TERMS CLEANER
    // Remove tier logic, formulas, simulation notes from custom_terms
    // Truth = referral_tiers[] array, NOT text in custom_terms
    // ============================================
    custom_terms: isReferralMultiTier 
      ? cleanReferralCustomTerms(extracted.terms_conditions?.join('; ') || '')
      : (extracted.terms_conditions?.join('; ') || ''),
    // ✅ FIX: Populate special_requirements from LLM extraction OR filter from terms_conditions
    special_requirements: extracted.special_requirements?.length > 0 
      ? extracted.special_requirements 
      : (extracted.terms_conditions || []).filter((term: string) => {
          const t = term.toLowerCase();
          return (
            // Eligibility patterns (bukan deposit untuk klaim, tapi syarat historis)
            /turnover.*bulan/i.test(t) ||
            /total\s*turnover/i.test(t) ||         // "Total Turnover Minimal Rp X"
            /wajib\s*aktif.*bulan/i.test(t) ||     // "Wajib Aktif Dalam 3 BULAN"
            /bermain.*bulan/i.test(t) ||
            /terdaftar.*bulan/i.test(t) ||
            /deposit.*kali/i.test(t) ||
            /verifikasi|ktp|sim/i.test(t) ||
            /melampirkan.*foto/i.test(t) ||         // "Melampirkan Foto KTP/SIM"
            // Payout split patterns
            /withdraw.*%|wd.*%/i.test(t) ||
            /sisanya.*to|sisa.*to/i.test(t) ||
            /dikenai\s*syarat\s*to/i.test(t) ||     // "Dikenai Syarat TO 3X"
            /bisa\s*di\s*withdraw/i.test(t) ||      // "Bisa di Withdraw 50%"
            // Birthday/special claim patterns
            /ulang\s*tahun|birthday/i.test(t) ||
            /klaim.*tanggal/i.test(t) ||
            /tepat.*tanggal/i.test(t) ||            // "Tepat di Tanggal Ulang Tahun"
            /hanya\s*dapat\s*di\s*klaim/i.test(t)   // "Hanya Dapat di Klaim di Tanggal"
          );
        }),

    // Dinamis mode - from first subcategory as base
    // ✅ FIX: Skip formula defaults for non-formula modes (event/fixed/tier)
    // ✅ CRITICAL: Use lockedFields?.calculation_basis FIRST (Step-0 wins)
    calculation_base: (() => {
      if (skipFormulaDefaults) return '';
      // PRIORITY 0: Locked fields from Reasoning-First Architecture
      if (lockedFields?.calculation_basis) {
        console.log('[Extractor Dinamis] Using LOCKED calculation_basis:', lockedFields.calculation_basis);
        return lockedFields.calculation_basis;
      }
      
    // ✅ PRIORITY 0.5: Evidence-based detection for Withdraw Bonus
      // If trigger = Withdraw, look for calculation evidence in terms
      const isWithdrawTrigger = lockedFields?.trigger_event === 'Withdraw' || 
                                 extracted.promo_name?.toLowerCase().includes('wd') ||
                                 extracted.promo_name?.toLowerCase().includes('withdraw');
      
      if (isWithdrawTrigger) {
        const termsText = (extracted.terms_conditions || []).join(' ').toLowerCase();
        const promoName = (extracted.promo_name || '').toLowerCase();
        const combinedText = termsText + ' ' + promoName;
        
        // ✅ SEMANTIC SEPARATION v2.0:
        // - "TO x 1", "minimal TO", "syarat TO" = TURNOVER MULTIPLIER (bukan calculation basis!)
        // - "WD 500.000 × 5%", "dari WD" = CALCULATION BASIS = withdraw
        // - "dari turnover", "TO × 5%" = CALCULATION BASIS = turnover
        
        // PRIORITY 1: Look for "CONTOH PERHITUNGAN" pattern - the calculation example
        // Pattern: "wd 500.000 × 5%" or "penarikan × 5%" indicates basis = withdraw
        const hasWithdrawCalculationExample = 
          /(?:wd|withdraw|penarikan)\s*[\d.,]+\s*[×x]\s*\d+\s*%/i.test(combinedText) ||  // "wd 500.000 × 5%"
          /\d+\s*%\s*[×x]\s*(?:wd|withdraw|penarikan)/i.test(combinedText);  // "5% × wd"
        
        if (hasWithdrawCalculationExample) {
          console.log('[Extractor Dinamis] Withdraw Bonus with CALCULATION EXAMPLE (WD) → calculation_base: withdraw');
          return 'withdraw';
        }
        
        // PRIORITY 2: Look for turnover calculation example
        // Pattern: "TO × 5%" or "dari turnover" (explicit basis statement, NOT multiplier)
        const hasTurnoverCalculationExample = 
          /(?:to|turnover)\s*[\d.,]+\s*[×x]\s*\d+\s*%/i.test(combinedText) ||  // "TO 1.000.000 × 5%"
          /\d+\s*%\s*[×x]\s*(?:to|turnover)[\d.,]+/i.test(combinedText) ||  // "5% × TO 1jt"
          /\d+\s*%\s*dari\s*(?:to|turnover)/i.test(combinedText) ||  // "5% dari turnover"
          /dari\s*(?:to|turnover)/i.test(combinedText);  // "bonus dari turnover"
        
        if (hasTurnoverCalculationExample) {
          console.log('[Extractor Dinamis] Withdraw Bonus with CALCULATION EXAMPLE (TO) → calculation_base: turnover');
          return 'turnover';
        }
        
        // PRIORITY 3: Evidence "dari WD", "dari penarikan" (explicit basis statement)
        const hasWithdrawBasisEvidence = 
          /dari\s*(wd|withdraw|penarikan)/i.test(combinedText) ||
          /\d+\s*%\s*dari\s*(wd|withdraw)/i.test(combinedText);
        
        if (hasWithdrawBasisEvidence) {
          console.log('[Extractor Dinamis] Withdraw Bonus with WITHDRAW evidence → calculation_base: withdraw');
          return 'withdraw';
        }
        
        // ✅ v1.3: NO DEFAULT — calculation_basis MUST be from evidence
        // If no evidence found, return null and flag for human review
        console.log('[Extractor Dinamis] Withdraw Bonus - NO EVIDENCE for calculation_basis → null (LOW CONFIDENCE)');
        return null;  // Let the UI/reviewer decide
      }
      
      // PRIORITY 1: Subcategory extraction
      return subcategories[0]?.calculation_base || 'deposit';
    })(),
    calculation_method: skipFormulaDefaults ? '' : (subcategories[0]?.calculation_method || 'percentage'),
    // ✅ FIX: For formula mode, extract calculation_value from terms if not in subcategory
    calculation_value: (() => {
      if (skipFormulaDefaults) return null;
      // PRIORITY 0: Locked fields reward amount/percentage
      if (lockedFields?.reward_is_percentage && lockedFields?.mode === 'formula') {
        // Try to extract percentage from promo name or terms
        const combined = `${extracted.promo_name || ''} ${(extracted.terms_conditions || []).join(' ')}`;
        const percentMatch = combined.match(/(\d+(?:[.,]\d+)?)\s*%/);
        if (percentMatch) {
          const percent = parseFloat(percentMatch[1].replace(',', '.'));
          console.log('[Extractor Dinamis] Extracted percentage from content:', percent);
          return percent;
        }
      }
      // PRIORITY 1: Subcategory extraction
      return subcategories[0]?.calculation_value || 0;
    })(),
    // ✅ FIX v2: For formula mode, extract min_calculation from terms
    // Works for both "Minimal WD" (withdraw trigger) and "Minimal TO" (turnover basis)
    // CRITICAL: Withdraw-triggered promos BYPASS skipFormulaDefaults for min_calculation
    min_calculation: (() => {
      const termsText = (extracted.terms_conditions || []).join(' ').toLowerCase();
      
      // ✅ PRIORITY 0: WITHDRAW-TRIGGERED PROMOS ALWAYS EXTRACT (BYPASS skipFormulaDefaults)
      const isWithdrawTriggered = lockedFields?.trigger_event === 'Withdraw' ||
                                   extracted.promo_name?.toLowerCase().includes('wd') ||
                                   extracted.promo_name?.toLowerCase().includes('withdraw');
      
      if (isWithdrawTriggered) {
        // Pattern: "Minimal WD sebesar 200.000", "Min WD Rp 200rb"
        const minWDPattern = /min(?:imal|imum)?\s*(?:wd|withdraw|penarikan)\s*(?:sebesar\s*)?(?:rp\.?|idr)?[\s:]*([0-9.,]+)\s*(?:jt|juta|rb|ribu|k)?/i;
        const match = termsText.match(minWDPattern);
        if (match) {
          const rawNum = match[1].replace(/[.,]/g, '');
          let amount = parseInt(rawNum, 10);
          const suffix = match[0].toLowerCase();
          if (/jt|juta/i.test(suffix) && amount < 1000) amount *= 1_000_000;
          else if (/rb|ribu|k/i.test(suffix) && amount < 10000) amount *= 1000;
          console.log('[Extractor Dinamis] WD OVERRIDE - Extracted min_calculation:', amount);
          return amount;
        }
        
        // FALLBACK: Use subcategory minimum_base (dari LLM)
        const subMinBase = subcategories[0]?.minimum_base;
        if (subMinBase && subMinBase > 0) {
          console.log('[Extractor Dinamis] WD OVERRIDE - Using subcategory minimum_base:', subMinBase);
          return subMinBase;
        }
      }
      
      // Non-withdraw promos: respect skipFormulaDefaults
      if (skipFormulaDefaults) return null;
      
      // ✅ PRIORITY 0.5: Extract min TO from terms
      const minTOPattern = /min(?:imal|imum)?\s*(?:to|turnover)\s*(?:sebesar\s*)?(?:rp\.?|idr)?[\s:]*([0-9.,]+)\s*(?:jt|juta|rb|ribu|k)?/i;
      const toMatch = termsText.match(minTOPattern);
      if (toMatch) {
        const rawNum = toMatch[1].replace(/[.,]/g, '');
        let amount = parseInt(rawNum, 10);
        const suffix = toMatch[0].toLowerCase();
        if (/jt|juta/i.test(suffix) && amount < 1000) amount *= 1_000_000;
        else if (/rb|ribu|k/i.test(suffix) && amount < 10000) amount *= 1000;
        console.log('[Extractor Dinamis] Extracted min_calculation (TO) from terms:', amount);
        return amount;
      }
      
      // PRIORITY 1: Subcategory extraction
      return subcategories[0]?.minimum_base || 0;
    })(),
    min_calculation_enabled: (() => {
      const termsText = (extracted.terms_conditions || []).join(' ').toLowerCase();
      
      // ✅ PRIORITY 0: WITHDRAW-TRIGGERED PROMOS ALWAYS ENABLE (BYPASS skipFormulaDefaults)
      const isWithdrawTriggered = lockedFields?.trigger_event === 'Withdraw' ||
                                   extracted.promo_name?.toLowerCase().includes('wd') ||
                                   extracted.promo_name?.toLowerCase().includes('withdraw');
      
      if (isWithdrawTriggered) {
        const minWDPattern = /min(?:imal|imum)?\s*(?:wd|withdraw|penarikan)/i;
        if (minWDPattern.test(termsText)) {
          console.log('[Extractor Dinamis] WD OVERRIDE - Enabling min_calculation');
          return true;
        }
        // Also enable if subcategory has minimum_base
        if ((subcategories[0]?.minimum_base || 0) > 0) {
          console.log('[Extractor Dinamis] WD OVERRIDE - Enabling via subcategory minimum_base');
          return true;
        }
      }
      
      // Non-withdraw promos: respect skipFormulaDefaults
      if (skipFormulaDefaults) return false;
      
      // Also enable for any "Minimal TO" pattern
      const minTOPattern = /min(?:imal|imum)?\s*(?:to|turnover)/i;
      if (minTOPattern.test(termsText)) {
        console.log('[Extractor Dinamis] Enabling min_calculation for TO pattern');
        return true;
      }
      
      return (subcategories[0]?.minimum_base || 0) > 0;
    })(),
    
    // ✅ FIX: Map dinamis_reward_type from first subcategory (was hardcoded to 'Freechip')
    dinamis_reward_type: (subcategories[0]?.jenis_hadiah || subcategories[0]?.dinamis_reward_type || 'credit_game').toLowerCase(),  // lowercase to match DINAMIS_REWARD_TYPES
    dinamis_reward_amount: 0,
    
    // ✅ FIX: payout_direction default for deposit bonus with turnover
    // ✅ V1.2: APK/Freechip promos have NO payout direction
    payout_direction: (() => {
      // ========================================
      // GUARD: APK/Freechip promos → null (no payout direction)
      // ========================================
      const promoName = (extracted.promo_name || '').toLowerCase();
      const termsText = (extracted.terms_conditions || []).join(' ').toLowerCase();
      const isApkPromo = 
        lockedFields?.trigger_event === 'APK Download' ||
        lockedFields?.require_apk === true ||
        /apk|download|aplikasi|freechip|freebet/i.test(promoName) ||
        /apk|download|aplikasi/i.test(termsText);
      
      if (isApkPromo) {
        console.log('[Extractor Dinamis] APK promo detected - payout_direction = null');
        return null;
      }
      
      const llmDirection = subcategories[0]?.payout_direction as string | undefined;
      if (llmDirection === 'depan' || llmDirection === 'before') return 'depan';
      if (llmDirection === 'belakang' || llmDirection === 'after') return 'belakang';
      
      // Default: Deposit bonus dengan TO = bonus di depan (before WD)
      const calcBase = (subcategories[0]?.calculation_base || '').toLowerCase();
      // Use turnover_rule since turnover_multiplier may not exist on PromoSubCategory
      const hasTurnover = !!(subcategories[0]?.turnover_rule && subcategories[0]?.turnover_rule !== '0x');
      
      if (calcBase === 'deposit' && hasTurnover) {
        return 'depan';  // Bonus dulu, WD setelah TO
      }
      
      return null;
    })() as 'depan' | 'belakang' | null,
    // ✅ ENHANCED: Extract max_claim from terms for formula mode
    dinamis_max_claim: (() => {
      // PRIORITY 0: Check subcategory first
      if (subcategories[0]?.max_bonus) return subcategories[0].max_bonus;
      
      // PRIORITY 1: Extract from terms for formula mode
      if (lockedFields?.mode === 'formula') {
        const termsText = (extracted.terms_conditions || []).join(' ').toLowerCase();
        // Pattern: "Maksimal bonus 50.000", "Max bonus Rp 100rb"
        const maxBonusPattern = /(?:maksimal|max|maks)\s*(?:bonus|claim)?\s*(?:sebesar\s*)?(?:rp\.?|idr)?[\s:]*([0-9.,]+)\s*(?:jt|juta|rb|ribu|k)?/i;
        const match = termsText.match(maxBonusPattern);
        if (match) {
          const rawNum = match[1].replace(/\./g, '').replace(',', '');
          let amount = parseInt(rawNum, 10);
          const suffix = match[0].toLowerCase();
          if (/jt|juta/i.test(suffix) && amount < 1000) amount *= 1_000_000;
          else if (/rb|ribu|k/i.test(suffix) && amount < 10000) amount *= 1000;
          console.log('[Extractor Dinamis] Extracted max_claim from terms:', amount);
          return amount;
        }
      }
      
      return 0;
    })(),
    dinamis_max_claim_unlimited: hasUnlimitedMaxBonus,
    // ✅ ONTOLOGY FIX: Read payout threshold from subcategory BEFORE it gets emptied
    // Truth must flow from extraction → mapping → UI
    // min_reward_claim = payout threshold ("minimal bonus yang bisa dicairkan")
    // DO NOT confuse with minimum_base = eligibility threshold ("minimal kekalahan")
    // Use nullish coalescing (??) not logical OR (||) to preserve explicit 0 values
    min_reward_claim: subcategories[0]?.min_reward_claim ?? null,  // ✅ null instead of 0
    min_reward_claim_enabled: (subcategories[0]?.min_reward_claim ?? 0) > 0,
    conversion_formula: extracted.conversion_formula ?? '',
    
    // Dinamis Mode - Voucher / Ticket / Lucky Spin fields (WAJIB DIISI dari extraction)
    reward_quantity: extracted.subcategories[0]?.reward_quantity || 1,
    voucher_kind: extracted.subcategories[0]?.voucher_kind || '',
    voucher_kind_custom: '',
    voucher_valid_from: extracted.subcategories[0]?.voucher_valid_from || '',
    voucher_valid_until: extracted.subcategories[0]?.voucher_valid_until || '',
    voucher_valid_unlimited: extracted.subcategories[0]?.voucher_valid_unlimited || false,
    lucky_spin_max_per_day: extracted.subcategories[0]?.lucky_spin_max_per_day ?? null,
    lucky_spin_id: extracted.subcategories[0]?.lucky_spin_id || '',

    // Step 2 - Batasan & Akses
    platform_access: 'semua',
    game_restriction: 'specific_game',
    // ✅ EVIDENCE-BASED game_types extraction from terms
    game_types: (() => {
      // Priority 1: Subcategory extraction
      if (subcategories[0]?.game_types?.length > 0) {
        return subcategories[0].game_types;
      }
      
      // Priority 2: Extract from terms/promo name (evidence-based)
      const termsText = (extracted.terms_conditions || []).join(' ').toLowerCase();
      const promoName = (extracted.promo_name || '').toLowerCase();
      const combinedText = termsText + ' ' + promoName;
      
      const detectedTypes: string[] = [];
      
      // ✅ Robust pattern matching for game types
      if (/\b(slot|slots)\b|bermain\s*slot|khusus\s*slot|game\s*slot|untuk\s*slot/i.test(combinedText)) {
        detectedTypes.push('slot');
      }
      if (/\b(casino|live\s*casino|baccarat|roulette|blackjack)\b/i.test(combinedText)) {
        detectedTypes.push('live_casino');
      }
      if (/\b(togel|lottery|lotre|4d|3d|2d)\b/i.test(combinedText)) {
        detectedTypes.push('togel');
      }
      if (/\b(sportsbook|taruhan\s*bola|handicap|parlay|sports)\b/i.test(combinedText)) {
        detectedTypes.push('sportsbook');
      }
      if (/\b(poker|domino|ceme|capsa)\b/i.test(combinedText)) {
        detectedTypes.push('poker');
      }
      if (/\b(arcade|fishing|tembak\s*ikan)\b/i.test(combinedText)) {
        detectedTypes.push('arcade');
      }
      
      if (detectedTypes.length > 0) {
        console.log('[Extractor] Detected game_types from terms:', detectedTypes);
        return detectedTypes;
      }
      
      return [];
    })(),
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
    require_apk: lockedFields?.require_apk ?? false,
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
    // ✅ V1.2: APK/Freechip promos have NO payout direction
    global_payout_direction_enabled: (() => {
      const promoName = (extracted.promo_name || '').toLowerCase();
      const isApkPromo = 
        lockedFields?.trigger_event === 'APK Download' ||
        lockedFields?.require_apk === true ||
        /apk|download|aplikasi|freechip|freebet/i.test(promoName);
      
      if (isApkPromo) {
        return false;
      }
      return true;
    })(),
    global_payout_direction: (() => {
      const promoName = (extracted.promo_name || '').toLowerCase();
      const isApkPromo = 
        lockedFields?.trigger_event === 'APK Download' ||
        lockedFields?.require_apk === true ||
        /apk|download|aplikasi|freechip|freebet/i.test(promoName);
      
      // APK promos: return 'after' as inert default (won't be displayed due to enabled=false)
      if (isApkPromo) {
        return 'after' as const;
      }
      
      // ✅ FIX v1.3: CONDITIONAL Payout Direction for Withdraw Bonus
      // Rule: payout_direction depends on PROVEN calculation_basis
      const isWithdrawBonus = 
        lockedFields?.trigger_event === 'Withdraw' ||
        /bonus\s*(extra\s*)?(wd|withdraw|penarikan)/i.test(promoName) ||
        /extra\s*wd/i.test(promoName);
      
      if (isWithdrawBonus) {
        const calculationBasis = lockedFields?.calculation_basis;
        const termsText = (extracted.terms_conditions || []).join(' ').toLowerCase();
        
        if (calculationBasis === 'withdraw') {
          // Bonus = f(WD) → WD harus terjadi dulu → AFTER (WAJIB)
          console.log('[Extractor] calculation_basis=withdraw → payout=after (MANDATORY)');
          return 'after' as const;
        } else if (calculationBasis === 'turnover') {
          // Bonus = f(TO), WD hanya gate → bisa before atau after dari S&K
          const hasBeforeEvidence = /sebelum\s*(wd|withdraw|deposit)/i.test(termsText);
          const payoutFromTerms = hasBeforeEvidence ? 'before' : 'after';
          console.log(`[Extractor] calculation_basis=turnover → payout=${payoutFromTerms} (from S&K)`);
          return payoutFromTerms as 'before' | 'after';
        } else {
          // No evidence → default after (conservative), flagged low confidence
          console.log('[Extractor] calculation_basis unknown → payout=after (default, LOW CONFIDENCE)');
          return 'after' as const;
        }
      }
      
      return subcategories[0]?.payout_direction === 'before' ? 'before' : 'after';
    })() as 'before' | 'after',

    // Subcategories
    has_subcategories: extracted.has_subcategories && subcategories.length > 1,
    subcategories: subcategories.length > 1 ? subcategories : [],
    
    // Point Store Redeem Table
    redeem_items: [],
    redeem_jenis_reward: '',
    
    // Referral Commission Tiers (referral)
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
    
    // Override for referral multi-tier: switch to tier mode with referral archetype
    ...(isReferralMultiTier && {
      reward_mode: 'tier' as const,
      tier_archetype: 'referral' as const,
      has_subcategories: false,  // Disable combo subcategories mode
      subcategories: [],         // Clear generic subcategories
    }),
    
    // Override for Event Level Up: switch to tier mode with level archetype
    ...(isEventLevelUp && {
      reward_mode: 'tier' as const,
      tier_archetype: 'level' as const,
      tiers: eventLevelUpTiers,  // ✅ Use existing tiers[] structure with minimal_point
      level_up_rewards: [],      // Inert - truth is in tiers[]
      has_subcategories: false,  // Data is in tiers[], not subcategories
      subcategories: [],         // Clear generic subcategories
      // Event Level Up tidak pakai deposit/turnover rules
      min_deposit: null,
      turnover_rule: '',
      turnover_rule_enabled: false,
      claim_frequency: 'sekali',  // 1x per level naik
    }),

    // Override for Deposit Bonus Tier: switch to tier mode with level archetype
    // subcategories[] converted to depositBonusTiers[] (deposit_amount dimension)
    ...(isDepositBonusTier && {
      reward_mode: 'tier' as const,
      tier_archetype: 'level' as const,
      tiers: depositBonusTiers,
      tier_count: depositBonusTiers.length,
      has_subcategories: false,   // Truth is in tiers[], not subcategories
      subcategories: [],          // Inert
    }),
    
    // ============================================
    // FIXED v1.2.1: Event Lucky Spin Prize - NO MODE OVERRIDE
    // reward_mode MUST come from Gate, this only sets ancillary fields
    // ============================================
    ...(isEventLuckySpinPrize && {
      // ❌ REMOVED: reward_mode: 'formula' - ILLEGAL OVERRIDE
      // Mode comes from Gate, not from this condition
      dinamis_reward_type: 'voucher',  // Undian = Voucher/Ticket
      // Clear Lucky Spin tiket flags (inert values)
      fixed_reward_type: '',
      fixed_lucky_spin_enabled: false,
      fixed_lucky_spin_id_enabled: false,
      fixed_lucky_spin_id: '',
      fixed_lucky_spin_max_per_day: null,
      // ✅ AUTO-CASCADE: Section 6 - Penukaran Hadiah / Lucky Spin
      // Non-prefixed (Dinamis mode)
      ticket_exchange_enabled: true,
      ticket_exchange_mode: 'lucky_spin' as const,
      lucky_spin_rewards: luckySpinRewards,
      // Prefixed (Fixed mode)
      fixed_ticket_exchange_enabled: true,
      fixed_ticket_exchange_mode: 'lucky_spin' as const,
      fixed_lucky_spin_rewards: luckySpinRewards,
    }),
    
    // AUTO-CASCADE: Section 6 for Lucky Spin promos (when not already overridden)
    ...(!isEventLuckySpinPrize && isLuckySpinPromo && {
      // Non-prefixed (Dinamis mode)
      ticket_exchange_enabled: true,
      ticket_exchange_mode: 'lucky_spin' as const,
      lucky_spin_rewards: luckySpinRewards,
      // Prefixed (Fixed mode)
      fixed_ticket_exchange_enabled: true,
      fixed_ticket_exchange_mode: 'lucky_spin' as const,
      fixed_lucky_spin_rewards: luckySpinRewards,
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

  // ============================================
  // COMPLETE LOCKED FIELDS APPLICATION (v3.0)
  // Apply ALL locked fields from Reasoning-First Architecture
  // These are PHYSICS LAWS - cannot be overridden by UI or keyword defaults
  // ============================================
  let dataWithLockedFields = enforcedData;
  
  if (lockedFields) {
    console.log('[mapExtractedToPromoFormData] Applying COMPLETE locked fields as LAW:', {
      trigger_event: lockedFields.trigger_event,
      require_apk: lockedFields.require_apk,
      reward_amount: lockedFields.reward_amount,
      max_claim: lockedFields.max_claim,
      turnover_enabled: lockedFields.turnover_enabled,
    });
    
    // Apply each locked field as non-negotiable law
    if (lockedFields.trigger_event !== undefined) {
      dataWithLockedFields.trigger_event = lockedFields.trigger_event;
    }
    if (lockedFields.require_apk !== undefined) {
      dataWithLockedFields.require_apk = lockedFields.require_apk;
    }
    if (lockedFields.reward_amount !== undefined) {
      dataWithLockedFields.reward_amount = lockedFields.reward_amount;
    }
    if (lockedFields.max_bonus !== undefined) {
      dataWithLockedFields.max_bonus = lockedFields.max_bonus;
    }
    if (lockedFields.max_claim !== undefined) {
      dataWithLockedFields.max_claim = lockedFields.max_claim;
    }
    if (lockedFields.max_claim_unlimited !== undefined) {
      dataWithLockedFields.max_claim_unlimited = lockedFields.max_claim_unlimited;
    }
    if (lockedFields.turnover_enabled !== undefined) {
      dataWithLockedFields.turnover_enabled = lockedFields.turnover_enabled;
      dataWithLockedFields.turnover_rule_enabled = lockedFields.turnover_enabled;
    }
    if (lockedFields.turnover_multiplier !== undefined) {
      dataWithLockedFields.turnover_multiplier = lockedFields.turnover_multiplier;
    }
    if (lockedFields.min_deposit !== undefined) {
      dataWithLockedFields.min_deposit = lockedFields.min_deposit;
    }
  }

  // ============================================
  // FINAL SAFETY NET: sanitizeByMode()
  // Mematikan impossible state berdasarkan mode
  // This is the last line of defense against ghost fields
  // ============================================
  const sanitizedData = sanitizeByMode(dataWithLockedFields);
  
  console.log('[mapExtractedToPromoFormData] Applied sanitizeByMode:', {
    mode: sanitizedData.reward_mode,
    calculation_basis: sanitizedData.calculation_basis,
    require_apk: sanitizedData.require_apk,
    trigger_event: sanitizedData.trigger_event,
  });

  // ============================================
  // HARD GUARD: ARCHITECTURE VIOLATION CHECK (v1.2.1)
  // Fail-loud if reward_mode was overridden after Gate decision
  // ============================================
  if (import.meta.env?.DEV) {
    const finalMode = sanitizedData.reward_mode || sanitizedData.mode;
    if (finalMode && finalMode !== gateDecision.mode) {
      console.error('[ARCHITECTURE VIOLATION] reward_mode overridden after Primitive Gate!', {
        gateDecision: gateDecision.mode,
        finalMode: finalMode,
        isApkPromo: gateDecision.constraints.require_apk,
        promo_name: extracted.promo_name,
      });
      // In development, throw to catch this immediately
      throw new Error(
        `[ARCHITECTURE VIOLATION] reward_mode was "${finalMode}" but Gate decided "${gateDecision.mode}". ` +
        `Promo: "${extracted.promo_name}". No override is allowed after Primitive Gate v1.2.1.`
      );
    }
  }

  // ============================================
  // POST-EXTRACTION NORMALIZER (v1.0)
  // Single Point of Normalization untuk semua pintu masuk
  // - Strip suffixes (%, x, Rp) → pure numbers
  // - Force calculation_method dari promo_name
  // - Validate Withdraw context → payout_direction
  // - Dedupe ghost subcategories
  // ============================================
  const normalizedData = normalizeExtractedPromo(
    sanitizedData as Record<string, unknown>,
    extractionSource || 'html'
  );
  
  console.log('[mapExtractedToPromoFormData] Applied Post-Extraction Normalizer');

  // ============================================
  // FINAL: Apply Taxonomy Lock (SSoT enforcement)
  // This is the LAST CHANCE to ensure taxonomy fields are correct
  // ============================================
  let finalData = normalizedData as Record<string, unknown>;
  
  if (useTaxonomy) {
    console.log('[mapExtractedToPromoFormData] Applying FINAL taxonomy lock:', {
      mode: taxonomyDecision.mode,
      archetype: taxonomyDecision.archetype,
      calculation_basis: taxonomyDecision.calculation_basis,
    });
    
    // Lock taxonomy fields — CANNOT be overridden
    finalData.reward_mode = taxonomyDecision.mode;
    
    if (taxonomyDecision.calculation_basis) {
      finalData.calculation_base = taxonomyDecision.calculation_basis;
    }
    
    if (taxonomyDecision.payout_direction) {
      finalData.payout_direction = taxonomyDecision.payout_direction === 'before' 
        ? 'depan' 
        : 'belakang';
    }
    
    if (taxonomyDecision.trigger_event) {
      finalData.trigger_event = taxonomyDecision.trigger_event;
    }
    
    // Attach audit trail
    finalData._taxonomy_decision = {
      archetype: taxonomyDecision.archetype,
      confidence: taxonomyDecision.confidence,
      version: taxonomyDecision.taxonomy_version,
      timestamp: taxonomyDecision.decision_timestamp,
    };
    
    // ============================================
    // ARCHETYPE PAYLOAD POPULATION (v1.0)
    // Populate archetype_payload & turnover_basis for lifecycle-heavy archetypes
    // ============================================
    const archetypePayloadResult = buildArchetypePayloadFromExtracted(
      extracted, 
      taxonomyDecision.archetype
    );
    
    if (archetypePayloadResult) {
      finalData.archetype_payload = archetypePayloadResult.archetype_payload;
      finalData.archetype_invariants = archetypePayloadResult.archetype_invariants;
    }

  }

  // ============================================
  // POST-SANITIZE RE-INJECT (ALWAYS — outside useTaxonomy guard)
  // Must run regardless of taxonomy confidence to avoid data loss.
  // ============================================

  // -----------------------------------------------
  // FIX 2: turnover_basis — LLM first, regex fallback, then archetype default
  // -----------------------------------------------
  const mechanicTypeForBasis = (extracted._reasoning_v2 as any)?.mechanic_selection?.mechanic_type as string | undefined;
  const resolvedTurnoverBasis = 
    extracted.turnover_basis ||                                           // LLM value — highest priority
    (finalData.archetype_payload as any)?.turnover_basis ||              // archetype detector — fallback
    (mechanicTypeForBasis?.startsWith('deposit_bonus') || taxonomyDecision.archetype === 'DEPOSIT_BONUS'
      ? 'deposit_plus_bonus'
      : null);                                                            // semantic default for deposit promos
  if (resolvedTurnoverBasis) {
    finalData.turnover_basis = resolvedTurnoverBasis as 'bonus_only' | 'deposit_plus_bonus' | 'deposit_only';
  }

  // -----------------------------------------------
  // FIX 1: conversion_formula generator — mechanic_type-based fallbacks
  // -----------------------------------------------
  if (!finalData.conversion_formula) {
    if (extracted.conversion_formula) {
      // LLM provided a value — always use it first
      finalData.conversion_formula = extracted.conversion_formula;
    } else {
      // No LLM value — generate deterministic fallback based on mechanic_type
      const mechanic = (extracted._reasoning_v2 as any)?.mechanic_selection?.mechanic_type as string | undefined
        ?? (extracted as any).mechanic_type as string | undefined;
      const firstSub = extracted.subcategories?.[0];
      const rate = firstSub?.calculation_value ?? (extracted as any).reward_percentage ?? 'reward_percentage';
      const maxB = (finalData as any).max_bonus ?? (finalData as any).fixed_max_bonus ?? 'max_bonus';

      if (isDepositBonusTier || mechanic === 'deposit_bonus_percent') {
        finalData.conversion_formula = `min(deposit * ${rate}%, ${maxB})`;
      } else if (mechanic === 'deposit_bonus_fixed') {
        finalData.conversion_formula = `deposit * reward_percentage`;
      } else if (mechanic === 'rollingan_turnover' || mechanic === 'cashback_turnover' || mechanic === 'cashback') {
        finalData.conversion_formula = `total_turnover * ${rate}%`;
      } else if (mechanic === 'referral_commission' || taxonomyDecision.archetype === 'REFERRAL') {
        finalData.conversion_formula = `net_winlose_downline * komisi%`;
      }
      // All other mechanic types: leave empty — LLM is responsible
    }
  }

  console.log('[mapExtractedToPromoFormData] Post-sanitize re-inject:', {
    archetype: taxonomyDecision.archetype,
    mechanic_type: (extracted._reasoning_v2 as any)?.mechanic_selection?.mechanic_type,
    useTaxonomy,
    turnover_basis: finalData.turnover_basis,
    conversion_formula: finalData.conversion_formula,
  });

  return finalData as unknown as PromoFormData;
}
