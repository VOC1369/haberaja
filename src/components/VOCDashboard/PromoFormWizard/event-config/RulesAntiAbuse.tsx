import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Info } from "lucide-react";

export interface RulesAntiAbuseData {
  max_klaim_per_user: string;
  excluded_user_types: string[];
  ip_device_limitation: boolean;
  admin_note: string;
}

interface RulesAntiAbuseProps {
  data: RulesAntiAbuseData;
  onChange: (updates: Partial<RulesAntiAbuseData>) => void;
}

const USER_TYPES = [
  { id: "new_member", label: "New Member" },
  { id: "vip", label: "VIP" },
  { id: "regular", label: "Regular" },
];

export function RulesAntiAbuse({ data, onChange }: RulesAntiAbuseProps) {
  const handleUserTypeToggle = (typeId: string) => {
    const current = data.excluded_user_types || [];
    const updated = current.includes(typeId)
      ? current.filter((t) => t !== typeId)
      : [...current, typeId];
    onChange({ excluded_user_types: updated });
  };

  return (
    <div className="space-y-6">
      {/* Info Badge */}
      <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-400">
          UI ini tidak mengeksekusi aturan, hanya referensi untuk legal & CS.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Max Klaim per User */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Max Klaim per User
          </Label>
          <Input
            type="number"
            value={data.max_klaim_per_user}
            onChange={(e) => onChange({ max_klaim_per_user: e.target.value })}
            placeholder="Contoh: 1"
            className="bg-muted"
          />
        </div>

        {/* IP / Device Limitation */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            IP / Device Limitation
          </Label>
          <div className="flex items-center gap-3 mt-2">
            <Switch
              checked={data.ip_device_limitation}
              onCheckedChange={(checked) =>
                onChange({ ip_device_limitation: checked })
              }
            />
            <span className="text-sm text-muted-foreground">
              {data.ip_device_limitation ? "Aktif" : "Tidak Aktif"}
            </span>
          </div>
        </div>
      </div>

      {/* Excluded User Types */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-foreground">
          Excluded User Type
        </Label>
        <div className="flex flex-wrap gap-4">
          {USER_TYPES.map((type) => (
            <div key={type.id} className="flex items-center space-x-2">
              <Checkbox
                id={`user-type-${type.id}`}
                checked={(data.excluded_user_types || []).includes(type.id)}
                onCheckedChange={() => handleUserTypeToggle(type.id)}
              />
              <Label
                htmlFor={`user-type-${type.id}`}
                className="text-sm font-normal cursor-pointer"
              >
                {type.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Admin Note */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          Admin Note
        </Label>
        <Textarea
          value={data.admin_note}
          onChange={(e) => onChange({ admin_note: e.target.value })}
          placeholder="Catatan internal untuk tim (tidak terlihat oleh user)"
          className="bg-muted min-h-[100px]"
        />
        <p className="text-xs text-muted-foreground">
          Catatan ini hanya terlihat oleh admin internal.
        </p>
      </div>
    </div>
  );
}
