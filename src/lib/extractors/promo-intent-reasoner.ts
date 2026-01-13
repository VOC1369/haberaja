/**
 * Promo Intent Reasoner (Step-0)
 * Version: v1.0.0+2025-01-09
 * 
 * REASONING-FIRST ARCHITECTURE:
 * This module performs LLM reasoning BEFORE extraction.
 * It answers 6 core questions to understand promo intent.
 * 
 * Q0A: What does user DO to get reward? (primary_action)
 * Q0B: Is reward calculated or given? (reward_nature)
 * Q0C: Who determines the value? (value_determiner)
 * Q0D: Is there a time limit? (time_scope)
 * Q0E: How is reward distributed? (distribution_path)
 * Q0F: What shape is the reward value? (value_shape)
 * 
 * OUTPUT: PromoIntent with evidence spans for audit trail
 */

import { getOpenAIKey, IS_DEV_MODE } from '../config/openai.dev';

// ============================================
// TYPES
// ============================================

export type PrimaryAction = 
  | 'deposit'       // User deposits money
  | 'loss'          // User loses money (cashback)
  | 'turnover'      // User accumulates turnover (rollingan)
  | 'withdraw'      // User withdraws money (WD bonus)
  | 'download_apk'  // User downloads app
  | 'login'         // User logs in
  | 'referral'      // User refers friends
  | 'mission'       // User completes mission/quest
  | 'redeem'        // User redeems points/voucher
  | 'bet'           // User places bets
  | 'level_up'      // User reaches level/tier
  | 'register'      // User registers new account
  | 'verify'        // User verifies identity
  | 'birthday';     // Special: birthday trigger

export type RewardNature = 
  | 'given'         // Reward is fixed, given directly
  | 'calculated';   // Reward is calculated (%, formula)

export type ValueDeterminer = 
  | 'user_choice'   // User selects reward (redemption, catalog)
  | 'system_calculate' // System calculates (formula)
  | 'fixed';        // Fixed value, no calculation

export type TimeScope = 
  | 'limited'       // Has end date
  | 'ongoing'       // No end date but can claim repeatedly
  | 'permanent';    // One-time, permanent benefit

export type DistributionPath = 
  | 'auto'          // Automatically credited
  | 'manual_cs'     // Must contact CS
  | 'redemption_store' // Must redeem in store
  | 'system_wallet'; // Credited to wallet

export type ValueShape = 
  | 'fixed'         // Single fixed amount (Rp 50.000)
  | 'percent'       // Percentage (10%)
  | 'range'         // Range of values (5K - 20K)
  | 'tier_table'    // Tiered table (Level 1: X, Level 2: Y)
  | 'catalog';      // Catalog of items to choose

// ============================================
// PROMO INTENT INTERFACE
// ============================================

export interface PromoIntent {
  // Core Questions (Q0A-D)
  primary_action: PrimaryAction;
  reward_nature: RewardNature;
  value_determiner: ValueDeterminer;
  time_scope: TimeScope;
  
  // Extended Axes (Q0E-F)
  distribution_path: DistributionPath;
  value_shape: ValueShape;
  
  // Evidence for Audit Trail (2-4 text spans)
  intent_evidence: string[];
  
  // Confidence (deterministic, NOT from LLM)
  confidence: number;
  
  // LLM's reasoning explanation
  reasoning: string;
  
  // Metadata
  reasoner_version: string;
  processed_at: string;
}

// ============================================
// INTENT REASONER PROMPT
// ============================================

export const INTENT_REASONER_PROMPT = `
Kamu adalah PROMO INTENT ANALYZER. 
Tugasmu adalah MEMAHAMI promo, BUKAN mengekstrak field.

Jawab 6 pertanyaan ini SEBELUM menganalisis detail:

## Q0A: User ngapain untuk dapat reward ini?
Pilih SATU yang paling akurat:
- deposit: User harus deposit uang
- loss: User mendapat reward dari kekalahan (cashback)
- turnover: User harus akumulasi turnover (rollingan)
- download_apk: User harus download aplikasi
- login: User hanya perlu login
- referral: User harus ajak teman
- mission: User harus selesaikan misi/quest
- redeem: User harus tukar poin/voucher
- bet: User harus pasang taruhan
- level_up: User harus naik level/tier
- register: User harus daftar akun baru
- verify: User harus verifikasi identitas
- birthday: Reward untuk ulang tahun

## Q0B: Reward ini dihitung atau langsung dikasih?
- given: Langsung dikasih (nominal fix, item spesifik)
- calculated: Dihitung (persentase, formula, berdasarkan deposit/loss)

## Q0C: Siapa yang menentukan nilai reward?
- user_choice: User pilih sendiri (katalog, redemption)
- system_calculate: Sistem hitung (formula %)
- fixed: Nilai sudah tetap dari awal

## Q0D: Ada batasan waktu?
- limited: Ada tanggal mulai/berakhir
- ongoing: Tidak ada tanggal akhir, bisa klaim berulang
- permanent: Sekali klaim, permanen

## Q0E: Bagaimana reward didistribusikan?
- auto: Otomatis masuk saldo
- manual_cs: Harus hubungi CS
- redemption_store: Harus tukar di store/redemption
- system_wallet: Masuk ke wallet khusus

## Q0F: Bentuk nilai reward-nya?
- fixed: Nominal tetap (Rp 50.000, 100 poin)
- percent: Persentase (10%, 0.5%)
- range: Rentang nilai (5K - 20K, pilih antara)
- tier_table: Tabel bertingkat (Level 1: X, Level 2: Y)
- catalog: Katalog item untuk dipilih

## OUTPUT FORMAT (JSON):
{
  "primary_action": "...",
  "reward_nature": "...",
  "value_determiner": "...",
  "time_scope": "...",
  "distribution_path": "...",
  "value_shape": "...",
  "intent_evidence": [
    "kutipan teks 1 yang mendukung kesimpulan",
    "kutipan teks 2 yang mendukung kesimpulan",
    "kutipan teks 3 (opsional)",
    "kutipan teks 4 (opsional)"
  ],
  "reasoning": "Penjelasan singkat mengapa jawaban ini dipilih"
}

## ATURAN KRITIS:
1. FOKUS pada INTENT, bukan detail angka
2. Evidence harus kutipan LANGSUNG dari teks
3. Minimal 2 evidence, maksimal 4
4. Jika ragu antara 2 pilihan, pilih yang LEBIH KONSERVATIF

## CONTOH:

Input: "Download Aplikasi Dapat Freechip 5K-20K, pilih sendiri credit game-nya"
Output:
{
  "primary_action": "download_apk",
  "reward_nature": "given",
  "value_determiner": "user_choice",
  "time_scope": "ongoing",
  "distribution_path": "redemption_store",
  "value_shape": "range",
  "intent_evidence": [
    "Download Aplikasi",
    "Dapat Freechip 5K-20K",
    "pilih sendiri credit game"
  ],
  "reasoning": "User harus download APK untuk dapat reward. Reward langsung dikasih (given) dengan nilai range 5K-20K yang user pilih sendiri."
}

Input: "Cashback 5% dari total kekalahan, otomatis masuk setiap Senin"
Output:
{
  "primary_action": "loss",
  "reward_nature": "calculated",
  "value_determiner": "system_calculate",
  "time_scope": "ongoing",
  "distribution_path": "auto",
  "value_shape": "percent",
  "intent_evidence": [
    "Cashback 5%",
    "total kekalahan",
    "otomatis masuk setiap Senin"
  ],
  "reasoning": "Ini cashback berbasis kekalahan (loss). Sistem menghitung 5% dari loss. Distribusi otomatis mingguan."
}

📤 OUTPUT: JSON VALID saja, tanpa markdown code block.
`;

// ============================================
// CONFIDENCE SCORING (DETERMINISTIC)
// ============================================

/**
 * Calculate confidence score based on evidence quality.
 * This is DETERMINISTIC, not from LLM output.
 */
export function calculateIntentConfidence(intent: Partial<PromoIntent>): number {
  let score = 0.5; // Base score
  
  // Evidence quantity scoring
  const evidenceCount = intent.intent_evidence?.length ?? 0;
  if (evidenceCount >= 2) score += 0.15;
  if (evidenceCount >= 3) score += 0.10;
  if (evidenceCount >= 4) score += 0.05;
  
  // Evidence quality check: does it contain action and reward?
  const evidenceText = (intent.intent_evidence || []).join(' ').toLowerCase();
  const hasActionEvidence = /deposit|download|login|referral|turnover|loss|klaim|tukar|mission|level/i.test(evidenceText);
  const hasRewardEvidence = /bonus|reward|hadiah|cash|credit|voucher|tiket|poin|freechip|freebet/i.test(evidenceText);
  
  if (hasActionEvidence && hasRewardEvidence) {
    score += 0.15;
  } else if (hasActionEvidence || hasRewardEvidence) {
    score += 0.05;
  }
  
  // Conflict detection penalty
  // If calculated but no percent/formula hint, reduce confidence
  if (intent.reward_nature === 'calculated' && intent.value_shape === 'fixed') {
    // This is suspicious: calculated but fixed shape?
    score -= 0.10;
  }
  
  // If given but has percent shape, reduce confidence
  if (intent.reward_nature === 'given' && intent.value_shape === 'percent') {
    score -= 0.15;
  }
  
  // Reasoning quality bonus
  if (intent.reasoning && intent.reasoning.length > 50) {
    score += 0.05;
  }
  
  // Clamp to 0-1 range
  return Math.max(0, Math.min(1, score));
}

/**
 * Check if intent has conflicts (internal contradictions)
 */
export function detectIntentConflicts(intent: PromoIntent): string[] {
  const conflicts: string[] = [];
  
  // Given + percent is contradictory
  if (intent.reward_nature === 'given' && intent.value_shape === 'percent') {
    conflicts.push('reward_nature=given contradicts value_shape=percent');
  }
  
  // Calculated + fixed without system_calculate is suspicious
  if (intent.reward_nature === 'calculated' && intent.value_determiner === 'fixed') {
    conflicts.push('reward_nature=calculated contradicts value_determiner=fixed');
  }
  
  // User choice with auto distribution is suspicious
  if (intent.value_determiner === 'user_choice' && intent.distribution_path === 'auto') {
    conflicts.push('value_determiner=user_choice rarely has distribution_path=auto');
  }
  
  // Range/catalog with calculated is contradictory
  if (intent.reward_nature === 'calculated' && (intent.value_shape === 'range' || intent.value_shape === 'catalog')) {
    conflicts.push(`reward_nature=calculated contradicts value_shape=${intent.value_shape}`);
  }
  
  return conflicts;
}

// ============================================
// DETERMINISTIC INTENT DETECTION (Contract of Thinking v1.0)
// NO API CALL for obvious cases - pattern matching only
// ============================================

/**
 * Extract evidence snippets from content for audit trail
 */
function extractEvidence(content: string, keywords: string[]): string[] {
  const evidence: string[] = [];
  for (const kw of keywords) {
    const regex = new RegExp(`.{0,25}${kw}.{0,25}`, 'i');
    const match = content.match(regex);
    if (match) evidence.push(match[0].trim());
  }
  return evidence.slice(0, 4); // Max 4 evidence
}

/**
 * DETERMINISTIC detection for obvious cases.
 * NO API call needed - pattern matching only.
 * Returns high confidence (0.9+) for definitive patterns.
 * 
 * CONTRACT OF THINKING v1.0 - Section B & F:
 * - REASON before DECIDE
 * - Confidence >= 0.9 → skip LLM
 * - Confidence < 0.6 → UNCERTAINTY MODE
 */
export function detectObviousIntent(content: string): PromoIntent | null {
  const lower = content.toLowerCase();
  
  // ========== APK DOWNLOAD - DEFINITE pattern ==========
  if (/download\s*(aplikasi|apk)|install\s*apk|unduh\s*(app|aplikasi)/i.test(lower)) {
    const hasRedemptionStore = /redemption\s*store|tukar|pilih\s*(credit|hadiah|sendiri)|store/i.test(lower);
    const hasRange = /\d+[kK]?\s*[-–]\s*\d+[kK]?/i.test(lower);
    
    console.log('[Intent Reasoner] DETERMINISTIC: APK Download detected');
    return {
      primary_action: 'download_apk',
      reward_nature: 'given',
      value_determiner: hasRedemptionStore ? 'user_choice' : 'fixed',
      distribution_path: hasRedemptionStore ? 'redemption_store' : 'auto',
      value_shape: hasRange ? 'range' : 'fixed',
      time_scope: 'ongoing',
      intent_evidence: extractEvidence(lower, ['download', 'apk', 'aplikasi', 'freechip', 'credit']),
      confidence: 0.95,
      reasoning: 'Deterministic: APK Download pattern detected - mode=event, no calculation needed',
      reasoner_version: REASONER_VERSION,
      processed_at: new Date().toISOString(),
    };
  }
  
  // ========== BIRTHDAY - DEFINITE pattern ==========
  if (/ulang\s*tahun|birthday|ultah|bday|ulangtahun/i.test(lower)) {
    console.log('[Intent Reasoner] DETERMINISTIC: Birthday detected');
    return {
      primary_action: 'birthday',
      reward_nature: 'given',
      value_determiner: 'fixed',
      distribution_path: 'auto',
      value_shape: 'fixed',
      time_scope: 'ongoing',
      intent_evidence: extractEvidence(lower, ['ulang tahun', 'birthday', 'ultah', 'bonus']),
      confidence: 0.95,
      reasoning: 'Deterministic: Birthday pattern detected - fixed reward, yearly claim',
      reasoner_version: REASONER_VERSION,
      processed_at: new Date().toISOString(),
    };
  }
  
  // ========== REFERRAL - DEFINITE pattern ==========
  if (/referral|referal|refferal|ajak\s*teman|invite|undang\s*teman|rekrut/i.test(lower)) {
    console.log('[Intent Reasoner] DETERMINISTIC: Referral detected');
    return {
      primary_action: 'referral',
      reward_nature: 'calculated',
      value_determiner: 'system_calculate',
      distribution_path: 'auto',
      value_shape: 'tier_table',
      time_scope: 'ongoing',
      intent_evidence: extractEvidence(lower, ['referral', 'ajak teman', 'invite', 'komisi', 'downline']),
      confidence: 0.92,
      reasoning: 'Deterministic: Referral pattern detected - commission-based, tier table',
      reasoner_version: REASONER_VERSION,
      processed_at: new Date().toISOString(),
    };
  }
  
  // ========== CASHBACK / LOSS-BASED - DEFINITE pattern ==========
  if (/cashback|cash\s*back|rebate/i.test(lower) && /kekalahan|loss|kalah/i.test(lower)) {
    console.log('[Intent Reasoner] DETERMINISTIC: Cashback (loss-based) detected');
    return {
      primary_action: 'loss',
      reward_nature: 'calculated',
      value_determiner: 'system_calculate',
      distribution_path: 'auto',
      value_shape: 'percent',
      time_scope: 'ongoing',
      intent_evidence: extractEvidence(lower, ['cashback', 'kekalahan', 'loss', '%']),
      confidence: 0.92,
      reasoning: 'Deterministic: Cashback loss-based pattern detected - percentage of loss',
      reasoner_version: REASONER_VERSION,
      processed_at: new Date().toISOString(),
    };
  }
  
  // ========== ROLLINGAN / TURNOVER-BASED - DEFINITE pattern ==========
  if (/rollingan|roll(ing)?an/i.test(lower) || (/turnover|to\s*bonus/i.test(lower) && /%/i.test(lower))) {
    console.log('[Intent Reasoner] DETERMINISTIC: Rollingan (turnover-based) detected');
    return {
      primary_action: 'turnover',
      reward_nature: 'calculated',
      value_determiner: 'system_calculate',
      distribution_path: 'auto',
      value_shape: 'percent',
      time_scope: 'ongoing',
      intent_evidence: extractEvidence(lower, ['rollingan', 'turnover', '%', 'mingguan']),
      confidence: 0.90,
      reasoning: 'Deterministic: Rollingan/turnover pattern detected - percentage of TO',
      reasoner_version: REASONER_VERSION,
      processed_at: new Date().toISOString(),
    };
  }
  
  // ========== WITHDRAW-BASED - DEFINITE pattern ==========
  // Patterns: bonus wd, bonus withdraw, extra wd, bonus penarikan, wd bonus
  // ✅ FIX: Match "BONUS EXTRA WD 5% SETIAP HARI" - allow numbers/% between words
  if (/bonus\s*extra\s*(?:\d+%?\s*)?wd/i.test(lower) ||
      /extra\s*(?:\d+%?\s*)?wd/i.test(lower) ||
      /bonus\s*(extra\s*)?(wd|withdraw|penarikan)/i.test(lower) ||
      /wd\s*bonus/i.test(lower)) {
    console.log('[Intent Reasoner] DETERMINISTIC: Withdraw bonus detected');
    return {
      primary_action: 'withdraw',
      reward_nature: 'calculated',
      value_determiner: 'system_calculate',
      distribution_path: 'manual_cs',  // Per terms: "claim ke livechat"
      value_shape: 'percent',
      time_scope: 'ongoing',
      intent_evidence: extractEvidence(lower, ['bonus', 'wd', 'withdraw', '%', 'penarikan', 'extra']),
      confidence: 0.92,
      reasoning: 'Deterministic: Withdraw bonus pattern - triggered on WD, calculated from turnover evidence',
      reasoner_version: REASONER_VERSION,
      processed_at: new Date().toISOString(),
    };
  }
  
  // ========== LUCKY SPIN / MINI GAME - DEFINITE pattern ==========
  if (/lucky\s*spin|mini\s*game|roda\s*keberuntungan|spin\s*gratis|putar\s*roda/i.test(lower)) {
    console.log('[Intent Reasoner] DETERMINISTIC: Lucky Spin detected');
    return {
      primary_action: 'redeem',
      reward_nature: 'given',
      value_determiner: 'user_choice',
      distribution_path: 'redemption_store',
      value_shape: 'catalog',
      time_scope: 'ongoing',
      intent_evidence: extractEvidence(lower, ['lucky spin', 'spin', 'putar', 'hadiah']),
      confidence: 0.90,
      reasoning: 'Deterministic: Lucky Spin pattern detected - catalog redemption',
      reasoner_version: REASONER_VERSION,
      processed_at: new Date().toISOString(),
    };
  }
  
  return null; // Let LLM handle ambiguous cases
}

// ============================================
// MAIN REASONER FUNCTION
// ============================================

const REASONER_VERSION = 'v1.1.0+contract-of-thinking';

/**
 * Run Step-0 Intent Reasoning on promo content.
 * Returns PromoIntent with evidence and confidence.
 * 
 * CONTRACT OF THINKING v1.0:
 * - STEP 0: Deterministic detection (no API call)
 * - STEP 1: LLM reasoning (if API key exists)
 * - STEP 2: UNCERTAINTY MODE (if no API key or LLM fails)
 */
export async function reasonPromoIntent(content: string): Promise<PromoIntent> {
  // STEP 0: Deterministic detection FIRST (NO API CALL)
  const obviousIntent = detectObviousIntent(content);
  if (obviousIntent && obviousIntent.confidence >= 0.9) {
    console.log('[Intent Reasoner] DETERMINISTIC: Skipping LLM call, confidence =', obviousIntent.confidence);
    return obviousIntent;
  }
  
  // STEP 1: Try LLM if API key exists
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    console.warn('[Intent Reasoner] No API key → UNCERTAINTY MODE');
    return createUncertainIntent(content);
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.1, // Low temperature for consistency
        messages: [
          { role: 'system', content: INTENT_REASONER_PROMPT },
          { role: 'user', content: `Analisis promo berikut:\n\n${content}` },
        ],
      }),
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';
    
    // Parse LLM response
    const parsed = parseIntentResponse(rawContent);
    
    // Calculate deterministic confidence
    const confidence = calculateIntentConfidence(parsed);
    
    // Detect conflicts
    const conflicts = detectIntentConflicts(parsed as PromoIntent);
    
    // Apply conflict penalty
    const finalConfidence = Math.max(0, confidence - (conflicts.length * 0.1));
    
    if (IS_DEV_MODE) {
      console.log('[Intent Reasoner] Raw LLM response:', rawContent);
      console.log('[Intent Reasoner] Parsed intent:', parsed);
      console.log('[Intent Reasoner] Conflicts:', conflicts);
      console.log('[Intent Reasoner] Final confidence:', finalConfidence);
    }
    
    return {
      primary_action: parsed.primary_action || 'deposit',
      reward_nature: parsed.reward_nature || 'calculated',
      value_determiner: parsed.value_determiner || 'system_calculate',
      time_scope: parsed.time_scope || 'ongoing',
      distribution_path: parsed.distribution_path || 'auto',
      value_shape: parsed.value_shape || 'percent',
      intent_evidence: parsed.intent_evidence || [],
      confidence: finalConfidence,
      reasoning: parsed.reasoning || '',
      reasoner_version: REASONER_VERSION,
      processed_at: new Date().toISOString(),
    };
    
  } catch (error) {
    console.error('[Intent Reasoner] Error:', error);
    return createFallbackIntent(content);
  }
}

/**
 * Parse LLM response to PromoIntent structure
 */
function parseIntentResponse(rawContent: string): Partial<PromoIntent> {
  try {
    // Try direct JSON parse
    const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    // Fallback: try to extract JSON from text
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        console.warn('[Intent Reasoner] Failed to parse JSON from response');
      }
    }
    return {};
  }
}

/**
 * UNCERTAINTY MODE - Contract of Thinking v1.0 Section F
 * 
 * When confidence < 0.6 OR evidence < 2:
 * - needs_human_review = true
 * - mode = unknown (safe default)
 * - calculation_basis = null
 * 
 * JANGAN fallback keyword. Lebih baik unknown daripada confident-but-wrong.
 */
function createUncertainIntent(content: string): PromoIntent {
  console.log('[Intent Reasoner] UNCERTAINTY MODE activated');
  
  return {
    primary_action: 'deposit', // Safe default - most common
    reward_nature: 'given',    // Assume given (safer than calculated - no formula errors)
    value_determiner: 'fixed',
    time_scope: 'ongoing',
    distribution_path: 'auto',
    value_shape: 'fixed',
    intent_evidence: ['[UNCERTAIN] Insufficient evidence - needs human review'],
    confidence: 0.3, // LOW - triggers human review
    reasoning: 'UNCERTAINTY MODE: No API key and pattern not obvious. Human review required. DO NOT assume mode=formula.',
    reasoner_version: REASONER_VERSION,
    processed_at: new Date().toISOString(),
  };
}

/**
 * @deprecated Use createUncertainIntent instead
 * Kept for backward compatibility
 */
function createFallbackIntent(content: string): PromoIntent {
  return createUncertainIntent(content);
}

// ============================================
// EXPORTS
// ============================================

export {
  REASONER_VERSION,
};
