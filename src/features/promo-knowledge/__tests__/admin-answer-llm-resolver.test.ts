/**
 * PR-19C — Live LLM resolver tests (mocked ai-client).
 * Locks: no JSON mutation, allowedTargetPaths enforcement, ambiguous→clarify,
 * LLM failure surfaces error, no regex over warning text in source.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PkV10Record } from "../schema/pk-v10";
import type { AdminVerifyIssueQuestion } from "../admin-verify/extractor-issue-adapter";

// Mock the AI client BEFORE importing resolver.
vi.mock("@/lib/ai-client", () => {
  return {
    callAI: vi.fn(),
    extractJSON: <T>(resp: unknown) => {
      const text =
        (resp as { content?: Array<{ type: string; text: string }> })?.content
          ?.filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("\n") ?? "";
      const cleaned = text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      return JSON.parse(cleaned) as T;
    },
  };
});

import { callAI } from "@/lib/ai-client";
import { resolveAdminAnswerToPatchPreview } from "../admin-verify/admin-answer-llm-resolver";

function buildRec(): PkV10Record {
  const rec: unknown = {
    domain: "promo_knowledge",
    record_id: "pk_test_pr19c",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    meta_engine: {
      schema_block: { schema_name: "PKB_Wolfbrain", schema_version: "V.10.1", status: "ai_draft" },
      source_block: { raw_content: "RAW" },
    },
    trigger_engine: {
      trigger_rule_block: { rule_type: "first_deposit_only" },
    },
    readiness_engine: {
      validation_block: { warnings: [] },
      observability_block: { ambiguity_flags: [], contradiction_flags: [] },
    },
  };
  return rec as PkV10Record;
}

function buildTask(): AdminVerifyIssueQuestion {
  return {
    task_id: "f3-rule_type-test",
    severity: "contradiction",
    source_text: "rule_type invalid",
    issue_summary: "Jenis aturan trigger tidak sesuai F3 V.10.1.",
    admin_question: "Pilih jenis aturan yang sesuai.",
    answer_mode: "free_text",
    affected_paths: ["trigger_engine.trigger_rule_block.rule_type"],
    evidence_paths: [],
    requires_llm_resolution: true,
  };
}

function llmReply(obj: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(obj) }] };
}

beforeEach(() => {
  (callAI as unknown as ReturnType<typeof vi.fn>).mockReset();
});

describe("PR-19C resolveAdminAnswerToPatchPreview (live LLM)", () => {
  it("returns patch preview for clear admin answer", async () => {
    (callAI as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      llmReply({
        intent_summary: "Admin memilih conditional.",
        confidence: "high",
        needs_confirmation: true,
        needs_clarification: false,
        proposed_patches: [
          {
            operation: "set_value",
            target_path: "trigger_engine.trigger_rule_block.rule_type",
            old_value_preview: "first_deposit_only",
            new_value_preview: "conditional",
            reason: "Sesuai F3 V.10.1.",
          },
        ],
        unresolved_questions: [],
      }),
    );

    const rec = buildRec();
    const before = JSON.stringify(rec);
    const r = await resolveAdminAnswerToPatchPreview({
      record: rec,
      reviewTask: buildTask(),
      adminAnswer: { task_id: "x", answer_text: "Pakai conditional saja." },
      rawContentReadonly: "RAW",
      allowedTargetPaths: ["trigger_engine.trigger_rule_block.rule_type"],
    });

    expect(r.proposed_patches).toHaveLength(1);
    expect(r.proposed_patches[0].new_value_preview).toBe("conditional");
    expect(r.needs_confirmation).toBe(true);
    expect(r.needs_clarification).toBe(false);
    expect(JSON.stringify(rec)).toBe(before); // no mutation
  });

  it("returns needs_clarification when LLM signals ambiguity", async () => {
    (callAI as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      llmReply({
        intent_summary: "Jawaban tidak jelas.",
        confidence: "low",
        needs_confirmation: false,
        needs_clarification: true,
        proposed_patches: [],
        unresolved_questions: ["Sebutkan satu nilai enum."],
      }),
    );

    const r = await resolveAdminAnswerToPatchPreview({
      record: buildRec(),
      reviewTask: buildTask(),
      adminAnswer: { task_id: "x", answer_text: "ikut yang benar aja" },
      rawContentReadonly: "RAW",
      allowedTargetPaths: ["trigger_engine.trigger_rule_block.rule_type"],
    });

    expect(r.needs_clarification).toBe(true);
    expect(r.proposed_patches).toEqual([]);
    expect(r.unresolved_questions?.[0]).toMatch(/enum/i);
  });

  it("rejects patches whose target_path is outside allowedTargetPaths", async () => {
    (callAI as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      llmReply({
        intent_summary: "Admin ingin ubah field lain.",
        confidence: "medium",
        needs_confirmation: true,
        needs_clarification: false,
        proposed_patches: [
          {
            operation: "set_value",
            target_path: "meta_engine.source_block.raw_content", // FORBIDDEN
            old_value_preview: "RAW",
            new_value_preview: "HACKED",
            reason: "Try to edit raw_content.",
          },
          {
            operation: "set_value",
            target_path: "identity_engine.promo_block.promo_name", // not in whitelist
            old_value_preview: null,
            new_value_preview: "Renamed",
            reason: "Rename promo.",
          },
        ],
      }),
    );

    const rec = buildRec();
    const before = JSON.stringify(rec);
    const r = await resolveAdminAnswerToPatchPreview({
      record: rec,
      reviewTask: buildTask(),
      adminAnswer: { task_id: "x", answer_text: "ubah nama promo dan raw" },
      rawContentReadonly: "RAW",
      allowedTargetPaths: ["trigger_engine.trigger_rule_block.rule_type"],
    });

    expect(r.proposed_patches).toEqual([]);
    expect(r.needs_clarification).toBe(true);
    expect(r.unresolved_questions?.join(" ")).toMatch(/allowedTargetPaths/);
    expect(JSON.stringify(rec)).toBe(before); // no mutation
  });

  it("does not mutate record even when LLM returns valid patch", async () => {
    (callAI as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      llmReply({
        intent_summary: "ok",
        confidence: "high",
        needs_confirmation: true,
        needs_clarification: false,
        proposed_patches: [
          {
            operation: "set_value",
            target_path: "trigger_engine.trigger_rule_block.rule_type",
            old_value_preview: "first_deposit_only",
            new_value_preview: "simple",
            reason: "ok",
          },
        ],
      }),
    );
    const rec = buildRec();
    const snapshot = JSON.stringify(rec);
    await resolveAdminAnswerToPatchPreview({
      record: rec,
      reviewTask: buildTask(),
      adminAnswer: { task_id: "x", answer_text: "simple" },
      rawContentReadonly: "RAW",
      allowedTargetPaths: ["trigger_engine.trigger_rule_block.rule_type"],
    });
    expect(JSON.stringify(rec)).toBe(snapshot);
    // Confirm rule_type still original
    expect(rec.trigger_engine?.trigger_rule_block?.rule_type).toBe("first_deposit_only");
  });

  it("propagates LLM transport failure (caller must show hard error)", async () => {
    (callAI as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("AI proxy error: 503 OVERLOADED"),
    );
    const rec = buildRec();
    const snapshot = JSON.stringify(rec);

    await expect(
      resolveAdminAnswerToPatchPreview({
        record: rec,
        reviewTask: buildTask(),
        adminAnswer: { task_id: "x", answer_text: "conditional" },
        rawContentReadonly: "RAW",
        allowedTargetPaths: ["trigger_engine.trigger_rule_block.rule_type"],
      }),
    ).rejects.toThrow(/AI proxy error/);

    expect(JSON.stringify(rec)).toBe(snapshot); // no mutation on failure
  });

  it("malformed LLM JSON throws (no silent fallback)", async () => {
    (callAI as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: [{ type: "text", text: "not json at all" }],
    });
    await expect(
      resolveAdminAnswerToPatchPreview({
        record: buildRec(),
        reviewTask: buildTask(),
        adminAnswer: { task_id: "x", answer_text: "conditional" },
        rawContentReadonly: "RAW",
        allowedTargetPaths: ["trigger_engine.trigger_rule_block.rule_type"],
      }),
    ).rejects.toBeInstanceOf(Error);
  });

  it("empty admin answer short-circuits without calling LLM", async () => {
    const r = await resolveAdminAnswerToPatchPreview({
      record: buildRec(),
      reviewTask: buildTask(),
      adminAnswer: { task_id: "x", answer_text: "   " },
      rawContentReadonly: "RAW",
      allowedTargetPaths: ["trigger_engine.trigger_rule_block.rule_type"],
    });
    expect(r.needs_clarification).toBe(true);
    expect(r.proposed_patches).toEqual([]);
    expect(callAI).not.toHaveBeenCalled();
  });

  it("source has no regex over warning/contradiction free text", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(
      "src/features/promo-knowledge/admin-verify/admin-answer-llm-resolver.ts",
      "utf8",
    );
    expect(/\.test\(\s*(source_text|warning|raw_content|contradiction)/i.test(src)).toBe(false);
    // Must NOT silently fall back to mocked resolver.
    expect(/mockedAdminAnswer/i.test(src)).toBe(false);
  });
});
