/**
 * PR-21 — Structural Supabase write gate + review issue summary +
 * acknowledgement-aware publishRecord tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase client used by publishRecord/unpublishRecord.
const upsertSingle = vi.fn();
const updateSingle = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (_table: string) => ({
      upsert: (_rows: unknown[], _opts: unknown) => ({
        select: () => ({ single: () => upsertSingle() }),
      }),
      update: (_patch: unknown) => ({
        eq: (_c: string, _v: string) => ({
          select: () => ({ single: () => updateSingle() }),
        }),
      }),
    }),
  },
}));

import {
  canPublish,
  canWriteToSupabase,
  getPublishReviewIssues,
  publishRecord,
  unpublishRecord,
} from "../supabase-publish";
import { createInertPkV10Record } from "@/features/promo-knowledge/schema/pk-v10";

function structurallyValidRecord() {
  const rec = createInertPkV10Record("rec_pr21");
  rec.identity_engine.client_block.client_id = "Liveboard";
  rec.identity_engine.promo_block.promo_name = "Welcome 100%";
  rec.meta_engine.source_block.raw_content = "<html>...</html>";
  rec.ai_confidence = { "reward_engine.currency": 0.9 };
  rec._field_status = { "identity_engine.promo_block.promo_name": "explicit" };
  return rec;
}

function happyRecord() {
  const rec = structurallyValidRecord();
  rec.readiness_engine.observability_block.review_required = false;
  rec.readiness_engine.validation_block.status = "ok";
  rec.readiness_engine.commit_block.ready_to_commit = true;
  return rec;
}

beforeEach(() => {
  upsertSingle.mockReset();
  updateSingle.mockReset();
});

describe("canWriteToSupabase — structural gate", () => {
  it("passes even if review_required = true", () => {
    const r = structurallyValidRecord();
    r.readiness_engine.observability_block.review_required = true;
    expect(canWriteToSupabase(r).ok).toBe(true);
  });

  it("passes even if ready_to_commit = false", () => {
    const r = structurallyValidRecord();
    r.readiness_engine.commit_block.ready_to_commit = false;
    expect(canWriteToSupabase(r).ok).toBe(true);
  });

  it("passes even if warnings/contradictions/ambiguity exist", () => {
    const r = structurallyValidRecord();
    r.readiness_engine.validation_block.warnings = ["w1"];
    r.readiness_engine.observability_block.ambiguity_flags = ["a1"];
    r.readiness_engine.observability_block.contradiction_flags = ["c1"];
    expect(canWriteToSupabase(r).ok).toBe(true);
  });

  it("fails if record_id missing", () => {
    const r = structurallyValidRecord();
    r.record_id = "";
    const res = canWriteToSupabase(r);
    expect(res.ok).toBe(false);
    expect(res.reasons.join("|")).toMatch(/record_id/);
  });

  it("fails if raw_content missing", () => {
    const r = structurallyValidRecord();
    r.meta_engine.source_block.raw_content = "";
    expect(canWriteToSupabase(r).ok).toBe(false);
  });

  it("fails if variant_engine missing", () => {
    const r = structurallyValidRecord() as unknown as Record<string, unknown>;
    delete r.variant_engine;
    expect(canWriteToSupabase(r).ok).toBe(false);
  });

  it("fails on null/non-object", () => {
    expect(canWriteToSupabase(null).ok).toBe(false);
    expect(canWriteToSupabase("x").ok).toBe(false);
  });
});

describe("canPublish — strict gate remains strict", () => {
  it("still fails on review_required = true", () => {
    const r = happyRecord();
    r.readiness_engine.observability_block.review_required = true;
    expect(canPublish(r).ok).toBe(false);
  });

  it("still fails on ready_to_commit = false", () => {
    const r = happyRecord();
    r.readiness_engine.commit_block.ready_to_commit = false;
    expect(canPublish(r).ok).toBe(false);
  });
});

describe("getPublishReviewIssues", () => {
  it("returns hasIssues=false on clean record", () => {
    const r = happyRecord();
    expect(getPublishReviewIssues(r).hasIssues).toBe(false);
  });

  it("flags review_required and ready_to_commit and warnings", () => {
    const r = happyRecord();
    r.readiness_engine.observability_block.review_required = true;
    r.readiness_engine.commit_block.ready_to_commit = false;
    r.readiness_engine.validation_block.warnings = ["w1", "w2"];
    r.readiness_engine.observability_block.contradiction_flags = ["c1"];
    const out = getPublishReviewIssues(r);
    expect(out.hasIssues).toBe(true);
    expect(out.counts.warnings).toBe(2);
    expect(out.counts.contradictions).toBe(1);
    expect(out.reviewRequired).toBe(true);
    expect(out.readyToCommit).toBe(false);
  });
});

describe("publishRecord — acknowledgement-aware", () => {
  it("blocks publish with review issues without acknowledgement", async () => {
    const r = structurallyValidRecord();
    r.readiness_engine.observability_block.review_required = true;
    const res = await publishRecord(r, "admin@x", {
      adminAcknowledgedReviewIssues: false,
    });
    expect(res.ok).toBe(false);
    expect((res.reasons ?? []).join("|")).toMatch(/acknowledgement required/);
    expect(upsertSingle).not.toHaveBeenCalled();
  });

  it("allows publish with review issues when acknowledged, writing full record_json", async () => {
    upsertSingle.mockResolvedValue({ data: { record_id: "rec_pr21" }, error: null });
    const r = structurallyValidRecord();
    r.readiness_engine.observability_block.review_required = true;
    r.readiness_engine.commit_block.ready_to_commit = false;
    r.readiness_engine.validation_block.warnings = ["w1"];
    const before = JSON.parse(JSON.stringify(r));
    const res = await publishRecord(r, "admin@x", {
      adminAcknowledgedReviewIssues: true,
    });
    expect(res.ok).toBe(true);
    expect(upsertSingle).toHaveBeenCalledTimes(1);
    // Record was not mutated by publish
    expect(r).toEqual(before);
  });

  it("blocks publish when structural gate fails, even with acknowledgement", async () => {
    const r = structurallyValidRecord();
    r.record_id = "";
    const res = await publishRecord(r, "admin@x", {
      adminAcknowledgedReviewIssues: true,
    });
    expect(res.ok).toBe(false);
    expect(upsertSingle).not.toHaveBeenCalled();
  });

  it("legacy call (no options) still uses strict canPublish", async () => {
    const r = structurallyValidRecord();
    r.readiness_engine.observability_block.review_required = true;
    const res = await publishRecord(r, "admin@x");
    expect(res.ok).toBe(false);
    expect(upsertSingle).not.toHaveBeenCalled();
  });
});

describe("unpublishRecord", () => {
  it("calls update without touching record_json", async () => {
    updateSingle.mockResolvedValue({ data: { record_id: "rec_pr21", is_published: false }, error: null });
    const res = await unpublishRecord("rec_pr21");
    expect(res.ok).toBe(true);
    expect(updateSingle).toHaveBeenCalledTimes(1);
  });
});
