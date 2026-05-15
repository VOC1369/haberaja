/**
 * APBE v3.1 Validation System
 * 
 * STRUCTURE + SEMANTIC WARNINGS
 * User bebas berkreasi tanpa dipaksa - warnings are non-blocking.
 * 
 * VALIDATORS KEPT:
 * ✅ Required fields (website_name, agent name, gender, tone, style, language_ratio, lokasi)
 * ✅ Boundary rule default (1 rule must exist)
 * ✅ VIP Logic (if active) - threshold configured
 * ✅ Contact format validation (WA/Telegram format)
 * 
 * SEMANTIC WARNINGS (non-blocking):
 * ⚠️ Tone consistency (agent tone vs empathy level)
 * ⚠️ Dictionary similarity detection
 * ⚠️ Crisis tone vs agent tone alignment
 * 
 * VALIDATORS REMOVED:
 * ❌ Template quality / length
 * ❌ Greeting consistency
 * ❌ Issue mapping
 * ❌ Lane rules
 * ❌ Keyword matching
 * ❌ Auto-fill requirements
 */

import { APBEConfig } from "@/types/apbe-config";
import { isValidEnumValue } from "./apbe-enums";
import { validateDictionary, findDictionaryConflicts } from "./apbe-dictionary-preprocessor";

// ============================================================
// INTERFACES
// ============================================================

export interface ValidationResult {
  isValid: boolean;
  isSaveable: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[]; // Kept for backward compatibility
  enhancementTips: EnhancementTip[]; // New: enhancement suggestions
  completionPercentage: number;
  sectionStatus: Record<string, SectionStatus>;
  criticalCount: number;
  warningCount: number; // Kept for backward compatibility
  tipsCount: number; // New: count of enhancement tips
}

export type ErrorSeverity = "critical" | "warning" | "info";

export interface ValidationError {
  section: string;
  field: string;
  message: string;
  type: "required" | "format" | "enum" | "conflict" | "range";
  severity: ErrorSeverity;
}

export interface ValidationWarning {
  section: string;
  field: string;
  message: string;
  type: "recommendation" | "conflict";
}

// New: Enhancement tips (non-blocking suggestions)
export interface EnhancementTip {
  section: string;
  field: string;
  message: string;
  benefit: string; // What benefit this enhancement provides
  suggestedValue?: string | number; // Optional recommended value
}

export interface SectionStatus {
  name: string;
  completed: number;
  total: number;
  percentage: number;
  errors: ValidationError[];
}

// ============================================================
// SECTION NAMES
// ============================================================

const SECTION_NAMES: Record<string, string> = {
  A: "Brand Identity",
  agent: "Agent Persona",
  C: "Communication Engine",
  L: "Interaction Library",
  O: "Operational SOP",
  V: "VIP Logic",
};

// ============================================================
// MAIN VALIDATION FUNCTION (SIMPLIFIED)
// ============================================================

export function validateAPBEConfig(config: APBEConfig): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const sectionStatus: Record<string, SectionStatus> = {};

  // === 1. Brand Identity (A) ===
  const brandErrors = validateBrandIdentity(config.A);
  errors.push(...brandErrors);
  sectionStatus.A = {
    name: "Brand Identity",
    completed: getCompletedFields(config.A, ["group_name", "website_name", "lokasi"]),
    total: 3,
    percentage: 0,
    errors: brandErrors,
  };
  sectionStatus.A.percentage = Math.round((sectionStatus.A.completed / sectionStatus.A.total) * 100);

  // === 2. Agent Persona ===
  const agentErrors = validateAgentPersona(config.agent);
  errors.push(...agentErrors);
  sectionStatus.agent = {
    name: "Agent Persona",
    completed: getCompletedFields(config.agent, ["name", "gender", "tone", "style"]),
    total: 4,
    percentage: 0,
    errors: agentErrors,
  };
  sectionStatus.agent.percentage = Math.round((sectionStatus.agent.completed / sectionStatus.agent.total) * 100);

  // === 3. Communication Engine (C) ===
  const commErrors = validateCommunicationEngine(config.C);
  errors.push(...commErrors);
  sectionStatus.C = {
    name: "Communication Engine",
    completed: 1, // Language ratio always has default
    total: 1,
    percentage: 100,
    errors: commErrors,
  };

  // === 4. Interaction Library (L) - OPTIONAL ===
  sectionStatus.L = {
    name: "Interaction Library",
    completed: 1,
    total: 1,
    percentage: 100,
    errors: [],
  };

  // === 5. Operational SOP (O) ===
  const sopErrors = validateOperationalSOP(config.O);
  errors.push(...sopErrors);
  sectionStatus.O = {
    name: "Operational SOP",
    completed: config.O.admin_contact.value ? 1 : 0,
    total: 1,
    percentage: config.O.admin_contact.value ? 100 : 0,
    errors: sopErrors,
  };

  // Note: Behaviour Engine form deleted - Personalization moved to C, Anti-Hunter moved to Safety/Crisis (O)

  // === 7. VIP Logic (V) ===
  const vipErrors = validateVIPLogic(config.V);
  errors.push(...vipErrors);
  sectionStatus.V = {
    name: "VIP Logic",
    completed: config.V.active ? (config.V.threshold.value > 0 ? 1 : 0) : 1,
    total: 1,
    percentage: 0,
    errors: vipErrors,
  };
  sectionStatus.V.percentage = config.V.active 
    ? (config.V.threshold.value > 0 ? 100 : 0)
    : 100;

  // === Enhancement Tips (non-blocking suggestions) ===
  const enhancementTips = generateEnhancementTips(config);

  // === Calculate overall ===
  const totalCompleted = Object.values(sectionStatus).reduce((sum, s) => sum + s.completed, 0);
  const totalFields = Object.values(sectionStatus).reduce((sum, s) => sum + s.total, 0);
  const completionPercentage = Math.round((totalCompleted / totalFields) * 100);

  const criticalCount = errors.filter(e => e.severity === "critical").length;
  const warningCount = 0; // No longer using warnings
  const tipsCount = enhancementTips.length;
  const isSaveable = criticalCount === 0;

  return {
    isValid: errors.length === 0,
    isSaveable,
    errors,
    warnings: [], // Empty - deprecated
    enhancementTips,
    completionPercentage,
    sectionStatus,
    criticalCount,
    warningCount,
    tipsCount,
  };
}

/**
 * Quick check if config can be saved
 */
export function canSaveConfig(config: APBEConfig): boolean {
  const result = validateAPBEConfig(config);
  return result.isSaveable;
}

/**
 * Get human-readable validation summary
 */
export function getValidationSummary(result: ValidationResult): string {
  if (result.isValid) {
    return "✅ Semua validasi berhasil";
  }
  if (!result.isSaveable) {
    return `❌ ${result.criticalCount} field wajib harus diisi sebelum bisa disimpan`;
  }
  return `⚠️ ${result.warningCount} warning, tetapi bisa disimpan`;
}

// ============================================================
// SECTION VALIDATORS (SIMPLIFIED)
// ============================================================

function validateBrandIdentity(brand: APBEConfig["A"]): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // group_name is REQUIRED (INTERNAL METADATA ONLY - never exposed to runtime/chat/prompt)
  // This field is for dashboard/provider/analytics use only
  if (!brand.group_name?.trim()) {
    errors.push({ 
      section: "A", 
      field: "group_name", 
      message: "Nama Group wajib diisi (internal metadata)", 
      type: "required", 
      severity: "critical" 
    });
  }
  
  // website_name is REQUIRED
  if (!brand.website_name?.trim()) {
    errors.push({ 
      section: "A", 
      field: "website_name", 
      message: "Nama Website wajib diisi", 
      type: "required", 
      severity: "critical" 
    });
  }
  
  // lokasi is REQUIRED
  if (!isValidEnumValue("lokasi_region", brand.lokasi)) {
    errors.push({ 
      section: "A", 
      field: "lokasi", 
      message: "Lokasi/Region wajib dipilih", 
      type: "required", 
      severity: "critical" 
    });
  }
  
  // group_name, slogan, call_to_player, archetype are OPTIONAL - no validation
  
  return errors;
}

function validateAgentPersona(agent: APBEConfig["agent"]): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // name is REQUIRED
  if (!agent.name?.trim()) {
    errors.push({ 
      section: "agent", 
      field: "name", 
      message: "Nama Agent wajib diisi", 
      type: "required", 
      severity: "critical" 
    });
  }
  
  // gender is REQUIRED
  if (!isValidEnumValue("agent_gender", agent.gender)) {
    errors.push({ 
      section: "agent", 
      field: "gender", 
      message: "Gender wajib dipilih", 
      type: "required", 
      severity: "critical" 
    });
  }
  
  // tone is REQUIRED
  if (!isValidEnumValue("agent_tone", agent.tone)) {
    errors.push({ 
      section: "agent", 
      field: "tone", 
      message: "Tone Personality wajib dipilih", 
      type: "required", 
      severity: "critical" 
    });
  }
  
  // style is REQUIRED
  if (!isValidEnumValue("agent_style", agent.style)) {
    errors.push({ 
      section: "agent", 
      field: "style", 
      message: "Communication Style wajib dipilih", 
      type: "required", 
      severity: "critical" 
    });
  }
  
  // speed, backstory, emoji_allowed, emoji_forbidden are OPTIONAL - no validation
  
  return errors;
}

function validateCommunicationEngine(comm: APBEConfig["C"]): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Language ratio must equal 100%
  const totalRatio = (comm.language_ratio?.indonesian || 0) + (comm.language_ratio?.english || 0);
  if (totalRatio !== 100) {
    errors.push({ 
      section: "C", 
      field: "language_ratio", 
      message: `Ratio bahasa harus total 100% (sekarang ${totalRatio}%)`, 
      type: "range",
      severity: "critical"
    });
  }
  
  // Boundary rule default check
  const boundaryRules = comm.boundary_rules;
  if (!boundaryRules || !boundaryRules.default_rules || boundaryRules.default_rules.length === 0) {
    errors.push({
      section: "C",
      field: "boundary_rules",
      message: "Default boundary rule wajib aktif",
      type: "required",
      severity: "critical",
    });
  }
  
  // All other fields (empathy, persuasion, humor, dialect, auto_switch, etc.) are OPTIONAL
  // No validation needed - they all have defaults
  
  return errors;
}

function validateOperationalSOP(sop: APBEConfig["O"]): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Admin contact value REQUIRED
  if (!sop.admin_contact.value?.trim()) {
    errors.push({ 
      section: "O", 
      field: "admin_contact.value", 
      message: "Kontak admin wajib diisi", 
      type: "required", 
      severity: "critical" 
    });
  } else {
    // Format validation
    if (sop.admin_contact.method === "whatsapp") {
      const waValue = sop.admin_contact.value.replace(/\D/g, "");
      if (waValue.length < 8 || waValue.length > 15) {
        errors.push({ 
          section: "O", 
          field: "admin_contact.value", 
          message: "Nomor WA harus 8-15 digit", 
          type: "format",
          severity: "critical"
        });
      }
    } else if (sop.admin_contact.method === "telegram") {
      if (!sop.admin_contact.value.startsWith("@")) {
        errors.push({ 
          section: "O", 
          field: "admin_contact.value", 
          message: "Username Telegram harus diawali @", 
          type: "format",
          severity: "critical"
        });
      }
    }
  }
  
  // All other fields (escalation, crisis, risk, dictionaries) are OPTIONAL
  // No content validation - user can fill or leave empty
  
  return errors;
}

function validateVIPLogic(vip: APBEConfig["V"]): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // If VIP not active, no validation needed
  if (!vip.active) {
    return errors;
  }
  
  // VIP active: threshold must be configured
  if (!vip.threshold?.value || vip.threshold.value <= 0) {
    errors.push({ 
      section: "V", 
      field: "threshold.value", 
      message: "VIP aktif tapi threshold belum dikonfigurasi", 
      type: "required", 
      severity: "critical" 
    });
  }
  
  // All other VIP fields are OPTIONAL (greeting, closing, svip_rules, etc.)
  
  return errors;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getCompletedFields(obj: Record<string, any>, fields: string[]): number {
  return fields.filter(field => {
    const value = obj[field];
    return value !== undefined && value !== null && value !== "";
  }).length;
}

// ============================================================
// ENHANCEMENT TIPS (NON-BLOCKING SUGGESTIONS)
// ============================================================

/**
 * Generate enhancement tips for improving persona configuration
 * These are helpful suggestions, NOT warnings or errors
 */
function generateEnhancementTips(config: APBEConfig): EnhancementTip[] {
  const tips: EnhancementTip[] = [];
  
  // === 1. Tone Consistency Tips ===
  const agentTone = config.agent?.tone;
  const empathyLevel = config.C?.empathy || 7;
  
  // Strict tone with high empathy - suggest adjustment
  if (agentTone === "strict_efficient" && empathyLevel > 7) {
    tips.push({
      section: "C",
      field: "empathy",
      message: "Tingkat empati tinggi dengan tone 'Tegas & Efisien'",
      benefit: "Menurunkan empati ke 5-6 akan membuat respons lebih konsisten dengan tone tegas",
      suggestedValue: 6
    });
  }
  
  // Soft tone with low empathy - suggest adjustment
  if (agentTone === "soft_warm" && empathyLevel < 5) {
    tips.push({
      section: "C",
      field: "empathy",
      message: "Tingkat empati rendah dengan tone 'Soft & Warm'",
      benefit: "Menaikkan empati ke 7-8 akan membuat respons lebih hangat dan konsisten",
      suggestedValue: 7
    });
  }
  
  // === 2. VIP Enhancement Tips ===
  // All VIP tone modifiers use range -3 to +3
  if (config.V?.active) {
    const vipWarmth = config.V?.tone_modifiers?.warmth ?? 0;
    const vipFormality = config.V?.tone_modifiers?.formality ?? 0;
    const vipSpeed = config.V?.tone_modifiers?.speed ?? 0;
    
    // Warmth: If negative or zero, suggest +2
    if (vipWarmth < 1) {
      tips.push({
        section: "V",
        field: "tone_modifiers.warmth",
        message: "VIP warmth modifier rendah atau netral",
        benefit: "Menaikkan warmth ke +2 akan memberikan pengalaman VIP yang lebih personal dan hangat",
        suggestedValue: 2
      });
    }
    
    // Formality: If negative, suggest at least 0 or +1 for VIP respect
    if (vipFormality < 0) {
      tips.push({
        section: "V",
        field: "tone_modifiers.formality",
        message: "VIP formality modifier negatif (terlalu santai)",
        benefit: "Menaikkan formality ke 0 atau +1 akan memberikan kesan lebih hormat kepada VIP",
        suggestedValue: 1
      });
    }
    
    // Speed: If negative, VIP might feel deprioritized
    if (vipSpeed < 0) {
      tips.push({
        section: "V",
        field: "tone_modifiers.speed",
        message: "VIP speed modifier negatif (respons lebih lambat)",
        benefit: "Menaikkan speed ke 0 atau +1 agar VIP tidak merasa diperlambat",
        suggestedValue: 1
      });
    }
  }
  
  // === 3. Persuasion Tips ===
  const persuasionLevel = config.C?.persuasion || 6;
  
  if (agentTone === "gentle_supportive" && persuasionLevel > 7) {
    tips.push({
      section: "C",
      field: "persuasion",
      message: "Tingkat persuasif tinggi dengan tone 'Gentle & Supportive'",
      benefit: "Menurunkan persuasif ke 5-6 akan membuat respons lebih lembut dan supportif",
      suggestedValue: 5
    });
  }
  
  return tips;
}

// ============================================================
// VERSION
// ============================================================

export const VALIDATION_VERSION = "3.1.0" as const;
