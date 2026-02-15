import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Save, Settings, Timer } from "lucide-react";
import { toast } from "sonner";

interface APIDataSectionProps {
  form: UseFormReturn<any>;
  onSave: () => void;
}

export function APIDataSection({ form, onSave }: APIDataSectionProps) {
  const handleSave = () => {
    onSave();
    // Persist debounce to localStorage for Test Console to read
    const debounceVal = form.getValues("apiData.debounceSeconds") || 3;
    localStorage.setItem("voc_debounce_seconds", String(debounceVal));
    toast.success("API & Settings saved!");
  };

  const debounceValue = form.watch("apiData.debounceSeconds") ?? 3;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* API Keys Card */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="h-6 w-6 text-button-hover" />
          <div>
            <h3 className="text-lg font-semibold text-button-hover">API Keys</h3>
            <p className="text-sm text-muted-foreground">
              Kelola API keys untuk integrasi
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <FormField
            control={form.control}
            name="apiData.supabaseApi"
            render={({ field }) => (
              <FormItem>
                <FormLabel>API Supabase</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Masukkan API key Supabase"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  API key untuk koneksi ke Supabase database
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="apiData.chatGptApi"
            render={({ field }) => (
              <FormItem>
                <FormLabel>API ChatGPT</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Masukkan API key ChatGPT"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  API key untuk integrasi OpenAI ChatGPT
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </Card>

      {/* Debounce Settings Card */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Timer className="h-6 w-6 text-button-hover" />
          <div>
            <h3 className="text-lg font-semibold text-button-hover">Chat Debounce</h3>
            <p className="text-sm text-muted-foreground">
              Waktu tunggu sebelum pesan berturut-turut digabung dan dikirim ke AI
            </p>
          </div>
        </div>

        <FormField
          control={form.control}
          name="apiData.debounceSeconds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Debounce Timer</FormLabel>
              <FormControl>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Slider
                      min={1}
                      max={15}
                      step={1}
                      value={[field.value ?? 3]}
                      onValueChange={(vals) => field.onChange(vals[0])}
                      className="flex-1"
                    />
                    <span className="text-2xl font-bold text-button-hover tabular-nums min-w-[3ch] text-right">
                      {field.value ?? 3}s
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1 detik</span>
                    <span>15 detik</span>
                  </div>
                </div>
              </FormControl>
              <FormDescription className="mt-3">
                Jika user kirim 3 pesan dalam <strong>{debounceValue} detik</strong>, akan digabung jadi 1 request ke AI.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="mt-4 p-3 rounded-md bg-muted/50 border border-border">
          <p className="text-xs text-muted-foreground">
            <strong>Contoh:</strong> User kirim "kak," → tunggu {debounceValue}s → kirim "ada promo?" → timer reset → tunggu {debounceValue}s lagi → tidak ada pesan baru → semua digabung jadi 1 API call.
          </p>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" onClick={handleSave} className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
          <Save className="h-4 w-4 mr-2" />
          Save API & Settings
        </Button>
      </div>
    </div>
  );
}
