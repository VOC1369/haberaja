/**
 * Field-key → canonical V.10.1 path routing tests.
 *
 * Locks the 5 acceptance test cases:
 *   1. issue.field_key = "valid_until" → registry question used
 *   2. issue.affected_paths includes min_deposit path → registry question used
 *   3. issue without field_key/path → generic free-text card
 *   4. source_text contains "tanggal" but NO field_key/path → still generic
 *      (no wording inference)
 *   5. path known but FIELD_REGISTRY has no entry → "belum punya template"
 */
import { describe, it, expect } from "vitest";
import type { PkV10Record } from "../schema/pk-v10";
import type { AdminVerifyIssueQuestion } from "../admin-verify/extractor-issue-adapter";
import { humanizeIssue } from "../admin-verify/humanize-issue";
import {
  resolveCanonicalPath,
  findFieldKeyToken,
  FIELD_KEY_TO_PATH,
} from "../admin-verify/field-key-path-map";

function makeRec(): PkV10Record {
  return {
    domain: "promo_knowledge",
    record_id: "pk_test_routing",
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
      validation_block: { warnings: [], status: "draft" },
      observability_block: { ambiguity_flags: [], contradiction_flags: [] },
      state_block: { state: "draft" },
    },
  } as unknown as PkV10Record;
}

function task(p: Partial<AdminVerifyIssueQuestion>): AdminVerifyIssueQuestion {
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
    ...p,
  };
}

describe("field-key-path-map — pure resolver", () => {
  it("resolves via affected_paths first", () => {
    expect(
      resolveCanonicalPath({ affected_paths: ["scope_engine.geo_block.geo_restriction"] }),
    ).toBe("scope_engine.geo_block.geo_restriction");
  });

  it("resolves via field_key when no path", () => {
    expect(resolveCanonicalPath({ field_key: "valid_until" })).toBe(
      FIELD_KEY_TO_PATH.valid_until,
    );
  });

  it("resolves via canonical token in source_text (boundary-checked)", () => {
    expect(
      resolveCanonicalPath({
        source_text: "Tanggal akhir event tidak disebutkan, perlu konfirmasi periode valid_until",
      }),
    ).toBe(FIELD_KEY_TO_PATH.valid_until);
  });

  it("does NOT match wording — 'tanggal' alone resolves to null", () => {
    expect(resolveCanonicalPath({ source_text: "Tanggal akhir tidak jelas" })).toBeNull();
  });

  it("findFieldKeyToken respects word boundaries", () => {
    expect(findFieldKeyToken("xvalid_untilx")).toBeNull();
    expect(findFieldKeyToken("foo valid_until bar")).toBe("valid_until");
    expect(findFieldKeyToken('"valid_until"')).toBe("valid_until");
  });

  it("returns null for empty / null", () => {
    expect(resolveCanonicalPath({})).toBeNull();
    expect(findFieldKeyToken(null)).toBeNull();
    expect(findFieldKeyToken("")).toBeNull();
  });
});

describe("humanizeIssue — path-first routing", () => {
  it("Test 1: field_key=valid_until → uses FIELD_REGISTRY question", () => {
    const h = humanizeIssue(task({ field_key: "valid_until" }), makeRec());
    expect(h.shouldRenderAsAdminQuestion).toBe(true);
    expect(h.mainQuestion).toBe("Sampai kapan promo ini berlaku?");
    const labels = (h.options ?? []).map((o) => o.label);
    expect(labels).toContain("Tidak ada batas waktu");
    expect(labels).toContain("Tanggal tertentu");
    expect(labels).toContain("Tidak disebutkan di sumber");
    expect(labels).toContain("Jelaskan manual");
    // Bukan generic bucket
    expect(labels).not.toContain("Masuk ke Syarat & Ketentuan");
  });

  it("Test 2: affected_paths=[min_deposit path] → uses FIELD_REGISTRY question", () => {
    const h = humanizeIssue(
      task({ affected_paths: ["reward_engine.requirement_block.min_deposit"] }),
      makeRec(),
    );
    expect(h.shouldRenderAsAdminQuestion).toBe(true);
    expect(h.mainQuestion).toBe("Minimum deposit untuk eligible?");
    const labels = (h.options ?? []).map((o) => o.label);
    expect(labels).toContain("Tidak disebutkan di sumber");
    expect(labels).toContain("Jelaskan manual");
    expect(labels).not.toContain("Masuk ke Syarat & Ketentuan");
  });

  it("Test 3: no field/path → operational resolution bucket (NOT evidence-classification)", () => {
    const h = humanizeIssue(
      task({ source_text: "Sesuatu yang tidak terkait field manapun." }),
      makeRec(),
    );
    expect(h.mainQuestion).toMatch(/keputusan admin|mana yang harus dipakai/i);
    expect(h.mainQuestion).not.toMatch(/diperlakukan sebagai apa/i);
    const labels = (h.options ?? []).map((o) => o.label);
    expect(labels).not.toContain("Masuk ke Syarat & Ketentuan");
    expect(labels).not.toContain("Masuk ke cara klaim");
    expect(labels).toContain("Gunakan data seperti yang tertulis");
  });

  it("Test 4: source_text has 'tanggal' but NO field_key/path → still generic (no inference)", () => {
    const h = humanizeIssue(
      task({ source_text: "Tanggal akhir event tidak disebutkan." }),
      makeRec(),
    );
    // 'tanggal' is wording, NOT a canonical field key → must not auto-route to valid_until.
    expect(h.mainQuestion).not.toBe("Sampai kapan promo ini berlaku?");
  });

  it("Test 5: path known but no FIELD_REGISTRY entry → debug card", () => {
    const h = humanizeIssue(
      task({ affected_paths: ["meta_engine.source_block.raw_content"] }),
      makeRec(),
    );
    expect(h.shouldRenderAsAdminQuestion).toBe(false);
    expect(h.title).toMatch(/belum punya template/i);
  });
});
