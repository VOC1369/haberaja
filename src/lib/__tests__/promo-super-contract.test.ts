/**
 * PROMO SUPER CONTRACT Test Suite
 * Tests the 3-GATE classification logic
 * 
 * PROMO = Trigger + Benefit + Constraints (semua harus ada)
 * BUKAN PROMO = salah satu tidak ada
 */

import { describe, it, expect } from 'vitest';
import { calculateCategory, getCategoryName, getPromoCategory, isSystemRule } from '../extractors/category-classifier';

describe('PROMO SUPER CONTRACT - calculateCategory (3-Gate)', () => {
  // ============================================
  // PROMO CASES (semua 3 pintu TRUE)
  // ============================================
  
  describe('Valid Promos (All 3 Gates TRUE)', () => {
    it('T1: Birthday Bonus → PROMO (A)', () => {
      // Trigger: moment (birthday)
      // Benefit: credit (freechip)
      // Constraints: TO requirement
      const result = calculateCategory(true, true, true, 'REWARD');
      expect(result).toBe('A');
      expect(getCategoryName(result)).toBe('Reward Program');
      expect(isSystemRule(result)).toBe(false);
    });

    it('T2: APK Download Freechip → PROMO (A)', () => {
      // Trigger: action (download)
      // Benefit: credit (freechip)
      // Constraints: redeem via CS
      const result = calculateCategory(true, true, true, 'REWARD');
      expect(result).toBe('A');
    });

    it('T3: Deposit Pulsa No Fee → PROMO (A)', () => {
      // Trigger: action (deposit)
      // Benefit: cost_reduction (tanpa potongan)
      // Constraints: TO 5x, min deposit
      const result = calculateCategory(true, true, true, 'REWARD');
      expect(result).toBe('A');
    });

    it('T4: Lucky Spin → PROMO (B) when marked as EVENT', () => {
      // Trigger: action (spin)
      // Benefit: chance (prizes)
      // Constraints: limit tiket
      const result = calculateCategory(true, true, true, 'EVENT');
      expect(result).toBe('B');
      expect(getCategoryName(result)).toBe('Event Program');
    });

    it('T5: Withdraw Bonus 5% → PROMO (A)', () => {
      // Trigger: action (withdraw)
      // Benefit: percentage (5% bonus)
      // Constraints: min WD, TO
      const result = calculateCategory(true, true, true, 'REWARD');
      expect(result).toBe('A');
    });

    it('T6: Event TO Hadiah Mobil → PROMO (B)', () => {
      // Trigger: state (total TO)
      // Benefit: item (mobil)
      // Constraints: periode tertentu
      const result = calculateCategory(true, true, true, 'EVENT');
      expect(result).toBe('B');
    });

    it('T7: Welcome Bonus → PROMO (A)', () => {
      // Trigger: action (deposit) + state (member baru)
      // Benefit: percentage (100% bonus)
      // Constraints: min deposit, max bonus, TO
      const result = calculateCategory(true, true, true, 'REWARD');
      expect(result).toBe('A');
    });

    it('T8: Referral Commission → PROMO (A)', () => {
      // Trigger: state (referral count)
      // Benefit: percentage (commission %)
      // Constraints: min downline, admin fee
      const result = calculateCategory(true, true, true, 'REWARD');
      expect(result).toBe('A');
    });

    it('T9: Cashback Harian → PROMO (A)', () => {
      // Trigger: action (bet/main)
      // Benefit: credit (cashback)
      // Constraints: min loss, daily limit
      const result = calculateCategory(true, true, true, 'REWARD');
      expect(result).toBe('A');
    });

    it('T10: Voucher Diskon → PROMO (A)', () => {
      // Trigger: action (redeem)
      // Benefit: percentage (diskon)
      // Constraints: period, scope
      const result = calculateCategory(true, true, true, 'REWARD');
      expect(result).toBe('A');
    });
  });

  // ============================================
  // BUKAN PROMO CASES (salah satu FALSE)
  // ============================================

  describe('Non-Promos (At least 1 Gate FALSE)', () => {
    it('T11: Pure SOP (no benefit) → SYSTEM_RULE (C)', () => {
      // Trigger: action (withdraw)
      // Benefit: TIDAK ADA
      // Constraints: ada (proses 1x24 jam)
      const result = calculateCategory(true, false, true);
      expect(result).toBe('C');
      expect(getCategoryName(result)).toBe('System Rule');
      expect(isSystemRule(result)).toBe(true);
    });

    it('T12: Info CS Contact → SYSTEM_RULE (C)', () => {
      // Trigger: TIDAK ADA (hanya info)
      // Benefit: TIDAK ADA
      // Constraints: TIDAK ADA
      const result = calculateCategory(false, false, false);
      expect(result).toBe('C');
    });

    it('T13: Verification Requirement → SYSTEM_RULE (C)', () => {
      // Trigger: action (withdraw)
      // Benefit: TIDAK ADA (hanya bisa WD yang seharusnya memang bisa)
      // Constraints: ada (verifikasi KTP)
      const result = calculateCategory(true, false, true);
      expect(result).toBe('C');
    });

    it('T14: No constraints → SYSTEM_RULE (C)', () => {
      // Edge case: ada trigger dan benefit tapi tidak ada constraints
      // Ini sangat jarang terjadi untuk promo valid
      const result = calculateCategory(true, true, false);
      expect(result).toBe('C');
    });

    it('T15: Only trigger → SYSTEM_RULE (C)', () => {
      const result = calculateCategory(true, false, false);
      expect(result).toBe('C');
    });

    it('T16: Only benefit → SYSTEM_RULE (C)', () => {
      const result = calculateCategory(false, true, false);
      expect(result).toBe('C');
    });

    it('T17: Only constraints → SYSTEM_RULE (C)', () => {
      const result = calculateCategory(false, false, true);
      expect(result).toBe('C');
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe('Edge Cases', () => {
    it('T18: Default to A when promo_category not specified', () => {
      const result = calculateCategory(true, true, true);
      expect(result).toBe('A'); // Default to Reward Program
    });

    it('T19: promo_category undefined still defaults to A', () => {
      const result = calculateCategory(true, true, true, undefined);
      expect(result).toBe('A');
    });

    it('T20: promo_category SYSTEM_RULE still checks gates', () => {
      // Even if LLM says SYSTEM_RULE, if all gates pass → A
      // (Code overrides LLM for category calculation)
      const result = calculateCategory(true, true, true, 'SYSTEM_RULE');
      expect(result).toBe('A');
    });
  });
});

describe('PROMO SUPER CONTRACT - Helper Functions', () => {
  it('getPromoCategory returns correct values', () => {
    expect(getPromoCategory('A')).toBe('REWARD');
    expect(getPromoCategory('B')).toBe('EVENT');
    expect(getPromoCategory('C')).toBe('SYSTEM_RULE');
  });

  it('isSystemRule correctly identifies non-promos', () => {
    expect(isSystemRule('A')).toBe(false);
    expect(isSystemRule('B')).toBe(false);
    expect(isSystemRule('C')).toBe(true);
  });
});
