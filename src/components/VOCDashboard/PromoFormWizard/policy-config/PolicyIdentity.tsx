import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PolicyIdentityData, POLICY_SUBTYPES } from "./types";

interface PolicyIdentityProps {
  data: PolicyIdentityData;
  onChange: (updates: Partial<PolicyIdentityData>) => void;
}

export function PolicyIdentity({ data, onChange }: PolicyIdentityProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Policy Name */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Nama Policy <span className="text-destructive">*</span>
          </Label>
          <Input
            className="bg-muted"
            placeholder="Contoh: LOYALTY POINT CITRA77"
            value={data.policy_name}
            onChange={(e) => onChange({ policy_name: e.target.value })}
          />
        </div>

        {/* Policy Subtype */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Tipe Policy <span className="text-destructive">*</span>
          </Label>
          <Select
            value={data.policy_subtype}
            onValueChange={(v) => onChange({ policy_subtype: v as PolicyIdentityData['policy_subtype'] })}
          >
            <SelectTrigger className="bg-muted">
              <SelectValue placeholder="Pilih tipe policy" />
            </SelectTrigger>
            <SelectContent>
              {POLICY_SUBTYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Client ID */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          Client ID <span className="text-destructive">*</span>
        </Label>
        <Input
          className="bg-muted"
          placeholder="Contoh: CITRA77"
          value={data.client_id}
          onChange={(e) => onChange({ client_id: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Identifier klien/brand yang menggunakan policy ini
        </p>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          Deskripsi Policy
        </Label>
        <Textarea
          className="bg-muted min-h-[100px]"
          placeholder="Jelaskan secara singkat tentang policy ini..."
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>

      {/* Active Status */}
      <div className="flex items-center gap-3 pt-2">
        <Switch
          checked={data.is_active}
          onCheckedChange={(v) => onChange({ is_active: v })}
        />
        <span className="text-sm text-muted-foreground">
          Status: {data.is_active ? 'Aktif' : 'Tidak Aktif'}
        </span>
      </div>
    </div>
  );
}
