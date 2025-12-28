import { PromoFormData, GAME_RESTRICTIONS, GAME_PROVIDERS, GAME_NAMES, CONTACT_CHANNELS, GEO_RESTRICTIONS, PLATFORM_ACCESS, CALCULATION_BASES, CALCULATION_METHODS, CLAIM_FREQUENCIES, REWARD_DISTRIBUTIONS, DINAMIS_REWARD_TYPES, REWARD_TYPES, PROMO_RISK_LEVELS, buildPKBPayload, TIER_ARCHETYPE_OPTIONS, LP_EARN_BASIS_OPTIONS } from "./types";
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
import { cn, formatPromoType } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

// Helper: format number with thousand separator
export const formatNumber = (num: number): string => {
  return num.toLocaleString('id-ID');
};

// ============= EPISTEMIC AUTHORITY HELPERS =============
// Summary = Renderer, NOT Reasoner. Never infer facts that don't exist.

/**
 * Get dynamic column label based on calculation_base
 * "Win/Loss" for loss-based, "Turnover" for turnover-based, etc.
 */
export const getBaseColumnLabel = (calculationBase: string | undefined): string => {
  const base = calculationBase?.toLowerCase() || '';
  switch (base) {
    case 'loss':
      return 'Kekalahan Bersih';
    case 'win':
      return 'Kemenangan';
    case 'winloss':
    case 'win_loss':
      return 'Win/Loss';
    case 'turnover':
    case 'to':
      return 'Turnover';
    case 'deposit':
      return 'Deposit';
    case 'bet_amount':
      return 'Nilai Taruhan';
    default:
      return 'Nilai';
  }
};

/**
 * Check if max_bonus is EXPLICITLY set (not confused with minimum_base)
 * Returns true only if dinamis_max_claim is set OR max_bonus_explicit flag exists
 */
export const hasExplicitMaxBonus = (sub: any): boolean => {
  // If dinamis_max_claim is set (from form), it's explicit
  if (sub.dinamis_max_claim && sub.dinamis_max_claim > 0) return true;
  // If unlimited flag is set, it's explicit (means "no cap")
  if (sub.dinamis_max_claim_unlimited === true) return false; // No cap!
  // If max_bonus_explicit flag exists from extraction, trust it
  if (sub.max_bonus_explicit === true) return true;
  // Legacy: if max_bonus is set but we don't have explicit flag, 
  // be conservative - don't assume it's correct (could be extraction error)
  return false;
};

/**
 * Get the actual max bonus value to use for capping
 * Returns Infinity if no explicit max is set
 */
export const getExplicitMaxBonus = (sub: any): number => {
  if (sub.dinamis_max_claim_unlimited === true) return Infinity;
  if (sub.dinamis_max_claim && sub.dinamis_max_claim > 0) return sub.dinamis_max_claim;
  if (sub.max_bonus_explicit === true && sub.max_bonus && sub.max_bonus > 0) return sub.max_bonus;
  return Infinity; // Default: unlimited if not explicit
};

/**
 * Validate percentage consistency between promo_name and formula value
 * Returns warning message if mismatch detected
 * 
 * Example:
 * - promo_name: "ROLLINGAN SLOT MINGGUAN 0.5%"
 * - formula_value: 5
 * → WARNING: Nama promo menunjukkan 0.5%, tapi formula value = 5%
 */
export const validatePercentageConsistency = (data: PromoFormData): string | null => {
  const promoName = data.promo_name || '';
  const formulaValue = data.formula_metadata?.value || 
    data.calculation_value ||
    data.subcategories?.[0]?.calculation_value;
  
  if (!formulaValue) return null;
  
  // Extract percentage from promo_name using regex
  // Matches: "0.5%", "5%", "100%", "0.8 %"
  const percentMatch = promoName.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!percentMatch) return null;
  
  // Parse with comma support (Indonesian decimals)
  const namePercent = parseFloat(percentMatch[1].replace(',', '.'));
  const formulaPercent = typeof formulaValue === 'number' ? formulaValue : parseFloat(formulaValue);
  
  // Check mismatch (allowing small float tolerance)
  if (Math.abs(namePercent - formulaPercent) > 0.01) {
    return `⚠️ KONFLIK PERSENTASE: Nama promo menunjukkan ${namePercent}%, tapi formula value = ${formulaPercent}%. Pastikan salah satu dikoreksi!`;
  }
  
  return null;
};

// Helper: capitalize first letter
const capitalizeFirst = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

// Helper: Get detailed reward distribution display with day/time specifics
const getRewardDistributionDisplay = (data: PromoFormData): string => {
  const baseLabel = REWARD_DISTRIBUTIONS.find(r => r.value === data.reward_distribution)?.label 
    || data.reward_distribution || '';
  
  // Jika "hari_tertentu" dan ada detail hari/jam
  if (data.reward_distribution === 'hari_tertentu') {
    const day = data.distribution_day 
      ? capitalizeFirst(data.distribution_day) 
      : '';
    
    // Dengan jam
    if (data.distribution_day_time_enabled && data.distribution_time_from) {
      const timeFrom = data.distribution_time_from;
      const timeUntil = data.distribution_time_until || timeFrom;
      return `Hari ${day}, ${timeFrom} - ${timeUntil} WIB`;
    }
    
    // Tanpa jam, hanya hari
    if (day) {
      return `Hari ${day}`;
    }
  }
  
  // Jika "tanggal_tertentu" dan ada detail tanggal
  if (data.reward_distribution === 'tanggal_tertentu') {
    if (data.distribution_date_from && data.distribution_date_until) {
      return `${data.distribution_date_from} - ${data.distribution_date_until}`;
    }
    if (data.distribution_date_from) {
      return data.distribution_date_from;
    }
  }
  
  return baseLabel;
};

// Helper: Dynamic Point Unit labels based on promo_unit selection
const getPointUnitLabel = (promoUnit: string | undefined) => {
  switch (promoUnit) {
    case 'exp': return 'Experience Point';
    case 'hybrid': return 'Point';
    case 'lp':
    default: return 'Loyalty Point';
  }
};

const getPointUnitShort = (promoUnit: string | undefined) => {
  switch (promoUnit) {
    case 'exp': return 'EXP';
    case 'hybrid': return 'Point';
    case 'lp':
    default: return 'LP';
  }
};

/**
 * Get calculation period display string (multi-source)
 * Priority: 
 *   1. claim_frequency (Indonesian) 
 *   2. formula_metadata.period (English)
 *   3. Infer from promo_name (contains "MINGGUAN", "HARIAN", etc.)
 *   4. Fallback: 'berkala'
 */
const getPeriodDisplayFromData = (data: PromoFormData): string => {
  // 1. Check claim_frequency first (Indonesian)
  const freq = data.claim_frequency?.toLowerCase();
  if (freq === 'harian' || freq === 'daily') return 'harian';
  if (freq === 'mingguan' || freq === 'weekly') return 'mingguan';
  if (freq === 'bulanan' || freq === 'monthly') return 'bulanan';
  
  // 2. Fallback to formula_metadata.period (English)
  const period = data.formula_metadata?.period?.toLowerCase();
  if (period === 'daily') return 'harian';
  if (period === 'weekly') return 'mingguan';
  if (period === 'monthly') return 'bulanan';
  
  // 3. Infer from promo_name
  const promoName = (data.promo_name || '').toLowerCase();
  if (promoName.includes('mingguan') || promoName.includes('weekly')) return 'mingguan';
  if (promoName.includes('harian') || promoName.includes('daily')) return 'harian';
  if (promoName.includes('bulanan') || promoName.includes('monthly')) return 'bulanan';
  
  // 4. Final fallback
  return 'berkala';
};

/**
 * Get game type display string for S&K
 * Priority: game_types array → infer from promo_name/promo_type → fallback
 * 
 * IMPORTANT: Fallback must NOT contain "permainan" because template already has it!
 */
const getGameTypeDisplayForTerms = (data: PromoFormData): string => {
  // 1. If game_types has values, use getGameCategoryLabel
  const types = data.game_types?.length > 0 
    ? data.game_types 
    : (data.subcategories?.[0]?.game_types || []);
  
  if (types.length > 0) {
    return getGameCategoryLabel(types);
  }
  
  // 2. Infer from promo_name or promo_type
  const searchText = `${data.promo_name || ''} ${data.promo_type || ''}`.toLowerCase();
  
  if (searchText.includes('sportsbook') || searchText.includes('sport')) return 'Sportsbook';
  if (searchText.includes('slot')) return 'Slot';
  if (searchText.includes('casino') || searchText.includes('live casino')) return 'Casino';
  if (searchText.includes('togel') || searchText.includes('lottery')) return 'Togel';
  if (searchText.includes('poker')) return 'Poker';
  if (searchText.includes('arcade')) return 'Arcade';
  if (searchText.includes('sabung ayam') || searchText.includes('cockfight')) return 'Sabung Ayam';
  if (searchText.includes('tembak ikan') || searchText.includes('fishing')) return 'Tembak Ikan';
  
  // 3. Fallback - just "tertentu" (NOT "permainan tertentu"!)
  // Because the template already says "di permainan {gameLabel}"
  return 'tertentu';
};

// Helper: generate GLOBAL terms (applies to all subcategories)
export const generateGlobalTerms = (data: PromoFormData): string[] => {
  const terms: string[] = [];
  
  // ============= CLAIM FREQUENCY INFERENCE FROM PERIOD =============
  // FIX: Jika periode Senin-Minggu = MINGGUAN, bukan HARIAN
  // Period overrides claim_frequency untuk mencegah mismatch
  const inferFrequencyFromPeriod = (
    periodStart: string | undefined,
    periodEnd: string | undefined,
    fullData: PromoFormData
  ): string => {
    // 🔒 PRIORITY 0: Sanity check based on distribution_day
    // If distribution is on a specific weekday, that implies WEEKLY distribution!
    // This overrides any incorrect claim_frequency (e.g., "bulanan" with "selasa" distribution)
    const distDay = fullData.distribution_day?.toLowerCase();
    const weekdays = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu',
                      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    if (distDay && weekdays.includes(distDay)) {
      return 'mingguan';  // Weekly distribution on specific day
    }
    
    if (distDay === 'setiap_hari' || distDay === 'daily' || distDay === 'setiap hari') {
      return 'harian';  // Daily distribution
    }
    
    // PRIORITY 1: Use explicit claim_frequency or formula_metadata.period
    const explicitPeriod = getPeriodDisplayFromData(fullData);
    if (explicitPeriod !== 'berkala') {
      return explicitPeriod;
    }
    
    // PRIORITY 2: Infer from day range (only if no explicit data)
    if (periodStart && periodEnd) {
      const start = periodStart.toLowerCase();
      const end = periodEnd.toLowerCase();
      
      // Full week = MINGGUAN
      if (start === 'senin' && end === 'minggu') return 'mingguan';
      if (start === 'senin' && end === 'jumat') return 'mingguan';
      if (start === 'sabtu' && end === 'minggu') return 'mingguan';
      
      // Same day (Senin s/d Senin) = MINGGUAN (weekly on specific day)
      if (start === end) return 'mingguan';
      
      return 'mingguan';
    }
    
    return 'berkala';
  };
  
  // Get the CORRECT frequency (period-based inference takes priority)
  const effectiveFrequency = inferFrequencyFromPeriod(
    data.calculation_period_start,
    data.calculation_period_end,
    data
  );
  
  // Claim frequency - use inferred value
  if (effectiveFrequency === 'mingguan') {
    terms.push(`Bonus diberikan berdasarkan perhitungan mingguan.`);
    
    // Dynamic period - ONLY show if explicitly extracted (jangan hardcode!)
    if (data.calculation_period_start && data.calculation_period_end) {
      const startDay = capitalizeFirst(data.calculation_period_start);
      const endDay = capitalizeFirst(data.calculation_period_end);
      terms.push(`Periode hitungan berlaku hari ${startDay} s/d ${endDay}.`);
    }
  } else if (effectiveFrequency === 'harian') {
    terms.push(`Bonus diberikan berdasarkan perhitungan harian.`);
    
    // Dynamic period for daily (if extracted)
    if (data.calculation_period_start && data.calculation_period_end) {
      const startDay = capitalizeFirst(data.calculation_period_start);
      const endDay = capitalizeFirst(data.calculation_period_end);
      terms.push(`Periode hitungan berlaku hari ${startDay} s/d ${endDay}.`);
    }
  } else if (effectiveFrequency) {
    terms.push(`Frekuensi klaim: ${effectiveFrequency}.`);
  }
  
  // ============================================
  // NEUTRALIZED: Claim mechanism is runtime decision, not promo data!
  // ============================================
  // Distribution day for PROCESSING (not auto-credit language)
  if (data.distribution_day) {
    const dayLabel = data.distribution_day === 'setiap_hari' 
      ? 'setiap hari' 
      : `hari ${capitalizeFirst(data.distribution_day)}`;
    terms.push(`Pemrosesan bonus dilakukan ${dayLabel}.`);
  }
  
  // NEUTRAL claim term - lets toggle & Livechat decide actual mechanism
  terms.push(`Bonus diproses sesuai mekanisme klaim yang berlaku.`);
  
  // Distribution time (untuk Hari Tertentu - legacy support)
  if (data.reward_distribution === 'hari_tertentu' && data.distribution_day && data.distribution_time_from && data.distribution_time_until) {
    // Only add time detail if not already covered above
    terms.push(`Waktu pembagian: ${data.distribution_time_from} - ${data.distribution_time_until} WIB.`);
  }
  
  // Platform requirement - APK download
  if (data.require_apk) {
    terms.push(`Wajib download APK terlebih dahulu untuk claim reward ini.`);
  }
  
  // Period - ONLY show if dates are NOT system-generated (today's date)
  const isSystemGeneratedDate = (dateStr: string | undefined): boolean => {
    if (!dateStr) return false;
    const today = new Date().toISOString().split('T')[0];
    const inputDate = dateStr.split('T')[0];
    return inputDate === today;
  };
  
  const hasRealFrom = data.valid_from && !isSystemGeneratedDate(data.valid_from);
  const hasRealUntil = data.valid_until && !isSystemGeneratedDate(data.valid_until);
  
  if (hasRealFrom || hasRealUntil) {
    const from = hasRealFrom ? `dari ${data.valid_from}` : '';
    const until = hasRealUntil ? `hingga ${data.valid_until}` : '';
    terms.push(`Periode promo berlaku ${from} ${until}.`.replace('  ', ' ').trim());
  }
  
  // Geo restriction
  if (data.geo_restriction && data.geo_restriction !== 'semua') {
    const geoLabel = GEO_RESTRICTIONS.find(g => g.value === data.geo_restriction)?.label || data.geo_restriction;
    terms.push(`Promo hanya berlaku untuk wilayah: ${geoLabel}.`);
  }
  
  // Platform access - map to proper human-readable sentence
  const getPlatformAccessTerm = (value: string | undefined): string | null => {
    if (!value) return null;
    const normalized = value.toLowerCase().trim();
    // Skip universal access - don't add redundant line
    if (normalized === 'all' || normalized === 'semua') return null;
    const labelMap: Record<string, string> = {
      'apk': 'Promo hanya tersedia melalui APK.',
      'web': 'Promo hanya tersedia melalui website.',
      'mobile': 'Promo hanya tersedia melalui mobile.',
    };
    return labelMap[normalized] || null;
  };
  
  const platformTerm = getPlatformAccessTerm(data.platform_access);
  if (platformTerm) {
    terms.push(platformTerm);
  }
  
  // Contact channel
  if (data.contact_channel_enabled && data.contact_channel) {
    const channelLabel = CONTACT_CHANNELS.find(c => c.value === data.contact_channel)?.label || data.contact_channel;
    
    if (data.contact_channel === 'livechat') {
      terms.push(`Untuk claim bisa melalui: Live Chat.`);
    } else if (data.contact_link) {
      terms.push(`Untuk claim bisa melalui: ${channelLabel} Official - ${data.contact_link}`);
    } else {
      terms.push(`Untuk claim bisa melalui: ${channelLabel} Official.`);
    }
  }
  
  // Default terms
  terms.push(`Bonus dapat dibatalkan jika terdapat indikasi kecurangan dari player.`);
  terms.push(`Syarat & ketentuan bonus dapat berubah sewaktu-waktu tanpa pemberitahuan, dan seluruh keputusan bersifat mutlak tidak dapat diganggu gugat.`);
  
  return terms;
};

// Synonym mapping untuk legacy data yang ter-extract dengan English terms
const GAME_CATEGORY_SYNONYMS: Record<string, string> = {
  'cockfight': 'Sabung Ayam',
  'sabung ayam': 'Sabung Ayam',
  'sports_betting': 'Sportsbook',
  'sports betting': 'Sportsbook',
  'fish_shooting': 'Tembak Ikan',
  'fish shooting': 'Tembak Ikan',
  'tembak_ikan': 'Tembak Ikan',
  'lottery': 'Togel',
  'arcade_games': 'Arcade',
};

// Helper: get game category label - PRESERVE Indonesian names, don't translate!
// "SABUNG AYAM" → "Sabung Ayam" (NOT "COCKFIGHT"!)
const getGameCategoryLabel = (gameTypes: string[]): string => {
  if (!gameTypes?.length) return 'Semua permainan';
  
  return gameTypes.map((t: string) => {
    const normalized = t.toLowerCase().trim();
    
    // 1. Check GAME_RESTRICTIONS mapping first (normalized value → label)
    const mapped = GAME_RESTRICTIONS.find(g => g.value === normalized);
    if (mapped) return mapped.label;
    
    // 2. Check synonym mapping for legacy English terms
    const synonym = GAME_CATEGORY_SYNONYMS[normalized];
    if (synonym) return synonym;
    
    // 3. If no mapping, use ORIGINAL value in uppercase (preserve Indonesian terms)
    return t.toUpperCase();
  }).join(', ');
};

// Helper: generate terms for a specific SUBCATEGORY
// 🔒 EPISTEMIC AUTHORITY CONTRACT: Only render EXPLICIT facts, never infer!
export const generateSubcategoryTerms = (sub: any, data: PromoFormData): string[] => {
  const terms: string[] = [];
  
  // Game restriction - use helper to preserve Indonesian names
  const gameCategory = getGameCategoryLabel(sub.game_types);
  
  // Eligible providers (extracted from "KATEGORI (PROVIDER1 & PROVIDER2)" pattern)
  // e.g., "SABUNG AYAM (SV388 & WS168)" → eligible_providers: ["SV388", "WS168"]
  const eligibleProviders = sub.eligible_providers?.length > 0 
    ? ` (${sub.eligible_providers.join(' & ')})` 
    : '';
  
  // Game providers (whitelist - from form selection)
  const provider = sub.game_providers?.length > 0 
    ? sub.game_providers.map((p: string) => GAME_PROVIDERS.find(g => g.value === p)?.label || p).join(', ')
    : null;
  const gameName = sub.game_names?.length > 0
    ? sub.game_names.map((n: string) => GAME_NAMES.find(g => g.value === n)?.label || n).join(', ')
    : null;
  
  // Build game description with eligible_providers FIRST (from extraction), then provider whitelist
  let gameDesc = `Bonus berlaku untuk ${gameCategory}${eligibleProviders}`;
  if (provider) gameDesc += ` - Provider: ${provider}`;
  if (gameName) gameDesc += ` - Game: ${gameName}`;
  terms.push(`${gameDesc}.`);
  
  // Bonus percentage - use dynamic label
  if (sub.calculation_value) {
    const baseLabel = getBaseColumnLabel(sub.calculation_base);
    terms.push(`Bonus ${sub.calculation_value}% dari ${baseLabel}.`);
  }
  
  // 🔒 ONTOLOGY FIX: Eligibility threshold (minimum_base) vs Payout threshold (dinamis_min_claim)
  // minimum_base = EXPLICIT threshold to QUALIFY for promo
  // dinamis_min_claim = minimum BONUS amount to be CLAIMED
  // These are COMPLETELY DIFFERENT concepts!
  
  // 🔒 ANTI-DUPLICATE: Jika minimum_base === dinamis_min_claim, ini LEGACY DATA salah mapping
  // Prioritas: dinamis_min_claim (payout) → IGNORE minimum_base yang sama
  const minClaimValue = sub.dinamis_min_claim || 0;
  const minBaseValue = sub.minimum_base || 0;
  const isDuplicateValue = minBaseValue > 0 && minClaimValue > 0 && minBaseValue === minClaimValue;
  
  // Payout threshold - RENDER FIRST (prioritas)
  if (minClaimValue > 0) {
    terms.push(`Minimal bonus yang dapat dicairkan adalah Rp ${formatNumber(minClaimValue)}.`);
  }
  
  // Eligibility threshold - ONLY show if EXPLICITLY declared AND NOT duplicate of payout
  if (minBaseValue > 0 && !isDuplicateValue) {
    const baseLabel = getBaseColumnLabel(sub.calculation_base);
    terms.push(`Minimal ${baseLabel} untuk mendapatkan bonus ini adalah Rp ${formatNumber(minBaseValue)}.`);
  }
  
  // 🔒 EPISTEMIC AUTHORITY: Max claim - ONLY show if EXPLICITLY set!
  // DO NOT show max_bonus if it might be confused with minimum_base (extraction error)
  if (sub.dinamis_max_claim_unlimited === true) {
    terms.push(`Tidak ada batas maksimum untuk pembagian bonus ini.`);
  } else if (sub.dinamis_max_claim && sub.dinamis_max_claim > 0) {
    // dinamis_max_claim is set from form = explicit
    terms.push(`Maksimum bonus yang bisa didapat adalah Rp ${formatNumber(sub.dinamis_max_claim)}.`);
  } else if (hasExplicitMaxBonus(sub)) {
    // Only show max_bonus if explicitly marked
    terms.push(`Maksimum bonus yang bisa didapat adalah Rp ${formatNumber(sub.max_bonus)}.`);
  }
  // ⚠️ If no explicit max_bonus, DON'T add any "maksimum bonus" text!
  
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
// 🔒 EPISTEMIC AUTHORITY: Resolve "specific_game" placeholder using game_types[]
export const generateSinglePromoTerms = (data: PromoFormData): string[] => {
  const terms: string[] = [];
  
  // Game restriction - humanize label (single promo mode)
  // FIX: Sync dengan game_types[] dan game_providers[] dari UI whitelist
  // Prioritas: game_types[] > game_restriction field
  const hasSpecificGames = (data.game_types?.length > 0) || 
    (data.game_restriction && data.game_restriction !== 'semua');
  
  if (hasSpecificGames) {
    // Use getGameTypeDisplayForTerms() which reads from game_types[]
    let gameLabel = getGameTypeDisplayForTerms(data);
    
    // Fallback to game_restriction label if game_types[] empty
    if (gameLabel === 'Semua Permainan' && data.game_restriction && data.game_restriction !== 'semua') {
      gameLabel = GAME_RESTRICTIONS.find(g => g.value === data.game_restriction)?.label || gameLabel;
    }
    
    // Provider suffix: prioritas game_providers[] > eligible_providers > subcategories
    const providers = data.game_providers?.length > 0 
      ? data.game_providers
      : (data.eligible_providers?.length > 0 
          ? data.eligible_providers
          : (data.subcategories?.[0]?.eligible_providers || []));
    
    // Filter out "ALL" placeholder
    const filteredProviders = providers.filter(p => p && p.toUpperCase() !== 'ALL');
    const providerSuffix = filteredProviders.length > 0 
      ? ` (${filteredProviders.join(' & ')})` 
      : '';
    
    terms.push(`Bonus ini hanya berlaku untuk player yang bertaruh di permainan ${gameLabel}${providerSuffix}.`);
  } else {
    terms.push(`Bonus ini berlaku untuk semua jenis permainan.`);
  }
  
  // 🔒 ONTOLOGY FIX: Eligibility threshold (min_calculation) vs Payout threshold (dinamis_min_claim)
  // ANTI-DUPLICATE: Jika min_calculation === dinamis_min_claim, ini LEGACY DATA salah mapping
  const singleMinClaim = data.dinamis_min_claim || 0;
  const singleMinBase = data.min_calculation || 0;
  const singleIsDuplicate = singleMinBase > 0 && singleMinClaim > 0 && singleMinBase === singleMinClaim;
  
  // Payout threshold - RENDER FIRST (prioritas)
  if (singleMinClaim > 0) {
    terms.push(`Minimal bonus yang bisa dicairkan adalah Rp ${formatNumber(singleMinClaim)}.`);
  }
  
  // Eligibility threshold - ONLY show if EXPLICITLY declared AND NOT duplicate of payout
  if (data.min_calculation_enabled && singleMinBase > 0 && !singleIsDuplicate) {
    const baseLabel = getBaseColumnLabel(data.calculation_base);
    terms.push(`Minimal ${baseLabel} untuk mendapatkan bonus ini adalah Rp ${formatNumber(singleMinBase)}.`);
  }
  
  // Max claim - 🔒 EPISTEMIC AUTHORITY: Only show if explicitly set
  if (data.dinamis_max_claim_unlimited) {
    terms.push(`Tidak ada batas maksimum untuk pembagian bonus ini.`);
  } else if (data.dinamis_max_claim && data.dinamis_max_claim > 0) {
    terms.push(`Maksimum bonus yang bisa didapat adalah Rp ${formatNumber(data.dinamis_max_claim)}.`);
  }
  // ⚠️ If no explicit max_claim, DON'T add any "maksimum bonus" text!
  
    // Turnover rule - 🔧 FIX: Check toggle FIRST like generateSinglePromoTerms
    if (data.turnover_rule_enabled && data.turnover_rule && !['turnover', 'win_loss', 'winloss', 'bet_amount'].includes(data.calculation_base?.toLowerCase() || '')) {
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
    
    // Step 3: Jenis Program
    const step3Fields = [
      !!data.program_classification
    ];
    const step3Percentage = Math.round((step3Fields.filter(Boolean).length / step3Fields.length) * 100);
    
    // Step 4: Konfigurasi Reward (Event Config)
    let step4Fields: boolean[] = [];
    if (data.reward_mode === 'fixed') {
      step4Fields = [
        !!data.reward_mode,
        !!data.reward_type,
        data.reward_amount > 0
      ];
    } else if (data.reward_mode === 'formula') {
      step4Fields = [
        !!data.reward_mode,
        !!data.calculation_base,
        !!data.calculation_method,
        data.calculation_value > 0,
        !!data.dinamis_reward_type
      ];
    } else if (data.reward_mode === 'tier') {
      step4Fields = [
        !!data.reward_mode,
        !!data.promo_unit
      ];
    } else {
      step4Fields = [!!data.reward_mode];
    }
    const step4Percentage = step4Fields.length > 0 
      ? Math.round((step4Fields.filter(Boolean).length / step4Fields.length) * 100)
      : 0;

    return {
      step1: { percentage: step1Percentage, complete: step1Percentage === 100 },
      step2: { percentage: step2Percentage, complete: step2Percentage === 100 },
      step3: { percentage: step3Percentage, complete: step3Percentage === 100 },
      step4: { percentage: step4Percentage, complete: step4Percentage === 100 }
    };
  }, [data]);

  const overallScore = useMemo(() => {
    return Math.round(
      (stepCompletion.step1.percentage + stepCompletion.step2.percentage + stepCompletion.step3.percentage + stepCompletion.step4.percentage) / 4
    );
  }, [stepCompletion]);

  const hasCriticalErrors = !stepCompletion.step1.complete || !stepCompletion.step2.complete || !stepCompletion.step3.complete || !stepCompletion.step4.complete;

  const isAllComplete = stepCompletion.step1.complete && stepCompletion.step2.complete && stepCompletion.step3.complete && stepCompletion.step4.complete;

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          label="Jenis Program"
          percentage={stepCompletion.step3.percentage}
          complete={stepCompletion.step3.complete}
          onClick={() => onGoToStep?.(3)}
        />
        <BlockCard
          blockKey="step4"
          label="Konfigurasi Reward"
          percentage={stepCompletion.step4.percentage}
          complete={stepCompletion.step4.complete}
          onClick={() => onGoToStep?.(4)}
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
      const exampleBase = data.min_calculation && data.min_calculation > 0 ? data.min_calculation : 5000000;
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
            <ValueBox label="Tipe" value={formatPromoType(data.promo_type)} />
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

          {/* Step 4 Summary - Konfigurasi Reward */}
          <CollapsibleSection 
            title="Konfigurasi Reward" 
            complete={!!isStep2Complete}
            stepNumber={4}
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
                    {/* Dasar & Metode Perhitungan */}
                    <ValueBox 
                      label="Dasar Perhitungan" 
                      value={CALCULATION_BASES.find(b => b.value === data.fixed_calculation_base)?.label || data.fixed_calculation_base} 
                    />
                    <ValueBox 
                      label="Jenis Perhitungan" 
                      value={CALCULATION_METHODS.find(c => c.value === data.fixed_calculation_method)?.label || data.fixed_calculation_method} 
                    />
                    {/* Nilai Bonus */}
                    <ValueBox 
                      label="Nilai Bonus" 
                      value={data.fixed_calculation_value ? `${data.fixed_calculation_value}${data.fixed_calculation_method === 'percentage' ? '%' : ''}` : undefined} 
                    />
                    {/* Jenis Reward */}
                    <ValueBox 
                      label="Jenis Reward" 
                      value={REWARD_TYPES.find(r => r.value === data.fixed_reward_type)?.label || data.fixed_reward_type} 
                    />
                    {/* Max Claim */}
                    <ValueBox 
                      label="Batas Maksimal Bonus" 
                      value={data.fixed_max_claim_unlimited ? 'Unlimited' : (data.fixed_max_claim ? `Rp ${data.fixed_max_claim.toLocaleString('id-ID')}` : undefined)} 
                    />
                    {/* Payout Direction */}
                    <ValueBox 
                      label="Payout Direction" 
                      value={data.fixed_payout_direction === 'before' ? 'Didepan' : 'Dibelakang'} 
                    />
                    {/* Admin Fee - hanya tampil jika enabled */}
                    {data.fixed_admin_fee_enabled && (
                      <ValueBox 
                        label="Admin Fee" 
                        value={`${data.fixed_admin_fee_percentage ?? 0}%`} 
                      />
                    )}
                    {/* Minimum Depo - hanya tampil jika enabled */}
                    {data.fixed_min_depo_enabled && data.fixed_min_depo && (
                      <ValueBox 
                        label="Minimum Depo" 
                        value={`Rp ${data.fixed_min_depo.toLocaleString('id-ID')}`} 
                      />
                    )}
                    {/* Minimal Perhitungan - hanya tampil jika enabled */}
                    {data.fixed_min_calculation_enabled && data.fixed_min_calculation && (
                      <ValueBox 
                        label={`Minimal Perhitungan ${CALCULATION_BASES.find(b => b.value === data.fixed_calculation_base)?.label || ''}`}
                        value={`Rp ${data.fixed_min_calculation.toLocaleString('id-ID')}`} 
                      />
                    )}
                    {/* Periode Klaim */}
                    <ValueBox 
                      label="Periode Klaim" 
                      value={CLAIM_FREQUENCIES.find(c => c.value === data.claim_frequency)?.label || data.claim_frequency} 
                    />
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
                    <ValueBox label={`Minimal Perhitungan ${CALCULATION_BASES.find(b => b.value === data.calculation_base)?.label || ''}`} value={data.min_calculation_enabled ? (data.min_calculation ? `Rp ${data.min_calculation.toLocaleString('id-ID')}` : undefined) : 'Tidak ada batas minimal'} />
                    {/* Payout Direction */}
                    <ValueBox 
                      label="Payout Direction" 
                      value={data.global_payout_direction === 'before' ? 'Didepan' : 'Dibelakang'} 
                    />
                    {/* Admin Fee - hanya tampil jika enabled */}
                    {data.admin_fee_enabled && data.admin_fee_percentage !== null && (
                      <ValueBox 
                        label="Admin Fee" 
                        value={`${data.admin_fee_percentage}%`} 
                      />
                    )}
                    <ValueBox label="Periode Klaim" value={CLAIM_FREQUENCIES.find(c => c.value === data.claim_frequency)?.label || data.claim_frequency} />
                    <ValueBox label="Waktu Pembagian Bonus" value={getRewardDistributionDisplay(data)} />
                    {/* Syarat Main Sebelum WD */}
                    <ValueBox 
                      label="Syarat Main Sebelum WD" 
                      value={data.turnover_rule_enabled ? data.turnover_rule : 'Tidak aktif'} 
                    />
                  </>
                )}
                {data.reward_mode === 'tier' && (
                  <>
                    {/* Tier Archetype - FIRST */}
                    <ValueBox 
                      label="Arsitektur Tier" 
                      value={TIER_ARCHETYPE_OPTIONS.find(t => t.value === data.tier_archetype)?.label || 'Belum dipilih'} 
                      isBadge
                      badgeVariant="outline"
                    />
                    <ValueBox label="Satuan Poin" value={data.promo_unit?.toUpperCase() || 'LP'} />
                    <ValueBox label="Mode EXP" value={data.exp_mode} />
                    <ValueBox 
                      label={`Basis Perhitungan ${getPointUnitShort(data.promo_unit)}`}
                      value={LP_EARN_BASIS_OPTIONS.find(b => b.value === data.lp_earn_basis)?.label || 'Turnover'} 
                    />
                    <ValueBox 
                      label="Earn Rule" 
                      value={data.lp_earn_amount && data.lp_earn_point_amount 
                        ? `${data.lp_earn_amount.toLocaleString('id-ID')} ${
                            LP_EARN_BASIS_OPTIONS.find(b => b.value === data.lp_earn_basis)?.unit || 'TO'
                          } → ${data.lp_earn_point_amount} ${getPointUnitShort(data.promo_unit)}` 
                        : '-'
                      } 
                    />
                    <ValueBox label="Jumlah Tier" value={`${data.tiers?.length || 0} tier`} />
                    
                    {/* Level Up Rewards (jika ada) */}
                    {data.level_up_rewards && data.level_up_rewards.length > 0 && (
                      <ValueBox 
                        label="Level Up Rewards" 
                        value={`${data.level_up_rewards.length} reward`} 
                      />
                    )}
                    
                    {/* Fast EXP Missions (jika ada) */}
                    {data.fast_exp_missions && data.fast_exp_missions.length > 0 && (
                      <ValueBox 
                        label="Fast EXP Missions" 
                        value={`${data.fast_exp_missions.length} mission`} 
                      />
                    )}
                    
                    {/* Detail Tier Table - Untuk tier_level */}
                    {data.tiers && data.tiers.length > 0 && data.tier_archetype === 'tier_level' && (
                      <div className="col-span-full mt-2">
                        <p className="text-muted-foreground text-xs mb-2">Detail Tier</p>
                        <div className="bg-muted rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-left py-2 px-3 font-medium text-foreground">Level</th>
                                <th className="text-left py-2 px-3 font-medium text-foreground">Min Point</th>
                                <th className="text-left py-2 px-3 font-medium text-foreground">Reward</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.tiers.slice(0, 5).map((tier, idx) => (
                                <tr key={tier.id || idx} className="border-t border-border">
                                  <td className="py-2 px-3 text-foreground">{tier.type || `Tier ${idx + 1}`}</td>
                                  <td className="py-2 px-3 text-foreground">{tier.minimal_point?.toLocaleString('id-ID') || 0}</td>
                                  <td className="py-2 px-3 text-button-hover font-medium">
                                    {tier.reward_type === 'percentage' 
                                      ? `${tier.reward}%` 
                                      : `Rp ${Number(tier.reward).toLocaleString('id-ID')}`}
                                  </td>
                                </tr>
                              ))}
                              {data.tiers.length > 5 && (
                                <tr className="border-t border-border bg-muted/30">
                                  <td colSpan={3} className="py-2 px-3 text-center text-muted-foreground">
                                    +{data.tiers.length - 5} tier lainnya
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    
                    {/* Redeem Items Table - Untuk tier_point_store */}
                    {data.tier_archetype === 'tier_point_store' && data.redeem_items && data.redeem_items.length > 0 && (
                      <div className="col-span-full mt-2">
                        <p className="text-muted-foreground text-xs mb-2">Daftar Hadiah Redeem</p>
                        <div className="bg-muted rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-left py-2 px-3 font-medium text-foreground">Nama Hadiah</th>
                                <th className="text-left py-2 px-3 font-medium text-foreground">Nilai</th>
                                <th className="text-left py-2 px-3 font-medium text-foreground">Biaya {getPointUnitShort(data.promo_unit)}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.redeem_items.slice(0, 5).map((item, idx) => (
                                <tr key={item.id || idx} className="border-t border-border">
                                  <td className="py-2 px-3 text-foreground">{item.nama_hadiah}</td>
                                  <td className="py-2 px-3 text-foreground">Rp {item.nilai_hadiah?.toLocaleString('id-ID') || 0}</td>
                                  <td className="py-2 px-3 text-button-hover font-medium">{item.biaya_lp?.toLocaleString('id-ID') || 0} {getPointUnitShort(data.promo_unit)}</td>
                                </tr>
                              ))}
                              {data.redeem_items.length > 5 && (
                                <tr className="border-t border-border bg-muted/30">
                                  <td colSpan={3} className="py-2 px-3 text-center text-muted-foreground">
                                    +{data.redeem_items.length - 5} hadiah lainnya
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
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
                  onClick={() => onGoToStep?.(4)}
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
                        <p className="text-button-hover font-medium">
                          {sub.calculation_value 
                            ? (sub.calculation_method === 'percentage' 
                                ? `${sub.calculation_value}%` 
                                : formatNumber(sub.calculation_value))
                            : '-'}
                        </p>
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
                        <p className="text-foreground">
                          {/* Prioritize eligible_providers (extracted from "SABUNG AYAM (SV388 & WS168)") over game_providers */}
                          {sub.eligible_providers?.length > 0 
                            ? sub.eligible_providers.join(', ')
                            : sub.game_providers?.length > 0 && !sub.game_providers.includes('ALL')
                              ? sub.game_providers.map(p => GAME_PROVIDERS.find(g => g.value === p)?.label || p).join(', ') 
                              : '-'}
                        </p>
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
                            ? `(Global) ${REWARD_TYPES.find(r => r.value === data.global_jenis_hadiah)?.label || data.global_jenis_hadiah || '-'}${data.global_jenis_hadiah === 'hadiah_fisik' && data.physical_reward_name ? `: ${data.physical_reward_name}${data.physical_reward_quantity && data.physical_reward_quantity > 1 ? ` x${data.physical_reward_quantity}` : ''}` : ''}${data.global_jenis_hadiah === 'uang_tunai' && data.cash_reward_amount ? `: Rp ${formatNumber(data.cash_reward_amount)}` : ''}`
                            : `${REWARD_TYPES.find(r => r.value === sub.jenis_hadiah)?.label || sub.jenis_hadiah || '-'}${sub.jenis_hadiah === 'hadiah_fisik' && sub.physical_reward_name ? `: ${sub.physical_reward_name}${sub.physical_reward_quantity && sub.physical_reward_quantity > 1 ? ` x${sub.physical_reward_quantity}` : ''}` : ''}${sub.jenis_hadiah === 'uang_tunai' && sub.cash_reward_amount ? `: Rp ${formatNumber(sub.cash_reward_amount)}` : ''}`}
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
                
                {/* FIX 3: Percentage Consistency Warning */}
                {(() => {
                  const percentWarning = validatePercentageConsistency(data);
                  if (percentWarning) {
                    return (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-amber-500">{percentWarning}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Perhatikan konsistensi antara nama promo dan nilai formula. Inkonsistensi dapat menyebabkan Livechat memberikan jawaban yang salah.
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
                {/* Detail per Varian - Combined Ilustrasi + S&K */}
                {data.has_subcategories && data.subcategories && data.subcategories.length > 0 ? (
                  <div className="space-y-4">
                    <p className="font-semibold text-foreground">Detail per Varian:</p>
                    
                    {data.subcategories.map((sub, idx) => (
                      <Collapsible key={sub.id || idx} defaultOpen={idx === 0}>
                        <CollapsibleTrigger className="w-full flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:bg-card/80 transition-colors group">
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
                        
                        <CollapsibleContent className="mt-2 border border-border rounded-xl overflow-hidden bg-card">
                          {/* 🔒 EPISTEMIC AUTHORITY: Ilustrasi Perhitungan - ONLY cap if EXPLICIT max_bonus */}
                          {sub.calculation_method === 'percentage' && sub.calculation_value ? (
                            <div className="p-4 border-b border-border">
                              <p className="font-medium text-foreground mb-3 flex items-center gap-2">
                                <span>📊</span> Ilustrasi Perhitungan
                              </p>
                              <table className="w-full text-sm">
                                <thead className="bg-muted/30">
                                  <tr>
                                    <th className="text-left py-1.5 px-3 font-medium text-foreground">
                                      {getBaseColumnLabel(sub.calculation_base)}
                                    </th>
                                    <th className="text-left py-1.5 px-3 font-medium text-muted-foreground">Kalkulasi</th>
                                    <th className="text-left py-1.5 px-3 font-medium text-foreground">Perkiraan Bonus</th>
                                  </tr>
                                </thead>
                                <tbody>
                                {(() => {
                                    // 🔧 FIX: Fixed illustration values (minimum_base = min REWARD threshold, bukan base amount!)
                                    const illustrationAmounts = [1_000_000, 2_000_000, 5_000_000];
                                    return illustrationAmounts.map((amount, i) => {
                                      const rawBonus = amount * (sub.calculation_value / 100);
                                      // 🔒 ONLY cap if max_bonus is EXPLICITLY set!
                                      const maxClaim = getExplicitMaxBonus(sub);
                                      const bonus = Math.min(rawBonus, maxClaim);
                                      const isCapped = bonus < rawBonus;
                                      // 🔒 ONTOLOGY: Check if bonus is below payout threshold
                                      const minClaim = sub.dinamis_min_claim || 0;
                                      const isBelowMinClaim = minClaim > 0 && bonus < minClaim;
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
                                            <span className={isBelowMinClaim ? "text-muted-foreground line-through" : ""}>
                                              Rp {formatNumber(bonus)}{isCapped && ' (max)'}
                                            </span>
                                            {isBelowMinClaim && (
                                              <span className="text-amber-500 text-xs ml-2">*</span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    });
                                  })()}
                                </tbody>
                              </table>
                              {/* 🔒 EPISTEMIC: Show "no max" disclaimer if max_bonus is NOT explicit */}
                              {!hasExplicitMaxBonus(sub) && !sub.dinamis_max_claim_unlimited && (
                                <p className="text-xs text-muted-foreground mt-2 italic">
                                  ⚠️ Tidak ada batas maksimum yang dinyatakan pada promo ini.
                                </p>
                              )}
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
                  /* 🔒 EPISTEMIC AUTHORITY: Single promo mode with ilustrasi - ONLY cap if EXPLICIT */
                  <div className="space-y-4">
                    <p className="font-semibold text-foreground">Ilustrasi Perhitungan</p>
                    
                    <div className="overflow-hidden rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="text-left py-1.5 px-3 font-medium text-foreground">
                              {getBaseColumnLabel(data.calculation_base)}
                            </th>
                            <th className="text-left py-1.5 px-3 font-medium text-muted-foreground">Kalkulasi</th>
                            <th className="text-left py-1.5 px-3 font-medium text-foreground">Perkiraan Bonus</th>
                          </tr>
                        </thead>
                        <tbody>
                        {(() => {
                            // 🔧 FIX: Use dynamic values based on min_calculation (sama dengan Step3Reward)
                            const minBase = data.min_calculation || 1_000_000;
                            const illustrationAmounts = [minBase, minBase * 2, minBase * 5];
                            return illustrationAmounts.map((amount, index) => {
                              const rawBonus = amount * (data.calculation_value / 100);
                              // 🔒 ONLY cap if max_bonus is EXPLICITLY set!
                              const maxClaim = getExplicitMaxBonus(data);
                              const bonus = Math.min(rawBonus, maxClaim);
                              const isCapped = bonus < rawBonus;
                              // 🔒 ONTOLOGY: Check if bonus is below payout threshold
                              const minClaim = data.dinamis_min_claim || 0;
                              const isBelowMinClaim = minClaim > 0 && bonus < minClaim;
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
                                    <span className={isBelowMinClaim ? "text-muted-foreground line-through" : ""}>
                                      Rp {formatNumber(bonus)}{isCapped && ' (max)'}
                                    </span>
                                    {isBelowMinClaim && (
                                      <span className="text-amber-500 text-xs ml-2">*</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                    
                    <p className="text-sm text-amber-500 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      Nilai ini hanya ilustrasi. Nominal akhir diverifikasi oleh Human Agent & sistem.
                    </p>
                    {/* 🔒 EPISTEMIC: Show "no max" disclaimer if max_bonus is NOT explicit */}
                    {!hasExplicitMaxBonus(data) && !data.dinamis_max_claim_unlimited && (
                      <p className="text-xs text-muted-foreground italic">
                        ⚠️ Tidak ada batas maksimum yang dinyatakan pada promo ini.
                      </p>
                    )}
                    
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
                      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 bg-card border border-border rounded-xl hover:bg-card/80 transition-colors group">
                        <div className="flex items-center gap-3">
                          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180 text-muted-foreground" />
                          <span className="font-medium text-foreground">📄 Promo Parent</span>
                          <Badge variant="outline" className="text-xs">
                            {data.promo_name || 'Promo'}
                          </Badge>
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent className="mt-2 border border-border rounded-xl overflow-hidden bg-[#1E1E1E]">
                        <pre className="font-mono text-[12px] leading-[1.6] text-foreground whitespace-pre-wrap break-words p-4 max-h-[200px] overflow-y-auto">
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
                        <CollapsibleTrigger className="w-full flex items-center justify-between p-3 bg-card border border-border rounded-xl hover:bg-card/80 transition-colors group">
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
                        
                        <CollapsibleContent className="mt-2 border border-border rounded-xl overflow-hidden bg-[#1E1E1E]">
                          <pre className="font-mono text-[12px] leading-[1.6] text-foreground whitespace-pre-wrap break-words p-4 max-h-[200px] overflow-y-auto">
                            {JSON.stringify(sub, null, 2)}
                          </pre>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </>
                ) : (
                  /* Single promo mode - show full JSON */
                  <div className="rounded-xl overflow-hidden bg-[#1E1E1E] border border-border">
                    <pre className="font-mono text-[12px] leading-[1.6] text-foreground whitespace-pre-wrap break-words p-4 max-h-[300px] overflow-y-auto">
                      {JSON.stringify(pkbPayload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </Card>
  );
}
