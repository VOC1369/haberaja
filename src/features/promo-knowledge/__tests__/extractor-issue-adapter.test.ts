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
  dedupIssueQuestions,
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

  // ──────────────────────────────────────────────────────────────────
  // Cross-bucket dedup (contradiction > ambiguity > warning)
  // ──────────────────────────────────────────────────────────────────
  describe("cross-bucket dedup", () => {
    it("collapses duplicate warning + contradiction into one contradiction", () => {
      const text =
        "S&K khusus SLOT tidak konsisten dengan tabel CASINO/SPORTS";
      const rec = buildRec({
        warnings: [text],
        contradictions: [text],
      });
      const issues = collectExtractorIssues(rec);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe("contradiction");

      const qs = buildIssueQuestions(rec);
      expect(qs).toHaveLength(1);
      expect(qs[0].severity).toBe("contradiction");
    });

    it("collapses duplicate ambiguity + warning into ambiguity", () => {
      const text = "Periode promo tidak jelas";
      const rec = buildRec({
        warnings: [text],
        ambiguity: [text],
      });
      const issues = collectExtractorIssues(rec);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe("ambiguity");
    });

    it("dedup is whitespace + case insensitive", () => {
      const rec = buildRec({
        warnings: ["  Foo   bar BAZ  "],
        contradictions: ["foo bar baz"],
      });
      const issues = collectExtractorIssues(rec);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe("contradiction");
    });

    it("dedup strips leading dotted.path prefix", () => {
      const rec = buildRec({
        warnings: ["reward_engine.currency: nilai tidak dikenali"],
        contradictions: ["nilai tidak dikenali"],
      });
      const issues = collectExtractorIssues(rec);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe("contradiction");
    });

    it("keeps distinct issues separate when text differs", () => {
      const rec = buildRec({
        warnings: ["Periode promo tidak jelas"],
        contradictions: [
          "S&K khusus SLOT tidak konsisten dengan tabel CASINO/SPORTS",
        ],
      });
      const issues = collectExtractorIssues(rec);
      expect(issues).toHaveLength(2);
      const sevs = issues.map((i) => i.severity).sort();
      expect(sevs).toEqual(["contradiction", "warning"]);
    });

    it("regression — SLOT vs CASINO/SPORTS double-emit produces ONE card", () => {
      const factual =
        "S&K point 3 menyebut 'Bonus diberikan khusus permainan SLOT', " +
        "namun tabel bonus mencakup CASINO dan SPORTS. " +
        "Kontradiksi antara S&K dan tabel bonus.";
      const rec = buildRec({
        warnings: [factual],
        contradictions: [factual],
      });
      const qs = buildIssueQuestions(rec);
      expect(qs).toHaveLength(1);
      expect(qs[0].severity).toBe("contradiction");
      expect(qs[0].source_text).toBe(factual);
    });

    it("clean record stays empty (no template regression)", () => {
      expect(collectExtractorIssues(buildRec())).toEqual([]);
      expect(buildIssueQuestions(buildRec())).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Final-pass dedup (extractor + F3 merge)
  // ──────────────────────────────────────────────────────────────────
  describe("dedupIssueQuestions (final pass)", () => {
    const mk = (
      task_id: string,
      severity: AdminVerifyIssueQuestion["severity"],
      source_text: string,
      affected_paths: string[] = [],
    ): AdminVerifyIssueQuestion => ({
      task_id,
      severity,
      source_text,
      issue_summary: "x",
      admin_question: "x",
      answer_mode: "free_text",
      affected_paths,
      evidence_paths: [],
      requires_llm_resolution: true,
    });

    it("collapses extractor + F3 about the same canonical path into ONE card", () => {
      const path = "variant_engine.items_block.subcategories[2].turnover_rule_format";
      const a = mk("ex-1", "warning", "Aturan turnover varian 2 perlu cek", [path]);
      const b = mk(
        "f3-turnover_rule_format_2-xx",
        "contradiction",
        `Path: ${path}\nNilai saat ini: (D+B) x 8\nAllowed F3 V.10.2: [multiplier, min_rupiah]`,
        [path],
      );
      const out = dedupIssueQuestions([a, b]);
      expect(out).toHaveLength(1);
      expect(out[0].severity).toBe("contradiction");
      expect(out[0].affected_paths[0]).toBe(path);
    });

    it("collapses path-less items when one text is contained in the other", () => {
      const a = mk("c1", "contradiction", "S&K SLOT vs tabel CASINO/SPORTS");
      const b = mk(
        "w1",
        "warning",
        "Catatan: S&K SLOT vs tabel CASINO/SPORTS — tidak konsisten",
      );
      const out = dedupIssueQuestions([a, b]);
      expect(out).toHaveLength(1);
      expect(out[0].severity).toBe("contradiction");
    });

    it("keeps genuinely distinct path-less items separate", () => {
      const a = mk("c1", "contradiction", "Periode promo tidak jelas");
      const b = mk("c2", "contradiction", "Mata uang tidak disebut");
      const out = dedupIssueQuestions([a, b]);
      expect(out).toHaveLength(2);
    });

    it("regression — SLOT vs CASINO/SPORTS triple-emit yields ONE card", () => {
      const text =
        "S&K khusus SLOT tidak konsisten dengan tabel CASINO/SPORTS";
      const items = [
        mk("c-1", "contradiction", text),
        mk("w-1", "warning", `Catatan: ${text}`),
        mk("a-1", "ambiguity", text),
      ];
      const out = dedupIssueQuestions(items);
      expect(out).toHaveLength(1);
      expect(out[0].severity).toBe("contradiction");
    });

    it("regression — SLOT vs CASINO/SPORTS 3 paraphrases yield ONE card", () => {
      const t1 =
        "S&K poin 3 menyebut 'Bonus diberikan khusus permainan SLOT' " +
        "namun tabel bonus mencakup CASINO dan SPORTS. Kemungkinan " +
        "kontradiksi atau S&K poin 3 hanya berlaku untuk varian tertentu.";
      const t2 =
        "Header promo menyebut 'UP TO RP 15.000.000' yang sesuai dengan " +
        "max bonus varian SLOT 30%, namun S&K poin 3 menyatakan 'Bonus " +
        "diberikan khusus permainan SLOT' sementara tabel bonus mencakup " +
        "CASINO dan SPORTS juga. Tidak jelas apakah S&K poin 3 adalah " +
        "kesalahan atau hanya berlaku untuk subset tertentu.";
      const t3 =
        "Terdapat inkonsistensi antara S&K poin 3 ('Bonus diberikan khusus " +
        "permainan SLOT') dengan keberadaan varian CASINO dan SPORTS di " +
        "tabel bonus. Perlu klarifikasi apakah S&K poin 3 adalah kesalahan " +
        "copy-paste atau memang ada pembatasan tambahan.";
      const items = [
        mk("a-1", "ambiguity", t1),
        mk("c-1", "contradiction", t2),
        mk("w-1", "warning", t3),
      ];
      const out = dedupIssueQuestions(items);
      expect(out).toHaveLength(1);
      expect(out[0].severity).toBe("contradiction");
    });

    it("does NOT fold short distinct messages with low token overlap", () => {
      const a = mk("c1", "contradiction", "Periode promo tidak jelas tanggal hilang");
      const b = mk("c2", "warning", "Mata uang reward tidak disebut di promo");
      const out = dedupIssueQuestions([a, b]);
      expect(out).toHaveLength(2);
    });
  });
});
