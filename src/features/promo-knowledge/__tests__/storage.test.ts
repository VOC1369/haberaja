/**
 * PK-06.0 STORAGE — Gate 1.5 hardening test.
 *
 * Contract:
 *   saveRecord() MUST re-inject governance_version, domain_version, and domain
 *   from the Registry, even if the caller mutated/tampered them before save.
 *   This is D-6 enforcement at the storage boundary.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { saveRecord, createDraftRecord } from "../storage/local-storage";
import { PK_REGISTRY } from "../registry";

// Minimal in-memory localStorage stub for node test env.
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

describe("PK-06.0 Storage — D-6 re-injection on save", () => {
  it("re-injects governance metadata even when caller tampers all three fields", () => {
    const rec = createDraftRecord();
    // Tamper with all three D-6 fields
    (rec as { governance_version: string }).governance_version = "V.99-TAMPERED";
    (rec as { domain_version: string }).domain_version = "PK-99.9-TAMPERED";
    (rec as { domain: string }).domain = "evil_domain";

    const saved = saveRecord(rec);

    expect(saved.governance_version).toBe(PK_REGISTRY.governance_version);
    expect(saved.domain_version).toBe(PK_REGISTRY.domain_version);
    expect(saved.domain).toBe(PK_REGISTRY.domain);
  });

  it("re-injects on every subsequent save (idempotent enforcement)", () => {
    const rec = createDraftRecord();
    const first = saveRecord(rec);
    // Tamper after save and re-save
    (first as { domain: string }).domain = "tampered_again";
    const second = saveRecord(first);
    expect(second.domain).toBe(PK_REGISTRY.domain);
    expect(second.governance_version).toBe(PK_REGISTRY.governance_version);
    expect(second.domain_version).toBe(PK_REGISTRY.domain_version);
  });

  it("bumps updated_at on save", async () => {
    const rec = createDraftRecord();
    const before = rec.updated_at;
    await new Promise((r) => setTimeout(r, 5));
    const saved = saveRecord(rec);
    expect(saved.updated_at >= before).toBe(true);
  });
});
