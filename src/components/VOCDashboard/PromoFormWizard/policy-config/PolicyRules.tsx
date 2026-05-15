import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { PolicyRulesData, PolicyRule, PolicyPenalty } from "./types";

interface PolicyRulesProps {
  data: PolicyRulesData;
  onChange: (updates: Partial<PolicyRulesData>) => void;
}

export function PolicyRules({ data, onChange }: PolicyRulesProps) {
  // Rules
  const addRule = () => {
    const newRule: PolicyRule = {
      id: `rule_${Date.now()}`,
      rule_text: '',
      is_penalty: false,
    };
    onChange({ rules: [...data.rules, newRule] });
  };

  const updateRule = (index: number, field: keyof PolicyRule, value: string | boolean) => {
    const updated = [...data.rules];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ rules: updated });
  };

  const removeRule = (index: number) => {
    const updated = data.rules.filter((_, i) => i !== index);
    onChange({ rules: updated });
  };

  // Penalties
  const addPenalty = () => {
    const newPenalty: PolicyPenalty = {
      id: `penalty_${Date.now()}`,
      violation: '',
      consequence: '',
    };
    onChange({ penalties: [...data.penalties, newPenalty] });
  };

  const updatePenalty = (index: number, field: keyof PolicyPenalty, value: string) => {
    const updated = [...data.penalties];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ penalties: updated });
  };

  const removePenalty = (index: number) => {
    const updated = data.penalties.filter((_, i) => i !== index);
    onChange({ penalties: updated });
  };

  return (
    <div className="space-y-6">
      {/* Rules List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium text-foreground">
              Daftar Aturan
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Aturan yang berlaku untuk policy ini
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={addRule}>
            <Plus className="h-4 w-4 mr-2" />
            Tambah Aturan
          </Button>
        </div>

        {data.rules.length > 0 ? (
          <div className="space-y-3">
            {data.rules.map((rule, idx) => (
              <div
                key={rule.id}
                className="p-4 rounded-lg border border-border bg-muted/30"
              >
                <div className="flex items-start gap-3">
                  <span className="text-sm text-muted-foreground w-6 pt-2">{idx + 1}.</span>
                  <div className="flex-1 space-y-3">
                    <Input
                      className="bg-muted"
                      placeholder="Tuliskan aturan..."
                      value={rule.rule_text}
                      onChange={(e) => updateRule(idx, 'rule_text', e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.is_penalty}
                        onCheckedChange={(v) => updateRule(idx, 'is_penalty', v)}
                      />
                      <span className="text-xs text-muted-foreground">
                        Tandai sebagai aturan penalti
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeRule(idx)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Belum ada aturan. Klik "Tambah Aturan" untuk menambahkan.
            </p>
          </div>
        )}
      </div>

      {/* Penalties Mapping */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium text-foreground">
              Pemetaan Penalti
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Konsekuensi untuk setiap pelanggaran
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={addPenalty}>
            <Plus className="h-4 w-4 mr-2" />
            Tambah Penalti
          </Button>
        </div>

        {data.penalties.length > 0 ? (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-5 bg-muted px-4 py-2 border-b border-border">
              <span className="text-xs font-medium text-muted-foreground col-span-2">Pelanggaran</span>
              <span className="text-xs font-medium text-muted-foreground col-span-2">Konsekuensi</span>
              <span className="text-xs font-medium text-muted-foreground">Action</span>
            </div>

            {data.penalties.map((penalty, idx) => (
              <div key={penalty.id} className="grid grid-cols-5 px-4 py-2 border-b border-border last:border-b-0 items-center gap-2">
                <Input
                  className="bg-muted h-8 col-span-2"
                  placeholder="Contoh: Bet melebihi limit"
                  value={penalty.violation}
                  onChange={(e) => updatePenalty(idx, 'violation', e.target.value)}
                />
                <Input
                  className="bg-muted h-8 col-span-2"
                  placeholder="Contoh: Bonus dibatalkan"
                  value={penalty.consequence}
                  onChange={(e) => updatePenalty(idx, 'consequence', e.target.value)}
                />
                <Button variant="ghost" size="sm" onClick={() => removePenalty(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Belum ada pemetaan penalti.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
