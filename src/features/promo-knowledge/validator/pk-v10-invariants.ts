/**
 * PK-V10 INVARIANT VALIDATOR — Step 6B
 *
 * Purpose: prevent malformed-but-JSON-valid output from entering the system.
 * Pure function. No side effects. No mode decisions. No mutation.
 *
 * SCOPE — Step 6B only:
 *   #1 reward_form must be in PK_V10_REWARD_FORM         [ERROR]
 *   #2 reward_form ↔ reward_type mapping consistency      [WARNING]
 *       (Phase A soft launch — see REWARD_MAPPING_MATRIX_V10.md)
 *   #3 max_reward_unlimited=true → max_reward===null      [ERROR]
 *   #4 valid_until_unlimited=true → valid_until===null    [ERROR]
 *   #5 reward_identity_block (item_name|quantity) only when
 *      reward_engine.reward_type === "physical"           [WARNING]
 *   #6 external_system.system === "none" → ref_id === ""  [WARNING]
 *   #7 external_system.system !== "none" → ref_id non-empty[WARNING]
 *
 * EXPLICITLY OUT OF SCOPE: (none — Step 6B is fully wired post matrix lock)
 *
 * DESIGN NOTES:
 *   - Severity tier mirrors validator/index.ts (error|warning|info).
 *   - Walks mechanics_engine.items[].data defensively. The `data` blob is
 *     intentionally open-typed (Record<string, unknown>); we narrow at the
 *     edge instead of trusting structure.
 *   - This validator does NOT touch PK-06.0 validator. It is a sibling.
 */

import {
  PK_V10_REWARD_FORM,
  type PkV10Record,
} from "../schema/pk-v10";

// Mirror the public validation report shape from the V06 validator so callers
// can treat reports uniformly without coupling to that file.
export type PkV10ValidationSeverity = "error" | "warning" | "info";

export interface PkV10ValidationIssue {
  severity: PkV10ValidationSeverity;
  path: string;
  code: string;
  message: string;
}

export interface PkV10ValidationReport {
  ok: boolean; // true when zero errors
  issues: PkV10ValidationIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

const issue = (
  severity: PkV10ValidationSeverity,
  path: string,
  code: string,
  message: string,
): PkV10ValidationIssue => ({ severity, path, code, message });

// ─── Local type guards ────────────────────────────────────────────────────
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Reward Mapping Matrix V10 (Invariant #2 — Phase A WARNING).
 * Source of truth: src/features/promo-knowledge/schema/REWARD_MAPPING_MATRIX_V10.md
 *
 * Rules:
 *   - `combo` is intentionally absent → handled as "skip" by caller (always pass).
 *   - Empty / missing reward_form → skip (not validated here).
 *   - reward_type not in this map → skip (no opinion until matrix amended).
 */
const REWARD_TYPE_TO_ALLOWED_FORMS: Readonly<Record<string, readonly string[]>> = {
  cash: ["cashback", "credit_game"],
  lucky_spin: ["spin_token"],
  voucher: ["voucher_code"],
  physical: ["physical_item"],
  freespin: ["freespin_token"],
  ticket: ["mystery_reward"],
  credit_game: ["credit_game"],
  discount: ["voucher_code"],
};

/**
 * validatePkV10Invariants
 * Pure function. Returns a severity-tiered report.
 */
export function validatePkV10Invariants(rec: PkV10Record): PkV10ValidationReport {
  const issues: PkV10ValidationIssue[] = [];

  // ─── #3 max_reward_unlimited mutex ────────────────────────────────────
  const reward = rec.reward_engine;
  if (reward) {
    if (reward.max_reward_unlimited === true && reward.max_reward !== null) {
      issues.push(
        issue(
          "error",
          "reward_engine.max_reward",
          "UNLIMITED_MUTEX_VIOLATION",
          `max_reward_unlimited=true requires max_reward===null, got ${String(reward.max_reward)}.`,
        ),
      );
    }

    // ─── #5 reward_identity_block boundary ────────────────────────────
    const rib = reward.reward_identity_block;
    const ribFilled =
      isPlainObject(rib) &&
      ((rib.item_name !== null && rib.item_name !== undefined) ||
        (rib.quantity !== null && rib.quantity !== undefined));
    if (ribFilled && reward.reward_type !== "physical") {
      issues.push(
        issue(
          "warning",
          "reward_engine.reward_identity_block",
          "IDENTITY_BLOCK_NON_PHYSICAL",
          `reward_identity_block is populated but reward_type="${String(reward.reward_type)}" (must be "physical").`,
        ),
      );
    }
  }

  // ─── #4 valid_until_unlimited mutex ───────────────────────────────────
  const vb = rec.period_engine?.validity_block;
  if (vb && vb.valid_until_unlimited === true && vb.valid_until !== null) {
    issues.push(
      issue(
        "error",
        "period_engine.validity_block.valid_until",
        "UNLIMITED_MUTEX_VIOLATION",
        `valid_until_unlimited=true requires valid_until===null, got "${String(vb.valid_until)}".`,
      ),
    );
  }

  // ─── #1, #6, #7 — walk mechanics_engine.items[] ───────────────────────
  const items = rec.mechanics_engine?.items_block?.items ?? [];
  items.forEach((item, idx) => {
    const data = item?.data;
    if (!isPlainObject(data)) return;

    // #1 reward_form enum check (only when present + non-empty)
    const rf = data.reward_form;
    if (rf !== undefined && rf !== null && rf !== "") {
      if (
        typeof rf !== "string" ||
        !(PK_V10_REWARD_FORM as readonly string[]).includes(rf)
      ) {
        issues.push(
          issue(
            "error",
            `mechanics_engine.items[${idx}].data.reward_form`,
            "REWARD_FORM_ENUM_INVALID",
            `reward_form "${String(rf)}" is not in PK_V10_REWARD_FORM enum.`,
          ),
        );
      }
    }

    // #6 / #7 — external_system ↔ ref_id consistency
    const ext = data.external_system;
    if (isPlainObject(ext)) {
      const system = ext.system;
      const refId = ext.ref_id;
      if (system === "none") {
        if (refId !== "") {
          issues.push(
            issue(
              "warning",
              `mechanics_engine.items[${idx}].data.external_system.ref_id`,
              "EXTERNAL_SYSTEM_NONE_REQUIRES_EMPTY_REF",
              `external_system.system="none" requires ref_id="" (empty string), got ${JSON.stringify(refId)}.`,
            ),
          );
        }
      } else if (typeof system === "string" && system.length > 0) {
        if (typeof refId !== "string" || refId.length === 0) {
          issues.push(
            issue(
              "warning",
              `mechanics_engine.items[${idx}].data.external_system.ref_id`,
              "EXTERNAL_SYSTEM_REF_REQUIRED",
              `external_system.system="${system}" requires non-empty ref_id, got ${JSON.stringify(refId)}.`,
            ),
          );
        }
      }
    }
  });

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;

  return {
    ok: errorCount === 0,
    issues,
    errorCount,
    warningCount,
    infoCount,
  };
}
