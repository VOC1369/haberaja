/**
 * PK-06.0 STATE TRANSITION — Gate 1.5 hardening test.
 *
 * Contract (mirrors PromoKnowledgePage advance gating):
 *   - State cannot advance if validator reports any error.
 *   - A clean record follows: ai_draft → reviewed → finalized → published → archived.
 */

import { describe, it, expect } from "vitest";
import { createInertPromoKnowledgeRecord } from "../schema/inert";
import { validatePromoKnowledge } from "../validator";
import type { LifecycleState, PromoKnowledgeRecord } from "../schema/pk-06.0";

const NEXT_STATE: Partial<Record<LifecycleState, LifecycleState>> = {
  ai_draft: "reviewed",
  reviewed: "finalized",
  finalized: "published",
  published: "archived",
};

/** Mirrors the gating logic in PromoKnowledgePage.handleAdvanceState. */
function tryAdvance(rec: PromoKnowledgeRecord): { ok: boolean; rec: PromoKnowledgeRecord; reason?: string } {
  const cur = rec.readiness_engine.state_block.state;
  const next = NEXT_STATE[cur];
  if (!next) return { ok: false, rec, reason: "TERMINAL" };
  const report = validatePromoKnowledge(rec);
  if (!report.ok) return { ok: false, rec, reason: "VALIDATION_BLOCKED" };
  return {
    ok: true,
    rec: {
      ...rec,
      readiness_engine: {
        ...rec.readiness_engine,
        state_block: {
          state: next,
          state_changed_at: new Date().toISOString(),
          state_changed_by: "test",
        },
      },
    },
  };
}

function makeValidRecord(): PromoKnowledgeRecord {
  const rec = createInertPromoKnowledgeRecord("state-test-1");
  rec.claim_engine.method_block.claim_method = "manual_livechat";
  return rec;
}

describe("PK-06.0 State Transition — validation gating", () => {
  it("blocks advance when validator reports an ERROR (tampered D-6)", () => {
    const rec = makeValidRecord();
    (rec as { domain: string }).domain = "wrong_domain";
    const result = tryAdvance(rec);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("VALIDATION_BLOCKED");
    expect(result.rec.readiness_engine.state_block.state).toBe("ai_draft");
  });

  it("blocks advance when claim_method enum is invalid", () => {
    const rec = makeValidRecord();
    rec.claim_engine.method_block.claim_method = "invalid_method" as never;
    const result = tryAdvance(rec);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("VALIDATION_BLOCKED");
  });

  it("advances valid record through full lifecycle: ai_draft → reviewed → finalized → published → archived", () => {
    let rec = makeValidRecord();
    const path: LifecycleState[] = ["ai_draft"];

    for (let i = 0; i < 4; i++) {
      const result = tryAdvance(rec);
      expect(result.ok).toBe(true);
      rec = result.rec;
      path.push(rec.readiness_engine.state_block.state);
    }

    expect(path).toEqual(["ai_draft", "reviewed", "finalized", "published", "archived"]);

    // Terminal: no further advance possible
    const terminal = tryAdvance(rec);
    expect(terminal.ok).toBe(false);
    expect(terminal.reason).toBe("TERMINAL");
  });

  it("warning-only state (priority_order subset issue) does NOT block advance", () => {
    const rec = makeValidRecord();
    rec.claim_engine.channels_block = {
      channels: ["livechat"],
      priority_order: ["whatsapp"], // warning, not error
    };
    const report = validatePromoKnowledge(rec);
    expect(report.warningCount).toBeGreaterThan(0);
    expect(report.errorCount).toBe(0);

    const result = tryAdvance(rec);
    expect(result.ok).toBe(true);
    expect(result.rec.readiness_engine.state_block.state).toBe("reviewed");
  });
});
