import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "lucide-react";

export interface EventHeaderData {
  nama_event: string;
  tipe_event: string;
  status: string;
  periode_start: string;
  periode_end: string;
  owner_event: string;
}

interface EventHeaderProps {
  data: EventHeaderData;
  onChange: (updates: Partial<EventHeaderData>) => void;
}

export function EventHeader({ data, onChange }: EventHeaderProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Nama Event */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Nama Event <span className="text-destructive">*</span>
          </Label>
          <Input
            value={data.nama_event}
            onChange={(e) => onChange({ nama_event: e.target.value })}
            placeholder="Contoh: Lucky Box Natal 2024"
            className="bg-muted"
          />
        </div>

        {/* Tipe Event */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Tipe Event
          </Label>
          <Select
            value={data.tipe_event}
            onValueChange={(value) => onChange({ tipe_event: value })}
          >
            <SelectTrigger className="bg-muted">
              <SelectValue placeholder="Pilih tipe event" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="community">Community</SelectItem>
              <SelectItem value="promo">Promo</SelectItem>
              <SelectItem value="retention">Retention</SelectItem>
              <SelectItem value="traffic">Traffic</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Status</Label>
          <Select
            value={data.status}
            onValueChange={(value) => onChange({ status: value })}
          >
            <SelectTrigger className="bg-muted">
              <SelectValue placeholder="Pilih status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Owner Event */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Owner Event (PIC)
          </Label>
          <Input
            value={data.owner_event}
            onChange={(e) => onChange({ owner_event: e.target.value })}
            placeholder="Nama PIC"
            className="bg-muted"
          />
        </div>

        {/* Periode Event - Start */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Periode Mulai
          </Label>
          <div className="relative">
            <Input
              type="date"
              value={data.periode_start}
              onChange={(e) => onChange({ periode_start: e.target.value })}
              className="bg-muted"
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Periode Event - End */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Periode Selesai
          </Label>
          <div className="relative">
            <Input
              type="date"
              value={data.periode_end}
              onChange={(e) => onChange({ periode_end: e.target.value })}
              className="bg-muted"
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
