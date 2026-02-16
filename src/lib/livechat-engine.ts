/**
 * Livechat Test Console Engine v1.0
 * Dev-only chat engine using APBE persona + Promo KB data
 */

import { getOpenAIKey, IS_DEV_MODE } from './config/openai.dev';
import { compileRuntimePrompt } from './apbe-prompt-template';
import { loadInitialConfig } from './apbe-storage';
import { promoKB } from './promo-storage';
import { getPayloadContract } from './extractors/promo-taxonomy';
import type { PromoItem } from '@/components/VOCDashboard/PromoFormWizard/types';
import type { APBEConfig } from '@/types/apbe-config';
import {
  type BehavioralRuleItem,
  extractAIPayload,
  getBehavioralRules,
} from '@/components/VOCDashboard/BehavioralWizard/types';

// ============================================
// TYPES
// ============================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  rawContent?: string;
  debug?: DebugBreakdown | null;
  timestamp: string;
}

export interface DebugBreakdown {
  userIntent: string;
  jsonFieldsReferenced: string[];
  analysis: string;
  retrievalStatus: string;
  conflictCheck: string;
  confidence: string;
  finalValidation: string;
  raw: string;
  source?: 'llm' | 'client';
  kbHealth?: {
    status: 'READY' | 'NOT_READY' | 'UNKNOWN';
    missingKeys: string[];
  };
}

// ============================================
// KB CONTEXT BUILDER
// ============================================

const KB_FIELDS = [
  'promo_name', 'promo_type', 'reward_mode', 'reward_amount',
  'min_deposit', 'max_bonus', 'max_bonus_unlimited',
  'turnover_multiplier', 'calculation_base', 'calculation_basis',
  'payout_direction', 'trigger_event', 'special_conditions',
  'custom_terms', 'blacklisted_games', 'valid_from', 'valid_until',
  'game_types', 'game_providers', 'claim_frequency', 'claim_method',
  'mode', 'category', 'tier_archetype', 'tiers',
  'turnover_basis', 'archetype_payload', 'archetype_invariants',
] as const;

interface KBContextResult {
  context: string;
  kbHealth: {
    status: 'READY' | 'NOT_READY' | 'UNKNOWN';
    missingKeys: string[];
  };
}

function buildKBContext(promo: PromoItem): KBContextResult {
  const data: Record<string, unknown> = {};
  for (const field of KB_FIELDS) {
    const value = (promo as unknown as Record<string, unknown>)[field];
    if (value !== undefined && value !== null && value !== '') {
      data[field] = value;
    }
  }
  
  // Resolve archetype (2-level fallback)
  const extraConfig = (promo as unknown as Record<string, unknown>).extra_config as Record<string, unknown> | undefined;
  const taxonomyDecision = extraConfig?._taxonomy_decision as Record<string, unknown> | undefined;
  const taxonomyLegacy = extraConfig?._taxonomy as Record<string, unknown> | undefined;
  const archetype = (taxonomyDecision?.archetype as string) ?? (taxonomyLegacy?.archetype as string) ?? null;
  
  // Compute KB health via payload contract
  let kbHealth: KBContextResult['kbHealth'];
  if (!archetype) {
    kbHealth = { status: 'UNKNOWN', missingKeys: [] };
  } else {
    const contract = getPayloadContract(archetype);
    if (!contract) {
      kbHealth = { status: 'READY', missingKeys: [] };
    } else {
      const payload = (promo as unknown as Record<string, unknown>).archetype_payload as Record<string, unknown> | undefined || {};
      const missing = contract.required_keys.filter(k => !(k in payload));
      kbHealth = {
        status: missing.length > 0 ? 'NOT_READY' : 'READY',
        missingKeys: missing,
      };
    }
  }
  
  // Build context string with rigid KB_HEALTH block
  let context = `# KNOWLEDGE BASE — Active Promo
Promo: ${promo.promo_name || 'Unknown'}

\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`

# KB_HEALTH
status: ${kbHealth.status}
missing_required_payload_keys: [${kbHealth.missingKeys.join(', ')}]
priority_rule: archetype_payload > custom_terms for lifecycle logic`;

  return { context, kbHealth };
}

// ============================================
// DEBUG INSTRUCTION BLOCK
// ============================================

const DEBUG_INSTRUCTION = `
CRITICAL MANDATORY RULE — You MUST ALWAYS append a Debug section after EVERY answer. No exceptions. Every single reply must end with this.

Separate your answer and the debug section with exactly this marker on its own line: ---DEBUG---

The Debug section MUST follow this exact format:

[User Intent]
<summarize user intent in 1 sentence>

[JSON Data Referenced]
<list each field used as: field_name = value>
<if custom_terms: custom_terms -> poin X: "quote">
<if special_conditions: special_conditions -> "quote">
<if no fields used: "Tidak ada field yang dirujuk">

[Analysis]
<one of: Match ditemukan | Mismatch terdeteksi | Ambiguitas terdeteksi | Field kosong | Konflik antar field>
<brief explanation>

[Retrieval Status]
<valid | partial | none>

[Conflict Check]
<tidak ada | ada (list fields)>

[Confidence]
<sangat tinggi | tinggi | sedang | rendah>

[Final Validation]
<one of: Jawaban konsisten dengan KB | Jawaban berpotensi ambiguous | KB kurang lengkap | JSON conflict terdeteksi>

REMEMBER: The ---DEBUG--- section is MANDATORY for EVERY response. Do NOT skip it. Do NOT forget it. ALWAYS include it.
Do NOT hide structural issues.
Do NOT invent fields.
If JSON incomplete, explicitly state it.`;

// ============================================
// SYSTEM PROMPT BUILDER
// ============================================

export interface BuildSystemPromptOptions {
  generalKBEnabled?: boolean;
  behavioralKBEnabled?: boolean;
  allPromos?: PromoItem[];
}

// ============================================
// BEHAVIORAL KB CONTEXT BUILDER
// ============================================

function buildBehavioralKBContext(): string | null {
  const rules = getBehavioralRules();
  const activeRules = rules.filter(r => r.status === 'active');
  if (activeRules.length === 0) return null;

  const aiPayloads = activeRules.map(r => extractAIPayload(r));

  return `# BEHAVIORAL RULES (Reaction Engine)
Berikut ${aiPayloads.length} behavioral rules yang aktif. Gunakan untuk mendeteksi pola perilaku player dan merespons sesuai template.

\`\`\`json
${JSON.stringify(aiPayloads, null, 2)}
\`\`\`

# BEHAVIORAL PRECEDENCE RULE
Jika ada rule Behavioral yang match dengan pesan player:
- Gunakan response_template dari rule tersebut sebagai dasar jawaban
- Tone dan gaya bahasa TETAP mengikuti Persona identity di atas
- Escalation mengikuti handoff_protocol dari rule
Jika TIDAK ada rule yang match:
- Gunakan Persona default behavior seperti biasa
- Crisis tone dan escalation dari Persona tetap berlaku penuh`;
}

export async function buildSystemPrompt(
  selectedPromo: PromoItem | null,
  debugMode: boolean,
  options: BuildSystemPromptOptions = {},
): Promise<string> {
  // Load APBE config and compile persona prompt
  const config = await loadInitialConfig();
  const personaPrompt = compileRuntimePrompt(config);
  
  let systemPrompt = personaPrompt;

  // LANGUAGE FIREWALL — never expose internal field names to players
  systemPrompt += `\n\n# ATURAN BAHASA — WAJIB DIPATUHI
Kamu DILARANG KERAS menyebutkan istilah teknis internal kepada player. Berikut daftar istilah yang TIDAK BOLEH muncul di jawaban:
- reward_mode, mode, formula, fixed, tier (gunakan bahasa natural: "bonus dihitung berdasarkan persentase", "bonus tetap", "bonus bertingkat")
- calculation_basis, calculation_base (gunakan: "dihitung dari deposit/turnover/loss")
- payout_direction (gunakan: "bonus diberikan sebelum/sesudah syarat terpenuhi")
- trigger_event (gunakan: "syarat untuk mendapatkan bonus ini adalah...")
- archetype, archetype_payload, tier_archetype (JANGAN PERNAH disebutkan)
- turnover_multiplier (gunakan: "syarat TO/turnover Xx")
- claim_frequency, claim_method (gunakan bahasa natural: "bisa diklaim sekali/berkali-kali", "klaim otomatis/manual")
- max_bonus_unlimited (gunakan: "tidak ada batas maksimal bonus")
- field_name apapun yang menggunakan underscore (_) TIDAK BOLEH muncul di jawaban

Selalu gunakan bahasa yang ramah dan mudah dipahami player. Data JSON adalah referensi internal kamu, BUKAN untuk ditampilkan ke player.`;

  // Inject General KB if enabled
  if (options.generalKBEnabled) {
    const { getGeneralKnowledge } = await import('@/types/knowledge');
    const kbItems = getGeneralKnowledge();
    if (kbItems.length > 0) {
      const kbData = kbItems.map(i => ({ question: i.question, answer: i.answer, category: i.category }));
      systemPrompt += `\n\n# GENERAL KNOWLEDGE BASE
Berikut referensi FAQ umum yang bisa kamu gunakan untuk menjawab pertanyaan player:

\`\`\`json
${JSON.stringify(kbData, null, 2)}
\`\`\`

Gunakan data di atas untuk menjawab pertanyaan umum. Jika pertanyaan player cocok dengan salah satu FAQ, prioritaskan jawaban dari sini.`;
    }
  }

  // Inject KB context — "all promos" mode or single promo
  if (options.allPromos && options.allPromos.length > 0) {
    systemPrompt += '\n\n' + buildAllPromosContext(options.allPromos);
  } else if (selectedPromo) {
    const { context } = buildKBContext(selectedPromo);
    systemPrompt += '\n\n' + context;
    systemPrompt += '\n\nPRIORITAS: Jika data tersedia di archetype_payload, gunakan archetype_payload. custom_terms hanya untuk narasi S&K yang tidak terstruktur.';
  }
  
  // Inject Behavioral KB if enabled (additive layer, default OFF)
  if (options.behavioralKBEnabled) {
    const bkbContext = buildBehavioralKBContext();
    if (bkbContext) {
      systemPrompt += '\n\n' + bkbContext;
    }
  }

  // Inject debug instructions if debug mode ON
  if (debugMode) {
    systemPrompt += '\n\n' + DEBUG_INSTRUCTION;
  }
  
  return systemPrompt;
}

// ============================================
// ALL PROMOS CONTEXT BUILDER
// ============================================

function buildAllPromosContext(promos: PromoItem[]): string {
  let context = `# KNOWLEDGE BASE — Semua Promo (${promos.length} promo)\n`;
  
  promos.forEach((promo, idx) => {
    const data: Record<string, unknown> = {};
    for (const field of KB_FIELDS) {
      const value = (promo as unknown as Record<string, unknown>)[field];
      if (value !== undefined && value !== null && value !== '') {
        data[field] = value;
      }
    }
    context += `\n## ${idx + 1}. ${promo.promo_name || promo.id}\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`;
  });

  context += '\nPRIORITAS: Jika player bertanya tentang promo tertentu, cari dari daftar di atas berdasarkan nama atau tipe. Jika data tersedia di archetype_payload, gunakan archetype_payload.';
  return context;
}

// ============================================
// DEBUG PARSER
// ============================================

export function parseDebugSection(raw: string): DebugBreakdown {
  const extract = (header: string): string => {
    const regex = new RegExp(`\\[${header}\\]\\s*\\n([\\s\\S]*?)(?=\\n\\[|$)`, 'i');
    const match = raw.match(regex);
    return match ? match[1].trim() : '';
  };

  return {
    userIntent: extract('User Intent'),
    jsonFieldsReferenced: extract('JSON Data Referenced').split('\n').filter(Boolean),
    analysis: extract('Analysis'),
    retrievalStatus: extract('Retrieval Status'),
    conflictCheck: extract('Conflict Check'),
    confidence: extract('Confidence'),
    finalValidation: extract('Final Validation'),
    raw,
  };
}

// ============================================
// STREAMING CHAT
// ============================================

export async function streamChat(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  debugMode: boolean,
  onDelta: (text: string) => void,
  onDebug: (debug: DebugBreakdown) => void,
  onDone: () => void,
  onError: (error: string) => void,
  selectedPromo?: PromoItem | null,
): Promise<void> {
  if (!IS_DEV_MODE) {
    onError('Livechat Test Console hanya tersedia di dev mode');
    return;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getOpenAIKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      onError(`OpenAI API error: ${response.status} - ${errorText}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError('No response body');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;
        
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') break;
        
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            fullResponse += content;
            onDelta(content);
          }
        } catch {
          buffer = line + '\n' + buffer;
          break;
        }
      }
    }

    // Parse debug section if debug mode
    if (debugMode) {
      if (fullResponse.includes('---DEBUG---')) {
        const parts = fullResponse.split('---DEBUG---');
        if (parts.length >= 2) {
        const debugRaw = parts.slice(1).join('---DEBUG---').trim();
          const debug = parseDebugSection(debugRaw);
          debug.source = 'llm';
          // Attach kbHealth from engine (not UI-computed)
          if (selectedPromo) {
            const { kbHealth } = buildKBContext(selectedPromo);
            debug.kbHealth = kbHealth;
          }
          onDebug(debug);
        }
      } else {
        // Client-side fallback
        const lastUserMsg = messages[messages.length - 1]?.content || '';
        const clientDebug = buildClientDebug(lastUserMsg, fullResponse, selectedPromo || null);
        // Attach kbHealth from engine
        if (selectedPromo) {
          const { kbHealth } = buildKBContext(selectedPromo);
          clientDebug.kbHealth = kbHealth;
        }
        onDebug(clientDebug);
      }
    }

    onDone();
  } catch (error) {
    onError(error instanceof Error ? error.message : 'Unknown error');
  }
}

// ============================================
// CLIENT-SIDE DEBUG FALLBACK
// ============================================

const CLIENT_DEBUG_FIELDS = [
  'max_bonus', 'min_deposit', 'reward_amount', 'turnover_multiplier',
  'reward_mode', 'payout_direction', 'calculation_base', 'calculation_basis',
  'claim_frequency', 'claim_method', 'promo_type', 'trigger_event',
] as const;

export function buildClientDebug(
  userMessage: string,
  assistantResponse: string,
  promo: PromoItem | null,
): DebugBreakdown {
  const promoData = promo as unknown as Record<string, unknown> | null;
  const userNumbers = userMessage.match(/[\d][.\d,]*/g)?.map(n => parseFloat(n.replace(/,/g, ''))) || [];

  const fieldsReferenced: string[] = [];
  let matchCount = 0;
  let mismatchCount = 0;

  if (promoData) {
    for (const field of CLIENT_DEBUG_FIELDS) {
      const val = promoData[field];
      if (val === undefined || val === null || val === '') continue;

      const valStr = String(val);
      const valNum = parseFloat(valStr);

      // Check if user message or assistant response references this field
      const mentioned = userMessage.toLowerCase().includes(field.replace(/_/g, ' '))
        || assistantResponse.toLowerCase().includes(valStr.toLowerCase())
        || (!isNaN(valNum) && userNumbers.includes(valNum));

      if (mentioned) {
        fieldsReferenced.push(`${field} = ${valStr}`);
        // Check consistency: does assistant response contain the KB value?
        if (assistantResponse.includes(valStr)) {
          matchCount++;
        } else {
          mismatchCount++;
        }
      }
    }
  }

  const hasPromo = promo !== null;
  const confidence = !hasPromo ? 'rendah'
    : mismatchCount > 0 ? 'rendah'
    : matchCount >= 2 ? 'sangat tinggi'
    : matchCount === 1 ? 'tinggi'
    : 'sedang';

  const analysis = mismatchCount > 0
    ? `Mismatch terdeteksi — ${mismatchCount} field tidak konsisten`
    : matchCount > 0
    ? `Match ditemukan — ${matchCount} field konsisten`
    : hasPromo
    ? 'Tidak ada field numerik yang dirujuk langsung'
    : 'Tidak ada promo KB yang dipilih';

  return {
    userIntent: userMessage.length > 120 ? userMessage.slice(0, 120) + '…' : userMessage,
    jsonFieldsReferenced: fieldsReferenced.length > 0 ? fieldsReferenced : ['Tidak ada field yang dirujuk'],
    analysis,
    retrievalStatus: hasPromo ? (matchCount > 0 ? 'valid' : 'partial') : 'none',
    conflictCheck: mismatchCount > 0 ? `ada (${mismatchCount} field)` : 'tidak ada',
    confidence,
    finalValidation: mismatchCount > 0
      ? 'JSON conflict terdeteksi'
      : matchCount > 0
      ? 'Jawaban konsisten dengan KB'
      : 'KB kurang lengkap',
    raw: '[Client-generated trace]',
    source: 'client',
  };
}

// ============================================
// PROMO LOADER
// ============================================

export async function loadPromoList(): Promise<PromoItem[]> {
  return promoKB.getAll();
}
