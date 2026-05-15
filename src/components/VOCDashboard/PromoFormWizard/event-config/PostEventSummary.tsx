import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, CheckCircle, XCircle, MinusCircle } from "lucide-react";

export interface PostEventSummaryData {
  kpi_tercapai: string;
  catatan_performa: string;
  masalah_abuse: string;
  rekomendasi_next: string;
}

interface PostEventSummaryProps {
  data: PostEventSummaryData;
  onChange: (updates: Partial<PostEventSummaryData>) => void;
  onCloneEvent?: () => void;
}

export function PostEventSummary({
  data,
  onChange,
  onCloneEvent,
}: PostEventSummaryProps) {
  const getKPIIcon = (value: string) => {
    switch (value) {
      case "ya":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "tidak":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "sebagian":
        return <MinusCircle className="h-4 w-4 text-warning" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Tercapai */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          KPI Tercapai
        </Label>
        <Select
          value={data.kpi_tercapai}
          onValueChange={(value) => onChange({ kpi_tercapai: value })}
        >
          <SelectTrigger className="bg-muted">
            <div className="flex items-center gap-2">
              {getKPIIcon(data.kpi_tercapai)}
              <SelectValue placeholder="Pilih status KPI" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ya">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                Ya
              </div>
            </SelectItem>
            <SelectItem value="tidak">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                Tidak
              </div>
            </SelectItem>
            <SelectItem value="sebagian">
              <div className="flex items-center gap-2">
                <MinusCircle className="h-4 w-4 text-warning" />
                Sebagian
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Catatan Performa */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          Catatan Performa
        </Label>
        <Textarea
          value={data.catatan_performa}
          onChange={(e) => onChange({ catatan_performa: e.target.value })}
          placeholder="Evaluasi performa event secara keseluruhan..."
          className="bg-muted min-h-[100px]"
        />
      </div>

      {/* Masalah / Abuse */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          Masalah / Abuse
        </Label>
        <Textarea
          value={data.masalah_abuse}
          onChange={(e) => onChange({ masalah_abuse: e.target.value })}
          placeholder="Dokumentasi masalah atau abuse yang terjadi..."
          className="bg-muted min-h-[100px]"
        />
      </div>

      {/* Rekomendasi Next Event */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          Rekomendasi Next Event
        </Label>
        <Textarea
          value={data.rekomendasi_next}
          onChange={(e) => onChange({ rekomendasi_next: e.target.value })}
          placeholder="Saran perbaikan untuk event berikutnya..."
          className="bg-muted min-h-[100px]"
        />
      </div>

      {/* Clone Event Button */}
      <div className="pt-4 border-t border-border">
        <Button
          variant="outline"
          onClick={onCloneEvent}
          className="w-full md:w-auto"
        >
          <Copy className="h-4 w-4 mr-2" />
          Clone Event
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          Buat event baru dengan pengaturan yang sama sebagai template.
        </p>
      </div>
    </div>
  );
}
