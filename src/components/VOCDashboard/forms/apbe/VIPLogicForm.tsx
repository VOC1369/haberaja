import { UseFormReturn } from "react-hook-form";
import { APBEConfig, VIPThresholdType } from "@/types/apbe-config";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Crown, Plus, Trash2, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface VIPLogicFormProps {
  form: UseFormReturn<APBEConfig>;
  isEditingFromSummary?: boolean;
  onSaveAndReturn?: () => void;
}

const thresholdTypeOptions: { value: VIPThresholdType; label: string }[] = [
  { value: "total_deposit", label: "Total Deposit" },
  { value: "turnover", label: "Total Turnover" },
  { value: "ggr", label: "Gross Gaming Revenue" },
];

const currencyOptions = [
  { value: "IDR", label: "IDR - Indonesian Rupiah" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "SGD", label: "SGD - Singapore Dollar" },
  { value: "MYR", label: "MYR - Malaysian Ringgit" },
  { value: "THB", label: "THB - Thai Baht" },
  { value: "VND", label: "VND - Vietnamese Dong" },
  { value: "PHP", label: "PHP - Philippine Peso" },
  { value: "JPY", label: "JPY - Japanese Yen" },
  { value: "KRW", label: "KRW - South Korean Won" },
  { value: "CNY", label: "CNY - Chinese Yuan" },
  { value: "INR", label: "INR - Indian Rupee" },
  { value: "AUD", label: "AUD - Australian Dollar" },
];

// Format number to Indonesian format (1.000.000,5)
const formatNumber = (num: number): string => {
  return num.toLocaleString('id-ID', { maximumFractionDigits: 10 });
};

// Parse Indonesian format back to number
const parseNumber = (str: string): number => {
  // Remove thousand separators (dots), replace decimal comma with dot
  const normalized = str.replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized) || 0;
};

export function VIPLogicForm({ form, isEditingFromSummary, onSaveAndReturn }: VIPLogicFormProps) {
  const [newTierName, setNewTierName] = useState("");
  const [thresholdDisplay, setThresholdDisplay] = useState<string>(() => {
    const val = form.getValues("V.threshold.value");
    return val ? formatNumber(val) : "";
  });

  const vipEnabled = form.watch("V.active");
  const svipRules = form.watch("V.svip_rules") || [];

  const handleSaveSection = () => {
    toast.success("VIP Logic saved!");
    if (onSaveAndReturn) {
      onSaveAndReturn();
    }
  };

  const addSVIPRule = () => {
    if (newTierName.trim()) {
      const newRule = {
        tier_name: newTierName.trim(),
        threshold: 50000000,
        notes: "",
      };
      form.setValue("V.svip_rules", [...svipRules, newRule]);
      setNewTierName("");
    }
  };

  const removeSVIPRule = (index: number) => {
    const updated = svipRules.filter((_, i) => i !== index);
    form.setValue("V.svip_rules", updated);
  };

  return (
    <div className="page-wrapper">
      <Card className="form-card">
        <div className="form-card-header">
          <div className="icon-circle">
            <Crown className="icon-circle-icon" />
          </div>
          <div>
            <h3 className="form-card-title">VIP Logic</h3>
            <p className="form-card-description">
              Pengaturan khusus untuk player VIP
            </p>
          </div>
        </div>

        <div className="form-section space-y-6">
          {/* Enable VIP Section */}
          <div className="space-y-6">
            <h4 className="text-lg font-semibold text-button-hover">1. Aktivasi VIP</h4>
          <FormField
            control={form.control}
            name="V.active"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg bg-muted p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-button-hover">Aktifkan VIP Logic</FormLabel>
                  <FormDescription>
                    Gunakan perlakuan khusus untuk player VIP
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

          {vipEnabled && (
            <>
              {/* VIP Threshold Section */}
              <div className="space-y-6">
                <h4 className="text-lg font-semibold text-button-hover">2. Kriteria VIP</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="V.threshold.type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipe Threshold *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih tipe" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {thresholdTypeOptions.map((option) => (
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

                  <FormField
                    control={form.control}
                    name="V.threshold.value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nilai Threshold *</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="1.000.000"
                            value={thresholdDisplay}
                            onChange={(e) => {
                              const raw = e.target.value;
                              // Allow numbers, dots, commas
                              if (/^[\d.,]*$/.test(raw)) {
                                setThresholdDisplay(raw);
                                const parsed = parseNumber(raw);
                                if (!isNaN(parsed)) {
                                  field.onChange(parsed);
                                }
                              }
                            }}
                            onBlur={() => {
                              // Format display on blur
                              const parsed = parseNumber(thresholdDisplay);
                              if (!isNaN(parsed) && parsed > 0) {
                                setThresholdDisplay(formatNumber(parsed));
                              }
                            }}
                          />
                        </FormControl>
                        <FormDescription>Gunakan titik atau koma untuk desimal</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="V.threshold.currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mata Uang</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "IDR"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih mata uang" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {currencyOptions.map((option) => (
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
              </div>


              {/* Tone Modifiers Section */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold text-button-hover">3. Tone Modifiers</h4>
                  <p className="text-sm text-muted-foreground mt-1">Penyesuaian nada untuk VIP dibanding regular player</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="V.tone_modifiers.warmth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Warmth Modifier: {field.value > 0 ? `+${field.value}` : field.value}
                        </FormLabel>
                        <FormControl>
                          <div className="space-y-3">
                            <Slider
                              min={-3}
                              max={3}
                              step={1}
                              value={[field.value || 0]}
                              onValueChange={(vals) => field.onChange(vals[0])}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Lebih Dingin</span>
                              <span>Lebih Hangat</span>
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="V.tone_modifiers.formality"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Formality Modifier: {field.value > 0 ? `+${field.value}` : field.value}
                        </FormLabel>
                        <FormControl>
                          <div className="space-y-3">
                            <Slider
                              min={-3}
                              max={3}
                              step={1}
                              value={[field.value || 0]}
                              onValueChange={(vals) => field.onChange(vals[0])}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Lebih Santai</span>
                              <span>Lebih Formal</span>
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="V.tone_modifiers.speed"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Speed Modifier: {field.value > 0 ? `+${field.value}` : field.value}
                        </FormLabel>
                        <FormControl>
                          <div className="space-y-3">
                            <Slider
                              min={-3}
                              max={3}
                              step={1}
                              value={[field.value || 0]}
                              onValueChange={(vals) => field.onChange(vals[0])}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Lebih Lambat</span>
                              <span>Lebih Cepat</span>
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Priority Response Section */}
              <div className="space-y-6">
                <h4 className="text-lg font-semibold text-button-hover">4. Priority Response</h4>
                <FormField
                  control={form.control}
                  name="V.priority_response"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg bg-muted p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-button-hover">Priority Response</FormLabel>
                        <FormDescription>VIP dapat respons lebih cepat</FormDescription>
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

              {/* SVIP Rules Section */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold text-button-hover">5. SVIP Rules</h4>
                  <p className="text-sm text-muted-foreground mt-1">Tier VIP khusus dengan perlakuan ekstra</p>
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="ex: Diamond VIP, Platinum"
                    value={newTierName}
                    onChange={(e) => setNewTierName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSVIPRule())}
                    className="flex-1"
                  />
                  <Button type="button" onClick={addSVIPRule} variant="outline" className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover shrink-0">
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah Tier
                  </Button>
                </div>

                {svipRules.length > 0 ? (
                  <div className="space-y-4">
                    {svipRules.map((rule, index) => (
                      <Card key={index} className="p-6 bg-muted/30">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Crown className="h-5 w-5 text-button-hover" />
                            <span className="font-medium">{rule.tier_name}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/20"
                            onClick={() => removeSVIPRule(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">
                              Threshold (Rp {formatNumber(rule.threshold)})
                            </label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder="50.000.000"
                              value={formatNumber(rule.threshold)}
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (/^[\d.]*$/.test(raw)) {
                                  const updated = [...svipRules];
                                  updated[index].threshold = parseNumber(raw);
                                  form.setValue("V.svip_rules", updated);
                                }
                              }}
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">Perbedaan Utama</label>
                            <Textarea
                              placeholder="ex: Respon maksimal 1 menit, panggil Kak + nama..."
                              value={rule.notes}
                              onChange={(e) => {
                                const updated = [...svipRules];
                                updated[index].notes = e.target.value;
                                form.setValue("V.svip_rules", updated);
                              }}
                              className="min-h-[80px]"
                            />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-sm text-muted-foreground/60 border border-muted-foreground/30 rounded-lg border-dashed">
                    Belum ada SVIP tier. Tambahkan tier di atas.
                  </div>
                )}
              </div>
            </>
          )}
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