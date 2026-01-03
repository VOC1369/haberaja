/**
 * useEditContext Hook
 * 
 * Tracks which layer the user is actively editing for audit clarity.
 * 
 * PROBLEM THIS SOLVES:
 * - Without explicit edit target, audit logs are meaningless
 * - UI cannot show "editing fixed_max_claim" vs "editing max_claim"
 * - Override could happen "tanpa niat" (unintentionally)
 * 
 * USAGE:
 * - Wrap form sections with EditContextProvider
 * - Use useEditContext() to get current edit target
 * - Use getFieldEditTarget() to determine target for a field
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { PromoFormData } from '@/components/VOCDashboard/PromoFormWizard/types';

// ============================================
// TYPES
// ============================================

/**
 * Target layer for editing
 */
export type EditTarget = 'base' | 'fixed' | 'subcategory';

/**
 * Edit context state
 */
export interface EditContext {
  /** Current edit target */
  target: EditTarget;
  /** Subcategory index if editing subcategory */
  subcategoryIndex?: number;
  /** Set the edit target */
  setTarget: (target: EditTarget, subcategoryIndex?: number) => void;
  /** Reset to base */
  reset: () => void;
}

/**
 * Field with fixed equivalent
 */
const FIXED_CAPABLE_FIELDS = new Set([
  'reward_type',
  'max_claim',
  'max_claim_unlimited',
  'calculation_base',
  'calculation_value',
  'turnover_rule',
  'turnover_rule_enabled',
  'payout_direction',
  'min_deposit',
]);

/**
 * Fields that can exist in subcategory
 */
const SUBCATEGORY_CAPABLE_FIELDS = new Set([
  'reward_type',
  'jenis_hadiah',
  'max_bonus',
  'max_bonus_unlimited',
  'calculation_base',
  'calculation_value',
  'turnover_rule',
  'turnover_rule_enabled',
  'payout_direction',
  'dinamis_reward_amount',
]);

// ============================================
// CONTEXT
// ============================================

const EditContextContext = createContext<EditContext | null>(null);

// ============================================
// PROVIDER
// ============================================

interface EditContextProviderProps {
  children: ReactNode;
  /** Initial target (default: 'base') */
  initialTarget?: EditTarget;
  /** Initial subcategory index */
  initialSubcategoryIndex?: number;
}

export function EditContextProvider({
  children,
  initialTarget = 'base',
  initialSubcategoryIndex,
}: EditContextProviderProps) {
  const [target, setTargetState] = useState<EditTarget>(initialTarget);
  const [subcategoryIndex, setSubcategoryIndex] = useState<number | undefined>(
    initialSubcategoryIndex
  );

  const setTarget = useCallback((newTarget: EditTarget, newSubcategoryIndex?: number) => {
    setTargetState(newTarget);
    setSubcategoryIndex(newTarget === 'subcategory' ? newSubcategoryIndex : undefined);
    
    console.debug('[EditContext] Target changed:', {
      target: newTarget,
      subcategoryIndex: newTarget === 'subcategory' ? newSubcategoryIndex : undefined,
    });
  }, []);

  const reset = useCallback(() => {
    setTargetState('base');
    setSubcategoryIndex(undefined);
  }, []);

  return (
    <EditContextContext.Provider
      value={{
        target,
        subcategoryIndex,
        setTarget,
        reset,
      }}
    >
      {children}
    </EditContextContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

/**
 * Get current edit context
 * 
 * @throws If used outside EditContextProvider
 */
export function useEditContext(): EditContext {
  const context = useContext(EditContextContext);
  
  if (!context) {
    // Return a safe default instead of throwing (for gradual adoption)
    return {
      target: 'base',
      subcategoryIndex: undefined,
      setTarget: () => {
        console.warn('[useEditContext] No EditContextProvider found');
      },
      reset: () => {
        console.warn('[useEditContext] No EditContextProvider found');
      },
    };
  }
  
  return context;
}

// ============================================
// HELPERS
// ============================================

/**
 * Determine the appropriate edit target for a field based on promo state
 * 
 * @param data Current promo data
 * @param fieldName Field being edited
 * @param subcategoryIndex Optional subcategory context
 * @returns The appropriate edit target
 */
export function getFieldEditTarget(
  data: Partial<PromoFormData>,
  fieldName: string,
  subcategoryIndex?: number
): EditTarget {
  // If we're in a subcategory context and field supports it
  if (subcategoryIndex !== undefined && SUBCATEGORY_CAPABLE_FIELDS.has(fieldName)) {
    return 'subcategory';
  }

  // If in fixed mode and field has fixed equivalent
  if (data.reward_mode === 'fixed' && FIXED_CAPABLE_FIELDS.has(fieldName)) {
    return 'fixed';
  }

  // Default to base
  return 'base';
}

/**
 * Get the actual field name to use based on edit target
 * 
 * @param fieldName Base field name
 * @param target Edit target
 * @returns Resolved field name (e.g., 'max_claim' → 'fixed_max_claim')
 */
export function getResolvedFieldName(
  fieldName: string,
  target: EditTarget
): string {
  if (target === 'fixed') {
    const fixedMap: Record<string, string> = {
      reward_type: 'fixed_reward_type',
      max_claim: 'fixed_max_claim',
      max_claim_unlimited: 'fixed_max_claim_unlimited',
      calculation_base: 'fixed_calculation_base',
      calculation_value: 'fixed_calculation_value',
      turnover_rule: 'fixed_turnover_rule',
      turnover_rule_enabled: 'fixed_turnover_rule_enabled',
      payout_direction: 'fixed_payout_direction',
      min_deposit: 'fixed_min_depo',
      min_deposit_enabled: 'fixed_min_depo_enabled',
    };
    return fixedMap[fieldName] || fieldName;
  }

  // Base and subcategory use the field name as-is
  return fieldName;
}

/**
 * Create a descriptive label for the current edit context
 * 
 * @param target Edit target
 * @param subcategoryIndex Subcategory index if applicable
 * @returns Human-readable label
 */
export function getEditContextLabel(
  target: EditTarget,
  subcategoryIndex?: number
): string {
  switch (target) {
    case 'fixed':
      return 'Editing Fixed Override';
    case 'subcategory':
      return `Editing Subcategory ${subcategoryIndex !== undefined ? subcategoryIndex + 1 : ''}`;
    case 'base':
    default:
      return 'Editing Base Value';
  }
}
