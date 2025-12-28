/**
 * VOC LLM-Based Category Classifier
 * Version: v1.0.0+2025-12-21
 * 
 * ARCHITECTURE:
 * - LLM answers Q1-Q4 with evidence
 * - Category calculated in CODE, not by LLM
 * - Quality gates determine confidence
 * - Human can override, all logged
 * 
 * CONTRACT OF TRUTH:
 * - AI = First-pass reasoning (menebak)
 * - UI = Authority (menentukan)
 * - Human = Gatekeeper (mengunci kebenaran)
 */

import { getOpenAIKey, IS_DEV_MODE } from '../config/openai.dev';

// ============================================
// TYPES
// ============================================

export type ProgramCategory = 'A' | 'B' | 'C';
export type ClassificationConfidence = 'high' | 'medium' | 'low';

export type QualityFlag = 
  | 'no_evidence'           // YA tapi evidence null
  | 'short_reasoning'       // reasoning < 40 chars
  | 'missing_specifics'     // tidak menyebut objek+fungsi
  | 'paraphrased_evidence'  // evidence bukan substring
  | 'single_weak_evidence'  // hanya 1 evidence tanpa angka
  | 'valid';                // lolos semua gate

export interface QAnswer {
  answer: 'ya' | 'tidak';
  reasoning: string;
  evidence: string | null;
}

export interface ClassificationResult {
  // Q1-Q4 Answers
  q1: QAnswer;
  q2: QAnswer;
  q3: QAnswer;
  q4: QAnswer;
  
  // Calculated by CODE (not LLM)
  category: ProgramCategory;
  category_name: string;
  
  // Quality Assessment
  confidence: ClassificationConfidence;
  quality_flags: QualityFlag[];
  evidence_count: number;
  
  // Metadata
  classifier_prompt_version: string;
  classification_model: string;
  classifier_runtime: 'client' | 'server';
  content_length: number;
  latency_ms: number;
  tokens_used?: number;
}

export interface ClassificationOverride {
  from: ProgramCategory;
  to: ProgramCategory;
  reason: string;
  overridden_by: string; // user_id or 'anonymous'
  timestamp: string;     // ISO format
}

// ============================================
// CONSTANTS
// ============================================

export const CLASSIFIER_PROMPT_VERSION = 'v1.0.0+2025-12-21';
export const CLASSIFICATION_MODEL = 'gpt-4o-mini';

// ============================================
// CLASSIFIER PROMPT (LLM hanya menjawab Q1-Q4)
// ============================================

const CLASSIFICATION_PROMPT = `
Kamu adalah REASONING ASSISTANT untuk klasifikasi konten iGaming.

🔒 ATURAN MUTLAK:
1. Kamu HANYA menjawab Q1-Q4 dengan reasoning dan evidence
2. Kamu TIDAK BOLEH menentukan kategori final
3. Kamu TIDAK BOLEH output "final_category", "program_nature", atau "classification"
4. Evidence HARUS kutipan PERSIS dari content (substring match)
5. Jika tidak ada bukti eksplisit, evidence = null

📋 PERTANYAAN (jawab SEMUA, jangan skip):

Q1: Apakah content ini UTAMANYA membahas PENALTI, LARANGAN, atau PEMBATASAN?
    Ciri-ciri: potongan %, suspend, hangus, tidak boleh, larangan, batasan
    Evidence harus mengandung kata-kata terkait penalty/restriction

Q2: Apakah ini SISTEM ONGOING tanpa end date yang membutuhkan AKUMULASI?
    Ciri-ciri: Loyalty Point, LP, EXP, Tier, Level, tukar/exchange, kumpulkan dulu
    PENTING: "Hadiah" di exchange table = Q2 YA, bukan event!
    Evidence harus menunjukkan mekanisme akumulasi/penukaran

Q3: Apakah user LANGSUNG DAPAT VALUE dari SATU AKSI tanpa akumulasi?
    Ciri-ciri: Welcome Bonus, Cashback otomatis, deposit langsung dapat %
    PENTING: Jika perlu kumpulkan/tukar dulu = BUKAN Q3
    Evidence harus menunjukkan instant reward

Q4: Apakah ada KOMPETISI dengan PERIODE TERBATAS dan PEMENANG/UNDIAN?
    Ciri-ciri: tanggal mulai-selesai, winner, ranking, undian, tournament
    PENTING: Exchange table dengan "Hadiah" = BUKAN Q4
    Evidence harus menunjukkan periode + winner mechanism

⚠️ EDGE CASES (WAJIB DIPAHAMI):
- "tidak mendapatkan bonus mingguan" = Q1 YA (pembatasan)
- "Hadiah Utama 2.5 Juta" di tabel tukar = Q2 YA (exchange, bukan event)
- "LP = Loyalty Point" = Q2 YA (sistem akumulasi)
- "Download APK dapat EXP" = Q2 YA (akumulasi, bukan instant reward)

📤 OUTPUT FORMAT (JSON ONLY, tanpa markdown):
{
  "q1_answer": "ya" atau "tidak",
  "q1_reasoning": "penjelasan 40+ karakter yang menyebut objek+fungsi spesifik",
  "q1_evidence": "kutipan PERSIS dari content" atau null,
  
  "q2_answer": "ya" atau "tidak",
  "q2_reasoning": "penjelasan 40+ karakter yang menyebut objek+fungsi spesifik",
  "q2_evidence": "kutipan PERSIS dari content" atau null,
  
  "q3_answer": "ya" atau "tidak",
  "q3_reasoning": "penjelasan 40+ karakter yang menyebut objek+fungsi spesifik",
  "q3_evidence": "kutipan PERSIS dari content" atau null,
  
  "q4_answer": "ya" atau "tidak",
  "q4_reasoning": "penjelasan 40+ karakter yang menyebut objek+fungsi spesifik",
  "q4_evidence": "kutipan PERSIS dari content" atau null
}
`;

// ============================================
// CATEGORY CALCULATION (IN CODE, NOT LLM)
// ============================================

export function calculateCategory(q1: string, q2: string, q3: string, q4: string): ProgramCategory {
  // FIXED PRIORITY ORDER (2025-12-24):
  // 1. Q1 (Penalty/Restriction) → C (Policy) - MUTLAK
  if (q1 === 'ya') return 'C';
  
  // 2. Q4 (Event dengan periode + pemenang) → B (Event)
  //    Lucky Spin, Tournament, Undian = Event, BUKAN Policy!
  //    Q4 harus dicek SEBELUM Q2 agar Event tidak kalah dari Ongoing System
  if (q4 === 'ya') return 'B';
  
  // 3. Q3 (Instant Reward tanpa akumulasi) → A (Reward)
  if (q3 === 'ya') return 'A';
  
  // 4. Q2 (Ongoing System - loyalty, tier, LP) → C (Policy)
  if (q2 === 'ya') return 'C';
  
  // 5. Default to Policy (most restrictive)
  return 'C';
}

export function getCategoryName(category: ProgramCategory): string {
  switch (category) {
    case 'A': return 'Reward Program';
    case 'B': return 'Event Program';
    case 'C': return 'Policy Program';
  }
}

/**
 * Post-processing override untuk memastikan konsistensi classification
 * ROLLINGAN = Policy Program (C) - turnover-based, recurring system
 * CASHBACK = Reward Program (A) - loss-based, instant claim
 * 
 * PRIORITY ORDER:
 * 1. promo_name (most reliable - user-facing title)
 * 2. promo_type (only if promo_name has no clear keywords)
 * 
 * CASHBACK checked before ROLLINGAN to handle "Rollingan Cashback" promo_type correctly
 */
export function applyKeywordOverrides(
  llmCategory: ProgramCategory,
  promoName: string,
  promoType?: string
): { category: ProgramCategory; wasOverridden: boolean; overrideReason?: string } {
  const nameLower = promoName.toLowerCase();
  const typeLower = (promoType || '').toLowerCase();
  
  // ============================================
  // STEP 1: Check PROMO_NAME first (highest priority)
  // The promo name is the most reliable indicator
  // ============================================
  
  // If promo_name contains CASHBACK → A (instant loss-based reward)
  if (/cashback|cash\s*back|rebate/i.test(nameLower)) {
    if (llmCategory !== 'A') {
      console.log('[Classifier] Keyword override: CASHBACK in promo_name, forcing A (was', llmCategory, ')');
      return { category: 'A', wasOverridden: true, overrideReason: 'CASHBACK in promo_name → Reward Program' };
    }
    return { category: 'A', wasOverridden: false };
  }
  
  // NEW MEMBER / WELCOME → A (one-time welcome bonus)
  if (/new\s*member|member\s*baru|welcome|selamat\s*datang/i.test(nameLower)) {
    if (llmCategory !== 'A') {
      console.log('[Classifier] Keyword override: NEW MEMBER in promo_name, forcing A (was', llmCategory, ')');
      return { category: 'A', wasOverridden: true, overrideReason: 'NEW MEMBER → Bonus Instan' };
    }
    return { category: 'A', wasOverridden: false };
  }
  
  // BIRTHDAY / ULANG TAHUN → A (one-time birthday reward)
  if (/birthday|ulang\s*tahun|ultah/i.test(nameLower)) {
    if (llmCategory !== 'A') {
      console.log('[Classifier] Keyword override: BIRTHDAY in promo_name, forcing A (was', llmCategory, ')');
      return { category: 'A', wasOverridden: true, overrideReason: 'BIRTHDAY → Bonus Instan' };
    }
    return { category: 'A', wasOverridden: false };
  }
  
  // LUCKY SPIN / MINI GAME / RODA → B (event with random/undian mechanism)
  if (/lucky\s*spin|mini\s*game|roda\s*keberuntungan|spin\s*the\s*wheel|putar\s*roda/i.test(nameLower)) {
    if (llmCategory !== 'B') {
      console.log('[Classifier] Keyword override: LUCKY SPIN/MINI GAME in promo_name, forcing B (was', llmCategory, ')');
      return { category: 'B', wasOverridden: true, overrideReason: 'LUCKY SPIN → Event Program' };
    }
    return { category: 'B', wasOverridden: false };
  }
  
  // TOURNAMENT / TURNAMEN / KOMPETISI → B (event with ranking/winners)
  if (/tournament|turnamen|kompetisi|leaderboard|ranking\s*event/i.test(nameLower)) {
    if (llmCategory !== 'B') {
      console.log('[Classifier] Keyword override: TOURNAMENT in promo_name, forcing B (was', llmCategory, ')');
      return { category: 'B', wasOverridden: true, overrideReason: 'TOURNAMENT → Event Program' };
    }
    return { category: 'B', wasOverridden: false };
  }
  
  // If promo_name contains ROLLINGAN → A (turnover-based cashback = Reward Program)
  if (/rollingan|roll(ing)?an/i.test(nameLower)) {
    if (llmCategory !== 'A') {
      console.log('[Classifier] Keyword override: ROLLINGAN in promo_name, forcing A (was', llmCategory, ')');
      return { category: 'A', wasOverridden: true, overrideReason: 'ROLLINGAN → Reward Program (turnover cashback)' };
    }
    return { category: 'A', wasOverridden: false };
  }
  
  // DEPOSIT PULSA / INFO → C (informational policy)
  if (/tersedia\s*deposit|deposit\s*pulsa|info\s*deposit/i.test(nameLower)) {
    return { category: 'C', wasOverridden: false };
  }
  
  // ============================================
  // STEP 2: Fallback to promo_type (if name didn't match)
  // Only check promo_type if promo_name didn't have clear keywords
  // Skip if promo_type contains BOTH keywords (e.g., "Rollingan Cashback")
  // ============================================
  
  const hasCashbackInType = /cashback|cash\s*back|rebate/i.test(typeLower);
  const hasRollinganInType = /rollingan|roll(ing)?an/i.test(typeLower);
  
  // If promo_type has BOTH keywords, don't override (rely on LLM)
  if (hasCashbackInType && hasRollinganInType) {
    console.log('[Classifier] promo_type has both CASHBACK and ROLLINGAN, no override');
    return { category: llmCategory, wasOverridden: false };
  }
  
  // promo_type pure CASHBACK
  if (hasCashbackInType) {
    if (llmCategory !== 'A') {
      console.log('[Classifier] Keyword override: CASHBACK in promo_type, forcing A (was', llmCategory, ')');
      return { category: 'A', wasOverridden: true, overrideReason: 'CASHBACK in promo_type → Reward Program' };
    }
    return { category: 'A', wasOverridden: false };
  }
  
  // promo_type pure ROLLINGAN → A (turnover-based cashback = Reward Program)
  if (hasRollinganInType) {
    if (llmCategory !== 'A') {
      console.log('[Classifier] Keyword override: ROLLINGAN in promo_type, forcing A (was', llmCategory, ')');
      return { category: 'A', wasOverridden: true, overrideReason: 'ROLLINGAN → Reward Program (turnover cashback)' };
    }
    return { category: 'A', wasOverridden: false };
  }
  
  // No override needed
  return { category: llmCategory, wasOverridden: false };
}

// ============================================
// QUALITY GATES (CONFIDENCE CALCULATION)
// ============================================

interface QualityAssessment {
  confidence: ClassificationConfidence;
  flags: QualityFlag[];
  evidence_count: number;
}

function assessQuality(
  answers: { q1: QAnswer; q2: QAnswer; q3: QAnswer; q4: QAnswer },
  content: string
): QualityAssessment {
  const flags: QualityFlag[] = [];
  let evidenceCount = 0;
  let hasConstraintEvidence = false;
  
  // Find the deciding question (first "ya")
  const decidingQ = 
    answers.q1.answer === 'ya' ? answers.q1 :
    answers.q2.answer === 'ya' ? answers.q2 :
    answers.q3.answer === 'ya' ? answers.q3 :
    answers.q4.answer === 'ya' ? answers.q4 : null;
  
  // Count all evidence
  [answers.q1, answers.q2, answers.q3, answers.q4].forEach(q => {
    if (q.evidence && q.evidence.trim().length > 0) {
      evidenceCount++;
      // Check if evidence contains constraint (angka, %, tanggal, limit)
      if (/\d+%|\d{1,2}[-\/]\d{1,2}|tidak|minimal|maksimal|wajib|dilarang/i.test(q.evidence)) {
        hasConstraintEvidence = true;
      }
    }
  });
  
  // ============================================
  // GATE A: Evidence wajib untuk deciding "YA"
  // ============================================
  if (decidingQ && decidingQ.answer === 'ya') {
    if (!decidingQ.evidence || decidingQ.evidence.trim().length === 0) {
      flags.push('no_evidence');
    } else {
      // Check if evidence is substring of content
      const evidenceLower = decidingQ.evidence.toLowerCase().trim();
      const contentLower = content.toLowerCase();
      if (!contentLower.includes(evidenceLower)) {
        flags.push('paraphrased_evidence');
      }
    }
  }
  
  // ============================================
  // GATE B: Specificity minimal (reasoning >= 40 chars)
  // ============================================
  if (decidingQ && decidingQ.reasoning.length < 40) {
    flags.push('short_reasoning');
  }
  
  // Check if reasoning mentions specific objects
  if (decidingQ && decidingQ.reasoning.length >= 40) {
    // Simple heuristic: reasoning should contain specific terms
    const hasSpecifics = /\d+|%|bonus|point|LP|EXP|tier|deposit|withdraw|potongan|hangus|suspend|hadiah|turnover|TO/i.test(decidingQ.reasoning);
    if (!hasSpecifics) {
      flags.push('missing_specifics');
    }
  }
  
  // ============================================
  // GATE C: Multi-evidence for high confidence
  // ============================================
  if (evidenceCount === 1 && !hasConstraintEvidence) {
    flags.push('single_weak_evidence');
  }
  
  // ============================================
  // CALCULATE CONFIDENCE
  // ============================================
  let confidence: ClassificationConfidence;
  
  if (flags.includes('no_evidence') || flags.includes('paraphrased_evidence')) {
    confidence = 'low';
  } else if (flags.includes('short_reasoning') || flags.includes('missing_specifics')) {
    confidence = 'medium';
  } else if (flags.includes('single_weak_evidence')) {
    confidence = 'medium';
  } else if (evidenceCount >= 2 || hasConstraintEvidence) {
    confidence = 'high';
  } else {
    confidence = 'medium';
  }
  
  // If no flags, mark as valid
  if (flags.length === 0) {
    flags.push('valid');
  }
  
  return { confidence, flags, evidence_count: evidenceCount };
}

// ============================================
// MAIN CLASSIFIER FUNCTION
// ============================================

export async function classifyContent(content: string): Promise<ClassificationResult> {
  // Use centralized DEV MODE API key
  const apiKey = getOpenAIKey();

  console.log('[Classifier] Starting LLM-based classification...');
  console.log('[Classifier] Prompt version:', CLASSIFIER_PROMPT_VERSION);
  console.log('[Classifier] Content length:', content.length);

  const startTime = performance.now();

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: CLASSIFICATION_MODEL,
        messages: [
          { role: 'system', content: CLASSIFICATION_PROMPT },
          { role: 'user', content: `Analisis content berikut:\n\n---\n${content.substring(0, 4000)}\n---` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    const latency = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Classifier] API error:', response.status, errorText);
      throw new Error(`Classification API error: ${response.status}`);
    }

    const data = await response.json();
    let resultText = data.choices?.[0]?.message?.content || '{}';
    
    // Clean markdown wrapper if present
    resultText = resultText.replace(/```json\n?/g, '').replace(/\n?```/g, '');

    const parsed = JSON.parse(resultText);
    
    // ============================================
    // VALIDATE: LLM should NOT have returned category
    // ============================================
    if (parsed.final_category || parsed.program_nature || parsed.program_classification) {
      console.warn('[Classifier] WARNING: LLM returned category (ignored). This violates contract.');
    }

    // Build Q answers
    const q1: QAnswer = {
      answer: parsed.q1_answer?.toLowerCase() === 'ya' ? 'ya' : 'tidak',
      reasoning: parsed.q1_reasoning || '',
      evidence: parsed.q1_evidence || null,
    };
    const q2: QAnswer = {
      answer: parsed.q2_answer?.toLowerCase() === 'ya' ? 'ya' : 'tidak',
      reasoning: parsed.q2_reasoning || '',
      evidence: parsed.q2_evidence || null,
    };
    const q3: QAnswer = {
      answer: parsed.q3_answer?.toLowerCase() === 'ya' ? 'ya' : 'tidak',
      reasoning: parsed.q3_reasoning || '',
      evidence: parsed.q3_evidence || null,
    };
    const q4: QAnswer = {
      answer: parsed.q4_answer?.toLowerCase() === 'ya' ? 'ya' : 'tidak',
      reasoning: parsed.q4_reasoning || '',
      evidence: parsed.q4_evidence || null,
    };

    // ============================================
    // CALCULATE CATEGORY IN CODE (NOT FROM LLM)
    // ============================================
    const category = calculateCategory(q1.answer, q2.answer, q3.answer, q4.answer);
    const categoryName = getCategoryName(category);

    // ============================================
    // ASSESS QUALITY & CONFIDENCE
    // ============================================
    const quality = assessQuality({ q1, q2, q3, q4 }, content);

    // ============================================
    // LOG RESULTS
    // ============================================
    console.log('[Classifier] === CLASSIFICATION RESULT ===');
    console.log('[Classifier] Q1 (Penalty):', q1.answer, '-', q1.reasoning.substring(0, 50) + '...');
    console.log('[Classifier] Q2 (Ongoing):', q2.answer, '-', q2.reasoning.substring(0, 50) + '...');
    console.log('[Classifier] Q3 (Instant):', q3.answer, '-', q3.reasoning.substring(0, 50) + '...');
    console.log('[Classifier] Q4 (Event):', q4.answer, '-', q4.reasoning.substring(0, 50) + '...');
    console.log('[Classifier] CATEGORY (calculated in code):', category, '-', categoryName);
    console.log('[Classifier] CONFIDENCE:', quality.confidence);
    console.log('[Classifier] QUALITY FLAGS:', quality.flags);
    console.log('[Classifier] EVIDENCE COUNT:', quality.evidence_count);
    console.log('[Classifier] LATENCY:', latency, 'ms');

    return {
      q1, q2, q3, q4,
      category,
      category_name: categoryName,
      confidence: quality.confidence,
      quality_flags: quality.flags,
      evidence_count: quality.evidence_count,
      classifier_prompt_version: CLASSIFIER_PROMPT_VERSION,
      classification_model: CLASSIFICATION_MODEL,
      classifier_runtime: 'client',
      content_length: content.length,
      latency_ms: latency,
      tokens_used: data.usage?.total_tokens,
    };

  } catch (error) {
    console.error('[Classifier] Classification failed:', error);
    throw error;
  }
}

// ============================================
// EXPORTS FOR UI
// ============================================

export function getCategoryBadgeVariant(category: ProgramCategory): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (category) {
    case 'A': return 'default';      // Reward = primary/green
    case 'B': return 'secondary';    // Event = yellow/orange
    case 'C': return 'outline';      // Policy = neutral/gray
  }
}

export function getConfidenceBadgeVariant(confidence: ClassificationConfidence): 'default' | 'secondary' | 'destructive' {
  switch (confidence) {
    case 'high': return 'default';      // green
    case 'medium': return 'secondary';  // yellow
    case 'low': return 'destructive';   // red
  }
}

export function formatQualityFlag(flag: QualityFlag): string {
  switch (flag) {
    case 'no_evidence': return 'Tidak ada evidence untuk jawaban kunci';
    case 'paraphrased_evidence': return 'Evidence bukan kutipan persis dari content';
    case 'short_reasoning': return 'Reasoning terlalu pendek (< 40 karakter)';
    case 'missing_specifics': return 'Reasoning tidak menyebut objek/fungsi spesifik';
    case 'single_weak_evidence': return 'Hanya 1 evidence lemah tanpa constraint jelas';
    case 'valid': return 'Semua quality gate lolos';
    default: return flag;
  }
}
