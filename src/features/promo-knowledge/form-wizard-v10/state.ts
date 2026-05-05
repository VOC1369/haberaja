/**
 * Phase 1 — Local skeleton state for V.10.1 Form Wizard.
 * Shape mirrors PkV10Record path naming (engine.block.field), but is NOT the schema.
 * Real prefill / save will land in Phase 2+. NO connection to extractor or storage.
 */

export type V10WizardState = {
  identity_engine: {
    client_block: { client_id: string; client_name: string };
    promo_block: {
      promo_name: string;
      promo_type: string;
      target_user: string;
      promo_mode: string;
    };
  };
  scope_engine: {
    platform_block: { platform_access: string; apk_required: boolean };
    geo_block: { geo_restriction: string };
    game_block: { game_domain: string; eligible_providers: string[] };
    blacklist_block: { providers: string[]; games: string[] };
  };
  risk_engine: { level_block: { promo_risk_level: string } };
  trigger_engine: {
    primary_trigger_block: { trigger_event: string };
    trigger_rule_block: {
      conditions: Array<{ field: string; operator: string; value: string; currency: string }>;
      logic_operator: string;
    };
  };
  period_engine: {
    validity_block: {
      valid_from: string;
      valid_until: string;
      valid_until_unlimited: boolean;
      validity_mode: string;
      validity_duration_value: string;
      validity_duration_unit: string;
    };
    distribution_block: { claim_frequency: string; distribution_day: string };
  };
  time_window_engine: {
    distribution_window_block: { enabled: boolean; start_time: string; end_time: string; days: string[] };
    claim_window_block: { enabled: boolean; start_time: string; end_time: string; days: string[] };
    reset_block: { enabled: boolean; reset_time: string; reset_frequency: string };
  };
  taxonomy_engine: {
    mode_block: { mode: string; tier_archetype: string };
    logic_block: { turnover_basis: string; conversion_formula: string };
  };
  reward_engine: {
    reward_type: string;
    voucher_kind: string;
    currency: string;
    max_reward: string;
    max_reward_unlimited: boolean;
    payout_direction: string;
    calculation_basis: string;
    calculation_method: string;
    calculation_value: string;
    calculation_unit: string;
    requirement_block: { min_deposit: string };
    admin_fee_enabled: boolean;
    admin_fee_value: string;
  };
  payment_engine: {
    deposit_block: { deposit_method: string; deposit_rate: string; deposit_method_providers: string[] };
    method_whitelist_block: { methods: string[]; providers: string[] };
    method_blacklist_block: { methods: string[]; providers: string[] };
  };
  claim_engine: {
    method_block: { claim_method: string; auto_credit: boolean };
    channels_block: { channels: string[] };
    instruction_block: { claim_steps: string[]; claim_url: string };
    proof_requirement_block: { proof_required: boolean; proof_types: string[]; proof_destinations: string[] };
  };
  proof_engine: {
    social_proof_block: { platforms: string[]; hashtags: string[]; content_requirements: string };
  };
  loyalty_engine: {
    mechanism_block: { point_name: string; loyalty_mode: string; earning_rule: string };
    exchange_block: { exchange_groups_note: string };
  };
  dependency_engine: {
    stacking_block: { stacking_allowed: boolean; stacking_policy: string; max_concurrent: string };
    exclusion_block: { mutually_exclusive_with: string[]; can_combine_with: string[] };
  };
  invalidation_engine: {
    void_conditions_note: string;
    penalty_block: { void_action: string; penalty_type: string; penalty_scope: string };
  };
  terms_engine: {
    conditions_block: { terms_conditions: string };
    requirements_block: { special_requirements: string[] };
  };
};

export const initialV10WizardState: V10WizardState = {
  identity_engine: {
    client_block: { client_id: "", client_name: "" },
    promo_block: { promo_name: "", promo_type: "", target_user: "", promo_mode: "" },
  },
  scope_engine: {
    platform_block: { platform_access: "", apk_required: false },
    geo_block: { geo_restriction: "" },
    game_block: { game_domain: "", eligible_providers: [] },
    blacklist_block: { providers: [], games: [] },
  },
  risk_engine: { level_block: { promo_risk_level: "" } },
  trigger_engine: {
    primary_trigger_block: { trigger_event: "" },
    trigger_rule_block: { conditions: [], logic_operator: "" },
  },
  period_engine: {
    validity_block: {
      valid_from: "", valid_until: "", valid_until_unlimited: false,
      validity_mode: "", validity_duration_value: "", validity_duration_unit: "",
    },
    distribution_block: { claim_frequency: "", distribution_day: "" },
  },
  time_window_engine: {
    distribution_window_block: { enabled: false, start_time: "", end_time: "", days: [] },
    claim_window_block: { enabled: false, start_time: "", end_time: "", days: [] },
    reset_block: { enabled: false, reset_time: "", reset_frequency: "" },
  },
  taxonomy_engine: {
    mode_block: { mode: "", tier_archetype: "" },
    logic_block: { turnover_basis: "", conversion_formula: "" },
  },
  reward_engine: {
    reward_type: "", voucher_kind: "", currency: "IDR",
    max_reward: "", max_reward_unlimited: false,
    payout_direction: "", calculation_basis: "", calculation_method: "",
    calculation_value: "", calculation_unit: "",
    requirement_block: { min_deposit: "" },
    admin_fee_enabled: false, admin_fee_value: "",
  },
  payment_engine: {
    deposit_block: { deposit_method: "", deposit_rate: "", deposit_method_providers: [] },
    method_whitelist_block: { methods: [], providers: [] },
    method_blacklist_block: { methods: [], providers: [] },
  },
  claim_engine: {
    method_block: { claim_method: "", auto_credit: false },
    channels_block: { channels: [] },
    instruction_block: { claim_steps: [], claim_url: "" },
    proof_requirement_block: { proof_required: false, proof_types: [], proof_destinations: [] },
  },
  proof_engine: {
    social_proof_block: { platforms: [], hashtags: [], content_requirements: "" },
  },
  loyalty_engine: {
    mechanism_block: { point_name: "", loyalty_mode: "", earning_rule: "" },
    exchange_block: { exchange_groups_note: "" },
  },
  dependency_engine: {
    stacking_block: { stacking_allowed: false, stacking_policy: "", max_concurrent: "" },
    exclusion_block: { mutually_exclusive_with: [], can_combine_with: [] },
  },
  invalidation_engine: {
    void_conditions_note: "",
    penalty_block: { void_action: "", penalty_type: "", penalty_scope: "" },
  },
  terms_engine: {
    conditions_block: { terms_conditions: "" },
    requirements_block: { special_requirements: [] },
  },
};

export const STEP_TITLES = [
  "Identitas Promo",
  "Batasan & Akses",
  "Trigger & Validitas",
  "Reward & Perhitungan",
  "Pembayaran",
  "Klaim & Bukti",
  "Loyalitas",
  "Ketergantungan & Pembatalan",
  "Review & Simpan",
] as const;
