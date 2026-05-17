/**
 * ADMIN VERIFY SECTION — Phase 4 (LLM Reviewer renderer + Apply orchestration)
 *
 * The legacy registry / gap reader / extractor issue / F3 compliance
 * pipeline is no longer imported at runtime. The single source of admin
 * questions is the `admin-reviewer` edge function (Phase 1).
 *
 * Phase 4 adds:
 *   - onApplyDecision handler → `applyAdminDecision` orchestrator
 *   - On success: parent state is updated via `onApply(updatedRecord)`,
 *     record is saved via savePkRecord (inside orchestrator), related
 *     signals are cleared. The renderer marks the card as applied.
 *   - On failure: record is NOT mutated, signals NOT cleared, card shows
 *     "Jawaban belum bisa diterapkan. Coba ulang."
 */

import { useCallback } from "react";
import type { PkV10Record } from "@/features/promo-knowledge/schema/pk-v10";
import { useAdminDecisions } from "./useAdminDecisions";
import { AdminDecisionsRenderer } from "./AdminDecisionsRenderer";
import { applyAdminDecision } from "./apply-admin-decision";
import type { AdminDecision } from "./admin-decision-types";

export interface AdminVerifySectionProps {
  record: PkV10Record | null;
  onApply: (next: PkV10Record) => void;
}

// Words that must never appear in admin-facing error copy.
const FORBIDDEN_TECH_TERMS = [
  "target_path",
  "json",
  "schema",
  "resolver",
  "patch",
  "array",
  "field",
  "enum",
  "old_value_preview",
  "new_value_preview",
];

function containsTechTerm(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_TECH_TERMS.some((t) => lower.includes(t));
}

const FRIENDLY_FALLBACK =
  "Jawaban ini belum bisa diterapkan karena data tersimpan tidak memiliki bagian yang cocok untuk diubah. Pilih jawaban lain atau isi penjelasan manual.";

function toAdminFriendlyError(args: {
  errors?: string[];
  unresolved_questions?: string[];
}): string {
  // Prefer reviewer-authored clarifications when they are admin-safe.
  for (const q of args.unresolved_questions ?? []) {
    if (q && q.trim() && !containsTechTerm(q)) return q.trim();
  }
  for (const e of args.errors ?? []) {
    if (e && e.trim() && !containsTechTerm(e)) return e.trim();
  }
  return FRIENDLY_FALLBACK;
}

export function AdminVerifySection({ record, onApply }: AdminVerifySectionProps) {
  const { state, decisions, error, retry } = useAdminDecisions(record);

  const handleApplyDecision = useCallback(
    async (args: {
      decision: AdminDecision;
      selectedValue: string;
      selectedLabel: string;
      note: string;
    }): Promise<{ ok: boolean; errorMessage?: string }> => {
      if (!record) {
        return { ok: false, errorMessage: "Data promo tidak tersedia." };
      }
      const result = await applyAdminDecision({
        record,
        decision: args.decision,
        selectedValue: args.selectedValue,
        selectedLabel: args.selectedLabel,
        note: args.note,
      });
      if (!result.ok || !result.record) {
        return {
          ok: false,
          errorMessage: toAdminFriendlyError({
            errors: result.errors,
            unresolved_questions: result.unresolved_questions,
          }),
        };
      }
      onApply(result.record);
      return { ok: true };
    },
    [record, onApply],
  );

  return (
    <AdminDecisionsRenderer
      state={state}
      decisions={decisions}
      error={error}
      onRetry={retry}
      onApplyDecision={record ? handleApplyDecision : undefined}
    />
  );
}
