import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { PromoFormData, PromoItem, initialPromoData, savePromoDraft } from "./types";
import { Step1Identity } from "./Step1Identity";
import { Step2Access } from "./Step2Access";
import { StepProgramClassification, type ProgramType } from "./StepProgramClassification";
import { Step3Reward } from "./Step3Reward";
import { Step4BEventConfig } from "./Step4BEventConfig";
import { Step4CPolicy, PolicyConfigData, initialPolicyData } from "./Step4CPolicy";
import { Step4Review, generateTermsList, formatNumber } from "./Step4Review";

// Dynamic step title generator for Step 4
const getStep4Title = (program: ProgramType) => {
  switch (program) {
    case 'event':
      return "Konfigurasi Event";
    case 'policy':
      return "Konfigurasi Policy";
    case 'reward':
      return "Konfigurasi Reward";
    default:
      // Placeholder saat belum pilih program (Step 3)
      return "Konfigurasi";
  }
};

// Map ProgramType → program_classification
const programToClassification = (program: ProgramType): 'A' | 'B' | 'C' | undefined => {
  switch (program) {
    case 'reward': return 'A';  // Bonus Instan
    case 'event': return 'B';   // Event/Kompetisi
    case 'policy': return 'C';  // Program Sistem
    default: return undefined;
  }
};

// Map program_classification → ProgramType (untuk restore saat edit)
const classificationToProgram = (classification?: 'A' | 'B' | 'C'): ProgramType => {
  switch (classification) {
    case 'A': return 'reward';
    case 'B': return 'event';
    case 'C': return 'policy';
    default: return null;
  }
};

interface PromoFormWizardProps {
  onBack?: () => void;
  initialData?: PromoItem;
  onSaveSuccess?: () => void;
}

export function PromoFormWizard({ onBack, initialData, onSaveSuccess }: PromoFormWizardProps) {
  // Jump to Step 5 (Review) when editing existing promo
  const [currentStep, setCurrentStep] = useState(initialData ? 5 : 1);
  const [formData, setFormData] = useState<PromoFormData>(initialData || initialPromoData);
  const [editingId, setEditingId] = useState<string | undefined>(initialData?.id);
  const [isEditingFromReview, setIsEditingFromReview] = useState(false);
  // Restore selectedProgram from initialData when editing
  const [selectedProgram, setSelectedProgram] = useState<ProgramType>(
    initialData ? classificationToProgram(initialData.program_classification) : null
  );
  const [policyData, setPolicyData] = useState<PolicyConfigData>(initialPolicyData);

  const handleChange = (updates: Partial<PromoFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    // If editing from review, return to review instead of advancing
    if (isEditingFromReview) {
      setCurrentStep(5);
      setIsEditingFromReview(false);
      return;
    }
    // Block proceeding from step 3 without program selection
    if (currentStep === 3 && !selectedProgram) {
      return;
    }
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  // Handle navigation from Review to specific step for editing
  const handleGoToStepFromReview = (step: number) => {
    setIsEditingFromReview(true);
    setCurrentStep(step);
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Generate full S&K string from promo data
  const generateFullTermsString = (data: PromoFormData): string => {
    let result = `${data.promo_name?.toUpperCase() || 'NAMA PROMO'}\n\n`;
    
    // Add calculation example for formula (dinamis) mode with percentage
    if (data.reward_mode === 'formula' && data.calculation_value) {
      result += `Contoh Perhitungan:\n`;
      result += `Total ${data.calculation_base || 'turnover'} x ${data.calculation_value}% = Nilai Bonus\n`;
      result += `-----------------------------------------------\n`;
      const exampleBase = data.min_calculation && data.min_calculation > 0 ? data.min_calculation : 1000000;
      const exampleReward = exampleBase * (data.calculation_value / 100);
      result += `${formatNumber(exampleBase)} x ${data.calculation_value}% = ${formatNumber(exampleReward)} (Bonus yang didapat)\n\n`;
    }
    
    result += `Syarat & Ketentuan:\n`;
    const terms = generateTermsList(data);
    terms.forEach((term, i) => {
      result += `${i + 1}. ${term}\n`;
    });
    
    return result;
  };

  const handleSaveDraft = async () => {
    const generatedTerms = generateFullTermsString(formData);
    const dataToSave: PromoFormData = { 
      ...formData, 
      status: 'draft', 
      custom_terms: generatedTerms,
      program_classification: programToClassification(selectedProgram),
    };
    const saved = await savePromoDraft(dataToSave, editingId);
    setEditingId(saved.id);
    toast.success(`Draft "${formData.promo_name || 'Untitled'}" tersimpan!`);
    console.log("Saved draft:", saved);
  };

  const handlePublish = async () => {
    const generatedTerms = generateFullTermsString(formData);
    const dataToSave: PromoFormData = { 
      ...formData, 
      status: 'active', 
      custom_terms: generatedTerms,
      program_classification: programToClassification(selectedProgram),
    };
    const saved = await savePromoDraft(dataToSave, editingId);
    toast.success(`Promo "${formData.promo_name}" berhasil dipublish!`);
    console.log("Published promo:", saved);
    
    // Reset form and go back
    setFormData(initialPromoData);
    setEditingId(undefined);
    setCurrentStep(1);
    setSelectedProgram(null);
    onSaveSuccess?.();
  };

  const progress = (currentStep / 5) * 100;
  const canProceedFromStep3 = selectedProgram !== null;
  
  // Dynamic STEPS array based on program selection
  const STEPS = [
    { id: 1, title: "Identitas Promo" },
    { id: 2, title: "Batasan & Akses" },
    { id: 3, title: "Jenis Program" },
    { id: 4, title: getStep4Title(selectedProgram) },
    { id: 5, title: "Review & Simpan" },
  ];

  return (
    <div className="page-wrapper space-y-6">
      {/* Back Button */}
      {onBack && (
        <Button
          variant="outline"
          onClick={onBack}
          className="rounded-full border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
      )}

      {/* Progress Card */}
      <Card className="p-6">
        {/* Progress Bar with Thumb */}
        <div className="relative w-full py-4 mb-2">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
            <div 
              className="h-full bg-button-hover transition-all" 
              style={{ width: `${progress}%` }} 
            />
          </div>
          {/* Slider Thumb */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border-2 border-button-hover bg-background transition-all"
            style={{ left: `calc(${progress}% - 10px)` }}
          />
        </div>

        {/* Step Labels (Step 1 / Step 5) */}
        <div className="flex items-center justify-between text-sm mb-4">
          <span className="text-muted-foreground">Step 1</span>
          <span className="text-lg font-bold text-foreground">{currentStep}/5</span>
          <span className="text-muted-foreground">Step 5</span>
        </div>

        {/* Divider Line */}
        <div className="border-t border-border mb-4" />

        {/* Step Navigation */}
        <div className="flex items-center justify-between text-sm">
          {STEPS.map((step) => {
            // Block navigation to Step 4 if no program selected yet
            const isStep4Blocked = step.id === 4 && !selectedProgram;
            
            return (
              <button
                key={step.id}
                onClick={() => {
                  if (isStep4Blocked) return; // Block click
                  setCurrentStep(step.id);
                }}
                disabled={isStep4Blocked}
                className={`transition-colors ${
                  currentStep === step.id
                    ? "text-button-hover font-medium"
                    : currentStep > step.id
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                } ${isStep4Blocked ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
              >
                {step.title}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Step Content */}
      <Card className="p-6 animate-fade-in">
        {currentStep === 1 && (
          <Step1Identity 
            data={formData} 
            onChange={handleChange}
            isEditingFromReview={isEditingFromReview}
            onSaveAndReturn={() => {
              setCurrentStep(5);
              setIsEditingFromReview(false);
            }}
          />
        )}
        {currentStep === 2 && (
          <Step2Access 
            data={formData} 
            onChange={handleChange}
            isEditingFromReview={isEditingFromReview}
            onSaveAndReturn={() => {
              setCurrentStep(5);
              setIsEditingFromReview(false);
            }}
          />
        )}
        {currentStep === 3 && (
          <StepProgramClassification 
            selectedProgram={selectedProgram}
            onSelect={setSelectedProgram}
          />
        )}
        {currentStep === 4 && selectedProgram === 'event' && (
          <Step4BEventConfig
            formData={formData}
            onFormDataChange={handleChange}
            isEditingFromReview={isEditingFromReview}
            onSaveAndReturn={() => {
              setCurrentStep(5);
              setIsEditingFromReview(false);
            }}
          />
        )}
        {/* Phase 1: Policy disabled - fallback to Reward config */}
        {currentStep === 4 && selectedProgram === 'policy' && (
          <Step3Reward 
            data={formData} 
            onChange={handleChange}
            isEditingFromReview={isEditingFromReview}
            onSaveAndReturn={() => {
              setCurrentStep(5);
              setIsEditingFromReview(false);
            }}
            stepNumber={4}
            stepTitle="Konfigurasi Policy"
          />
        )}
        {currentStep === 4 && selectedProgram !== 'event' && selectedProgram !== 'policy' && (
          <Step3Reward 
            data={formData} 
            onChange={handleChange}
            isEditingFromReview={isEditingFromReview}
            onSaveAndReturn={() => {
              setCurrentStep(5);
              setIsEditingFromReview(false);
            }}
            stepNumber={4}
            stepTitle="Konfigurasi Reward"
          />
        )}
        {currentStep === 5 && <Step4Review data={formData} onGoToStep={handleGoToStepFromReview} />}
      </Card>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-64 right-0 bg-background border-t border-border p-4 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left: Previous Button or Back to Review */}
          {isEditingFromReview ? (
             <Button
              variant="outline"
              onClick={() => {
                setCurrentStep(5);
                setIsEditingFromReview(false);
              }}
              className="h-11 px-6 rounded-full border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Kembali ke Review
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className="h-11 px-6 rounded-full border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Sebelumnya
            </Button>
          )}

          {/* Center: Save Draft + Step Counter */}
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={handleSaveDraft} className="h-11 px-6 rounded-full border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
              <Save className="h-4 w-4 mr-2" />
              Simpan Draft
            </Button>
            <span className="text-sm text-muted-foreground">
              Step {currentStep} / 5
            </span>
          </div>

          {/* Right: Next/Publish Button or Save & Return */}
          {isEditingFromReview ? (
            <Button 
              variant="golden" 
              onClick={() => {
                setCurrentStep(5);
                setIsEditingFromReview(false);
              }} 
              className="rounded-full"
            >
              Simpan & Kembali
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : currentStep === 5 ? (
            <Button variant="golden" onClick={handlePublish} className="rounded-full">
              Publish Promo
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button 
              variant="golden" 
              onClick={handleNext} 
              disabled={currentStep === 3 && !canProceedFromStep3}
              className="rounded-full disabled:opacity-50"
            >
              Selanjutnya
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      {/* Spacer for fixed bottom nav */}
      <div className="h-20" />
    </div>
  );
}
