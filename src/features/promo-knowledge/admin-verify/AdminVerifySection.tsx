/**
 * ADMIN VERIFY SECTION — Phase 3 (LLM Reviewer renderer)
 *
 * The legacy registry / gap-reader / extractor-issue / F3-compliance
 * pipeline is no longer imported at runtime. The single source of admin
 * questions is the `admin-reviewer` edge function, surfaced via
 * `useAdminDecisions`.
 *
 * Hard rules:
 *   - Never mutate PkV10Record from this component.
 *   - Never store decisions on PkV10Record (cache lives in localStorage).
 *   - On reviewer error, render a blocking banner. No fallback to raw signals.
 *   - No legacy imports: buildIssueQuestions, buildF3ComplianceQuestions,
 *     dedupIssueQuestions, humanizeIssue, ExtractorIssueCard, readGapsFromJson,
 *     deterministic-apply, enum-normalizer, field-registry — all dropped from
 *     runtime. Files are retained on disk for legacy tests only.
 *
 * Apply flow blocker (reported, not patched):
 *   AdminDecision does not yet carry typed field paths the existing
 *   `applyAdminPatchPreviewToPkRecord` resolver needs. The bridge from
 *   AdminDecision → PkV10Record patch is scheduled for Phase 4. Until then,
 *   each card surfaces an explicit inline note and the Apply button stays
 *   disabled. No dummy patches are emitted.
 */

import type { PkV10Record } from "@/features/promo-knowledge/schema/pk-v10";
import { useAdminDecisions } from "./useAdminDecisions";
import { AdminDecisionsRenderer } from "./AdminDecisionsRenderer";

export interface AdminVerifySectionProps {
  record: PkV10Record | null;
  // Kept in the contract so the parent (`PseudoKnowledgeSection`) does not
  // change. Phase 4 will wire this when the AdminDecision → patch bridge ships.
  onApply: (next: PkV10Record) => void;
}

export function AdminVerifySection({ record }: AdminVerifySectionProps) {
  const { state, decisions, error, retry } = useAdminDecisions(record);

  return (
    <AdminDecisionsRenderer
      state={state}
      decisions={decisions}
      error={error}
      onRetry={retry}
    />
  );
}
