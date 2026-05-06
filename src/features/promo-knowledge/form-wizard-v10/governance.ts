/**
 * Phase 2B — V.10.1 Form Wizard Save Governance.
 *
 * Append-only audit trail for safe-bound field edits performed via the
 * Form Wizard V.10.1.
 *
 * STRICT SCOPE:
 *   - Only paths in SAFE_PATHS are inspected.
 *   - For each changed path:
 *       • append entry to `_human_override_log`
 *       • set `_field_status[path] = "explicit"`
 *   - Never touches `ai_confidence`, variant_engine, projection_engine,
 *     mechanics_engine, reasoning_engine, meta_engine, classification_engine,
 *     readiness_engine (except root `updated_at`).
 *   - Skipped/TBD/placeholder fields (admin_fee, loyalty builders, etc.) are
 *     NOT in SAFE_PATHS by construction, so they cannot be logged.
 *   - No DB, no extractor, no V.09 bridge.
 */
import type { PkV10Record } from "../schema/pk-v10";

export interface FormWizardOverrideEntry {
  field_path: string;
  previous_value: unknown;
  new_value: unknown;
  previous_field_status: string | null;
  previous_ai_confidence: number | null;
  overridden_by: "admin";
  timestamp: string;
  source: "form_wizard_v10_phase_2b";
}

/** Safe field paths bound by Phase 2A binding.ts (single source of truth). */
export const SAFE_PATHS: readonly string[] = [
  "identity_engine.client_block.client_id",
  "identity_engine.client_block.client_name",
  "identity_engine.promo_block.promo_name",
  "identity_engine.promo_block.promo_type",
  "identity_engine.promo_block.target_user",
  "identity_engine.promo_block.promo_mode",

  "scope_engine.platform_block.platform_access",
  "scope_engine.platform_block.apk_required",
  "scope_engine.geo_block.geo_restriction",
  "scope_engine.game_block.game_domain",
  "scope_engine.game_block.eligible_providers",
  "scope_engine.blacklist_block.providers",
  "scope_engine.blacklist_block.games",

  "risk_engine.level_block.promo_risk_level",

  "trigger_engine.primary_trigger_block.trigger_event",
  "trigger_engine.trigger_rule_block.conditions",
  "trigger_engine.trigger_rule_block.logic_operator",

  "period_engine.validity_block.valid_from",
  "period_engine.validity_block.valid_until",
  "period_engine.validity_block.valid_until_unlimited",
  "period_engine.validity_block.validity_mode",
  "period_engine.validity_block.validity_duration_value",
  "period_engine.validity_block.validity_duration_unit",
  "period_engine.distribution_block.claim_frequency",
  "period_engine.distribution_block.distribution_day",

  "time_window_engine.distribution_window_block.enabled",
  "time_window_engine.distribution_window_block.start_time",
  "time_window_engine.distribution_window_block.end_time",
  "time_window_engine.distribution_window_block.days",
  "time_window_engine.claim_window_block.enabled",
  "time_window_engine.claim_window_block.start_time",
  "time_window_engine.claim_window_block.end_time",
  "time_window_engine.claim_window_block.days",
  "time_window_engine.reset_block.enabled",
  "time_window_engine.reset_block.reset_time",
  "time_window_engine.reset_block.reset_frequency",

  "taxonomy_engine.mode_block.mode",
  "taxonomy_engine.mode_block.tier_archetype",
  "taxonomy_engine.logic_block.turnover_basis",
  "taxonomy_engine.logic_block.conversion_formula",

  "reward_engine.reward_type",
  "reward_engine.voucher_kind",
  "reward_engine.currency",
  "reward_engine.max_reward",
  "reward_engine.max_reward_unlimited",
  "reward_engine.payout_direction",
  "reward_engine.calculation_basis",
  "reward_engine.calculation_method",
  "reward_engine.calculation_value",
  "reward_engine.calculation_unit",
  "reward_engine.requirement_block.min_deposit",

  "payment_engine.deposit_block.deposit_method",
  "payment_engine.deposit_block.deposit_rate",
  "payment_engine.deposit_block.deposit_method_providers",
  "payment_engine.method_whitelist_block.methods",
  "payment_engine.method_whitelist_block.providers",
  "payment_engine.method_blacklist_block.methods",
  "payment_engine.method_blacklist_block.providers",

  "claim_engine.method_block.claim_method",
  "claim_engine.method_block.auto_credit",
  "claim_engine.channels_block.channels",
  "claim_engine.instruction_block.claim_steps",
  "claim_engine.instruction_block.claim_url",
  "claim_engine.proof_requirement_block.proof_required",
  "claim_engine.proof_requirement_block.proof_types",
  "claim_engine.proof_requirement_block.proof_destinations",

  "proof_engine.social_proof_block.platforms",
  "proof_engine.social_proof_block.hashtags",
  "proof_engine.social_proof_block.content_requirements",

  "loyalty_engine.mechanism_block.point_name",
  "loyalty_engine.mechanism_block.loyalty_mode",
  "loyalty_engine.mechanism_block.earning_rule",

  "dependency_engine.stacking_block.stacking_allowed",
  "dependency_engine.stacking_block.stacking_policy",
  "dependency_engine.stacking_block.max_concurrent",
  "dependency_engine.exclusion_block.mutually_exclusive_with",
  "dependency_engine.exclusion_block.can_combine_with",

  "invalidation_engine.penalty_block.void_action",
  "invalidation_engine.penalty_block.penalty_type",
  "invalidation_engine.penalty_block.penalty_scope",

  "terms_engine.conditions_block.terms_conditions",
  "terms_engine.requirements_block.special_requirements",
] as const;

function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/** Deep-equality for JSON-shaped values (good enough for safe scalar/array fields). */
function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Apply Phase 2B governance to a merged record.
 *
 * Returns a NEW record with:
 *   - `_human_override_log` appended (existing entries preserved)
 *   - `_field_status[path] = "explicit"` for every changed safe path
 *   - root `updated_at` bumped (saveRecord will also bump, this is belt-and-suspenders)
 *
 * `ai_confidence`, variant_engine, system engines remain untouched.
 */
export function applyFormWizardGovernance(
  original: PkV10Record,
  merged: PkV10Record,
): { record: PkV10Record; entries: FormWizardOverrideEntry[] } {
  const now = new Date().toISOString();
  const existingLog = Array.isArray(merged._human_override_log)
    ? [...merged._human_override_log]
    : [];
  const fieldStatus: Record<string, string> = {
    ...(merged._field_status as Record<string, string> | undefined ?? {}),
  };
  const aiConf = (merged.ai_confidence ?? {}) as Record<string, unknown>;

  const newEntries: FormWizardOverrideEntry[] = [];

  for (const path of SAFE_PATHS) {
    const prev = getByPath(original, path);
    const next = getByPath(merged, path);
    if (jsonEqual(prev, next)) continue;

    const prevStatusRaw = fieldStatus[path];
    const prevStatus = typeof prevStatusRaw === "string" ? prevStatusRaw : null;

    const prevConfRaw = aiConf[path];
    const prevConf = typeof prevConfRaw === "number" ? prevConfRaw : null;

    const entry: FormWizardOverrideEntry = {
      field_path: path,
      previous_value: prev ?? null,
      new_value: next ?? null,
      previous_field_status: prevStatus,
      previous_ai_confidence: prevConf,
      overridden_by: "admin",
      timestamp: now,
      source: "form_wizard_v10_phase_2b",
    };
    newEntries.push(entry);
    fieldStatus[path] = "explicit";
  }

  if (newEntries.length === 0) {
    return { record: { ...merged, updated_at: now }, entries: [] };
  }

  const next: PkV10Record = {
    ...merged,
    _field_status: fieldStatus,
    _human_override_log: [...existingLog, ...newEntries],
    updated_at: now,
  };

  return { record: next, entries: newEntries };
}
