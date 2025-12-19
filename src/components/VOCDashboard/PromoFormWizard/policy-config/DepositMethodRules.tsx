import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { DepositMethodRulesData, DEPOSIT_METHODS } from "./types";

interface DepositMethodRulesProps {
  data: DepositMethodRulesData;
  onChange: (updates: Partial<DepositMethodRulesData>) => void;
}

export function DepositMethodRules({ data, onChange }: DepositMethodRulesProps) {
  const handleMethodToggle = (method: string, checked: boolean) => {
    const newMethods = checked
      ? [...data.deposit_methods, method]
      : data.deposit_methods.filter((m) => m !== method);
    onChange({ deposit_methods: newMethods });
  };

  return (
    <div className="space-y-4 pt-4">
      {/* Metode Deposit */}
      <div className="space-y-2">
        <Label>Metode Deposit</Label>
        <div className="flex flex-wrap gap-4">
          {DEPOSIT_METHODS.map((method) => (
            <div key={method.value} className="flex items-center space-x-2">
              <Checkbox
                id={`deposit-${method.value}`}
                checked={data.deposit_methods.includes(method.value)}
                onCheckedChange={(checked) => handleMethodToggle(method.value, checked as boolean)}
              />
              <Label htmlFor={`deposit-${method.value}`} className="cursor-pointer font-normal">
                {method.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Provider yang Diterima */}
      <div className="space-y-2">
        <Label htmlFor="accepted_providers">Provider yang Diterima</Label>
        <Input
          id="accepted_providers"
          value={data.accepted_providers}
          onChange={(e) => onChange({ accepted_providers: e.target.value })}
          placeholder="e.g., Telkomsel, XL, Axis"
        />
      </div>

      {/* Min/Max Deposit */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="minimal_deposit">Minimal Deposit</Label>
          <Input
            id="minimal_deposit"
            value={data.minimal_deposit}
            onChange={(e) => onChange({ minimal_deposit: e.target.value })}
            placeholder="e.g., Rp 5.000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maximal_deposit">Maksimal Deposit</Label>
          <Input
            id="maximal_deposit"
            value={data.maximal_deposit}
            onChange={(e) => onChange({ maximal_deposit: e.target.value })}
            placeholder="e.g., Tidak ada batasan"
          />
        </div>
      </div>

      {/* Konfirmasi Wajib */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="confirmation_required">Konfirmasi Wajib</Label>
          <Switch
            id="confirmation_required"
            checked={data.confirmation_required}
            onCheckedChange={(checked) => onChange({ confirmation_required: checked })}
          />
        </div>
        {data.confirmation_required && (
          <div className="space-y-2">
            <Label htmlFor="confirmation_method">Metode Konfirmasi</Label>
            <Input
              id="confirmation_method"
              value={data.confirmation_method}
              onChange={(e) => onChange({ confirmation_method: e.target.value })}
              placeholder="e.g., Via Live Chat"
            />
          </div>
        )}
      </div>
    </div>
  );
}
