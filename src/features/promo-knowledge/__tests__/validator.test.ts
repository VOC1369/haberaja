/**
 * PK-06.0 VALIDATOR — Gate 1.5 hardening tests.
 *
 * Coverage:
 *   1. D-6 governance metadata mismatch → error
 *   2. _schema.version drift → info only (non-blocking)
 *   3. Invalid claim_method enum → error
 *   4. proof_required=true + empty proof_types → error
 *   5. priority_order not subset of channels → warning
 */

import { describe, it, expect } from "vitest";
import { validatePromoKnowledge } from "../validator";
import { createInertPromoKnowledgeRecord } from "../schema/inert";
import { PK_REGISTRY } from "../registry";

const baseRecord = () => createInertPromoKnowledgeRecord("test-rec-1");

describe("PK-06.0 Validator — D-6 Governance", () => {
  it("flags governance_version mismatch as ERROR", () => {
    const rec = baseRecord();
    (rec as { governance_version: string }).governance_version = "V.05";
    const report = validatePromoKnowledge(rec);
    const hit = report.issues.find((i) => i.code === "D6_GOV_VERSION_MISMATCH");
    expect(hit).toBeDefined();
    expect(hit?.severity).toBe("error");
    expect(report.ok).toBe(false);
  });

  it("flags domain_version mismatch as ERROR", () => {
    const rec = baseRecord();
    (rec as { domain_version: string }).domain_version = "PK-05.9";
    const report = validatePromoKnowledge(rec);
    expect(report.issues.some((i) => i.code === "D6_DOMAIN_VERSION_MISMATCH" && i.severity === "error")).toBe(true);
  });

  it("flags domain mismatch as ERROR", () => {
    const rec = baseRecord();
    (rec as { domain: string }).domain = "event_ops";
    const report = validatePromoKnowledge(rec);
    expect(report.issues.some((i) => i.code === "D6_DOMAIN_MISMATCH" && i.severity === "error")).toBe(true);
  });

  it("treats _schema.version drift as INFO only (non-blocking)", () => {
    const rec = baseRecord();
    rec._schema = { ...rec._schema!, version: "9.9" };
    const report = validatePromoKnowledge(rec);
    const hit = report.issues.find((i) => i.code === "SPEC_HISTORICAL_DRIFT");
    expect(hit).toBeDefined();
    expect(hit?.severity).toBe("info");
    // Drift alone (with correct D-6 + valid claim_method) must not block
    rec.claim_engine.method_block.claim_method = "manual_livechat";
    const report2 = validatePromoKnowledge(rec);
    expect(report2.errorCount).toBe(0);
    expect(report2.ok).toBe(true);
  });

  it("passes clean when D-6 + _schema match registry", () => {
    const rec = baseRecord();
    rec.claim_engine.method_block.claim_method = "manual_livechat";
    const report = validatePromoKnowledge(rec);
    expect(report.errorCount).toBe(0);
    expect(rec.governance_version).toBe(PK_REGISTRY.governance_version);
  });
});

describe("PK-06.0 Validator — claim_engine rules", () => {
  it("flags invalid claim_method as ERROR", () => {
    const rec = baseRecord();
    rec.claim_engine.method_block.claim_method = "telepathy" as never;
    const report = validatePromoKnowledge(rec);
    const hit = report.issues.find(
      (i) => i.path === "claim_engine.method_block.claim_method" && i.code === "ENUM_INVALID",
    );
    expect(hit).toBeDefined();
    expect(hit?.severity).toBe("error");
  });

  it("flags proof_required=true + empty proof_types as ERROR", () => {
    const rec = baseRecord();
    rec.claim_engine.method_block.claim_method = "manual_livechat";
    rec.claim_engine.proof_requirement_block = {
      proof_required: true,
      proof_types: [],
      proof_destinations: ["livechat"],
    };
    const report = validatePromoKnowledge(rec);
    const hit = report.issues.find((i) => i.code === "CROSSFIELD_PROOF_TYPES_REQUIRED");
    expect(hit).toBeDefined();
    expect(hit?.severity).toBe("error");
    expect(report.ok).toBe(false);
  });

  it("flags priority_order not subset of channels as WARNING (non-blocking)", () => {
    const rec = baseRecord();
    rec.claim_engine.method_block.claim_method = "manual_livechat";
    rec.claim_engine.channels_block = {
      channels: ["livechat"],
      priority_order: ["whatsapp"], // not in channels[]
    };
    const report = validatePromoKnowledge(rec);
    const hit = report.issues.find((i) => i.code === "PRIORITY_NOT_SUBSET");
    expect(hit).toBeDefined();
    expect(hit?.severity).toBe("warning");
    // Warning must NOT block ok
    expect(report.errorCount).toBe(0);
    expect(report.ok).toBe(true);
  });
});
