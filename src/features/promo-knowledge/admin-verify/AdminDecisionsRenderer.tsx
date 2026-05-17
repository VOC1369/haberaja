/**
 * AdminDecisionsRenderer — global apply button.
 *
 * State map (overall):
 *   idle    → nothing
 *   empty   → "Tidak ada verifikasi tambahan"
 *   loading → "Reviewer sedang menyusun pertanyaan..."
 *   error   → blocking banner with retry
 *   ready   → list of AdminDecisionCard (controlled) + 1 global apply button
 *
 * The global "Terapkan Semua Jawaban" button is enabled only when every
 * decision has a selected option. Clicking it applies all decisions
 * sequentially. Per-decision failures are surfaced inline on the failed
 * card; their related signals are NOT cleared (handled by the orchestrator).
 */

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
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
   * Called once per answered decision when admin clicks the global button.
   * Must resolve with `{ ok, errorMessage? }`.
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

type GlobalStatus = "idle" | "applying" | "success" | "partial_error";

export function AdminDecisionsRenderer({
  state,
  decisions,
  error,
  onRetry,
  onApplyDecision,
}: AdminDecisionsRendererProps) {
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [globalStatus, setGlobalStatus] = useState<GlobalStatus>("idle");

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

  const allAnswered = useMemo(
    () => decisions.every((d) => (answers[d.id]?.selectedValue ?? "").trim().length > 0),
    [decisions, answers],
  );

  const isApplying = globalStatus === "applying";
  const canApply = !!onApplyDecision && allAnswered && !isApplying;

  const handleApplyAll = async () => {
    if (!onApplyDecision) return;
    setGlobalStatus("applying");
    // Mark every pending card as applying (visual only; status overwritten per result)
    setAnswers((prev) => {
      const next = { ...prev };
      for (const d of decisions) {
        const a = next[d.id] ?? DEFAULT_ANSWER;
        if (a.status !== "applied") {
          next[d.id] = { ...a, status: "applying", errorMessage: null };
        }
      }
      return next;
    });

    let anyFailed = false;
    for (const d of decisions) {
      const a = answers[d.id] ?? DEFAULT_ANSWER;
      if (a.status === "applied") continue;
      const opt = d.options.find((o) => o.value === a.selectedValue);
      const result = await onApplyDecision({
        decision: d,
        selectedValue: a.selectedValue,
        selectedLabel: opt?.label ?? "",
        note: a.note,
      });
      if (result.ok) {
        setAnswer(d.id, { status: "applied", errorMessage: null });
      } else {
        anyFailed = true;
        setAnswer(d.id, {
          status: "error",
          errorMessage:
            result.errorMessage?.trim() ||
            "Jawaban belum bisa diterapkan. Coba ulang.",
        });
      }
    }
    setGlobalStatus(anyFailed ? "partial_error" : "success");
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
                setAnswer(d.id, {
                  selectedValue: value,
                  status: a.status === "applied" ? "applied" : "idle",
                  errorMessage: null,
                })
              }
              onChangeNote={(note) => setAnswer(d.id, { note })}
              status={a.status}
              errorMessage={a.errorMessage}
              disabled={isApplying || a.status === "applied"}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
        <div className="flex-1 min-w-0">
          {globalStatus === "success" ? (
            <p className="text-xs text-success flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>Jawaban berhasil diterapkan.</span>
            </p>
          ) : globalStatus === "partial_error" ? (
            <p className="text-xs text-destructive flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                Beberapa jawaban belum bisa diterapkan. Periksa kembali pilihan Anda.
              </span>
            </p>
          ) : !allAnswered ? (
            <p className="text-xs text-muted-foreground">
              Jawab semua pertanyaan untuk melanjutkan.
            </p>
          ) : null}
        </div>
        <Button onClick={handleApplyAll} disabled={!canApply}>
          {isApplying ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              Menerapkan jawaban...
            </>
          ) : (
            "Terapkan Semua Jawaban"
          )}
        </Button>
      </div>
    </Card>
  );
}
