/**
 * PROMO STORAGE ABSTRACTION LAYER
 * 
 * Pre-Supabase architecture - easy migration later:
 * - promoKB → localStorage (akan jadi Supabase)
 * - extractorSession → sessionStorage (tetap browser-only)
 * 
 * SEMUA component WAJIB import dari file ini
 * JANGAN langsung akses localStorage/sessionStorage
 */

import type { PromoFormData, PromoItem } from '@/components/VOCDashboard/PromoFormWizard/types';
import type { ExtractedPromo } from '@/lib/openai-extractor';

// Storage keys
const PROMO_KB_KEY = 'voc_promo_drafts';
const SESSION_KEY = 'pseudo_extractor_session';

// ============================================
// KNOWLEDGE BASE STORAGE (akan jadi Supabase)
// ============================================

export const promoKB = {
  /**
   * Get all promos from Knowledge Base
   */
  getAll: (): PromoItem[] => {
    try {
      const data = localStorage.getItem(PROMO_KB_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      console.error('[promoKB] Failed to parse storage');
      return [];
    }
  },

  /**
   * Get single promo by ID
   */
  getById: (id: string): PromoItem | null => {
    const all = promoKB.getAll();
    return all.find(p => p.id === id) || null;
  },

  /**
   * Add new promo to Knowledge Base
   */
  add: (promo: PromoFormData): PromoItem => {
    const existing = promoKB.getAll();
    const now = new Date().toISOString();
    
    const promoWithId = promo as PromoFormData & { id?: string };
    
    const newPromo: PromoItem = {
      ...promo,
      id: promoWithId.id || `promo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      version: 1,
      is_active: false,
      status: 'active',
      created_at: now,
      updated_at: now,
      updated_by: 'Admin',
    };
    
    existing.push(newPromo);
    localStorage.setItem(PROMO_KB_KEY, JSON.stringify(existing));
    
    console.log('[promoKB] Added promo:', newPromo.id);
    return newPromo;
  },

  /**
   * Update existing promo
   */
  update: (id: string, updates: Partial<PromoFormData>): boolean => {
    const existing = promoKB.getAll();
    const index = existing.findIndex(p => p.id === id);
    
    if (index === -1) {
      console.warn('[promoKB] Promo not found:', id);
      return false;
    }
    
    existing[index] = {
      ...existing[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    
    localStorage.setItem(PROMO_KB_KEY, JSON.stringify(existing));
    console.log('[promoKB] Updated promo:', id);
    return true;
  },

  /**
   * Delete promo from Knowledge Base
   */
  delete: (id: string): boolean => {
    const existing = promoKB.getAll();
    const filtered = existing.filter(p => p.id !== id);
    
    if (filtered.length === existing.length) {
      console.warn('[promoKB] Promo not found for deletion:', id);
      return false;
    }
    
    localStorage.setItem(PROMO_KB_KEY, JSON.stringify(filtered));
    console.log('[promoKB] Deleted promo:', id);
    return true;
  },

  // Nanti tinggal ganti implementation:
  // getAll: async () => await supabase.from('promo_kb').select('*')
  // add: async (promo) => await supabase.from('promo_kb').insert(promo)
  // etc.
};

// ============================================
// SESSION STORAGE (tetap di browser)
// ============================================

export type InputMode = 'url' | 'html' | 'image';

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
   */
  load: (): ExtractorSession | null => {
    try {
      const data = sessionStorage.getItem(SESSION_KEY);
      if (!data) return null;
      return JSON.parse(data) as ExtractorSession;
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
