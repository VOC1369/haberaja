import { UseFormReturn } from "react-hook-form";
import { APBEConfig } from "@/types/apbe-config";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, Sun, Cloud, Sunset, Moon, Plus, X, Save, Lock, Unlock, RotateCcw, AlertTriangle, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { validateTemplate, ValidationResult } from "@/lib/apbe-interaction-validator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface InteractionLibraryFormProps {
  form: UseFormReturn<APBEConfig>;
  isEditingFromSummary?: boolean;
  onSaveAndReturn?: () => void;
}

// Track which fields are locked vs editable
interface FieldLockState {
  [fieldPath: string]: boolean; // true = locked, false = editable
}

// Track original generated values for reset
interface OriginalValues {
  [fieldPath: string]: string;
}

// Track validation warnings per field
interface FieldWarnings {
  [fieldPath: string]: ValidationResult;
}

// Lazy loading state for each section
interface SectionLoadState {
  greetings: boolean;
  closings: boolean;
  apologies: boolean;
  empathy: boolean;
  crisis: boolean;
}

export function InteractionLibraryForm({ form, isEditingFromSummary, onSaveAndReturn }: InteractionLibraryFormProps) {
  const [newEmpathyPhrase, setNewEmpathyPhrase] = useState("");
  
  // Lock state: all fields start LOCKED (true = locked)
  const [fieldLocks, setFieldLocks] = useState<FieldLockState>({});
  
  // Store original generated values for reset functionality
  const [originalValues, setOriginalValues] = useState<OriginalValues>({});
  
  // Track validation warnings per field
  const [fieldWarnings, setFieldWarnings] = useState<FieldWarnings>({});
  
  // Lazy loading: track which sections have been opened
  const [loadedSections, setLoadedSections] = useState<SectionLoadState>({
    greetings: true,
    closings: false,
    apologies: false,
    empathy: false,
    crisis: false,
  });
  
  // Get current config for validation
  const config = form.getValues();
  
  // Check if a field is locked (default: locked)
  const isFieldLocked = useCallback((fieldPath: string): boolean => {
    return fieldLocks[fieldPath] !== false; // undefined or true = locked
  }, [fieldLocks]);
  
  // Toggle lock/unlock for a field
  const toggleFieldLock = useCallback((fieldPath: string) => {
    const currentValue = form.getValues(fieldPath as any);
    
    // If unlocking, store original value for reset
    if (isFieldLocked(fieldPath)) {
      setOriginalValues(prev => ({
        ...prev,
        [fieldPath]: currentValue || ""
      }));
    }
    
    setFieldLocks(prev => ({
      ...prev,
      [fieldPath]: !isFieldLocked(fieldPath)
    }));
  }, [fieldLocks, form, isFieldLocked]);
  
  // Save and re-lock a field
  const saveAndLockField = useCallback((fieldPath: string) => {
    const currentValue = form.getValues(fieldPath as any) || "";
    
    // Validate the content
    const validation = validateTemplate(
      { id: fieldPath, category: "greeting", content: currentValue, isEdited: true, warnings: [] },
      config
    );
    
    setFieldWarnings(prev => ({
      ...prev,
      [fieldPath]: validation
    }));
    
    // Lock the field
    setFieldLocks(prev => ({
      ...prev,
      [fieldPath]: true
    }));
    
    if (validation.warnings.length > 0) {
      toast.warning(`Disimpan dengan ${validation.warnings.length} peringatan`);
    } else {
      toast.success("Template disimpan");
    }
  }, [config, form]);
  
  // Reset field to original value
  const resetField = useCallback((fieldPath: string) => {
    const original = originalValues[fieldPath];
    if (original !== undefined) {
      form.setValue(fieldPath as any, original);
      setFieldWarnings(prev => {
        const updated = { ...prev };
        delete updated[fieldPath];
        return updated;
      });
      toast.info("Template direset ke nilai asli");
    }
  }, [originalValues, form]);
  
  // Real-time validation on content change
  const validateFieldContent = useCallback((fieldPath: string, content: string) => {
    const validation = validateTemplate(
      { id: fieldPath, category: "greeting", content, isEdited: true, warnings: [] },
      config
    );
    
    setFieldWarnings(prev => ({
      ...prev,
      [fieldPath]: validation
    }));
  }, [config]);
  
  // Handle tab change to trigger lazy loading
  const handleTabChange = useCallback((value: string) => {
    setLoadedSections(prev => ({
      ...prev,
      [value]: true,
    }));
  }, []);

  const handleSaveSection = () => {
    toast.success("Interaction Library saved!");
    if (onSaveAndReturn) {
      onSaveAndReturn();
    }
  };

  const empathyPhrases = form.watch("L.empathy_phrases") || [];

  const addEmpathyPhrase = () => {
    if (newEmpathyPhrase.trim()) {
      form.setValue("L.empathy_phrases", [...empathyPhrases, newEmpathyPhrase.trim()]);
      setNewEmpathyPhrase("");
    }
  };

  const removeEmpathyPhrase = (index: number) => {
    const updated = empathyPhrases.filter((_, i) => i !== index);
    form.setValue("L.empathy_phrases", updated);
  };


  const timeSlots = [
    { key: "morning", label: "Pagi", icon: Sun, time: "05:00 - 11:00" },
    { key: "afternoon", label: "Siang", icon: Cloud, time: "11:00 - 15:00" },
    { key: "evening", label: "Sore", icon: Sunset, time: "15:00 - 18:00" },
    { key: "night", label: "Malam", icon: Moon, time: "18:00 - 05:00" },
  ];

  // Render a locked/editable field with controls
  const renderEditableField = (
    fieldPath: string,
    label: string,
    placeholder: string,
    description?: string,
    labelIcon?: React.ReactNode
  ) => {
    const isLocked = isFieldLocked(fieldPath);
    const warnings = fieldWarnings[fieldPath];
    const hasWarnings = warnings && (warnings.warnings.length > 0 || warnings.errors.length > 0);
    
    return (
      <FormField
        control={form.control}
        name={fieldPath as any}
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between">
              <FormLabel className="flex items-center gap-2">
                {labelIcon}
                {label}
              </FormLabel>
              <div className="flex items-center gap-1">
                {!isLocked && originalValues[fieldPath] && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => resetField(fieldPath)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Reset ke nilai asli</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {isLocked ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleFieldLock(fieldPath)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-button-hover"
                        >
                          <Lock className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Klik untuk edit</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => saveAndLockField(fieldPath)}
                          className="h-7 w-7 p-0 text-button-hover hover:text-button-hover"
                        >
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Simpan & kunci</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
            <FormControl>
              {isLocked ? (
                <div 
                  className="min-h-[80px] p-3 bg-muted/30 rounded-lg text-sm text-foreground/80 cursor-not-allowed border border-border/50"
                  onClick={() => toggleFieldLock(fieldPath)}
                >
                  {field.value || <span className="text-muted-foreground italic">Belum di-generate</span>}
                </div>
              ) : (
                <Textarea
                  placeholder={placeholder}
                  className={`min-h-[80px] ${hasWarnings ? 'border-warning ring-1 ring-warning/30' : 'border-button-hover'}`}
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    validateFieldContent(fieldPath, e.target.value);
                  }}
                />
              )}
            </FormControl>
            {description && <FormDescription>{description}</FormDescription>}
            {hasWarnings && !isLocked && (
              <div className="flex flex-wrap gap-1 mt-1">
                {warnings.errors.map((err, i) => (
                  <Badge key={`err-${i}`} variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {err}
                  </Badge>
                ))}
                {warnings.warnings.map((warn, i) => (
                  <Badge key={`warn-${i}`} variant="secondary" className="text-xs bg-warning/20 text-warning border-warning/30">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {warn}
                  </Badge>
                ))}
              </div>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  return (
    <div className="page-wrapper">
      <Card className="form-card">
        <div className="form-card-header">
          <div className="icon-circle">
            <BookOpen className="icon-circle-icon" />
          </div>
          <div>
            <h3 className="form-card-title">Interaction Library</h3>
            <p className="form-card-description">
              Ini adalah gambaran bagaimana AI Agent anda akan berinteraksi dengan user
            </p>
          </div>
        </div>

        <div className="form-section space-y-6">
          <Tabs defaultValue="greetings" className="space-y-8" onValueChange={handleTabChange}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="greetings">Sapaan</TabsTrigger>
            <TabsTrigger value="closings">Penutup</TabsTrigger>
            <TabsTrigger value="apologies">Maaf</TabsTrigger>
            <TabsTrigger value="empathy">Empati</TabsTrigger>
            <TabsTrigger value="crisis">Krisis</TabsTrigger>
          </TabsList>

          {/* GREETINGS */}
          <TabsContent value="greetings" className="space-y-6">

            {renderEditableField(
              "L.greetings.default",
              "Sapaan Default *",
              "Halo {{call_to_player}}! Ada yang bisa dibantu? 😊",
              "Sapaan standar jika waktu tidak diketahui"
            )}

            <div className="form-grid">
              {timeSlots.map((slot) => (
                <div key={slot.key}>
                  {renderEditableField(
                    `L.greetings.${slot.key}`,
                    `${slot.label}`,
                    `Sapaan untuk ${slot.label.toLowerCase()}...`,
                    `(${slot.time})`,
                    <slot.icon className="h-4 w-4 text-button-hover" />
                  )}
                </div>
              ))}
            </div>

            {renderEditableField(
              "L.greetings.vip",
              "Sapaan VIP",
              "Sapaan khusus untuk player VIP...",
              "Sapaan eksklusif untuk pemain VIP",
              <span className="text-button-hover">⭐</span>
            )}
          </TabsContent>

          {/* CLOSINGS - LAZY LOADED */}
          <TabsContent value="closings" className="space-y-6 pb-8">
            {!loadedSections.closings ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Memuat...</span>
              </div>
            ) : (
              <>

            {renderEditableField(
              "L.closings.normal",
              "Penutup Normal *",
              "Terima kasih {{call_to_player}}! Semoga beruntung 🍀",
              "Penutup standar untuk percakapan biasa"
            )}

            {renderEditableField(
              "L.closings.vip",
              "Penutup VIP",
              "Terima kasih banyak {{call_to_player}}! Sukses selalu 🏆",
              "Penutup khusus untuk player VIP",
              <span className="text-button-hover">⭐</span>
            )}

            {renderEditableField(
              "L.closings.soft_push",
              "Penutup Soft Push",
              "Terima kasih {{call_to_player}}! Jangan lupa cek promo terbaru kami ya 🎁",
              "Ajak lanjutan, sangat halus"
            )}

            {renderEditableField(
              "L.closings.neutral",
              "Penutup Netral",
              "Terima kasih {{call_to_player}}! 🙏",
              "Tidak ajak apa pun"
            )}

            {renderEditableField(
              "L.closings.angry",
              "Penutup Saat Player Marah",
              "Sekali lagi mohon maaf {{call_to_player}}. Semoga masalah ini tidak terulang 🙏",
              "Penutup saat player dalam kondisi marah/kecewa"
            )}
              </>
            )}
          </TabsContent>

          {/* APOLOGIES - LAZY LOADED */}
          <TabsContent value="apologies" className="space-y-6 pb-8">
            {!loadedSections.apologies ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Memuat...</span>
              </div>
            ) : (
              <>

            {renderEditableField(
              "L.apologies.mild",
              "Maaf Ringan",
              "Mohon maaf atas ketidaknyamanan kecil ini {{call_to_player}} 🙏",
              "Minor error, mis-info kecil"
            )}

            {renderEditableField(
              "L.apologies.medium",
              "Maaf Sedang",
              "Mohon maaf {{call_to_player}}, sedang ada kendala teknis. Tim kami sedang proses ya 🙏",
              "Pending singkat, kendala teknis"
            )}

            {renderEditableField(
              "L.apologies.severe",
              "Maaf Berat",
              "Kami sangat menyesal atas ketidaknyamanan yang {{call_to_player}} alami. Tim prioritas kami sedang tangani sekarang 🙏",
              "WD lama, saldo hilang, marah level 8+"
            )}
              </>
            )}
          </TabsContent>

          {/* EMPATHY PHRASES - LAZY LOADED */}
          <TabsContent value="empathy" className="space-y-6 pb-8">
            {!loadedSections.empathy ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Memuat...</span>
              </div>
            ) : (
              <>

            <div className="space-y-4">
              <FormLabel>Frasa Empati</FormLabel>
              <p className="text-sm text-muted-foreground">
                Kumpulan frasa empati yang akan digunakan AI untuk merespons dengan pengertian. Gunakan {"{{call_to_player}}"} untuk sapaan dinamis.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Tambah frasa empati..."
                  value={newEmpathyPhrase}
                  onChange={(e) => setNewEmpathyPhrase(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmpathyPhrase())}
                  className="flex-1"
                />
                <Button type="button" onClick={addEmpathyPhrase} variant="outline" className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 min-h-[60px] p-3 bg-muted rounded-lg">
                {empathyPhrases.map((phrase, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-2 py-1.5 px-3">
                    {phrase}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-destructive"
                      onClick={() => removeEmpathyPhrase(index)}
                    />
                  </Badge>
                ))}
                {empathyPhrases.length === 0 && (
                  <span className="text-sm text-muted-foreground">Belum ada frasa empati</span>
                )}
              </div>
            </div>
              </>
            )}
          </TabsContent>

          {/* CRISIS TEMPLATES - LAZY LOADED */}
          <TabsContent value="crisis" className="space-y-6 pb-8">
            {!loadedSections.crisis ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Memuat...</span>
              </div>
            ) : (
              <>

                <Tabs defaultValue="angry" className="w-full">
                  <TabsList className="grid grid-cols-5 w-full">
                    <TabsTrigger value="angry">Marah</TabsTrigger>
                    <TabsTrigger value="system">System Error</TabsTrigger>
                    <TabsTrigger value="payment">Payment</TabsTrigger>
                    <TabsTrigger value="locked">Akun Lock</TabsTrigger>
                    <TabsTrigger value="fraud">Fraud</TabsTrigger>
                  </TabsList>

                  <TabsContent value="angry" className="mt-4">
                    {renderEditableField(
                      "O.crisis.templates.angry_player",
                      "Template Player Marah",
                      "Kami sangat memahami kekecewaan {{call_to_player}}..."
                    )}
                  </TabsContent>

                  <TabsContent value="system" className="mt-4">
                    {renderEditableField(
                      "O.crisis.templates.system_error",
                      "Template System Error",
                      "Mohon maaf {{call_to_player}}, sedang ada gangguan teknis..."
                    )}
                  </TabsContent>

                  <TabsContent value="payment" className="mt-4">
                    {renderEditableField(
                      "O.crisis.templates.payment_issue",
                      "Template Payment Issue",
                      "Kami akan segera cek transaksi {{call_to_player}}..."
                    )}
                  </TabsContent>

                  <TabsContent value="locked" className="mt-4">
                    {renderEditableField(
                      "O.crisis.templates.account_locked",
                      "Template Akun Terkunci",
                      "Akun {{call_to_player}} sedang dalam proses verifikasi..."
                    )}
                  </TabsContent>

                  <TabsContent value="fraud" className="mt-4">
                    {renderEditableField(
                      "O.crisis.templates.fraud_detected",
                      "Template Fraud Detected",
                      "Demi keamanan, akun {{call_to_player}} perlu verifikasi tambahan..."
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </TabsContent>
        </Tabs>
        </div>
        {isEditingFromSummary && (
          <div className="mt-6 flex justify-end">
            <Button 
              type="button" 
              onClick={handleSaveSection}
              className="bg-button-hover text-button-hover-foreground hover:bg-button-hover/90"
            >
              <Save className="h-4 w-4 mr-2" />
              Simpan & Kembali
            </Button>
          </div>
        )}

      </Card>
    </div>
  );
}
