import { UseFormReturn } from "react-hook-form";
import { VOCConfig } from "@/types/voc-config";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Save } from "lucide-react";
import { toast } from "@/lib/notify";

interface SafetyCrisisFormProps {
  form: UseFormReturn<VOCConfig>;
  onSave: () => void;
}

export function SafetyCrisisForm({ form, onSave }: SafetyCrisisFormProps) {
  const bonusAllowed = form.watch("safetyCrisis.bonusPreventifAllowed");

  const handleSave = () => {
    onSave();
    toast.success("Safety & Crisis settings saved!");
  };

  return (
    <div className="max-w-7xl mx-auto">
      <Card className="p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-button-hover mb-2">Safety & Crisis Settings</h3>
          <p className="text-sm text-muted-foreground">
            Mengatur batas aman Danila & cara merespons masalah sensitif
          </p>
        </div>

        <div className="space-y-6">
          <FormField
            control={form.control}
            name="safetyCrisis.crisisToneStyle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Crisis Tone Style *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select crisis tone" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="calm">Tenang & Menenangkan</SelectItem>
                    <SelectItem value="apologetic">Apologetic (banyak minta maaf)</SelectItem>
                    <SelectItem value="solution">Solution-focused</SelectItem>
                    <SelectItem value="empathetic">Empathetic (sangat empati)</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Gaya bicara saat krisis</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="safetyCrisis.bonusPreventifAllowed"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg bg-muted p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-button-hover">Bonus Preventif Allowed</FormLabel>
                    <FormDescription>
                      Izinkan AI menawarkan bonus untuk mencegah churn
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

            {bonusAllowed && (
              <FormField
                control={form.control}
                name="safetyCrisis.bonusPreventifLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bonus Preventif Limit</FormLabel>
                    <FormControl>
                      <Input placeholder="ex: 50000" {...field} />
                    </FormControl>
                    <FormDescription>Batas maksimal bonus yang bisa ditawarkan</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

          <FormField
            control={form.control}
            name="safetyCrisis.riskAppetite"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Risk Appetite (1-100) *</FormLabel>
                <FormControl>
                  <div className="space-y-4">
                    <Slider
                      min={1}
                      max={100}
                      step={1}
                      value={[field.value || 50]}
                      onValueChange={(vals) => field.onChange(vals[0])}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Very Conservative</span>
                      <span className="font-medium text-button-hover">{field.value || 50}%</span>
                      <span>Very Aggressive</span>
                    </div>
                  </div>
                </FormControl>
                <FormDescription>Seberapa berani AI dalam mengambil keputusan</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="safetyCrisis.forbiddenPhrases"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Forbidden Phrases *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Kata/frasa yang dilarang, pisahkan dengan koma..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Kata/frasa yang tidak boleh diucapkan AI</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="safetyCrisis.allowedSensitiveTerms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Allowed Sensitive Terms *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Istilah sensitif yang diizinkan..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Istilah sensitif yang boleh digunakan</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="safetyCrisis.crisisResponseTemplate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Crisis Response Template *</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Template respons saat krisis..."
                    className="min-h-[120px]"
                    {...field}
                  />
                </FormControl>
                <FormDescription>Template pesan untuk situasi krisis</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={handleSave} className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
            <Save className="h-4 w-4 mr-2" />
            Save Safety Settings
          </Button>
        </div>
      </Card>
    </div>
  );
}