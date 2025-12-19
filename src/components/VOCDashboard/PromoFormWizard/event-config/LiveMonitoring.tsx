import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Info, Users, Gift, AlertTriangle } from "lucide-react";

export interface LiveMonitoringData {
  status_event: string;
  estimasi_partisipan: number;
  klaim_masuk: number;
  catatan_anomali: string;
}

interface LiveMonitoringProps {
  data: LiveMonitoringData;
  onChange: (updates: Partial<LiveMonitoringData>) => void;
}

export function LiveMonitoring({ data, onChange }: LiveMonitoringProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Live":
        return (
          <Badge className="bg-success text-success-foreground animate-pulse">
            Live
          </Badge>
        );
      case "Paused":
        return (
          <Badge className="bg-warning text-warning-foreground">Paused</Badge>
        );
      case "Ended":
        return <Badge variant="secondary">Ended</Badge>;
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Info Badge */}
      <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-400">
          Data bersifat estimasi. Untuk analytics lengkap, gunakan dashboard
          terpisah.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Status Event */}
        <Card className="p-6 bg-card border-border">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Status Event
            </p>
            <div className="flex items-center gap-2">
              {getStatusBadge(data.status_event || "Draft")}
            </div>
          </div>
        </Card>

        {/* Estimasi Partisipan */}
        <Card className="p-6 bg-card border-border">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Est. Partisipan
            </p>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-button-hover" />
              <span className="text-2xl font-bold text-foreground">
                {(data.estimasi_partisipan || 0).toLocaleString("id-ID")}
              </span>
            </div>
          </div>
        </Card>

        {/* Klaim Masuk */}
        <Card className="p-6 bg-card border-border">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Klaim Masuk
            </p>
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-success" />
              <span className="text-2xl font-bold text-foreground">
                {(data.klaim_masuk || 0).toLocaleString("id-ID")}
              </span>
            </div>
          </div>
        </Card>

        {/* Anomaly Indicator */}
        <Card className="p-6 bg-card border-border">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Anomali
            </p>
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={`h-5 w-5 ${
                  data.catatan_anomali ? "text-warning" : "text-muted-foreground"
                }`}
              />
              <span className="text-sm text-foreground">
                {data.catatan_anomali ? "Ada catatan" : "Tidak ada"}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Catatan Anomali */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          Catatan Anomali
        </Label>
        <Textarea
          value={data.catatan_anomali}
          onChange={(e) => onChange({ catatan_anomali: e.target.value })}
          placeholder="Catat jika ada aktivitas mencurigakan atau anomali..."
          className="bg-muted min-h-[100px]"
        />
      </div>
    </div>
  );
}
