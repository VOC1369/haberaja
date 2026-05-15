/**
 * APBE Runtime Crisis Logic v1.0
 * 
 * Modul behaviour engine untuk menangani user yang marah/crisis
 * Dipisahkan dari validator karena ini adalah runtime behavior, bukan validation logic
 * 
 * Fungsi:
 * ✔ detectCrisis() - Deteksi apakah user sedang dalam kondisi crisis
 * ✔ determineToneOverride() - Override tone berdasarkan persona archetype
 * ✔ generateCrisisResponse() - Generate response dengan template yang sesuai
 * ✔ escalationDecisionTree() - Logika eskalasi ke manusia
 * ✔ postCrisisNormalization() - Kembali ke tone normal setelah crisis selesai
 * 
 * Digunakan oleh AI Engine, bukan oleh CMS/Form
 */

import { BrandArchetype } from "./apbe-enums";
import { ARCHETYPE_RULESET, CrisisStyle } from "./apbe-archetype-ruleset";

// ============================================================
// TYPES
// ============================================================

export interface CrisisDetectionResult {
  isCrisis: boolean;
  severity: 1 | 2 | 3; // 1=mild, 2=medium, 3=severe
  triggers: string[];
  matchedWords: string[];
  escalateImmediately: boolean;
}

export interface ToneOverride {
  playfulness: "off" | "low" | "normal";
  emojiDensity: "none" | "low" | "normal";
  formality: "high" | "medium" | "low";
  empathy: "high" | "medium";
  escalationPriority: "high" | "medium" | "low";
}

export interface CrisisResponseConfig {
  archetype: BrandArchetype;
  templates: Record<string, string>;
  callToPlayer: string;
  agentName: string;
}

export interface EscalationDecision {
  shouldEscalate: boolean;
  reason: string;
  priority: "urgent" | "normal";
  suggestedMessage: string;
}

// ============================================================
// CRISIS DETECTION PATTERNS
// ============================================================

/**
 * Toxic words by severity level
 * Used for crisis detection and severity scoring
 */
const TOXIC_PATTERNS = {
  level_1: ["kesel", "bete", "sebel", "cape", "males", "lama", "ribet"],
  level_2: ["tolol", "bego", "idiot", "bodoh", "goblog"],
  level_3: ["anjing", "babi", "bangsat", "kontol", "memek", "tai", "asu"],
} as const;

/**
 * Escalation trigger phrases
 * When user explicitly requests human assistance
 */
const ESCALATION_TRIGGERS = [
  "admin",
  "cs",
  "customer service",
  "minta dibantu",
  "hubungi langsung",
  "bicara dengan manusia",
  "mau komplain",
  "minta atasan",
  "supervisor",
  "manager",
];

/**
 * Financial crisis indicators
 * High priority - involves money
 */
const FINANCIAL_TRIGGERS = [
  "penipu",
  "scam",
  "tipu",
  "refund",
  "mana uang",
  "uang saya",
  "duit saya",
  "kembalikan",
  "rugi",
  "hilang",
];

// ============================================================
// CRISIS DETECTION
// ============================================================

/**
 * Detect if user message indicates crisis state
 * 
 * @param message - User's message text
 * @param dictionaryRed - Custom red words from config
 * @param dictionaryYellow - Custom yellow words from config
 * @returns CrisisDetectionResult with severity and triggers
 */
export function detectCrisis(
  message: string,
  dictionaryRed: string[] = [],
  dictionaryYellow: string[] = []
): CrisisDetectionResult {
  const lowerMessage = message.toLowerCase();
  const matchedWords: string[] = [];
  const triggers: string[] = [];
  let maxSeverity = 1 as 1 | 2 | 3;
  
  // Check Level 3 (severe) - includes custom red words
  const level3Words = [...TOXIC_PATTERNS.level_3, ...dictionaryRed.map(w => w.toLowerCase())];
  level3Words.forEach(word => {
    if (lowerMessage.includes(word)) {
      matchedWords.push(word);
      triggers.push("toxic_level_3");
      maxSeverity = 3;
    }
  });
  
  // Check Level 2 (medium)
  if (maxSeverity < 3) {
    TOXIC_PATTERNS.level_2.forEach(word => {
      if (lowerMessage.includes(word)) {
        matchedWords.push(word);
        triggers.push("toxic_level_2");
        if (maxSeverity < 2) maxSeverity = 2;
      }
    });
  }
  
  // Check Level 1 (mild) - includes custom yellow words
  if (maxSeverity < 2) {
    const level1Words = [...TOXIC_PATTERNS.level_1, ...dictionaryYellow.map(w => w.toLowerCase())];
    level1Words.forEach(word => {
      if (lowerMessage.includes(word)) {
        matchedWords.push(word);
        triggers.push("toxic_level_1");
      }
    });
  }
  
  // Check escalation triggers
  ESCALATION_TRIGGERS.forEach(trigger => {
    if (lowerMessage.includes(trigger)) {
      triggers.push("escalation_request");
    }
  });
  
  // Check financial triggers (always high priority)
  FINANCIAL_TRIGGERS.forEach(trigger => {
    if (lowerMessage.includes(trigger)) {
      triggers.push("financial_concern");
      if (maxSeverity < 2) maxSeverity = 2;
    }
  });
  
  // Check for ALL CAPS (anger indicator)
  const capsRatio = (message.match(/[A-Z]/g) || []).length / message.length;
  if (capsRatio > 0.5 && message.length > 10) {
    triggers.push("caps_anger");
    if (maxSeverity < 2) maxSeverity = 2;
  }
  
  // Check for excessive punctuation (!!!, ???)
  if (/[!?]{3,}/.test(message)) {
    triggers.push("excessive_punctuation");
  }
  
  const isCrisis = matchedWords.length > 0 || triggers.length > 0;
  const escalateImmediately = maxSeverity === 3 || triggers.includes("financial_concern");
  
  return {
    isCrisis,
    severity: maxSeverity,
    triggers: [...new Set(triggers)], // dedupe
    matchedWords: [...new Set(matchedWords)],
    escalateImmediately,
  };
}

// ============================================================
// TONE OVERRIDE BY PERSONA
// ============================================================

/**
 * Determine tone override based on persona archetype
 * Different archetypes respond to crisis differently
 * 
 * Ruler = calm professional, solution first
 * Sage = empathetic balanced, stable
 * Jester = MUST shift down from playful to soft empathetic
 */
export function determineToneOverride(archetype: BrandArchetype): ToneOverride {
  const crisisStyle = ARCHETYPE_RULESET[archetype]?.crisis_style || "empathetic_soft";
  
  switch (archetype) {
    case "ruler":
      return {
        playfulness: "off",
        emojiDensity: "none",
        formality: "high",
        empathy: "medium",
        escalationPriority: "high",
      };
      
    case "sage":
      return {
        playfulness: "off",
        emojiDensity: "low",
        formality: "medium",
        empathy: "high",
        escalationPriority: "medium",
      };
      
    case "jester":
      // CRITICAL: Jester MUST shift down playfulness during crisis
      return {
        playfulness: "off", // Turn off playfulness completely
        emojiDensity: "low", // Reduce emoji
        formality: "medium", // Increase formality slightly
        empathy: "high", // Maximum empathy
        escalationPriority: "medium",
      };
      
    case "caregiver":
      return {
        playfulness: "off",
        emojiDensity: "low",
        formality: "low",
        empathy: "high",
        escalationPriority: "medium",
      };
      
    case "hero":
      return {
        playfulness: "off",
        emojiDensity: "none",
        formality: "high",
        empathy: "medium",
        escalationPriority: "high",
      };
      
    default:
      // Default: balanced empathetic
      return {
        playfulness: "off",
        emojiDensity: "low",
        formality: "medium",
        empathy: "high",
        escalationPriority: "medium",
      };
  }
}

// ============================================================
// CRISIS RESPONSE GENERATION
// ============================================================

/**
 * Generate crisis response using template and persona config
 * Applies tone override based on archetype
 */
export function generateCrisisResponse(
  templateKey: string,
  config: CrisisResponseConfig
): string {
  const template = config.templates[templateKey] || config.templates["angry_player"] || "";
  const toneOverride = determineToneOverride(config.archetype);
  
  // Replace template variables
  let response = template
    .replace(/\{\{A\.call_to_player\}\}/g, config.callToPlayer)
    .replace(/\{\{agent\.name\}\}/g, config.agentName);
  
  // Apply tone modifications based on override
  if (toneOverride.emojiDensity === "none") {
    // Remove most emoji, keep only 🙏
    response = response.replace(/[😊🎉💪🔥✨🥳👍❤️😢💛🌟🏆🎁]/g, "");
  } else if (toneOverride.emojiDensity === "low") {
    // Keep only empathy emoji
    response = response.replace(/[🎉💪🔥✨🥳🏆🎁]/g, "");
  }
  
  return response.trim();
}

// ============================================================
// ESCALATION DECISION TREE
// ============================================================

/**
 * Determine whether to escalate to human support
 * 
 * @param crisisResult - Result from detectCrisis()
 * @param messageCount - Number of angry messages in session
 * @param maxAiAttempts - Max AI attempts before escalation (from config)
 * @returns EscalationDecision with recommendation
 */
export function escalationDecisionTree(
  crisisResult: CrisisDetectionResult,
  messageCount: number,
  maxAiAttempts: number = 3
): EscalationDecision {
  // Immediate escalation for severe cases
  if (crisisResult.escalateImmediately) {
    return {
      shouldEscalate: true,
      reason: "Severity level 3 or financial concern detected",
      priority: "urgent",
      suggestedMessage: "Mohon tunggu sebentar, saya akan menghubungkan {{A.call_to_player}} dengan tim prioritas kami. 🙏",
    };
  }
  
  // Explicit escalation request
  if (crisisResult.triggers.includes("escalation_request")) {
    return {
      shouldEscalate: true,
      reason: "User explicitly requested human support",
      priority: "normal",
      suggestedMessage: "Baik {{A.call_to_player}}, saya akan hubungkan dengan admin yang bertugas. Mohon tunggu sebentar ya. 🙏",
    };
  }
  
  // Too many angry messages
  if (messageCount >= maxAiAttempts && crisisResult.isCrisis) {
    return {
      shouldEscalate: true,
      reason: `User sent ${messageCount} angry messages (max: ${maxAiAttempts})`,
      priority: "normal",
      suggestedMessage: "{{A.call_to_player}}, agar lebih cepat terselesaikan, saya akan bantu hubungkan dengan tim kami. 🙏",
    };
  }
  
  // Not escalating - AI continues handling
  return {
    shouldEscalate: false,
    reason: "Within AI handling threshold",
    priority: "normal",
    suggestedMessage: "",
  };
}

// ============================================================
// POST-CRISIS NORMALIZATION
// ============================================================

/**
 * Check if crisis has ended and AI can return to normal tone
 * 
 * @param recentMessages - Last 2-3 messages from user
 * @returns boolean - true if safe to return to normal tone
 */
export function shouldNormalizeTone(recentMessages: string[]): boolean {
  if (recentMessages.length < 2) return false;
  
  // Check last 2 messages are not crisis
  const lastTwoMessages = recentMessages.slice(-2);
  const crisisResults = lastTwoMessages.map(msg => detectCrisis(msg));
  
  // All recent messages are non-crisis
  return crisisResults.every(result => !result.isCrisis);
}

/**
 * Get gradual tone restoration steps
 * AI shouldn't jump immediately back to full playful mode
 */
export function getToneRestorationSteps(archetype: BrandArchetype): {
  step1: ToneOverride;
  step2: ToneOverride;
} {
  const isPlayful = ["jester", "everyman", "explorer", "innocent"].includes(archetype);
  
  if (isPlayful) {
    return {
      // First message after crisis: still subdued
      step1: {
        playfulness: "low",
        emojiDensity: "low",
        formality: "medium",
        empathy: "high",
        escalationPriority: "medium",
      },
      // Second message: back to normal
      step2: {
        playfulness: "normal",
        emojiDensity: "normal",
        formality: "low",
        empathy: "medium",
        escalationPriority: "low",
      },
    };
  }
  
  // Formal personas return to normal faster
  return {
    step1: {
      playfulness: "off",
      emojiDensity: "low",
      formality: "high",
      empathy: "medium",
      escalationPriority: "medium",
    },
    step2: {
      playfulness: "off",
      emojiDensity: "low",
      formality: "high",
      empathy: "medium",
      escalationPriority: "low",
    },
  };
}

// ============================================================
// CRISIS OVERRIDE TABLE (Reference)
// ============================================================

/**
 * Reference table for crisis overrides by persona type
 * Used by AI Engine during runtime
 */
export const CRISIS_OVERRIDE_TABLE: Record<BrandArchetype, {
  playfulness: boolean;
  emojiLevel: "low" | "medium" | "high";
  formality: "low" | "medium" | "high";
  empathy: "medium" | "high";
  escalationPriority: "medium" | "high";
}> = {
  ruler: { playfulness: false, emojiLevel: "low", formality: "high", empathy: "medium", escalationPriority: "high" },
  sage: { playfulness: false, emojiLevel: "medium", formality: "medium", empathy: "high", escalationPriority: "medium" },
  jester: { playfulness: false, emojiLevel: "low", formality: "medium", empathy: "high", escalationPriority: "medium" },
  hero: { playfulness: false, emojiLevel: "low", formality: "high", empathy: "medium", escalationPriority: "high" },
  caregiver: { playfulness: false, emojiLevel: "medium", formality: "low", empathy: "high", escalationPriority: "medium" },
  everyman: { playfulness: false, emojiLevel: "medium", formality: "medium", empathy: "high", escalationPriority: "medium" },
  creator: { playfulness: false, emojiLevel: "medium", formality: "medium", empathy: "high", escalationPriority: "medium" },
  explorer: { playfulness: false, emojiLevel: "low", formality: "medium", empathy: "high", escalationPriority: "medium" },
  rebel: { playfulness: false, emojiLevel: "low", formality: "medium", empathy: "medium", escalationPriority: "medium" },
  lover: { playfulness: false, emojiLevel: "low", formality: "medium", empathy: "high", escalationPriority: "medium" },
  magician: { playfulness: false, emojiLevel: "medium", formality: "medium", empathy: "high", escalationPriority: "medium" },
  innocent: { playfulness: false, emojiLevel: "low", formality: "medium", empathy: "high", escalationPriority: "medium" },
};

// ============================================================
// VERSION
// ============================================================

export const RUNTIME_CRISIS_VERSION = "1.2.0" as const;
