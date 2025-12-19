/**
 * Policy Program Types
 * Category C - Rules and restrictions without rewards
 */

export interface ExtractedPolicy {
  // Classification (LOCKED)
  program_type: 'policy';
  program_classification: 'C';
  
  // Identity
  policy_name: string;
  policy_type: 'deposit_policy' | 'discount_policy' | 'betting_restriction' | 'game_restriction' | 'account_policy';
  client_id: string | null;
  
  // Deposit Rules (only for deposit_policy)
  deposit_rules: {
    deposit_methods: string[];
    accepted_providers: string | null;
    minimal_deposit: string | null;
    maximal_deposit: string | null;
    confirmation_required: boolean;
    confirmation_method: string | null;
  } | null;
  
  // Usage Requirements
  usage_requirements: {
    game_category: string;
    credit_multiplier: string;
    max_bet_rule: string | null;
    notes: string | null;
  }[];
  
  // Game Scope
  game_scope: {
    applicable_games: string[];
    excluded_games: string[];
    provider_restrictions: string[];
  };
  
  // Restrictions & Prohibitions
  restrictions: {
    prohibitions: string[];
    max_bet_rules: {
      game_type: string;
      max_bet: string;
    }[];
  };
  
  // Penalties
  penalties: {
    type: 'potongan_withdraw' | 'hangus_saldo' | 'suspend_akun' | 'blokir_permanen';
    detail: string | null;
    percentage: number | null;
    minimum_amount: string | null;
  }[];
  
  // Bonus Exclusion
  bonus_exclusion: {
    no_deposit_bonus: boolean;
    no_newmember_bonus: boolean;
    no_daily_bonus: boolean;
    only_weekly_bonus: boolean;
    excluded_bonuses: string[];
    allowed_bonuses: string[];
  };
  
  // AI Behavior Guard
  ai_behavior: {
    never_suggest_bonus: boolean;
    always_explain_penalty: boolean;
    confirm_before_deposit: boolean;
    custom_guards: string[];
  };
  
  // Authority & Disclaimer
  authority: {
    authority_clause: string;
    terms_can_change: boolean;
    management_decision_final: boolean;
    disclaimer_text: string | null;
  };
  
  // NO REWARD (all null) - these fields exist but must be null
  reward_type: null;
  bonus_percentage: null;
  bonus_amount: null;
  turnover_for_reward: null;
  max_bonus: null;
  
  // Metadata
  source_url?: string;
  raw_content?: string;
  extracted_at?: string;
  
  // Validation
  validation: {
    is_complete: boolean;
    warnings: string[];
  };
}

/**
 * Default values for a new policy extraction
 */
export const DEFAULT_EXTRACTED_POLICY: ExtractedPolicy = {
  program_type: 'policy',
  program_classification: 'C',
  
  policy_name: '',
  policy_type: 'deposit_policy',
  client_id: null,
  
  deposit_rules: null,
  
  usage_requirements: [],
  
  game_scope: {
    applicable_games: [],
    excluded_games: [],
    provider_restrictions: [],
  },
  
  restrictions: {
    prohibitions: [],
    max_bet_rules: [],
  },
  
  penalties: [],
  
  bonus_exclusion: {
    no_deposit_bonus: true,
    no_newmember_bonus: true,
    no_daily_bonus: false,
    only_weekly_bonus: false,
    excluded_bonuses: ['deposit_bonus', 'newmember_bonus'],
    allowed_bonuses: [],
  },
  
  ai_behavior: {
    never_suggest_bonus: true,
    always_explain_penalty: true,
    confirm_before_deposit: true,
    custom_guards: [],
  },
  
  authority: {
    authority_clause: 'Keputusan manajemen bersifat mutlak dan tidak dapat diganggu gugat.',
    terms_can_change: true,
    management_decision_final: true,
    disclaimer_text: null,
  },
  
  // NO REWARD
  reward_type: null,
  bonus_percentage: null,
  bonus_amount: null,
  turnover_for_reward: null,
  max_bonus: null,
  
  validation: {
    is_complete: false,
    warnings: [],
  },
};

/**
 * Map extracted policy to form-ready data
 */
export function mapPolicyToFormData(extracted: ExtractedPolicy) {
  return {
    program_classification: 'C' as const,
    program_type: 'policy' as const,
    ...extracted,
  };
}
