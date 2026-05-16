/**
 * PATCH F — Level Up registry coverage tests.
 *
 * Locks the contract:
 *   - Extractor ambiguity flag prefixed with `reward_engine.reward_table_block.basis:`
 *     resolves to that canonical path.
 *   - FIELD_REGISTRY has a deterministic writer for `reward_table_block.basis`
 *     and `taxonomy_engine.mode_block.tier_archetype`.
 *   - Admin radio answer (loyalty_points / deposit_accumulation / ...)
 *     writes the value, marks _field_status explicit, logs override, and
 *     clears the exact source_text flag — all without LLM resolver.
 *   - Humanized card carries the extractor reason (cleaned of path prefix).
 */
import { describe, it, expect } from "vitest";
import { applyDeterministicRegistryAnswer } from "../admin-verify/deterministic-apply";
import { FIELD_REGISTRY_INDEX } from "../admin-verify/field-registry";
import { buildIssueQuestions } from "../admin-verify/extractor-issue-adapter";
import { humanizeIssue } from "../admin-verify/humanize-issue";
import { createInertPkV10Record } from "../schema/pk-v10";
import type { PkV10Record } from "../schema/pk-v10";

const BASIS_PATH = "reward_engine.reward_table_block.basis";
const TIER_PATH = "taxonomy_engine.mode_block.tier_archetype";

function recWithAmbiguity(flag: string): PkV10Record {
  const r = createInertPkV10Record("pk_level_up");
  r.readiness_engine.observability_block.ambiguity_flags = [flag];
  return r;
}

describe("PATCH D — registry entries exist", () => {
  it("registers reward_table_block.basis", () => {
    const entry = FIELD_REGISTRY_INDEX.get(BASIS_PATH);
    expect(entry).toBeDefined();
    const values = entry!.options!.map((o) => o.value);
    expect(values).toContain("loyalty_points");
    expect(values).toContain("deposit_accumulation");
    expect(values).toContain("not_stated_confirmed");
    expect(values).toContain("manual_note");
  });
  it("registers tier_archetype", () => {
    const entry = FIELD_REGISTRY_INDEX.get(TIER_PATH);
    expect(entry).toBeDefined();
    const values = entry!.options!.map((o) => o.value);
    expect(values).toContain("level");
    expect(values).toContain("history_deposit_threshold");
    expect(values).toContain("not_stated_confirmed");
  });
});

describe("Level Up — extractor flag → canonical path", () => {
  it("derives basis path from prefixed ambiguity flag", () => {
    const rec = recWithAmbiguity(
      `${BASIS_PATH}: causal basis not stated — opsi: loyalty point / deposit / turnover.`,
    );
    const qs = buildIssueQuestions(rec);
    expect(qs).toHaveLength(1);
    expect(qs[0].affected_paths).toEqual([BASIS_PATH]);
  });

  it("derives tier_archetype path via field-key token (no prefix)", () => {
    const rec = recWithAmbiguity("tier_archetype belum jelas dari sumber");
    const qs = buildIssueQuestions(rec);
    expect(qs[0].affected_paths).toEqual([TIER_PATH]);
  });
});

describe("PATCH E — wording carries extractor reason", () => {
  it("strips path prefix and surfaces reason as context line", () => {
    const flag = `${BASIS_PATH}: causal basis not stated — opsi: loyalty point / deposit / turnover.`;
    const rec = recWithAmbiguity(flag);
    const q = buildIssueQuestions(rec)[0];
    const h = humanizeIssue(q, rec);
    expect(h.shouldRenderAsAdminQuestion).toBe(true);
    expect(h.options).toBeTruthy();
    const reasonLine = h.contextLines?.find((c) => c.key === "Alasan sistem");
    expect(reasonLine).toBeDefined();
    expect(reasonLine!.value).not.toContain(BASIS_PATH);
    expect(reasonLine!.value).toMatch(/causal basis/);
  });
});

describe("PATCH F — deterministic apply for Level Up basis", () => {
  it("admin picks loyalty_points → JSON patched, flag cleared, log written", () => {
    const flag = `${BASIS_PATH}: causal basis not stated`;
    const rec = recWithAmbiguity(flag);
    const before = JSON.stringify(rec);
    const entry = FIELD_REGISTRY_INDEX.get(BASIS_PATH)!;
    const result = applyDeterministicRegistryAnswer({
      record: rec,
      entry,
      hint: "loyalty_points",
      severity: "ambiguity",
      sourceText: flag,
    });
    expect(JSON.stringify(rec)).toBe(before); // input untouched
    expect(result.ok).toBe(true);
    const r = result.record!;
    expect(r.reward_engine.reward_table_block?.basis).toBe("loyalty_points");
    expect(r._field_status?.[BASIS_PATH]).toBe("explicit");
    expect(r.readiness_engine.observability_block.ambiguity_flags).toEqual([]);
    const log = (r as PkV10Record & { _human_override_log?: unknown[] })
      ._human_override_log;
    expect(Array.isArray(log)).toBe(true);
    expect((log as unknown[]).length).toBeGreaterThan(0);
  });

  it("admin picks not_stated_confirmed → basis empty, admin_note logged", () => {
    const flag = `${BASIS_PATH}: causal basis not stated`;
    const rec = recWithAmbiguity(flag);
    const entry = FIELD_REGISTRY_INDEX.get(BASIS_PATH)!;
    const result = applyDeterministicRegistryAnswer({
      record: rec,
      entry,
      hint: "not_stated_confirmed",
      severity: "ambiguity",
      sourceText: flag,
    });
    expect(result.ok).toBe(true);
    const r = result.record!;
    expect(r.reward_engine.reward_table_block?.basis).toBe("");
    expect(r._field_status?.[BASIS_PATH]).toBe("explicit");
    const log = (r as PkV10Record & {
      _human_override_log?: Array<{ reason?: string }>;
    })._human_override_log!;
    expect(log[0].reason).toContain("not stated");
  });

  it("admin picks tier_archetype=level → patched", () => {
    const flag = `${TIER_PATH}: archetype ambigu`;
    const rec = recWithAmbiguity(flag);
    const entry = FIELD_REGISTRY_INDEX.get(TIER_PATH)!;
    const result = applyDeterministicRegistryAnswer({
      record: rec,
      entry,
      hint: "level",
      severity: "ambiguity",
      sourceText: flag,
    });
    expect(result.ok).toBe(true);
    const r = result.record!;
    expect(r.taxonomy_engine.mode_block.tier_archetype).toBe("level");
    expect(r._field_status?.[TIER_PATH]).toBe("explicit");
  });
});
