import { useState } from "react";
import { format, parse } from "date-fns";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, X, ChevronDown, Settings, Zap, Trophy, Star, Target, Trash2, CalendarIcon, Calculator, AlertTriangle, Clock, Save, Phone, Gamepad2, Layers, Gift } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  PromoFormData,
  PromoSubCategory,
  TierReward,
  FastExpMission,
  LevelUpReward,
  REWARD_TYPES,
  TURNOVER_RULES,
  CLAIM_FREQUENCIES,
  LP_CALC_METHODS,
  EXP_CALC_METHODS,
  REWARD_DISTRIBUTIONS,
  CALCULATION_BASES,
  CALCULATION_METHODS,
  DINAMIS_REWARD_TYPES,
  GAME_RESTRICTIONS,
  GAME_PROVIDERS,
  GAME_NAMES,
} from "./types";
import { SelectWithAddNew, SelectOption } from "./SelectWithAddNew";
import { SubCategoryCard, createInitialSubCategory } from "./SubCategoryCard";

interface Step3Props {
  data: PromoFormData;
  onChange: (data: Partial<PromoFormData>) => void;
  isEditingFromReview?: boolean;
  onSaveAndReturn?: () => void;
}

const DEFAULT_PROMO_UNITS: SelectOption[] = [
  { value: 'lp', label: 'Loyalty Points (LP)' },
  { value: 'exp', label: 'Experience Points (EXP)' },
  { value: 'hybrid', label: 'Hybrid (LP + EXP)' },
];

const DEFAULT_EXP_MODES: SelectOption[] = [
  { value: 'level_up', label: 'Level Up' },
  { value: 'exp_store', label: 'EXP Store' },
  { value: 'both', label: 'Both' },
];

const DEFAULT_TIER_REWARD_TYPES: SelectOption[] = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'percentage', label: 'Percentage' },
];

const DEFAULT_HADIAH_TYPES: SelectOption[] = [
  { value: 'credit_game', label: 'Credit Game' },
  { value: 'freechip', label: 'Freechip' },
  { value: 'lp', label: 'Loyalty Points (LP)' },
  { value: 'exp', label: 'Experience Points (EXP)' },
];

const DEFAULT_LP_VALUE_TYPES: SelectOption[] = [
  { value: 'credit_game', label: 'Credit Game' },
  { value: 'freechip', label: 'Freechip' },
];

export function Step3Reward({ data, onChange, isEditingFromReview, onSaveAndReturn }: Step3Props) {
  // State for new requirement input
  const [newRequirement, setNewRequirement] = useState("");
  
  // State for new exclusion rule input
  const [newExclusionRule, setNewExclusionRule] = useState("");
  // State for decimal input (to handle "0," intermediate state)
  const [calcValueInput, setCalcValueInput] = useState(() => 
    data.calculation_value !== undefined && data.calculation_value !== null 
      ? String(data.calculation_value).replace('.', ',') 
      : ''
  );
  
  // All options are now editable - initialized from defaults
  const [promoUnitOptions, setPromoUnitOptions] = useState<SelectOption[]>([...DEFAULT_PROMO_UNITS]);
  const [expModeOptions, setExpModeOptions] = useState<SelectOption[]>([...DEFAULT_EXP_MODES]);
  const [rewardTypeOptions, setRewardTypeOptions] = useState<SelectOption[]>(
    REWARD_TYPES.map(r => ({ value: r.value, label: r.label }))
  );
  const [turnoverRuleOptions, setTurnoverRuleOptions] = useState<SelectOption[]>(
    TURNOVER_RULES.map(r => ({ value: r.value, label: r.label }))
  );
  const [claimFrequencyOptions, setClaimFrequencyOptions] = useState<SelectOption[]>(
    CLAIM_FREQUENCIES.map(f => ({ value: f.value, label: f.label }))
  );
  const [lpCalcMethodOptions, setLpCalcMethodOptions] = useState<SelectOption[]>(
    LP_CALC_METHODS.map(m => ({ value: m.value, label: m.label }))
  );
  const [expCalcMethodOptions, setExpCalcMethodOptions] = useState<SelectOption[]>(
    EXP_CALC_METHODS.map(m => ({ value: m.value, label: m.label }))
  );
  const [tierRewardTypeOptions, setTierRewardTypeOptions] = useState<SelectOption[]>([...DEFAULT_TIER_REWARD_TYPES]);
  const [hadiahTypeOptions, setHadiahTypeOptions] = useState<SelectOption[]>([...DEFAULT_HADIAH_TYPES]);
  const [lpValueTypeOptions, setLpValueTypeOptions] = useState<SelectOption[]>([...DEFAULT_LP_VALUE_TYPES]);
  const [expValueTypeOptions, setExpValueTypeOptions] = useState<SelectOption[]>([...DEFAULT_LP_VALUE_TYPES]);
  const [rewardDistributionOptions, setRewardDistributionOptions] = useState<SelectOption[]>(
    REWARD_DISTRIBUTIONS.map(d => ({ value: d.value, label: d.label }))
  );
  // Dinamis mode options
  const [calcBaseOptions, setCalcBaseOptions] = useState<SelectOption[]>(
    CALCULATION_BASES.map(c => ({ value: c.value, label: c.label }))
  );
  const [calcMethodOptions, setCalcMethodOptions] = useState<SelectOption[]>(
    CALCULATION_METHODS.map(c => ({ value: c.value, label: c.label }))
  );
  const [dinamisRewardTypeOptions, setDinamisRewardTypeOptions] = useState<SelectOption[]>(
    DINAMIS_REWARD_TYPES.map(d => ({ value: d.value, label: d.label }))
  );
  // Game targeting options (for Dinamis mode)
  const [gameTypeOptions, setGameTypeOptions] = useState<SelectOption[]>(
    GAME_RESTRICTIONS.map(g => ({ value: g.value, label: g.label }))
  );
  const [gameProviderOptions, setGameProviderOptions] = useState<SelectOption[]>(
    GAME_PROVIDERS.map(p => ({ value: p.value, label: p.label }))
  );
  const [gameNameOptions, setGameNameOptions] = useState<SelectOption[]>(
    GAME_NAMES.map(n => ({ value: n.value, label: n.label }))
  );
  
  // Game blacklist options (same as whitelist but separate state)
  const [gameTypeBlacklistOptions, setGameTypeBlacklistOptions] = useState<SelectOption[]>(
    GAME_RESTRICTIONS.map(g => ({ value: g.value, label: g.label }))
  );
  const [gameProviderBlacklistOptions, setGameProviderBlacklistOptions] = useState<SelectOption[]>(
    GAME_PROVIDERS.map(p => ({ value: p.value, label: p.label }))
  );
  const [gameNameBlacklistOptions, setGameNameBlacklistOptions] = useState<SelectOption[]>(
    GAME_NAMES.map(n => ({ value: n.value, label: n.label }))
  );

  // Dynamic label helpers based on calculation_base
  const getMinimumBaseLabel = () => {
    const baseOption = calcBaseOptions.find(c => c.value === data.calculation_base);
    if (baseOption) {
      return `Minimal Perhitungan ${baseOption.label}`;
    }
    return 'Minimal Perhitungan'; // fallback
  };

  const getMinimumBaseType = () => {
    const baseOption = calcBaseOptions.find(c => c.value === data.calculation_base);
    return baseOption?.label?.toLowerCase() || 'aktivitas';
  };

  const showC2 = data.promo_unit === 'lp' || data.promo_unit === 'hybrid';
  const showC3 = data.promo_unit === 'lp' || data.promo_unit === 'hybrid' || 
                 data.exp_mode === 'exp_store' || data.exp_mode === 'both';
  const showC4 = data.promo_unit === 'exp' || data.promo_unit === 'hybrid';
  const showC5 = data.exp_mode === 'level_up' || data.exp_mode === 'both';

  // Delete handlers - now work on all options (including defaults)
  const handleDeletePromoUnit = (value: string) => setPromoUnitOptions(promoUnitOptions.filter(p => p.value !== value));
  const handleDeleteExpMode = (value: string) => setExpModeOptions(expModeOptions.filter(e => e.value !== value));
  const handleDeleteRewardType = (value: string) => setRewardTypeOptions(rewardTypeOptions.filter(r => r.value !== value));
  const handleDeleteTurnoverRule = (value: string) => setTurnoverRuleOptions(turnoverRuleOptions.filter(t => t.value !== value));
  const handleDeleteClaimFrequency = (value: string) => setClaimFrequencyOptions(claimFrequencyOptions.filter(c => c.value !== value));
  const handleDeleteLpCalcMethod = (value: string) => setLpCalcMethodOptions(lpCalcMethodOptions.filter(l => l.value !== value));
  const handleDeleteExpCalcMethod = (value: string) => setExpCalcMethodOptions(expCalcMethodOptions.filter(e => e.value !== value));
  const handleDeleteTierRewardType = (value: string) => setTierRewardTypeOptions(tierRewardTypeOptions.filter(t => t.value !== value));
  const handleDeleteHadiahType = (value: string) => setHadiahTypeOptions(hadiahTypeOptions.filter(h => h.value !== value));
  const handleDeleteLpValueType = (value: string) => setLpValueTypeOptions(lpValueTypeOptions.filter(l => l.value !== value));
  const handleDeleteExpValueType = (value: string) => setExpValueTypeOptions(expValueTypeOptions.filter(e => e.value !== value));
  const handleDeleteRewardDistribution = (value: string) => setRewardDistributionOptions(rewardDistributionOptions.filter(d => d.value !== value));
  // Dinamis mode delete handlers
  const handleDeleteCalcBase = (value: string) => setCalcBaseOptions(calcBaseOptions.filter(c => c.value !== value));
  const handleDeleteCalcMethod = (value: string) => setCalcMethodOptions(calcMethodOptions.filter(c => c.value !== value));
  const handleDeleteDinamisRewardType = (value: string) => setDinamisRewardTypeOptions(dinamisRewardTypeOptions.filter(d => d.value !== value));
  // Game targeting delete handlers
  const handleDeleteGameType = (value: string) => setGameTypeOptions(gameTypeOptions.filter(g => g.value !== value));
  const handleDeleteGameProvider = (value: string) => setGameProviderOptions(gameProviderOptions.filter(p => p.value !== value));
  const handleDeleteGameName = (value: string) => setGameNameOptions(gameNameOptions.filter(n => n.value !== value));
  // Game blacklist delete handlers
  const handleDeleteGameTypeBlacklist = (value: string) => setGameTypeBlacklistOptions(gameTypeBlacklistOptions.filter(g => g.value !== value));
  const handleDeleteGameProviderBlacklist = (value: string) => setGameProviderBlacklistOptions(gameProviderBlacklistOptions.filter(p => p.value !== value));
  const handleDeleteGameNameBlacklist = (value: string) => setGameNameBlacklistOptions(gameNameBlacklistOptions.filter(n => n.value !== value));

  const addTier = () => {
    const newTier: TierReward = {
      id: Date.now().toString(),
      minimal_point: 0,
      reward: 0,
      reward_type: 'fixed',
      type: 'credit_game',
    };
    onChange({ tiers: [...data.tiers, newTier] });
  };

  const removeTier = (id: string) => {
    onChange({ tiers: data.tiers.filter(t => t.id !== id) });
  };

  const updateTier = (id: string, updates: Partial<TierReward>) => {
    onChange({
      tiers: data.tiers.map(t => t.id === id ? { ...t, ...updates } : t)
    });
  };

  const addFastExpMission = () => {
    const newMission: FastExpMission = {
      id: Date.now().toString(),
      activity: '',
      bonus_exp: 0,
    };
    onChange({ fast_exp_missions: [...data.fast_exp_missions, newMission] });
  };

  const removeFastExpMission = (id: string) => {
    onChange({ fast_exp_missions: data.fast_exp_missions.filter(m => m.id !== id) });
  };

  const updateFastExpMission = (id: string, updates: Partial<FastExpMission>) => {
    onChange({
      fast_exp_missions: data.fast_exp_missions.map(m => m.id === id ? { ...m, ...updates } : m)
    });
  };

  const addLevelUpReward = () => {
    const newReward: LevelUpReward = {
      id: Date.now().toString(),
      tier: '',
      min_exp: 0,
      reward: 0,
      reward_type: 'fixed',
      type: 'credit_game',
    };
    onChange({ level_up_rewards: [...data.level_up_rewards, newReward] });
  };

  const removeLevelUpReward = (id: string) => {
    onChange({ level_up_rewards: data.level_up_rewards.filter(r => r.id !== id) });
  };

  const updateLevelUpReward = (id: string, updates: Partial<LevelUpReward>) => {
    onChange({
      level_up_rewards: data.level_up_rewards.map(r => r.id === id ? { ...r, ...updates } : r)
    });
  };

  // Handler for adding special requirements (comma-separated)
  const handleAddRequirement = () => {
    if (!newRequirement.trim()) return;
    const newReqs = newRequirement.split(',').map(r => r.trim()).filter(r => r.length > 0);
    const existingReqs = data.special_requirements || [];
    const uniqueReqs = newReqs.filter(r => !existingReqs.includes(r));
    if (uniqueReqs.length > 0) {
      onChange({ special_requirements: [...existingReqs, ...uniqueReqs] });
    }
    setNewRequirement("");
  };

  // Handler for removing special requirement
  const handleRemoveRequirement = (req: string) => {
    onChange({ special_requirements: (data.special_requirements || []).filter(r => r !== req) });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="icon-circle">
          <Settings className="icon-circle-icon" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-button-hover">Step 3 — Konfigurasi Reward</h3>
          <p className="text-sm text-muted-foreground">
            Atur mode dan detail reward promo
          </p>
        </div>
      </div>

      {/* Blok A - Mode Reward (Radio Cards) */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">Mode Reward</Label>
        <div className="flex gap-4">
          {[
            { value: 'fixed', label: 'Fixed', desc: 'Reward tetap' },
            { value: 'formula', label: 'Dinamis', desc: 'Rumus kustom' },  // UI: 'Dinamis', Value: 'formula'
            { value: 'tier', label: 'Tier', desc: 'Berdasarkan level' },
          ].map((mode) => (
            <div
              key={mode.value}
              onClick={() => onChange({ reward_mode: mode.value as 'fixed' | 'tier' | 'formula' })}
              className={data.reward_mode === mode.value ? 'radio-card-selected' : 'radio-card'}
            >
              <input type="radio" className="sr-only" checked={data.reward_mode === mode.value} readOnly />
              <div className="text-center">
                <div className="font-semibold text-foreground">{mode.label}</div>
                <div className="text-xs text-muted-foreground">{mode.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Blok B - Mode Fixed */}
      {data.reward_mode === 'fixed' && (
        <Collapsible>
          <CollapsibleTrigger className="collapsible-trigger w-full">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-button-hover" />
              <div className="text-left">
                <div className="text-sm font-semibold text-foreground">Mode Fixed</div>
                <div className="text-xs text-muted-foreground">Konfigurasi bonus tetap</div>
              </div>
            </div>
            <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200" />
          </CollapsibleTrigger>
          <CollapsibleContent className="collapsible-content">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jenis Bonus</Label>
                <SelectWithAddNew
                  value={data.reward_type}
                  onValueChange={(value) => onChange({ reward_type: value })}
                  options={rewardTypeOptions}
                  onAddOption={(option) => setRewardTypeOptions([...rewardTypeOptions, option])}
                  onDeleteOption={handleDeleteRewardType}
                  placeholder="Pilih jenis bonus"
                />
                <p className="text-xs text-muted-foreground">
                  Bentuk bonus yang diterima player.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Nilai Bonus</Label>
                <Input
                  type="number"
                  value={data.reward_amount}
                  onChange={(e) => onChange({ reward_amount: Number(e.target.value) })}
                  placeholder="Contoh: 50000"
                />
                <p className="text-xs text-muted-foreground">
                  Besaran bonus yang diberikan.
                </p>
              </div>
              <div className="space-y-2">
                <Label>{getMinimumBaseLabel()}</Label>
                <Input
                  type="number"
                  value={data.min_requirement}
                  onChange={(e) => onChange({ min_requirement: Number(e.target.value) })}
                  placeholder="Contoh: 100000"
                />
                <p className="text-xs text-muted-foreground">
                  Batas minimal {getMinimumBaseType()} untuk mendapat bonus.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Batas Maksimal Bonus</Label>
                <Input
                  type="number"
                  value={data.max_claim}
                  onChange={(e) => onChange({ max_claim: Number(e.target.value) })}
                  placeholder="Contoh: 500000"
                />
                <p className="text-xs text-muted-foreground">
                  Nilai maksimum bonus yang dapat diterima.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Periode Klaim</Label>
                <SelectWithAddNew
                  value={data.claim_frequency}
                  onValueChange={(value) => onChange({ claim_frequency: value })}
                  options={claimFrequencyOptions}
                  onAddOption={(option) => setClaimFrequencyOptions([...claimFrequencyOptions, option])}
                  onDeleteOption={handleDeleteClaimFrequency}
                  placeholder="Pilih periode klaim"
                />
                <p className="text-xs text-muted-foreground">
                  Seberapa sering bonus dapat diajukan.
                </p>
              </div>
            </div>
            
            {/* Conditional Date Pickers for Claim Frequency */}
            {data.claim_frequency === 'tanggal_tertentu' && (
              <div className="mt-4 p-4 bg-muted rounded-lg space-y-4">
                <p className="text-xs text-muted-foreground">
                  💡 Untuk promo 1 hari saja, isi kedua tanggal dengan tanggal yang sama
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Dari Tanggal</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !data.claim_date_from && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {data.claim_date_from ? format(parse(data.claim_date_from, 'yyyy-MM-dd', new Date()), 'dd MMMM yyyy') : "Pilih tanggal"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={data.claim_date_from ? parse(data.claim_date_from, 'yyyy-MM-dd', new Date()) : undefined}
                          onSelect={(date) => onChange({ claim_date_from: date ? format(date, 'yyyy-MM-dd') : '' })}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Hingga Tanggal</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !data.claim_date_until && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {data.claim_date_until ? format(parse(data.claim_date_until, 'yyyy-MM-dd', new Date()), 'dd MMMM yyyy') : "Pilih tanggal"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={data.claim_date_until ? parse(data.claim_date_until, 'yyyy-MM-dd', new Date()) : undefined}
                          onSelect={(date) => onChange({ claim_date_until: date ? format(date, 'yyyy-MM-dd') : '' })}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Blok F - Mode Formula (UI: Dinamis) */}
      {data.reward_mode === 'formula' && (
        <>

          {/* Toggle Sub Kategori (Combo Promo) */}
          <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl">
            <Switch
              checked={data.has_subcategories || false}
              onCheckedChange={(checked) => {
                if (checked && (!data.subcategories || data.subcategories.length === 0)) {
                  // Auto-create first sub-category when toggle ON
                  onChange({ 
                    has_subcategories: true, 
                    subcategories: [createInitialSubCategory(1)] 
                  });
                } else {
                  onChange({ has_subcategories: checked });
                }
              }}
            />
            <div className="flex-1">
              <div className="font-medium text-sm text-button-hover flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Aktifkan Sub Kategori (Combo Promo){data.has_subcategories && ` (${data.subcategories?.length || 0})`}
              </div>
              <p className="text-xs text-muted-foreground">
                Jika diaktifkan, promo ini memiliki beberapa sub kategori / varian bonus.
              </p>
            </div>
            
            {/* Button - HANYA tampil jika toggle ON */}
            {data.has_subcategories && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const currentCount = data.subcategories?.length || 0;
                  if (currentCount >= 10) {
                    toast.error("Maksimum 10 sub kategori");
                    return;
                  }
                  const newSubCategory = createInitialSubCategory(currentCount + 1);
                  onChange({ subcategories: [...(data.subcategories || []), newSubCategory] });
                  toast.success(`Sub Kategori ${currentCount + 1} ditambahkan`);
                }}
                disabled={(data.subcategories?.length || 0) >= 10}
                className="h-8 px-3 bg-muted text-muted-foreground hover:bg-button-hover hover:text-button-hover-foreground"
              >
                <Plus className="h-4 w-4 mr-1" />
                Tambah Sub Kategori
              </Button>
            )}
          </div>

          {/* Sub Category Cards - Only when toggle ON */}
          {data.has_subcategories && (
            <div className="space-y-4 mt-4">
                {(data.subcategories || []).map((subCategory, index) => (
                  <SubCategoryCard
                    key={subCategory.id}
                    subCategory={subCategory}
                    index={index}
                    globalJenisHadiahEnabled={data.global_jenis_hadiah_enabled}
                    globalMaxBonusEnabled={data.global_max_bonus_enabled}
                    globalPayoutDirectionEnabled={data.global_payout_direction_enabled}
                    // Inverse logic callbacks - when sub-category toggle ON, turn global OFF
                    onInvertGlobalJenisHadiah={() => onChange({ global_jenis_hadiah_enabled: false })}
                    onInvertGlobalMaxBonus={() => onChange({ global_max_bonus_enabled: false })}
                    onInvertGlobalPayoutDirection={() => onChange({ global_payout_direction_enabled: false })}
                    onChange={(updates) => {
                      const updatedSubcategories = [...(data.subcategories || [])];
                      updatedSubcategories[index] = { ...subCategory, ...updates };
                      onChange({ subcategories: updatedSubcategories });
                    }}
                    onDelete={() => {
                      const currentCount = data.subcategories?.length || 0;
                      if (currentCount <= 1) {
                        toast.error("Minimal 1 sub kategori harus ada");
                        return;
                      }
                      const updatedSubcategories = (data.subcategories || []).filter((_, i) => i !== index);
                      onChange({ subcategories: updatedSubcategories });
                      toast.success("Sub kategori dihapus");
                    }}
                    onSave={() => {
                      toast.success(`${subCategory.name || `Sub Kategori ${index + 1}`} disimpan`);
                    }}
                  />
                ))}
            </div>
          )}

          {/* Section 1-3: Only show when NOT using subcategories */}
          {!data.has_subcategories && (
            <>
          {/* Section 1 - Dasar Perhitungan Bonus */}
          <Collapsible>
            <CollapsibleTrigger className="w-full p-4 bg-card border border-border rounded-xl flex items-center justify-between mb-4 hover:bg-card/80 transition-colors group">
              <div className="flex items-center gap-3">
                <Calculator className="h-5 w-5 text-button-hover" />
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">1. Dasar Perhitungan Bonus</div>
                  <div className="text-xs text-muted-foreground">Konfigurasi dasar kalkulasi reward</div>
                </div>
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mb-6">
            
            {/* Row 1: Jenis Hadiah & Max Bonus (2 kolom) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Jenis Hadiah */}
              <div className="space-y-2">
                <Label>Jenis Hadiah</Label>
                <SelectWithAddNew
                  value={data.dinamis_reward_type}
                  onValueChange={(value) => onChange({ dinamis_reward_type: value })}
                  options={dinamisRewardTypeOptions}
                  onAddOption={(option) => setDinamisRewardTypeOptions([...dinamisRewardTypeOptions, option])}
                  onDeleteOption={handleDeleteDinamisRewardType}
                  placeholder="Pilih jenis"
                />
              </div>
              
              {/* Max Bonus */}
              <div className="space-y-2">
                <Label>Max Bonus</Label>
                <Input
                  type="text"
                  value={data.dinamis_max_claim ? data.dinamis_max_claim.toLocaleString('id-ID') : ''}
                  onChange={(e) => onChange({ dinamis_max_claim: Number(e.target.value.replace(/\D/g, '')) })}
                  placeholder="Contoh: 100.000"
                />
              </div>
            </div>
            
            {/* Row 2: Payout Direction & Admin Fee (2 kolom) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Payout Direction */}
              <div className="space-y-2">
                <Label>Payout Direction</Label>
                <RadioGroup
                  value={data.global_payout_direction || 'after'}
                  onValueChange={(value: 'before' | 'after') => onChange({ global_payout_direction: value })}
                  className="flex gap-6 pt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="before" id="payout-before-global" />
                    <Label htmlFor="payout-before-global" className="cursor-pointer font-normal text-sm">Didepan</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="after" id="payout-after-global" />
                    <Label htmlFor="payout-after-global" className="cursor-pointer font-normal text-sm">Dibelakang</Label>
                  </div>
                </RadioGroup>
              </div>
              
              {/* Admin Fee */}
              <div className="space-y-2">
                <Label>Admin Fee (Opsional)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={data.admin_fee_percentage ?? 0}
                    onChange={(e) => onChange({ admin_fee_percentage: Number(e.target.value) || 0 })}
                    placeholder="0"
                    className="pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
              </div>
            </div>
            
            {/* Row 3: Dasar Perhitungan & Jenis Perhitungan */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dasar Perhitungan</Label>
                <SelectWithAddNew
                  value={data.calculation_base}
                  onValueChange={(value) => onChange({ calculation_base: value })}
                  options={calcBaseOptions}
                  onAddOption={(option) => setCalcBaseOptions([...calcBaseOptions, option])}
                  onDeleteOption={handleDeleteCalcBase}
                  placeholder="Pilih dasar (TO, Deposit, dll)"
                />
              </div>
              <div className="space-y-2">
                <Label>Jenis Perhitungan</Label>
                <SelectWithAddNew
                  value={data.calculation_method}
                  onValueChange={(value) => onChange({ calculation_method: value })}
                  options={calcMethodOptions}
                  onAddOption={(option) => setCalcMethodOptions([...calcMethodOptions, option])}
                  onDeleteOption={handleDeleteCalcMethod}
                  placeholder="Pilih jenis (%, Fixed)"
                />
              </div>
              <div className="space-y-2">
                <Label>Nilai Bonus</Label>
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={calcValueInput}
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/[^0-9.,]/g, '');
                      setCalcValueInput(rawValue);
                      const normalizedValue = rawValue.replace(',', '.');
                      const numValue = parseFloat(normalizedValue);
                      if (!isNaN(numValue)) {
                        onChange({ calculation_value: numValue });
                      } else if (rawValue === '' || rawValue === '0' || rawValue === '0,' || rawValue === '0.') {
                        onChange({ calculation_value: 0 });
                      }
                    }}
                    onBlur={() => {
                      if (data.calculation_value !== undefined && data.calculation_value !== null) {
                        setCalcValueInput(String(data.calculation_value).replace('.', ','));
                      }
                    }}
                    placeholder="Contoh: 0,5"
                    className="pr-10"
                  />
                  {data.calculation_method === 'percentage' && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  )}
                </div>
              </div>
              
              {/* Minimal Perhitungan - Same row as Nilai Bonus */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{getMinimumBaseLabel()}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Aktifkan</span>
                    <Switch
                      checked={data.minimum_base_enabled}
                      onCheckedChange={(checked) => onChange({ 
                        minimum_base_enabled: checked,
                        minimum_base: checked ? data.minimum_base : 0
                      })}
                    />
                  </div>
                </div>
                <Input
                  type="text"
                  value={data.minimum_base_enabled && data.minimum_base ? data.minimum_base.toLocaleString('id-ID') : ''}
                  onChange={(e) => onChange({ minimum_base: Number(e.target.value.replace(/\D/g, '')) })}
                  placeholder={data.minimum_base_enabled ? "Contoh: 1.000.000" : "Tidak aktif"}
                  disabled={!data.minimum_base_enabled}
                  className={!data.minimum_base_enabled ? "opacity-50" : ""}
                />
              </div>
            </div>
            
            {/* Ilustrasi Perhitungan - Collapsible like SubCategoryCard */}
            {data.calculation_method === 'percentage' && data.calculation_value > 0 && (
              <Collapsible>
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
                        <div className="text-xs font-medium text-muted-foreground">{data.calculation_base === 'turnover' ? 'Turnover' : data.calculation_base === 'deposit' ? 'Deposit' : 'Nilai'}</div>
                        <div className="text-xs font-medium text-muted-foreground">Kalkulasi</div>
                        <div className="text-xs font-medium text-muted-foreground">Perkiraan Bonus</div>
                      </div>
                      {(() => {
                        const percentage = data.calculation_value;
                        const minBase = data.minimum_base || 1000000;
                        const maxClaim = data.dinamis_max_claim_unlimited ? Infinity : (data.dinamis_max_claim || Infinity);
                        const sampleLevels = [minBase, minBase * 2, minBase * 5];
                        return sampleLevels.map((to, idx) => {
                          const rawReward = Math.floor(to * percentage / 100);
                          const finalReward = Math.min(rawReward, maxClaim);
                          const isCapped = rawReward > maxClaim && maxClaim !== Infinity;
                          return (
                            <div key={idx} className="grid grid-cols-3 px-4 py-2 border-b border-border last:border-b-0">
                              <div className="text-sm text-foreground">Rp {to.toLocaleString('id-ID')}</div>
                              <div className="text-xs text-muted-foreground">{percentage}%</div>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${isCapped ? 'text-warning' : 'text-foreground'}`}>
                                  Rp {finalReward.toLocaleString('id-ID')}
                                </span>
                                {isCapped && <span className="text-xs text-warning">(max)</span>}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                    <p className="text-xs text-warning mt-3 flex items-center gap-2">
                      <span>⚠️</span>
                      <span>Nilai ini hanya ilustrasi.</span>
                    </p>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )}

            {/* Syarat Main Sebelum WD - Styled like SubCategoryCard */}
            <div className="pt-4">
              <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl mb-2">
                <Switch
                  checked={data.turnover_rule_enabled === true}
                  onCheckedChange={(checked) => onChange({ turnover_rule_enabled: checked })}
                />
                <div>
                  <div className="font-medium text-sm text-button-hover">Syarat Main Sebelum WD</div>
                  <p className="text-xs text-muted-foreground">
                    Aktifkan jika promo memiliki syarat kelipatan main (turnover) sebelum withdrawal
                  </p>
                </div>
              </div>
              
              {data.turnover_rule_enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Kelipatan Main Bonus (TO)</Label>
                    <SelectWithAddNew
                      value={data.turnover_rule}
                      onValueChange={(value) => onChange({ turnover_rule: value })}
                      options={turnoverRuleOptions}
                      onAddOption={(option) => setTurnoverRuleOptions([...turnoverRuleOptions, option])}
                      onDeleteOption={handleDeleteTurnoverRule}
                      placeholder="Pilih kelipatan main"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nilai Custom</Label>
                    <Input
                      value={data.turnover_rule_custom || ''}
                      onChange={(e) => onChange({ turnover_rule_custom: e.target.value })}
                      placeholder="Contoh: 3x, 10x, 12x"
                      disabled={data.turnover_rule !== 'custom'}
                      className={data.turnover_rule !== 'custom' ? 'opacity-50' : ''}
                    />
                  </div>
                </div>
              )}
            </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Section 2 - Permainan & Provider */}
          <Collapsible>
            <CollapsibleTrigger className="w-full p-4 bg-card border border-border rounded-xl flex items-center justify-between mb-4 hover:bg-card/80 transition-colors group">
              <div className="flex items-center gap-3">
                <Gamepad2 className="h-5 w-5 text-button-hover" />
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">2. Permainan & Provider</div>
                  <div className="text-xs text-muted-foreground">Target game dan provider untuk promo</div>
                </div>
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mb-6">
              {/* Jenis Game - Multi-select dengan Badges */}
              <div className="space-y-2 mb-4">
                <Label>Jenis Game</Label>
                {(data.game_types?.length > 0 || data.game_restriction) && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(data.game_types || []).map((type, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-button-hover/20 rounded-full text-sm text-button-hover border border-button-hover/40">
                        {gameTypeOptions.find(g => g.value === type)?.label || type}
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...(data.game_types || [])];
                            updated.splice(idx, 1);
                            onChange({ game_types: updated });
                          }}
                          className="hover:text-destructive transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <SelectWithAddNew
                  value=""
                  onValueChange={(value) => {
                    if (value && !data.game_types?.includes(value)) {
                      onChange({ game_types: [...(data.game_types || []), value], game_restriction: value });
                    }
                  }}
                  options={gameTypeOptions}
                  onAddOption={(option) => setGameTypeOptions([...gameTypeOptions, option])}
                  onDeleteOption={handleDeleteGameType}
                  placeholder="Pilih jenis game"
                />
                <p className="text-xs text-muted-foreground">
                  Kategori game yang berlaku untuk promo ini
                </p>
              </div>
              
              {/* Provider Game - Multi-select dengan Badges */}
              <div className="space-y-2 mb-4">
                <Label>Provider Game</Label>
                {data.game_providers?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {data.game_providers.map((provider, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-button-hover/20 rounded-full text-sm text-button-hover border border-button-hover/40">
                        {gameProviderOptions.find(p => p.value === provider)?.label || provider}
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...data.game_providers];
                            updated.splice(idx, 1);
                            onChange({ game_providers: updated });
                          }}
                          className="hover:text-destructive transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <SelectWithAddNew
                  value=""
                  onValueChange={(value) => {
                    if (value && !data.game_providers?.includes(value)) {
                      onChange({ game_providers: [...(data.game_providers || []), value] });
                    }
                  }}
                  options={gameProviderOptions}
                  onAddOption={(option) => setGameProviderOptions([...gameProviderOptions, option])}
                  onDeleteOption={handleDeleteGameProvider}
                  placeholder="Pilih provider"
                />
                <p className="text-xs text-muted-foreground">
                  Provider/vendor game (PG SOFT, Pragmatic, dll)
                </p>
              </div>
              
              {/* Nama Game - Multi-select dengan Badges */}
              <div className="space-y-2">
                <Label>Nama Game</Label>
                {data.game_names?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {data.game_names.map((name, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-button-hover/20 rounded-full text-sm text-button-hover border border-button-hover/40">
                        {gameNameOptions.find(n => n.value === name)?.label || name}
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...data.game_names];
                            updated.splice(idx, 1);
                            onChange({ game_names: updated });
                          }}
                          className="hover:text-destructive transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <SelectWithAddNew
                  value=""
                  onValueChange={(value) => {
                    if (value && !data.game_names?.includes(value)) {
                      onChange({ game_names: [...(data.game_names || []), value] });
                    }
                  }}
                  options={gameNameOptions}
                  onAddOption={(option) => setGameNameOptions([...gameNameOptions, option])}
                  onDeleteOption={handleDeleteGameName}
                  placeholder="Pilih nama game"
                />
                <p className="text-xs text-muted-foreground">
                  Nama spesifik game (Mahjong Wins, Spaceman, dll)
                </p>
              </div>
              
              {/* Blok 2B - Game Dilarang (Blacklist) - Styled like SubCategoryCard */}
              <div className="mt-6 pt-4 border-t border-border">
                <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl mb-4">
                  <Switch
                    checked={data.game_blacklist_enabled ?? false}
                    onCheckedChange={(checked) => onChange({ game_blacklist_enabled: checked })}
                  />
                  <div>
                    <div className="font-medium text-sm text-button-hover">Game Dilarang (Blacklist)</div>
                    <p className="text-xs text-muted-foreground">
                      Aktifkan untuk kecualikan game tertentu dari promo ini
                    </p>
                  </div>
                </div>
                
                {data.game_blacklist_enabled && (
                  <div className="space-y-4">
                    {/* Helper text */}
                    <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                      <p className="text-xs text-warning">
                        ⚠️ Jika diaktifkan, promo TIDAK berlaku untuk kombinasi jenis game / provider / nama game yang dipilih di sini, walaupun termasuk di daftar game diizinkan di atas.
                      </p>
                    </div>
                    
                    {/* Jenis Game Blacklist - Multi-select dengan Badges */}
                    <div className="space-y-2">
                      <Label>Jenis Game Dilarang</Label>
                      {data.game_types_blacklist?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {data.game_types_blacklist.map((type, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-destructive/20 rounded-full text-sm text-destructive border border-destructive/40">
                              {gameTypeBlacklistOptions.find(g => g.value === type)?.label || type}
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...data.game_types_blacklist];
                                  updated.splice(idx, 1);
                                  onChange({ game_types_blacklist: updated });
                                }}
                                className="hover:text-destructive transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <SelectWithAddNew
                        value=""
                        onValueChange={(value) => {
                          if (value && !data.game_types_blacklist?.includes(value)) {
                            onChange({ game_types_blacklist: [...(data.game_types_blacklist || []), value] });
                          }
                        }}
                        options={gameTypeBlacklistOptions}
                        onAddOption={(option) => setGameTypeBlacklistOptions([...gameTypeBlacklistOptions, option])}
                        onDeleteOption={handleDeleteGameTypeBlacklist}
                        placeholder="Pilih jenis game"
                      />
                    </div>
                    
                    {/* Provider Blacklist - Multi-select dengan Badges */}
                    <div className="space-y-2">
                      <Label>Provider Game Dilarang</Label>
                      {data.game_providers_blacklist?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {data.game_providers_blacklist.map((provider, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-destructive/20 rounded-full text-sm text-destructive border border-destructive/40">
                              {gameProviderBlacklistOptions.find(p => p.value === provider)?.label || provider}
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...data.game_providers_blacklist];
                                  updated.splice(idx, 1);
                                  onChange({ game_providers_blacklist: updated });
                                }}
                                className="hover:text-destructive transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <SelectWithAddNew
                        value=""
                        onValueChange={(value) => {
                          if (value && !data.game_providers_blacklist?.includes(value)) {
                            onChange({ game_providers_blacklist: [...(data.game_providers_blacklist || []), value] });
                          }
                        }}
                        options={gameProviderBlacklistOptions}
                        onAddOption={(option) => setGameProviderBlacklistOptions([...gameProviderBlacklistOptions, option])}
                        onDeleteOption={handleDeleteGameProviderBlacklist}
                        placeholder="Pilih provider"
                      />
                    </div>
                    
                    {/* Nama Game Blacklist - Multi-select dengan Badges */}
                    <div className="space-y-2">
                      <Label>Nama Game Dilarang</Label>
                      {data.game_names_blacklist?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {data.game_names_blacklist.map((name, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-destructive/20 rounded-full text-sm text-destructive border border-destructive/40">
                              {gameNameBlacklistOptions.find(n => n.value === name)?.label || name}
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...data.game_names_blacklist];
                                  updated.splice(idx, 1);
                                  onChange({ game_names_blacklist: updated });
                                }}
                                className="hover:text-destructive transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <SelectWithAddNew
                        value=""
                        onValueChange={(value) => {
                          if (value && !data.game_names_blacklist?.includes(value)) {
                            onChange({ game_names_blacklist: [...(data.game_names_blacklist || []), value] });
                          }
                        }}
                        options={gameNameBlacklistOptions}
                        onAddOption={(option) => setGameNameBlacklistOptions([...gameNameBlacklistOptions, option])}
                        onDeleteOption={handleDeleteGameNameBlacklist}
                        placeholder="Pilih nama game"
                      />
                    </div>
                    
                    {/* Badge-based - Aturan Pengecualian Khusus */}
                    <div className="space-y-3">
                      <Label>Aturan Pengecualian Khusus</Label>
                      <div className="flex flex-wrap gap-2">
                        {(data.game_exclusion_rules || []).map((rule, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-sm text-foreground">
                            {rule}
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...(data.game_exclusion_rules || [])];
                                updated.splice(idx, 1);
                                onChange({ game_exclusion_rules: updated });
                              }}
                              className="hover:text-destructive transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={newExclusionRule}
                          onChange={(e) => setNewExclusionRule(e.target.value)}
                          placeholder="Contoh: Semua slot 3 line, old game slot"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newExclusionRule.trim()) {
                              e.preventDefault();
                              onChange({ game_exclusion_rules: [...(data.game_exclusion_rules || []), newExclusionRule.trim()] });
                              setNewExclusionRule('');
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            if (newExclusionRule.trim()) {
                              onChange({ game_exclusion_rules: [...(data.game_exclusion_rules || []), newExclusionRule.trim()] });
                              setNewExclusionRule('');
                            }
                          }}
                          className="bg-muted text-muted-foreground hover:bg-button-hover hover:text-button-hover-foreground"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Tambah
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Untuk kasus khusus yang tidak tercakup dropdown (HEROES, game 3 line, dll)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
            </>
          )}

          {/* Section 4 - Hadiah dan Waktu (Always visible - shared across subcategories) */}
          <Collapsible>
            <CollapsibleTrigger className="collapsible-trigger w-full">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-button-hover" />
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">4. Hadiah dan Waktu</div>
                  <div className="text-xs text-muted-foreground">Jenis hadiah, waktu claim, dan periode pembagian</div>
                </div>
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent className="collapsible-content">
              {/* Global Jenis Hadiah & Max Bonus - 2 kolom */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Jenis Hadiah (Global) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Jenis Hadiah (Global)</Label>
                    <Switch
                      checked={data.global_jenis_hadiah_enabled}
                      onCheckedChange={(checked) => {
                        onChange({ global_jenis_hadiah_enabled: checked });
                        // Inverse logic: jika global ON, semua subcategory toggle harus OFF
                        if (checked && data.subcategories?.length) {
                          const updatedSubcategories = data.subcategories.map(sub => ({
                            ...sub,
                            jenis_hadiah_same_as_global: false
                          }));
                          onChange({ global_jenis_hadiah_enabled: checked, subcategories: updatedSubcategories });
                        }
                      }}
                    />
                  </div>
                  <SelectWithAddNew
                    value={data.global_jenis_hadiah || ''}
                    onValueChange={(value) => onChange({ global_jenis_hadiah: value })}
                    options={dinamisRewardTypeOptions}
                    onAddOption={(option) => setDinamisRewardTypeOptions([...dinamisRewardTypeOptions, option])}
                    onDeleteOption={handleDeleteDinamisRewardType}
                    placeholder="Pilih jenis hadiah"
                    disabled={!data.global_jenis_hadiah_enabled}
                    className={!data.global_jenis_hadiah_enabled ? "opacity-50" : ""}
                  />
                  <p className="text-xs text-muted-foreground">
                    {data.global_jenis_hadiah_enabled 
                      ? "Semua sub kategori mengikuti."
                      : "Sub kategori set sendiri."}
                  </p>
                </div>
                
                {/* Max Bonus (Global) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Max Bonus (Global)</Label>
                    <Switch
                      checked={data.global_max_bonus_enabled}
                      onCheckedChange={(checked) => {
                        onChange({ global_max_bonus_enabled: checked });
                        // Inverse logic: jika global ON, semua subcategory toggle harus OFF
                        if (checked && data.subcategories?.length) {
                          const updatedSubcategories = data.subcategories.map(sub => ({
                            ...sub,
                            max_bonus_same_as_global: false
                          }));
                          onChange({ global_max_bonus_enabled: checked, subcategories: updatedSubcategories });
                        }
                      }}
                    />
                  </div>
                  <Input
                    type="text"
                    value={data.global_max_bonus ? data.global_max_bonus.toLocaleString('id-ID') : ''}
                    onChange={(e) => onChange({ global_max_bonus: Number(e.target.value.replace(/\D/g, '')) })}
                    placeholder="Contoh: 100.000.000"
                    disabled={!data.global_max_bonus_enabled}
                    className={!data.global_max_bonus_enabled ? "opacity-50" : ""}
                  />
                  <p className="text-xs text-muted-foreground">
                    {data.global_max_bonus_enabled 
                      ? "Semua sub kategori mengikuti."
                      : "Sub kategori set sendiri."}
                  </p>
                </div>
              </div>
              
              {/* Row: Payout Direction + Admin Fee */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Kolom Kiri: Payout Direction */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Payout Direction (Global)</Label>
                    <Switch
                      checked={data.global_payout_direction_enabled}
                      onCheckedChange={(checked) => {
                        onChange({ global_payout_direction_enabled: checked });
                        if (checked && data.subcategories?.length) {
                          const updatedSubcategories = data.subcategories.map(sub => ({
                            ...sub,
                            payout_direction_same_as_global: false
                          }));
                          onChange({ global_payout_direction_enabled: checked, subcategories: updatedSubcategories });
                        }
                      }}
                    />
                  </div>
                  <RadioGroup
                    value={data.global_payout_direction || 'after'}
                    onValueChange={(value: 'before' | 'after') => onChange({ global_payout_direction: value })}
                    className={cn("flex gap-6 pt-2", !data.global_payout_direction_enabled && "opacity-50 pointer-events-none")}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="before" id="global-payout-before" disabled={!data.global_payout_direction_enabled} />
                      <Label htmlFor="global-payout-before" className="cursor-pointer font-normal">Didepan</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="after" id="global-payout-after" disabled={!data.global_payout_direction_enabled} />
                      <Label htmlFor="global-payout-after" className="cursor-pointer font-normal">Dibelakang</Label>
                    </div>
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground">
                    {data.global_payout_direction_enabled 
                      ? "Semua sub kategori mengikuti."
                      : "Sub kategori set sendiri."}
                  </p>
                </div>
                
                {/* Kolom Kanan: Admin Fee (Global) - untuk SEMUA promo type */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Admin Fee (Opsional)</Label>
                      <Switch
                        checked={data.admin_fee_enabled ?? false}
                        onCheckedChange={(checked) => {
                          onChange({ 
                            admin_fee_enabled: checked,
                            admin_fee_percentage: checked ? data.admin_fee_percentage : null
                          });
                        }}
                      />
                    </div>
                    {data.admin_fee_enabled && (
                      <div className="relative animate-in fade-in slide-in-from-top-2 duration-200">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={data.admin_fee_percentage ?? ''}
                          onChange={(e) => onChange({ admin_fee_percentage: e.target.value ? Number(e.target.value) : null })}
                          placeholder="Contoh: 20"
                          className="pr-10"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Potongan admin pada perhitungan komisi.
                    </p>
                  </div>
              </div>

              {/* Periode Klaim & Waktu Pembagian Bonus */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Periode Klaim</Label>
                  <SelectWithAddNew
                    value={data.claim_frequency}
                    onValueChange={(value) => onChange({ claim_frequency: value })}
                    options={claimFrequencyOptions}
                    onAddOption={(option) => setClaimFrequencyOptions([...claimFrequencyOptions, option])}
                    onDeleteOption={handleDeleteClaimFrequency}
                    placeholder="Pilih periode"
                  />
                  <p className="text-xs text-muted-foreground">
                    Seberapa sering bonus dihitung dan dapat diajukan.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Waktu Pembagian Bonus</Label>
                  <SelectWithAddNew
                    value={data.reward_distribution}
                    onValueChange={(value) => onChange({ reward_distribution: value })}
                    options={rewardDistributionOptions}
                    onAddOption={(option) => setRewardDistributionOptions([...rewardDistributionOptions, option])}
                    onDeleteOption={handleDeleteRewardDistribution}
                    placeholder="Pilih waktu pembagian"
                  />
                  <p className="text-xs text-muted-foreground">
                    Kapan bonus dikirim setelah periode berakhir.
                  </p>
                </div>
              </div>
              
              {/* Conditional untuk Hari Tertentu */}
              {(data.claim_frequency === 'hari_tertentu' || data.reward_distribution === 'hari_tertentu') && (
                <div className="mt-4 p-4 bg-muted rounded-lg space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Hari</Label>
                      <SelectWithAddNew
                        value={data.distribution_day || ''}
                        onValueChange={(value) => onChange({ distribution_day: value })}
                        options={[
                          { value: 'senin', label: 'Senin' },
                          { value: 'selasa', label: 'Selasa' },
                          { value: 'rabu', label: 'Rabu' },
                          { value: 'kamis', label: 'Kamis' },
                          { value: 'jumat', label: 'Jumat' },
                          { value: 'sabtu', label: 'Sabtu' },
                          { value: 'minggu', label: 'Minggu' },
                          { value: 'setiap_hari', label: 'Setiap Hari' },
                        ]}
                        placeholder="Pilih hari"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Dari Jam (WIB)</Label>
                        <Switch 
                          checked={data.distribution_day_time_enabled || false}
                          onCheckedChange={(checked) => onChange({ distribution_day_time_enabled: checked })}
                        />
                      </div>
                      <SelectWithAddNew
                        value={data.distribution_time_from || ''}
                        onValueChange={(value) => onChange({ distribution_time_from: value })}
                        options={[
                          { value: '00:00', label: '00:00' },
                          { value: '01:00', label: '01:00' },
                          { value: '02:00', label: '02:00' },
                          { value: '03:00', label: '03:00' },
                          { value: '04:00', label: '04:00' },
                          { value: '05:00', label: '05:00' },
                          { value: '06:00', label: '06:00' },
                          { value: '07:00', label: '07:00' },
                          { value: '08:00', label: '08:00' },
                          { value: '09:00', label: '09:00' },
                          { value: '10:00', label: '10:00' },
                          { value: '11:00', label: '11:00' },
                          { value: '12:00', label: '12:00' },
                          { value: '13:00', label: '13:00' },
                          { value: '14:00', label: '14:00' },
                          { value: '15:00', label: '15:00' },
                          { value: '16:00', label: '16:00' },
                          { value: '17:00', label: '17:00' },
                          { value: '18:00', label: '18:00' },
                          { value: '19:00', label: '19:00' },
                          { value: '20:00', label: '20:00' },
                          { value: '21:00', label: '21:00' },
                          { value: '22:00', label: '22:00' },
                          { value: '23:00', label: '23:00' },
                        ]}
                        placeholder="Pilih jam mulai"
                        disabled={!data.distribution_day_time_enabled}
                        className={!data.distribution_day_time_enabled ? "opacity-50" : ""}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Hingga Jam (WIB)</Label>
                      <SelectWithAddNew
                        value={data.distribution_time_until || ''}
                        onValueChange={(value) => onChange({ distribution_time_until: value })}
                        options={[
                          { value: '00:00', label: '00:00' },
                          { value: '01:00', label: '01:00' },
                          { value: '02:00', label: '02:00' },
                          { value: '03:00', label: '03:00' },
                          { value: '04:00', label: '04:00' },
                          { value: '05:00', label: '05:00' },
                          { value: '06:00', label: '06:00' },
                          { value: '07:00', label: '07:00' },
                          { value: '08:00', label: '08:00' },
                          { value: '09:00', label: '09:00' },
                          { value: '10:00', label: '10:00' },
                          { value: '11:00', label: '11:00' },
                          { value: '12:00', label: '12:00' },
                          { value: '13:00', label: '13:00' },
                          { value: '14:00', label: '14:00' },
                          { value: '15:00', label: '15:00' },
                          { value: '16:00', label: '16:00' },
                          { value: '17:00', label: '17:00' },
                          { value: '18:00', label: '18:00' },
                          { value: '19:00', label: '19:00' },
                          { value: '20:00', label: '20:00' },
                          { value: '21:00', label: '21:00' },
                          { value: '22:00', label: '22:00' },
                          { value: '23:00', label: '23:00' },
                          { value: '23:59', label: '23:59' },
                        ]}
                        placeholder="Pilih jam selesai"
                        disabled={!data.distribution_day_time_enabled}
                        className={!data.distribution_day_time_enabled ? "opacity-50" : ""}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-yellow-500">
                    💡 Contoh: Rollingan mingguan dikirim setiap Senin 14:00 - 16:00 WIB.
                  </p>
                </div>
              )}

              {/* Conditional untuk Tanggal Tertentu */}
              {(data.claim_frequency === 'tanggal_tertentu' || data.reward_distribution === 'tanggal_tertentu') && (
                <div className="mt-4 p-4 bg-muted rounded-lg space-y-4">
                  {/* Periode Aktif Promo */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-button-hover" />
                      <span className="text-sm font-medium">Periode Aktif Promo</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Dari Tanggal</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal rounded-lg",
                                !data.claim_date_from && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {data.claim_date_from ? format(parse(data.claim_date_from, 'yyyy-MM-dd', new Date()), 'dd MMMM yyyy') : "Pilih tanggal"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={data.claim_date_from ? parse(data.claim_date_from, 'yyyy-MM-dd', new Date()) : undefined}
                              onSelect={(date) => onChange({ claim_date_from: date ? format(date, 'yyyy-MM-dd') : '' })}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label>Hingga Tanggal</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal rounded-lg",
                                !data.claim_date_until && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {data.claim_date_until ? format(parse(data.claim_date_until, 'yyyy-MM-dd', new Date()), 'dd MMMM yyyy') : "Pilih tanggal"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={data.claim_date_until ? parse(data.claim_date_until, 'yyyy-MM-dd', new Date()) : undefined}
                              onSelect={(date) => onChange({ claim_date_until: date ? format(date, 'yyyy-MM-dd') : '' })}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      💡 Untuk promo 1 hari saja, isi kedua tanggal dengan tanggal yang sama
                    </p>
                  </div>

                  {/* Batas Jam Aktif (Opsional) */}
                  <div className="space-y-3 pt-3 border-t border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-button-hover" />
                        <span className="text-sm font-medium">Batas Jam Aktif (Opsional)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={data.distribution_time_enabled || false}
                          onCheckedChange={(checked) => onChange({ distribution_time_enabled: checked })}
                        />
                        <span className="text-xs text-muted-foreground">
                          {data.distribution_time_enabled ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>
                    </div>

                    {data.distribution_time_enabled && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Dari Jam</Label>
                          <SelectWithAddNew
                            value={data.distribution_time_from || ''}
                            onValueChange={(value) => onChange({ distribution_time_from: value })}
                            options={[
                              { value: '00:00', label: '00:00 WIB' },
                              { value: '01:00', label: '01:00 WIB' },
                              { value: '02:00', label: '02:00 WIB' },
                              { value: '03:00', label: '03:00 WIB' },
                              { value: '04:00', label: '04:00 WIB' },
                              { value: '05:00', label: '05:00 WIB' },
                              { value: '06:00', label: '06:00 WIB' },
                              { value: '07:00', label: '07:00 WIB' },
                              { value: '08:00', label: '08:00 WIB' },
                              { value: '09:00', label: '09:00 WIB' },
                              { value: '10:00', label: '10:00 WIB' },
                              { value: '11:00', label: '11:00 WIB' },
                              { value: '12:00', label: '12:00 WIB' },
                              { value: '13:00', label: '13:00 WIB' },
                              { value: '14:00', label: '14:00 WIB' },
                              { value: '15:00', label: '15:00 WIB' },
                              { value: '16:00', label: '16:00 WIB' },
                              { value: '17:00', label: '17:00 WIB' },
                              { value: '18:00', label: '18:00 WIB' },
                              { value: '19:00', label: '19:00 WIB' },
                              { value: '20:00', label: '20:00 WIB' },
                              { value: '21:00', label: '21:00 WIB' },
                              { value: '22:00', label: '22:00 WIB' },
                              { value: '23:00', label: '23:00 WIB' },
                            ]}
                            placeholder="Pilih jam mulai"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Hingga Jam</Label>
                          <SelectWithAddNew
                            value={data.distribution_time_until || ''}
                            onValueChange={(value) => onChange({ distribution_time_until: value })}
                            options={[
                              { value: '00:00', label: '00:00 WIB' },
                              { value: '01:00', label: '01:00 WIB' },
                              { value: '02:00', label: '02:00 WIB' },
                              { value: '03:00', label: '03:00 WIB' },
                              { value: '04:00', label: '04:00 WIB' },
                              { value: '05:00', label: '05:00 WIB' },
                              { value: '06:00', label: '06:00 WIB' },
                              { value: '07:00', label: '07:00 WIB' },
                              { value: '08:00', label: '08:00 WIB' },
                              { value: '09:00', label: '09:00 WIB' },
                              { value: '10:00', label: '10:00 WIB' },
                              { value: '11:00', label: '11:00 WIB' },
                              { value: '12:00', label: '12:00 WIB' },
                              { value: '13:00', label: '13:00 WIB' },
                              { value: '14:00', label: '14:00 WIB' },
                              { value: '15:00', label: '15:00 WIB' },
                              { value: '16:00', label: '16:00 WIB' },
                              { value: '17:00', label: '17:00 WIB' },
                              { value: '18:00', label: '18:00 WIB' },
                              { value: '19:00', label: '19:00 WIB' },
                              { value: '20:00', label: '20:00 WIB' },
                              { value: '21:00', label: '21:00 WIB' },
                              { value: '22:00', label: '22:00 WIB' },
                              { value: '23:59', label: '23:59 WIB' },
                            ]}
                            placeholder="Pilih jam selesai"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Section 4 - Syarat Khusus (Badge-based) */}
          <Collapsible>
            <CollapsibleTrigger className="collapsible-trigger w-full">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-button-hover" />
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">5. Syarat Khusus</div>
                  <div className="text-xs text-muted-foreground">Ketentuan tambahan</div>
                </div>
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent className="collapsible-content">
              {/* Guard Rule Hint */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
                <p className="text-xs text-amber-500 font-medium">
                  ⚠️ Deskripsi syarat khusus untuk AI, bukan rumus matematika. AI tidak boleh menghitung hasil.
                </p>
              </div>
              <div className="space-y-3">
                <Label>Syarat & Ketentuan Tambahan</Label>
                
                {/* Badge List */}
                {(data.special_requirements || []).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {(data.special_requirements || []).map((req, index) => (
                      <Badge 
                        key={index} 
                        variant="secondary" 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted text-foreground border border-border rounded-full"
                      >
                        <span>{req}</span>
                        <button 
                          type="button"
                          onClick={() => {
                            const updated = (data.special_requirements || []).filter((_, i) => i !== index);
                            onChange({ special_requirements: updated });
                          }}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                
                {/* Input with Plus icon inline */}
                <div className="relative">
                  <Input
                    placeholder="Tambah syarat (pisahkan dengan koma)..."
                    value={newRequirement}
                    onChange={(e) => setNewRequirement(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (!newRequirement.trim()) return;
                        const newItems = newRequirement
                          .split(',')
                          .map(item => item.trim())
                          .filter(item => item !== '');
                        const current = data.special_requirements || [];
                        const unique = newItems.filter(item => !current.includes(item));
                        if (unique.length > 0) {
                          onChange({ special_requirements: [...current, ...unique] });
                        }
                        setNewRequirement("");
                      }
                    }}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newRequirement.trim()) return;
                      const newItems = newRequirement
                        .split(',')
                        .map(item => item.trim())
                        .filter(item => item !== '');
                      const current = data.special_requirements || [];
                      const unique = newItems.filter(item => !current.includes(item));
                      if (unique.length > 0) {
                        onChange({ special_requirements: [...current, ...unique] });
                      }
                      setNewRequirement("");
                    }}
                    disabled={!newRequirement.trim()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-button-hover disabled:opacity-50 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  💡 Tekan Enter atau klik (+) untuk menambah. Pisahkan beberapa syarat dengan koma.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Section 5 - Kontak Official */}
          <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl">
            <Switch
              checked={data.contact_channel_enabled || false}
              onCheckedChange={(checked) => onChange({ contact_channel_enabled: checked })}
            />
            <div className="flex-1">
              <div className="font-medium text-sm text-button-hover">5. Tampilkan Kontak Official</div>
              <p className="text-xs text-muted-foreground">
                Tampilkan info kontak resmi di respons AI untuk promo ini
              </p>
            </div>
          </div>

          {data.contact_channel_enabled && (
            <div className="p-4 bg-muted rounded-lg space-y-4">
              <div className={`grid gap-4 ${data.contact_channel !== 'livechat' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <SelectWithAddNew
                    value={data.contact_channel || ''}
                    onValueChange={(value) => onChange({ contact_channel: value })}
                    options={[
                      { value: 'whatsapp', label: 'WhatsApp' },
                      { value: 'telegram', label: 'Telegram' },
                      { value: 'livechat', label: 'Live Chat' },
                      { value: 'email', label: 'Email' },
                    ]}
                    placeholder="Pilih channel"
                  />
                </div>
                
                {/* Only show Link/Nomor for channels that need it */}
                {data.contact_channel !== 'livechat' && (
                  <div className="space-y-2">
                    <Label>Link / Nomor</Label>
                    <Input
                      value={data.contact_link || ''}
                      onChange={(e) => onChange({ contact_link: e.target.value })}
                      placeholder={
                        data.contact_channel === 'whatsapp' ? 'Contoh: wa.me/628xxx' :
                        data.contact_channel === 'telegram' ? 'Contoh: t.me/username' :
                        data.contact_channel === 'email' ? 'Contoh: support@website.com' :
                        'Masukkan link/nomor'
                      }
                    />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {data.contact_channel === 'livechat' 
                  ? '💬 Live Chat sudah tersedia di website — tidak perlu link tambahan.'
                  : '💡 Kontak ini akan ditampilkan di akhir respons AI saat menjelaskan promo.'
                }
              </p>
            </div>
          )}
        </>
      )}

      {/* Blok C - Mode Tier */}
      {data.reward_mode === 'tier' && (
        <>
          {/* C0 - Unit Poin Reward */}
          <Collapsible>
            <CollapsibleTrigger className="collapsible-trigger w-full">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-button-hover" />
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">Unit Poin Reward</div>
                  <div className="text-xs text-muted-foreground">Pilih sistem poin</div>
                </div>
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent className="collapsible-content">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Satuan Poin <span className="text-destructive">*</span></Label>
                  <SelectWithAddNew
                    value={data.promo_unit}
                    onValueChange={(value) => onChange({ promo_unit: value as any })}
                    options={promoUnitOptions}
                    onAddOption={(option) => setPromoUnitOptions([...promoUnitOptions, option])}
                    onDeleteOption={handleDeletePromoUnit}
                    placeholder="Pilih satuan poin"
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    {data.promo_unit === 'lp' && 'Loyalty Points - poin yang bisa ditukar ke hadiah'}
                    {data.promo_unit === 'exp' && 'Experience Points - poin untuk naik level'}
                    {data.promo_unit === 'hybrid' && 'Kombinasi LP dan EXP'}
                  </p>
                </div>
                {(data.promo_unit === 'exp' || data.promo_unit === 'hybrid') && (
                  <div className="space-y-2">
                    <Label>EXP Mode</Label>
                    <SelectWithAddNew
                      value={data.exp_mode}
                      onValueChange={(value) => onChange({ exp_mode: value as 'level_up' | 'exp_store' | 'both' })}
                      options={expModeOptions}
                      onAddOption={(option) => setExpModeOptions([...expModeOptions, option])}
                      onDeleteOption={handleDeleteExpMode}
                      placeholder="Pilih EXP mode"
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* C1 - Rumus Perhitungan */}
          <Collapsible>
            <CollapsibleTrigger className="collapsible-trigger w-full">
              <div className="flex items-center gap-3">
                <Star className="h-5 w-5 text-button-hover" />
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">Rumus Perhitungan LP/EXP</div>
                  <div className="text-xs text-muted-foreground">Formula konversi poin</div>
                </div>
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent className="collapsible-content">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Konfigurasi rumus LP/EXP tersedia di mode Tier.</p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* C3 - Tier Store */}
          {showC3 && (
            <Collapsible>
              <CollapsibleTrigger className="collapsible-trigger w-full">
                <div className="flex items-center gap-3">
                  <Trophy className="h-5 w-5 text-button-hover" />
                  <div className="text-left">
                    <div className="text-sm font-semibold text-foreground">Tabel Tier Reward (Store)</div>
                    <div className="text-xs text-muted-foreground">{data.tiers.length} tier terkonfigurasi</div>
                  </div>
                </div>
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent className="collapsible-content">
                <div className="space-y-4">
                  {data.tiers.map((tier) => (
                    <div key={tier.id} className="flex items-end gap-4 p-3 bg-muted rounded-lg">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Minimal Poin</Label>
                        <Input
                          type="number"
                          value={tier.minimal_point}
                          onChange={(e) => updateTier(tier.id, { minimal_point: Number(e.target.value) })}
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Reward</Label>
                        <Input
                          value={tier.reward}
                          onChange={(e) => updateTier(tier.id, { reward: e.target.value })}
                        />
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0 rounded-full bg-muted hover:bg-declined/20 group" onClick={() => removeTier(tier.id)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-declined" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" onClick={addTier} className="w-full border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover">
                    <Plus className="h-4 w-4 mr-2" /> Tambah Tier
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}

      {/* Blok D - Waktu Pembagian (only for Fixed & Tier modes) */}
      {(data.reward_mode === 'fixed' || data.reward_mode === 'tier') && (
        <Collapsible>
          <CollapsibleTrigger className="collapsible-trigger w-full">
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-button-hover" />
              <div className="text-left">
                <div className="text-sm font-semibold text-foreground">Waktu Distribusi Hadiah</div>
                <div className="text-xs text-muted-foreground">Kapan sistem mendistribusikan reward setelah klaim disetujui</div>
              </div>
            </div>
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          </CollapsibleTrigger>
          <CollapsibleContent className="collapsible-content">
            <div className="space-y-4">
              <SelectWithAddNew
                value={data.reward_distribution}
                onValueChange={(value) => onChange({ reward_distribution: value })}
                options={rewardDistributionOptions}
                onAddOption={(option) => setRewardDistributionOptions([...rewardDistributionOptions, option])}
                onDeleteOption={handleDeleteRewardDistribution}
                placeholder="Pilih waktu distribusi"
              />
              
              {/* Helper text based on selection */}
              {data.reward_distribution && (
                <p className="text-xs text-muted-foreground">
                  {REWARD_DISTRIBUTIONS.find(d => d.value === data.reward_distribution)?.helper || ''}
                </p>
              )}
              
              {/* Conditional Day & Time Selector for Hari Tertentu */}
              {data.reward_distribution === 'hari_tertentu' && (
                <div className="p-4 bg-muted rounded-lg space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Hari</Label>
                      <SelectWithAddNew
                        value={data.distribution_day}
                        onValueChange={(value) => onChange({ distribution_day: value })}
                        options={[
                          { value: 'senin', label: 'Senin' },
                          { value: 'selasa', label: 'Selasa' },
                          { value: 'rabu', label: 'Rabu' },
                          { value: 'kamis', label: 'Kamis' },
                          { value: 'jumat', label: 'Jumat' },
                          { value: 'sabtu', label: 'Sabtu' },
                          { value: 'minggu', label: 'Minggu' },
                          { value: 'setiap_hari', label: 'Setiap Hari' },
                        ]}
                        onAddOption={() => {}}
                        onDeleteOption={() => {}}
                        placeholder="Pilih hari"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Jam (WIB)</Label>
                      <SelectWithAddNew
                        value={data.distribution_time}
                        onValueChange={(value) => onChange({ distribution_time: value })}
                        options={[
                          { value: '00:00', label: '00:00' },
                          { value: '06:00', label: '06:00' },
                          { value: '09:00', label: '09:00' },
                          { value: '12:00', label: '12:00' },
                          { value: '15:00', label: '15:00' },
                          { value: '18:00', label: '18:00' },
                          { value: '21:00', label: '21:00' },
                          { value: '23:59', label: '23:59' },
                        ]}
                        onAddOption={() => {}}
                        onDeleteOption={() => {}}
                        placeholder="Pilih jam"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    💡 Contoh: Rollingan mingguan dikirim setiap Senin 00:00 WIB.
                  </p>
                </div>
              )}

              {/* Conditional Date Range Selector for Tanggal Tertentu */}
              {data.reward_distribution === 'tanggal_tertentu' && (
                <div className="p-4 bg-muted rounded-lg space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Dari Tanggal</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !data.distribution_date_from && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {data.distribution_date_from ? format(parse(data.distribution_date_from, 'yyyy-MM-dd', new Date()), 'dd MMMM yyyy') : "Pilih tanggal"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={data.distribution_date_from ? parse(data.distribution_date_from, 'yyyy-MM-dd', new Date()) : undefined}
                            onSelect={(date) => onChange({ distribution_date_from: date ? format(date, 'yyyy-MM-dd') : '' })}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label>Hingga Tanggal</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !data.distribution_date_until && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {data.distribution_date_until ? format(parse(data.distribution_date_until, 'yyyy-MM-dd', new Date()), 'dd MMMM yyyy') : "Pilih tanggal"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={data.distribution_date_until ? parse(data.distribution_date_until, 'yyyy-MM-dd', new Date()) : undefined}
                            onSelect={(date) => onChange({ distribution_date_until: date ? format(date, 'yyyy-MM-dd') : '' })}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label>Jam (WIB)</Label>
                      <SelectWithAddNew
                        value={data.distribution_time}
                        onValueChange={(value) => onChange({ distribution_time: value })}
                        options={[
                          { value: '00:00', label: '00:00' },
                          { value: '06:00', label: '06:00' },
                          { value: '09:00', label: '09:00' },
                          { value: '12:00', label: '12:00' },
                          { value: '15:00', label: '15:00' },
                          { value: '18:00', label: '18:00' },
                          { value: '21:00', label: '21:00' },
                          { value: '23:59', label: '23:59' },
                        ]}
                        onAddOption={() => {}}
                        onDeleteOption={() => {}}
                        placeholder="Pilih jam"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    💡 Jika hanya 1 hari saja, isi kedua tanggal dengan tanggal yang sama.
                  </p>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Blok E - Syarat Khusus (only for Fixed & Tier modes) */}
      {(data.reward_mode === 'fixed' || data.reward_mode === 'tier') && (
        <Collapsible>
          <CollapsibleTrigger className="collapsible-trigger w-full">
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-button-hover" />
              <div className="text-left">
                <div className="text-sm font-semibold text-foreground">Syarat Khusus</div>
                <div className="text-xs text-muted-foreground">Terms & Conditions tambahan</div>
              </div>
            </div>
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          </CollapsibleTrigger>
          <CollapsibleContent className="collapsible-content">
            <div className="space-y-3">
              {/* Badge List */}
              {data.special_requirements && data.special_requirements.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {data.special_requirements.map((req, index) => (
                    <Badge 
                      key={index} 
                      variant="secondary" 
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted text-foreground border border-border rounded-full"
                    >
                      <span>{req}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRequirement(req)}
                        className="hover:text-destructive transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              
              {/* Input dengan Plus icon inline */}
              <div className="relative">
                <Input
                  placeholder="Tambah syarat (pisahkan dengan koma)..."
                  value={newRequirement}
                  onChange={(e) => setNewRequirement(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddRequirement())}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={handleAddRequirement}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-button-hover transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Pisahkan beberapa syarat dengan koma, lalu tekan Enter atau klik ikon +
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

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
