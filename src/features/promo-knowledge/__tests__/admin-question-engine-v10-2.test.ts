/**
 * V.10.2 REBUILD — Admin Question Engine contract tests.
 *
 * Locks the post-D5 doctrine:
 *   - 0 admin question when extractor emits zero flags / no F3 issue,
 *     no matter how many fields are null.
 *   - Questions ONLY come from:
 *       readiness_engine.validation_block.warnings[]
 *       readiness_engine.observability_block.ambiguity_flags[]
 *       readiness_engine.observability_block.contradiction_flags[]
 *       F3 V.10.2 invalid enum / shape
 *   - Extractor source_text is preserved verbatim on the issue.
 *   - Provider null with zero flags → no provider question.
 *
 * No regex / keyword logic. No FIELD_REGISTRY iteration. No null-check
 * question generator. No "Field tidak disebutkan" template.
 */
import { describe, it, expect } from "vitest";
import { buildIssueQuestions } from "../admin-verify/extractor-issue-adapter";
import { buildF3ComplianceQuestions } from "../admin-verify/f3-compliance-adapter";
import type { PkV10Record } from "../schema/pk-v10";

function makeRecord(overrides?: {
  warnings?: string[];
  ambiguity?: string[];
  contradictions?: string[];
  currency?: string | null;
  state?: string;
}): PkV10Record {
  const rec: unknown = {
    domain: "promo_knowledge",
    record_id: "pk_test_v10_2",
    created_at: "2026-05-16T00:00:00.000Z",
    updated_at: "2026-05-16T00:00:00.000Z",
    meta_engine: {
      schema_block: {
        schema_name: "PKB_Wolfbrain",
        schema_version: "V.10.2",
        status: "ai_draft",
      },
      source_block: { raw_content: null },
    },
    identity_engine: { promo_block: { promo_name: null } },
    scope_engine: {
      game_block: { game_domain: null, eligible_providers: [] },
      blacklist_block: { providers: [] },
    },
    reward_engine: { currency: overrides?.currency ?? null },
    trigger_engine: { trigger_rule_block: { rule_type: null } },
    variant_engine: { items_block: { subcategories: [] } },
    readiness_engine: {
      state_block: { state: overrides?.state ?? "draft" },
      validation_block: {
        status: "draft",
        warnings: overrides?.warnings ?? [],
      },
      observability_block: {
        ambiguity_flags: overrides?.ambiguity ?? [],
        contradiction_flags: overrides?.contradictions ?? [],
      },
    },
  };
  return rec as PkV10Record;
}

function allQuestions(rec: PkV10Record) {
  return [...buildIssueQuestions(rec), ...buildF3ComplianceQuestions(rec)];
}

describe("V.10.2 Admin Question Engine — reasoning-only", () => {
  it("clean record (all nulls, zero flags) → 0 questions", () => {
    const rec = makeRecord();
    expect(allQuestions(rec)).toHaveLength(0);
  });

  it("warning → question generated with extractor source_text preserved", () => {
    const rec = makeRecord({
      warnings: ["Tabel varian menyebut SLOT, tapi S&K hanya Sports."],
    });
    const qs = allQuestions(rec);
    const warning = qs.find((q) => q.severity === "warning");
    expect(warning).toBeDefined();
    expect(warning!.source_text).toBe(
      "Tabel varian menyebut SLOT, tapi S&K hanya Sports.",
    );
  });

  it("ambiguity → question generated with extractor source_text preserved", () => {
    const rec = makeRecord({
      ambiguity: ["Periode promo tidak menyebut tahun."],
    });
    const qs = allQuestions(rec);
    const amb = qs.find((q) => q.severity === "ambiguity");
    expect(amb).toBeDefined();
    expect(amb!.source_text).toBe("Periode promo tidak menyebut tahun.");
  });

  it("contradiction → critical question generated, source_text preserved", () => {
    const rec = makeRecord({
      contradictions: ["Tabel: TO 5x. S&K: TO 10x."],
    });
    const qs = allQuestions(rec);
    const contra = qs.find((q) => q.severity === "contradiction");
    expect(contra).toBeDefined();
    expect(contra!.source_text).toBe("Tabel: TO 5x. S&K: TO 10x.");
  });

  it("provider whitelist empty, zero flags → no provider question", () => {
    const rec = makeRecord();
    const qs = allQuestions(rec);
    const providerHits = qs.filter((q) =>
      q.affected_paths.some(
        (p) =>
          p === "scope_engine.game_block.eligible_providers" ||
          p === "scope_engine.blacklist_block.providers",
      ),
    );
    expect(providerHits).toHaveLength(0);
  });

  it("F3 currency shape check is NOT regex-driven", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(
      "src/features/promo-knowledge/admin-verify/f3-compliance-adapter.ts",
      "utf8",
    );
    expect(src.includes("/^[A-Z]{3}$/")).toBe(false);
    // valid shape passes silently
    const valid = makeRecord({ currency: "IDR" });
    expect(
      buildF3ComplianceQuestions(valid).some((q) =>
        q.affected_paths.includes("reward_engine.currency"),
      ),
    ).toBe(false);
    // malformed shape surfaces a question
    const bad = makeRecord({ currency: "idr" });
    expect(
      buildF3ComplianceQuestions(bad).some((q) =>
        q.affected_paths.includes("reward_engine.currency"),
      ),
    ).toBe(true);
  });

  it("AdminVerifySection does NOT runtime-import readGapsFromJson", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(
      "src/features/promo-knowledge/admin-verify/AdminVerifySection.tsx",
      "utf8",
    );
    expect(src.includes("readGapsFromJson")).toBe(false);
  });

  it("F3 enum labels reference V.10.2 (no V.10.1 leftover in source_text)", async () => {
    const rec = makeRecord({ state: "garbage_state" });
    const qs = buildF3ComplianceQuestions(rec);
    const stateQ = qs.find((q) =>
      q.affected_paths.includes("readiness_engine.state_block.state"),
    );
    expect(stateQ).toBeDefined();
    expect(stateQ!.source_text).toContain("F3 V.10.2");
    expect(stateQ!.source_text).not.toContain("V.10.1");
  });
});
