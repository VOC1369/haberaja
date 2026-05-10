/**
 * PR-20 — applyAdminPatchPreviewToPkRecord tests.
 *
 * Locks:
 *   - All-or-nothing apply.
 *   - Path whitelist + forbidden path defense.
 *   - Type/enum validation.
 *   - raw_content & readiness flags never auto-changed.
 *   - Input record never mutated.
 *   - _human_override_log appended; _field_status set to "explicit".
 *   - updated_at bumped, created_at preserved.
 */
import { describe, it, expect } from "vitest";
import type { PkV10Record } from "../schema/pk-v10";
import { applyAdminPatchPreviewToPkRecord } from "../admin-verify/admin-patch-apply";
import type { JsonPatchPreview } from "../admin-verify/extractor-issue-adapter";

function buildRec(): PkV10Record {
  const rec: unknown = {
    domain: "promo_knowledge",
    record_id: "pk_pr20_test",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ai_confidence: { "trigger_engine.trigger_rule_block.rule_type": 0.42 },
    _field_status: { "trigger_engine.trigger_rule_block.rule_type": "ai_inferred" },
    meta_engine: {
      schema_block: {
        schema_name: "PKB_Wolfbrain",
        schema_version: "V.10.1",
        status: "ai_draft",
      },
      source_block: { raw_content: "ORIGINAL RAW CONTENT" },
    },
    trigger_engine: {
      trigger_rule_block: { rule_type: "first_deposit_only", conditions: [], logic_operator: "" },
    },
    reward_engine: { currency: "idr" },
    variant_engine: {
      items_block: {
        subcategories: [
          { variant_id: "v1", turnover_rule_format: "(Deposit + Bonus) x 20" },
        ],
      },
    },
    terms_engine: {
      conditions_block: {
        terms_conditions: [
          "Promo hanya berlaku untuk member baru.",
          "Wajib deposit minimal 100rb.",
        ],
      },
    },
    readiness_engine: {
      state_block: { state: "draft", state_changed_at: "", state_changed_by: "" },
      commit_block: { ready_to_commit: false },
      validation_block: { is_structurally_complete: false, status: "draft", warnings: ["W1"] },
      observability_block: {
        ambiguity_flags: ["A1"],
        contradiction_flags: ["C1"],
        review_required: true,
      },
    },
  };
  return rec as PkV10Record;
}

const RULE_TYPE_PATH = "trigger_engine.trigger_rule_block.rule_type";
const TURNOVER_PATH =
  "variant_engine.items_block.subcategories[0].turnover_rule_format";
const CURRENCY_PATH = "reward_engine.currency";
const TERMS_PATH = "terms_engine.conditions_block.terms_conditions";

describe("applyAdminPatchPreviewToPkRecord — happy paths", () => {
  it("applies a valid rule_type set_value patch", () => {
    const rec = buildRec();
    const before = JSON.stringify(rec);
    const patch: JsonPatchPreview = {
      operation: "set_value",
      target_path: RULE_TYPE_PATH,
      old_value_preview: "first_deposit_only",
      new_value_preview: "conditional",
      reason: "Admin memilih conditional.",
    };
    const out = applyAdminPatchPreviewToPkRecord({
      record: rec,
      patches: [patch],
      allowedTargetPaths: [RULE_TYPE_PATH],
    });
    expect(out.ok).toBe(true);
    expect(out.record!.trigger_engine.trigger_rule_block.rule_type).toBe("conditional");
    expect((out.record!._field_status as Record<string, string>)[RULE_TYPE_PATH]).toBe(
      "explicit",
    );
    const log = (out.record as unknown as { _human_override_log: unknown[] })
      ._human_override_log;
    expect(Array.isArray(log)).toBe(true);
    expect(log.length).toBe(1);
    // raw_content untouched
    expect(out.record!.meta_engine?.source_block?.raw_content).toBe(
      "ORIGINAL RAW CONTENT",
    );
    // input untouched
    expect(JSON.stringify(rec)).toBe(before);
  });

  it("applies turnover_rule_format on a subcategory", () => {
    const rec = buildRec();
    const patch: JsonPatchPreview = {
      operation: "set_value",
      target_path: TURNOVER_PATH,
      old_value_preview: "(Deposit + Bonus) x 20",
      new_value_preview: "multiplier",
      reason: "Admin memilih multiplier.",
    };
    const out = applyAdminPatchPreviewToPkRecord({
      record: rec,
      patches: [patch],
      allowedTargetPaths: [TURNOVER_PATH],
    });
    expect(out.ok).toBe(true);
    expect(
      out.record!.variant_engine?.items_block?.subcategories?.[0]
        ?.turnover_rule_format,
    ).toBe("multiplier");
  });

  it("applies replace_text_in_array for terms_conditions only", () => {
    const rec = buildRec();
    const patch: JsonPatchPreview = {
      operation: "replace_text_in_array",
      target_path: TERMS_PATH,
      old_value_preview: "Wajib deposit minimal 100rb.",
      new_value_preview: "Wajib deposit minimal Rp 100.000.",
      reason: "Format mata uang dirapikan.",
    };
    const out = applyAdminPatchPreviewToPkRecord({
      record: rec,
      patches: [patch],
      allowedTargetPaths: [TERMS_PATH],
    });
    expect(out.ok).toBe(true);
    const arr = out.record!.terms_engine?.conditions_block?.terms_conditions ?? [];
    expect(arr).toContain("Wajib deposit minimal Rp 100.000.");
    expect(arr).not.toContain("Wajib deposit minimal 100rb.");
    // raw_content untouched
    expect(out.record!.meta_engine?.source_block?.raw_content).toBe(
      "ORIGINAL RAW CONTENT",
    );
  });

  it("applies currency when uppercase 3-letter ISO", () => {
    const rec = buildRec();
    const patch: JsonPatchPreview = {
      operation: "set_value",
      target_path: CURRENCY_PATH,
      old_value_preview: "idr",
      new_value_preview: "IDR",
      reason: "Normalisasi mata uang.",
    };
    const out = applyAdminPatchPreviewToPkRecord({
      record: rec,
      patches: [patch],
      allowedTargetPaths: [CURRENCY_PATH],
    });
    expect(out.ok).toBe(true);
    expect(out.record!.reward_engine?.currency).toBe("IDR");
  });
});

describe("applyAdminPatchPreviewToPkRecord — rejections", () => {
  it("rejects target_path outside allowedTargetPaths", () => {
    const rec = buildRec();
    const patch: JsonPatchPreview = {
      operation: "set_value",
      target_path: RULE_TYPE_PATH,
      old_value_preview: "x",
      new_value_preview: "conditional",
      reason: "",
    };
    const out = applyAdminPatchPreviewToPkRecord({
      record: rec,
      patches: [patch],
      allowedTargetPaths: [CURRENCY_PATH], // mismatched
    });
    expect(out.ok).toBe(false);
    expect(out.errors?.[0]).toMatch(/not in allowedTargetPaths/);
  });

  it("rejects raw_content edits explicitly", () => {
    const rec = buildRec();
    const patch: JsonPatchPreview = {
      operation: "set_value",
      target_path: "meta_engine.source_block.raw_content",
      old_value_preview: "ORIGINAL RAW CONTENT",
      new_value_preview: "TAMPERED",
      reason: "",
    };
    const out = applyAdminPatchPreviewToPkRecord({
      record: rec,
      patches: [patch],
      allowedTargetPaths: ["meta_engine.source_block.raw_content"],
    });
    expect(out.ok).toBe(false);
    expect(out.errors?.[0]).toMatch(/forbidden/);
  });

  it("rejects invalid rule_type enum value", () => {
    const rec = buildRec();
    const patch: JsonPatchPreview = {
      operation: "set_value",
      target_path: RULE_TYPE_PATH,
      old_value_preview: "first_deposit_only",
      new_value_preview: "first_deposit_only",
      reason: "",
    };
    const out = applyAdminPatchPreviewToPkRecord({
      record: rec,
      patches: [patch],
      allowedTargetPaths: [RULE_TYPE_PATH],
    });
    expect(out.ok).toBe(false);
    expect(out.errors?.[0]).toMatch(/value must be one of/);
  });

  it("rejects readiness flags mutation (review_required)", () => {
    const rec = buildRec();
    const patch: JsonPatchPreview = {
      operation: "set_value",
      target_path: "readiness_engine.observability_block.review_required",
      old_value_preview: true,
      new_value_preview: false,
      reason: "",
    };
    const out = applyAdminPatchPreviewToPkRecord({
      record: rec,
      patches: [patch],
      allowedTargetPaths: [
        "readiness_engine.observability_block.review_required",
      ],
    });
    expect(out.ok).toBe(false);
    expect(out.errors?.[0]).toMatch(/forbidden/);
  });

  it("all-or-nothing: one invalid patch blocks the whole batch", () => {
    const rec = buildRec();
    const ok: JsonPatchPreview = {
      operation: "set_value",
      target_path: RULE_TYPE_PATH,
      old_value_preview: "first_deposit_only",
      new_value_preview: "conditional",
      reason: "",
    };
    const bad: JsonPatchPreview = {
      operation: "set_value",
      target_path: CURRENCY_PATH,
      old_value_preview: "idr",
      new_value_preview: "rupiah",
      reason: "",
    };
    const before = JSON.stringify(rec);
    const out = applyAdminPatchPreviewToPkRecord({
      record: rec,
      patches: [ok, bad],
      allowedTargetPaths: [RULE_TYPE_PATH, CURRENCY_PATH],
    });
    expect(out.ok).toBe(false);
    expect(JSON.stringify(rec)).toBe(before);
    expect(out.record).toBeUndefined();
  });
});

describe("applyAdminPatchPreviewToPkRecord — invariants", () => {
  it("does NOT auto-clear warnings/contradictions/ambiguity/review_required", () => {
    const rec = buildRec();
    const patch: JsonPatchPreview = {
      operation: "set_value",
      target_path: RULE_TYPE_PATH,
      old_value_preview: "first_deposit_only",
      new_value_preview: "conditional",
      reason: "",
    };
    const out = applyAdminPatchPreviewToPkRecord({
      record: rec,
      patches: [patch],
      allowedTargetPaths: [RULE_TYPE_PATH],
    });
    expect(out.ok).toBe(true);
    const r = out.record!;
    expect(r.readiness_engine.validation_block.warnings).toEqual(["W1"]);
    expect(r.readiness_engine.observability_block.ambiguity_flags).toEqual(["A1"]);
    expect(r.readiness_engine.observability_block.contradiction_flags).toEqual(["C1"]);
    expect(r.readiness_engine.observability_block.review_required).toBe(true);
    expect(r.readiness_engine.commit_block.ready_to_commit).toBe(false);
    expect(r.readiness_engine.validation_block.status).toBe("draft");
  });

  it("bumps updated_at, preserves created_at, record_id, schema_version, domain", () => {
    const rec = buildRec();
    const patch: JsonPatchPreview = {
      operation: "set_value",
      target_path: RULE_TYPE_PATH,
      old_value_preview: "first_deposit_only",
      new_value_preview: "conditional",
      reason: "",
    };
    const out = applyAdminPatchPreviewToPkRecord({
      record: rec,
      patches: [patch],
      allowedTargetPaths: [RULE_TYPE_PATH],
    });
    expect(out.ok).toBe(true);
    expect(out.record!.created_at).toBe(rec.created_at);
    expect(out.record!.record_id).toBe(rec.record_id);
    expect(out.record!.domain).toBe(rec.domain);
    expect(out.record!.meta_engine?.schema_block?.schema_version).toBe("V.10.1");
    expect(out.record!.updated_at).not.toBe(rec.updated_at);
  });

  it("_human_override_log entry has expected shape and source", () => {
    const rec = buildRec();
    const patch: JsonPatchPreview = {
      operation: "set_value",
      target_path: RULE_TYPE_PATH,
      old_value_preview: "first_deposit_only",
      new_value_preview: "conditional",
      reason: "Admin memilih conditional.",
    };
    const out = applyAdminPatchPreviewToPkRecord({
      record: rec,
      patches: [patch],
      allowedTargetPaths: [RULE_TYPE_PATH],
      actor: "admin",
      source: "admin_verify_llm_patch_preview",
    });
    expect(out.ok).toBe(true);
    const log = (out.record as unknown as {
      _human_override_log: Array<Record<string, unknown>>;
    })._human_override_log;
    expect(log.length).toBe(1);
    const entry = log[0];
    expect(entry.field_path).toBe(RULE_TYPE_PATH);
    expect(entry.previous_value).toBe("first_deposit_only");
    expect(entry.new_value).toBe("conditional");
    expect(entry.previous_field_status).toBe("ai_inferred");
    expect(entry.previous_ai_confidence).toBe(0.42);
    expect(entry.overridden_by).toBe("admin");
    expect(entry.source).toBe("admin_verify_llm_patch_preview");
    expect(typeof entry.timestamp).toBe("string");
  });
});
