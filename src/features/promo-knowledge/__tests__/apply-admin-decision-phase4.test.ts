/**
 * Phase 4 — Admin Decision Apply Orchestration tests.
 *
 * Uses injected resolver + save (no LLM, no network, no real localStorage).
 */
import { describe, it, expect, vi } from "vitest";

import { applyAdminDecision } from "../admin-verify/apply-admin-decision";
import { deriveAllowedTargetPaths } from "../admin-verify/admin-decision-patch-resolver";
import type { AdminDecision } from "../admin-verify/admin-decision-types";
import type { PkV10Record } from "../schema/pk-v10";

function makeRecord(): PkV10Record {
  return {
    record_id: "rec-phase4-1",
    domain: "promo",
    schema_version: "10.2.0",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ai_confidence: {},
    _field_status: {},
    identity_engine: {
      promo_block: { promo_name: "Test Promo", promo_type: "deposit_bonus" },
    },
    meta_engine: { source_block: { raw_content: "" } },
    trigger_engine: {
      trigger_rule_block: { rule_type: "simple" },
    },
    reward_engine: { currency: "IDR" },
    variant_engine: {
      items_block: {
        subcategories: [
          { turnover_rule_format: "multiplier" },
          { turnover_rule_format: "multiplier" },
        ],
      },
    },
    terms_engine: {
      conditions_block: {
        terms_conditions: ["Berlaku untuk member baru", "Maksimal 1x klaim"],
      },
    },
    readiness_engine: {
      validation_block: { warnings: ["w0", "w1"], status: "ok" },
      observability_block: {
        ambiguity_flags: ["a0"],
        contradiction_flags: ["c0", "c1"],
      },
      commit_block: { ready_to_commit: false },
    },
  } as unknown as PkV10Record;
}

const contradictionDecision: AdminDecision = {
  id: "dec-1",
  decision_type: "contradiction",
  title: "Aturan turnover tidak konsisten",
  explanation: "Ada dua format yang berbeda untuk aturan turnover.",
  question: "Format mana yang harus dipakai?",
  options: [
    { label: "Ikuti S&K (kelipatan)", value: "multiplier" },
    { label: "Pakai minimum rupiah", value: "min_rupiah" },
  ],
  manual_note_enabled: true,
  related_signal_indices: {
    warnings: [],
    ambiguity_flags: [],
    contradiction_flags: [0],
  },
};

describe("Phase 4 — applyAdminDecision", () => {
  it("derives allowed paths including per-variant turnover_rule_format", () => {
    const rec = makeRecord();
    const allowed = deriveAllowedTargetPaths(rec);
    expect(allowed).toContain("trigger_engine.trigger_rule_block.rule_type");
    expect(allowed).toContain("reward_engine.currency");
    expect(allowed).toContain("terms_engine.conditions_block.terms_conditions");
    expect(allowed).toContain(
      "variant_engine.items_block.subcategories[0].turnover_rule_format",
    );
    expect(allowed).toContain(
      "variant_engine.items_block.subcategories[1].turnover_rule_format",
    );
  });

  it("applies patch, clears related contradiction signal, and saves", async () => {
    const rec = makeRecord();
    const save = vi.fn();
    const resolver = vi.fn(async () => ({
      intent_summary: "Admin memilih format kelipatan.",
      proposed_patches: [
        {
          operation: "set_value" as const,
          target_path:
            "variant_engine.items_block.subcategories[0].turnover_rule_format",
          old_value_preview: "multiplier",
          new_value_preview: "min_rupiah",
          reason: "Sesuai pilihan admin.",
        },
      ],
      unresolved_questions: [],
    }));

    const out = await applyAdminDecision({
      record: rec,
      decision: contradictionDecision,
      selectedValue: "min_rupiah",
      selectedLabel: "Pakai minimum rupiah",
      note: "",
      resolver,
      save,
    });

    expect(out.ok).toBe(true);
    expect(out.record).toBeDefined();
    const updated = out.record!;
    expect(
      (updated as any).variant_engine.items_block.subcategories[0]
        .turnover_rule_format,
    ).toBe("min_rupiah");
    // contradiction[0] cleared, contradiction[1] preserved
    expect(
      (updated as any).readiness_engine.observability_block.contradiction_flags,
    ).toEqual(["c1"]);
    // warnings & ambiguity untouched
    expect(
      (updated as any).readiness_engine.validation_block.warnings,
    ).toEqual(["w0", "w1"]);
    expect(
      (updated as any).readiness_engine.observability_block.ambiguity_flags,
    ).toEqual(["a0"]);
    // _human_override_log appended
    expect(
      Array.isArray((updated as any)._human_override_log) &&
        (updated as any)._human_override_log.length,
    ).toBe(1);
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith(updated);
  });

  it("does NOT mutate or clear signals when resolver returns no patches", async () => {
    const rec = makeRecord();
    const save = vi.fn();
    const resolver = vi.fn(async () => ({
      intent_summary: "Tidak bisa ditentukan.",
      proposed_patches: [],
      unresolved_questions: ["Mohon jelaskan lebih spesifik."],
    }));

    const out = await applyAdminDecision({
      record: rec,
      decision: contradictionDecision,
      selectedValue: "multiplier",
      selectedLabel: "Ikuti S&K (kelipatan)",
      note: "",
      resolver,
      save,
    });

    expect(out.ok).toBe(false);
    expect(out.record).toBeUndefined();
    expect(save).not.toHaveBeenCalled();
    // original record untouched
    expect(
      rec.readiness_engine?.observability_block?.contradiction_flags,
    ).toEqual(["c0", "c1"]);
  });

  it("does NOT save when resolver throws", async () => {
    const rec = makeRecord();
    const save = vi.fn();
    const resolver = vi.fn(async () => {
      throw new Error("LLM down");
    });

    const out = await applyAdminDecision({
      record: rec,
      decision: contradictionDecision,
      selectedValue: "multiplier",
      selectedLabel: "Ikuti S&K (kelipatan)",
      note: "",
      resolver,
      save,
    });

    expect(out.ok).toBe(false);
    expect(out.errors).toBeDefined();
    expect(save).not.toHaveBeenCalled();
  });

  it("rejects patches whose target_path is outside allowlist (no save)", async () => {
    const rec = makeRecord();
    const save = vi.fn();
    const resolver = vi.fn(async () => ({
      intent_summary: "Forbidden path attempt.",
      proposed_patches: [
        {
          operation: "set_value" as const,
          target_path: "meta_engine.source_block.raw_content",
          old_value_preview: "",
          new_value_preview: "HACKED",
          reason: "n/a",
        },
      ],
      unresolved_questions: [],
    }));

    const out = await applyAdminDecision({
      record: rec,
      decision: contradictionDecision,
      selectedValue: "multiplier",
      selectedLabel: "x",
      note: "",
      resolver,
      save,
    });

    // Forbidden paths are stripped at resolver allowlist step → no patches
    // → orchestrator returns ok=false; even if it slipped through, the
    // safe applier would reject. Either way: no save, no mutation.
    expect(out.ok).toBe(false);
    expect(save).not.toHaveBeenCalled();
    // raw_content unchanged
    expect((rec as any).meta_engine.source_block.raw_content).toBe("");
  });

  it("returns error when no option is selected", async () => {
    const rec = makeRecord();
    const save = vi.fn();
    const resolver = vi.fn();

    const out = await applyAdminDecision({
      record: rec,
      decision: contradictionDecision,
      selectedValue: "",
      selectedLabel: "",
      note: "",
      resolver,
      save,
    });

    expect(out.ok).toBe(false);
    expect(resolver).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});
