/**
 * Wolf Parser V0.9 — Strict Validator
 *
 * Tugas:
 * - Pastikan output LLM punya shape PERSIS V0.9.
 * - Buang field asing.
 * - Isi default null/[]/{} untuk field yang hilang.
 * - Validasi enum gap_type & value_status.
 */
import type {
  ParserOutput,
  ParsedPromo,
  Gap,
  GapType,
  ValueStatus,
} from "./wolf-parser-types";

const GAP_TYPES: ReadonlySet<GapType> = new Set([
  "required_missing",
  "optional_missing",
  "ambiguous",
]);

const VALUE_STATUSES: ReadonlySet<ValueStatus> = new Set([
  "explicit",
  "ambiguous",
  "not_stated",
  "not_applicable",
]);

const PARSED_PROMO_KEYS: Array<keyof ParsedPromo> = [
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
  "game_exclusions",
  "source_evidence_map",
  "ambiguity_flags",
  "parse_confidence",
  "value_status_map",
  "needs_operator_fill_map",
  "clean_text",
];

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
    game_exclusions: [],
    source_evidence_map: {},
    ambiguity_flags: [],
    parse_confidence: null,
    value_status_map: {},
    needs_operator_fill_map: {},
    clean_text: "",
  };
}

function asStringOrNull(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return typeof v === "string" ? v : String(v);
}

function asNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function asBoolOrNull(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string" && x.length > 0) as string[];
}

function asStringMap(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string" && val.length > 0) out[k] = val;
  }
  return out;
}

function asValueStatusMap(v: unknown): Record<string, ValueStatus> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, ValueStatus> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string" && VALUE_STATUSES.has(val as ValueStatus)) {
      out[k] = val as ValueStatus;
    }
  }
  return out;
}

function asBoolMap(v: unknown): Record<string, boolean> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "boolean") out[k] = val;
  }
  return out;
}

function normalizeGap(raw: unknown): Gap | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const field = typeof r.field === "string" ? r.field : "";
  const gap_type = typeof r.gap_type === "string" ? r.gap_type : "";
  const question = typeof r.question === "string" ? r.question : "";
  const options = asStringArray(r.options);
  if (!field || !GAP_TYPES.has(gap_type as GapType) || !question) return null;
  return { field, gap_type: gap_type as GapType, question, options };
}

function normalizeParsedPromo(raw: unknown): ParsedPromo {
  const out = emptyParsedPromo();
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;

  out.promo_name = asStringOrNull(r.promo_name);
  out.promo_type = asStringOrNull(r.promo_type);
  out.client_id = asStringOrNull(r.client_id);
  out.target_user = asStringOrNull(r.target_user);
  out.valid_from = asStringOrNull(r.valid_from);
  out.valid_until = asStringOrNull(r.valid_until);
  out.platform_access = asStringOrNull(r.platform_access);
  out.geo_restriction = asStringOrNull(r.geo_restriction);
  out.min_deposit = asNumberOrNull(r.min_deposit);
  out.max_bonus = asNumberOrNull(r.max_bonus);
  out.max_bonus_unlimited = asBoolOrNull(r.max_bonus_unlimited);
  out.has_turnover = asBoolOrNull(r.has_turnover);
  out.is_tiered = asBoolOrNull(r.is_tiered);
  out.reward_type_hint = asStringOrNull(r.reward_type_hint);
  out.calculation_basis = asStringOrNull(r.calculation_basis);
  out.calculation_value = asNumberOrNull(r.calculation_value);
  out.turnover_requirement = asNumberOrNull(r.turnover_requirement);
  out.claim_method = asStringOrNull(r.claim_method);
  out.game_types = asStringArray(r.game_types);
  out.game_exclusions = asStringArray(r.game_exclusions);
  out.source_evidence_map = asStringMap(r.source_evidence_map);
  out.ambiguity_flags = asStringArray(r.ambiguity_flags);
  out.parse_confidence = asNumberOrNull(r.parse_confidence);
  out.value_status_map = asValueStatusMap(r.value_status_map);
  out.needs_operator_fill_map = asBoolMap(r.needs_operator_fill_map);
  out.clean_text =
    typeof r.clean_text === "string" ? r.clean_text : "";

  return out;
}

/**
 * Normalize ANY raw object to strict V0.9 ParserOutput.
 * Drops foreign top-level keys. Drops foreign keys inside parsed_promo.
 */
export function validateAndNormalize(raw: unknown): ParserOutput {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const parsed_promo = normalizeParsedPromo(r.parsed_promo);

  // Defensive: ensure exactly the documented keys exist.
  const finalParsed: ParsedPromo = emptyParsedPromo();
  for (const key of PARSED_PROMO_KEYS) {
    (finalParsed as any)[key] = (parsed_promo as any)[key];
  }

  const gapsRaw = Array.isArray(r.gaps) ? r.gaps : [];
  const gaps = gapsRaw
    .map(normalizeGap)
    .filter((g): g is Gap => g !== null);

  return {
    schema_version: "0.9",
    parsed_promo: finalParsed,
    gaps,
  };
}
