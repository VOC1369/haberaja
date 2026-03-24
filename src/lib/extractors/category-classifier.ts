/**
 * VOC LLM-Based Category Classifier
 * Version: v2.0.0+2025-01-14 (PROMO SUPER CONTRACT)
 * 
 * ARCHITECTURE:
 * - LLM identifies 3 GATES: Trigger → Benefit → Constraints
 * - Category calculated in CODE, not by LLM
 * - Quality gates determine confidence
 * - Human can override, all logged
 * 
 * PROMO SUPER CONTRACT:
 * Promo = program yang menghasilkan PERUBAHAN STATE yang menguntungkan user,
 * ketika KONDISI tertentu terpenuhi (aksi / momen / state),
 * dan hubungan tersebut DIKUNCI oleh syarat & ketentuan.
 * 
 * ❌ BUKAN ditentukan oleh kata
 * ❌ BUKAN ditentukan oleh gaya bahasa
 * ❌ BUKAN ditentukan oleh format
 * ✅ Ditentukan oleh sebab–akibat sistem
 */

import { callAI, extractText } from '../ai-client';

// ============================================
// KEYWORD OVERRIDE VERSION (for session invalidation)
// Update this whenever keyword rules change in keyword-rules.ts
// ============================================
export const KEYWORD_OVERRIDE_VERSION = '2025-01-14-v3';

// ============================================
// TYPES
// ============================================

export type ProgramCategory = 'A' | 'B' | 'C';
export type ClassificationConfidence = 'high' | 'medium' | 'low';

export type TriggerType = 'action' | 'moment' | 'state' | null;
export type BenefitCategory = 'money' | 'credit' | 'percentage' | 'item' | 'chance' | 'access' | 'cost_reduction' | null;

export type QualityFlag = 
  | 'no_trigger_evidence'      // trigger found but no evidence
  | 'no_benefit_evidence'      // benefit found but no evidence
  | 'no_constraints_evidence'  // constraints found but no evidence
  | 'paraphrased_evidence'     // evidence bukan substring
  | 'weak_reasoning'           // reasoning < 40 chars
  | 'valid';                   // lolos semua gate

// Legacy Q-Answer interface (for backward compatibility)
export interface QAnswer {
  answer: 'ya' | 'tidak';
  reasoning: string;
  evidence: string | null;
}

// NEW: Three Gate Result Interface
export interface ThreeGateResult {
  // PINTU 1: TRIGGER
  trigger: {
    found: boolean;
    type: TriggerType;
    evidence: string | null;
  };
  
  // PINTU 2: BENEFIT
  benefit: {
    found: boolean;
    category: BenefitCategory;
    evidence: string | null;
  };
  
  // PINTU 3: CONSTRAINTS
  constraints: {
    found: boolean;
    evidence: string | null;
  };
  
  // Decision
  is_promo: boolean;
  reasoning: string;
}

export interface ClassificationResult {
  // Three Gate Results (PRIMARY)
  trigger: ThreeGateResult['trigger'];
  benefit: ThreeGateResult['benefit'];
  constraints: ThreeGateResult['constraints'];
  
  // Decision
  is_promo: boolean;
  
  // Calculated by CODE (not LLM)
  category: ProgramCategory;
  category_name: string;
  promo_category: 'REWARD' | 'EVENT' | 'SYSTEM_RULE';
  
  // Quality Assessment
  confidence: ClassificationConfidence;
  quality_flags: QualityFlag[];
  evidence_count: number;
  reasoning: string;
  
  // Metadata
  classifier_prompt_version: string;
  classification_model: string;
  classifier_runtime: 'client' | 'server';
  content_length: number;
  latency_ms: number;
  tokens_used?: number;
  
  // Legacy Q1-Q4 (for backward compatibility with override UI)
  q1?: QAnswer;
  q2?: QAnswer;
  q3?: QAnswer;
  q4?: QAnswer;
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

export const CLASSIFIER_PROMPT_VERSION = 'v2.0.0+2025-01-14-SUPER';
export const CLASSIFICATION_MODEL = 'gpt-4o-mini';

// ============================================
// PROMO SUPER CONTRACT PROMPT (3 PINTU)
// ============================================

const CLASSIFICATION_PROMPT = `
Kamu adalah REASONING ASSISTANT untuk klasifikasi konten iGaming.

🔒 DEFINISI CANONICAL (TIDAK BOLEH DIBANTAH):
Promo = program yang menghasilkan PERUBAHAN STATE yang menguntungkan user,
ketika KONDISI tertentu terpenuhi (aksi / momen / state),
dan hubungan tersebut DIKUNCI oleh syarat & ketentuan.

❌ BUKAN ditentukan oleh kata (tidak ada kata "bonus" bukan berarti bukan promo)
❌ BUKAN ditentukan oleh gaya bahasa (teks SOP bisa berisi promo)
❌ BUKAN ditentukan oleh format
✅ Ditentukan oleh SEBAB–AKIBAT SISTEM

📋 LOGIKA KEPUTUSAN – 3 PINTU (WAJIB URUT):

═══════════════════════════════════════════════════════════════
PINTU 1 - TRIGGER (Kondisi Pemicu)
═══════════════════════════════════════════════════════════════
Identifikasi SATU atau lebih pemicu:

ACTION → user melakukan sesuatu
  - deposit, withdraw, main/bet, download APK, klaim, spin, redeem
  - hubungi CS, verifikasi, registrasi
  
MOMENT → waktu / event alami
  - ulang tahun, tanggal tertentu, periode bulanan, hari spesial
  
STATE → status / akumulasi
  - total TO, level VIP, histori aktivitas, referral count
  - member baru, member lama, status tertentu

❗ Jika TIDAK ADA trigger yang jelas → BUKAN PROMO

═══════════════════════════════════════════════════════════════
PINTU 2 - BENEFIT (Perubahan State yang Menguntungkan)
═══════════════════════════════════════════════════════════════
Perubahan yang menguntungkan user:

MONEY → saldo, chip, uang tunai, transfer
CREDIT → bonus %, cashback %, rebate %, freechip
PERCENTAGE → potongan harga, diskon %
ITEM → mobil, HP, merchandise, hadiah fisik
CHANCE → tiket undian, lucky spin, raffle, kesempatan
ACCESS → hak klaim, akses event, privilege, fitur khusus
COST_REDUCTION → bebas potongan, bebas fee, nilai lebih, tanpa potong

❗ Jika TIDAK ADA benefit/keuntungan → BUKAN PROMO
❗ Hanya bisa melakukan sesuatu yang seharusnya (WD, main) = BUKAN benefit

═══════════════════════════════════════════════════════════════
PINTU 3 - CONSTRAINTS (Pengunci / Syarat & Ketentuan)
═══════════════════════════════════════════════════════════════
Harus ada aturan yang mengikat hubungan Trigger → Benefit:

- min value / limit (minimal deposit, maksimal bonus)
- periode waktu (berlaku sampai, per hari, per minggu)
- frekuensi (sekali, harian, mingguan)
- channel klaim (otomatis, via CS, redemption store)
- turnover / wagering (TO 5x, syarat taruhan)
- diskualifikasi / antifraud (jika curang, hangus)
- scope (game tertentu, provider tertentu, payment tertentu)

❗ Jika TIDAK ADA constraints/aturan → kemungkinan besar BUKAN PROMO

═══════════════════════════════════════════════════════════════
⚠️ PERINGATAN ANTI-HALU
═══════════════════════════════════════════════════════════════
- JANGAN TERTIPU oleh gaya bahasa. Teks prosedur/SOP bisa berisi Promo.
- JANGAN TERTIPU oleh keyword. Tidak ada kata "bonus" bukan berarti bukan promo.
- PROMO = LOGIKA SEBAB-AKIBAT: User X → Dapat Y → dengan aturan Z
- BUKAN PROMO jika hanya menjelaskan cara kerja sistem tanpa benefit tambahan.

🧪 CONTOH KEPUTUSAN:
- "Birthday dapat freechip 50k, TO 3x" → PROMO (action+moment, credit, constraints)
- "Download APK dapat 25k, claim via CS" → PROMO (action, credit, constraints)
- "Deposit pulsa tanpa potongan, TO 5x" → PROMO (action, cost_reduction, constraints)
- "WD diproses 1x24 jam" → BUKAN PROMO (ada action, tapi TIDAK ADA benefit tambahan)
- "Untuk withdraw, verifikasi KTP dulu" → BUKAN PROMO (action, tapi TIDAK ADA benefit)

📤 OUTPUT FORMAT (JSON ONLY, tanpa markdown):
{
  "trigger_found": true/false,
  "trigger_type": "action" | "moment" | "state" | null,
  "trigger_evidence": "kutipan PERSIS dari content" atau null,
  
  "benefit_found": true/false,
  "benefit_category": "money" | "credit" | "percentage" | "item" | "chance" | "access" | "cost_reduction" | null,
  "benefit_evidence": "kutipan PERSIS dari content" atau null,
  
  "constraints_found": true/false,
  "constraints_evidence": "kutipan PERSIS dari content" atau null,
  
  "is_promo": true/false,
  "promo_category": "REWARD" | "EVENT" | "SYSTEM_RULE",
  "reasoning": "penjelasan singkat 40+ karakter kenapa promo/bukan promo"
}
`;

// ============================================
// CATEGORY CALCULATION (IN CODE, NOT LLM)
// ============================================

export function calculateCategory(
  triggerFound: boolean,
  benefitFound: boolean,
  constraintsFound: boolean,
  promoCategory?: string
): ProgramCategory {
  // 3 PINTU CHECK: Semua harus TRUE untuk jadi PROMO
  const isPromo = triggerFound && benefitFound && constraintsFound;
  
  if (isPromo) {
    // Tentukan A atau B berdasarkan promo_category dari LLM
    if (promoCategory === 'EVENT') return 'B';
    return 'A'; // Default: Reward Program
  }
  
  // Tidak memenuhi 3 pintu = System Rule (bukan promo)
  return 'C';
}

export function getCategoryName(category: ProgramCategory): string {
  switch (category) {
    case 'A': return 'Reward Program';
    case 'B': return 'Event Program';
    case 'C': return 'System Rule'; // NOT a promo - informational only
  }
}

export function getPromoCategory(category: ProgramCategory): 'REWARD' | 'EVENT' | 'SYSTEM_RULE' {
  switch (category) {
    case 'A': return 'REWARD';
    case 'B': return 'EVENT';
    case 'C': return 'SYSTEM_RULE';
  }
}

/**
 * Check if a category is a System Rule (non-promo)
 * System Rules are detected by extraction but NOT saved to promo KB
 */
export function isSystemRule(category: ProgramCategory): boolean {
  return category === 'C';
}

// ============================================
// KEYWORD OVERRIDES (DELEGATED TO keyword-rules.ts)
// ============================================

import { applyKeywordOverride as applyKeywordOverrideFromRules } from './keyword-rules';

/**
 * Apply keyword-based override to LLM classification
 * 
 * SEMANTIC ESCAPE HATCH:
 * Certain keywords GUARANTEE a specific category regardless of LLM output.
 * This is a "semantic escape hatch" for cases where the keyword itself
 * is definitionally tied to a category.
 * 
 * @see keyword-rules.ts for the single source of truth
 */
export function applyKeywordOverrides(
  llmCategory: ProgramCategory,
  promoName: string,
  promoType?: string
): { category: ProgramCategory; wasOverridden: boolean; overrideReason?: string } {
  return applyKeywordOverrideFromRules(llmCategory, promoName, promoType);
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
  result: ThreeGateResult,
  content: string
): QualityAssessment {
  const flags: QualityFlag[] = [];
  let evidenceCount = 0;
  
  // Count evidence and check quality
  const contentLower = content.toLowerCase();
  
  // GATE A: Trigger evidence
  if (result.trigger.found) {
    if (!result.trigger.evidence || result.trigger.evidence.trim().length === 0) {
      flags.push('no_trigger_evidence');
    } else {
      evidenceCount++;
      // Check substring match
      const evidenceLower = result.trigger.evidence.toLowerCase().trim();
      if (!contentLower.includes(evidenceLower)) {
        flags.push('paraphrased_evidence');
      }
    }
  }
  
  // GATE B: Benefit evidence
  if (result.benefit.found) {
    if (!result.benefit.evidence || result.benefit.evidence.trim().length === 0) {
      flags.push('no_benefit_evidence');
    } else {
      evidenceCount++;
    }
  }
  
  // GATE C: Constraints evidence
  if (result.constraints.found) {
    if (!result.constraints.evidence || result.constraints.evidence.trim().length === 0) {
      flags.push('no_constraints_evidence');
    } else {
      evidenceCount++;
    }
  }
  
  // GATE D: Reasoning quality
  if (result.reasoning.length < 40) {
    flags.push('weak_reasoning');
  }
  
  // ============================================
  // CALCULATE CONFIDENCE
  // ============================================
  let confidence: ClassificationConfidence;
  
  const criticalFlags = ['no_trigger_evidence', 'no_benefit_evidence', 'paraphrased_evidence'];
  const hasCriticalFlag = flags.some(f => criticalFlags.includes(f));
  
  if (hasCriticalFlag) {
    confidence = 'low';
  } else if (flags.includes('weak_reasoning') || flags.includes('no_constraints_evidence')) {
    confidence = 'medium';
  } else if (evidenceCount >= 3) {
    confidence = 'high';
  } else if (evidenceCount >= 2) {
    confidence = 'medium';
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
  console.log('[Classifier] Starting 3-GATE classification (PROMO SUPER CONTRACT)...');
  console.log('[Classifier] Prompt version:', CLASSIFIER_PROMPT_VERSION);
  console.log('[Classifier] Content length:', content.length);

  const startTime = performance.now();

  try {
    const aiResponse = await callAI({
      type: 'classify',
      system: CLASSIFICATION_PROMPT,
      messages: [
        { role: 'user', content: `Analisis content berikut:\n\n---\n${content.substring(0, 4000)}\n---` },
      ],
      temperature: 0.1,
    });

    const latency = Math.round(performance.now() - startTime);
    const rawText = extractText(aiResponse);
    let resultText = rawText.replace(/```json\n?/g, '').replace(/\n?```/g, '');

    const parsed = JSON.parse(resultText);

    // ============================================
    // BUILD THREE GATE RESULT
    // ============================================
    const threeGateResult: ThreeGateResult = {
      trigger: {
        found: parsed.trigger_found === true,
        type: parsed.trigger_type || null,
        evidence: parsed.trigger_evidence || null,
      },
      benefit: {
        found: parsed.benefit_found === true,
        category: parsed.benefit_category || null,
        evidence: parsed.benefit_evidence || null,
      },
      constraints: {
        found: parsed.constraints_found === true,
        evidence: parsed.constraints_evidence || null,
      },
      is_promo: parsed.is_promo === true,
      reasoning: parsed.reasoning || '',
    };

    // ============================================
    // CALCULATE CATEGORY IN CODE (NOT FROM LLM)
    // ============================================
    const category = calculateCategory(
      threeGateResult.trigger.found,
      threeGateResult.benefit.found,
      threeGateResult.constraints.found,
      parsed.promo_category
    );
    const categoryName = getCategoryName(category);
    const promoCategory = getPromoCategory(category);

    // ============================================
    // ASSESS QUALITY & CONFIDENCE
    // ============================================
    const quality = assessQuality(threeGateResult, content);

    // ============================================
    // LOG RESULTS
    // ============================================
    console.log('[Classifier] === 3-GATE CLASSIFICATION RESULT ===');
    console.log('[Classifier] TRIGGER:', threeGateResult.trigger.found ? '✅' : '❌', 
      `(${threeGateResult.trigger.type})`, 
      threeGateResult.trigger.evidence?.substring(0, 50) || 'null');
    console.log('[Classifier] BENEFIT:', threeGateResult.benefit.found ? '✅' : '❌', 
      `(${threeGateResult.benefit.category})`, 
      threeGateResult.benefit.evidence?.substring(0, 50) || 'null');
    console.log('[Classifier] CONSTRAINTS:', threeGateResult.constraints.found ? '✅' : '❌',
      threeGateResult.constraints.evidence?.substring(0, 50) || 'null');
    console.log('[Classifier] IS_PROMO:', threeGateResult.is_promo ? '✅ PROMO' : '❌ BUKAN PROMO');
    console.log('[Classifier] CATEGORY (calculated in code):', category, '-', categoryName);
    console.log('[Classifier] CONFIDENCE:', quality.confidence);
    console.log('[Classifier] QUALITY FLAGS:', quality.flags);
    console.log('[Classifier] EVIDENCE COUNT:', quality.evidence_count);
    console.log('[Classifier] REASONING:', threeGateResult.reasoning);
    console.log('[Classifier] LATENCY:', latency, 'ms');

    // ============================================
    // BUILD LEGACY Q1-Q4 FOR BACKWARD COMPATIBILITY
    // ============================================
    const legacyQ1: QAnswer = {
      answer: 'tidak', // 3-gate doesn't have penalty detection
      reasoning: 'Migrated to 3-Gate system',
      evidence: null,
    };
    const legacyQ2: QAnswer = {
      answer: 'tidak', // 3-gate doesn't have ongoing detection
      reasoning: 'Migrated to 3-Gate system',
      evidence: null,
    };
    const legacyQ3: QAnswer = {
      answer: threeGateResult.is_promo ? 'ya' : 'tidak',
      reasoning: threeGateResult.reasoning,
      evidence: threeGateResult.benefit.evidence,
    };
    const legacyQ4: QAnswer = {
      answer: promoCategory === 'EVENT' ? 'ya' : 'tidak',
      reasoning: threeGateResult.reasoning,
      evidence: threeGateResult.trigger.evidence,
    };

    return {
      // 3 Gate Results (PRIMARY)
      trigger: threeGateResult.trigger,
      benefit: threeGateResult.benefit,
      constraints: threeGateResult.constraints,
      is_promo: threeGateResult.is_promo,
      
      // Category
      category,
      category_name: categoryName,
      promo_category: promoCategory,
      
      // Quality
      confidence: quality.confidence,
      quality_flags: quality.flags,
      evidence_count: quality.evidence_count,
      reasoning: threeGateResult.reasoning,
      
      // Metadata
      classifier_prompt_version: CLASSIFIER_PROMPT_VERSION,
      classification_model: CLASSIFICATION_MODEL,
      classifier_runtime: 'client',
      content_length: content.length,
      latency_ms: latency,
      tokens_used: data.usage?.total_tokens,
      
      // Legacy (for backward compatibility)
      q1: legacyQ1,
      q2: legacyQ2,
      q3: legacyQ3,
      q4: legacyQ4,
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
    case 'no_trigger_evidence': return 'Tidak ada evidence untuk trigger';
    case 'no_benefit_evidence': return 'Tidak ada evidence untuk benefit';
    case 'no_constraints_evidence': return 'Tidak ada evidence untuk constraints';
    case 'paraphrased_evidence': return 'Evidence bukan kutipan persis dari content';
    case 'weak_reasoning': return 'Reasoning terlalu pendek (< 40 karakter)';
    case 'valid': return 'Semua gate valid';
    default: return flag;
  }
}

// ============================================
// HELPER: Get Gate Label for UI
// ============================================

export function getGateLabel(gate: 'trigger' | 'benefit' | 'constraints'): string {
  switch (gate) {
    case 'trigger': return 'PINTU 1 - Trigger (Kondisi Pemicu)';
    case 'benefit': return 'PINTU 2 - Benefit (Perubahan State)';
    case 'constraints': return 'PINTU 3 - Constraints (Pengunci)';
  }
}

export function getTriggerTypeLabel(type: TriggerType): string {
  switch (type) {
    case 'action': return 'Action (User melakukan sesuatu)';
    case 'moment': return 'Moment (Waktu/event alami)';
    case 'state': return 'State (Status/akumulasi)';
    default: return 'Tidak terdeteksi';
  }
}

export function getBenefitCategoryLabel(category: BenefitCategory): string {
  switch (category) {
    case 'money': return 'Money (Saldo/uang tunai)';
    case 'credit': return 'Credit (Bonus/freechip)';
    case 'percentage': return 'Percentage (Diskon %)';
    case 'item': return 'Item (Hadiah fisik)';
    case 'chance': return 'Chance (Undian/spin)';
    case 'access': return 'Access (Akses/privilege)';
    case 'cost_reduction': return 'Cost Reduction (Bebas fee)';
    default: return 'Tidak terdeteksi';
  }
}
