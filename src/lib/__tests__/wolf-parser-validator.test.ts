import { describe, it, expect } from "vitest";
import { validateAndNormalize } from "../parsers/wolf-parser-validator";

describe("wolf-parser-validator V0.9", () => {
  it("returns full V0.9 shape from empty input", () => {
    const out = validateAndNormalize({});
    expect(out.schema_version).toBe("0.9");
    expect(out.gaps).toEqual([]);
    expect(out.parsed_promo.promo_name).toBeNull();
    expect(out.parsed_promo.game_types).toEqual([]);
    expect(out.parsed_promo.source_evidence_map).toEqual({});
    expect(out.parsed_promo.value_status_map).toEqual({});
    expect(out.parsed_promo.needs_operator_fill_map).toEqual({});
    expect(out.parsed_promo.clean_text).toBe("");
  });

  it("test case 1 — sederhana", () => {
    const llm = {
      schema_version: "0.9",
      parsed_promo: {
        promo_name: null,
        promo_type: "deposit_bonus",
        min_deposit: 100000,
        max_bonus: 2000000,
        max_bonus_unlimited: false,
        has_turnover: true,
        is_tiered: false,
        reward_type_hint: "percentage",
        calculation_basis: "deposit",
        calculation_value: 10,
        turnover_requirement: 8,
        game_types: ["slot"],
        source_evidence_map: {
          promo_type: "Bonus deposit",
          min_deposit: "min depo 100rb",
          turnover_requirement: "TO 8x",
        },
        value_status_map: {
          promo_type: "explicit",
          min_deposit: "explicit",
          claim_method: "not_stated",
        },
        needs_operator_fill_map: { promo_name: true, claim_method: true },
        clean_text: "Deposit bonus 10%.",
      },
      gaps: [
        {
          field: "promo_name",
          gap_type: "required_missing",
          question: "Apa nama resmi promo ini?",
          options: [],
        },
        {
          field: "claim_method",
          gap_type: "required_missing",
          question: "Bagaimana bonus diberikan?",
          options: ["auto", "manual"],
        },
      ],
    };
    const out = validateAndNormalize(llm);
    expect(out.parsed_promo.promo_type).toBe("deposit_bonus");
    expect(out.parsed_promo.turnover_requirement).toBe(8);
    expect(out.parsed_promo.game_types).toEqual(["slot"]);
    expect(out.gaps).toHaveLength(2);
    expect(out.parsed_promo.value_status_map.claim_method).toBe("not_stated");
  });

  it("test case 2 — ambigu, mostly null", () => {
    const llm = {
      schema_version: "0.9",
      parsed_promo: {
        target_user: null,
        ambiguity_flags: ["promo_type", "target_user"],
        parse_confidence: 0.15,
        clean_text: "Promo untuk member baru.",
        source_evidence_map: { target_user: "new member" },
        value_status_map: {
          promo_type: "ambiguous",
          target_user: "ambiguous",
          min_deposit: "not_stated",
        },
      },
      gaps: [
        {
          field: "promo_type",
          gap_type: "ambiguous",
          question: "Jenis promo apa ini?",
          options: [],
        },
      ],
    };
    const out = validateAndNormalize(llm);
    expect(out.parsed_promo.parse_confidence).toBe(0.15);
    expect(out.parsed_promo.ambiguity_flags).toContain("promo_type");
    expect(out.parsed_promo.value_status_map.promo_type).toBe("ambiguous");
    expect(out.gaps[0].gap_type).toBe("ambiguous");
  });

  it("test case 3 — hybrid, scalar turnover, no platform_access invented", () => {
    const llm = {
      schema_version: "0.9",
      parsed_promo: {
        promo_type: "cashback",
        platform_access: null,
        min_deposit: 50000,
        max_bonus: 5000000,
        is_tiered: true,
        reward_type_hint: "percentage_range",
        calculation_basis: "loss",
        calculation_value: null,
        turnover_requirement: null,
        claim_method: "manual",
        game_exclusions: ["live_casino"],
        ambiguity_flags: ["calculation_value", "platform_access"],
        value_status_map: {
          calculation_value: "ambiguous",
          platform_access: "ambiguous",
        },
        clean_text: "Cashback mingguan 5-15% dari loss.",
      },
      gaps: [
        {
          field: "platform_access",
          gap_type: "ambiguous",
          question: "Teks menyebut APK — apa value resmi?",
          options: [],
        },
      ],
    };
    const out = validateAndNormalize(llm);
    expect(out.parsed_promo.platform_access).toBeNull();
    expect(out.parsed_promo.is_tiered).toBe(true);
    expect(out.parsed_promo.turnover_requirement).toBeNull();
    expect(out.parsed_promo.game_exclusions).toEqual(["live_casino"]);
  });

  it("rejects foreign top-level keys and foreign parsed_promo keys", () => {
    const llm = {
      schema_version: "0.9",
      foreign_root: "drop me",
      parsed_promo: {
        promo_name: "X",
        rogue_field: "drop me too",
      },
      gaps: [],
    };
    const out = validateAndNormalize(llm) as any;
    expect(out.foreign_root).toBeUndefined();
    expect(out.parsed_promo.rogue_field).toBeUndefined();
    expect(out.parsed_promo.promo_name).toBe("X");
  });

  it("rejects gaps with invalid gap_type or missing fields", () => {
    const out = validateAndNormalize({
      gaps: [
        { field: "x", gap_type: "BAD", question: "q", options: [] },
        { field: "", gap_type: "ambiguous", question: "q", options: [] },
        { field: "y", gap_type: "ambiguous", question: "", options: [] },
        {
          field: "z",
          gap_type: "required_missing",
          question: "ok",
          options: ["a", "b"],
        },
      ],
    });
    expect(out.gaps).toHaveLength(1);
    expect(out.gaps[0].field).toBe("z");
  });

  it("coerces non-scalar turnover_requirement to null (no object accepted)", () => {
    const out = validateAndNormalize({
      parsed_promo: {
        turnover_requirement: { multiplier: 8, basis: null },
      },
    });
    expect(out.parsed_promo.turnover_requirement).toBeNull();
  });

  it("ignores invalid value_status enum entries", () => {
    const out = validateAndNormalize({
      parsed_promo: {
        value_status_map: {
          a: "explicit",
          b: "INVALID",
          c: "not_stated",
        },
      },
    });
    expect(out.parsed_promo.value_status_map).toEqual({
      a: "explicit",
      c: "not_stated",
    });
  });
});
