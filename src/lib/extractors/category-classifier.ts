/**
 * Category Classifier
 * Detects program type BEFORE extraction to route to correct schema
 * 
 * Categories:
 * A = Reward Programs (deterministic, calculable)
 * B = Event Programs (non-deterministic, random/undian)
 * C = Policy Programs (rules, no reward)
 */

export type ProgramCategory = 'A' | 'B' | 'C';

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
}

// Signals that indicate Category A (Reward)
const REWARD_SIGNALS = {
  keywords: [
    'bonus', 'cashback', 'rollingan', 'rebate', 'komisi',
    'welcome bonus', 'deposit bonus', 'referral bonus',
    'new member bonus', 'next deposit', 'turnover',
    'bonus member baru', 'bonus harian', 'bonus mingguan',
    'bonus bulanan', 'bonus selamat datang', 'promo bonus',
  ],
  patterns: [
    /bonus\s*\d+%/i,           // "bonus 100%"
    /cashback\s*\d+%/i,        // "cashback 5%"
    /rollingan\s*\d+%/i,       // "rollingan 0.5%"
    /komisi\s*\d+%/i,          // "komisi 10%"
    /max\s*bonus\s*rp/i,       // "max bonus Rp 1.000.000"
    /turnover\s*\d+x/i,        // "turnover 10x"
    /to\s*x\s*\d+/i,           // "TO x 20"
    /bonus\s*hingga/i,         // "bonus hingga"
    /dapat\s*bonus/i,          // "dapat bonus"
    /mendapat(kan)?\s*bonus/i, // "mendapatkan bonus"
  ],
  negative: ['tidak ada bonus', 'tidak mendapatkan bonus', 'tanpa bonus', 'bukan bonus'],
};

// Signals that indicate Category B (Event)
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
    /berhadiah\s*(langsung|menarik)/i,
    /kumpul(kan)?\s*(poin|kupon|tiket)/i,
  ],
  negative: ['pasti dapat', 'otomatis masuk', 'langsung dikreditkan'],
};

// Signals that indicate Category C (Policy)
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
    /potongan\s*\d+%/i,                          // "potongan 50%"
    /penalti\s*\d+%/i,
    /akan\s*(di)?(hangus|suspend|bekukan|blokir)/i,
    /deposit\s*pulsa/i,
    /tanpa\s*potongan/i,
    /max(imal)?\s*bet/i,
    /\d+x\s*(jumlah\s*)?(credit|kredit)/i,       // "5x jumlah credit" (for WD, not reward)
    /syarat\s*(wd|withdraw|penarikan)/i,
    /wajib\s*(dimainkan|dipertaruhkan)/i,
  ],
  // Strong indicator: if these exist, almost certainly Policy
  strongIndicators: [
    'tidak akan mendapatkan bonus',
    'tidak mendapatkan bonus',
    'bukan bonus',
    'bukan promo',
    'aturan deposit',
    'kebijakan deposit',
    'peraturan deposit',
    'syarat dan ketentuan deposit',
  ],
};

/**
 * Classify content into program category
 */
export function classifyContent(content: string): ClassificationResult {
  const contentLower = content.toLowerCase();
  
  // Score each category
  const scores = {
    A: 0,
    B: 0,
    C: 0,
  };
  
  const signalsFound = {
    A: [] as string[],
    B: [] as string[],
    C: [] as string[],
  };

  // Check Category C (Policy) FIRST - it has explicit "no bonus" signals
  // Strong indicators override everything
  for (const indicator of POLICY_SIGNALS.strongIndicators) {
    if (contentLower.includes(indicator)) {
      return {
        category: 'C',
        category_name: 'Policy Program',
        confidence: 'high',
        signals: [indicator],
        reasoning: `Strong indicator found: "${indicator}"`,
        scores: { A: 0, B: 0, C: 100 },
      };
    }
  }

  // Check negative signals for Reward (if present, likely NOT reward)
  for (const neg of REWARD_SIGNALS.negative) {
    if (contentLower.includes(neg)) {
      scores.A -= 10; // Heavy penalty
      signalsFound.C.push(`Anti-reward: ${neg}`);
    }
  }

  // Score Category A (Reward)
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

  // Score Category B (Event)
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
  
  // Check negative signals for Event
  for (const neg of EVENT_SIGNALS.negative) {
    if (contentLower.includes(neg)) {
      scores.B -= 5;
    }
  }

  // Score Category C (Policy)
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

  // Determine winner
  const maxScore = Math.max(scores.A, scores.B, scores.C);
  
  // If all scores low, default to A (Reward) with low confidence
  if (maxScore < 3) {
    return {
      category: 'A',
      category_name: 'Reward Program',
      confidence: 'low',
      signals: [],
      reasoning: 'No strong signals detected, defaulting to Reward',
      scores,
    };
  }

  // Determine winner and confidence
  let winner: ProgramCategory;
  let winnerName: string;
  
  if (scores.C >= scores.A && scores.C >= scores.B) {
    winner = 'C';
    winnerName = 'Policy Program';
  } else if (scores.B >= scores.A && scores.B >= scores.C) {
    winner = 'B';
    winnerName = 'Event Program';
  } else {
    winner = 'A';
    winnerName = 'Reward Program';
  }

  const confidence = maxScore >= 8 ? 'high' : maxScore >= 5 ? 'medium' : 'low';

  return {
    category: winner,
    category_name: winnerName,
    confidence,
    signals: signalsFound[winner],
    reasoning: `Score: A=${scores.A}, B=${scores.B}, C=${scores.C}`,
    scores,
  };
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
        description: 'Aturan/kebijakan tanpa reward (deposit rules, restrictions, penalties)',
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

PENTING:
- Ini adalah ATURAN/KEBIJAKAN, BUKAN bonus
- TIDAK ADA reward yang diberikan
- Kata "deposit", "tanpa potongan" BUKAN berarti ada bonus

FOKUS EKSTRAK:
- policy_name
- policy_type (deposit_policy, discount_policy, betting_restriction, game_restriction, account_policy)
- deposit_method / provider
- eligible_games / excluded_games
- usage_requirement (x kali kredit untuk WD, bukan untuk dapat bonus)
- max_bet_rule
- withdrawal_penalty
- violation_actions (hangus, suspend, blokir)
- confirmation_requirement
- authority_clause

FIELD YANG WAJIB NULL (TIDAK ADA REWARD):
- reward_type: null
- bonus_percentage: null
- bonus_amount: null
- turnover_for_reward: null
- max_bonus: null

ATURAN KERAS:
1. Jika ada "tidak akan mendapatkan bonus" → SEMUA field bonus = null
2. Jika ada penalti/sanksi → ini POLICY
3. Syarat kredit untuk WITHDRAW ≠ turnover untuk dapat bonus

OUTPUT: JSON VALID sesuai Policy schema.
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
