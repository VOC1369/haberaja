/**
 * Livechat Test Console Engine v1.0
 * Dev-only chat engine using APBE persona + Promo KB data
 */

import { getOpenAIKey, IS_DEV_MODE } from './config/openai.dev';
import { compileRuntimePrompt } from './apbe-prompt-template';
import { loadInitialConfig } from './apbe-storage';
import { promoKB } from './promo-storage';
import type { PromoItem } from '@/components/VOCDashboard/PromoFormWizard/types';
import type { APBEConfig } from '@/types/apbe-config';

// ============================================
// TYPES
// ============================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
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
] as const;

function buildKBContext(promo: PromoItem): string {
  const data: Record<string, unknown> = {};
  for (const field of KB_FIELDS) {
    const value = (promo as unknown as Record<string, unknown>)[field];
    if (value !== undefined && value !== null && value !== '') {
      data[field] = value;
    }
  }
  
  return `# KNOWLEDGE BASE — Active Promo
Promo: ${promo.promo_name || 'Unknown'}

\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\``;
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

export async function buildSystemPrompt(
  selectedPromo: PromoItem | null,
  debugMode: boolean
): Promise<string> {
  // Load APBE config and compile persona prompt
  const config = await loadInitialConfig();
  const personaPrompt = compileRuntimePrompt(config);
  
  let systemPrompt = personaPrompt;
  
  // Inject KB context if promo selected
  if (selectedPromo) {
    systemPrompt += '\n\n' + buildKBContext(selectedPromo);
  }
  
  // Inject debug instructions if debug mode ON
  if (debugMode) {
    systemPrompt += '\n\n' + DEBUG_INSTRUCTION;
  }
  
  return systemPrompt;
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
    if (debugMode && fullResponse.includes('---DEBUG---')) {
      const parts = fullResponse.split('---DEBUG---');
      if (parts.length >= 2) {
        const debugRaw = parts.slice(1).join('---DEBUG---').trim();
        const debug = parseDebugSection(debugRaw);
        onDebug(debug);
      }
    }

    onDone();
  } catch (error) {
    onError(error instanceof Error ? error.message : 'Unknown error');
  }
}

// ============================================
// PROMO LOADER
// ============================================

export async function loadPromoList(): Promise<PromoItem[]> {
  return promoKB.getAll();
}
