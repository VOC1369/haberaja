/**
 * USE ARCHETYPE CONTEXT v1.0
 * 
 * ARCHITECTURAL LOCK #4:
 * UI = archetype-driven rendering, not mode-driven
 * 
 * This hook provides:
 * 1. Archetype detection from form data
 * 2. Field applicability resolution
 * 3. Locked field enforcement
 * 4. Confidence signaling
 * 
 * UI components should use this hook to determine:
 * - Which fields to show/hide
 * - Which fields are locked (readonly)
 * - What the current archetype is
 * 
 * VERSION: v1.0.0+2025-01-15 (LOCKED)
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { 
  type PromoArchetype, 
  ARCHETYPE_RULES, 
  getArchetypeRule,
  getArchetypeDisplayName 
} from '@/lib/extractors/promo-taxonomy';
import { detectArchetype, type ArchetypeDetectionResult } from '@/lib/extractors/archetype-detector';
import { 
  deriveFieldsForArchetype, 
  getFieldApplicability,
  applyLockedFields 
} from '@/lib/extractors/field-derivation-engine';
import { 
  validateArchetypeInvariants,
  validateFullPipeline 
} from '@/lib/extractors/archetype-invariant-validator';

// ============================================
// CONTEXT TYPES
// ============================================

export interface ArchetypeContextValue {
  // Current archetype
  archetype: PromoArchetype;
  archetypeDisplayName: string;
  
  // Detection result
  detectionResult: ArchetypeDetectionResult | null;
  
  // Field applicability
  applicableFields: string[];
  notApplicableFields: string[];
  optionalFields: string[];
  lockedFields: string[];
  
  // Confidence and flags
  confidence: 'high' | 'medium' | 'low';
  ambiguityFlags: string[];
  
  // Validation
  isValid: boolean;
  violations: string[];
  
  // Functions
  isFieldApplicable: (fieldName: string) => boolean;
  isFieldLocked: (fieldName: string) => boolean;
  getLockedValue: (fieldName: string) => unknown | undefined;
}

// ============================================
// CONTEXT CREATION
// ============================================

const ArchetypeContext = createContext<ArchetypeContextValue | null>(null);

// ============================================
// PROVIDER COMPONENT
// ============================================

interface ArchetypeProviderProps {
  formData: {
    promo_name?: string;
    terms?: string;
    [key: string]: unknown;
  };
  children: ReactNode;
}

export function ArchetypeProvider({ formData, children }: ArchetypeProviderProps) {
  const contextValue = useMemo(() => {
    const promoName = formData.promo_name || '';
    const terms = typeof formData.terms === 'string' ? formData.terms : '';
    
    // Detect archetype
    const detectionResult = detectArchetype(promoName, terms, formData);
    const archetype = detectionResult.archetype;
    
    // Get applicability
    const applicability = getFieldApplicability(archetype);
    
    // Get locked fields from archetype rule
    const rule = getArchetypeRule(archetype);
    const lockedFields = rule ? Object.keys(rule.locked_fields) : [];
    
    // Validate
    const validationResult = validateFullPipeline(archetype, formData);
    
    // Build locked value map
    const lockedValueMap: Record<string, unknown> = {};
    if (rule) {
      for (const [fieldName, constraint] of Object.entries(rule.locked_fields)) {
        if (constraint && typeof constraint === 'object' && 'value' in constraint) {
          lockedValueMap[fieldName] = constraint.value;
        }
      }
    }
    
    return {
      archetype,
      archetypeDisplayName: getArchetypeDisplayName(archetype),
      detectionResult,
      
      applicableFields: applicability.applicable,
      notApplicableFields: applicability.not_applicable,
      optionalFields: applicability.optional,
      lockedFields,
      
      confidence: detectionResult.confidence,
      ambiguityFlags: detectionResult.ambiguity_flags,
      
      isValid: validationResult.valid,
      violations: validationResult.violations.map(v => v.message),
      
      isFieldApplicable: (fieldName: string) => {
        if (applicability.not_applicable.includes(fieldName)) return false;
        if (applicability.applicable.includes(fieldName)) return true;
        if (applicability.optional.includes(fieldName)) return true;
        return true; // Default: applicable
      },
      
      isFieldLocked: (fieldName: string) => lockedFields.includes(fieldName),
      
      getLockedValue: (fieldName: string) => lockedValueMap[fieldName],
    };
  }, [formData]);

  return (
    <ArchetypeContext.Provider value={contextValue}>
      {children}
    </ArchetypeContext.Provider>
  );
}

// ============================================
// MAIN HOOK
// ============================================

export function useArchetypeContext(): ArchetypeContextValue {
  const context = useContext(ArchetypeContext);
  if (!context) {
    throw new Error('useArchetypeContext must be used within an ArchetypeProvider');
  }
  return context;
}

// ============================================
// STANDALONE HOOKS (no provider needed)
// ============================================

/**
 * useArchetypeResolver
 * 
 * Standalone hook to resolve archetype from form data.
 * Use when you just need archetype detection without full context.
 */
export function useArchetypeResolver(formData: {
  promo_name?: string;
  terms?: string;
  [key: string]: unknown;
}): {
  archetype: PromoArchetype;
  displayName: string;
  confidence: 'high' | 'medium' | 'low';
  ambiguityFlags: string[];
} {
  return useMemo(() => {
    const promoName = formData.promo_name || '';
    const terms = typeof formData.terms === 'string' ? formData.terms : '';
    
    const result = detectArchetype(promoName, terms, formData);
    
    return {
      archetype: result.archetype,
      displayName: getArchetypeDisplayName(result.archetype),
      confidence: result.confidence,
      ambiguityFlags: result.ambiguity_flags,
    };
  }, [formData]);
}

/**
 * useFieldApplicability
 * 
 * Standalone hook to check field applicability for an archetype.
 */
export function useFieldApplicability(archetype: PromoArchetype): {
  isApplicable: (fieldName: string) => boolean;
  isLocked: (fieldName: string) => boolean;
  applicableFields: string[];
  notApplicableFields: string[];
} {
  return useMemo(() => {
    const applicability = getFieldApplicability(archetype);
    const rule = getArchetypeRule(archetype);
    const lockedFields = rule ? Object.keys(rule.locked_fields) : [];
    
    return {
      isApplicable: (fieldName: string) => {
        if (applicability.not_applicable.includes(fieldName)) return false;
        return true;
      },
      isLocked: (fieldName: string) => lockedFields.includes(fieldName),
      applicableFields: applicability.applicable,
      notApplicableFields: applicability.not_applicable,
    };
  }, [archetype]);
}

/**
 * useDerivedFields
 * 
 * Hook to derive field values from evidence.
 * Use when populating form from extraction.
 */
export function useDerivedFields(
  archetype: PromoArchetype,
  promoName: string,
  terms: string,
  existingFields: Record<string, unknown> = {}
): {
  fields: Record<string, unknown>;
  lockedFields: string[];
  derivedFields: string[];
  confidence: 'high' | 'medium' | 'low';
} {
  return useMemo(() => {
    const result = deriveFieldsForArchetype(
      archetype,
      promoName,
      terms,
      existingFields
    );
    
    return {
      fields: result.fields,
      lockedFields: result.locked_fields,
      derivedFields: result.derived_fields,
      confidence: result.confidence,
    };
  }, [archetype, promoName, terms, existingFields]);
}

// ============================================
// UI HELPER FUNCTIONS
// ============================================

/**
 * getFieldVisibility
 * 
 * Determines if a field should be visible in the UI.
 * Returns 'show' | 'hide' | 'disabled'
 */
export function getFieldVisibility(
  archetype: PromoArchetype,
  fieldName: string
): 'show' | 'hide' | 'disabled' {
  const rule = getArchetypeRule(archetype);
  if (!rule) return 'show';
  
  // Check not_applicable
  if (rule.not_applicable_fields.includes(fieldName)) {
    return 'hide';
  }
  
  // Check locked
  if (fieldName in rule.locked_fields) {
    return 'disabled';
  }
  
  return 'show';
}

/**
 * shouldShowSection
 * 
 * Determines if a form section should be visible based on archetype.
 */
export function shouldShowSection(
  archetype: PromoArchetype,
  sectionFields: string[]
): boolean {
  const rule = getArchetypeRule(archetype);
  if (!rule) return true;
  
  // Section should show if at least one field is applicable
  return sectionFields.some(
    field => !rule.not_applicable_fields.includes(field)
  );
}
