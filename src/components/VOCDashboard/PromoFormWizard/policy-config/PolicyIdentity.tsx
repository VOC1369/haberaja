import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PolicyIdentityData, POLICY_TYPES, POLICY_STATUS } from "./types";

interface PolicyIdentityProps {
  data: PolicyIdentityData;
  onChange: (updates: Partial<PolicyIdentityData>) => void;
}

export function PolicyIdentity({ data, onChange }: PolicyIdentityProps) {
  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Nama Policy */}
        <div className="space-y-2">
          <Label htmlFor="policy_name">
            Nama Policy <span className="text-destructive">*</span>
          </Label>
          <Input
            id="policy_name"
            value={data.policy_name}
            onChange={(e) => onChange({ policy_name: e.target.value })}
            placeholder="e.g., Deposit Pulsa Tanpa Potongan"
          />
        </div>

        {/* Tipe Policy */}
        <div className="space-y-2">
          <Label>Tipe Policy</Label>
          <Select
            value={data.policy_type}
            onValueChange={(value) => onChange({ policy_type: value as PolicyIdentityData['policy_type'] })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih tipe policy" />
            </SelectTrigger>
            <SelectContent>
              {POLICY_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={data.status}
            onValueChange={(value) => onChange({ status: value as PolicyIdentityData['status'] })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih status" />
            </SelectTrigger>
            <SelectContent>
              {POLICY_STATUS.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Client/Brand */}
        <div className="space-y-2">
          <Label htmlFor="client_id">Client/Brand</Label>
          <Input
            id="client_id"
            value={data.client_id}
            onChange={(e) => onChange({ client_id: e.target.value })}
            placeholder="Nama brand"
          />
        </div>
      </div>
    </div>
  );
}
