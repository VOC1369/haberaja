import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { canPublish } from "../supabase-publish";
import { createInertPkV10Record } from "@/features/promo-knowledge/schema/pk-v10";

function happyRecord() {
  const rec = createInertPkV10Record("rec_test_1");
  rec.identity_engine.client_block.client_id = "Liveboard";
  rec.identity_engine.promo_block.promo_name = "Welcome 100%";
  rec.meta_engine.source_block.raw_content = "<html>...</html>";
  rec.readiness_engine.observability_block.review_required = false;
  rec.readiness_engine.validation_block.status = "ok";
  rec.readiness_engine.commit_block.ready_to_commit = true;
  rec.ai_confidence = { "reward_engine.currency": 0.9 };
  rec._field_status = { "identity_engine.promo_block.promo_name": "explicit" };
  return rec;
}

describe("canPublish", () => {
  it("happy path passes", () => {
    expect(canPublish(happyRecord()).ok).toBe(true);
  });

  it("missing record_id fails", () => {
    const r = happyRecord();
    r.record_id = "";
    const res = canPublish(r);
    expect(res.ok).toBe(false);
    expect(res.reasons.join("|")).toMatch(/record_id/);
  });

  it("missing client_id fails", () => {
    const r = happyRecord();
    r.identity_engine.client_block.client_id = "";
    expect(canPublish(r).ok).toBe(false);
  });

  it("missing promo_name fails", () => {
    const r = happyRecord();
    r.identity_engine.promo_block.promo_name = "";
    expect(canPublish(r).ok).toBe(false);
  });

  it("schema_version not V.10.1 fails", () => {
    const r = happyRecord() as unknown as Record<string, any>;
    r.meta_engine.schema_block.schema_version = "V.10";
    expect(canPublish(r).ok).toBe(false);
  });

  it("missing raw_content fails (uses meta_engine.source_block.raw_content)", () => {
    const r = happyRecord();
    r.meta_engine.source_block.raw_content = "";
    const res = canPublish(r);
    expect(res.ok).toBe(false);
    expect(res.reasons.join("|")).toMatch(/raw_content/);
  });

  it("missing variant_engine fails", () => {
    const r = happyRecord() as unknown as Record<string, any>;
    delete r.variant_engine;
    expect(canPublish(r).ok).toBe(false);
  });

  it("missing _field_status fails", () => {
    const r = happyRecord() as unknown as Record<string, any>;
    delete r._field_status;
    expect(canPublish(r).ok).toBe(false);
  });

  it("missing ai_confidence fails", () => {
    const r = happyRecord() as unknown as Record<string, any>;
    delete r.ai_confidence;
    expect(canPublish(r).ok).toBe(false);
  });

  it("review_required true fails", () => {
    const r = happyRecord();
    r.readiness_engine.observability_block.review_required = true;
    expect(canPublish(r).ok).toBe(false);
  });

  it("validation_status needs_review fails", () => {
    const r = happyRecord();
    r.readiness_engine.validation_block.status = "needs_review";
    expect(canPublish(r).ok).toBe(false);
  });

  it("ready_to_commit false fails", () => {
    const r = happyRecord();
    r.readiness_engine.commit_block.ready_to_commit = false;
    expect(canPublish(r).ok).toBe(false);
  });

  it("partial wizard-like state fails", () => {
    const partial = {
      record_id: "rec_partial",
      identity_engine: { client_block: { client_id: "Liveboard" } },
    };
    expect(canPublish(partial).ok).toBe(false);
  });

  it("projection-only object fails", () => {
    const proj = {
      projection_engine: { summary_block: { promo_summary: "..." } },
    };
    expect(canPublish(proj).ok).toBe(false);
  });

  it("non-object input fails", () => {
    expect(canPublish(null).ok).toBe(false);
    expect(canPublish("string").ok).toBe(false);
    expect(canPublish(123).ok).toBe(false);
  });
});
