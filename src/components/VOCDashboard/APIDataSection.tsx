import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Save, Settings } from "lucide-react";
import { toast } from "sonner";

interface APIDataSectionProps {
  form: UseFormReturn<any>;
  onSave: () => void;
}

export function APIDataSection({ form, onSave }: APIDataSectionProps) {
  const handleSave = () => {
    onSave();
    toast.success("API Data saved!");
  };

  return (
    <div className="max-w-7xl mx-auto">
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="h-6 w-6 text-button-hover" />
          <div>
            <h3 className="text-lg font-semibold text-button-hover">API Data</h3>
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

        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={handleSave} className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
            <Save className="h-4 w-4 mr-2" />
            Save API Data
          </Button>
        </div>
      </Card>
    </div>
  );
}
