/**
 * Regression guard for F3 Runtime Enum Alignment (HIGH-1 + HIGH-2).
 * Prevents reintroduction of legacy enum keys in FormWizardV10 label dictionaries.
 * Scope: UI labels only. Does NOT validate schema, extractor, or Supabase.
 */
import { describe, it, expect } from "vitest";
import { L_TRIGGER_EVENT, L_TIER_ARCHETYPE } from "../form-wizard-v10/labels";

describe("F3 enum alignment — L_TRIGGER_EVENT (HIGH-2)", () => {
  const keys = Object.keys(L_TRIGGER_EVENT);
  it("includes apk_download", () => expect(keys).toContain("apk_download"));
  it("includes lottery_result_match", () => expect(keys).toContain("lottery_result_match"));
  it("does not include app_install", () => expect(keys).not.toContain("app_install"));
});

describe("F3 enum alignment — L_TIER_ARCHETYPE (HIGH-1)", () => {
  const keys = Object.keys(L_TIER_ARCHETYPE);
  it("includes point_redemption", () => expect(keys).toContain("point_redemption"));
  it("does not include point_store", () => expect(keys).not.toContain("point_store"));
});
