/**
 * PATCH C — valid_until deterministic apply E2E tests.
 *
 * Locks the contract:
 *   - Admin radio answer that maps to a FIELD_REGISTRY writer is applied
 *     deterministically (no LLM resolver, no allowed_target_paths gate).
 *   - `valid_until` + `valid_until_unlimited` siblings flip together.
 *   - `_field_status` becomes "explicit" for both paths.
 *   - `_human_override_log` gains entries.
 *   - The exact source_text flag is cleared from its severity bucket.
 *   - Free-text / CUSTOM hints are rejected (caller must use resolver).
 */
import { describe, it, expect } from "vitest";
import {
  applyDeterministicRegistryAnswer,
  isDeterministicHint,
} from "../admin-verify/deterministic-apply";
import { FIELD_REGISTRY_INDEX, CUSTOM } from "../admin-verify/field-registry";
import { buildIssueQuestions } from "../admin-verify/extractor-issue-adapter";
import { createInertPkV10Record } from "../schema/pk-v10";
import type { PkV10Record } from "../schema/pk-v10";

const VALID_UNTIL_PATH = "period_engine.validity_block.valid_until";
const VALID_UNTIL_UNL_PATH = "period_engine.validity_block.valid_until_unlimited";

function makeRecord(warning: string): PkV10Record {
  const rec = createInertPkV10Record("pk_test_valid_until");
  rec.readiness_engine.validation_block.warnings = [warning];
  return rec;
}

describe("PATCH A — affected_paths derivation", () => {
  it("derives canonical path from extractor 'dotted.path: rest' prefix", () => {
    const rec = makeRecord(
      `${VALID_UNTIL_PATH}: Field 'Tanggal akhir' missing.`,
    );
    const qs = buildIssueQuestions(rec);
    expect(qs).toHaveLength(1);
    expect(qs[0].affected_paths).toEqual([VALID_UNTIL_PATH]);
  });

  it("derives canonical path via field-key token when no prefix", () => {
    const rec = makeRecord("valid_until is empty");
    const qs = buildIssueQuestions(rec);
    expect(qs[0].affected_paths).toEqual([VALID_UNTIL_PATH]);
  });

  it("leaves affected_paths empty when no identity present", () => {
    const rec = makeRecord("something odd");
    expect(buildIssueQuestions(rec)[0].affected_paths).toEqual([]);
  });
});

describe("isDeterministicHint", () => {
  it("treats free-text hints as non-deterministic", () => {
    expect(isDeterministicHint("")).toBe(false);
    expect(isDeterministicHint(undefined)).toBe(false);
    expect(isDeterministicHint(CUSTOM)).toBe(false);
    expect(isDeterministicHint("manual_note")).toBe(false);
    expect(isDeterministicHint("__manual__")).toBe(false);
  });
  it("accepts concrete enum-like hints", () => {
    expect(isDeterministicHint("no_expiry")).toBe(true);
    expect(isDeterministicHint("not_stated_confirmed")).toBe(true);
  });
});

describe("PATCH B — deterministic registry apply for valid_until", () => {
  const entry = FIELD_REGISTRY_INDEX.get(VALID_UNTIL_PATH)!;
  expect(entry).toBeDefined();
  const sourceText = `${VALID_UNTIL_PATH}: Field 'Tanggal akhir' missing.`;

  it("Test 1 — no_expiry sets unlimited=true, clears flag, logs override", () => {
    const rec = makeRecord(sourceText);
    const before = JSON.stringify(rec);
    const result = applyDeterministicRegistryAnswer({
      record: rec,
      entry,
      hint: "no_expiry",
      severity: "warning",
      sourceText,
    });
    expect(JSON.stringify(rec)).toBe(before); // input untouched
    expect(result.ok).toBe(true);
    const r = result.record!;
    expect(r.period_engine.validity_block.valid_until).toBeNull();
    expect(r.period_engine.validity_block.valid_until_unlimited).toBe(true);
    expect(r._field_status?.[VALID_UNTIL_PATH]).toBe("explicit");
    expect(r._field_status?.[VALID_UNTIL_UNL_PATH]).toBe("explicit");
    expect(r.readiness_engine.validation_block.warnings).toEqual([]);
    const log = (r as PkV10Record & { _human_override_log?: unknown[] })
      ._human_override_log;
    expect(Array.isArray(log)).toBe(true);
    expect((log as unknown[]).length).toBe(2);
  });

  it("Test 3 — not_stated_confirmed sets null, unlimited stays false, admin_note logged", () => {
    const rec = makeRecord(sourceText);
    const result = applyDeterministicRegistryAnswer({
      record: rec,
      entry,
      hint: "not_stated_confirmed",
      severity: "warning",
      sourceText,
    });
    expect(result.ok).toBe(true);
    const r = result.record!;
    expect(r.period_engine.validity_block.valid_until).toBeNull();
    expect(r.period_engine.validity_block.valid_until_unlimited).toBe(false);
    expect(r._field_status?.[VALID_UNTIL_PATH]).toBe("explicit");
    expect(r.readiness_engine.validation_block.warnings).toEqual([]);
    const log = (r as PkV10Record & {
      _human_override_log?: Array<{ reason?: string }>;
    })._human_override_log!;
    expect(log[0].reason).toContain("not stated");
  });

  it("Test 4 — manual_note hint is rejected (resolver required)", () => {
    const rec = makeRecord(sourceText);
    const result = applyDeterministicRegistryAnswer({
      record: rec,
      entry,
      hint: "manual_note",
      severity: "warning",
      sourceText,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/free-text/);
  });

  it("CUSTOM (date) hint is rejected (resolver required for date payload)", () => {
    const rec = makeRecord(sourceText);
    const result = applyDeterministicRegistryAnswer({
      record: rec,
      entry,
      hint: CUSTOM,
      severity: "warning",
      sourceText,
    });
    expect(result.ok).toBe(false);
  });
});
