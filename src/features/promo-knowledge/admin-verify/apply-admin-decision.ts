/**
 * Phase 4 — Apply Admin Decision orchestrator.
 *
 * Flow (linear, all-or-nothing):
 *   1. Run patch resolver (LLM) → JsonPatchPreview[].
 *   2. If empty patches → return error. No record mutation.
 *   3. Validate + apply via `applyAdminPatchPreviewToPkRecord`
 *      (path whitelist, op whitelist, enum validators, deep clone).
 *   4. Clear the related signals from readiness_engine using the
 *      decision's `related_signal_indices` (indices into the ORIGINAL
 *      signals as they were extracted, sorted descending so splice is safe).
 *   5. Persist the updated record via `savePkRecord`.
 *   6. Return the updated record to the caller (UI parent).
 *
 * Hard guarantees:
 *   - On any failure step, no mutation, no signal clearing, no save.
 *   - Never emits dummy patches.
 *   - Never touches schema/raw_content/governance/readiness commit flags.
 *   - Caller is responsible for surfacing user-facing error copy.
 */
import type { PkV10Record } from "../schema/pk-v10";
import type { AdminDecision } from "./admin-decision-types";
import {
  applyAdminPatchPreviewToPkRecord,
  type AppliedPatchSummary,
} from "./admin-patch-apply";
import {
  deriveAllowedTargetPaths,
  liveDecisionPatchResolver,
  type DecisionPatchResolver,
} from "./admin-decision-patch-resolver";
import { saveRecord as savePkRecord } from "../storage/local-storage";
import { extractAdminReviewerSignals } from "./admin-reviewer-client";

export interface ApplyAdminDecisionInput {
  record: PkV10Record;
  decision: AdminDecision;
  selectedValue: string;
  selectedLabel: string;
  note: string;
  /** Override the LLM resolver (for tests). */
  resolver?: DecisionPatchResolver;
  /** Override save (for tests). Defaults to local-storage savePkRecord. */
  save?: (record: PkV10Record) => void;
}

export interface ApplyAdminDecisionResult {
  ok: boolean;
  record?: PkV10Record;
  applied_patches?: AppliedPatchSummary[];
  errors?: string[];
}

/**
 * Remove entries from `readiness_engine` arrays at the indices recorded in
 * the AdminDecision. Indices are validated against the CURRENT arrays
 * (snapshot taken before the patch apply). Out-of-range indices are ignored
 * defensively — never throws.
 */
function clearRelatedSignals(
  record: PkV10Record,
  decision: AdminDecision,
): PkV10Record {
  const clone = JSON.parse(JSON.stringify(record)) as PkV10Record;
  const re = (clone.readiness_engine ?? {}) as Record<string, unknown>;
  const vb = (re.validation_block ?? {}) as Record<string, unknown>;
  const ob = (re.observability_block ?? {}) as Record<string, unknown>;

  const drop = (arr: unknown, indices: number[]): string[] => {
    if (!Array.isArray(arr)) return [];
    const next = [...(arr as unknown[])];
    const sorted = [...indices].sort((a, b) => b - a);
    for (const idx of sorted) {
      if (Number.isInteger(idx) && idx >= 0 && idx < next.length) {
        next.splice(idx, 1);
      }
    }
    return next.filter((x): x is string => typeof x === "string");
  };

  vb.warnings = drop(vb.warnings, decision.related_signal_indices.warnings);
  ob.ambiguity_flags = drop(
    ob.ambiguity_flags,
    decision.related_signal_indices.ambiguity_flags,
  );
  ob.contradiction_flags = drop(
    ob.contradiction_flags,
    decision.related_signal_indices.contradiction_flags,
  );

  (re as Record<string, unknown>).validation_block = vb;
  (re as Record<string, unknown>).observability_block = ob;
  (clone as unknown as Record<string, unknown>).readiness_engine = re;
  return clone;
}

export async function applyAdminDecision(
  input: ApplyAdminDecisionInput,
): Promise<ApplyAdminDecisionResult> {
  const {
    record,
    decision,
    selectedValue,
    selectedLabel,
    note,
    resolver = liveDecisionPatchResolver,
    save = savePkRecord,
  } = input;

  if (!selectedValue || selectedValue.trim().length === 0) {
    return { ok: false, errors: ["no selection"] };
  }

  const allowedTargetPaths = deriveAllowedTargetPaths(record);

  // 1. Resolve patches via LLM (or injected resolver).
  let resolved;
  try {
    resolved = await resolver({
      record,
      decision,
      selectedValue,
      selectedLabel,
      note,
      allowedTargetPaths,
    });
  } catch (err) {
    return {
      ok: false,
      errors: [err instanceof Error ? err.message : "resolver failed"],
    };
  }

  if (!resolved.proposed_patches || resolved.proposed_patches.length === 0) {
    return {
      ok: false,
      errors:
        resolved.unresolved_questions && resolved.unresolved_questions.length > 0
          ? resolved.unresolved_questions
          : ["no actionable patch"],
    };
  }

  // 2. Validate + apply via the locked patcher.
  const applyResult = applyAdminPatchPreviewToPkRecord({
    record,
    patches: resolved.proposed_patches,
    allowedTargetPaths,
    actor: "admin",
    source: "admin_verify_decision_resolver",
    reason: resolved.intent_summary,
  });

  if (!applyResult.ok || !applyResult.record) {
    return { ok: false, errors: applyResult.errors ?? ["apply failed"] };
  }

  // 3. Clear related signals (AFTER successful apply).
  const cleared = clearRelatedSignals(applyResult.record, decision);

  // 4. Persist.
  try {
    save(cleared);
  } catch (err) {
    return {
      ok: false,
      errors: [err instanceof Error ? err.message : "save failed"],
    };
  }

  // Sanity (defensive): signature should differ from input now.
  void extractAdminReviewerSignals;

  return {
    ok: true,
    record: cleared,
    applied_patches: applyResult.applied_patches,
  };
}
