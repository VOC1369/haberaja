import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, X, Clock } from "lucide-react";

export interface ChannelActivationData {
  channels: {
    telegram: boolean;
    whatsapp: boolean;
    instagram: boolean;
  };
  website: {
    banner: boolean;
    popup: boolean;
    landing_section: boolean;
  };
  ads_support: boolean;
  creative_code: string;
  jadwal_posting: string[];
  checklist_status: {
    telegram: boolean;
    whatsapp: boolean;
    instagram: boolean;
    banner: boolean;
    popup: boolean;
    landing_section: boolean;
  };
}

interface ChannelActivationProps {
  data: ChannelActivationData;
  onChange: (updates: Partial<ChannelActivationData>) => void;
}

export function ChannelActivation({ data, onChange }: ChannelActivationProps) {
  const [newSchedule, setNewSchedule] = useState("");

  const handleChannelChange = (channel: keyof ChannelActivationData["channels"], value: boolean) => {
    onChange({
      channels: { ...data.channels, [channel]: value },
    });
  };

  const handleWebsiteChange = (placement: keyof ChannelActivationData["website"], value: boolean) => {
    onChange({
      website: { ...data.website, [placement]: value },
    });
  };

  const handleChecklistChange = (key: keyof ChannelActivationData["checklist_status"], value: boolean) => {
    onChange({
      checklist_status: { ...data.checklist_status, [key]: value },
    });
  };

  const addSchedule = () => {
    if (newSchedule.trim()) {
      onChange({
        jadwal_posting: [...(data.jadwal_posting || []), newSchedule.trim()],
      });
      setNewSchedule("");
    }
  };

  const removeSchedule = (index: number) => {
    onChange({
      jadwal_posting: (data.jadwal_posting || []).filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      {/* Sub-section 4.1: Community Channels */}
      <Card className="p-6 bg-card border-border">
        <h4 className="text-sm font-semibold text-foreground mb-4">
          Community Channels
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Telegram */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={data.channels?.telegram}
                onCheckedChange={(checked) =>
                  handleChannelChange("telegram", checked as boolean)
                }
              />
              <span className="text-sm">Telegram</span>
            </div>
            <Badge
              variant={data.checklist_status?.telegram ? "default" : "secondary"}
              className={data.checklist_status?.telegram ? "bg-success text-success-foreground" : ""}
            >
              {data.checklist_status?.telegram ? "Sudah Live" : "Belum"}
            </Badge>
          </div>

          {/* WhatsApp */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={data.channels?.whatsapp}
                onCheckedChange={(checked) =>
                  handleChannelChange("whatsapp", checked as boolean)
                }
              />
              <span className="text-sm">WhatsApp</span>
            </div>
            <Badge
              variant={data.checklist_status?.whatsapp ? "default" : "secondary"}
              className={data.checklist_status?.whatsapp ? "bg-success text-success-foreground" : ""}
            >
              {data.checklist_status?.whatsapp ? "Sudah Live" : "Belum"}
            </Badge>
          </div>

          {/* Instagram */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={data.channels?.instagram}
                onCheckedChange={(checked) =>
                  handleChannelChange("instagram", checked as boolean)
                }
              />
              <span className="text-sm">Instagram</span>
            </div>
            <Badge
              variant={data.checklist_status?.instagram ? "default" : "secondary"}
              className={data.checklist_status?.instagram ? "bg-success text-success-foreground" : ""}
            >
              {data.checklist_status?.instagram ? "Sudah Live" : "Belum"}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Sub-section 4.2: Website Placement */}
      <Card className="p-6 bg-card border-border">
        <h4 className="text-sm font-semibold text-foreground mb-4">
          Website Placement
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Banner */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={data.website?.banner}
                onCheckedChange={(checked) =>
                  handleWebsiteChange("banner", checked as boolean)
                }
              />
              <span className="text-sm">Banner</span>
            </div>
            <Badge
              variant={data.checklist_status?.banner ? "default" : "secondary"}
              className={data.checklist_status?.banner ? "bg-success text-success-foreground" : ""}
            >
              {data.checklist_status?.banner ? "Sudah Live" : "Belum"}
            </Badge>
          </div>

          {/* Pop-up */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={data.website?.popup}
                onCheckedChange={(checked) =>
                  handleWebsiteChange("popup", checked as boolean)
                }
              />
              <span className="text-sm">Pop-up</span>
            </div>
            <Badge
              variant={data.checklist_status?.popup ? "default" : "secondary"}
              className={data.checklist_status?.popup ? "bg-success text-success-foreground" : ""}
            >
              {data.checklist_status?.popup ? "Sudah Live" : "Belum"}
            </Badge>
          </div>

          {/* Landing Section */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={data.website?.landing_section}
                onCheckedChange={(checked) =>
                  handleWebsiteChange("landing_section", checked as boolean)
                }
              />
              <span className="text-sm">Landing Section</span>
            </div>
            <Badge
              variant={data.checklist_status?.landing_section ? "default" : "secondary"}
              className={data.checklist_status?.landing_section ? "bg-success text-success-foreground" : ""}
            >
              {data.checklist_status?.landing_section ? "Sudah Live" : "Belum"}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Sub-section 4.3: Ads Support */}
      <Card className="p-6 bg-card border-border">
        <h4 className="text-sm font-semibold text-foreground mb-4">
          Ads Support
        </h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-foreground">
              Aktifkan Ads Support
            </Label>
            <Switch
              checked={data.ads_support}
              onCheckedChange={(checked) => onChange({ ads_support: checked })}
            />
          </div>
          {data.ads_support && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                Creative Code/Tag
              </Label>
              <Input
                value={data.creative_code}
                onChange={(e) => onChange({ creative_code: e.target.value })}
                placeholder="Masukkan kode creative atau tag"
                className="bg-muted"
              />
            </div>
          )}
        </div>
      </Card>

      {/* Sub-section 4.4: Jadwal Posting */}
      <Card className="p-6 bg-card border-border">
        <h4 className="text-sm font-semibold text-foreground mb-4">
          Jadwal Posting
        </h4>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newSchedule}
              onChange={(e) => setNewSchedule(e.target.value)}
              placeholder="Contoh: Senin 10:00, Rabu 14:00"
              className="bg-muted"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={addSchedule}
              className="flex-shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {(data.jadwal_posting || []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(data.jadwal_posting || []).map((schedule, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="flex items-center gap-1 px-3 py-1"
                >
                  <Clock className="h-3 w-3" />
                  {schedule}
                  <button
                    onClick={() => removeSchedule(index)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
