import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { UsageRequirementsData, GameRequirement, REQUIREMENT_TYPES, GAME_CATEGORIES } from "./types";

interface UsageRequirementsProps {
  data: UsageRequirementsData;
  onChange: (updates: Partial<UsageRequirementsData>) => void;
}

export function UsageRequirements({ data, onChange }: UsageRequirementsProps) {
  const addGameRequirement = () => {
    const newReq: GameRequirement = {
      id: Date.now().toString(),
      game_category: 'all',
      credit_multiplier: '',
      max_bet_rule: '',
    };
    onChange({ game_requirements: [...data.game_requirements, newReq] });
  };

  const removeGameRequirement = (id: string) => {
    onChange({ game_requirements: data.game_requirements.filter((r) => r.id !== id) });
  };

  const updateGameRequirement = (id: string, updates: Partial<GameRequirement>) => {
    onChange({
      game_requirements: data.game_requirements.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    });
  };

  return (
    <div className="space-y-4 pt-4">
      {/* Requirement Type */}
      <div className="space-y-2">
        <Label>Requirement Type</Label>
        <Select
          value={data.requirement_type}
          onValueChange={(value) => onChange({ requirement_type: value as UsageRequirementsData['requirement_type'] })}
        >
          <SelectTrigger className="w-full md:w-1/2">
            <SelectValue placeholder="Pilih tipe" />
          </SelectTrigger>
          <SelectContent>
            {REQUIREMENT_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Game-Specific Requirements */}
      {data.requirement_type !== 'none' && (
        <div className="space-y-3">
          <Label>Game-Specific Requirements</Label>
          
          {data.game_requirements.map((req) => (
            <div
              key={req.id}
              className="p-4 border border-border rounded-lg bg-muted/30 space-y-3"
            >
              <div className="flex items-center justify-between">
                <Select
                  value={req.game_category}
                  onValueChange={(value) => updateGameRequirement(req.id, { game_category: value })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Kategori Game" />
                  </SelectTrigger>
                  <SelectContent>
                    {GAME_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeGameRequirement(req.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Requirement</Label>
                  <Input
                    value={req.credit_multiplier}
                    onChange={(e) => updateGameRequirement(req.id, { credit_multiplier: e.target.value })}
                    placeholder="e.g., 5x Jumlah Credit"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Max Bet Rule</Label>
                  <Input
                    value={req.max_bet_rule}
                    onChange={(e) => updateGameRequirement(req.id, { max_bet_rule: e.target.value })}
                    placeholder="e.g., Tidak boleh lebih dari nilai Deposit"
                  />
                </div>
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={addGameRequirement}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Tambah Kategori Game
          </Button>
        </div>
      )}
    </div>
  );
}
