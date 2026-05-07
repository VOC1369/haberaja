/**
 * PR-18 — Display-only summary for the Step9 publish gate.
 *
 * PURE / READ-ONLY. Never mutates record. Never bypasses canPublish.
 *
 * REVERT NOTE (PR-18):
 *  - REASON_MAP, humanizeReason, detectSkGameTypeConflict,
 *    detectProductAmbiguity, BlockerActionItem, and all per-promo
 *    keyword/regex matching of warning/ambiguity/contradiction text
 *    have been removed.
 *  - Issue resolution belongs in Admin Verify (LLM reasoning), not Step9.
 *  - Step9 is now a final safety gate only: it shows a generic summary and
 *    points the admin back to Admin Verify.
 */
import type { PkV10Record } from "../schema/pk-v10";

export interface PublishBlockerDisplay {
  blocked: boolean;
  title: string;
  subtitle: string;
  /** Compact one-liner for the gate card. */
  shortSummary: string;
  /** Raw canPublish reasons — surfaced verbatim under "Detail teknis". */
  technicalReasons: string[];
  /** Raw extractor flag arrays — display-only counts/lists, no parsing. */
  warnings: string[];
  ambiguity: string[];
  contradictions: string[];
  /** Counts for headline display. */
  totalIssueCount: number;
}

export function buildPublishBlockerDisplay(
  rec: PkV10Record | null,
  publishGate: { ok: boolean; reasons: string[] },
): PublishBlockerDisplay {
  const technical = publishGate.reasons ?? [];
  const readiness = (rec?.readiness_engine ?? {}) as Record<string, unknown>;
  const obs = (readiness.observability_block ?? {}) as Record<string, unknown>;
  const val = (readiness.validation_block ?? {}) as Record<string, unknown>;

  const warnings: string[] = Array.isArray(val.warnings) ? (val.warnings as string[]) : [];
  const ambiguity: string[] = Array.isArray(obs.ambiguity_flags)
    ? (obs.ambiguity_flags as string[])
    : [];
  const contradictions: string[] = Array.isArray(obs.contradiction_flags)
    ? (obs.contradiction_flags as string[])
    : [];

  const totalIssueCount =
    warnings.length + ambiguity.length + contradictions.length + technical.length;

  const shortSummary = publishGate.ok
    ? "Semua gate lulus."
    : "Masih ada review item yang belum selesai. Selesaikan di Admin Verify.";

  return {
    blocked: !publishGate.ok,
    title: publishGate.ok ? "Promo siap dipublish" : "Promo belum bisa dipublish",
    subtitle: publishGate.ok
      ? "Semua gate lulus. Klik Publish untuk kirim ke Supabase."
      : "Selesaikan review di Admin Verify sebelum publish ke Supabase.",
    shortSummary,
    technicalReasons: technical,
    warnings,
    ambiguity,
    contradictions,
    totalIssueCount,
  };
}
