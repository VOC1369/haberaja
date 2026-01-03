import React, { useState, useEffect } from "react";
import { format, parse } from "date-fns";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FormattedNumberInput } from "@/components/ui/formatted-number-input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, X, ChevronDown, Settings, Zap, Trophy, Star, Target, Trash2, CalendarIcon, Calculator, AlertTriangle, Clock, Save, Phone, Gamepad2, Layers, Gift, CheckCircle2, XCircle, Ticket, Download } from "lucide-react";
import { GameWhitelistBlacklist } from "./GameWhitelistBlacklist";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn, formatNumberWithSeparator } from "@/lib/utils";
import { toast } from "sonner";
import {
  PromoFormData,
  PromoSubCategory,
  RedeemItem,
  ReferralCommissionTier,
  TierReward,
  FastExpMission,
  LevelUpReward,
  TicketReward,
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
  TIER_ARCHETYPE_OPTIONS,
  TierArchetype,
} from "./types";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { generateUUID } from "@/lib/supabase-client";
import { SelectWithAddNew, SelectOption } from "./SelectWithAddNew";
import { SubCategoryCard, createInitialSubCategory } from "./SubCategoryCard";

interface Step3Props {
  data: PromoFormData;
  onChange: (data: Partial<PromoFormData>) => void;
  isEditingFromReview?: boolean;
  onSaveAndReturn?: () => void;
  stepNumber?: number;
  stepTitle?: string;
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
  { value: 'saldo', label: 'Saldo' },
  { value: 'credit_game', label: 'Credit Game' },
  { value: 'cashback', label: 'Cashback' },
  { value: 'freechip', label: 'Freechip' },
  { value: 'lp', label: 'Loyalty Points (LP)' },
  { value: 'exp', label: 'Experience Points (EXP)' },
  { value: 'voucher', label: 'Voucher / Ticket' },
  { value: 'lucky_spin', label: 'Lucky Spin' },
  { value: 'hadiah_fisik', label: 'Hadiah Fisik' },
  { value: 'uang_tunai', label: 'Uang Tunai' },
];

// Jenis Voucher ENUM (standarisasi)
const DEFAULT_VOUCHER_KINDS: SelectOption[] = [
  { value: 'deposit', label: 'Deposit' },
  { value: 'lucky_spin', label: 'Lucky Spin' },
  { value: 'event_entry', label: 'Event Entry' },
  { value: 'discount', label: 'Discount' },
  { value: 'free_play', label: 'Free Play' },
  { value: 'other', label: 'Other' },
];

// Reward types yang memerlukan unit-based claim (bukan nominal uang) - label "Max Claim Reward"
const UNIT_BASED_REWARDS = ['voucher', 'ticket', 'lucky_spin'];

// Reward types yang TIDAK memerlukan Max Bonus (freeze field) - DEPRECATED, replaced by UNIT_BASED_REWARDS
const NON_MONETARY_REWARDS = ['voucher', 'lucky_spin', 'hadiah_fisik'];

// Reward types yang memerlukan FULL semantic locking (voucher/ticket)
const VOUCHER_TICKET_REWARDS = ['voucher', 'ticket'];
const isVoucherTicket = (rewardType: string | undefined) => 
  VOUCHER_TICKET_REWARDS.includes(rewardType || '');

// Helper untuk cek apakah reward type memerlukan eligibility-based logic (bukan calculation-based)
const isEligibilityBasedReward = (rewardType: string | undefined) =>
  UNIT_BASED_REWARDS.includes(rewardType || '');

// Opsi eligibility untuk Voucher/Ticket/Lucky Spin (syarat mendapatkan ticket)
const TICKET_ELIGIBILITY_OPTIONS: SelectOption[] = [
  { value: 'deposit', label: 'Deposit' },
  { value: 'turnover', label: 'Turnover (TO)' },
  { value: 'loss', label: 'Loss (WL)' },
  { value: 'manual', label: 'Manual / Event' },
];

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

const DEFAULT_LP_VALUE_TYPES: SelectOption[] = [
  { value: 'credit_game', label: 'Credit Game' },
  { value: 'freechip', label: 'Freechip' },
];

// Referral Basis Perhitungan options
const REFERRAL_BASIS_OPTIONS: SelectOption[] = [
  { value: 'turnover', label: 'Turnover (TO)' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'win', label: 'Win' },
  { value: 'loss', label: 'Loss' },
  { value: 'bet_amount', label: 'Bet Amount' },
  { value: 'lp', label: 'Loyalty Point' },
  { value: 'exp', label: 'Experience Point' },
];

export function Step3Reward({ data, onChange, isEditingFromReview, onSaveAndReturn, stepNumber = 3, stepTitle = "Konfigurasi Reward" }: Step3Props) {
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
  
  // Sync calcValueInput when data.calculation_value changes (e.g., mode switch reset)
  useEffect(() => {
    if (data.calculation_value === undefined || data.calculation_value === null) {
      setCalcValueInput('');
    } else {
      setCalcValueInput(String(data.calculation_value).replace('.', ','));
    }
  }, [data.calculation_value]);
  
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
  
  // Referral Basis options state
  const [referralBasisOptions, setReferralBasisOptions] = useState<SelectOption[]>([...REFERRAL_BASIS_OPTIONS]);

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

  // Helper untuk menampilkan nama point unit yang benar berdasarkan pilihan user
  const getPointUnitLabel = (pointUnit: string | undefined) => {
    switch (pointUnit) {
      case 'exp': return 'Experience Point';
      case 'hybrid': return 'Point';
      case 'lp':
      default: return 'Loyalty Point';
    }
  };

  // Helper untuk Referral Basis Label
  const getReferralBasisLabel = (basis: string) => {
    const found = referralBasisOptions.find(o => o.value === basis);
    return found?.label || basis;
  };

  const getPointUnitShort = (pointUnit: string | undefined) => {
    switch (pointUnit) {
      case 'exp': return 'EXP';
      case 'hybrid': return 'Point';
      case 'lp':
      default: return 'LP';
    }
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
      type: '',
      jenis_hadiah: 'credit_game',
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
          <h3 className="text-lg font-semibold text-button-hover">Step {stepNumber} — {stepTitle}</h3>
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
              onClick={() => {
                const newMode = mode.value as 'fixed' | 'tier' | 'formula';
                if (newMode !== data.reward_mode) {
                  // Check if current mode has data that would be lost
                  const hasFixedData = data.reward_mode === 'fixed' && (
                    data.fixed_calculation_value || 
                    data.fixed_reward_type ||
                    data.fixed_max_claim
                  );
                  const hasDinamisData = data.reward_mode === 'formula' && (
                    data.calculation_value || 
                    data.dinamis_reward_type ||
                    data.dinamis_max_claim ||
                    (data.subcategories && data.subcategories.length > 0)
                  );
                  const hasTierData = data.reward_mode === 'tier' && (
                    data.tiers && data.tiers.length > 0
                  );
                  
                  if (hasFixedData || hasDinamisData || hasTierData) {
                    toast.warning("Mode reward berubah - konfigurasi sebelumnya di-reset", {
                      description: `Data mode ${data.reward_mode === 'fixed' ? 'Fixed' : data.reward_mode === 'formula' ? 'Dinamis' : 'Tier'} akan direset.`
                    });
                  }
                  
                  // Reset ALL calculation-related fields when switching modes
                  // This ensures NO data bleeding between modes
                  onChange({ 
                    reward_mode: newMode,
                    has_subcategories: false,
                    subcategories: [],
                    
                    // ============ RESET DINAMIS (formula) FIELDS ============
                    calculation_base: '',
                    calculation_method: '',
                    calculation_value: undefined,
                    dinamis_reward_type: '',
                    dinamis_max_claim: undefined,
                    dinamis_max_claim_unlimited: false,
                    admin_fee_enabled: false,
                    admin_fee_percentage: 0,
                    global_payout_direction: 'after',
                    min_calculation_enabled: false,
                    min_calculation: 0,
                    physical_reward_name: '',
                    physical_reward_quantity: 1,
                    cash_reward_amount: undefined,
                    
                    // ============ RESET FIXED FIELDS ============
                    fixed_calculation_base: '',
                    fixed_calculation_method: '',
                    fixed_calculation_value: undefined,
                    fixed_reward_type: '',
                    fixed_max_claim: undefined,
                    fixed_max_claim_unlimited: false,
                    fixed_payout_direction: 'after',
                    fixed_admin_fee_enabled: false,
                    fixed_admin_fee_percentage: 0,
                    fixed_min_depo_enabled: false,
                    fixed_min_depo: undefined,
                    fixed_min_calculation_enabled: false,
                    fixed_min_calculation: undefined,
                    fixed_turnover_rule_enabled: false,
                    fixed_turnover_rule: '',
                    
                    // ============ RESET TIER FIELDS ============
                    // Note: tier-specific fields reset to valid defaults
                    tier_archetype: undefined,
                    promo_unit: 'lp',
                    exp_mode: 'level_up',
                    lp_earn_basis: 'turnover',
                    lp_earn_amount: undefined,
                    lp_earn_point_amount: undefined,
                  });
                }
              }}
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
                  value={data.fixed_reward_type || ''}
                  onValueChange={(value) => {
                    // Set inert values untuk field yang tidak relevan
                    const inertUpdates: Partial<PromoFormData> = {
                      fixed_reward_type: value,
                      // Reset semua field reward ke inert
                      fixed_physical_reward_name: '',
                      fixed_physical_reward_quantity: undefined,
                      fixed_cash_reward_amount: undefined,
                      fixed_reward_quantity: null,
                      fixed_voucher_kind: '',
                      fixed_voucher_kind_custom: '',
                      fixed_voucher_valid_from: '',
                      fixed_voucher_valid_until: '',
                      fixed_lucky_spin_enabled: false,
                      fixed_lucky_spin_id: '',
                      fixed_lucky_spin_max_per_day: null,
                    };
                    
                    // Set default untuk field yang relevan
                    if (value === 'hadiah_fisik') {
                      inertUpdates.fixed_reward_quantity = 1;
                    } else if (value === 'voucher' || value === 'ticket') {
                      inertUpdates.fixed_reward_quantity = 1;
                      // Eligibility-based: HANYA disable calculation fields, BUKAN eligibility fields
                      // fixed_calculation_base & fixed_min_calculation TETAP AKTIF untuk syarat eligibility
                      inertUpdates.fixed_payout_direction = undefined;
                      inertUpdates.fixed_admin_fee_enabled = false;
                      inertUpdates.fixed_admin_fee_percentage = undefined;
                      inertUpdates.fixed_calculation_method = '';
                      inertUpdates.fixed_calculation_value = undefined;
                    } else if (value === 'lucky_spin') {
                      inertUpdates.fixed_lucky_spin_enabled = true;
                      inertUpdates.fixed_reward_quantity = 1;
                      // Eligibility-based: HANYA disable calculation fields
                      inertUpdates.fixed_payout_direction = undefined;
                      inertUpdates.fixed_admin_fee_enabled = false;
                      inertUpdates.fixed_admin_fee_percentage = undefined;
                      inertUpdates.fixed_calculation_method = '';
                      inertUpdates.fixed_calculation_value = undefined;
                    }
                    
                    onChange(inertUpdates);
                  }}
                  options={dinamisRewardTypeOptions}
                  onAddOption={(option) => setDinamisRewardTypeOptions([...dinamisRewardTypeOptions, option])}
                  onDeleteOption={handleDeleteDinamisRewardType}
                  placeholder="Pilih jenis"
                />
                {/* Dynamic Field: Hadiah Fisik */}
                {data.fixed_reward_type === 'hadiah_fisik' && (
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    <div className="col-span-2 space-y-2">
                      <Label>Nama Hadiah Fisik</Label>
                      <Input
                        value={data.fixed_physical_reward_name || ''}
                        onChange={(e) => onChange({ fixed_physical_reward_name: e.target.value })}
                        placeholder="Contoh: MITSUBISHI PAJERO SPORT DAKAR 2025"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Jumlah Reward</Label>
                      <Input
                        type="number"
                        min={1}
                        value={data.fixed_reward_quantity ?? 1}
                        onChange={(e) => onChange({ fixed_reward_quantity: parseInt(e.target.value) || 1 })}
                        placeholder="1"
                      />
                    </div>
                  </div>
                )}
                {/* Dynamic Field: Lucky Spin */}
                {data.fixed_reward_type === 'lucky_spin' && (
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    <div className="space-y-2">
                      <Label>ID Lucky Spin</Label>
                      <Input
                        value={data.fixed_lucky_spin_id || ''}
                        onChange={(e) => onChange({ 
                          fixed_lucky_spin_id: e.target.value,
                          fixed_lucky_spin_enabled: true
                        })}
                        placeholder="Contoh: SPIN-2024-001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Jumlah Reward</Label>
                      <Input
                        type="number"
                        min={1}
                        value={data.fixed_reward_quantity ?? 1}
                        onChange={(e) => onChange({ fixed_reward_quantity: parseInt(e.target.value) || 1 })}
                        placeholder="Jumlah spin"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Spin/Hari (opsional)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={data.fixed_lucky_spin_max_per_day ?? ''}
                        onChange={(e) => onChange({ fixed_lucky_spin_max_per_day: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="Contoh: 3"
                      />
                    </div>
                  </div>
                )}
                {/* Dynamic Field: Uang Tunai */}
                {data.fixed_reward_type === 'uang_tunai' && (
                  <div className="space-y-2 mt-2">
                    <Label>Nominal Uang Tunai</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rp</span>
                      <Input
                        className="pl-10"
                        value={formatRupiah(data.fixed_cash_reward_amount)}
                        onChange={(e) => onChange({ fixed_cash_reward_amount: parseRupiah(e.target.value) })}
                        placeholder="50.000.000"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              {/* Max Bonus / Max Claim Reward - Dynamic Label based on reward type */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    {UNIT_BASED_REWARDS.includes(data.fixed_reward_type || '') ? 'Max Claim Reward' : 'Max Bonus'}
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Unlimited</span>
                    <Switch
                      checked={data.fixed_max_claim_unlimited ?? false}
                      onCheckedChange={(checked) => onChange({ 
                        fixed_max_claim_unlimited: checked,
                        fixed_max_claim: checked ? undefined : data.fixed_max_claim
                      })}
                    />
                  </div>
                </div>
                <Input
                  type="text"
                  value={data.fixed_max_claim_unlimited ? '' : (data.fixed_max_claim ? data.fixed_max_claim.toLocaleString('id-ID') : '')}
                  onChange={(e) => onChange({ fixed_max_claim: Number(e.target.value.replace(/\D/g, '')) })}
                  placeholder={data.fixed_max_claim_unlimited ? "Unlimited / Tanpa Batas" : (UNIT_BASED_REWARDS.includes(data.fixed_reward_type || '') ? "Contoh: 10 unit/hari" : "Contoh: 100.000")}
                  disabled={data.fixed_max_claim_unlimited}
                  className={cn(data.fixed_max_claim_unlimited && "opacity-50")}
                />
              </div>
            </div>
            
            {/* Row 1.1: Voucher / Ticket Fields (hanya muncul jika fixed_reward_type === 'voucher') */}
            {data.fixed_reward_type === 'voucher' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Left column - dibawah Jenis Hadiah */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Jenis Voucher</Label>
                    <Select
                      value={data.fixed_voucher_kind || ''}
                      onValueChange={(value) => onChange({ 
                        fixed_voucher_kind: value,
                        fixed_voucher_kind_custom: value === 'other' ? (data.fixed_voucher_kind_custom || '') : ''
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih jenis voucher" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEFAULT_VOUCHER_KINDS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {data.fixed_voucher_kind === 'other' && (
                      <Input
                        value={data.fixed_voucher_kind_custom || ''}
                        onChange={(e) => onChange({ fixed_voucher_kind_custom: e.target.value })}
                        placeholder="Tulis jenis voucher custom..."
                        className="mt-2"
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Jumlah Reward</Label>
                    <Input
                      type="number"
                      min={1}
                      value={data.fixed_reward_quantity ?? 1}
                      onChange={(e) => onChange({ fixed_reward_quantity: parseInt(e.target.value) || 1 })}
                      placeholder="1"
                    />
                  </div>
                </div>
                {/* Right column - dibawah Max Bonus */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Masa Berlaku Dimulai</Label>
                    <Input
                      type="date"
                      value={data.fixed_voucher_valid_from || ''}
                      onChange={(e) => onChange({ fixed_voucher_valid_from: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label>Masa Berakhir</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Unlimited</span>
                        <Switch
                          checked={data.fixed_voucher_valid_unlimited || false}
                          onCheckedChange={(checked) => onChange({ 
                            fixed_voucher_valid_unlimited: checked,
                            fixed_voucher_valid_until: checked ? '' : data.fixed_voucher_valid_until
                          })}
                        />
                      </div>
                    </div>
                    <Input
                      type="date"
                      value={data.fixed_voucher_valid_unlimited ? '' : (data.fixed_voucher_valid_until || '')}
                      onChange={(e) => onChange({ fixed_voucher_valid_until: e.target.value })}
                      disabled={data.fixed_voucher_valid_unlimited}
                      placeholder={data.fixed_voucher_valid_unlimited ? "Tidak ada kadaluwarsa" : ""}
                      className={cn(data.fixed_voucher_valid_unlimited && "opacity-50")}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {/* Row 2: 2 kolom utama - Kolom 1 (Payout + Admin Fee), Kolom 2 (Minimum Depo) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              
              {/* KOLOM 1: Dibagi 2 sub-kolom (Payout Direction + Admin Fee) */}
              <div className="grid grid-cols-2 gap-4">
                {/* 1a: Payout Direction */}
                <div className="space-y-2">
                  <Label className={isVoucherTicket(data.fixed_reward_type) ? 'text-muted-foreground' : ''}>Payout Direction</Label>
                  <RadioGroup
                    value={data.fixed_payout_direction || 'after'}
                    onValueChange={(value: 'before' | 'after') => onChange({ fixed_payout_direction: value })}
                    className={cn("flex flex-row items-center gap-4 pt-1", isVoucherTicket(data.fixed_reward_type) && "opacity-50 pointer-events-none")}
                    disabled={isVoucherTicket(data.fixed_reward_type)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="before" id="fixed-payout-before-global" disabled={isVoucherTicket(data.fixed_reward_type)} />
                      <Label htmlFor="fixed-payout-before-global" className="cursor-pointer font-normal text-sm">Didepan</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="after" id="fixed-payout-after-global" disabled={isVoucherTicket(data.fixed_reward_type)} />
                      <Label htmlFor="fixed-payout-after-global" className="cursor-pointer font-normal text-sm">Dibelakang</Label>
                    </div>
                  </RadioGroup>
                  {isVoucherTicket(data.fixed_reward_type) && (
                    <p className="text-xs text-muted-foreground">Voucher / Ticket tidak menggunakan payout direction</p>
                  )}
                </div>
                
                {/* 1b: Admin Fee */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className={isVoucherTicket(data.fixed_reward_type) ? 'text-muted-foreground' : ''}>Admin Fee</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Aktifkan</span>
                      <Switch
                        checked={data.fixed_admin_fee_enabled ?? false}
                        onCheckedChange={(checked) => onChange({ 
                          fixed_admin_fee_enabled: checked,
                          fixed_admin_fee_percentage: checked ? (data.fixed_admin_fee_percentage ?? 0) : undefined
                        })}
                        disabled={isVoucherTicket(data.fixed_reward_type)}
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={data.fixed_admin_fee_enabled ? (data.fixed_admin_fee_percentage ?? 0) : ''}
                      onChange={(e) => onChange({ fixed_admin_fee_percentage: Number(e.target.value) || 0 })}
                      placeholder={isVoucherTicket(data.fixed_reward_type) ? "Tidak berlaku" : (data.fixed_admin_fee_enabled ? "0" : "Tidak aktif")}
                      disabled={!data.fixed_admin_fee_enabled || isVoucherTicket(data.fixed_reward_type)}
                      className={cn("pr-8", (!data.fixed_admin_fee_enabled || isVoucherTicket(data.fixed_reward_type)) && "opacity-50")}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  </div>
                  {isVoucherTicket(data.fixed_reward_type) && (
                    <p className="text-xs text-muted-foreground">Admin fee hanya berlaku untuk reward berbasis uang</p>
                  )}
                </div>
              </div>
              
              {/* KOLOM 2: Minimum Depo */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Minimum Depo</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Aktifkan</span>
                    <Switch
                      checked={data.fixed_min_depo_enabled ?? false}
                      onCheckedChange={(checked) => onChange({ 
                        fixed_min_depo_enabled: checked,
                        fixed_min_depo: checked ? (data.fixed_min_depo ?? 0) : undefined
                      })}
                    />
                  </div>
                </div>
                <FormattedNumberInput
                  value={data.fixed_min_depo_enabled ? (data.fixed_min_depo ?? 0) : 0}
                  onChange={(value) => onChange({ fixed_min_depo: value })}
                  placeholder={data.fixed_min_depo_enabled ? "Contoh: 50.000" : "Tidak aktif"}
                  className={!data.fixed_min_depo_enabled ? "opacity-50 pointer-events-none" : ""}
                />
              </div>
            </div>
            
            {/* Row 3: Dasar Perhitungan & Jenis Perhitungan */}
            {(() => {
              const isEligibilityMode = isEligibilityBasedReward(data.fixed_reward_type);
              const isManualEligibility = isEligibilityMode && data.fixed_calculation_base === 'manual';
              
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Dasar Perhitungan / Syarat Mendapatkan Ticket */}
                  <div className="space-y-2">
                    <Label>{isEligibilityMode ? 'Syarat Mendapatkan Ticket' : 'Dasar Perhitungan'}</Label>
                    <SelectWithAddNew
                      value={data.fixed_calculation_base || ''}
                      onValueChange={(value) => {
                        const updates: Partial<PromoFormData> = { fixed_calculation_base: value };
                        
                        // Set trigger_event untuk mapping yang benar
                        if (value === 'turnover') updates.trigger_event = 'turnover';
                        else if (value === 'loss') updates.trigger_event = 'loss';
                        else if (value === 'deposit') updates.trigger_event = 'deposit';
                        else if (value === 'manual') updates.trigger_event = 'event';
                        
                        // Jika Manual/Event, disable min_calculation
                        if (isEligibilityMode && value === 'manual') {
                          updates.fixed_min_calculation_enabled = false;
                          updates.fixed_min_calculation = undefined;
                        }
                        
                        onChange(updates);
                      }}
                      options={isEligibilityMode ? TICKET_ELIGIBILITY_OPTIONS : calcBaseOptions}
                      onAddOption={isEligibilityMode ? undefined : (option) => setCalcBaseOptions([...calcBaseOptions, option])}
                      onDeleteOption={isEligibilityMode ? undefined : handleDeleteCalcBase}
                      placeholder={isEligibilityMode ? "Pilih syarat (Deposit, TO, Loss, Manual)" : "Pilih dasar (TO, Deposit, dll)"}
                    />
                  </div>
                  
                  {/* Jenis Perhitungan - DISABLED untuk eligibility-based rewards */}
                  <div className="space-y-2">
                    <Label className={isEligibilityMode ? 'text-muted-foreground' : ''}>Jenis Perhitungan</Label>
                    <SelectWithAddNew
                      value={data.fixed_calculation_method || ''}
                      onValueChange={(value) => onChange({ fixed_calculation_method: value })}
                      options={calcMethodOptions}
                      onAddOption={(option) => setCalcMethodOptions([...calcMethodOptions, option])}
                      onDeleteOption={handleDeleteCalcMethod}
                      placeholder={isEligibilityMode ? "Tidak berlaku untuk ticket" : "Pilih jenis (%, Fixed)"}
                      disabled={isEligibilityMode}
                    />
                    {isEligibilityMode && (
                      <p className="text-xs text-muted-foreground">Ticket tidak menggunakan kalkulasi %/fixed</p>
                    )}
                  </div>
                  
                  {/* Nilai Bonus - DISABLED untuk eligibility-based rewards */}
                  <div className="space-y-2">
                    <Label className={isEligibilityMode ? 'text-muted-foreground' : ''}>Nilai Bonus</Label>
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={data.fixed_calculation_value !== undefined && data.fixed_calculation_value !== null 
                          ? String(data.fixed_calculation_value).replace('.', ',') 
                          : ''}
                        onChange={(e) => {
                          const rawValue = e.target.value.replace(/[^0-9.,]/g, '');
                          const normalizedValue = rawValue.replace(',', '.');
                          const numValue = parseFloat(normalizedValue);
                          if (!isNaN(numValue)) {
                            onChange({ fixed_calculation_value: numValue });
                          } else if (rawValue === '' || rawValue === '0' || rawValue === '0,' || rawValue === '0.') {
                            onChange({ fixed_calculation_value: 0 });
                          }
                        }}
                        placeholder={isEligibilityMode ? "Tidak berlaku untuk ticket" : "Contoh: 0,5"}
                        className={cn("pr-10", isEligibilityMode && "opacity-50")}
                        disabled={isEligibilityMode}
                      />
                      {data.fixed_calculation_method === 'percentage' && !isEligibilityMode && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Minimal Perhitungan / Ambang Syarat - AKTIF untuk eligibility, disabled jika Manual */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className={isManualEligibility ? 'text-muted-foreground' : ''}>
                        {isEligibilityMode 
                          ? 'Ambang Syarat' 
                          : `Minimal Perhitungan ${calcBaseOptions.find(c => c.value === data.fixed_calculation_base)?.label || ''}`}
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Aktifkan</span>
                        <Switch
                          checked={data.fixed_min_calculation_enabled ?? false}
                          onCheckedChange={(checked) => onChange({ 
                            fixed_min_calculation_enabled: checked,
                            fixed_min_calculation: checked ? data.fixed_min_calculation : undefined
                          })}
                          disabled={isManualEligibility}
                        />
                      </div>
                    </div>
                    <Input
                      type="text"
                      value={data.fixed_min_calculation_enabled && data.fixed_min_calculation ? data.fixed_min_calculation.toLocaleString('id-ID') : ''}
                      onChange={(e) => onChange({ fixed_min_calculation: Number(e.target.value.replace(/\D/g, '')) })}
                      placeholder={isManualEligibility 
                        ? "Manual / Event tidak memerlukan ambang" 
                        : (data.fixed_min_calculation_enabled ? "Contoh: 1.000.000" : "Tidak aktif")}
                      disabled={!data.fixed_min_calculation_enabled || isManualEligibility}
                      className={(!data.fixed_min_calculation_enabled || isManualEligibility) ? "opacity-50" : ""}
                    />
                    {isManualEligibility && (
                      <p className="text-xs text-muted-foreground">Syarat manual tidak memerlukan nilai ambang</p>
                    )}
                  </div>
                </div>
              );
            })()}
            
            {/* Ilustrasi Perhitungan - Collapsible */}
            {data.fixed_calculation_method === 'percentage' && (data.fixed_calculation_value ?? 0) > 0 && (
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
                        <div className="text-xs font-medium text-muted-foreground">{data.fixed_calculation_base === 'turnover' ? 'Turnover' : data.fixed_calculation_base === 'deposit' ? 'Deposit' : 'Nilai'}</div>
                        <div className="text-xs font-medium text-muted-foreground">Kalkulasi</div>
                        <div className="text-xs font-medium text-muted-foreground">Perkiraan Bonus</div>
                      </div>
                      {(() => {
                        const percentage = data.fixed_calculation_value ?? 0;
                        const minBase = data.fixed_min_calculation || 1000000;
                        const maxClaim = data.fixed_max_claim_unlimited ? Infinity : (data.fixed_max_claim || Infinity);
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

            {/* Syarat Main Sebelum WD */}
            <div className="pt-4">
              <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl mb-2">
                <Switch
                  checked={data.fixed_turnover_rule_enabled === true}
                  onCheckedChange={(checked) => onChange({ fixed_turnover_rule_enabled: checked })}
                />
                <div>
                  <div className="font-medium text-sm text-button-hover">Syarat Main Sebelum WD</div>
                  <p className="text-xs text-muted-foreground">
                    Aktifkan jika promo memiliki syarat kelipatan main (turnover) sebelum withdrawal
                  </p>
                </div>
              </div>
              
              {data.fixed_turnover_rule_enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Kelipatan Main Bonus (TO)</Label>
                    <SelectWithAddNew
                      value={data.fixed_turnover_rule || ''}
                      onValueChange={(value) => onChange({ fixed_turnover_rule: value })}
                      options={turnoverRuleOptions}
                      onAddOption={(option) => setTurnoverRuleOptions([...turnoverRuleOptions, option])}
                      onDeleteOption={handleDeleteTurnoverRule}
                      placeholder="Pilih kelipatan main"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nilai Custom</Label>
                    <Input
                      value={data.fixed_turnover_rule_custom || ''}
                      onChange={(e) => onChange({ fixed_turnover_rule_custom: e.target.value })}
                      placeholder="Contoh: 3x, 10x, 12x"
                      disabled={data.fixed_turnover_rule !== 'custom'}
                      className={data.fixed_turnover_rule !== 'custom' ? 'opacity-50' : ''}
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
              <GameWhitelistBlacklist
                gameTypes={data.game_types || []}
                gameProviders={data.game_providers || []}
                gameNames={data.game_names || []}
                gameTypesBlacklist={data.game_types_blacklist || []}
                gameProvidersBlacklist={data.game_providers_blacklist || []}
                gameNamesBlacklist={data.game_names_blacklist || []}
                gameBlacklistEnabled={data.game_blacklist_enabled ?? false}
                gameExclusionRules={data.game_exclusion_rules || []}
                gameTypeOptions={gameTypeOptions}
                gameProviderOptions={gameProviderOptions}
                gameNameOptions={gameNameOptions}
                gameTypeBlacklistOptions={gameTypeBlacklistOptions}
                gameProviderBlacklistOptions={gameProviderBlacklistOptions}
                gameNameBlacklistOptions={gameNameBlacklistOptions}
                onGameTypesChange={(types) => onChange({ game_types: types })}
                onGameProvidersChange={(providers) => onChange({ game_providers: providers })}
                onGameNamesChange={(names) => onChange({ game_names: names })}
                onGameTypesBlacklistChange={(types) => onChange({ game_types_blacklist: types })}
                onGameProvidersBlacklistChange={(providers) => onChange({ game_providers_blacklist: providers })}
                onGameNamesBlacklistChange={(names) => onChange({ game_names_blacklist: names })}
                onBlacklistEnabledChange={(enabled) => onChange({ game_blacklist_enabled: enabled })}
                onExclusionRulesChange={(rules) => onChange({ game_exclusion_rules: rules })}
                onAddGameTypeOption={(option) => setGameTypeOptions([...gameTypeOptions, option])}
                onDeleteGameTypeOption={handleDeleteGameType}
                onAddGameProviderOption={(option) => setGameProviderOptions([...gameProviderOptions, option])}
                onDeleteGameProviderOption={handleDeleteGameProvider}
                onAddGameNameOption={(option) => setGameNameOptions([...gameNameOptions, option])}
                onDeleteGameNameOption={handleDeleteGameName}
                onAddGameTypeBlacklistOption={(option) => setGameTypeBlacklistOptions([...gameTypeBlacklistOptions, option])}
                onDeleteGameTypeBlacklistOption={handleDeleteGameTypeBlacklist}
                onAddGameProviderBlacklistOption={(option) => setGameProviderBlacklistOptions([...gameProviderBlacklistOptions, option])}
                onDeleteGameProviderBlacklistOption={handleDeleteGameProviderBlacklist}
                onAddGameNameBlacklistOption={(option) => setGameNameBlacklistOptions([...gameNameBlacklistOptions, option])}
                onDeleteGameNameBlacklistOption={handleDeleteGameNameBlacklist}
              />
            </CollapsibleContent>
          </Collapsible>

          {/* Section 3 - Hadiah dan Waktu */}
          <Collapsible>
            <CollapsibleTrigger className="collapsible-trigger w-full group">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-button-hover" />
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">3. Hadiah dan Waktu</div>
                  <div className="text-xs text-muted-foreground">Periode klaim dan distribusi reward</div>
                </div>
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="collapsible-content">
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
              
              {/* Helper text based on selection */}
              {data.reward_distribution && (
                <p className="text-xs text-muted-foreground">
                  {REWARD_DISTRIBUTIONS.find(d => d.value === data.reward_distribution)?.helper || ''}
                </p>
              )}
              
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
            <CollapsibleTrigger className="collapsible-trigger w-full group">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-button-hover" />
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">4. Syarat Khusus</div>
                  <div className="text-xs text-muted-foreground">Ketentuan tambahan untuk promo</div>
                </div>
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="collapsible-content">
              <div className="space-y-4">
                {/* Contact Channel with Toggle */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl">
                    <Switch
                      checked={data.contact_channel_enabled ?? false}
                      onCheckedChange={(checked) => onChange({ contact_channel_enabled: checked })}
                    />
                    <div>
                      <div className="font-medium text-sm text-button-hover flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Contact Channel
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Aktifkan jika promo memerlukan kontak khusus untuk klaim
                      </p>
                    </div>
                  </div>

                  {data.contact_channel_enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <div className="space-y-2">
                        <Label>Link/Nomor</Label>
                        <Input
                          value={data.contact_link || ''}
                          onChange={(e) => onChange({ contact_link: e.target.value })}
                          placeholder="Contoh: +628123456789"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Syarat Khusus (Badges) */}
                <div className="space-y-3">
                  <Label>Syarat Khusus Lainnya</Label>
                  <div className="flex flex-wrap gap-2">
                    {(data.special_requirements || []).map((req, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-sm text-foreground">
                        {req}
                        <button
                          type="button"
                          onClick={() => handleRemoveRequirement(req)}
                          className="hover:text-destructive transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newRequirement}
                      onChange={(e) => setNewRequirement(e.target.value)}
                      placeholder="Contoh: Harus via mobile, Wajib verifikasi KTP"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddRequirement();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleAddRequirement}
                      className="bg-muted text-muted-foreground hover:bg-button-hover hover:text-button-hover-foreground"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Tambah
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pisahkan dengan koma untuk menambah banyak sekaligus. Enter untuk submit.
                  </p>
                </div>

                {/* Custom Terms */}
                <div className="space-y-2">
                  <Label>Catatan Tambahan</Label>
                  <Textarea
                    value={data.custom_terms || ''}
                    onChange={(e) => onChange({ custom_terms: e.target.value })}
                    placeholder="Ketentuan khusus yang tidak tercakup di form..."
                    rows={3}
                  />
                </div>
              </div>
          </CollapsibleContent>
          </Collapsible>

          {/* Section 5 - Manual Claim & Contact Official */}
          <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl">
            <Switch
              checked={data.contact_channel_enabled || false}
              onCheckedChange={(checked) => onChange({ 
                contact_channel_enabled: checked
              })}
            />
            <div className="flex-1">
              <div className="font-medium text-sm text-button-hover flex items-center gap-2">
                <Phone className="h-4 w-4" />
                5. Manual Claim & Contact Official
              </div>
              <p className="text-xs text-muted-foreground">
                Info kontak untuk klaim bonus via CS
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
                
                {data.contact_channel !== 'livechat' && (
                  <div className="space-y-2">
                    <Label>Link / Nomor</Label>
                    <Input
                      value={data.contact_link || ''}
                      onChange={(e) => onChange({ contact_link: e.target.value })}
                      placeholder={
                        data.contact_channel === 'whatsapp' ? 'https://wa.me/628xxx' :
                        data.contact_channel === 'telegram' ? 'https://t.me/xxx' :
                        data.contact_channel === 'email' ? 'support@example.com' :
                        'Masukkan link atau nomor'
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

          {/* Section 6 - Penukaran Hadiah / Lucky Spin (Opsional) */}
          <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl">
            <Switch
              checked={data.fixed_ticket_exchange_enabled || false}
              onCheckedChange={(checked) => onChange({ 
                fixed_ticket_exchange_enabled: checked,
                // Reset data jika OFF
                ...(checked ? {} : { 
                  fixed_ticket_exchange_mode: '',
                  fixed_ticket_rewards: [],
                  fixed_lucky_spin_rewards: []
                })
              })}
            />
            <div className="flex-1">
              <div className="font-medium text-sm text-button-hover flex items-center gap-2">
                <Gift className="h-4 w-4" />
                6. Penukaran Hadiah / Lucky Spin
              </div>
              <p className="text-xs text-muted-foreground">
                Untuk promo berbasis Ticket atau Lucky Spin (opsional)
              </p>
            </div>
          </div>

          {data.fixed_ticket_exchange_enabled && (
            <div className="p-4 bg-card border border-border rounded-xl space-y-4">
              {/* Mode Selection */}
              <div className="space-y-2">
                <Label>Mode Reward</Label>
                <Select
                  value={data.fixed_ticket_exchange_mode || ''}
                  onValueChange={(value) => onChange({ 
                    fixed_ticket_exchange_mode: value as 'voucher' | 'lucky_spin',
                    // Reset data saat mode berubah
                    fixed_ticket_rewards: [],
                    fixed_lucky_spin_rewards: []
                  })}
                >
                  <SelectTrigger className="bg-muted">
                    <SelectValue placeholder="Pilih mode reward" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="voucher">
                      <div className="flex items-center gap-2">
                        <Ticket className="h-4 w-4" />
                        Voucher / Ticket (Tukar Hadiah)
                      </div>
                    </SelectItem>
                    <SelectItem value="lucky_spin">
                      <div className="flex items-center gap-2">
                        <Gamepad2 className="h-4 w-4" />
                        Lucky Spin (Acak / Spin)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Mode 1: Voucher/Ticket Exchange Table */}
              {data.fixed_ticket_exchange_mode === 'voucher' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gift className="h-5 w-5 text-button-hover" />
                      <span className="font-semibold text-sm">Tabel Penukaran Ticket</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 bg-muted text-muted-foreground hover:bg-button-hover hover:text-button-hover-foreground"
                      onClick={() => {
                        const newItem: TicketReward = {
                          id: generateUUID(),
                          ticket: 1,
                          reward: ''
                        };
                        onChange({ 
                          fixed_ticket_rewards: [...(data.fixed_ticket_rewards || []), newItem] 
                        });
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Row
                    </Button>
                  </div>

                  {/* Table */}
                  {(data.fixed_ticket_rewards || []).length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ticket</TableHead>
                          <TableHead>Hadiah</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(data.fixed_ticket_rewards || []).map((item, index) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Input
                                type="number"
                                min={1}
                                value={item.ticket}
                                onChange={(e) => {
                                  const updated = [...(data.fixed_ticket_rewards || [])];
                                  updated[index] = { ...item, ticket: parseInt(e.target.value) || 1 };
                                  onChange({ fixed_ticket_rewards: updated });
                                }}
                                className="bg-muted"
                                placeholder="1"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.reward}
                                onChange={(e) => {
                                  const updated = [...(data.fixed_ticket_rewards || [])];
                                  updated[index] = { ...item, reward: e.target.value };
                                  onChange({ fixed_ticket_rewards: updated });
                                }}
                                className="bg-muted"
                                placeholder="Contoh: Rp 10.000 atau Honda PCX"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  const updated = (data.fixed_ticket_rewards || []).filter((_, i) => i !== index);
                                  onChange({ fixed_ticket_rewards: updated });
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                      Belum ada hadiah. Klik "Add Row" untuk menambahkan.
                    </div>
                  )}

                  {/* Helper text */}
                  <p className="text-xs text-muted-foreground">
                    💡 User hanya bisa redeem hadiah dengan Ticket ≤ jumlah Ticket yang dimiliki.
                  </p>
                </div>
              )}

              {/* Mode 2: Lucky Spin Prize List */}
              {data.fixed_ticket_exchange_mode === 'lucky_spin' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gift className="h-5 w-5 text-button-hover" />
                      <span className="font-semibold text-sm">Daftar Hadiah Lucky Spin</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 bg-muted text-muted-foreground hover:bg-button-hover hover:text-button-hover-foreground"
                      onClick={() => {
                        onChange({ 
                          fixed_lucky_spin_rewards: [...(data.fixed_lucky_spin_rewards || []), ''] 
                        });
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Row
                    </Button>
                  </div>

                  {(data.fixed_lucky_spin_rewards || []).length > 0 ? (
                    <div className="space-y-2">
                      {(data.fixed_lucky_spin_rewards || []).map((prize, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-6">{index + 1}.</span>
                          <Input
                            value={prize}
                            onChange={(e) => {
                              const updated = [...(data.fixed_lucky_spin_rewards || [])];
                              updated[index] = e.target.value;
                              onChange({ fixed_lucky_spin_rewards: updated });
                            }}
                            className="bg-muted flex-1"
                            placeholder="Contoh: Honda PCX / iPhone 16 Pro / Rp 5.000.000"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              const updated = (data.fixed_lucky_spin_rewards || []).filter((_, i) => i !== index);
                              onChange({ fixed_lucky_spin_rewards: updated });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                      Belum ada hadiah. Klik "Add Row" untuk menambahkan.
                    </div>
                  )}

                  {/* Helper text */}
                  <p className="text-xs text-muted-foreground">
                    💡 Ticket berfungsi sebagai akses spin. Tidak ada logika exchange.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Toggle - Wajib Download APK (Selalu di paling bawah) */}
          <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl">
            <Switch
              checked={data.require_apk || false}
              onCheckedChange={(checked) => onChange({ require_apk: checked })}
            />
            <div className="flex-1">
              <div className="font-medium text-sm text-button-hover flex items-center gap-2">
                <Download className="h-4 w-4" />
                Wajib Download APK
              </div>
              <p className="text-xs text-muted-foreground">
                User wajib download APK terlebih dahulu untuk claim reward
              </p>
            </div>
          </div>
        </>
      )}

      {/* Blok F - Mode Formula (UI: Dinamis) */}
      {data.reward_mode === 'formula' && (
        <>

          {/* Section 1-3: Dinamis tidak memiliki subcategories */}
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
                  value={data.dinamis_reward_type || ''}
                  onValueChange={(value) => {
                    // Set inert values untuk field yang tidak relevan
                    const inertUpdates: Partial<PromoFormData> = {
                      dinamis_reward_type: value,
                      // Reset semua field reward ke inert
                      physical_reward_name: '',
                      physical_reward_quantity: undefined,
                      cash_reward_amount: undefined,
                      reward_quantity: null,
                      voucher_kind: '',
                      voucher_kind_custom: '',
                      voucher_valid_from: '',
                      voucher_valid_until: '',
                      lucky_spin_enabled: false,
                      lucky_spin_id: '',
                      lucky_spin_max_per_day: null,
                    };
                    
                    // Set default untuk field yang relevan
                    if (value === 'hadiah_fisik') {
                      inertUpdates.reward_quantity = 1;
                    } else if (value === 'voucher' || value === 'ticket') {
                      inertUpdates.reward_quantity = 1;
                      // Eligibility-based: HANYA disable calculation fields, BUKAN eligibility fields
                      // calculation_base & min_calculation TETAP AKTIF untuk syarat eligibility
                      inertUpdates.global_payout_direction = undefined;
                      inertUpdates.admin_fee_enabled = false;
                      inertUpdates.admin_fee_percentage = 0;
                      inertUpdates.calculation_method = '';
                      inertUpdates.calculation_value = undefined;
                    } else if (value === 'lucky_spin') {
                      inertUpdates.lucky_spin_enabled = true;
                      inertUpdates.reward_quantity = 1;
                      // Eligibility-based: HANYA disable calculation fields
                      inertUpdates.global_payout_direction = undefined;
                      inertUpdates.admin_fee_enabled = false;
                      inertUpdates.admin_fee_percentage = 0;
                      inertUpdates.calculation_method = '';
                      inertUpdates.calculation_value = undefined;
                    }
                    
                    onChange(inertUpdates);
                  }}
                  options={dinamisRewardTypeOptions}
                  onAddOption={(option) => setDinamisRewardTypeOptions([...dinamisRewardTypeOptions, option])}
                  onDeleteOption={handleDeleteDinamisRewardType}
                  placeholder="Pilih jenis"
                />
                {/* Dynamic Field: Hadiah Fisik */}
                {data.dinamis_reward_type === 'hadiah_fisik' && (
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    <div className="col-span-2 space-y-2">
                      <Label>Nama Hadiah Fisik</Label>
                      <Input
                        value={data.physical_reward_name || ''}
                        onChange={(e) => onChange({ physical_reward_name: e.target.value })}
                        placeholder="Contoh: MITSUBISHI PAJERO SPORT DAKAR 2025"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Jumlah Reward</Label>
                      <Input
                        type="number"
                        min={1}
                        value={data.reward_quantity ?? 1}
                        onChange={(e) => onChange({ reward_quantity: parseInt(e.target.value) || 1 })}
                        placeholder="1"
                      />
                    </div>
                  </div>
                )}
                {/* Dynamic Field: Lucky Spin */}
                {data.dinamis_reward_type === 'lucky_spin' && (
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    <div className="space-y-2">
                      <Label>ID Lucky Spin</Label>
                      <Input
                        value={data.lucky_spin_id || ''}
                        onChange={(e) => onChange({ 
                          lucky_spin_id: e.target.value,
                          lucky_spin_enabled: true
                        })}
                        placeholder="Contoh: SPIN-2024-001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Jumlah Reward</Label>
                      <Input
                        type="number"
                        min={1}
                        value={data.reward_quantity ?? 1}
                        onChange={(e) => onChange({ reward_quantity: parseInt(e.target.value) || 1 })}
                        placeholder="Jumlah spin"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Spin/Hari (opsional)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={data.lucky_spin_max_per_day ?? ''}
                        onChange={(e) => onChange({ lucky_spin_max_per_day: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="Contoh: 3"
                      />
                    </div>
                  </div>
                )}
                {/* Dynamic Field: Uang Tunai */}
                {data.dinamis_reward_type === 'uang_tunai' && (
                  <div className="space-y-2 mt-2">
                    <Label>Nominal Uang Tunai</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rp</span>
                      <Input
                        className="pl-10"
                        value={formatRupiah(data.cash_reward_amount)}
                        onChange={(e) => onChange({ cash_reward_amount: parseRupiah(e.target.value) })}
                        placeholder="50.000.000"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              {/* Max Bonus / Max Claim Reward - Dynamic Label based on reward type */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    {UNIT_BASED_REWARDS.includes(data.dinamis_reward_type || '') ? 'Max Claim Reward' : 'Max Bonus'}
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Unlimited</span>
                    <Switch
                      checked={data.dinamis_max_claim_unlimited ?? false}
                      onCheckedChange={(checked) => onChange({ 
                        dinamis_max_claim_unlimited: checked,
                        dinamis_max_claim: checked ? null : data.dinamis_max_claim
                      })}
                    />
                  </div>
                </div>
                <Input
                  type="text"
                  value={data.dinamis_max_claim_unlimited ? '' : (data.dinamis_max_claim ? data.dinamis_max_claim.toLocaleString('id-ID') : '')}
                  onChange={(e) => onChange({ dinamis_max_claim: Number(e.target.value.replace(/\D/g, '')) })}
                  placeholder={data.dinamis_max_claim_unlimited ? "Unlimited / Tanpa Batas" : (UNIT_BASED_REWARDS.includes(data.dinamis_reward_type || '') ? "Contoh: 10 unit/hari" : "Contoh: 100.000")}
                  disabled={data.dinamis_max_claim_unlimited}
                  className={cn(data.dinamis_max_claim_unlimited && "opacity-50")}
                />
              </div>
            </div>
            
            {/* Row 1.1: Voucher / Ticket Fields (hanya muncul jika dinamis_reward_type === 'voucher') */}
            {data.dinamis_reward_type === 'voucher' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Left column - dibawah Jenis Hadiah */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Jenis Voucher</Label>
                    <Select
                      value={data.voucher_kind || ''}
                      onValueChange={(value) => onChange({ 
                        voucher_kind: value,
                        voucher_kind_custom: value === 'other' ? (data.voucher_kind_custom || '') : ''
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih jenis voucher" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEFAULT_VOUCHER_KINDS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {data.voucher_kind === 'other' && (
                      <Input
                        value={data.voucher_kind_custom || ''}
                        onChange={(e) => onChange({ voucher_kind_custom: e.target.value })}
                        placeholder="Tulis jenis voucher custom..."
                        className="mt-2"
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Jumlah Reward</Label>
                    <Input
                      type="number"
                      min={1}
                      value={data.reward_quantity ?? 1}
                      onChange={(e) => onChange({ reward_quantity: parseInt(e.target.value) || 1 })}
                      placeholder="1"
                    />
                  </div>
                </div>
                {/* Right column - dibawah Max Bonus */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Masa Berlaku Dimulai</Label>
                    <Input
                      type="date"
                      value={data.voucher_valid_from || ''}
                      onChange={(e) => onChange({ voucher_valid_from: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label>Masa Berakhir</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Unlimited</span>
                        <Switch
                          checked={data.voucher_valid_unlimited || false}
                          onCheckedChange={(checked) => onChange({ 
                            voucher_valid_unlimited: checked,
                            voucher_valid_until: checked ? '' : data.voucher_valid_until
                          })}
                        />
                      </div>
                    </div>
                    <Input
                      type="date"
                      value={data.voucher_valid_unlimited ? '' : (data.voucher_valid_until || '')}
                      onChange={(e) => onChange({ voucher_valid_until: e.target.value })}
                      disabled={data.voucher_valid_unlimited}
                      placeholder={data.voucher_valid_unlimited ? "Tidak ada kadaluwarsa" : ""}
                      className={cn(data.voucher_valid_unlimited && "opacity-50")}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {/* Row 2: 2 kolom utama - Kolom 1 (Payout + Admin Fee), Kolom 2 (Minimum Depo) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              
              {/* KOLOM 1: Dibagi 2 sub-kolom (Payout Direction + Admin Fee) */}
              <div className="grid grid-cols-2 gap-4">
                {/* 1a: Payout Direction */}
                <div className="space-y-2">
                  <Label className={isVoucherTicket(data.dinamis_reward_type) ? 'text-muted-foreground' : ''}>Payout Direction</Label>
                  <RadioGroup
                    value={data.global_payout_direction || 'after'}
                    onValueChange={(value: 'before' | 'after') => onChange({ global_payout_direction: value })}
                    className={cn("flex flex-row items-center gap-4 pt-1", isVoucherTicket(data.dinamis_reward_type) && "opacity-50 pointer-events-none")}
                    disabled={isVoucherTicket(data.dinamis_reward_type)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="before" id="payout-before-global" disabled={isVoucherTicket(data.dinamis_reward_type)} />
                      <Label htmlFor="payout-before-global" className="cursor-pointer font-normal text-sm">Didepan</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="after" id="payout-after-global" disabled={isVoucherTicket(data.dinamis_reward_type)} />
                      <Label htmlFor="payout-after-global" className="cursor-pointer font-normal text-sm">Dibelakang</Label>
                    </div>
                  </RadioGroup>
                  {isVoucherTicket(data.dinamis_reward_type) && (
                    <p className="text-xs text-muted-foreground">Voucher / Ticket tidak menggunakan payout direction</p>
                  )}
                </div>
                
                {/* 1b: Admin Fee */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className={isVoucherTicket(data.dinamis_reward_type) ? 'text-muted-foreground' : ''}>Admin Fee</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Aktifkan</span>
                      <Switch
                        checked={data.admin_fee_enabled ?? false}
                        onCheckedChange={(checked) => onChange({ 
                          admin_fee_enabled: checked,
                          admin_fee_percentage: checked ? (data.admin_fee_percentage ?? 0) : 0
                        })}
                        disabled={isVoucherTicket(data.dinamis_reward_type)}
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={data.admin_fee_enabled ? (data.admin_fee_percentage ?? 0) : ''}
                      onChange={(e) => onChange({ admin_fee_percentage: Number(e.target.value) || 0 })}
                      placeholder={isVoucherTicket(data.dinamis_reward_type) ? "Tidak berlaku" : (data.admin_fee_enabled ? "0" : "Tidak aktif")}
                      disabled={!data.admin_fee_enabled || isVoucherTicket(data.dinamis_reward_type)}
                      className={cn("pr-10", (!data.admin_fee_enabled || isVoucherTicket(data.dinamis_reward_type)) && "opacity-50")}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  </div>
                  {isVoucherTicket(data.dinamis_reward_type) && (
                    <p className="text-xs text-muted-foreground">Admin fee hanya berlaku untuk reward berbasis uang</p>
                  )}
                </div>
              </div>
              
              {/* KOLOM 2: Minimum Depo — ONLY for deposit-based calculation */}
              {data.calculation_base === 'deposit' && !isVoucherTicket(data.dinamis_reward_type) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Minimum Deposit</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Aktifkan</span>
                      <Switch
                        checked={(data.min_deposit ?? 0) > 0}
                        onCheckedChange={(checked) => onChange({ 
                          min_deposit: checked ? 50000 : 0
                        })}
                      />
                    </div>
                  </div>
                  <div className={(data.min_deposit ?? 0) <= 0 ? "opacity-50 pointer-events-none" : ""}>
                    {(data.min_deposit ?? 0) > 0 ? (
                      <FormattedNumberInput
                        value={data.min_deposit ?? 0}
                        onChange={(value) => onChange({ min_deposit: value })}
                        placeholder="Contoh: 50.000"
                      />
                    ) : (
                      <Input
                        value=""
                        placeholder="Tidak aktif"
                        disabled
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Row 3: Dasar Perhitungan & Jenis Perhitungan */}
            {(() => {
              const isEligibilityMode = isEligibilityBasedReward(data.dinamis_reward_type);
              const isManualEligibility = isEligibilityMode && data.calculation_base === 'manual';
              
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Dasar Perhitungan / Syarat Mendapatkan Ticket */}
                  <div className="space-y-2">
                    <Label>{isEligibilityMode ? 'Syarat Mendapatkan Ticket' : 'Dasar Perhitungan'}</Label>
                    <SelectWithAddNew
                      value={data.calculation_base}
                      onValueChange={(value) => {
                        const updates: Partial<PromoFormData> = { calculation_base: value };
                        
                        // Set trigger_event untuk mapping yang benar
                        if (value === 'turnover') updates.trigger_event = 'turnover';
                        else if (value === 'loss') updates.trigger_event = 'loss';
                        else if (value === 'deposit') updates.trigger_event = 'deposit';
                        else if (value === 'manual') updates.trigger_event = 'event';
                        
                        // Jika Manual/Event, disable min_calculation
                        if (isEligibilityMode && value === 'manual') {
                          updates.min_calculation_enabled = false;
                          updates.min_calculation = 0;
                        }
                        
                        onChange(updates);
                      }}
                      options={isEligibilityMode ? TICKET_ELIGIBILITY_OPTIONS : calcBaseOptions}
                      onAddOption={isEligibilityMode ? undefined : (option) => setCalcBaseOptions([...calcBaseOptions, option])}
                      onDeleteOption={isEligibilityMode ? undefined : handleDeleteCalcBase}
                      placeholder={isEligibilityMode ? "Pilih syarat (Deposit, TO, Loss, Manual)" : "Pilih dasar (TO, Deposit, dll)"}
                    />
                  </div>
                  
                  {/* Jenis Perhitungan - DISABLED untuk eligibility-based rewards */}
                  <div className="space-y-2">
                    <Label className={isEligibilityMode ? 'text-muted-foreground' : ''}>Jenis Perhitungan</Label>
                    <SelectWithAddNew
                      value={data.calculation_method}
                      onValueChange={(value) => onChange({ calculation_method: value })}
                      options={calcMethodOptions}
                      onAddOption={(option) => setCalcMethodOptions([...calcMethodOptions, option])}
                      onDeleteOption={handleDeleteCalcMethod}
                      placeholder={isEligibilityMode ? "Tidak berlaku untuk ticket" : "Pilih jenis (%, Fixed)"}
                      disabled={isEligibilityMode}
                    />
                    {isEligibilityMode && (
                      <p className="text-xs text-muted-foreground">Ticket tidak menggunakan kalkulasi %/fixed</p>
                    )}
                  </div>
                  
                  {/* Nilai Bonus - DISABLED untuk eligibility-based rewards */}
                  <div className="space-y-2">
                    <Label className={isEligibilityMode ? 'text-muted-foreground' : ''}>Nilai Bonus</Label>
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
                        placeholder={isEligibilityMode ? "Tidak berlaku untuk ticket" : "Contoh: 0,5"}
                        className={cn("pr-10", isEligibilityMode && "opacity-50")}
                        disabled={isEligibilityMode}
                      />
                      {data.calculation_method === 'percentage' && !isEligibilityMode && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Minimal Perhitungan / Ambang Syarat - AKTIF untuk eligibility, disabled jika Manual */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className={isManualEligibility ? 'text-muted-foreground' : ''}>
                        {isEligibilityMode 
                          ? 'Ambang Syarat' 
                          : getMinimumBaseLabel()}
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Aktifkan</span>
                        <Switch
                          checked={data.min_calculation_enabled}
                          onCheckedChange={(checked) => onChange({ 
                            min_calculation_enabled: checked,
                            min_calculation: checked ? data.min_calculation : 0
                          })}
                          disabled={isManualEligibility}
                        />
                      </div>
                    </div>
                    <Input
                      type="text"
                      value={data.min_calculation_enabled && data.min_calculation ? data.min_calculation.toLocaleString('id-ID') : ''}
                      onChange={(e) => onChange({ min_calculation: Number(e.target.value.replace(/\D/g, '')) })}
                      placeholder={isManualEligibility 
                        ? "Manual / Event tidak memerlukan ambang" 
                        : (data.min_calculation_enabled ? "Contoh: 1.000.000" : "Tidak aktif")}
                      disabled={!data.min_calculation_enabled || isManualEligibility}
                      className={(!data.min_calculation_enabled || isManualEligibility) ? "opacity-50" : ""}
                    />
                    {isManualEligibility && (
                      <p className="text-xs text-muted-foreground">Syarat manual tidak memerlukan nilai ambang</p>
                    )}
                  </div>
                </div>
              );
            })()}
            
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
                        const minBase = data.min_calculation || 1000000;
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
              <GameWhitelistBlacklist
                gameTypes={data.game_types || []}
                gameProviders={data.game_providers || []}
                gameNames={data.game_names || []}
                gameTypesBlacklist={data.game_types_blacklist || []}
                gameProvidersBlacklist={data.game_providers_blacklist || []}
                gameNamesBlacklist={data.game_names_blacklist || []}
                gameBlacklistEnabled={data.game_blacklist_enabled ?? false}
                gameExclusionRules={data.game_exclusion_rules || []}
                gameTypeOptions={gameTypeOptions}
                gameProviderOptions={gameProviderOptions}
                gameNameOptions={gameNameOptions}
                gameTypeBlacklistOptions={gameTypeBlacklistOptions}
                gameProviderBlacklistOptions={gameProviderBlacklistOptions}
                gameNameBlacklistOptions={gameNameBlacklistOptions}
                onGameTypesChange={(types) => onChange({ game_types: types })}
                onGameProvidersChange={(providers) => onChange({ game_providers: providers })}
                onGameNamesChange={(names) => onChange({ game_names: names })}
                onGameTypesBlacklistChange={(types) => onChange({ game_types_blacklist: types })}
                onGameProvidersBlacklistChange={(providers) => onChange({ game_providers_blacklist: providers })}
                onGameNamesBlacklistChange={(names) => onChange({ game_names_blacklist: names })}
                onBlacklistEnabledChange={(enabled) => onChange({ game_blacklist_enabled: enabled })}
                onExclusionRulesChange={(rules) => onChange({ game_exclusion_rules: rules })}
                onAddGameTypeOption={(option) => setGameTypeOptions([...gameTypeOptions, option])}
                onDeleteGameTypeOption={handleDeleteGameType}
                onAddGameProviderOption={(option) => setGameProviderOptions([...gameProviderOptions, option])}
                onDeleteGameProviderOption={handleDeleteGameProvider}
                onAddGameNameOption={(option) => setGameNameOptions([...gameNameOptions, option])}
                onDeleteGameNameOption={handleDeleteGameName}
                onAddGameTypeBlacklistOption={(option) => setGameTypeBlacklistOptions([...gameTypeBlacklistOptions, option])}
                onDeleteGameTypeBlacklistOption={handleDeleteGameTypeBlacklist}
                onAddGameProviderBlacklistOption={(option) => setGameProviderBlacklistOptions([...gameProviderBlacklistOptions, option])}
                onDeleteGameProviderBlacklistOption={handleDeleteGameProviderBlacklist}
                onAddGameNameBlacklistOption={(option) => setGameNameBlacklistOptions([...gameNameBlacklistOptions, option])}
                onDeleteGameNameBlacklistOption={handleDeleteGameNameBlacklist}
              />
            </CollapsibleContent>
          </Collapsible>
            </>

          {/* Section 3 - Hadiah dan Waktu */}
          <Collapsible>
            <CollapsibleTrigger className="collapsible-trigger w-full group">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-button-hover" />
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">3. Hadiah dan Waktu</div>
                  <div className="text-xs text-muted-foreground">Periode klaim dan distribusi reward</div>
                </div>
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="collapsible-content">
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
              
              {/* Helper text based on selection */}
              {data.reward_distribution && (
                <p className="text-xs text-muted-foreground">
                  {REWARD_DISTRIBUTIONS.find(d => d.value === data.reward_distribution)?.helper || ''}
                </p>
              )}
              
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
            <CollapsibleTrigger className="collapsible-trigger w-full group">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-button-hover" />
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">4. Syarat Khusus</div>
                  <div className="text-xs text-muted-foreground">Ketentuan tambahan untuk promo</div>
                </div>
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
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

          {/* Section 5 - Manual Claim & Contact Official */}
          <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl">
            <Switch
              checked={data.contact_channel_enabled || false}
              onCheckedChange={(checked) => onChange({ 
                contact_channel_enabled: checked
              })}
            />
            <div className="flex-1">
              <div className="font-medium text-sm text-button-hover flex items-center gap-2">
                <Phone className="h-4 w-4" />
                5. Manual Claim & Contact Official
              </div>
              <p className="text-xs text-muted-foreground">
                Info kontak untuk klaim bonus via CS
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

          {/* Section 6 - Penukaran Hadiah / Lucky Spin (Opsional) - Dynamic Mode */}
          <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl">
            <Switch
              checked={data.ticket_exchange_enabled || false}
              onCheckedChange={(checked) => onChange({ 
                ticket_exchange_enabled: checked,
                // Reset data jika OFF
                ...(checked ? {} : { 
                  ticket_exchange_mode: '',
                  ticket_rewards: [],
                  lucky_spin_rewards: []
                })
              })}
            />
            <div className="flex-1">
              <div className="font-medium text-sm text-button-hover flex items-center gap-2">
                <Gift className="h-4 w-4" />
                6. Penukaran Hadiah / Lucky Spin
              </div>
              <p className="text-xs text-muted-foreground">
                Untuk promo berbasis Ticket atau Lucky Spin (opsional)
              </p>
            </div>
          </div>

          {data.ticket_exchange_enabled && (
            <div className="p-4 bg-card border border-border rounded-xl space-y-4">
              {/* Mode Selection */}
              <div className="space-y-2">
                <Label>Mode Reward</Label>
                <Select
                  value={data.ticket_exchange_mode || ''}
                  onValueChange={(value) => onChange({ 
                    ticket_exchange_mode: value as 'voucher' | 'lucky_spin',
                    // Reset data saat mode berubah
                    ticket_rewards: [],
                    lucky_spin_rewards: []
                  })}
                >
                  <SelectTrigger className="bg-muted">
                    <SelectValue placeholder="Pilih mode reward" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="voucher">
                      <div className="flex items-center gap-2">
                        <Ticket className="h-4 w-4" />
                        Voucher / Ticket (Tukar Hadiah)
                      </div>
                    </SelectItem>
                    <SelectItem value="lucky_spin">
                      <div className="flex items-center gap-2">
                        <Gamepad2 className="h-4 w-4" />
                        Lucky Spin (Acak / Spin)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Mode 1: Voucher/Ticket Exchange Table */}
              {data.ticket_exchange_mode === 'voucher' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gift className="h-5 w-5 text-button-hover" />
                      <span className="font-semibold text-sm">Tabel Penukaran Ticket</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 bg-muted text-muted-foreground hover:bg-button-hover hover:text-button-hover-foreground"
                      onClick={() => {
                        const newItem: TicketReward = {
                          id: generateUUID(),
                          ticket: 1,
                          reward: ''
                        };
                        onChange({ 
                          ticket_rewards: [...(data.ticket_rewards || []), newItem] 
                        });
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Row
                    </Button>
                  </div>

                  {/* Table */}
                  {(data.ticket_rewards || []).length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ticket</TableHead>
                          <TableHead>Hadiah</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(data.ticket_rewards || []).map((item, index) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Input
                                type="number"
                                min={1}
                                value={item.ticket}
                                onChange={(e) => {
                                  const updated = [...(data.ticket_rewards || [])];
                                  updated[index] = { ...item, ticket: parseInt(e.target.value) || 1 };
                                  onChange({ ticket_rewards: updated });
                                }}
                                className="bg-muted"
                                placeholder="1"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.reward}
                                onChange={(e) => {
                                  const updated = [...(data.ticket_rewards || [])];
                                  updated[index] = { ...item, reward: e.target.value };
                                  onChange({ ticket_rewards: updated });
                                }}
                                className="bg-muted"
                                placeholder="Contoh: Rp 10.000 atau Honda PCX"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  const updated = (data.ticket_rewards || []).filter((_, i) => i !== index);
                                  onChange({ ticket_rewards: updated });
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                      Belum ada hadiah. Klik "Add Row" untuk menambahkan.
                    </div>
                  )}

                  {/* Helper text */}
                  <p className="text-xs text-muted-foreground">
                    💡 User hanya bisa redeem hadiah dengan Ticket ≤ jumlah Ticket yang dimiliki.
                  </p>
                </div>
              )}

              {/* Mode 2: Lucky Spin Prize List */}
              {data.ticket_exchange_mode === 'lucky_spin' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gift className="h-5 w-5 text-button-hover" />
                      <span className="font-semibold text-sm">Daftar Hadiah Lucky Spin</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 bg-muted text-muted-foreground hover:bg-button-hover hover:text-button-hover-foreground"
                      onClick={() => {
                        onChange({ 
                          lucky_spin_rewards: [...(data.lucky_spin_rewards || []), ''] 
                        });
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Row
                    </Button>
                  </div>

                  {(data.lucky_spin_rewards || []).length > 0 ? (
                    <div className="space-y-2">
                      {(data.lucky_spin_rewards || []).map((prize, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-6">{index + 1}.</span>
                          <Input
                            value={prize}
                            onChange={(e) => {
                              const updated = [...(data.lucky_spin_rewards || [])];
                              updated[index] = e.target.value;
                              onChange({ lucky_spin_rewards: updated });
                            }}
                            className="bg-muted flex-1"
                            placeholder="Contoh: Honda PCX / iPhone 16 Pro / Rp 5.000.000"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              const updated = (data.lucky_spin_rewards || []).filter((_, i) => i !== index);
                              onChange({ lucky_spin_rewards: updated });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                      Belum ada hadiah. Klik "Add Row" untuk menambahkan.
                    </div>
                  )}

                  {/* Helper text */}
                  <p className="text-xs text-muted-foreground">
                    💡 Ticket berfungsi sebagai akses spin. Tidak ada logika exchange.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Toggle - Wajib Download APK (Selalu di paling bawah) */}
          <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl">
            <Switch
              checked={data.require_apk || false}
              onCheckedChange={(checked) => onChange({ require_apk: checked })}
            />
            <div className="flex-1">
              <div className="font-medium text-sm text-button-hover flex items-center gap-2">
                <Download className="h-4 w-4" />
                Wajib Download APK
              </div>
              <p className="text-xs text-muted-foreground">
                User wajib download APK terlebih dahulu untuk claim reward
              </p>
            </div>
          </div>
        </>
      )}

      {/* Blok C - Mode Tier (DUPLICATED FROM DINAMIS - UI ONLY) */}
      {data.reward_mode === 'tier' && (
        <>
          {/* Tier Archetype Selector (UI-gating only) */}
          <div className="space-y-3">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-xs text-amber-200">
                ⚠️ Mode <strong>Tier</strong> digunakan untuk reward berbasis ambang (level, point, atau metrik lain). 
                Pilih tipe tier di bawah untuk menampilkan field yang relevan.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Tier Archetype <span className="text-red-500">*</span></Label>
              <Select
                value={data.tier_archetype || ''}
                onValueChange={(value: TierArchetype) => onChange({ tier_archetype: value })}
              >
                <SelectTrigger className="w-full bg-card border-border">
                  <SelectValue placeholder="Pilihan tier archetype" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {TIER_ARCHETYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="py-3">
                      <span className="font-medium text-foreground">{option.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {data.tier_archetype 
                  ? TIER_ARCHETYPE_OPTIONS.find(o => o.value === data.tier_archetype)?.description
                  : 'Pilih archetype untuk melihat deskripsi'}
              </p>
            </div>
          </div>

          {/* 1. Tabel Perhitungan - Only for tier_point_store */}
          {data.tier_archetype === 'tier_point_store' && (
            <Collapsible>
              <CollapsibleTrigger className="w-full p-4 bg-card border border-border rounded-xl flex items-center justify-between mb-4 hover:bg-card/80 transition-colors group">
                <div className="flex items-center gap-3">
                  <Star className="h-5 w-5 text-button-hover" />
                  <div className="text-left">
                    <div className="text-sm font-semibold text-foreground">1. Tabel Perhitungan</div>
                    <div className="text-xs text-muted-foreground">Konfigurasi point store dan tabel redeem</div>
                  </div>
                </div>
                <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-4 bg-card/50 border border-border rounded-xl mb-4 space-y-4">
              
              {/* Row 1: Point Unit + Basis Perhitungan */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Col 1: Point Unit */}
                <div className="space-y-2">
                  <Label className="text-sm">Point Unit</Label>
                  <Select
                    value={data.promo_unit || 'lp'}
                    onValueChange={(value: 'lp' | 'exp' | 'hybrid') => onChange({ promo_unit: value })}
                  >
                    <SelectTrigger className="w-full bg-card border-border">
                      <SelectValue placeholder="Pilih unit point..." />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="lp">Loyalty Point (LP)</SelectItem>
                      <SelectItem value="exp">Experience Point (EXP)</SelectItem>
                      <SelectItem value="hybrid">Hybrid (LP + EXP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Col 2: Basis Perhitungan */}
                <div className="space-y-2">
                  <Label className="text-sm">
                    Basis Perhitungan {getPointUnitShort(data.promo_unit)} <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={data.lp_earn_basis || 'turnover'}
                    onValueChange={(value) => onChange({ lp_earn_basis: value as 'turnover' | 'win' | 'lose' | 'deposit' })}
                  >
                    <SelectTrigger className="bg-card border-border">
                      <SelectValue placeholder="Pilih basis perhitungan" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border z-50">
                      <SelectItem value="turnover">Turnover</SelectItem>
                      <SelectItem value="win">Kemenangan (Win)</SelectItem>
                      <SelectItem value="lose">Kekalahan Bersih (Net Loss)</SelectItem>
                      <SelectItem value="deposit">Deposit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Row 2: EXP Mode + Aturan Perolehan */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                {/* Col 1: Point Mode */}
                <div className="space-y-2">
                  <Label className="text-sm">{getPointUnitShort(data.promo_unit)} Mode</Label>
                  <Select
                    value={data.exp_mode || 'exp_store'}
                    onValueChange={(value: 'level_up' | 'exp_store' | 'both') => onChange({ exp_mode: value })}
                  >
                    <SelectTrigger className="w-full bg-card border-border">
                      <SelectValue placeholder="Pilih mode EXP..." />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="exp_store">Point Store Only</SelectItem>
                      <SelectItem value="level_up">Level Up Only</SelectItem>
                      <SelectItem value="both">Both (Store + Level)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Col 2: Aturan Perolehan - Grid 2 kolom */}
                <div className="space-y-2">
                  <Label className="text-sm">
                    Aturan Perolehan {getPointUnitShort(data.promo_unit)} <span className="text-destructive">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Kolom 4a - Turnover/Win/Loss/Deposit */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Jumlah</Label>
                      <FormattedNumberInput
                        value={data.lp_earn_amount || 0}
                        onChange={(val) => onChange({ lp_earn_amount: val })}
                        className="w-full bg-muted"
                        min={1}
                      />
                    </div>
                    
                    {/* Kolom 4b - Loyalty Point/EXP */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        {getPointUnitShort(data.promo_unit)}
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        value={data.lp_earn_point_amount || ''}
                        onChange={(e) => onChange({ lp_earn_point_amount: parseInt(e.target.value) || 0 })}
                        className="w-full bg-muted"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Helper Text Section - Semua dikumpulkan di sini */}
              <div className="p-3 bg-muted/50 rounded-lg space-y-1.5 text-xs text-muted-foreground">
                <p>
                  💡 <strong>Point Unit:</strong> {
                    data.promo_unit === 'exp' ? 'Experience Point untuk leveling dan achievement system.' :
                    data.promo_unit === 'hybrid' ? 'Kombinasi LP untuk rewards dan EXP untuk leveling.' :
                    'Loyalty Point yang bisa ditukar dengan hadiah di Point Store.'
                  }
                </p>
                <p>
                  💡 <strong>{getPointUnitShort(data.promo_unit)} Mode:</strong> {
                    data.exp_mode === 'level_up' ? `${getPointUnitShort(data.promo_unit)} hanya untuk naik level, tidak bisa ditukar.` :
                    data.exp_mode === 'both' ? `${getPointUnitShort(data.promo_unit)} bisa untuk naik level dan ditukar hadiah.` :
                    `${getPointUnitShort(data.promo_unit)} hanya untuk ditukar hadiah di store, tidak ada sistem level.`
                  }
                </p>
                <p>
                  💡 <strong>Earn Rule:</strong> {
                    data.lp_earn_basis === 'win' ? `${getPointUnitLabel(data.promo_unit)} diberikan berdasarkan total kemenangan pemain.` :
                    data.lp_earn_basis === 'lose' ? `${getPointUnitLabel(data.promo_unit)} diberikan sebagai kompensasi atas kekalahan bersih.` :
                    data.lp_earn_basis === 'deposit' ? `${getPointUnitLabel(data.promo_unit)} diberikan berdasarkan total deposit pemain.` :
                    `${getPointUnitLabel(data.promo_unit)} terakumulasi otomatis berdasarkan total turnover.`
                  }
                </p>
              </div>

              {/* Daftar Hadiah Penukaran - Tabel Redeem */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift className="h-5 w-5 text-button-hover" />
                    <span className="font-semibold text-sm">Tabel Redeem {getPointUnitLabel(data.promo_unit)}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newItem: RedeemItem = {
                        id: generateUUID(),
                        nama_hadiah: '',
                        nilai_hadiah: 0,
                        biaya_lp: 0,
                        is_active: true,
                      };
                      onChange({ redeem_items: [...(data.redeem_items || []), newItem] });
                    }}
                    className="h-8 px-3 bg-muted text-muted-foreground hover:bg-button-hover hover:text-button-hover-foreground"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Row
                  </Button>
                </div>
                
                {/* Jenis Reward - Global untuk semua redeem items */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Jenis Reward</Label>
                  <SelectWithAddNew
                    value={data.redeem_jenis_reward || ''}
                    onValueChange={(val) => onChange({ redeem_jenis_reward: val })}
                    placeholder="Pilih jenis reward..."
                    options={dinamisRewardTypeOptions}
                    onAddOption={(opt) => {
                      setDinamisRewardTypeOptions(prev => [...prev, opt]);
                    }}
                    onDeleteOption={(val) => {
                      setDinamisRewardTypeOptions(prev => prev.filter(opt => opt.value !== val));
                    }}
                  />
                </div>
                
                {/* Table */}
                {(data.redeem_items || []).length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama Hadiah</TableHead>
                        <TableHead>Nilai Hadiah</TableHead>
                        <TableHead>Biaya {getPointUnitShort(data.promo_unit)}</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data.redeem_items || []).map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Input
                              value={item.nama_hadiah}
                              onChange={(e) => {
                                const updatedItems = [...(data.redeem_items || [])];
                                updatedItems[index] = { ...updatedItems[index], nama_hadiah: e.target.value };
                                onChange({ redeem_items: updatedItems });
                              }}
                              placeholder="Credit Game 10.000"
                              className="bg-muted"
                            />
                          </TableCell>
                          <TableCell>
                            <FormattedNumberInput
                              value={item.nilai_hadiah}
                              onChange={(val) => {
                                const updatedItems = [...(data.redeem_items || [])];
                                updatedItems[index] = { ...updatedItems[index], nilai_hadiah: val };
                                onChange({ redeem_items: updatedItems });
                              }}
                              className="bg-muted"
                            />
                          </TableCell>
                          <TableCell>
                            <FormattedNumberInput
                              value={item.biaya_lp}
                              onChange={(val) => {
                                const updatedItems = [...(data.redeem_items || [])];
                                updatedItems[index] = { ...updatedItems[index], biaya_lp: val };
                                onChange({ redeem_items: updatedItems });
                              }}
                              className="bg-muted"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const updatedItems = (data.redeem_items || []).filter((_, i) => i !== index);
                                onChange({ redeem_items: updatedItems });
                              }}
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                    Belum ada hadiah. Klik "Add Row" untuk menambahkan.
                  </div>
                )}
                
                {/* Helper text */}
                <p className="text-xs text-muted-foreground">
                  💡 User hanya bisa redeem hadiah dengan Biaya {getPointUnitShort(data.promo_unit)} ≤ {getPointUnitLabel(data.promo_unit)} yang dimiliki. Minimum redeem = row dengan biaya paling kecil.
                </p>
              </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Network Metric UI (tier_network) - Cloned from tier_point_store pattern */}
          {data.tier_archetype === 'tier_network' && (
            <>
              {/* Section 1: Metode Perhitungan Komisi (Interactive) */}
              <div className="p-4 bg-card border border-border rounded-xl space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calculator className="h-5 w-5 text-button-hover" />
                  <div>
                    <span className="font-semibold text-sm">Metode Perhitungan Komisi</span>
                    <p className="text-xs text-muted-foreground">Konfigurasi dasar perhitungan komisi referral.</p>
                  </div>
                </div>
                
                {/* Interactive Fields */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Col 1: Basis Perhitungan - SelectWithAddNew */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Basis Perhitungan</Label>
                    <SelectWithAddNew
                      value={data.referral_calculation_basis || 'turnover'}
                      onValueChange={(value) => onChange({ referral_calculation_basis: value })}
                      options={referralBasisOptions}
                      onAddOption={(opt) => setReferralBasisOptions(prev => [...prev, opt])}
                      onDeleteOption={(val) => setReferralBasisOptions(prev => prev.filter(o => o.value !== val))}
                      placeholder="Pilih dasar (TO, Deposit, dll)"
                    />
                  </div>
                  
                  {/* Col 2: Admin Fee - Toggle + Percentage */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Admin Fee</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Aktifkan</span>
                        <Switch
                          checked={data.referral_admin_fee_enabled ?? true}
                          onCheckedChange={(checked) => onChange({ referral_admin_fee_enabled: checked })}
                        />
                      </div>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={data.referral_admin_fee_enabled !== false ? (data.referral_admin_fee_percentage ?? 20) : ''}
                        onChange={(e) => onChange({ referral_admin_fee_percentage: parseFloat(e.target.value) || 0 })}
                        placeholder={data.referral_admin_fee_enabled !== false ? "0" : "Tidak aktif"}
                        disabled={data.referral_admin_fee_enabled === false}
                        className={cn("pr-8", data.referral_admin_fee_enabled === false && "opacity-50")}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                    </div>
                  </div>
                </div>
                
                {/* Dynamic Helper text */}
                <p className="text-xs text-muted-foreground">
                  💡 {data.referral_admin_fee_enabled !== false 
                    ? `Komisi dihitung dari ${getReferralBasisLabel(data.referral_calculation_basis || 'turnover')} setelah potongan admin fee ${data.referral_admin_fee_percentage ?? 20}%.`
                    : `Komisi dihitung dari ${getReferralBasisLabel(data.referral_calculation_basis || 'turnover')} tanpa potongan admin fee.`
                  }
                </p>
              </div>

              {/* Section 2: Tabel Tier Komisi Referral */}
              {(() => {
                // Validate tier order - min_downline must increase progressively
                const tiers = data.referral_tiers || [];
                const orderError = tiers.length >= 2 && tiers.some((tier, idx) => {
                  if (idx === 0) return false;
                  return tier.min_downline <= tiers[idx - 1].min_downline;
                });
                
                return (
                  <div className="p-4 bg-card border border-border rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-button-hover" />
                        <span className="font-semibold text-sm">Tabel Tier Komisi Referral</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const currentTiers = data.referral_tiers || [];
                          const lastMinDownline = currentTiers.length > 0 
                            ? currentTiers[currentTiers.length - 1].min_downline 
                            : 0;
                          const newTier: ReferralCommissionTier = {
                            id: generateUUID(),
                            tier_label: `Tier ${currentTiers.length + 1}`,
                            min_downline: lastMinDownline + 5, // Auto-increment by 5
                            commission_percentage: 0,
                          };
                          onChange({ referral_tiers: [...currentTiers, newTier] });
                        }}
                        className="h-8 rounded-full"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Row
                      </Button>
                    </div>

                    {/* Validation Error */}
                    {orderError && (
                      <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span>Min Downline harus naik secara bertahap antar tier (Tier 2 &gt; Tier 1, dst)</span>
                      </div>
                    )}

                    {/* Table - 2 Baris per Tier */}
                    {(data.referral_tiers || []).length > 0 ? (
                      <div className="border border-border rounded-lg overflow-hidden">
                        <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="text-foreground font-semibold px-4 w-1/4">Nama Tier</TableHead>
                          <TableHead className="text-foreground font-semibold px-4 w-1/4">Downline Aktif (≥)</TableHead>
                          <TableHead className="text-foreground font-semibold px-4 w-1/4">Winlose</TableHead>
                          <TableHead className="text-foreground font-semibold px-4 w-1/4">Cashback</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(data.referral_tiers || []).map((tier, index) => {
                          // Calculate derived values
                          const adminFeePercent =
                            data.referral_admin_fee_enabled !== false
                              ? (data.referral_admin_fee_percentage ?? 20)
                              : 0;
                          const sampleWinlose = tier.sample_winlose ?? 0;
                          const feeAmount = Math.round((sampleWinlose * adminFeePercent) / 100);
                          const winloseBersih = sampleWinlose - feeAmount;
                          const komisi = Math.round((winloseBersih * tier.commission_percentage) / 100);

                          return (
                            <React.Fragment key={tier.id}>
                              {/* Row 1: Identitas & Input - 4 kolom sama lebar */}
                              <TableRow className="hover:bg-muted/20 border-b-0">
                                <TableCell className="px-4 py-4 w-1/4">
                                  <Input
                                    value={tier.tier_label || `Tier ${index + 1}`}
                                    onChange={(e) => {
                                      const updatedTiers = [...(data.referral_tiers || [])];
                                      updatedTiers[index] = { ...updatedTiers[index], tier_label: e.target.value };
                                      onChange({ referral_tiers: updatedTiers });
                                    }}
                                    placeholder={`Tier ${index + 1}`}
                                    className="bg-muted"
                                  />
                                </TableCell>
                                <TableCell className="px-4 py-4 w-1/4">
                                  <Input
                                    type="number"
                                    min={0}
                                    value={tier.min_downline === 0 ? '' : tier.min_downline}
                                    onChange={(e) => {
                                      const updatedTiers = [...(data.referral_tiers || [])];
                                      updatedTiers[index] = {
                                        ...updatedTiers[index],
                                        min_downline: e.target.value === '' ? 0 : parseInt(e.target.value, 10),
                                      };
                                      onChange({ referral_tiers: updatedTiers });
                                    }}
                                    placeholder="0"
                                    className="bg-muted"
                                  />
                                </TableCell>
                                <TableCell className="px-4 py-4 w-1/4">
                                  <FormattedNumberInput
                                    value={tier.sample_winlose ?? 0}
                                    onChange={(val) => {
                                      const updatedTiers = [...(data.referral_tiers || [])];
                                      updatedTiers[index] = { ...updatedTiers[index], sample_winlose: val };
                                      onChange({ referral_tiers: updatedTiers });
                                    }}
                                    placeholder="0"
                                    className="bg-muted"
                                  />
                                </TableCell>
                                <TableCell className="px-4 py-4 w-1/4">
                                  <FormattedNumberInput
                                    value={tier.sample_cashback ?? 0}
                                    onChange={(val) => {
                                      const updatedTiers = [...(data.referral_tiers || [])];
                                      updatedTiers[index] = { ...updatedTiers[index], sample_cashback: val };
                                      onChange({ referral_tiers: updatedTiers });
                                    }}
                                    placeholder="0"
                                    className="bg-muted"
                                  />
                                </TableCell>
                              </TableRow>

                              {/* Row 2: Perhitungan - 4 kolom sama lebar (25% each) */}
                              <TableRow className="bg-muted/20 border-b-0">
                                <TableCell className="px-4 py-3 w-1/4">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">
                                      Fee {adminFeePercent}%
                                      <span className="ml-1 text-[10px] text-muted-foreground/60">(dari Admin Fee)</span>
                                    </Label>
                                    <div className="h-10 px-3 py-2 bg-muted/50 border border-input rounded-md flex items-center text-sm text-muted-foreground">
                                      {formatNumberWithSeparator(feeAmount)}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="px-4 py-3 w-1/4">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Winlose Bersih</Label>
                                    <div className="h-10 px-3 py-2 bg-muted/50 border border-input rounded-md flex items-center text-sm text-muted-foreground">
                                      {formatNumberWithSeparator(winloseBersih)}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="px-4 py-3 w-1/4">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Persentase Komisi</Label>
                                    <div className="flex items-center gap-2">
                                      <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step={0.1}
                                        value={tier.commission_percentage === 0 ? '' : tier.commission_percentage}
                                        onChange={(e) => {
                                          const updatedTiers = [...(data.referral_tiers || [])];
                                          updatedTiers[index] = {
                                            ...updatedTiers[index],
                                            commission_percentage: e.target.value === '' ? 0 : parseFloat(e.target.value),
                                          };
                                          onChange({ referral_tiers: updatedTiers });
                                        }}
                                        placeholder="0"
                                        className="bg-muted"
                                      />
                                      <span className="text-sm text-muted-foreground">%</span>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="px-4 py-3 w-1/4">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Komisi</Label>
                                    <div className="h-10 px-3 py-2 bg-primary/10 border border-primary/20 rounded-md flex items-center text-sm font-medium text-foreground">
                                      {formatNumberWithSeparator(komisi)}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>

                              {/* Row 3: Delete Button */}
                              <TableRow
                                className={cn(
                                  "bg-muted/20",
                                  index < (data.referral_tiers || []).length - 1 && "border-b-2 border-border"
                                )}
                              >
                                <TableCell colSpan={4} className="px-4 py-2">
                                  <div className="flex justify-end">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const updatedTiers = (data.referral_tiers || []).filter((_, i) => i !== index);
                                        const relabeledTiers = updatedTiers.map((t, i) => ({
                                          ...t,
                                          tier_label: t.tier_label || `Tier ${i + 1}`,
                                        }));
                                        onChange({ referral_tiers: relabeledTiers });
                                      }}
                                      className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 className="h-4 w-4 mr-1" />
                                      Hapus Tier
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            </React.Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                    Belum ada tier. Klik "Add Row" untuk menambahkan.
                  </div>
                )}

                    {/* Helper text */}
                    <p className="text-xs text-muted-foreground">
                      💡 Komisi diberikan berdasarkan jumlah downline aktif yang dimiliki user.
                    </p>
                  </div>
                );
              })()}
            </>
          )}
          {data.tier_archetype === 'tier_level' && (
            <>
              {/* Card 1: Aturan Progress Level (Simple, not accordion) */}
              <div className="p-4 bg-card border border-border rounded-xl space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="h-5 w-5 text-button-hover" />
                  <span className="font-semibold text-sm">Aturan Progress LP (Loyalty Point)</span>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {/* Col 1: Basis Progress */}
                  <div className="space-y-1">
                    <Label className="text-xs">Basis Progress</Label>
                    <Select
                      value={data.lp_earn_basis || 'turnover'}
                      onValueChange={(val) => onChange({ lp_earn_basis: val as 'turnover' | 'win' | 'lose' | 'deposit' })}
                    >
                      <SelectTrigger className="bg-muted">
                        <SelectValue placeholder="Pilih..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border z-50">
                        <SelectItem value="turnover">Turnover</SelectItem>
                        <SelectItem value="win">Kemenangan (Win)</SelectItem>
                        <SelectItem value="lose">Net Loss</SelectItem>
                        <SelectItem value="deposit">Deposit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Col 2: Rate Progress */}
                  <div className="space-y-1">
                    <Label className="text-xs">Rate Progress</Label>
                    <FormattedNumberInput
                      value={data.lp_earn_amount || 0}
                      onChange={(val) => onChange({ lp_earn_amount: val })}
                      className="bg-muted"
                      min={1}
                    />
                  </div>
                  {/* Col 3: LP per Rate */}
                  <div className="space-y-1">
                    <Label className="text-xs">LP per Rate</Label>
                    <Input
                      type="number"
                      min={1}
                      value={data.lp_earn_point_amount || ''}
                      onChange={(e) => onChange({ lp_earn_point_amount: parseInt(e.target.value) || 0 })}
                      className="bg-muted"
                    />
                  </div>
                  {/* Col 4: Mode Claim */}
                  <div className="space-y-1">
                    <Label className="text-xs">Mode Claim</Label>
                    <Select
                      value={data.tier_claim_mode || 'otomatis'}
                      onValueChange={(val) => onChange({ tier_claim_mode: val as 'otomatis' | 'manual' })}
                    >
                      <SelectTrigger className="bg-muted">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border z-50">
                        <SelectItem value="otomatis">Otomatis</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Helper text */}
                <p className="text-xs text-muted-foreground">
                  💡 Setiap {formatRupiah(data.lp_earn_amount || 1000)} {data.lp_earn_basis || 'turnover'} → {data.lp_earn_point_amount || 1} LP. 
                  Claim: {data.tier_claim_mode === 'manual' ? 'User harus klik claim' : 'Otomatis masuk saldo'}.
                </p>
              </div>

              {/* Card 2: Tabel Level Reward */}
              <div className="p-4 bg-card border border-border rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-button-hover" />
                    <span className="font-semibold text-sm">Tabel Level Reward</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addTier}
                    className="h-8 px-3 bg-muted text-muted-foreground hover:bg-button-hover hover:text-button-hover-foreground"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Level
                  </Button>
                </div>
                
                {(data.tiers || []).length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Level Name</TableHead>
                        <TableHead>Jenis Hadiah</TableHead>
                        <TableHead>Nilai Hadiah</TableHead>
                        <TableHead className="w-[80px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data.tiers || []).map((tier) => (
                        <TableRow key={tier.id}>
                          <TableCell>
                            <Input
                              value={tier.type || ''}
                              onChange={(e) => updateTier(tier.id, { type: e.target.value })}
                              placeholder="Silver, Gold..."
                              className="bg-muted"
                            />
                          </TableCell>
                          <TableCell>
                            <SelectWithAddNew
                              value={tier.jenis_hadiah || 'credit_game'}
                              onValueChange={(val) => updateTier(tier.id, { jenis_hadiah: val })}
                              options={hadiahTypeOptions}
                              placeholder="Credit Game"
                              onAddOption={(opt) => setHadiahTypeOptions([...hadiahTypeOptions, opt])}
                              onDeleteOption={handleDeleteHadiahType}
                            />
                          </TableCell>
                          <TableCell>
                            <FormattedNumberInput
                              value={typeof tier.reward === 'number' ? tier.reward : 0}
                              onChange={(val) => updateTier(tier.id, { reward: val })}
                              className="bg-muted"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeTier(tier.id)}
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                    Belum ada level. Klik "Add Level" untuk menambahkan.
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground">
                  💡 Reward diberikan saat user mencapai level terkait. Tidak ada rumus tambahan.
                </p>
              </div>
            </>
          )}

          {/* Section 1 - Dasar Perhitungan Bonus - ONLY for tier_point_store (tier_level uses simplified Tabel Level Reward above) */}
          {false && data.tier_archetype !== 'tier_point_store' && (
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="w-full p-4 bg-card border border-border rounded-xl flex items-center justify-between mb-4 hover:bg-card/80 transition-colors group">
                <div className="flex items-center gap-3">
                  <Calculator className="h-5 w-5 text-button-hover" />
                  <div className="text-left">
                    <span className="font-semibold text-sm text-foreground">1. Dasar Perhitungan Bonus</span>
                    <p className="text-xs text-muted-foreground">Konfigurasi reward per level/tier</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Toggle Sub Kategori di kanan */}
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs text-muted-foreground">Sub Kategori</span>
                    <Switch
                      checked={data.has_subcategories || false}
                      onCheckedChange={(checked) => {
                        if (checked && (!data.subcategories || data.subcategories.length === 0)) {
                          onChange({ 
                            has_subcategories: checked,
                            subcategories: [createInitialSubCategory(0)]
                          });
                        } else {
                          onChange({ has_subcategories: checked });
                        }
                      }}
                    />
                  </div>
                  <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-4 mb-6">
                {/* SubCategory Cards - Only show when has_subcategories is true */}
                {data.has_subcategories && (
                  <>
                    <div className="space-y-4">
                      {(data.subcategories || []).map((subCategory, index) => (
                        <SubCategoryCard
                          key={subCategory.id || index}
                          index={index}
                          subCategory={subCategory}
                          globalJenisHadiahEnabled={data.global_jenis_hadiah_enabled}
                          globalMaxBonusEnabled={data.global_max_bonus_enabled}
                          globalPayoutDirectionEnabled={data.global_payout_direction_enabled}
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
                    
                    {/* Tombol Tambah Sub Kategori - Full width */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const currentCount = data.subcategories?.length || 0;
                        const newSubCategory = createInitialSubCategory(currentCount + 1);
                        onChange({ subcategories: [...(data.subcategories || []), newSubCategory] });
                        toast.success("Sub kategori baru ditambahkan");
                      }}
                      className="w-full h-12 border-dashed border-2 border-muted-foreground/30 bg-muted/50 text-muted-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover transition-all"
                    >
                      <Plus className="h-4 w-4" />
                      Tambah Sub Kategori
                    </Button>
                  </>
                )}
                
                {/* Empty state when subcategories disabled */}
                {!data.has_subcategories && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">Aktifkan toggle "Sub Kategori" untuk menambahkan level/tier reward.</p>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}


          {(() => {
            // Tier Archetype field visibility helpers (UI-gating only)
            const tierArchetype = data.tier_archetype || 'tier_level';
            const showLevelFields = tierArchetype === 'tier_level';
            const showPointStoreFields = tierArchetype === 'tier_point_store';
            
            return (
            <>
          {/* Section 2 - Permainan & Provider */}
          <Collapsible>
            <CollapsibleTrigger className="w-full p-4 bg-card border border-border rounded-xl flex items-center justify-between mb-4 hover:bg-card/80 transition-colors group">
              <div className="flex items-center gap-3">
                <Gamepad2 className="h-5 w-5 text-button-hover" />
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">2. Permainan & Provider {data.has_subcategories && <span className="text-xs font-normal text-muted-foreground">(Global)</span>}</div>
                  <div className="text-xs text-muted-foreground">Target game dan provider</div>
                </div>
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mb-6">
              <GameWhitelistBlacklist
                gameTypes={data.game_types || []}
                gameProviders={data.game_providers || []}
                gameNames={data.game_names || []}
                gameTypesBlacklist={data.game_types_blacklist || []}
                gameProvidersBlacklist={data.game_providers_blacklist || []}
                gameNamesBlacklist={data.game_names_blacklist || []}
                gameBlacklistEnabled={data.game_blacklist_enabled ?? false}
                gameExclusionRules={data.game_exclusion_rules || []}
                gameTypeOptions={gameTypeOptions}
                gameProviderOptions={gameProviderOptions}
                gameNameOptions={gameNameOptions}
                gameTypeBlacklistOptions={gameTypeBlacklistOptions}
                gameProviderBlacklistOptions={gameProviderBlacklistOptions}
                gameNameBlacklistOptions={gameNameBlacklistOptions}
                onGameTypesChange={(types) => onChange({ game_types: types })}
                onGameProvidersChange={(providers) => onChange({ game_providers: providers })}
                onGameNamesChange={(names) => onChange({ game_names: names })}
                onGameTypesBlacklistChange={(types) => onChange({ game_types_blacklist: types })}
                onGameProvidersBlacklistChange={(providers) => onChange({ game_providers_blacklist: providers })}
                onGameNamesBlacklistChange={(names) => onChange({ game_names_blacklist: names })}
                onBlacklistEnabledChange={(enabled) => onChange({ game_blacklist_enabled: enabled })}
                onExclusionRulesChange={(rules) => onChange({ game_exclusion_rules: rules })}
                onAddGameTypeOption={(option) => setGameTypeOptions([...gameTypeOptions, option])}
                onDeleteGameTypeOption={handleDeleteGameType}
                onAddGameProviderOption={(option) => setGameProviderOptions([...gameProviderOptions, option])}
                onDeleteGameProviderOption={handleDeleteGameProvider}
                onAddGameNameOption={(option) => setGameNameOptions([...gameNameOptions, option])}
                onDeleteGameNameOption={handleDeleteGameName}
                onAddGameTypeBlacklistOption={(option) => setGameTypeBlacklistOptions([...gameTypeBlacklistOptions, option])}
                onDeleteGameTypeBlacklistOption={handleDeleteGameTypeBlacklist}
                onAddGameProviderBlacklistOption={(option) => setGameProviderBlacklistOptions([...gameProviderBlacklistOptions, option])}
                onDeleteGameProviderBlacklistOption={handleDeleteGameProviderBlacklist}
                onAddGameNameBlacklistOption={(option) => setGameNameBlacklistOptions([...gameNameBlacklistOptions, option])}
                onDeleteGameNameBlacklistOption={handleDeleteGameNameBlacklist}
              />
            </CollapsibleContent>
          </Collapsible>

          {/* Section 3 - Hadiah dan Waktu */}
          <Collapsible>
            <CollapsibleTrigger className="collapsible-trigger w-full group">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-button-hover" />
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">3. Hadiah dan Waktu {data.has_subcategories && <span className="text-xs font-normal text-muted-foreground">(Global)</span>}</div>
                  <div className="text-xs text-muted-foreground">Periode klaim dan distribusi reward</div>
                </div>
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="collapsible-content">
              <div className="space-y-4">
                {/* Row 1: Periode Klaim + Waktu Distribusi */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Periode Klaim</Label>
                    <SelectWithAddNew value={data.claim_frequency} onValueChange={(value) => onChange({ claim_frequency: value })} options={claimFrequencyOptions} onAddOption={(option) => setClaimFrequencyOptions([...claimFrequencyOptions, option])} onDeleteOption={handleDeleteClaimFrequency} placeholder="Pilih periode" />
                  </div>
                  <div className="space-y-2">
                    <Label>Waktu Pembagian Bonus</Label>
                    <SelectWithAddNew value={data.reward_distribution} onValueChange={(value) => onChange({ reward_distribution: value })} options={rewardDistributionOptions} onAddOption={(option) => setRewardDistributionOptions([...rewardDistributionOptions, option])} onDeleteOption={handleDeleteRewardDistribution} placeholder="Pilih waktu pembagian" />
                  </div>
                </div>

                {/* Helper text based on selection */}
                {data.reward_distribution && (
                  <p className="text-xs text-muted-foreground">
                    {REWARD_DISTRIBUTIONS.find(d => d.value === data.reward_distribution)?.helper || ''}
                  </p>
                )}

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
                                { value: '23:00', label: '23:00 WIB' },
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
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Section 4 - Syarat Khusus */}
          <Collapsible>
            <CollapsibleTrigger className="collapsible-trigger w-full group">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-button-hover" />
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">4. Syarat Khusus {data.has_subcategories && <span className="text-xs font-normal text-muted-foreground">(Global)</span>}</div>
                  <div className="text-xs text-muted-foreground">Ketentuan tambahan untuk promo</div>
                </div>
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="collapsible-content">
              <div className="space-y-3">
                <Label>Syarat & Ketentuan Tambahan</Label>
                {(data.special_requirements || []).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {(data.special_requirements || []).map((req, index) => (
                      <Badge key={index} variant="secondary" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted text-foreground border border-border rounded-full">
                        <span>{req}</span>
                        <button type="button" onClick={() => { const updated = (data.special_requirements || []).filter((_, i) => i !== index); onChange({ special_requirements: updated }); }} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <Input placeholder="Tambah syarat (pisahkan dengan koma)..." value={newRequirement} onChange={(e) => setNewRequirement(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddRequirement(); } }} className="pr-10" />
                  <button type="button" onClick={handleAddRequirement} disabled={!newRequirement.trim()} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-button-hover disabled:opacity-50"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Section 5 - Manual Claim & Contact Official */}
          <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl">
            <Switch checked={data.contact_channel_enabled || false} onCheckedChange={(checked) => onChange({ contact_channel_enabled: checked })} />
            <div className="flex-1">
              <div className="font-medium text-sm text-button-hover flex items-center gap-2">
                <Phone className="h-4 w-4" />
                5. Manual Claim & Contact Official {data.has_subcategories && <span className="text-xs font-normal text-muted-foreground">(Global)</span>}
              </div>
              <p className="text-xs text-muted-foreground">Info kontak untuk klaim bonus via CS</p>
            </div>
          </div>

          {data.contact_channel_enabled && (
            <div className="p-4 bg-muted rounded-lg space-y-4">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <SelectWithAddNew value={data.contact_channel || ''} onValueChange={(value) => onChange({ contact_channel: value })} options={[{ value: 'whatsapp', label: 'WhatsApp' }, { value: 'telegram', label: 'Telegram' }, { value: 'livechat', label: 'Live Chat' }, { value: 'email', label: 'Email' }]} placeholder="Pilih channel" />
                </div>
                {data.contact_channel !== 'livechat' && (
                  <div className="space-y-2">
                    <Label>Link / Nomor</Label>
                    <Input value={data.contact_link || ''} onChange={(e) => onChange({ contact_link: e.target.value })} placeholder="Masukkan link/nomor" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Toggle - Wajib Download APK (Selalu di paling bawah) */}
          <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl">
            <Switch checked={data.require_apk || false} onCheckedChange={(checked) => onChange({ require_apk: checked })} />
            <div className="flex-1">
              <div className="font-medium text-sm text-button-hover flex items-center gap-2">
                <Download className="h-4 w-4" />
                Wajib Download APK {data.has_subcategories && <span className="text-xs font-normal text-muted-foreground">(Global)</span>}
              </div>
              <p className="text-xs text-muted-foreground">User wajib download APK terlebih dahulu untuk claim reward</p>
            </div>
          </div>
            </>
            );
          })()}
        </>
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
