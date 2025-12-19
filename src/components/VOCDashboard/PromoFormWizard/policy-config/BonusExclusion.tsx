import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle } from "lucide-react";
import { BonusExclusionData } from "./types";

interface BonusExclusionProps {
  data: BonusExclusionData;
  onChange: (updates: Partial<BonusExclusionData>) => void;
}

export function BonusExclusion({ data, onChange }: BonusExclusionProps) {
  return (
    <div className="space-y-4 pt-4">
      {/* Warning Banner */}
      <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
        <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-600">
            Policy Program TIDAK memberikan bonus.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Centang bonus yang TIDAK berlaku untuk policy ini:
          </p>
        </div>
      </div>

      {/* Checkbox list */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="no_deposit_bonus"
            checked={data.no_deposit_bonus}
            onCheckedChange={(checked) => onChange({ no_deposit_bonus: checked as boolean })}
          />
          <Label htmlFor="no_deposit_bonus" className="cursor-pointer font-normal">
            Tidak dapat Bonus Deposit
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="no_newmember_bonus"
            checked={data.no_newmember_bonus}
            onCheckedChange={(checked) => onChange({ no_newmember_bonus: checked as boolean })}
          />
          <Label htmlFor="no_newmember_bonus" className="cursor-pointer font-normal">
            Tidak dapat Bonus New Member
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="no_daily_bonus"
            checked={data.no_daily_bonus}
            onCheckedChange={(checked) => onChange({ no_daily_bonus: checked as boolean })}
          />
          <Label htmlFor="no_daily_bonus" className="cursor-pointer font-normal">
            Tidak dapat Bonus Harian
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="only_weekly_bonus"
            checked={data.only_weekly_bonus}
            onCheckedChange={(checked) => onChange({ only_weekly_bonus: checked as boolean })}
          />
          <Label htmlFor="only_weekly_bonus" className="cursor-pointer font-normal">
            Hanya dapat Bonus Mingguan
          </Label>
        </div>
      </div>

      {/* Catatan Bonus */}
      <div className="space-y-2">
        <Label htmlFor="bonus_notes">Catatan Bonus</Label>
        <Textarea
          id="bonus_notes"
          value={data.bonus_notes}
          onChange={(e) => onChange({ bonus_notes: e.target.value })}
          placeholder="Catatan tambahan tentang status bonus..."
          rows={2}
        />
      </div>
    </div>
  );
}
