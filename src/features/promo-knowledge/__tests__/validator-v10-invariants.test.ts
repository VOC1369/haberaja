/**
 * PK-V10 INVARIANT VALIDATOR — Step 6B tests.
 *
 * Coverage matrix:
 *   #1 reward_form enum                 — pass + fail (ERROR)
 *   #2 reward_form ↔ reward_type mapping     — pass + fail (WARNING)
 *   #3 max_reward_unlimited mutex       — pass + fail (ERROR)
 *   #4 valid_until_unlimited mutex      — pass + fail (ERROR)
 *   #5 reward_identity_block boundary   — pass + fail (WARNING)
 *   #6 external_system=none → ref_id="" — pass + fail (WARNING)
 *   #7 external_system!=none → ref_id   — pass + fail (WARNING)
 */

import { describe, it, expect } from "vitest";
import { validatePkV10Invariants } from "../validator/pk-v10-invariants";
import { createInertPkV10Record, type PkV10Record, type PkV10MechanicItem } from "../schema/pk-v10";

const baseRecord = (): PkV10Record => createInertPkV10Record("test-v10-rec");

const mkItem = (data: Record<string, unknown>): PkV10MechanicItem => ({
  mechanic_id: "M01",
  mechanic_type: "reward",
  evidence: "",
  confidence: null,
  ambiguity: null,
  activation_rule: null,
  data,
});

describe("PK-V10 Invariants — clean baseline", () => {
  it("inert record passes with zero issues", () => {
    const rec = baseRecord();
    const r = validatePkV10Invariants(rec);
    expect(r.errorCount).toBe(0);
    expect(r.warningCount).toBe(0);
    expect(r.ok).toBe(true);
  });
});

describe("PK-V10 Invariants — #1 reward_form enum (ERROR)", () => {
  it("PASS: valid enum value", () => {
    const rec = baseRecord();
    rec.mechanics_engine.items_block.items = [mkItem({ reward_form: "spin_token" })];
    const r = validatePkV10Invariants(rec);
    expect(r.errorCount).toBe(0);
  });

  it("FAIL: invented value blocked", () => {
    const rec = baseRecord();
    rec.mechanics_engine.items_block.items = [mkItem({ reward_form: "lucky_spin" })];
    const r = validatePkV10Invariants(rec);
    const hit = r.issues.find((i) => i.code === "REWARD_FORM_ENUM_INVALID");
    expect(hit?.severity).toBe("error");
    expect(r.ok).toBe(false);
  });

  it("PASS: empty/missing reward_form is allowed (not yet extracted)", () => {
    const rec = baseRecord();
    rec.mechanics_engine.items_block.items = [
      mkItem({ reward_form: "" }),
      mkItem({}),
    ];
    const r = validatePkV10Invariants(rec);
    expect(r.errorCount).toBe(0);
  });
});

describe("PK-V10 Invariants — #3 max_reward_unlimited mutex (ERROR)", () => {
  it("PASS: unlimited=true + max_reward=null", () => {
    const rec = baseRecord();
    rec.reward_engine.max_reward_unlimited = true;
    rec.reward_engine.max_reward = null;
    expect(validatePkV10Invariants(rec).errorCount).toBe(0);
  });

  it("FAIL: unlimited=true + max_reward=100000", () => {
    const rec = baseRecord();
    rec.reward_engine.max_reward_unlimited = true;
    rec.reward_engine.max_reward = 100000;
    const r = validatePkV10Invariants(rec);
    const hit = r.issues.find(
      (i) => i.path === "reward_engine.max_reward" && i.code === "UNLIMITED_MUTEX_VIOLATION",
    );
    expect(hit?.severity).toBe("error");
    expect(r.ok).toBe(false);
  });
});

describe("PK-V10 Invariants — #4 valid_until_unlimited mutex (ERROR)", () => {
  it("PASS: unlimited=true + valid_until=null", () => {
    const rec = baseRecord();
    rec.period_engine.validity_block.valid_until_unlimited = true;
    rec.period_engine.validity_block.valid_until = null;
    expect(validatePkV10Invariants(rec).errorCount).toBe(0);
  });

  it("FAIL: unlimited=true + valid_until set", () => {
    const rec = baseRecord();
    rec.period_engine.validity_block.valid_until_unlimited = true;
    rec.period_engine.validity_block.valid_until = "2026-12-31";
    const r = validatePkV10Invariants(rec);
    const hit = r.issues.find(
      (i) => i.path === "period_engine.validity_block.valid_until" && i.code === "UNLIMITED_MUTEX_VIOLATION",
    );
    expect(hit?.severity).toBe("error");
    expect(r.ok).toBe(false);
  });
});

describe("PK-V10 Invariants — #5 reward_identity_block boundary (WARNING)", () => {
  it("PASS: filled identity_block + reward_type=physical", () => {
    const rec = baseRecord();
    rec.reward_engine.reward_type = "physical";
    rec.reward_engine.reward_identity_block = { item_name: "iPhone 16", quantity: 1 };
    const r = validatePkV10Invariants(rec);
    expect(r.warningCount).toBe(0);
    expect(r.errorCount).toBe(0);
  });

  it("FAIL (warn): filled identity_block + reward_type=cash", () => {
    const rec = baseRecord();
    rec.reward_engine.reward_type = "cash";
    rec.reward_engine.reward_identity_block = { item_name: "Cashback", quantity: null };
    const r = validatePkV10Invariants(rec);
    const hit = r.issues.find((i) => i.code === "IDENTITY_BLOCK_NON_PHYSICAL");
    expect(hit?.severity).toBe("warning");
    expect(r.ok).toBe(true); // warning does not block
  });

  it("PASS: empty identity_block + non-physical type", () => {
    const rec = baseRecord();
    rec.reward_engine.reward_type = "lucky_spin";
    // identity_block stays {item_name:null, quantity:null} from inert
    expect(validatePkV10Invariants(rec).warningCount).toBe(0);
  });
});

describe("PK-V10 Invariants — #6/#7 external_system ↔ ref_id (WARNING)", () => {
  it("PASS #6: system=none + ref_id=''", () => {
    const rec = baseRecord();
    rec.mechanics_engine.items_block.items = [
      mkItem({ external_system: { system: "none", ref_id: "" } }),
    ];
    expect(validatePkV10Invariants(rec).warningCount).toBe(0);
  });

  it("FAIL #6 (warn): system=none + ref_id non-empty", () => {
    const rec = baseRecord();
    rec.mechanics_engine.items_block.items = [
      mkItem({ external_system: { system: "none", ref_id: "LS-001" } }),
    ];
    const r = validatePkV10Invariants(rec);
    const hit = r.issues.find((i) => i.code === "EXTERNAL_SYSTEM_NONE_REQUIRES_EMPTY_REF");
    expect(hit?.severity).toBe("warning");
  });

  it("PASS #7: system=lucky_spin + ref_id='LS-001'", () => {
    const rec = baseRecord();
    rec.mechanics_engine.items_block.items = [
      mkItem({ external_system: { system: "lucky_spin", ref_id: "LS-001" } }),
    ];
    expect(validatePkV10Invariants(rec).warningCount).toBe(0);
  });

  it("FAIL #7 (warn): system=lucky_spin + ref_id missing", () => {
    const rec = baseRecord();
    rec.mechanics_engine.items_block.items = [
      mkItem({ external_system: { system: "lucky_spin", ref_id: "" } }),
    ];
    const r = validatePkV10Invariants(rec);
    const hit = r.issues.find((i) => i.code === "EXTERNAL_SYSTEM_REF_REQUIRED");
    expect(hit?.severity).toBe("warning");
  });
});

describe("PK-V10 Invariants — #2 reward_form ↔ reward_type mapping (WARNING)", () => {
  it("PASS: cash + cashback (allowed)", () => {
    const rec = baseRecord();
    rec.reward_engine.reward_type = "cash";
    rec.mechanics_engine.items_block.items = [
      { ...mkItem({ reward_form: "cashback" }), mechanic_type: "reward" },
    ];
    const r = validatePkV10Invariants(rec);
    expect(r.warningCount).toBe(0);
    expect(r.errorCount).toBe(0);
  });

  it("PASS: cash + credit_game (dual mapping allowed)", () => {
    const rec = baseRecord();
    rec.reward_engine.reward_type = "cash";
    rec.mechanics_engine.items_block.items = [
      { ...mkItem({ reward_form: "credit_game" }), mechanic_type: "reward" },
    ];
    expect(validatePkV10Invariants(rec).warningCount).toBe(0);
  });

  it("PASS: ticket + mystery_reward", () => {
    const rec = baseRecord();
    rec.reward_engine.reward_type = "ticket";
    rec.mechanics_engine.items_block.items = [
      { ...mkItem({ reward_form: "mystery_reward" }), mechanic_type: "reward" },
    ];
    expect(validatePkV10Invariants(rec).warningCount).toBe(0);
  });

  it("FAIL (warn): physical + cashback", () => {
    const rec = baseRecord();
    rec.reward_engine.reward_type = "physical";
    rec.mechanics_engine.items_block.items = [
      { ...mkItem({ reward_form: "cashback" }), mechanic_type: "reward" },
    ];
    const r = validatePkV10Invariants(rec);
    const hit = r.issues.find((i) => i.code === "REWARD_FORM_TYPE_MISMATCH");
    expect(hit?.severity).toBe("warning");
    expect(r.ok).toBe(true); // warning, not blocking
  });

  it("FAIL (warn): lucky_spin + voucher_code", () => {
    const rec = baseRecord();
    rec.reward_engine.reward_type = "lucky_spin";
    rec.mechanics_engine.items_block.items = [
      { ...mkItem({ reward_form: "voucher_code" }), mechanic_type: "reward" },
    ];
    const r = validatePkV10Invariants(rec);
    const hit = r.issues.find((i) => i.code === "REWARD_FORM_TYPE_MISMATCH");
    expect(hit?.severity).toBe("warning");
  });

  it("SKIP: combo allows any reward_form (no warning)", () => {
    const rec = baseRecord();
    rec.reward_engine.reward_type = "combo";
    rec.mechanics_engine.items_block.items = [
      { ...mkItem({ reward_form: "spin_token" }), mechanic_type: "reward" },
      { ...mkItem({ reward_form: "physical_item" }), mechanic_type: "reward" },
    ];
    expect(validatePkV10Invariants(rec).warningCount).toBe(0);
  });

  it("SKIP: empty reward_form (no warning)", () => {
    const rec = baseRecord();
    rec.reward_engine.reward_type = "physical";
    rec.mechanics_engine.items_block.items = [
      { ...mkItem({ reward_form: "" }), mechanic_type: "reward" },
    ];
    expect(validatePkV10Invariants(rec).warningCount).toBe(0);
  });

  it("SKIP: empty reward_type (no warning)", () => {
    const rec = baseRecord();
    rec.reward_engine.reward_type = "";
    rec.mechanics_engine.items_block.items = [
      { ...mkItem({ reward_form: "cashback" }), mechanic_type: "reward" },
    ];
    expect(validatePkV10Invariants(rec).warningCount).toBe(0);
  });

  it("SKIP: non-reward mechanic_type (no warning even on mismatch)", () => {
    const rec = baseRecord();
    rec.reward_engine.reward_type = "physical";
    rec.mechanics_engine.items_block.items = [
      { ...mkItem({ reward_form: "cashback" }), mechanic_type: "claim" },
    ];
    expect(validatePkV10Invariants(rec).warningCount).toBe(0);
  });

  it("Invariant #2 does not affect ok=true (warning-only Phase A)", () => {
    const rec = baseRecord();
    rec.reward_engine.reward_type = "voucher";
    rec.mechanics_engine.items_block.items = [
      { ...mkItem({ reward_form: "spin_token" }), mechanic_type: "reward" },
    ];
    const r = validatePkV10Invariants(rec);
    expect(r.warningCount).toBeGreaterThan(0);
    expect(r.errorCount).toBe(0);
    expect(r.ok).toBe(true);
  });
});
