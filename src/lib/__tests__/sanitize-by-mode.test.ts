import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizeByMode, resetInvariantLogCounter, NON_FORMULA_MODES } from '../sanitize-by-mode';

describe('sanitizeByMode — Final Safety Net v1.0', () => {
  
  // Reset log counter before each test
  beforeEach(() => {
    resetInvariantLogCounter();
  });

  // ========================================
  // A. MODE-BASED HARD STRIP (WAJIB)
  // ========================================
  describe('A. Mode-Based Hard Strip', () => {
    it('T1: Event menghapus semua field kalkulasi', () => {
      const input = {
        reward_mode: 'event',
        calculation_basis: 'deposit',
        calculation_base: 'deposit',
        calculation_value: 50,
        min_calculation: 10000,
        turnover_multiplier: 5,
        turnover_rule_enabled: true,
        turnover_enabled: true,
        min_deposit: 50000,
      };
      
      const result = sanitizeByMode(input);
      
      expect(result.calculation_basis).toBeNull();
      expect(result.calculation_base).toBe('');
      expect(result.calculation_value).toBeNull();
      expect(result.min_calculation).toBeNull();
      expect(result.turnover_multiplier).toBeNull();
      expect(result.turnover_rule_enabled).toBe(false);
      expect(result.turnover_enabled).toBe(false);
      expect(result.min_deposit).toBeNull();
    });

    it('T2: Fixed menghapus kalkulasi', () => {
      const input = {
        reward_mode: 'fixed',
        turnover_multiplier: 5,
        min_deposit: 50000,
        calculation_basis: 'deposit',
        calculation_base: 'turnover',
      };
      
      const result = sanitizeByMode(input);
      
      expect(result.turnover_multiplier).toBeNull();
      expect(result.min_deposit).toBeNull();
      expect(result.calculation_basis).toBeNull();
      expect(result.calculation_base).toBe('');
    });

    it('T3: Tier menghapus conversion_formula dan calculation fields', () => {
      const input = {
        reward_mode: 'tier',
        conversion_formula: 'x*y',
        calculation_base: 'deposit',
        calculation_value: 10,
        fixed_calculation_value: 20,
      };
      
      const result = sanitizeByMode(input);
      
      expect(result.conversion_formula).toBe('');
      expect(result.calculation_base).toBe('');
      expect(result.calculation_value).toBeNull();
      expect(result.fixed_calculation_value).toBeNull();
    });

    it('T3b: Formula mode TIDAK dihapus (tetap utuh)', () => {
      const input = {
        reward_mode: 'formula',
        calculation_basis: 'deposit',
        calculation_base: 'deposit',
        calculation_value: 50,
        turnover_multiplier: 3,
      };
      
      const result = sanitizeByMode(input);
      
      // Formula mode should preserve these fields
      expect(result.calculation_basis).toBe('deposit');
      expect(result.calculation_base).toBe('deposit');
      expect(result.calculation_value).toBe(50);
      expect(result.turnover_multiplier).toBe(3);
    });
  });

  // ========================================
  // B. ZERO NORMALIZATION (ANTI silent corruption)
  // ========================================
  describe('B. Zero Normalization', () => {
    it('T4: reward_amount=0 → null', () => {
      const input = { reward_mode: 'formula', reward_amount: 0 };
      const result = sanitizeByMode(input);
      expect(result.reward_amount).toBeNull();
    });

    it('T4b: reward_amount > 0 tetap utuh', () => {
      const input = { reward_mode: 'formula', reward_amount: 100 };
      const result = sanitizeByMode(input);
      expect(result.reward_amount).toBe(100);
    });

    it('T5: max_bonus=0 + unlimited=true → null', () => {
      const input = { 
        reward_mode: 'formula', 
        max_bonus: 0, 
        max_bonus_unlimited: true 
      };
      const result = sanitizeByMode(input);
      expect(result.max_bonus).toBeNull();
    });

    it('T5b: max_bonus=0 + unlimited=false → null (ambiguous)', () => {
      const input = { 
        reward_mode: 'formula', 
        max_bonus: 0, 
        max_bonus_unlimited: false 
      };
      const result = sanitizeByMode(input);
      expect(result.max_bonus).toBeNull();
    });

    it('T5c: min_calculation=0 → null', () => {
      const input = { reward_mode: 'formula', min_calculation: 0 };
      const result = sanitizeByMode(input);
      expect(result.min_calculation).toBeNull();
    });
  });

  // ========================================
  // C. PERCENTAGE CONSISTENCY
  // ========================================
  describe('C. Percentage Consistency', () => {
    it('T6: percentage flag false melarang percent unit', () => {
      const input = {
        reward_mode: 'formula',
        reward_is_percentage: false,
        reward_unit: 'percent',
      };
      const result = sanitizeByMode(input);
      expect(result.reward_unit).toBe('fixed');
    });

    it('T6b: percentage flag true membolehkan percent unit', () => {
      const input = {
        reward_mode: 'formula',
        reward_is_percentage: true,
        reward_unit: 'percent',
      };
      const result = sanitizeByMode(input);
      expect(result.reward_unit).toBe('percent');
    });
  });

  // ========================================
  // D. EVENT SAFETY GUARD
  // ========================================
  describe('D. Event Safety Guard', () => {
    it('T7: Event unlimited+0 jadi finite', () => {
      const input = {
        reward_mode: 'event',
        max_claim_unlimited: true,
        max_claim: 0,
      };
      const result = sanitizeByMode(input);
      expect(result.max_claim_unlimited).toBe(false);
      expect(result.max_claim).toBe(1);
    });

    it('T7b: Event unlimited+valid claim tetap utuh', () => {
      const input = {
        reward_mode: 'event',
        max_claim_unlimited: true,
        max_claim: 5,
      };
      const result = sanitizeByMode(input);
      expect(result.max_claim_unlimited).toBe(true);
      expect(result.max_claim).toBe(5);
    });
  });

  // ========================================
  // E. APK GATE NORMALIZATION
  // ========================================
  describe('E. APK Gate Normalization', () => {
    it('T8: APK in promo_name memaksa require_apk + trigger_event', () => {
      const input = {
        reward_mode: 'event',
        promo_name: 'Download APK Dapat Freechip',
        custom_terms: '',
        require_apk: false,
        trigger_event: 'Login',
      };
      const result = sanitizeByMode(input);
      expect(result.require_apk).toBe(true);
      expect(result.trigger_event).toBe('Download_APK');
    });

    it('T8b: APK in custom_terms memaksa require_apk', () => {
      const input = {
        reward_mode: 'event',
        promo_name: 'Bonus Spesial',
        custom_terms: 'hanya untuk pengguna APK',
        require_apk: false,
      };
      const result = sanitizeByMode(input);
      expect(result.require_apk).toBe(true);
    });

    it('T8c: Aplikasi keyword juga trigger APK gate', () => {
      const input = {
        reward_mode: 'event',
        promo_name: 'Download Aplikasi Bonus',
        require_apk: false,
      };
      const result = sanitizeByMode(input);
      expect(result.require_apk).toBe(true);
    });

    it('T8d: Non-APK promo tetap require_apk=false', () => {
      const input = {
        reward_mode: 'event',
        promo_name: 'Welcome Bonus',
        custom_terms: 'Deposit minimal 50rb',
        require_apk: false,
      };
      const result = sanitizeByMode(input);
      expect(result.require_apk).toBe(false);
    });
  });

  // ========================================
  // F. INVARIANT ASSERTION (Fail-safe)
  // ========================================
  describe('F. Invariant Assertion', () => {
    it('T9: Event dengan calculation_basis → paksa null (tidak throw)', () => {
      const input = {
        reward_mode: 'event',
        calculation_basis: 'deposit',
        promo_name: 'Test Promo',
      };
      
      // Should NOT throw
      const result = sanitizeByMode(input);
      
      // Should force-null
      expect(result.calculation_basis).toBeNull();
      expect(result.calculation_base).toBe('');
    });

    it('T9b: Event dengan calculation_basis empty string → tetap empty', () => {
      const input = {
        reward_mode: 'event',
        calculation_basis: '',
      };
      const result = sanitizeByMode(input);
      expect(result.calculation_basis).toBeNull(); // Mode-based strip converts to null
    });
  });

  // ========================================
  // G. IDEMPOTENCY (ANTI regresi batch)
  // ========================================
  describe('G. Idempotency', () => {
    it('T10: Panggil dua kali hasil sama', () => {
      const input = {
        reward_mode: 'event',
        promo_name: 'APK Promo',
        require_apk: true,
        trigger_event: 'Download_APK',
        calculation_basis: null,
        calculation_base: '',
      };
      const once = sanitizeByMode(input);
      const twice = sanitizeByMode(once);
      expect(twice).toEqual(once);
    });

    it('T10b: Dirty input → clean → clean lagi = sama', () => {
      const dirty = {
        reward_mode: 'event',
        promo_name: 'Download APK Bonus',
        calculation_basis: 'deposit',
        calculation_value: 0,
        turnover_multiplier: 5,
        require_apk: false,
      };
      
      const firstPass = sanitizeByMode(dirty);
      const secondPass = sanitizeByMode(firstPass);
      
      expect(secondPass).toEqual(firstPass);
      expect(secondPass.calculation_basis).toBeNull();
      expect(secondPass.require_apk).toBe(true);
    });
  });

  // ========================================
  // H. NON_FORMULA_MODES CONSTANT
  // ========================================
  describe('H. NON_FORMULA_MODES Constant', () => {
    it('H1: NON_FORMULA_MODES contains expected modes', () => {
      expect(NON_FORMULA_MODES).toContain('event');
      expect(NON_FORMULA_MODES).toContain('fixed');
      expect(NON_FORMULA_MODES).toContain('tier');
      expect(NON_FORMULA_MODES).not.toContain('formula');
    });

    it('H2: All non-formula modes strip calculation fields', () => {
      NON_FORMULA_MODES.forEach((mode) => {
        const input = {
          reward_mode: mode,
          calculation_basis: 'deposit',
          turnover_multiplier: 5,
        };
        const result = sanitizeByMode(input);
        expect(result.calculation_basis).toBeNull();
        expect(result.turnover_multiplier).toBeNull();
      });
    });
  });

  // ========================================
  // I. V1.1 ADDITIONS
  // ========================================
  describe('I. V1.1 Additions', () => {
    it('T11: uses mode field when reward_mode is missing (canonical export)', () => {
      const input = {
        mode: 'event',  // canonical uses 'mode', not 'reward_mode'
        calculation_basis: 'deposit',
      };
      const result = sanitizeByMode(input);
      expect(result.calculation_basis).toBeNull();
    });

    it('T12: APK context with deposit trigger forces Download_APK', () => {
      const input = {
        reward_mode: 'event',
        promo_name: 'Download APK Bonus',
        trigger_event: 'First Deposit',
      };
      const result = sanitizeByMode(input);
      expect(result.trigger_event).toBe('Download_APK');
    });

    it('T13: event mode with empty category defaults to REWARD', () => {
      const input = {
        reward_mode: 'event',
        category: '',
      };
      const result = sanitizeByMode(input);
      expect(result.category).toBe('REWARD');
    });

    it('T13b: event mode with existing category is preserved', () => {
      const input = {
        reward_mode: 'event',
        category: 'BONUS',
      };
      const result = sanitizeByMode(input);
      expect(result.category).toBe('BONUS');
    });

    it('T12b: APK context preserves non-deposit trigger', () => {
      const input = {
        reward_mode: 'event',
        promo_name: 'Download APK Bonus',
        trigger_event: 'Registration',
      };
      const result = sanitizeByMode(input);
      expect(result.trigger_event).toBe('Registration');
    });
  });
});
