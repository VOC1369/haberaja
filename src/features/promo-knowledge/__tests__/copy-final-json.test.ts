/**
 * PR-7 — Copy Final JSON regression test.
 *
 * Locks the source of the Step9 "Copy Final JSON V.10.1" button:
 * always full canonical PkV10Record loaded from pk:rec via
 * loadFinalPkRecordForCopy(recordId).
 *
 * NOT a schema invariant test (that is PR-13). This only guards that the
 * copy helper does not regress to wizard state / projection_engine /
 * mappedPreview / extractedPromo / V.09.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { saveRecord } from "../storage/local-storage";
import { loadFinalPkRecordForCopy } from "../form-wizard-v10/copy-final-json";
import type { PkV10Record } from "../schema/pk-v10";

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
  key(i: number) { return Array.from(this.store.keys())[i] ?? null; }
  get length() { return this.store.size; }
}

beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = new MemoryStorage() as unknown as Storage;
});

function buildFixture(): PkV10Record {
  return {
    domain: "promo_knowledge",
    record_id: "pk_test_copyfinal_001",
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
      source_block: {
        raw_content: "RAW_CONTENT_FIXTURE_MARKER",
      },
    },
    identity_engine: {
      promo_block: { promo_name: "Test Promo" },
    },
    variant_engine: {
      items_block: {
        subcategories: [
          { variant_id: "v1", variant_label: "A" },
          { variant_id: "v2", variant_label: "B" },
        ],
      },
      summary_block: {
        expected_count: 2,
      },
    },
    readiness_engine: {
      state_block: {
        state: "ai_draft",
        state_changed_at: "2026-01-01T00:00:00.000Z",
        state_changed_by: "test",
      },
    },
    ai_confidence: { overall: 0.91 },
    _field_status: { "identity_engine.promo_block.promo_name": "ai_extracted" },
    _human_override_log: [
      { path: "identity_engine.promo_block.promo_name", at: "2026-01-01T00:00:00.000Z", by: "human:test" },
    ],
  } as unknown as PkV10Record;
}

describe("PR-7 — Copy Final JSON source", () => {
  it("returns null when recordId is missing", () => {
    expect(loadFinalPkRecordForCopy(null)).toBeNull();
    expect(loadFinalPkRecordForCopy(undefined)).toBeNull();
    expect(loadFinalPkRecordForCopy("")).toBeNull();
  });

  it("returns null when record not present in pk:rec (no fallback)", () => {
    expect(loadFinalPkRecordForCopy("does_not_exist")).toBeNull();
  });

  it("returns full canonical PkV10Record from pk:rec", () => {
    const fixture = buildFixture();
    saveRecord(fixture);

    const rec = loadFinalPkRecordForCopy(fixture.record_id);
    expect(rec).not.toBeNull();

    // Round-trip through JSON.stringify (mirrors clipboard payload).
    const copied = JSON.parse(JSON.stringify(rec));

    // Root canonical fields
    expect(copied.record_id).toBe(fixture.record_id);
    expect(copied.meta_engine.schema_block.schema_version).toBe("V.10.1");
    expect(copied.identity_engine).toBeDefined();
    expect(copied.identity_engine.promo_block.promo_name).toBe("Test Promo");

    // raw_content preserved
    expect(copied.meta_engine.source_block.raw_content).toBe("RAW_CONTENT_FIXTURE_MARKER");

    // variant_engine intact
    expect(copied.variant_engine).toBeDefined();
    expect(copied.variant_engine.items_block.subcategories.length).toBe(
      fixture.variant_engine!.items_block!.subcategories!.length
    );

    // ai_confidence / _field_status / _human_override_log preserved
    expect(copied.ai_confidence).toBeDefined();
    expect(copied._field_status).toBeDefined();
    expect(Array.isArray(copied._human_override_log)).toBe(true);
    expect(copied._human_override_log.length).toBe(1);

    // Not a partial: must NOT be projection-only / wizard-only
    const rootKeys = Object.keys(copied);
    expect(rootKeys).toContain("meta_engine");
    expect(rootKeys).toContain("variant_engine");
    expect(rootKeys).toContain("identity_engine");
    // not solely projection_engine
    expect(rootKeys.length).toBeGreaterThan(1);
  });
});
