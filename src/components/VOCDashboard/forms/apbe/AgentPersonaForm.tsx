import { UseFormReturn } from "react-hook-form";
import { APBEConfig, AgentGender, AgentStyle, AgentSpeed, AgentTone } from "@/types/apbe-config";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Bot, X, Plus, Sparkles, Save } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface AgentPersonaFormProps {
  form: UseFormReturn<APBEConfig>;
  isEditingFromSummary?: boolean;
  onSaveAndReturn?: () => void;
}

const genderOptions: { value: AgentGender; label: string }[] = [
  { value: "female", label: "Perempuan" },
  { value: "male", label: "Laki-laki" },
  { value: "neutral", label: "Netral" },
];

const toneOptions: { value: AgentTone; label: string }[] = [
  { value: "soft_warm", label: "Soft & Warm" },
  { value: "neutral", label: "Neutral" },
  { value: "strict_efficient", label: "Strict & Efficient" },
  { value: "cheerful_playful", label: "Cheerful & Playful" },
  { value: "gentle_supportive", label: "Gentle & Supportive" },
  { value: "elite_formal", label: "Elite & Formal" },
];

const styleOptions: { value: AgentStyle; label: string }[] = [
  { value: "friendly", label: "Ramah & Casual" },
  { value: "professional", label: "Profesional" },
  { value: "playful", label: "Ceria & Fun" },
  { value: "caring", label: "Perhatian & Supportive" },
  { value: "formal", label: "Formal & Sopan" },
  { value: "energetic", label: "Energik & Semangat" },
];

const speedOptions: { value: AgentSpeed; label: string; description: string }[] = [
  { value: "instant", label: "Instant", description: "< 1 detik" },
  { value: "fast", label: "Fast", description: "1-3 detik" },
  { value: "normal", label: "Normal", description: "3-5 detik" },
  { value: "relaxed", label: "Relaxed", description: "5-10 detik" },
];

export function AgentPersonaForm({ form, isEditingFromSummary, onSaveAndReturn }: AgentPersonaFormProps) {
  const [newForbiddenEmoji, setNewForbiddenEmoji] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const generateBackstory = () => {
    const groupName = form.getValues("A.group_name") || "Brand";
    const agentName = form.getValues("agent.name") || "AI Agent";
    const agentGender = form.getValues("agent.gender");
    const agentTone = form.getValues("agent.tone");
    
    setIsGenerating(true);
    
    const genderText = agentGender === "female" ? "perempuan" : agentGender === "male" ? "laki-laki" : "netral";
    const toneText = toneOptions.find(t => t.value === agentTone)?.label || "friendly";
    
    setTimeout(() => {
      const generatedBackstory = `${agentName} adalah customer service AI ${genderText} dari ${groupName} yang berdedikasi tinggi. Dengan karakter ${toneText.toLowerCase()}, ${agentName} selalu siap membantu player dengan solusi cepat dan akurat. ${agentName} memahami kebutuhan player dan berkomitmen memberikan pengalaman layanan terbaik dengan respon yang ramah namun profesional.`;
      
      form.setValue("agent.backstory", generatedBackstory);
      setIsGenerating(false);
      toast.success("Backstory berhasil di-generate!");
    }, 1500);
  };

  const handleSaveSection = () => {
    toast.success("Agent Persona saved!");
    if (onSaveAndReturn) {
      onSaveAndReturn();
    }
  };
  const forbiddenEmojis = form.watch("agent.emoji_forbidden") || [];

  const addForbiddenEmoji = () => {
    if (newForbiddenEmoji.trim()) {
      const emojis = newForbiddenEmoji.split(',').map(e => e.trim()).filter(e => e.length > 0);
      const existingForbiddenLower = forbiddenEmojis.map(e => e.toLowerCase());
      
      const duplicatesInForbidden = emojis.filter(e => existingForbiddenLower.includes(e.toLowerCase()));
      const newEmojis = emojis.filter(e => !existingForbiddenLower.includes(e.toLowerCase()));
      
      if (duplicatesInForbidden.length > 0) {
        toast.error(`Emoji sudah ada: ${duplicatesInForbidden.join(', ')}`);
      }
      if (newEmojis.length > 0) {
        form.setValue("agent.emoji_forbidden", [...forbiddenEmojis, ...newEmojis]);
      }
      setNewForbiddenEmoji("");
    }
  };

  const removeForbiddenEmoji = (index: number) => {
    const updated = forbiddenEmojis.filter((_, i) => i !== index);
    form.setValue("agent.emoji_forbidden", updated);
  };

  return (
    <div className="page-wrapper">
      <Card className="form-card">
        <div className="form-card-header">
          <div className="icon-circle">
            <Bot className="icon-circle-icon" />
          </div>
          <div>
            <h3 className="form-card-title">Agent Persona</h3>
            <p className="form-card-description">
              Karakter dan kepribadian AI agent
            </p>
          </div>
        </div>

        <div className="form-section space-y-6">
          {/* Basic Info Section */}
          <div className="space-y-6">
            <h4 className="text-lg font-semibold text-button-hover">1. Informasi Dasar</h4>
            <div className="form-grid">
            <FormField
              control={form.control}
              name="agent.name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Agent *</FormLabel>
                  <FormControl>
                    <Input placeholder="ex: Riri, Maya, Danila" {...field} />
                  </FormControl>
                  <FormDescription>Nama persona AI yang akan muncul kepada player. Misal: Riri, Danila, Maya.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="agent.gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih gender" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {genderOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Jenis kelamin agent</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            </div>
          </div>

          {/* Backstory Section */}
          <div className="space-y-6">
            <h4 className="text-lg font-semibold text-button-hover">2. Backstory & Karakter</h4>
          <FormField
            control={form.control}
            name="agent.backstory"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between mb-2">
                  <FormLabel>Backstory Agent</FormLabel>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={generateBackstory}
                    disabled={isGenerating}
                    className="h-7 px-3 bg-muted text-muted-foreground hover:bg-button-hover hover:text-button-hover-foreground"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    {isGenerating ? "Generating..." : "Generate"}
                  </Button>
                </div>
                <FormControl>
                  <Textarea
                    placeholder="ex: Riri adalah AI customer service VOC 1369 yang ramah dan profesional..."
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Deskripsi karakter yang akan membentuk kepribadian AI
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />


            {/* Tone Kepribadian */}
          <FormField
            control={form.control}
            name="agent.tone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tone Kepribadian *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih tone" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {toneOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>Karakter utama cara bicara agent di luar kondisi krisis/VIP</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          </div>

          {/* Style & Speed Section */}
          <div className="space-y-6">
            <h4 className="text-lg font-semibold text-button-hover">3. Gaya & Kecepatan</h4>
            <div className="form-grid">
            <FormField
              control={form.control}
              name="agent.style"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gaya Komunikasi *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih gaya" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {styleOptions.map((option) => (
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
              name="agent.speed"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kecepatan Respons *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih kecepatan" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {speedOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label} ({option.description})
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

          {/* Emoji Section */}
          <div className="space-y-6">
            <h4 className="text-lg font-semibold text-button-hover">4. Pengaturan Emoji</h4>
            {/* Forbidden Emojis Only */}
            <div className="space-y-3">
              <FormLabel>Emoji yang Dilarang</FormLabel>
              <FormDescription className="text-xs">
                Daftar emoji yang tidak boleh digunakan oleh AI dalam respons
              </FormDescription>
              <div className="flex gap-2">
                <Input
                  placeholder="ex: 💀, 🖕, ☠️"
                  value={newForbiddenEmoji}
                  onChange={(e) => setNewForbiddenEmoji(e.target.value)}
                  className="flex-1"
                />
                <Button type="button" onClick={addForbiddenEmoji} size="icon" variant="outline" className="border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-3 min-h-[60px] p-3 bg-destructive/10 rounded-lg border border-destructive/20 overflow-y-auto items-center content-start">
                {forbiddenEmojis.length > 0 ? (
                  forbiddenEmojis.map((emoji, index) => (
                    <div 
                      key={index} 
                      className="inline-flex items-center gap-2 px-2 py-1 rounded-md border border-destructive/30 bg-destructive/5"
                    >
                      <span className="text-lg leading-none">{emoji}</span>
                      <button
                        type="button"
                        onClick={() => removeForbiddenEmoji(index)}
                        className="text-sm leading-none text-destructive/70 hover:text-destructive transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground w-full text-center">Belum ada emoji yang dilarang</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Save Section Button - only show when editing from summary */}
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