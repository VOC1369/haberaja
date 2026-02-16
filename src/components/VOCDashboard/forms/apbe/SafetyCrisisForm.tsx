import { UseFormReturn } from "react-hook-form";
import { APBEConfig, CrisisTone } from "@/types/apbe-config";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ShieldAlert, Plus, X, Save, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { processWordsToAdd, cleanDictionary } from "@/lib/apbe-dictionary-preprocessor";

// Format number with thousand separator (dot)
const formatNumber = (value: number | undefined): string => {
  if (!value) return "";
  return value.toLocaleString("id-ID");
};

// Parse formatted string back to number
const parseNumber = (value: string): number => {
  return parseInt(value.replace(/\./g, "")) || 0;
};

interface SafetyCrisisFormProps {
  form: UseFormReturn<APBEConfig>;
  isEditingFromSummary?: boolean;
  onSaveAndReturn?: () => void;
}

const crisisToneOptions: { value: CrisisTone; label: string }[] = [
  { value: "calm", label: "Tenang & Menenangkan" },
  { value: "apologetic", label: "Apologetic (banyak minta maaf)" },
  { value: "solution", label: "Solution-focused" },
  { value: "empathetic", label: "Sangat Empati" },
];

export function SafetyCrisisForm({ form, isEditingFromSummary, onSaveAndReturn }: SafetyCrisisFormProps) {
  const [newRedWord, setNewRedWord] = useState("");

  const dictionaryRed = form.watch("O.crisis.dictionary_red") || [];
  const preventiveBonusAllowed = form.watch("O.risk.preventive_bonus_allowed");

  const handleSaveSection = () => {
    toast.success("Safety & Crisis saved!");
    if (onSaveAndReturn) {
      onSaveAndReturn();
    }
  };

  const addRedWord = () => {
    if (!newRedWord.trim()) return;
    
    const result = processWordsToAdd(newRedWord, dictionaryRed, []);
    
    result.errors.forEach(err => toast.error(err));
    result.warnings.forEach(warn => toast.warning(warn));
    
    if (result.added.length > 0) {
      form.setValue("O.crisis.dictionary_red", [...dictionaryRed, ...result.added]);
      toast.success(`${result.added.length} kata ditambahkan ke Dictionary Red`);
    }
    
    setNewRedWord("");
  };

  const removeRedWord = (index: number) => {
    const updated = dictionaryRed.filter((_: string, i: number) => i !== index);
    form.setValue("O.crisis.dictionary_red", updated);
  };

  // Clean dictionaries (remove duplicates, normalize) — Red only
  const handleCleanDictionaries = () => {
    const cleanedRed = cleanDictionary(dictionaryRed);
    const redRemoved = dictionaryRed.length - cleanedRed.length;
    
    if (redRemoved > 0) {
      form.setValue("O.crisis.dictionary_red", cleanedRed);
      toast.success(`Dibersihkan: ${redRemoved} duplikat Red`);
    } else {
      toast.info("Dictionary sudah bersih, tidak ada duplikat");
    }
  };

  return (
    <div className="page-wrapper">
      <Card className="form-card">
        <div className="form-card-header">
          <div className="icon-circle">
            <ShieldAlert className="icon-circle-icon" />
          </div>
          <div>
            <h3 className="form-card-title">Safety & Crisis</h3>
            <p className="form-card-description">
              Pengaturan keamanan dan penanganan krisis
            </p>
          </div>
        </div>

        <div className="form-section space-y-6">
          {/* Section 1: Basic Settings */}
          <div className="space-y-6">
            <h4 className="text-lg font-semibold text-button-hover">1. Pengaturan Dasar</h4>
            <div className="form-grid">
            <FormField
              control={form.control}
              name="O.crisis.tone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gaya Respons Krisis *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih gaya" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {crisisToneOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Bagaimana AI merespons saat krisis</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="O.risk.appetite"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sensitivitas Eskalasi Ke Human Agent: {field.value || 50}%</FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      <Slider
                        min={1}
                        max={100}
                        step={1}
                        value={[field.value || 50]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Rendah</span>
                        <span>Tinggi</span>
                      </div>
                    </div>
                  </FormControl>
                  <FormDescription>Seberapa sensitif AI untuk meminta bantuan human agent</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            </div>
          </div>

          {/* Section 2: Dictionary Red */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-button-hover">2. Dictionary Red</h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCleanDictionaries}
                className="text-xs"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Bersihkan Duplikat
              </Button>
            </div>
            
            <div className="space-y-3">
              <FormLabel className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-destructive"></span>
                Dictionary Red (TERLARANG)
              </FormLabel>
              <p className="text-sm text-muted-foreground">
                Kata/frasa yang TIDAK BOLEH diucapkan AI sama sekali
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Tambah kata (pisahkan dengan koma)..."
                  value={newRedWord}
                  onChange={(e) => setNewRedWord(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRedWord())}
                  className="flex-1"
                />
                <Button type="button" onClick={addRedWord} size="icon" variant="outline" className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 min-h-[60px] p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                {dictionaryRed.map((word: string, index: number) => (
                  <Badge key={index} variant="destructive" className="flex items-center gap-2 px-3">
                    {word}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => removeRedWord(index)}
                    />
                  </Badge>
                ))}
              </div>
              {/* Red Severity Weight */}
              <FormField
                control={form.control}
                name="O.crisis.severity_weights.red"
                render={({ field }) => (
                  <FormItem className="pt-3">
                    <FormLabel className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-destructive"></span>
                      Bobot Severity Merah: {field.value?.toFixed(1) || "1.0"}
                    </FormLabel>
                    <FormControl>
                      <Slider
                        min={0.5}
                        max={1}
                        step={0.1}
                        value={[field.value || 1.0]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                        className="w-full"
                      />
                    </FormControl>
                    <FormDescription>Bobot keseriusan kata RED (1.0 = sangat serius)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Section 3: Preventive Bonus */}
          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-semibold text-button-hover">3. Bonus Preventif</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Pengaturan bonus yang bisa ditawarkan AI untuk mencegah churn
              </p>
            </div>

            <FormField
              control={form.control}
              name="O.risk.preventive_bonus_allowed"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg bg-muted p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-button-hover">Izinkan Bonus Preventif</FormLabel>
                    <FormDescription>
                      AI boleh menawarkan bonus untuk mencegah player churn
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

            {preventiveBonusAllowed && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-4 bg-muted/40 rounded-lg">
                <FormField
                  control={form.control}
                  name="O.risk.preventive_bonus_limit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Limit Bonus per-customer (Rp)</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="50.000"
                          value={formatNumber(field.value)}
                          onChange={(e) => field.onChange(parseNumber(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="O.risk.preventive_bonus_max_total"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Total Bonus Harian</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="500.000"
                          value={formatNumber(field.value)}
                          onChange={(e) => field.onChange(parseNumber(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="O.risk.preventive_bonus_cooldown"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cooldown (Jam)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="24"
                          value={field.value || ""}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 24)}
                        />
                      </FormControl>
                      <FormDescription>Jeda Pemberian ke User yang sama</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="O.risk.preventive_bonus_approval"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-button-hover">Butuh Approval</FormLabel>
                        <FormDescription>Admin harus approve</FormDescription>
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
            )}
          </div>
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
