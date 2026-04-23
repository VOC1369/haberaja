/**
 * Wolfclaw Parser V0.9 — Validator (DEFENSE LAYER)
 *
 * Enforces contract shape, drops foreign keys, and applies 7 guardrail rules.
 * NOT a parser. NOT an extractor. NOT an LLM layer.
 */

import type {
  Gap,
  GapType,
  OperatorAnswer,
  ParsedPromo,
  ParserOutput,
  ValueStatus,
} from "./wolf-parser-types";

// Re-export OperatorAnswer so downstream consumers can import from validator
// without coupling to the types file directly.
export type { OperatorAnswer };

// ---------------------------------------------------------------------------
// Allowed key sets
// ---------------------------------------------------------------------------

const ALLOWED_TOP_LEVEL_KEYS = new Set<string>([
  "schema_version",
  "parsed_promo",
  "gaps",
]);

const ALLOWED_PARSED_PROMO_KEYS = new Set<keyof ParsedPromo>([
  "promo_name",
  "promo_type",
  "client_id",
  "target_user",
  "valid_from",
  "valid_until",
  "platform_access",
  "geo_restriction",
  "min_deposit",
  "max_bonus",
  "max_bonus_unlimited",
  "has_turnover",
  "is_tiered",
  "reward_type_hint",
  "calculation_basis",
  "calculation_value",
  "turnover_requirement",
  "claim_method",
  "game_types",
  "game_types_human",
  "game_exclusions",
  "game_exclusions_human",
  "source_evidence_map",
  "ambiguity_flags",
  "parse_confidence",
  "value_status_map",
  "needs_operator_fill_map",
  "clean_text",
]);

const FORBIDDEN_DATE_LITERALS = new Set<string>([
  "hari_ini",
  "today",
  "now",
  "sekarang",
  "tidak_terbatas",
  "unlimited",
  "selamanya",
]);

const FORBIDDEN_EVIDENCE_PREFIXES_MODE1 = [
  "[OPERATOR_FILL",
  "operator:",
  "operator_confirmed:",
];

const OPERATOR_EVIDENCE_PREFIXES = ["operator_confirmed:", "operator_memo:"];

const CRITICAL_FIELDS_MODE1: Array<keyof ParsedPromo> = [
  "valid_from",
  "valid_until",
  "max_bonus",
  "max_bonus_unlimited",
  "has_turnover",
];

const VALID_GAP_TYPES = new Set<GapType>([
  "required_missing",
  "optional_missing",
  "ambiguous",
]);

const VALID_VALUE_STATUSES = new Set<ValueStatus>([
  "explicit",
  "ambiguous",
  "not_stated",
  "not_applicable",
]);

const VALID_CALC_BASIS = new Set<string>(["loss", "turnover", "deposit"]);

// ---------------------------------------------------------------------------
// Default empty V0.9 shape
// ---------------------------------------------------------------------------

function emptyParsedPromo(): ParsedPromo {
  return {
    promo_name: null,
    promo_type: null,
    client_id: null,
    target_user: null,
    valid_from: null,
    valid_until: null,
    platform_access: null,
    geo_restriction: null,
    min_deposit: null,
    max_bonus: null,
    max_bonus_unlimited: null,
    has_turnover: null,
    is_tiered: null,
    reward_type_hint: null,
    calculation_basis: null,
    calculation_value: null,
    turnover_requirement: null,
    claim_method: null,
    game_types: [],
    game_types_human: null,
    game_exclusions: [],
    game_exclusions_human: null,
    source_evidence_map: {},
    ambiguity_flags: [],
    parse_confidence: null,
    value_status_map: {},
    needs_operator_fill_map: {},
    clean_text: "",
  };
}

function emptyOutput(): ParserOutput {
  return {
    schema_version: "0.9",
    parsed_promo: emptyParsedPromo(),
    gaps: [],
  };
}

// ---------------------------------------------------------------------------
// Coercion helpers
// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function coerceString(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

function coerceNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function coerceBoolean(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  return null;
}

function coerceStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === "string") {
      const t = item.trim();
      if (t.length > 0) out.push(t);
    }
  }
  return out;
}

function coerceEvidenceMap(v: unknown): Record<string, string[]> {
  if (!isPlainObject(v)) return {};
  const out: Record<string, string[]> = {};
  for (const [k, val] of Object.entries(v)) {
    out[k] = coerceStringArray(val);
  }
  return out;
}

function coerceValueStatusMap(v: unknown): Record<string, ValueStatus> {
  if (!isPlainObject(v)) return {};
  const out: Record<string, ValueStatus> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "string" && VALID_VALUE_STATUSES.has(val as ValueStatus)) {
      out[k] = val as ValueStatus;
    }
  }
  return out;
}

function coerceBoolMap(v: unknown): Record<string, boolean> {
  if (!isPlainObject(v)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "boolean") out[k] = val;
  }
  return out;
}

function coerceGaps(v: unknown): Gap[] {
  if (!Array.isArray(v)) return [];
  const out: Gap[] = [];
  for (const item of v) {
    if (!isPlainObject(item)) continue;
    const field = coerceString(item.field);
    const gap_type = item.gap_type;
    const question = coerceString(item.question);
    const options = coerceStringArray(item.options);
    if (
      field &&
      typeof gap_type === "string" &&
      VALID_GAP_TYPES.has(gap_type as GapType) &&
      question
    ) {
      out.push({
        field,
        gap_type: gap_type as GapType,
        question,
        options,
      });
    }
  }
  return out;
}

function coerceCalcBasis(
  v: unknown,
): "loss" | "turnover" | "deposit" | null {
  if (typeof v === "string" && VALID_CALC_BASIS.has(v)) {
    return v as "loss" | "turnover" | "deposit";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rule 1 — Forbidden Date Literals
// ---------------------------------------------------------------------------

function applyRule1ForbiddenDates(p: ParsedPromo): void {
  for (const key of ["valid_from", "valid_until"] as const) {
    const v = p[key];
    if (typeof v === "string" && FORBIDDEN_DATE_LITERALS.has(v.toLowerCase())) {
      console.warn(
        `[wolf-parser-validator] Rule 1: forbidden literal "${v}" in ${key}, coerced to null`,
      );
      p[key] = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Rule 2 — Forbidden Evidence Prefix (Mode 1 only)
// ---------------------------------------------------------------------------

function applyRule2ForbiddenEvidence(p: ParsedPromo): void {
  const cleaned: Record<string, string[]> = {};
  for (const [field, evidence] of Object.entries(p.source_evidence_map)) {
    const filtered = evidence.filter((e) => {
      const bad = FORBIDDEN_EVIDENCE_PREFIXES_MODE1.some((pfx) =>
        e.startsWith(pfx),
      );
      if (bad) {
        console.warn(
          `[wolf-parser-validator] Rule 2: dropped operator-style evidence in mode=initial for "${field}": ${e.slice(0, 40)}…`,
        );
      }
      return !bad;
    });
    cleaned[field] = filtered;
  }
  p.source_evidence_map = cleaned;
}

// ---------------------------------------------------------------------------
// Rule 4 — Gaps Integrity (Mode 1)
// ---------------------------------------------------------------------------

function isFieldUnresolved(p: ParsedPromo, field: keyof ParsedPromo): boolean {
  const v = p[field];
  if (v === null || v === undefined) return true;
  const status = p.value_status_map[field as string];
  if (status === "ambiguous" || status === "not_stated") return true;
  return false;
}

function applyRule4GapsIntegrity(out: ParserOutput): void {
  if (out.gaps.length > 0) return;
  const unresolved = CRITICAL_FIELDS_MODE1.filter((f) =>
    isFieldUnresolved(out.parsed_promo, f),
  );
  if (unresolved.length > 0) {
    throw new Error(
      `gaps missing for critical unresolved fields: ${unresolved.join(", ")}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Rule 5 — Needs Operator Fill Consistency (Mode 2)
// ---------------------------------------------------------------------------

function applyRule5NeedsOperatorFill(out: ParserOutput): void {
  if (out.gaps.length > 0) return;
  const stillNeeded = Object.entries(out.parsed_promo.needs_operator_fill_map)
    .filter(([, v]) => v === true)
    .map(([k]) => k);
  if (stillNeeded.length > 0) {
    throw new Error(
      `gaps[] empty but needs_operator_fill_map still flags: ${stillNeeded.join(", ")}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Rule 7 — Mode 2 Evidence Guardrail (PARTIAL)
//
// TODO: Full cross-field/operator-answer evidence validation must be performed
// by wolf-parser.ts (Step 5), which has access to the OperatorAnswer[] context
// passed by the caller. This validator only sees the parser output payload, so
// it can only emit warnings — never throws — when a field appears resolved but
// no plausible evidence (literal or operator-prefixed) is recorded.
// ---------------------------------------------------------------------------

function applyRule7Mode2EvidenceGuardrail(out: ParserOutput): void {
  const p = out.parsed_promo;
  for (const field of ALLOWED_PARSED_PROMO_KEYS) {
    if (
      field === "source_evidence_map" ||
      field === "value_status_map" ||
      field === "needs_operator_fill_map" ||
      field === "ambiguity_flags" ||
      field === "game_types" ||
      field === "game_exclusions" ||
      field === "game_types_human" ||
      field === "game_exclusions_human" ||
      field === "clean_text" ||
      field === "parse_confidence"
    ) {
      continue;
    }
    const value = p[field];
    const status = p.value_status_map[field as string];
    const isResolved =
      value !== null && value !== undefined && status === "explicit";
    if (!isResolved) continue;
    const evidence = p.source_evidence_map[field as string] ?? [];
    if (evidence.length === 0) {
      console.warn(
        `[wolf-parser-validator] Rule 7: field "${String(field)}" resolved in mode=refine but no evidence recorded`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Rule 8 — Human Field Shape Check
//
// game_types_human and game_exclusions_human must be string[] | null.
// If shape is invalid (anything else), defensively coerce to null.
// ---------------------------------------------------------------------------

function applyRule8HumanFieldShape(p: ParsedPromo): void {
  for (const key of ["game_types_human", "game_exclusions_human"] as const) {
    const v = p[key];
    if (v === null) continue;
    if (Array.isArray(v) && v.every((item) => typeof item === "string")) {
      continue;
    }
    console.warn(
      `[wolf-parser-validator] Rule 8: invalid shape for ${key}, coerced to null`,
    );
    p[key] = null;
  }
}

// ---------------------------------------------------------------------------
// Rule 3 + 6 — Foreign key drop & turnover_requirement scalar
// (Both applied during normalization in normalizeParsedPromo)
// ---------------------------------------------------------------------------

function normalizeParsedPromo(raw: unknown): ParsedPromo {
  const out = emptyParsedPromo();
  if (!isPlainObject(raw)) return out;

  // Rule 3: only copy whitelisted keys; everything else dropped silently.
  for (const key of ALLOWED_PARSED_PROMO_KEYS) {
    if (!(key in raw)) continue;
    const v = (raw as Record<string, unknown>)[key];
    switch (key) {
      case "promo_name":
      case "promo_type":
      case "client_id":
      case "target_user":
      case "valid_from":
      case "valid_until":
      case "platform_access":
      case "geo_restriction":
      case "reward_type_hint":
      case "claim_method":
        out[key] = coerceString(v);
        break;
      case "min_deposit":
      case "max_bonus":
      case "calculation_value":
      case "parse_confidence":
        out[key] = coerceNumber(v);
        break;
      case "turnover_requirement":
        // Rule 6: scalar number | null only.
        out.turnover_requirement = coerceNumber(v);
        break;
      case "max_bonus_unlimited":
      case "has_turnover":
      case "is_tiered":
        out[key] = coerceBoolean(v);
        break;
      case "calculation_basis":
        out.calculation_basis = coerceCalcBasis(v);
        break;
      case "game_types":
      case "game_exclusions":
      case "ambiguity_flags":
        out[key] = coerceStringArray(v);
        break;
      case "source_evidence_map":
        out.source_evidence_map = coerceEvidenceMap(v);
        break;
      case "value_status_map":
        out.value_status_map = coerceValueStatusMap(v);
        break;
      case "needs_operator_fill_map":
        out.needs_operator_fill_map = coerceBoolMap(v);
        break;
      case "clean_text":
        out.clean_text = typeof v === "string" ? v : "";
        break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function validateAndNormalize(
  raw: unknown,
  mode: "initial" | "refine",
): ParserOutput {
  const out = emptyOutput();

  if (isPlainObject(raw)) {
    // Rule 3 (top-level): drop foreign top-level keys silently.
    out.parsed_promo = normalizeParsedPromo(raw.parsed_promo);
    out.gaps = coerceGaps(raw.gaps);
    // schema_version is always coerced to "0.9" — never trust caller.
  }

  // Rule 1
  applyRule1ForbiddenDates(out.parsed_promo);

  // Rule 2 — only in initial mode
  if (mode === "initial") {
    applyRule2ForbiddenEvidence(out.parsed_promo);
  }

  // Rule 4 — initial only
  if (mode === "initial") {
    applyRule4GapsIntegrity(out);
  }

  // Rule 5 — refine only
  if (mode === "refine") {
    applyRule5NeedsOperatorFill(out);
  }

  // Rule 7 — refine only, partial (warn only)
  if (mode === "refine") {
    applyRule7Mode2EvidenceGuardrail(out);
  }

  return out;
}
