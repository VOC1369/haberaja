import { UseFormReturn } from "react-hook-form";
import { APBEConfig, ContactMethod, SOPStyle } from "@/types/apbe-config";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Settings, Plus, Trash2, Save, Sparkles, Loader2 } from "lucide-react";
import { generateEscalationMessage } from "@/lib/apbe-interaction-generator";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface OperationalSOPFormProps {
  form: UseFormReturn<APBEConfig>;
  isEditingFromSummary?: boolean;
  onSaveAndReturn?: () => void;
}

// Only WhatsApp and Telegram
const contactMethodOptions: { value: ContactMethod; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
];

// Country codes for WhatsApp
const countryCodeOptions = [
  { value: "+62", label: "+62 (Indonesia)" },
  { value: "+60", label: "+60 (Malaysia)" },
  { value: "+65", label: "+65 (Singapore)" },
  { value: "+66", label: "+66 (Thailand)" },
  { value: "+855", label: "+855 (Cambodia)" },
];

// Time options for picker (00:00 - 23:00)
const timeOptions = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, "0");
  return { value: `${hour}:00`, label: `${hour}:00` };
});

const sopStyleOptions: { value: SOPStyle; label: string; description: string }[] = [
  { value: "strict", label: "Strict", description: "Ikuti prosedur ketat" },
  { value: "flexible", label: "Flexible", description: "Bisa improvisasi" },
  { value: "adaptive", label: "Adaptive", description: "Sesuai situasi" },
];


const escalationTriggerOptions = [
  { id: "angry_level_8", label: "Jika player marah level 8+" },
  { id: "wd_pending_10min", label: "Jika WD pending > 10 menit" },
  { id: "account_locked", label: "Jika akun terkunci" },
  { id: "fraud_detected", label: "Jika terdeteksi fraud" },
  { id: "vip_complaint", label: "Jika VIP komplain" },
  { id: "repeated_issue", label: "Jika masalah berulang 3x" },
];


export function OperationalSOPForm({ form, isEditingFromSummary, onSaveAndReturn }: OperationalSOPFormProps) {
  // Local state for adaptive contact fields
  const [countryCode, setCountryCode] = useState("+62");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("22:00");
  const [phoneError, setPhoneError] = useState("");
  const [telegramError, setTelegramError] = useState("");
  const [timeError, setTimeError] = useState("");
  const [newCustomTrigger, setNewCustomTrigger] = useState("");
  const [customTriggerError, setCustomTriggerError] = useState("");

  const contactMethod = form.watch("O.admin_contact.method");

  // Parse existing value on mount
  useEffect(() => {
    const currentValue = form.getValues("O.admin_contact.value") || "";
    const currentHours = form.getValues("O.admin_contact.active_hours") || "";

    // Parse WhatsApp number
    if (contactMethod === "whatsapp" && currentValue) {
      const matchedCode = countryCodeOptions.find(c => currentValue.startsWith(c.value));
      if (matchedCode) {
        setCountryCode(matchedCode.value);
        setPhoneNumber(currentValue.replace(matchedCode.value, "").trim());
      }
    }

    // Parse Telegram username
    if (contactMethod === "telegram" && currentValue) {
      setTelegramUsername(currentValue);
    }

    // Parse active hours (format: "HH:MM - HH:MM WIB")
    if (currentHours) {
      const hourMatch = currentHours.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
      if (hourMatch) {
        setStartTime(hourMatch[1]);
        setEndTime(hourMatch[2]);
      }
    }
  }, [contactMethod]);

  // Validate and update WhatsApp number
  const handlePhoneChange = (value: string) => {
    // Only allow digits
    const digitsOnly = value.replace(/\D/g, "");
    setPhoneNumber(digitsOnly);

    // Validation
    if (digitsOnly.length > 0 && digitsOnly.startsWith("0")) {
      setPhoneError("Jangan awali dengan angka 0");
    } else if (digitsOnly.length > 0 && digitsOnly.length < 8) {
      setPhoneError("Minimal 8 digit");
    } else {
      setPhoneError("");
    }

    // Update form value
    if (digitsOnly && !digitsOnly.startsWith("0") && digitsOnly.length >= 8) {
      form.setValue("O.admin_contact.value", `${countryCode} ${digitsOnly}`);
    }
  };

  // Update form when country code changes
  const handleCountryCodeChange = (code: string) => {
    setCountryCode(code);
    if (phoneNumber && !phoneNumber.startsWith("0") && phoneNumber.length >= 8) {
      form.setValue("O.admin_contact.value", `${code} ${phoneNumber}`);
    }
  };

  // Validate and update Telegram username
  const handleTelegramChange = (value: string) => {
    setTelegramUsername(value);

    // Validation
    if (value && !value.startsWith("@")) {
      setTelegramError("Harus diawali dengan @");
    } else if (value && /^@\d+$/.test(value)) {
      setTelegramError("Tidak boleh hanya angka");
    } else if (value && !/^@[a-zA-Z0-9_]+$/.test(value)) {
      setTelegramError("Hanya huruf, angka, dan underscore");
    } else {
      setTelegramError("");
      form.setValue("O.admin_contact.value", value);
    }
  };

  // Update active hours - supports overnight shifts (e.g., 21:00 - 08:00)
  const handleTimeChange = (type: "start" | "end", value: string) => {
    const newStart = type === "start" ? value : startTime;
    const newEnd = type === "end" ? value : endTime;

    if (type === "start") setStartTime(value);
    if (type === "end") setEndTime(value);

    // Check if it's overnight shift (end time is less than start time)
    const isOvernightShift = newEnd < newStart;
    
    // Validate: start and end cannot be the same
    if (newStart === newEnd) {
      setTimeError("Jam Mulai dan Jam Berakhir tidak boleh sama");
    } else {
      setTimeError("");
      // Format output with indicator for overnight shift
      const suffix = isOvernightShift ? "+1" : "";
      form.setValue("O.admin_contact.active_hours", `${newStart} - ${newEnd}${suffix} WIB`);
    }
  };

  const escalationTriggers = form.watch("O.escalation.threshold_triggers") || [];
  
  // Separate preset and custom triggers
  const presetTriggerIds = escalationTriggerOptions.map(opt => opt.id);
  const customTriggers = escalationTriggers.filter(t => t.startsWith("custom:"));

  // Add custom trigger
  const addCustomTrigger = () => {
    const trimmed = newCustomTrigger.trim();
    if (!trimmed) {
      setCustomTriggerError("Trigger tidak boleh kosong");
      return;
    }
    if (trimmed.length < 5) {
      setCustomTriggerError("Minimal 5 karakter");
      return;
    }
    const customId = `custom:${trimmed.toLowerCase().replace(/\s+/g, "_")}`;
    if (escalationTriggers.includes(customId)) {
      setCustomTriggerError("Trigger sudah ada");
      return;
    }
    form.setValue("O.escalation.threshold_triggers", [...escalationTriggers, customId]);
    setNewCustomTrigger("");
    setCustomTriggerError("");
    toast.success("Custom trigger ditambahkan!");
  };

  // Remove custom trigger
  const removeCustomTrigger = (triggerId: string) => {
    form.setValue(
      "O.escalation.threshold_triggers",
      escalationTriggers.filter(t => t !== triggerId)
    );
    toast.success("Custom trigger dihapus");
  };

  // Get display label for custom trigger
  const getCustomTriggerLabel = (triggerId: string) => {
    return triggerId.replace("custom:", "").replace(/_/g, " ");
  };

  const handleSaveSection = () => {
    toast.success("Operational SOP saved!");
    if (onSaveAndReturn) {
      onSaveAndReturn();
    }
  };


  return (
    <div className="page-wrapper">
      <Card className="form-card">
        <div className="form-card-header">
          <div className="icon-circle">
            <Settings className="icon-circle-icon" />
          </div>
          <div>
            <h3 className="form-card-title">Operational SOP</h3>
            <p className="form-card-description">
              Pengaturan standar operasional dan eskalasi
            </p>
          </div>
        </div>

        <div className="form-section space-y-6">
          {/* Admin Contact Section */}
          <div className="space-y-6">
            <h4 className="text-lg font-semibold text-button-hover">1. Kontak Admin</h4>
            
            {/* Method Selection */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="O.admin_contact.method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Metode Kontak *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih metode" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contactMethodOptions.map((option) => (
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

              {/* WhatsApp Fields */}
              {contactMethod === "whatsapp" && (
                <>
                  <FormItem>
                    <FormLabel>Kode Negara *</FormLabel>
                    <Select onValueChange={handleCountryCodeChange} value={countryCode}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih kode" />
                      </SelectTrigger>
                      <SelectContent>
                        {countryCodeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>

                  <FormItem>
                    <FormLabel>Nomor WhatsApp *</FormLabel>
                    <Input
                      placeholder="ex: 81234567890"
                      value={phoneNumber}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                    />
                    {phoneError && (
                      <p className="text-sm text-destructive">{phoneError}</p>
                    )}
                  </FormItem>
                </>
              )}

              {/* Telegram Field */}
              {contactMethod === "telegram" && (
                <FormItem className="md:col-span-2">
                  <FormLabel>Username Telegram *</FormLabel>
                  <Input
                    placeholder="ex: @VOCAdmin"
                    value={telegramUsername}
                    onChange={(e) => handleTelegramChange(e.target.value)}
                  />
                  {telegramError && (
                    <p className="text-sm text-destructive">{telegramError}</p>
                  )}
                </FormItem>
              )}
            </div>

            {/* Active Hours - Time Picker Range */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormItem>
                <FormLabel>Jam Mulai *</FormLabel>
                <Select onValueChange={(v) => handleTimeChange("start", v)} value={startTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jam mulai" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>

              <FormItem>
                <FormLabel>Jam Berakhir *</FormLabel>
                <Select onValueChange={(v) => handleTimeChange("end", v)} value={endTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jam berakhir" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {timeError && (
                  <p className="text-sm text-destructive">{timeError}</p>
                )}
              </FormItem>

              <FormItem className="flex items-end">
                <div className="h-10 flex items-center text-sm text-muted-foreground">
                  Output: {startTime} - {endTime}{endTime < startTime ? " (+1 hari)" : ""} WIB
                </div>
              </FormItem>
            </div>

            <FormField
              control={form.control}
              name="O.admin_contact.backup_contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kontak Cadangan</FormLabel>
                  <FormControl>
                    <Input placeholder="ex: +6289876543210 atau @VOCBackup" {...field} />
                  </FormControl>
                  <FormDescription>Kontak alternatif jika admin utama tidak tersedia</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Escalation to Human Agent Section */}
          <div className="space-y-6">
            <h4 className="text-lg font-semibold text-button-hover">2. Eskalasi Ke Human Agent</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="O.escalation.sop_style"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gaya SOP *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih gaya SOP" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sopStyleOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <span className="font-medium">{option.label}</span>
                            <span className="text-muted-foreground ml-2">— {option.description}</span>
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
                name="O.escalation.max_ai_attempts"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max AI Attempts: {field.value || 3}</FormLabel>
                    <FormControl>
                      <Slider
                        min={1}
                        max={10}
                        step={1}
                        value={[field.value || 3]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                        className="w-full mt-4"
                      />
                    </FormControl>
                    <FormDescription>Berapa kali AI mencoba sebelum eskalasi</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="O.escalation.auto_escalate"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg bg-muted p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-button-hover">Auto Escalate</FormLabel>
                    <FormDescription>
                      Otomatis eskalasi jika trigger terpenuhi
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
              name="O.escalation.threshold_triggers"
              render={() => (
                <FormItem className="space-y-2">
                  <FormLabel>Trigger Eskalasi</FormLabel>
                  
                  <div className="space-y-4">
                    {/* Preset Triggers */}
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {escalationTriggerOptions.map((option) => (
                          <FormItem key={option.id} className="flex items-center space-x-2">
                            <FormControl>
                              <Checkbox
                                checked={escalationTriggers.includes(option.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    form.setValue("O.escalation.threshold_triggers", [...escalationTriggers, option.id]);
                                  } else {
                                    form.setValue("O.escalation.threshold_triggers", escalationTriggers.filter((t) => t !== option.id));
                                  }
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">{option.label}</FormLabel>
                          </FormItem>
                        ))}
                      </div>
                    </div>

                    {/* Custom Triggers */}
                    <div className="space-y-2 pt-2">
                      <p className="text-sm text-muted-foreground font-medium">Custom Triggers</p>
                      
                      {customTriggers.length > 0 && (
                        <div className="space-y-4 mb-2">
                          {customTriggers.map((triggerId) => (
                            <div key={triggerId} className="flex items-center justify-between p-4 bg-muted rounded-lg border border-border">
                              <div className="flex items-center gap-3">
                                <Checkbox checked disabled className="opacity-70" />
                                <span className="text-sm capitalize">{getCustomTriggerLabel(triggerId)}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-button-hover/20 text-button-hover">Custom</span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => removeCustomTrigger(triggerId)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Custom Trigger */}
                      <div className="flex gap-4">
                        <Input
                          placeholder="Jika [kondisi custom]..."
                          value={newCustomTrigger}
                          onChange={(e) => {
                            setNewCustomTrigger(e.target.value);
                            setCustomTriggerError("");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addCustomTrigger();
                            }
                          }}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={addCustomTrigger}
                          className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Tambah
                        </Button>
                      </div>
                      
                      {customTriggerError && (
                        <p className="text-sm text-destructive">{customTriggerError}</p>
                      )}
                    </div>
                  </div>
                  
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="O.escalation.default_message"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Pesan Eskalasi Default</FormLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const currentConfig = form.getValues();
                        const generatedMessage = generateEscalationMessage(currentConfig);
                        form.setValue('O.escalation.default_message', generatedMessage);
                        toast.success("Pesan eskalasi berhasil di-generate!");
                      }}
                      className="h-7 px-3 bg-muted text-muted-foreground hover:bg-button-hover hover:text-button-hover-foreground"
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      Generate
                    </Button>
                  </div>
                  <FormControl>
                    <Textarea
                      placeholder="Mohon maaf Kak, saya akan hubungkan dengan tim kami yang lebih berpengalaman..."
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