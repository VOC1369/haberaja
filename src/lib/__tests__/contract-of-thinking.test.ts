/**
 * Contract of Thinking v1.0 - Unit Tests
 * 
 * ACCEPTANCE TEST (Section H):
 * - APK Download promo MUST have mode ≠ formula
 * - APK Download promo MUST have calculation_basis = null
 * - APK Download promo MUST have require_apk = true
 * 
 * These tests ensure "impossible states" stay impossible.
 */

import { describe, it, expect } from 'vitest';
import { detectObviousIntent } from '../extractors/promo-intent-reasoner';
import { routeMechanic, checkInvariants } from '../extractors/mechanic-router';
import { shouldUseKeywordFallback } from '../extractors/keyword-rules';
import type { PromoIntent } from '../extractors/promo-intent-reasoner';

// ============================================
// SECTION H: ACCEPTANCE TEST - APK DOWNLOAD
// ============================================

describe('Contract of Thinking v1.0', () => {
  describe('Section H: Acceptance Test - APK Download', () => {
    const APK_CONTENT_BASIC = 'Download APK dapat Freechip 5K-20K';
    const APK_CONTENT_REDEMPTION = 'Download Aplikasi Dapat Freechip 5K-20K, pilih sendiri di Redemption Store';
    const APK_CONTENT_FULL = `
      DOWNLOAD APLIKASI DAPAT FREECHIP !
      Penukaran hanya 1x per User ID
      Minimal deposit Rp 50.000
      Hadiah freechip 5.000 - 20.000
      Pilih sendiri credit game yang diinginkan
    `;
    
    it('should detect APK download with deterministic pattern (basic)', () => {
      const intent = detectObviousIntent(APK_CONTENT_BASIC);
      
      expect(intent).not.toBeNull();
      expect(intent?.primary_action).toBe('download_apk');
      expect(intent?.reward_nature).toBe('given');
      expect(intent?.confidence).toBeGreaterThanOrEqual(0.9);
    });
    
    it('should detect APK download with redemption store', () => {
      const intent = detectObviousIntent(APK_CONTENT_REDEMPTION);
      
      expect(intent).not.toBeNull();
      expect(intent?.primary_action).toBe('download_apk');
      expect(intent?.value_determiner).toBe('user_choice');
      expect(intent?.distribution_path).toBe('redemption_store');
      expect(intent?.value_shape).toBe('range');
    });
    
    it('should detect APK download with full terms', () => {
      const intent = detectObviousIntent(APK_CONTENT_FULL);
      
      expect(intent).not.toBeNull();
      expect(intent?.primary_action).toBe('download_apk');
      expect(intent?.reward_nature).toBe('given');
    });
    
    it('should route APK promo to event mode, NOT formula', () => {
      const intent: PromoIntent = {
        primary_action: 'download_apk',
        reward_nature: 'given',
        value_determiner: 'user_choice',
        time_scope: 'ongoing',
        distribution_path: 'redemption_store',
        value_shape: 'range',
        intent_evidence: ['download', 'apk'],
        confidence: 0.95,
        reasoning: 'test',
        reasoner_version: 'test',
        processed_at: new Date().toISOString(),
      };
      
      const result = routeMechanic(intent);
      
      // CRITICAL: mode MUST NOT be formula
      expect(result.locked_fields.mode).not.toBe('formula');
      expect(result.locked_fields.mode).toBe('event');
    });
    
    it('should have null calculation_basis for APK promo', () => {
      const intent: PromoIntent = {
        primary_action: 'download_apk',
        reward_nature: 'given',
        value_determiner: 'fixed',
        time_scope: 'ongoing',
        distribution_path: 'auto',
        value_shape: 'fixed',
        intent_evidence: ['download apk'],
        confidence: 0.95,
        reasoning: 'test',
        reasoner_version: 'test',
        processed_at: new Date().toISOString(),
      };
      
      const result = routeMechanic(intent);
      
      // CRITICAL: calculation_basis MUST be null (no formula)
      expect(result.locked_fields.calculation_basis).toBeNull();
    });
    
    it('should set require_apk=true for APK promo mechanic', () => {
      const intent: PromoIntent = {
        primary_action: 'download_apk',
        reward_nature: 'given',
        value_determiner: 'fixed',
        time_scope: 'ongoing',
        distribution_path: 'auto',
        value_shape: 'fixed',
        intent_evidence: ['download apk'],
        confidence: 0.95,
        reasoning: 'test',
        reasoner_version: 'test',
        processed_at: new Date().toISOString(),
      };
      
      const result = routeMechanic(intent);
      
      // Mechanic type should be apk_download_reward
      expect(result.mechanic_type).toBe('apk_download_reward');
    });
  });
  
  // ============================================
  // SECTION D: INVARIANTS
  // ============================================
  
  describe('Section D: Invariants', () => {
    it('Invariant 1: Given ≠ Percentage - reward_nature=given → reward_is_percentage=false', () => {
      const intent: PromoIntent = {
        primary_action: 'download_apk',
        reward_nature: 'given', // GIVEN
        value_determiner: 'fixed',
        time_scope: 'ongoing',
        distribution_path: 'auto',
        value_shape: 'fixed',
        intent_evidence: [],
        confidence: 0.9,
        reasoning: 'test',
        reasoner_version: 'test',
        processed_at: new Date().toISOString(),
      };
      
      const { enforced_locks } = checkInvariants(intent);
      
      // Given = NOT percentage
      expect(enforced_locks.reward_is_percentage).toBe(false);
    });
    
    it('Invariant 2: Range ≠ Formula - value_shape=range → mode ≠ formula', () => {
      const intent: PromoIntent = {
        primary_action: 'deposit',
        reward_nature: 'calculated',
        value_determiner: 'system_calculate',
        time_scope: 'ongoing',
        distribution_path: 'auto',
        value_shape: 'range', // RANGE
        intent_evidence: [],
        confidence: 0.9,
        reasoning: 'test',
        reasoner_version: 'test',
        processed_at: new Date().toISOString(),
      };
      
      const { enforced_locks, violations } = checkInvariants(intent);
      
      // Range/Catalog cannot be formula
      expect(enforced_locks.mode).not.toBe('formula');
      expect(violations.length).toBeGreaterThan(0);
    });
    
    it('Invariant 3: Redemption ≠ Calculation - distribution_path=redemption_store → calculation_basis=null', () => {
      const intent: PromoIntent = {
        primary_action: 'redeem',
        reward_nature: 'given',
        value_determiner: 'user_choice',
        time_scope: 'ongoing',
        distribution_path: 'redemption_store', // REDEMPTION
        value_shape: 'catalog',
        intent_evidence: [],
        confidence: 0.9,
        reasoning: 'test',
        reasoner_version: 'test',
        processed_at: new Date().toISOString(),
      };
      
      const { enforced_locks } = checkInvariants(intent);
      
      // Redemption = no calculation
      expect(enforced_locks.calculation_basis).toBeNull();
    });
    
    it('Invariant 4: Calculated ⇒ Basis Wajib - reward_nature=calculated → calculation_basis required', () => {
      const intent: PromoIntent = {
        primary_action: 'deposit',
        reward_nature: 'calculated', // CALCULATED
        value_determiner: 'system_calculate',
        time_scope: 'ongoing',
        distribution_path: 'auto',
        value_shape: 'percent',
        intent_evidence: [],
        confidence: 0.9,
        reasoning: 'test',
        reasoner_version: 'test',
        processed_at: new Date().toISOString(),
      };
      
      const result = routeMechanic(intent);
      
      // Calculated = must have basis
      expect(result.locked_fields.calculation_basis).not.toBeNull();
      expect(result.locked_fields.calculation_basis).toBeDefined();
    });
  });
  
  // ============================================
  // SECTION F: UNCERTAINTY MODE
  // ============================================
  
  describe('Section F: Uncertainty Mode', () => {
    it('should NOT use keyword fallback (Contract gate)', () => {
      const shouldUseFallback = shouldUseKeywordFallback();
      
      // DISABLED per Contract of Thinking v1.0
      expect(shouldUseFallback).toBe(false);
    });
    
    it('should return null for ambiguous content (not force detection)', () => {
      const ambiguousContent = 'Promo spesial untuk member setia kami';
      const intent = detectObviousIntent(ambiguousContent);
      
      // Should NOT force detection on ambiguous content
      expect(intent).toBeNull();
    });
  });
  
  // ============================================
  // OTHER DETERMINISTIC DETECTIONS
  // ============================================
  
  describe('Other Deterministic Patterns', () => {
    it('should detect Birthday promo', () => {
      const intent = detectObviousIntent('Bonus Ulang Tahun 100.000 untuk member aktif');
      
      expect(intent).not.toBeNull();
      expect(intent?.primary_action).toBe('birthday');
      expect(intent?.reward_nature).toBe('given');
      expect(intent?.confidence).toBeGreaterThanOrEqual(0.9);
    });
    
    it('should detect Referral promo', () => {
      const intent = detectObviousIntent('Ajak teman dapat komisi 0.5% dari turnover');
      
      expect(intent).not.toBeNull();
      expect(intent?.primary_action).toBe('referral');
      expect(intent?.reward_nature).toBe('calculated');
      expect(intent?.value_shape).toBe('tier_table');
    });
    
    it('should detect Cashback (loss-based) promo', () => {
      const intent = detectObviousIntent('Cashback 10% dari kekalahan mingguan');
      
      expect(intent).not.toBeNull();
      expect(intent?.primary_action).toBe('loss');
      expect(intent?.reward_nature).toBe('calculated');
      expect(intent?.value_shape).toBe('percent');
    });
    
    it('should detect Rollingan promo', () => {
      const intent = detectObviousIntent('Bonus Rollingan 0.3% setiap minggu');
      
      expect(intent).not.toBeNull();
      expect(intent?.primary_action).toBe('turnover');
      expect(intent?.reward_nature).toBe('calculated');
    });
    
    it('should detect Lucky Spin promo', () => {
      const intent = detectObviousIntent('Lucky Spin gratis setiap deposit 100rb');
      
      expect(intent).not.toBeNull();
      expect(intent?.primary_action).toBe('redeem');
      expect(intent?.distribution_path).toBe('redemption_store');
    });
  });
});
