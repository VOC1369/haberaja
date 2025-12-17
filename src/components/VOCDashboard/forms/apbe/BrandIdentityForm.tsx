import { UseFormReturn } from "react-hook-form";
import { APBEConfig, BrandArchetype } from "@/types/apbe-config";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getDefaultsForArchetype, ARCHETYPE_RULESET } from "@/lib/apbe-archetype-ruleset";

interface BrandIdentityFormProps {
  form: UseFormReturn<APBEConfig>;
  isEditingFromSummary?: boolean;
  onSaveAndReturn?: () => void;
}
const archetypeOptions: {
  value: BrandArchetype;
  label: string;
  description: string;
}[] = [{
  value: "jester",
  label: "Jester",
  description: "Playful & fun"
}, {
  value: "caregiver",
  label: "Caregiver",
  description: "Caring & supportive"
}, {
  value: "hero",
  label: "Hero",
  description: "Bold & confident"
}, {
  value: "sage",
  label: "Sage",
  description: "Wise & knowledgeable"
}, {
  value: "everyman",
  label: "Everyman",
  description: "Relatable & friendly"
}, {
  value: "ruler",
  label: "Ruler",
  description: "Premium & authoritative"
}, {
  value: "creator",
  label: "Creator",
  description: "Innovative & creative"
}, {
  value: "explorer",
  label: "Explorer",
  description: "Adventurous & free"
}, {
  value: "rebel",
  label: "Rebel",
  description: "Edgy & unconventional"
}, {
  value: "lover",
  label: "Lover",
  description: "Passionate & intimate"
}, {
  value: "magician",
  label: "Magician",
  description: "Transformative & visionary"
}, {
  value: "innocent",
  label: "Innocent",
  description: "Pure & optimistic"
}];
// Lokasi options for timezone/IP relevance
const lokasiOptions = [
  { value: "indonesia", label: "Indonesia (WIB/WITA/WIT)" },
  { value: "malaysia", label: "Malaysia (MYT)" },
  { value: "singapore", label: "Singapore (SGT)" },
  { value: "thailand", label: "Thailand (ICT)" },
  { value: "vietnam", label: "Vietnam (ICT)" },
  { value: "philippines", label: "Philippines (PHT)" },
  { value: "cambodia", label: "Cambodia (ICT)" },
  { value: "laos", label: "Laos (ICT)" },
  { value: "myanmar", label: "Myanmar (MMT)" },
  { value: "brunei", label: "Brunei (BNT)" },
];
export function BrandIdentityForm({
  form,
  isEditingFromSummary,
  onSaveAndReturn
}: BrandIdentityFormProps) {
  const handleSaveSection = () => {
    toast.success("Brand Identity saved!");
    if (onSaveAndReturn) {
      onSaveAndReturn();
    }
  };

  return <div className="page-wrapper">
      <Card className="form-card">
        <div className="form-card-header">
          <div className="icon-circle">
            <Building2 className="icon-circle-icon" />
          </div>
          <div>
            <h3 className="form-card-title">Brand Identity</h3>
            <p className="form-card-description">
              Identitas inti brand yang akan direpresentasikan oleh AI
            </p>
          </div>
        </div>

        <div className="form-section space-y-6">
          <div className="space-y-6">
            <h4 className="text-lg font-semibold text-button-hover">1. Identitas Brand</h4>
            <div className="form-grid">
          <FormField control={form.control} name="A.group_name" render={({
          field
        }) => <FormItem>
                <FormLabel>Nama Group</FormLabel>
                <FormControl>
                  <Input placeholder="ex: VOC Group" {...field} />
                </FormControl>
                <FormDescription>Opsional. Data internal untuk backend. Tidak digunakan untuk greeting AI.</FormDescription>
                <FormMessage />
              </FormItem>} />

          <FormField control={form.control} name="A.website_name" render={({
          field
        }) => <FormItem>
                <FormLabel>Nama Website / Brand *</FormLabel>
                <FormControl>
                  <Input placeholder="ex: VOC 1369" {...field} />
                </FormControl>
                <FormDescription>Identitas utama brand yang dilihat player.</FormDescription>
                <FormMessage />
              </FormItem>} />

          <FormField control={form.control} name="A.slogan" render={({
          field
        }) => <FormItem className="md:col-span-2">
                <FormLabel>Slogan / Tagline *</FormLabel>
                <FormControl>
                  <Input placeholder="ex: Vereenigde Oostindische Compagnie" {...field} />
                </FormControl>
                <FormDescription>Tagline brand yang akan digunakan AI</FormDescription>
                <FormMessage />
              </FormItem>} />

          {/* NEW FIELD: Sapaan Brand ke Player */}
          <FormField control={form.control} name="A.call_to_player" render={({
          field
        }) => <FormItem>
                <FormLabel>Sapaan Brand ke Player *</FormLabel>
                <FormControl>
                  <Input placeholder="ex: Kak, Bos, Sis" {...field} />
                </FormControl>
                <FormDescription>Sapaan default yang akan digunakan AI saat menyapa player</FormDescription>
                <FormMessage />
              </FormItem>} />

          <FormField control={form.control} name="A.archetype" render={({
          field
        }) => {
          const handleArchetypeChange = (value: string) => {
            field.onChange(value);
            
            // Auto-suggest Communication Engine values based on archetype
            const defaults = getDefaultsForArchetype(value as BrandArchetype);
            const rule = ARCHETYPE_RULESET[value as BrandArchetype];
            
            // === DIFF-BASED OVERWRITE LOGIC ===
            // Only overwrite fields that haven't been manually changed by user
            const dirtyFields = form.formState.dirtyFields;
            
            // Track what was auto-updated vs preserved
            const autoUpdated: string[] = [];
            const preserved: string[] = [];
            
            // Agent tone - overwrite if not dirty
            if (!dirtyFields.agent?.tone) {
              form.setValue("agent.tone", defaults.tone);
              autoUpdated.push("Tone");
            } else {
              preserved.push("Tone");
            }
            
            // Humor usage - overwrite if not dirty
            if (!dirtyFields.C?.humor_usage) {
              form.setValue("C.humor_usage", defaults.humor_usage);
              autoUpdated.push("Humor");
            } else {
              preserved.push("Humor");
            }
            
            // Dialect allowed - overwrite if not dirty
            if (!dirtyFields.C?.dialect_allowed) {
              form.setValue("C.dialect_allowed", defaults.dialect_allowed);
              autoUpdated.push("Dialect");
            } else {
              preserved.push("Dialect");
            }
            
            // === SMART TOAST NOTIFICATION ===
            if (preserved.length === 0) {
              // All fields auto-updated
              toast.success(
                `Nilai default disesuaikan dengan archetype "${rule.label}"`,
                {
                  description: `Tone: ${defaults.tone}, Humor: ${defaults.humor_usage}`,
                  icon: <Sparkles className="h-4 w-4" />,
                }
              );
            } else if (autoUpdated.length > 0) {
              // Partial update - some preserved
              toast.success(
                `Archetype "${rule.label}" diterapkan`,
                {
                  description: `Auto-update: ${autoUpdated.join(", ")}. Dipertahankan: ${preserved.join(", ")}`,
                  icon: <Sparkles className="h-4 w-4" />,
                }
              );
            } else {
              // Nothing updated - all preserved
              toast.info(
                `Archetype "${rule.label}" dipilih`,
                {
                  description: `Nilai manual Anda dipertahankan. Reset manual jika ingin default archetype.`,
                }
              );
            }
          };
          
          return (
            <FormItem>
              <FormLabel>Brand Archetype *</FormLabel>
              <Select onValueChange={handleArchetypeChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih archetype" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {archetypeOptions.map(option => <SelectItem key={option.value} value={option.value}>
                      <span className="font-medium">{option.label}</span>
                      <span className="text-muted-foreground ml-2">— {option.description}</span>
                    </SelectItem>)}
                </SelectContent>
              </Select>
              <FormDescription>Kepribadian Dasar Brand</FormDescription>
              <FormMessage />
            </FormItem>
          );
        }} />

          <FormField control={form.control} name="A.lokasi" render={({
          field
        }) => <FormItem>
                <FormLabel>Lokasi / Region *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih lokasi" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {lokasiOptions.map(option => <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
                <FormDescription>Region operasional untuk IP relevance dan timezone</FormDescription>
                <FormMessage />
              </FormItem>} />
            </div>
          </div>
        </div>

        {/* Save Section Button - only show when editing from summary */}
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
    </div>;
}