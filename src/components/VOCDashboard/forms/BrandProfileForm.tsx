import { UseFormReturn } from "react-hook-form";
import { VOCConfig } from "@/types/voc-config";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Save } from "lucide-react";
import { toast } from "@/lib/notify";

interface BrandProfileFormProps {
  form: UseFormReturn<VOCConfig>;
  onSave: () => void;
}

export function BrandProfileForm({ form, onSave }: BrandProfileFormProps) {
  const handleSave = () => {
    onSave();
    toast.success("Brand Profile saved!");
  };

  return (
    <div className="max-w-7xl mx-auto">
      <Card className="p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-button-hover mb-2">Brand Persona</h3>
          <p className="text-sm text-muted-foreground">
            Menentukan Persona Agent AI
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="brandProfile.brandName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Brand Name *</FormLabel>
                <FormControl>
                  <Input placeholder="ex: ACG77" {...field} />
                </FormControl>
                <FormDescription>Nama brand lengkap</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="brandProfile.shortName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Short Name / Nickname *</FormLabel>
                <FormControl>
                  <Input placeholder="ex: ACG" {...field} />
                </FormControl>
                <FormDescription>Nama singkat brand</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="brandProfile.slogan"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slogan / Tagline *</FormLabel>
                <FormControl>
                  <Input placeholder="ex: Your Lucky Game" {...field} />
                </FormControl>
                <FormDescription>Slogan atau tagline brand</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="brandProfile.agentName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Agent Name *</FormLabel>
                <FormControl>
                  <Input placeholder="ex: Danila" {...field} />
                </FormControl>
                <FormDescription>Nama AI agent</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="brandProfile.agentGender"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Agent Gender *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="female">Perempuan</SelectItem>
                    <SelectItem value="male">Laki-laki</SelectItem>
                    <SelectItem value="neutral">Netral</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Jenis kelamin AI agent</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="brandProfile.toneStyle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tone Style *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="friendly">Friendly & Casual</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="playful">Playful & Fun</SelectItem>
                    <SelectItem value="caring">Caring & Supportive</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Gaya bicara AI</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="brandProfile.defaultCallToPlayer"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Call-to-Player *</FormLabel>
                <FormControl>
                  <Input placeholder="ex: Kak, Boss, Bro" {...field} />
                </FormControl>
                <FormDescription>Sapaan default untuk player</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="brandProfile.emojiPreference"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Emoji Preference *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select emoji style" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="minimal">Minimal (1-2 per pesan)</SelectItem>
                    <SelectItem value="moderate">Sedang (3-4 per pesan)</SelectItem>
                    <SelectItem value="expressive">Ekspresif (5+ per pesan)</SelectItem>
                    <SelectItem value="none">Tidak ada emoji</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Preferensi penggunaan emoji</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={handleSave} className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
            <Save className="h-4 w-4 mr-2" />
            Save Brand Profile
          </Button>
        </div>
      </Card>
    </div>
  );
}
