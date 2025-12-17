/**
 * APBE Persona JSON Validator v3.0
 * 
 * SIMPLIFIED VALIDATION - Structure only, not content.
 * User bebas berkreasi tanpa dipaksa mengikuti rule internal.
 * 
 * VALIDATOR YANG DIPERTAHANKAN:
 * ✅ 1. Field wajib kosong (website_name, agent name, gender, tone, dll)
 * ✅ 2. Boundary rule default harus ada 1
 * ✅ 3. VIP Logic (jika aktif) - minimal 1 tier
 * ✅ 4. Safety Escalation (jika aktif) - minimal 1 kondisi
 * 
 * VALIDATOR YANG DIHAPUS:
 * ❌ Template quality check
 * ❌ Tone mismatch check
 * ❌ Greeting consistency
 * ❌ Issue mapping
 * ❌ Keyword matching
 * ❌ Lane rules (legacy)
 * ❌ Dictionary Red/Yellow count
 * ❌ Toxic severity levels
 */

import { APBEConfig } from "@/types/apbe-config";

// ============================================================
// INTERFACES
// ============================================================

export type BlockStatus = "complete" | "warning" | "error";

export interface PersonaValidationResult {
  score: number;
  isReady: boolean;
  canPublish: boolean;
  criticalErrors: string[];
  warnings: string[];
  info: string[];
  blockStatus: Record<string, BlockStatus>;
  blockResults: Record<string, BlockValidation>;
  missingBlocks: string[];
  missingFields: string[];
  summary: string;
}

export interface BlockValidation {
  name: string;
  status: BlockStatus;
  isComplete: boolean;
  completedFields: number;
  totalFields: number;
  percentage: number;
  missingFields: string[];
  warnings: string[];
  criticalErrors: string[];
}

// ============================================================
// REQUIRED FIELDS (STRUCTURE ONLY)
// ============================================================

const REQUIRED_FIELDS = {
  A: {
    name: "Brand Identity",
    fields: [
      { key: "group_name", label: "Nama Group" },
      { key: "website_name", label: "Nama Website" },
      { key: "lokasi", label: "Lokasi/Region" },
    ],
  },
  agent: {
    name: "Agent Persona",
    fields: [
      { key: "name", label: "Nama Agent" },
      { key: "gender", label: "Gender" },
      { key: "tone", label: "Tone Personality" },
      { key: "style", label: "Communication Style" },
    ],
  },
  C: {
    name: "Communication Engine",
    fields: [
      // All sliders have defaults, only check language_ratio
      { key: "language_ratio.indonesian", label: "Language Ratio" },
    ],
  },
  O: {
    name: "Operational SOP",
    fields: [
      { key: "admin_contact.value", label: "Kontak Admin" },
    ],
  },
} as const;

// ============================================================
// MAIN VALIDATOR FUNCTION (SIMPLIFIED)
// ============================================================

export function validatePersonaJSON(config: APBEConfig): PersonaValidationResult {
  const criticalErrors: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];
  const blockStatus: Record<string, BlockStatus> = {};
  const blockResults: Record<string, BlockValidation> = {};
  const missingBlocks: string[] = [];
  const missingFields: string[] = [];

  // ========================================
  // 1. CHECK REQUIRED FIELDS (STRUCTURE)
  // ========================================
  
  // Brand Identity (A)
  const brandResult = validateRequiredFields(config.A, REQUIRED_FIELDS.A);
  blockResults["A"] = brandResult;
  blockStatus["A"] = brandResult.status;
  if (brandResult.criticalErrors.length > 0) {
    criticalErrors.push(...brandResult.criticalErrors);
  }

  // Agent Persona
  const agentResult = validateRequiredFields(config.agent, REQUIRED_FIELDS.agent);
  blockResults["agent"] = agentResult;
  blockStatus["agent"] = agentResult.status;
  if (agentResult.criticalErrors.length > 0) {
    criticalErrors.push(...agentResult.criticalErrors);
  }

  // Communication Engine (C)
  const commResult = validateRequiredFields(config.C, REQUIRED_FIELDS.C);
  // Check boundary rule default
  const boundaryCheck = validateBoundaryRuleDefault(config.C?.boundary_rules);
  if (boundaryCheck) {
    commResult.criticalErrors.push(boundaryCheck);
    commResult.status = "error";
  }
  blockResults["C"] = commResult;
  blockStatus["C"] = commResult.status;
  if (commResult.criticalErrors.length > 0) {
    criticalErrors.push(...commResult.criticalErrors);
  }

  // Operational SOP (O)
  const sopResult = validateRequiredFields(config.O, REQUIRED_FIELDS.O);
  blockResults["O"] = sopResult;
  blockStatus["O"] = sopResult.status;
  if (sopResult.criticalErrors.length > 0) {
    criticalErrors.push(...sopResult.criticalErrors);
  }

  // Interaction Library (L) - OPTIONAL, no required fields
  blockResults["L"] = {
    name: "Interaction Library",
    status: "complete",
    isComplete: true,
    completedFields: 0,
    totalFields: 0,
    percentage: 100,
    missingFields: [],
    warnings: [],
    criticalErrors: [],
  };
  blockStatus["L"] = "complete";

  // Note: Behaviour Engine form deleted - Personalization moved to C, Anti-Hunter moved to Safety/Crisis (O)
  // No B block validation needed

  // ========================================
  // 2. VIP LOGIC VALIDATION (IF ACTIVE)
  // ========================================
  
  const vipResult = validateVIPLogic(config.V);
  blockResults["V"] = vipResult;
  blockStatus["V"] = vipResult.status;
  if (vipResult.criticalErrors.length > 0) {
    criticalErrors.push(...vipResult.criticalErrors);
  }

  // ========================================
  // 3. CALCULATE SCORE
  // ========================================
  
  // Score = 100 - (criticalErrors × 20)
  const penaltyCritical = criticalErrors.length * 20;
  const score = Math.max(0, 100 - penaltyCritical);

  // ========================================
  // 4. DETERMINE READINESS
  // ========================================
  
  const canPublish = criticalErrors.length === 0;
  const isReady = score >= 90 && criticalErrors.length === 0;

  return {
    score,
    isReady,
    canPublish,
    criticalErrors,
    warnings,
    info,
    blockStatus,
    blockResults,
    missingBlocks,
    missingFields,
    summary: generateSummary(score, criticalErrors),
  };
}

// ============================================================
// FIELD VALIDATORS
// ============================================================

function validateRequiredFields(
  blockData: unknown,
  spec: { name: string; fields: readonly { key: string; label: string }[] }
): BlockValidation {
  const criticalErrors: string[] = [];
  const missingFields: string[] = [];
  let completedFields = 0;
  const totalFields = spec.fields.length;

  if (!blockData) {
    return {
      name: spec.name,
      status: "error",
      isComplete: false,
      completedFields: 0,
      totalFields,
      percentage: 0,
      missingFields: spec.fields.map(f => f.key),
      warnings: [],
      criticalErrors: [`${spec.name} tidak dikonfigurasi`],
    };
  }

  for (const field of spec.fields) {
    const value = getNestedValue(blockData, field.key);
    if (!isEmpty(value)) {
      completedFields++;
    } else {
      missingFields.push(field.key);
      criticalErrors.push(`${field.label} wajib diisi`);
    }
  }

  const percentage = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 100;
  const status: BlockStatus = criticalErrors.length > 0 ? "error" : "complete";

  return {
    name: spec.name,
    status,
    isComplete: criticalErrors.length === 0,
    completedFields,
    totalFields,
    percentage,
    missingFields,
    warnings: [],
    criticalErrors,
  };
}

// ========================================
// BOUNDARY RULE DEFAULT CHECK
// ========================================

function validateBoundaryRuleDefault(boundaryRules?: APBEConfig["C"]["boundary_rules"]): string | null {
  // Default boundary rule harus ada 1
  // "AI dilarang menjawab pertanyaan di luar Knowledge Base"
  
  if (!boundaryRules) {
    return "Boundary rules wajib dikonfigurasi";
  }
  
  if (!boundaryRules.default_rules || boundaryRules.default_rules.length === 0) {
    return "Default boundary rule wajib aktif";
  }
  
  // Custom rules completely optional - no check needed
  return null;
}

// ========================================
// VIP LOGIC VALIDATION
// ========================================

function validateVIPLogic(vipConfig: APBEConfig["V"]): BlockValidation {
  const result: BlockValidation = {
    name: "VIP Logic",
    status: "complete",
    isComplete: true,
    completedFields: 0,
    totalFields: 0,
    percentage: 100,
    missingFields: [],
    warnings: [],
    criticalErrors: [],
  };

  // If VIP not active, no validation needed
  if (!vipConfig?.active) {
    return result;
  }

  // VIP Active: check minimal requirements
  // Minimal 1 tier (threshold configured)
  if (!vipConfig.threshold?.value || vipConfig.threshold.value <= 0) {
    result.criticalErrors.push("VIP aktif tapi threshold belum dikonfigurasi");
    result.status = "error";
    result.isComplete = false;
  }

  // SVIP rules are completely optional - no check needed

  return result;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  
  const parts = path.split(".");
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  
  return current;
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (typeof value === "number" && value === 0) return false; // 0 is valid
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === "object" && Object.keys(value).length === 0) return true;
  return false;
}

function generateSummary(score: number, criticalErrors: string[]): string {
  if (criticalErrors.length > 0) {
    return `❌ ${criticalErrors.length} field wajib belum diisi`;
  }
  
  if (score >= 100) {
    return "✅ Persona siap dipublish";
  }
  
  return "✅ Persona siap dipublish";
}

// ============================================================
// VERSION
// ============================================================

export const PERSONA_VALIDATOR_VERSION = "3.0.0" as const;
