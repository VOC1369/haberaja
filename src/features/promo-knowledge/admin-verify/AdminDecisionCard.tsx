/**
 * AdminDecisionCard — controlled, no apply button.
 *
 * Renders ONE AdminDecision. The apply action is global (lives in the
 * parent renderer). Each card only collects: selected option + optional
 * admin note. Per-card error message is surfaced inline when the global
 * apply pass fails specifically for this decision.
 *
 * Forbidden user-visible terms: field_path, schema, JSON, engine, severity,
 * flags, source_text, warning, ambiguity, contradiction.
 */

import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HelpCircle, AlertCircle, CheckCircle2 } from "lucide-react";
import type { AdminDecision } from "./admin-decision-types";

export type AdminDecisionApplyStatus = "idle" | "applying" | "applied" | "error";

export interface AdminDecisionCardProps {
  decision: AdminDecision;
  selectedValue: string;
  note: string;
  onSelect: (value: string) => void;
  onChangeNote: (note: string) => void;
  status?: AdminDecisionApplyStatus;
  errorMessage?: string | null;
  disabled?: boolean;
}

export function AdminDecisionCard({
  decision,
  selectedValue,
  note,
  onSelect,
  onChangeNote,
  status = "idle",
  errorMessage = null,
  disabled = false,
}: AdminDecisionCardProps) {
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
            disabled={disabled}
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
            disabled={disabled}
          />
        </div>
      ) : null}

      {status === "error" && errorMessage ? (
        <p className="text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </p>
      ) : status === "applied" ? (
        <p className="text-xs text-success flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span>Jawaban telah diterapkan.</span>
        </p>
      ) : null}
    </Card>
  );
}
