import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AuthorityData } from "./types";

interface AuthorityDisclaimerProps {
  data: AuthorityData;
  onChange: (updates: Partial<AuthorityData>) => void;
}

export function AuthorityDisclaimer({ data, onChange }: AuthorityDisclaimerProps) {
  return (
    <div className="space-y-4 pt-4">
      {/* Klausa Otoritas */}
      <div className="space-y-2">
        <Label htmlFor="authority_clause">Klausa Otoritas</Label>
        <Textarea
          id="authority_clause"
          value={data.authority_clause}
          onChange={(e) => onChange({ authority_clause: e.target.value })}
          placeholder="Semua keputusan dari [BRAND] adalah mutlak dan tidak dapat diganggu gugat."
          rows={3}
        />
      </div>

      {/* Syarat Dapat Berubah */}
      <div className="flex items-center justify-between p-4 bg-muted/30 border border-border rounded-lg">
        <div className="space-y-0.5">
          <Label htmlFor="terms_can_change">Syarat Dapat Berubah</Label>
          <p className="text-xs text-muted-foreground">
            Syarat dan Ketentuan dapat berubah sewaktu-waktu tanpa pemberitahuan lebih lanjut.
          </p>
        </div>
        <Switch
          id="terms_can_change"
          checked={data.terms_can_change}
          onCheckedChange={(checked) => onChange({ terms_can_change: checked })}
        />
      </div>
    </div>
  );
}
