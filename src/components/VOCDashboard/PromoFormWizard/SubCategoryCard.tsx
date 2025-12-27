import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ChevronDown, Save, Trash2, AlertTriangle, Calculator, X, Plus, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { PromoSubCategory, CALCULATION_BASES, CALCULATION_METHODS, DINAMIS_REWARD_TYPES, GAME_RESTRICTIONS, GAME_PROVIDERS, GAME_NAMES, TURNOVER_RULES } from "./types";
import { SelectWithAddNew, SelectOption } from "./SelectWithAddNew";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// Helper untuk format angka ke Rupiah Indonesia (dengan separator titik)
const formatRupiah = (value: number | undefined): string => {
  if (value === undefined || value === null || isNaN(value)) return '';
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// Helper untuk parse Rupiah string ke number
const parseRupiah = (value: string): number => {
  const cleaned = value.replace(/\./g, '');
  return parseInt(cleaned, 10) || 0;
};

function ExclusionRulesInput({
  rules,
  onChange
}: {
  rules: string[] | string;
  onChange: (rules: string[]) => void;
}) {
  const [newRule, setNewRule] = useState('');

  // Normalize rules to array (handle legacy string format)
  const normalizedRules = Array.isArray(rules) ? rules : rules ? [rules] : [];
  const handleAdd = () => {
    if (newRule.trim()) {
      onChange([...normalizedRules, newRule.trim()]);
      setNewRule('');
    }
  };
  return <div className="space-y-3">
      <Label>Aturan Pengecualian Khusus</Label>
      <div className="flex flex-wrap gap-2">
        {normalizedRules.map((rule, idx) => <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-sm text-foreground">
            {rule}
            <button type="button" onClick={() => {
          const updated = [...normalizedRules];
          updated.splice(idx, 1);
          onChange(updated);
        }} className="hover:text-destructive transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>)}
      </div>
      <div className="flex gap-2">
        <Input value={newRule} onChange={e => setNewRule(e.target.value)} placeholder="Contoh: Semua slot 3 line, old game slot" onKeyDown={e => {
        if (e.key === 'Enter' && newRule.trim()) {
          e.preventDefault();
          handleAdd();
        }
      }} />
        <Button type="button" variant="ghost" onClick={handleAdd} className="bg-muted text-muted-foreground hover:bg-button-hover hover:text-button-hover-foreground">
          <Plus className="h-4 w-4 mr-1" />
          Tambah
        </Button>
      </div>
    </div>;
}
interface SubCategoryCardProps {
  subCategory: PromoSubCategory;
  index: number;
  onChange: (updates: Partial<PromoSubCategory>) => void;
  onDelete: () => void;
  onSave: () => void;
  // Global toggles from parent - for display/info only now
  globalJenisHadiahEnabled?: boolean;
  globalMaxBonusEnabled?: boolean;
  globalPayoutDirectionEnabled?: boolean;
  // Callbacks to invert global toggles when sub-category toggle is ON
  onInvertGlobalJenisHadiah?: () => void;
  onInvertGlobalMaxBonus?: () => void;
  onInvertGlobalPayoutDirection?: () => void;
}
export function SubCategoryCard({
  subCategory,
  index,
  onChange,
  onDelete,
  onSave,
  globalJenisHadiahEnabled = true,
  globalMaxBonusEnabled = true,
  globalPayoutDirectionEnabled = true,
  onInvertGlobalJenisHadiah,
  onInvertGlobalMaxBonus,
  onInvertGlobalPayoutDirection
}: SubCategoryCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Helper to format number with thousand separators (Indonesian format: dots)
  const formatThousands = (num: number): string => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };
  
  // Helper to parse formatted number back to numeric value
  const parseFormattedNumber = (str: string): number => {
    // Remove thousand separators (dots) and convert comma to dot for decimal
    const cleaned = str.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  };

  const [calcValueInput, setCalcValueInput] = useState(() => {
    if (subCategory.calculation_value !== undefined && subCategory.calculation_value !== null && subCategory.calculation_value > 0) {
      // For percentage: show plain number (e.g., 25 or 0.5)
      // For fixed/threshold: show with thousand separators
      if (subCategory.calculation_method === 'percentage') {
        return String(subCategory.calculation_value).replace('.', ',');
      }
      return formatThousands(subCategory.calculation_value);
    }
    return '';
  });

  // State for Max Bonus input with thousand separators
  const [maxBonusInput, setMaxBonusInput] = useState(() => {
    if (subCategory.max_bonus !== undefined && subCategory.max_bonus !== null && subCategory.max_bonus > 0) {
      return formatThousands(subCategory.max_bonus);
    }
    return '';
  });

  // State for Minimal Perhitungan input with thousand separators
  const [minBaseInput, setMinBaseInput] = useState(() => {
    if (subCategory.minimum_base !== undefined && subCategory.minimum_base !== null && subCategory.minimum_base > 0) {
      return formatThousands(subCategory.minimum_base);
    }
    return '';
  });

  const [calcBaseOptions, setCalcBaseOptions] = useState<SelectOption[]>(CALCULATION_BASES.map(c => ({
    value: c.value,
    label: c.label
  })));
  const [calcMethodOptions, setCalcMethodOptions] = useState<SelectOption[]>(CALCULATION_METHODS.map(c => ({
    value: c.value,
    label: c.label
  })));
  const [dinamisRewardTypeOptions, setDinamisRewardTypeOptions] = useState<SelectOption[]>(DINAMIS_REWARD_TYPES.map(d => ({
    value: d.value,
    label: d.label
  })));
  const [turnoverRuleOptions, setTurnoverRuleOptions] = useState<SelectOption[]>(TURNOVER_RULES.map(r => ({
    value: r.value,
    label: r.label
  })));
  const [gameTypeOptions, setGameTypeOptions] = useState<SelectOption[]>(GAME_RESTRICTIONS.map(g => ({
    value: g.value,
    label: g.label
  })));
  const [gameProviderOptions, setGameProviderOptions] = useState<SelectOption[]>(GAME_PROVIDERS.map(p => ({
    value: p.value,
    label: p.label
  })));
  const [gameNameOptions, setGameNameOptions] = useState<SelectOption[]>(GAME_NAMES.map(n => ({
    value: n.value,
    label: n.label
  })));
  const [gameTypeBlacklistOptions, setGameTypeBlacklistOptions] = useState<SelectOption[]>([{
    value: 'tidak_ada',
    label: 'Tidak ada'
  }, ...GAME_RESTRICTIONS.map(g => ({
    value: g.value,
    label: g.label
  }))]);
  const [gameProviderBlacklistOptions, setGameProviderBlacklistOptions] = useState<SelectOption[]>([{
    value: 'tidak_ada',
    label: 'Tidak ada'
  }, ...GAME_PROVIDERS.map(p => ({
    value: p.value,
    label: p.label
  }))]);
  const [gameNameBlacklistOptions, setGameNameBlacklistOptions] = useState<SelectOption[]>([{
    value: 'tidak_ada',
    label: 'Tidak ada'
  }, ...GAME_NAMES.map(n => ({
    value: n.value,
    label: n.label
  }))]);

  // Reformat calcValueInput when calculation_method changes
  useEffect(() => {
    if (subCategory.calculation_value !== undefined && subCategory.calculation_value !== null && subCategory.calculation_value > 0) {
      if (subCategory.calculation_method === 'percentage') {
        // Format as decimal (use comma as separator)
        setCalcValueInput(String(subCategory.calculation_value).replace('.', ','));
      } else {
        // Format with thousand separator
        setCalcValueInput(formatThousands(subCategory.calculation_value));
      }
    } else {
      setCalcValueInput('');
    }
  }, [subCategory.calculation_method]);

  // Get list of overridden fields for visual indicator
  const getOverriddenFields = (): string[] => {
    const overrides: string[] = [];
    
    if (!subCategory.jenis_hadiah_same_as_global && subCategory.jenis_hadiah) {
      overrides.push('Hadiah');
    }
    if (!subCategory.max_bonus_same_as_global && !subCategory.max_bonus_unlimited && subCategory.max_bonus > 0) {
      overrides.push('Max Bonus');
    }
    if (subCategory.max_bonus_unlimited) {
      overrides.push('Unlimited');
    }
    if (!subCategory.payout_direction_same_as_global) {
      overrides.push('Payout');
    }
    if (subCategory.admin_fee_enabled && subCategory.admin_fee_percentage > 0) {
      overrides.push('Admin Fee');
    }
    if (subCategory.game_types?.length > 0) {
      overrides.push('Games');
    }
    if (subCategory.game_providers?.length > 0) {
      overrides.push('Providers');
    }
    if (subCategory.turnover_rule_enabled && subCategory.turnover_rule) {
      overrides.push('TO');
    }
    
    return overrides;
  };

  const overriddenFields = getOverriddenFields();

  // Generate summary for collapsed header
  const getSummary = (): string => {
    const parts: string[] = [];
    if (subCategory.name && subCategory.name !== `Sub Kategori ${index + 1}`) {
      parts.push(subCategory.name);
    }

    // Show first selected game type
    if (subCategory.game_types?.length > 0) {
      const firstType = gameTypeOptions.find(g => g.value === subCategory.game_types[0])?.label;
      if (firstType && firstType !== 'Semua') {
        parts.push(subCategory.game_types.length > 1 ? `${firstType} +${subCategory.game_types.length - 1}` : firstType);
      }
    }

    // Show first selected provider
    if (subCategory.game_providers?.length > 0) {
      const firstProvider = gameProviderOptions.find(p => p.value === subCategory.game_providers[0])?.label;
      if (firstProvider && firstProvider !== 'Semua Provider') {
        parts.push(subCategory.game_providers.length > 1 ? `${firstProvider} +${subCategory.game_providers.length - 1}` : firstProvider);
      }
    }
    if (subCategory.minimum_base && subCategory.minimum_base_enabled) {
      parts.push(`Min ${subCategory.minimum_base.toLocaleString('id-ID')}`);
    }
    if (parts.length === 0) {
      return `Sub Kategori #${index + 1}`;
    }
    return parts.join(' • ');
  };
  const getMinimumBaseLabel = () => {
    const baseOption = calcBaseOptions.find(c => c.value === subCategory.calculation_base);
    if (baseOption) {
      return `Minimal Perhitungan ${baseOption.label}`;
    }
    return 'Minimal Perhitungan';
  };
  return <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="collapsible-trigger w-full">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-6 h-6 rounded-full bg-button-hover/20 flex items-center justify-center text-xs font-medium text-button-hover">
            {index + 1}
          </div>
          <div className="text-left flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">
                {subCategory.name || `Sub Kategori ${index + 1}`}
              </span>
              {/* Override indicator badges */}
              {overriddenFields.length > 0 && (
                <div className="flex items-center gap-1">
                  <Pencil className="h-3 w-3 text-button-hover" />
                  <span className="text-[10px] text-button-hover font-medium">
                    {overriddenFields.length} override
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {/* Show override badges when collapsed */}
              {!isOpen && overriddenFields.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {overriddenFields.slice(0, 4).map((field) => (
                    <Badge 
                      key={field} 
                      variant="secondary" 
                      className="text-[10px] px-1.5 py-0 h-4 bg-button-hover/15 text-button-hover border-button-hover/30"
                    >
                      {field}
                    </Badge>
                  ))}
                  {overriddenFields.length > 4 && (
                    <Badge 
                      variant="secondary" 
                      className="text-[10px] px-1.5 py-0 h-4 bg-muted text-muted-foreground"
                    >
                      +{overriddenFields.length - 4}
                    </Badge>
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground truncate max-w-md">
                  {getSummary()}
                </span>
              )}
            </div>
          </div>
        </div>
        <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform duration-200 flex-shrink-0", isOpen && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="collapsible-content">
        {/* Header: Nama Sub Kategori */}
        <div className="space-y-2 mb-6">
          <Label>Nama Sub Kategori</Label>
          <Input value={subCategory.name} onChange={e => onChange({
          name: e.target.value
        })} placeholder={`Sub Kategori ${index + 1}`} />
          <p className="text-xs text-muted-foreground">
            Nama kustom untuk varian promo ini
          </p>
        </div>
        
        {/* Headline: Dasar Perhitungan Bonus */}
        <h4 className="font-semibold text-button-hover mb-4 text-sm">1. Dasar Perhitungan Bonus</h4>
        
        {/* Row 1: Jenis Hadiah & Max Bonus (2 kolom) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Jenis Hadiah */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Jenis Hadiah</Label>
              {/* Toggle On/Off untuk field */}
              <div className="flex items-center gap-2">
                <Switch checked={!subCategory.jenis_hadiah_same_as_global} onCheckedChange={checked => {
                onChange({
                  jenis_hadiah_same_as_global: !checked,
                  jenis_hadiah: !checked ? '' : subCategory.jenis_hadiah
                });
              }} />
              </div>
            </div>
            <SelectWithAddNew value={subCategory.jenis_hadiah_same_as_global ? '' : subCategory.jenis_hadiah} onValueChange={value => onChange({
            jenis_hadiah: value,
            physical_reward_name: value !== 'hadiah_fisik' ? '' : subCategory.physical_reward_name,
            cash_reward_amount: value !== 'uang_tunai' ? undefined : subCategory.cash_reward_amount
          })} options={dinamisRewardTypeOptions} onAddOption={option => setDinamisRewardTypeOptions([...dinamisRewardTypeOptions, option])} onDeleteOption={value => setDinamisRewardTypeOptions(dinamisRewardTypeOptions.filter(d => d.value !== value))} placeholder={subCategory.jenis_hadiah_same_as_global ? "-" : "Pilih jenis"} disabled={subCategory.jenis_hadiah_same_as_global} className={subCategory.jenis_hadiah_same_as_global ? "opacity-50" : ""} />
            {/* Jika Hadiah Fisik dipilih, tampilkan input nama hadiah */}
            {subCategory.jenis_hadiah === 'hadiah_fisik' && !subCategory.jenis_hadiah_same_as_global && (
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div className="col-span-2 space-y-2">
                  <Label className="text-sm">Nama Hadiah Fisik</Label>
                  <Input
                    value={subCategory.physical_reward_name || ''}
                    onChange={(e) => onChange({ physical_reward_name: e.target.value })}
                    placeholder="Contoh: iPhone 16 Pro Max 256GB"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Jumlah Unit</Label>
                  <Input
                    type="number"
                    min={1}
                    value={subCategory.physical_reward_quantity || 1}
                    onChange={(e) => onChange({ physical_reward_quantity: parseInt(e.target.value) || 1 })}
                    placeholder="1"
                    className="w-full"
                  />
                </div>
              </div>
            )}
            {/* Jika Uang Tunai dipilih, tampilkan input nominal */}
            {subCategory.jenis_hadiah === 'uang_tunai' && !subCategory.jenis_hadiah_same_as_global && (
              <div className="space-y-2 mt-3">
                <Label className="text-sm">Nominal Uang Tunai</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rp</span>
                  <Input
                    className="pl-10"
                    value={formatRupiah(subCategory.cash_reward_amount)}
                    onChange={(e) => onChange({ cash_reward_amount: parseRupiah(e.target.value) })}
                    placeholder="50.000.000"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Masukkan nominal uang tunai (format: 10.000.000)
                </p>
              </div>
            )}
          </div>
          
          {/* Max Bonus */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Max Bonus</Label>
              <div className="flex items-center gap-3">
                {/* Toggle Unlimited */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Unlimited</span>
                  <Switch 
                    checked={subCategory.max_bonus_unlimited ?? false} 
                    onCheckedChange={checked => {
                      onChange({
                        max_bonus_unlimited: checked,
                        max_bonus: checked ? 0 : subCategory.max_bonus,
                        max_bonus_same_as_global: checked ? false : subCategory.max_bonus_same_as_global
                      });
                    }} 
                  />
                </div>
                {/* Toggle On/Off untuk field */}
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={!subCategory.max_bonus_same_as_global} 
                    disabled={subCategory.max_bonus_unlimited}
                    onCheckedChange={checked => {
                      onChange({
                        max_bonus_same_as_global: !checked,
                        max_bonus: !checked ? 0 : subCategory.max_bonus
                      });
                    }} 
                  />
                </div>
              </div>
            </div>
            <Input 
              type="text" 
              inputMode="numeric"
              value={subCategory.max_bonus_unlimited || subCategory.max_bonus_same_as_global ? '' : maxBonusInput} 
              onChange={e => {
                const rawValue = e.target.value.replace(/[^0-9.]/g, '');
                setMaxBonusInput(rawValue);
                const numValue = parseFormattedNumber(rawValue);
                onChange({ max_bonus: numValue });
              }}
              onBlur={() => {
                if (subCategory.max_bonus > 0 && !subCategory.max_bonus_unlimited && !subCategory.max_bonus_same_as_global) {
                  setMaxBonusInput(formatThousands(subCategory.max_bonus));
                } else {
                  setMaxBonusInput('');
                }
              }}
              placeholder={subCategory.max_bonus_unlimited ? "Unlimited / Tanpa Batas" : (subCategory.max_bonus_same_as_global ? "-" : "Contoh: 100.000")} 
              disabled={subCategory.max_bonus_unlimited || subCategory.max_bonus_same_as_global} 
              className={(subCategory.max_bonus_unlimited || subCategory.max_bonus_same_as_global) ? "opacity-50" : ""} 
            />
          </div>
        </div>
        
        {/* Row 2: Payout Direction (2 kolom - sejajar dengan row 1) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Payout Direction - Kolom Kiri */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Payout Direction</Label>
              {/* Toggle On/Off untuk field */}
              <div className="flex items-center gap-2">
                <Switch checked={!subCategory.payout_direction_same_as_global} onCheckedChange={checked => {
                onChange({
                  payout_direction_same_as_global: !checked,
                  payout_direction: !checked ? 'after' : subCategory.payout_direction
                });
              }} />
              </div>
            </div>
            <RadioGroup value={subCategory.payout_direction_same_as_global ? 'after' : subCategory.payout_direction} onValueChange={(value: 'before' | 'after') => onChange({
            payout_direction: value
          })} className={cn("flex gap-6 pt-2", subCategory.payout_direction_same_as_global && "opacity-50 pointer-events-none")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="before" id={`payout-before-${index}`} disabled={subCategory.payout_direction_same_as_global} />
                <Label htmlFor={`payout-before-${index}`} className="cursor-pointer font-normal text-sm">Didepan</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="after" id={`payout-after-${index}`} disabled={subCategory.payout_direction_same_as_global} />
                <Label htmlFor={`payout-after-${index}`} className="cursor-pointer font-normal text-sm">Dibelakang</Label>
              </div>
            </RadioGroup>
          </div>
          
          {/* Kolom Kanan: Admin Fee */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Admin Fee (Opsional)</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Aktifkan</span>
                <Switch
                  checked={subCategory.admin_fee_enabled ?? false}
                  onCheckedChange={(checked) => {
                    onChange({
                      admin_fee_enabled: checked,
                      admin_fee_percentage: checked ? (subCategory.admin_fee_percentage ?? 0) : 0
                    });
                  }}
                />
              </div>
            </div>
            
            <div className="relative">
              <Input
                type="number"
                min={0}
                max={100}
                value={subCategory.admin_fee_enabled ? (subCategory.admin_fee_percentage ?? 0) : ''}
                onChange={(e) => onChange({ 
                  admin_fee_percentage: Number(e.target.value) || 0 
                })}
                placeholder={subCategory.admin_fee_enabled ? "0" : "Tidak aktif"}
                disabled={!subCategory.admin_fee_enabled}
                className={cn("pr-10", !subCategory.admin_fee_enabled && "opacity-50")}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </div>
        </div>

        {/* Section 1: Dasar Perhitungan Bonus */}
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Dasar Perhitungan</Label>
              <SelectWithAddNew value={subCategory.calculation_base} onValueChange={value => onChange({
              calculation_base: value
            })} options={calcBaseOptions} onAddOption={option => setCalcBaseOptions([...calcBaseOptions, option])} onDeleteOption={value => setCalcBaseOptions(calcBaseOptions.filter(c => c.value !== value))} placeholder="Pilih dasar (TO, Deposit, dll)" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Jenis Perhitungan</Label>
                <Switch 
                  checked={subCategory.calculation_method_enabled !== false} 
                  onCheckedChange={checked => onChange({
                    calculation_method_enabled: checked,
                    calculation_method: checked ? subCategory.calculation_method : ''
                  })}
                />
              </div>
              <SelectWithAddNew 
                value={subCategory.calculation_method} 
                onValueChange={value => onChange({ calculation_method: value })} 
                options={calcMethodOptions} 
                onAddOption={option => setCalcMethodOptions([...calcMethodOptions, option])} 
                onDeleteOption={value => setCalcMethodOptions(calcMethodOptions.filter(c => c.value !== value))} 
                placeholder={subCategory.calculation_method_enabled !== false ? "Pilih jenis (%, Fixed)" : "-"}
                disabled={subCategory.calculation_method_enabled === false}
              />
            </div>
            <div className="space-y-2">
              <Label>Nilai Bonus</Label>
              <div className="relative">
                {subCategory.calculation_method === 'percentage' ? (
                  // Percentage mode: allow decimals, no thousand separator
                  <Input 
                    type="text" 
                    inputMode="decimal" 
                    value={calcValueInput} 
                    onChange={e => {
                      // Allow digits, comma, and dot for decimals
                      const rawValue = e.target.value.replace(/[^0-9.,]/g, '');
                      setCalcValueInput(rawValue);
                      const numValue = parseFloat(rawValue.replace(',', '.')) || 0;
                      onChange({ calculation_value: numValue });
                    }} 
                    placeholder="Contoh: 25 atau 0,5" 
                    className="pr-10" 
                  />
                ) : (
                  // Fixed/Threshold mode: use thousand separator
                  <Input 
                    type="text" 
                    inputMode="numeric" 
                    value={calcValueInput} 
                    onChange={e => {
                      // Allow only digits and dots (thousand separator)
                      const rawValue = e.target.value.replace(/[^0-9.]/g, '');
                      setCalcValueInput(rawValue);
                      const numValue = parseFormattedNumber(rawValue);
                      onChange({ calculation_value: numValue });
                    }} 
                    onBlur={() => {
                      // Format with thousand separators on blur
                      if (subCategory.calculation_value !== undefined && subCategory.calculation_value !== null && subCategory.calculation_value > 0) {
                        setCalcValueInput(formatThousands(subCategory.calculation_value));
                      } else {
                        setCalcValueInput('');
                      }
                    }} 
                    placeholder="Contoh: 25.000" 
                    className="pr-10" 
                  />
                )}
                {subCategory.calculation_method === 'percentage' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>}
              </div>
            </div>
            {/* Minimal Perhitungan - Same row as Nilai Bonus */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{getMinimumBaseLabel()}</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Aktifkan</span>
                  <Switch 
                    checked={subCategory.minimum_base_enabled} 
                    onCheckedChange={checked => onChange({
                      minimum_base_enabled: checked,
                      minimum_base: checked ? subCategory.minimum_base : 0
                    })} 
                  />
                </div>
              </div>
              <Input 
                type="text" 
                inputMode="numeric"
                value={!subCategory.minimum_base_enabled ? '' : minBaseInput} 
                onChange={e => {
                  const rawValue = e.target.value.replace(/[^0-9.]/g, '');
                  setMinBaseInput(rawValue);
                  const numValue = parseFormattedNumber(rawValue);
                  onChange({ minimum_base: numValue });
                }}
                onBlur={() => {
                  if (subCategory.minimum_base > 0 && subCategory.minimum_base_enabled) {
                    setMinBaseInput(formatThousands(subCategory.minimum_base));
                  } else {
                    setMinBaseInput('');
                  }
                }}
                placeholder={subCategory.minimum_base_enabled ? "Contoh: 1.000.000" : "Tidak aktif"}
                disabled={!subCategory.minimum_base_enabled}
                className={!subCategory.minimum_base_enabled ? "opacity-50" : ""}
              />
            </div>
          </div>
          
          {/* Ilustrasi Perhitungan - Collapsible */}
          {subCategory.calculation_method === 'percentage' && subCategory.calculation_value > 0 && <Collapsible>
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <CollapsibleTrigger className="flex items-center justify-between w-full group">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Ilustrasi Perhitungan</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="rounded-lg border border-border overflow-hidden mt-3">
                    <div className="grid grid-cols-3 bg-card px-4 py-2 border-b border-border">
                      <div className="text-xs font-medium text-muted-foreground">Nilai</div>
                      <div className="text-xs font-medium text-muted-foreground">Kalkulasi</div>
                      <div className="text-xs font-medium text-muted-foreground">Perkiraan Bonus</div>
                    </div>
                    {(() => {
                  const percentage = subCategory.calculation_value;
                  const minBase = subCategory.minimum_base || 1000000;
                  const maxClaim = subCategory.dinamis_max_claim_unlimited ? Infinity : subCategory.dinamis_max_claim || Infinity;
                  const sampleLevels = [minBase, minBase * 2, minBase * 5];
                  return sampleLevels.map((to, idx) => {
                    const rawReward = Math.floor(to * percentage / 100);
                    const finalReward = Math.min(rawReward, maxClaim);
                    const isCapped = rawReward > maxClaim && maxClaim !== Infinity;
                    return <div key={idx} className="grid grid-cols-3 px-4 py-2 border-b border-border last:border-b-0">
                            <div className="text-sm text-foreground">Rp {to.toLocaleString('id-ID')}</div>
                            <div className="text-xs text-muted-foreground">{percentage}%</div>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${isCapped ? 'text-warning' : 'text-foreground'}`}>
                                Rp {finalReward.toLocaleString('id-ID')}
                              </span>
                              {isCapped && <span className="text-xs text-warning">(max)</span>}
                            </div>
                          </div>;
                  });
                })()}
                  </div>
                  <p className="text-xs text-warning mt-3 flex items-center gap-2">
                    <span>⚠️</span>
                    <span>Nilai ini hanya ilustrasi.</span>
                  </p>
                </CollapsibleContent>
              </div>
            </Collapsible>}

          {/* Syarat Main Sebelum WD - Styled like Wajib APK */}
          <div className="pt-4">
            <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl mb-2">
              <Switch 
                checked={subCategory.turnover_rule_enabled} 
                onCheckedChange={checked => onChange({
                  turnover_rule_enabled: checked
                })} 
              />
              <div>
                <div className="font-medium text-sm text-button-hover">Syarat Main Sebelum WD</div>
                <p className="text-xs text-muted-foreground">
                  Aktifkan jika promo memiliki syarat kelipatan main (turnover) sebelum withdrawal
                </p>
              </div>
            </div>
            {subCategory.turnover_rule_enabled && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kelipatan Main Bonus (TO)</Label>
                  <SelectWithAddNew value={subCategory.turnover_rule} onValueChange={value => onChange({
                turnover_rule: value
              })} options={turnoverRuleOptions} onAddOption={option => setTurnoverRuleOptions([...turnoverRuleOptions, option])} onDeleteOption={value => setTurnoverRuleOptions(turnoverRuleOptions.filter(t => t.value !== value))} placeholder="Pilih kelipatan main" />
                </div>
                <div className="space-y-2">
                  <Label>Nilai Custom</Label>
                  <Input value={subCategory.turnover_rule_custom || ''} onChange={e => onChange({
                turnover_rule_custom: e.target.value
              })} placeholder="Contoh: 3x, 10x, 12x" disabled={subCategory.turnover_rule !== 'custom'} className={subCategory.turnover_rule !== 'custom' ? 'opacity-50' : ''} />
                </div>
              </div>}
          </div>

        </div>

        {/* Section 2: Permainan & Provider - Multi-select dengan Badges */}
        <div className="space-y-4 mb-6">
          <h4 className="text-sm font-semibold text-button-hover">2. Permainan & Provider</h4>
          
          {/* Jenis Game - Multi-select */}
          <div className="space-y-2">
            <Label>Jenis Game</Label>
            {subCategory.game_types?.length > 0 && <div className="flex flex-wrap gap-2 mb-2">
                {subCategory.game_types.map((type, idx) => <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-button-hover/20 rounded-full text-sm text-button-hover border border-button-hover/40">
                    {gameTypeOptions.find(g => g.value === type)?.label || type}
                    <button type="button" onClick={() => {
                const updated = [...subCategory.game_types];
                updated.splice(idx, 1);
                onChange({
                  game_types: updated
                });
              }} className="hover:text-destructive transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>)}
              </div>}
            <SelectWithAddNew value="" onValueChange={value => {
            if (value && !subCategory.game_types?.includes(value)) {
              onChange({
                game_types: [...(subCategory.game_types || []), value]
              });
            }
          }} options={gameTypeOptions} onAddOption={option => setGameTypeOptions([...gameTypeOptions, option])} onDeleteOption={value => setGameTypeOptions(gameTypeOptions.filter(g => g.value !== value))} placeholder="Pilih jenis game" />
          </div>
          
          {/* Provider Game - Multi-select */}
          <div className="space-y-2">
            <Label>Provider Game</Label>
            {subCategory.game_providers?.length > 0 && <div className="flex flex-wrap gap-2 mb-2">
                {subCategory.game_providers.map((provider, idx) => <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-button-hover/20 rounded-full text-sm text-button-hover border border-button-hover/40">
                    {gameProviderOptions.find(p => p.value === provider)?.label || provider}
                    <button type="button" onClick={() => {
                const updated = [...subCategory.game_providers];
                updated.splice(idx, 1);
                onChange({
                  game_providers: updated
                });
              }} className="hover:text-destructive transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>)}
              </div>}
            <SelectWithAddNew value="" onValueChange={value => {
            if (value && !subCategory.game_providers?.includes(value)) {
              onChange({
                game_providers: [...(subCategory.game_providers || []), value]
              });
            }
          }} options={gameProviderOptions} onAddOption={option => setGameProviderOptions([...gameProviderOptions, option])} onDeleteOption={value => setGameProviderOptions(gameProviderOptions.filter(p => p.value !== value))} placeholder="Pilih provider" />
          </div>
          
          {/* Nama Game - Multi-select */}
          <div className="space-y-2">
            <Label>Nama Game</Label>
            {subCategory.game_names?.length > 0 && <div className="flex flex-wrap gap-2 mb-2">
                {subCategory.game_names.map((name, idx) => <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-button-hover/20 rounded-full text-sm text-button-hover border border-button-hover/40">
                    {gameNameOptions.find(n => n.value === name)?.label || name}
                    <button type="button" onClick={() => {
                const updated = [...subCategory.game_names];
                updated.splice(idx, 1);
                onChange({
                  game_names: updated
                });
              }} className="hover:text-destructive transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>)}
              </div>}
            <SelectWithAddNew value="" onValueChange={value => {
            if (value && !subCategory.game_names?.includes(value)) {
              onChange({
                game_names: [...(subCategory.game_names || []), value]
              });
            }
          }} options={gameNameOptions} onAddOption={option => setGameNameOptions([...gameNameOptions, option])} onDeleteOption={value => setGameNameOptions(gameNameOptions.filter(n => n.value !== value))} placeholder="Pilih nama game" />
          </div>

          {/* Blacklist - Styled like Wajib APK */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl mb-4">
              <Switch 
                checked={subCategory.game_blacklist_enabled} 
                onCheckedChange={checked => onChange({
                  game_blacklist_enabled: checked
                })} 
              />
              <div>
                <div className="font-medium text-sm text-button-hover">Game Dilarang (Blacklist)</div>
                <p className="text-xs text-muted-foreground">
                  Aktifkan untuk kecualikan game tertentu dari promo ini
                </p>
              </div>
            </div>
            {subCategory.game_blacklist_enabled && <div className="space-y-4">
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                  <p className="text-xs text-warning">
                    ⚠️ Game di blacklist tidak berlaku untuk sub kategori ini.
                  </p>
                </div>
                
                {/* Jenis Game Blacklist - Multi-select */}
                <div className="space-y-2">
                  <Label>Jenis Game Dilarang</Label>
                  {subCategory.game_types_blacklist?.length > 0 && <div className="flex flex-wrap gap-2 mb-2">
                      {subCategory.game_types_blacklist.map((type, idx) => <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-destructive/20 rounded-full text-sm text-destructive border border-destructive/40">
                          {gameTypeBlacklistOptions.find(g => g.value === type)?.label || type}
                          <button type="button" onClick={() => {
                    const updated = [...subCategory.game_types_blacklist];
                    updated.splice(idx, 1);
                    onChange({
                      game_types_blacklist: updated
                    });
                  }} className="hover:text-destructive transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>)}
                    </div>}
                  <SelectWithAddNew value="" onValueChange={value => {
                if (value && !subCategory.game_types_blacklist?.includes(value)) {
                  onChange({
                    game_types_blacklist: [...(subCategory.game_types_blacklist || []), value]
                  });
                }
              }} options={gameTypeBlacklistOptions} onAddOption={option => setGameTypeBlacklistOptions([...gameTypeBlacklistOptions, option])} onDeleteOption={value => setGameTypeBlacklistOptions(gameTypeBlacklistOptions.filter(g => g.value !== value))} placeholder="Pilih jenis game" />
                </div>
                
                {/* Provider Blacklist - Multi-select */}
                <div className="space-y-2">
                  <Label>Provider Game Dilarang</Label>
                  {subCategory.game_providers_blacklist?.length > 0 && <div className="flex flex-wrap gap-2 mb-2">
                      {subCategory.game_providers_blacklist.map((provider, idx) => <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-destructive/20 rounded-full text-sm text-destructive border border-destructive/40">
                          {gameProviderBlacklistOptions.find(p => p.value === provider)?.label || provider}
                          <button type="button" onClick={() => {
                    const updated = [...subCategory.game_providers_blacklist];
                    updated.splice(idx, 1);
                    onChange({
                      game_providers_blacklist: updated
                    });
                  }} className="hover:text-destructive transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>)}
                    </div>}
                  <SelectWithAddNew value="" onValueChange={value => {
                if (value && !subCategory.game_providers_blacklist?.includes(value)) {
                  onChange({
                    game_providers_blacklist: [...(subCategory.game_providers_blacklist || []), value]
                  });
                }
              }} options={gameProviderBlacklistOptions} onAddOption={option => setGameProviderBlacklistOptions([...gameProviderBlacklistOptions, option])} onDeleteOption={value => setGameProviderBlacklistOptions(gameProviderBlacklistOptions.filter(p => p.value !== value))} placeholder="Pilih provider" />
                </div>
                
                {/* Nama Game Blacklist - Multi-select */}
                <div className="space-y-2">
                  <Label>Nama Game Dilarang</Label>
                  {subCategory.game_names_blacklist?.length > 0 && <div className="flex flex-wrap gap-2 mb-2">
                      {subCategory.game_names_blacklist.map((name, idx) => <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-destructive/20 rounded-full text-sm text-destructive border border-destructive/40">
                          {gameNameBlacklistOptions.find(n => n.value === name)?.label || name}
                          <button type="button" onClick={() => {
                    const updated = [...subCategory.game_names_blacklist];
                    updated.splice(idx, 1);
                    onChange({
                      game_names_blacklist: updated
                    });
                  }} className="hover:text-destructive transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>)}
                    </div>}
                  <SelectWithAddNew value="" onValueChange={value => {
                if (value && !subCategory.game_names_blacklist?.includes(value)) {
                  onChange({
                    game_names_blacklist: [...(subCategory.game_names_blacklist || []), value]
                  });
                }
              }} options={gameNameBlacklistOptions} onAddOption={option => setGameNameBlacklistOptions([...gameNameBlacklistOptions, option])} onDeleteOption={value => setGameNameBlacklistOptions(gameNameBlacklistOptions.filter(n => n.value !== value))} placeholder="Pilih nama game" />
                </div>
                
                <ExclusionRulesInput rules={subCategory.game_exclusion_rules || []} onChange={rules => onChange({
              game_exclusion_rules: rules
            })} />
              </div>}
          </div>
        </div>


        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/20 hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Hapus Sub Kategori
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Hapus Sub Kategori?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Anda yakin ingin menghapus "{subCategory.name || `Sub Kategori ${index + 1}`}"? 
                  Tindakan ini tidak dapat dibatalkan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <Button variant="destructive" onClick={onDelete} className="hover:!bg-button-hover hover:!text-black">
                  Hapus
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="golden" size="sm" onClick={onSave}>
            <Save className="h-4 w-4 mr-2" />
            Simpan Sub Kategori
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>;
}

// Helper to create initial sub-category
export function createInitialSubCategory(index: number): PromoSubCategory {
  return {
    id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: `Sub Kategori ${index + 1}`,
    calculation_base: '',
    calculation_method: '',
    calculation_method_enabled: false,
    calculation_value: 0,
    minimum_base: 0,
    minimum_base_enabled: false,
    turnover_rule: '',
    turnover_rule_enabled: false,
    turnover_rule_custom: '',
    jenis_hadiah_same_as_global: true,
    jenis_hadiah: '',
    max_bonus_same_as_global: true,
    max_bonus: 0,
    max_bonus_unlimited: false,
    payout_direction_same_as_global: true,
    payout_direction: 'after',
    admin_fee_same_as_global: true,
    admin_fee_enabled: false,
    admin_fee_percentage: null,
    game_types: [],
    game_providers: [],
    game_names: [],
    game_blacklist_enabled: false,
    game_types_blacklist: [],
    game_providers_blacklist: [],
    game_names_blacklist: [],
    game_exclusion_rules: [],
    dinamis_reward_type: '',
    dinamis_reward_amount: 0,
    dinamis_max_claim: 0,
    dinamis_max_claim_unlimited: false,
    dinamis_min_claim: 0,
    dinamis_min_claim_enabled: false
  };
}