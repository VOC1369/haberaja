/**
 * Wolf Parser V0.9 — Type Definitions
 * Source: liveboard_arsitektur_v09_locked.md (§6.3.1, §9.8.1)
 *
 * RULES:
 * - Shape PERSIS sesuai contract V0.9. Tidak ada field tambahan.
 * - Tidak ada naming kreatif. Tidak ada nesting baru.
 * - Field scalar tetap scalar. Tidak ada object liar.
 */

export type GapType = "required_missing" | "optional_missing" | "ambiguous";

export type ValueStatus =
  | "explicit"
  | "ambiguous"
  | "not_stated"
  | "not_applicable";

export interface Gap {
  field: string;
  gap_type: GapType;
  question: string;
  options: string[];
}

/**
 * ParsedPromo — exact V0.9 shape.
 * Semua field scalar = primitive | null. Tidak boleh diganti object.
 */
export interface ParsedPromo {
  promo_name: string | null;
  promo_type: string | null;
  client_id: string | null;
  target_user: string | null;
  valid_from: string | null;
  valid_until: string | null;
  platform_access: string | null;
  geo_restriction: string | null;
  min_deposit: number | null;
  max_bonus: number | null;
  max_bonus_unlimited: boolean | null;
  has_turnover: boolean | null;
  is_tiered: boolean | null;
  reward_type_hint: string | null;
  calculation_basis: string | null;
  calculation_value: number | null;
  turnover_requirement: number | null;
  claim_method: string | null;
  game_types: string[];
  game_exclusions: string[];
  source_evidence_map: Record<string, string>;
  ambiguity_flags: string[];
  parse_confidence: number | null;
  value_status_map: Record<string, ValueStatus>;
  needs_operator_fill_map: Record<string, boolean>;
  clean_text: string;
}

export interface ParserOutput {
  schema_version: "0.9";
  parsed_promo: ParsedPromo;
  gaps: Gap[];
}

/**
 * Operator answer to a single gap.
 * Value is always string from the form; engine coerces per field type.
 */
export interface OperatorAnswer {
  field: string;
  value: string;
}
