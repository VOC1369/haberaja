/**
 * POLICY STORAGE ABSTRACTION LAYER
 * 
 * Storage untuk Policy Programs (Category C)
 * TERPISAH dari promoKB - JANGAN DIGABUNG
 * 
 * localStorage key: voc_policy_kb
 */

import type { PolicyConfigData } from '@/components/VOCDashboard/PromoFormWizard/policy-config/types';

// Storage key - DIFFERENT from promo
const POLICY_KB_KEY = 'voc_policy_kb';

export interface PolicyItem extends PolicyConfigData {
  id: string;
  version: number;
  is_active: boolean;
  status: 'draft' | 'active' | 'paused' | 'deprecated';
  program_classification: 'C';
  program_classification_name: 'Policy Program';
  created_at: string;
  updated_at: string;
  updated_by: string;
  source_url?: string;
  raw_content?: string;
}

// ============================================
// POLICY KNOWLEDGE BASE STORAGE
// ============================================

export const policyKB = {
  /**
   * Get all policies from Knowledge Base
   */
  getAll: (): PolicyItem[] => {
    try {
      const data = localStorage.getItem(POLICY_KB_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      console.error('[policyKB] Failed to parse storage');
      return [];
    }
  },

  /**
   * Get single policy by ID
   */
  getById: (id: string): PolicyItem | null => {
    const all = policyKB.getAll();
    return all.find(p => p.id === id) || null;
  },

  /**
   * Add new policy to Knowledge Base
   * CRITICAL: This is for Category C ONLY
   */
  add: (policy: PolicyConfigData, metadata?: { source_url?: string; raw_content?: string }): PolicyItem => {
    const existing = policyKB.getAll();
    const now = new Date().toISOString();
    
    const newPolicy: PolicyItem = {
      ...policy,
      id: `policy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      version: 1,
      is_active: false,
      status: policy.identity?.status || 'draft',
      program_classification: 'C',
      program_classification_name: 'Policy Program',
      created_at: now,
      updated_at: now,
      updated_by: 'Admin',
      source_url: metadata?.source_url,
      raw_content: metadata?.raw_content,
    };
    
    existing.push(newPolicy);
    localStorage.setItem(POLICY_KB_KEY, JSON.stringify(existing));
    
    // Dispatch custom event for same-window listeners
    window.dispatchEvent(new CustomEvent('policy-storage-updated'));
    
    console.log('[policyKB] Added policy:', newPolicy.id, newPolicy.identity?.policy_name);
    return newPolicy;
  },

  /**
   * Update existing policy
   */
  update: (id: string, updates: Partial<PolicyConfigData>): boolean => {
    const existing = policyKB.getAll();
    const index = existing.findIndex(p => p.id === id);
    
    if (index === -1) {
      console.warn('[policyKB] Policy not found:', id);
      return false;
    }
    
    existing[index] = {
      ...existing[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    
    localStorage.setItem(POLICY_KB_KEY, JSON.stringify(existing));
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent('policy-storage-updated'));
    
    console.log('[policyKB] Updated policy:', id);
    return true;
  },

  /**
   * Delete policy from Knowledge Base
   */
  delete: (id: string): boolean => {
    const existing = policyKB.getAll();
    const filtered = existing.filter(p => p.id !== id);
    
    if (filtered.length === existing.length) {
      console.warn('[policyKB] Policy not found for deletion:', id);
      return false;
    }
    
    localStorage.setItem(POLICY_KB_KEY, JSON.stringify(filtered));
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent('policy-storage-updated'));
    
    console.log('[policyKB] Deleted policy:', id);
    return true;
  },

  /**
   * Get count of policies
   */
  count: (): number => {
    return policyKB.getAll().length;
  },

  /**
   * Clear all policies (for testing)
   */
  clear: (): void => {
    localStorage.removeItem(POLICY_KB_KEY);
    window.dispatchEvent(new CustomEvent('policy-storage-updated'));
    console.log('[policyKB] Cleared all policies');
  },
};

// ============================================
// POLICY MAPPER FUNCTION
// Maps ExtractedPromo (Policy type) → PolicyConfigData
// CRITICAL: NO REWARD FIELDS
// ============================================

export function mapExtractedToPolicyFormData(extracted: any): PolicyConfigData {
  console.log('[PolicyMapper] Mapping extracted policy:', extracted);
  
  // Parse deposit methods
  const depositMethods: string[] = [];
  if (extracted.deposit_rules?.deposit_methods) {
    depositMethods.push(...extracted.deposit_rules.deposit_methods);
  } else if (extracted.deposit_method) {
    // Handle string or array
    if (Array.isArray(extracted.deposit_method)) {
      depositMethods.push(...extracted.deposit_method);
    } else if (typeof extracted.deposit_method === 'string') {
      depositMethods.push(extracted.deposit_method);
    }
  }
  
  // Parse penalties
  const penalties: Array<{
    id: string;
    type: string;
    detail: string;
    percentage?: number;
    minimum_amount?: string;
  }> = [];
  
  if (extracted.penalties && Array.isArray(extracted.penalties)) {
    extracted.penalties.forEach((p: any, i: number) => {
      penalties.push({
        id: `penalty_${i}`,
        type: p.type || 'potongan_withdraw',
        detail: p.detail || '',
        percentage: p.percentage,
        minimum_amount: p.minimum_amount,
      });
    });
  }
  
  // Parse game requirements
  const gameRequirements: Array<{
    id: string;
    game_category: string;
    credit_multiplier: string;
    max_bet_rule: string;
  }> = [];
  
  if (extracted.usage_requirements && Array.isArray(extracted.usage_requirements)) {
    extracted.usage_requirements.forEach((req: any, i: number) => {
      gameRequirements.push({
        id: `req_${i}`,
        game_category: req.game_category || '',
        credit_multiplier: req.credit_multiplier || '',
        max_bet_rule: req.max_bet_rule || '',
      });
    });
  }
  
  // Parse bonus exclusion
  const bonusExclusion = extracted.bonus_exclusion || {};
  
  // Map to PolicyConfigData structure
  const policyData: PolicyConfigData = {
    identity: {
      policy_name: extracted.policy_name || extracted.promo_name || '',
      policy_type: extracted.policy_type || 'deposit_policy',
      status: 'draft',
      client_id: extracted.client_id || '',
    },
    deposit_rules: {
      deposit_methods: depositMethods,
      accepted_providers: extracted.deposit_rules?.accepted_providers || extracted.accepted_providers || '',
      minimal_deposit: extracted.deposit_rules?.minimal_deposit || extracted.minimal_deposit || '',
      maximal_deposit: extracted.deposit_rules?.maximal_deposit || extracted.maximal_deposit || '',
      confirmation_required: extracted.deposit_rules?.confirmation_required || extracted.confirmation_required || false,
      confirmation_method: extracted.deposit_rules?.confirmation_method || extracted.confirmation_method || '',
    },
    usage: {
      requirement_type: gameRequirements.length > 0 ? 'credit_multiplier' : 'none',
      game_requirements: gameRequirements,
    },
    game_scope: {
      applicable_games: extracted.game_scope?.applicable_games || [],
      excluded_games: extracted.game_scope?.excluded_games || extracted.excluded_games || [],
      scope_notes: extracted.game_scope?.scope_notes || '',
    },
    restrictions: {
      prohibitions: extracted.restrictions?.prohibitions || [],
    },
    penalties: {
      selected_penalties: penalties.map(p => p.type),
      penalties: penalties,
      penalty_detail: penalties.map(p => p.detail).filter(Boolean).join('; '),
      withdraw_percentage: penalties.find(p => p.percentage)?.percentage || 0,
      withdraw_minimum: penalties.find(p => p.minimum_amount)?.minimum_amount || '',
    },
    bonus_exclusion: {
      no_deposit_bonus: bonusExclusion.no_deposit_bonus ?? true,
      no_newmember_bonus: bonusExclusion.no_newmember_bonus ?? true,
      no_daily_bonus: bonusExclusion.no_daily_bonus ?? false,
      only_weekly_bonus: bonusExclusion.only_weekly_bonus ?? false,
      bonus_notes: bonusExclusion.bonus_notes || '',
    },
    authority: {
      authority_clause: extracted.authority?.authority_clause || 'Semua keputusan manajemen bersifat final.',
      terms_can_change: extracted.authority?.terms_can_change ?? true,
    },
    ai_behavior: {
      can_explain_rules: true,
      can_explain_consequences: true,
      can_redirect_to_cs: true,
      can_call_it_bonus: false,
      can_calculate_reward: false,
      can_promise_prize: false,
    },
  };
  
  console.log('[PolicyMapper] Mapped result:', policyData);
  return policyData;
}
