import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Step1Scenario } from "./Step1Scenario";
import { Step2Reaction } from "./Step2Reaction";
import { Step3Review } from "./Step3Review";
import { 
  WizardFormData, 
  initialWizardData, 
  addBehavioralRule, 
  BehavioralRuleItem, 
  updateBehavioralRule, 
  generateRuleName,
  generateDisplayName,
  behaviorCategoryEnumMapping,
  intentEnumMapping,
  modeResponsEnumMapping,
  calculatePriorityV6,  // V6.1: Use new priority formula
  derivedReactionFromMode
} from "./types";
import { toast } from "sonner";

// V5.2.1: Helper to derive scenario from behavior_category
function deriveScenarioFromCategory(category: string): string {
  const categoryToScenario: Record<string, string> = {
    "ToxicHeavy": "marah_kasar",
    "ToxicLight": "sarkas",
    "SpamBehavior": "spamming",
    "ThreatBehavior": "ancaman",
    "ChurnRisk": "mau_pindah",
    "EmotionalVenting": "curhat_kalah",
    "SocialEngineering": "merayu"
  };
  return categoryToScenario[category] || "marah_kasar";
}

interface BehavioralWizardProps {
  onBack: () => void;
  editingItem?: BehavioralRuleItem | null;
}

export function BehavioralWizard({ onBack, editingItem }: BehavioralWizardProps) {
  // V5.2.1: Saat edit, langsung masuk ke Step 3 (Review)
  const [currentStep, setCurrentStep] = useState(editingItem ? 3 : 1);
  const [formData, setFormData] = useState<WizardFormData>(() => {
    if (editingItem) {
      // V5.2.1: Derive scenario and reaction properly
      const scenarioFromCategory = deriveScenarioFromCategory(editingItem.behavior_category);
      
      // Bug Fix #1: Use derivedReactionFromMode() for proper reaction classification
      const derivedReaction = editingItem.handoff_protocol.required 
        ? "handoff" 
        : derivedReactionFromMode(editingItem.mode_respons);
      
      return {
        scenario: scenarioFromCategory,
        reaction: derivedReaction,
        brand_tone: editingItem.brand_tone,
        response_template: editingItem.response_template,
        reasoning_guideline: editingItem.reasoning_guideline,
        severity_level: editingItem.severity_level,
        priority: editingItem.priority,
        expires_at: editingItem.expires_at || null,
        handoff_type: editingItem.handoff_protocol.type === "silent_handover" ? "silent_handover" : "active_handover",
        display_name: editingItem.display_name || "",
        behavior_category: editingItem.behavior_category,
        intent_perilaku: editingItem.intent_perilaku,
        pattern_trigger: editingItem.pattern_trigger,
        mode_respons: editingItem.mode_respons
      };
    }
    return initialWizardData;
  });

  const totalSteps = 3;
  const progress = (currentStep / totalSteps) * 100;

  const handleChange = (updates: Partial<WizardFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (currentStep === 1 && !formData.scenario && !editingItem) {
      toast.error("Pilih skenario terlebih dahulu");
      return;
    }
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    // Bug Fix #2: Prevent navigation to Step 1/2 in edit mode
    if (editingItem) {
      // Dalam edit mode, tidak bisa mundur ke step sebelumnya
      return;
    }
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSave = () => {
    if (editingItem) {
      // V6.1: Dual Naming - system rule_name is IMMUTABLE, only display_name is editable
      const userDisplayName = formData.display_name.trim() || generateDisplayName(formData.scenario, formData.reaction);
      
      // V6.1: Use new priority formula
      const behaviorCategoryEnum = behaviorCategoryEnumMapping[formData.behavior_category] || formData.behavior_category;
      
      // Bug Fix #3: Keep original rule_name immutable - DO NOT regenerate!
      const result = updateBehavioralRule(editingItem.id, {
        display_name: userDisplayName,
        // rule_name: TIDAK DIUBAH - tetap pakai yang existing dari editingItem
        behavior_category: behaviorCategoryEnum,
        intent_perilaku: intentEnumMapping[formData.intent_perilaku] || formData.intent_perilaku,
        pattern_trigger: formData.pattern_trigger,
        severity_level: formData.severity_level,
        priority: calculatePriorityV6(behaviorCategoryEnum, formData.severity_level),
        mode_respons: modeResponsEnumMapping[formData.mode_respons] || formData.mode_respons,
        brand_tone: formData.brand_tone,
        response_template: formData.response_template,
        reasoning_guideline: formData.reasoning_guideline,
        handoff_protocol: formData.reaction === "handoff" 
          ? { required: true, type: formData.handoff_type || "active_handover", tag_alert: "HIGH_PRIORITY" }
          : formData.reaction === "firm"
          ? { required: false, type: "monitoring", tag_alert: "FIRM_RESPONSE" }
          : { required: false, type: "monitoring", tag_alert: "" },
        expires_at: formData.expires_at || null
      });
      
      // V6.1: Handle BLOCK response
      if (result.success === false) {
        toast.error("Gagal menyimpan: " + result.violations.join(", "));
        return;
      }
      
      toast.success("Aturan berhasil diperbarui");
    } else {
      // V6.1: Handle BLOCK response for new rules
      const result = addBehavioralRule(formData);
      
      if ('blocked' in result && result.blocked) {
        toast.error("Gagal menyimpan: " + result.violations.join(", "));
        return;
      }
      
      toast.success("Aturan baru berhasil disimpan");
    }
    onBack();
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1Scenario data={formData} onChange={handleChange} />;
      case 2:
        return <Step2Reaction data={formData} onChange={handleChange} />;
      case 3:
        return <Step3Review data={formData} onChange={handleChange} editingItem={editingItem} />;
      default:
        return null;
    }
  };

  const canProceed = () => {
    if (currentStep === 1) return !!formData.scenario || !!editingItem;
    if (currentStep === 2) return !!formData.reaction;
    return true;
  };

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-10 w-10 rounded-full hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {editingItem ? "Edit Aturan Behavioral" : "Buat Aturan Behavioral Baru"}
          </h1>
          <p className="text-sm text-muted-foreground">
            B-KB Wizard V5.2 — Enterprise Behavior Engine
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Langkah {currentStep} dari {totalSteps}</span>
          <span className="text-primary font-medium">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span className={currentStep >= 1 ? "text-primary font-medium" : ""}>Skenario</span>
          <span className={currentStep >= 2 ? "text-primary font-medium" : ""}>Reaksi</span>
          <span className={currentStep >= 3 ? "text-primary font-medium" : ""}>Review</span>
        </div>
      </div>

      {/* Step Content */}
      <div className="pb-24">
        {renderStep()}
      </div>

      {/* Fixed Bottom Navigation Bar */}
      <div className="footer-bar">
        <div className="footer-bar-content">
          {/* Left: Previous Button */}
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentStep === 1 || !!editingItem}
            className="h-11 px-6 gap-2 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Sebelumnya
          </Button>

          {/* Center: Step Counter */}
          <span className="text-sm text-muted-foreground">
            Langkah {currentStep} / {totalSteps}
          </span>

          {/* Right: Next/Save Button */}
          {currentStep === totalSteps ? (
            <Button
              onClick={handleSave}
              variant="golden"
              className="gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              {editingItem ? "Simpan Perubahan" : "Simpan Aturan"}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              variant="golden"
              className="gap-2"
            >
              Selanjutnya
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}