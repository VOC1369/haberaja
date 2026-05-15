import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { PolicyScopeData } from "./types";

interface PolicyScopeProps {
  data: PolicyScopeData;
  onChange: (updates: Partial<PolicyScopeData>) => void;
}

export function PolicyScope({ data, onChange }: PolicyScopeProps) {
  // Affected Games
  const addAffectedGame = () => {
    onChange({ affected_games: [...data.affected_games, ''] });
  };

  const updateAffectedGame = (index: number, value: string) => {
    const updated = [...data.affected_games];
    updated[index] = value;
    onChange({ affected_games: updated });
  };

  const removeAffectedGame = (index: number) => {
    const updated = data.affected_games.filter((_, i) => i !== index);
    onChange({ affected_games: updated });
  };

  // Affected Providers
  const addAffectedProvider = () => {
    onChange({ affected_providers: [...data.affected_providers, ''] });
  };

  const updateAffectedProvider = (index: number, value: string) => {
    const updated = [...data.affected_providers];
    updated[index] = value;
    onChange({ affected_providers: updated });
  };

  const removeAffectedProvider = (index: number) => {
    const updated = data.affected_providers.filter((_, i) => i !== index);
    onChange({ affected_providers: updated });
  };

  return (
    <div className="space-y-6">
      {/* Effective Period */}
      <div className="space-y-4">
        <Label className="text-sm font-medium text-foreground">
          Periode Berlaku
        </Label>

        <div className="flex items-center gap-3 mb-4">
          <Switch
            checked={data.effective_unlimited}
            onCheckedChange={(v) => onChange({ effective_unlimited: v })}
          />
          <span className="text-sm text-muted-foreground">
            Berlaku tanpa batas waktu
          </span>
        </div>

        {!data.effective_unlimited && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                Tanggal Mulai
              </Label>
              <Input
                type="date"
                className="bg-muted"
                value={data.effective_from || ''}
                onChange={(e) => onChange({ effective_from: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                Tanggal Berakhir
              </Label>
              <Input
                type="date"
                className="bg-muted"
                value={data.effective_until || ''}
                onChange={(e) => onChange({ effective_until: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Affected Games */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium text-foreground">
              Game yang Terpengaruh
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Opsional - Kosongkan jika berlaku untuk semua game
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={addAffectedGame}>
            <Plus className="h-4 w-4 mr-2" />
            Tambah Game
          </Button>
        </div>

        {data.affected_games.length > 0 ? (
          <div className="space-y-2">
            {data.affected_games.map((game, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  className="bg-muted flex-1"
                  placeholder="Contoh: Sweet Bonanza"
                  value={game}
                  onChange={(e) => updateAffectedGame(idx, e.target.value)}
                />
                <Button variant="ghost" size="sm" onClick={() => removeAffectedGame(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Berlaku untuk semua game (tidak ada filter khusus).
            </p>
          </div>
        )}
      </div>

      {/* Affected Providers */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium text-foreground">
              Provider yang Terpengaruh
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Opsional - Kosongkan jika berlaku untuk semua provider
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={addAffectedProvider}>
            <Plus className="h-4 w-4 mr-2" />
            Tambah Provider
          </Button>
        </div>

        {data.affected_providers.length > 0 ? (
          <div className="space-y-2">
            {data.affected_providers.map((provider, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  className="bg-muted flex-1"
                  placeholder="Contoh: Pragmatic Play"
                  value={provider}
                  onChange={(e) => updateAffectedProvider(idx, e.target.value)}
                />
                <Button variant="ghost" size="sm" onClick={() => removeAffectedProvider(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Berlaku untuk semua provider (tidak ada filter khusus).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
