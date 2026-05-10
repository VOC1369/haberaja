/**
 * PR-22 — humanize-issue helper tests (presentation only).
 * Locks: concrete object surfacing, specific questions, internal hints,
 * no JSON mutation.
 */
import { describe, it, expect } from "vitest";
import type { PkV10Record } from "../schema/pk-v10";
import type { AdminVerifyIssueQuestion } from "../admin-verify/extractor-issue-adapter";
import { humanizeIssue } from "../admin-verify/humanize-issue";

function makeRec(overrides: Record<string, unknown> = {}): PkV10Record {
  const rec: unknown = {
    domain: "promo_knowledge",
    record_id: "pk_test_pr22",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    meta_engine: {
      schema_block: { schema_name: "PKB_Wolfbrain", schema_version: "V.10.1", status: "ai_draft" },
      source_block: { raw_content: "RAW" },
    },
    identity_engine: { promo_block: { promo_name: "Test", promo_type: "deposit-bonus" } },
    trigger_engine: {
      trigger_rule_block: {
        rule_type: "first_deposit_only",
        trigger_event: "first_deposit",
        conditions: ["minimal deposit 50.000"],
      },
    },
    scope_engine: { audience_block: { target_user: "member baru" } },
    variant_engine: {
      items_block: {
        subcategories: [
          { variant_name: "Slot 100%", turnover_rule_format: "(D+B)*20" },
        ],
      },
    },
    reward_engine: { currency: "Rupiah" },
    readiness_engine: {
      validation_block: { warnings: [], status: "draft" },
      observability_block: { ambiguity_flags: [], contradiction_flags: [] },
      state_block: { state: "draft" },
    },
    ...overrides,
  };
  return rec as PkV10Record;
}

function task(partial: Partial<AdminVerifyIssueQuestion>): AdminVerifyIssueQuestion {
  return {
    task_id: "t-1",
    severity: "warning",
    source_text: "",
    issue_summary: "",
    admin_question: "",
    answer_mode: "free_text",
    affected_paths: [],
    evidence_paths: [],
    requires_llm_resolution: true,
    ...partial,
  };
}

describe("PR-22 humanizeIssue — concrete object & specific question", () => {
  it("generic warning surfaces source_text and asks classification, not 'apa penjelasannya'", () => {
    const q = task({
      severity: "warning",
      source_text: "Bonus 100% berlaku semua provider kecuali ini",
    });
    const h = humanizeIssue(q, makeRec());
    expect(h.objectValue).toContain("Bonus 100%");
    expect(h.mainQuestion).toMatch(/diperlakukan sebagai apa/i);
    expect(h.mainQuestion).not.toMatch(/apa penjelasan yang benar/i);
    expect(h.options?.length ?? 0).toBeGreaterThan(0);
    expect(h.shouldRenderAsAdminQuestion).toBe(true);
  });

  it("contradiction asks 'bagian mana yang harus dijadikan acuan'", () => {
    const q = task({
      severity: "contradiction",
      source_text: "Tabel bilang 100%, S&K bilang 50%.",
    });
    const h = humanizeIssue(q, makeRec());
    expect(h.mainQuestion).toMatch(/bagian mana yang harus dijadikan acuan/i);
    expect(h.objectValue).toContain("Tabel bilang");
    expect(h.options?.some((o) => o.value === "trust_variant_table")).toBe(true);
  });

  it("rule_type asks 'Promo ini bisa diklaim dalam kondisi apa' and shows trigger context", () => {
    const q = task({
      severity: "contradiction",
      affected_paths: ["trigger_engine.trigger_rule_block.rule_type"],
      source_text: "rule_type=first_deposit_only",
    });
    const h = humanizeIssue(q, makeRec());
    expect(h.mainQuestion).toMatch(/dalam kondisi apa/i);
    const ctxKeys = (h.contextLines ?? []).map((c) => c.key);
    expect(ctxKeys).toContain("Trigger");
    expect(ctxKeys).toContain("Kondisi");
    expect(h.options?.some((o) => o.value === "conditional")).toBe(true);
    // Internal enum NOT shown as label main copy.
    expect(h.options?.find((o) => o.value === "conditional")?.label).not.toBe(
      "conditional",
    );
  });

  it("turnover_rule_format shows variant_name and current value", () => {
    const q = task({
      severity: "contradiction",
      affected_paths: [
        "variant_engine.items_block.subcategories[0].turnover_rule_format",
      ],
    });
    const h = humanizeIssue(q, makeRec());
    expect(h.objectValue).toBe("Slot 100%");
    expect(h.contextLines?.[0]?.value).toBe("(D+B)*20");
    expect(h.mainQuestion).toMatch(/dihitung dengan cara apa/i);
    expect(h.options?.some((o) => o.value === "multiplier")).toBe(true);
  });

  it("currency asks 'Mata uang yang dipakai promo ini apa' and shows current value", () => {
    const q = task({
      severity: "warning",
      affected_paths: ["reward_engine.currency"],
    });
    const h = humanizeIssue(q, makeRec());
    expect(h.objectValue).toBe("Rupiah");
    expect(h.mainQuestion).toMatch(/mata uang yang dipakai/i);
    expect(h.options?.some((o) => o.value === "IDR")).toBe(true);
  });

  it("generic issue without source_text falls back to debug-style (shouldRender=false)", () => {
    const q = task({ severity: "warning", source_text: "" });
    const h = humanizeIssue(q, makeRec());
    expect(h.shouldRenderAsAdminQuestion).toBe(false);
  });

  it("never mutates the record (frozen snapshot stays equal)", () => {
    const rec = makeRec();
    const before = JSON.stringify(rec);
    humanizeIssue(
      task({
        affected_paths: ["trigger_engine.trigger_rule_block.rule_type"],
      }),
      rec,
    );
    expect(JSON.stringify(rec)).toBe(before);
  });
});
