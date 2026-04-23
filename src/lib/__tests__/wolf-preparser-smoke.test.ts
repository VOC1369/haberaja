/**
 * Wolfclaw PreParser V1.0 — Smoke Tests
 *
 * STEP B: smoke-only validation of new PreParser layer.
 * Scope:
 *   - Category 1: PreParser output shape validation (validatePreParserOutput)
 *   - Category 4 (partial): Foreign key drop on _preparser sub-keys
 *
 * Does NOT call the LLM — only exercises the validator coercion paths.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validatePreParserOutput } from "@/lib/parsers/wolf-parser-validator";
import type { PreParserOutput } from "@/lib/parsers/wolf-preparser-types";

// Helper — build a minimal valid PreParser payload.
function validPreParser(
  overrides: Partial<PreParserOutput> = {},
): Record<string, unknown> {
  return {
    shape: "single_flat",
    parseability: "clean",
    classification_confidence: 0.9,
    structure: { unit_count: 1, line_count: 0 },
    signals: {
      has_repeated_lines: false,
      has_shared_rules: false,
      rows_depend_on_parent: false,
      mutually_exclusive_lines: false,
    },
    conflicts: [],
    routing_hints: {
      parse_parent: true,
      capture_lines: false,
      needs_review: false,
    },
    reasoning_summary: "Single flat promo, no lines, no conflicts.",
    ...overrides,
  } as Record<string, unknown>;
}

describe("PreParser smoke — Category 1: output shape validation", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("S1.1 valid PreParser passes through unchanged", () => {
    const out = validatePreParserOutput(validPreParser());
    expect(out).not.toBeNull();
    expect(out!.shape).toBe("single_flat");
    expect(out!.parseability).toBe("clean");
    expect(out!.classification_confidence).toBe(0.9);
    expect(out!.routing_hints.parse_parent).toBe(true);
  });

  it("S1.2 all 4 shape enum values accepted", () => {
    const shapes = [
      "single_flat",
      "single_with_lines",
      "multi_independent",
      "invalid",
    ] as const;
    for (const shape of shapes) {
      const out = validatePreParserOutput(validPreParser({ shape }));
      expect(out).not.toBeNull();
      expect(out!.shape).toBe(shape);
    }
  });

  it("S1.3 invalid shape enum coerces to null + warn", () => {
    const out = validatePreParserOutput(validPreParser({ shape: "weird" as never }));
    expect(out).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("S1.4 all 4 parseability enum values accepted", () => {
    const vals = ["clean", "parseable_with_conflicts", "partial", "reject"] as const;
    for (const p of vals) {
      const out = validatePreParserOutput(validPreParser({ parseability: p }));
      expect(out).not.toBeNull();
      expect(out!.parseability).toBe(p);
    }
  });

  it("S1.5 invalid parseability coerces to null", () => {
    const out = validatePreParserOutput(
      validPreParser({ parseability: "bogus" as never }),
    );
    expect(out).toBeNull();
  });

  it("S1.6 missing required signals key coerces to null", () => {
    const bad = validPreParser();
    (bad.signals as Record<string, unknown>).has_repeated_lines = "yes";
    const out = validatePreParserOutput(bad);
    expect(out).toBeNull();
  });

  it("S1.7 missing required routing_hints key coerces to null", () => {
    const bad = validPreParser();
    delete (bad.routing_hints as Record<string, unknown>).needs_review;
    const out = validatePreParserOutput(bad);
    expect(out).toBeNull();
  });

  it("S1.8 empty reasoning_summary coerces to null", () => {
    const out = validatePreParserOutput(
      validPreParser({ reasoning_summary: "" }),
    );
    expect(out).toBeNull();
  });

  it("S1.9 classification_confidence out of [0,1] range coerces to null value", () => {
    const out = validatePreParserOutput(
      validPreParser({ classification_confidence: 1.5 }),
    );
    expect(out).not.toBeNull();
    expect(out!.classification_confidence).toBeNull();
  });

  it("S1.10 classification_confidence explicit null preserved", () => {
    const out = validatePreParserOutput(
      validPreParser({ classification_confidence: null }),
    );
    expect(out).not.toBeNull();
    expect(out!.classification_confidence).toBeNull();
  });

  it("S1.11 non-object input returns null + warn", () => {
    expect(validatePreParserOutput(null)).toBeNull();
    expect(validatePreParserOutput("string")).toBeNull();
    expect(validatePreParserOutput(42)).toBeNull();
    expect(validatePreParserOutput([])).toBeNull();
  });

  it("S1.12 conflicts array of valid items preserved", () => {
    const out = validatePreParserOutput(
      validPreParser({
        conflicts: [
          {
            type: "tnc_vs_row_contradiction",
            impact: "degrades_accuracy",
            source_refs: ["T&C poin 3", "Row 1"],
            detail: "Slot-only T&C vs Casino row",
          },
        ],
      }),
    );
    expect(out).not.toBeNull();
    expect(out!.conflicts.length).toBe(1);
    expect(out!.conflicts[0].impact).toBe("degrades_accuracy");
  });

  it("S1.13 conflict with invalid impact dropped silently", () => {
    const out = validatePreParserOutput(
      validPreParser({
        conflicts: [
          {
            type: "x",
            impact: "catastrophic" as never,
            source_refs: [],
            detail: "bad",
          },
          {
            type: "y",
            impact: "cosmetic",
            source_refs: [],
            detail: "good",
          },
        ],
      }),
    );
    expect(out).not.toBeNull();
    expect(out!.conflicts.length).toBe(1);
    expect(out!.conflicts[0].type).toBe("y");
  });

  it("S1.14 structure with non-numeric counts defaults to 0", () => {
    const out = validatePreParserOutput(
      validPreParser({
        structure: { unit_count: "many", line_count: null } as never,
      }),
    );
    expect(out).not.toBeNull();
    expect(out!.structure.unit_count).toBe(0);
    expect(out!.structure.line_count).toBe(0);
  });
});

describe("PreParser smoke — Category 4: foreign keys silent drop on _preparser", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warnSpy.mockRestore());

  it("S4.1 foreign top-level keys on _preparser dropped", () => {
    const payload = validPreParser();
    (payload as Record<string, unknown>).rogue_field = "boom";
    (payload as Record<string, unknown>).extra_data = { hack: true };
    const out = validatePreParserOutput(payload);
    expect(out).not.toBeNull();
    expect((out as unknown as Record<string, unknown>).rogue_field).toBeUndefined();
    expect((out as unknown as Record<string, unknown>).extra_data).toBeUndefined();
  });

  it("S4.2 foreign keys inside signals preserved-but-ignored (only required keys read)", () => {
    const payload = validPreParser();
    (payload.signals as Record<string, unknown>).extra_signal = true;
    const out = validatePreParserOutput(payload);
    expect(out).not.toBeNull();
    expect(
      (out!.signals as unknown as Record<string, unknown>).extra_signal,
    ).toBeUndefined();
  });
});
