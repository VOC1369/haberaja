/**
 * WITHDRAW BONUS ARCHETYPE v1.3
 * Part of PROMO PATTERN TAXONOMY
 * 
 * Evidence-First Architecture — NO DEFAULT ASSUMPTIONS
 * 
 * trigger_event: Withdraw
 * calculation_basis: 
 *   - 'withdraw' → 5% dari nilai WD (payout = AFTER, wajib)
 *   - 'turnover' → 5% dari TO, klaim saat WD (payout = from S&K)
 * 
 * RULES:
 * 1. calculation_basis MUST be inferred from evidence, NO DEFAULT
 * 2. If basis = withdraw → payout = after (MANDATORY)
 * 3. If basis = turnover → payout = infer from S&K
 * 4. If no evidence → confidence = low, flag for review
 */

export interface WithdrawBonusConfig {
  trigger_event: 'Withdraw';
  calculation_basis: 'withdraw' | 'turnover' | null;
  payout_direction: 'before' | 'after';
  
  // Constraints
  turnover_multiplier: number | null;  // e.g., 1x
  min_calculation: number | null;       // Min WD threshold
  
  // Evidence tracking
  calculation_evidence?: string;  // e.g., "WD 500.000 × 5%"
  payout_evidence?: string;       // e.g., "sebelum/setelah WD"
}

export interface WithdrawBonusInference {
  config: Partial<WithdrawBonusConfig>;
  confidence: 'high' | 'medium' | 'low';
  flags: string[];
}

/**
 * Infer Withdraw Bonus configuration from promo terms
 * 
 * Detection Priority:
 * 1. Explicit Calculation Example (HIGH confidence)
 *    - "WD 500.000 × 5% = 25.000" → calculation_basis: 'withdraw'
 *    - "TO 1.000.000 × 5% = 50.000" → calculation_basis: 'turnover'
 * 
 * 2. "dari X" Statement (MEDIUM confidence)
 *    - "dari WD" → calculation_basis: 'withdraw'
 *    - "dari turnover" → calculation_basis: 'turnover'
 * 
 * 3. NO EVIDENCE (LOW confidence)
 *    - calculation_basis: null
 *    - Flag for human review
 */
export function inferWithdrawBonusConfig(
  terms: string,
  promoName: string
): WithdrawBonusInference {
  const flags: string[] = [];
  let confidence: 'high' | 'medium' | 'low' = 'high';
  
  const combinedText = `${promoName} ${terms}`.toLowerCase();
  
  // ============================================
  // CALCULATION BASIS DETECTION
  // ============================================
  
  // PRIORITY 1: Explicit calculation examples (HIGH confidence)
  const withdrawCalcPattern = /(?:wd|withdraw|penarikan)\s*[\d.,]+\s*[×x]\s*\d+\s*%/i;
  const turnoverCalcPattern = /(?:to|turnover)\s*[\d.,]+\s*[×x]\s*\d+\s*%/i;
  
  // PRIORITY 2: "dari X" statements (MEDIUM confidence)
  const dariWithdrawPattern = /(?:dari|berdasarkan)\s*(?:wd|withdraw|penarikan|nilai\s*(?:wd|withdraw))/i;
  const dariTurnoverPattern = /(?:dari|berdasarkan)\s*(?:to|turnover)/i;
  
  let calculation_basis: 'withdraw' | 'turnover' | null = null;
  let calculation_evidence: string | undefined;
  
  // PRIORITY 1: Explicit calculation examples
  const withdrawCalcMatch = combinedText.match(withdrawCalcPattern);
  const turnoverCalcMatch = combinedText.match(turnoverCalcPattern);
  
  if (withdrawCalcMatch) {
    calculation_basis = 'withdraw';
    calculation_evidence = withdrawCalcMatch[0];
    confidence = 'high';
  } else if (turnoverCalcMatch) {
    calculation_basis = 'turnover';
    calculation_evidence = turnoverCalcMatch[0];
    confidence = 'high';
  }
  // PRIORITY 2: "dari X" statements
  else if (dariWithdrawPattern.test(combinedText)) {
    calculation_basis = 'withdraw';
    calculation_evidence = combinedText.match(dariWithdrawPattern)?.[0];
    confidence = 'medium';
  } else if (dariTurnoverPattern.test(combinedText)) {
    calculation_basis = 'turnover';
    calculation_evidence = combinedText.match(dariTurnoverPattern)?.[0];
    confidence = 'medium';
  }
  // NO EVIDENCE
  else {
    calculation_basis = null;
    confidence = 'low';
    flags.push('missing_calculation_evidence');
  }
  
  // ============================================
  // PAYOUT DIRECTION DETECTION (Conditional)
  // ============================================
  
  let payout_direction: 'before' | 'after' = 'after';
  let payout_evidence: string | undefined;
  
  if (calculation_basis === 'withdraw') {
    // MANDATORY: Bonus = f(WD) → WD must happen first → AFTER
    payout_direction = 'after';
    payout_evidence = 'calculation_basis=withdraw → payout=after (MANDATORY)';
  } else if (calculation_basis === 'turnover') {
    // Conditional: Bonus = f(TO), WD is just gate → infer from S&K
    const hasBeforeEvidence = /sebelum\s*(?:wd|withdraw|deposit)/i.test(combinedText);
    const hasAfterEvidence = /setelah\s*(?:wd|withdraw)/i.test(combinedText);
    
    if (hasBeforeEvidence) {
      payout_direction = 'before';
      payout_evidence = 'S&K mentions "sebelum WD"';
    } else if (hasAfterEvidence) {
      payout_direction = 'after';
      payout_evidence = 'S&K mentions "setelah WD"';
    } else {
      // Default to after for turnover-based (conservative)
      payout_direction = 'after';
      payout_evidence = 'No explicit timing → default after';
    }
  } else {
    // No calculation basis evidence → default after, flag
    payout_direction = 'after';
    payout_evidence = 'No calculation_basis → default after (LOW CONFIDENCE)';
    if (!flags.includes('missing_calculation_evidence')) {
      flags.push('missing_payout_evidence');
    }
  }
  
  // ============================================
  // TURNOVER MULTIPLIER EXTRACTION
  // ============================================
  
  let turnover_multiplier: number | null = null;
  const toMultiplierPattern = /(?:to|turnover)\s*x?\s*(\d+)/i;
  const minimalToPattern = /minimal\s*to\s*x?\s*(\d+)/i;
  
  const toMatch = combinedText.match(minimalToPattern) || combinedText.match(toMultiplierPattern);
  if (toMatch) {
    turnover_multiplier = parseInt(toMatch[1], 10);
  }
  
  // ============================================
  // MIN CALCULATION (Min WD) EXTRACTION
  // ============================================
  
  let min_calculation: number | null = null;
  const minWDPattern = /min(?:imal|imum)?\s*(?:wd|withdraw|penarikan)\s*(?:sebesar\s*)?(?:rp\.?|idr)?[\s:]*([0-9.,]+)\s*(?:jt|juta|rb|ribu|k)?/i;
  
  const minWDMatch = combinedText.match(minWDPattern);
  if (minWDMatch) {
    const rawNum = minWDMatch[1].replace(/[.,]/g, '');
    let amount = parseInt(rawNum, 10);
    const suffix = minWDMatch[0].toLowerCase();
    if (/jt|juta/i.test(suffix) && amount < 1000) amount *= 1_000_000;
    else if (/rb|ribu|k/i.test(suffix) && amount < 10000) amount *= 1000;
    min_calculation = amount;
  }
  
  return {
    config: {
      trigger_event: 'Withdraw',
      calculation_basis,
      payout_direction,
      turnover_multiplier,
      min_calculation,
      calculation_evidence,
      payout_evidence,
    },
    confidence,
    flags,
  };
}

/**
 * Check if promo is a Withdraw Bonus
 */
export function isWithdrawBonusPromo(promoName: string, triggerEvent?: string): boolean {
  if (triggerEvent === 'Withdraw') return true;
  
  const name = promoName.toLowerCase();
  return (
    /bonus\s*(extra\s*)?(wd|withdraw|penarikan)/i.test(name) ||
    /extra\s*wd/i.test(name) ||
    /wd\s*bonus/i.test(name)
  );
}
