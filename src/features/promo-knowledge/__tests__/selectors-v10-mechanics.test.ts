/**
 * PK V.10 SELECTORS — Step 7 tests.
 *
 * Covers:
 *   - findMechanic predicate-based disambiguation
 *   - sel.luckySpinRefId / luckySpinMaxPerDay (mechanic_type=reward + reward_form=spin_token)
 *   - sel.spinValidUntil / spinValidUntilUnlimited (time_window + scope=reward_validity)
 *   - sel.physicalItemName / physicalQuantity
 *   - sel.maxRewardUnlimited / validUntilUnlimited
 */

import { describe, it, expect } from "vitest";
import { sel } from "../selectors/pk-v10-selectors";
import {
  createInertPkV10Record,
  type PkV10Record,
  type PkV10MechanicItem,
} from "../schema/pk-v10";

const base = (): PkV10Record => createInertPkV10Record("sel-v10-test");

const mk = (
  mechanic_id: string,
  mechanic_type: string,
  data: Record<string, unknown>,
): PkV10MechanicItem => ({
  mechanic_id,
  mechanic_type,
  evidence: "",
  confidence: null,
  ambiguity: null,
  activation_rule: null,
  data,
});

const withItems = (items: PkV10MechanicItem[]): PkV10Record => {
  const rec = base();
  rec.mechanics_engine.items_block.items = items;
  return rec;
};

// ────────────────────────────────────────────────────────────────────────────
describe("inert baseline → all step-7 selectors return null/false", () => {
  const rec = base();
  it("luckySpinRefId null", () => expect(sel.luckySpinRefId(rec)).toBeNull());
  it("luckySpinMaxPerDay null", () =>
    expect(sel.luckySpinMaxPerDay(rec)).toBeNull());
  it("spinValidUntil null", () => expect(sel.spinValidUntil(rec)).toBeNull());
  it("spinValidUntilUnlimited false", () =>
    expect(sel.spinValidUntilUnlimited(rec)).toBe(false));
  it("physicalItemName null", () =>
    expect(sel.physicalItemName(rec)).toBeNull());
  it("physicalQuantity null", () =>
    expect(sel.physicalQuantity(rec)).toBeNull());
  it("maxRewardUnlimited false", () =>
    expect(sel.maxRewardUnlimited(rec)).toBe(false));
  it("validUntilUnlimited false", () =>
    expect(sel.validUntilUnlimited(rec)).toBe(false));
});

// ────────────────────────────────────────────────────────────────────────────
describe("luckySpinRefId / luckySpinMaxPerDay — predicate disambiguation", () => {
  it("picks reward item with reward_form=spin_token, ignores cashback reward", () => {
    const rec = withItems([
      mk("M01", "reward", {
        reward_form: "cashback",
        external_system: { system: "none", ref_id: "" },
        execution: { max_per_day: 99 },
      }),
      mk("M02", "reward", {
        reward_form: "spin_token",
        external_system: {
          system: "spin_engine",
          ref_id: "LS-001",
          redemption_method: "auto",
        },
        execution: { max_per_day: 5 },
      }),
    ]);
    expect(sel.luckySpinRefId(rec)).toBe("LS-001");
    expect(sel.luckySpinMaxPerDay(rec)).toBe(5);
  });

  it("returns null when no reward item has reward_form=spin_token", () => {
    const rec = withItems([
      mk("M01", "reward", {
        reward_form: "cashback",
        external_system: { system: "none", ref_id: "" },
        execution: { max_per_day: 10 },
      }),
    ]);
    expect(sel.luckySpinRefId(rec)).toBeNull();
    expect(sel.luckySpinMaxPerDay(rec)).toBeNull();
  });

  it("returns null when external_system / execution missing on the matching item", () => {
    const rec = withItems([
      mk("M01", "reward", { reward_form: "spin_token" }),
    ]);
    expect(sel.luckySpinRefId(rec)).toBeNull();
    expect(sel.luckySpinMaxPerDay(rec)).toBeNull();
  });

  it("returns null when ref_id is empty string (s() collapses '' → null)", () => {
    const rec = withItems([
      mk("M01", "reward", {
        reward_form: "spin_token",
        external_system: { system: "spin_engine", ref_id: "" },
      }),
    ]);
    expect(sel.luckySpinRefId(rec)).toBeNull();
  });

  it("ignores wrong-typed max_per_day (string) — strict typing", () => {
    const rec = withItems([
      mk("M01", "reward", {
        reward_form: "spin_token",
        execution: { max_per_day: "5" },
      }),
    ]);
    expect(sel.luckySpinMaxPerDay(rec)).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("spinValidUntil / spinValidUntilUnlimited — time_window + scope predicate", () => {
  it("picks time_window with scope=reward_validity, ignores promo_period", () => {
    const rec = withItems([
      mk("M01", "time_window", {
        scope: "promo_period",
        validity: { valid_until: "2026-12-31", valid_until_unlimited: false },
      }),
      mk("M02", "time_window", {
        scope: "reward_validity",
        validity: { valid_until: "2026-06-30", valid_until_unlimited: false },
      }),
    ]);
    expect(sel.spinValidUntil(rec)).toBe("2026-06-30");
    expect(sel.spinValidUntilUnlimited(rec)).toBe(false);
  });

  it("returns unlimited=true when sibling flag is set", () => {
    const rec = withItems([
      mk("M01", "time_window", {
        scope: "reward_validity",
        validity: { valid_until: null, valid_until_unlimited: true },
      }),
    ]);
    expect(sel.spinValidUntil(rec)).toBeNull();
    expect(sel.spinValidUntilUnlimited(rec)).toBe(true);
  });

  it("returns null + false when no reward_validity window exists", () => {
    const rec = withItems([
      mk("M01", "time_window", {
        scope: "claim_window",
        validity: { valid_until: "2026-01-01", valid_until_unlimited: false },
      }),
    ]);
    expect(sel.spinValidUntil(rec)).toBeNull();
    expect(sel.spinValidUntilUnlimited(rec)).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("reward identity (flat engine path)", () => {
  it("reads reward_identity_block.item_name + quantity", () => {
    const rec = base();
    rec.reward_engine.reward_identity_block = {
      item_name: "Iphone 15",
      quantity: 2,
    };
    expect(sel.physicalItemName(rec)).toBe("Iphone 15");
    expect(sel.physicalQuantity(rec)).toBe(2);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("unlimited siblings (Step 5B)", () => {
  it("maxRewardUnlimited true when flag set", () => {
    const rec = base();
    rec.reward_engine.max_reward = null;
    rec.reward_engine.max_reward_unlimited = true;
    expect(sel.maxRewardUnlimited(rec)).toBe(true);
  });

  it("validUntilUnlimited true when flag set", () => {
    const rec = base();
    rec.period_engine.validity_block.valid_until = null;
    rec.period_engine.validity_block.valid_until_unlimited = true;
    expect(sel.validUntilUnlimited(rec)).toBe(true);
  });
});
