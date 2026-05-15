/**
 * EVIDENCE CLEANER v1.0
 * Minimal-cleaning layer untuk evidence sebelum ke taxonomy
 * 
 * PURPOSE:
 * - Normalize numeric values (hapus noise formatting)
 * - Detect boolean flags (signals untuk detector)
 * - Extract ranges (untuk tier/variant detection)
 * 
 * NON-PURPOSE:
 * - NOT a decision maker
 * - NOT a parser engine
 * - NOT allowed to guess mode/archetype
 * 
 * VERSION: v1.0.0+2025-01-22 (LOCKED)
 */

// ============================================
// CLEANED EVIDENCE INTERFACE
// ============================================

export interface CleanedEvidence {
  // Raw inputs (preserved as-is)
  promoName: string;
  terms: string;
  
  // Cleaned numeric values
  numericValues: {
    reward_amount?: number;
    min_deposit?: number;
    max_bonus?: number;
    turnover_multiplier?: number;
    valid_from?: string;   // ISO date
    valid_until?: string;  // ISO date
  };
  
  // Detected flags (boolean signals for taxonomy)
  flags: {
    has_apk_keywords: boolean;
    has_tier_structure: boolean;
    has_percentage_reward: boolean;
    has_fixed_amount: boolean;
    has_turnover_requirement: boolean;
    has_blacklist: boolean;
    has_referral_keywords: boolean;
    has_withdraw_keywords: boolean;
    has_loss_keywords: boolean;
    has_deposit_keywords: boolean;
    has_login_trigger: boolean;
    has_birthday_keywords: boolean;
    has_lucky_spin: boolean;
    has_competition: boolean;
  };
  
  // Range detection (for tier/variant promos)
  detectedRanges: {
    deposit_range?: { min: number; max: number };
    reward_variants?: number[];  // [5000, 10000, 20000]
  };
  
  // Cleaning metadata
  _cleaning_meta: {
    cleaned_at: string;
    version: string;
    patterns_matched: string[];
  };
}

// ============================================
// NUMERIC PATTERNS
// ============================================

const NUMERIC_PATTERNS = {
  // Indonesian currency formats
  rupiah: /rp\.?\s*([\d.,]+)/gi,
  shortform_k: /([\d.,]+)\s*k\b/gi,     // 50K, 100k
  shortform_rb: /([\d.,]+)\s*rb\b/gi,   // 50rb, 100 ribu
  shortform_jt: /([\d.,]+)\s*jt\b/gi,   // 5jt, 10 juta
  
  // Percentage
  percentage: /([\d.,]+)\s*%/g,
  
  // Multiplier
  multiplier: /([\d.,]+)\s*x\b/gi,
  
  // Plain numbers (fallback)
  plain: /\b([\d.,]+)\b/g,
};

// ============================================
// FLAG DETECTION PATTERNS
// ============================================

const FLAG_PATTERNS = {
  has_apk_keywords: [
    /download\s*apk/i,
    /\bapk\b/i,
    /aplikasi\s*(mobile|android|ios)?/i,
    /pengguna\s*apk/i,
    /khusus\s*apk/i,
    /install\s*app/i,
  ],
  
  has_tier_structure: [
    /tier\s*\d/i,
    /level\s*\d+\s*[→=:]/i,
    /bronze|silver|gold|platinum|diamond/i,
    /tahap(an)?\s*\d/i,
    /tingkat\s*\d/i,
  ],
  
  has_percentage_reward: [
    /\d+\s*%/,
    /persen/i,
  ],
  
  has_fixed_amount: [
    /rp\.?\s*[\d.,]+/i,
    /freechip/i,
    /freebet/i,
  ],
  
  has_turnover_requirement: [
    /turnover|to\s*\d+x/i,
    /syarat\s*(wd|withdraw|penarikan)/i,
    /sebelum\s*(wd|withdraw)/i,
  ],
  
  has_blacklist: [
    /tidak\s*(berlaku|termasuk)/i,
    /blacklist/i,
    /kecuali/i,
    /dikecualikan/i,
    /tidak\s*eligible/i,
  ],
  
  has_referral_keywords: [
    /referral/i,
    /referal/i,
    /refferal/i,
    /ajak\s*teman/i,
    /undang\s*teman/i,
    /rekrut/i,
  ],
  
  has_withdraw_keywords: [
    /withdraw/i,
    /\bwd\b/i,
    /penarikan/i,
    /tarik\s*dana/i,
  ],
  
  has_loss_keywords: [
    /\bloss\b/i,
    /kekalahan/i,
    /kalah/i,
    /cashback.*loss/i,
  ],
  
  has_deposit_keywords: [
    /deposit/i,
    /\bdepo\b/i,
    /setor/i,
  ],
  
  has_login_trigger: [
    /login/i,
    /masuk/i,
    /daily\s*reward/i,
    /harian/i,
  ],
  
  has_birthday_keywords: [
    /birthday/i,
    /ulang\s*tahun/i,
    /ultah/i,
    /hari\s*lahir/i,
  ],
  
  has_lucky_spin: [
    /lucky\s*spin/i,
    /spin\s*gratis/i,
    /roda\s*keberuntungan/i,
    /putar\s*roda/i,
    /gacha/i,
  ],
  
  has_competition: [
    /tournament/i,
    /turnamen/i,
    /leaderboard/i,
    /kompetisi/i,
    /ranking/i,
    /peringkat/i,
  ],
};

// ============================================
// MAIN CLEANING FUNCTION
// ============================================

export function cleanEvidence(
  promoName: string,
  terms: string
): CleanedEvidence {
  const combinedText = `${promoName} ${terms}`;
  const patternsMatched: string[] = [];
  
  // Extract numeric values
  const numericValues = extractNumericValues(combinedText, patternsMatched);
  
  // Detect flags
  const flags = detectFlags(combinedText, patternsMatched);
  
  // Detect ranges
  const detectedRanges = extractRanges(combinedText, patternsMatched);
  
  return {
    promoName,
    terms,
    numericValues,
    flags,
    detectedRanges,
    _cleaning_meta: {
      cleaned_at: new Date().toISOString(),
      version: '1.0.0',
      patterns_matched: patternsMatched,
    },
  };
}

// ============================================
// NUMERIC VALUE EXTRACTION
// ============================================

function extractNumericValues(
  text: string,
  patternsMatched: string[]
): CleanedEvidence['numericValues'] {
  const result: CleanedEvidence['numericValues'] = {};
  
  // Extract percentage (for reward_amount if percentage-based)
  const percentMatches = [...text.matchAll(NUMERIC_PATTERNS.percentage)];
  if (percentMatches.length > 0) {
    const firstPercent = parseNumericString(percentMatches[0][1]);
    if (firstPercent !== null && firstPercent > 0 && firstPercent <= 200) {
      result.reward_amount = firstPercent;
      patternsMatched.push(`percentage: ${firstPercent}%`);
    }
  }
  
  // Extract turnover multiplier
  const multiplierMatches = [...text.matchAll(NUMERIC_PATTERNS.multiplier)];
  if (multiplierMatches.length > 0) {
    const firstMultiplier = parseNumericString(multiplierMatches[0][1]);
    if (firstMultiplier !== null && firstMultiplier > 0 && firstMultiplier <= 100) {
      result.turnover_multiplier = firstMultiplier;
      patternsMatched.push(`multiplier: ${firstMultiplier}x`);
    }
  }
  
  // Extract rupiah amounts
  const rupiahMatches = extractRupiahAmounts(text);
  if (rupiahMatches.length > 0) {
    // Sort to find min/max candidates
    rupiahMatches.sort((a, b) => a - b);
    
    // Heuristic: smallest reasonable amount is likely min_deposit
    const minCandidate = rupiahMatches.find(v => v >= 10000 && v <= 1000000);
    if (minCandidate !== undefined) {
      result.min_deposit = minCandidate;
      patternsMatched.push(`min_deposit: Rp ${minCandidate}`);
    }
    
    // Heuristic: larger amounts might be max_bonus
    const maxCandidate = rupiahMatches.find(v => v > 100000 && v !== minCandidate);
    if (maxCandidate !== undefined) {
      result.max_bonus = maxCandidate;
      patternsMatched.push(`max_bonus: Rp ${maxCandidate}`);
    }
  }
  
  // Extract dates
  const dateResult = extractDateRange(text);
  if (dateResult.from) {
    result.valid_from = dateResult.from;
    patternsMatched.push(`valid_from: ${dateResult.from}`);
  }
  if (dateResult.until) {
    result.valid_until = dateResult.until;
    patternsMatched.push(`valid_until: ${dateResult.until}`);
  }
  
  return result;
}

/**
 * Parse numeric string with Indonesian formatting
 * Handles: 1.000.000, 1,000,000, 1000000, 50K, 50rb, 5jt
 */
function parseNumericString(str: string): number | null {
  if (!str) return null;
  
  // Remove all non-numeric chars except comma and period
  let cleaned = str.replace(/[^\d.,]/g, '');
  
  // Handle Indonesian format (1.000.000 = 1 million)
  if (cleaned.includes('.') && cleaned.includes(',')) {
    // Mixed format - assume periods are thousands separators
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.match(/\.\d{3}(\.\d{3})*$/)) {
    // Multiple periods = thousands separator (Indonesian)
    cleaned = cleaned.replace(/\./g, '');
  } else if (cleaned.includes(',')) {
    // Comma might be decimal or thousand separator
    if (cleaned.match(/,\d{3}$/)) {
      // Likely thousands separator
      cleaned = cleaned.replace(/,/g, '');
    } else {
      // Likely decimal
      cleaned = cleaned.replace(',', '.');
    }
  }
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Extract all rupiah amounts from text
 */
function extractRupiahAmounts(text: string): number[] {
  const amounts: number[] = [];
  
  // Direct Rp format
  const rpMatches = [...text.matchAll(NUMERIC_PATTERNS.rupiah)];
  for (const match of rpMatches) {
    const value = parseNumericString(match[1]);
    if (value !== null && value > 0) {
      amounts.push(value);
    }
  }
  
  // Shortform K (thousands)
  const kMatches = [...text.matchAll(NUMERIC_PATTERNS.shortform_k)];
  for (const match of kMatches) {
    const value = parseNumericString(match[1]);
    if (value !== null && value > 0) {
      amounts.push(value * 1000);
    }
  }
  
  // Shortform rb (ribu = thousands)
  const rbMatches = [...text.matchAll(NUMERIC_PATTERNS.shortform_rb)];
  for (const match of rbMatches) {
    const value = parseNumericString(match[1]);
    if (value !== null && value > 0) {
      amounts.push(value * 1000);
    }
  }
  
  // Shortform jt (juta = millions)
  const jtMatches = [...text.matchAll(NUMERIC_PATTERNS.shortform_jt)];
  for (const match of jtMatches) {
    const value = parseNumericString(match[1]);
    if (value !== null && value > 0) {
      amounts.push(value * 1000000);
    }
  }
  
  return amounts;
}

/**
 * Extract date range from text
 */
function extractDateRange(text: string): { from?: string; until?: string } {
  const result: { from?: string; until?: string } = {};
  
  // Pattern: DD/MM/YYYY or DD-MM-YYYY
  const datePattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g;
  const dateMatches = [...text.matchAll(datePattern)];
  
  if (dateMatches.length >= 1) {
    const first = dateMatches[0];
    const year = first[3].length === 2 ? `20${first[3]}` : first[3];
    result.from = `${year}-${first[2].padStart(2, '0')}-${first[1].padStart(2, '0')}`;
  }
  
  if (dateMatches.length >= 2) {
    const second = dateMatches[1];
    const year = second[3].length === 2 ? `20${second[3]}` : second[3];
    result.until = `${year}-${second[2].padStart(2, '0')}-${second[1].padStart(2, '0')}`;
  }
  
  return result;
}

// ============================================
// FLAG DETECTION
// ============================================

function detectFlags(
  text: string,
  patternsMatched: string[]
): CleanedEvidence['flags'] {
  const flags: CleanedEvidence['flags'] = {
    has_apk_keywords: false,
    has_tier_structure: false,
    has_percentage_reward: false,
    has_fixed_amount: false,
    has_turnover_requirement: false,
    has_blacklist: false,
    has_referral_keywords: false,
    has_withdraw_keywords: false,
    has_loss_keywords: false,
    has_deposit_keywords: false,
    has_login_trigger: false,
    has_birthday_keywords: false,
    has_lucky_spin: false,
    has_competition: false,
  };
  
  for (const [flagName, patterns] of Object.entries(FLAG_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        flags[flagName as keyof typeof flags] = true;
        patternsMatched.push(`${flagName}: matched`);
        break; // One match is enough for the flag
      }
    }
  }
  
  return flags;
}

// ============================================
// RANGE EXTRACTION
// ============================================

function extractRanges(
  text: string,
  patternsMatched: string[]
): CleanedEvidence['detectedRanges'] {
  const result: CleanedEvidence['detectedRanges'] = {};
  
  // Deposit range pattern: "Deposit 50K - 100K" or "Min 50rb Max 100rb"
  const rangePattern = /(?:deposit|depo|min(?:imal)?)\s*(?:rp\.?)?\s*([\d.,]+[kmrb]*)\s*[-–~]\s*(?:rp\.?)?\s*([\d.,]+[kmrb]*)/i;
  const rangeMatch = text.match(rangePattern);
  
  if (rangeMatch) {
    const min = parseShortformNumber(rangeMatch[1]);
    const max = parseShortformNumber(rangeMatch[2]);
    
    if (min !== null && max !== null && min < max) {
      result.deposit_range = { min, max };
      patternsMatched.push(`deposit_range: ${min}-${max}`);
    }
  }
  
  // Reward variants: multiple fixed amounts in table
  const rupiahAmounts = extractRupiahAmounts(text);
  if (rupiahAmounts.length >= 2) {
    // Filter to unique, reasonable reward values
    const uniqueAmounts = [...new Set(rupiahAmounts)]
      .filter(v => v >= 1000 && v <= 100000000)
      .sort((a, b) => a - b);
    
    if (uniqueAmounts.length >= 2) {
      result.reward_variants = uniqueAmounts;
      patternsMatched.push(`reward_variants: [${uniqueAmounts.join(', ')}]`);
    }
  }
  
  return result;
}

/**
 * Parse shortform numbers (50K, 100rb, 5jt)
 */
function parseShortformNumber(str: string): number | null {
  const cleaned = str.toLowerCase().replace(/[^\d.,kmrbjt]/g, '');
  
  let multiplier = 1;
  if (/k$/.test(str.toLowerCase())) {
    multiplier = 1000;
  } else if (/rb$/.test(str.toLowerCase()) || /ribu/.test(str.toLowerCase())) {
    multiplier = 1000;
  } else if (/jt$/.test(str.toLowerCase()) || /juta/.test(str.toLowerCase())) {
    multiplier = 1000000;
  } else if (/m$/.test(str.toLowerCase())) {
    multiplier = 1000000;
  }
  
  const numPart = parseNumericString(cleaned.replace(/[kmrbjt]+$/i, ''));
  return numPart !== null ? numPart * multiplier : null;
}

// ============================================
// EXPORTS
// ============================================

export const EVIDENCE_CLEANER_VERSION = '1.0.0';
