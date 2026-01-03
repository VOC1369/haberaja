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
 * - Use useTrackedChange() to auto-track write intents
 * - Use getFieldEditTarget() to determine target for a field
 */

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import type { PromoFormData } from '@/components/VOCDashboard/PromoFormWizard/types';
import type { WriteIntent } from '@/lib/promo-write-contract';

// ============================================
// TYPES
// ============================================

/**
 * Target layer for editing
 */
export type EditTarget = 'base' | 'fixed' | 'subcategory';

/**
 * Write history entry for audit
 */
export interface WriteHistoryEntry {
  timestamp: number;
  field: string;
  target: EditTarget;
  subcategoryIndex?: number;
  previousValue: unknown;
  newValue: unknown;
}

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
  /** Track a field change (for audit) */
  trackChange: (field: string, previousValue: unknown, newValue: unknown, subcategoryIndex?: number) => WriteIntent;
  /** Get write history */
  getWriteHistory: () => WriteHistoryEntry[];
  /** Clear write history */
  clearWriteHistory: () => void;
  /** Current form data reference (for context-aware decisions) */
  formData: Partial<PromoFormData> | null;
  /** Update form data reference */
  setFormData: (data: Partial<PromoFormData>) => void;
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
  /** Initial form data for context-aware tracking */
  initialFormData?: Partial<PromoFormData>;
}

export function EditContextProvider({
  children,
  initialTarget = 'base',
  initialSubcategoryIndex,
  initialFormData,
}: EditContextProviderProps) {
  const [target, setTargetState] = useState<EditTarget>(initialTarget);
  const [subcategoryIndex, setSubcategoryIndex] = useState<number | undefined>(
    initialSubcategoryIndex
  );
  const [formData, setFormDataState] = useState<Partial<PromoFormData> | null>(initialFormData || null);
  const writeHistoryRef = useRef<WriteHistoryEntry[]>([]);

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

  const setFormData = useCallback((data: Partial<PromoFormData>) => {
    setFormDataState(data);
  }, []);

  /**
   * Track a field change and return WriteIntent for storage layer
   */
  const trackChange = useCallback((
    field: string,
    previousValue: unknown,
    newValue: unknown,
    overrideSubcategoryIndex?: number
  ): WriteIntent => {
    const effectiveTarget = target;
    const effectiveSubcategoryIndex = overrideSubcategoryIndex ?? subcategoryIndex;
    
    // Record in history
    const entry: WriteHistoryEntry = {
      timestamp: Date.now(),
      field,
      target: effectiveTarget,
      subcategoryIndex: effectiveSubcategoryIndex,
      previousValue,
      newValue,
    };
    writeHistoryRef.current.push(entry);
    
    // Keep only last 50 entries
    if (writeHistoryRef.current.length > 50) {
      writeHistoryRef.current = writeHistoryRef.current.slice(-50);
    }
    
    console.debug('[EditContext] Tracked change:', entry);
    
    // Return WriteIntent for storage layer
    return {
      target: effectiveTarget,
      field,
      value: newValue,
      subcategoryIndex: effectiveSubcategoryIndex,
      reason: `UI edit at ${new Date().toISOString()}`,
    };
  }, [target, subcategoryIndex]);

  const getWriteHistory = useCallback(() => {
    return [...writeHistoryRef.current];
  }, []);

  const clearWriteHistory = useCallback(() => {
    writeHistoryRef.current = [];
  }, []);

  return (
    <EditContextContext.Provider
      value={{
        target,
        subcategoryIndex,
        setTarget,
        reset,
        trackChange,
        getWriteHistory,
        clearWriteHistory,
        formData,
        setFormData,
      }}
    >
      {children}
    </EditContextContext.Provider>
  );
}

// ============================================
// HOOKS
// ============================================

/**
 * Get current edit context
 * 
 * @returns EditContext or safe default if no provider
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
      trackChange: (field, _prev, value) => {
        console.warn('[useEditContext] No EditContextProvider found');
        return { target: 'base', field, value };
      },
      getWriteHistory: () => [],
      clearWriteHistory: () => {},
      formData: null,
      setFormData: () => {},
    };
  }
  
  return context;
}

/**
 * Hook for creating tracked onChange handlers
 * 
 * Usage:
 * ```tsx
 * const { createTrackedHandler } = useTrackedChange();
 * 
 * <Input
 *   value={data.max_claim}
 *   onChange={createTrackedHandler('max_claim', data.max_claim, (value) => {
 *     onChange({ max_claim: Number(value) });
 *   })}
 * />
 * ```
 */
export function useTrackedChange() {
  const editContext = useEditContext();
  
  /**
   * Create a tracked onChange handler
   */
  const createTrackedHandler = useCallback(<T,>(
    field: string,
    previousValue: T,
    onChangeCallback: (newValue: T) => void,
    subcategoryIndex?: number
  ) => {
    return (newValue: T) => {
      // Track the change
      editContext.trackChange(field, previousValue, newValue, subcategoryIndex);
      // Execute the actual change
      onChangeCallback(newValue);
    };
  }, [editContext]);

  /**
   * Create a tracked event handler (for input events)
   */
  const createTrackedInputHandler = useCallback((
    field: string,
    previousValue: string | number,
    onChangeCallback: (e: React.ChangeEvent<HTMLInputElement>) => void,
    subcategoryIndex?: number
  ) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      // Track the change
      editContext.trackChange(field, previousValue, e.target.value, subcategoryIndex);
      // Execute the actual change
      onChangeCallback(e);
    };
  }, [editContext]);

  /**
   * Wrap an onChange handler to auto-track changes
   */
  const wrapOnChange = useCallback(<T extends Record<string, unknown>>(
    onChange: (updates: Partial<T>) => void,
    currentData: T,
    subcategoryIndex?: number
  ) => {
    return (updates: Partial<T>) => {
      // Track each field being updated
      Object.entries(updates).forEach(([field, newValue]) => {
        const previousValue = currentData[field];
        editContext.trackChange(field, previousValue, newValue, subcategoryIndex);
      });
      // Execute the actual change
      onChange(updates);
    };
  }, [editContext]);

  return {
    createTrackedHandler,
    createTrackedInputHandler,
    wrapOnChange,
    editContext,
  };
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
