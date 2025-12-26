import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { BettingRestrictionData } from "./types";
import { FormattedNumberInput } from "@/components/ui/formatted-number-input";

interface BettingConfigProps {
  data: BettingRestrictionData;
  onChange: (updates: Partial<BettingRestrictionData>) => void;
}

export function BettingConfig({ data, onChange }: BettingConfigProps) {
  // Excluded Games
  const addExcludedGame = () => {
    onChange({ excluded_games: [...data.excluded_games, ''] });
  };

  const updateExcludedGame = (index: number, value: string) => {
    const updated = [...data.excluded_games];
    updated[index] = value;
    onChange({ excluded_games: updated });
  };

  const removeExcludedGame = (index: number) => {
    const updated = data.excluded_games.filter((_, i) => i !== index);
    onChange({ excluded_games: updated });
  };

  // Excluded Providers
  const addExcludedProvider = () => {
    onChange({ excluded_providers: [...data.excluded_providers, ''] });
  };

  const updateExcludedProvider = (index: number, value: string) => {
    const updated = [...data.excluded_providers];
    updated[index] = value;
    onChange({ excluded_providers: updated });
  };

  const removeExcludedProvider = (index: number) => {
    const updated = data.excluded_providers.filter((_, i) => i !== index);
    onChange({ excluded_providers: updated });
  };

  // Affected Bonus Types
  const addAffectedBonus = () => {
    onChange({ affected_bonus_types: [...data.affected_bonus_types, ''] });
  };

  const updateAffectedBonus = (index: number, value: string) => {
    const updated = [...data.affected_bonus_types];
    updated[index] = value;
    onChange({ affected_bonus_types: updated });
  };

  const removeAffectedBonus = (index: number) => {
    const updated = data.affected_bonus_types.filter((_, i) => i !== index);
    onChange({ affected_bonus_types: updated });
  };

  return (
    <div className="space-y-6">
      {/* Max Bet */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          Maximum Bet
        </Label>
        <FormattedNumberInput
          className="bg-muted"
          placeholder="100.000"
          value={data.max_bet || 0}
          onChange={(val) => onChange({ max_bet: val || undefined })}
        />
        <p className="text-xs text-muted-foreground">
          Maksimal taruhan per spin/round (kosongkan jika tidak ada limit)
        </p>
      </div>

      {/* Excluded Games */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground">
            Game yang Dikecualikan
          </Label>
          <Button variant="outline" size="sm" onClick={addExcludedGame}>
            <Plus className="h-4 w-4 mr-2" />
            Tambah Game
          </Button>
        </div>

        {data.excluded_games.length > 0 ? (
          <div className="space-y-2">
            {data.excluded_games.map((game, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  className="bg-muted flex-1"
                  placeholder="Contoh: Sweet Bonanza"
                  value={game}
                  onChange={(e) => updateExcludedGame(idx, e.target.value)}
                />
                <Button variant="ghost" size="sm" onClick={() => removeExcludedGame(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Belum ada game yang dikecualikan.
            </p>
          </div>
        )}
      </div>

      {/* Excluded Providers */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground">
            Provider yang Dikecualikan
          </Label>
          <Button variant="outline" size="sm" onClick={addExcludedProvider}>
            <Plus className="h-4 w-4 mr-2" />
            Tambah Provider
          </Button>
        </div>

        {data.excluded_providers.length > 0 ? (
          <div className="space-y-2">
            {data.excluded_providers.map((provider, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  className="bg-muted flex-1"
                  placeholder="Contoh: Pragmatic Play"
                  value={provider}
                  onChange={(e) => updateExcludedProvider(idx, e.target.value)}
                />
                <Button variant="ghost" size="sm" onClick={() => removeExcludedProvider(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Belum ada provider yang dikecualikan.
            </p>
          </div>
        )}
      </div>

      {/* Affected Bonus Types */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground">
            Bonus yang Terpengaruh
          </Label>
          <Button variant="outline" size="sm" onClick={addAffectedBonus}>
            <Plus className="h-4 w-4 mr-2" />
            Tambah Bonus
          </Button>
        </div>

        {data.affected_bonus_types.length > 0 ? (
          <div className="space-y-2">
            {data.affected_bonus_types.map((bonus, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  className="bg-muted flex-1"
                  placeholder="Contoh: Welcome Bonus"
                  value={bonus}
                  onChange={(e) => updateAffectedBonus(idx, e.target.value)}
                />
                <Button variant="ghost" size="sm" onClick={() => removeAffectedBonus(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Belum ada bonus yang terpengaruh.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
