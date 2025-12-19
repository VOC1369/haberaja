import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { WithdrawalPolicyData } from "./types";

interface WithdrawalConfigProps {
  data: WithdrawalPolicyData;
  onChange: (updates: Partial<WithdrawalPolicyData>) => void;
}

export function WithdrawalConfig({ data, onChange }: WithdrawalConfigProps) {
  const addRequirement = () => {
    onChange({ requirements: [...data.requirements, ''] });
  };

  const updateRequirement = (index: number, value: string) => {
    const updated = [...data.requirements];
    updated[index] = value;
    onChange({ requirements: updated });
  };

  const removeRequirement = (index: number) => {
    const updated = data.requirements.filter((_, i) => i !== index);
    onChange({ requirements: updated });
  };

  return (
    <div className="space-y-6">
      {/* Min/Max Withdrawal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Minimum Withdrawal <span className="text-destructive">*</span>
          </Label>
          <Input
            type="number"
            className="bg-muted"
            placeholder="50000"
            value={data.min_withdrawal || ''}
            onChange={(e) => onChange({ min_withdrawal: parseInt(e.target.value) || 0 })}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Maximum Withdrawal
          </Label>
          <Input
            type="number"
            className="bg-muted"
            placeholder="Kosongkan jika tidak ada limit"
            value={data.max_withdrawal || ''}
            onChange={(e) => onChange({ max_withdrawal: e.target.value ? parseInt(e.target.value) : undefined })}
          />
        </div>
      </div>

      {/* Daily Limit & Frequency */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Limit Harian
          </Label>
          <Input
            type="number"
            className="bg-muted"
            placeholder="Contoh: 50000000"
            value={data.daily_limit || ''}
            onChange={(e) => onChange({ daily_limit: e.target.value ? parseInt(e.target.value) : undefined })}
          />
          <p className="text-xs text-muted-foreground">
            Total maksimal WD per hari (opsional)
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Frekuensi Limit
          </Label>
          <Input
            className="bg-muted"
            placeholder="Contoh: 3x per hari"
            value={data.frequency_limit || ''}
            onChange={(e) => onChange({ frequency_limit: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Berapa kali boleh WD per periode (opsional)
          </p>
        </div>
      </div>

      {/* Requirements */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground">
            Syarat Withdrawal
          </Label>
          <Button variant="outline" size="sm" onClick={addRequirement}>
            <Plus className="h-4 w-4 mr-2" />
            Tambah Syarat
          </Button>
        </div>

        {data.requirements.length > 0 ? (
          <div className="space-y-2">
            {data.requirements.map((req, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-6">{idx + 1}.</span>
                <Input
                  className="bg-muted flex-1"
                  placeholder="Contoh: Minimal 1x TO sebelum WD"
                  value={req}
                  onChange={(e) => updateRequirement(idx, e.target.value)}
                />
                <Button variant="ghost" size="sm" onClick={() => removeRequirement(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Belum ada syarat withdrawal.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
