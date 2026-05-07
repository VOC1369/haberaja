/**
 * PR-13 — Schema / Field Invariant Test
 *
 * Tiny regression guard ensuring the canonical PkV10Record V.10.1 keeps its
 * minimum shape before UI polish. NOT a runtime validator. NOT a full schema
 * check. NOT exported. Helper is test-local on purpose.
 *
 * Doctrine:
 *   - PkV10Record is the single source of truth.
 *   - Do not import PromoFormData.
 *   - Do not touch PR-7 copy helper, schema, enums, extractor, Supabase.
 */

import { describe, it, expect } from "vitest";
import type { PkV10Record } from "../schema/pk-v10";

// ─── Test-local helper ────────────────────────────────────────────────────
// Pure, read-only, no side effects, no normalization, no fallback.
function validateMinimumPkV10InvariantForTest(
  record: unknown,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);

  if (!isObj(record)) {
    return { ok: false, errors: ["record is not an object"] };
  }

  if (record.domain !== "promo_knowledge") errors.push("domain must be 'promo_knowledge'");
  if (typeof record.record_id !== "string" || record.record_id.length === 0)
    errors.push("record_id missing or empty");
  if (typeof record.updated_at !== "string" || record.updated_at.length === 0)
    errors.push("updated_at missing");

  const meta = record.meta_engine;
  if (!isObj(meta)) errors.push("meta_engine missing");
  else {
    const sb = meta.schema_block;
    if (!isObj(sb) || sb.schema_version !== "V.10.1")
      errors.push("schema_version must be 'V.10.1'");
    const src = meta.source_block;
    if (!isObj(src) || typeof src.raw_content !== "string" || src.raw_content.length === 0)
      errors.push("raw_content missing or empty");
  }

  if (!isObj(record.identity_engine)) errors.push("identity_engine missing");
  if (!isObj(record.readiness_engine)) errors.push("readiness_engine missing");

  const ve = record.variant_engine;
  if (!isObj(ve)) errors.push("variant_engine missing");
  else {
    const sum = isObj(ve.summary_block) ? ve.summary_block : null;
    const items = isObj(ve.items_block) ? ve.items_block : null;
    const subs = items?.subcategories;
    if (!sum || typeof sum.expected_count !== "number")
      errors.push("variant_engine.summary_block.expected_count missing");
    if (!Array.isArray(subs)) errors.push("variant_engine.items_block.subcategories must be array");
    if (sum && Array.isArray(subs) && sum.expected_count !== subs.length)
      errors.push(
        `variant count mismatch: expected_count=${sum.expected_count} vs subcategories.length=${subs.length}`,
      );
  }

  if (!isObj(record._field_status)) errors.push("_field_status missing");
  if (!isObj(record.ai_confidence)) errors.push("ai_confidence missing");
  if (!Array.isArray(record._human_override_log)) errors.push("_human_override_log must be array");

  return { ok: errors.length === 0, errors };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────
function buildValidFixture(): PkV10Record {
  return {
    domain: "promo_knowledge",
    record_id: "pk_test_invariant_001",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    meta_engine: {
      schema_block: {
        schema_name: "PKB_Wolfbrain",
        schema_version: "V.10.1",
        locked_at: "2026-01-01T00:00:00.000Z",
        created_by: "test",
        status: "ai_draft",
        extractor: "test",
      },
      source_block: { raw_content: "RAW_CONTENT_FIXTURE" },
    },
    identity_engine: { promo_block: { promo_name: "Test Promo" } },
    variant_engine: {
      items_block: {
        subcategories: [
          { variant_id: "v1", variant_label: "A" },
          { variant_id: "v2", variant_label: "B" },
        ],
      },
      summary_block: { expected_count: 2 },
    },
    readiness_engine: {
      state_block: {
        state: "ai_draft",
        state_changed_at: "2026-01-01T00:00:00.000Z",
        state_changed_by: "test",
      },
    },
    ai_confidence: { overall: 0.9 },
    _field_status: { "identity_engine.promo_block.promo_name": "ai_extracted" },
    _human_override_log: [],
  } as unknown as PkV10Record;
}

describe("PR-13 — PkV10Record minimum invariant", () => {
  it("Test 1: valid minimum fixture passes invariant", () => {
    const rec = buildValidFixture();
    const r = validateMinimumPkV10InvariantForTest(rec);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);

    expect(rec.domain).toBe("promo_knowledge");
    expect(typeof rec.record_id).toBe("string");
    expect(rec.record_id.length).toBeGreaterThan(0);
    expect(rec.meta_engine.schema_block.schema_version).toBe("V.10.1");
    expect(typeof rec.meta_engine.source_block.raw_content).toBe("string");
    expect(rec.meta_engine.source_block.raw_content!.length).toBeGreaterThan(0);
    expect(rec.identity_engine).toBeDefined();
    expect(rec.variant_engine).toBeDefined();
    expect(Array.isArray(rec.variant_engine!.items_block!.subcategories)).toBe(true);
    expect(rec.variant_engine!.summary_block!.expected_count).toBe(
      rec.variant_engine!.items_block!.subcategories!.length,
    );
    expect(typeof rec._field_status).toBe("object");
    expect(typeof rec.ai_confidence).toBe("object");
    expect(Array.isArray(rec._human_override_log)).toBe(true);
    expect(rec.readiness_engine).toBeDefined();
    expect(rec.updated_at).toBeDefined();
  });

  it("Test 2: variant count mismatch fails invariant", () => {
    const rec = buildValidFixture();
    rec.variant_engine!.summary_block!.expected_count = 2;
    rec.variant_engine!.items_block!.subcategories = [
      { variant_id: "v1", variant_label: "A" },
    ];
    const r = validateMinimumPkV10InvariantForTest(rec);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("variant count mismatch"))).toBe(true);
  });

  it("Test 3: partial wizard-like state fails invariant", () => {
    const partial = {
      identity_engine: { promo_block: { promo_name: "x" } },
      reward_engine: {},
      scope_engine: {},
    };
    const r = validateMinimumPkV10InvariantForTest(partial);
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
    // missing essentials
    expect(r.errors.some((e) => e.includes("domain"))).toBe(true);
    expect(r.errors.some((e) => e.includes("record_id"))).toBe(true);
    expect(r.errors.some((e) => e.includes("meta_engine"))).toBe(true);
    expect(r.errors.some((e) => e.includes("variant_engine"))).toBe(true);
  });

  it("Test 4: projection-only object fails invariant", () => {
    const projection = { projection_engine: { summary: "anything" } };
    const r = validateMinimumPkV10InvariantForTest(projection);
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("Test 5: missing/empty raw_content fails invariant", () => {
    const recA = buildValidFixture();
    (recA.meta_engine.source_block as { raw_content?: string }).raw_content = "";
    const rA = validateMinimumPkV10InvariantForTest(recA);
    expect(rA.ok).toBe(false);
    expect(rA.errors.some((e) => e.includes("raw_content"))).toBe(true);

    const recB = buildValidFixture();
    delete (recB.meta_engine.source_block as { raw_content?: string }).raw_content;
    const rB = validateMinimumPkV10InvariantForTest(recB);
    expect(rB.ok).toBe(false);
    expect(rB.errors.some((e) => e.includes("raw_content"))).toBe(true);
  });
});
