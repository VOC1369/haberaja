/**
 * PR-19B — admin-answer-patch-preview tests.
 * Locks: deterministic, no mutation, no live LLM, no apply.
 */
import { describe, it, expect } from "vitest";
import { mockedAdminAnswerToPatchPreview } from "../admin-verify/admin-answer-patch-preview";
import { buildF3ComplianceQuestions } from "../admin-verify/f3-compliance-adapter";
import type { PkV10Record } from "../schema/pk-v10";

function buildRec(overrides: {
  rule_type?: string;
  turnover_format?: string;
} = {}): PkV10Record {
  const rec: unknown = {
    domain: "promo_knowledge",
    record_id: "pk_test_pr19b",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    meta_engine: {
      schema_block: { schema_name: "PKB_Wolfbrain", schema_version: "V.10.1", status: "ai_draft" },
      source_block: { raw_content: "RAW" },
    },
    trigger_engine: {
      trigger_rule_block: { rule_type: overrides.rule_type ?? "first_deposit_only" },
    },
    variant_engine: {
      items_block: {
        subcategories: [
          { turnover_rule_format: overrides.turnover_format ?? "(Deposit + Bonus) x 20" },
        ],
      },
    },
    readiness_engine: {
      validation_block: { warnings: [] },
      observability_block: { ambiguity_flags: [], contradiction_flags: [] },
    },
  };
  return rec as PkV10Record;
}

describe("PR-19B mockedAdminAnswerToPatchPreview", () => {
  it("rule_type invalid + answer 'conditional' → set_value patch preview", async () => {
    const rec = buildRec();
    const q = buildF3ComplianceQuestions(rec).find((x) =>
      x.affected_paths.includes("trigger_engine.trigger_rule_block.rule_type"),
    )!;
    expect(q).toBeTruthy();
    const before = JSON.stringify(rec);
    const r = await mockedAdminAnswerToPatchPreview({
      record: rec,
      reviewTask: q,
      adminAnswer: { task_id: q.task_id, answer_text: "Menurut saya ini conditional." },
    });
    expect(r.needs_clarification).toBeFalsy();
    expect(r.needs_confirmation).toBe(true);
    expect(r.proposed_patches).toHaveLength(1);
    expect(r.proposed_patches[0]).toMatchObject({
      operation: "set_value",
      target_path: "trigger_engine.trigger_rule_block.rule_type",
      old_value_preview: "first_deposit_only",
      new_value_preview: "conditional",
    });
    expect(JSON.stringify(rec)).toBe(before); // no mutation
  });

  it("turnover_rule_format invalid + answer 'multiplier' → set_value patch", async () => {
    const rec = buildRec();
    const q = buildF3ComplianceQuestions(rec).find((x) =>
      x.affected_paths[0]?.endsWith(".turnover_rule_format"),
    )!;
    const r = await mockedAdminAnswerToPatchPreview({
      record: rec,
      reviewTask: q,
      adminAnswer: { task_id: q.task_id, answer_text: "Ini multiplier." },
    });
    expect(r.proposed_patches).toHaveLength(1);
    expect(r.proposed_patches[0].new_value_preview).toBe("multiplier");
    expect(r.proposed_patches[0].old_value_preview).toBe("(Deposit + Bonus) x 20");
  });

  it("min rupiah (two-word) is recognized as min_rupiah", async () => {
    const rec = buildRec();
    const q = buildF3ComplianceQuestions(rec).find((x) =>
      x.affected_paths[0]?.endsWith(".turnover_rule_format"),
    )!;
    const r = await mockedAdminAnswerToPatchPreview({
      record: rec,
      reviewTask: q,
      adminAnswer: { task_id: q.task_id, answer_text: "min rupiah saja" },
    });
    expect(r.proposed_patches[0]?.new_value_preview).toBe("min_rupiah");
  });

  it("unclear answer → needs_clarification, no patches", async () => {
    const rec = buildRec();
    const q = buildF3ComplianceQuestions(rec)[0];
    const r = await mockedAdminAnswerToPatchPreview({
      record: rec,
      reviewTask: q,
      adminAnswer: { task_id: q.task_id, answer_text: "ikut yang benar aja" },
    });
    expect(r.needs_clarification).toBe(true);
    expect(r.proposed_patches).toEqual([]);
  });

  it("empty answer → needs_clarification", async () => {
    const rec = buildRec();
    const q = buildF3ComplianceQuestions(rec)[0];
    const r = await mockedAdminAnswerToPatchPreview({
      record: rec,
      reviewTask: q,
      adminAnswer: { task_id: q.task_id, answer_text: "   " },
    });
    expect(r.needs_clarification).toBe(true);
    expect(r.proposed_patches).toEqual([]);
  });

  it("ambiguous answer mentioning two enum values → needs_clarification", async () => {
    const rec = buildRec();
    const q = buildF3ComplianceQuestions(rec).find((x) =>
      x.affected_paths.includes("trigger_engine.trigger_rule_block.rule_type"),
    )!;
    const r = await mockedAdminAnswerToPatchPreview({
      record: rec,
      reviewTask: q,
      adminAnswer: { task_id: q.task_id, answer_text: "antara simple atau conditional ya" },
    });
    expect(r.needs_clarification).toBe(true);
    expect(r.proposed_patches).toEqual([]);
  });

  it("source contains no live network / regex over warning text", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(
      "src/features/promo-knowledge/admin-verify/admin-answer-patch-preview.ts",
      "utf8",
    );
    expect(src.includes("fetch(")).toBe(false);
    expect(/from\s+["'][^"']*ai-proxy/i.test(src)).toBe(false);
    expect(/\.test\(\s*(source_text|warning|raw)/i.test(src)).toBe(false);
  });
});
