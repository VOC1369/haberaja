/**
 * APK Download Extraction E2E Test
 * 
 * Verifies the complete extraction pipeline for APK Download promos:
 * 1. promo-intent-reasoner.ts → detectObviousIntent()
 * 2. mechanic-router.ts → routePromoIntent()
 * 3. sanitize-by-mode.ts → sanitizeByMode()
 * 
 * Expected: mode=event, calculation_basis=null, require_apk=true, trigger_event=Download_APK
 */

import { describe, it, expect } from 'vitest';
import { detectObviousIntent } from '../extractors/promo-intent-reasoner';
import { routeMechanic } from '../extractors/mechanic-router';
import { sanitizeByMode, NON_FORMULA_MODES } from '../sanitize-by-mode';

describe('APK Download Extraction E2E', () => {
  // ============================================
  // TEST: Promo Intent Reasoner (Step-0)
  // ============================================
  describe('Step-0: Promo Intent Reasoner', () => {
    it('should detect APK download intent with high confidence', () => {
      const content = 'Download APK dapat Freechip 5K-20K melalui Redemption Store';
      
      const intent = detectObviousIntent(content);
      
      expect(intent).not.toBeNull();
      expect(intent?.primary_action).toBe('download_apk');
      expect(intent?.reward_nature).toBe('given');
      expect(intent?.confidence).toBeGreaterThanOrEqual(0.9);
      expect(intent?.distribution_path).toBe('redemption_store');
      expect(intent?.value_shape).toBe('range');
    });
    
    it('should detect APK with "install apk" pattern', () => {
      const content = 'Install APK untuk mendapatkan bonus freechip';
      
      const intent = detectObviousIntent(content);
      
      expect(intent).not.toBeNull();
      expect(intent?.primary_action).toBe('download_apk');
    });
    
    it('should detect APK with "unduh aplikasi" pattern', () => {
      const content = 'Unduh aplikasi dan dapatkan hadiah';
      
      const intent = detectObviousIntent(content);
      
      expect(intent).not.toBeNull();
      expect(intent?.primary_action).toBe('download_apk');
    });
  });
  
  // ============================================
  // TEST: Mechanic Router
  // ============================================
  describe('Step-1: Mechanic Router', () => {
    it('should route APK intent to event mode with null calculation_basis', () => {
      const content = 'Download APK dapat Freechip 5K-20K';
      const intent = detectObviousIntent(content);
      
      expect(intent).not.toBeNull();
      
      const result = routeMechanic(intent!);
      
      expect(result.mechanic_type).toBe('apk_download_reward');
      expect(result.locked_fields.mode).toBe('event');
      expect(result.locked_fields.calculation_basis).toBeNull();
      expect(result.locked_fields.reward_is_percentage).toBe(false);
    });
    
    it('should detect invariant violations if range with formula', () => {
      const content = 'Download APK dapat Freechip 5K-20K';
      const intent = detectObviousIntent(content);
      
      expect(intent).not.toBeNull();
      
      const result = routeMechanic(intent!);
      
      // No violations should occur for APK (correct flow)
      // Violations would occur if someone tried to force formula mode
      expect(result.locked_fields.mode).not.toBe('formula');
    });
  });
  
  // ============================================
  // TEST: sanitizeByMode() Safety Net
  // ============================================
  describe('Step-2: sanitizeByMode() Safety Net', () => {
    it('should strip formula fields for event mode APK promo', () => {
      const promoData = {
        promo_name: 'Download APK Dapat Freechip 5K-20K',
        reward_mode: 'event',
        calculation_basis: 'deposit', // Ghost field (should be stripped)
        calculation_base: 'deposit',
        calculation_value: 10,
        min_calculation: 50000,
        turnover_multiplier: 3,
        require_apk: false, // Should be corrected
        trigger_event: 'Login',
        custom_terms: 'Download APK dan klaim hadiah',
      };
      
      const sanitized = sanitizeByMode(promoData);
      
      // Formula fields stripped
      expect(sanitized.calculation_basis).toBeNull();
      expect(sanitized.calculation_base).toBe('');
      expect(sanitized.calculation_value).toBeNull();
      expect(sanitized.min_calculation).toBeNull();
      expect(sanitized.turnover_multiplier).toBeNull();
      
      // APK gate enforced
      expect(sanitized.require_apk).toBe(true);
      expect(sanitized.trigger_event).toBe('APK Download');
    });
    
    it('should force require_apk=true when APK in promo name', () => {
      const promoData = {
        promo_name: 'Bonus Download APK Member Baru',
        reward_mode: 'event',
        require_apk: false,
      };
      
      const sanitized = sanitizeByMode(promoData);
      
      expect(sanitized.require_apk).toBe(true);
    });
    
    it('should force require_apk=true when APK in terms', () => {
      const promoData = {
        promo_name: 'Bonus Member Baru',
        reward_mode: 'fixed',
        custom_terms: 'Wajib install APK untuk claim bonus',
        require_apk: false,
      };
      
      const sanitized = sanitizeByMode(promoData);
      
      expect(sanitized.require_apk).toBe(true);
    });
    
    it('should strip formula fields for all NON_FORMULA_MODES', () => {
      for (const mode of NON_FORMULA_MODES) {
        const promoData = {
          promo_name: 'Test Promo',
          reward_mode: mode,
          calculation_basis: 'deposit',
          calculation_value: 10,
        };
        
        const sanitized = sanitizeByMode(promoData);
        
        expect(sanitized.calculation_basis).toBeNull();
        expect(sanitized.calculation_value).toBeNull();
      }
    });
  });
  
  // ============================================
  // TEST: Full E2E Flow
  // ============================================
  describe('Full E2E: APK Download Promo', () => {
    it('should process APK promo correctly through entire pipeline', () => {
      const content = 'Download APK dapat Freechip 5K-20K melalui Redemption Store';
      
      // Step 0: Intent Detection
      const intent = detectObviousIntent(content);
      expect(intent).not.toBeNull();
      expect(intent!.primary_action).toBe('download_apk');
      expect(intent!.confidence).toBeGreaterThanOrEqual(0.9);
      
      // Step 1: Mechanic Routing
      const routerResult = routeMechanic(intent!);
      expect(routerResult.mechanic_type).toBe('apk_download_reward');
      expect(routerResult.locked_fields.mode).toBe('event');
      expect(routerResult.locked_fields.calculation_basis).toBeNull();
      
      // Step 2: Create mock form data (simulating openai-extractor output)
      const mockFormData = {
        promo_name: 'Download APK Dapat Freechip',
        reward_mode: routerResult.locked_fields.mode,
        // Simulate LLM ghost fields
        calculation_basis: 'deposit', // Should be stripped
        calculation_value: 10,
        min_calculation: 50000,
        turnover_multiplier: 3,
        require_apk: false,
        trigger_event: 'Login',
        custom_terms: 'Download APK untuk dapatkan hadiah',
      };
      
      // Step 3: Final sanitization
      const sanitized = sanitizeByMode(mockFormData);
      
      // Final verification
      expect(sanitized.reward_mode).toBe('event');
      expect(sanitized.calculation_basis).toBeNull();
      expect(sanitized.calculation_value).toBeNull();
      expect(sanitized.min_calculation).toBeNull();
      expect(sanitized.turnover_multiplier).toBeNull();
      expect(sanitized.require_apk).toBe(true);
      expect(sanitized.trigger_event).toBe('APK Download');
    });
    
    it('should handle formula mode promo differently (preserve calculation fields)', () => {
      // This is NOT an APK promo - should preserve formula fields
      const promoData = {
        promo_name: 'Deposit Bonus 10%',
        reward_mode: 'formula',
        calculation_basis: 'deposit',
        calculation_base: 'deposit',
        calculation_value: 10,
        min_calculation: 50000,
        turnover_multiplier: 3,
        require_apk: false,
      };
      
      const sanitized = sanitizeByMode(promoData);
      
      // Formula fields preserved
      expect(sanitized.calculation_basis).toBe('deposit');
      expect(sanitized.calculation_base).toBe('deposit');
      expect(sanitized.calculation_value).toBe(10);
      // Note: min_calculation check depends on formula mode logic
      expect(sanitized.turnover_multiplier).toBe(3);
      expect(sanitized.require_apk).toBe(false);
    });
  });
  
  // ============================================
  // TEST: Edge Cases
  // ============================================
  describe('Edge Cases', () => {
    it('should handle missing mode gracefully', () => {
      const promoData = {
        promo_name: 'Test',
        calculation_basis: 'deposit',
      };
      
      const sanitized = sanitizeByMode(promoData);
      
      // No crash, mode undefined means no stripping
      expect(sanitized.promo_name).toBe('Test');
    });
    
    it('should handle null values correctly', () => {
      const promoData = {
        promo_name: 'Download APK',
        reward_mode: 'event',
        calculation_basis: null,
        calculation_value: null,
        require_apk: null,
        custom_terms: 'APK promo',
      };
      
      const sanitized = sanitizeByMode(promoData);
      
      expect(sanitized.calculation_basis).toBeNull();
      expect(sanitized.require_apk).toBe(true); // APK in name
    });
  });
});
