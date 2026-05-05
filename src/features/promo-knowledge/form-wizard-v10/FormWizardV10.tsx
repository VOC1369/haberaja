/**
 * Phase 1 — V.10.1 Form Wizard SKELETON ENTRY.
 *
 * STRICT SCOPE:
 *   - UI only. No extractor, no prefill, no save, no Supabase, no V.09 bridge.
 *   - All paths follow PkV10Record naming.
 *   - All enum stored values come from F3 (canonical snake_case).
 *   - Variant editor = Phase 4 placeholder.
 */
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, ChevronLeft } from "lucide-react";
import { initialV10WizardState, STEP_TITLES, type V10WizardState } from "./state";
import { Step1Identity } from "./steps/Step1Identity";
import { Step2Access } from "./steps/Step2Access";
import { Step3Trigger } from "./steps/Step3Trigger";
import { Step4Reward } from "./steps/Step4Reward";
import { Step5Payment } from "./steps/Step5Payment";
import { Step6Claim } from "./steps/Step6Claim";
import { Step7Loyalty } from "./steps/Step7Loyalty";
import { Step8Dependency } from "./steps/Step8Dependency";
import { Step9Review } from "./steps/Step9Review";

export interface FormWizardV10Props {
  onBack?: () => void;
  recordName?: string;
}

export function FormWizardV10({ onBack, recordName }: FormWizardV10Props) {
  const [state, setState] = useState<V10WizardState>(initialV10WizardState);
  const [step, setStep] = useState(1);
  const total = STEP_TITLES.length;
  const progress = useMemo(() => (step / total) * 100, [step, total]);

  const update = <K extends keyof V10WizardState>(key: K, patch: Partial<V10WizardState[K]>) => {
    setState((s) => ({ ...s, [key]: { ...s[key], ...patch } }));
  };

  const renderStep = () => {
    switch (step) {
      case 1: return <Step1Identity state={state} update={update} />;
      case 2: return <Step2Access state={state} update={update} />;
      case 3: return <Step3Trigger state={state} update={update} />;
      case 4: return <Step4Reward state={state} update={update} />;
      case 5: return <Step5Payment state={state} update={update} />;
      case 6: return <Step6Claim state={state} update={update} />;
      case 7: return <Step7Loyalty state={state} update={update} />;
      case 8: return <Step8Dependency state={state} update={update} />;
      case 9: return <Step9Review state={state} update={update} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Kembali
            </Button>
          )}
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Form Wizard V.10.1 — Skeleton
            </h2>
            <p className="text-xs text-muted-foreground">
              UI Only · No save · No prefill · No Supabase
              {recordName ? ` · Record: ${recordName}` : ""}
            </p>
          </div>
        </div>
        <Badge className="bg-button-hover/20 text-button-hover border border-button-hover/30">
          Phase 1 Skeleton
        </Badge>
      </div>

      {/* Progress */}
      <Card className="p-4 bg-card border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">
            Step {step} / {total} — {STEP_TITLES[step - 1]}
          </span>
          <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} />
        <div className="flex flex-wrap gap-1 mt-3">
          {STEP_TITLES.map((title, idx) => {
            const n = idx + 1;
            const active = n === step;
            const done = n < step;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setStep(n)}
                className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                  active
                    ? "bg-button-hover text-button-hover-foreground border-button-hover"
                    : done
                    ? "border-button-hover/40 text-button-hover"
                    : "border-border text-muted-foreground"
                }`}
              >
                {n}. {title}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Step body */}
      <div className="space-y-4">{renderStep()}</div>

      {/* Bottom nav */}
      <Card className="p-4 bg-card border-border flex items-center justify-between">
        <Button
          variant="outline"
          disabled={step === 1}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Sebelumnya
        </Button>
        <span className="text-xs text-muted-foreground">
          Skeleton — perubahan tidak disimpan
        </span>
        <Button
          disabled={step === total}
          onClick={() => setStep((s) => Math.min(total, s + 1))}
        >
          Selanjutnya <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </Card>
    </div>
  );
}
