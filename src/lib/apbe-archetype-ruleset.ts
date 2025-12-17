/**
 * APBE ARCHETYPE RULESET v1.0
 * 
 * 12 archetypes × 9 parameters per archetype
 * 
 * Digunakan untuk:
 * ✔ Auto-suggestion APBE (saat user pilih archetype)
 * ✔ Konsistensi validator (cross-check tone/humor/formality)
 * ✔ Tone/style sanity-check
 * ✔ Precedence adjustment (crisis override)
 * 
 * LOCKED - Values match APBE_ENUMS v1.0
 */

import { 
  BrandArchetype, 
  AgentTone, 
  HumorUsage 
} from "./apbe-enums";

// PersuasionMode type removed - using string[] for flexibility

// ============================================================
// TYPES
// ============================================================

export interface ArchetypeRule {
  /** Human-readable label */
  label: string;
  /** Default tone when archetype selected */
  default_tone: AgentTone;
  /** Valid tone values for this archetype */
  tone_range: AgentTone[];
  /** Humor usage level */
  humor: HumorUsage;
  /** Whether dialect (slang) is allowed */
  dialect: boolean;
  /** Crisis response style for precedence engine */
  crisis_style: CrisisStyle;
}

export type CrisisStyle = 
  | "authoritative_calm"
  | "empathetic_soft"
  | "solution_first"
  | "directive_solution"
  | "empathetic_direct"
  | "calm_direct"
  | "cool_direct"
  | "soothing_calm"
  | "reassuring_soft";

// ============================================================
// ARCHETYPE RULESET v1.0 (LOCKED)
// ============================================================

export const ARCHETYPE_RULESET: Record<BrandArchetype, ArchetypeRule> = {
  ruler: {
    label: "Premium & authoritative",
    default_tone: "elite_formal",
    tone_range: ["elite_formal", "strict_efficient"],
    humor: "none",
    dialect: false,
    crisis_style: "authoritative_calm",
  },

  jester: {
    label: "Playful & fun",
    default_tone: "cheerful_playful",
    tone_range: ["cheerful_playful"],
    humor: "frequent",
    dialect: true,
    crisis_style: "empathetic_soft",
  },

  sage: {
    label: "Wise & knowledgeable",
    default_tone: "gentle_supportive",
    tone_range: ["gentle_supportive", "soft_warm"],
    humor: "subtle",
    dialect: false,
    crisis_style: "solution_first",
  },

  hero: {
    label: "Bold & confident",
    default_tone: "strict_efficient",
    tone_range: ["strict_efficient", "neutral"],
    humor: "subtle",
    dialect: false,
    crisis_style: "directive_solution",
  },

  caregiver: {
    label: "Caring & supportive",
    default_tone: "soft_warm",
    tone_range: ["soft_warm", "gentle_supportive"],
    humor: "subtle",
    dialect: true,
    crisis_style: "empathetic_soft",
  },

  everyman: {
    label: "Relatable & friendly",
    default_tone: "neutral",
    tone_range: ["neutral", "soft_warm"],
    humor: "moderate",
    dialect: true,
    crisis_style: "empathetic_direct",
  },

  creator: {
    label: "Innovative & creative",
    default_tone: "gentle_supportive",
    tone_range: ["gentle_supportive", "soft_warm"],
    humor: "subtle",
    dialect: false,
    crisis_style: "solution_first",
  },

  explorer: {
    label: "Adventurous & free",
    default_tone: "cheerful_playful",
    tone_range: ["cheerful_playful", "neutral"],
    humor: "moderate",
    dialect: true,
    crisis_style: "calm_direct",
  },

  rebel: {
    label: "Edgy & unconventional",
    default_tone: "strict_efficient",
    tone_range: ["strict_efficient", "neutral"],
    humor: "subtle",
    dialect: true,
    crisis_style: "cool_direct",
  },

  lover: {
    label: "Passionate & intimate",
    default_tone: "soft_warm",
    tone_range: ["soft_warm", "gentle_supportive"],
    humor: "subtle",
    dialect: true,
    crisis_style: "soothing_calm",
  },

  magician: {
    label: "Transformative & visionary",
    default_tone: "gentle_supportive",
    tone_range: ["gentle_supportive", "soft_warm"],
    humor: "subtle",
    dialect: false,
    crisis_style: "solution_first",
  },

  innocent: {
    label: "Pure, optimistic & simple",
    default_tone: "cheerful_playful",
    tone_range: ["cheerful_playful", "soft_warm"],
    humor: "subtle",
    dialect: true,
    crisis_style: "reassuring_soft",
  },
} as const;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get archetype rule by archetype value
 */
export function getArchetypeRule(archetype: BrandArchetype): ArchetypeRule {
  return ARCHETYPE_RULESET[archetype];
}

/**
 * Get default form values when archetype is selected
 * Used for auto-suggestion in forms
 */
export function getDefaultsForArchetype(archetype: BrandArchetype): {
  tone: AgentTone;
  humor_usage: HumorUsage;
  dialect_allowed: boolean;
} {
  const rule = ARCHETYPE_RULESET[archetype];
  
  return {
    tone: rule.default_tone,
    humor_usage: rule.humor,
    dialect_allowed: rule.dialect,
  };
}


/**
 * Validate if tone matches archetype
 */
export function isToneValidForArchetype(archetype: BrandArchetype, tone: AgentTone): boolean {
  const rule = ARCHETYPE_RULESET[archetype];
  return rule.tone_range.includes(tone);
}

/**
 * Validate if humor matches archetype
 */
export function isHumorValidForArchetype(archetype: BrandArchetype, humor: HumorUsage): boolean {
  const rule = ARCHETYPE_RULESET[archetype];
  // Allow exact match or less (e.g., archetype says "moderate" but user picks "subtle" = OK)
  const humorHierarchy: HumorUsage[] = ["none", "subtle", "moderate", "frequent"];
  const ruleIndex = humorHierarchy.indexOf(rule.humor);
  const userIndex = humorHierarchy.indexOf(humor);
  return userIndex <= ruleIndex;
}

/**
 * Get crisis style for archetype (used in precedence engine)
 */
export function getCrisisStyleForArchetype(archetype: BrandArchetype): CrisisStyle {
  return ARCHETYPE_RULESET[archetype].crisis_style;
}

/**
 * Get all validation issues for archetype consistency
 * Returns array of issues (empty = all valid)
 */
export function validateArchetypeConsistency(
  archetype: BrandArchetype,
  values: {
    tone?: AgentTone;
    humor_usage?: HumorUsage;
    dialect_allowed?: boolean;
  }
): ArchetypeValidationIssue[] {
  const issues: ArchetypeValidationIssue[] = [];
  const rule = ARCHETYPE_RULESET[archetype];

  // Validate tone
  if (values.tone && !rule.tone_range.includes(values.tone)) {
    issues.push({
      field: "tone",
      severity: "error",
      message: `Tone "${values.tone}" tidak cocok dengan archetype "${archetype}". Disarankan: ${rule.tone_range.join(" atau ")}`,
      suggested: rule.default_tone,
    });
  }

  // Validate humor
  if (values.humor_usage && !isHumorValidForArchetype(archetype, values.humor_usage)) {
    issues.push({
      field: "humor_usage",
      severity: "error",
      message: `Humor "${values.humor_usage}" terlalu tinggi untuk archetype "${archetype}". Maksimum: ${rule.humor}`,
      suggested: rule.humor,
    });
  }

  // Validate dialect
  if (values.dialect_allowed !== undefined && values.dialect_allowed !== rule.dialect) {
    if (values.dialect_allowed && !rule.dialect) {
      issues.push({
        field: "dialect_allowed",
        severity: "warning",
        message: `Dialect/slang tidak disarankan untuk archetype "${archetype}" yang formal`,
        suggested: false,
      });
    }
  }

  return issues;
}

export interface ArchetypeValidationIssue {
  field: string;
  severity: "error" | "warning";
  message: string;
  suggested: string | number | boolean;
}

// ============================================================
// DISPLAY LABELS FOR CRISIS STYLE
// ============================================================

export const CRISIS_STYLE_LABELS: Record<CrisisStyle, string> = {
  authoritative_calm: "Tenang & Berwibawa",
  empathetic_soft: "Empati & Lembut",
  solution_first: "Fokus Solusi",
  directive_solution: "Solusi Terarah",
  empathetic_direct: "Empati Langsung",
  calm_direct: "Tenang & Langsung",
  cool_direct: "Cool & Langsung",
  soothing_calm: "Menenangkan",
  reassuring_soft: "Meyakinkan & Lembut",
};

// ============================================================
// VERSION & TRACKING (V1.0.1)
// ============================================================

/**
 * Current archetype ruleset version
 * Used for version tracking in APBEConfig._meta.archetype_ruleset_version
 * 
 * When this version changes, APBE can prompt users:
 * "Archetype updated from v1.0.0 → v1.0.1. Ingin apply update ke persona ini?"
 */
export const ARCHETYPE_RULESET_VERSION = "1.2.0" as const;

/**
 * Check if persona's archetype ruleset needs update
 */
export function needsArchetypeUpdate(personaVersion: string): boolean {
  return personaVersion !== ARCHETYPE_RULESET_VERSION;
}

/**
 * Get version change summary for user notification
 */
export function getVersionChangeSummary(fromVersion: string): string | null {
  if (fromVersion === ARCHETYPE_RULESET_VERSION) return null;
  
  // Version change notes
  const changes: Record<string, string> = {
    "1.0.0": "v1.0.1: Warmth range extended untuk premium brands, crisis confidence scoring ditambahkan",
    "1.0.1": "v1.1.0: Region modifiers untuk multi-market support, clampValue() terintegrasi ke composeFinalTone()",
  };
  
  return changes[fromVersion] || `Update dari ${fromVersion} ke ${ARCHETYPE_RULESET_VERSION}`;
}

// ============================================================
// REGION SUPPORT (V1.2 - Simplified)
// ============================================================

/**
 * Apply region modifier to archetype defaults (simplified - no numeric adjustments)
 * Region-specific modifications now handled at communication level, not archetype level
 * 
 * @param defaults - Base defaults from getDefaultsForArchetype()
 * @param _region - Target market region (kept for API compatibility)
 * @returns Defaults unchanged (region-specific logic moved elsewhere)
 */
export function applyRegionModifier(
  defaults: ReturnType<typeof getDefaultsForArchetype>,
  _region: string = "indonesia"
): ReturnType<typeof getDefaultsForArchetype> {
  // Region-specific modifications removed with formality/warmth fields
  // Return defaults unchanged
  return { ...defaults };
}

/**
 * Get available regions for dropdown selection
 */
export function getAvailableRegions(): Array<{ value: string; label: string }> {
  return [
    { value: "indonesia", label: "Indonesia" },
    { value: "thailand", label: "Thailand" },
    { value: "philippines", label: "Philippines" },
    { value: "malaysia", label: "Malaysia" },
    { value: "vietnam", label: "Vietnam" },
    { value: "india", label: "India" },
    { value: "cambodia", label: "Cambodia" },
  ];
}
