/**
 * Wolfclaw PreParser V1.0 — Type Contract (LOCKED)
 *
 * Structural reasoning layer. Runs BEFORE Parser.
 * Detects shape (flat / with_lines / multi / invalid), parseability,
 * structural conflicts, and emits routing hints for Parser.
 *
 * PreParser does NOT extract business fields, does NOT interpret
 * variant/tier semantics, does NOT emit ParsedPromo.
 *
 * Source of truth for PreParser shape. Do NOT add, rename, or retype
 * fields without an explicit contract bump.
 */

export type PreParserShape =
  | "single_flat"
  | "single_with_lines"
  | "multi_independent"
  | "invalid";

export type PreParserParseability =
  | "clean"
  | "parseable_with_conflicts"
  | "partial"
  | "reject";

export type PreParserConflictImpact =
  | "blocks_parse"
  | "degrades_accuracy"
  | "cosmetic";

export interface PreParserStructure {
  unit_count: number;
  line_count: number;
}

export interface PreParserSignals {
  has_repeated_lines: boolean;
  has_shared_rules: boolean;
  rows_depend_on_parent: boolean;
  mutually_exclusive_lines: boolean;
}

export interface PreParserConflict {
  type: string;
  impact: PreParserConflictImpact;
  source_refs: string[];
  detail: string;
}

export interface PreParserRoutingHints {
  parse_parent: boolean;
  capture_lines: boolean;
  needs_review: boolean;
}

export interface PreParserOutput {
  shape: PreParserShape;
  parseability: PreParserParseability;
  classification_confidence: number | null;
  structure: PreParserStructure;
  signals: PreParserSignals;
  conflicts: PreParserConflict[];
  routing_hints: PreParserRoutingHints;
  reasoning_summary: string;
}

// ---------------------------------------------------------------------------
// CapturedLine — emitted by Parser (NOT by PreParser) when
// _preparser.routing_hints.capture_lines = true.
// Lives in wolf-parser-types.ts as ParserOutput.captured_lines[].
// Re-exported here for downstream convenience.
// ---------------------------------------------------------------------------

export type CapturedLineType =
  | "table_row"
  | "list_item"
  | "threshold"
  | "redeem_option";

export interface CapturedLineFields {
  category: string | null;
  product_scope: string | null;
  min_deposit: number | null;
  max_bonus: number | null;
  turnover_requirement: number | null;
  calculation_value: number | null;
  reward_type_hint: string | null;
}

export interface CapturedLine {
  line_id: string;
  line_type: CapturedLineType;
  label: string;
  raw_fragment: string;
  fields: CapturedLineFields;
  source_evidence_map: Record<string, string>;
  ambiguity_flags: string[];
}
