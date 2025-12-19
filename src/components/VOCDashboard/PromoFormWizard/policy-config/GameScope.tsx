import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { GameScopeData, GAME_CATEGORIES } from "./types";

interface GameScopeProps {
  data: GameScopeData;
  onChange: (updates: Partial<GameScopeData>) => void;
}

export function GameScope({ data, onChange }: GameScopeProps) {
  const handleApplicableToggle = (game: string, checked: boolean) => {
    const newGames = checked
      ? [...data.applicable_games, game]
      : data.applicable_games.filter((g) => g !== game);
    onChange({ applicable_games: newGames });
  };

  const handleExcludedToggle = (game: string, checked: boolean) => {
    const newGames = checked
      ? [...data.excluded_games, game]
      : data.excluded_games.filter((g) => g !== game);
    onChange({ excluded_games: newGames });
  };

  return (
    <div className="space-y-4 pt-4">
      {/* Berlaku Untuk */}
      <div className="space-y-2">
        <Label>Berlaku Untuk</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {GAME_CATEGORIES.map((cat) => (
            <div key={cat.value} className="flex items-center space-x-2">
              <Checkbox
                id={`applicable-${cat.value}`}
                checked={data.applicable_games.includes(cat.value)}
                onCheckedChange={(checked) => handleApplicableToggle(cat.value, checked as boolean)}
              />
              <Label htmlFor={`applicable-${cat.value}`} className="cursor-pointer font-normal text-sm">
                {cat.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Game yang Dikecualikan */}
      <div className="space-y-2">
        <Label>Game yang Dikecualikan</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {GAME_CATEGORIES.filter((c) => c.value !== 'all').map((cat) => (
            <div key={cat.value} className="flex items-center space-x-2">
              <Checkbox
                id={`excluded-${cat.value}`}
                checked={data.excluded_games.includes(cat.value)}
                onCheckedChange={(checked) => handleExcludedToggle(cat.value, checked as boolean)}
              />
              <Label htmlFor={`excluded-${cat.value}`} className="cursor-pointer font-normal text-sm">
                {cat.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Catatan Scope */}
      <div className="space-y-2">
        <Label htmlFor="scope_notes">Catatan Scope</Label>
        <Textarea
          id="scope_notes"
          value={data.scope_notes}
          onChange={(e) => onChange({ scope_notes: e.target.value })}
          placeholder="Catatan tambahan tentang cakupan game..."
          rows={3}
        />
      </div>
    </div>
  );
}
