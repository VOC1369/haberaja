/**
 * Category Classifier for VOC Promo Extraction
 * 
 * Implements reasoning-tree classification (NOT keyword matching):
 * Q1: Ada penalti/larangan/pembatasan? → POLICY (C)
 * Q2: Sistem ongoing tanpa periode? → POLICY (C)
 * Q3: User langsung dapat value dari 1 aksi? → REWARD (A)
 * Q4: Ada kompetisi/periode/undian/winner? → EVENT (B)
 * Q5: Default → POLICY (C)
 * 
 * CRITICAL: POLICY (C) is checked FIRST as highest priority
 */

export type ProgramCategory = 'A' | 'B' | 'C';

export interface ContentClassification {
  category: ProgramCategory;
  category_name: string;
  confidence: 'high' | 'medium' | 'low';
  signals: string[];
  reasoning: string;
}

// ============= SIGNAL PATTERNS =============
// Priority Order: POLICY (C) → REWARD (A) → EVENT (B)

const POLICY_SIGNALS = {
  // Penalties & Restrictions (highest priority)
  penalties: [
    /potongan\s*(withdraw|wd)/i,
    /penalti/i,
    /hangus/i,
    /suspend/i,
    /blokir/i,
    /dibekukan/i,
    /tidak\s*sah/i,
    /melanggar/i,
    /banned/i,
    /manipulasi/i,
    /kedapatan/i,
  ],
  // Policy-specific keywords
  policy_keywords: [
    /tanpa\s*potongan/i,
    /tidak\s*(akan\s*)?mendapatkan\s*bonus/i,
    /tidak\s*berlaku/i,
    /tidak\s*diperbolehkan/i,
    /syarat\s*(withdraw|wd|penarikan)/i,
    /ketentuan\s*(deposit|depo)/i,
    /aturan/i,
    /kebijakan/i,
    /rules/i,
    /restriction/i,
  ],
  // System ongoing indicators
  system_keywords: [
    /loyalty\s*point/i,
    /point\s*(system|exchange)/i,
    /tier\s*(system|level)/i,
    /exp(erience)?\s*point/i,
    /tukar\s*point/i,
    /deposit\s*pulsa/i,
  ],
};

const REWARD_SIGNALS = {
  // Direct bonus indicators
  bonus_keywords: [
    /bonus\s*\d+%/i,
    /bonus\s*deposit/i,
    /welcome\s*bonus/i,
    /new\s*member\s*bonus/i,
    /cashback\s*\d+%/i,
    /rollingan\s*\d+%/i,
    /rebate/i,
    /referral\s*bonus/i,
    /freechip/i,
    /free\s*chip/i,
    /langsung\s*(dapat|dapet|mendapat)/i,
    /bonus\s*langsung/i,
    /max\s*bonus\s*(rp\.?)?[\d.,]+/i,
    /maksimal\s*bonus/i,
    /turnover\s*\d+x/i,
    /to\s*\d+x/i,
  ],
};

const EVENT_SIGNALS = {
  // Competition/temporal indicators
  event_keywords: [
    /tournament/i,
    /turnamen/i,
    /race\s*(mingguan|harian|bulanan)/i,
    /lucky\s*draw/i,
    /undian/i,
    /periode\s*(berlaku|promo)/i,
    /leaderboard/i,
    /pemenang/i,
    /winner/i,
    /hadiah\s*utama/i,
    /prize\s*(pool|\d+)/i,
    /event\s*(spesial|natal|tahun)/i,
    /challenge/i,
    /misi\s*(mingguan|harian)/i,
    /quest/i,
  ],
};

// ============= CLASSIFICATION FUNCTION =============

export function classifyContent(content: string): ContentClassification {
  const lowerContent = content.toLowerCase();
  const signals: string[] = [];
  let reasoning = '';

  // ============================================
  // Q1: Check for PENALTIES/RESTRICTIONS first
  // If found → POLICY (C)
  // ============================================
  const penaltyMatches: string[] = [];
  for (const pattern of POLICY_SIGNALS.penalties) {
    const match = content.match(pattern);
    if (match) {
      penaltyMatches.push(match[0]);
    }
  }

  if (penaltyMatches.length > 0) {
    signals.push(...penaltyMatches);
    reasoning = `Q1 HIT: Terdeteksi penalti/larangan: ${penaltyMatches.join(', ')}`;
    return {
      category: 'C',
      category_name: 'Policy Program',
      confidence: 'high',
      signals,
      reasoning,
    };
  }

  // ============================================
  // Q2: Check for POLICY keywords (rules, restrictions, system)
  // If found → POLICY (C)
  // ============================================
  const policyKeywordMatches: string[] = [];
  for (const pattern of POLICY_SIGNALS.policy_keywords) {
    const match = content.match(pattern);
    if (match) {
      policyKeywordMatches.push(match[0]);
    }
  }

  // Also check system keywords
  for (const pattern of POLICY_SIGNALS.system_keywords) {
    const match = content.match(pattern);
    if (match) {
      policyKeywordMatches.push(match[0]);
    }
  }

  // Strong policy indicators (multiple signals)
  if (policyKeywordMatches.length >= 2) {
    signals.push(...policyKeywordMatches);
    reasoning = `Q2 HIT: Multiple policy indicators: ${policyKeywordMatches.join(', ')}`;
    return {
      category: 'C',
      category_name: 'Policy Program',
      confidence: 'high',
      signals,
      reasoning,
    };
  }

  // ============================================
  // Q3: Check for REWARD signals (direct bonus)
  // User langsung dapat value dari 1 aksi
  // ============================================
  const rewardMatches: string[] = [];
  for (const pattern of REWARD_SIGNALS.bonus_keywords) {
    const match = content.match(pattern);
    if (match) {
      rewardMatches.push(match[0]);
    }
  }

  // Check if this is a PURE reward (no policy indicators)
  const hasPolicyIndicators = policyKeywordMatches.length > 0;
  
  if (rewardMatches.length >= 2 && !hasPolicyIndicators) {
    signals.push(...rewardMatches);
    reasoning = `Q3 HIT: Direct reward indicators: ${rewardMatches.join(', ')}`;
    return {
      category: 'A',
      category_name: 'Reward Program',
      confidence: rewardMatches.length >= 3 ? 'high' : 'medium',
      signals,
      reasoning,
    };
  }

  // Single strong reward signal
  if (rewardMatches.length === 1 && !hasPolicyIndicators) {
    signals.push(...rewardMatches);
    // But check if there are policy indicators too
    if (policyKeywordMatches.length > 0) {
      // Mixed signals - default to POLICY for safety
      signals.push(...policyKeywordMatches);
      reasoning = `Q3 CONFLICT: Reward signal + Policy indicators → Default to Policy`;
      return {
        category: 'C',
        category_name: 'Policy Program',
        confidence: 'low',
        signals,
        reasoning,
      };
    }
    reasoning = `Q3 HIT: Single reward indicator: ${rewardMatches[0]}`;
    return {
      category: 'A',
      category_name: 'Reward Program',
      confidence: 'medium',
      signals,
      reasoning,
    };
  }

  // ============================================
  // Q4: Check for EVENT signals (competition/temporal)
  // Ada kompetisi/periode/undian/winner
  // ============================================
  const eventMatches: string[] = [];
  for (const pattern of EVENT_SIGNALS.event_keywords) {
    const match = content.match(pattern);
    if (match) {
      eventMatches.push(match[0]);
    }
  }

  if (eventMatches.length > 0 && !hasPolicyIndicators) {
    signals.push(...eventMatches);
    reasoning = `Q4 HIT: Event/competition indicators: ${eventMatches.join(', ')}`;
    return {
      category: 'B',
      category_name: 'Event Program',
      confidence: eventMatches.length >= 2 ? 'high' : 'medium',
      signals,
      reasoning,
    };
  }

  // ============================================
  // Q5: DEFAULT → POLICY (C)
  // No clear signals, default to most restrictive
  // ============================================
  
  // Collect any signals we found
  if (policyKeywordMatches.length > 0) signals.push(...policyKeywordMatches);
  if (rewardMatches.length > 0) signals.push(...rewardMatches);
  if (eventMatches.length > 0) signals.push(...eventMatches);

  reasoning = signals.length > 0 
    ? `Q5 DEFAULT: Mixed/unclear signals → Default to Policy`
    : `Q5 DEFAULT: No clear classification signals → Default to Policy`;

  return {
    category: 'C',
    category_name: 'Policy Program',
    confidence: 'low',
    signals,
    reasoning,
  };
}

// ============= EXTRACTION PROMPTS =============

export const REWARD_EXTRACTION_PROMPT = `
Kamu adalah REWARD EXTRACTOR untuk iGaming Knowledge Base.

🔒 KLASIFIKASI:
- program_classification: "A"
- program_classification_name: "Reward Program"
- Ini adalah BONUS/REWARD yang user LANGSUNG dapat dari aksi

📋 FIELD YANG HARUS DIEKSTRAK:

IDENTITY:
- promo_name: Nama promo (contoh: "WELCOME BONUS 100%")
- promo_type: "Welcome Bonus" | "Deposit Bonus" | "Cashback" | "Rollingan" | "Referral Bonus"
- client_id: Nama brand/website (contoh: "CITRA77", "PAPUA4D")
- target_user: "new_member" | "all" | "vip"

CALCULATION:
- calculation_base: "deposit" | "turnover" | "bet_amount"
- calculation_method: "percentage" | "fixed"
- calculation_value: Number (contoh: 100 untuk 100%)
- minimum_base: Number minimal deposit/bet (contoh: 50000)
- max_bonus: Number maksimal bonus atau null jika unlimited
- turnover_rule: Number multiplier (contoh: 8 untuk 8x)
- payout_direction: "depan" (dapat bonus dulu) | "belakang" (main dulu)

GAME SCOPE:
- game_types: Array ["slot", "casino", "sports", "togel"]
- game_providers: Array ["Pragmatic Play", "PG Soft"] atau ["ALL"]
- blacklist.enabled: boolean
- blacklist.games: Array game yang dikecualikan
- blacklist.providers: Array provider yang dikecualikan
- blacklist.rules: Array aturan umum (contoh: "Game 3 line")

TERMS:
- terms_conditions: Array string syarat & ketentuan
- claim_method: "Auto" | "Live Chat" | "Klaim Manual"

DATES:
- valid_from: "YYYY-MM-DD" atau null
- valid_until: "YYYY-MM-DD" atau null

CONFIDENCE per field:
- "explicit": tertulis jelas di tabel/teks
- "explicit_from_terms": dari S&K
- "derived": inferensi logis
- "unknown": tidak ada data
- "not_applicable": tidak relevan untuk tipe ini

📤 OUTPUT:
- JSON VALID saja
- Tanpa markdown wrapper
- Tanpa penjelasan
`;

export const EVENT_EXTRACTION_PROMPT = `
Kamu adalah EVENT EXTRACTOR untuk iGaming Knowledge Base.

🔒 KLASIFIKASI:
- program_classification: "B"
- program_classification_name: "Event Program"
- Ini adalah EVENT/KOMPETISI berbatas waktu dengan winner/ranking

📋 FIELD YANG HARUS DIEKSTRAK:

IDENTITY:
- event_name: Nama event (contoh: "LUCKY DRAW NATAL")
- event_type: "tournament" | "race" | "lucky_draw" | "leaderboard" | "mission"
- client_id: Nama brand/website
- target_user: "new_member" | "all" | "vip"

PERIOD:
- start_date: "YYYY-MM-DD"
- end_date: "YYYY-MM-DD"
- is_recurring: boolean
- recurrence_pattern: "daily" | "weekly" | "monthly" | null

MECHANICS:
- participation_method: String (contoh: "Deposit minimal 100rb")
- qualification_rules: Array string syarat kualifikasi
- scoring_system: String atau null (contoh: "Turnover tertinggi")

PRIZES:
- prize_pool: Number total hadiah atau null
- prizes: Array { rank: "1st", reward: "Rp 10.000.000" }
- winner_count: Number jumlah pemenang
- winner_selection: "highest_score" | "random_draw" | "first_come"

TERMS:
- terms_conditions: Array string syarat & ketentuan

SCOPE:
- applicable_games: Array game yang berlaku
- excluded_games: Array game yang dikecualikan

📤 OUTPUT:
- JSON VALID saja
- Tanpa markdown wrapper
- Tanpa penjelasan
`;

export const POLICY_EXTRACTION_PROMPT = `
Kamu adalah POLICY EXTRACTOR untuk iGaming Knowledge Base.

🔒 KLASIFIKASI TERKUNCI:
- program_classification: "C"
- program_classification_name: "Policy Program"
- Ini adalah ATURAN/KEBIJAKAN, BUKAN bonus/reward

📋 FIELD YANG HARUS DIEKSTRAK:

IDENTITY:
- policy_name: Nama kebijakan (contoh: "Deposit Pulsa Tanpa Potongan")
- policy_type: "deposit_policy" | "withdrawal_policy" | "betting_restriction" | "game_restriction" | "general_policy"
- client_id: Nama brand/website (contoh: "PAPUA4D")

DEPOSIT RULES (jika policy_type = deposit_policy):
- deposit_method: Array metode deposit ["pulsa", "bank", "ewallet"]
- accepted_providers: String provider (contoh: "Telkomsel, XL, Axis")
- minimal_deposit: String nominal (contoh: "Rp 5.000")
- maximal_deposit: String atau "Tidak ada batasan"
- deposit_rate: Number (100 = tanpa potongan, 90 = potongan 10%)

USAGE REQUIREMENTS (array):
- game_category: String (contoh: "Slots", "Sportbook")
- credit_multiplier: String (contoh: "5x Jumlah Credit")
- max_bet_rule: String atau null

GAME SCOPE:
- applicable_games: Array game yang berlaku
- excluded_games: Array game yang dikecualikan (contoh: ["Togel"])

RESTRICTIONS:
- prohibitions: Array larangan/hal yang tidak boleh
- restrictions: Array pembatasan umum

PENALTIES (array):
- type: "potongan_withdraw" | "hangus" | "suspend" | "blokir"
- detail: String penjelasan
- percentage: Number jika ada (contoh: 50)
- minimum_amount: String jika ada

AUTHORITY:
- authority_clause: String klausa keputusan mutlak
- terms_can_change: boolean

TERMS:
- terms_conditions: Array string syarat & ketentuan tambahan

🚫 ATURAN KERAS (WAJIB DIPATUHI):
1. JIKA tidak yakin sebuah field ada → SET null
2. DILARANG mengarang field reward
3. DILARANG mengisi bonus_percentage, max_bonus, turnover_for_reward dengan angka APAPUN
4. Kata "deposit", "tanpa potongan", "promo" BUKAN berarti ada bonus
5. Syarat kredit untuk WITHDRAW ≠ turnover untuk DAPAT bonus
6. SEMUA content dengan penalti/larangan = POLICY

🚫 FIELD YANG WAJIB null UNTUK POLICY (TIDAK ADA REWARD):
- bonus_percentage: null
- reward_type: null
- max_bonus: null
- turnover_for_reward: null
- calculation_value: null
- cashback_rate: null
- turnover_rule: null
- payout_direction: null

📤 OUTPUT:
- JSON VALID saja
- Tanpa markdown wrapper
- Tanpa penjelasan
- Tanpa komentar
`;

// ============= PROMPT SELECTOR =============

export function getExtractionPrompt(category: ProgramCategory): string {
  switch (category) {
    case 'A':
      return REWARD_EXTRACTION_PROMPT;
    case 'B':
      return EVENT_EXTRACTION_PROMPT;
    case 'C':
      return POLICY_EXTRACTION_PROMPT;
    default:
      console.warn('[Classifier] Unknown category, defaulting to POLICY');
      return POLICY_EXTRACTION_PROMPT;
  }
}

// ============= UTILITY EXPORTS =============

export function getCategoryBadgeStyle(category: ProgramCategory): string {
  switch (category) {
    case 'A':
      return 'bg-success/20 text-success border-success/40'; // Green for Reward
    case 'B':
      return 'bg-primary/20 text-primary border-primary/40'; // Blue for Event
    case 'C':
      return 'bg-muted text-muted-foreground border-border'; // Gray for Policy
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

export function getCategoryLabel(category: ProgramCategory): string {
  switch (category) {
    case 'A':
      return 'Reward';
    case 'B':
      return 'Event';
    case 'C':
      return 'Policy';
    default:
      return 'Unknown';
  }
}
