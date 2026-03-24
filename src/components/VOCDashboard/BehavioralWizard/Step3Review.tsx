import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Copy, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  WizardFormData, 
  BehavioralRuleItem,
  scenarioCards, 
  reactionOptions, 
  patternTriggerOptions, 
  generateRuleName,
  generateDisplayName,
  behaviorCategoryEnumMapping,
  intentEnumMapping,
  modeResponsEnumMapping,
  calculatePriority,
  validateBehavioralRule
} from "./types";
import { toast } from "@/lib/notify";

interface Step3Props {
  data: WizardFormData;
  onChange: (updates: Partial<WizardFormData>) => void;
  editingItem?: BehavioralRuleItem | null;
}

export function Step3Review({ data, onChange, editingItem }: Step3Props) {
  const [enableExpiry, setEnableExpiry] = useState(!!data.expires_at);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const selectedScenario = scenarioCards.find(s => s.id === data.scenario);
  const selectedReaction = reactionOptions.find(r => r.id === data.reaction);
  
  // V5.2: System-generated rule name (immutable, backend-safe)
  const systemRuleName = generateRuleName(data.scenario, data.reaction);
  
  // V5.2: User-friendly display name (editable)
  const displayName = data.display_name.trim() || generateDisplayName(data.scenario, data.reaction);
  
  // V6.1: Scenario label dari 7 fixed cards saja
  const scenarioLabel = selectedScenario?.label || "Tidak dipilih";

  // V5.2.1: Check for legacy validation issues when editing
  const validationResult = editingItem ? validateBehavioralRule(editingItem) : null;
  const showValidationWarning = validationResult && !validationResult.isValid && 
    (!editingItem?.last_validated_at || editingItem.auto_fixed_fields?.length);

  const handleExpiryToggle = (enabled: boolean) => {
    setEnableExpiry(enabled);
    if (!enabled) {
      onChange({ expires_at: null });
    }
  };

  const getSeverityColor = (level: number) => {
    if (level >= 5) return "bg-declined/20 text-declined border-declined/50";
    if (level >= 4) return "bg-warning/20 text-warning border-warning/50";
    if (level >= 3) return "bg-button-hover/20 text-button-hover border-button-hover/50";
    return "bg-success/20 text-success border-success/50";
  };

  const getReactionColor = (reaction: string) => {
    if (reaction === "handoff") return "bg-declined/20 text-declined border-declined/50";
    if (reaction === "firm") return "bg-warning/20 text-warning border-warning/50";
    return "bg-success/20 text-success border-success/50";
  };

  // V5.2.1: Build final JSON object with snake_case ENUM values
  const buildFinalJson = () => {
    const autoPriority = calculatePriority(data.scenario, data.reaction, data.severity_level);
    
    return {
      // === LAYER 1: UI (display_name tidak masuk AI payload) ===
      display_name: displayName,
      
      // === LAYER 2: AI ENGINE ===
      rule_name: systemRuleName,
      behavior_category: behaviorCategoryEnumMapping[data.behavior_category] || data.behavior_category,
      intent_perilaku: intentEnumMapping[data.intent_perilaku] || data.intent_perilaku,
      pattern_trigger: data.pattern_trigger,
      severity_level: data.severity_level,
      mode_respons: modeResponsEnumMapping[data.mode_respons] || data.mode_respons,
      response_template: data.response_template,
      reasoning_guideline: data.reasoning_guideline,
      handoff_protocol: data.reaction === "handoff" 
        ? { required: true, type: data.handoff_type || "active_handover", tag_alert: "HIGH_PRIORITY" }
        : data.reaction === "firm"
        ? { required: false, type: "monitoring", tag_alert: "FIRM_RESPONSE" }
        : { required: false, type: "monitoring", tag_alert: "" },
      
      // === LAYER 3: SYSTEM ===
      status: "active",
      version: "1.0.0",
      priority: autoPriority,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: data.expires_at || null
    };
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(buildFinalJson(), null, 2));
      setCopied(true);
      toast.success("JSON berhasil disalin");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Gagal menyalin JSON");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">Langkah 3 — Review & Simpan</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Periksa konfigurasi aturan sebelum menyimpan.
        </p>
      </div>

      {/* V5.2.1: Validation Warning for Legacy Data */}
      {showValidationWarning && validationResult && (
        <Card className="border-amber-500/50 bg-card">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-400">⚠️ Legacy Rule Warning</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Rule ini dibuat sebelum V5.1 dan memiliki constraint violation:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground mt-2">
                  {validationResult.violations.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
                {validationResult.autoFixed && (
                  <p className="text-xs text-amber-400 mt-2">
                    Auto-fix akan diterapkan saat save: {Object.keys(validationResult.autoFixed).join(", ")}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* V5.2: Dual Naming System */}
      <Card className="border-border bg-card">
        <CardContent className="p-6 space-y-4">
          {/* Display Name (User-Friendly, Editable) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-primary">Nama Aturan (Display)</Label>
            <Input
              placeholder="Contoh: Marah Kasar – Mode Tenangkan"
              value={data.display_name}
              onChange={(e) => onChange({ display_name: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Nama yang mudah dipahami admin. Boleh spasi, emoji, bahasa Indonesia.
            </p>
          </div>
          
          {/* Preview final display name if empty */}
          {!data.display_name.trim() && (
            <div className="text-xs text-muted-foreground">
              Auto: <span className="text-foreground bg-muted px-2 py-0.5 rounded">{displayName}</span>
            </div>
          )}
          
          {/* System Rule Name (Immutable) */}
          <div className="pt-3 border-t border-border">
            <Label className="text-xs text-muted-foreground">System Rule ID (auto-generated)</Label>
            <div className="text-sm text-foreground/70 font-mono bg-muted px-3 py-2 rounded-lg border border-border mt-1">
              {systemRuleName}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ID sistem untuk backend, indexing, dan analytics. Tidak bisa diubah.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Scenario Summary */}
        <Card className="bg-card">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Skenario</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{selectedScenario?.icon || "❓"}</span>
              <div className="flex-1">
                <div className="font-semibold text-foreground">{scenarioLabel}</div>
                <div className="text-xs text-muted-foreground">{selectedScenario?.description || ""}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reaction Summary */}
        <Card className="bg-card">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reaksi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{selectedReaction?.icon || "❓"}</span>
              <div className="flex-1">
                <div className="font-semibold text-foreground">{selectedReaction?.label || "Tidak dipilih"}</div>
                <div className="text-xs text-muted-foreground">{selectedReaction?.description || ""}</div>
              </div>
              <Badge variant="outline" className={getReactionColor(data.reaction)}>
                {data.reaction === "handoff" ? "AI Off" : data.reaction === "firm" ? "Tegas" : "Lembut"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Technical Details */}
      <Card className="bg-card">
        <CardHeader className="p-6 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Detail Teknis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Kategori</Label>
              <div className="text-sm font-medium text-foreground mt-1">{data.behavior_category || "-"}</div>
              <div className="text-xs text-muted-foreground font-mono">
                → {behaviorCategoryEnumMapping[data.behavior_category] || "-"}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Intent</Label>
              <div className="text-sm font-medium text-foreground mt-1">{data.intent_perilaku || "-"}</div>
              <div className="text-xs text-muted-foreground font-mono">
                → {intentEnumMapping[data.intent_perilaku] || "-"}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Mode Respons</Label>
              <div className="text-sm font-medium text-foreground mt-1">{data.mode_respons || "-"}</div>
              <div className="text-xs text-muted-foreground font-mono">
                → {modeResponsEnumMapping[data.mode_respons] || "-"}
              </div>
            </div>
          </div>

          {/* Pattern Triggers */}
          <div>
            <Label className="text-xs text-muted-foreground">Pattern Triggers</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(data.pattern_trigger || {})
                .filter(([_, active]) => active)
                .map(([key]) => {
                  const pattern = patternTriggerOptions.find(p => p.key === key);
                  return (
                    <Badge key={key} variant="outline" className="bg-muted">
                      {pattern?.label || key}
                    </Badge>
                  );
                })}
              {Object.keys(data.pattern_trigger || {}).length === 0 && (
                <span className="text-sm text-muted-foreground">Tidak ada pattern trigger</span>
              )}
            </div>
          </div>

          {/* Severity & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Severity Level</Label>
              <div className="mt-2">
                <Badge variant="outline" className={getSeverityColor(data.severity_level)}>
                  Level {data.severity_level}/5
                  {data.severity_level === 5 && " (CRISIS)"}
                </Badge>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Priority Score (Auto)</Label>
              <div className="mt-2">
                <Badge variant="outline" className="bg-muted">
                  {calculatePriority(data.scenario, data.reaction, data.severity_level)}/100
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Applicability Criteria — Editable */}
      <Card className="bg-card">
        <CardHeader className="p-6 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Kriteria Penerapan</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            className="min-h-[80px] bg-muted border-border text-sm"
            placeholder="Kapan rule ini harus diterapkan?"
            value={data.applicability_criteria}
            onChange={(e) => onChange({ applicability_criteria: e.target.value })}
          />
        </CardContent>
      </Card>

      {/* Response Template — Editable */}
      <Card className="bg-card">
        <CardHeader className="p-6 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Template Respons</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            className="min-h-[120px] bg-muted border-border text-sm"
            placeholder="Template respons AI..."
            value={data.response_template}
            onChange={(e) => onChange({ response_template: e.target.value })}
          />
        </CardContent>
      </Card>

      {/* Handoff Protocol */}
      {data.reaction === "handoff" && (
        <Card className="border-red-500/50 bg-card">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-sm font-medium text-red-400">⚠️ Handoff Protocol</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <Label className="text-xs text-muted-foreground">Required</Label>
                <div className="font-medium text-red-400">Yes</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Type</Label>
                <div className="font-medium text-foreground">
                  {data.handoff_type === "silent_handover" 
                    ? "🔇 Silent Handover" 
                    : "🗣️ Active Handover"}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tag Alert</Label>
                <code className="bg-declined/20 px-2 py-0.5 rounded text-declined">HIGH_PRIORITY</code>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expiry Setting */}
      <Card className="bg-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Atur Tanggal Kedaluwarsa</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Aturan akan otomatis nonaktif setelah tanggal ini
              </p>
            </div>
            <Switch
              checked={enableExpiry}
              onCheckedChange={handleExpiryToggle}
            />
          </div>
          
          {enableExpiry && (
            <div className="mt-4">
              <Input
                type="date"
                value={data.expires_at || ""}
                onChange={(e) => onChange({ expires_at: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* JSON Output Preview (Collapsible) */}
      <Collapsible open={jsonOpen} onOpenChange={setJsonOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full bg-card p-6 rounded-xl border border-border">
          <span>📄 JSON Output Preview (3-Layer)</span>
          <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${jsonOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyJson}
              className="absolute top-2 right-2 h-8 gap-1 text-xs"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Tersalin" : "Salin"}
            </Button>
            <pre className="text-xs bg-muted p-6 pt-10 rounded-b-xl overflow-x-auto max-h-[400px] border border-t-0 border-border font-mono">
              {JSON.stringify(buildFinalJson(), null, 2)}
            </pre>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
