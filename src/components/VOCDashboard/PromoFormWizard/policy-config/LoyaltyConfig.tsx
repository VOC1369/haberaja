import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { LoyaltyProgramData, ExchangeTier, EARNING_PERIODS } from "./types";
import { FormattedNumberInput } from "@/components/ui/formatted-number-input";

interface LoyaltyConfigProps {
  data: LoyaltyProgramData;
  onChange: (updates: Partial<LoyaltyProgramData>) => void;
}

export function LoyaltyConfig({ data, onChange }: LoyaltyConfigProps) {
  const addTier = () => {
    const newTier: ExchangeTier = {
      id: `tier_${Date.now()}`,
      lp_required: 0,
      reward_credit: 0,
      tier_name: '',
    };
    onChange({ exchange_tiers: [...data.exchange_tiers, newTier] });
  };

  const updateTier = (index: number, field: keyof ExchangeTier, value: number | string) => {
    const updated = [...data.exchange_tiers];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ exchange_tiers: updated });
  };

  const removeTier = (index: number) => {
    const updated = data.exchange_tiers.filter((_, i) => i !== index);
    onChange({ exchange_tiers: updated });
  };

  const addClaimStep = () => {
    onChange({ claim_steps: [...data.claim_steps, ''] });
  };

  const updateClaimStep = (index: number, value: string) => {
    const updated = [...data.claim_steps];
    updated[index] = value;
    onChange({ claim_steps: updated });
  };

  const removeClaimStep = (index: number) => {
    const updated = data.claim_steps.filter((_, i) => i !== index);
    onChange({ claim_steps: updated });
  };

  return (
    <div className="space-y-6">
      {/* Aturan Perolehan LP - Grid 2 kolom */}
      <div className="grid grid-cols-2 gap-4">
        {/* Kolom 4a - Turnover */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Turnover <span className="text-destructive">*</span>
          </Label>
          <FormattedNumberInput
            className="bg-muted"
            value={data.earning_to_amount || 1000}
            onChange={(val) => onChange({ earning_to_amount: val })}
          />
        </div>

        {/* Kolom 4b - Loyalty Point */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Loyalty Point <span className="text-destructive">*</span>
          </Label>
          <FormattedNumberInput
            className="bg-muted"
            value={data.earning_lp_amount || 1}
            onChange={(val) => onChange({ earning_lp_amount: val })}
          />
        </div>
      </div>

      {/* Periode Akumulasi */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          Periode Akumulasi
        </Label>
        <Select
          value={data.earning_period}
          onValueChange={(v) => onChange({ earning_period: v as LoyaltyProgramData['earning_period'] })}
        >
          <SelectTrigger className="bg-muted">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EARNING_PERIODS.map((period) => (
              <SelectItem key={period.value} value={period.value}>
                {period.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Accumulation Time */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          Waktu Akumulasi
        </Label>
        <Input
          className="bg-muted"
          placeholder="Contoh: 09:00 WIB"
          value={data.accumulation_time || ''}
          onChange={(e) => onChange({ accumulation_time: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Waktu reset perhitungan LP (opsional)
        </p>
      </div>

      {/* Exchange Tiers Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground">
            Exchange Tiers
          </Label>
          <Button variant="outline" size="sm" onClick={addTier}>
            <Plus className="h-4 w-4 mr-2" />
            Tambah Tier
          </Button>
        </div>

        {data.exchange_tiers.length > 0 ? (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-4 bg-muted px-4 py-2 border-b border-border">
              <span className="text-xs font-medium text-muted-foreground">Nama Tier</span>
              <span className="text-xs font-medium text-muted-foreground">LP Required</span>
              <span className="text-xs font-medium text-muted-foreground">Credit Reward</span>
              <span className="text-xs font-medium text-muted-foreground">Action</span>
            </div>

            {data.exchange_tiers.map((tier, idx) => (
              <div key={tier.id} className="grid grid-cols-4 px-4 py-2 border-b border-border last:border-b-0 items-center gap-2">
                <Input
                  className="bg-muted h-8"
                  placeholder="Tier 1"
                  value={tier.tier_name || ''}
                  onChange={(e) => updateTier(idx, 'tier_name', e.target.value)}
                />
                <FormattedNumberInput
                  className="bg-muted h-8"
                  placeholder="0"
                  value={tier.lp_required || 0}
                  onChange={(val) => updateTier(idx, 'lp_required', val)}
                />
                <FormattedNumberInput
                  className="bg-muted h-8"
                  placeholder="0"
                  value={tier.reward_credit || 0}
                  onChange={(val) => updateTier(idx, 'reward_credit', val)}
                />
                <Button variant="ghost" size="sm" onClick={() => removeTier(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Belum ada tier. Klik "Tambah Tier" untuk menambahkan.
            </p>
          </div>
        )}
      </div>

      {/* Claim Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Limit Klaim
          </Label>
          <Input
            className="bg-muted"
            placeholder="Contoh: 1x per bulan"
            value={data.claim_limit}
            onChange={(e) => onChange({ claim_limit: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Channel Klaim
          </Label>
          <Input
            className="bg-muted"
            placeholder="Contoh: APK only"
            value={data.claim_channel}
            onChange={(e) => onChange({ claim_channel: e.target.value })}
          />
        </div>
      </div>

      {/* Claim Steps */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground">
            Langkah Klaim
          </Label>
          <Button variant="outline" size="sm" onClick={addClaimStep}>
            <Plus className="h-4 w-4 mr-2" />
            Tambah Langkah
          </Button>
        </div>

        {data.claim_steps.length > 0 ? (
          <div className="space-y-2">
            {data.claim_steps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-6">{idx + 1}.</span>
                <Input
                  className="bg-muted flex-1"
                  placeholder="Contoh: Buka menu Loyalty Point"
                  value={step}
                  onChange={(e) => updateClaimStep(idx, e.target.value)}
                />
                <Button variant="ghost" size="sm" onClick={() => removeClaimStep(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Belum ada langkah klaim.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
