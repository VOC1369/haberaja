import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";

export interface ObjectiveKPIData {
  tujuan_utama: string;
  kpi_engagement_rate: string;
  kpi_ndp_harian: string;
  kpi_traffic_lift: string;
  catatan_kpi: string;
}

interface ObjectiveKPIProps {
  data: ObjectiveKPIData;
  onChange: (updates: Partial<ObjectiveKPIData>) => void;
}

export function ObjectiveKPI({ data, onChange }: ObjectiveKPIProps) {
  return (
    <div className="space-y-6">
      {/* Info Badge */}
      <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
        <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
        <p className="text-sm text-warning">
          UI tidak menghitung KPI, hanya menyimpan target untuk evaluasi.
        </p>
      </div>

      <div className="space-y-6">
        {/* Tujuan Utama */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Tujuan Utama
          </Label>
          <Select
            value={data.tujuan_utama}
            onValueChange={(value) => onChange({ tujuan_utama: value })}
          >
            <SelectTrigger className="bg-muted">
              <SelectValue placeholder="Pilih tujuan utama" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="engagement">Engagement</SelectItem>
              <SelectItem value="aktivasi">Aktivasi</SelectItem>
              <SelectItem value="ndp">NDP</SelectItem>
              <SelectItem value="retention">Retention</SelectItem>
              <SelectItem value="traffic">Traffic</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* KPI Fields - Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* KPI: Engagement Rate */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              KPI: Engagement Rate
            </Label>
            <div className="relative">
              <Input
                type="number"
                value={data.kpi_engagement_rate}
                onChange={(e) =>
                  onChange({ kpi_engagement_rate: e.target.value })
                }
                placeholder="0"
                className="bg-muted pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                %
              </span>
            </div>
          </div>

          {/* KPI: NDP Harian */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              KPI: NDP Harian
            </Label>
            <Input
              type="number"
              value={data.kpi_ndp_harian}
              onChange={(e) => onChange({ kpi_ndp_harian: e.target.value })}
              placeholder="0"
              className="bg-muted"
            />
          </div>

          {/* KPI: Traffic Lift */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              KPI: Traffic Lift
            </Label>
            <div className="relative">
              <Input
                type="number"
                value={data.kpi_traffic_lift}
                onChange={(e) =>
                  onChange({ kpi_traffic_lift: e.target.value })
                }
                placeholder="0"
                className="bg-muted pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                %
              </span>
            </div>
          </div>
        </div>

        {/* Catatan KPI */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Catatan KPI
          </Label>
          <Textarea
            value={data.catatan_kpi}
            onChange={(e) => onChange({ catatan_kpi: e.target.value })}
            placeholder="Catatan tambahan untuk target KPI..."
            className="bg-muted min-h-[100px]"
          />
        </div>
      </div>
    </div>
  );
}
