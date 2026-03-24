/**
 * PROMO STORAGE ABSTRACTION LAYER
 *
 * SUPABASE MODE: Tabel `promo_kb` (flat columns, schema v2.2)
 * - Semua operasi CRUD diarahkan ke Supabase
 * - Fallback ke localStorage hanya jika USE_SUPABASE = false
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
// STORAGE CONFIGURATION
// ============================================
const USE_SUPABASE = true;          // Supabase is live — tabel: promo_kb
const TABLE = 'promo_kb';           // Satu-satunya nama tabel. Jangan ubah.
const STORAGE_KEY = 'voc_promo_kb'; // localStorage fallback key (pre-production only)
const SESSION_KEY = 'pseudo_extractor_session';

// ============================================
// FLAT COLUMN MAPPER: PromoFormData → promo_kb row
// ============================================

/**
 * Memetakan PromoFormData ke flat columns tabel promo_kb.
 * Field yang tidak ada di schema tabel disimpan ke extra_config.
 */
function toFlatRow(promo: PromoFormData, id: string, now: string): Record<string, unknown> {
  // Field-field yang masuk ke extra_config (tidak ada kolom flat-nya)
  const extraConfigFields: Record<string, unknown> = {};

  const knownFields = new Set([
    'promo_id', 'client_id', 'client_name', 'promo_name', 'promo_slug',
    'schema_version', 'status', 'source_url', 'promo_summary',
    'category', 'mode', 'intent_category', 'target_segment',
    'trigger_event', 'trigger_min_value',
    'reward_type', 'reward_unit', 'reward_amount', 'reward_is_percentage',
    'reward_item_description', 'calculation_basis', 'payout_direction',
    'conversion_formula', 'tier_archetype', 'tier_count', 'tiers',
    'min_calculation', 'min_deposit', 'max_bonus', 'max_bonus_unlimited',
    'turnover_enabled', 'turnover_multiplier', 'turnover_basis', 'turnover_basis_extra',
    'min_withdraw_after_bonus', 'claim_frequency', 'claim_method',
    'claim_deadline_days', 'claim_platform', 'claim_url',
    'proof_required', 'proof_type', 'proof_destination',
    'max_claim', 'max_claim_unlimited',
    'distribution_mode', 'distribution_schedule', 'distribution_note',
    'game_scope', 'game_types', 'game_providers', 'game_exclusions',
    'platform_access', 'geo_restriction', 'require_apk',
    'valid_from', 'valid_until', 'valid_until_unlimited',
    'one_account_rule', 'promo_risk_level', 'anti_fraud_notes',
    'custom_terms', 'special_conditions', 'extra_config',
    'archetype_payload', 'archetype_invariants',
    'has_subcategories', 'subcategories',
    'extraction_confidence', 'human_verified', 'penalty_type',
    'created_by', 'created_at', 'updated_at',
  ]);

  // Kumpulkan field non-standard ke extra_config
  Object.entries(promo).forEach(([key, val]) => {
    if (!knownFields.has(key) && val !== undefined && val !== null) {
      extraConfigFields[key] = val;
    }
  });

  const mergedExtra = {
    ...(typeof promo.extra_config === 'object' && promo.extra_config !== null
      ? (promo.extra_config as Record<string, unknown>)
      : {}),
    ...extraConfigFields,
  };

  // Tentukan mode dari reward_mode
  const mode = (promo as PromoFormData & { reward_mode?: string }).reward_mode
    || (promo as Record<string, unknown>).mode as string
    || null;

  return {
    id,
    promo_id:               promo.promo_slug || id,
    client_id:              promo.client_id || DEFAULT_CLIENT_ID,
    client_name:            promo.client_name || null,
    promo_name:             promo.promo_name,
    promo_slug:             promo.promo_slug || null,
    schema_version:         '2.2',
    status:                 promo.status || 'draft',
    source_url:             promo.source_url || null,
    promo_summary:          promo.promo_summary || null,

    // Taxonomy
    category:               promo.category || null,
    mode,
    intent_category:        promo.intent_category || null,
    target_segment:         promo.target_segment || null,
    trigger_event:          promo.trigger_event || null,
    trigger_min_value:      (promo as Record<string, unknown>).trigger_min_value as number ?? null,

    // Reward Core
    reward_type:            promo.reward_type || null,
    reward_unit:            (promo as Record<string, unknown>).reward_unit as string ?? null,
    reward_amount:          promo.reward_amount ?? null,
    reward_is_percentage:   (promo as Record<string, unknown>).reward_is_percentage as boolean ?? false,
    reward_item_description:(promo as Record<string, unknown>).reward_item_description as string ?? null,

    // Calculation
    calculation_basis:      (promo as Record<string, unknown>).calculation_basis as string
                            || (promo as Record<string, unknown>).calculation_base as string
                            || null,
    payout_direction:       (promo as Record<string, unknown>).payout_direction as string ?? null,
    conversion_formula:     promo.conversion_formula || null,

    // Tiers
    tier_archetype:         promo.tier_archetype || null,
    tier_count:             Array.isArray(promo.tiers) ? promo.tiers.length : 0,
    tiers:                  promo.tiers || [],

    // Calculation limits
    min_calculation:        promo.min_calculation ?? null,
    min_deposit:            promo.min_deposit ?? null,
    max_bonus:              (promo as Record<string, unknown>).max_bonus as number ?? null,
    max_bonus_unlimited:    (promo as Record<string, unknown>).max_bonus_unlimited as boolean ?? false,

    // Turnover
    turnover_enabled:       promo.turnover_rule_enabled ?? false,
    turnover_multiplier:    (promo as Record<string, unknown>).turnover_multiplier as number ?? null,
    turnover_basis:         (promo as Record<string, unknown>).turnover_basis as string ?? null,
    turnover_basis_extra:   (promo as Record<string, unknown>).turnover_basis_extra as string ?? null,
    min_withdraw_after_bonus:(promo as Record<string, unknown>).min_withdraw_after_bonus as number ?? null,

    // Claim
    claim_frequency:        promo.claim_frequency || null,
    claim_method:           promo.claim_method || null,
    claim_deadline_days:    (promo as Record<string, unknown>).claim_deadline_days as number ?? null,
    claim_platform:         (promo as Record<string, unknown>).claim_platform as string ?? null,
    claim_url:              (promo as Record<string, unknown>).claim_url as string ?? null,
    max_claim:              promo.max_claim ?? null,
    max_claim_unlimited:    (promo as Record<string, unknown>).max_claim_unlimited as boolean ?? false,

    // Proof
    proof_required:         (promo as Record<string, unknown>).proof_required as boolean ?? false,
    proof_type:             (promo as Record<string, unknown>).proof_type as string ?? 'none',
    proof_destination:      (promo as Record<string, unknown>).proof_destination as string ?? 'none',
    penalty_type:           (promo as Record<string, unknown>).penalty_type as string ?? null,

    // Distribution
    distribution_mode:      (promo as Record<string, unknown>).distribution_mode as string
                            || promo.reward_distribution
                            || null,
    distribution_schedule:  (promo as Record<string, unknown>).distribution_schedule as string ?? null,
    distribution_note:      (promo as Record<string, unknown>).distribution_note as string ?? null,

    // Game scope
    game_scope:             promo.game_restriction || null,
    game_types:             promo.game_types || [],
    game_providers:         promo.game_providers || [],
    game_exclusions:        (promo as Record<string, unknown>).game_exclusions as unknown[] ?? [],

    // Access
    platform_access:        promo.platform_access || 'semua',
    geo_restriction:        promo.geo_restriction || 'indonesia',
    require_apk:            promo.require_apk ?? false,
    one_account_rule:       (promo as Record<string, unknown>).one_account_rule as boolean ?? false,

    // Validity
    valid_from:             promo.valid_from || null,
    valid_until:            promo.valid_until || null,
    valid_until_unlimited:  promo.valid_until_unlimited ?? false,

    // Risk
    promo_risk_level:       promo.promo_risk_level || 'medium',
    anti_fraud_notes:       (promo as Record<string, unknown>).anti_fraud_notes as string ?? null,
    custom_terms:           promo.custom_terms || null,
    special_conditions:     promo.special_requirements || [],

    // Subcategories
    has_subcategories:      Array.isArray((promo as Record<string, unknown>).subcategories)
                            && ((promo as Record<string, unknown>).subcategories as unknown[]).length > 0,
    subcategories:          (promo as Record<string, unknown>).subcategories || [],

    // Archetype
    archetype_payload:      (promo as Record<string, unknown>).archetype_payload || {},
    archetype_invariants:   (promo as Record<string, unknown>).archetype_invariants || {},

    // Extraction meta
    extraction_confidence:  (promo as Record<string, unknown>).extraction_confidence as number ?? 0.9,
    human_verified:         (promo as Record<string, unknown>).human_verified as boolean ?? false,

    // Audit
    created_by:             promo.created_by || 'Admin',

    // Escape hatch — semua field non-standard masuk di sini
    extra_config:           Object.keys(mergedExtra).length > 0 ? mergedExtra : {},
  };
}

/**
 * Memetakan flat row dari promo_kb kembali ke PromoItem.
 */
function fromFlatRow(row: Record<string, unknown>): PromoItem {
  const extra = (row.extra_config && typeof row.extra_config === 'object')
    ? row.extra_config as Record<string, unknown>
    : {};

  const promo: PromoItem = {
    // Identity
    id:                     row.id as string,
    client_id:              row.client_id as string,
    client_name:            row.client_name as string ?? undefined,
    promo_name:             row.promo_name as string,
    promo_slug:             row.promo_slug as string ?? undefined,
    source_url:             row.source_url as string ?? undefined,
    promo_summary:          row.promo_summary as string ?? undefined,
    schema_version:         row.schema_version as string ?? '2.2',
    status:                 (row.status as 'active' | 'paused' | 'draft' | 'expired') || 'draft',
    is_active:              false,
    version:                1,

    // Taxonomy
    category:               row.category as 'REWARD' | 'EVENT' | '' ?? '',
    promo_type:             row.promo_slug as string ?? '',
    reward_mode:            (row.mode as 'fixed' | 'tier' | 'formula') ?? 'fixed',
    intent_category:        row.intent_category as string ?? '',
    target_segment:         row.target_segment as string ?? '',
    trigger_event:          row.trigger_event as string ?? '',

    // Reward
    reward_type:            row.reward_type as string ?? '',
    reward_unit:            row.reward_unit as string ?? undefined,
    reward_amount:          row.reward_amount as number ?? null,
    reward_is_percentage:   row.reward_is_percentage as boolean ?? false,
    reward_item_description:row.reward_item_description as string ?? undefined,
    conversion_formula:     row.conversion_formula as string ?? '',

    // Calculation
    calculation_basis:      row.calculation_basis as string ?? '',
    calculation_base:       row.calculation_basis as string ?? '',
    payout_direction:       row.payout_direction as string ?? undefined,
    min_calculation:        row.min_calculation as number ?? null,
    min_deposit:            row.min_deposit as number ?? null,
    max_bonus:              row.max_bonus as number ?? undefined,
    max_bonus_unlimited:    row.max_bonus_unlimited as boolean ?? false,

    // Turnover
    turnover_rule_enabled:  row.turnover_enabled as boolean ?? false,
    turnover_multiplier:    row.turnover_multiplier as number ?? undefined,
    turnover_basis:         row.turnover_basis as string ?? undefined,
    turnover_basis_extra:   row.turnover_basis_extra as string ?? undefined,
    min_withdraw_after_bonus: row.min_withdraw_after_bonus as number ?? undefined,
    turnover_rule:          '',
    turnover_rule_custom:   '',

    // Claim
    claim_frequency:        row.claim_frequency as string ?? '',
    claim_method:           row.claim_method as string ?? '',
    claim_deadline_days:    row.claim_deadline_days as number ?? undefined,
    claim_platform:         row.claim_platform as string ?? undefined,
    claim_url:              row.claim_url as string ?? undefined,
    max_claim:              row.max_claim as number ?? null,
    max_claim_unlimited:    row.max_claim_unlimited as boolean ?? false,

    // Proof
    proof_required:         row.proof_required as boolean ?? false,
    proof_type:             row.proof_type as string ?? 'none',
    proof_destination:      row.proof_destination as string ?? 'none',
    penalty_type:           row.penalty_type as string ?? undefined,

    // Distribution
    distribution_mode:      row.distribution_mode as string ?? undefined,
    distribution_schedule:  row.distribution_schedule as string ?? undefined,
    distribution_note:      row.distribution_note as string ?? undefined,
    reward_distribution:    row.distribution_mode as string ?? '',
    distribution_day:       '',
    distribution_time:      '',
    distribution_date_from: '',
    distribution_date_until:'',
    distribution_time_enabled: false,
    distribution_time_from: '',
    distribution_time_until:'',
    distribution_day_time_enabled: false,
    calculation_period_start: '',
    calculation_period_end:   '',
    calculation_period_note:  '',

    // Game scope
    game_restriction:       row.game_scope as string ?? '',
    game_types:             (row.game_types as string[]) || [],
    game_providers:         (row.game_providers as string[]) || [],
    game_exclusions:        (row.game_exclusions as unknown[]) || [],
    game_names:             [],
    game_blacklist_enabled: false,
    game_types_blacklist:   [],
    game_providers_blacklist: [],
    game_names_blacklist:   [],
    game_exclusion_rules:   [],

    // Access
    platform_access:        row.platform_access as string ?? 'semua',
    geo_restriction:        row.geo_restriction as string ?? 'indonesia',
    require_apk:            row.require_apk as boolean ?? false,
    one_account_rule:       row.one_account_rule as boolean ?? false,

    // Validity
    valid_from:             row.valid_from as string ?? '',
    valid_until:            row.valid_until as string ?? '',
    valid_until_unlimited:  row.valid_until_unlimited as boolean ?? false,

    // Risk
    promo_risk_level:       (row.promo_risk_level as 'no' | 'low' | 'medium' | 'high') ?? 'medium',
    anti_fraud_notes:       row.anti_fraud_notes as string ?? undefined,
    custom_terms:           row.custom_terms as string ?? '',
    special_requirements:   (row.special_conditions as string[]) || [],

    // Subcategories
    has_subcategories:      row.has_subcategories as boolean ?? false,
    subcategories:          (row.subcategories as unknown[]) || [],

    // Tiers
    tier_archetype:         (row.tier_archetype as 'level' | 'point_store' | 'referral' | 'formula') ?? undefined,
    tier_count:             row.tier_count as number ?? 0,
    tiers:                  (row.tiers as unknown[]) || [],
    fast_exp_missions:      [],
    level_up_rewards:       [],
    promo_unit:             'lp',
    exp_mode:               'level_up',
    lp_calc_method:         '',
    exp_calc_method:        '',
    lp_earn_basis:          'turnover',
    lp_earn_amount:         0,
    lp_earn_point_amount:   0,
    exp_formula:            '',
    lp_value:               '',
    exp_value:              '',
    vip_multiplier:         { enabled: false, min_daily_to: 0, tiers: [] },

    // Archetype
    archetype_payload:      (row.archetype_payload as Record<string, unknown>) || {},
    archetype_invariants:   (row.archetype_invariants as Record<string, unknown>) || {},

    // Extraction meta
    extraction_confidence:  row.extraction_confidence as number ?? 0.9,
    human_verified:         row.human_verified as boolean ?? false,
    created_by:             row.created_by as string ?? 'Admin',

    // Audit timestamps
    created_at:             row.created_at as string ?? new Date().toISOString(),
    updated_at:             row.updated_at as string ?? new Date().toISOString(),
    updated_by:             'Admin',

    // Admin Fee
    admin_fee_enabled:      false,
    admin_fee_percentage:   null,

    // Fixed mode
    fixed_reward_type:      '',
    fixed_calculation_base: '',
    fixed_calculation_method: '',
    fixed_payout_direction: 'after',
    fixed_admin_fee_enabled: false,
    fixed_max_claim_enabled: false,
    fixed_max_claim_unlimited: false,
    fixed_min_calculation_enabled: false,
    fixed_calculation_value_enabled: false,
    fixed_turnover_rule_enabled: false,
    fixed_turnover_rule:    '',

    // Dinamis legacy
    dinamis_reward_type:    '',
    dinamis_reward_amount:  null,
    dinamis_max_claim_unlimited: false,
    min_reward_claim:       null,
    min_reward_claim_enabled: false,
    calculation_base:       row.calculation_basis as string ?? '',
    calculation_method:     '',
    calculation_value:      null,
    min_calculation_enabled: false,

    // Date ranges
    claim_date_from:        '',
    claim_date_until:       '',

    // Referral
    referral_tiers:         [],
    referral_calculation_basis: '',
    referral_admin_fee_enabled: false,
    referral_admin_fee_percentage: null,

    // Spread extra_config fields back
    ...extra,
  };

  return normalizeToStandard(promo);
}

// ============================================
// KNOWLEDGE BASE STORAGE
// ============================================

export const promoKB = {
  /**
   * Get all promos from Knowledge Base
   */
  getAll: async (): Promise<PromoItem[]> => {
    if (!USE_SUPABASE) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const promos: PromoItem[] = stored ? JSON.parse(stored) : [];
        return normalizePromoArray(promos);
      } catch (error) {
        console.error('[promoKB] Failed to load from localStorage:', error);
        return [];
      }
    }

    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('client_id', DEFAULT_CLIENT_ID)
        .order('created_at', { ascending: false });

      if (error) {
        logSupabaseError('promoKB.getAll', error);
        return [];
      }

      return (data || []).map(row => fromFlatRow(row as Record<string, unknown>));
    } catch (error) {
      logSupabaseError('promoKB.getAll', error);
      return [];
    }
  },

  /**
   * Get single promo by ID
   */
  getById: async (id: string): Promise<PromoItem | null> => {
    if (!USE_SUPABASE) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const promos: PromoItem[] = stored ? JSON.parse(stored) : [];
        const found = promos.find(p => p.id === id) || null;
        return found ? normalizeToStandard(found) : null;
      } catch (error) {
        console.error('[promoKB] Failed to get by id from localStorage:', error);
        return null;
      }
    }

    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        if (error) logSupabaseError('promoKB.getById', error);
        return null;
      }

      return fromFlatRow(data as Record<string, unknown>);
    } catch (error) {
      logSupabaseError('promoKB.getById', error);
      return null;
    }
  },

  /**
   * Add new promo to Knowledge Base
   * Dipanggil saat tombol Publish ditekan di Step 5 Review
   */
  add: async (promo: PromoFormData): Promise<PromoItem> => {
    const now = new Date().toISOString();
    const promoWithId = promo as PromoFormData & { id?: string };
    const id = promoWithId.id || generateUUID();

    if (!USE_SUPABASE) {
      const newItem: PromoItem = {
        ...promo,
        id,
        status: promo.status || 'draft',
        is_active: false,
        version: 1,
        created_at: now,
        updated_at: now,
        updated_by: 'Admin',
      } as PromoItem;

      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const promos: PromoItem[] = stored ? JSON.parse(stored) : [];
        promos.unshift(newItem);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(promos));
        window.dispatchEvent(new CustomEvent('promo-storage-updated'));
        return newItem;
      } catch (error) {
        console.error('[promoKB] Failed to add to localStorage:', error);
        throw new Error('Failed to add promo to localStorage');
      }
    }

    const row = toFlatRow(promo, id, now);
    row.created_at = now;
    row.updated_at = now;

    const { data, error } = await supabase
      .from(TABLE)
      .insert(row)
      .select()
      .single();

    if (error) {
      logSupabaseError('promoKB.add', error);
      throw new Error(`Failed to add promo to database: ${error.message}`);
    }

    window.dispatchEvent(new CustomEvent('promo-storage-updated'));
    console.log('[promoKB] Added promo:', data.id, data.promo_name);

    return fromFlatRow(data as Record<string, unknown>);
  },

  /**
   * Update existing promo
   */
  update: async (id: string, updates: Partial<PromoFormData>, writeIntent?: WriteIntent): Promise<boolean> => {
    if (!USE_SUPABASE) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const promos: PromoItem[] = stored ? JSON.parse(stored) : [];
        const index = promos.findIndex(p => p.id === id);
        if (index === -1) return false;

        if (writeIntent) {
          const validation = validateWriteIntent(promos[index], writeIntent);
          if (!validation.valid) {
            console.error('[promoKB] Write validation failed:', validation.error);
            return false;
          }
        }

        promos[index] = {
          ...promos[index],
          ...updates,
          version: (promos[index].version || 1) + 1,
          updated_at: new Date().toISOString(),
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(promos));
        window.dispatchEvent(new CustomEvent('promo-storage-updated'));
        return true;
      } catch (error) {
        console.error('[promoKB] Failed to update in localStorage:', error);
        return false;
      }
    }

    try {
      const now = new Date().toISOString();
      // Build partial flat update — hanya field yang diupdate
      const partialRow = toFlatRow(updates as PromoFormData, id, now);
      // Hapus field yang tidak boleh di-overwrite saat partial update
      delete partialRow.id;
      delete partialRow.created_at;
      partialRow.updated_at = now;

      const { error } = await supabase
        .from(TABLE)
        .update(partialRow)
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
    if (!USE_SUPABASE) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const promos: PromoItem[] = stored ? JSON.parse(stored) : [];
        const filtered = promos.filter(p => p.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        window.dispatchEvent(new CustomEvent('promo-storage-updated'));
        return true;
      } catch (error) {
        console.error('[promoKB] Failed to delete from localStorage:', error);
        return false;
      }
    }

    try {
      const { error } = await supabase
        .from(TABLE)
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
    } catch (e) {
      console.error('[extractorSession] Failed to save:', e);
    }
  },

  load: (): ExtractorSession | null => {
    try {
      const data = sessionStorage.getItem(SESSION_KEY);
      if (!data) return null;

      const parsed = JSON.parse(data) as ExtractorSession & {
        _keyword_override_version?: string;
      };

      if (
        parsed._keyword_override_version &&
        parsed._keyword_override_version !== KEYWORD_OVERRIDE_VERSION
      ) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }

      return parsed;
    } catch {
      console.error('[extractorSession] Failed to load');
      return null;
    }
  },

  clear: (): void => {
    sessionStorage.removeItem(SESSION_KEY);
  },

  hasData: (): boolean => {
    const session = extractorSession.load();
    return !!session?.extractedPromo;
  },
};
