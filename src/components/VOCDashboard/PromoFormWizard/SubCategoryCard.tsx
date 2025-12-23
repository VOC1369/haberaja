import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ChevronDown, Save, Trash2, AlertTriangle, Calculator, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PromoSubCategory, CALCULATION_BASES, CALCULATION_METHODS, DINAMIS_REWARD_TYPES, GAME_RESTRICTIONS, GAME_PROVIDERS, GAME_NAMES, TURNOVER_RULES } from "./types";
import { SelectWithAddNew, SelectOption } from "./SelectWithAddNew";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// Inline component for exclusion rules
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
  const [calcValueInput, setCalcValueInput] = useState(() => subCategory.calculation_value !== undefined && subCategory.calculation_value !== null ? String(subCategory.calculation_value).replace('.', ',') : '');

  // Options state for dropdowns
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
          <div className="text-left flex-1">
            <div className="text-sm font-semibold text-foreground">
              {subCategory.name || `Sub Kategori ${index + 1}`}
            </div>
            <div className="text-xs text-muted-foreground truncate max-w-md">
              {getSummary()}
            </div>
          </div>
        </div>
        <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
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
              {/* Toggle SELALU tampil & SELALU clickable - inverse logic */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Sama dengan Promo Global</span>
                <Switch checked={subCategory.jenis_hadiah_same_as_global} onCheckedChange={checked => {
                onChange({
                  jenis_hadiah_same_as_global: checked,
                  jenis_hadiah: checked ? '' : subCategory.jenis_hadiah
                });
                // Inverse logic: jika sub-category ON, global harus OFF
                if (checked && globalJenisHadiahEnabled && onInvertGlobalJenisHadiah) {
                  onInvertGlobalJenisHadiah();
                }
              }} />
              </div>
            </div>
            <SelectWithAddNew value={subCategory.jenis_hadiah_same_as_global ? '' : subCategory.jenis_hadiah} onValueChange={value => onChange({
            jenis_hadiah: value,
            physical_reward_name: value !== 'hadiah_fisik' ? '' : subCategory.physical_reward_name
          })} options={dinamisRewardTypeOptions} onAddOption={option => setDinamisRewardTypeOptions([...dinamisRewardTypeOptions, option])} onDeleteOption={value => setDinamisRewardTypeOptions(dinamisRewardTypeOptions.filter(d => d.value !== value))} placeholder={subCategory.jenis_hadiah_same_as_global ? "Mengikuti global" : "Pilih jenis"} disabled={subCategory.jenis_hadiah_same_as_global} className={subCategory.jenis_hadiah_same_as_global ? "opacity-50" : ""} />
            {/* Jika Hadiah Fisik dipilih, tampilkan input nama hadiah */}
            {subCategory.jenis_hadiah === 'hadiah_fisik' && !subCategory.jenis_hadiah_same_as_global && (
              <div className="space-y-2 mt-3">
                <Label className="text-sm">Nama Hadiah Fisik</Label>
                <Input
                  value={subCategory.physical_reward_name || ''}
                  onChange={(e) => onChange({ physical_reward_name: e.target.value })}
                  placeholder="Contoh: iPhone 16 Pro Max 256GB"
                />
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
                {/* Toggle Sama dengan Global */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Sama dengan Global</span>
                  <Switch 
                    checked={subCategory.max_bonus_same_as_global} 
                    disabled={subCategory.max_bonus_unlimited}
                    onCheckedChange={checked => {
                      onChange({
                        max_bonus_same_as_global: checked,
                        max_bonus: checked ? 0 : subCategory.max_bonus
                      });
                      // Inverse logic: jika sub-category ON, global harus OFF
                      if (checked && globalMaxBonusEnabled && onInvertGlobalMaxBonus) {
                        onInvertGlobalMaxBonus();
                      }
                    }} 
                  />
                </div>
              </div>
            </div>
            <Input 
              type="text" 
              value={subCategory.max_bonus_unlimited ? '' : (subCategory.max_bonus_same_as_global ? '' : (subCategory.max_bonus ? subCategory.max_bonus.toLocaleString('id-ID') : ''))} 
              onChange={e => onChange({
                max_bonus: Number(e.target.value.replace(/\D/g, ''))
              })} 
              placeholder={subCategory.max_bonus_unlimited ? "Unlimited / Tanpa Batas" : (subCategory.max_bonus_same_as_global ? "Mengikuti global" : "Contoh: 100.000")} 
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
              {/* Toggle SELALU tampil & SELALU clickable - inverse logic */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Sama dengan Promo Global</span>
                <Switch checked={subCategory.payout_direction_same_as_global} onCheckedChange={checked => {
                onChange({
                  payout_direction_same_as_global: checked,
                  payout_direction: checked ? 'after' : subCategory.payout_direction
                });
                // Inverse logic: jika sub-category ON, global harus OFF
                if (checked && globalPayoutDirectionEnabled && onInvertGlobalPayoutDirection) {
                  onInvertGlobalPayoutDirection();
                }
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
              <Label>Jenis Perhitungan</Label>
              <SelectWithAddNew value={subCategory.calculation_method} onValueChange={value => onChange({
              calculation_method: value
            })} options={calcMethodOptions} onAddOption={option => setCalcMethodOptions([...calcMethodOptions, option])} onDeleteOption={value => setCalcMethodOptions(calcMethodOptions.filter(c => c.value !== value))} placeholder="Pilih jenis (%, Fixed)" />
            </div>
            <div className="space-y-2">
              <Label>Nilai Bonus</Label>
              <div className="relative">
                <Input type="text" inputMode="decimal" value={calcValueInput} onChange={e => {
                const rawValue = e.target.value.replace(/[^0-9.,]/g, '');
                setCalcValueInput(rawValue);
                const normalizedValue = rawValue.replace(',', '.');
                const numValue = parseFloat(normalizedValue);
                if (!isNaN(numValue)) {
                  onChange({
                    calculation_value: numValue
                  });
                } else if (rawValue === '' || rawValue === '0' || rawValue === '0,' || rawValue === '0.') {
                  onChange({
                    calculation_value: 0
                  });
                }
              }} onBlur={() => {
                if (subCategory.calculation_value !== undefined && subCategory.calculation_value !== null) {
                  setCalcValueInput(String(subCategory.calculation_value).replace('.', ','));
                }
              }} placeholder="Contoh: 0,5" className="pr-10" />
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
                value={subCategory.minimum_base_enabled && subCategory.minimum_base ? subCategory.minimum_base.toLocaleString('id-ID') : ''} 
                onChange={e => onChange({
                  minimum_base: Number(e.target.value.replace(/\D/g, ''))
                })} 
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
    calculation_value: 0,
    minimum_base: 0,
    minimum_base_enabled: true,
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