/**
 * PR-18 — Extractor Issue Adapter contract tests.
 *
 * These tests lock the contract:
 *   - Extractor flags (warnings / ambiguity_flags / contradiction_flags) at
 *     readiness_engine.* become AdminVerifyIssueQuestion candidates.
 *   - Adapter does NOT use regex / keyword matching.
 *   - Mocked resolver returns a preview that is NEVER auto-applied.
 *   - Calling the resolver does NOT mutate the record.
 *   - raw_content is never edited by adapter or resolver.
 */
import { describe, it, expect } from "vitest";
import {
  collectExtractorIssues,
  buildIssueQuestions,
  mockedAdminAnswerResolver,
  type AdminVerifyIssueQuestion,
} from "../admin-verify/extractor-issue-adapter";
import type { PkV10Record } from "../schema/pk-v10";

function buildRec(overrides: Partial<{
  warnings: string[];
  ambiguity: string[];
  contradictions: string[];
}> = {}): PkV10Record {
  const rec: unknown = {
    domain: "promo_knowledge",
    record_id: "pk_test_pr18",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    meta_engine: {
      schema_block: {
        schema_name: "PKB_Wolfbrain",
        schema_version: "V.10.1",
        status: "ai_draft",
      },
      source_block: { raw_content: "RAW_FIXTURE" },
    },
    readiness_engine: {
      validation_block: { warnings: overrides.warnings ?? [] },
      observability_block: {
        ambiguity_flags: overrides.ambiguity ?? [],
        contradiction_flags: overrides.contradictions ?? [],
      },
    },
  };
  return rec as PkV10Record;
}

describe("PR-18 extractor-issue-adapter", () => {
  it("returns no issues for a clean record", () => {
    expect(collectExtractorIssues(buildRec())).toEqual([]);
    expect(buildIssueQuestions(buildRec())).toEqual([]);
  });

  it("collects warnings / ambiguity / contradictions deterministically", () => {
    const rec = buildRec({
      warnings: ["w1"],
      ambiguity: ["a1", "a2"],
      contradictions: ["c1"],
    });
    const issues = collectExtractorIssues(rec);
    expect(issues).toHaveLength(4);
    expect(issues.map((i) => i.severity).sort()).toEqual(
      ["ambiguity", "ambiguity", "contradiction", "warning"].sort(),
    );
    // Stable task_ids
    const issues2 = collectExtractorIssues(rec);
    expect(issues2.map((i) => i.task_id)).toEqual(issues.map((i) => i.task_id));
  });

  it("question text is generic — NO keyword/regex matching", () => {
    const rec = buildRec({
      contradictions: [
        "S&K mentions SLOT but variant table has Casino/Sports/Slot",
      ],
    });
    const qs = buildIssueQuestions(rec);
    expect(qs).toHaveLength(1);
    const q = qs[0];
    // Generic copy — must NOT contain promo-specific keywords from the source.
    expect(q.admin_question.toLowerCase()).not.toContain("slot");
    expect(q.admin_question.toLowerCase()).not.toContain("casino");
    expect(q.admin_question.toLowerCase()).not.toContain("s&k");
    expect(q.requires_llm_resolution).toBe(true);
    expect(q.answer_mode).toBe("free_text");
    // Source text preserved verbatim for evidence
    expect(q.source_text).toContain("S&K mentions SLOT");
  });

  it("mocked resolver never auto-applies and returns needs_confirmation=true", async () => {
    const rec = buildRec({ warnings: ["something odd"] });
    const before = JSON.stringify(rec);
    const q = buildIssueQuestions(rec)[0];
    const result = await mockedAdminAnswerResolver({
      record: rec,
      reviewTask: q,
      adminAnswer: { task_id: q.task_id, answer_text: "Yes the table is correct." },
      rawContentReadonly: rec.meta_engine.source_block.raw_content ?? null,
      allowedTargetPaths: [],
    });
    expect(result.needs_confirmation).toBe(true);
    expect(JSON.stringify(rec)).toBe(before); // record untouched
  });

  it("mocked resolver returns needs_clarification on empty answer", async () => {
    const rec = buildRec({ warnings: ["x"] });
    const q = buildIssueQuestions(rec)[0];
    const r = await mockedAdminAnswerResolver({
      record: rec,
      reviewTask: q,
      adminAnswer: { task_id: q.task_id, answer_text: "  " },
      rawContentReadonly: null,
      allowedTargetPaths: [],
    });
    expect(r.needs_clarification).toBe(true);
    expect(r.proposed_patches).toEqual([]);
  });

  it("adapter source code contains no regex / keyword business logic", async () => {
    // Static guard — fail if anyone re-introduces keyword matching.
    const fs = await import("node:fs");
    const path = "src/features/promo-knowledge/admin-verify/extractor-issue-adapter.ts";
    const src = fs.readFileSync(path, "utf8");
    // Must not use RegExp literals over flag text
    expect(/\.test\(\s*(text|source_text|raw|str)/i.test(src)).toBe(false);
    // Must not contain promo-specific keywords as logic
    const forbidden = ["/slot/i", "/casino/i", "/sport/i", "/s&k/i"];
    for (const f of forbidden) {
      expect(src.includes(f)).toBe(false);
    }
  });

  it("buildIssueQuestions emits expected shape for each severity", () => {
    const rec = buildRec({
      warnings: ["w"],
      ambiguity: ["a"],
      contradictions: ["c"],
    });
    const qs: AdminVerifyIssueQuestion[] = buildIssueQuestions(rec);
    for (const q of qs) {
      expect(q.task_id).toMatch(/^(warning|ambiguity|contradiction)-\d+-/);
      expect(q.evidence_paths).toContain("meta_engine.source_block.raw_content");
      expect(q.requires_llm_resolution).toBe(true);
    }
  });
});
