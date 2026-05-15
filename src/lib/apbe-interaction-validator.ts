/**
 * APBE Interaction Library Validator v2.0
 * Validates edited templates against persona rules
 */

import { APBEConfig } from "@/types/apbe-config";
import { InteractionTemplate } from "./apbe-interaction-generator";

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

// Required placeholders that cannot be removed
const REQUIRED_PLACEHOLDERS = ["{{A.call_to_player}}"];

// Formal words that shouldn't appear in friendly tone
const FORMAL_WORDS = ["Bapak", "Ibu", "Anda", "saudara", "yang terhormat"];

// Casual words that shouldn't appear in professional tone
const CASUAL_WORDS = ["dong", "deh", "nih", "yuk", "wkwk", "hehe", "lol", "btw", "gue", "lu"];

/**
 * Check if content contains forbidden emojis
 */
export const checkForbiddenEmojis = (content: string, forbiddenEmojis: string[]): string[] => {
  const warnings: string[] = [];
  
  forbiddenEmojis.forEach(emoji => {
    if (content.includes(emoji)) {
      warnings.push(`Emoji "${emoji}" tidak diizinkan oleh persona.`);
    }
  });
  
  return warnings;
};

/**
 * Check if required placeholders are present
 */
export const checkRequiredPlaceholders = (content: string): string[] => {
  const errors: string[] = [];
  
  // Check if the template uses call_to_player somewhere
  // It's okay if not every template has it, but warn if it was removed from a template that had it
  
  return errors;
};

/**
 * Check if content matches tone expectations
 */
export const checkToneConsistency = (content: string, tone: string): string[] => {
  const warnings: string[] = [];
  
  if (tone === "friendly" || tone === "playful") {
    // Check for overly formal language
    FORMAL_WORDS.forEach(word => {
      if (content.toLowerCase().includes(word.toLowerCase())) {
        warnings.push(`Kata "${word}" terlalu formal untuk tone ${tone}.`);
      }
    });
  }
  
  if (tone === "professional") {
    // Check for casual language
    CASUAL_WORDS.forEach(word => {
      if (content.toLowerCase().includes(word.toLowerCase())) {
        warnings.push(`Kata "${word}" terlalu kasual untuk tone professional.`);
      }
    });
  }
  
  return warnings;
};

/**
 * Check language ratio (Indonesian vs English)
 */
export const checkLanguageRatio = (content: string, idRatio: number, enRatio: number): string[] => {
  const warnings: string[] = [];
  
  // Simple check: count English words vs Indonesian
  const englishPattern = /\b(the|and|or|is|are|was|were|have|has|been|being|will|would|could|should|can|may|might|must|shall|do|does|did|hello|hi|thanks|thank|sorry|please|yes|no|ok|okay)\b/gi;
  const englishMatches = content.match(englishPattern) || [];
  const words = content.split(/\s+/).filter(w => w.length > 2);
  
  if (words.length > 0) {
    const englishPercentage = (englishMatches.length / words.length) * 100;
    
    if (enRatio === 0 && englishPercentage > 10) {
      warnings.push(`Rasio bahasa Inggris (${Math.round(englishPercentage)}%) melebihi setting persona (${enRatio}%).`);
    }
  }
  
  return warnings;
};

/**
 * Check content length
 */
export const checkContentLength = (content: string): string[] => {
  const warnings: string[] = [];
  
  if (content.length < 10) {
    warnings.push("Konten terlalu pendek (minimal 10 karakter).");
  }
  
  if (content.length > 500) {
    warnings.push("Konten terlalu panjang (maksimal 500 karakter).");
  }
  
  return warnings;
};

/**
 * Validate a single template against persona config
 */
export const validateTemplate = (
  template: InteractionTemplate,
  config: APBEConfig
): ValidationResult => {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  const content = template.content;
  const tone = config.agent?.style || "friendly";
  const forbiddenEmojis = config.agent?.emoji_forbidden || [];
  const idRatio = config.C?.language_ratio?.indonesian || 100;
  const enRatio = config.C?.language_ratio?.english || 0;
  
  // Check forbidden emojis
  warnings.push(...checkForbiddenEmojis(content, forbiddenEmojis));
  
  // Check tone consistency
  warnings.push(...checkToneConsistency(content, tone));
  
  // Check language ratio
  warnings.push(...checkLanguageRatio(content, idRatio, enRatio));
  
  // Check content length
  const lengthWarnings = checkContentLength(content);
  if (lengthWarnings.some(w => w.includes("pendek"))) {
    errors.push(...lengthWarnings.filter(w => w.includes("pendek")));
  } else {
    warnings.push(...lengthWarnings);
  }
  
  // Check if content is empty
  if (!content.trim()) {
    errors.push("Konten tidak boleh kosong.");
  }
  
  return {
    isValid: errors.length === 0,
    warnings,
    errors
  };
};

/**
 * Validate entire library
 */
export const validateLibrary = (
  library: Record<string, InteractionTemplate[]>,
  config: APBEConfig
): { categoryWarnings: Record<string, string[]>; isValid: boolean } => {
  const categoryWarnings: Record<string, string[]> = {};
  let isValid = true;
  
  Object.entries(library).forEach(([category, templates]) => {
    const warnings: string[] = [];
    
    templates.forEach(template => {
      const result = validateTemplate(template, config);
      if (!result.isValid) {
        isValid = false;
      }
      warnings.push(...result.warnings, ...result.errors);
    });
    
    if (warnings.length > 0) {
      categoryWarnings[category] = warnings;
    }
  });
  
  return { categoryWarnings, isValid };
};

/**
 * Sanitize content - remove forbidden emojis
 */
export const sanitizeContent = (content: string, forbiddenEmojis: string[]): string => {
  let sanitized = content;
  forbiddenEmojis.forEach(emoji => {
    sanitized = sanitized.replace(new RegExp(emoji, 'g'), '');
  });
  return sanitized;
};
