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
// MAIN REASONER FUNCTION
// ============================================

const REASONER_VERSION = 'v1.0.0+2025-01-09';

/**
 * Run Step-0 Intent Reasoning on promo content.
 * Returns PromoIntent with evidence and confidence.
 */
export async function reasonPromoIntent(content: string): Promise<PromoIntent> {
  const apiKey = getOpenAIKey();
  
  if (!apiKey) {
    console.warn('[Intent Reasoner] No API key, returning fallback intent');
    return createFallbackIntent(content);
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
 * Create fallback intent when LLM fails.
 * Uses basic heuristics, NOT keyword matching.
 */
function createFallbackIntent(content: string): PromoIntent {
  const contentLower = content.toLowerCase();
  
  // Very basic heuristics - conservative defaults
  let primary_action: PrimaryAction = 'deposit';
  let reward_nature: RewardNature = 'calculated';
  let value_shape: ValueShape = 'percent';
  
  // Download detection
  if (/download|apk|aplikasi/i.test(contentLower)) {
    primary_action = 'download_apk';
    reward_nature = 'given';
    value_shape = 'range';
  }
  
  // Loss-based detection
  if (/kekalahan|loss|cashback/i.test(contentLower)) {
    primary_action = 'loss';
  }
  
  // Turnover detection
  if (/rollingan|turnover/i.test(contentLower)) {
    primary_action = 'turnover';
  }
  
  // Referral detection
  if (/referral|ajak teman/i.test(contentLower)) {
    primary_action = 'referral';
  }
  
  return {
    primary_action,
    reward_nature,
    value_determiner: reward_nature === 'given' ? 'fixed' : 'system_calculate',
    time_scope: 'ongoing',
    distribution_path: 'auto',
    value_shape,
    intent_evidence: ['[FALLBACK] No evidence extracted'],
    confidence: 0.3, // Low confidence for fallback
    reasoning: 'Fallback intent created due to LLM failure',
    reasoner_version: REASONER_VERSION,
    processed_at: new Date().toISOString(),
  };
}

// ============================================
// EXPORTS
// ============================================

export {
  REASONER_VERSION,
};
