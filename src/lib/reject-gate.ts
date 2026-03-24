/**
 * REJECT GATE v2.0 — Anthropic via ai-proxy
 *
 * Two-level input filter that runs BEFORE the Q1-Q4 classifier and extractor.
 * Purpose: discard garbage input before spending LLM tokens.
 *
 * Flow:
 *   Input → L1 (rule-based) → L2 (LLM lightweight via Anthropic) → Q1-Q4 Classifier → Extractor
 *
 * @version 2.0
 */

import { callAI, extractJSON } from './ai-client';

// ============================================================================
// TYPES
// ============================================================================

export type RejectReason =
  | 'L1_NO_PROMO_SIGNAL'    // No number + reward keyword + mechanic keyword combo
  | 'L1_TOO_SHORT'           // Input < 20 chars (plainly not a promo)
  | 'L2_NOT_A_PROMO'         // LLM says not a valid promo
  | 'L2_ERROR_PASS'          // L2 failed (network/parse), pass through anyway
  | null;                    // valid — no reject

export interface RejectGateResult {
  valid: boolean;
  reason: RejectReason;
  skip_llm: boolean;
  /** L2 hint when available */
  promo_type_hint?: string;
  /** L2 explanation when rejected */
  l2_reason?: string;
  /** Which level made the decision */
  level: 'L1' | 'L2' | 'PASS';
}

// ============================================================================
// L1 RULE-BASED KEYWORDS (Indonesian + English)
// ============================================================================

const NUMBER_PATTERN = /\d/;

const REWARD_KEYWORDS: RegExp = new RegExp(
  [
    'bonus', 'freechip', 'free chip', 'cashback', 'cash back',
    'komisi', 'hadiah', 'poin', 'point', 'rollingan', 'rolling',
    'diskon', 'rebate', 'reward', 'prize', 'jackpot', 'kredit',
    'voucher', 'free ?bet', 'free ?spin', 'free ?play',
    'loyalty', 'loyalti', 'referral', 'referensi',
    // Lucky Spin / ticket-based rewards
    'tiket', 'ticket', 'lucky.?spin', 'lucky.?draw', 'spin',
  ].join('|'),
  'i'
);

const MECHANIC_KEYWORDS: RegExp = new RegExp(
  [
    'deposit', 'setor', 'turnover', 'to\\b', 'referral', 'refer',
    'daftar', 'register', 'klaim', 'claim', 'syarat', 'minimal',
    'minimum', 'withdraw', 'wd\\b', 'taruhan', 'bet', 'main',
    'transaksi', 'transaction', 'periode', 'berlaku',
    'member', 'player', 'akun', 'account',
    // Ticket mechanic signals
    'reset', 'per hari', 'setiap hari', 'harian',
  ].join('|'),
  'i'
);

// ============================================================================
// L1 — RULE-BASED GATE (no LLM)
// ============================================================================

export function runL1Gate(input: string): { pass: boolean; reason: RejectReason } {
  const text = input.trim();

  if (text.length < 20) {
    return { pass: false, reason: 'L1_TOO_SHORT' };
  }

  const hasNumber = NUMBER_PATTERN.test(text);
  const hasReward = REWARD_KEYWORDS.test(text);
  const hasMechanic = MECHANIC_KEYWORDS.test(text);

  // Need at least: 1 number + 1 reward keyword + 1 mechanic keyword
  if (!hasNumber || !hasReward || !hasMechanic) {
    return { pass: false, reason: 'L1_NO_PROMO_SIGNAL' };
  }

  return { pass: true, reason: null };
}

// ============================================================================
// L2 — LLM LIGHTWEIGHT GATE
// ============================================================================

export interface L2GateResult {
  is_valid_promo: boolean;
  reason: string;
  promo_type_hint: string;
}

const L2_SYSTEM_PROMPT = `You are a strict iGaming promo validator. Your job is to decide if a text is a real, extractable iGaming promotion or bonus description.

Return ONLY valid JSON, no markdown, no explanation:
{ "is_valid_promo": boolean, "reason": string, "promo_type_hint": string }

promo_type_hint examples: "deposit_bonus", "cashback", "referral", "loyalty_tier", "free_spin", "event", "unknown"

Reject (is_valid_promo: false) if:
- It's generic marketing text with no extractable promo rules
- It's a news article, review, or non-structured text
- It's plainly not about a casino/betting promotion
- It has promo keywords but no actual rules to extract`;

export async function runL2Gate(input: string): Promise<L2GateResult> {
  const truncated = input.slice(0, 800); // lightweight — cap tokens

  const response = await callAI({
    type: 'reject_gate',
    system: L2_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Apakah teks ini adalah deskripsi promo/bonus iGaming yang valid dan bisa di-extract?\n\n${truncated}`,
      },
    ],
    temperature: 0,
  });

  return extractJSON<L2GateResult>(response);
}

// ============================================================================
// MAIN: runRejectGate
// ============================================================================

/**
 * Run L1 (rule-based) then L2 (LLM) reject gate on raw promo input.
 * Returns RejectGateResult with valid flag and skip_llm directive.
 *
 * @param input - Raw promo text from user or scraper
 * @param skipL2 - Force skip L2 (for testing or cost-saving mode)
 */
export async function runRejectGate(
  input: string,
  skipL2 = false
): Promise<RejectGateResult> {
  // ── L1 ──────────────────────────────────────────────────────────────────
  const l1 = runL1Gate(input);
  if (!l1.pass) {
    return {
      valid: false,
      reason: l1.reason,
      skip_llm: true,
      level: 'L1',
    };
  }

  // ── Skip L2 when requested (testing / cost-save mode) ───────────────────
  if (skipL2) {
    return { valid: true, reason: null, skip_llm: false, level: 'PASS' };
  }

  // ── L2 ──────────────────────────────────────────────────────────────────
  try {
    const l2 = await runL2Gate(input);

    if (!l2.is_valid_promo) {
      return {
        valid: false,
        reason: 'L2_NOT_A_PROMO',
        skip_llm: true,
        l2_reason: l2.reason,
        promo_type_hint: l2.promo_type_hint,
        level: 'L2',
      };
    }

    return {
      valid: true,
      reason: null,
      skip_llm: false,
      promo_type_hint: l2.promo_type_hint,
      level: 'L2',
    };
  } catch (err) {
    // L2 failure is non-fatal → pass through (don't block on network issues)
    console.warn('[RejectGate] L2 failed, passing through:', err);
    return {
      valid: true,
      reason: 'L2_ERROR_PASS',
      skip_llm: false,
      level: 'PASS',
    };
  }
}
