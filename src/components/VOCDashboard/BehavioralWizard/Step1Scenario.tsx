import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { WizardFormData, scenarioCards } from "./types";

interface Step1Props {
  data: WizardFormData;
  onChange: (updates: Partial<WizardFormData>) => void;
}

export function Step1Scenario({ data, onChange }: Step1Props) {
  const handleScenarioSelect = (scenarioId: string) => {
    const scenario = scenarioCards.find(s => s.id === scenarioId);
    if (scenario) {
      onChange({
        scenario: scenarioId,
        behavior_category: scenario.mapping.behavior_category,
        intent_perilaku: scenario.mapping.intent_perilaku,
        pattern_trigger: scenario.mapping.pattern_trigger,
        mode_respons: scenario.mapping.suggested_mode,
        severity_level: scenario.mapping.default_severity
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">Langkah 1 — Pilih Skenario</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pilih jenis masalah yang ingin ditangani. Sistem akan otomatis memetakan ke kategori yang tepat.
        </p>
      </div>

      {/* Scenario Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {scenarioCards.map((scenario) => (
          <Card
            key={scenario.id}
            className={`cursor-pointer transition-all duration-200 border-2 ${
              data.scenario === scenario.id
                ? "border-button-hover bg-button-hover/10 ring-2 ring-button-hover/30"
                : "border-border hover:border-button-hover/50 hover:bg-muted"
            }`}
            onClick={() => handleScenarioSelect(scenario.id)}
          >
            <CardContent className="p-6 text-center">
              <div className="text-4xl mb-2">{scenario.icon}</div>
              <h3 className="font-semibold text-foreground text-sm">{scenario.label}</h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {scenario.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Auto-mapped Info */}
      {data.scenario && (
        <Card className="border-button-hover/30 bg-card">
          <CardContent className="p-6">
            <h4 className="text-sm font-medium text-button-hover mb-2">Auto-Mapping Aktif</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Kategori:</span>
                <span className="ml-1 text-foreground">{data.behavior_category}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Intent:</span>
                <span className="ml-1 text-foreground">{data.intent_perilaku}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Mode:</span>
                <span className="ml-1 text-foreground">{data.mode_respons}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Severity:</span>
                <span className="ml-1 text-foreground">{data.severity_level}/5</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
