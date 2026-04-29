/**
 * STORAGE — V.10 contract test.
 *
 * Updated for Step 2 (V.10 migration). The legacy D-6 re-injection contract
 * (governance_version / domain_version / domain top-level fields) has been
 * dropped. V.10 carries its schema stamp inside `meta_engine.schema_block`.
 *
 * This test now asserts the V.10 dumb-upsert contract: updated_at bumps,
 * record persists, no legacy field injection.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { saveRecord, createDraftRecord } from "../storage/local-storage";

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.store.set(k, String(v));
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
  key(i: number) {
    return Array.from(this.store.keys())[i] ?? null;
  }
  get length() {
    return this.store.size;
  }
}

beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = new MemoryStorage() as unknown as Storage;
});

describe("PKB_Wolfbrain V.10 Storage — dumb upsert", () => {
  it("persists V.10 schema stamp inside meta_engine.schema_block", () => {
    const rec = createDraftRecord();
    const saved = saveRecord(rec);
    expect(saved.meta_engine.schema_block.schema_name).toBe("PKB_Wolfbrain");
    expect(saved.meta_engine.schema_block.schema_version).toBe("V.10");
  });

  it("bumps updated_at on save", async () => {
    const rec = createDraftRecord();
    const before = rec.updated_at;
    await new Promise((r) => setTimeout(r, 5));
    const saved = saveRecord(rec);
    expect(saved.updated_at >= before).toBe(true);
  });

  it("does NOT inject legacy V.09 governance fields", () => {
    const rec = createDraftRecord();
    const saved = saveRecord(rec);
    expect((saved as unknown as Record<string, unknown>).governance_version).toBeUndefined();
    expect((saved as unknown as Record<string, unknown>).domain_version).toBeUndefined();
    expect((saved as unknown as Record<string, unknown>)._schema).toBeUndefined();
  });
});
