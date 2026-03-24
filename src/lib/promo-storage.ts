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
  // Cast sekali ke p untuk akses aman tanpa TS error
  const p = promo as unknown as Record<string, unknown>;

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
    ...(typeof p.extra_config === 'object' && p.extra_config !== null
      ? (p.extra_config as Record<string, unknown>)
      : {}),
    ...extraConfigFields,
  };

  // Tentukan mode dari reward_mode
  const mode = (p.reward_mode as string) || (p.mode as string) || null;

  return {
    id,
    promo_id:               (p.promo_slug as string) || id,
    client_id:              (p.client_id as string) || DEFAULT_CLIENT_ID,
    client_name:            (p.client_name as string) || null,
    promo_name:             p.promo_name as string,
    promo_slug:             (p.promo_slug as string) || null,
    schema_version:         '2.2',
    status:                 (p.status as string) || 'draft',
    source_url:             (p.source_url as string) || null,
    promo_summary:          (p.promo_summary as string) || null,

    // Taxonomy
    category:               (p.category as string) || null,
    mode,
    intent_category:        (p.intent_category as string) || null,
    target_segment:         (p.target_segment as string) || null,
    trigger_event:          (p.trigger_event as string) || null,
    trigger_min_value:      (p.trigger_min_value as number) ?? null,

    // Reward Core
    reward_type:            (p.reward_type as string) || null,
    reward_unit:            (p.reward_unit as string) ?? null,
    reward_amount:          (p.reward_amount as number) ?? null,
    reward_is_percentage:   (p.reward_is_percentage as boolean) ?? false,
    reward_item_description:(p.reward_item_description as string) ?? null,

    // Calculation
    calculation_basis:      (p.calculation_basis as string)
                            || (p.calculation_base as string)
                            || null,
    payout_direction:       (p.payout_direction as string) ?? null,
    conversion_formula:     (p.conversion_formula as string) || null,

    // Tiers
    tier_archetype:         (p.tier_archetype as string) || null,
    tier_count:             Array.isArray(p.tiers) ? (p.tiers as unknown[]).length : 0,
    tiers:                  (p.tiers as unknown[]) || [],

    // Calculation limits
    min_calculation:        (p.min_calculation as number) ?? null,
    min_deposit:            (p.min_deposit as number) ?? null,
    max_bonus:              (p.max_bonus as number) ?? null,
    max_bonus_unlimited:    (p.max_bonus_unlimited as boolean) ?? false,

    // Turnover
    turnover_enabled:       (p.turnover_rule_enabled as boolean) ?? false,
    turnover_multiplier:    (p.turnover_multiplier as number) ?? null,
    turnover_basis:         (p.turnover_basis as string) ?? null,
    turnover_basis_extra:   (p.turnover_basis_extra as string) ?? null,
    min_withdraw_after_bonus:(p.min_withdraw_after_bonus as number) ?? null,

    // Claim
    claim_frequency:        (p.claim_frequency as string) || null,
    claim_method:           (p.claim_method as string) || null,
    claim_deadline_days:    (p.claim_deadline_days as number) ?? null,
    claim_platform:         (p.claim_platform as string) ?? null,
    claim_url:              (p.claim_url as string) ?? null,
    max_claim:              (p.max_claim as number) ?? null,
    max_claim_unlimited:    (p.max_claim_unlimited as boolean) ?? false,

    // Proof
    proof_required:         (p.proof_required as boolean) ?? false,
    proof_type:             (p.proof_type as string) ?? 'none',
    proof_destination:      (p.proof_destination as string) ?? 'none',
    penalty_type:           (p.penalty_type as string) ?? null,

    // Distribution
    distribution_mode:      (p.distribution_mode as string)
                            || (p.reward_distribution as string)
                            || null,
    distribution_schedule:  (p.distribution_schedule as string) ?? null,
    distribution_note:      (p.distribution_note as string) ?? null,

    // Game scope
    game_scope:             (p.game_restriction as string) || null,
    game_types:             (p.game_types as string[]) || [],
    game_providers:         (p.game_providers as string[]) || [],
    game_exclusions:        (p.game_exclusions as unknown[]) ?? [],

    // Access
    platform_access:        (p.platform_access as string) || 'semua',
    geo_restriction:        (p.geo_restriction as string) || 'indonesia',
    require_apk:            (p.require_apk as boolean) ?? false,
    one_account_rule:       (p.one_account_rule as boolean) ?? false,

    // Validity
    valid_from:             (p.valid_from as string) || null,
    valid_until:            (p.valid_until as string) || null,
    valid_until_unlimited:  (p.valid_until_unlimited as boolean) ?? false,

    // Risk
    promo_risk_level:       (p.promo_risk_level as string) || 'medium',
    anti_fraud_notes:       (p.anti_fraud_notes as string) ?? null,
    custom_terms:           (p.custom_terms as string) || null,
    special_conditions:     (p.special_requirements as string[]) || [],

    // Subcategories
    has_subcategories:      Array.isArray(p.subcategories) && (p.subcategories as unknown[]).length > 0,
    subcategories:          (p.subcategories as unknown[]) || [],

    // Archetype
    archetype_payload:      (p.archetype_payload as Record<string, unknown>) || {},
    archetype_invariants:   (p.archetype_invariants as Record<string, unknown>) || {},

    // Extraction meta
    extraction_confidence:  (p.extraction_confidence as number) ?? 0.9,
    human_verified:         (p.human_verified as boolean) ?? false,

    // Audit
    created_by:             (p.created_by as string) || 'Admin',

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const safe = (v: unknown, fallback: unknown = undefined) => v ?? fallback;

  const promo: PromoItem = {
    // Identity
    id:                     row.id as string,
    client_id:              row.client_id as string,
    client_name:            safe(row.client_name) as string | undefined,
    promo_name:             row.promo_name as string,
    promo_slug:             safe(row.promo_slug) as string | undefined,
    source_url:             safe(row.source_url) as string | undefined,
    promo_summary:          safe(row.promo_summary) as string | undefined,
    schema_version:         '2.1' as '2.1',
    status:                 ((row.status as string) || 'draft') as 'active' | 'paused' | 'draft' | 'expired',
    is_active:              false,
    version:                1,

    // Taxonomy
    category:               ((row.category as string) || '') as 'REWARD' | 'EVENT' | '',
    promo_type:             (row.promo_slug as string) || '',
    reward_mode:            ((row.mode as string) || 'fixed') as 'fixed' | 'tier' | 'formula',
    intent_category:        (row.intent_category as string) || '',
    target_segment:         (row.target_segment as string) || '',
    trigger_event:          (row.trigger_event as string) || '',

    // Reward
    reward_type:            (row.reward_type as string) || '',
    reward_unit:            safe(row.reward_unit) as string | undefined,
    reward_amount:          safe(row.reward_amount, null) as number | null,
    reward_item_description:safe(row.reward_item_description) as string | undefined,
    conversion_formula:     (row.conversion_formula as string) || '',

    // Calculation
    calculation_base:       (row.calculation_basis as string) || '',
    payout_direction:       safe(row.payout_direction) as 'belakang' | 'depan' | undefined,
    min_calculation:        safe(row.min_calculation, null) as number | null,
    min_deposit:            safe(row.min_deposit, null) as number | null,
    max_bonus:              safe(row.max_bonus) as number | undefined,
    max_bonus_unlimited:    (row.max_bonus_unlimited as boolean) ?? false,

    // Turnover
    turnover_rule_enabled:  (row.turnover_enabled as boolean) ?? false,
    turnover_multiplier:    safe(row.turnover_multiplier) as number | undefined,
    turnover_basis:         safe(row.turnover_basis) as 'bonus_only' | 'deposit_only' | 'deposit_plus_bonus' | undefined,
    min_withdraw_after_bonus: safe(row.min_withdraw_after_bonus) as number | undefined,
    turnover_rule:          '',
    turnover_rule_custom:   '',

    // Claim
    claim_frequency:        (row.claim_frequency as string) || '',
    claim_method:           ((row.claim_method as string) || '') as '' | 'auto' | 'manual' | 'cs_request',
    claim_deadline_days:    safe(row.claim_deadline_days) as number | undefined,
    claim_platform:         safe(row.claim_platform) as 'auto' | 'form' | 'livechat' | 'whatsapp' | 'telegram' | 'apk' | undefined,
    claim_url:              safe(row.claim_url) as string | undefined,
    max_claim:              safe(row.max_claim, null) as number | null,
    max_claim_unlimited:    (row.max_claim_unlimited as boolean) ?? false,

    // Proof
    proof_required:         (row.proof_required as boolean) ?? false,
    proof_type:             ((row.proof_type as string) || 'none') as 'none' | 'screenshot' | 'social_post' | 'bill_share',
    proof_destination:      ((row.proof_destination as string) || 'none') as 'none' | 'livechat' | 'whatsapp' | 'telegram' | 'facebook',
    penalty_type:           safe(row.penalty_type) as 'bonus_cancel' | 'full_balance_void' | undefined,

    // Distribution
    distribution_mode:      safe(row.distribution_mode) as string | undefined,
    distribution_schedule:  safe(row.distribution_schedule) as string | undefined,
    distribution_note:      safe(row.distribution_note) as string | undefined,
    reward_distribution:    (row.distribution_mode as string) || '',
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
    game_restriction:       (row.game_scope as string) || '',
    game_types:             ((row.game_types as unknown[]) || []) as string[],
    game_providers:         ((row.game_providers as unknown[]) || []) as string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    game_exclusions:        ((row.game_exclusions as unknown[]) || []) as any[],
    game_names:             [],
    game_blacklist_enabled: false,
    game_types_blacklist:   [],
    game_providers_blacklist: [],
    game_names_blacklist:   [],
    game_exclusion_rules:   [],

    // Access
    platform_access:        (row.platform_access as string) || 'semua',
    geo_restriction:        (row.geo_restriction as string) || 'indonesia',
    require_apk:            (row.require_apk as boolean) ?? false,
    one_account_rule:       (row.one_account_rule as boolean) ?? false,

    // Validity
    valid_from:             (row.valid_from as string) || '',
    valid_until:            (row.valid_until as string) || '',
    valid_until_unlimited:  (row.valid_until_unlimited as boolean) ?? false,

    // Risk
    promo_risk_level:       ((row.promo_risk_level as string) || 'medium') as 'no' | 'low' | 'medium' | 'high',
    anti_fraud_notes:       safe(row.anti_fraud_notes) as string | undefined,
    custom_terms:           (row.custom_terms as string) || '',
    special_requirements:   ((row.special_conditions as unknown[]) || []) as string[],

    // Subcategories
    has_subcategories:      (row.has_subcategories as boolean) ?? false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subcategories:          ((row.subcategories as unknown[]) || []) as any[],

    // Tiers
    tier_archetype:         safe(row.tier_archetype) as 'level' | 'point_store' | 'referral' | 'formula' | undefined,
    tier_count:             (row.tier_count as number) ?? 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tiers:                  ((row.tiers as unknown[]) || []) as any[],
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
    extraction_confidence:  (row.extraction_confidence as number) ?? 0.9,
    human_verified:         (row.human_verified as boolean) ?? false,
    created_by:             (row.created_by as string) || 'Admin',

    // Audit timestamps
    created_at:             (row.created_at as string) || new Date().toISOString(),
    updated_at:             (row.updated_at as string) || new Date().toISOString(),
    updated_by:             'Admin',

    // Admin Fee
    admin_fee_enabled:      false,
    admin_fee_percentage:   null,

    // Fixed mode
    fixed_reward_type:      '',
    fixed_calculation_base: '',
    fixed_calculation_method: '',
    fixed_payout_direction: 'after' as 'before' | 'after',
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
