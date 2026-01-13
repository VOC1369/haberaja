/**
 * PROMO STORAGE ABSTRACTION LAYER
 * 
 * PRE-SUPABASE MODE: Uses localStorage as primary storage
 * Set USE_SUPABASE = true when Supabase is ready for production
 * 
 * - promoKB → localStorage (pre-production) / Supabase table: voc_promo_kb (production)
 * - extractorSession → sessionStorage (tetap browser-only)
 * 
 * SEMUA component WAJIB import dari file ini
 * JANGAN langsung akses Supabase atau localStorage
 */

import type { PromoFormData, PromoItem } from '@/components/VOCDashboard/PromoFormWizard/types';
import type { ExtractedPromo } from '@/lib/openai-extractor';
import { supabase, DEFAULT_CLIENT_ID, generateUUID, logSupabaseError } from '@/lib/supabase-client';
import { KEYWORD_OVERRIDE_VERSION } from '@/lib/extractors/category-classifier';
import { normalizeToStandard, normalizePromoArray } from '@/lib/promo-field-normalizer';
import { validateWriteIntent, type WriteIntent } from '@/lib/promo-write-contract';

// ============================================
// PRE-SUPABASE MODE CONFIGURATION
// ============================================
const USE_SUPABASE = false; // Set to true when Supabase table is ready
const STORAGE_KEY = 'voc_promo_kb';
const SESSION_KEY = 'pseudo_extractor_session';

// ============================================
// KNOWLEDGE BASE STORAGE
// ============================================

export const promoKB = {
  /**
   * Get all promos from Knowledge Base
   */
  getAll: async (): Promise<PromoItem[]> => {
    // PRE-SUPABASE: Use localStorage
    if (!USE_SUPABASE) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const promos: PromoItem[] = stored ? JSON.parse(stored) : [];
        console.log('[promoKB] Loaded from localStorage:', promos.length, 'promos');
        // Normalize legacy dinamis_* fields to canonical base fields
        return normalizePromoArray(promos);
      } catch (error) {
        console.error('[promoKB] Failed to load from localStorage:', error);
        return [];
      }
    }

    // SUPABASE MODE (for production)
    try {
      const { data, error } = await supabase
        .from('voc_promo_kb')
        .select('*')
        .eq('client_id', DEFAULT_CLIENT_ID)
        .order('created_at', { ascending: false });

      if (error) {
        logSupabaseError('promoKB.getAll', error);
        return [];
      }

      return (data || []).map(row => {
        const promo = {
          ...row.promo_data,
          id: row.id,
          promo_name: row.promo_name,
          promo_type: row.promo_type,
          intent_category: row.intent_category,
          status: row.status,
          is_active: row.is_active,
          version: row.version,
          created_at: row.created_at,
          updated_at: row.updated_at,
          updated_by: row.updated_by,
          program_classification: row.program_classification,
        };
        // Normalize legacy dinamis_* fields to canonical base fields
        return normalizeToStandard(promo);
      });
    } catch (error) {
      logSupabaseError('promoKB.getAll', error);
      return [];
    }
  },

  /**
   * Get single promo by ID
   */
  getById: async (id: string): Promise<PromoItem | null> => {
    // PRE-SUPABASE: Use localStorage
    if (!USE_SUPABASE) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const promos: PromoItem[] = stored ? JSON.parse(stored) : [];
        const found = promos.find(p => p.id === id) || null;
        // Normalize legacy dinamis_* fields to canonical base fields
        return found ? normalizeToStandard(found) : null;
      } catch (error) {
        console.error('[promoKB] Failed to get by id from localStorage:', error);
        return null;
      }
    }

    // SUPABASE MODE
    try {
      const { data, error } = await supabase
        .from('voc_promo_kb')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        if (error) logSupabaseError('promoKB.getById', error);
        return null;
      }

      const promo = {
        ...data.promo_data,
        id: data.id,
        promo_name: data.promo_name,
        promo_type: data.promo_type,
        intent_category: data.intent_category,
        status: data.status,
        is_active: data.is_active,
        version: data.version,
        created_at: data.created_at,
        updated_at: data.updated_at,
        updated_by: data.updated_by,
        program_classification: data.program_classification,
      };
      // Normalize legacy dinamis_* fields to canonical base fields
      return normalizeToStandard(promo);
    } catch (error) {
      logSupabaseError('promoKB.getById', error);
      return null;
    }
  },

  /**
   * Add new promo to Knowledge Base
   */
  add: async (promo: PromoFormData): Promise<PromoItem> => {
    const now = new Date().toISOString();
    const promoWithId = promo as PromoFormData & { id?: string };
    const id = promoWithId.id || generateUUID();

    const newItem: PromoItem = {
      ...promo,
      id,
      status: promo.status || 'draft',
      is_active: false,
      version: 1,
      created_at: now,
      updated_at: now,
      updated_by: 'Admin',
    };

    // PRE-SUPABASE: Use localStorage
    if (!USE_SUPABASE) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const promos: PromoItem[] = stored ? JSON.parse(stored) : [];
        
        promos.unshift(newItem); // Add to beginning (newest first)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(promos));
        
        window.dispatchEvent(new CustomEvent('promo-storage-updated'));
        console.log('[promoKB] Added promo (localStorage):', id, promo.promo_name);
        
        return newItem;
      } catch (error) {
        console.error('[promoKB] Failed to add to localStorage:', error);
        throw new Error('Failed to add promo to localStorage');
      }
    }

    // SUPABASE MODE
    const newRow = {
      id,
      client_id: DEFAULT_CLIENT_ID,
      promo_name: promo.promo_name,
      promo_type: promo.promo_type,
      intent_category: promo.intent_category,
      promo_data: promo,
      status: promo.status || 'draft',
      is_active: false,
      version: 1,
      program_classification: promo.program_classification || null,
      created_at: now,
      updated_at: now,
      updated_by: 'Admin',
    };

    const { data, error } = await supabase
      .from('voc_promo_kb')
      .insert(newRow)
      .select()
      .single();

    if (error) {
      logSupabaseError('promoKB.add', error);
      throw new Error('Failed to add promo to database');
    }

    window.dispatchEvent(new CustomEvent('promo-storage-updated'));
    console.log('[promoKB] Added promo:', data.id, data.promo_name);

    return {
      ...data.promo_data,
      id: data.id,
      promo_name: data.promo_name,
      promo_type: data.promo_type,
      intent_category: data.intent_category,
      status: data.status,
      is_active: data.is_active,
      version: data.version,
      created_at: data.created_at,
      updated_at: data.updated_at,
      updated_by: data.updated_by,
      program_classification: data.program_classification,
    };
  },

  /**
   * Update existing promo
   * @param id - Promo ID to update
   * @param updates - Partial updates to apply
   * @param writeIntent - Optional explicit write intent for validation (audit-safe)
   */
  update: async (id: string, updates: Partial<PromoFormData>, writeIntent?: WriteIntent): Promise<boolean> => {
    // PRE-SUPABASE: Use localStorage
    if (!USE_SUPABASE) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const promos: PromoItem[] = stored ? JSON.parse(stored) : [];
        
        const index = promos.findIndex(p => p.id === id);
        if (index === -1) {
          console.warn('[promoKB] Promo not found:', id);
          return false;
        }
        
        // Validate Write Intent if provided (audit-safe writes)
        if (writeIntent) {
          const validation = validateWriteIntent(promos[index], writeIntent);
          if (!validation.valid) {
            console.error('[promoKB] Write validation failed:', validation.error);
            console.error('[promoKB] Intent:', writeIntent);
            return false;
          }
          console.log('[promoKB] Write intent validated:', writeIntent.target, '->', validation.resolvedField);
        }
        
        promos[index] = {
          ...promos[index],
          ...updates,
          version: (promos[index].version || 1) + 1,
          updated_at: new Date().toISOString(),
        };
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(promos));
        window.dispatchEvent(new CustomEvent('promo-storage-updated'));
        console.log('[promoKB] Updated promo (localStorage):', id, writeIntent?.target || 'unspecified');
        
        return true;
      } catch (error) {
        console.error('[promoKB] Failed to update in localStorage:', error);
        return false;
      }
    }

    // SUPABASE MODE
    try {
      const { data: current } = await supabase
        .from('voc_promo_kb')
        .select('promo_data, version')
        .eq('id', id)
        .maybeSingle();

      if (!current) {
        console.warn('[promoKB] Promo not found:', id);
        return false;
      }

      const mergedData = { ...current.promo_data, ...updates };

      const updatePayload: Record<string, unknown> = {
        promo_name: updates.promo_name || mergedData.promo_name,
        promo_type: updates.promo_type || mergedData.promo_type,
        intent_category: updates.intent_category || mergedData.intent_category,
        promo_data: mergedData,
        status: updates.status || mergedData.status,
        version: (current.version || 1) + 1,
        program_classification: updates.program_classification || mergedData.program_classification,
        updated_at: new Date().toISOString(),
      };

      if ('is_active' in updates) {
        updatePayload.is_active = updates.is_active;
      } else if ('is_active' in mergedData) {
        updatePayload.is_active = mergedData.is_active;
      }

      const { error } = await supabase
        .from('voc_promo_kb')
        .update(updatePayload)
        .eq('id', id);

      if (error) {
        logSupabaseError('promoKB.update', error);
        return false;
      }

      window.dispatchEvent(new CustomEvent('promo-storage-updated'));
      console.log('[promoKB] Updated promo:', id);
      return true;
    } catch (error) {
      logSupabaseError('promoKB.update', error);
      return false;
    }
  },

  /**
   * Delete promo from Knowledge Base
   */
  delete: async (id: string): Promise<boolean> => {
    // PRE-SUPABASE: Use localStorage
    if (!USE_SUPABASE) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const promos: PromoItem[] = stored ? JSON.parse(stored) : [];
        
        const filtered = promos.filter(p => p.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        
        window.dispatchEvent(new CustomEvent('promo-storage-updated'));
        console.log('[promoKB] Deleted promo (localStorage):', id);
        
        return true;
      } catch (error) {
        console.error('[promoKB] Failed to delete from localStorage:', error);
        return false;
      }
    }

    // SUPABASE MODE
    try {
      const { error } = await supabase
        .from('voc_promo_kb')
        .delete()
        .eq('id', id);

      if (error) {
        logSupabaseError('promoKB.delete', error);
        return false;
      }

      window.dispatchEvent(new CustomEvent('promo-storage-updated'));
      console.log('[promoKB] Deleted promo:', id);
      return true;
    } catch (error) {
      logSupabaseError('promoKB.delete', error);
      return false;
    }
  },
};

// ============================================
// SESSION STORAGE (tetap di browser)
// ============================================

export type InputMode = 'url' | 'html' | 'image' | 'text' | 'hybrid';

export interface EditHistoryItem {
  command: string;
  success: boolean;
  message: string;
  timestamp: number;
}

export interface ExtractorSession {
  extractedPromo: ExtractedPromo | null;
  editHistory: EditHistoryItem[];
  inputMode: InputMode;
  lastInput: string;
  imagePreview: string | null;
  timestamp: number;
}

export const extractorSession = {
  /**
   * Save session data (partial update)
   */
  save: (data: Partial<ExtractorSession>): void => {
    try {
      const current = extractorSession.load() || {
        extractedPromo: null,
        editHistory: [],
        inputMode: 'url' as InputMode,
        lastInput: '',
        imagePreview: null,
        timestamp: Date.now(),
      };

      const updated: ExtractorSession = {
        ...current,
        ...data,
        timestamp: Date.now(),
      };

      sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
      console.log('[extractorSession] Saved');
    } catch (e) {
      console.error('[extractorSession] Failed to save:', e);
    }
  },

  /**
   * Load session data
   * Auto-invalidates if keyword override version changed
   */
  load: (): ExtractorSession | null => {
    try {
      const data = sessionStorage.getItem(SESSION_KEY);
      if (!data) return null;
      
      const parsed = JSON.parse(data) as ExtractorSession & { 
        _keyword_override_version?: string 
      };
      
      // Auto-invalidate if classifier version changed
      if (parsed._keyword_override_version && parsed._keyword_override_version !== KEYWORD_OVERRIDE_VERSION) {
        console.log('[extractorSession] Invalidated: classifier version changed from', 
          parsed._keyword_override_version, 'to', KEYWORD_OVERRIDE_VERSION);
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      
      return parsed;
    } catch {
      console.error('[extractorSession] Failed to load');
      return null;
    }
  },

  /**
   * Clear session (hard reset)
   */
  clear: (): void => {
    sessionStorage.removeItem(SESSION_KEY);
    console.log('[extractorSession] Cleared');
  },

  /**
   * Check if session has extracted data
   */
  hasData: (): boolean => {
    const session = extractorSession.load();
    return !!session?.extractedPromo;
  },
};
