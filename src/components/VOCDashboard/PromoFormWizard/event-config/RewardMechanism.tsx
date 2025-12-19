import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { FileText } from "lucide-react";

export interface RewardMechanismData {
  tipe_reward: string[];
  mekanisme_distribusi: string;
  min_deposit: string;
  turnover: string;
  batas_klaim: string;
  syarat_tambahan: string;
}

interface RewardMechanismProps {
  data: RewardMechanismData;
  onChange: (updates: Partial<RewardMechanismData>) => void;
}

const REWARD_TYPES = [
  { id: "bonus", label: "Bonus" },
  { id: "free_spin", label: "Free Spin" },
  { id: "point", label: "Point" },
  { id: "voucher", label: "Voucher" },
  { id: "non_monetary", label: "Non-monetary (badge, ranking)" },
];

export function RewardMechanism({ data, onChange }: RewardMechanismProps) {
  const handleRewardTypeToggle = (typeId: string) => {
    const current = data.tipe_reward || [];
    const updated = current.includes(typeId)
      ? current.filter((t) => t !== typeId)
      : [...current, typeId];
    onChange({ tipe_reward: updated });
  };

  return (
    <div className="space-y-6">
      {/* Sub-section 3.1: Tipe Reward */}
      <Card className="p-6 bg-card border-border">
        <h4 className="text-sm font-semibold text-foreground mb-4">
          Tipe Reward
        </h4>
        <div className="flex flex-wrap gap-4">
          {REWARD_TYPES.map((type) => (
            <div key={type.id} className="flex items-center space-x-2">
              <Checkbox
                id={type.id}
                checked={(data.tipe_reward || []).includes(type.id)}
                onCheckedChange={() => handleRewardTypeToggle(type.id)}
              />
              <Label
                htmlFor={type.id}
                className="text-sm font-normal cursor-pointer"
              >
                {type.label}
              </Label>
            </div>
          ))}
        </div>
      </Card>

      {/* Sub-section 3.2: Mekanisme */}
      <Card className="p-6 bg-card border-border">
        <h4 className="text-sm font-semibold text-foreground mb-4">
          Mekanisme Distribusi
        </h4>
        <Select
          value={data.mekanisme_distribusi}
          onValueChange={(value) => onChange({ mekanisme_distribusi: value })}
        >
          <SelectTrigger className="bg-muted">
            <SelectValue placeholder="Pilih mekanisme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed">Fixed</SelectItem>
            <SelectItem value="tier">Tier</SelectItem>
            <SelectItem value="conditional">Conditional</SelectItem>
            <SelectItem value="random">Random/Undian</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      {/* Sub-section 3.3: Syarat Utama */}
      <Card className="p-6 bg-card border-border">
        <h4 className="text-sm font-semibold text-foreground mb-4">
          Syarat Utama
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              Min Deposit
            </Label>
            <Input
              value={data.min_deposit}
              onChange={(e) => onChange({ min_deposit: e.target.value })}
              placeholder="Contoh: Rp 50.000"
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              TO / Wagering
            </Label>
            <Input
              value={data.turnover}
              onChange={(e) => onChange({ turnover: e.target.value })}
              placeholder="Contoh: 5x TO"
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              Batas Klaim
            </Label>
            <Input
              value={data.batas_klaim}
              onChange={(e) => onChange({ batas_klaim: e.target.value })}
              placeholder="Contoh: 1x per user"
              className="bg-muted"
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Syarat Tambahan
          </Label>
          <Textarea
            value={data.syarat_tambahan}
            onChange={(e) => onChange({ syarat_tambahan: e.target.value })}
            placeholder="Syarat dan ketentuan lain yang berlaku..."
            className="bg-muted min-h-[80px]"
          />
        </div>
      </Card>

      {/* Sub-section 3.4: Disclaimer (Locked) */}
      <Card className="p-6 bg-muted/50 border-border">
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">
              Disclaimer Otomatis
            </h4>
            <p className="text-sm text-muted-foreground italic">
              "Syarat dan ketentuan berlaku. Keputusan [BRAND] bersifat mutlak
              dan tidak dapat diganggu gugat."
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Template ini tidak dapat diedit.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
