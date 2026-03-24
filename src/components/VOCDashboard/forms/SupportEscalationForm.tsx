import { UseFormReturn } from "react-hook-form";
import { VOCConfig } from "@/types/voc-config";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Save } from "lucide-react";
import { toast } from "@/lib/notify";

interface SupportEscalationFormProps {
  form: UseFormReturn<VOCConfig>;
  onSave: () => void;
}

export function SupportEscalationForm({ form, onSave }: SupportEscalationFormProps) {
  const escalationOptions = [
    { id: "angry8", label: "Jika marah level 8+" },
    { id: "wd10min", label: "Jika WD pending > 10 menit" },
    { id: "accountLock", label: "Jika akun lock" },
  ];

  const handleSave = () => {
    onSave();
    toast.success("Support Escalation saved!");
  };

  return (
    <div className="max-w-7xl mx-auto">
      <Card className="p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-button-hover mb-2">Support & Escalation</h3>
          <p className="text-sm text-muted-foreground">
            Menentukan SOP bantuan & eskalasi ke manusia
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="supportEscalation.adminContactMethod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Admin/PIC Contact Method *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="telegram">Telegram</SelectItem>
                    <SelectItem value="discord">Discord</SelectItem>
                    <SelectItem value="livechat">Live Chat Internal</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Metode kontak admin</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="supportEscalation.adminContact"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Admin Contact *</FormLabel>
                <FormControl>
                  <Input placeholder="ex: +6281234567890" {...field} />
                </FormControl>
                <FormDescription>Nomor/ID kontak admin</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="supportEscalation.picActiveHours"
            render={({ field }) => (
              <FormItem>
                <FormLabel>PIC Active Hours *</FormLabel>
                <FormControl>
                  <Input placeholder="ex: 08:00 - 22:00 WIB" {...field} />
                </FormControl>
                <FormDescription>Jam aktif PIC/admin</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="supportEscalation.sopStyle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SOP Style *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select SOP style" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="strict">Strict (ikuti prosedur ketat)</SelectItem>
                    <SelectItem value="flexible">Flexible (bisa improvisasi)</SelectItem>
                    <SelectItem value="adaptive">Adaptive (sesuai situasi)</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Gaya SOP yang diterapkan</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="supportEscalation.escalationThreshold"
            render={() => (
              <FormItem className="col-span-2">
                <FormLabel>Escalation Threshold *</FormLabel>
                <div className="space-y-2">
                  {escalationOptions.map((option) => (
                    <FormField
                      key={option.id}
                      control={form.control}
                      name="supportEscalation.escalationThreshold"
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
                <FormDescription>Kondisi yang memicu eskalasi ke admin</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="supportEscalation.defaultEscalationMessage"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Default Escalation Message *</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Pesan yang dikirim saat eskalasi..."
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormDescription>Template pesan saat eskalasi ke admin</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={handleSave} className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
            <Save className="h-4 w-4 mr-2" />
            Save Support Settings
          </Button>
        </div>
      </Card>
    </div>
  );
}
