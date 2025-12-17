import { UseFormReturn } from "react-hook-form";
import { APBEConfig, HumorUsage, DataVerificationMode, DEFAULT_VERIFICATION_FIELDS } from "@/types/apbe-config";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Save, Plus, X, Lock } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface CommunicationEngineFormProps {
  form: UseFormReturn<APBEConfig>;
  isEditingFromSummary?: boolean;
  onSaveAndReturn?: () => void;
}

const humorOptions: { value: HumorUsage; label: string }[] = [
  { value: "none", label: "Tidak Ada" },
  { value: "subtle", label: "Jarang" },
  { value: "moderate", label: "Sedikit" },
  { value: "frequent", label: "Cukup" },
];

const interactionModeOptions: { value: DataVerificationMode; label: string; description: string }[] = [
  { value: "step_by_step", label: "Step by Step", description: "AI bertanya satu per satu di chat" },
  { value: "form", label: "Form", description: "AI mengirim form terstruktur" },
  { value: "adaptive", label: "Adaptive (Conditional)", description: "AI memilih metode berdasarkan kondisi user" },
];

// Default rule yang tidak bisa dihapus - sesuai logika validasi baru
const DEFAULT_BOUNDARY_RULE = "AI dilarang menjawab pertanyaan di luar Knowledge Base";

export function CommunicationEngineForm({ form, isEditingFromSummary, onSaveAndReturn }: CommunicationEngineFormProps) {
  const languageRatio = form.watch("C.language_ratio");
  const boundaryRules = form.watch("C.boundary_rules");
  const rawDataVerification = form.watch("C.data_verification");
  
  // Fallback: ensure data_verification has default fields if empty/undefined
  const dataVerification = {
    enabled: rawDataVerification?.enabled ?? false,
    fields: (rawDataVerification?.fields?.length > 0) ? rawDataVerification.fields : DEFAULT_VERIFICATION_FIELDS,
    interaction_mode: rawDataVerification?.interaction_mode ?? "step_by_step" as DataVerificationMode,
  };
  
  // Initialize form with default fields if empty (one-time migration)
  if (rawDataVerification?.enabled && (!rawDataVerification?.fields || rawDataVerification.fields.length === 0)) {
    form.setValue("C.data_verification.fields", DEFAULT_VERIFICATION_FIELDS);
  }
  
  const [newBoundary, setNewBoundary] = useState("");
  const [newVerificationRule, setNewVerificationRule] = useState("");

  const handleSaveSection = () => {
    toast.success("Communication Engine saved!");
    if (onSaveAndReturn) {
      onSaveAndReturn();
    }
  };

  // Add custom boundary
  const handleAddBoundary = () => {
    if (!newBoundary.trim()) return;
    
    const current = boundaryRules?.custom_rules || [];
    if (current.includes(newBoundary.trim())) {
      toast.error("Aturan ini sudah ada");
      return;
    }
    
    form.setValue("C.boundary_rules.custom_rules", [...current, newBoundary.trim()]);
    setNewBoundary("");
    toast.success("Batasan custom ditambahkan");
  };

  // Remove custom boundary
  const handleRemoveBoundary = (boundary: string) => {
    const current = boundaryRules?.custom_rules || [];
    form.setValue("C.boundary_rules.custom_rules", current.filter(b => b !== boundary));
  };

  // Add verification field
  const handleAddVerificationField = () => {
    if (!newVerificationRule.trim()) return;
    
    const current = dataVerification?.fields || [];
    const exists = current.some(f => f.toLowerCase() === newVerificationRule.trim().toLowerCase());
    if (exists) {
      toast.error("Field ini sudah ada");
      return;
    }
    
    form.setValue("C.data_verification.fields", [...current, newVerificationRule.trim()]);
    setNewVerificationRule("");
    toast.success("Field verifikasi ditambahkan");
  };

  // Remove verification field
  const handleRemoveVerificationField = (field: string) => {
    const current = dataVerification?.fields || [];
    form.setValue("C.data_verification.fields", current.filter(f => f !== field));
  };

  return (
    <div className="page-wrapper">
      <Card className="form-card">
        <div className="form-card-header">
          <div className="icon-circle">
            <MessageSquare className="icon-circle-icon" />
          </div>
          <div>
            <h3 className="form-card-title">Communication Engine</h3>
            <p className="form-card-description">
              Pengaturan cara AI berbicara secara teknis. Kepribadian sudah diatur di halaman Agent Persona.
            </p>
          </div>
        </div>

        <div className="form-section space-y-6">
          {/* Empathy & Persuasion Sliders Section */}
          <div className="space-y-6">
            <h4 className="text-lg font-semibold text-button-hover">1. Tingkat Empati & Persuasif</h4>
            <div className="form-grid">
              <FormField
                control={form.control}
                name="C.empathy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tingkat Empati (1-10) *</FormLabel>
                    <FormControl>
                      <div className="space-y-4">
                        <Slider
                          min={1}
                          max={10}
                          step={1}
                          value={[field.value || 7]}
                          onValueChange={(vals) => field.onChange(vals[0])}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Netral</span>
                          <span className="font-medium text-button-hover">{field.value || 7}</span>
                          <span>Sangat Empati</span>
                        </div>
                      </div>
                    </FormControl>
                    <FormDescription>Seberapa lembut & memahami AI saat merespons</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="C.persuasion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tingkat Persuasif (1-10) *</FormLabel>
                    <FormControl>
                      <div className="space-y-4">
                        <Slider
                          min={1}
                          max={10}
                          step={1}
                          value={[field.value || 6]}
                          onValueChange={(vals) => field.onChange(vals[0])}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Pasif</span>
                          <span className="font-medium text-button-hover">{field.value || 6}</span>
                          <span>Sangat Persuasif</span>
                        </div>
                      </div>
                    </FormControl>
                    <FormDescription>Seberapa kuat AI mengajak pemain ke aksi (deposit, cek promo)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Humor Section */}
          <div className="space-y-6">
            <h4 className="text-lg font-semibold text-button-hover">2. Humor</h4>
            <FormField
              control={form.control}
              name="C.humor_usage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Penggunaan Humor *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih frekuensi humor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {humorOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Language Ratio Section */}
          <div className="space-y-6">
            <h4 className="text-lg font-semibold text-button-hover">3. Rasio Bahasa</h4>
            <div className="p-4 bg-muted rounded-lg space-y-4">
              <div className="flex justify-between text-sm">
                <span>Indonesia</span>
                <span className="text-button-hover font-medium">{languageRatio?.indonesian || 90}%</span>
              </div>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[languageRatio?.indonesian || 90]}
                onValueChange={(vals) => {
                  form.setValue("C.language_ratio", {
                    indonesian: vals[0],
                    english: 100 - vals[0],
                  });
                }}
                className="w-full"
              />
              <div className="flex justify-between text-sm">
                <span>English</span>
                <span className="text-button-hover font-medium">{languageRatio?.english || 10}%</span>
              </div>
            </div>
          </div>

          {/* Language Switches Section */}
          <div className="space-y-6">
            <h4 className="text-lg font-semibold text-button-hover">4. Pengaturan Bahasa</h4>
            <div className="form-grid">
              <FormField
                control={form.control}
                name="C.dialect_allowed"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg bg-muted p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-button-hover">Izinkan Dialek</FormLabel>
                      <FormDescription>
                        AI boleh pakai bahasa gaul / dialek lokal
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="C.auto_switch"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg bg-muted p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-button-hover">Auto-Switch Bahasa</FormLabel>
                      <FormDescription>
                        AI otomatis mengikuti bahasa user
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Personalization Section */}
          <div className="space-y-6">
            <h4 className="text-lg font-semibold text-button-hover">5. Personalization</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Tingkat Personalisasi */}
              <FormField
                control={form.control}
                name="C.personalization.level"
                render={({ field }) => (
                  <FormItem className="rounded-lg bg-muted p-4">
                    <FormLabel>Tingkat Personalisasi: {field.value || 7}</FormLabel>
                    <FormControl>
                      <div className="space-y-3 mt-3">
                        <Slider
                          min={1}
                          max={10}
                          step={1}
                          value={[field.value || 7]}
                          onValueChange={(vals) => field.onChange(vals[0])}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Generic</span>
                          <span>Sangat Personal</span>
                        </div>
                      </div>
                    </FormControl>
                    <FormDescription className="mt-2">Seberapa personal respons AI terhadap setiap player</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Right Column: Sentimental Memory */}
              <FormField
                control={form.control}
                name="C.personalization.memory_enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg bg-muted p-4 h-fit">
                    <div className="space-y-0.5">
                      <FormLabel className="text-button-hover">Sentimental Memory</FormLabel>
                      <FormDescription>
                        AI mengingat mood & riwayat interaksi player
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Boundary Rules Section */}
          <div className="space-y-4">
            <div className="space-y-1">
              <h4 className="text-lg font-semibold text-button-hover">6. Batasan Perilaku AI</h4>
              <p className="text-sm text-muted-foreground/50">
                Aturan keras yang TIDAK BOLEH dilanggar AI dalam kondisi apapun
              </p>
            </div>
            
            <div className="space-y-4">
              {/* Default Rule (non-editable) */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Aturan Default (tidak dapat dihapus)</p>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm flex-1">{DEFAULT_BOUNDARY_RULE}</span>
                  <Badge variant="outline" className="text-xs bg-card">Default</Badge>
                </div>
              </div>

              {/* Custom Rules */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Aturan Tambahan</p>
                
                {/* Add new rule input */}
                <div className="flex gap-2">
                  <Input
                    placeholder="ex: AI tidak boleh membahas politik..."
                    value={newBoundary}
                    onChange={(e) => setNewBoundary(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddBoundary();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    onClick={handleAddBoundary}
                    disabled={!newBoundary.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Custom rules list - only show if there are rules */}
                {boundaryRules?.custom_rules && boundaryRules.custom_rules.length > 0 && (
                  <div className="space-y-2">
                    {boundaryRules.custom_rules.map((rule, index) => (
                      <div key={index} className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                        <span className="text-sm flex-1">{rule}</span>
                        <X
                          className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-destructive transition-colors"
                          onClick={() => handleRemoveBoundary(rule)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Data Verification Section */}
          <div className="space-y-4">
            <div className="space-y-1">
              <h4 className="text-lg font-semibold text-button-hover">7. Verifikasi Data User</h4>
              <p className="text-sm text-muted-foreground/50">
                Mengatur apakah AI secara konsisten melakukan pengumpulan dan klarifikasi data user sebelum mengambil kesimpulan.
              </p>
            </div>

            {/* Main Toggle */}
            <FormField
              control={form.control}
              name="C.data_verification.enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg bg-muted p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-button-hover">Aktifkan Verifikasi Data User</FormLabel>
                    <FormDescription>
                      Jika aktif, AI tidak menganggap klaim user sebagai fakta dan akan mengumpulkan data secara konsisten.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Conditional Content - Only show when enabled */}
            {dataVerification?.enabled && (
              <div className="space-y-6 animate-in fade-in-50 duration-300">
                {/* Badge-based Fields */}
                <div className="space-y-3">
                  <FormLabel>Field Verifikasi Data</FormLabel>
                  
                  {/* Badge List - Flex Wrap */}
                  <div className="flex flex-wrap gap-2">
                    {(dataVerification?.fields || []).map((field, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted text-foreground border border-border rounded-full text-sm"
                      >
                        <span>{field}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveVerificationField(field)}
                          className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>

                  {/* Add new field */}
                  <div className="flex gap-2 pt-2">
                    <Input
                      placeholder="contoh: Sudah berapa lama bermain di web kami?"
                      value={newVerificationRule}
                      onChange={(e) => setNewVerificationRule(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddVerificationField();
                        }
                      }}
                      className="flex-1"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={handleAddVerificationField}
                      disabled={!newVerificationRule.trim()}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Tambah
                    </Button>
                  </div>
                </div>

                {/* Interaction Mode Dropdown */}
                <FormField
                  control={form.control}
                  name="C.data_verification.interaction_mode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Metode Bertanya AI</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih metode bertanya" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {interactionModeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Metode ini menentukan cara AI mengumpulkan data, bukan memverifikasi kebenarannya.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>

          {/* Save Button for Edit Mode */}
          {isEditingFromSummary && (
            <div className="pt-4 border-t border-border">
              <Button 
                type="button" 
                onClick={handleSaveSection}
                className="w-full"
                variant="default"
              >
                <Save className="mr-2 h-4 w-4" />
                Save & Return to Summary
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
