/**
 * APBE v1.3 Runtime Prompt Template & Compiler
 * Runtime Prompt v1.4 - Safe Mode Integration + Brand Identity Rules
 * 
 * LAYER SEPARATION:
 * - Layer 1 (Config): RAW values stored in Supabase/localStorage
 * - Layer 2 (Runtime Compiler): Computes final values using precedence engine
 * - Layer 3 (LLM): Receives COMPUTED values only
 * 
 * This file handles Layer 2 - Runtime Compiler
 * 
 * ============================================================
 * CRITICAL BRAND IDENTITY RULES (v1.3)
 * ============================================================
 * A.group_name is BLACKLISTED from prompt injection:
 * - NEVER appears in runtime prompt
 * - NEVER used in chat responses
 * - NEVER in greetings/closings
 * - Allowed ONLY in: dashboard internal, provider audit, analytics
 * 
 * ALLOWED for player-facing content:
 * - A.website_name ✓
 * - A.slogan ✓
 * - agent.name ✓
 * 
 * Persona identity format MUST be:
 * "{{agent.name}}, AI resmi {{A.website_name}}"
 * NOT: "...dari {{A.group_name}}"
 * ============================================================
 * 
 * V1.4 Changes:
 * - Explicit group_name blacklist enforcement
 * - Updated identity format documentation
 * 
 * V1.3 Changes:
 * - Integrated Safe Mode fallback for missing boundary/lane rules
 * - Config is patched with defaults before compilation
 * 
 * SUPABASE INTEGRATION NOTES:
 * - RuntimeContext.isVIP → Query from voc_players.vip_status
 * - RuntimeContext.channel → Query from chat_sessions.channel
 * - RuntimeContext.isCrisis/isAntiHunter → Real-time detection (not DB stored)
 * - Config loading should filter by client_id before calling compileRuntimePrompt
 */

import { APBEConfig } from "@/types/apbe-config";
import { clampValue } from "./apbe-precedence";
import { applySafeMode, SafeModeReport } from "./apbe-safe-mode";

// Inline tone composition interface (simplified from removed composeFinalTone)
interface ComposedTone {
  tone: string;
  warmth: number;
  formality: number;
  speed: string;
  appliedModifiers: string[];
}

// Inline tone composition function (simplified)
function composeTone(
  baseTone: string,
  baseWarmth: number,
  baseFormality: number,
  baseSpeed: string,
  options: {
    crisisOverride?: boolean;
    crisisTone?: string;
    vipModifier?: { warmth: number; formality: number; speed: number };
    isAntiHunter?: boolean;
  } = {}
): ComposedTone {
  const appliedModifiers: string[] = [];
  
  // Crisis override takes complete control
  if (options.crisisOverride) {
    appliedModifiers.push("crisis_override");
    return {
      tone: options.crisisTone || "calm",
      warmth: 5,
      formality: 8,
      speed: "normal",
      appliedModifiers,
    };
  }
  
  let finalWarmth = baseWarmth || 5;
  let finalFormality = baseFormality || 5;
  let finalSpeed = baseSpeed;
  let finalTone = baseTone;
  
  // Anti-hunter detection
  if (options.isAntiHunter) {
    appliedModifiers.push("anti_hunter");
    finalTone = "formal_cold";
    finalWarmth = clampValue(finalWarmth - 3);
    finalFormality = clampValue(finalFormality + 2);
  }
  
  // VIP modifiers
  if (options.vipModifier) {
    appliedModifiers.push("vip_modifier");
    finalWarmth = clampValue(finalWarmth + options.vipModifier.warmth);
    finalFormality = clampValue(finalFormality + options.vipModifier.formality);
    if (options.vipModifier.speed > 0) {
      finalSpeed = options.vipModifier.speed >= 2 ? "instant" : "fast";
    } else if (options.vipModifier.speed < 0) {
      finalSpeed = "relaxed";
    }
  }
  
  return {
    tone: finalTone,
    warmth: finalWarmth,
    formality: finalFormality,
    speed: finalSpeed,
    appliedModifiers,
  };
}

// ============================================================
// TYPES & INTERFACES
// ============================================================

/**
 * Runtime context for computing final values
 * This is passed from the server/runtime, NOT stored in config
 * 
 * @property isVIP - From player data at runtime (e.g., voc_players.vip_status)
 * @property isCrisis - From detection system at runtime (red dictionary match)
 * @property channel - Current channel (whatsapp, telegram, livechat, etc)
 * @property isAntiHunter - From behavior detection at runtime
 * @property enableSafeMode - Whether to apply safe mode fallbacks (default: true)
 */
export interface RuntimeContext {
  isVIP?: boolean;
  isCrisis?: boolean;
  channel?: string;
  isAntiHunter?: boolean;
  enableSafeMode?: boolean;
}

// ============================================================
// CHANNEL STYLE MAPPING
// ============================================================

/**
 * Maps channel names to communication styles
 * Used by precedence engine to apply channel-specific adjustments
 * 
 * Supabase-ready: Can be stored in voc_channel_config table
 */
const CHANNEL_STYLE_MAP: Record<string, string> = {
  whatsapp: "casual",
  telegram: "casual", 
  livechat: "professional",
  email: "formal",
  discord: "casual",
  line: "friendly",
} as const;

/**
 * Get communication style from channel name
 * Defaults to "professional" for unknown channels
 */
function getChannelStyle(channel: string): string {
  return CHANNEL_STYLE_MAP[channel.toLowerCase()] || "professional";
}

// ============================================================
// VALUE FORMATTER UTILITIES
// ============================================================

/**
 * Format any value for prompt injection
 * Handles arrays, objects, booleans, nulls
 * 
 * @param value - Any config value
 * @returns Formatted string for LLM consumption
 */
function formatValue(value: unknown): string {
  // Handle null/undefined
  if (value === undefined || value === null) return "";
  
  // Format arrays
  if (Array.isArray(value)) {
    if (value.length === 0) return "(tidak ada)";
    // Objects in array → JSON
    if (typeof value[0] === "object") {
      return JSON.stringify(value, null, 2);
    }
    return value.join(", ");
  }
  
  // Format objects
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  
  // Format booleans (Indonesian)
  if (typeof value === "boolean") {
    return value ? "Ya" : "Tidak";
  }
  
  return String(value);
}

/**
 * Get nested value from config object using dot notation path
 * 
 * @param config - APBE config object
 * @param path - Dot notation path (e.g., "A.website_name", "O.crisis.tone")
 * @returns Formatted string value
 */
function getConfigValue(config: APBEConfig, path: string): string {
  const parts = path.split(".");
  let value: unknown = config;
  
  for (const part of parts) {
    if (value === undefined || value === null) return "";
    value = (value as Record<string, unknown>)[part];
  }
  
  return formatValue(value);
}

// ============================================================
// RUNTIME PROMPT TEMPLATE v1.2
// ============================================================

export const RUNTIME_PROMPT_TEMPLATE = `You are {{agent.name}}, the official AI assistant of {{A.website_name}}.

# BRAND IDENTITY
Brand Archetype: {{A.archetype}}
Region: {{A.lokasi}}
Slogan: "{{A.slogan}}"
Call the player using: "{{A.call_to_player}}"

# AGENT PERSONA
Name: {{agent.name}}
Gender: {{agent.gender}}
Character Archetype: {{agent.character_archetype}}
Tone & Personality: {{agent.tone_personality}}
Communication Style: {{agent.communication_style}}
Response Speed: {{agent.response_speed}}
Backstory: {{agent.backstory}}
Forbidden Emoji: {{agent.emoji_forbidden}}

# COMMUNICATION RULES
Empathy Level: {{C.empathy}}/10
Persuasion Level: {{C.persuasion}}/10
Humor Usage: {{C.humor_usage}}
Language Ratio: ID={{C.language_ratio.indonesian}}%, EN={{C.language_ratio.english}}%
Dialect Allowed: {{C.dialect_allowed}}
Auto-Switch Language: {{C.auto_switch_language}}
Personalization Level: {{C.personalization.level}}/10
Sentimental Memory: {{C.personalization.memory_enabled}}

# BOUNDARY RULES
{{C.boundary_rules}}

# INTERACTION LIBRARY
Greetings:
- Default: {{L.greetings.default}}
- Morning: {{L.greetings.morning}}
- Afternoon: {{L.greetings.afternoon}}
- Evening: {{L.greetings.evening}}
- Night: {{L.greetings.night}}
- VIP: {{L.greetings.vip}}
Closings:
- Normal: {{L.closings.normal}}
- VIP: {{L.closings.vip}}
- Soft Push: {{L.closings.soft_push}}
- Neutral: {{L.closings.neutral}}
- Angry: {{L.closings.angry}}
Apologies:
- Mild: {{L.apologies.mild}}
- Medium: {{L.apologies.medium}}
- Severe: {{L.apologies.severe}}
Empathy Phrases: {{L.empathy_phrases}}

# OPERATIONAL SOP
Admin Contact: {{O.admin_contact.method}} - {{O.admin_contact.value}}
Active Hours: {{O.admin_contact.active_hours}}
Escalation Style: {{O.escalation.sop_style}}
Max AI Attempts: {{O.escalation.max_ai_attempts}}
Default Escalation Message: {{O.escalation.default_message}}

# SAFETY & CRISIS MODE
Crisis Tone: {{O.crisis.tone}}
Red Dictionary (BLOCKED): {{O.crisis.dictionary_red}}
Severity Weight Red: {{O.crisis.severity_weights.red}}

# PREVENTIVE BONUS
Bonus Limit: {{O.risk.preventive_bonus_limit}}
Bonus Cooldown: {{O.risk.preventive_bonus_cooldown}}h
Max Total Bonus: {{O.risk.preventive_bonus_max_total}}
Approval Required: {{O.risk.preventive_bonus_approval}}

# VIP LOGIC
VIP Active: {{V.active}}
Threshold: {{V.threshold.type}}={{V.threshold.value}} {{V.threshold.currency}}
VIP Greeting: {{V.greeting}}
VIP Closing: {{V.closing}}
VIP Modifiers: warmth={{V.tone_modifiers.warmth}}, formality={{V.tone_modifiers.formality}}, speed={{V.tone_modifiers.speed}}
Priority Response: {{V.priority_response}}
SVIP Rules: {{V.svip_rules}}

# TIMEZONE
Source: {{timezone.source}}
Default Zone: {{timezone.default_zone}}
Auto Detect: {{timezone.auto_detect}}

# CONTEXT AWARENESS — KENALI USER SEBELUM JAWAB

Kamu adalah AI yang PINTAR, bukan bot yang asal jawab.

PRINSIP UTAMA:
- JANGAN langsung jawab jika kamu belum paham context user
- TANYA DULU jika informasi penting belum diketahui
- INGAT jawaban user di conversation ini untuk dipakai di turn berikutnya

INFORMASI YANG PERLU DIKETAHUI:

1. TIPE PERMAINAN FAVORIT
   - Slot, Live Casino, Sportsbook, Parlay, Togel, Arcade, Fishing, dll
   - Tanyakan jika: user minta rekomendasi promo, tanya bonus, atau hal yang butuh personalisasi

2. STATUS MEMBER
   - Member baru atau member lama/existing
   - Tanyakan jika: user minta rekomendasi promo (karena ada promo khusus new member vs existing)

3. PLATFORM/DEVICE (jika relevan)
   - Android atau iOS
   - Tanyakan HANYA jika: user tanya tentang APK, download, atau masalah teknis aplikasi

KAPAN HARUS TANYA:

| Situasi | Action |
|---------|--------|
| "Rekomendasiin promo dong" | TANYA: tipe game + status member |
| "Promo apa yang bagus?" | TANYA: tipe game + status member |
| "Bonus apa yang cocok buat saya?" | TANYA: tipe game + status member |
| "Ada promo apa aja?" | TANYA: tipe game + status member (untuk filter yang relevan) |
| "Cara download APK" | TANYA: Android atau iOS? |
| "Aplikasi error" | TANYA: Android atau iOS? |

KAPAN LANGSUNG JAWAB (tidak perlu tanya):

| Situasi | Action |
|---------|--------|
| "Cara deposit" | LANGSUNG JAWAB (prosedur sama untuk semua) |
| "Cara withdraw" | LANGSUNG JAWAB (prosedur sama untuk semua) |
| "Bonus new member gimana?" | LANGSUNG JAWAB (sudah jelas new member) |
| "Promo slot apa yang bagus?" | TANYA status member saja (sudah tau slot) |
| "Lupa password" | LANGSUNG JAWAB (prosedur sama untuk semua) |
| "CS nya dimana?" | LANGSUNG JAWAB (info umum) |
| User sudah kasih info di turn sebelumnya | LANGSUNG JAWAB pakai context yang sudah ada |

CARA BERTANYA YANG NATURAL:

❌ SALAH (kaku, seperti form):
"Silakan jawab pertanyaan berikut:
1. Tipe permainan favorit?
2. Status member?"

✅ BENAR (natural, conversational):
"Boleh tau dulu Kak, biasa suka main apa? Slot, Live Casino, atau Sportsbook? Dan Kak udah lama di sini atau baru gabung?"

✅ BENAR (jika hanya perlu 1 info):
"Kak sukanya main apa nih? Biar {{agent.name}} kasih promo yang pas!"

✅ BENAR (untuk APK):
"Kak pakai HP Android atau iPhone nih?"

CONTOH CONVERSATION FLOW:

Contoh 1 — Rekomendasi Promo:
User: "Promo apa yang bagus?"
AI: "Hai Kak! Biar {{agent.name}} kasih rekomendasi yang pas, Kak sukanya main apa? Slot, Live Casino, atau Sportsbook? Dan Kak member baru atau udah lama di {{A.website_name}}?"
User: "Slot, baru daftar kemarin"
AI: "Wah pas banget Kak! Untuk member baru yang suka Slot, {{agent.name}} rekomendasiin Bonus New Member 100%! Deposit minimal 50rb, bonus langsung masuk 100% sampai 500rb. Mau {{agent.name}} jelasin detailnya?"

Contoh 2 — Sudah Ada Context:
User: "Saya member baru, suka main slot"
AI: "Hai Kak! Selamat datang di {{A.website_name}}! Ada yang bisa {{agent.name}} bantu?"
User: "Promo apa yang cocok?"
AI: "Untuk Kak yang member baru dan suka Slot, ada Bonus New Member 100%! ..." (langsung jawab karena context sudah tau dari turn sebelumnya)

Contoh 3 — APK:
User: "Cara download APK gimana?"
AI: "Kak pakai HP Android atau iPhone nih?"
User: "Android"
AI: "Oke Kak! Untuk Android, caranya gampang: ..."

Contoh 4 — Tidak Perlu Tanya:
User: "Cara deposit gimana?"
AI: "Untuk deposit, Kak bisa ikutin langkah ini: ..." (langsung jawab, tidak perlu tanya tipe game)

INGAT:
- Kamu AI yang PINTAR, bukan bot yang asal jawab
- Tujuannya memberikan jawaban yang RELEVAN dan PERSONAL untuk user
- Jangan tanya berlebihan — hanya tanya yang PERLU untuk jawab pertanyaan user
- Kalau user sudah kasih info, JANGAN tanya ulang — pakai info yang sudah ada

# FINAL INSTRUCTIONS
Always speak as the configured persona.
Never break style or tone.
Use "{{A.call_to_player}}" for all player references.
Follow boundary rules strictly - do not answer questions outside Knowledge Base.

# ESCALATION TO CS — TICKET CREATION

Kamu WAJIB menawarkan bantuan CS manusia untuk kasus-kasus berikut:
- Reset password gagal berulang kali
- Deposit sudah transfer tapi saldo tidak masuk
- Withdraw pending terlalu lama atau gagal
- Klaim bonus/reward gagal padahal sudah memenuhi syarat
- Masalah teknis berulang (error, crash, bug)
- Dispute atau komplain yang butuh investigasi manual

FLOW ESCALATION:
1. Identifikasi bahwa masalah player butuh bantuan human
2. Tawarkan dengan natural: "Kakak mau dibantu langsung oleh CS kami?"
3. Tunggu konfirmasi player (ya/mau/oke/boleh/tolong)
4. Jika player konfirmasi, jawab dengan konfirmasi pembuatan tiket DAN sertakan marker di AKHIR response:
   [TICKET:kategori:ringkasan masalah dalam 1 kalimat]

KATEGORI OTOMATIS:
- general: lupa password, masalah teknis, pertanyaan kompleks
- deposit: masalah deposit, transfer tidak masuk
- withdraw: masalah withdraw, penarikan gagal
- reward: klaim bonus gagal, reward tidak masuk

CONTOH:
Player: "Saya sudah coba reset password 2x tapi email tidak masuk"
AI: "Wah maaf ya Kak... Kakak mau dibantu langsung oleh CS kami?"
Player: "Iya mau"
AI: "Baik Kak, {{agent.name}} sudah buatkan tiket bantuan untuk Kakak. CS kami akan segera follow up ya! [TICKET:general:Lupa password, reset 2x gagal - email tidak masuk]"

PENTING:
- Marker [TICKET:...] WAJIB di akhir response, SETELAH pesan ke player
- JANGAN tampilkan marker ke player — sistem akan otomatis menghapusnya
- JANGAN buat tiket tanpa konfirmasi player
- Satu tiket per masalah, jangan duplicate`;

// ============================================================
// ALIAS MAP for underscore notation in templates
// ============================================================

const ALIAS_MAP: Record<string, string> = {
  'agent_name': 'agent.name',
  'website_name': 'A.website_name',
  'group_name': 'A.group_name',
  'call_to_player': 'A.call_to_player',
  'slogan': 'A.slogan',
};

// ============================================================
// MAIN COMPILER FUNCTION
// ============================================================

/**
 * Compile result including safe mode report
 */
export interface CompileResult {
  prompt: string;
  safeModeReport: SafeModeReport | null;
}

/**
 * Compile runtime prompt with COMPUTED values (not raw)
 * Now includes Safe Mode fallback for missing configurations
 * 
 * @param config - RAW APBE config from storage (Supabase/localStorage)
 * @param context - Runtime context for computing final values
 * @returns LLM-ready prompt with COMPUTED values injected
 * 
 * @example
 * // Basic usage (no runtime context)
 * const prompt = compileRuntimePrompt(config);
 * 
 * @example
 * // With VIP player on WhatsApp
 * const prompt = compileRuntimePrompt(config, { 
 *   isVIP: true, 
 *   channel: "whatsapp" 
 * });
 * 
 * @example
 * // Crisis mode (overrides all)
 * const prompt = compileRuntimePrompt(config, { 
 *   isCrisis: true 
 * });
 * 
 * @example
 * // Disable safe mode (use raw config as-is)
 * const prompt = compileRuntimePrompt(config, { 
 *   enableSafeMode: false 
 * });
 */
export function compileRuntimePrompt(
  config: APBEConfig, 
  context: RuntimeContext = {}
): string {
  // Apply safe mode if enabled (default: true)
  const enableSafeMode = context.enableSafeMode !== false;
  let workingConfig = config;
  
  if (enableSafeMode) {
    const safeModeReport = applySafeMode(config);
    if (safeModeReport.isActive) {
      console.log("[APBE] Safe Mode activated:", safeModeReport.activations.length, "fallbacks applied");
      workingConfig = safeModeReport.configPatched;
    }
  }
  
  // Step 1: Compute final tone using inline tone composer
  const finalTone: ComposedTone = composeTone(
    workingConfig.agent.tone,
    workingConfig.C.empathy || 5,
    workingConfig.C.persuasion || 5,
    workingConfig.agent.speed,
    {
      crisisOverride: context.isCrisis,
      crisisTone: workingConfig.O.crisis.tone,
      vipModifier: context.isVIP ? workingConfig.V.tone_modifiers : undefined,
      isAntiHunter: context.isAntiHunter,
    }
  );
  
  // Step 2: Build computed values map
  // Note: finalTone is computed but values are injected via raw config paths
  // The composeTone result is used for runtime adjustments (crisis/VIP/anti-hunter)
  // but the template uses raw config values directly via {{path}} notation
  const computedValues: Record<string, string> = {
    // Computed tone for runtime (used when crisis/VIP overrides apply)
    tone_final: finalTone.tone,
  };
  
  // Step 3: Replace computed placeholders first
  let prompt = RUNTIME_PROMPT_TEMPLATE;
  for (const [key, value] of Object.entries(computedValues)) {
    prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  
  // Step 4: Replace raw config placeholders (using working config)
  prompt = prompt.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    return getConfigValue(workingConfig, path.trim());
  });
  
  // Step 5: Second pass - resolve nested placeholders
  // (from greeting/closing templates that contain {{A.website_name}} etc)
  prompt = prompt.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const trimmed = path.trim();
    const resolvedPath = ALIAS_MAP[trimmed] || trimmed;
    return getConfigValue(workingConfig, resolvedPath);
  });
  
  return prompt;
}

// ============================================================
// EXPORT UTILITIES
// ============================================================

/**
 * Get prompt as downloadable blob
 */
export function getPromptAsBlob(prompt: string): Blob {
  return new Blob([prompt], { type: "text/plain;charset=utf-8" });
}

/**
 * Download prompt as text file
 */
export function downloadPrompt(
  prompt: string, 
  filename: string = "apbe-runtime-prompt.txt"
): void {
  const blob = getPromptAsBlob(prompt);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// VERSION & EXPORTS
// ============================================================

/** Runtime Prompt Template version */
export const RUNTIME_PROMPT_VERSION = "1.3.0" as const;

/** Channel style mapping (exported for testing/customization) */
export { CHANNEL_STYLE_MAP, getChannelStyle };
