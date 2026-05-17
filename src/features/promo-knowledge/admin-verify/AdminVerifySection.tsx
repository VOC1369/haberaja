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
          errorMessage: "Jawaban belum bisa diterapkan. Coba ulang.",
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
