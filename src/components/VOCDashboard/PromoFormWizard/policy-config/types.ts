// Policy Config Types

export interface PolicyIdentityData {
  policy_name: string;
  policy_type: 'deposit_policy' | 'discount_policy' | 'betting_restriction' | 'game_restriction' | 'account_policy' | 'other';
  status: 'draft' | 'active' | 'paused' | 'deprecated';
  client_id: string;
}

export interface DepositMethodRulesData {
  deposit_methods: string[];
  accepted_providers: string;
  minimal_deposit: string;
  maximal_deposit: string;
  confirmation_required: boolean;
  confirmation_method: string;
}

export interface GameRequirement {
  id: string;
  game_category: string;
  credit_multiplier: string;
  max_bet_rule: string;
}

export interface UsageRequirementsData {
  requirement_type: 'credit_multiplier' | 'turnover' | 'play_count' | 'none';
  game_requirements: GameRequirement[];
}

export interface GameScopeData {
  applicable_games: string[];
  excluded_games: string[];
  scope_notes: string;
}

export interface RestrictionsData {
  prohibitions: string[];
}

export interface Penalty {
  id: string;
  type: string;
  detail: string;
  percentage?: number;
  minimum_amount?: string;
}

export interface PenaltiesData {
  selected_penalties: string[];
  penalties: Penalty[];
  penalty_detail: string;
  withdraw_percentage: number;
  withdraw_minimum: string;
}

export interface BonusExclusionData {
  no_deposit_bonus: boolean;
  no_newmember_bonus: boolean;
  no_daily_bonus: boolean;
  only_weekly_bonus: boolean;
  bonus_notes: string;
}

export interface AuthorityData {
  authority_clause: string;
  terms_can_change: boolean;
}

export interface AIBehaviorData {
  can_explain_rules: true;
  can_explain_consequences: true;
  can_redirect_to_cs: true;
  can_call_it_bonus: false;
  can_calculate_reward: false;
  can_promise_prize: false;
}

export interface PolicyConfigData {
  identity: PolicyIdentityData;
  deposit_rules: DepositMethodRulesData;
  usage: UsageRequirementsData;
  game_scope: GameScopeData;
  restrictions: RestrictionsData;
  penalties: PenaltiesData;
  bonus_exclusion: BonusExclusionData;
  authority: AuthorityData;
  ai_behavior: AIBehaviorData;
}

export const initialPolicyData: PolicyConfigData = {
  identity: {
    policy_name: '',
    policy_type: 'deposit_policy',
    status: 'draft',
    client_id: '',
  },
  deposit_rules: {
    deposit_methods: [],
    accepted_providers: '',
    minimal_deposit: '',
    maximal_deposit: '',
    confirmation_required: false,
    confirmation_method: '',
  },
  usage: {
    requirement_type: 'none',
    game_requirements: [],
  },
  game_scope: {
    applicable_games: [],
    excluded_games: [],
    scope_notes: '',
  },
  restrictions: {
    prohibitions: [],
  },
  penalties: {
    selected_penalties: [],
    penalties: [],
    penalty_detail: '',
    withdraw_percentage: 0,
    withdraw_minimum: '',
  },
  bonus_exclusion: {
    no_deposit_bonus: true,
    no_newmember_bonus: true,
    no_daily_bonus: false,
    only_weekly_bonus: false,
    bonus_notes: '',
  },
  authority: {
    authority_clause: 'Semua keputusan dari [BRAND] adalah mutlak dan tidak dapat diganggu gugat.',
    terms_can_change: true,
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

// Constants
export const POLICY_TYPES = [
  { value: 'deposit_policy', label: 'Deposit Policy' },
  { value: 'discount_policy', label: 'Discount Policy' },
  { value: 'betting_restriction', label: 'Betting Restriction' },
  { value: 'game_restriction', label: 'Game Restriction' },
  { value: 'account_policy', label: 'Account Policy' },
  { value: 'other', label: 'Other' },
];

export const POLICY_STATUS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'deprecated', label: 'Deprecated' },
];

export const DEPOSIT_METHODS = [
  { value: 'pulsa', label: 'Pulsa' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'ewallet', label: 'E-Wallet' },
  { value: 'qris', label: 'QRIS' },
  { value: 'other', label: 'Other' },
];

export const REQUIREMENT_TYPES = [
  { value: 'credit_multiplier', label: 'Credit Multiplier' },
  { value: 'turnover', label: 'Turnover' },
  { value: 'play_count', label: 'Play Count' },
  { value: 'none', label: 'None' },
];

export const GAME_CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'slots', label: 'Slots' },
  { value: 'sportsbook', label: 'Sportsbook' },
  { value: 'live_casino', label: 'Live Casino' },
  { value: 'togel', label: 'Togel' },
  { value: 'poker', label: 'Poker' },
  { value: 'arcade', label: 'Arcade' },
];

export const PENALTY_TYPES = [
  { value: 'potongan_withdraw', label: 'Potongan Withdraw' },
  { value: 'kemenangan_hangus', label: 'Kemenangan Dihanguskan' },
  { value: 'saldo_dibekukan', label: 'Saldo Dibekukan' },
  { value: 'akun_suspend', label: 'Akun Disuspend' },
  { value: 'akun_blokir', label: 'Akun Diblokir Permanen' },
  { value: 'lainnya', label: 'Lainnya' },
];

// Helper to convert boolean flags to array format for extraction
export function getBonusArrays(data: BonusExclusionData) {
  const excluded: string[] = [];
  const allowed: string[] = [];

  if (data.no_deposit_bonus) excluded.push('deposit_bonus');
  else allowed.push('deposit_bonus');

  if (data.no_newmember_bonus) excluded.push('newmember_bonus');
  else allowed.push('newmember_bonus');

  if (data.no_daily_bonus) excluded.push('daily_bonus');
  else allowed.push('daily_bonus');

  if (data.only_weekly_bonus) allowed.push('weekly_bonus');

  return { excluded_bonuses: excluded, allowed_bonuses: allowed };
}
