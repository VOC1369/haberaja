// ============================================
// POLICY CONFIGURATION TYPES
// ============================================

export type PolicySubtype = 
  | 'loyalty_program'
  | 'deposit_policy'
  | 'withdrawal_policy'
  | 'betting_restriction'
  | 'general_policy';

export interface PolicyIdentityData {
  policy_name: string;
  policy_subtype: PolicySubtype;
  client_id: string;
  description: string;
  is_active: boolean;
}

export interface ExchangeTier {
  id: string;
  lp_required: number;
  reward_credit: number;
  tier_name?: string;
}

export interface LoyaltyProgramData {
  earning_rule: string;
  earning_period: 'daily' | 'weekly' | 'monthly';
  accumulation_time?: string;
  exchange_tiers: ExchangeTier[];
  claim_limit: string;
  claim_channel: string;
  claim_steps: string[];
}

export interface DepositPolicyData {
  min_deposit: number;
  max_deposit?: number;
  channels: string[];
  potongan_percentage?: number;
  restrictions: string[];
}

export interface WithdrawalPolicyData {
  min_withdrawal: number;
  max_withdrawal?: number;
  daily_limit?: number;
  frequency_limit?: string;
  requirements: string[];
}

export interface BettingRestrictionData {
  max_bet?: number;
  excluded_games: string[];
  excluded_providers: string[];
  affected_bonus_types: string[];
}

export interface PolicyRule {
  id: string;
  rule_text: string;
  is_penalty: boolean;
}

export interface PolicyPenalty {
  id: string;
  violation: string;
  consequence: string;
}

export interface PolicyRulesData {
  rules: PolicyRule[];
  penalties: PolicyPenalty[];
}

export interface PolicyScopeData {
  affected_games: string[];
  affected_providers: string[];
  effective_from?: string;
  effective_until?: string;
  effective_unlimited: boolean;
}

export interface PolicyConfigData {
  identity: PolicyIdentityData;
  loyalty: LoyaltyProgramData;
  deposit: DepositPolicyData;
  withdrawal: WithdrawalPolicyData;
  betting: BettingRestrictionData;
  rules: PolicyRulesData;
  scope: PolicyScopeData;
}

// Initial data for policy configuration
export const initialPolicyData: PolicyConfigData = {
  identity: {
    policy_name: '',
    policy_subtype: 'general_policy',
    client_id: '',
    description: '',
    is_active: true,
  },
  loyalty: {
    earning_rule: '',
    earning_period: 'daily',
    accumulation_time: '',
    exchange_tiers: [],
    claim_limit: '',
    claim_channel: '',
    claim_steps: [],
  },
  deposit: {
    min_deposit: 0,
    max_deposit: undefined,
    channels: [],
    potongan_percentage: undefined,
    restrictions: [],
  },
  withdrawal: {
    min_withdrawal: 0,
    max_withdrawal: undefined,
    daily_limit: undefined,
    frequency_limit: '',
    requirements: [],
  },
  betting: {
    max_bet: undefined,
    excluded_games: [],
    excluded_providers: [],
    affected_bonus_types: [],
  },
  rules: {
    rules: [],
    penalties: [],
  },
  scope: {
    affected_games: [],
    affected_providers: [],
    effective_from: '',
    effective_until: '',
    effective_unlimited: false,
  },
};

// Policy subtype options for select
export const POLICY_SUBTYPES = [
  { value: 'loyalty_program', label: 'Loyalty Program' },
  { value: 'deposit_policy', label: 'Deposit Policy' },
  { value: 'withdrawal_policy', label: 'Withdrawal Policy' },
  { value: 'betting_restriction', label: 'Betting Restriction' },
  { value: 'general_policy', label: 'General Policy' },
] as const;

// Earning period options
export const EARNING_PERIODS = [
  { value: 'daily', label: 'Harian' },
  { value: 'weekly', label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
] as const;

// Deposit channel options
export const DEPOSIT_CHANNELS = [
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'ewallet', label: 'E-Wallet' },
  { value: 'pulsa', label: 'Pulsa' },
  { value: 'qris', label: 'QRIS' },
  { value: 'crypto', label: 'Crypto' },
] as const;
