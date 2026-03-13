/**
 * Event Turnover Slot PRESIDENSLOT - Pre-populated Extraction
 * 
 * 15 Tier mixed rewards:
 * - Tier 1-5: Hadiah Fisik (Mobil, Motor, Emas)
 * - Tier 6-15: Uang Tunai (Rp 300.000 - Rp 15.000.000)
 * 
 * Archetype: tier_level (Event Level Up / Turnover Milestone)
 */

import type { PromoFormData, TierReward } from '@/components/VOCDashboard/PromoFormWizard/types';
import { generateUUID } from '@/lib/supabase-client';

// ============================================
// PRESIDENSLOT EVENT TURNOVER SLOT TIERS
// ============================================

const PRESIDENSLOT_TIERS: TierReward[] = [
  // Tier 1-5: HADIAH FISIK
  {
    id: generateUUID(),
    type: 'Tier 1 - Grand Prize',
    minimal_point: 500000000, // TO 500 Juta
    reward: 0,
    reward_type: 'fixed',
    jenis_hadiah: 'hadiah_fisik',
    physical_reward_name: '1 Unit Mitsubishi Pajero Sport Dakar 2025',
    physical_reward_quantity: 1,
  },
  {
    id: generateUUID(),
    type: 'Tier 2',
    minimal_point: 300000000, // TO 300 Juta
    reward: 0,
    reward_type: 'fixed',
    jenis_hadiah: 'hadiah_fisik',
    physical_reward_name: '1 Unit Toyota Veloz 2025',
    physical_reward_quantity: 1,
  },
  {
    id: generateUUID(),
    type: 'Tier 3',
    minimal_point: 200000000, // TO 200 Juta
    reward: 0,
    reward_type: 'fixed',
    jenis_hadiah: 'hadiah_fisik',
    physical_reward_name: '1 Unit Yamaha XMAX 2025',
    physical_reward_quantity: 1,
  },
  {
    id: generateUUID(),
    type: 'Tier 4',
    minimal_point: 100000000, // TO 100 Juta
    reward: 0,
    reward_type: 'fixed',
    jenis_hadiah: 'hadiah_fisik',
    physical_reward_name: '1 Unit Honda PCX 2025',
    physical_reward_quantity: 1,
  },
  {
    id: generateUUID(),
    type: 'Tier 5',
    minimal_point: 50000000, // TO 50 Juta
    reward: 0,
    reward_type: 'fixed',
    jenis_hadiah: 'hadiah_fisik',
    physical_reward_name: 'Emas Antam 25 Gram',
    physical_reward_quantity: 1,
  },
  
  // Tier 6-15: UANG TUNAI
  {
    id: generateUUID(),
    type: 'Tier 6',
    minimal_point: 25000000, // TO 25 Juta
    reward: 15000000,
    reward_type: 'fixed',
    jenis_hadiah: 'uang_tunai',
    cash_reward_amount: 15000000,
  },
  {
    id: generateUUID(),
    type: 'Tier 7',
    minimal_point: 15000000, // TO 15 Juta
    reward: 10000000,
    reward_type: 'fixed',
    jenis_hadiah: 'uang_tunai',
    cash_reward_amount: 10000000,
  },
  {
    id: generateUUID(),
    type: 'Tier 8',
    minimal_point: 10000000, // TO 10 Juta
    reward: 5000000,
    reward_type: 'fixed',
    jenis_hadiah: 'uang_tunai',
    cash_reward_amount: 5000000,
  },
  {
    id: generateUUID(),
    type: 'Tier 9',
    minimal_point: 7500000, // TO 7.5 Juta
    reward: 3000000,
    reward_type: 'fixed',
    jenis_hadiah: 'uang_tunai',
    cash_reward_amount: 3000000,
  },
  {
    id: generateUUID(),
    type: 'Tier 10',
    minimal_point: 5000000, // TO 5 Juta
    reward: 2000000,
    reward_type: 'fixed',
    jenis_hadiah: 'uang_tunai',
    cash_reward_amount: 2000000,
  },
  {
    id: generateUUID(),
    type: 'Tier 11',
    minimal_point: 3000000, // TO 3 Juta
    reward: 1500000,
    reward_type: 'fixed',
    jenis_hadiah: 'uang_tunai',
    cash_reward_amount: 1500000,
  },
  {
    id: generateUUID(),
    type: 'Tier 12',
    minimal_point: 2000000, // TO 2 Juta
    reward: 1000000,
    reward_type: 'fixed',
    jenis_hadiah: 'uang_tunai',
    cash_reward_amount: 1000000,
  },
  {
    id: generateUUID(),
    type: 'Tier 13',
    minimal_point: 1000000, // TO 1 Juta
    reward: 500000,
    reward_type: 'fixed',
    jenis_hadiah: 'uang_tunai',
    cash_reward_amount: 500000,
  },
  {
    id: generateUUID(),
    type: 'Tier 14',
    minimal_point: 500000, // TO 500rb
    reward: 300000,
    reward_type: 'fixed',
    jenis_hadiah: 'uang_tunai',
    cash_reward_amount: 300000,
  },
  {
    id: generateUUID(),
    type: 'Tier 15',
    minimal_point: 250000, // TO 250rb
    reward: 200000,
    reward_type: 'fixed',
    jenis_hadiah: 'uang_tunai',
    cash_reward_amount: 200000,
  },
];

/**
 * Generate pre-populated PromoFormData for Event Turnover Slot PRESIDENSLOT
 * Returns a complete form state ready for the wizard
 */
export function createEventTurnoverPresidenslot(): Partial<PromoFormData> {
  return {
    // ===============================
    // STEP 1: IDENTITY
    // ===============================
    client_id: 'PRESIDENSLOT',
    promo_name: 'EVENT TURNOVER SLOT PRESIDENSLOT',
    promo_type: 'Event / Level Up',
    intent_category: 'REWARD',
    target_segment: 'Player Slot',
    trigger_event: 'Turnover',
    
    // ===============================
    // STEP 2: ACCESS
    // ===============================
    platform_access: 'Semua',
    valid_until_unlimited: true,
    valid_from: '',
    valid_until: '',
    status: 'active',
    geo_restriction: 'Semua',
    require_apk: false,
    
    // ===============================
    // STEP 3: REWARD CONFIG (TIER MODE)
    // ===============================
    reward_mode: 'tier',
    tier_archetype: 'level',
    promo_unit: 'lp', // placeholder
    
    // Tiers (15 tiers: 5 hadiah fisik + 10 uang tunai)
    tiers: PRESIDENSLOT_TIERS,
    
    // Claim Rules
    claim_frequency: 'bulanan',
    claim_date_from: '1',
    claim_date_until: '5',
    claim_method: 'manual',
    
    // Contact Channel
    contact_channel_enabled: true,
    contact_channel: 'WhatsApp / Telegram',
    contact_link: '',
    
    // Game Scope (SLOT only)
    game_restriction: 'slot',
    game_types: ['SLOT'],
    game_providers: ['Semua'],
    game_names: [],
    
    // Blacklist
    game_blacklist_enabled: false,
    game_types_blacklist: [],
    game_providers_blacklist: [],
    game_names_blacklist: [],
    game_exclusion_rules: [],
    
    // ===============================
    // STEP 4: CLASSIFICATION
    // ===============================
    program_classification: 'B', // Event Program
    classification_confidence: 'high',
    category: 'EVENT',
    
    // ===============================
    // CUSTOM TERMS
    // ===============================
    custom_terms: `SYARAT & KETENTUAN EVENT TURNOVER SLOT PRESIDENSLOT

1. Akumulasi TurnOver Slot di Periode Bulan Sebelumnya
2. Klaim Bonus Tanggal 1 - 5 di Bulan berikutnya
3. Klaim melalui WhatsApp / Telegram Official
4. Ketentuan berlaku untuk provider SLOT saja
5. Keputusan admin adalah FINAL dan tidak dapat diganggu gugat
6. Promo dapat berubah sewaktu-waktu tanpa pemberitahuan sebelumnya
7. Hadiah fisik akan dikirim ke alamat pemenang (koordinasi via CS)
8. Hadiah uang tunai akan dikreditkan ke akun pemenang

TABEL HADIAH:
- TO 500 Juta: Mitsubishi Pajero Sport Dakar 2025
- TO 300 Juta: Toyota Veloz 2025
- TO 200 Juta: Yamaha XMAX 2025
- TO 100 Juta: Honda PCX 2025
- TO 50 Juta: Emas Antam 25 Gram
- TO 25 Juta: Rp 15.000.000
- TO 15 Juta: Rp 10.000.000
- TO 10 Juta: Rp 5.000.000
- TO 7.5 Juta: Rp 3.000.000
- TO 5 Juta: Rp 2.000.000
- TO 3 Juta: Rp 1.500.000
- TO 2 Juta: Rp 1.000.000
- TO 1 Juta: Rp 500.000
- TO 500rb: Rp 300.000
- TO 250rb: Rp 200.000`,

    // ===============================
    // INERT VALUES (Tier Mode Contract)
    // ===============================
    reward_type: '',
    reward_amount: null,
    min_deposit: null,
    max_claim: null,
    turnover_rule: '',
    turnover_rule_enabled: false,
    calculation_base: '',
    calculation_value: null,
    min_calculation: null,
    min_calculation_enabled: false,
    
    // Fixed mode fields (not used in tier mode)
    fixed_reward_type: '',
    fixed_calculation_base: '',
    fixed_calculation_method: '',
    fixed_calculation_value: undefined,
    fixed_max_claim: undefined,
    fixed_max_claim_enabled: false,
    fixed_max_claim_unlimited: false,
    fixed_payout_direction: 'after',
    fixed_turnover_rule_enabled: false,
    fixed_turnover_rule: '',
    fixed_min_depo_enabled: false,
    fixed_min_depo: undefined,
    
    // ===============================
    // EMPTY ARRAYS (Required by type)
    // ===============================
    special_requirements: [],
    fast_exp_missions: [],
    level_up_rewards: [],
    redeem_items: [],
    referral_tiers: [],
    subcategories: [],
    
    // VIP Multiplier (not used)
    vip_multiplier: {
      enabled: false,
      min_daily_to: 0,
      tiers: [],
    },
  };
}

/**
 * Get tier summary for display
 */
export function getPresidenslorTierSummary(): string {
  const physicalCount = PRESIDENSLOT_TIERS.filter(t => t.jenis_hadiah === 'hadiah_fisik').length;
  const cashCount = PRESIDENSLOT_TIERS.filter(t => t.jenis_hadiah === 'uang_tunai').length;
  
  return `${PRESIDENSLOT_TIERS.length} Tier (${physicalCount} Hadiah Fisik, ${cashCount} Uang Tunai)`;
}

export { PRESIDENSLOT_TIERS };
