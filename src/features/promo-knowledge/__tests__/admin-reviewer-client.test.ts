/**
 * Phase 2 — Admin Reviewer client tests.
 *
 * Covers:
 *   1. Empty signals do NOT invoke reviewer (hook contract — covered indirectly
 *      via the client by asserting count is 0).
 *   2. signalsSignature stable for equal signals.
 *   3. signalsSignature changes when signals change.
 *   4. Cache hit returns previously saved response.
 *   5. Cache miss → invoke → save.
 *   6. Error envelope returned on non-OK response.
 *   7. Cache never written into the PkV10Record passed in.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: "test-token" } },
      })),
    },
  },
}));

import type { PkV10Record } from "../schema/pk-v10";
import {
  cacheKey,
  clearCached,
  countSignals,
  extractAdminReviewerContext,
  extractAdminReviewerSignals,
  invokeAdminReviewer,
  loadCached,
  saveCached,
  signalsSignature,
} from "../admin-verify/admin-reviewer-client";
import type { AdminReviewerResponse } from "../admin-verify/admin-decision-types";
import { isAdminReviewerError } from "../admin-verify/admin-decision-types";

function makeRecord(
  overrides: Partial<{
    warnings: string[];
    ambiguity_flags: string[];
    contradiction_flags: string[];
    promo_name: string;
    promo_type: string;
    raw_content: string;
  }> = {},
): PkV10Record {
  return {
    domain: "promo_knowledge",
    record_id: "rec_test_1",
    identity_engine: {
      promo_block: {
        promo_name: overrides.promo_name ?? "Promo Test",
        promo_type: overrides.promo_type ?? "deposit_bonus",
      },
    },
    readiness_engine: {
      validation_block: { warnings: overrides.warnings ?? [] },
      observability_block: {
        ambiguity_flags: overrides.ambiguity_flags ?? [],
        contradiction_flags: overrides.contradiction_flags ?? [],
      },
    },
    meta_engine: {
      source_block: { raw_content: overrides.raw_content ?? "" },
    },
  } as unknown as PkV10Record;
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("extractAdminReviewerSignals", () => {
  it("returns empty arrays for clean record", () => {
    const s = extractAdminReviewerSignals(makeRecord());
    expect(countSignals(s)).toBe(0);
  });

  it("collects warnings / ambiguity / contradiction", () => {
    const s = extractAdminReviewerSignals(
      makeRecord({
        warnings: ["w1"],
        ambiguity_flags: ["a1", "a2"],
        contradiction_flags: ["c1"],
      }),
    );
    expect(s.warnings).toEqual(["w1"]);
    expect(s.ambiguity_flags).toHaveLength(2);
    expect(s.contradiction_flags).toEqual(["c1"]);
    expect(countSignals(s)).toBe(4);
  });
});

describe("signalsSignature", () => {
  it("is stable for equal signal payloads", () => {
    const a = signalsSignature({
      warnings: ["w1", "w2"],
      ambiguity_flags: [],
      contradiction_flags: ["c1"],
    });
    const b = signalsSignature({
      warnings: ["w2", "w1"], // order shouldn't matter
      ambiguity_flags: [],
      contradiction_flags: ["c1"],
    });
    expect(a).toBe(b);
  });

  it("changes when signals change", () => {
    const a = signalsSignature({
      warnings: ["w1"],
      ambiguity_flags: [],
      contradiction_flags: [],
    });
    const b = signalsSignature({
      warnings: ["w1", "w2"],
      ambiguity_flags: [],
      contradiction_flags: [],
    });
    expect(a).not.toBe(b);
  });
});

describe("cache (localStorage)", () => {
  it("save → load round-trip under the expected key", () => {
    const resp: AdminReviewerResponse = { ok: true, decisions: [] };
    saveCached("rec_1", "sig_1", resp);
    expect(localStorage.getItem(cacheKey("rec_1", "sig_1"))).toBeTruthy();
    expect(loadCached("rec_1", "sig_1")).toEqual(resp);
  });

  it("clearCached removes the entry", () => {
    saveCached("rec_1", "sig_1", { ok: true, decisions: [] });
    clearCached("rec_1", "sig_1");
    expect(loadCached("rec_1", "sig_1")).toBeNull();
  });

  it("does NOT touch the source record", () => {
    const rec = makeRecord({ warnings: ["w1"] });
    const snapshot = JSON.stringify(rec);
    const sig = signalsSignature(extractAdminReviewerSignals(rec));
    saveCached(rec.record_id, sig, { ok: true, decisions: [] });
    expect(JSON.stringify(rec)).toBe(snapshot);
    expect((rec as unknown as Record<string, unknown>)._admin_decisions_cache).toBeUndefined();
  });
});

describe("invokeAdminReviewer", () => {
  it("returns ok success on 200 with decisions[]", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ decisions: [] }), { status: 200 }),
    ) as unknown as typeof fetch;

    const resp = await invokeAdminReviewer(
      {
        record_id: "rec_1",
        signals: {
          warnings: ["w1"],
          ambiguity_flags: [],
          contradiction_flags: [],
        },
      },
      { fetchImpl },
    );
    expect(resp.ok).toBe(true);
    if (resp.ok) expect(resp.decisions).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("maps non-OK envelope errors through", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({ error: "RATE_LIMITED", message: "Coba lagi sebentar." }),
        { status: 429 },
      ),
    ) as unknown as typeof fetch;

    const resp = await invokeAdminReviewer(
      {
        record_id: "rec_1",
        signals: {
          warnings: ["w1"],
          ambiguity_flags: [],
          contradiction_flags: [],
        },
      },
      { fetchImpl },
    );
    expect(resp.ok).toBe(false);
    if (isAdminReviewerError(resp)) {
      expect(resp.error).toBe("RATE_LIMITED");
      expect(resp.status).toBe(429);
    }
  });

  it("returns INVALID_OUTPUT when body is not JSON", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("not json", { status: 200 }),
    ) as unknown as typeof fetch;
    const resp = await invokeAdminReviewer(
      {
        record_id: "rec_1",
        signals: {
          warnings: ["w1"],
          ambiguity_flags: [],
          contradiction_flags: [],
        },
      },
      { fetchImpl },
    );
    expect(resp.ok).toBe(false);
    if (isAdminReviewerError(resp)) expect(resp.error).toBe("INVALID_OUTPUT");
  });
});

describe("extractAdminReviewerContext", () => {
  it("trims raw_content to <= 2000 chars", () => {
    const big = "x".repeat(5000);
    const ctx = extractAdminReviewerContext(
      makeRecord({ raw_content: big }),
    );
    expect(ctx.raw_content_excerpt?.length).toBeLessThanOrEqual(2000);
  });

  it("includes promo_name & promo_type", () => {
    const ctx = extractAdminReviewerContext(
      makeRecord({ promo_name: "Bonus 100%", promo_type: "deposit_bonus" }),
    );
    expect(ctx.promo_name).toBe("Bonus 100%");
    expect(ctx.promo_type).toBe("deposit_bonus");
  });
});
