/**
 * APBE v1.2 Summary Review Page
 * Displays all form data in collapsible cards with grid layout
 * Includes: Validation with severity, Precedence Diagram, QA Panel
 * 
 * V1.2 Changes:
 * - Updated field display to match v1.2 schema
 * - Removed deprecated fields from display
 * 
 * V1.1 Changes:
 * - Added comprehensive memoization for performance optimization
 * - React.memo on child components to prevent unnecessary rerenders
 */

import { useState, useMemo, useCallback, memo } from "react";
import { UseFormReturn } from "react-hook-form";
import { APBEConfig } from "@/types/apbe-config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { validateAPBEConfig, ValidationResult, getValidationSummary } from "@/lib/apbe-validation";
import { validatePersonaJSON, PersonaValidationResult, BlockStatus } from "@/lib/apbe-persona-validator";
import { toast } from "sonner";
import { Edit2, CheckCircle2, AlertCircle, FileJson, Sparkles, List, Check, ArrowLeft, ChevronDown, ClipboardCheck, AlertTriangle, Info, XCircle, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

// Import new UI components
import { APBEVersionFooter } from "./APBEVersionFooter";
import { PersonaValidatorCard } from "./PersonaValidatorCard";
import { getUIFriendlyError } from "@/lib/apbe-error-dictionary";

// ========================
// DISPLAY LABEL MAPPINGS
// (UI-only, tidak mengubah data asli)
// ========================

// Brand Identity
const archetypeLabels: Record<string, string> = {
  jester: "Jester",
  caregiver: "Caregiver",
  hero: "Hero",
  sage: "Sage",
  everyman: "Everyman",
  ruler: "Ruler",
  creator: "Creator",
  explorer: "Explorer",
  rebel: "Rebel",
  lover: "Lover",
  magician: "Magician",
  innocent: "Innocent",
};

const lokasiLabels: Record<string, string> = {
  indonesia: "Indonesia (WIB/WITA/WIT)",
  malaysia: "Malaysia (MYT)",
  singapore: "Singapore (SGT)",
  thailand: "Thailand (ICT)",
  vietnam: "Vietnam (ICT)",
  philippines: "Philippines (PHT)",
  cambodia: "Cambodia (ICT)",
  laos: "Laos (ICT)",
  myanmar: "Myanmar (MMT)",
  brunei: "Brunei (BNT)",
};

// Agent Persona
const genderLabels: Record<string, string> = {
  female: "Perempuan",
  male: "Laki-laki",
  neutral: "Netral",
};

const toneLabels: Record<string, string> = {
  soft_warm: "Lembut & Hangat",
  neutral: "Netral",
  strict_efficient: "Tegas & Efisien",
  cheerful_playful: "Ceria & Playful",
  gentle_supportive: "Gentle & Supportif",
  elite_formal: "Elite & Formal",
};

const styleLabels: Record<string, string> = {
  friendly: "Ramah & Casual",
  professional: "Profesional",
  playful: "Ceria & Fun",
  caring: "Perhatian & Supportif",
  formal: "Formal & Sopan",
  energetic: "Energik & Semangat",
};

const speedLabels: Record<string, string> = {
  instant: "Instan (< 1 detik)",
  fast: "Cepat (1-3 detik)",
  normal: "Normal (3-5 detik)",
  relaxed: "Santai (5-10 detik)",
};

// Communication Engine
const humorUsageLabels: Record<string, string> = {
  none: "Tidak ada humor",
  subtle: "Subtle (jarang)",
  moderate: "Sedang",
  frequent: "Sering",
};

// Operational SOP
const contactMethodLabels: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
};

// VIP Logic

const sopStyleLabels: Record<string, string> = {
  strict: "Ketat",
  flexible: "Fleksibel",
  adaptive: "Adaptif",
};

// VIP Logic
const thresholdTypeLabels: Record<string, string> = {
  total_deposit: "Total Deposit",
  turnover: "Total Turnover",
  ggr: "Gross Gaming Revenue",
};

// Helper function
const getLabel = (value: string | undefined, mapping: Record<string, string>): string => {
  if (!value) return "";
  return mapping[value] || value;
};

interface APBESummaryReviewProps {
  form: UseFormReturn<APBEConfig>;
  onEditSection: (sectionKey: string) => void;
  onGenerateJSON: () => void;
  onGeneratePrompt: () => void;
  onPublish: (adminName: string) => void;
  onViewPersonaList: () => void;
  onBack?: () => void;
  editingPersonaName?: string;
}

interface ValueBoxProps {
  label: string;
  value: string | number | boolean | string[] | React.ReactNode;
  className?: string;
}

// Memoized ValueBox component to prevent unnecessary rerenders
const ValueBox = memo(({ label, value, className }: ValueBoxProps) => {
  const displayValue = useMemo(() => {
    if (typeof value === "boolean") {
      return value ? "Ya" : "Tidak";
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-muted-foreground italic text-xs">Tidak ada</span>;
      return value.join(", ");
    }
    if (value === "" || value === undefined || value === null) {
      return <span className="text-muted-foreground">-</span>;
    }
    return value;
  }, [value]);

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="bg-muted rounded-lg min-h-10 px-4 py-2 text-sm text-foreground flex items-center">
        <span>{displayValue}</span>
      </div>
    </div>
  );
});

ValueBox.displayName = "ValueBox";

interface CollapsibleSectionProps {
  title: string;
  sectionKey: string;
  status: { percentage: number; errors: any[] };
  blockStatus?: BlockStatus; // New: from persona validator
  criticalErrors?: string[]; // New: block-level critical errors
  children: React.ReactNode;
  onEdit: () => void;
  defaultOpen?: boolean;
}

// Memoized CollapsibleSection component
const CollapsibleSection = memo(({ title, sectionKey, status, blockStatus, criticalErrors = [], children, onEdit, defaultOpen = true }: CollapsibleSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  // Memoized status calculation
  const statusInfo = useMemo(() => {
    const hasCritical = blockStatus === "error" || criticalErrors.length > 0;
    const hasWarning = blockStatus === "warning" || (status.errors.length > 0 && !hasCritical);
    const isComplete = blockStatus === "complete" || (status.percentage === 100 && !hasCritical && !hasWarning);
    return { hasCritical, hasWarning, isComplete };
  }, [blockStatus, criticalErrors, status]);
  
  const { hasCritical, hasWarning, isComplete } = statusInfo;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-xl overflow-hidden bg-card border border-border">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-6 hover:bg-muted transition-colors cursor-pointer w-full">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-foreground">{title}</span>
              {/* Status Badge - Only show if has errors/warnings or is complete */}
              {(hasCritical || hasWarning || isComplete) && (
                <Badge 
                  variant="outline"
                  className={cn(
                    hasCritical && "bg-destructive/10 text-destructive border-destructive/30",
                    hasWarning && !hasCritical && "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
                    isComplete && "bg-success/10 text-success border-success/30"
                  )}
                >
                  {hasCritical ? (
                    <><XCircle className="h-3 w-3 mr-1" /> Error</>
                  ) : hasWarning ? (
                    <><AlertTriangle className="h-3 w-3 mr-1" /> Warning</>
                  ) : isComplete ? (
                    <><CheckCircle2 className="h-3 w-3 mr-1" /> Lengkap</>
                  ) : null}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Edit Button */}
              <div 
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    onEdit();
                  }
                }}
                className="gap-2 border border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover inline-flex items-center justify-center rounded-full text-sm font-medium h-10 px-4 py-2 transition-colors"
              >
                <Edit2 className="h-4 w-4" />
                Edit
              </div>
              <ChevronDown className={cn(
                "h-5 w-5 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180"
              )} />
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-6 pt-2">
            {/* Block-level Critical Errors Display - Human-Friendly Messages */}
            {criticalErrors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    {criticalErrors.map((error, idx) => (
                      <p key={idx} className="text-sm text-destructive">
                        {getUIFriendlyError(error)}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
});

CollapsibleSection.displayName = "CollapsibleSection";

// Memoized Section Label for grouping
const SectionLabel = memo(({ children }: { children: React.ReactNode }) => (
  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 mt-4 first:mt-0">
    {children}
  </p>
));

SectionLabel.displayName = "SectionLabel";

export function APBESummaryReview({ form, onEditSection, onGenerateJSON, onGeneratePrompt, onPublish, onViewPersonaList, onBack, editingPersonaName }: APBESummaryReviewProps) {
  // Memoize config to prevent unnecessary rerenders
  const config = useMemo(() => form.getValues(), [form]);
  
  // Memoized validations
  const validation = useMemo(() => validateAPBEConfig(config), [config]);
  const personaValidation = useMemo(() => validatePersonaJSON(config), [config]);
  
  // Memoized helper to get critical errors for a block
  const getBlockCriticalErrors = useCallback((blockKey: string): string[] => {
    return personaValidation.criticalErrors.filter(e => e.startsWith(`[${blockKey}]`));
  }, [personaValidation.criticalErrors]);
  
  // Admin will be auto-detected from session (future implementation)

  return (
    <div className="page-wrapper pb-14">
      {/* Single Card Container - Matching VIP Logic Design */}
      <Card className="form-card flex flex-col min-h-[400px]">
        {/* Header */}
        <div className="form-card-header">
          <div className="icon-circle">
            <ClipboardCheck className="icon-circle-icon" />
          </div>
          <div>
            <h3 className="form-card-title">Summary Review</h3>
            <p className="form-card-description">
              Review seluruh konfigurasi sebelum publish persona
            </p>
          </div>
        </div>

        {/* Content Section - Inside same Card */}
        <div className="form-section">
          {/* Editing Indicator */}
          {editingPersonaName && (
            <div className="bg-button-hover/10 border border-button-hover/30 rounded-lg p-3 flex items-center gap-2 mb-6">
              <Edit2 className="h-4 w-4 text-button-hover" />
              <span className="text-sm">Editing: <strong className="text-button-hover">{editingPersonaName}</strong></span>
            </div>
          )}

          {/* Top critical error notification removed - consolidated at bottom in PersonaValidatorCard */}

          {/* Enhancement Tips Banner - Collapsible */}
          {validation.tipsCount > 0 && (
            <Collapsible defaultOpen={false} className="mb-6">
              <CollapsibleTrigger className="w-full flex items-center justify-between p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/10 transition cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                    <Lightbulb className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="font-medium text-yellow-500">
                      {validation.tipsCount} Saran Peningkatan
                    </span>
                    <span className="text-xs text-muted-foreground -mt-0.5">
                      Klik untuk lihat detail
                    </span>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 p-4 rounded-xl border border-border bg-background">
                <ul className="space-y-4">
                  {validation.enhancementTips.map((tip, idx) => {
                    const sectionKeyMap: Record<string, string> = {
                      A: "brandIdentity",
                      agent: "agentPersona", 
                      C: "communicationEngine",
                      O: "operationalSop",
                      V: "vipLogic",
                    };
                    const targetSection = sectionKeyMap[tip.section] || "brandIdentity";
                    
                    // Build the full field path for form.setValue
                    const getFieldPath = () => {
                      if (tip.section === "C") {
                        return `C.${tip.field}` as any;
                      }
                      if (tip.section === "V") {
                        return `V.${tip.field}` as any;
                      }
                      return `${tip.section}.${tip.field}` as any;
                    };
                    
                    const handleApplyRecommendation = () => {
                      if (tip.suggestedValue !== undefined) {
                        form.setValue(getFieldPath(), tip.suggestedValue, { shouldDirty: true });
                        toast.success(`Nilai ${tip.field} diubah menjadi ${tip.suggestedValue}`);
                      }
                    };
                    
                    return (
                      <li key={idx} className="flex flex-col gap-2 p-3 rounded-lg bg-muted/30">
                        <div className="flex items-start gap-2">
                          <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{tip.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">{tip.benefit}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-6">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs rounded-full"
                            onClick={() => onEditSection(targetSection)}
                          >
                            <Edit2 className="h-3 w-3 mr-1" />
                            Edit Bagian Ini
                          </Button>
                          {tip.suggestedValue !== undefined && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs rounded-full bg-yellow-500/10 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/20 hover:text-yellow-600"
                              onClick={handleApplyRecommendation}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Terapkan ({tip.suggestedValue})
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Persona Validator Card */}
          <PersonaValidatorCard config={config} onEditSection={onEditSection} />

          <div className="grid gap-6">
              
              {/* Identitas Brand */}
              <CollapsibleSection 
                title="Identitas Brand"
                sectionKey="brandIdentity"
                status={validation.sectionStatus.A}
                blockStatus={personaValidation.blockStatus["A"]}
                criticalErrors={getBlockCriticalErrors("A")}
                onEdit={() => onEditSection("brandIdentity")}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <ValueBox label="Nama Group" value={config.A.group_name} />
                  <ValueBox label="Nama Website" value={config.A.website_name} />
                  <ValueBox label="Slogan" value={config.A.slogan} />
                  <ValueBox label="Archetype" value={getLabel(config.A.archetype, archetypeLabels)} />
                  <ValueBox label="Lokasi / Region" value={getLabel(config.A.lokasi, lokasiLabels)} />
                  <ValueBox label="Sapaan ke Player" value={config.A.call_to_player} />
                </div>
              </CollapsibleSection>

              {/* Persona Agent */}
              <CollapsibleSection 
                title="Persona Agent"
                sectionKey="agentPersona"
                status={validation.sectionStatus.agent}
                blockStatus={personaValidation.blockStatus["agent"]}
                criticalErrors={getBlockCriticalErrors("agent")}
                onEdit={() => onEditSection("agentPersona")}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <ValueBox label="Nama Agent" value={config.agent.name} />
                  <ValueBox label="Jenis Kelamin" value={getLabel(config.agent.gender, genderLabels)} />
                  <ValueBox label="Nada Bicara" value={getLabel(config.agent.tone, toneLabels)} />
                  <ValueBox label="Gaya Komunikasi" value={getLabel(config.agent.style, styleLabels)} />
                  <ValueBox label="Kecepatan Respons" value={getLabel(config.agent.speed, speedLabels)} />
                  <ValueBox label="Emoji Dilarang" value={config.agent.emoji_forbidden} />
                  <ValueBox label="Latar Belakang" value={config.agent.backstory} className="col-span-2" />
                </div>
              </CollapsibleSection>

              {/* Mesin Komunikasi */}
              <CollapsibleSection 
                title="Mesin Komunikasi"
                sectionKey="communicationEngine"
                status={validation.sectionStatus.C}
                blockStatus={personaValidation.blockStatus["C"]}
                criticalErrors={getBlockCriticalErrors("C")}
                onEdit={() => onEditSection("communicationEngine")}
              >
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <ValueBox label="Tingkat Empati" value={`${config.C.empathy}/10`} />
                  <ValueBox label="Tingkat Persuasif" value={`${config.C.persuasion}/10`} />
                  <ValueBox label="Humor" value={getLabel(config.C.humor_usage, humorUsageLabels)} />
                  <ValueBox label="Izinkan Dialek" value={config.C.dialect_allowed} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                  <ValueBox label="Rasio Bahasa" value={`ID: ${config.C.language_ratio.indonesian}% | EN: ${config.C.language_ratio.english}%`} />
                  <ValueBox label="Auto-Switch Bahasa" value={config.C.auto_switch} />
                  <ValueBox label="Aturan Kustom" value={config.C.boundary_rules?.custom_rules?.length || 0} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
                  <ValueBox label="Tingkat Personalisasi" value={`${config.C?.personalization?.level ?? 5}/10`} />
                  <ValueBox label="Memori Sentimental" value={config.C?.personalization?.memory_enabled ?? false} />
                </div>
              </CollapsibleSection>

              {/* Perpustakaan Interaksi */}
              <CollapsibleSection 
                title="Perpustakaan Interaksi"
                sectionKey="interactionLibrary"
                status={validation.sectionStatus.L}
                blockStatus={personaValidation.blockStatus["L"]}
                criticalErrors={getBlockCriticalErrors("L")}
                onEdit={() => onEditSection("interactionLibrary")}
              >
                {/* Greeting Sub-section */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-button-hover mb-4">Sapaan</h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <ValueBox label="Default" value={config.L.greetings.default} />
                    <ValueBox label="Pagi" value={config.L.greetings.morning} />
                    <ValueBox label="Siang" value={config.L.greetings.afternoon} />
                    <ValueBox label="Sore" value={config.L.greetings.evening} />
                    <ValueBox label="Malam" value={config.L.greetings.night} />
                    <ValueBox label="VIP" value={config.L.greetings.vip} />
                  </div>
                </div>
                
                {/* Closing Sub-section */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-button-hover mb-4">Penutup</h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <ValueBox label="Normal" value={config.L.closings.normal} />
                    <ValueBox label="VIP" value={config.L.closings.vip} />
                    <ValueBox label="Ajakan Halus" value={config.L.closings.soft_push} />
                    <ValueBox label="Netral" value={config.L.closings.neutral} />
                    <ValueBox label="Marah" value={config.L.closings.angry} />
                  </div>
                </div>
                
                {/* Apologies Sub-section */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-button-hover mb-4">Permintaan Maaf</h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <ValueBox label="Ringan" value={config.L.apologies.mild} />
                    <ValueBox label="Sedang" value={config.L.apologies.medium} />
                    <ValueBox label="Berat" value={config.L.apologies.severe} />
                  </div>
                </div>
                
                {/* Empathy Phrases */}
                <div>
                  <h4 className="text-sm font-semibold text-button-hover mb-4">Frasa Empati</h4>
                  <ValueBox label="Frasa" value={config.L.empathy_phrases} />
                </div>
              </CollapsibleSection>

              {/* SOP Operasional */}
              <CollapsibleSection 
                title="SOP Operasional"
                sectionKey="operationalSOP"
                status={validation.sectionStatus.O}
                blockStatus={personaValidation.blockStatus["O"]}
                criticalErrors={getBlockCriticalErrors("O")}
                onEdit={() => onEditSection("operationalSOP")}
              >
                <SectionLabel>Kontak Admin</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <ValueBox label="Metode" value={getLabel(config.O.admin_contact.method, contactMethodLabels)} />
                  <ValueBox label="Kontak" value={config.O.admin_contact.value} />
                  <ValueBox label="Jam Aktif" value={config.O.admin_contact.active_hours} />
                </div>
                
                <SectionLabel>Eskalasi</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <ValueBox label="Gaya SOP" value={getLabel(config.O.escalation.sop_style, sopStyleLabels)} />
                  <ValueBox label="Maks Percobaan AI" value={config.O.escalation.max_ai_attempts} />
                  <ValueBox label="Auto Eskalasi" value={config.O.escalation.auto_escalate} />
                  <ValueBox label="Pesan Default" value={config.O.escalation.default_message} />
                </div>
              </CollapsibleSection>

              {/* Keamanan & Krisis */}
              <CollapsibleSection 
                title="Keamanan & Krisis"
                sectionKey="safetyCrisis"
                status={{ percentage: 100, errors: [] }}
                blockStatus={personaValidation.blockStatus["O"]}
                criticalErrors={personaValidation.criticalErrors.filter(e => e.includes("crisis") || e.includes("toxic"))}
                onEdit={() => onEditSection("safetyCrisis")}
              >
                <SectionLabel>Kamus & Severity</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <ValueBox label="Kamus Merah" value={config.O.crisis.dictionary_red} />
                  <ValueBox label="Kamus Kuning" value={config.O.crisis.dictionary_yellow} />
                  <ValueBox label="Bobot Severity Merah" value={config.O.crisis.severity_weights.red} />
                  <ValueBox label="Bobot Severity Kuning" value={config.O.crisis.severity_weights.yellow} />
                </div>
                
                <SectionLabel>Level Toxisitas</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <ValueBox label="Level 1 (Ringan)" value={config.O.crisis.toxic_severity?.level_1 || "Belum diisi"} />
                  <ValueBox label="Level 2 (Sedang)" value={config.O.crisis.toxic_severity?.level_2 || "Belum diisi"} />
                  <ValueBox label="Level 3 (Berat)" value={config.O.crisis.toxic_severity?.level_3 || "Belum diisi"} />
                </div>
                
                <SectionLabel>Anti-Hunter</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <ValueBox label="Anti-Hunter Aktif" value={config.O?.anti_hunter?.enabled ?? false} />
                  <ValueBox label="Jumlah Rules" value={config.O?.anti_hunter?.rules?.length ?? 0} />
                </div>
                
                <SectionLabel>Bonus Preventif</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <ValueBox label="Sensitivitas Eskalasi" value={`${config.O.risk.appetite}/100`} />
                  <ValueBox label="Bonus Preventif" value={config.O.risk.preventive_bonus_allowed} />
                  <ValueBox label="Limit Bonus" value={config.O.risk.preventive_bonus_limit?.toLocaleString('id-ID') || "Tidak diatur"} />
                  <ValueBox label="Jeda Pemberian" value={config.O.risk.preventive_bonus_cooldown ? `${config.O.risk.preventive_bonus_cooldown} jam` : "Tidak diatur"} />
                  <ValueBox label="Maks Total Bonus" value={config.O.risk.preventive_bonus_max_total?.toLocaleString('id-ID') || "Tidak diatur"} />
                  <ValueBox label="Butuh Approval" value={config.O.risk.preventive_bonus_approval} />
                </div>
              </CollapsibleSection>


              {/* Logika VIP */}
              <CollapsibleSection 
                title="Logika VIP"
                sectionKey="vipLogic"
                status={validation.sectionStatus.V}
                blockStatus={personaValidation.blockStatus["V"]}
                criticalErrors={getBlockCriticalErrors("V")}
                onEdit={() => onEditSection("vipLogic")}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <ValueBox label="VIP Aktif" value={config.V.active} />
                  <ValueBox label="Tipe Threshold" value={getLabel(config.V.threshold.type, thresholdTypeLabels)} />
                  <ValueBox label="Nilai Threshold" value={`${config.V.threshold.value.toLocaleString('id-ID')} ${config.V.threshold.currency}`} />
                  <ValueBox label="Respons Prioritas" value={config.V.priority_response} />
                </div>
                
                <SectionLabel>Pengubah Nada</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <ValueBox label="Kehangatan" value={config.V.tone_modifiers.warmth > 0 ? `+${config.V.tone_modifiers.warmth}` : config.V.tone_modifiers.warmth.toString()} />
                  <ValueBox label="Formalitas" value={config.V.tone_modifiers.formality > 0 ? `+${config.V.tone_modifiers.formality}` : config.V.tone_modifiers.formality.toString()} />
                  <ValueBox label="Kecepatan" value={config.V.tone_modifiers.speed > 0 ? `+${config.V.tone_modifiers.speed}` : config.V.tone_modifiers.speed.toString()} />
                </div>
                
                <div className="mt-6">
                  <ValueBox label="Jumlah Aturan SVIP" value={config.V.svip_rules.length} />
                </div>
              </CollapsibleSection>

          </div>
        </div>

        {/* Version Footer - Vertically centered in remaining space */}
        <div className="flex items-center justify-center pt-6 pb-0 -mb-2">
          <span className="text-xs text-muted-foreground">VOC | APBE V.1.2.0</span>
        </div>
      </Card>

      {/* Fixed Bottom Navigation Bar */}
      <div className="footer-bar">
        <div className="footer-bar-content">
          {/* Left: Back Button */}
          {onBack && (
            <Button
              variant="outline"
              onClick={onBack}
              className="h-11 px-6 gap-2 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
            >
              <ArrowLeft className="h-4 w-4" />
              Sebelumnya
            </Button>
          )}
          {!onBack && <div />}

          {/* Center: Action Buttons */}
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={onGenerateJSON}
              className="h-11 px-6 gap-2 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
            >
              <FileJson className="h-4 w-4" />
              JSON
            </Button>
            <Button 
              variant="outline"
              onClick={onGeneratePrompt}
              disabled={!validation.isValid}
              className="h-11 px-6 gap-2 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              Prompt
            </Button>
          </div>

          {/* Right: Publish Button (Admin auto-detected from session) */}
          <div className="flex items-center gap-3">
            <Button 
              onClick={() => onPublish("Admin")}
              disabled={!validation.isValid}
              variant="golden"
              className="gap-2"
            >
              <Check className="h-4 w-4" />
              Save & Publish
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
