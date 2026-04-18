/**
 * Livechat Test Console Engine v1.0
 * Dev-only chat engine using APBE persona + Promo KB data
 */

import { compileRuntimePrompt } from './apbe-prompt-template';
import { callAI, extractText } from './ai-client';
import { IS_DEV_MODE } from './config/dev-mode';

// AI Proxy URL (Supabase Edge Function — Claude Sonnet 4.5)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const AI_PROXY_URL = `${SUPABASE_URL}/functions/v1/ai-proxy`;
import { loadInitialConfig } from './apbe-storage';
import { promoKB } from './promo-storage';
import { getPayloadContract } from './extractors/promo-taxonomy';
import { createTicketFromChat, buildTicketFeedbackContext } from './ticket-storage';
import { getGeneralKnowledge } from '@/types/knowledge';
import type { PromoItem } from '@/components/VOCDashboard/PromoFormWizard/types';
import type { APBEConfig } from '@/types/apbe-config';
import type { TicketCategory } from '@/types/ticket';
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
  ticketCreated?: { ticket_number: string; category: string };
}

export interface KBSourceMatch {
  source: 'promo' | 'general' | 'behavioral';
  label: string;
  detail: string;
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
  kbSources?: KBSourceMatch[];
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

[KB Sources Used]
<untuk SETIAP KB source yang kamu gunakan untuk menjawab, tulis SATU baris per source:>
<format: SOURCE_TYPE | label | detail>
<SOURCE_TYPE harus salah satu dari: promo, general, behavioral>
<contoh: general | FAQ: "Kapan LP kadaluwarsa?" | answer digunakan sebagai basis jawaban>
<contoh: promo | Promo: Welcome Bonus | field: min_deposit, reward_amount>
<contoh: behavioral | Rule: abusive_language | rule diterapkan untuk tone>
<jika TIDAK ADA KB yang digunakan: none | Tidak ada KB match | jawaban murni dari persona>

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

export function buildBehavioralKBContext(): string | null {
  const rules = getBehavioralRules();
  const activeRules = rules.filter(r => r.status === 'active');
  if (activeRules.length === 0) return null;

  const aiPayloads = activeRules.map(r => extractAIPayload(r));

  return `# BEHAVIORAL RULES (Reaction Engine)
Berikut ${aiPayloads.length} behavioral rules aktif.

\`\`\`json
${JSON.stringify(aiPayloads, null, 2)}
\`\`\`

# BEHAVIORAL RULE SELECTION — WAJIB DIPATUHI

STEP 1: Analisis pesan player terhadap SETIAP rule's applicability_criteria secara semantik. Gunakan pemahaman konteks, bukan keyword matching.
STEP 2: Pilih SATU rule yang paling match. Jika ada tie, pilih yang severity_level tertinggi.
STEP 3: Identifikasi secara internal rule mana yang kamu pilih.
STEP 4: Gunakan response_template sebagai INSPIRASI dan STRUKTUR — BUKAN kalimat verbatim. Pilih salah satu variasi, lalu parafrase dengan gaya natural sesuai konteks spesifik player. Kamu BOLEH menyesuaikan kalimat selama intent dan tone-nya sesuai.
STEP 5: Terapkan reasoning_guideline untuk menentukan pendekatan, tone, dan langkah-langkah.
STEP 6: Ikuti handoff_protocol dari rule tersebut.

# ANTI-REPETITION — WAJIB

- JANGAN pernah ulangi kalimat yang PERSIS SAMA dengan jawaban kamu di turn sebelumnya.
- Jika rule yang sama match di turn berikutnya, WAJIB gunakan variasi template yang BERBEDA atau parafrase baru.
- Setiap respons harus terasa FRESH dan kontekstual terhadap pesan spesifik player di turn itu.

# TIERED ESCALATION — ACROSS TURNS

Jika rule yang SAMA match 2x berturut-turut:
- Turn 1: Gunakan pendekatan EMPATI (soft, validasi perasaan)
- Turn 2: Naikkan ke pendekatan TEGAS (set boundary, minta kerjasama)
- Turn 3+: Jika masih berlanjut, pertimbangkan ESKALASI ke admin meskipun handoff_protocol.required = false

LARANGAN:
- JANGAN blend multiple rules dalam satu jawaban.
- JANGAN gunakan respons generik jika ada rule yang match.
- JANGAN copy-paste template mentah-mentah — selalu adaptasi ke konteks.
- JANGAN gunakan kalimat klise berulang seperti "Komunikasi yang sopan diperlukan" atau "Sabar ya".

JIKA TIDAK ADA rule yang match:
- Gunakan Persona default behavior seperti biasa.
- Crisis tone dan escalation dari Persona tetap berlaku penuh.`;
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

  // CLOSING DISCIPLINE — anti-template closing
  systemPrompt += `\n\n# CLOSING DISCIPLINE — ANTI-TEMPLATE

ATURAN CLOSING:
1. JANGAN selalu tutup dengan kalimat penutup. Jika jawaban sudah lengkap dan jelas, STOP di situ. Tidak perlu closing.
2. Jika memang ingin menutup, JANGAN gunakan pola yang sama berulang. Variasikan:
   - Kadang tanpa closing sama sekali (langsung selesai)
   - Kadang closing pendek: "Ada lagi?" / "Lanjut?"
   - Kadang closing kontekstual yang relevan dengan topik
   - Kadang gunakan closing dari Interaction Library (Closings templates di atas)
3. DILARANG menggunakan pola "Kalau [Kak/kamu] butuh bantuan [lagi/lebih lanjut], [nama agent] siap [bantu/membantu]!" di setiap turn. Pola ini HANYA boleh muncul MAKSIMAL 1x per 5 turn.
4. Emoji closing (😊✨) TIDAK wajib di setiap pesan. Gunakan secukupnya.
5. Closing HARUS terasa natural — seperti chat teman, bukan template customer service.

CONTOH CLOSING YANG BAGUS:
- (tanpa closing — jawaban langsung selesai)
- "Ada lagi yang mau ditanya? 😊"
- "Semoga membantu ya!"
- "Itu dia infonya — kalau masih bingung langsung tanya aja"
- "Coba cek dulu ya, nanti kabarin lagi kalau ada kendala"

CONTOH CLOSING YANG DILARANG (terlalu template):
- "Kalau Kak butuh bantuan atau informasi lebih lanjut, Riri siap membantu! 😊✨"
- "Jika ada pertanyaan lain, jangan ragu untuk bertanya ya!"
- Pola apapun yang identik/mirip di 2+ turn berturut-turut`;

  // Inject General KB if enabled
  if (options.generalKBEnabled) {
    const { getGeneralKnowledge } = await import('@/types/knowledge');
    const kbItems = getGeneralKnowledge();
    if (kbItems.length > 0) {
      const kbData = kbItems.map(i => ({ question: i.question, answer: i.answer, category: i.category }));
      systemPrompt += `\n\n# GENERAL KNOWLEDGE BASE — WAJIB DIPATUHI
Berikut referensi FAQ resmi. Ini adalah sumber kebenaran utama untuk pertanyaan umum.

\`\`\`json
${JSON.stringify(kbData, null, 2)}
\`\`\`

# ATURAN PENGGUNAAN GENERAL KB — MANDATORY
1. Untuk SETIAP pesan player, WAJIB scan seluruh FAQ di atas terlebih dahulu.
2. Jika topik/intent player COCOK atau MIRIP dengan salah satu FAQ → WAJIB gunakan 'answer' dari FAQ tersebut sebagai BASIS jawaban. JANGAN generate jawaban sendiri.
3. Kamu BOLEH menyesuaikan gaya bahasa sesuai persona, tapi SUBSTANSI dan LANGKAH-LANGKAH dari answer FAQ TIDAK BOLEH dihilangkan atau diganti.
4. JANGAN memberikan jawaban generik seperti "tim teknis sedang menangani" jika ada FAQ yang relevan. Berikan langkah konkret dari KB.
5. Jika TIDAK ADA FAQ yang cocok, baru boleh menjawab berdasarkan pengetahuan umum persona.
6. Di debug section, sebutkan FAQ mana yang kamu gunakan (atau "Tidak ada FAQ match").`;
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

  // Inject ticket status feedback if any chat tickets were resolved
  const ticketFeedback = buildTicketFeedbackContext();
  if (ticketFeedback) {
    systemPrompt += '\n\n' + ticketFeedback;
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

  // Parse [KB Sources Used] section
  const kbSourcesRaw = extract('KB Sources Used');
  const kbSources: KBSourceMatch[] = [];
  if (kbSourcesRaw) {
    const lines = kbSourcesRaw.split('\n').filter(l => l.trim() && l.includes('|'));
    for (const line of lines) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 3) {
        const sourceType = parts[0].toLowerCase();
        if (sourceType === 'promo' || sourceType === 'general' || sourceType === 'behavioral') {
          kbSources.push({ source: sourceType, label: parts[1], detail: parts[2] });
        }
      }
    }
  }

  return {
    userIntent: extract('User Intent'),
    jsonFieldsReferenced: extract('JSON Data Referenced').split('\n').filter(Boolean),
    analysis: extract('Analysis'),
    retrievalStatus: extract('Retrieval Status'),
    conflictCheck: extract('Conflict Check'),
    confidence: extract('Confidence'),
    finalValidation: extract('Final Validation'),
    raw,
    kbSources: kbSources.length > 0 ? kbSources : undefined,
  };
}

// ============================================
// STREAMING CHAT
// ============================================

export interface StreamChatOptions {
  generalKBEnabled?: boolean;
  behavioralKBEnabled?: boolean;
}

export async function streamChat(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  debugMode: boolean,
  onDelta: (text: string) => void,
  onDebug: (debug: DebugBreakdown) => void,
  onDone: () => void,
  onError: (error: string) => void,
  selectedPromo?: PromoItem | null,
  onTicketCreated?: (ticket: { ticket_number: string; category: string }) => void,
  kbOptions?: StreamChatOptions,
): Promise<void> {
  if (!IS_DEV_MODE) {
    onError('Livechat Test Console hanya tersedia di dev mode');
    return;
  }

  try {
    // Stream from Claude Sonnet 4.5 via Supabase ai-proxy (SSE passthrough)
    const response = await fetch(AI_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        type: 'chat',
        system: systemPrompt,
        messages: messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      onError(`AI proxy error: ${response.status} - ${errorText}`);
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

    // Anthropic SSE format:
    //   event: content_block_delta
    //   data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}
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
        if (line.startsWith('event:')) continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') break;

        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.type === 'content_block_delta') {
            const text = parsed.delta?.text as string | undefined;
            if (text) {
              fullResponse += text;
              onDelta(text);
            }
          }
          // Other event types (message_start, message_delta, message_stop, ping) ignored
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
      // Client-side fallback — use LLM reasoning call
        const lastUserMsg = messages[messages.length - 1]?.content || '';
        const clientDebug = await buildClientDebug(lastUserMsg, fullResponse, selectedPromo || null, kbOptions);
        // Attach kbHealth from engine
        if (selectedPromo) {
          const { kbHealth } = buildKBContext(selectedPromo);
          clientDebug.kbHealth = kbHealth;
        }
        onDebug(clientDebug);
      }
    }

    // Detect and process [TICKET:category:summary] marker
    const ticketMatch = fullResponse.match(/\[TICKET:(\w+):([^\]]+)\]/);
    if (ticketMatch && onTicketCreated) {
      const category = ticketMatch[1] as TicketCategory;
      const summary = ticketMatch[2].trim();
      const validCategories: TicketCategory[] = ['general', 'deposit', 'withdraw', 'reward'];
      if (validCategories.includes(category)) {
        const ticket = createTicketFromChat(category, summary);
        onTicketCreated({ ticket_number: ticket.ticket_number, category });
      }
    }

    onDone();
  } catch (error) {
    onError(error instanceof Error ? error.message : 'Unknown error');
  }
}

// ============================================
// CLIENT-SIDE DEBUG FALLBACK — LLM REASONING
// ============================================

export async function buildClientDebug(
  userMessage: string,
  assistantResponse: string,
  promo: PromoItem | null,
  kbOptions?: StreamChatOptions,
): Promise<DebugBreakdown> {
  // Build KB inventory for reasoning prompt
  const kbInventory: string[] = [];

  if (promo) {
    kbInventory.push(`[Promo KB] Promo: "${(promo as any).promo_name || promo.id}"`);
  }

  if (kbOptions?.generalKBEnabled) {
    const kbItems = getGeneralKnowledge();
    for (const item of kbItems) {
      kbInventory.push(`[General KB] FAQ: "${item.question}" (category: ${item.category})`);
    }
  }

  if (kbOptions?.behavioralKBEnabled) {
    const rules = getBehavioralRules();
    const activeRules = rules.filter(r => r.status === 'active');
    for (const rule of activeRules) {
      kbInventory.push(`[Behavioral KB] Rule: "${rule.display_name || rule.behavior_category}" (criteria: ${rule.applicability_criteria || 'N/A'})`);
    }
  }

  if (kbInventory.length === 0) {
    return {
      userIntent: userMessage.length > 120 ? userMessage.slice(0, 120) + '…' : userMessage,
      jsonFieldsReferenced: ['Tidak ada KB yang aktif'],
      analysis: 'Tidak ada KB yang aktif — jawaban murni dari persona',
      retrievalStatus: 'none',
      conflictCheck: 'tidak ada',
      confidence: 'rendah',
      finalValidation: 'KB kurang lengkap',
      raw: '[Client reasoning — no KB active]',
      source: 'client',
    };
  }

  // LLM reasoning call
  try {
    const reasoningPrompt = `Kamu adalah debugger untuk AI customer service. Tugasmu: tentukan KB (Knowledge Base) mana yang DIGUNAKAN oleh assistant untuk menjawab.

## KB yang tersedia:
${kbInventory.map((k, i) => `${i + 1}. ${k}`).join('\n')}

## Pesan user:
"${userMessage}"

## Respons assistant:
"${assistantResponse.slice(0, 1500)}"

## Instruksi:
Analisis respons assistant dan tentukan:
1. KB mana yang BENAR-BENAR digunakan (bukan hanya tersedia, tapi benar-benar menjadi sumber jawaban)
2. Jika jawaban mengandung informasi spesifik yang ada di KB, itu MATCH
3. Jika jawaban hanya berdasarkan persona/pengetahuan umum, tulis "none"

Jawab HANYA dalam format JSON valid (tanpa markdown, tanpa backtick):
{
  "kbSources": [{"source": "promo|general|behavioral", "label": "nama/judul KB", "detail": "penjelasan singkat kenapa match"}],
  "confidence": "sangat tinggi|tinggi|sedang|rendah",
  "analysis": "penjelasan 1 kalimat",
  "fieldsReferenced": ["deskripsi field/FAQ/rule yang dirujuk"]
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getOpenAIKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: reasoningPrompt }],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response (handle possible markdown wrapping)
    let jsonStr = rawContent.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    
    const parsed = JSON.parse(jsonStr);
    const kbSources: KBSourceMatch[] = (parsed.kbSources || [])
      .filter((s: any) => ['promo', 'general', 'behavioral'].includes(s.source))
      .map((s: any) => ({ source: s.source, label: s.label, detail: s.detail }));

    return {
      userIntent: userMessage.length > 120 ? userMessage.slice(0, 120) + '…' : userMessage,
      jsonFieldsReferenced: parsed.fieldsReferenced?.length > 0
        ? parsed.fieldsReferenced
        : ['Tidak ada field yang dirujuk'],
      analysis: parsed.analysis || 'Reasoning call completed',
      retrievalStatus: kbSources.length > 0 ? 'valid' : 'partial',
      conflictCheck: 'tidak ada',
      confidence: parsed.confidence || 'sedang',
      finalValidation: kbSources.length > 0 ? 'Jawaban konsisten dengan KB' : 'KB kurang lengkap',
      raw: `[Client reasoning trace]\n${rawContent}`,
      source: 'client',
      kbSources: kbSources.length > 0 ? kbSources : undefined,
    };
  } catch (err) {
    // Fallback if reasoning call fails
    return {
      userIntent: userMessage.length > 120 ? userMessage.slice(0, 120) + '…' : userMessage,
      jsonFieldsReferenced: ['⚠️ Reasoning call gagal — tidak bisa menentukan KB sources'],
      analysis: `Reasoning call error: ${err instanceof Error ? err.message : 'unknown'}`,
      retrievalStatus: 'none',
      conflictCheck: 'tidak ada',
      confidence: 'rendah',
      finalValidation: 'KB kurang lengkap',
      raw: `[Client reasoning — FAILED]\n${err}`,
      source: 'client',
    };
  }
}

// ============================================
// PROMO LOADER
// ============================================

export async function loadPromoList(): Promise<PromoItem[]> {
  return promoKB.getAll();
}
