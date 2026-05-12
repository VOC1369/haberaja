/**
 * PR-22.x — Condition gating & summary tests.
 * Locks:
 *   - Structured conditions suppress the rule_type contradiction question.
 *   - Missing/string-only conditions still produce the question.
 *   - buildConditionSummary returns Bahasa Indonesia summary.
 *   - No JSON mutation.
 */
import { describe, it, expect } from "vitest";
import {
  isStructuredCondition,
  hasResolvedStructuredConditions,
  buildConditionSummary,
} from "../admin-verify/condition-summary";
import { buildF3ComplianceQuestions } from "../admin-verify/f3-compliance-adapter";
import type { PkV10Record } from "../schema/pk-v10";

function buildRec(patch: Record<string, unknown> = {}): PkV10Record {
  const base: unknown = {
    domain: "promo_knowledge",
    record_id: "pk_cond_gate",
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

describe("condition-summary helpers", () => {
  it("isStructuredCondition recognizes shape {field, operator, value}", () => {
    expect(
      isStructuredCondition({
        field: "deposit_amount",
        operator: "gte",
        value: 50000,
      }),
    ).toBe(true);
    expect(isStructuredCondition({ field: "x", operator: "eq" })).toBe(false);
    expect(isStructuredCondition("raw text")).toBe(false);
    expect(isStructuredCondition(null)).toBe(false);
  });

  it("hasResolvedStructuredConditions only true when ALL conditions structured", () => {
    expect(
      hasResolvedStructuredConditions(
        buildRec({
          trigger_engine: {
            trigger_rule_block: {
              rule_type: "first_deposit_only",
              conditions: [
                { field: "deposit_amount", operator: "gte", value: 50000, currency: "IDR" },
                { field: "user_status", operator: "equals", value: "new_member" },
              ],
            },
          },
        }),
      ),
    ).toBe(true);

    expect(
      hasResolvedStructuredConditions(
        buildRec({
          trigger_engine: {
            trigger_rule_block: {
              rule_type: "bad",
              conditions: ["minimal deposit 50000"], // string, not structured
            },
          },
        }),
      ),
    ).toBe(false);

    expect(hasResolvedStructuredConditions(buildRec())).toBe(false);
  });

  it("buildConditionSummary renders Bahasa Indonesia summary", () => {
    const out = buildConditionSummary([
      { field: "deposit_amount", operator: "gte", value: 50000, currency: "IDR" },
      { field: "user_status", operator: "equals", value: "new_member" },
    ]);
    expect(out).toContain("Minimal deposit Rp50.000");
    expect(out).toContain("Khusus member baru");
    expect(out).toContain(";");
  });

  it("buildConditionSummary handles deposit_count=1 special case", () => {
    const out = buildConditionSummary([
      { field: "deposit_count", operator: "equals", value: 1 },
      { field: "user_status", operator: "equals", value: "new_member" },
    ]);
    expect(out).toContain("Deposit pertama");
    expect(out).toContain("Khusus member baru");
  });
});

describe("F3 question gating — structured conditions suppress rule_type question", () => {
  it("does NOT emit rule_type question when conditions are structured & valid", () => {
    const rec = buildRec({
      trigger_engine: {
        trigger_rule_block: {
          rule_type: "first_deposit_only", // invalid alias
          conditions: [
            { field: "deposit_amount", operator: "gte", value: 50000, currency: "IDR" },
            { field: "user_status", operator: "equals", value: "new_member" },
          ],
        },
      },
    });
    const qs = buildF3ComplianceQuestions(rec);
    const ruleTypeQs = qs.filter(
      (q) => q.affected_paths[0] === "trigger_engine.trigger_rule_block.rule_type",
    );
    expect(ruleTypeQs).toHaveLength(0);
  });

  it("DOES emit rule_type question when conditions are missing", () => {
    const rec = buildRec({
      trigger_engine: { trigger_rule_block: { rule_type: "first_deposit_only" } },
    });
    const qs = buildF3ComplianceQuestions(rec);
    const ruleTypeQs = qs.filter(
      (q) => q.affected_paths[0] === "trigger_engine.trigger_rule_block.rule_type",
    );
    expect(ruleTypeQs).toHaveLength(1);
  });

  it("DOES emit rule_type question when conditions are unstructured strings", () => {
    const rec = buildRec({
      trigger_engine: {
        trigger_rule_block: {
          rule_type: "first_deposit_only",
          conditions: ["minimal deposit Rp50.000"],
        },
      },
    });
    const qs = buildF3ComplianceQuestions(rec);
    const ruleTypeQs = qs.filter(
      (q) => q.affected_paths[0] === "trigger_engine.trigger_rule_block.rule_type",
    );
    expect(ruleTypeQs).toHaveLength(1);
  });

  it("does not mutate the record", () => {
    const rec = buildRec({
      trigger_engine: {
        trigger_rule_block: {
          rule_type: "bad",
          conditions: [
            { field: "deposit_amount", operator: "gte", value: 50000, currency: "IDR" },
          ],
        },
      },
    });
    const before = JSON.stringify(rec);
    buildF3ComplianceQuestions(rec);
    buildConditionSummary(rec.trigger_engine?.trigger_rule_block?.conditions);
    hasResolvedStructuredConditions(rec);
    expect(JSON.stringify(rec)).toBe(before);
  });
});
