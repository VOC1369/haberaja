import { UseFormReturn } from "react-hook-form";
import { VOCConfig } from "@/types/voc-config";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Save } from "lucide-react";
import { toast } from "sonner";

interface CommunicationStyleFormProps {
  form: UseFormReturn<VOCConfig>;
  onSave: () => void;
}

export function CommunicationStyleForm({ form, onSave }: CommunicationStyleFormProps) {
  const handleSave = () => {
    onSave();
    toast.success("Communication Style saved!");
  };

  return (
    <div className="max-w-7xl mx-auto">
      <Card className="p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-button-hover mb-2">Communication Style</h3>
          <p className="text-sm text-muted-foreground">
            Mengatur gaya bicara Danila berdasarkan kepribadian brand
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="communicationStyle.formalityLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Formality Level (1-10) *</FormLabel>
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
                      <span>Sangat Casual</span>
                      <span className="font-medium text-button-hover">{field.value || 5}</span>
                      <span>Sangat Formal</span>
                    </div>
                  </div>
                </FormControl>
                <FormDescription>1 = sangat santai, 10 = sangat formal</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="communicationStyle.warmthLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Warmth Level (1-10) *</FormLabel>
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
                      <span>Dingin</span>
                      <span className="font-medium text-button-hover">{field.value || 5}</span>
                      <span>Sangat Hangat</span>
                    </div>
                  </div>
                </FormControl>
                <FormDescription>1 = dingin/profesional, 10 = sangat hangat/akrab</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="communicationStyle.humorUsage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Humor Usage *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select humor level" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Tidak ada humor</SelectItem>
                    <SelectItem value="subtle">Subtle (jarang)</SelectItem>
                    <SelectItem value="moderate">Sedang</SelectItem>
                    <SelectItem value="frequent">Sering</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Seberapa sering menggunakan humor</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="communicationStyle.emojiStyle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Emoji Style *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select emoji style" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="classic">Classic (😊🙏👍)</SelectItem>
                    <SelectItem value="cute">Cute (🥺💕✨)</SelectItem>
                    <SelectItem value="professional">Professional (✓📋📊)</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Gaya emoji yang digunakan</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={handleSave} className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
            <Save className="h-4 w-4 mr-2" />
            Save Communication Style
          </Button>
        </div>
      </Card>
    </div>
  );
}
