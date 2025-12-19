import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PenaltiesData, PENALTY_TYPES } from "./types";

interface PenaltiesConsequencesProps {
  data: PenaltiesData;
  onChange: (updates: Partial<PenaltiesData>) => void;
}

export function PenaltiesConsequences({ data, onChange }: PenaltiesConsequencesProps) {
  const handlePenaltyToggle = (penalty: string, checked: boolean) => {
    const newPenalties = checked
      ? [...data.selected_penalties, penalty]
      : data.selected_penalties.filter((p) => p !== penalty);
    onChange({ selected_penalties: newPenalties });
  };

  const showWithdrawFields = data.selected_penalties.includes('potongan_withdraw');

  return (
    <div className="space-y-4 pt-4">
      {/* Jenis Penalti */}
      <div className="space-y-2">
        <Label>Jenis Penalti</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PENALTY_TYPES.map((penalty) => (
            <div key={penalty.value} className="flex items-center space-x-2">
              <Checkbox
                id={`penalty-${penalty.value}`}
                checked={data.selected_penalties.includes(penalty.value)}
                onCheckedChange={(checked) => handlePenaltyToggle(penalty.value, checked as boolean)}
              />
              <Label htmlFor={`penalty-${penalty.value}`} className="cursor-pointer font-normal">
                {penalty.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Conditional fields for Potongan Withdraw */}
      {showWithdrawFields && (
        <div className="p-4 border border-amber-500/30 bg-amber-500/5 rounded-lg space-y-4">
          <Label className="text-amber-600">Detail Potongan Withdraw</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="withdraw_percentage">Persentase Potongan</Label>
              <div className="relative">
                <Input
                  id="withdraw_percentage"
                  type="number"
                  value={data.withdraw_percentage || ''}
                  onChange={(e) => onChange({ withdraw_percentage: Number(e.target.value) })}
                  placeholder="e.g., 50"
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="withdraw_minimum">Minimal untuk Potongan</Label>
              <Input
                id="withdraw_minimum"
                value={data.withdraw_minimum}
                onChange={(e) => onChange({ withdraw_minimum: e.target.value })}
                placeholder="e.g., Minimal Deposit 1.000.000 Baru Bisa Di Potong"
              />
            </div>
          </div>
        </div>
      )}

      {/* Detail Penalti */}
      <div className="space-y-2">
        <Label htmlFor="penalty_detail">Detail Penalti</Label>
        <Textarea
          id="penalty_detail"
          value={data.penalty_detail}
          onChange={(e) => onChange({ penalty_detail: e.target.value })}
          placeholder="Jelaskan detail penalti secara spesifik..."
          rows={3}
        />
      </div>
    </div>
  );
}
