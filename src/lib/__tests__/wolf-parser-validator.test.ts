/**
 * Wolfclaw Parser V0.9 — Validator unit tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateAndNormalize } from "@/lib/parsers/wolf-parser-validator";
import type { ParserOutput } from "@/lib/parsers/wolf-parser-types";

// Helper: build a minimal "resolved" parsed_promo so Rule 4 doesn't throw.
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

describe("wolf-parser-validator", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("1. empty input -> full V0.9 shape (mode=refine bypasses Rule 4)", () => {
    const out = validateAndNormalize({}, "refine");
    expect(out.schema_version).toBe("0.9");
    expect(out.parsed_promo.promo_name).toBeNull();
    expect(out.parsed_promo.game_types).toEqual([]);
    expect(out.parsed_promo.source_evidence_map).toEqual({});
    expect(out.parsed_promo.clean_text).toBe("");
    expect(out.gaps).toEqual([]);
  });

  it("2. schema_version always '0.9'", () => {
    const out = validateAndNormalize(
      { schema_version: "9.9.9", ...resolvedPromo() },
      "initial",
    );
    expect(out.schema_version).toBe("0.9");
  });

  it("3. valid_from='hari_ini' -> null", () => {
    const out = validateAndNormalize(
      resolvedPromo({ valid_from: "hari_ini" }),
      "refine",
    );
    expect(out.parsed_promo.valid_from).toBeNull();
  });

  it("4. valid_until='unlimited' -> null", () => {
    const out = validateAndNormalize(
      resolvedPromo({ valid_until: "unlimited" }),
      "refine",
    );
    expect(out.parsed_promo.valid_until).toBeNull();
  });

  it("5. mode=initial drops evidence with '[OPERATOR_FILL' prefix", () => {
    const out = validateAndNormalize(
      resolvedPromo({
        source_evidence_map: {
          max_bonus: ["[OPERATOR_FILL] manual entry", "literal text 100"],
        },
      }),
      "initial",
    );
    expect(out.parsed_promo.source_evidence_map.max_bonus).toEqual([
      "literal text 100",
    ]);
  });

  it("6. mode=initial drops evidence with 'operator:' prefix", () => {
    const out = validateAndNormalize(
      resolvedPromo({
        source_evidence_map: {
          max_bonus: ["operator: said so", "valid evidence"],
        },
      }),
      "initial",
    );
    expect(out.parsed_promo.source_evidence_map.max_bonus).toEqual([
      "valid evidence",
    ]);
  });

  it("7. mode=refine preserves 'operator_confirmed:' evidence", () => {
    const out = validateAndNormalize(
      {
        parsed_promo: {
          max_bonus: 200,
          value_status_map: { max_bonus: "explicit" },
          source_evidence_map: {
            max_bonus: ["operator_confirmed: 200"],
          },
        },
        gaps: [],
      },
      "refine",
    );
    expect(out.parsed_promo.source_evidence_map.max_bonus).toEqual([
      "operator_confirmed: 200",
    ]);
  });

  it("8. foreign top-level key dropped", () => {
    const out = validateAndNormalize(
      { ...resolvedPromo(), evil_extra: "boom" },
      "initial",
    ) as ParserOutput & { evil_extra?: unknown };
    expect(out.evil_extra).toBeUndefined();
  });

  it("9. foreign parsed_promo key dropped", () => {
    const out = validateAndNormalize(
      {
        parsed_promo: {
          ...resolvedPromo().parsed_promo,
          rogue_field: "should be gone",
        },
        gaps: [],
      },
      "initial",
    );
    expect(
      (out.parsed_promo as unknown as Record<string, unknown>).rogue_field,
    ).toBeUndefined();
  });

  it("10. mode=initial throws if gaps[] empty but critical unresolved", () => {
    expect(() =>
      validateAndNormalize(
        {
          parsed_promo: { promo_name: "X" },
          gaps: [],
        },
        "initial",
      ),
    ).toThrow(/gaps missing for critical unresolved fields/);
  });

  it("11. mode=initial passes if critical fields resolved", () => {
    expect(() => validateAndNormalize(resolvedPromo(), "initial")).not.toThrow();
  });

  it("12. mode=refine throws if gaps[] empty but needs_operator_fill_map flags remain", () => {
    expect(() =>
      validateAndNormalize(
        {
          parsed_promo: {
            needs_operator_fill_map: { max_bonus: true },
          },
          gaps: [],
        },
        "refine",
      ),
    ).toThrow(/needs_operator_fill_map still flags/);
  });

  it("13. turnover_requirement object -> null", () => {
    const out = validateAndNormalize(
      resolvedPromo({
        turnover_requirement: { multiplier: 8, basis: "deposit" },
      }),
      "initial",
    );
    expect(out.parsed_promo.turnover_requirement).toBeNull();
  });

  it("14. turnover_requirement number preserved", () => {
    const out = validateAndNormalize(
      resolvedPromo({ turnover_requirement: 8 }),
      "initial",
    );
    expect(out.parsed_promo.turnover_requirement).toBe(8);
  });

  it("15. mode=refine warns when field appears resolved without operator-style evidence", () => {
    validateAndNormalize(
      {
        parsed_promo: {
          max_bonus: 500,
          value_status_map: { max_bonus: "explicit" },
          source_evidence_map: {},
          needs_operator_fill_map: {},
        },
        gaps: [],
      },
      "refine",
    );
    const calls = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(calls.some((m) => m.includes("Rule 7"))).toBe(true);
  });

  it("16. invalid calculation_basis coerced to null", () => {
    const out = validateAndNormalize(
      resolvedPromo({ calculation_basis: "weird_basis" }),
      "initial",
    );
    expect(out.parsed_promo.calculation_basis).toBeNull();
  });

  it("17. invalid gap entries are dropped", () => {
    const out = validateAndNormalize(
      {
        ...resolvedPromo(),
        gaps: [
          { field: "x", gap_type: "required_missing", question: "Q?", options: [] },
          { field: "", gap_type: "required_missing", question: "Q?", options: [] },
          { field: "y", gap_type: "bogus", question: "Q?", options: [] },
        ],
      },
      "initial",
    );
    expect(out.gaps.length).toBe(1);
    expect(out.gaps[0].field).toBe("x");
  });
});
