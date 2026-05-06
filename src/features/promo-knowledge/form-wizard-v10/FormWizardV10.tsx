/**
 * Phase 2A — V.10.1 Form Wizard ENTRY (binding-enabled, SAFE FIELDS).
 *
 * SCOPE:
 *   - When `recordId` is provided → prefill from PkV10Record (safe fields).
 *   - "Simpan ke Draft V.10.1" merges wizard state back into the record and
 *     persists via local-storage (`saveRecord`). NO Supabase. NO extractor.
 *     NO V.09 bridge.
 *   - When no recordId → behaves as Phase 1 skeleton (no save).
 *   - Skipped fields (admin_fee, loyalty builders, variants, system blocks)
 *     are documented in `binding.ts`.
 */
import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, ChevronLeft, Save } from "lucide-react";
import { initialV10WizardState, STEP_TITLES, type V10WizardState } from "./state";
import { pkRecordToWizard, mergeWizardIntoPkRecord } from "./binding";
import { applyFormWizardGovernance } from "./governance";
import { loadRecord, saveRecord } from "../storage/local-storage";
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
  recordId?: string;
}

export function FormWizardV10({ onBack, recordName, recordId }: FormWizardV10Props) {
  const [state, setState] = useState<V10WizardState>(initialV10WizardState);
  const [step, setStep] = useState(1);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [loadError, setLoadError] = useState<string | null>(null);

  const total = STEP_TITLES.length;
  const progress = useMemo(() => (step / total) * 100, [step, total]);
  const bindingEnabled = !!recordId;

  // Prefill on mount / recordId change
  useEffect(() => {
    if (!recordId) return;
    const rec = loadRecord(recordId);
    if (!rec) {
      setLoadError(`Record ${recordId} tidak ditemukan di pk:rec.`);
      return;
    }
    try {
      setState(pkRecordToWizard(rec));
      setLoadError(null);
    } catch (e) {
      setLoadError(`Gagal prefill: ${(e as Error).message}`);
    }
  }, [recordId]);

  const update = <K extends keyof V10WizardState>(key: K, patch: Partial<V10WizardState[K]>) => {
    setState((s) => ({ ...s, [key]: { ...s[key], ...patch } }));
    if (saveStatus === "saved") setSaveStatus("idle");
  };

  const handleSave = () => {
    if (!recordId) return;
    setSaveStatus("saving");
    try {
      const rec = loadRecord(recordId);
      if (!rec) throw new Error("Record tidak ditemukan saat save.");
      const merged = mergeWizardIntoPkRecord(rec, state);
      const { record: governed, entries } = applyFormWizardGovernance(rec, merged);
      saveRecord(governed);
      // eslint-disable-next-line no-console
      console.info(`[FormWizardV10][Phase 2B] override entries: ${entries.length}`, entries);
      setSaveStatus("saved");
    } catch (e) {
      setLoadError((e as Error).message);
      setSaveStatus("error");
    }
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
      case 9: return <Step9Review state={state} update={update} recordId={recordId} />;
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
              Form Wizard V.10.1 {bindingEnabled ? "— Phase 2A Binding" : "— Skeleton"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {bindingEnabled
                ? "Safe-fields binding · localStorage only · No Supabase · No extractor"
                : "UI Only · No save · No prefill · No Supabase"}
              {recordName ? ` · Record: ${recordName}` : ""}
              {recordId ? ` · ID: ${recordId.slice(0, 8)}…` : ""}
            </p>
          </div>
        </div>
        <Badge className="bg-button-hover/20 text-button-hover border border-button-hover/30">
          {bindingEnabled ? "Phase 2A" : "Phase 1 Skeleton"}
        </Badge>
      </div>

      {loadError && (
        <Card className="p-3 border-error/40 bg-error/10 text-sm text-error">
          {loadError}
        </Card>
      )}

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
        <div className="flex items-center gap-2">
          {bindingEnabled ? (
            <>
              <span className="text-xs text-muted-foreground">
                {saveStatus === "saved" ? "Tersimpan ✓" :
                 saveStatus === "saving" ? "Menyimpan…" :
                 saveStatus === "error" ? "Gagal simpan" : "Belum disimpan"}
              </span>
              <Button variant="outline" onClick={handleSave} disabled={saveStatus === "saving"}>
                <Save className="h-4 w-4 mr-1" /> Simpan ke Draft V.10.1
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              Skeleton — perubahan tidak disimpan
            </span>
          )}
        </div>
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
