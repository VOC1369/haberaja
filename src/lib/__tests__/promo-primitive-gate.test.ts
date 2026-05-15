/**
 * PROMO PRIMITIVE GATE v1.2.1 — GOLDEN TEST SET
 * 
 * 🚫 CI GATE — ALL TESTS MUST PASS
 * If any test fails, PR should be BLOCKED.
 * Do NOT add auto-fix or silent sanitize to make tests pass.
 * 
 * These 10 tests are the MINIMUM requirement for v1.2.1 compliance.
 * All tests MUST pass before any release.
 * 
 * TEST PHILOSOPHY:
 * - Each test verifies one aspect of the decision table
 * - No "lucky" passes - all paths are explicitly tested
 * - Ambiguous cases have confidence < high
 * 
 * SIGNAL CONTRACT: docs/architecture/promo-primitive-gate.signal-contract.md
 * 
 * VERSION: v1.2.1+2025-01-14 (FROZEN)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  resolveModFromPrimitive, 
  type PromoPrimitive,
  type PrimitiveGateResult 
} from '../extractors/promo-primitive-gate';
import { 
  collectPrimitiveEvidence, 
  inferTaskDomain, 
  inferRewardNature,
  inferPrimitivesWithConfidence,
  hasApkConstraint,
  type PrimitiveEvidence,
  type PrimitiveInference
} from '../extractors/primitive-evidence-collector';
import { checkModeInvariants } from '../extractors/primitive-invariant-checker';

describe('PROMO PRIMITIVE GATE v1.2 — GOLDEN TEST SET', () => {
  
  // ============================================
  // TEST 1: Cashback 5% khusus APK
  // Expected: formula mode, require_apk=true
  // ============================================
  describe('T1: Cashback 5% khusus APK', () => {
    const content = 'Cashback 5% dari deposit khusus pengguna APK. Minimal deposit 100rb.';
    
    it('should detect APK as constraint, not mode determinant', () => {
      const evidence = collectPrimitiveEvidence(content);
      expect(hasApkConstraint(evidence)).toBe(true);
    });
    
    it('should infer financial domain (APK is constraint)', () => {
      const evidence = collectPrimitiveEvidence(content);
      const domain = inferTaskDomain(evidence, content);
      expect(domain).toBe('financial');
    });
    
    it('should infer calculated reward nature', () => {
      const evidence = collectPrimitiveEvidence(content);
      const nature = inferRewardNature(evidence);
      expect(nature).toBe('calculated');
    });
    
    it('should resolve to formula mode', () => {
      const primitive: PromoPrimitive = {
        task_type: 'action',
        task_domain: 'financial',
        state_change: 'bonus_added',
        reward_nature: 'calculated',
      };
      const result = resolveModFromPrimitive(primitive);
      expect(result.mode).toBe('formula');
    });
  });
  
  // ============================================
  // TEST 2: Bonus Deposit 50rb (fixed)
  // Expected: fixed mode
  // ============================================
  describe('T2: Bonus Deposit 50rb (fixed)', () => {
    const content = 'Bonus deposit 50.000 untuk member baru. Klaim sekali saja.';
    
    it('should infer financial domain', () => {
      const evidence = collectPrimitiveEvidence(content);
      const domain = inferTaskDomain(evidence, content);
      expect(domain).toBe('financial');
    });
    
    it('should infer fixed reward nature (no percentage)', () => {
      const evidence = collectPrimitiveEvidence(content);
      // No calculated hints (no %)
      expect(evidence.calculated_hints.length).toBe(0);
      const nature = inferRewardNature(evidence);
      expect(nature).toBe('fixed');
    });
    
    it('should resolve to fixed mode via EXPLICIT rule', () => {
      const primitive: PromoPrimitive = {
        task_type: 'action',
        task_domain: 'financial',
        state_change: 'bonus_added',
        reward_nature: 'fixed',
      };
      const result = resolveModFromPrimitive(primitive);
      expect(result.mode).toBe('fixed');
      expect(result.reasoning).toContain('EXPLICIT');
    });
  });
  
  // ============================================
  // TEST 3: Freechip APK, TO 1x sebelum WD
  // Expected: fixed mode, turnover_enabled=true ALLOWED
  // ============================================
  describe('T3: Freechip APK, TO 1x sebelum WD', () => {
    const content = 'Download APK dapat Freechip 20rb. Syarat TO 1x sebelum withdraw.';
    
    it('should detect APK as constraint', () => {
      const evidence = collectPrimitiveEvidence(content);
      expect(hasApkConstraint(evidence)).toBe(true);
    });
    
    it('should infer platform domain (APK is primary action)', () => {
      const evidence = collectPrimitiveEvidence(content);
      const domain = inferTaskDomain(evidence, content);
      expect(domain).toBe('platform');
    });
    
    it('should resolve to fixed mode', () => {
      const primitive: PromoPrimitive = {
        task_type: 'action',
        task_domain: 'platform',
        state_change: 'reward_granted',
        reward_nature: 'fixed',
      };
      const result = resolveModFromPrimitive(primitive);
      expect(result.mode).toBe('fixed');
    });
    
    it('should NOT violate invariant with turnover_enabled=true', () => {
      // v1.2: Fixed mode CAN have turnover for withdrawal requirement
      const invariantResult = checkModeInvariants('fixed', {
        calculation_basis: null,
        turnover_enabled: true, // For WD requirement
        tier_count: 0,
      });
      expect(invariantResult.valid).toBe(true);
      expect(invariantResult.violations).toHaveLength(0);
    });
  });
  
  // ============================================
  // TEST 4: VIP Level 5 bonus 50k (single level)
  // Expected: fixed mode (NOT tier, because single level)
  // ============================================
  describe('T4: VIP Level 5 bonus 50k', () => {
    const content = 'Bonus 50.000 untuk member VIP Level 5. Klaim otomatis.';
    
    it('should infer access domain', () => {
      const evidence = collectPrimitiveEvidence(content);
      const domain = inferTaskDomain(evidence, content);
      expect(domain).toBe('access');
    });
    
    it('should infer fixed reward nature', () => {
      const evidence = collectPrimitiveEvidence(content);
      const nature = inferRewardNature(evidence);
      expect(nature).toBe('fixed');
    });
    
    it('should resolve to fixed mode', () => {
      const primitive: PromoPrimitive = {
        task_type: 'state',
        task_domain: 'access',
        state_change: 'level_reached',
        reward_nature: 'fixed',
      };
      const result = resolveModFromPrimitive(primitive);
      expect(result.mode).toBe('fixed');
    });
  });
  
  // ============================================
  // TEST 5: VIP Level 1-10 dengan reward berbeda
  // Expected: tier mode (multiple levels = tier structure)
  // ============================================
  describe('T5: VIP Level 1-10 dengan reward berbeda', () => {
    const content = 'Level 1 → 50rb, Level 2 → 100rb, Level 3 → 200rb, dst.';
    
    it('should detect tiered hints', () => {
      const evidence = collectPrimitiveEvidence(content);
      expect(evidence.tiered_hints.length).toBeGreaterThan(0);
    });
    
    it('should infer tiered reward nature', () => {
      const evidence = collectPrimitiveEvidence(content);
      const nature = inferRewardNature(evidence);
      expect(nature).toBe('tiered');
    });
    
    it('should resolve to tier mode', () => {
      const primitive: PromoPrimitive = {
        task_type: 'state',
        task_domain: 'access',
        state_change: 'level_progression',
        reward_nature: 'tiered',
      };
      const result = resolveModFromPrimitive(primitive);
      expect(result.mode).toBe('tier');
    });
  });
  
  // ============================================
  // TEST 6: Lucky Spin Deposit
  // Expected: fixed mode (chance = non-calculated)
  // ============================================
  describe('T6: Lucky Spin Deposit', () => {
    const content = 'Lucky Spin setiap deposit 50rb. Dapatkan hadiah random!';
    
    it('should detect chance hints', () => {
      const evidence = collectPrimitiveEvidence(content);
      expect(evidence.chance_hints.length).toBeGreaterThan(0);
    });
    
    it('should infer chance reward nature', () => {
      const evidence = collectPrimitiveEvidence(content);
      const nature = inferRewardNature(evidence);
      expect(nature).toBe('chance');
    });
    
    it('should resolve to fixed mode (chance → fixed)', () => {
      const primitive: PromoPrimitive = {
        task_type: 'action',
        task_domain: 'gameplay',
        state_change: 'spin_completed',
        reward_nature: 'chance',
      };
      const result = resolveModFromPrimitive(primitive);
      expect(result.mode).toBe('fixed');
      expect(result.reasoning).toContain('non-deterministic');
    });
  });
  
  // ============================================
  // TEST 7: Download APK dapat 20rb
  // Expected: fixed mode, require_apk=true
  // ============================================
  describe('T7: Download APK dapat 20rb', () => {
    const content = 'Download APK dapat bonus 20.000. Klaim di livechat.';
    
    it('should detect platform domain', () => {
      const evidence = collectPrimitiveEvidence(content);
      const domain = inferTaskDomain(evidence, content);
      expect(domain).toBe('platform');
    });
    
    it('should infer fixed reward nature', () => {
      const evidence = collectPrimitiveEvidence(content);
      const nature = inferRewardNature(evidence);
      expect(nature).toBe('fixed');
    });
    
    it('should resolve to fixed mode', () => {
      const primitive: PromoPrimitive = {
        task_type: 'action',
        task_domain: 'platform',
        state_change: 'app_installed',
        reward_nature: 'fixed',
      };
      const result = resolveModFromPrimitive(primitive);
      expect(result.mode).toBe('fixed');
    });
    
    it('should detect APK constraint', () => {
      const evidence = collectPrimitiveEvidence(content);
      expect(hasApkConstraint(evidence)).toBe(true);
    });
  });
  
  // ============================================
  // TEST 8: Bonus Deposit 10%
  // Expected: formula mode
  // ============================================
  describe('T8: Bonus Deposit 10%', () => {
    const content = 'Bonus deposit 10% untuk setiap deposit. Max bonus 500rb.';
    
    it('should infer financial domain', () => {
      const evidence = collectPrimitiveEvidence(content);
      const domain = inferTaskDomain(evidence, content);
      expect(domain).toBe('financial');
    });
    
    it('should detect calculated hints (percentage)', () => {
      const evidence = collectPrimitiveEvidence(content);
      expect(evidence.calculated_hints.length).toBeGreaterThan(0);
    });
    
    it('should infer calculated reward nature', () => {
      const evidence = collectPrimitiveEvidence(content);
      const nature = inferRewardNature(evidence);
      expect(nature).toBe('calculated');
    });
    
    it('should resolve to formula mode', () => {
      const primitive: PromoPrimitive = {
        task_type: 'action',
        task_domain: 'financial',
        state_change: 'bonus_calculated',
        reward_nature: 'calculated',
      };
      const result = resolveModFromPrimitive(primitive);
      expect(result.mode).toBe('formula');
    });
  });
  
  // ============================================
  // TEST 9: Ambiguous case → confidence=medium
  // Expected: medium confidence, ambiguity_flags populated
  // ============================================
  describe('T9: Ambiguous case (platform + financial conflict)', () => {
    const content = 'Bonus untuk member aktif.'; // Very minimal info
    
    it('should have confidence=medium or low', () => {
      const evidence = collectPrimitiveEvidence(content);
      const inference = inferPrimitivesWithConfidence(evidence, content);
      expect(['medium', 'low']).toContain(inference.confidence);
    });
    
    it('should flag minimal_hints or no_evidence', () => {
      const evidence = collectPrimitiveEvidence(content);
      const inference = inferPrimitivesWithConfidence(evidence, content);
      const hasAmbiguityFlag = inference.ambiguity_flags.some(f => 
        f === 'minimal_hints' || f === 'no_evidence'
      );
      expect(hasAmbiguityFlag).toBe(true);
    });
  });
  
  // ============================================
  // TEST 10: No evidence → confidence=low
  // Expected: low confidence
  // ============================================
  describe('T10: No evidence case', () => {
    const content = 'Promo spesial.'; // No meaningful content
    
    it('should have confidence=low', () => {
      const evidence = collectPrimitiveEvidence(content);
      const inference = inferPrimitivesWithConfidence(evidence, content);
      expect(inference.confidence).toBe('low');
    });
    
    it('should flag no_evidence or minimal_hints', () => {
      const evidence = collectPrimitiveEvidence(content);
      const inference = inferPrimitivesWithConfidence(evidence, content);
      const hasFlag = inference.ambiguity_flags.some(f => 
        f === 'no_evidence' || f === 'minimal_hints'
      );
      expect(hasFlag).toBe(true);
    });
    
    it('should default to fixed mode (safe fallback)', () => {
      const primitive: PromoPrimitive = {
        task_type: 'action',
        task_domain: 'platform', // Default
        state_change: 'unknown',
        reward_nature: 'fixed', // Default
      };
      const result = resolveModFromPrimitive(primitive);
      expect(result.mode).toBe('fixed');
    });
  });
});

// ============================================
// DECISION TABLE COMPLETENESS TEST
// ============================================
describe('DECISION TABLE COMPLETENESS (20/20 coverage)', () => {
  const domains: Array<'platform' | 'financial' | 'gameplay' | 'temporal' | 'access'> = 
    ['platform', 'financial', 'gameplay', 'temporal', 'access'];
  const natures: Array<'fixed' | 'calculated' | 'tiered' | 'chance'> = 
    ['fixed', 'calculated', 'tiered', 'chance'];
  
  it('should cover all 20 domain×nature combinations', () => {
    let explicitCount = 0;
    
    for (const domain of domains) {
      for (const nature of natures) {
        const primitive: PromoPrimitive = {
          task_type: 'action',
          task_domain: domain,
          state_change: 'test',
          reward_nature: nature,
        };
        
        const result = resolveModFromPrimitive(primitive);
        
        // Every combination must have a valid mode
        expect(['fixed', 'formula', 'tier']).toContain(result.mode);
        
        // Count explicit vs fallback
        if (!result.reasoning.includes('Default fallback')) {
          explicitCount++;
        }
      }
    }
    
    // At least 17 should be explicit (not fallback)
    expect(explicitCount).toBeGreaterThanOrEqual(17);
  });
  
  it('should have explicit rule for financial + fixed', () => {
    const primitive: PromoPrimitive = {
      task_type: 'action',
      task_domain: 'financial',
      state_change: 'bonus_added',
      reward_nature: 'fixed',
    };
    const result = resolveModFromPrimitive(primitive);
    expect(result.mode).toBe('fixed');
    expect(result.reasoning).toContain('EXPLICIT');
  });
});

// ============================================
// INVARIANT RELAXATION TEST
// ============================================
describe('INVARIANT v1.2 — Relaxed turnover for fixed mode', () => {
  it('should allow turnover_enabled=true for fixed mode (WD requirement)', () => {
    const result = checkModeInvariants('fixed', {
      calculation_basis: null,
      turnover_enabled: true,
      tier_count: 0,
    });
    expect(result.valid).toBe(true);
  });
  
  it('should still reject calculation_basis for fixed mode', () => {
    const result = checkModeInvariants('fixed', {
      calculation_basis: 'deposit',
      turnover_enabled: false,
      tier_count: 0,
    });
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });
  
  it('should still reject tier_count>0 for fixed mode', () => {
    const result = checkModeInvariants('fixed', {
      calculation_basis: null,
      turnover_enabled: false,
      tier_count: 3,
    });
    expect(result.valid).toBe(false);
  });
});

// ============================================
// LEVEL PATTERN DISAMBIGUATION TEST
// ============================================
describe('LEVEL PATTERN v1.2 — No dual-match', () => {
  it('should detect VIP Level 5 as access (not tiered)', () => {
    const content = 'Bonus untuk VIP Level 5';
    const evidence = collectPrimitiveEvidence(content);
    
    // Access should have hints
    expect(evidence.access_hints.length).toBeGreaterThan(0);
    
    // If no tier table syntax, tiered hints should be empty
    expect(evidence.tiered_hints.length).toBe(0);
  });
  
  it('should detect Level 1 → 100rb as tiered (not access)', () => {
    const content = 'Level 1 → 100rb, Level 2 → 200rb';
    const evidence = collectPrimitiveEvidence(content);
    
    // Tiered should have hints (tier table pattern)
    expect(evidence.tiered_hints.length).toBeGreaterThan(0);
  });
});
