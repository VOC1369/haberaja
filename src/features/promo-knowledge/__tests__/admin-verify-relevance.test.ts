/**
 * Admin Verify — relevance gate tests (V.10.1)
 *
 * Locks behavior of gap-reader + field-registry isRelevant() for the
 * not_stated/missing branch. Authority gate (explicit/inferred/etc.)
 * remains tested by existing fixtures; here we focus on relevance.
 *
 * NOTE on fixtures:
 *   - Baseline fixtures under __tests__/baseline/ are still legacy
 *     V.06 / V.09 shape (no schema_version, no _field_status,
 *     no variant_engine, no max_reward_unlimited).
 *   - These tests intentionally do NOT load those fixtures. Instead
 *     they build minimal V.10.1 preconditions in-memory via
 *     createInertPkV10Record() + targeted field/status writes.
 *   - This avoids dragging fixture migration into the relevance-gate
 *     scope; baseline upgrade is tracked as a separate task.
 */

import { describe, expect, it } from "vitest";
import { createInertPkV10Record } from "@/features/promo-knowledge/schema/pk-v10";
import { readGapsFromJson } from "@/features/promo-knowledge/admin-verify/gap-reader";

const base = () => createInertPkV10Record("test-rec");

const setStatus = (
  rec: ReturnType<typeof base>,
  path: string,
  status: string,
) => {
  rec._field_status = { ...(rec._field_status ?? {}), [path]: status } as never;
};

describe("Admin Verify relevance gate", () => {
  it("Geo explicit → no geo question", () => {
    const r = base();
    r.scope_engine.geo_block.geo_restriction = "indonesia";
    setStatus(r, "scope_engine.geo_block.geo_restriction", "explicit");

    const gaps = readGapsFromJson(r);
    expect(
      gaps.find((g) => g.path === "scope_engine.geo_block.geo_restriction"),
    ).toBeUndefined();
  });

  it("Referral + downline_winlose → no min_deposit question", () => {
    const r = base();
    r.identity_engine.promo_block.promo_type = "referral";
    r.reward_engine.calculation_basis = "downline_winlose";
    r.trigger_engine.primary_trigger_block.trigger_event = "downline_activity";
    setStatus(r, "reward_engine.requirement_block.min_deposit", "not_stated");

    const gaps = readGapsFromJson(r);
    expect(
      gaps.find(
        (g) => g.path === "reward_engine.requirement_block.min_deposit",
      ),
    ).toBeUndefined();
  });

  it("Referral + downline_winlose → no turnover_basis question", () => {
    const r = base();
    r.identity_engine.promo_block.promo_type = "referral";
    r.reward_engine.calculation_basis = "downline_winlose";
    r.trigger_engine.primary_trigger_block.trigger_event = "downline_activity";
    setStatus(r, "taxonomy_engine.logic_block.turnover_basis", "not_stated");

    const gaps = readGapsFromJson(r);
    expect(
      gaps.find((g) => g.path === "taxonomy_engine.logic_block.turnover_basis"),
    ).toBeUndefined();
  });

  it("max_reward_unlimited=true → no max_reward question", () => {
    const r = base();
    r.reward_engine.max_reward = null;
    r.reward_engine.max_reward_unlimited = true;
    setStatus(r, "reward_engine.max_reward", "not_stated");

    const gaps = readGapsFromJson(r);
    expect(
      gaps.find((g) => g.path === "reward_engine.max_reward"),
    ).toBeUndefined();
  });

  it("Welcome/deposit bonus missing min_deposit → still asks", () => {
    const r = base();
    r.identity_engine.promo_block.promo_type = "welcome_bonus";
    r.reward_engine.calculation_basis = "deposit";
    r.trigger_engine.primary_trigger_block.trigger_event = "first_deposit";
    setStatus(r, "reward_engine.requirement_block.min_deposit", "not_stated");

    const gaps = readGapsFromJson(r);
    expect(
      gaps.find(
        (g) => g.path === "reward_engine.requirement_block.min_deposit",
      ),
    ).toBeDefined();
  });
});
