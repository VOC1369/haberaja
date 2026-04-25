/**
 * PK-06.0 BASELINE REGRESSION HARNESS — minimal guard.
 *
 * Loads every clean baseline JSON snapshot under
 *   src/features/promo-knowledge/__tests__/baseline/
 * and asserts structural invariants that must hold pre- and post-refactor.
 *
 * Scope (locked):
 *   - JSON parse OK
 *   - required root engines present
 *   - mechanics_engine.items_block.items[] non-empty
 *   - readiness_engine.state_block.state present
 *   - zero legacy wrapper fields (_mechanics_v31, canonical_projection)
 *
 * EXPLICITLY OUT OF SCOPE:
 *   - baseline_pending/ (anomaly cases — not part of regression truth)
 *   - schema validator coverage (kept in validator.test.ts)
 *   - diff tooling
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BASELINE_DIR = join(__dirname, "baseline");

const REQUIRED_ROOT_ENGINES = [
  "identity_engine",
  "readiness_engine",
  "mechanics_engine",
  "projection_engine",
] as const;

const FORBIDDEN_LEGACY_FIELDS = ["_mechanics_v31", "canonical_projection"] as const;

const baselineFiles = readdirSync(BASELINE_DIR).filter((f) => f.endsWith(".json"));

describe("PK-06.0 baseline regression harness", () => {
  it("baseline directory is non-empty", () => {
    expect(baselineFiles.length).toBeGreaterThan(0);
  });

  describe.each(baselineFiles)("baseline file: %s", (file) => {
    const raw = readFileSync(join(BASELINE_DIR, file), "utf-8");
    let parsed: Record<string, unknown>;

    it("parses as valid JSON", () => {
      expect(() => {
        parsed = JSON.parse(raw);
      }).not.toThrow();
    });

    it("has all required root engines", () => {
      parsed ??= JSON.parse(raw);
      for (const engine of REQUIRED_ROOT_ENGINES) {
        expect(parsed[engine], `missing root engine "${engine}"`).toBeDefined();
      }
    });

    it("mechanics_engine.items_block.items has at least one item", () => {
      parsed ??= JSON.parse(raw);
      const me = parsed.mechanics_engine as
        | { items_block?: { items?: unknown[] } }
        | undefined;
      const items = me?.items_block?.items;
      expect(Array.isArray(items)).toBe(true);
      expect((items ?? []).length).toBeGreaterThan(0);
    });

    it("readiness_engine.state_block.state is set", () => {
      parsed ??= JSON.parse(raw);
      const re = parsed.readiness_engine as
        | { state_block?: { state?: unknown } }
        | undefined;
      const state = re?.state_block?.state;
      expect(typeof state).toBe("string");
      expect((state as string).length).toBeGreaterThan(0);
    });

    it("contains zero legacy wrapper fields", () => {
      parsed ??= JSON.parse(raw);
      for (const k of FORBIDDEN_LEGACY_FIELDS) {
        expect(parsed[k], `legacy field "${k}" should not exist`).toBeUndefined();
      }
    });
  });
});
