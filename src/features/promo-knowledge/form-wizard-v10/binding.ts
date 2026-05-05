/**
 * Phase 2A — V.10.1 Form Wizard ↔ PkV10Record binding (SAFE FIELDS ONLY).
 *
 * STRICT SCOPE / TECHNICAL DEBT NOTE:
 *   - Enum authority for Phase 2A = `src/features/promo-knowledge/schema/enums.ts`
 *     (runtime active F3). NOT the master plan document.
 *   - SKIPPED (left untouched on the record):
 *       • reward_engine.admin_fee_*               (TBD path)
 *       • loyalty: tier_block, exchange_groups,
 *         level_up_rewards, vip_multiplier, fast_exp_missions,
 *         redeem_items, referral_tiers              (TBD paths / placeholder)
 *       • variant_engine.items_block.subcategories (Phase 4 placeholder)
 *       • projection_engine, readiness_engine,
 *         reasoning_engine, mechanics_engine,
 *         meta_engine, classification_engine,
 *         _field_status / ai_confidence            (system-only)
 *       • PLATFORM_ACCESS, GEO, VALIDITY_MODE,
 *         DURATION_UNIT, RESET_FREQUENCY,
 *         CALCULATION_UNIT, SOCIAL_PLATFORM,
 *         LOYALTY_MODE                              (enum group not in F3 yet —
 *                                                   bound as free-text passthrough)
 *   - This is engineering-temporary. Must be revisited under task
 *     "F3 Runtime Enum Alignment / Cleanup".
 */
import type { PkV10Record } from "../schema/pk-v10";
import type { V10WizardState } from "./state";
import { initialV10WizardState } from "./state";

const s = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const n = (v: unknown): string => (v === null || v === undefined || v === "" ? "" : String(v));
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const toNum = (v: string): number | null => {
  if (v === "" || v === null || v === undefined) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

/**
 * Read PkV10Record into the wizard state. Only safe fields populated.
 */
export function pkRecordToWizard(rec: PkV10Record): V10WizardState {
  const init = initialV10WizardState;

  const id = rec.identity_engine ?? init.identity_engine;
  const sc = rec.scope_engine ?? init.scope_engine;
  const rk = rec.risk_engine ?? init.risk_engine;
  const tg = rec.trigger_engine ?? init.trigger_engine;
  const pe = rec.period_engine ?? init.period_engine;
  const tw = rec.time_window_engine ?? init.time_window_engine;
  const tx = rec.taxonomy_engine ?? init.taxonomy_engine;
  const rw = rec.reward_engine ?? init.reward_engine;
  const py = rec.payment_engine ?? init.payment_engine;
  const cl = rec.claim_engine ?? init.claim_engine;
  const pf = rec.proof_engine ?? init.proof_engine;
  const lo = rec.loyalty_engine ?? init.loyalty_engine;
  const dp = rec.dependency_engine ?? init.dependency_engine;
  const iv = rec.invalidation_engine ?? init.invalidation_engine;
  const tm = rec.terms_engine ?? init.terms_engine;

  return {
    identity_engine: {
      client_block: {
        client_id: s(id.client_block?.client_id),
        client_name: s(id.client_block?.client_name),
      },
      promo_block: {
        promo_name: s(id.promo_block?.promo_name),
        promo_type: s(id.promo_block?.promo_type),
        target_user: s(id.promo_block?.target_user),
        promo_mode: s(id.promo_block?.promo_mode),
      },
    },
    scope_engine: {
      platform_block: {
        platform_access: s(sc.platform_block?.platform_access),
        apk_required: !!sc.platform_block?.apk_required,
      },
      geo_block: { geo_restriction: s(sc.geo_block?.geo_restriction) },
      game_block: {
        game_domain: s(sc.game_block?.game_domain),
        eligible_providers: arr(sc.game_block?.eligible_providers),
      },
      blacklist_block: {
        providers: arr(sc.blacklist_block?.providers),
        games: arr(sc.blacklist_block?.games),
      },
    },
    risk_engine: { level_block: { promo_risk_level: s(rk.level_block?.promo_risk_level) } },
    trigger_engine: {
      primary_trigger_block: { trigger_event: s(tg.primary_trigger_block?.trigger_event) },
      trigger_rule_block: {
        conditions: (tg.trigger_rule_block?.conditions ?? []).map((c) => ({
          field: s(c.field),
          operator: s(c.operator),
          value: s(c.value),
          currency: s(c.currency),
        })),
        logic_operator: s(tg.trigger_rule_block?.logic_operator),
      },
    },
    period_engine: {
      validity_block: {
        valid_from: s(pe.validity_block?.valid_from),
        valid_until: s(pe.validity_block?.valid_until),
        valid_until_unlimited: !!pe.validity_block?.valid_until_unlimited,
        validity_mode: s(pe.validity_block?.validity_mode),
        validity_duration_value: n(pe.validity_block?.validity_duration_value),
        validity_duration_unit: s(pe.validity_block?.validity_duration_unit),
      },
      distribution_block: {
        claim_frequency: s(pe.distribution_block?.claim_frequency),
        distribution_day: s(pe.distribution_block?.distribution_day),
      },
    },
    time_window_engine: {
      distribution_window_block: {
        enabled: !!tw.distribution_window_block?.enabled,
        start_time: s(tw.distribution_window_block?.start_time),
        end_time: s(tw.distribution_window_block?.end_time),
        days: arr(tw.distribution_window_block?.days),
      },
      claim_window_block: {
        enabled: !!tw.claim_window_block?.enabled,
        start_time: s(tw.claim_window_block?.start_time),
        end_time: s(tw.claim_window_block?.end_time),
        days: arr(tw.claim_window_block?.days),
      },
      reset_block: {
        enabled: !!tw.reset_block?.enabled,
        reset_time: s(tw.reset_block?.reset_time),
        reset_frequency: s(tw.reset_block?.reset_frequency),
      },
    },
    taxonomy_engine: {
      mode_block: {
        mode: s(tx.mode_block?.mode),
        tier_archetype: s(tx.mode_block?.tier_archetype),
      },
      logic_block: {
        turnover_basis: s(tx.logic_block?.turnover_basis),
        conversion_formula: s(tx.logic_block?.conversion_formula),
      },
    },
    reward_engine: {
      reward_type: s(rw.reward_type),
      voucher_kind: s(rw.voucher_kind),
      currency: s(rw.currency) || "IDR",
      max_reward: n(rw.max_reward),
      max_reward_unlimited: !!rw.max_reward_unlimited,
      payout_direction: s(rw.payout_direction),
      calculation_basis: s(rw.calculation_basis),
      calculation_method: s(rw.calculation_method),
      calculation_value: n(rw.calculation_value),
      calculation_unit: s(rw.calculation_unit),
      requirement_block: { min_deposit: n(rw.requirement_block?.min_deposit) },
      admin_fee_enabled: false,
      admin_fee_value: "",
    },
    payment_engine: {
      deposit_block: {
        deposit_method: s(py.deposit_block?.deposit_method),
        deposit_rate: n(py.deposit_block?.deposit_rate),
        deposit_method_providers: arr(py.deposit_block?.deposit_method_providers),
      },
      method_whitelist_block: {
        methods: arr(py.method_whitelist_block?.methods),
        providers: arr(py.method_whitelist_block?.providers),
      },
      method_blacklist_block: {
        methods: arr(py.method_blacklist_block?.methods),
        providers: arr(py.method_blacklist_block?.providers),
      },
    },
    claim_engine: {
      method_block: {
        claim_method: s(cl.method_block?.claim_method),
        auto_credit: !!cl.method_block?.auto_credit,
      },
      channels_block: { channels: arr(cl.channels_block?.channels) },
      instruction_block: {
        claim_steps: arr(cl.instruction_block?.claim_steps),
        claim_url: s(cl.instruction_block?.claim_url),
      },
      proof_requirement_block: {
        proof_required: !!cl.proof_requirement_block?.proof_required,
        proof_types: arr(cl.proof_requirement_block?.proof_types),
        proof_destinations: arr(cl.proof_requirement_block?.proof_destinations),
      },
    },
    proof_engine: {
      social_proof_block: {
        platforms: arr(pf.social_proof_block?.platforms),
        hashtags: arr(pf.social_proof_block?.hashtags),
        content_requirements: arr(pf.social_proof_block?.content_requirements).join("\n"),
      },
    },
    loyalty_engine: {
      mechanism_block: {
        point_name: s(lo.mechanism_block?.point_name),
        loyalty_mode: s(lo.mechanism_block?.loyalty_mode),
        earning_rule: s(lo.mechanism_block?.earning_rule),
      },
      exchange_block: { exchange_groups_note: "" },
    },
    dependency_engine: {
      stacking_block: {
        stacking_allowed: !!dp.stacking_block?.stacking_allowed,
        stacking_policy: s(dp.stacking_block?.stacking_policy),
        max_concurrent: n(dp.stacking_block?.max_concurrent),
      },
      exclusion_block: {
        mutually_exclusive_with: arr(dp.exclusion_block?.mutually_exclusive_with),
        can_combine_with: arr(dp.exclusion_block?.can_combine_with),
      },
    },
    invalidation_engine: {
      void_conditions_note: "",
      penalty_block: {
        void_action: s(iv.penalty_block?.void_action),
        penalty_type: s(iv.penalty_block?.penalty_type),
        penalty_scope: s(iv.penalty_block?.penalty_scope),
      },
    },
    terms_engine: {
      conditions_block: {
        terms_conditions: Array.isArray(tm.conditions_block?.terms_conditions)
          ? (tm.conditions_block?.terms_conditions as string[]).join("\n")
          : s(tm.conditions_block?.terms_conditions),
      },
      requirements_block: { special_requirements: arr(tm.requirements_block?.special_requirements) },
    },
  };
}

/**
 * Merge wizard state back into a PkV10Record. Skips TBD/placeholder/system fields.
 * Returns a NEW record. Does not mutate input.
 */
export function mergeWizardIntoPkRecord(rec: PkV10Record, w: V10WizardState): PkV10Record {
  return {
    ...rec,
    identity_engine: {
      ...rec.identity_engine,
      client_block: {
        ...rec.identity_engine.client_block,
        client_id: w.identity_engine.client_block.client_id,
        client_name: w.identity_engine.client_block.client_name,
      },
      promo_block: {
        ...rec.identity_engine.promo_block,
        promo_name: w.identity_engine.promo_block.promo_name,
        promo_type: w.identity_engine.promo_block.promo_type,
        target_user: w.identity_engine.promo_block.target_user,
        promo_mode: w.identity_engine.promo_block.promo_mode,
      },
    },
    scope_engine: {
      ...rec.scope_engine,
      platform_block: {
        ...rec.scope_engine.platform_block,
        platform_access: w.scope_engine.platform_block.platform_access,
        apk_required: w.scope_engine.platform_block.apk_required,
      },
      geo_block: { ...rec.scope_engine.geo_block, geo_restriction: w.scope_engine.geo_block.geo_restriction },
      game_block: {
        ...rec.scope_engine.game_block,
        game_domain: w.scope_engine.game_block.game_domain,
        eligible_providers: w.scope_engine.game_block.eligible_providers,
      },
      blacklist_block: {
        ...rec.scope_engine.blacklist_block,
        providers: w.scope_engine.blacklist_block.providers,
        games: w.scope_engine.blacklist_block.games,
      },
    },
    risk_engine: {
      ...rec.risk_engine,
      level_block: { promo_risk_level: w.risk_engine.level_block.promo_risk_level },
    },
    trigger_engine: {
      ...rec.trigger_engine,
      primary_trigger_block: {
        ...rec.trigger_engine.primary_trigger_block,
        trigger_event: w.trigger_engine.primary_trigger_block.trigger_event,
      },
      trigger_rule_block: {
        ...rec.trigger_engine.trigger_rule_block,
        conditions: w.trigger_engine.trigger_rule_block.conditions.map((c) => ({
          field: c.field,
          operator: c.operator,
          value: c.value,
          currency: c.currency,
        })),
        logic_operator: w.trigger_engine.trigger_rule_block.logic_operator,
      },
    },
    period_engine: {
      ...rec.period_engine,
      validity_block: {
        ...rec.period_engine.validity_block,
        valid_from: w.period_engine.validity_block.valid_from || null,
        valid_until: w.period_engine.validity_block.valid_until || null,
        valid_until_unlimited: w.period_engine.validity_block.valid_until_unlimited,
        validity_mode: w.period_engine.validity_block.validity_mode,
        validity_duration_value: toNum(w.period_engine.validity_block.validity_duration_value),
        validity_duration_unit: w.period_engine.validity_block.validity_duration_unit,
      },
      distribution_block: {
        ...rec.period_engine.distribution_block,
        claim_frequency: w.period_engine.distribution_block.claim_frequency,
        distribution_day: w.period_engine.distribution_block.distribution_day,
      },
    },
    time_window_engine: {
      ...rec.time_window_engine,
      distribution_window_block: { ...w.time_window_engine.distribution_window_block },
      claim_window_block: { ...w.time_window_engine.claim_window_block },
      reset_block: { ...w.time_window_engine.reset_block },
    },
    taxonomy_engine: {
      ...rec.taxonomy_engine,
      mode_block: {
        mode: w.taxonomy_engine.mode_block.mode,
        tier_archetype: w.taxonomy_engine.mode_block.tier_archetype || null,
      },
      logic_block: {
        ...rec.taxonomy_engine.logic_block,
        turnover_basis: w.taxonomy_engine.logic_block.turnover_basis || null,
        conversion_formula: w.taxonomy_engine.logic_block.conversion_formula,
      },
    },
    reward_engine: {
      ...rec.reward_engine,
      reward_type: w.reward_engine.reward_type,
      voucher_kind: w.reward_engine.voucher_kind || null,
      currency: w.reward_engine.currency || null,
      max_reward: toNum(w.reward_engine.max_reward),
      max_reward_unlimited: w.reward_engine.max_reward_unlimited,
      payout_direction: w.reward_engine.payout_direction,
      calculation_basis: w.reward_engine.calculation_basis,
      calculation_method: w.reward_engine.calculation_method,
      calculation_value: toNum(w.reward_engine.calculation_value),
      calculation_unit: w.reward_engine.calculation_unit,
      requirement_block: {
        ...rec.reward_engine.requirement_block,
        min_deposit: toNum(w.reward_engine.requirement_block.min_deposit),
      },
    },
    payment_engine: {
      ...rec.payment_engine,
      deposit_block: {
        ...rec.payment_engine.deposit_block,
        deposit_method: w.payment_engine.deposit_block.deposit_method,
        deposit_rate: toNum(w.payment_engine.deposit_block.deposit_rate),
        deposit_method_providers: w.payment_engine.deposit_block.deposit_method_providers,
      },
      method_whitelist_block: { ...w.payment_engine.method_whitelist_block },
      method_blacklist_block: { ...w.payment_engine.method_blacklist_block },
    },
    claim_engine: {
      ...rec.claim_engine,
      method_block: { ...w.claim_engine.method_block },
      channels_block: {
        ...rec.claim_engine.channels_block,
        channels: w.claim_engine.channels_block.channels,
      },
      instruction_block: { ...w.claim_engine.instruction_block },
      proof_requirement_block: { ...w.claim_engine.proof_requirement_block },
    },
    proof_engine: {
      ...rec.proof_engine,
      social_proof_block: {
        ...rec.proof_engine.social_proof_block,
        platforms: w.proof_engine.social_proof_block.platforms,
        hashtags: w.proof_engine.social_proof_block.hashtags,
        content_requirements: w.proof_engine.social_proof_block.content_requirements
          ? w.proof_engine.social_proof_block.content_requirements.split("\n").filter(Boolean)
          : [],
      },
    },
    loyalty_engine: {
      ...rec.loyalty_engine,
      mechanism_block: { ...w.loyalty_engine.mechanism_block },
    },
    dependency_engine: {
      ...rec.dependency_engine,
      stacking_block: {
        ...rec.dependency_engine.stacking_block,
        stacking_allowed: w.dependency_engine.stacking_block.stacking_allowed,
        stacking_policy: w.dependency_engine.stacking_block.stacking_policy,
        max_concurrent: toNum(w.dependency_engine.stacking_block.max_concurrent),
      },
      exclusion_block: { ...w.dependency_engine.exclusion_block },
    },
    invalidation_engine: {
      ...rec.invalidation_engine,
      penalty_block: { ...w.invalidation_engine.penalty_block },
    },
    terms_engine: {
      ...rec.terms_engine,
      conditions_block: {
        ...rec.terms_engine.conditions_block,
        terms_conditions: w.terms_engine.conditions_block.terms_conditions
          ? w.terms_engine.conditions_block.terms_conditions.split("\n").filter(Boolean)
          : [],
      },
      requirements_block: {
        ...rec.terms_engine.requirements_block,
        special_requirements: w.terms_engine.requirements_block.special_requirements,
      },
    },
  };
}
