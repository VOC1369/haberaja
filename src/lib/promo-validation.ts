/**
 * Promo Form Validation Utility
 * 
 * Provides flexible, context-aware validation for promo forms.
 * Key features:
 * - Toggle-aware turnover validation (respects turnover_rule_enabled)
 * - Reward mode-specific validation
 * - Payment method validation (deposit_rate 1-100)
 */

import { PromoFormData } from '@/components/VOCDashboard/PromoFormWizard/types';

// ============================================
// VALIDATION RESULT TYPES
// ============================================

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// ============================================
// PROMO TYPES WITHOUT TURNOVER REQUIREMENT
// ============================================

/**
 * Promo types that typically don't have turnover requirements.
 * Used for context-aware validation - NOT to hide turnover fields.
 * 
 * NOTE: Rollingan/Cashback is INCLUDED here because:
 * - Bonus is rebate/cashback = instantly withdrawable
 * - "Turnover" in S&K refers to min TO to QUALIFY for bonus, NOT TO to withdraw
 * - This is fundamentally different from Welcome/Deposit bonus turnover
 */
export const PROMO_TYPES_WITHOUT_TURNOVER = [
  'Rollingan / Cashback',  // Rebate bonus - no TO for withdrawal
  'Loyalty Point',
  'Merchandise',
  'Campaign / Informational',
  'Event / Level Up',
  'Referral Bonus',        // Usually instant bonus
] as const;

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate promo form data
 * 
 * @param data Form data to validate
 * @param options Validation options
 * @returns Validation result with errors and warnings
 */
export function validatePromoFormData(
  data: PromoFormData,
  options: {
    strictMode?: boolean; // If true, all warnings become errors
  } = {}
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  
  // ========== REQUIRED FIELDS ==========
  
  // Identity fields (always required)
  if (!data.promo_name?.trim()) {
    errors.push({
      field: 'promo_name',
      message: 'Nama promo wajib diisi',
      severity: 'error',
    });
  }
  
  if (!data.client_id?.trim()) {
    errors.push({
      field: 'client_id',
      message: 'Nama website wajib diisi',
      severity: 'error',
    });
  }
  
  if (!data.promo_type?.trim()) {
    errors.push({
      field: 'promo_type',
      message: 'Tipe promo wajib dipilih',
      severity: 'error',
    });
  }
  
  // ========== TURNOVER VALIDATION ==========
  // Only validate if toggle is ON (user explicitly enabled it)
  
  if (data.turnover_rule_enabled) {
    if (!data.turnover_rule?.trim()) {
      errors.push({
        field: 'turnover_rule',
        message: 'Kelipatan main bonus (TO) wajib dipilih karena syarat main aktif',
        severity: 'error',
      });
    }
    
    // If custom selected but no custom value
    if (data.turnover_rule === 'custom' && !data.turnover_rule_custom?.trim()) {
      errors.push({
        field: 'turnover_rule_custom',
        message: 'Nilai custom TO wajib diisi',
        severity: 'error',
      });
    }
  } else {
    // Toggle OFF - add contextual warning if promo type typically has turnover
    const typicallyHasTurnover = !PROMO_TYPES_WITHOUT_TURNOVER.includes(
      data.promo_type as typeof PROMO_TYPES_WITHOUT_TURNOVER[number]
    );
    
    if (typicallyHasTurnover && data.promo_type && 
        ['Welcome Bonus', 'Deposit Bonus', 'Freechip'].includes(data.promo_type)) {
      warnings.push({
        field: 'turnover_rule_enabled',
        message: `Promo "${data.promo_type}" biasanya memiliki syarat turnover. Pastikan ini disengaja.`,
        severity: 'warning',
      });
    }
  }
  
  // ========== REWARD MODE VALIDATION ==========
  
  if (data.reward_mode === 'formula') {
    // Dinamis mode requires calculation fields
    if (!data.calculation_base?.trim()) {
      errors.push({
        field: 'calculation_base',
        message: 'Dasar perhitungan bonus wajib dipilih untuk mode Dinamis',
        severity: 'error',
      });
    }
    
    if (!data.calculation_method?.trim()) {
      errors.push({
        field: 'calculation_method',
        message: 'Jenis perhitungan wajib dipilih untuk mode Dinamis',
        severity: 'error',
      });
    }
    
    if (data.calculation_value === undefined || data.calculation_value === null || data.calculation_value === 0) {
      warnings.push({
        field: 'calculation_value',
        message: 'Nilai bonus belum diisi',
        severity: 'warning',
      });
    }
  }
  
  if (data.reward_mode === 'fixed') {
    // Fixed mode requires reward amount
    if (data.reward_amount === undefined || data.reward_amount === null || data.reward_amount === 0) {
      warnings.push({
        field: 'reward_amount',
        message: 'Nilai bonus belum diisi',
        severity: 'warning',
      });
    }
  }
  
  if (data.reward_mode === 'tier') {
    // Tier mode requires at least one tier
    if (!data.tiers || data.tiers.length === 0) {
      warnings.push({
        field: 'tiers',
        message: 'Belum ada tier yang dikonfigurasi',
        severity: 'warning',
      });
    }
  }
  
  // ========== PAYMENT METHOD VALIDATION ==========
  
  // Validate deposit_rate if provided (must be 1-100)
  if (data.deposit_rate !== undefined && data.deposit_rate !== null) {
    if (data.deposit_rate < 1 || data.deposit_rate > 100) {
      errors.push({
        field: 'deposit_rate',
        message: 'Rate deposit harus antara 1-100%',
        severity: 'error',
      });
    }
  }
  
  // If deposit_method is set, validate related fields
  if (data.deposit_method && data.deposit_method !== 'all') {
    if (data.deposit_method === 'pulsa') {
      // Pulsa requires operators
      if (!data.deposit_method_providers || data.deposit_method_providers.length === 0) {
        warnings.push({
          field: 'deposit_method_providers',
          message: 'Operator pulsa belum dipilih',
          severity: 'warning',
        });
      }
    }
  }
  
  // ========== SUBCATEGORY VALIDATION ==========
  
  if (data.has_subcategories && data.subcategories) {
    if (data.subcategories.length === 0) {
      errors.push({
        field: 'subcategories',
        message: 'Minimal 1 sub kategori harus ada jika mode sub kategori aktif',
        severity: 'error',
      });
    }
    
    // Validate each subcategory
    data.subcategories.forEach((sub, index) => {
      if (!sub.name?.trim()) {
        warnings.push({
          field: `subcategories[${index}].name`,
          message: `Sub kategori ${index + 1} belum diberi nama`,
          severity: 'warning',
        });
      }
      
      // Subcategory turnover validation (respects its own toggle)
      if (sub.turnover_rule_enabled && !sub.turnover_rule?.trim()) {
        errors.push({
          field: `subcategories[${index}].turnover_rule`,
          message: `Sub kategori "${sub.name || index + 1}": TO wajib diisi karena syarat main aktif`,
          severity: 'error',
        });
      }
    });
  }
  
  // ========== DATE VALIDATION ==========
  
  if (data.valid_from && data.valid_until && !data.valid_until_unlimited) {
    const from = new Date(data.valid_from);
    const until = new Date(data.valid_until);
    
    if (until < from) {
      errors.push({
        field: 'valid_until',
        message: 'Tanggal berakhir tidak boleh sebelum tanggal mulai',
        severity: 'error',
      });
    }
  }
  
  // ========== STRICT MODE ==========
  
  if (options.strictMode) {
    // Convert all warnings to errors
    const allErrors = [...errors, ...warnings.map(w => ({ ...w, severity: 'error' as const }))];
    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: [],
    };
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Quick check if turnover is required for validation
 * This is for UI hints only - actual validation uses toggle state
 */
export function isTurnoverTypicallyRequired(promoType: string): boolean {
  return !PROMO_TYPES_WITHOUT_TURNOVER.includes(
    promoType as typeof PROMO_TYPES_WITHOUT_TURNOVER[number]
  );
}

/**
 * Get validation hint text for turnover field
 */
export function getTurnoverValidationHint(promoType: string, isEnabled: boolean): string {
  if (isEnabled) {
    return 'Syarat main aktif — turnover wajib diisi';
  }
  
  const typicallyRequired = isTurnoverTypicallyRequired(promoType);
  
  if (typicallyRequired) {
    return `Promo "${promoType}" biasanya memiliki syarat turnover`;
  }
  
  return 'Tidak ada syarat main — bonus langsung bisa ditarik';
}
