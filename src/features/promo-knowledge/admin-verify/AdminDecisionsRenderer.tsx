/**
 * AdminDecisionsRenderer — Phase 4
 *
 * Pure presentational view + apply state machine PER decision. The actual
 * record mutation happens upstream (apply-admin-decision) — this component
 * owns only the answer/apply-status local state and the wiring.
 *
 * State map (overall):
 *   idle    → nothing
 *   empty   → "Tidak ada verifikasi tambahan"
 *   loading → "Reviewer sedang menyusun pertanyaan..."
 *   error   → blocking banner with retry
 *   ready   → one AdminDecisionCard per decision (each card has its own apply state)
 *
 * No fallback to legacy flag rendering. No raw signals shown.
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Sparkles, AlertTriangle, Loader2 } from "lucide-react";
import type {
  AdminDecision,
  AdminDecisionsState,
  AdminReviewerError,
} from "./admin-decision-types";
import {
  AdminDecisionCard,
  type AdminDecisionApplyStatus,
} from "./AdminDecisionCard";

export interface AdminDecisionsRendererProps {
  state: AdminDecisionsState;
  decisions: AdminDecision[];
  error: AdminReviewerError | null;
  onRetry: () => void;
  /**
   * Phase 4: called when admin clicks "Terapkan Jawaban" on a card.
   * Must resolve with `true` on success (renderer marks card as applied)
   * or `false` on failure (renderer surfaces `errorMessage`).
   */
  onApplyDecision?: (args: {
    decision: AdminDecision;
    selectedValue: string;
    selectedLabel: string;
    note: string;
  }) => Promise<{ ok: boolean; errorMessage?: string }>;
}

interface AnswerState {
  selectedValue: string;
  note: string;
  status: AdminDecisionApplyStatus;
  errorMessage: string | null;
}

const DEFAULT_ANSWER: AnswerState = {
  selectedValue: "",
  note: "",
  status: "idle",
  errorMessage: null,
};

export function AdminDecisionsRenderer({
  state,
  decisions,
  error,
  onRetry,
  onApplyDecision,
}: AdminDecisionsRendererProps) {
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});

  if (state === "idle") return null;

  if (state === "empty") {
    return (
      <Card className="bg-card border border-border rounded-xl p-8">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-6 w-6 text-success" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-button-hover">
              Verifikasi Admin
            </h3>
            <p className="text-sm text-muted-foreground">
              Tidak ada verifikasi tambahan.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (state === "loading") {
    return (
      <Card className="bg-card border border-border rounded-xl p-8">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-button-hover/10 flex items-center justify-center shrink-0">
            <Loader2 className="h-6 w-6 text-button-hover animate-spin" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-button-hover">
              Verifikasi Admin
            </h3>
            <p className="text-sm text-muted-foreground">
              Reviewer sedang menyusun pertanyaan...
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (state === "error") {
    const msg =
      error?.message?.trim() ||
      "Reviewer gagal membuat pertanyaan. Coba ulang.";
    return (
      <Card className="bg-destructive/5 border border-destructive rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-destructive">
                Verifikasi Admin
              </h3>
              <p className="text-sm text-foreground">{msg}</p>
            </div>
            <Button onClick={onRetry} variant="outline" size="sm">
              Coba ulang
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // state === "ready"
  if (decisions.length === 0) return null;

  const getAnswer = (id: string): AnswerState => answers[id] ?? DEFAULT_ANSWER;
  const setAnswer = (id: string, patch: Partial<AnswerState>) =>
    setAnswers((prev) => ({ ...prev, [id]: { ...getAnswer(id), ...patch } }));

  const handleApply = async (d: AdminDecision) => {
    if (!onApplyDecision) return;
    const a = getAnswer(d.id);
    if (!a.selectedValue.trim()) return;
    const opt = d.options.find((o) => o.value === a.selectedValue);
    setAnswer(d.id, { status: "applying", errorMessage: null });
    const result = await onApplyDecision({
      decision: d,
      selectedValue: a.selectedValue,
      selectedLabel: opt?.label ?? "",
      note: a.note,
    });
    if (result.ok) {
      setAnswer(d.id, { status: "applied", errorMessage: null });
    } else {
      setAnswer(d.id, {
        status: "error",
        errorMessage:
          result.errorMessage?.trim() ||
          "Jawaban belum bisa diterapkan. Coba ulang.",
      });
    }
  };

  return (
    <Card className="bg-card border border-border rounded-xl p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-button-hover/10 flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5 text-button-hover" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-button-hover">
            Verifikasi Admin
          </h3>
          <p className="text-sm text-muted-foreground">
            Reviewer menemukan {decisions.length} hal yang perlu konfirmasi.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {decisions.map((d) => {
          const a = getAnswer(d.id);
          return (
            <AdminDecisionCard
              key={d.id}
              decision={d}
              selectedValue={a.selectedValue}
              note={a.note}
              onSelect={(value) =>
                setAnswer(d.id, { selectedValue: value, status: "idle", errorMessage: null })
              }
              onChangeNote={(note) => setAnswer(d.id, { note })}
              onApply={onApplyDecision ? () => handleApply(d) : undefined}
              applyStatus={a.status}
              applyError={a.errorMessage}
            />
          );
        })}
      </div>
    </Card>
  );
}
