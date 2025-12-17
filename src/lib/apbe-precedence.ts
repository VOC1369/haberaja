/**
 * APBE v1.2 Crisis & VIP Utilities
 * 
 * Utility functions for crisis tone mapping and VIP modifier safety caps.
 * 
 * V1.1 Changes:
 * - Removed composeFinalTone() and ComposedTone interface (zombie code)
 * - Kept only essential utilities: clampValue, applyVIPModifierSafe, crisis mappings
 * 
 * CRISIS STYLE ↔ CRISIS TONE RELATIONSHIP:
 * - crisis_style (from archetype) defines the CHARACTER of crisis response
 * - O.crisis.tone (from config) defines the VOCAL delivery style
 */

import { CrisisStyle } from "./apbe-archetype-ruleset";

// ============================================================
// GLOBAL SAFETY CAP
// ============================================================

/**
 * Global clamp function for all numeric values
 * Prevents VIP modifiers or other adjustments from breaking UI scale
 */
export function clampValue(value: number, min: number = 1, max: number = 10): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Apply VIP modifiers with safety cap
 * Ensures final values never exceed UI scale bounds
 */
export function applyVIPModifierSafe(
  baseValue: number,
  modifier: number,
  min: number = 1,
  max: number = 10
): number {
  return clampValue(baseValue + modifier, min, max);
}

// ============================================================
// CRISIS STYLE ↔ TONE BIDIRECTIONAL MAPPING
// ============================================================

/**
 * Forward mapping: crisis_style (archetype) → recommended O.crisis.tone
 * Used when auto-suggesting crisis tone from archetype selection
 */
export const CRISIS_STYLE_TO_TONE: Record<CrisisStyle, string> = {
  authoritative_calm: "calm",
  empathetic_soft: "empathetic",
  solution_first: "solution",
  directive_solution: "solution",
  empathetic_direct: "empathetic",
  calm_direct: "calm",
  cool_direct: "calm",
  soothing_calm: "calm",
  reassuring_soft: "empathetic",
} as const;

/**
 * Reverse mapping: O.crisis.tone → fallback crisis_style(s) for template
 * Used when user manually sets O.crisis.tone and engine needs crisis_style for template
 * Returns array of compatible styles (first = primary fallback)
 */
export const TONE_TO_CRISIS_STYLE: Record<string, CrisisStyle[]> = {
  calm: ["authoritative_calm", "calm_direct", "cool_direct", "soothing_calm"],
  empathetic: ["empathetic_soft", "empathetic_direct", "reassuring_soft"],
  solution: ["solution_first", "directive_solution"],
  apologetic: ["empathetic_soft", "reassuring_soft"],
} as const;

/**
 * Get recommended crisis tone from archetype's crisis_style
 */
export function getRecommendedCrisisTone(crisisStyle: CrisisStyle): string {
  return CRISIS_STYLE_TO_TONE[crisisStyle] || "calm";
}

/**
 * Get fallback crisis_style from user-selected O.crisis.tone
 * Returns primary fallback style for template generation
 */
export function getCrisisStyleFromTone(tone: string): CrisisStyle {
  const styles = TONE_TO_CRISIS_STYLE[tone];
  return styles?.[0] || "authoritative_calm";
}

/**
 * Check if O.crisis.tone is optimal for the archetype's crisis_style
 * Returns { isOptimal, recommended, score } for advisory warning
 * 
 * Score: 1.0 = optimal match, 0.7 = acceptable mismatch, 0.4 = poor match
 */
export function validateCrisisToneForStyle(
  crisisStyle: CrisisStyle, 
  configuredTone: string
): { 
  isOptimal: boolean; 
  recommended: string; 
  score: number;
  message?: string;
} {
  const recommended = CRISIS_STYLE_TO_TONE[crisisStyle];
  const isOptimal = recommended === configuredTone;
  
  // Calculate confidence score
  let score = 1.0;
  if (!isOptimal) {
    // Check if tone is in compatible list for any related crisis style
    const compatibleStyles = TONE_TO_CRISIS_STYLE[configuredTone];
    if (compatibleStyles?.includes(crisisStyle)) {
      // Tone works but not optimal for this archetype
      score = 0.7;
    } else {
      // Tone is a poor match
      score = 0.4;
    }
  }
  
  if (!isOptimal) {
    const severity = score >= 0.7 ? "masih aman" : "kurang cocok";
    return {
      isOptimal: false,
      recommended,
      score,
      message: `Crisis tone alignment score: ${score}/1.0 — ${severity}. Disarankan: "${recommended}"`,
    };
  }
  
  return { isOptimal: true, recommended, score: 1.0 };
}
