import { UseFormReturn } from "react-hook-form";
import { APBEConfig, CrisisTone, HunterResponseStyle } from "@/types/apbe-config";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ShieldAlert, Plus, X, Save, Sparkles, AlertTriangle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

// Anti-Hunter response style options
const responseStyleOptions: { value: HunterResponseStyle; label: string }[] = [
  { value: "formal_cold", label: "Formal Dingin" },
  { value: "firm_polite", label: "Tegas Tapi Sopan" },
  { value: "redirect_admin", label: "Redirect ke Admin" },
];

// Preset pattern templates for common hunter types
const presetPatternTemplates: { category: string; patterns: string[] }[] = [
  { category: "Spam", patterns: ["Pesan Berulang >5x Dalam 1 Menit", "Copy-Paste Pesan Sama", "Flood Chat Dengan Karakter Random"] },
  { category: "Multi-Akun", patterns: ["IP Sama Dengan Akun Lain", "Device Fingerprint Duplikat", "Pola Deposit Identik Antar Akun"] },
  { category: "Promo Abuse", patterns: ["Klaim Promo Berulang Dengan Data Berbeda", "Pola Betting Abnormal Setelah Bonus", "Withdraw Langsung Setelah Klaim Promo"] },
  { category: "Freebet Hunter", patterns: ["Minta Freechip Berkali-Kali", "Ancam Pindah Jika Tidak Dikasih Bonus", "Bandingkan Dengan Kompetitor Untuk Minta Promo"] },
  { category: "Refund Abuse", patterns: ["Klaim Refund Berlebihan", "Manipulasi Bukti Transaksi", "Komplain Palsu Untuk Dapatkan Kompensasi"] },
];

// Crisis Template Mapping: tone → template type → content
// Using {{A.call_to_player}} variable directly - no conversion needed
const crisisTemplateMapping: Record<CrisisTone, Record<string, string>> = {
  calm: {
    angry_player: "Kami sangat memahami perasaan {{A.call_to_player}}. Tenang dulu ya, kami pastikan akan membantu menyelesaikan masalah ini dengan baik. Mari kita cari solusi terbaik bersama-sama.",
    system_error: "Mohon maaf atas ketidaknyamanannya. Tim teknis kami sedang menangani masalah ini. {{A.call_to_player}} bisa tenang, sistem akan segera pulih dan kami akan update perkembangannya.",
    payment_issue: "Kami mengerti kekhawatiran {{A.call_to_player}} soal transaksi ini. Jangan khawatir, kami akan cek detail transaksi dan memastikan semuanya terproses dengan benar.",
    account_locked: "Akun {{A.call_to_player}} sedang dalam proses verifikasi untuk keamanan. Ini prosedur standar dan tidak perlu khawatir. Kami akan bantu {{A.call_to_player}} melewati proses ini dengan lancar.",
    fraud_detected: "Demi keamanan akun {{A.call_to_player}}, kami perlu melakukan verifikasi tambahan. Ini untuk melindungi {{A.call_to_player}}. Prosesnya tidak lama dan kami akan dampingi.",
  },
  apologetic: {
    angry_player: "Mohon maaf yang sebesar-besarnya atas pengalaman yang tidak menyenangkan ini. Kami benar-benar menyesal dan akan segera memperbaiki situasi ini untuk {{A.call_to_player}}.",
    system_error: "Kami mohon maaf atas gangguan teknis yang terjadi. Ini sepenuhnya kesalahan dari pihak kami. Tim kami sedang bekerja keras untuk memperbaikinya secepatnya.",
    payment_issue: "Mohon maaf, kami menyesal atas kendala transaksi yang {{A.call_to_player}} alami. Kami akan prioritaskan pengecekan ini dan memastikan hak {{A.call_to_player}} terpenuhi.",
    account_locked: "Kami mohon maaf atas ketidaknyamanan ini. Kami paham ini sangat mengganggu. Tim kami akan segera memproses verifikasi akun {{A.call_to_player}}.",
    fraud_detected: "Mohon maaf jika proses ini merepotkan. Kami harus melakukan ini demi keamanan {{A.call_to_player}}. Kami akan bantu proses verifikasi secepatnya.",
  },
  solution: {
    angry_player: "Terima kasih sudah menghubungi kami. Langkah pertama, bisa ceritakan detail masalahnya? Kami akan langsung carikan solusi yang paling tepat untuk {{A.call_to_player}}.",
    system_error: "Kami sudah identifikasi masalahnya. Sementara tim teknis memperbaiki, ini alternatif yang bisa {{A.call_to_player}} coba: [solusi sementara]. Estimasi perbaikan: [waktu].",
    payment_issue: "Untuk transaksi {{A.call_to_player}}, kami butuh ID transaksi dan bukti pembayaran. Setelah kami terima, proses pengecekan maksimal 1x24 jam dan {{A.call_to_player}} akan kami update hasilnya.",
    account_locked: "Untuk membuka akun {{A.call_to_player}}, kami butuh: 1) KTP, 2) Foto selfie dengan KTP. Setelah lengkap, proses verifikasi maksimal 2 jam.",
    fraud_detected: "Untuk verifikasi keamanan, silakan lengkapi: 1) Konfirmasi nomor HP, 2) Jawab pertanyaan keamanan, 3) Kirim dokumen pendukung. Setelah itu akun akan aktif kembali.",
  },
  empathetic: {
    angry_player: "Kami benar-benar memahami betapa frustrasinya situasi ini, {{A.call_to_player}}. Perasaan {{A.call_to_player}} sangat valid. Kami ada di sini untuk membantu dan memastikan {{A.call_to_player}} tidak mengalami ini lagi.",
    system_error: "Kami paham ini pasti sangat menyebalkan, apalagi kalau sedang butuh. Kami merasakan kefrustrasian {{A.call_to_player}} dan sedang berusaha keras memperbaikinya.",
    payment_issue: "Kami sangat mengerti kekhawatiran {{A.call_to_player}} soal uang ini. Siapapun pasti akan merasa sama. Kami akan perlakukan ini sebagai prioritas dan pastikan dana {{A.call_to_player}} aman.",
    account_locked: "Pasti sangat tidak nyaman tidak bisa akses akun. Kami paham betapa pentingnya ini buat {{A.call_to_player}}. Kami akan dampingi prosesnya sampai akun {{A.call_to_player}} aktif kembali.",
    fraud_detected: "Kami mengerti ini situasi yang mengkhawatirkan. Perasaan {{A.call_to_player}} sangat bisa kami pahami. Kami akan pastikan akun {{A.call_to_player}} tetap aman dan proses ini berjalan lancar.",
  },
};


type TemplateKey = "angry" | "system" | "payment" | "locked" | "fraud";

export function SafetyCrisisForm({ form, isEditingFromSummary, onSaveAndReturn }: SafetyCrisisFormProps) {
  const [newRedWord, setNewRedWord] = useState("");
  const [newYellowWord, setNewYellowWord] = useState("");
  
  // Toxic Severity words state
  const [newLevel1Word, setNewLevel1Word] = useState("");
  const [newLevel2Word, setNewLevel2Word] = useState("");
  const [newLevel3Word, setNewLevel3Word] = useState("");
  
  // Anti-Hunter state
  const [newRuleName, setNewRuleName] = useState("");
  const [newPattern, setNewPattern] = useState("");
  
  // Auto toggle states for each template (default ON)
  const [autoToggles, setAutoToggles] = useState<Record<TemplateKey, boolean>>({
    angry: true,
    system: true,
    payment: true,
    locked: true,
    fraud: true,
  });

  // Anti-Hunter state
  const antiHunterEnabled = form.watch("O.anti_hunter.enabled");
  const antiHunterRules = form.watch("O.anti_hunter.rules") || [];

  const addAntiHunterRule = () => {
    if (newRuleName.trim()) {
      const newRule = {
        name: newRuleName.trim(),
        patterns: [] as string[],
        response_style: "firm_polite" as HunterResponseStyle,
        allow_blacklist: false,
        auto_escalate: false,
      };
      form.setValue("O.anti_hunter.rules", [...antiHunterRules, newRule]);
      setNewRuleName("");
    }
  };

  const removeAntiHunterRule = (index: number) => {
    const updated = antiHunterRules.filter((_: any, i: number) => i !== index);
    form.setValue("O.anti_hunter.rules", updated);
  };

  const addPatternToRule = (ruleIndex: number, pattern: string) => {
    const trimmed = pattern.trim();
    if (!trimmed) return;
    const updated = [...antiHunterRules];
    const allPatterns = [
      ...(updated[ruleIndex].manualPatterns || []),
      ...(updated[ruleIndex].presetPatterns || [])
    ].map((p: string) => p.toLowerCase());
    if (allPatterns.includes(trimmed.toLowerCase())) {
      toast.error(`Pattern "${trimmed}" sudah ada di rule ini`);
      return;
    }
    updated[ruleIndex].manualPatterns = [...(updated[ruleIndex].manualPatterns || []), trimmed];
    // Keep patterns array synced for backward compatibility
    updated[ruleIndex].patterns = [
      ...(updated[ruleIndex].manualPatterns || []),
      ...(updated[ruleIndex].presetPatterns || [])
    ];
    form.setValue("O.anti_hunter.rules", updated);
  };

  const addPresetPatternToRule = (ruleIndex: number, pattern: string) => {
    const updated = [...antiHunterRules];
    const allPatterns = [
      ...(updated[ruleIndex].manualPatterns || []),
      ...(updated[ruleIndex].presetPatterns || [])
    ].map((p: string) => p.toLowerCase());
    if (allPatterns.includes(pattern.toLowerCase())) {
      toast.error(`Pattern "${pattern}" sudah ada di rule ini`);
      return;
    }
    updated[ruleIndex].presetPatterns = [...(updated[ruleIndex].presetPatterns || []), pattern];
    // Keep patterns array synced for backward compatibility
    updated[ruleIndex].patterns = [
      ...(updated[ruleIndex].manualPatterns || []),
      ...(updated[ruleIndex].presetPatterns || [])
    ];
    form.setValue("O.anti_hunter.rules", updated);
  };

  const removePatternFromRule = (ruleIndex: number, patternIndex: number, source: 'manual' | 'preset') => {
    const updated = [...antiHunterRules];
    if (source === 'manual') {
      updated[ruleIndex].manualPatterns = (updated[ruleIndex].manualPatterns || []).filter((_: string, i: number) => i !== patternIndex);
    } else {
      updated[ruleIndex].presetPatterns = (updated[ruleIndex].presetPatterns || []).filter((_: string, i: number) => i !== patternIndex);
    }
    // Keep patterns array synced
    updated[ruleIndex].patterns = [
      ...(updated[ruleIndex].manualPatterns || []),
      ...(updated[ruleIndex].presetPatterns || [])
    ];
    form.setValue("O.anti_hunter.rules", updated);
  };

  const dictionaryRed = form.watch("O.crisis.dictionary_red") || [];
  const dictionaryYellow = form.watch("O.crisis.dictionary_yellow") || [];
  const preventiveBonusAllowed = form.watch("O.risk.preventive_bonus_allowed");
  const crisisTone = form.watch("O.crisis.tone");
  
  // Toxic Severity levels
  const toxicSeverity = form.watch("O.crisis.toxic_severity");
  const level1Words = toxicSeverity?.level_1 || [];
  const level2Words = toxicSeverity?.level_2 || [];
  const level3Words = toxicSeverity?.level_3 || [];
  
  // Financial Speech feature removed - no longer watching B.financial fields

  // Template field mapping
  const templateFieldMap: Record<TemplateKey, keyof APBEConfig["O"]["crisis"]["templates"]> = {
    angry: "angry_player",
    system: "system_error",
    payment: "payment_issue",
    locked: "account_locked",
    fraud: "fraud_detected",
  };

  // Watch call_to_player for dynamic template generation
  const callToPlayer = form.watch("A.call_to_player") || "Kak";

  // Auto-update templates when tone changes and toggle is ON
  useEffect(() => {
    if (!crisisTone) return;
    
    Object.entries(autoToggles).forEach(([key, isAuto]) => {
      if (isAuto) {
        const templateKey = key as TemplateKey;
        const fieldName = templateFieldMap[templateKey];
        const rawTemplate = crisisTemplateMapping[crisisTone]?.[fieldName];
        if (rawTemplate) {
          // Use template directly - {{A.call_to_player}} will be replaced at runtime
          form.setValue(`O.crisis.templates.${fieldName}`, rawTemplate);
        }
      }
    });
  }, [crisisTone]);

  const handleToggleChange = (key: TemplateKey, checked: boolean) => {
    setAutoToggles(prev => ({ ...prev, [key]: checked }));
    
    // If turning ON, populate with current tone template
    if (checked && crisisTone) {
      const fieldName = templateFieldMap[key];
      const rawTemplate = crisisTemplateMapping[crisisTone]?.[fieldName];
      if (rawTemplate) {
        // Use template directly - {{A.call_to_player}} will be replaced at runtime
        form.setValue(`O.crisis.templates.${fieldName}`, rawTemplate);
      }
    }
  };
  
  

  const handleSaveSection = () => {
    toast.success("Safety & Crisis saved!");
    if (onSaveAndReturn) {
      onSaveAndReturn();
    }
  };

  const addRedWord = () => {
    if (!newRedWord.trim()) return;
    
    const result = processWordsToAdd(newRedWord, dictionaryRed, dictionaryYellow);
    
    // Show errors
    result.errors.forEach(err => toast.error(err));
    
    // Show warnings (similar words detected)
    result.warnings.forEach(warn => toast.warning(warn));
    
    // Add successful words
    if (result.added.length > 0) {
      form.setValue("O.crisis.dictionary_red", [...dictionaryRed, ...result.added]);
      toast.success(`${result.added.length} kata ditambahkan ke Dictionary Red`);
    }
    
    setNewRedWord("");
  };

  const removeRedWord = (index: number) => {
    const updated = dictionaryRed.filter((_, i) => i !== index);
    form.setValue("O.crisis.dictionary_red", updated);
  };

  const addYellowWord = () => {
    if (!newYellowWord.trim()) return;
    
    const result = processWordsToAdd(newYellowWord, dictionaryYellow, dictionaryRed);
    
    // Show errors
    result.errors.forEach(err => toast.error(err));
    
    // Show warnings (similar words detected)
    result.warnings.forEach(warn => toast.warning(warn));
    
    // Add successful words
    if (result.added.length > 0) {
      form.setValue("O.crisis.dictionary_yellow", [...dictionaryYellow, ...result.added]);
      toast.success(`${result.added.length} kata ditambahkan ke Dictionary Yellow`);
    }
    
    setNewYellowWord("");
  };

  const removeYellowWord = (index: number) => {
    const updated = dictionaryYellow.filter((_, i) => i !== index);
    form.setValue("O.crisis.dictionary_yellow", updated);
  };

  // Clean dictionaries (remove duplicates, normalize)
  const handleCleanDictionaries = () => {
    const cleanedRed = cleanDictionary(dictionaryRed);
    const cleanedYellow = cleanDictionary(dictionaryYellow);
    
    const redRemoved = dictionaryRed.length - cleanedRed.length;
    const yellowRemoved = dictionaryYellow.length - cleanedYellow.length;
    
    if (redRemoved > 0 || yellowRemoved > 0) {
      form.setValue("O.crisis.dictionary_red", cleanedRed);
      form.setValue("O.crisis.dictionary_yellow", cleanedYellow);
      toast.success(`Dibersihkan: ${redRemoved} duplikat Red, ${yellowRemoved} duplikat Yellow`);
    } else {
      toast.info("Dictionary sudah bersih, tidak ada duplikat");
    }
  };

  // Toxic Severity - Add word to level (with preprocessing)
  const addToxicWord = (level: 1 | 2 | 3) => {
    const inputValue = level === 1 ? newLevel1Word : level === 2 ? newLevel2Word : newLevel3Word;
    if (!inputValue.trim()) return;
    
    // Get all levels as "other dictionaries" for cross-checking
    const currentLevel = level === 1 ? level1Words : level === 2 ? level2Words : level3Words;
    const otherLevels = [
      ...(level !== 1 ? level1Words : []),
      ...(level !== 2 ? level2Words : []),
      ...(level !== 3 ? level3Words : [])
    ];
    
    const result = processWordsToAdd(inputValue, currentLevel, otherLevels);
    
    // Show errors
    result.errors.forEach(err => toast.error(err));
    
    // Show warnings (similar words detected)
    result.warnings.forEach(warn => toast.warning(warn));
    
    // Add successful words
    if (result.added.length > 0) {
      const fieldKey = `O.crisis.toxic_severity.level_${level}` as const;
      form.setValue(fieldKey as any, [...currentLevel, ...result.added]);
      toast.success(`${result.added.length} kata ditambahkan ke Level ${level}`);
    }
    
    // Clear input
    if (level === 1) setNewLevel1Word("");
    else if (level === 2) setNewLevel2Word("");
    else setNewLevel3Word("");
  };

  // Remove word from toxic level
  const removeToxicWord = (level: 1 | 2 | 3, index: number) => {
    const fieldKey = `O.crisis.toxic_severity.level_${level}` as const;
    const currentWords = level === 1 ? level1Words : level === 2 ? level2Words : level3Words;
    const updated = currentWords.filter((_, i) => i !== index);
    form.setValue(fieldKey as any, updated);
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
          {/* Basic Settings */}
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

          {/* Dictionary Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-button-hover">2. Dictionary Kata</h4>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Red Dictionary */}
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
                {dictionaryRed.map((word, index) => (
                  <Badge key={index} variant="destructive" className="flex items-center gap-2 px-3">
                    {word}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => removeRedWord(index)}
                    />
                  </Badge>
                ))}
              </div>
              {/* Red Severity Weight - moved here */}
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

            {/* Yellow Dictionary */}
            <div className="space-y-3">
              <FormLabel className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-warning"></span>
                Dictionary Yellow (SENSITIF)
              </FormLabel>
              <p className="text-sm text-muted-foreground">
                Kata/frasa sensitif yang perlu hati-hati penggunaannya
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Tambah kata (pisahkan dengan koma)..."
                  value={newYellowWord}
                  onChange={(e) => setNewYellowWord(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addYellowWord())}
                  className="flex-1"
                />
                <Button type="button" onClick={addYellowWord} size="icon" variant="outline" className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 min-h-[60px] p-3 bg-warning/10 rounded-lg border border-warning/20">
                {dictionaryYellow.map((word, index) => (
                  <Badge 
                    key={index}
                    className="flex items-center gap-2 px-3 cursor-default bg-warning text-warning-foreground"
                  >
                    {word}
                    <X
                      className="h-3 w-3 cursor-pointer hover:scale-125 transition-transform"
                      onClick={() => removeYellowWord(index)}
                    />
                  </Badge>
                ))}
              </div>
              {/* Yellow Severity Weight - moved here */}
              <FormField
                control={form.control}
                name="O.crisis.severity_weights.yellow"
                render={({ field }) => (
                  <FormItem className="pt-3">
                    <FormLabel className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-warning"></span>
                      Bobot Severity Kuning: {field.value?.toFixed(1) || "0.6"}
                    </FormLabel>
                    <FormControl>
                      <Slider
                        min={0.1}
                        max={0.9}
                        step={0.1}
                        value={[field.value || 0.6]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                        className="w-full"
                      />
                    </FormControl>
                    <FormDescription>Bobot kata YELLOW dalam menaikkan kewaspadaan</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            </div>
          </div>

          {/* ============================================ */}
          {/* TOXIC SEVERITY - Granular Toxicity Levels */}
          {/* ============================================ */}
          <div className="space-y-4">
            <div className="space-y-1">
              <h4 className="text-lg font-semibold text-button-hover">3. Level Toksisitas</h4>
              <p className="text-sm text-muted-foreground">
                Klasifikasi kata kasar berdasarkan tingkat keparahan (3 level)
              </p>
            </div>
            
            {/* Level 1 - Ringan (Full Width) */}
            <div className="w-full">
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="flex items-center gap-3 p-4 bg-card">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-yellow-500/20 text-yellow-500 font-bold text-sm">
                    1
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Level 1 - Ringan</span>
                    <p className="text-xs text-muted-foreground">Tidak sopan, tapi masih bisa ditoleransi</p>
                  </div>
                </div>
                <div className="p-4 bg-card space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="bego, bodoh, geblek..."
                      value={newLevel1Word}
                      onChange={(e) => setNewLevel1Word(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addToxicWord(1);
                        }
                      }}
                      className="bg-background"
                    />
                    <Button
                      type="button"
                      onClick={() => addToxicWord(1)}
                      className="bg-button-hover text-button-hover-foreground hover:bg-button-hover/90 px-3"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[60px] p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                    {level1Words.length > 0 ? (
                      level1Words.map((word, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 gap-2 px-3"
                        >
                          {word}
                          <button
                            type="button"
                            onClick={() => removeToxicWord(1, idx)}
                            className="ml-1 hover:text-yellow-300"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground italic">Belum ada kata</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Level 2 & 3 - Two Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Level 2 - Sedang */}
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="flex items-center gap-3 p-4 bg-card">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-orange-500/20 text-orange-500 font-bold text-sm">
                    2
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Level 2 - Sedang</span>
                    <p className="text-xs text-muted-foreground">Kasar, perlu respons hati-hati</p>
                  </div>
                </div>
                <div className="p-4 bg-card space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="goblok, tolol, bangsat..."
                      value={newLevel2Word}
                      onChange={(e) => setNewLevel2Word(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addToxicWord(2);
                        }
                      }}
                      className="bg-background"
                    />
                    <Button
                      type="button"
                      onClick={() => addToxicWord(2)}
                      className="bg-button-hover text-button-hover-foreground hover:bg-button-hover/90 px-3"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[60px] p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                    {level2Words.length > 0 ? (
                      level2Words.map((word, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="bg-orange-500/10 text-orange-500 border-orange-500/30 gap-2 px-3"
                        >
                          {word}
                          <button
                            type="button"
                            onClick={() => removeToxicWord(2, idx)}
                            className="ml-1 hover:text-orange-300"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground italic">Belum ada kata</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Level 3 - Berat */}
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="flex items-center gap-3 p-4 bg-card">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-destructive/20 text-destructive font-bold text-sm">
                    3
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Level 3 - Berat</span>
                    <p className="text-xs text-muted-foreground">Sangat kasar, eskalasi ke admin</p>
                  </div>
                </div>
                <div className="p-4 bg-card space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="babi, anjing, kontol..."
                      value={newLevel3Word}
                      onChange={(e) => setNewLevel3Word(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addToxicWord(3);
                        }
                      }}
                      className="bg-background"
                    />
                    <Button
                      type="button"
                      onClick={() => addToxicWord(3)}
                      className="bg-button-hover text-button-hover-foreground hover:bg-button-hover/90 px-3"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[60px] p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                    {level3Words.length > 0 ? (
                      level3Words.map((word, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="bg-destructive/10 text-destructive border-destructive/30 gap-2 px-3"
                        >
                          {word}
                          <button
                            type="button"
                            onClick={() => removeToxicWord(3, idx)}
                            className="ml-1 hover:text-red-300"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground italic">Belum ada kata</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground italic">
              💡 AI akan menyesuaikan respons berdasarkan level toksisitas. Level 3 otomatis trigger eskalasi ke admin.
            </p>
          </div>

          {/* Anti-Hunter Section */}
          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-semibold text-button-hover">4. Anti-Hunter</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Deteksi dan tangani player hunter dengan rules khusus
              </p>
            </div>

            <FormField
              control={form.control}
              name="O.anti_hunter.enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg bg-muted p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-button-hover">Aktifkan Anti-Hunter</FormLabel>
                    <FormDescription>Deteksi dan tangani player hunter</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {antiHunterEnabled && (
              <>
                {/* Add New Rule */}
                <div className="space-y-3">
                  <FormLabel className="text-button-hover">Judul Aturan Anti Hunter</FormLabel>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Judul Aturan Anti Hunter"
                      value={newRuleName}
                      onChange={(e) => setNewRuleName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAntiHunterRule())}
                      className="flex-1"
                    />
                    <Button type="button" onClick={addAntiHunterRule} variant="outline" className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
                      <Plus className="h-4 w-4 mr-2" />
                      Tambah Rule
                    </Button>
                  </div>
                </div>

            {/* Rules List */}
            <div className="space-y-4">
              {antiHunterRules.map((rule: any, ruleIndex: number) => (
                <Card key={ruleIndex} className="p-4 space-y-4 border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-button-hover">{rule.name}</h4>
                      {rule.patterns.length === 0 && (
                        <Badge className="text-xs px-3 bg-muted text-muted-foreground border-0 cursor-default">Perlu pattern</Badge>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAntiHunterRule(ruleIndex)}
                      className="text-muted-foreground hover:bg-muted"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Pattern Deteksi Manual */}
                  <div className="space-y-3">
                    <FormLabel className="text-sm">Input Keyword Deteksi Manual</FormLabel>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Tambah pattern manual..."
                        value={newPattern}
                        onChange={(e) => setNewPattern(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addPatternToRule(ruleIndex, newPattern);
                            setNewPattern("");
                          }
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          addPatternToRule(ruleIndex, newPattern);
                          setNewPattern("");
                        }}
                        className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {/* Manual Pattern Badges - below input, GREEN styling */}
                    {((rule.manualPatterns?.length ?? 0) > 0) && (
                      <div className="flex flex-wrap gap-2">
                        {(rule.manualPatterns || []).map((pattern: string, patternIndex: number) => (
                          <Badge key={patternIndex} className="flex items-center gap-2 px-3 bg-success/20 text-success ring-1 ring-success/50 hover:bg-success/30">
                            {pattern}
                            <X
                              className="h-3 w-3 cursor-pointer text-success"
                              onClick={() => removePatternFromRule(ruleIndex, patternIndex, 'manual')}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                    
                  {/* Preset Pattern Templates - Single Dropdown */}
                  <div className="space-y-3">
                    <FormLabel className="text-sm">Template Keyword Deteksi</FormLabel>
                    <Select
                      onValueChange={(pattern) => addPresetPatternToRule(ruleIndex, pattern)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih preset pattern..." />
                      </SelectTrigger>
                      <SelectContent>
                        {presetPatternTemplates.map((preset) => (
                          <SelectGroup key={preset.category}>
                            <SelectLabel className="text-button-hover font-semibold text-left">{preset.category}</SelectLabel>
                            {preset.patterns.map((pattern) => (
                              <SelectItem key={pattern} value={pattern} className="text-sm text-left">
                                {pattern}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* Preset Pattern Badges - below dropdown, YELLOW styling */}
                    {((rule.presetPatterns?.length ?? 0) > 0) && (
                      <div className="flex flex-wrap gap-2">
                        {(rule.presetPatterns || []).map((pattern: string, patternIndex: number) => (
                          <Badge key={patternIndex} className="flex items-center gap-2 px-3 bg-button-hover/20 text-button-hover ring-2 ring-button-hover hover:bg-button-hover/30">
                            {pattern}
                            <X
                              className="h-3 w-3 cursor-pointer text-button-hover"
                              onClick={() => removePatternFromRule(ruleIndex, patternIndex, 'preset')}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Response Style - Row with 3 columns */}
                  <div className="grid grid-cols-3 gap-4 items-end">
                    <div className="space-y-1">
                      <FormLabel className="text-sm">Cara Respond</FormLabel>
                      <Select
                        value={rule.response_style}
                        onValueChange={(value: HunterResponseStyle) => {
                          const updated = [...antiHunterRules];
                          updated[ruleIndex].response_style = value;
                          form.setValue("O.anti_hunter.rules", updated);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {responseStyleOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-center gap-2 h-10">
                      <Checkbox
                        checked={rule.allow_blacklist}
                        onCheckedChange={(checked) => {
                          const updated = [...antiHunterRules];
                          updated[ruleIndex].allow_blacklist = !!checked;
                          form.setValue("O.anti_hunter.rules", updated);
                        }}
                      />
                      <span className="text-sm">Allow Blacklist</span>
                    </div>

                    <div className="flex items-center justify-center gap-2 h-10">
                      <Checkbox
                        checked={rule.auto_escalate}
                        onCheckedChange={(checked) => {
                          const updated = [...antiHunterRules];
                          updated[ruleIndex].auto_escalate = !!checked;
                          form.setValue("O.anti_hunter.rules", updated);
                        }}
                      />
                      <span className="text-sm">Auto Escalate</span>
                    </div>
                  </div>
                </Card>
              ))}

              {antiHunterRules.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground/60 border border-muted-foreground/30 rounded-lg border-dashed">
                  Belum ada rule. Tambahkan rule anti-hunter di atas.
                </div>
              )}
            </div>
              </>
            )}
          </div>

          {/* Preventive Bonus Section */}
          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-semibold text-button-hover">5. Bonus Preventif</h4>
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