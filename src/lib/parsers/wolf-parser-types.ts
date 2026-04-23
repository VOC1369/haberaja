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

// Re-export PreParser & CapturedLine types so consumers can import the
// extended ParserOutput shape from a single module without coupling to
// wolf-preparser-types directly.
export type {
  PreParserOutput,
  PreParserShape,
  PreParserParseability,
  PreParserConflictImpact,
  PreParserStructure,
  PreParserSignals,
  PreParserConflict,
  PreParserRoutingHints,
  CapturedLine,
  CapturedLineType,
  CapturedLineFields,
} from "./wolf-preparser-types";

import type {
  PreParserOutput,
  CapturedLine,
} from "./wolf-preparser-types";

/**
 * ParserOutput V0.9 — top-level shape.
 *
 * NOTE: schema_version stays "0.9" (Q1 decision B1). The two new sibling
 * fields (_preparser, captured_lines) are ADDITIVE metadata; existing
 * consumers that read only parsed_promo + gaps remain unaffected.
 *
 * Fallback semantics:
 * - _preparser = null → Parser treats input as flat (V0.9 behavior).
 * - captured_lines = []  → no row-level capture performed.
 */
export interface ParserOutput {
  schema_version: "0.9";
  parsed_promo: ParsedPromo;
  gaps: Gap[];
  _preparser: PreParserOutput | null;
  captured_lines: CapturedLine[];
}

export interface OperatorAnswer {
  field: string;
  radio_value: string;
  memo: string;
}
