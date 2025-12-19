import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { DepositPolicyData, DEPOSIT_CHANNELS } from "./types";

interface DepositConfigProps {
  data: DepositPolicyData;
  onChange: (updates: Partial<DepositPolicyData>) => void;
}

export function DepositConfig({ data, onChange }: DepositConfigProps) {
  const toggleChannel = (channel: string) => {
    const updated = data.channels.includes(channel)
      ? data.channels.filter((c) => c !== channel)
      : [...data.channels, channel];
    onChange({ channels: updated });
  };

  const addRestriction = () => {
    onChange({ restrictions: [...data.restrictions, ''] });
  };

  const updateRestriction = (index: number, value: string) => {
    const updated = [...data.restrictions];
    updated[index] = value;
    onChange({ restrictions: updated });
  };

  const removeRestriction = (index: number) => {
    const updated = data.restrictions.filter((_, i) => i !== index);
    onChange({ restrictions: updated });
  };

  return (
    <div className="space-y-6">
      {/* Min/Max Deposit */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Minimum Deposit <span className="text-destructive">*</span>
          </Label>
          <Input
            type="number"
            className="bg-muted"
            placeholder="10000"
            value={data.min_deposit || ''}
            onChange={(e) => onChange({ min_deposit: parseInt(e.target.value) || 0 })}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Maximum Deposit
          </Label>
          <Input
            type="number"
            className="bg-muted"
            placeholder="Kosongkan jika tidak ada limit"
            value={data.max_deposit || ''}
            onChange={(e) => onChange({ max_deposit: e.target.value ? parseInt(e.target.value) : undefined })}
          />
        </div>
      </div>

      {/* Deposit Channels */}
      <div className="space-y-4">
        <Label className="text-sm font-medium text-foreground">
          Channel Deposit yang Berlaku
        </Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {DEPOSIT_CHANNELS.map((channel) => (
            <div
              key={channel.value}
              className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/50"
            >
              <Checkbox
                checked={data.channels.includes(channel.value)}
                onCheckedChange={() => toggleChannel(channel.value)}
              />
              <span className="text-sm text-foreground">{channel.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Potongan Percentage */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          Potongan / Rate (%)
        </Label>
        <Input
          type="number"
          className="bg-muted"
          placeholder="Contoh: 10 untuk 10% potongan"
          value={data.potongan_percentage || ''}
          onChange={(e) => onChange({ potongan_percentage: e.target.value ? parseFloat(e.target.value) : undefined })}
        />
        <p className="text-xs text-muted-foreground">
          Persentase potongan yang dikenakan (opsional)
        </p>
      </div>

      {/* Restrictions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground">
            Pembatasan Khusus
          </Label>
          <Button variant="outline" size="sm" onClick={addRestriction}>
            <Plus className="h-4 w-4 mr-2" />
            Tambah Pembatasan
          </Button>
        </div>

        {data.restrictions.length > 0 ? (
          <div className="space-y-2">
            {data.restrictions.map((restriction, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  className="bg-muted flex-1"
                  placeholder="Contoh: Tidak berlaku untuk deposit via pulsa Telkomsel"
                  value={restriction}
                  onChange={(e) => updateRestriction(idx, e.target.value)}
                />
                <Button variant="ghost" size="sm" onClick={() => removeRestriction(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Belum ada pembatasan khusus.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
