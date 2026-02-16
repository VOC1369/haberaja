import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  WizardFormData, 
  reactionOptions, 
  scenarioCards,
  reactionModeMapping,
  scenarioSeverityRange,
  reactionSeverityRange,
  getReasoningForMode,
  getTemplateForMode
} from "./types";

interface Step2Props {
  data: WizardFormData;
  onChange: (updates: Partial<WizardFormData>) => void;
}

export function Step2Reaction({ data, onChange }: Step2Props) {
  const [autoTemplate, setAutoTemplate] = useState(true);
  const [autoReasoning, setAutoReasoning] = useState(true);

  // Auto-generate on mount/dependency change when Auto is ON and fields are empty
  useEffect(() => {
    if (autoTemplate && !data.response_template && data.mode_respons && data.scenario) {
      const autoContent = getTemplateForMode(data.mode_respons, data.scenario);
      if (autoContent) {
        onChange({ response_template: autoContent });
      }
    }
    if (autoReasoning && !data.reasoning_guideline && data.mode_respons && data.scenario) {
      const autoContent = getReasoningForMode(data.mode_respons, data.scenario);
      if (autoContent) {
        onChange({ reasoning_guideline: autoContent });
      }
    }
  }, [data.mode_respons, data.scenario]);

  const selectedScenario = scenarioCards.find(s => s.id === data.scenario);
  const selectedReaction = reactionOptions.find(r => r.id === data.reaction);
  
  // V5.1: Double-Lock Severity — Intersection of Scenario + Reaction ranges
  const scenarioConfig = scenarioSeverityRange[data.scenario] || { default: 3, min: 1, max: 5 };
  const reactionConfig = reactionSeverityRange[data.reaction];
  const finalMin = Math.max(scenarioConfig.min, reactionConfig.min);
  const finalMax = Math.min(scenarioConfig.max, reactionConfig.max);
  const isLocked = finalMin === finalMax;
  
  // Get allowed modes for current reaction - with default if empty
  const allowedModes = reactionModeMapping[data.reaction] || [];
  const defaultMode = allowedModes[0] || "";
  
  // Set default mode if not set yet
  if (data.reaction && !data.mode_respons && defaultMode) {
    onChange({ mode_respons: defaultMode });
  }

  const handleReactionSelect = (reactionId: "soft" | "firm" | "handoff") => {
    const allowedModesForReaction = reactionModeMapping[reactionId];
    const defaultMode = allowedModesForReaction[0];
    
    // V5.2: Auto-generate reasoning & template using MODE → SCENARIO
    const autoReasoningText = getReasoningForMode(defaultMode, data.scenario);
    const autoTemplateText = getTemplateForMode(defaultMode, data.scenario);
    
    // V5.1: Calculate severity with double-lock (Scenario × Reaction)
    const scenarioConf = scenarioSeverityRange[data.scenario] || { default: 3, min: 1, max: 5 };
    const reactionConf = reactionSeverityRange[reactionId];
    const newMin = Math.max(scenarioConf.min, reactionConf.min);
    const newMax = Math.min(scenarioConf.max, reactionConf.max);
    // Clamp severity to new range
    let newSeverity = scenarioConf.default;
    if (newSeverity < newMin) newSeverity = newMin;
    if (newSeverity > newMax) newSeverity = newMax;
    
    onChange({
      reaction: reactionId,
      mode_respons: defaultMode,
      reasoning_guideline: autoReasoningText,
      response_template: autoTemplateText,
      severity_level: newSeverity,
      handoff_type: reactionId === "handoff" ? (data.handoff_type || "active_handover") : undefined
    });
  };

  // V5.2: Handle mode change → update template & reasoning
  const handleModeChange = (newMode: string) => {
    const updates: Partial<WizardFormData> = { mode_respons: newMode };
    
    if (autoTemplate) {
      updates.response_template = getTemplateForMode(newMode, data.scenario);
    }
    if (autoReasoning) {
      updates.reasoning_guideline = getReasoningForMode(newMode, data.scenario);
    }
    
    onChange(updates);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">Langkah 2 — Pilih Reaksi</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tentukan bagaimana AI harus merespons skenario "{selectedScenario?.label || 'yang dipilih'}".
        </p>
      </div>

      {/* Reaction Cards - Strategy Level */}
      <div>
        <Label className="text-sm font-medium mb-3 block">Response Strategy</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {reactionOptions.map((reaction) => (
            <Card
              key={reaction.id}
              className={`cursor-pointer transition-all duration-200 border-2 ${
                data.reaction === reaction.id
                  ? `${reaction.color} ring-2 ring-offset-2 ring-offset-background`
                  : `border-border hover:${reaction.color}`
              }`}
              onClick={() => handleReactionSelect(reaction.id)}
            >
              <CardContent className="p-6 text-center">
                <div className="text-5xl mb-3">{reaction.icon}</div>
                <h3 className="font-bold text-foreground text-lg">{reaction.label}</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {reaction.description}
                </p>
                {reaction.id === "handoff" && (
                  <div className="mt-3 px-2 py-1 bg-declined/20 rounded-full text-xs text-declined">
                    AI Berhenti Total
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Execution Style Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mode Respons - LOCKED per Reaction */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Mode Respons (Execution Style)
            {data.reaction === "handoff" && (
              <span className="ml-2 text-xs text-red-400">🔒 Locked</span>
            )}
          </Label>
          <Select
            value={data.mode_respons}
            onValueChange={handleModeChange}
            disabled={data.reaction === "handoff"}
          >
            <SelectTrigger className={data.reaction === "handoff" ? "opacity-60" : ""}>
              <SelectValue placeholder="Pilih mode respons" />
            </SelectTrigger>
            <SelectContent>
              {allowedModes.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {mode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Mode terbatas sesuai strategi {selectedReaction?.label}
          </p>
        </div>

        {/* Severity Level - V5.1: Double-Locked (Scenario × Reaction) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Severity Level: {data.severity_level}/5
            {isLocked && (
              <span className="ml-2 text-xs text-red-400">🔒 Locked</span>
            )}
          </Label>
          <Slider
            value={[data.severity_level]}
            onValueChange={([value]) => onChange({ severity_level: value })}
            min={finalMin}
            max={finalMax}
            step={1}
            disabled={isLocked}
            className={`mt-2 ${isLocked ? "opacity-60" : ""}`}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{finalMin} - Min</span>
            <span>{finalMax} - Max</span>
          </div>
          {isLocked && (
            <p className="text-xs text-red-400">
              Severity terkunci ({selectedScenario?.label} + {selectedReaction?.label})
            </p>
          )}
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Priority Score: {data.priority}
          </Label>
          <Slider
            value={[data.priority]}
            onValueChange={([value]) => onChange({ priority: value })}
            min={1}
            max={100}
            step={1}
            className="mt-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1 - Rendah</span>
            <span>100 - Tertinggi</span>
          </div>
        </div>
      </div>

      {/* V5.1: Handoff Type Selector (Active vs Silent) */}
      {data.reaction === "handoff" && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Handoff Type</Label>
          <Select
            value={data.handoff_type || "active_handover"}
            onValueChange={(value: "active_handover" | "silent_handover") => 
              onChange({ handoff_type: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active_handover">
                🗣️ Active Handoff — AI bicara pesan transfer
              </SelectItem>
              <SelectItem value="silent_handover">
                🔇 Silent Handoff — AI diam, langsung transfer
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {data.handoff_type === "silent_handover" 
              ? "AI tidak berbicara. Langsung kirim event transfer ke backend."
              : "AI akan mengucapkan pesan transfer sebelum handoff."}
          </p>
        </div>
      )}

      {/* Response Template - Toggle ON/OFF */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Template Respons</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {autoTemplate ? "Auto" : "Manual"}
            </span>
            <Switch
              checked={autoTemplate}
              onCheckedChange={(checked) => {
                setAutoTemplate(checked);
                if (checked) {
                  // V5.2: Use MODE → SCENARIO lookup
                  const autoContent = getTemplateForMode(data.mode_respons, data.scenario);
                  onChange({ response_template: autoContent });
                } else {
                  onChange({ response_template: "" });
                }
              }}
            />
          </div>
        </div>
        <Textarea
          value={data.response_template}
          onChange={(e) => onChange({ response_template: e.target.value })}
          placeholder={autoTemplate ? "Template respons di-generate otomatis..." : "Ketik template respons manual..."}
          rows={3}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">
          {autoTemplate 
            ? "✨ Auto-generated. Anda dapat mengedit jika diperlukan."
            : "✏️ Mode manual aktif. Tulis template respons sesuai kebutuhan."}
        </p>
      </div>

      {/* Reasoning Guideline - Toggle ON/OFF */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Reasoning Guideline</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {autoReasoning ? "Auto" : "Manual"}
            </span>
            <Switch
              checked={autoReasoning}
              onCheckedChange={(checked) => {
                setAutoReasoning(checked);
                if (checked) {
                  // V5.2: Use MODE → SCENARIO lookup
                  const autoContent = getReasoningForMode(data.mode_respons, data.scenario);
                  onChange({ reasoning_guideline: autoContent });
                } else {
                  onChange({ reasoning_guideline: "" });
                }
              }}
            />
          </div>
        </div>
        <Textarea
          value={data.reasoning_guideline}
          onChange={(e) => onChange({ reasoning_guideline: e.target.value })}
          placeholder={autoReasoning ? "Panduan AI di-generate otomatis..." : "Ketik reasoning guideline manual..."}
          rows={3}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">
          {autoReasoning
            ? "✨ Auto-generated. Instruksi internal untuk AI."
            : "✏️ Mode manual aktif. Tulis panduan AI sesuai kebutuhan."}
        </p>
      </div>

      {/* Handoff Warning */}
      {data.reaction === "handoff" && (
        <Card className="border-declined/50 bg-card">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h4 className="font-medium text-declined">Human Handoff Aktif</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  AI akan {data.handoff_type === "silent_handover" ? "langsung transfer tanpa bicara" : "bicara pesan transfer lalu handoff"}. 
                  Tag alert: <code className="bg-declined/20 px-1 rounded text-declined">HIGH_PRIORITY</code>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
