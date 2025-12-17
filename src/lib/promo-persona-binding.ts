/**
 * Promo Persona Binding (PPB) v1.0
 * 
 * File ini TERPISAH dari PKB (Promo Knowledge Base).
 * PPB menyimpan konfigurasi AI/Persona yang terkait dengan promo,
 * tapi BUKAN bagian dari data promo itu sendiri.
 * 
 * Domain separation:
 * - PKB = Data deskriptif promo (fakta, aturan, periode)
 * - PPB = Cara AI berbicara tentang promo (template, guidelines)
 */

import { DEFAULT_AI_GUIDELINES } from './promo-guard-rules';

// ============================================
// INTERFACE: Persona Binding Config
// ============================================

export interface PromoPersonaBinding {
  promo_id: string;
  
  // AI Communication Templates
  ai_guidelines: string;
  response_template_offer: string;
  response_template_requirement: string;
  response_template_instruction: string;
  default_behavior: string;
  completion_steps: string;
  
  // Contact Channel (untuk eskalasi)
  contact_channel_enabled: boolean;
  contact_channel: string;
  contact_link: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
}

// ============================================
// DEFAULT VALUES
// ============================================

export const DEFAULT_PERSONA_BINDING: Omit<PromoPersonaBinding, 'promo_id' | 'created_at' | 'updated_at'> = {
  ai_guidelines: DEFAULT_AI_GUIDELINES,
  response_template_offer: '',
  response_template_requirement: '',
  response_template_instruction: '',
  default_behavior: '',
  completion_steps: '',
  contact_channel_enabled: false,
  contact_channel: '',
  contact_link: '',
};

// ============================================
// FIELD LISTS (untuk filtering saat save)
// ============================================

/**
 * Fields yang masuk ke Persona Binding (MOVE dari PKB)
 * Field-field ini TIDAK disimpan ke PKB object
 */
export const PERSONA_BINDING_FIELDS = [
  'ai_guidelines',
  'response_template_offer',
  'response_template_requirement',
  'response_template_instruction',
  'default_behavior',
  'completion_steps',
  'contact_channel_enabled',
  'contact_channel',
  'contact_link',
] as const;

/**
 * Fields yang di-DROP (duplikat atau tidak perlu)
 * Field-field ini tidak disimpan ke manapun
 */
export const DROPPED_FIELDS = [
  // Duplikat dengan unified fields
  'calculation_method',      // Implisit dalam conversion_formula
  'calculation_value',       // Implisit dalam conversion_formula
  'minimum_base',            // → gunakan min_requirement
  'minimum_base_enabled',    // → hapus toggle
  'dinamis_reward_type',     // → gunakan reward_type
  'dinamis_reward_amount',   // → gunakan reward_amount
  'dinamis_max_claim',       // → gunakan max_claim
  'dinamis_max_claim_unlimited', // → gunakan max_claim_unlimited
] as const;

// ============================================
// LOCAL STORAGE HELPERS
// ============================================

const PERSONA_BINDING_STORAGE_KEY = 'voc_promo_persona_bindings';

/**
 * Get all persona bindings from localStorage
 */
export function getPersonaBindings(): PromoPersonaBinding[] {
  try {
    const data = localStorage.getItem(PERSONA_BINDING_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Get persona binding by promo_id
 */
export function getPersonaBindingByPromoId(promoId: string): PromoPersonaBinding | undefined {
  const bindings = getPersonaBindings();
  return bindings.find(b => b.promo_id === promoId);
}

/**
 * Save persona binding for a promo
 */
export function savePersonaBinding(promoId: string, data: Partial<PromoPersonaBinding>): PromoPersonaBinding {
  const bindings = getPersonaBindings();
  const now = new Date().toISOString();
  
  const existingIndex = bindings.findIndex(b => b.promo_id === promoId);
  
  if (existingIndex !== -1) {
    // Update existing
    bindings[existingIndex] = {
      ...bindings[existingIndex],
      ...data,
      updated_at: now,
    };
    localStorage.setItem(PERSONA_BINDING_STORAGE_KEY, JSON.stringify(bindings));
    return bindings[existingIndex];
  }
  
  // Create new
  const newBinding: PromoPersonaBinding = {
    promo_id: promoId,
    ...DEFAULT_PERSONA_BINDING,
    ...data,
    created_at: now,
    updated_at: now,
  };
  
  bindings.push(newBinding);
  localStorage.setItem(PERSONA_BINDING_STORAGE_KEY, JSON.stringify(bindings));
  return newBinding;
}

/**
 * Delete persona binding by promo_id
 */
export function deletePersonaBinding(promoId: string): boolean {
  const bindings = getPersonaBindings();
  const filtered = bindings.filter(b => b.promo_id !== promoId);
  if (filtered.length !== bindings.length) {
    localStorage.setItem(PERSONA_BINDING_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  }
  return false;
}

/**
 * Extract persona binding fields from full promo data
 * Used during save to separate AI config from PKB
 */
export function extractPersonaBindingFields(data: Record<string, unknown>): Partial<PromoPersonaBinding> {
  const binding: Partial<PromoPersonaBinding> = {};
  
  for (const field of PERSONA_BINDING_FIELDS) {
    if (field in data) {
      (binding as Record<string, unknown>)[field] = data[field];
    }
  }
  
  return binding;
}
