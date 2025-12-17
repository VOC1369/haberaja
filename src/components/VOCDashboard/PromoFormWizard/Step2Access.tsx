import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, Layers, Clock, ChevronUp, ChevronDown, Save, ShieldAlert } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  PromoFormData,
  PLATFORM_ACCESS,
  GAME_RESTRICTIONS,
  GEO_RESTRICTIONS,
  STATUS_OPTIONS,
  PROMO_RISK_LEVELS,
} from "./types";
import { SelectWithAddNew, SelectOption } from "./SelectWithAddNew";

interface Step2Props {
  data: PromoFormData;
  onChange: (data: Partial<PromoFormData>) => void;
  isEditingFromReview?: boolean;
  onSaveAndReturn?: () => void;
}

export function Step2Access({ data, onChange, isEditingFromReview, onSaveAndReturn }: Step2Props) {
  const [customPlatforms, setCustomPlatforms] = useState<SelectOption[]>([]);
  const [customGames, setCustomGames] = useState<SelectOption[]>([]);
  const [customStatuses, setCustomStatuses] = useState<SelectOption[]>([]);
  const [customGeos, setCustomGeos] = useState<SelectOption[]>([]);
  
  const [platformOpen, setPlatformOpen] = useState(true);
  const [periodeOpen, setPeriodeOpen] = useState(true);
  const [riskOpen, setRiskOpen] = useState(false);

  const platformOptions: SelectOption[] = [
    ...PLATFORM_ACCESS.map(p => ({ value: p.value, label: p.label })),
    ...customPlatforms,
  ];

  const gameOptions: SelectOption[] = [
    ...GAME_RESTRICTIONS.map(g => ({ value: g.value, label: g.label })),
    ...customGames,
  ];

  const statusOptions: SelectOption[] = [
    ...STATUS_OPTIONS.map(s => ({ value: s.value, label: s.label })),
    ...customStatuses,
  ];

  const geoOptions: SelectOption[] = [
    ...GEO_RESTRICTIONS.map(g => ({ value: g.value, label: g.label })),
    ...customGeos,
  ];

  const handleDeletePlatform = (value: string) => {
    setCustomPlatforms(customPlatforms.filter(p => p.value !== value));
  };

  const handleDeleteGame = (value: string) => {
    setCustomGames(customGames.filter(g => g.value !== value));
  };

  const handleDeleteStatus = (value: string) => {
    setCustomStatuses(customStatuses.filter(s => s.value !== value));
  };

  const handleDeleteGeo = (value: string) => {
    setCustomGeos(customGeos.filter(g => g.value !== value));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <div className="icon-circle">
          <Settings className="icon-circle-icon" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-button-hover">Step 2 — Batasan & Akses</h3>
          <p className="text-sm text-muted-foreground">
            Pengaturan platform, game, waktu, dan status promo
          </p>
        </div>
        <Badge variant="pending" size="sm" className="ml-auto">Wajib</Badge>
      </div>

      {/* Section: Akses Platform */}
      <Collapsible open={platformOpen} onOpenChange={setPlatformOpen}>
        <CollapsibleTrigger className="collapsible-trigger w-full">
          <div className="flex items-center gap-3">
            <Layers className="h-5 w-5 text-button-hover" />
            <div className="text-left">
              <div className="text-sm font-semibold text-button-hover">1. Akses Platform</div>
              <div className="text-xs text-muted-foreground">Atur di platform mana promo ini berlaku</div>
            </div>
          </div>
          {platformOpen ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="collapsible-content">
          <div className="space-y-2">
            <Label>Akses Platform *</Label>
            <SelectWithAddNew
              value={data.platform_access}
              onValueChange={(value) => onChange({ platform_access: value })}
              options={platformOptions}
              onAddOption={(option) => setCustomPlatforms([...customPlatforms, option])}
              onDeleteOption={handleDeletePlatform}
              placeholder="Pilih platform"
            />
            <p className="text-xs text-muted-foreground">
              Promo berlaku untuk platform apa
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Section: Periode & Status */}
      <Collapsible open={periodeOpen} onOpenChange={setPeriodeOpen}>
        <CollapsibleTrigger className="collapsible-trigger w-full">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-button-hover" />
            <div className="text-left">
              <div className="text-sm font-semibold text-button-hover">2. Periode & Status</div>
              <div className="text-xs text-muted-foreground">Atur kapan promo aktif</div>
            </div>
          </div>
          {periodeOpen ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="collapsible-content">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Tanggal Mulai *</Label>
                <Input
                  type="date"
                  value={data.valid_from}
                  onChange={(e) => onChange({ valid_from: e.target.value })}
                  placeholder="dd/mm/yyyy"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Tanggal Berakhir</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Unlimited</span>
                    <Switch 
                      checked={data.valid_until_unlimited || false}
                      onCheckedChange={(checked) => onChange({ 
                        valid_until_unlimited: checked,
                        valid_until: checked ? '' : data.valid_until 
                      })}
                    />
                  </div>
                </div>
                <Input
                  type="date"
                  value={data.valid_until}
                  onChange={(e) => onChange({ valid_until: e.target.value })}
                  placeholder="dd/mm/yyyy"
                  disabled={data.valid_until_unlimited}
                  className={data.valid_until_unlimited ? 'opacity-50' : ''}
                />
                <p className="text-xs text-muted-foreground">
                  {data.valid_until_unlimited ? 'Promo berlaku tanpa batas waktu' : 'Kosongkan jika tidak ada batas'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Status Promo *</Label>
                <SelectWithAddNew
                  value={data.status}
                  onValueChange={(value) => onChange({ status: value as 'active' | 'paused' | 'draft' | 'expired' })}
                  options={statusOptions}
                  onAddOption={(option) => setCustomStatuses([...customStatuses, option])}
                  onDeleteOption={handleDeleteStatus}
                  placeholder="Pilih status"
                />
                <p className="text-xs text-muted-foreground">
                  Status promo saat ini
                </p>
              </div>

              <div className="space-y-2">
                <Label>Wilayah Promo</Label>
                <SelectWithAddNew
                  value={data.geo_restriction}
                  onValueChange={(value) => onChange({ geo_restriction: value })}
                  options={geoOptions}
                  onAddOption={(option) => setCustomGeos([...customGeos, option])}
                  onDeleteOption={handleDeleteGeo}
                  placeholder="Pilih wilayah"
                />
                <p className="text-xs text-muted-foreground">
                  Promo berlaku untuk wilayah tertentu
                </p>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Wajib APK Toggle */}
      <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl">
        <Switch
          checked={data.require_apk}
          onCheckedChange={(checked) => onChange({ require_apk: checked })}
        />
        <div>
          <div className="font-medium text-sm text-button-hover">3. Wajib APK</div>
          <p className="text-xs text-muted-foreground">Wajib download APK dahulu untuk claim reward ini</p>
        </div>
      </div>

      {/* Section: Promo Risk Level */}
      <Collapsible open={riskOpen} onOpenChange={setRiskOpen}>
        <CollapsibleTrigger className="collapsible-trigger w-full">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-button-hover" />
            <div className="text-left">
              <div className="text-sm font-semibold text-button-hover">4. Tingkat Risiko Promo</div>
              <div className="text-xs text-muted-foreground">Atur level kehati-hatian AI</div>
            </div>
            <Badge variant="outline" size="sm" className="ml-auto">Opsional</Badge>
          </div>
          {riskOpen ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="collapsible-content">
          {/* Helper text */}
          <p className="text-sm text-muted-foreground mb-4">
            Pilih tingkat risiko promo ini untuk mengatur seberapa hati-hati AI 
            menjelaskannya ke user. Field ini tidak mempengaruhi perhitungan, 
            klaim, atau sistem backend.
          </p>
          
          {/* Radio button group */}
          <RadioGroup
            value={data.promo_risk_level || ''}
            onValueChange={(value) => onChange({ 
              promo_risk_level: value as 'no' | 'low' | 'medium' | 'high' 
            })}
            className="space-y-3"
          >
            {PROMO_RISK_LEVELS.map((level) => (
              <div key={level.value} className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                <RadioGroupItem value={level.value} id={`risk-${level.value}`} className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor={`risk-${level.value}`} className="font-medium cursor-pointer">
                    {level.label}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {level.helper}
                  </p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </CollapsibleContent>
      </Collapsible>

      {/* Simpan & Kembali Button (Edit Mode from Review) */}
      {isEditingFromReview && onSaveAndReturn && (
        <div className="flex justify-end pt-6">
          <Button 
            variant="golden" 
            onClick={onSaveAndReturn}
            className="rounded-full gap-2"
          >
            <Save className="h-4 w-4" />
            Simpan & Kembali
          </Button>
        </div>
      )}
    </div>
  );
}
