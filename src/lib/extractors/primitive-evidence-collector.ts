/**
 * EVIDENCE COLLECTOR v1.0
 * Regex sebagai HINT, bukan DECISION.
 * Returns evidence untuk primitive inference.
 * 
 * PRINSIP KRITIS:
 * - Regex mengumpulkan EVIDENCE (bukti)
 * - Evidence dikirim ke Primitive Gate untuk DECISION
 * - Regex TIDAK PERNAH langsung menentukan mode
 * 
 * VERSION: v1.0.0+2025-01-14
 */

import type { TaskDomain, RewardNature } from './promo-primitive-gate';

// ============================================
// EVIDENCE INTERFACE
// ============================================

export interface PrimitiveEvidence {
  // Domain hints (where is the trigger happening?)
  platform_hints: string[];    // APK, install, download, register
  financial_hints: string[];   // Deposit, WD, turnover, loss
  gameplay_hints: string[];    // Bet, spin, scatter, win
  temporal_hints: string[];    // Birthday, anniversary, daily
  access_hints: string[];      // VIP, level, unlock, privilege
  
  // Reward nature hints (how is the reward determined?)
  calculated_hints: string[];  // %, dari, berdasarkan
  tiered_hints: string[];      // Level, tier, threshold, tier table
  chance_hints: string[];      // Spin, gacha, raffle, lottery, wheel
}

// ============================================
// MAIN EVIDENCE COLLECTOR
// ============================================

/**
 * collectPrimitiveEvidence
 * 
 * Scans promo content for hints about task_domain and reward_nature.
 * Returns arrays of matched patterns - these are EVIDENCE, not DECISIONS.
 */
export function collectPrimitiveEvidence(content: string): PrimitiveEvidence {
  const lower = content.toLowerCase();
  
  return {
    // ====================================
    // DOMAIN HINTS
    // ====================================
    
    platform_hints: extractMatches(lower, [
      /download\s*(apk|aplikasi)/,
      /pengguna\s*apk/,
      /khusus\s*apk/,
      /install\s*(app|aplikasi)/,
      /via\s*aplikasi/,
      /unduh\s*(app|apk|aplikasi)/,
      /member\s*apk/,
      /apk\s*(user|member|pengguna)/,
      /promo\s*apk/,
      /freechip\s*apk/,
      /bonus\s*apk/,
      /penukaran.*apk/,
    ]),
    
    financial_hints: extractMatches(lower, [
      /deposit/,
      /withdraw|wd|penarikan/,
      /turnover|to\b/,
      /loss|kekalahan/,
      /minimal\s*(depo|wd|deposit)/,
      /\b(dari|of)\s*(deposit|wd|loss|turnover)/,
      /cashback/,
      /rollingan/,
      /komisi/,
      /bonus\s*\d+\s*%/,
    ]),
    
    gameplay_hints: extractMatches(lower, [
      /\bbetting?\b/,
      /spin\s*slot/,
      /scatter/,
      /jackpot/,
      /provider\s*(pragmatic|pgsoft|habanero)/,
      /slot\s*game/,
      /live\s*casino/,
      /sportbook/,
    ]),
    
    temporal_hints: extractMatches(lower, [
      /birthday|ultah|ulang\s*tahun/,
      /anniversary|anniversari/,
      /daily|harian/,
      /mingguan|weekly/,
      /bulanan|monthly/,
      /hari\s*raya/,
      /tahun\s*baru/,
      /imlek/,
    ]),
    
    access_hints: extractMatches(lower, [
      /vip\s*(level)?/,
      /unlock/,
      /privilege/,
      /redemption\s*store/,
      /level\s*\d/,
      /akses\s*(khusus)?/,
      /naik\s*level/,
      /level\s*up/,
      /rank\s*up/,
    ]),
    
    // ====================================
    // REWARD NATURE HINTS
    // ====================================
    
    calculated_hints: extractMatches(lower, [
      /\d+\s*%/,
      /dari\s*(deposit|turnover|loss|wd)/,
      /bonus\s*\d+\s*%/,
      /cashback\s*\d+/,
      /berdasarkan\s*(deposit|turnover|loss)/,
      /x\s*\d+\s*dari/,
      /perhitungan/,
      /kalkulasi/,
    ]),
    
    tiered_hints: extractMatches(lower, [
      /level\s*\d/,
      /tier\s*\d/,
      /threshold/,
      /\d+[jmt]\s*[→=]\s*(rp)?\s*\d+/,
      /minimal.*dapat/,
      /\d+\s*-\s*\d+\s*[jmt]/,
      /hadiah\s*(mobil|motor|hp|iphone)/,
      /to\s+\d+[jmt]/,
    ]),
    
    chance_hints: extractMatches(lower, [
      /lucky\s*spin/,
      /gacha/,
      /raffle/,
      /lottery/,
      /wheel/,
      /undian/,
      /random/,
      /tiket\s*spin/,
      /spin\s*gratis/,
      /free\s*spin/,
    ]),
  };
}

// ============================================
// EVIDENCE INFERENCE FUNCTIONS
// ============================================

/**
 * inferTaskDomain
 * 
 * Infers task_domain from collected evidence.
 * Priority order ensures proper domain classification.
 * 
 * PRIORITY:
 * 1. financial (if has financial hints AND calculated hints)
 * 2. platform (if has platform hints)
 * 3. access (if has access hints)
 * 4. gameplay (if has gameplay hints)
 * 5. temporal (if has temporal hints)
 * 6. 'platform' as default
 * 
 * SPECIAL CASE:
 * If platform_hints AND financial_hints + calculated_hints exist,
 * we check which is the "primary trigger" vs "constraint":
 * - "APK + 5% dari deposit" → financial (APK is constraint)
 * - "Download APK dapat freechip" → platform (APK is trigger)
 */
export function inferTaskDomain(
  evidence: PrimitiveEvidence, 
  content?: string
): TaskDomain {
  const hasCalculated = evidence.calculated_hints.length > 0;
  const hasFinancial = evidence.financial_hints.length > 0;
  const hasPlatform = evidence.platform_hints.length > 0;
  
  // SPECIAL CASE: APK promo with calculation
  // If there's calculation AND platform hint, check which is primary
  if (hasPlatform && hasFinancial && hasCalculated) {
    // If content mentions "X% dari deposit/loss/turnover", financial is primary
    const lower = (content || '').toLowerCase();
    if (/\d+\s*%\s*(dari|of)\s*(deposit|loss|turnover|wd)/i.test(lower)) {
      return 'financial';
    }
    // Otherwise, platform is primary (APK freechip case)
  }
  
  // Priority order for single-domain cases
  if (hasFinancial && hasCalculated) return 'financial';
  if (hasPlatform) return 'platform';
  if (evidence.access_hints.length > 0) return 'access';
  if (evidence.gameplay_hints.length > 0) return 'gameplay';
  if (evidence.temporal_hints.length > 0) return 'temporal';
  
  // Conservative default
  return 'platform';
}

/**
 * inferRewardNature
 * 
 * Infers reward_nature from collected evidence.
 * Priority order ensures proper classification.
 * 
 * PRIORITY:
 * 1. chance (if has chance hints)
 * 2. tiered (if has tiered hints)
 * 3. calculated (if has calculated hints)
 * 4. 'fixed' as default
 */
export function inferRewardNature(evidence: PrimitiveEvidence): RewardNature {
  // Priority: chance > tiered > calculated > fixed
  if (evidence.chance_hints.length > 0) return 'chance';
  if (evidence.tiered_hints.length > 0) return 'tiered';
  if (evidence.calculated_hints.length > 0) return 'calculated';
  
  // Conservative default
  return 'fixed';
}

// ============================================
// APK CONSTRAINT DETECTOR
// ============================================

/**
 * hasApkConstraint
 * 
 * Checks if APK is mentioned as a CONSTRAINT (not necessarily the trigger).
 * Returns true if user must have APK to claim the promo.
 * 
 * This is separate from task_domain detection.
 * APK can be a constraint for ANY task_domain.
 */
export function hasApkConstraint(evidence: PrimitiveEvidence): boolean {
  return evidence.platform_hints.length > 0 && 
    evidence.platform_hints.some(hint => 
      hint.includes('apk') || 
      hint.includes('aplikasi') ||
      hint.includes('download')
    );
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * extractMatches
 * 
 * Extracts all regex matches from text.
 * Returns array of matched strings.
 */
function extractMatches(text: string, patterns: RegExp[]): string[] {
  const matches: string[] = [];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) matches.push(match[0]);
  }
  return matches;
}

/**
 * summarizeEvidence
 * 
 * Creates a human-readable summary of collected evidence.
 * Useful for debugging and logging.
 */
export function summarizeEvidence(evidence: PrimitiveEvidence): string {
  const parts: string[] = [];
  
  if (evidence.platform_hints.length > 0) {
    parts.push(`platform[${evidence.platform_hints.join(',')}]`);
  }
  if (evidence.financial_hints.length > 0) {
    parts.push(`financial[${evidence.financial_hints.join(',')}]`);
  }
  if (evidence.gameplay_hints.length > 0) {
    parts.push(`gameplay[${evidence.gameplay_hints.join(',')}]`);
  }
  if (evidence.temporal_hints.length > 0) {
    parts.push(`temporal[${evidence.temporal_hints.join(',')}]`);
  }
  if (evidence.access_hints.length > 0) {
    parts.push(`access[${evidence.access_hints.join(',')}]`);
  }
  if (evidence.calculated_hints.length > 0) {
    parts.push(`calculated[${evidence.calculated_hints.join(',')}]`);
  }
  if (evidence.tiered_hints.length > 0) {
    parts.push(`tiered[${evidence.tiered_hints.join(',')}]`);
  }
  if (evidence.chance_hints.length > 0) {
    parts.push(`chance[${evidence.chance_hints.join(',')}]`);
  }
  
  return parts.join(' | ') || 'no evidence';
}

// ============================================
// VERSION
// ============================================

export const EVIDENCE_COLLECTOR_VERSION = 'v1.0.0+2025-01-14';
