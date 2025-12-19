/**
 * Event Program Types
 * Category B - Non-deterministic/random rewards (lucky draw, tournaments, etc.)
 */

export type EventType = 
  | 'lucky_box'
  | 'lucky_draw'
  | 'grand_prize'
  | 'tournament'
  | 'leaderboard'
  | 'screenshot_event'
  | 'social_share'
  | 'mission'
  | 'achievement'
  | 'seasonal'
  | 'other';

export interface EventPrize {
  prize_name: string;
  prize_type: 'cash' | 'bonus' | 'merchandise' | 'free_spin' | 'voucher' | 'other';
  prize_value: string | null;
  quantity: number | null;
  probability: string | null; // e.g., "1:1000" or "rare"
  tier: string | null; // e.g., "Grand Prize", "1st", "Consolation"
}

export interface EventMechanics {
  participation_method: string;
  entry_cost: string | null; // e.g., "Deposit min 50rb" or "Free"
  entry_frequency: string | null; // e.g., "1x per hari", "Unlimited"
  winner_selection: 'random' | 'ranking' | 'first_come' | 'achievement' | 'manual';
  winner_announcement: string | null;
}

export interface ExtractedEvent {
  // Classification (LOCKED)
  program_type: 'event';
  program_classification: 'B';
  
  // Identity
  event_name: string;
  event_type: EventType;
  client_id: string | null;
  
  // Period
  period: {
    start_date: string | null;
    end_date: string | null;
    is_recurring: boolean;
    recurrence_pattern: string | null; // e.g., "Setiap Minggu", "Bulanan"
  };
  
  // Prizes
  prizes: EventPrize[];
  total_prize_pool: string | null;
  
  // Mechanics
  mechanics: EventMechanics;
  
  // Eligibility
  eligibility: {
    target_user: 'all' | 'new_member' | 'vip' | 'specific';
    minimum_deposit: string | null;
    minimum_turnover: string | null;
    required_games: string[];
    other_requirements: string[];
  };
  
  // Claim Process
  claim: {
    claim_channel: 'livechat' | 'telegram' | 'whatsapp' | 'automatic' | 'email';
    claim_deadline: string | null;
    claim_instructions: string | null;
    proof_required: string | null; // e.g., "Screenshot", "None"
  };
  
  // Terms
  terms_conditions: string[];
  
  // NO FORMULA-BASED REWARD (these are null/not applicable)
  bonus_percentage: null;
  calculation_formula: null;
  turnover_for_reward: null;
  payout_direction: null;
  
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
 * Default values for a new event extraction
 */
export const DEFAULT_EXTRACTED_EVENT: ExtractedEvent = {
  program_type: 'event',
  program_classification: 'B',
  
  event_name: '',
  event_type: 'other',
  client_id: null,
  
  period: {
    start_date: null,
    end_date: null,
    is_recurring: false,
    recurrence_pattern: null,
  },
  
  prizes: [],
  total_prize_pool: null,
  
  mechanics: {
    participation_method: '',
    entry_cost: null,
    entry_frequency: null,
    winner_selection: 'random',
    winner_announcement: null,
  },
  
  eligibility: {
    target_user: 'all',
    minimum_deposit: null,
    minimum_turnover: null,
    required_games: [],
    other_requirements: [],
  },
  
  claim: {
    claim_channel: 'livechat',
    claim_deadline: null,
    claim_instructions: null,
    proof_required: null,
  },
  
  terms_conditions: [],
  
  // NO FORMULA-BASED REWARD
  bonus_percentage: null,
  calculation_formula: null,
  turnover_for_reward: null,
  payout_direction: null,
  
  validation: {
    is_complete: false,
    warnings: [],
  },
};

/**
 * Map extracted event to form-ready data
 */
export function mapEventToFormData(extracted: ExtractedEvent) {
  return {
    program_classification: 'B' as const,
    program_type: 'event' as const,
    ...extracted,
  };
}

/**
 * Event type display labels
 */
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  lucky_box: 'Lucky Box',
  lucky_draw: 'Lucky Draw / Undian',
  grand_prize: 'Grand Prize',
  tournament: 'Tournament',
  leaderboard: 'Leaderboard Race',
  screenshot_event: 'Screenshot Event',
  social_share: 'Social Share',
  mission: 'Mission / Quest',
  achievement: 'Achievement',
  seasonal: 'Seasonal Event',
  other: 'Other',
};
