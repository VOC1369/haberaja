/**
 * AdminDecisionCard — Phase 3
 *
 * Renders ONE AdminDecision from the LLM Admin Reviewer.
 *
 * Hard UI rules (forbidden terms — must never appear as user-visible text):
 *   field_path, schema, JSON, engine, severity, flags, source_text,
 *   warning, ambiguity, contradiction.
 *
 * Phase 3 scope: render-only. The "Terapkan Jawaban ke JSON" button is
 * intentionally disabled with an inline note — the bridge from
 * AdminDecision → PkV10Record patch lands in Phase 4.
 */

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HelpCircle, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import type { AdminDecision } from "./admin-decision-types";

export type AdminDecisionApplyStatus = "idle" | "applying" | "applied" | "error";

export interface AdminDecisionCardProps {
  decision: AdminDecision;
  selectedValue: string;
  note: string;
  onSelect: (value: string) => void;
  onChangeNote: (note: string) => void;
  onApply?: () => void;
  applyStatus?: AdminDecisionApplyStatus;
  applyError?: string | null;
}

export function AdminDecisionCard({
  decision,
  selectedValue,
  note,
  onSelect,
  onChangeNote,
  onApply,
  applyStatus = "idle",
  applyError = null,
}: AdminDecisionCardProps) {
  const hasSelection = selectedValue.trim().length > 0;
  const canApply =
    !!onApply && hasSelection && applyStatus !== "applying" && applyStatus !== "applied";

  return (
    <Card className="bg-card border border-border rounded-xl p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-button-hover/10 flex items-center justify-center shrink-0">
          <HelpCircle className="h-5 w-5 text-button-hover" />
        </div>
        <div className="space-y-1">
          <h4 className="text-base font-semibold text-foreground">
            {decision.title}
          </h4>
          {decision.explanation ? (
            <p className="text-sm text-muted-foreground">
              {decision.explanation}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">
          {decision.question}
        </p>

        {decision.options.length > 0 ? (
          <RadioGroup
            value={selectedValue}
            onValueChange={onSelect}
            className="space-y-2"
          >
            {decision.options.map((opt) => {
              const id = `${decision.id}__${opt.value}`;
              return (
                <Label
                  key={id}
                  htmlFor={id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 cursor-pointer hover:border-button-hover transition-colors"
                >
                  <RadioGroupItem id={id} value={opt.value} className="mt-0.5" />
                  <span className="text-sm text-foreground">{opt.label}</span>
                </Label>
              );
            })}
          </RadioGroup>
        ) : null}
      </div>

      {decision.manual_note_enabled ? (
        <div className="space-y-2">
          <Label
            htmlFor={`${decision.id}__note`}
            className="text-sm text-muted-foreground"
          >
            Catatan admin (opsional)
          </Label>
          <Textarea
            id={`${decision.id}__note`}
            value={note}
            onChange={(e) => onChangeNote(e.target.value)}
            placeholder="Tulis penjelasan tambahan jika perlu."
            className="min-h-[72px]"
          />
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
        <div className="flex-1 min-w-0">
          {applyStatus === "error" && applyError ? (
            <p className="text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{applyError}</span>
            </p>
          ) : applyStatus === "applied" ? (
            <p className="text-xs text-success flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>Jawaban telah diterapkan.</span>
            </p>
          ) : null}
        </div>
        <Button onClick={onApply} disabled={!canApply} size="sm">
          {applyStatus === "applying" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              Menerapkan...
            </>
          ) : (
            "Terapkan Jawaban"
          )}
        </Button>
      </div>
    </Card>
  );
}
