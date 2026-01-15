/**
 * EVIDENCE COLLECTOR v1.2.1 — HARD FREEZE
 * Regex sebagai HINT, bukan DECISION.
 * Returns evidence untuk primitive inference.
 * 
 * ⛔ MODE DECISION FORBIDDEN HERE
 * This file may NOT assign: mode, reward_mode, category
 * Mode decisions live ONLY in: promo-primitive-gate.ts
 * Violation = Architecture breach
 * 
 * ⚠️ REGEX INFLATION FORBIDDEN
 * 
 * DO NOT ADD REGEX TO FIX A SINGLE PROMO.
 * Regexes generate SIGNALS, not DECISIONS.
 * 
 * If a promo fails:
 * 1. Check the gate logic first
 * 2. Update the Signal Contract if needed
 * 3. Only then consider adding evidence patterns
 * 
 * Every new regex must be documented in the Signal Contract.
 * 
 * SIGNAL CONTRACT: docs/architecture/promo-primitive-gate.signal-contract.md
 * 
 * VERSION: v1.2.1+2025-01-14 (FROZEN)
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
    
    // v1.2: Split "level" pattern — access = VIP/privilege context
    access_hints: extractMatches(lower, [
      /vip\s*(level)?\s*\d*/,        // VIP Level 5 (privilege)
      /unlock/,
      /privilege/,
      /redemption\s*store/,
      /akses\s*(khusus)?/,
      /naik\s*level/,                // Naik level (status change)
      /level\s*up/,                  // Level up (status change)
      /rank\s*up/,
      /member\s*(vip|gold|silver|platinum)/,
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
    
    // v1.2: Split "level" pattern — tiered = threshold table context
    // v1.2.2: REMOVED /minimal.*dapat/ - caused false positives with eligibility thresholds
    // e.g., "Minimal WD sebesar 200.000 bar dapat melakukan claim" is NOT a tier indicator
    tiered_hints: extractMatches(lower, [
      /level\s*\d+\s*[→=:]\s*\d/,    // Level 1 → 100rb (tier indicator)
      /tier\s*\d/,
      /threshold/,
      /\d+[jmt]\s*[→=]\s*(rp)?\s*\d+/,
      // ❌ REMOVED: /minimal.*dapat/ - false positive for "Minimal WD 200rb bar dapat claim"
      /\d+\s*-\s*\d+\s*[jmt]/,
      /hadiah\s*(mobil|motor|hp|iphone)/,
      /to\s+\d+[jmt]/,
      /bronze|silver|gold|platinum\s*[→=:]/,  // Tier names with arrow
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
  
  // SPECIAL CASE: APK promo with calculation (v1.2 — expanded)
  // If there's calculation AND platform hint, check which is primary
  if (hasPlatform && hasFinancial && hasCalculated) {
    const lower = (content || '').toLowerCase();
    
    // v1.2: More inclusive pattern for financial calculation detection
    const hasFinancialCalculation = 
      // Original pattern (strict)
      /\d+\s*%\s*(dari|of)\s*(deposit|loss|turnover|wd)/i.test(lower) ||
      // New patterns (inclusive) — "Bonus 10% untuk pengguna APK"
      /(cashback|bonus|rebate)\s*\d+\s*%/i.test(lower) ||
      /\d+\s*%\s*(untuk|khusus)?\s*(member|apk|pengguna)/i.test(lower) ||
      /(rollingan|komisi)\s*\d+/i.test(lower);
    
    if (hasFinancialCalculation) {
      return 'financial'; // Financial is primary, APK is constraint
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
// CONFIDENCE SCORING (v1.2)
// ============================================

export interface PrimitiveInference {
  task_domain: TaskDomain;
  reward_nature: RewardNature;
  confidence: 'high' | 'medium' | 'low';
  ambiguity_flags: string[];
}

/**
 * inferPrimitivesWithConfidence
 * 
 * Infers task_domain and reward_nature with confidence scoring.
 * Returns ambiguity flags for cases that need human review.
 */
export function inferPrimitivesWithConfidence(
  evidence: PrimitiveEvidence,
  content?: string
): PrimitiveInference {
  const domain = inferTaskDomain(evidence, content);
  const nature = inferRewardNature(evidence);
  
  const ambiguity_flags: string[] = [];
  let confidence: 'high' | 'medium' | 'low' = 'high';
  
  // ====================================
  // Check for conflicting evidence
  // ====================================
  
  // Platform + Financial conflict (APK + Deposit/Cashback)
  if (evidence.platform_hints.length > 0 && evidence.financial_hints.length > 0) {
    ambiguity_flags.push('platform_financial_conflict');
    confidence = 'medium';
  }
  
  // Access + Tiered overlap (VIP level table vs VIP unlock)
  if (evidence.access_hints.length > 0 && evidence.tiered_hints.length > 0) {
    ambiguity_flags.push('access_tiered_overlap');
    confidence = 'medium';
  }
  
  // v1.2.1: Access + Fixed without explicit tier table (might be tier in disguise)
  // "VIP Level 5 bonus 50k" - single level might be part of a larger tier structure
  if (domain === 'access' && nature === 'fixed' && evidence.tiered_hints.length === 0) {
    const hasExplicitTierTable = evidence.tiered_hints.some(h => 
      /level\s*\d+\s*[→=:]\s*\d/.test(h) || /tier\s*\d/.test(h)
    );
    if (!hasExplicitTierTable && evidence.access_hints.length > 0) {
      ambiguity_flags.push('access_single_level_reward');
      // Don't downgrade confidence - just flag for review
    }
  }
  
  // Calculated + Chance conflict (shouldn't happen)
  if (evidence.calculated_hints.length > 0 && evidence.chance_hints.length > 0) {
    ambiguity_flags.push('calculated_chance_conflict');
    confidence = 'medium';
  }
  
  // ====================================
  // Check for no/minimal evidence
  // ====================================
  const totalHints = [
    ...evidence.platform_hints,
    ...evidence.financial_hints,
    ...evidence.gameplay_hints,
    ...evidence.temporal_hints,
    ...evidence.access_hints,
    ...evidence.calculated_hints,
    ...evidence.tiered_hints,
    ...evidence.chance_hints,
  ].length;
  
  if (totalHints === 0) {
    ambiguity_flags.push('no_evidence');
    confidence = 'low';
  } else if (totalHints <= 2) {
    ambiguity_flags.push('minimal_hints');
    if (confidence === 'high') confidence = 'medium';
  }
  
  return {
    task_domain: domain,
    reward_nature: nature,
    confidence,
    ambiguity_flags,
  };
}

// ============================================
// VERSION
// ============================================

export const EVIDENCE_COLLECTOR_VERSION = 'v1.2.1+2025-01-14 (FROZEN)';
