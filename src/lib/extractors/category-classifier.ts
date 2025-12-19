/**
 * Category Classifier v2.0 — EPISTEMICALLY CORRECT
 * 
 * FUNDAMENTAL DISTINCTION:
 * | Kategori          | Sifat                    | Contoh                      | Classification |
 * |-------------------|--------------------------|-----------------------------|----------------|
 * | Temporal Event    | Punya periode, random    | Lucky Draw, Spin Wheel      | B (Event)      |
 * | Persistent System | Ongoing, deterministik   | Loyalty Point, Referral     | C (Policy)     |
 * 
 * Categories:
 * A = Reward Programs (deterministic, calculable bonus)
 * B = Event Programs (non-deterministic, random/undian, temporal)
 * C = Policy Programs (rules, persistent systems, no formula reward)
 * 
 * EXECUTION ORDER (LOCKED - DO NOT MODIFY):
 * 0. HARD POLICY OVERRIDE    ← RUNS FIRST
 * 1. Loyalty Program
 * 2. Referral
 * 3. Cashback / Rebate
 * 4. Welcome Bonus
 * 5. Lucky Draw / Event      ← RUNS LAST
 */

export type ProgramCategory = 'A' | 'B' | 'C';
export type ProgramNature = 'persistent_system' | 'temporal_event';
export type CategoryCSubtype = 
  | 'deposit_policy'
  | 'withdrawal_policy'
  | 'betting_restriction'
  | 'loyalty_program'
  | 'referral_program'
  | 'cashback_program'
  | 'general_policy';

export type EnhancedEventType = 
  | 'welcome_bonus'
  | 'deposit_bonus' 
  | 'cashback'
  | 'rebate'
  | 'referral'
  | 'lucky_draw'
  | 'loyalty_point'
  | 'policy'
  | 'event';

export interface ClassificationResult {
  category: ProgramCategory;
  category_name: string;
  confidence: 'high' | 'medium' | 'low';
  signals: string[];
  reasoning: string;
  scores: {
    A: number;
    B: number;
    C: number;
  };
  // NEW: Enhanced classification fields
  event_type?: EnhancedEventType;
  program_nature?: ProgramNature;
  program_subtype?: CategoryCSubtype;
  program_classification_name?: string;
}

// ╔═══════════════════════════════════════════════════════════════╗
// ║  HARD POLICY KEYWORDS — MUST RUN BEFORE ALL OTHER DETECTION  ║
// ║  DO NOT MOVE THIS BLOCK. DO NOT SKIP THIS CHECK.             ║
// ╚═══════════════════════════════════════════════════════════════╝
const HARD_POLICY_KEYWORDS = [
  'tanpa potongan',
  'tidak mendapatkan bonus',
  'tidak akan mendapatkan bonus',
  'kemenangan dianggap tidak sah',
  'dihanguskan',
  'dibatalkan',
  'penalti',
  'potongan withdraw',
  'ip dilarang',
  'akun dibekukan',
  'tidak berhak',
  'syarat wajib',
  'wajib mengikuti',
  'pelanggaran',
  'deposit pulsa',
  'rate pulsa',
  'via pulsa',
];

// ════════════════════════════════════════════════════════════════
// LOYALTY PROGRAM SIGNALS (persistent_system, NOT event)
// ════════════════════════════════════════════════════════════════
const LOYALTY_SIGNALS = [
  'loyalty point',
  'loyality point',      // common typo in ID
  'penukaran point',
  'penukaran poin',
  'tukar point',
  'tukar poin',
  'lp bonus',
  'turnover = 1',
  'to = 1 lp',
  'hadiah loyalitas',
  '1,000 turnover',
  '1.000 turnover',
];

const LOYALTY_PATTERNS = [
  /\bLP\b/i,             // "LP" as word
  /\d+\s*LP/i,           // "250 LP"
  /\d+\s*poin\s*(=|→)/i, // "250 poin = xxx"
  /\d+\s*point\s*(=|→)/i,// "250 point = xxx"
];

// Referral signals
const REFERRAL_SIGNALS = ['referral', 'ajak teman', 'kode referral', 'bonus ajak', 'undang teman'];

// Cashback signals
const CASHBACK_SIGNALS = ['cashback', 'rebate', 'komisi', 'rollingan'];

// Welcome bonus signals
const WELCOME_SIGNALS = ['welcome bonus', 'member baru', 'first deposit', 'new member', 'bonus selamat datang'];

// Lucky draw / Event signals (CHECK LAST!)
const LUCKY_DRAW_SIGNALS = ['lucky draw', 'undian', 'spin wheel', 'gacha', 'random', 'acak'];

// Standard reward signals for Category A
const REWARD_SIGNALS = {
  keywords: [
    'bonus', 'cashback', 'rollingan', 'rebate', 'komisi',
    'welcome bonus', 'deposit bonus', 'referral bonus',
    'new member bonus', 'next deposit', 'turnover',
    'bonus member baru', 'bonus harian', 'bonus mingguan',
    'bonus bulanan', 'bonus selamat datang', 'promo bonus',
  ],
  patterns: [
    /bonus\s*\d+%/i,
    /cashback\s*\d+%/i,
    /rollingan\s*\d+%/i,
    /komisi\s*\d+%/i,
    /max\s*bonus\s*rp/i,
    /turnover\s*\d+x/i,
    /to\s*x\s*\d+/i,
  ],
  negative: ['tidak ada bonus', 'tidak mendapatkan bonus', 'tanpa bonus', 'bukan bonus'],
};

// Standard event signals for Category B
const EVENT_SIGNALS = {
  keywords: [
    'lucky', 'undian', 'draw', 'acak', 'random', 'spin',
    'lucky box', 'pohon hadiah', 'gacha', 'mystery',
    'grand prize', 'jackpot event', 'hadiah utama',
    'pemenang', 'kupon', 'tiket undian',
    'screenshot', 'share', 'event natal', 'event tahun baru',
    'turnamen', 'tournament', 'leaderboard', 'race',
    'misi', 'quest', 'challenge', 'achievement',
  ],
  patterns: [
    /hadiah\s*(acak|random|undian)/i,
    /pemenang\s*(diundi|dipilih\s*acak)/i,
    /lucky\s*(box|draw|spin)/i,
    /grand\s*prize/i,
    /event\s*(spesial|khusus|natal|tahun)/i,
  ],
  negative: ['pasti dapat', 'otomatis masuk', 'langsung dikreditkan'],
};

// Standard policy signals for Category C
const POLICY_SIGNALS = {
  keywords: [
    'tanpa potongan', 'potongan', 'penalti', 'penalty',
    'larangan', 'dilarang', 'tidak boleh', 'tidak diperbolehkan',
    'suspend', 'hangus', 'dihanguskan', 'dibekukan', 'blokir',
    'syarat withdraw', 'syarat penarikan', 'aturan',
    'deposit pulsa', 'deposit via', 'metode deposit',
    'diskon togel', 'max bet', 'batasan', 'restriction',
    'kebijakan', 'ketentuan', 'peraturan',
    'rate pulsa', 'rate deposit', 'minimal deposit',
  ],
  patterns: [
    /tidak\s*(akan\s*)?mendapat(kan)?\s*bonus/i,
    /potongan\s*\d+%/i,
    /penalti\s*\d+%/i,
    /akan\s*(di)?(hangus|suspend|bekukan|blokir)/i,
    /deposit\s*pulsa/i,
    /tanpa\s*potongan/i,
    /max(imal)?\s*bet/i,
  ],
  strongIndicators: [
    'tidak akan mendapatkan bonus',
    'tidak mendapatkan bonus',
    'bukan bonus',
    'bukan promo',
    'aturan deposit',
    'kebijakan deposit',
    'peraturan deposit',
  ],
};

/**
 * Classify content into program category with CORRECT priority order
 * 
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  WARNING: CLASSIFICATION PRIORITY ORDER                       ║
 * ║  Lucky Draw detection MUST be LAST.                           ║
 * ║  Loyalty programs contain "Hadiah" tables = false positive.   ║
 * ║  DO NOT reorder without understanding full implications.      ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */
export function classifyContent(content: string): ClassificationResult {
  const contentLower = content.toLowerCase();
  
  // ════════════════════════════════════════════════════════════
  // STEP 0: HARD POLICY OVERRIDE (RUNS FIRST - NON-NEGOTIABLE)
  // ════════════════════════════════════════════════════════════
  const isPolicyContent = HARD_POLICY_KEYWORDS.some(keyword => {
    const regex = new RegExp(keyword, 'i');
    return regex.test(contentLower);
  });
  
  if (isPolicyContent) {
    // Check if it's specifically deposit pulsa
    const isDepositPulsa = /deposit\s*pulsa|via\s*pulsa|rate\s*pulsa/i.test(contentLower);
    
    return {
      category: 'C',
      category_name: 'Policy Program',
      confidence: 'high',
      signals: ['hard_policy_keyword_detected'],
      reasoning: 'Hard policy enforcement keywords detected',
      scores: { A: 0, B: 0, C: 100 },
      event_type: 'policy',
      program_nature: 'persistent_system',
      program_subtype: isDepositPulsa ? 'deposit_policy' : 'general_policy',
      program_classification_name: 'Policy / Syarat Ketentuan',
    };
  }
  
  // ════════════════════════════════════════════════════════════
  // STEP 1: LOYALTY PROGRAM (persistent_system) - BEFORE EVENT!
  // ════════════════════════════════════════════════════════════
  const hasLoyaltyKeyword = LOYALTY_SIGNALS.some(signal => contentLower.includes(signal));
  const hasLoyaltyPattern = LOYALTY_PATTERNS.some(pattern => pattern.test(content));
  
  // Also check for point exchange tables
  const hasPointExchangeTable = /\d+\s*(lp|point|poin).*(?:credit|hadiah|reward)/i.test(contentLower) ||
                                 /(?:credit|hadiah|reward).*\d+\s*(lp|point|poin)/i.test(contentLower);
  
  if (hasLoyaltyKeyword || hasLoyaltyPattern || hasPointExchangeTable) {
    return {
      category: 'C',
      category_name: 'Policy Program',
      confidence: 'high',
      signals: ['loyalty_keyword_detected', hasPointExchangeTable ? 'point_exchange_table' : 'pattern_match'],
      reasoning: 'Loyalty Point = Persistent System (rule-based exchange)',
      scores: { A: 0, B: 0, C: 100 },
      event_type: 'loyalty_point',
      program_nature: 'persistent_system',
      program_subtype: 'loyalty_program',
      program_classification_name: 'Loyalty Program',
    };
  }
  
  // ════════════════════════════════════════════════════════════
  // STEP 2: REFERRAL (persistent_system)
  // ════════════════════════════════════════════════════════════
  if (REFERRAL_SIGNALS.some(s => contentLower.includes(s))) {
    return {
      category: 'C',
      category_name: 'Policy Program',
      confidence: 'high',
      signals: ['referral_keyword'],
      reasoning: 'Referral = Persistent System',
      scores: { A: 5, B: 0, C: 100 },
      event_type: 'referral',
      program_nature: 'persistent_system',
      program_subtype: 'referral_program',
      program_classification_name: 'Referral Program',
    };
  }
  
  // ════════════════════════════════════════════════════════════
  // STEP 3: CASHBACK / REBATE (can be persistent)
  // ════════════════════════════════════════════════════════════
  if (CASHBACK_SIGNALS.some(s => contentLower.includes(s))) {
    // Check if it's a formula-based reward (Category A) or just a policy
    const hasFormula = /\d+%/.test(content);
    
    if (hasFormula) {
      return {
        category: 'A',
        category_name: 'Reward Program',
        confidence: 'high',
        signals: ['cashback_keyword', 'has_percentage'],
        reasoning: 'Cashback with formula = Reward Program',
        scores: { A: 100, B: 0, C: 20 },
        event_type: 'cashback',
        program_nature: 'temporal_event',
        program_classification_name: 'Cashback / Rebate',
      };
    } else {
      return {
        category: 'C',
        category_name: 'Policy Program',
        confidence: 'medium',
        signals: ['cashback_keyword'],
        reasoning: 'Cashback rules without formula',
        scores: { A: 30, B: 0, C: 70 },
        event_type: 'cashback',
        program_nature: 'persistent_system',
        program_subtype: 'cashback_program',
        program_classification_name: 'Cashback Policy',
      };
    }
  }
  
  // ════════════════════════════════════════════════════════════
  // STEP 4: WELCOME BONUS (temporal_event, Category A)
  // ════════════════════════════════════════════════════════════
  if (WELCOME_SIGNALS.some(s => contentLower.includes(s))) {
    return {
      category: 'A',
      category_name: 'Reward Program',
      confidence: 'high',
      signals: ['welcome_keyword'],
      reasoning: 'Welcome Bonus = Reward with formula',
      scores: { A: 100, B: 10, C: 0 },
      event_type: 'welcome_bonus',
      program_nature: 'temporal_event',
      program_classification_name: 'Welcome Bonus',
    };
  }
  
  // ════════════════════════════════════════════════════════════
  // STEP 5: Score-based detection (for remaining cases)
  // ════════════════════════════════════════════════════════════
  const scores = { A: 0, B: 0, C: 0 };
  const signalsFound = { A: [] as string[], B: [] as string[], C: [] as string[] };
  
  // Check negative signals for Reward
  for (const neg of REWARD_SIGNALS.negative) {
    if (contentLower.includes(neg)) {
      scores.A -= 10;
      signalsFound.C.push(`Anti-reward: ${neg}`);
    }
  }
  
  // Score Category A
  for (const keyword of REWARD_SIGNALS.keywords) {
    if (contentLower.includes(keyword)) {
      scores.A += 2;
      signalsFound.A.push(`keyword: ${keyword}`);
    }
  }
  for (const pattern of REWARD_SIGNALS.patterns) {
    if (pattern.test(content)) {
      scores.A += 3;
      signalsFound.A.push(`pattern: ${pattern.source}`);
    }
  }
  
  // Score Category B
  for (const keyword of EVENT_SIGNALS.keywords) {
    if (contentLower.includes(keyword)) {
      scores.B += 2;
      signalsFound.B.push(`keyword: ${keyword}`);
    }
  }
  for (const pattern of EVENT_SIGNALS.patterns) {
    if (pattern.test(content)) {
      scores.B += 3;
      signalsFound.B.push(`pattern: ${pattern.source}`);
    }
  }
  
  // Score Category C
  for (const keyword of POLICY_SIGNALS.keywords) {
    if (contentLower.includes(keyword)) {
      scores.C += 2;
      signalsFound.C.push(`keyword: ${keyword}`);
    }
  }
  for (const pattern of POLICY_SIGNALS.patterns) {
    if (pattern.test(content)) {
      scores.C += 3;
      signalsFound.C.push(`pattern: ${pattern.source}`);
    }
  }
  
  // Strong indicators override
  for (const indicator of POLICY_SIGNALS.strongIndicators) {
    if (contentLower.includes(indicator)) {
      return {
        category: 'C',
        category_name: 'Policy Program',
        confidence: 'high',
        signals: [indicator],
        reasoning: `Strong indicator found: "${indicator}"`,
        scores: { A: 0, B: 0, C: 100 },
        event_type: 'policy',
        program_nature: 'persistent_system',
        program_subtype: 'general_policy',
        program_classification_name: 'Policy / Syarat Ketentuan',
      };
    }
  }
  
  // ════════════════════════════════════════════════════════════
  // STEP 6 (LAST): LUCKY DRAW / EVENT (temporal_event)
  // Only reach here if NO OTHER type matched
  // ════════════════════════════════════════════════════════════
  if (LUCKY_DRAW_SIGNALS.some(s => contentLower.includes(s))) {
    return {
      category: 'B',
      category_name: 'Event Program',
      confidence: 'medium',
      signals: ['lucky_draw_keyword'],
      reasoning: 'Lucky draw keywords detected (checked last)',
      scores: { A: scores.A, B: 50, C: scores.C },
      event_type: 'lucky_draw',
      program_nature: 'temporal_event',
      program_classification_name: 'Lucky Draw / Event',
    };
  }
  
  // Determine winner
  const maxScore = Math.max(scores.A, scores.B, scores.C);
  
  // Default with low confidence
  if (maxScore < 3) {
    return {
      category: 'A',
      category_name: 'Reward Program',
      confidence: 'low',
      signals: [],
      reasoning: 'No strong signals detected, defaulting to Reward',
      scores,
      event_type: 'event',
      program_nature: 'temporal_event',
      program_classification_name: 'Generic Promo',
    };
  }
  
  // Winner based on scores
  let winner: ProgramCategory;
  let winnerName: string;
  let eventType: EnhancedEventType = 'event';
  let programNature: ProgramNature = 'temporal_event';
  
  if (scores.C >= scores.A && scores.C >= scores.B) {
    winner = 'C';
    winnerName = 'Policy Program';
    eventType = 'policy';
    programNature = 'persistent_system';
  } else if (scores.B >= scores.A && scores.B >= scores.C) {
    winner = 'B';
    winnerName = 'Event Program';
    eventType = 'event';
    programNature = 'temporal_event';
  } else {
    winner = 'A';
    winnerName = 'Reward Program';
    eventType = 'deposit_bonus';
    programNature = 'temporal_event';
  }
  
  const confidence = maxScore >= 8 ? 'high' : maxScore >= 5 ? 'medium' : 'low';
  
  return {
    category: winner,
    category_name: winnerName,
    confidence,
    signals: signalsFound[winner],
    reasoning: `Score: A=${scores.A}, B=${scores.B}, C=${scores.C}`,
    scores,
    event_type: eventType,
    program_nature: programNature,
    program_classification_name: winnerName,
  };
}

/**
 * Apply hard lock routing rules
 * This MUST be called after extraction to enforce classification constraints
 * 
 * ⚠️ CRITICAL: ROUTING RULES - DO NOT MODIFY WITHOUT REVIEW
 */
export function applyHardLockRouting(data: {
  event_type?: string;
  program_nature?: ProgramNature;
  program_classification?: ProgramCategory;
  program_subtype?: CategoryCSubtype;
  program_classification_name?: string;
  prizes?: any[];
}): typeof data {
  const result = { ...data };
  
  // RULE 1: persistent_system → FORCE Category C
  if (result.program_nature === 'persistent_system') {
    result.program_classification = 'C';
    
    // PROHIBIT event-style fields
    if (result.event_type === 'lucky_draw') {
      console.error('ROUTING VIOLATION: persistent_system cannot be lucky_draw');
      result.event_type = 'policy';
    }
    
    // Clear prizes array - not applicable for systems
    result.prizes = undefined;
  }
  
  // RULE 2: loyalty_point → LOCK to persistent_system + Category C
  if (result.event_type === 'loyalty_point') {
    result.program_nature = 'persistent_system';
    result.program_classification = 'C';
    result.program_subtype = 'loyalty_program';
    result.program_classification_name = 'Loyalty Program';
  }
  
  // RULE 3: referral → LOCK to persistent_system + Category C
  if (result.event_type === 'referral') {
    result.program_nature = 'persistent_system';
    result.program_classification = 'C';
    result.program_subtype = 'referral_program';
  }
  
  // RULE 4: lucky_draw → MUST be temporal_event + Category B
  if (result.event_type === 'lucky_draw') {
    result.program_nature = 'temporal_event';
    result.program_classification = 'B';
  }
  
  return result;
}

/**
 * Get category display info for UI
 */
export function getCategoryDisplayInfo(category: ProgramCategory): {
  name: string;
  description: string;
  color: string;
  bgColor: string;
} {
  switch (category) {
    case 'A':
      return {
        name: 'Reward Program',
        description: 'Bonus/reward dengan formula perhitungan (deposit bonus, cashback, rollingan)',
        color: 'text-green-400',
        bgColor: 'bg-green-500/20',
      };
    case 'B':
      return {
        name: 'Event Program',
        description: 'Event dengan hadiah acak/undian (lucky box, tournament, lucky draw)',
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/20',
      };
    case 'C':
      return {
        name: 'Policy Program',
        description: 'Aturan/kebijakan atau sistem persisten (deposit rules, loyalty point, referral)',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
      };
  }
}

// Extraction prompts per category
export const REWARD_EXTRACTION_PROMPT = `
Kamu adalah Reward Program Extractor untuk iGaming Knowledge Base.

KLASIFIKASI:
- program_type: "reward"
- program_classification: "A"
- program_nature: "temporal_event"

Ekstrak semua informasi reward/bonus menjadi JSON VALID.

FOKUS EKSTRAK:
- promo_name, promo_type, target_user
- calculation_base, calculation_method, calculation_value
- minimum_base, max_bonus, turnover_rule, payout_direction
- game_types, game_providers, blacklist
- terms_conditions, claim_method

FIELD WAJIB:
- bonus_percentage atau bonus_amount HARUS ada
- turnover_rule (TO x berapa)
- payout_direction (depan/belakang)

OUTPUT: JSON VALID sesuai Reward schema.
`;

export const EVENT_EXTRACTION_PROMPT = `
Kamu adalah Event Program Extractor untuk iGaming Knowledge Base.

KLASIFIKASI:
- program_type: "event"
- program_classification: "B"
- program_nature: "temporal_event"

PENTING:
- Ini adalah EVENT dengan hadiah ACAK/UNDIAN
- TIDAK ADA rumus perhitungan bonus
- JANGAN extract bonus_percentage atau turnover_for_reward

FOKUS EKSTRAK:
- event_name
- event_type (lucky_box, lucky_draw, grand_prize, tournament, screenshot_event)
- prizes (list hadiah yang tersedia)
- participation_method (cara ikut)
- claim_channel (livechat, telegram, automatic)
- period (start, end)
- eligibility (syarat ikut)
- event_mechanics (cara kerja event)

FIELD YANG WAJIB NULL:
- bonus_percentage: null
- calculation_formula: null
- turnover_for_reward: null

OUTPUT: JSON VALID sesuai Event schema.
`;

export const POLICY_EXTRACTION_PROMPT = `
Kamu adalah Policy Extractor untuk iGaming Knowledge Base.

KLASIFIKASI:
- program_type: "policy"  
- program_classification: "C"
- program_nature: "persistent_system"

PENTING:
- Ini adalah ATURAN/KEBIJAKAN atau SISTEM PERSISTEN
- Loyalty Point = sistem ekonomi ruled-based, BUKAN event lucky draw
- Referral = sistem persisten, BUKAN promo temporal
- TIDAK ADA reward formula (kecuali loyalty point exchange table)

FOKUS EKSTRAK:
- policy_name / event_name (untuk loyalty)
- policy_type / event_type
- program_subtype (deposit_policy, loyalty_program, referral_program, dll)

UNTUK LOYALTY POINT:
- Extract "earning_rule" (contoh: "1,000 TO = 1 LP")
- Extract subcategories dengan tiers dari tabel
- Tabel "Hadiah Utama" = exchange rate table, BUKAN prize pool
- claim_limit per subcategory (1x per hari, 1x per bulan)

UNTUK POLICY:
- deposit_method / provider
- eligible_games / excluded_games
- withdrawal_penalty
- violation_actions
- authority_clause

FIELD YANG WAJIB NULL (TIDAK ADA FORMULA REWARD):
- bonus_percentage: null
- calculation_formula: null (kecuali loyalty exchange)
- turnover_for_reward: null

OUTPUT: JSON VALID sesuai Policy/Loyalty schema.
`;

/**
 * Get appropriate extraction prompt based on category
 */
export function getExtractionPrompt(category: ProgramCategory): string {
  switch (category) {
    case 'A':
      return REWARD_EXTRACTION_PROMPT;
    case 'B':
      return EVENT_EXTRACTION_PROMPT;
    case 'C':
      return POLICY_EXTRACTION_PROMPT;
  }
}
