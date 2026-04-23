/**
 * Wolfclaw Parser V0.9 — Type Contract (LOCKED)
 *
 * Source of truth for parser shape. Do NOT add, rename, or retype fields
 * without an explicit contract bump.
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
  calculation_basis: "loss" | "turnover" | "deposit" | null;
  calculation_value: number | null;
  turnover_requirement: number | null;
  claim_method: string | null;
  game_types: string[];
  game_types_human: string[] | null;
  game_exclusions: string[];
  game_exclusions_human: string[] | null;
  source_evidence_map: Record<string, string[]>;
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

export interface OperatorAnswer {
  field: string;
  radio_value: string;
  memo: string;
}
