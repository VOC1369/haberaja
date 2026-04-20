/**
 * PROMO STORAGE ABSTRACTION LAYER — v3.1
 *
 * Schema: Universal Promo Ontology v3.1
 * - mechanics[]        : 10 primitive types (JSONB)
 * - adjudication       : conflict resolution result (JSONB)
 * - canonical_projection: summary for UI + livechat (JSONB)
 * - query_hints        : Danila confidence thresholds (JSONB)
 * - meta               : audit + extraction metadata (JSONB)
 *
 * Form Wizard Compatibility:
 * - fromV31Row()  → reads mechanics[] + canonical_projection → populates PromoFormData
 * - toV31Row()    → converts PromoFormData → v3.1 JSONB structure
 *
 * DRAFT RULE: status='draft' → localStorage only. Never Supabase.
 */

import type { PromoFormData, PromoItem } from '@/components/VOCDashboard/PromoFormWizard/types';
import type { ExtractedPromo } from '@/lib/voc-wolf-extractor';
import { supabase, DEFAULT_CLIENT_ID, generateUUID, logSupabaseError } from '@/lib/supabase-client';
import { KEYWORD_OVERRIDE_VERSION } from '@/lib/extractors/category-classifier';
import { generatePromoSummary, PromoSummaryContext } from './promo-summary-generator';

// ============================================
// STORAGE CONFIGURATION
// ============================================
const USE_SUPABASE = true;
const TABLE = 'promo_kb';
const STORAGE_KEY = 'voc_promo_kb';
const SESSION_KEY = 'pseudo_extractor_session';

// ============================================
// v3.1 TYPE DEFINITIONS
// ============================================

export interface MechanicNode {
  mechanic_id: string;
  mechanic_type:
    | 'trigger'
    | 'eligibility'
    | 'calculation'
    | 'reward'
    | 'state'
    | 'distribution'
    | 'claim'
    | 'control'
    | 'invalidator'
    | 'dependency';
  evidence: string;
  confidence: number;
  ambiguity: boolean;
  ambiguity_reason: string | null;
  activation_rule?: {
    type: 'all_of' | 'any_of' | 'none';
    conditions: string[];
  };
  data: Record<string, unknown>;
}

export interface AdjudicationResult {
  status: 'pending' | 'resolved' | 'unresolvable';
  adjudication_rules_version: string;
  priority_order: string[];
  conflicts: Array<{
    field: string;
    candidates: unknown[];
    chosen: unknown;
    strategy: string;
    evidence_refs: string[];
  }>;
  ambiguities: Array<{
    mechanic_id: string;
    reason: string;
  }>;
  confidence_adjustments: Array<{
    mechanic_id: string;
    delta: number;
    reason: string;
  }>;
  blocked_mechanics: string[];
}

export interface CanonicalProjection {
  promo_summary: string;
  main_trigger: string;
  main_reward_form: string;
  main_reward_percent: number | null;
  max_bonus: number | null;
  payout_direction: string;
  turnover_multiplier: number | null;
  turnover_basis: string;
  primary_claim_method: string;
  primary_claim_platform: string;
  proof_required: boolean;
  stateful: boolean;
  game_scope: string;
  game_types: string[];
  game_providers: string[];
  game_exclusions: string[];
  intent_category: string;
  target_segment: string;
}

export interface QueryHints {
  confidence_threshold_tegas: number;
  confidence_threshold_disclaimer: number;
  confidence_threshold_escalate: number;
  escalation_target: string;
  answer_language: string;
  answer_tone: string;
}

export interface PromoMeta {
  schema_version: string;
  created_at?: string;
  updated_at?: string;
  created_by: string;
  schema_evolved_from: string;
  human_verified: boolean;
  overall_extraction_confidence: number;
}

export interface PromoV31 {
  id?: string;
  promo_id: string;
  client_id: string;
  client_name?: string;
  promo_name: string;
  promo_slug?: string;
  status: 'active' | 'paused' | 'draft' | 'expired';
  source_url?: string;
  source_text_hash?: string;
  valid_from?: string | null;
  valid_until?: string | null;
  valid_until_unlimited: boolean;
  geo_restriction: string;
  platform_access: string;
  promo_risk_level: string;
  mechanics: MechanicNode[];
  adjudication: AdjudicationResult;
  canonical_projection: CanonicalProjection;
  query_hints: QueryHints;
  meta: PromoMeta;
  created_at?: string;
  updated_at?: string;
}

// ============================================
// DEFAULT BUILDERS
// ============================================

function defaultAdjudication(): AdjudicationResult {
  return {
    status: 'pending',
    adjudication_rules_version: 'V.APR.09',
    priority_order: [
      'numeric_value',
      'explicit_formula',
      'example_calculation',
      'textual_description',
      'marketing_language',
    ],
    conflicts: [],
    ambiguities: [],
    confidence_adjustments: [],
    blocked_mechanics: [],
  };
}

function defaultCanonicalProjection(): CanonicalProjection {
  return {
    promo_summary: '',
    main_trigger: '',
    main_reward_form: '',
    main_reward_percent: null,
    max_bonus: null,
    payout_direction: '',
    turnover_multiplier: null,
    turnover_basis: '',
    primary_claim_method: '',
    primary_claim_platform: '',
    proof_required: false,
    stateful: false,
    game_scope: 'semua',
    game_types: [],
    game_providers: [],
    game_exclusions: [],
    intent_category: '',
    target_segment: '',
  };
}

function defaultQueryHints(): QueryHints {
  return {
    confidence_threshold_tegas: 0.8,
    confidence_threshold_disclaimer: 0.5,
    confidence_threshold_escalate: 0.4,
    escalation_target: 'human_cs',
    answer_language: 'id',
    answer_tone: 'friendly_professional',
  };
}

function defaultMeta(createdBy = 'Admin'): PromoMeta {
  return {
    schema_version: 'V.APR.09',
    created_by: createdBy,
    schema_evolved_from: 'V.APR.09',
    human_verified: false,
    overall_extraction_confidence: 0,
  };
}

// ============================================
// MECHANICS BUILDER FROM PromoFormData
// Converts PromoFormData → mechanics[] v3.1 primitives
// ============================================

function buildMechanicsFromFormData(promo: PromoFormData): MechanicNode[] {
  const mechanics: MechanicNode[] = [];
  const p = promo as unknown as Record<string, unknown>;

  // --- TRIGGER ---
  mechanics.push({
    mechanic_id: 'm_trigger_1',
    mechanic_type: 'trigger',
    evidence: (p.trigger_event as string) || '',
    confidence: 0.85,
    ambiguity: !(p.trigger_event),
    ambiguity_reason: !(p.trigger_event) ? 'trigger_event tidak terisi' : null,
    data: {
      event: (p.trigger_event as string) || '',
      min_value: (p.trigger_min_value as number) || (p.min_deposit as number) || null,
      max_value: null,
      frequency: (p.claim_frequency as string) || 'unlimited',
      selection_type: null,
    },
  });

  // --- ELIGIBILITY ---
  mechanics.push({
    mechanic_id: 'm_eligibility_1',
    mechanic_type: 'eligibility',
    evidence: (p.target_segment as string) || '',
    confidence: 0.9,
    ambiguity: false,
    ambiguity_reason: null,
    data: {
      target_segment: (p.target_segment as string) || 'semua',
      min_level: null,
      min_deposit_history: null,
      require_apk: (p.require_apk as boolean) ?? false,
      one_account_rule: (p.one_account_rule as boolean) ?? false,
      other_conditions: (p.special_requirements as string[]) || [],
    },
  });

  // --- CALCULATION ---
  const calcBasis = (p.calculation_base as string) || (p.calculation_basis as string) || '';
  if (calcBasis) {
    mechanics.push({
      mechanic_id: 'm_calc_1',
      mechanic_type: 'calculation',
      evidence: calcBasis,
      confidence: 0.85,
      ambiguity: false,
      ambiguity_reason: null,
      data: {
        basis: calcBasis,
        formula: (p.conversion_formula as string) || '',
        min_basis_value: (p.min_calculation as number) || null,
        max_result: (p.max_bonus as number) || null,
        max_result_unlimited: (p.max_bonus_unlimited as boolean) ?? false,
        payout_direction: (p.payout_direction as string) || '',
      },
    });
  }

  // --- REWARD ---
  mechanics.push({
    mechanic_id: 'm_reward_1',
    mechanic_type: 'reward',
    evidence: (p.reward_type as string) || '',
    confidence: 0.9,
    ambiguity: !(p.reward_type),
    ambiguity_reason: !(p.reward_type) ? 'reward_type tidak terisi' : null,
    activation_rule: { type: 'all_of', conditions: [] },
    data: {
      reward_form: (p.reward_type as string) || '',
      reward_unit: (p.reward_unit as string) || '',
      reward_percent: (p.reward_is_percentage || p.reward_unit === 'percent') ? (p.reward_amount as number) || null : null,
      reward_amount_fixed: !(p.reward_is_percentage) && p.reward_unit !== 'percent' ? (p.reward_amount as number) || null : null,
      basis: calcBasis,
      max_result: (p.max_bonus as number) || null,
      item_description: (p.reward_item_description as string) || null,
      deducts_state: null,
    },
  });

  // --- STATE (hanya jika ada tier/loyalty) ---
  const hasTiers = Array.isArray(p.tiers) && (p.tiers as unknown[]).length > 0;
  const tierArchetype = (p.tier_archetype as string) || '';
  if (hasTiers || tierArchetype === 'point_store' || tierArchetype === 'level') {
    mechanics.push({
      mechanic_id: 'm_state_1',
      mechanic_type: 'state',
      evidence: `tier_archetype: ${tierArchetype}`,
      confidence: 0.8,
      ambiguity: false,
      ambiguity_reason: null,
      data: {
        owner: 'user',
        scope: 'lifetime',
        tier_archetype: tierArchetype,  // ← PERSIST in data object for round-trip
        storage_key: tierArchetype === 'point_store' ? 'loyalty_point_balance' : 'level_progress',
        initial_value: 0,
        update_rule: {
          type: 'accumulate_from_calculation',
          source_ref: 'm_calc_1',
          trigger_on: 'distribution_complete',
        },
        reset_rule: { type: 'none' },
        read_on: 'query_time',
        isolation: 'per_user_per_brand',
        consumed_by: [],
        produced_by: ['m_calc_1'],
        threshold: null,
        tiers: p.tiers || [],
      },
    });
  }

  // --- DISTRIBUTION ---
  const distMode = (p.distribution_mode as string) || (p.reward_distribution as string) || '';
  mechanics.push({
    mechanic_id: 'm_dist_1',
    mechanic_type: 'distribution',
    evidence: distMode,
    confidence: distMode ? 0.85 : 0.5,
    ambiguity: !distMode,
    ambiguity_reason: !distMode ? 'distribution_mode tidak terisi' : null,
    data: {
      mode: distMode || 'auto',
      schedule: (p.distribution_schedule as string) || null,
      delay_after_trigger_hours: 0,
      applies_to_reward: 'm_reward_1',
      distribution_note: (p.distribution_note as string) || '',
    },
  });

  // --- CLAIM ---
  const claimMethod = (p.claim_method as string) || '';
  mechanics.push({
    mechanic_id: 'm_claim_1',
    mechanic_type: 'claim',
    evidence: claimMethod,
    confidence: claimMethod ? 0.9 : 0.4,
    ambiguity: !claimMethod,
    ambiguity_reason: !claimMethod ? 'claim_method tidak terisi' : null,
    data: {
      method: claimMethod || 'manual',
      platform: (p.claim_platform as string) || 'livechat',
      applies_to_reward: 'm_reward_1',
      claim_url: (p.claim_url as string) || null,
      deadline_hours: (p.claim_deadline_days as number)
        ? (p.claim_deadline_days as number) * 24
        : null,
      max_claim: (p.max_claim as number) || null,
      max_claim_unlimited: (p.max_claim_unlimited as boolean) ?? false,
      proof_required: (p.proof_required as boolean) ?? false,
      proof_type: (p.proof_type as string) || 'none',
      proof_destination: (p.proof_destination as string) || 'none',
    },
  });

  // --- CONTROL (turnover/anti-fraud) ---
  mechanics.push({
    mechanic_id: 'm_control_1',
    mechanic_type: 'control',
    evidence: `turnover_enabled: ${p.turnover_rule_enabled || p.turnover_enabled}`,
    confidence: 0.85,
    ambiguity: false,
    ambiguity_reason: null,
    data: {
      turnover_enabled: (p.turnover_rule_enabled as boolean) || (p.turnover_enabled as boolean) || false,
      turnover_multiplier: (p.turnover_multiplier as number) || null,
      turnover_basis: (p.turnover_basis as string) || 'deposit_plus_bonus',
      min_withdraw_after_bonus: (p.min_withdraw_after_bonus as number) || null,
      penalty_type: (p.penalty_type as string) || null,
      combinable_with: [],
      cannot_combine_with: [],
      anti_fraud_notes: (p.anti_fraud_notes as string) || '',
    },
  });

  // --- INVALIDATOR ---
  const conditions: string[] = [];
  if (p.one_account_rule) conditions.push('multi_account', 'same_ip');
  if ((p.special_requirements as string[])?.length) {
    conditions.push(...((p.special_requirements as string[]) || []));
  }
  if (conditions.length > 0 || p.anti_fraud_notes) {
    mechanics.push({
      mechanic_id: 'm_invalidator_1',
      mechanic_type: 'invalidator',
      evidence: (p.anti_fraud_notes as string) || conditions.join(', '),
      confidence: 0.75,
      ambiguity: conditions.length === 0,
      ambiguity_reason: conditions.length === 0 ? 'Tidak ada kondisi invalidasi eksplisit' : null,
      data: {
        invalidation_conditions: conditions,
      },
    });
  }

  // --- DEPENDENCY ---
  mechanics.push({
    mechanic_id: 'm_dep_1',
    mechanic_type: 'dependency',
    evidence: 'auto-derived from form data',
    confidence: 0.75,
    ambiguity: false,
    ambiguity_reason: null,
    data: {
      graph_type: 'conditional',
      edges: [
        { from: 'm_trigger_1', to: 'm_calc_1', type: 'activates' },
        { from: 'm_calc_1', to: 'm_reward_1', type: 'derives_from' },
        { from: 'm_dist_1', to: 'm_reward_1', type: 'distributes' },
      ],
    },
  });

  return mechanics;
}

// ============================================
// CANONICAL PROJECTION BUILDER FROM MECHANICS
// ============================================

function buildCanonicalProjectionFromMechanics(
  mechanics: MechanicNode[],
  promo: PromoFormData
): CanonicalProjection {
  const p = promo as unknown as Record<string, unknown>;

  const triggerM = mechanics.find(m => m.mechanic_type === 'trigger');
  const rewardM = mechanics.find(m => m.mechanic_type === 'reward');
  const claimM = mechanics.find(m => m.mechanic_type === 'claim');
  const controlM = mechanics.find(m => m.mechanic_type === 'control');
  const calcM = mechanics.find(m => m.mechanic_type === 'calculation');
  const stateM = mechanics.find(m => m.mechanic_type === 'state');

  // ============================================
  // REWARD FORM: multi-source fallback
  // 1. mechanics reward node data.reward_form
  // 2. dinamis_reward_type (formula mode)
  // 3. fixed_reward_type (fixed mode)
  // 4. reward_type (root, used in tier mode)
  // ============================================
  const resolvedRewardForm: string =
    (rewardM?.data?.reward_form as string) ||
    (p.dinamis_reward_type as string) ||
    (p.fixed_reward_type as string) ||
    (p.reward_type as string) ||
    '';

  // ============================================
  // REWARD PERCENT: multi-source fallback
  // 1. mechanics reward node data.reward_percent
  // 2. subcategories[0].calculation_value (dinamis formula rate)
  // 3. fixed_calculation_value (fixed mode)
  // 4. calculation_value (root)
  // ============================================
  const subs = (p.subcategories as Array<Record<string, unknown>>) || [];
  const sub0CalcValue = (subs[0]?.calculation_value as number) ?? null;
  const resolvedRewardPercent: number | null =
    (rewardM?.data?.reward_percent as number) ??
    sub0CalcValue ??
    (p.fixed_calculation_value as number) ??
    (p.calculation_value as number) ??
    null;

  // ============================================
  // MAX BONUS: multi-source fallback
  // 1. p.max_bonus (root canonical)
  // 2. subcategories[0].max_bonus
  // 3. fixed_max_claim (fixed mode)
  // 4. dinamis_max_claim (formula mode)
  // ============================================
  const resolvedMaxBonus: number | null =
    (p.max_bonus as number) ??
    (subs[0]?.max_bonus as number) ??
    (p.fixed_max_claim as number) ??
    (p.dinamis_max_claim as number) ??
    null;

  // ============================================
  // PAYOUT DIRECTION: multi-source fallback
  // 1. calcM.data.payout_direction
  // 2. p.payout_direction (root)
  // 3. p.global_payout_direction (formula mode global)
  // 4. subcategories[0].payout_direction
  // ============================================
  const resolvedPayoutDirection: string =
    (calcM?.data?.payout_direction as string) ||
    (p.payout_direction as string) ||
    (p.global_payout_direction as string) ||
    (subs[0]?.payout_direction as string) ||
    '';

  // ============================================
  // CLAIM METHOD: multi-source fallback
  // 1. claimM.data.method
  // 2. p.claim_method
  // 3. p.contact_channel (if enabled)
  // ============================================
  const resolvedClaimMethod: string =
    (claimM?.data?.method as string) ||
    (p.claim_method as string) ||
    ((p.contact_channel_enabled && p.contact_channel) ? (p.contact_channel as string) : '') ||
    '';

  const resolvedClaimPlatform: string =
    (claimM?.data?.platform as string) ||
    (p.claim_platform as string) ||
    '';

  const cp: CanonicalProjection = {
    promo_summary: (() => {
      // Priority 1: existing promo_summary di PromoFormData
      if (p.promo_summary && typeof p.promo_summary === 'string' && (p.promo_summary as string).trim()) {
        return p.promo_summary as string;
      }

      // Priority 2: generate dari referral_tiers[] untuk referral
      if (p.tier_archetype === 'referral' && (p as any).referral_tiers?.length) {
        const ctx: PromoSummaryContext = {
          tier_archetype: 'referral',
          promo_type: (p.promo_type as string) || undefined,
          subcategories: ((p as any).referral_tiers as any[]).map((t: any) => ({
            calculation_value: t.commission_percentage,
            min_dimension_value: t.min_downline,
            sub_name: t.tier_label,
          })),
        };
        const generated = generatePromoSummary(mechanics as any, ctx);
        if (generated) return generated;
      }

      // Priority 3: generate dari subcategories[] untuk non-referral tier
      if ((p.subcategories as any[])?.length) {
        const ctx: PromoSummaryContext = {
          tier_archetype: (p.tier_archetype as string) || undefined,
          promo_type: (p.promo_type as string) || undefined,
          subcategories: (p.subcategories as any[]).map((s: any) => ({
            calculation_value: s.calculation_value,
            sub_name: s.sub_name || s.name,
          })),
        };
        const generated = generatePromoSummary(mechanics as any, ctx);
        if (generated) return generated;
      }

      return '';
    })(),
    main_trigger: (triggerM?.data?.event as string) || (p.trigger_event as string) || '',
    main_reward_form: resolvedRewardForm,
    main_reward_percent: resolvedRewardPercent,
    max_bonus: resolvedMaxBonus,
    payout_direction: resolvedPayoutDirection,
    turnover_multiplier: (controlM?.data?.turnover_multiplier as number) ?? null,
    turnover_basis: (controlM?.data?.turnover_basis as string) || (p.turnover_basis as string) || '',
    primary_claim_method: resolvedClaimMethod,
    primary_claim_platform: resolvedClaimPlatform,
    proof_required: (claimM?.data?.proof_required as boolean) ?? (p.proof_required as boolean) ?? false,
    stateful: !!stateM,
    game_scope: (p.game_restriction as string) || (p.game_scope as string) || 'semua',
    game_types: ((p.game_types as string[]) || []),
    game_providers: ((p.game_providers as string[]) || []),
    game_exclusions: ((p.game_exclusions as string[]) || []).map(e =>
      typeof e === 'string' ? e : JSON.stringify(e)
    ),
    intent_category: (p.intent_category as string) || '',
    target_segment: (p.target_segment as string) || '',
  };

  // ============================================
  // AUDIT LOG: canonical_projection fields resolved
  // ============================================
  const missingCritical: string[] = [];
  if (!cp.main_trigger) missingCritical.push('main_trigger');
  if (!cp.main_reward_form) missingCritical.push('main_reward_form');
  if (cp.main_reward_percent === null && cp.max_bonus === null) missingCritical.push('main_reward_percent + max_bonus (both null)');
  if (!cp.primary_claim_method) missingCritical.push('primary_claim_method');

  console.log('[canonical_projection] resolved fields:', {
    main_trigger: cp.main_trigger,
    main_reward_form: cp.main_reward_form,
    main_reward_percent: cp.main_reward_percent,
    max_bonus: cp.max_bonus,
    payout_direction: cp.payout_direction,
    turnover_multiplier: cp.turnover_multiplier,
    primary_claim_method: cp.primary_claim_method,
    stateful: cp.stateful,
    missing_critical: missingCritical.length > 0 ? missingCritical : 'none',
  });

  return cp;
}

// ============================================
// CONVERT PromoFormData → v3.1 DB ROW
// ============================================

function toV31Row(
  promo: PromoFormData,
  id: string,
  createdBy: string
): Record<string, unknown> {
  const p = promo as unknown as Record<string, unknown>;

  // Priority: gunakan _mechanics_v31 dari LLM jika valid, non-empty, dan tidak dirty
  // Fallback: derive dari form data via buildMechanicsFromFormData()
  const llmMechanics = (p._mechanics_v31 as MechanicNode[]) || [];
  const isDirty = (p._mechanics_v31_dirty as boolean) === true;

  const mechanics = (llmMechanics.length > 0 && !isDirty)
    ? llmMechanics
    : buildMechanicsFromFormData(promo);

  console.log(`[toV31Row] mechanics source: ${
    llmMechanics.length > 0 && !isDirty ? 'llm' : 'derived'
  } | llm_count: ${llmMechanics.length} | dirty: ${isDirty}`);
  const adjudication = defaultAdjudication();
  adjudication.status = 'resolved'; // Form data = already human-reviewed

  const canonical_projection = buildCanonicalProjectionFromMechanics(mechanics, promo);
  const query_hints = defaultQueryHints();
  const meta: PromoMeta = {
    ...defaultMeta(createdBy),
    overall_extraction_confidence:
      (p.extraction_confidence as number) ??
      mechanics.reduce((sum, m) => sum + m.confidence, 0) / (mechanics.length || 1),
    human_verified: (p.human_verified as boolean) ?? false,
    created_by: createdBy,
  };

  return {
    id,
    promo_id: (p.promo_id as string) || id,
    client_id: (p.client_id as string) || DEFAULT_CLIENT_ID,
    client_name: (p.client_name as string) || null,
    promo_name: (p.promo_name as string) || '',
    promo_slug: (p.promo_slug as string) || null,
    status: (p.status as string) || 'draft',
    source_url: (p.source_url as string) || null,
    source_text_hash: null,
    valid_from: (p.valid_from as string) || null,
    valid_until: (!p.valid_until || p.valid_until_unlimited) ? null : (p.valid_until as string),
    valid_until_unlimited: (p.valid_until_unlimited as boolean) ?? true,
    geo_restriction: (p.geo_restriction as string) || 'indonesia',
    platform_access: (p.platform_access as string) || 'semua',
    promo_risk_level: (p.promo_risk_level as string) || 'medium',
    mechanics,
    adjudication,
    canonical_projection,
    query_hints,
    meta,
  };
}

// ============================================
// CONVERT v3.1 DB ROW → PromoFormData (for form wizard editing)
// Bridge: mechanics[] + canonical_projection → PromoFormData
// ============================================

function fromV31Row(row: Record<string, unknown>): PromoItem {
  const mechanics = (row.mechanics as MechanicNode[]) || [];
  const cp = (row.canonical_projection as CanonicalProjection) || defaultCanonicalProjection();
  const meta = (row.meta as PromoMeta) || defaultMeta();

  const triggerM = mechanics.find(m => m.mechanic_type === 'trigger');
  const eligM = mechanics.find(m => m.mechanic_type === 'eligibility');
  const calcM = mechanics.find(m => m.mechanic_type === 'calculation');
  const rewardM = mechanics.find(m => m.mechanic_type === 'reward');
  const stateM = mechanics.find(m => m.mechanic_type === 'state');
  const distM = mechanics.find(m => m.mechanic_type === 'distribution');
  const claimM = mechanics.find(m => m.mechanic_type === 'claim');
  const controlM = mechanics.find(m => m.mechanic_type === 'control');

  const triggerData = (triggerM?.data || {}) as Record<string, unknown>;
  const eligData = (eligM?.data || {}) as Record<string, unknown>;
  const calcData = (calcM?.data || {}) as Record<string, unknown>;
  const rewardData = (rewardM?.data || {}) as Record<string, unknown>;
  const stateData = (stateM?.data || {}) as Record<string, unknown>;
  const distData = (distM?.data || {}) as Record<string, unknown>;
  const claimData = (claimM?.data || {}) as Record<string, unknown>;
  const controlData = (controlM?.data || {}) as Record<string, unknown>;

  // Derive reward_mode from state + tiers
  const hasTiers = Array.isArray(stateData?.tiers) && (stateData.tiers as unknown[]).length > 0;
  
  // ============================================
  // AUTHORITY INVERSION: Read tier_archetype from stored data first
  // Only fallback to heuristic if data.tier_archetype not present
  // ============================================
  const tierArchetype = hasTiers
    ? (typeof stateData?.tier_archetype === 'string' && stateData.tier_archetype
        ? stateData.tier_archetype  // ← Stored authority (round-trip safe)
        : (stateData?.storage_key === 'loyalty_point_balance' ? 'point_store' : 'level'))  // ← Legacy fallback
    : undefined;

  const rewardMode = hasTiers ? 'tier' : (calcData?.formula ? 'formula' : 'fixed');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const promo: any = {
    // Identity
    id: row.id as string,
    promo_id: (row.promo_id as string) || '',
    client_id: (row.client_id as string) || DEFAULT_CLIENT_ID,
    client_name: (row.client_name as string) || '',
    promo_name: (row.promo_name as string) || '',
    promo_slug: (row.promo_slug as string) || '',
    source_url: (row.source_url as string) || '',
    promo_summary: cp.promo_summary || '',
    schema_version: 'V.APR.09',
    status: ((row.status as string) || 'draft') as 'active' | 'paused' | 'draft' | 'expired',
    is_active: false,
    version: 1,

    // Taxonomy
    category: cp.intent_category?.includes('event') ? 'EVENT' : 'REWARD' as 'REWARD' | 'EVENT' | '',
    promo_type: (row.promo_slug as string) || '',
    reward_mode: rewardMode as 'fixed' | 'tier' | 'formula',
    intent_category: cp.intent_category || '',
    target_segment: (eligData.target_segment as string) || cp.target_segment || '',

    // Trigger
    trigger_event: (triggerData.event as string) || cp.main_trigger || '',
    trigger_min_value: (triggerData.min_value as number) || null,

    // Reward
    reward_type: (rewardData.reward_form as string) || cp.main_reward_form || '',
    reward_unit: (rewardData.reward_unit as string) || '',
    reward_amount: (rewardData.reward_percent as number) ?? (rewardData.reward_amount_fixed as number) ?? null,
    reward_is_percentage: !!(rewardData.reward_percent),
    reward_item_description: (rewardData.item_description as string) || '',

    // Calculation
    calculation_base: (calcData.basis as string) || '',
    calculation_basis: (calcData.basis as string) || '',
    payout_direction: (calcData.payout_direction as string) || cp.payout_direction || '' as 'belakang' | 'depan' | undefined,
    conversion_formula: (calcData.formula as string) || '',
    min_calculation: (calcData.min_basis_value as number) || null,
    min_deposit: (triggerData.min_value as number) || null,
    max_bonus: cp.max_bonus ?? (calcData.max_result as number) ?? null,
    max_bonus_unlimited: (calcData.max_result_unlimited as boolean) ?? false,

    // Turnover / control
    turnover_rule_enabled: (controlData.turnover_enabled as boolean) ?? false,
    turnover_enabled: (controlData.turnover_enabled as boolean) ?? false,
    turnover_multiplier: cp.turnover_multiplier ?? (controlData.turnover_multiplier as number) ?? null,
    turnover_basis: (cp.turnover_basis || controlData.turnover_basis as string) as 'bonus_only' | 'deposit_only' | 'deposit_plus_bonus' | undefined,
    min_withdraw_after_bonus: (controlData.min_withdraw_after_bonus as number) || null,
    anti_fraud_notes: (controlData.anti_fraud_notes as string) || '',
    penalty_type: (controlData.penalty_type as string) || undefined,
    turnover_rule: '',
    turnover_rule_custom: '',

    // Claim
    claim_frequency: (triggerData.frequency as string) || '',
    claim_method: (claimData.method as string) || '' as '' | 'auto' | 'manual' | 'cs_request',
    claim_deadline_days: claimData.deadline_hours
      ? Math.round((claimData.deadline_hours as number) / 24)
      : null,
    claim_platform: (claimData.platform as string) as 'auto' | 'form' | 'livechat' | 'whatsapp' | 'telegram' | 'apk' | undefined,
    claim_url: (claimData.claim_url as string) || null,
    max_claim: (claimData.max_claim as number) || null,
    max_claim_unlimited: (claimData.max_claim_unlimited as boolean) ?? false,

    // Proof
    proof_required: (claimData.proof_required as boolean) ?? cp.proof_required ?? false,
    proof_type: ((claimData.proof_type as string) || 'none') as 'none' | 'screenshot' | 'social_post' | 'bill_share',
    proof_destination: ((claimData.proof_destination as string) || 'none') as 'none' | 'livechat' | 'whatsapp' | 'telegram' | 'facebook',

    // Distribution
    distribution_mode: (distData.mode as string) || '',
    distribution_schedule: (distData.schedule as string) || '',
    distribution_note: (distData.distribution_note as string) || '',
    reward_distribution: (distData.mode as string) || '',
    distribution_day: '',
    distribution_time: '',
    distribution_date_from: '',
    distribution_date_until: '',
    distribution_time_enabled: false,
    distribution_time_from: '',
    distribution_time_until: '',
    distribution_day_time_enabled: false,
    calculation_period_start: '',
    calculation_period_end: '',
    calculation_period_note: '',

    // Game scope
    game_restriction: cp.game_scope || 'semua',
    game_scope: cp.game_scope || 'semua',
    game_types: cp.game_types || [],
    game_providers: cp.game_providers || [],
    game_exclusions: cp.game_exclusions || [],
    game_names: [],
    game_blacklist_enabled: false,
    game_types_blacklist: [],
    game_providers_blacklist: [],
    game_names_blacklist: [],
    game_exclusion_rules: [],

    // Access
    platform_access: (row.platform_access as string) || 'semua',
    geo_restriction: (row.geo_restriction as string) || 'indonesia',
    require_apk: (eligData.require_apk as boolean) ?? false,
    one_account_rule: (eligData.one_account_rule as boolean) ?? false,

    // Validity
    valid_from: (row.valid_from as string) || '',
    valid_until: (row.valid_until as string) || '',
    valid_until_unlimited: (row.valid_until_unlimited as boolean) ?? false,

    // Risk
    promo_risk_level: ((row.promo_risk_level as string) || 'medium') as 'no' | 'low' | 'medium' | 'high',
    custom_terms: '',
    special_requirements: (eligData.other_conditions as string[]) || [],

    // Tiers (from state mechanic)
    has_subcategories: false,
    subcategories: [],
    tier_archetype: tierArchetype as 'level' | 'point_store' | 'referral' | 'formula' | undefined,
    tiers: (stateData?.tiers as unknown[]) || [],
    fast_exp_missions: [],
    level_up_rewards: [],
    promo_unit: 'lp',
    exp_mode: 'level_up',
    lp_calc_method: '',
    exp_calc_method: '',
    lp_earn_basis: 'turnover',
    lp_earn_amount: 0,
    lp_earn_point_amount: 0,
    exp_formula: '',
    lp_value: '',
    exp_value: '',
    vip_multiplier: { enabled: false, min_daily_to: 0, tiers: [] },

    // Archetype (stored in meta for reference)
    archetype_payload: {},
    archetype_invariants: {},

    // Extraction meta
    extraction_confidence: meta.overall_extraction_confidence ?? 0.9,
    human_verified: meta.human_verified ?? false,
    is_locked: false,
    created_by: meta.created_by || 'Admin',

    // Timestamps
    created_at: (row.created_at as string) || new Date().toISOString(),
    updated_at: (row.updated_at as string) || new Date().toISOString(),
    updated_by: 'Admin',

    // Admin fee
    admin_fee_enabled: false,
    admin_fee_percentage: null,

    // Fixed mode UI fields
    fixed_reward_type: '',
    fixed_calculation_base: '',
    fixed_calculation_method: '',
    fixed_payout_direction: 'after' as 'before' | 'after',
    fixed_admin_fee_enabled: false,
    fixed_max_claim_enabled: false,
    fixed_max_claim_unlimited: false,
    fixed_min_calculation_enabled: false,
    fixed_calculation_value_enabled: false,
    fixed_turnover_rule_enabled: false,
    fixed_turnover_rule: '',

    // Dinamis legacy fields
    dinamis_reward_type: '',
    dinamis_reward_amount: null,
    dinamis_max_claim_unlimited: false,
    min_reward_claim: null,
    min_reward_claim_enabled: false,
    calculation_method: '',
    calculation_value: null,
    min_calculation_enabled: false,

    // Date ranges
    claim_date_from: '',
    claim_date_until: '',

    // Referral
    referral_tiers: [],
    referral_calculation_basis: '',
    referral_admin_fee_enabled: false,
    referral_admin_fee_percentage: null,
  };

  // Restore mechanics dari DB sebagai first-class persisted state
  // Tanpa ini, update path selalu fallback ke buildMechanicsFromFormData()
  const persistedMechanics = (row.mechanics as MechanicNode[]) || [];

  if (persistedMechanics.length > 0) {
    promo._mechanics_v31 = persistedMechanics;
    promo._mechanics_source = 'persisted';
    promo._mechanics_v31_dirty = false;

    console.log(
      `[fromV31Row] restored mechanics: ${persistedMechanics.length} primitives`
    );
  }

  return promo as PromoItem;
}

// ============================================
// KNOWLEDGE BASE STORAGE
// ============================================

export const promoKB = {
  getAll: async (): Promise<PromoItem[]> => {
    if (!USE_SUPABASE) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const promos: PromoItem[] = stored ? JSON.parse(stored) : [];
        return promos;
      } catch (error) {
        console.error('[promoKB] Failed to load from localStorage:', error);
        return [];
      }
    }

    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        logSupabaseError('promoKB.getAll', error);
        return [];
      }

      return (data || []).map(row => {
        try {
          return fromV31Row(row as Record<string, unknown>);
        } catch (err) {
          console.error('[promoKB.getAll] fromV31Row failed for row:', (row as Record<string,unknown>)?.id, err);
          return null;
        }
      }).filter(Boolean) as PromoItem[];
    } catch (error) {
      logSupabaseError('promoKB.getAll', error);
      return [];
    }
  },

  getById: async (id: string): Promise<PromoItem | null> => {
    if (!USE_SUPABASE) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const promos: PromoItem[] = stored ? JSON.parse(stored) : [];
        return promos.find(p => p.id === id) || null;
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

      return fromV31Row(data as Record<string, unknown>);
    } catch (error) {
      logSupabaseError('promoKB.getById', error);
      return null;
    }
  },

  add: async (promo: PromoFormData): Promise<PromoItem> => {
    // HARD GUARD: Draft tidak boleh masuk Supabase
    if (USE_SUPABASE && promo.status === 'draft') {
      const errMsg = '[promoKB.add] BLOCKED: status=draft tidak boleh masuk Supabase.';
      console.error(errMsg);
      throw new Error(errMsg);
    }

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

    // Inject session email into created_by
    let createdBy = 'Admin';
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userEmail = sessionData?.session?.user?.email;
      if (userEmail) createdBy = userEmail;
    } catch (_) {
      // fallback to Admin
    }

    const row = toV31Row(promo, id, createdBy);
    row.created_at = now;
    row.updated_at = now;

    const { data, error } = await supabase
      .from(TABLE)
      .upsert(row, { onConflict: 'promo_id,client_id' })
      .select()
      .single();

    if (error) {
      logSupabaseError('promoKB.add', error);
      if (error.code === '23505') {
        throw new Error('DUPLICATE_PROMO');
      }
      throw new Error(`Failed to add promo to database: ${error.message}`);
    }

    window.dispatchEvent(new CustomEvent('promo-storage-updated'));
    console.log('[promoKB.add] ✅ Published to Supabase v3.1:', data.id, data.promo_name);

    return fromV31Row(data as Record<string, unknown>);
  },

  update: async (id: string, updates: Partial<PromoFormData>): Promise<boolean> => {
    if (!USE_SUPABASE) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const promos: PromoItem[] = stored ? JSON.parse(stored) : [];
        const index = promos.findIndex(p => p.id === id);
        if (index === -1) return false;
        promos[index] = { ...promos[index], ...updates, updated_at: new Date().toISOString() };
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
      const u = updates as Record<string, unknown>;

      // For partial updates — only rebuild mechanics if significant fields changed
      const patch: Record<string, unknown> = { updated_at: now };

      // Always-patchable identity fields
      const identityFields: Array<[string, string]> = [
        ['status', 'status'],
        ['promo_name', 'promo_name'],
        ['promo_slug', 'promo_slug'],
        ['client_id', 'client_id'],
        ['client_name', 'client_name'],
        ['source_url', 'source_url'],
        ['valid_from', 'valid_from'],
        ['valid_until', 'valid_until'],
        ['valid_until_unlimited', 'valid_until_unlimited'],
        ['platform_access', 'platform_access'],
        ['geo_restriction', 'geo_restriction'],
        ['promo_risk_level', 'promo_risk_level'],
      ];

      for (const [src, dest] of identityFields) {
        if (src in u) patch[dest] = u[src];
      }

      // Date fields: "" → null
      for (const f of ['valid_from', 'valid_until']) {
        if (f in patch && (patch[f] === '' || patch[f] === undefined)) {
          patch[f] = null;
        }
      }

      // If mechanics-relevant fields changed, rebuild mechanics + canonical_projection
      const mechanicsFields = [
        'trigger_event', 'trigger_min_value', 'reward_type', 'reward_unit',
        'reward_amount', 'calculation_base', 'payout_direction', 'conversion_formula',
        'max_bonus', 'max_bonus_unlimited', 'turnover_rule_enabled', 'turnover_multiplier',
        'turnover_basis', 'claim_method', 'claim_platform', 'distribution_mode',
        'distribution_schedule', 'proof_required', 'proof_type', 'tiers', 'tier_archetype',
        'target_segment', 'require_apk', 'one_account_rule', 'anti_fraud_notes',
        'game_types', 'game_providers', 'game_exclusions', 'game_restriction',
      ];

      const hasMechanicChange = mechanicsFields.some(f => f in u);
      if (hasMechanicChange) {
        // Need current row to merge, then rebuild
        const { data: currentRow } = await supabase
          .from(TABLE)
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (currentRow) {
          const currentFormData = fromV31Row(currentRow as Record<string, unknown>);
          const merged = { ...currentFormData, ...updates } as PromoFormData;

          let createdBy = 'Admin';
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData?.session?.user?.email) createdBy = sessionData.session.user.email;
          } catch (_) { /* noop */ }

          const rebuilt = toV31Row(merged, id, createdBy);
          patch.mechanics = rebuilt.mechanics;
          patch.canonical_projection = rebuilt.canonical_projection;
          patch.adjudication = rebuilt.adjudication;
          patch.meta = rebuilt.meta;
        }
      }

      // Human verified / is_locked patches
      if ('human_verified' in u || 'is_locked' in u) {
        const currentMeta = await supabase.from(TABLE).select('meta').eq('id', id).maybeSingle();
        const existingMeta = (currentMeta.data?.meta as PromoMeta) || defaultMeta();
        patch.meta = {
          ...existingMeta,
          human_verified: ('human_verified' in u) ? (u.human_verified as boolean) : existingMeta.human_verified,
        };
      }

      const { error } = await supabase
        .from(TABLE)
        .update(patch)
        .eq('id', id);

      if (error) {
        logSupabaseError('promoKB.update', error);
        return false;
      }

      window.dispatchEvent(new CustomEvent('promo-storage-updated'));
      console.log('[promoKB] Updated promo v3.1:', id);
      return true;
    } catch (error) {
      logSupabaseError('promoKB.update', error);
      return false;
    }
  },

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
// LOCAL DRAFT KB — localStorage only
// Dipanggil saat user klik "Gunakan Promo" di Pseudo KB
// ============================================

const LOCAL_DRAFT_KEY = 'voc_promo_local_draft_';

export const localDraftKB = {
  save: (promo: PromoFormData): PromoItem => {
    const id = (promo as PromoFormData & { id?: string }).id || generateUUID();
    const now = new Date().toISOString();
    const draft: PromoItem = {
      ...promo,
      id,
      status: 'draft',
      is_active: false,
      version: 1,
      created_at: now,
      updated_at: now,
      updated_by: 'Admin',
    } as PromoItem;

    // Carry-forward internal mechanics metadata (tidak di-spread oleh PromoItem interface)
    const promoAny = promo as any;
    if (promoAny._mechanics_v31) {
      (draft as any)._mechanics_v31 = promoAny._mechanics_v31;
      (draft as any)._mechanics_source = promoAny._mechanics_source;
      (draft as any)._mechanics_v31_dirty = promoAny._mechanics_v31_dirty;
      console.log(`[localDraftKB.save] _mechanics_v31 preserved: ${promoAny._mechanics_v31.length} primitives`);
    }

    try {
      localStorage.setItem(`${LOCAL_DRAFT_KEY}${id}`, JSON.stringify(draft));
      window.dispatchEvent(new CustomEvent('promo-storage-updated'));
      console.log('[localDraftKB.save] Draft tersimpan lokal:', id, draft.promo_name);
    } catch (e) {
      console.error('[localDraftKB.save] Failed:', e);
    }
    return draft;
  },

  getAll: (): PromoItem[] => {
    const drafts: PromoItem[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(LOCAL_DRAFT_KEY)) {
          const raw = localStorage.getItem(key);
          if (raw) {
          try {
              const parsed = JSON.parse(raw) as PromoItem;
              const parsedAny = parsed as any;
              console.log(`[localDraftKB.load] id: ${parsed.id} | _mechanics_v31: ${parsedAny._mechanics_v31?.length ?? 0} primitives`);
              drafts.push(parsed);
            } catch {
              // skip corrupted
            }
          }
        }
      }
    } catch (e) {
      console.error('[localDraftKB.getAll] Failed:', e);
    }
    return drafts.sort((a, b) =>
      new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
    );
  },

  delete: (id: string): void => {
    localStorage.removeItem(`${LOCAL_DRAFT_KEY}${id}`);
    window.dispatchEvent(new CustomEvent('promo-storage-updated'));
  },

  isLocal: (id: string): boolean => {
    return localStorage.getItem(`${LOCAL_DRAFT_KEY}${id}`) !== null;
  },
};

// ============================================
// SESSION STORAGE
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
      const updated: ExtractorSession = { ...current, ...data, timestamp: Date.now() };
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

// ============================================
// EXPORTS — v3.1 public API (functions only, types declared inline above)
// ============================================
export { toV31Row, fromV31Row, buildMechanicsFromFormData, buildCanonicalProjectionFromMechanics };
