/**
 * REJECT GATE UNIT TESTS v1.0
 *
 * Tests L1 rule-based gate only (L2 requires live API — skip in unit tests).
 * 8 test cases covering all rejection and pass scenarios.
 */

import { describe, it, expect } from 'vitest';
import { runL1Gate, runRejectGate } from '../reject-gate';

// ============================================================================
// L1 UNIT TESTS
// ============================================================================

describe('RejectGate — L1 Rule-Based', () => {
  // Case 1: gibberish / random text
  it('C1: should reject gibberish with no promo signal', () => {
    const result = runL1Gate('asdfghjkl qwerty zxcvbn lorem ipsum dolor sit amet');
    expect(result.pass).toBe(false);
    expect(result.reason).toBe('L1_NO_PROMO_SIGNAL');
  });

  // Case 2: too short
  it('C2: should reject input that is too short', () => {
    const result = runL1Gate('bonus 50rb');
    expect(result.pass).toBe(false);
    expect(result.reason).toBe('L1_TOO_SHORT');
  });

  // Case 3: numbers only, no reward or mechanic keyword
  it('C3: should reject text with numbers but no reward/mechanic keywords', () => {
    const result = runL1Gate('100 200 300 500 1000 jadwal liga champions 2025 pertandingan final');
    expect(result.pass).toBe(false);
    expect(result.reason).toBe('L1_NO_PROMO_SIGNAL');
  });

  // Case 4: reward keyword but no number and no mechanic
  it('C4: should reject text with reward keyword but missing number and mechanic', () => {
    const result = runL1Gate('Dapatkan hadiah menarik setiap hari untuk semua member setia kami yang aktif bermain');
    expect(result.pass).toBe(false);
    expect(result.reason).toBe('L1_NO_PROMO_SIGNAL');
  });

  // Case 5: valid standard deposit bonus
  it('C5: should PASS valid deposit bonus promo', () => {
    const result = runL1Gate(
      'Bonus Deposit 100% hingga 500rb. Minimal deposit 50rb. Syarat turnover 5x dari total deposit + bonus.'
    );
    expect(result.pass).toBe(true);
    expect(result.reason).toBeNull();
  });

  // Case 6: valid referral promo
  it('C6: should PASS valid referral promo', () => {
    const result = runL1Gate(
      'Komisi Referral 10%. Ajak teman daftar dan deposit minimal 100rb. Dapatkan 10% dari setiap turnover member referral Anda.'
    );
    expect(result.pass).toBe(true);
    expect(result.reason).toBeNull();
  });

  // Case 7: valid cashback / rollingan
  it('C7: should PASS valid cashback promo', () => {
    const result = runL1Gate(
      'Cashback mingguan 5% untuk semua member. Minimal turnover 1 juta dalam periode 7 hari. Klaim setiap Senin.'
    );
    expect(result.pass).toBe(true);
    expect(result.reason).toBeNull();
  });

  // Case 8: promo-adjacent but no actual rules (marketing fluff)
  it('C8: should reject marketing fluff with reward word but no mechanic number combo', () => {
    const result = runL1Gate(
      'Kami memberikan pengalaman bermain terbaik dengan bonus yang menggiurkan dan layanan pelanggan prima'
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toBe('L1_NO_PROMO_SIGNAL');
  });
});

// ============================================================================
// runRejectGate INTEGRATION (L2 skipped — skipL2=true)
// ============================================================================

describe('RejectGate — runRejectGate (L2 skipped)', () => {
  it('should return valid=false level=L1 for gibberish', async () => {
    const result = await runRejectGate('qwerty asdf lorem ipsum dolor', true);
    expect(result.valid).toBe(false);
    expect(result.level).toBe('L1');
    expect(result.skip_llm).toBe(true);
  });

  it('should return valid=true level=PASS for valid referral promo', async () => {
    const result = await runRejectGate(
      'Komisi Referral 10%. Ajak teman daftar dan deposit minimal 100rb. Dapatkan 10% dari turnover member.',
      true
    );
    expect(result.valid).toBe(true);
    expect(result.level).toBe('PASS');
    expect(result.skip_llm).toBe(false);
  });

  it('should return valid=false level=L1 for too-short input', async () => {
    const result = await runRejectGate('bonus 50', true);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('L1_TOO_SHORT');
    expect(result.level).toBe('L1');
  });
});
