/**
 * Wolfclaw Parser — STEP B Smoke: PreParser integration + captured_lines
 *
 * Scope:
 *   - Category 2: validateAndNormalize accepts _preparser input
 *   - Category 3: captured_lines shape validation (Rule 10)
 *   - Category 4: foreign top-level keys drop preserved
 *   - Category 5: regression — V0.9 default empty shape unchanged
 *
 * Does NOT call the LLM — only exercises validator paths.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateAndNormalize } from "@/lib/parsers/wolf-parser-validator";
import type { ParserOutput } from "@/lib/parsers/wolf-parser-types";

function resolvedPromo(overrides: Record<string, unknown> = {}) {
  return {
    parsed_promo: {
      valid_from: "2026-01-01",
      valid_until: "2026-12-31",
      max_bonus: 100,
      max_bonus_unlimited: false,
      has_turnover: true,
      value_status_map: {
        valid_from: "explicit",
        valid_until: "explicit",
        max_bonus: "explicit",
        max_bonus_unlimited: "explicit",
        has_turnover: "explicit",
      },
      ...overrides,
    },
    gaps: [],
  };
}

function validPreParserPayload() {
  return {
    shape: "single_with_lines",
    parseability: "parseable_with_conflicts",
    classification_confidence: 0.9,
    structure: { unit_count: 1, line_count: 5 },
    signals: {
      has_repeated_lines: true,
      has_shared_rules: true,
      rows_depend_on_parent: true,
      mutually_exclusive_lines: false,
    },
    conflicts: [
      {
        type: "tnc_vs_row_contradiction",
        impact: "degrades_accuracy",
        source_refs: ["T&C 3"],
        detail: "Slot-only vs Casino row",
      },
    ],
    routing_hints: {
      parse_parent: true,
      capture_lines: true,
      needs_review: true,
    },
    reasoning_summary: "Welcome bonus 5 varian — parent + lines.",
  };
}

function validCapturedLine(id: string) {
  return {
    line_id: id,
    line_type: "table_row",
    label: `Welcome ${id}`,
    raw_fragment: `Welcome ${id} Casino | Min 50K | Max 5M | TO 10x`,
    fields: {
      category: "casino",
      product_scope: "casino",
      min_deposit: 50000,
      max_bonus: 5000000,
      turnover_requirement: 10,
      calculation_value: 50,
      reward_type_hint: "percentage",
    },
    source_evidence_map: {
      min_deposit: "Min 50K",
      max_bonus: "Max 5M",
    },
    ambiguity_flags: [],
  };
}

describe("Parser smoke — Category 2: ParserOutput accepts _preparser input", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warnSpy.mockRestore());

  it("S2.1 valid _preparser preserved in output (mode=initial)", () => {
    const out = validateAndNormalize(
      { ...resolvedPromo(), _preparser: validPreParserPayload() },
      "initial",
    );
    expect(out._preparser).not.toBeNull();
    expect(out._preparser!.shape).toBe("single_with_lines");
    expect(out._preparser!.routing_hints.capture_lines).toBe(true);
    expect(out._preparser!.conflicts.length).toBe(1);
  });

  it("S2.2 valid _preparser preserved in output (mode=refine)", () => {
    const out = validateAndNormalize(
      { ...resolvedPromo(), _preparser: validPreParserPayload() },
      "refine",
    );
    expect(out._preparser).not.toBeNull();
    expect(out._preparser!.parseability).toBe("parseable_with_conflicts");
  });

  it("S2.3 missing _preparser → null (no throw)", () => {
    const out = validateAndNormalize(resolvedPromo(), "initial");
    expect(out._preparser).toBeNull();
  });

  it("S2.4 invalid _preparser → null + warn (no throw)", () => {
    const out = validateAndNormalize(
      { ...resolvedPromo(), _preparser: { shape: "bogus", parseability: "x" } },
      "initial",
    );
    expect(out._preparser).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("S2.5 _preparser explicitly null → output null (no warn)", () => {
    const out = validateAndNormalize(
      { ...resolvedPromo(), _preparser: null },
      "initial",
    );
    expect(out._preparser).toBeNull();
  });
});

describe("Parser smoke — Category 3: captured_lines Rule 10 shape validation", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warnSpy.mockRestore());

  it("S3.1 5 valid captured_lines all preserved", () => {
    const lines = ["line_1", "line_2", "line_3", "line_4", "line_5"].map(
      validCapturedLine,
    );
    const out = validateAndNormalize(
      { ...resolvedPromo(), captured_lines: lines },
      "initial",
    );
    expect(out.captured_lines.length).toBe(5);
    expect(out.captured_lines[0].line_id).toBe("line_1");
    expect(out.captured_lines[0].fields.max_bonus).toBe(5000000);
  });

  it("S3.2 invalid line_type drops that item only", () => {
    const lines = [
      validCapturedLine("line_1"),
      { ...validCapturedLine("line_2"), line_type: "row" },
      validCapturedLine("line_3"),
    ];
    const out = validateAndNormalize(
      { ...resolvedPromo(), captured_lines: lines },
      "initial",
    );
    expect(out.captured_lines.length).toBe(2);
    expect(out.captured_lines.map((l) => l.line_id)).toEqual([
      "line_1",
      "line_3",
    ]);
  });

  it("S3.3 missing line_id drops that item", () => {
    const lines = [
      validCapturedLine("line_1"),
      { ...validCapturedLine(""), line_id: "" },
    ];
    const out = validateAndNormalize(
      { ...resolvedPromo(), captured_lines: lines },
      "initial",
    );
    expect(out.captured_lines.length).toBe(1);
  });

  it("S3.4 captured_lines not an array → coerce to [] + warn", () => {
    const out = validateAndNormalize(
      { ...resolvedPromo(), captured_lines: { not: "array" } },
      "initial",
    );
    expect(out.captured_lines).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("S3.5 captured_lines missing → default []", () => {
    const out = validateAndNormalize(resolvedPromo(), "initial");
    expect(out.captured_lines).toEqual([]);
  });

  it("S3.6 fields with missing keys defaults to null per key", () => {
    const partialLine = {
      ...validCapturedLine("line_1"),
      fields: { category: "casino" }, // missing 6 keys
    };
    const out = validateAndNormalize(
      { ...resolvedPromo(), captured_lines: [partialLine] },
      "initial",
    );
    expect(out.captured_lines.length).toBe(1);
    expect(out.captured_lines[0].fields.category).toBe("casino");
    expect(out.captured_lines[0].fields.min_deposit).toBeNull();
    expect(out.captured_lines[0].fields.max_bonus).toBeNull();
    expect(out.captured_lines[0].fields.reward_type_hint).toBeNull();
  });

  it("S3.7 source_evidence_map non-string values dropped", () => {
    const line = {
      ...validCapturedLine("line_1"),
      source_evidence_map: {
        min_deposit: "valid string",
        max_bonus: 12345,
        bad: null,
      },
    };
    const out = validateAndNormalize(
      { ...resolvedPromo(), captured_lines: [line] },
      "initial",
    );
    expect(out.captured_lines[0].source_evidence_map.min_deposit).toBe(
      "valid string",
    );
    expect(out.captured_lines[0].source_evidence_map.max_bonus).toBeUndefined();
    expect(out.captured_lines[0].source_evidence_map.bad).toBeUndefined();
  });

  it("S3.8 captured_line item not an object dropped", () => {
    const out = validateAndNormalize(
      {
        ...resolvedPromo(),
        captured_lines: [validCapturedLine("line_1"), "string", null, 42],
      },
      "initial",
    );
    expect(out.captured_lines.length).toBe(1);
  });

  it("S3.9 all 4 line_type enums accepted", () => {
    const types = ["table_row", "list_item", "threshold", "redeem_option"] as const;
    const lines = types.map((t, i) => ({
      ...validCapturedLine(`line_${i + 1}`),
      line_type: t,
    }));
    const out = validateAndNormalize(
      { ...resolvedPromo(), captured_lines: lines },
      "initial",
    );
    expect(out.captured_lines.length).toBe(4);
    expect(out.captured_lines.map((l) => l.line_type)).toEqual(types);
  });

  it("S3.10 label='' (empty string) preserved (not dropped)", () => {
    const line = { ...validCapturedLine("line_1"), label: "" };
    const out = validateAndNormalize(
      { ...resolvedPromo(), captured_lines: [line] },
      "initial",
    );
    expect(out.captured_lines.length).toBe(1);
    expect(out.captured_lines[0].label).toBe("");
  });
});

describe("Parser smoke — Category 4: foreign top-level keys silent drop preserved", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warnSpy.mockRestore());

  it("S4P.1 unknown top-level key dropped silently", () => {
    const out = validateAndNormalize(
      { ...resolvedPromo(), totally_made_up: "boom", another: 42 },
      "initial",
    ) as ParserOutput & Record<string, unknown>;
    expect(out.totally_made_up).toBeUndefined();
    expect(out.another).toBeUndefined();
  });

  it("S4P.2 foreign keys do NOT contaminate _preparser/captured_lines defaults", () => {
    const out = validateAndNormalize(
      { ...resolvedPromo(), evil: { _preparser: "hack" } },
      "initial",
    );
    expect(out._preparser).toBeNull();
    expect(out.captured_lines).toEqual([]);
  });
});

describe("Parser smoke — Category 5: REGRESSION (V0.9 flat behavior unchanged)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warnSpy.mockRestore());

  it("R5.1 empty input → full V0.9 shape with NEW sibling defaults", () => {
    const out = validateAndNormalize({}, "refine");
    expect(out.schema_version).toBe("0.9");
    expect(out.parsed_promo.promo_name).toBeNull();
    expect(out.parsed_promo.game_types).toEqual([]);
    expect(out.gaps).toEqual([]);
    // New siblings — sane defaults that don't break consumers
    expect(out._preparser).toBeNull();
    expect(out.captured_lines).toEqual([]);
  });

  it("R5.2 schema_version still coerced to '0.9' (not bumped)", () => {
    const out = validateAndNormalize(
      { schema_version: "9.9.9", ...resolvedPromo() },
      "initial",
    );
    expect(out.schema_version).toBe("0.9");
  });

  it("R5.3 ParsedPromo 28 fields untouched by addition", () => {
    const out = validateAndNormalize(resolvedPromo(), "initial");
    const expectedKeys = [
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
    ];
    expect(Object.keys(out.parsed_promo).sort()).toEqual(expectedKeys.sort());
    expect(Object.keys(out.parsed_promo).length).toBe(28);
  });

  it("R5.4 Rule 4 (gaps integrity initial) still throws when critical unresolved", () => {
    expect(() =>
      validateAndNormalize(
        { parsed_promo: { promo_name: "X" }, gaps: [] },
        "initial",
      ),
    ).toThrow(/gaps missing for critical unresolved fields/);
  });

  it("R5.5 Rule 1 forbidden date literals still coerced", () => {
    const out = validateAndNormalize(
      resolvedPromo({ valid_from: "hari_ini", valid_until: "unlimited" }),
      "refine",
    );
    expect(out.parsed_promo.valid_from).toBeNull();
    expect(out.parsed_promo.valid_until).toBeNull();
  });

  it("R5.6 _human field shape Rule 8 still preserved", () => {
    const out = validateAndNormalize(
      resolvedPromo({
        game_types_human: "should be array" as never,
      }),
      "refine",
    );
    expect(out.parsed_promo.game_types_human).toBeNull();
  });

  it("R5.7 ParserOutput top-level keys = exactly 5 (3 old + 2 new)", () => {
    const out = validateAndNormalize(resolvedPromo(), "initial");
    const keys = Object.keys(out).sort();
    expect(keys).toEqual([
      "_preparser",
      "captured_lines",
      "gaps",
      "parsed_promo",
      "schema_version",
    ]);
  });
});
