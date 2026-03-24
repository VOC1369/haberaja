import { UseFormReturn } from "react-hook-form";
import { VOCConfig } from "@/types/voc-config";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Save } from "lucide-react";
import { toast } from "@/lib/notify";

interface PlayerBehaviourFormProps {
  form: UseFormReturn<VOCConfig>;
  onSave: () => void;
}

export function PlayerBehaviourForm({ form, onSave }: PlayerBehaviourFormProps) {
  const silentSniperOptions = [
    { id: "formal", label: "Formal dingin" },
    { id: "fake-empathy", label: "Empati palsu" },
    { id: "delay", label: "Delay 3–5 menit" },
    { id: "redirect", label: "Redirect ke admin" },
  ];

  const vipToneOptions = [
    { id: "warm", label: "Lebih hangat" },
    { id: "caring", label: "Lebih manja" },
    { id: "quick", label: "Lebih cepat" },
    { id: "respectful", label: "Lebih hormat" },
  ];

  const handleSave = () => {
    onSave();
    toast.success("Player Behaviour settings saved!");
  };

  return (
    <div className="max-w-7xl mx-auto">
      <Card className="p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-button-hover mb-2">Player Behaviour Controls</h3>
          <p className="text-sm text-muted-foreground">
            Menentukan bagaimana Danila memperlakukan tipe pemain (VIP, normal, marah, hunter)
          </p>
        </div>

        <div className="space-y-6">
          <FormField
            control={form.control}
            name="playerBehaviour.personalizationLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Personalization Level (1-10) *</FormLabel>
                <FormControl>
                  <div className="space-y-4">
                    <Slider
                      min={1}
                      max={10}
                      step={1}
                      value={[field.value || 5]}
                      onValueChange={(vals) => field.onChange(vals[0])}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Generic</span>
                      <span className="font-medium text-button-hover">{field.value || 5}</span>
                      <span>Sangat Personal</span>
                    </div>
                  </div>
                </FormControl>
                <FormDescription>Seberapa personal respons AI</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="playerBehaviour.sentimentalMemory"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg bg-muted p-4">
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

          <FormField
            control={form.control}
            name="playerBehaviour.antiHunterAggressiveness"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Anti-Hunter Aggressiveness (1-10) *</FormLabel>
                <FormControl>
                  <div className="space-y-4">
                    <Slider
                      min={1}
                      max={10}
                      step={1}
                      value={[field.value || 5]}
                      onValueChange={(vals) => field.onChange(vals[0])}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Toleran</span>
                      <span className="font-medium text-button-hover">{field.value || 5}</span>
                      <span>Sangat Ketat</span>
                    </div>
                  </div>
                </FormControl>
                <FormDescription>Seberapa ketat menghadapi bonus hunter</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="playerBehaviour.silentSniperStyle"
            render={() => (
              <FormItem>
                <FormLabel>Silent Sniper Style *</FormLabel>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {silentSniperOptions.map((option) => (
                    <FormField
                      key={option.id}
                      control={form.control}
                      name="playerBehaviour.silentSniperStyle"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(option.id)}
                              onCheckedChange={(checked) => {
                                const current = field.value || [];
                                if (checked) {
                                  field.onChange([...current, option.id]);
                                } else {
                                  field.onChange(current.filter((v: string) => v !== option.id));
                                }
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">{option.label}</FormLabel>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
                <FormDescription>Gaya menghadapi silent sniper</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="playerBehaviour.vipThreshold"
            render={({ field }) => (
              <FormItem>
                <FormLabel>VIP Threshold *</FormLabel>
                <FormControl>
                  <Input placeholder="ex: deposit >= 10jt / turnover >= 50jt" {...field} />
                </FormControl>
                <FormDescription>Kriteria untuk dianggap VIP</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="playerBehaviour.vipTone"
            render={() => (
              <FormItem>
                <FormLabel>VIP Tone *</FormLabel>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {vipToneOptions.map((option) => (
                    <FormField
                      key={option.id}
                      control={form.control}
                      name="playerBehaviour.vipTone"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(option.id)}
                              onCheckedChange={(checked) => {
                                const current = field.value || [];
                                if (checked) {
                                  field.onChange([...current, option.id]);
                                } else {
                                  field.onChange(current.filter((v: string) => v !== option.id));
                                }
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">{option.label}</FormLabel>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
                <FormDescription>Cara memperlakukan VIP</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={handleSave} className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
            <Save className="h-4 w-4 mr-2" />
            Save Behaviour Settings
          </Button>
        </div>
      </Card>
    </div>
  );
}
