import { PromoFormData, GAME_RESTRICTIONS, GAME_PROVIDERS, GAME_NAMES, CONTACT_CHANNELS, GEO_RESTRICTIONS, PLATFORM_ACCESS, CALCULATION_BASES, CALCULATION_METHODS, CLAIM_FREQUENCIES, REWARD_DISTRIBUTIONS, DINAMIS_REWARD_TYPES, REWARD_TYPES, PROMO_RISK_LEVELS, buildPKBPayload } from "./types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, ChevronDown, Edit2, FileText, Copy, ClipboardCheck, Sparkles, XCircle } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

// Helper: format number with thousand separator
export const formatNumber = (num: number): string => {
  return num.toLocaleString('id-ID');
};

// Helper: generate GLOBAL terms (applies to all subcategories)
export const generateGlobalTerms = (data: PromoFormData): string[] => {
  const terms: string[] = [];
  
  // Claim frequency
  if (data.claim_frequency === 'mingguan') {
    terms.push(`Bonus diberikan berdasarkan perhitungan mingguan.`);
    terms.push(`Periode dihitung dari hari Senin (00:00 GMT+7) hingga hari Minggu (23:59 GMT+7).`);
  } else if (data.claim_frequency === 'harian') {
    terms.push(`Bonus diberikan berdasarkan perhitungan harian.`);
  } else if (data.claim_frequency) {
    terms.push(`Frekuensi klaim: ${data.claim_frequency}.`);
  }
  
  // Distribution time (untuk Hari Tertentu)
  if (data.reward_distribution === 'hari_tertentu' && data.distribution_day) {
    const dayLabel = data.distribution_day === 'setiap_hari' ? 'setiap hari' : `setiap hari ${data.distribution_day}`;
    
    if (data.distribution_time_from && data.distribution_time_until) {
      terms.push(`Bonus akan dibagikan ${dayLabel}, mulai pukul ${data.distribution_time_from} - ${data.distribution_time_until} WIB.`);
    } else if (data.distribution_time_from) {
      terms.push(`Bonus akan dibagikan ${dayLabel}, pukul ${data.distribution_time_from} WIB.`);
    }
  }
  
  // Platform
  if (data.require_apk) {
    terms.push(`Wajib download APK terlebih dahulu untuk claim reward ini.`);
  }
  
  // Period
  if (data.valid_from || data.valid_until) {
    const from = data.valid_from ? `dari ${data.valid_from}` : '';
    const until = data.valid_until ? `hingga ${data.valid_until}` : '';
    terms.push(`Periode promo berlaku ${from} ${until}.`.replace('  ', ' ').trim());
  }
  
  // Geo restriction
  if (data.geo_restriction && data.geo_restriction !== 'semua') {
    const geoLabel = GEO_RESTRICTIONS.find(g => g.value === data.geo_restriction)?.label || data.geo_restriction;
    terms.push(`Promo hanya berlaku untuk wilayah: ${geoLabel}.`);
  }
  
  // Platform access
  if (data.platform_access && data.platform_access !== 'semua') {
    const platformLabel = PLATFORM_ACCESS.find(p => p.value === data.platform_access)?.label || data.platform_access;
    terms.push(`Promo dapat diakses melalui: ${platformLabel}.`);
  }
  
  // Contact channel
  if (data.contact_channel_enabled && data.contact_channel) {
    const channelLabel = CONTACT_CHANNELS.find(c => c.value === data.contact_channel)?.label || data.contact_channel;
    
    if (data.contact_channel === 'livechat') {
      terms.push(`Untuk informasi lebih lanjut, silakan hubungi melalui Live Chat.`);
    } else if (data.contact_link) {
      terms.push(`Untuk informasi lebih lanjut, hubungi ${channelLabel} Official: ${data.contact_link}`);
    } else {
      terms.push(`Untuk informasi lebih lanjut, hubungi ${channelLabel} Official.`);
    }
  }
  
  // Default terms
  terms.push(`Bonus dapat dibatalkan jika terdapat indikasi kecurangan dari player.`);
  terms.push(`Syarat & ketentuan bonus dapat berubah sewaktu-waktu tanpa pemberitahuan, dan seluruh keputusan bersifat mutlak tidak dapat diganggu gugat.`);
  
  return terms;
};

// Helper: generate terms for a specific SUBCATEGORY
export const generateSubcategoryTerms = (sub: any, data: PromoFormData): string[] => {
  const terms: string[] = [];
  
  // Game restriction
  const gameType = sub.game_types?.length > 0 
    ? sub.game_types.map((t: string) => GAME_RESTRICTIONS.find(g => g.value === t)?.label || t).join(', ')
    : 'Semua permainan';
  const provider = sub.game_providers?.length > 0 
    ? sub.game_providers.map((p: string) => GAME_PROVIDERS.find(g => g.value === p)?.label || p).join(', ')
    : null;
  const gameName = sub.game_names?.length > 0
    ? sub.game_names.map((n: string) => GAME_NAMES.find(g => g.value === n)?.label || n).join(', ')
    : null;
  
  let gameDesc = `Bonus berlaku untuk ${gameType}`;
  if (provider) gameDesc += ` (Provider: ${provider})`;
  if (gameName) gameDesc += ` - Game: ${gameName}`;
  terms.push(`${gameDesc}.`);
  
  // Bonus percentage
  if (sub.calculation_value) {
    const baseLabel = CALCULATION_BASES.find(b => b.value === sub.calculation_base)?.label || sub.calculation_base || 'Turnover';
    terms.push(`Bonus ${sub.calculation_value}% dari ${baseLabel}.`);
  }
  
  // Minimum requirement
  if (sub.minimum_base && sub.minimum_base > 0) {
    const baseLabel = CALCULATION_BASES.find(b => b.value === sub.calculation_base)?.label || sub.calculation_base || 'syarat';
    terms.push(`Minimal ${baseLabel} untuk mendapatkan bonus ini adalah Rp ${formatNumber(sub.minimum_base)}.`);
  }
  
  // Max claim
  if (sub.dinamis_max_claim_unlimited) {
    terms.push(`Tidak ada batas maksimum untuk pembagian bonus ini.`);
  } else if (sub.dinamis_max_claim && sub.dinamis_max_claim > 0) {
    terms.push(`Maksimum bonus yang bisa didapat adalah Rp ${formatNumber(sub.dinamis_max_claim)}.`);
  } else if (sub.max_bonus && sub.max_bonus > 0) {
    terms.push(`Maksimum bonus yang bisa didapat adalah Rp ${formatNumber(sub.max_bonus)}.`);
  }
  
  // Blacklist info
  if (sub.game_blacklist_enabled) {
    // Filter out "tidak_ada" values before processing
    const filteredGameBlacklist = sub.game_types_blacklist?.filter((t: string) => t !== 'tidak_ada') || [];
    const filteredProviderBlacklist = sub.game_providers_blacklist?.filter((p: string) => p !== 'tidak_ada') || [];
    const filteredNameBlacklist = sub.game_names_blacklist?.filter((n: string) => n !== 'tidak_ada') || [];
    
    const blacklistGame = filteredGameBlacklist.length > 0
      ? filteredGameBlacklist.map((t: string) => GAME_RESTRICTIONS.find(g => g.value === t)?.label || t).join(', ')
      : null;
    const blacklistProvider = filteredProviderBlacklist.length > 0
      ? filteredProviderBlacklist.map((p: string) => GAME_PROVIDERS.find(g => g.value === p)?.label || p).join(', ')
      : null;
    const blacklistName = filteredNameBlacklist.length > 0
      ? filteredNameBlacklist.map((n: string) => GAME_NAMES.find(g => g.value === n)?.label || n).join(', ')
      : null;
    
    let blacklistDesc = 'Tidak berlaku untuk';
    const blacklists = [];
    if (blacklistGame) blacklists.push(blacklistGame);
    if (blacklistProvider) blacklists.push(`Provider: ${blacklistProvider}`);
    if (blacklistName) blacklists.push(`Game: ${blacklistName}`);
    if (blacklists.length > 0) {
      terms.push(`${blacklistDesc} ${blacklists.join(', ')}.`);
    }
    
    if (sub.game_exclusion_rules && sub.game_exclusion_rules.length > 0) {
      const exclusionRules = Array.isArray(sub.game_exclusion_rules) 
        ? sub.game_exclusion_rules.join('; ')
        : sub.game_exclusion_rules;
      terms.push(`Pengecualian khusus: ${exclusionRules}.`);
    }
  }
  
  // Turnover rule
  if (data.turnover_rule_enabled && data.turnover_rule) {
    terms.push(`Syarat turnover: ${data.turnover_rule}.`);
  }
  
  return terms;
};

// Helper: generate terms for SINGLE promo mode (non-combo)
export const generateSinglePromoTerms = (data: PromoFormData): string[] => {
  const terms: string[] = [];
  
  // Game restriction - humanize label (single promo mode)
  if (data.game_restriction && data.game_restriction !== 'semua') {
    const gameLabel = GAME_RESTRICTIONS.find(g => g.value === data.game_restriction)?.label || data.game_restriction;
    terms.push(`Bonus ini hanya berlaku untuk player yang bertaruh di permainan ${gameLabel}.`);
  } else {
    terms.push(`Bonus ini berlaku untuk semua jenis permainan.`);
  }
  
  // Minimum requirement
  if (data.minimum_base_enabled && data.minimum_base && data.minimum_base > 0) {
    const baseLabel = CALCULATION_BASES.find(b => b.value === data.calculation_base)?.label || data.calculation_base || 'syarat';
    terms.push(`Minimal ${baseLabel} untuk mendapatkan bonus ini adalah Rp ${formatNumber(data.minimum_base)}.`);
  }
  
  // Minimum claim
  if (data.dinamis_min_claim && data.dinamis_min_claim > 0) {
    terms.push(`Minimal bonus yang bisa dicairkan adalah Rp ${formatNumber(data.dinamis_min_claim)}.`);
  }
  
  // Max claim
  if (data.dinamis_max_claim_unlimited) {
    terms.push(`Tidak ada batas maksimum untuk pembagian bonus ini.`);
  } else if (data.dinamis_max_claim && data.dinamis_max_claim > 0) {
    terms.push(`Maksimum bonus yang bisa didapat adalah Rp ${formatNumber(data.dinamis_max_claim)}.`);
  }
  
  // Turnover rule (only for deposit-based promos)
  if (data.turnover_rule && !['turnover', 'win_loss', 'bet_amount'].includes(data.calculation_base?.toLowerCase() || '')) {
    terms.push(`Syarat turnover: ${data.turnover_rule}.`);
  }
  
  return terms;
};

// Legacy helper for backward compatibility
export const generateTermsList = (data: PromoFormData): string[] => {
  if (data.has_subcategories && data.subcategories && data.subcategories.length > 0) {
    // For combo promo, return combined terms (legacy behavior)
    const allTerms: string[] = [];
    allTerms.push(`Promo ini memiliki ${data.subcategories.length} varian bonus.`);
    data.subcategories.forEach((sub, idx) => {
      const subTerms = generateSubcategoryTerms(sub, data);
      subTerms.forEach(t => allTerms.push(t));
    });
    generateGlobalTerms(data).forEach(t => allTerms.push(t));
    return allTerms;
  } else {
    // Single promo mode
    return [...generateSinglePromoTerms(data), ...generateGlobalTerms(data)];
  }
};

// ============= ScoreRing Component =============
interface ScoreRingProps {
  score: number;
  hasCriticalErrors: boolean;
}

const ScoreRing = ({ score, hasCriticalErrors }: ScoreRingProps) => {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  
  const getScoreColor = () => {
    if (hasCriticalErrors) return "hsl(var(--destructive))";
    if (score >= 90) return "hsl(var(--success))";
    if (score >= 70) return "hsl(var(--warning))";
    return "hsl(var(--destructive))";
  };

  return (
    <div className="relative w-28 h-28 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="8"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={getScoreColor()}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-foreground">{score}</span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
    </div>
  );
};

// ============= BlockCard Component =============
interface BlockCardProps {
  blockKey: string;
  label: string;
  percentage: number;
  complete: boolean;
  onClick?: () => void;
}

const BlockCard = ({ blockKey, label, percentage, complete, onClick }: BlockCardProps) => {
  const getProgressColor = () => {
    if (complete) return "bg-success";
    if (percentage >= 70) return "bg-yellow-500";
    return "bg-destructive";
  };

  return (
    <div
      onClick={onClick}
      className="bg-muted rounded-lg p-3 cursor-pointer transition-colors hover:bg-muted/80"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {complete ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <AlertCircle className="h-4 w-4 text-amber-500" />
        )}
      </div>
      <div className="h-1.5 bg-background rounded-full overflow-hidden">
        <div 
          className={cn("h-full transition-all duration-500", getProgressColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1">{percentage}%</p>
    </div>
  );
};

// ============= PromoReadinessCard Component =============
interface PromoReadinessCardProps {
  data: PromoFormData;
  onGoToStep?: (step: number) => void;
}

const PromoReadinessCard = ({ data, onGoToStep }: PromoReadinessCardProps) => {
  // Calculate completion for each step
  const stepCompletion = useMemo(() => {
    // Step 1: Identitas Promo
    const step1Fields = [
      !!data.client_id,
      !!data.promo_name,
      !!data.promo_type
    ];
    const step1Percentage = Math.round((step1Fields.filter(Boolean).length / step1Fields.length) * 100);
    
    // Step 2: Batasan & Akses
    const step2Fields = [
      !!data.platform_access,
      !!data.status
    ];
    const step2Percentage = Math.round((step2Fields.filter(Boolean).length / step2Fields.length) * 100);
    
    // Step 3: Konfigurasi Reward
    let step3Fields: boolean[] = [];
    if (data.reward_mode === 'fixed') {
      step3Fields = [
        !!data.reward_mode,
        !!data.reward_type,
        data.reward_amount > 0
      ];
    } else if (data.reward_mode === 'formula') {
      step3Fields = [
        !!data.reward_mode,
        !!data.calculation_base,
        !!data.calculation_method,
        data.calculation_value > 0,
        !!data.dinamis_reward_type
      ];
    } else if (data.reward_mode === 'tier') {
      step3Fields = [
        !!data.reward_mode,
        !!data.promo_unit
      ];
    } else {
      step3Fields = [!!data.reward_mode];
    }
    const step3Percentage = step3Fields.length > 0 
      ? Math.round((step3Fields.filter(Boolean).length / step3Fields.length) * 100)
      : 0;

    return {
      step1: { percentage: step1Percentage, complete: step1Percentage === 100 },
      step2: { percentage: step2Percentage, complete: step2Percentage === 100 },
      step3: { percentage: step3Percentage, complete: step3Percentage === 100 }
    };
  }, [data]);

  const overallScore = useMemo(() => {
    return Math.round(
      (stepCompletion.step1.percentage + stepCompletion.step2.percentage + stepCompletion.step3.percentage) / 3
    );
  }, [stepCompletion]);

  const hasCriticalErrors = !stepCompletion.step1.complete || !stepCompletion.step2.complete || !stepCompletion.step3.complete;

  const isAllComplete = stepCompletion.step1.complete && stepCompletion.step2.complete && stepCompletion.step3.complete;

  return (
    <div className="rounded-xl bg-card border border-border p-6 mb-6">
      {/* Header with Status Badge */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="icon-circle">
            <Sparkles className="icon-circle-icon" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Promo Readiness</h3>
            <p className="text-sm text-muted-foreground">
              Kelengkapan konfigurasi promo sebelum publish
            </p>
          </div>
        </div>
        
        {/* Status Badge - Top Right */}
        <Badge 
          variant="outline"
          className={cn(
            "px-4 py-1.5 text-sm font-medium rounded-full flex items-center gap-2",
            isAllComplete 
              ? "bg-transparent border-2 border-success text-success" 
              : "bg-destructive/10 border-destructive/30 text-destructive"
          )}
        >
          {isAllComplete ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          {isAllComplete ? "Siap Publish" : "Belum Lengkap"}
        </Badge>
      </div>

      {/* Score Ring - Left aligned */}
      <div className="flex items-center gap-6 mb-6">
        <ScoreRing score={overallScore} hasCriticalErrors={hasCriticalErrors} />
        <div className="flex-1" />
      </div>

      {/* Block Completion Label */}
      <p className="text-sm font-medium text-foreground mb-3">Block Completion</p>

      {/* Block Completion Grid - Bottom */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <BlockCard
          blockKey="step1"
          label="Identitas Promo"
          percentage={stepCompletion.step1.percentage}
          complete={stepCompletion.step1.complete}
          onClick={() => onGoToStep?.(1)}
        />
        <BlockCard
          blockKey="step2"
          label="Batasan & Akses"
          percentage={stepCompletion.step2.percentage}
          complete={stepCompletion.step2.complete}
          onClick={() => onGoToStep?.(2)}
        />
        <BlockCard
          blockKey="step3"
          label="Konfigurasi Reward"
          percentage={stepCompletion.step3.percentage}
          complete={stepCompletion.step3.complete}
          onClick={() => onGoToStep?.(3)}
        />
      </div>
    </div>
  );
};

interface Step4Props {
  data: PromoFormData;
  onGoToStep?: (step: number) => void;
}

interface ValueBoxProps {
  label: string;
  value: string | number | undefined;
  isBadge?: boolean;
  badgeVariant?: "default" | "secondary" | "outline";
}

const ValueBox = ({ label, value, isBadge, badgeVariant = "outline" }: ValueBoxProps) => (
  <div className="space-y-2">
    <p className="text-sm font-medium text-foreground">{label}</p>
    {isBadge ? (
      <Badge 
        variant={badgeVariant} 
        className={cn(
          "text-sm px-4 py-2",
          badgeVariant === 'default' && "bg-success/20 text-success border-success/30"
        )}
      >
        {value ? String(value).charAt(0).toUpperCase() + String(value).slice(1) : '-'}
      </Badge>
    ) : (
      <div className="bg-background rounded-lg min-h-10 px-4 py-2 text-sm text-foreground flex items-center border border-border">
        <span>{value || 'Belum diisi'}</span>
      </div>
    )}
  </div>
);

interface CollapsibleSectionProps {
  title: string;
  complete: boolean;
  stepNumber: number;
  onEdit?: (step: number) => void;
  children: React.ReactNode;
}

const CollapsibleSection = ({ 
  title, 
  complete, 
  stepNumber,
  onEdit,
  children 
}: CollapsibleSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-xl overflow-hidden bg-card border border-border">
        <div className="flex items-center justify-between p-6 hover:bg-muted transition-colors">
          <CollapsibleTrigger className="flex items-center gap-3 flex-1">
            <span className="font-semibold text-foreground">{title}</span>
            <Badge 
              variant="outline"
              className={cn(
                complete 
                  ? "bg-success/10 text-success border-success/30" 
                  : "bg-amber-500/10 text-amber-500 border-amber-500/30"
              )}
            >
              {complete ? (
                <><CheckCircle2 className="h-3 w-3 mr-1" /> Lengkap</>
              ) : (
                <><AlertCircle className="h-3 w-3 mr-1" /> Belum Lengkap</>
              )}
            </Badge>
          </CollapsibleTrigger>
          <div className="flex items-center gap-3">
            {onEdit && (
              <Button 
                variant="outline" 
                onClick={() => onEdit(stepNumber)}
                className="gap-2 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
              >
                <Edit2 className="h-4 w-4" />
                Edit
              </Button>
            )}
            <CollapsibleTrigger>
              <ChevronDown className={cn(
                "h-5 w-5 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180"
              )} />
            </CollapsibleTrigger>
          </div>
        </div>
        
        <CollapsibleContent>
          <div className="p-6 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {children}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export function Step4Review({ data, onGoToStep }: Step4Props) {
  const [jsonOpen, setJsonOpen] = useState(false);
  const { toast } = useToast();
  
  // Build PKB payload for JSON preview (clean, canonical format)
  const pkbPayload = buildPKBPayload(data);

  const isStep1Complete = data.client_id && data.promo_name && data.promo_type;
  const isStep2Complete = data.reward_mode && (
    (data.reward_mode === 'fixed' && data.reward_type && data.reward_amount > 0) ||
    (data.reward_mode === 'tier' && data.promo_unit) ||
    (data.reward_mode === 'formula' && 
      data.calculation_base && 
      data.calculation_method && 
      data.calculation_value && data.calculation_value > 0 &&
      data.dinamis_reward_type)
  );
  const isStep3Complete = data.platform_access && data.status;

  const terms = generateTermsList(data);

  const handleCopyTerms = () => {
    const header = data.promo_name?.toUpperCase() || 'NAMA PROMO';
    
    let text = `${header}\n`;
    
    // Add calculation example for formula (dinamis) mode
    if (data.reward_mode === 'formula' && data.calculation_value) {
      text += `\nContoh Perhitungan:\n`;
      text += `Total ${data.calculation_base || 'Turnover'} x ${data.calculation_value}% = Nilai Bonus\n`;
      text += `-----------------------------------------------\n`;
      const exampleBase = data.minimum_base && data.minimum_base > 0 ? data.minimum_base : 5000000;
      const exampleReward = exampleBase * (data.calculation_value / 100);
      text += `${formatNumber(exampleBase)} x ${data.calculation_value}% = ${formatNumber(exampleReward)} (Bonus yang didapat)\n`;
    }
    
    text += `\nSyarat & Ketentuan:\n`;
    text += terms.map((t, i) => `${i + 1}. ${t}`).join('\n');
    
    navigator.clipboard.writeText(text);
    toast({ 
      title: "Berhasil disalin!", 
      description: "Syarat & Ketentuan telah disalin ke clipboard" 
    });
  };

  return (
    <Card className="form-card">
      {/* Header */}
      <div className="form-card-header">
        <div className="icon-circle">
          <CheckCircle2 className="icon-circle-icon" />
        </div>
        <div className="flex-1">
          <h3 className="form-card-title">Step 4 — Review & Simpan</h3>
          <p className="form-card-description">
            Periksa kembali semua konfigurasi sebelum menyimpan
          </p>
        </div>
        <Badge variant="golden">Wajib</Badge>
      </div>

      {/* Content */}
      <div className="form-section">
        {/* Promo Readiness Card - NEW */}
        <PromoReadinessCard data={data} onGoToStep={onGoToStep} />

        {/* 3-Column Grid Layout */}
        <div className="grid gap-6">
          {/* Step 1 Summary */}
          <CollapsibleSection 
            title="Identitas Promo" 
            complete={!!isStep1Complete}
            stepNumber={1}
            onEdit={onGoToStep}
          >
            <ValueBox label="Website" value={data.client_id} />
            <ValueBox label="Nama Promo" value={data.promo_name} />
            <ValueBox label="Tipe" value={data.promo_type} />
            <ValueBox label="Tujuan" value={data.intent_category} />
            <ValueBox label="Target" value={data.target_segment} />
            <ValueBox label="Trigger" value={data.trigger_event} />
          </CollapsibleSection>

          {/* Step 2 Summary - Batasan & Akses */}
          <CollapsibleSection 
            title="Batasan & Akses" 
            complete={!!isStep3Complete}
            stepNumber={2}
            onEdit={onGoToStep}
          >
            <ValueBox label="Platform" value={PLATFORM_ACCESS.find(p => p.value === data.platform_access)?.label || data.platform_access} />
            <ValueBox 
              label="Status" 
              value={data.status} 
              isBadge 
              badgeVariant={data.status === 'active' ? 'default' : 'secondary'} 
            />
            <ValueBox label="Wilayah" value={GEO_RESTRICTIONS.find(g => g.value === data.geo_restriction)?.label || data.geo_restriction} />
            <ValueBox label="Mulai" value={data.valid_from} />
            <ValueBox label="Berakhir" value={data.valid_until} />
            <ValueBox label="Wajib APK" value={data.require_apk ? 'Ya' : 'Tidak'} />
            {data.promo_risk_level && (
              <ValueBox 
                label="Tingkat Risiko" 
                value={PROMO_RISK_LEVELS.find(r => r.value === data.promo_risk_level)?.label || data.promo_risk_level} 
              />
            )}
          </CollapsibleSection>

          {/* Step 3 Summary - Konfigurasi Reward */}
          <CollapsibleSection 
            title="Konfigurasi Reward" 
            complete={!!isStep2Complete}
            stepNumber={3}
            onEdit={onGoToStep}
          >
            <ValueBox label="Mode" value={data.reward_mode === 'formula' ? 'Dinamis' : data.reward_mode} isBadge badgeVariant="outline" />
            
            {/* COMBO PROMO MODE - Tampilkan info redirect saja */}
            {data.has_subcategories && data.subcategories && data.subcategories.length > 0 ? (
              <div className="col-span-full bg-muted/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-foreground">
                  <span>📦</span>
                  <span className="font-medium">
                    Mode Combo Promo aktif ({data.subcategories.length} varian)
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Detail konfigurasi bonus masing-masing varian dapat dilihat di section "Sub Kategori Promo" di bawah.
                </p>
              </div>
            ) : (
              /* SINGLE PROMO MODE - Tampilkan detail lengkap */
              <>
                {data.reward_mode === 'fixed' && (
                  <>
                    <ValueBox label="Jenis Bonus" value={REWARD_TYPES.find(r => r.value === data.reward_type)?.label || data.reward_type} />
                    <ValueBox label="Nilai Bonus" value={data.reward_amount ? `Rp ${data.reward_amount.toLocaleString('id-ID')}` : undefined} />
                    <ValueBox label={`Minimal Perhitungan ${CALCULATION_BASES.find(b => b.value === data.calculation_base)?.label || ''}`} value={data.min_requirement ? `Rp ${data.min_requirement.toLocaleString('id-ID')}` : undefined} />
                    <ValueBox label="Batas Maksimal Bonus" value={data.max_claim ? `Rp ${data.max_claim.toLocaleString('id-ID')}` : undefined} />
                    <ValueBox label="Periode Klaim" value={CLAIM_FREQUENCIES.find(c => c.value === data.claim_frequency)?.label || data.claim_frequency} />
                  </>
                )}
                {data.reward_mode === 'formula' && (
                  <>
                    {/* Permainan & Provider - Display as badges */}
                    <div className="col-span-full">
                      <p className="text-muted-foreground text-xs mb-2">Jenis Game</p>
                      <div className="flex flex-wrap gap-2">
                        {data.game_types?.length > 0 ? data.game_types.map((type, idx) => (
                          <span key={idx} className="px-3 py-1 bg-button-hover/20 rounded-full text-sm text-button-hover border border-button-hover/40">
                            {GAME_RESTRICTIONS.find(g => g.value === type)?.label || type}
                          </span>
                        )) : <span className="text-muted-foreground text-sm">Semua</span>}
                      </div>
                    </div>
                    <div className="col-span-full">
                      <p className="text-muted-foreground text-xs mb-2">Provider Game</p>
                      <div className="flex flex-wrap gap-2">
                        {data.game_providers?.length > 0 ? data.game_providers.map((provider, idx) => (
                          <span key={idx} className="px-3 py-1 bg-button-hover/20 rounded-full text-sm text-button-hover border border-button-hover/40">
                            {GAME_PROVIDERS.find(p => p.value === provider)?.label || provider}
                          </span>
                        )) : <span className="text-muted-foreground text-sm">Semua</span>}
                      </div>
                    </div>
                    <div className="col-span-full">
                      <p className="text-muted-foreground text-xs mb-2">Nama Game</p>
                      <div className="flex flex-wrap gap-2">
                        {data.game_names?.length > 0 ? data.game_names.map((name, idx) => (
                          <span key={idx} className="px-3 py-1 bg-button-hover/20 rounded-full text-sm text-button-hover border border-button-hover/40">
                            {GAME_NAMES.find(n => n.value === name)?.label || name}
                          </span>
                        )) : <span className="text-muted-foreground text-sm">Semua</span>}
                      </div>
                    </div>
                    
                    {/* Game Blacklist */}
                    <ValueBox 
                      label="Blacklist Game" 
                      value={data.game_blacklist_enabled ? 'Aktif' : 'Tidak aktif'} 
                    />
                    {data.game_blacklist_enabled && (
                      <>
                        <div className="col-span-full">
                          <p className="text-muted-foreground text-xs mb-2">Jenis Game Dilarang</p>
                          <div className="flex flex-wrap gap-2">
                            {data.game_types_blacklist?.length > 0 ? data.game_types_blacklist.map((type, idx) => (
                              <span key={idx} className="px-3 py-1 bg-destructive/20 rounded-full text-sm text-destructive border border-destructive/40">
                                {GAME_RESTRICTIONS.find(g => g.value === type)?.label || type}
                              </span>
                            )) : <span className="text-muted-foreground text-sm">-</span>}
                          </div>
                        </div>
                        <div className="col-span-full">
                          <p className="text-muted-foreground text-xs mb-2">Provider Dilarang</p>
                          <div className="flex flex-wrap gap-2">
                            {data.game_providers_blacklist?.length > 0 ? data.game_providers_blacklist.map((provider, idx) => (
                              <span key={idx} className="px-3 py-1 bg-destructive/20 rounded-full text-sm text-destructive border border-destructive/40">
                                {GAME_PROVIDERS.find(p => p.value === provider)?.label || provider}
                              </span>
                            )) : <span className="text-muted-foreground text-sm">-</span>}
                          </div>
                        </div>
                        <div className="col-span-full">
                          <p className="text-muted-foreground text-xs mb-2">Nama Game Dilarang</p>
                          <div className="flex flex-wrap gap-2">
                            {data.game_names_blacklist?.length > 0 ? data.game_names_blacklist.map((name, idx) => (
                              <span key={idx} className="px-3 py-1 bg-destructive/20 rounded-full text-sm text-destructive border border-destructive/40">
                                {GAME_NAMES.find(n => n.value === name)?.label || name}
                              </span>
                            )) : <span className="text-muted-foreground text-sm">-</span>}
                          </div>
                        </div>
                        {data.game_exclusion_rules && data.game_exclusion_rules.length > 0 && (
                          <div className="col-span-full">
                            <p className="text-muted-foreground text-xs mb-2">Aturan Pengecualian Khusus</p>
                            <div className="flex flex-wrap gap-2">
                              {data.game_exclusion_rules.map((rule, idx) => (
                                <span key={idx} className="px-3 py-1 bg-muted rounded-full text-sm text-foreground">{rule}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    
                    {/* Reward Config */}
                    <ValueBox label="Dasar Perhitungan Bonus" value={CALCULATION_BASES.find(b => b.value === data.calculation_base)?.label || data.calculation_base} />
                    <ValueBox label="Jenis Perhitungan" value={CALCULATION_METHODS.find(c => c.value === data.calculation_method)?.label || data.calculation_method} />
                    <ValueBox label="Nilai Bonus" value={data.calculation_value ? `${data.calculation_value}${data.calculation_method === 'percentage' ? '%' : ''}` : undefined} />
                    <ValueBox label="Jenis Bonus" value={DINAMIS_REWARD_TYPES.find(r => r.value === data.dinamis_reward_type)?.label || data.dinamis_reward_type} />
                    <ValueBox label="Batas Maksimal Bonus" value={data.dinamis_max_claim_unlimited ? 'Unlimited' : (data.dinamis_max_claim ? `Rp ${data.dinamis_max_claim.toLocaleString('id-ID')}` : undefined)} />
                    <ValueBox label={`Minimal Perhitungan ${CALCULATION_BASES.find(b => b.value === data.calculation_base)?.label || ''}`} value={data.minimum_base_enabled ? (data.minimum_base ? `Rp ${data.minimum_base.toLocaleString('id-ID')}` : undefined) : 'Tidak ada batas minimal'} />
                    <ValueBox label="Periode Klaim" value={CLAIM_FREQUENCIES.find(c => c.value === data.claim_frequency)?.label || data.claim_frequency} />
                    <ValueBox label="Waktu Pembagian Bonus" value={REWARD_DISTRIBUTIONS.find(r => r.value === data.reward_distribution)?.label || data.reward_distribution} />
                    {/* Syarat Main Sebelum WD */}
                    <ValueBox 
                      label="Syarat Main Sebelum WD" 
                      value={data.turnover_rule_enabled ? data.turnover_rule : 'Tidak aktif'} 
                    />
                  </>
                )}
                {data.reward_mode === 'tier' && (
                  <>
                    <ValueBox label="Satuan Poin" value={data.promo_unit} />
                    <ValueBox label="Mode EXP" value={data.exp_mode} />
                    <ValueBox label="Formula LP" value={data.lp_formula} />
                    <ValueBox label="Jumlah Tier" value={`${data.tiers.length} tier`} />
                  </>
                )}
                {data.vip_multiplier.enabled && (
                  <ValueBox 
                    label="VIP Multiplier" 
                    value={data.vip_multiplier.tiers.map(t => `${t.name} ${t.bonus_percent}%`).join(', ')} 
                  />
                )}
              </>
            )}
          </CollapsibleSection>

          {/* Sub Kategori Section - Combo Promo */}
          {data.has_subcategories && data.subcategories && data.subcategories.length > 0 && (
            <div className="rounded-xl overflow-hidden bg-card border border-border">
              <div className="flex items-center justify-between p-6">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-foreground">Sub Kategori Promo ({data.subcategories.length})</span>
                  <Badge variant="outline" className="bg-button-hover/10 text-button-hover border-button-hover/30">
                    Combo Promo
                  </Badge>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => onGoToStep?.(3)}
                  className="gap-2 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit
                </Button>
              </div>
              
              <div className="px-6 pb-6 space-y-4">
                {data.subcategories.map((sub, idx) => (
                  <div key={sub.id || idx} className="bg-muted rounded-lg p-4 space-y-3">
                    {/* Subcategory Header */}
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">
                        {sub.name || `Sub Kategori ${idx + 1}`}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        Varian {idx + 1}
                      </Badge>
                    </div>
                    
                    {/* Subcategory Details Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      {/* Dasar Perhitungan */}
                      <div>
                        <p className="text-muted-foreground text-xs">Dasar</p>
                        <p className="text-foreground">{CALCULATION_BASES.find(b => b.value === sub.calculation_base)?.label || sub.calculation_base || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Metode</p>
                        <p className="text-foreground">{CALCULATION_METHODS.find(m => m.value === sub.calculation_method)?.label || sub.calculation_method || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Nilai</p>
                        <p className="text-button-hover font-medium">{sub.calculation_value ? `${sub.calculation_value}%` : '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Min Base</p>
                        <p className="text-foreground">{sub.minimum_base ? `Rp ${formatNumber(sub.minimum_base)}` : '-'}</p>
                      </div>
                      
                      {/* Permainan */}
                      <div>
                        <p className="text-muted-foreground text-xs">Jenis Game</p>
                        <p className="text-foreground">{sub.game_types?.length > 0 ? sub.game_types.map(t => GAME_RESTRICTIONS.find(g => g.value === t)?.label || t).join(', ') : 'Semua'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Provider</p>
                        <p className="text-foreground">{sub.game_providers?.length > 0 ? sub.game_providers.map(p => GAME_PROVIDERS.find(g => g.value === p)?.label || p).join(', ') : '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Nama Game</p>
                        <p className="text-foreground">{sub.game_names?.length > 0 ? sub.game_names.map(n => GAME_NAMES.find(g => g.value === n)?.label || n).join(', ') : '-'}</p>
                      </div>
                      
                      {/* Blacklist indicator */}
                      <div>
                        <p className="text-muted-foreground text-xs">Blacklist</p>
                        <p className={sub.game_blacklist_enabled ? "text-amber-500" : "text-muted-foreground"}>
                          {sub.game_blacklist_enabled ? 'Aktif' : 'Tidak aktif'}
                        </p>
                      </div>
                      
                      {/* Jenis Hadiah */}
                      <div>
                        <p className="text-muted-foreground text-xs">Jenis Hadiah</p>
                        <p className="text-foreground">
                          {sub.jenis_hadiah_same_as_global 
                            ? `(Global) ${REWARD_TYPES.find(r => r.value === data.global_jenis_hadiah)?.label || data.global_jenis_hadiah || '-'}`
                            : REWARD_TYPES.find(r => r.value === sub.jenis_hadiah)?.label || sub.jenis_hadiah || '-'}
                        </p>
                      </div>
                      
                      {/* Max Bonus */}
                      <div>
                        <p className="text-muted-foreground text-xs">Max Bonus</p>
                        <p className="text-foreground">
                          {sub.max_bonus_same_as_global 
                            ? `(Global) ${data.global_max_bonus ? `Rp ${formatNumber(data.global_max_bonus)}` : 'Unlimited'}`
                            : sub.dinamis_max_claim_unlimited 
                              ? 'Unlimited' 
                              : sub.dinamis_max_claim ? `Rp ${formatNumber(sub.dinamis_max_claim)}` : (sub.max_bonus ? `Rp ${formatNumber(sub.max_bonus)}` : '-')}
                        </p>
                      </div>
                      
                      {/* Payout Direction */}
                      <div>
                        <p className="text-muted-foreground text-xs">Payout Direction</p>
                        <p className="text-foreground">
                          {sub.payout_direction_same_as_global 
                            ? `(Global) ${data.global_payout_direction === 'before' ? 'Didepan' : 'Dibelakang'}`
                            : sub.payout_direction === 'before' ? 'Didepan' : 'Dibelakang'}
                        </p>
                      </div>
                    </div>
                      
                    {/* Blacklist Details (if enabled) */}
                    {sub.game_blacklist_enabled && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs text-amber-500 mb-2">Game Dilarang:</p>
                        <div className="flex flex-col gap-1 text-xs">
                          <div className="text-muted-foreground">
                            <span className="text-foreground/70">Jenis:</span> {sub.game_types_blacklist?.length > 0 ? sub.game_types_blacklist.map(t => GAME_RESTRICTIONS.find(g => g.value === t)?.label || t).join(', ') : '-'}
                          </div>
                          <div className="text-muted-foreground">
                            <span className="text-foreground/70">Provider:</span> {sub.game_providers_blacklist?.length > 0 ? sub.game_providers_blacklist.map(p => GAME_PROVIDERS.find(g => g.value === p)?.label || p).join(', ') : '-'}
                          </div>
                          <div className="text-muted-foreground">
                            <span className="text-foreground/70">Game:</span> {sub.game_names_blacklist?.length > 0 ? sub.game_names_blacklist.map(n => GAME_NAMES.find(g => g.value === n)?.label || n).join(', ') : '-'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Syarat dan Ketentuan Card */}
        <div className="mt-6">
          <div className="rounded-xl overflow-hidden bg-card border border-border">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="icon-circle">
                  <FileText className="icon-circle-icon" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Syarat dan Ketentuan</h3>
                  <p className="text-sm text-muted-foreground">
                    Preview S&K promo yang akan ditampilkan ke player
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCopyTerms}
                className="gap-2 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
              >
                <Copy className="h-4 w-4" />
                Salin
              </Button>
            </div>
            
            <div className="p-6">
              <div className="bg-muted rounded-xl p-6 space-y-4">
                {/* Header Promo */}
                <div className="text-lg font-bold text-button-hover">
                  {data.promo_name?.toUpperCase() || 'NAMA PROMO'}
                </div>
                
                {/* Detail per Varian - Combined Ilustrasi + S&K */}
                {data.has_subcategories && data.subcategories && data.subcategories.length > 0 ? (
                  <div className="space-y-4">
                    <p className="font-semibold text-foreground">Detail per Varian:</p>
                    
                    {data.subcategories.map((sub, idx) => (
                      <Collapsible key={sub.id || idx} defaultOpen={idx === 0}>
                        <CollapsibleTrigger className="w-full flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:bg-muted transition-colors group data-[state=open]:rounded-b-none data-[state=open]:border-b-0">
                          <div className="flex items-center gap-3">
                            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180 text-muted-foreground group-data-[state=open]:text-button-hover" />
                            <span className="font-medium text-button-hover">{sub.name || `Varian ${idx + 1}`}</span>
                            <Badge variant="outline" className="text-xs">
                              {sub.game_types?.length > 0 
                                ? sub.game_types.map((t: string) => GAME_RESTRICTIONS.find(g => g.value === t)?.label || t).join(', ')
                                : 'Semua Game'}
                            </Badge>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            Max: {sub.dinamis_max_claim_unlimited ? '∞' : `Rp ${formatNumber(sub.dinamis_max_claim || 0)}`}
                          </span>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent className="border border-t-0 border-border rounded-b-xl overflow-hidden bg-card">
                          {/* Ilustrasi Perhitungan - if percentage mode */}
                          {sub.calculation_method === 'percentage' && sub.calculation_value ? (
                            <div className="p-4 border-b border-border">
                              <p className="font-medium text-foreground mb-3 flex items-center gap-2">
                                <span>📊</span> Ilustrasi Perhitungan
                              </p>
                              <table className="w-full text-sm">
                                <thead className="bg-muted/30">
                                  <tr>
                                    <th className="text-left py-1.5 px-3 font-medium text-foreground">
                                      {(sub.calculation_base || 'Turnover').charAt(0).toUpperCase() + (sub.calculation_base || 'Turnover').slice(1)}
                                    </th>
                                    <th className="text-left py-1.5 px-3 font-medium text-muted-foreground">Kalkulasi</th>
                                    <th className="text-left py-1.5 px-3 font-medium text-foreground">Perkiraan Bonus</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {[1000000, 2000000, 5000000, 10000000, 20000000].map((amount, i) => {
                                    const rawBonus = amount * (sub.calculation_value / 100);
                                    const maxClaim = sub.dinamis_max_claim_unlimited ? Infinity : (sub.dinamis_max_claim || Infinity);
                                    const bonus = Math.min(rawBonus, maxClaim);
                                    const isCapped = bonus < rawBonus;
                                    return (
                                      <tr key={i} className="border-t border-border">
                                        <td className="py-1.5 px-3">
                                          <span className={i === 0 ? "text-button-hover font-medium" : "text-foreground"}>
                                            Rp {formatNumber(amount)}
                                          </span>
                                        </td>
                                        <td className="py-1.5 px-3 text-muted-foreground">
                                          {formatNumber(amount)} × {sub.calculation_value}%
                                        </td>
                                        <td className="py-1.5 px-3 font-medium text-foreground">
                                          Rp {formatNumber(bonus)}{isCapped && ' (max)'}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : null}
                          
                          {/* Syarat & Ketentuan */}
                          <div className="p-4">
                            <p className="font-medium text-foreground mb-3 flex items-center gap-2">
                              <span>📋</span> Syarat & Ketentuan
                            </p>
                            <ol className="space-y-2 text-sm text-muted-foreground">
                              {generateSubcategoryTerms(sub, data).map((term, i) => (
                                <li key={i} className="flex gap-2 leading-relaxed">
                                  <span className="flex-shrink-0">{i + 1}.</span>
                                  <span>{term}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                    
                    {/* Disclaimer */}
                    {data.reward_mode === 'formula' && data.subcategories.some(s => s.calculation_method === 'percentage' && s.calculation_value) && (
                      <p className="text-sm text-amber-500 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        Nilai ilustrasi hanya perkiraan. Nominal akhir diverifikasi oleh Human Agent & sistem.
                      </p>
                    )}
                    
                    {/* Global Terms - separate section */}
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="font-semibold text-foreground mb-3">Ketentuan Umum:</p>
                      <ol className="space-y-2 text-sm text-muted-foreground">
                        {generateGlobalTerms(data).map((term, i) => (
                          <li key={i} className="flex gap-2 leading-relaxed">
                            <span className="flex-shrink-0">{i + 1}.</span>
                            <span>{term}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                ) : data.reward_mode === 'formula' && data.calculation_method === 'percentage' && data.calculation_value ? (
                  /* Single promo mode with ilustrasi */
                  <div className="space-y-4">
                    <p className="font-semibold text-foreground">Ilustrasi Perhitungan</p>
                    
                    <div className="overflow-hidden rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="text-left py-1.5 px-3 font-medium text-foreground">
                              {(data.calculation_base || 'Turnover').charAt(0).toUpperCase() + (data.calculation_base || 'Turnover').slice(1)}
                            </th>
                            <th className="text-left py-1.5 px-3 font-medium text-muted-foreground">Kalkulasi</th>
                            <th className="text-left py-1.5 px-3 font-medium text-foreground">Perkiraan Bonus</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[1000000, 2000000, 5000000, 10000000, 20000000].map((amount, index) => {
                            const rawBonus = amount * (data.calculation_value / 100);
                            const maxClaim = data.dinamis_max_claim_unlimited ? Infinity : (data.dinamis_max_claim || Infinity);
                            const bonus = Math.min(rawBonus, maxClaim);
                            const isCapped = bonus < rawBonus;
                            return (
                              <tr key={index} className="border-t border-border">
                                <td className="py-1.5 px-3">
                                  <span className={index === 0 ? "text-button-hover font-medium" : "text-foreground"}>
                                    Rp {formatNumber(amount)}
                                  </span>
                                </td>
                                <td className="py-1.5 px-3 text-muted-foreground">
                                  {formatNumber(amount)} × {data.calculation_value}%
                                </td>
                                <td className="py-1.5 px-3 font-medium text-foreground">
                                  Rp {formatNumber(bonus)}{isCapped && ' (max)'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    <p className="text-sm text-amber-500 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      Nilai ini hanya ilustrasi. Nominal akhir diverifikasi oleh Human Agent & sistem.
                    </p>
                    
                    {/* S&K */}
                    <div className="pt-4 border-t border-border">
                      <p className="font-semibold text-foreground mb-3">Syarat & Ketentuan:</p>
                      <ol className="space-y-2 text-sm text-muted-foreground">
                        {[...generateSinglePromoTerms(data), ...generateGlobalTerms(data)].map((term, i) => (
                          <li key={i} className="flex gap-2 leading-relaxed">
                            <span className="flex-shrink-0">{i + 1}.</span>
                            <span>{term}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                ) : (
                  /* Non-formula mode - just S&K */
                  <div className="space-y-3">
                    <p className="font-semibold text-foreground">Syarat & Ketentuan:</p>
                    <ol className="space-y-2 text-sm text-muted-foreground">
                      {[...generateSinglePromoTerms(data), ...generateGlobalTerms(data)].map((term, i) => (
                        <li key={i} className="flex gap-2 leading-relaxed">
                          <span className="flex-shrink-0">{i + 1}.</span>
                          <span>{term}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* JSON Preview (Collapsible) - Split Parent & Subcategories */}
        <div className="mt-6">
          <Collapsible open={jsonOpen} onOpenChange={setJsonOpen}>
            {/* Header with title and copy button */}
            <div className={cn(
              "flex items-center justify-between bg-card border border-border p-6",
              jsonOpen ? "rounded-t-xl" : "rounded-xl"
            )}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  jsonOpen && "rotate-180"
                )} />
                <span>JSON Output Preview</span>
              </CollapsibleTrigger>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(JSON.stringify(pkbPayload, null, 2));
                  toast({
                    title: "Berhasil disalin!",
                    description: "PKB JSON telah disalin ke clipboard"
                  });
                }}
                className="gap-2 border-border text-foreground hover:bg-button-hover hover:text-button-hover-foreground hover:border-button-hover"
              >
                <Copy className="h-4 w-4" />
                Salin JSON
              </Button>
            </div>
            <CollapsibleContent>
              <div className="bg-card border border-t-0 border-border rounded-b-xl p-6 space-y-4">
                {/* Check if has subcategories - show split view */}
                {data.has_subcategories && data.subcategories && data.subcategories.length > 0 ? (
                  <>
                    {/* Parent Promo JSON */}
                    <Collapsible defaultOpen>
                      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 bg-card border border-border rounded-xl hover:bg-muted transition-colors group data-[state=open]:rounded-b-none data-[state=open]:border-b-0">
                        <div className="flex items-center gap-3">
                          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180 text-muted-foreground" />
                          <span className="font-medium text-foreground">📄 Promo Parent</span>
                          <Badge variant="outline" className="text-xs">
                            {data.promo_name || 'Promo'}
                          </Badge>
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent className="border border-t-0 border-border rounded-b-xl overflow-hidden">
                        <pre className="text-xs p-4 max-h-[200px] overflow-y-auto font-mono whitespace-pre-wrap break-all bg-background">
                          {JSON.stringify({
                            ...pkbPayload,
                            subcategories: `[${data.subcategories.length} varian - lihat di bawah]`
                          }, null, 2)}
                        </pre>
                      </CollapsibleContent>
                    </Collapsible>
                    
                    {/* Subcategories JSON - separate collapsible per varian */}
                    {data.subcategories.map((sub, idx) => (
                      <Collapsible key={sub.id || idx} defaultOpen={idx === 0}>
                        <CollapsibleTrigger className="w-full flex items-center justify-between p-3 bg-card border border-border rounded-xl hover:bg-muted transition-colors group data-[state=open]:rounded-b-none data-[state=open]:border-b-0">
                          <div className="flex items-center gap-3">
                            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180 text-muted-foreground" />
                            <span className="font-medium text-button-hover">📁 Varian: {sub.name || `Sub Kategori ${idx + 1}`}</span>
                            <Badge variant="outline" className="text-xs">
                              {sub.game_types?.length > 0 
                                ? sub.game_types.map((t: string) => GAME_RESTRICTIONS.find(g => g.value === t)?.label || t).join(', ')
                                : 'Semua Game'}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">
                            id: {sub.id?.substring(0, 12)}...
                          </span>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent className="border border-t-0 border-border rounded-b-xl overflow-hidden">
                          <pre className="text-xs p-4 max-h-[200px] overflow-y-auto font-mono whitespace-pre-wrap break-all bg-background">
                            {JSON.stringify(sub, null, 2)}
                          </pre>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </>
                ) : (
                  /* Single promo mode - show full JSON */
                  <pre className="text-xs max-h-[300px] overflow-y-auto font-mono whitespace-pre-wrap break-all">
                    {JSON.stringify(pkbPayload, null, 2)}
                  </pre>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </Card>
  );
}
