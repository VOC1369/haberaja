/**
 * PR-22.x — Condition Summary & Question Gating helper (PRESENTATION + GATING).
 *
 * Purpose:
 *   When `trigger_engine.trigger_rule_block.conditions[]` is already a list
 *   of structured, well-shaped conditions ({field, operator, value}), the
 *   admin does NOT need to be asked "Promo ini bisa diklaim dalam kondisi
 *   apa?" — the data already answers that question.
 *
 *   This helper provides:
 *     - `isStructuredCondition(c)` — shape check (field+operator+value present)
 *     - `hasResolvedStructuredConditions(rec)` — true when at least one
 *       condition exists AND ALL conditions are structurally valid
 *     - `buildConditionSummary(conditions)` — display-only, Bahasa Indonesia
 *       summary of structured conditions
 *
 * Strict rules (locked):
 *   - General logic only. NO per-promo branching.
 *   - NO regex / keyword matching over raw promo text.
 *   - NO JSON mutation.
 *   - Pure functions, no side effects.
 *
 * Used by:
 *   - `f3-compliance-adapter` to suppress the rule_type contradiction
 *     question when structured conditions already make the trigger explicit.
 *   - UI may also use `buildConditionSummary` as a read-only summary line.
 */

import type { PkV10Record } from "../schema/pk-v10";
import { humanizeCondition } from "./humanize-issue";

export function isStructuredCondition(cond: unknown): boolean {
  if (!cond || typeof cond !== "object") return false;
  const o = cond as Record<string, unknown>;
  const hasField = typeof o.field === "string" && o.field.trim().length > 0;
  const hasOperator =
    typeof o.operator === "string" && o.operator.trim().length > 0;
  const hasValue = o.value !== undefined && o.value !== null && o.value !== "";
  return hasField && hasOperator && hasValue;
}

/**
 * Returns true when:
 *   - `trigger_engine.trigger_rule_block.conditions` exists,
 *   - is a non-empty array,
 *   - and EVERY element is a structurally valid condition object.
 *
 * String-only conditions (raw text) do NOT count as resolved — they still
 * need admin classification.
 */
export function hasResolvedStructuredConditions(
  rec: PkV10Record | null,
): boolean {
  if (!rec) return false;
  const conditions = rec.trigger_engine?.trigger_rule_block?.conditions;
  if (!Array.isArray(conditions) || conditions.length === 0) return false;
  return conditions.every(isStructuredCondition);
}

/**
 * Display-only Bahasa Indonesia summary of a list of structured conditions.
 * Falls back gracefully via `humanizeCondition` for unknown shapes.
 */
export function buildConditionSummary(conditions: unknown): string {
  if (!Array.isArray(conditions) || conditions.length === 0) return "";
  return conditions
    .map((c) => humanizeCondition(c))
    .filter((s) => s && s.length > 0)
    .join("; ");
}
