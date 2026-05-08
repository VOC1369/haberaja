/**
 * PR-19A.1 — F3 Compliance Issue Adapter contract tests.
 */
import { describe, it, expect } from "vitest";
import { buildF3ComplianceQuestions } from "../admin-verify/f3-compliance-adapter";
import type { PkV10Record } from "../schema/pk-v10";

function buildRec(patch: Record<string, unknown> = {}): PkV10Record {
  const base: unknown = {
    domain: "promo_knowledge",
    record_id: "pk_test_f3",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    meta_engine: {
      schema_block: {
        schema_name: "PKB_Wolfbrain",
        schema_version: "V.10.1",
        status: "ai_draft",
      },
      source_block: { raw_content: "RAW" },
    },
    readiness_engine: {
      validation_block: { warnings: [] },
      observability_block: { ambiguity_flags: [], contradiction_flags: [] },
    },
    ...patch,
  };
  return base as PkV10Record;
}

describe("PR-19A.1 f3-compliance-adapter", () => {
  it("flags invalid rule_type", () => {
    const rec = buildRec({
      trigger_engine: {
        trigger_rule_block: { rule_type: "first_deposit_only" },
      },
    });
    const qs = buildF3ComplianceQuestions(rec);
    expect(qs).toHaveLength(1);
    expect(qs[0].severity).toBe("contradiction");
    expect(qs[0].affected_paths).toEqual([
      "trigger_engine.trigger_rule_block.rule_type",
    ]);
    expect(qs[0].source_text).toContain("first_deposit_only");
  });

  it("emits issue per invalid turnover_rule_format variant", () => {
    const rec = buildRec({
      variant_engine: {
        items_block: {
          subcategories: [
            { turnover_rule_format: "(Deposit + Bonus) x 20" },
            { turnover_rule_format: "multiplier" },
            { turnover_rule_format: "raw text" },
          ],
        },
      },
    });
    const qs = buildF3ComplianceQuestions(rec);
    expect(qs).toHaveLength(2);
    expect(qs[0].affected_paths[0]).toContain("subcategories[0]");
    expect(qs[1].affected_paths[0]).toContain("subcategories[2]");
  });

  it("returns no issue for valid rule_type", () => {
    const rec = buildRec({
      trigger_engine: { trigger_rule_block: { rule_type: "compound" } },
    });
    expect(buildF3ComplianceQuestions(rec)).toEqual([]);
  });

  it("returns no issue for valid turnover_rule_format", () => {
    const rec = buildRec({
      variant_engine: {
        items_block: {
          subcategories: [
            { turnover_rule_format: "multiplier" },
            { turnover_rule_format: "min_rupiah" },
          ],
        },
      },
    });
    expect(buildF3ComplianceQuestions(rec)).toEqual([]);
  });

  it("does not fail KHR/PHP currency (extensible)", () => {
    const recKHR = buildRec({ reward_engine: { currency: "KHR" } });
    const recPHP = buildRec({ reward_engine: { currency: "PHP" } });
    expect(buildF3ComplianceQuestions(recKHR)).toEqual([]);
    expect(buildF3ComplianceQuestions(recPHP)).toEqual([]);
  });

  it("warns on malformed currency shape", () => {
    const rec = buildRec({ reward_engine: { currency: "rupiah" } });
    const qs = buildF3ComplianceQuestions(rec);
    expect(qs).toHaveLength(1);
    expect(qs[0].severity).toBe("warning");
  });

  it("does not mutate the record", () => {
    const rec = buildRec({
      trigger_engine: { trigger_rule_block: { rule_type: "bad" } },
      variant_engine: {
        items_block: {
          subcategories: [{ turnover_rule_format: "formula" }],
        },
      },
      readiness_engine: {
        validation_block: { warnings: [], status: "WEIRD" },
        observability_block: { ambiguity_flags: [], contradiction_flags: [] },
        state_block: { state: "in_progress" },
      },
    });
    const before = JSON.stringify(rec);
    buildF3ComplianceQuestions(rec);
    expect(JSON.stringify(rec)).toBe(before);
  });

  it("flags invalid state and validation status", () => {
    const rec = buildRec({
      readiness_engine: {
        validation_block: { warnings: [], status: "in_review" },
        observability_block: { ambiguity_flags: [], contradiction_flags: [] },
        state_block: { state: "weird_state" },
      },
    });
    const qs = buildF3ComplianceQuestions(rec);
    const paths = qs.map((q) => q.affected_paths[0]).sort();
    expect(paths).toEqual([
      "readiness_engine.state_block.state",
      "readiness_engine.validation_block.status",
    ]);
  });
});
