/**
 * Category-Specific Extraction Prompts
 * Version: v1.0.0+2025-12-21
 * 
 * CONTRACT OF TRUTH:
 * - Category is LOCKED by code before extraction
 * - AI only fills fields according to the locked category
 * - AI NEVER determines category
 */

import type { ProgramCategory } from './category-classifier';

export const EXTRACTOR_PROMPT_VERSIONS = {
  A: 'v1.0.0+2025-12-21',
  B: 'v1.0.0+2025-12-21',
  C: 'v1.0.0+2025-12-21',
} as const;

// ============================================
// REWARD EXTRACTION PROMPT (Category A)
// ============================================

export const REWARD_EXTRACTION_PROMPT = `
Kamu adalah FIELD EXTRACTOR untuk Reward Program iGaming.

🔒 KLASIFIKASI SUDAH DIKUNCI:
- program_classification: "A"
- program_classification_name: "Reward Program"

Ini adalah BONUS/REWARD yang user LANGSUNG dapat dari aksi (instant reward).

📋 EXTRACT FIELDS:
{
  "promo_name": "nama promo",
  "promo_type": "welcome_bonus" | "deposit_bonus" | "cashback" | "rebate" | "reload_bonus" | "other",
  "client_id": "ID client jika disebutkan" | null,
  "target_user": "new_member" | "existing_member" | "vip" | "all",
  
  "calculation_base": "deposit" | "turnover" | "loss" | "bet",
  "calculation_method": "percentage" | "fixed" | "tiered",
  "calculation_value": number | null,
  
  "minimum_base": number | null,
  "max_bonus": number | null,
  "turnover_rule": "format: NxBO atau NxDP" | null,
  "payout_direction": "balance" | "withdrawable" | null,
  
  "game_types": ["slot", "casino", "sports", ...] | null,
  "game_providers": ["pragmatic", "pgsoft", ...] | null,
  "blacklist": ["togel", ...] | null,
  
  "valid_from": "YYYY-MM-DD" | null,
  "valid_until": "YYYY-MM-DD" | null,
  "claim_method": "auto" | "manual" | "code" | null,
  
  "terms_conditions": ["syarat 1", "syarat 2", ...] | null,
  
  "has_subcategories": boolean,
  "subcategories": [
    {
      "sub_name": "nama varian",
      "calculation_value": number,
      "minimum_base": number | null,
      "max_bonus": number | null,
      "turnover_rule": number | null,
      "payout_direction": "depan" | "belakang",
      "game_types": string[],
      "game_providers": string[],
      "blacklist": { "enabled": boolean, "games": string[], "providers": string[], "rules": string[] }
    }
  ] | null
}

🚫 ATURAN:
1. Jika data tidak eksplisit → null
2. JANGAN mengarang angka
3. calculation_value harus angka, bukan string "%"
4. Jika ada tabel dengan multiple baris → has_subcategories = true

📤 OUTPUT: JSON VALID saja, tanpa markdown.
`;

// ============================================
// EVENT EXTRACTION PROMPT (Category B)
// ============================================

export const EVENT_EXTRACTION_PROMPT = `
Kamu adalah FIELD EXTRACTOR untuk Event Program iGaming.

🔒 KLASIFIKASI SUDAH DIKUNCI:
- program_classification: "B"
- program_classification_name: "Event Program"

Ini adalah EVENT/KOMPETISI berbatas waktu dengan winner/ranking/undian.

📋 EXTRACT FIELDS:
{
  "promo_name": "nama event",
  "promo_type": "lucky_draw" | "tournament" | "race" | "leaderboard" | "spin_wheel" | "level_up" | "other",
  "client_id": "ID client jika disebutkan" | null,
  "target_user": "new_member" | "existing_member" | "vip" | "all",
  
  "valid_from": "YYYY-MM-DD" | null,
  "valid_until": "YYYY-MM-DD" | null,
  "is_recurring": boolean,
  "recurrence_pattern": "daily" | "weekly" | "monthly" | null,
  
  "participation_method": "auto" | "opt_in" | "deposit" | "turnover_based",
  "qualification_rules": ["syarat 1", "syarat 2", ...] | null,
  "scoring_system": "deskripsi sistem poin/ranking" | null,
  
  "prize_pool": number | null,
  "prizes": [
    { "rank": "1", "prize": "deskripsi hadiah", "value": number | null }
  ] | null,
  "winner_count": number | null,
  "winner_selection": "highest_score" | "random_draw" | "first_come" | null,
  
  "game_types": ["slot", "casino", ...] | null,
  "game_providers": string[] | null,
  "blacklist": ["togel", ...] | null,
  
  "terms_conditions": ["syarat 1", "syarat 2", ...] | null,
  
  "has_subcategories": boolean,
  "subcategories": [] | null
}

🚫 ATURAN:
1. Jika data tidak eksplisit → null
2. JANGAN mengarang tanggal atau hadiah
3. prizes harus array of objects dengan struktur di atas
4. Event HARUS punya valid_from atau valid_until (periode)

📤 OUTPUT: JSON VALID saja, tanpa markdown.
`;

// ============================================
// POLICY EXTRACTION PROMPT (Category C)
// ============================================

export const POLICY_EXTRACTION_PROMPT = `
Kamu adalah FIELD EXTRACTOR untuk Policy Program iGaming.

🔒 KLASIFIKASI SUDAH DIKUNCI:
- program_classification: "C"
- program_classification_name: "Policy Program"

Ini adalah ATURAN/KEBIJAKAN/SISTEM, BUKAN bonus/reward langsung.

📋 EXTRACT FIELDS:
{
  "promo_name": "nama kebijakan/sistem",
  "promo_type": "deposit_policy" | "withdrawal_policy" | "loyalty_program" | "betting_restriction" | "account_policy" | "other",
  "client_id": "ID client jika disebutkan" | null,
  
  "deposit_method": "metode deposit" | null,
  "accepted_providers": ["provider 1", ...] | null,
  "minimal_deposit": number | null,
  "maximal_deposit": number | null,
  
  "usage_requirements": [
    {
      "game_category": "slot" | "casino" | "sports" | "all",
      "credit_multiplier": number | null,
      "max_bet_rule": "deskripsi" | null
    }
  ] | null,
  
  "loyalty_mechanism": {
    "point_name": "LP" | "EXP" | "XP" | null,
    "earning_rule": "contoh: 1000 TO = 1 LP" | null,
    "exchange_table": [
      { "points": number, "reward": "deskripsi" }
    ] | null,
    "tier_system": [
      { "tier_name": "Bronze", "requirement": "deskripsi" }
    ] | null
  } | null,
  
  "game_types": ["slot", "casino", ...] | null,
  "game_providers": string[] | null,
  "blacklist": ["togel", ...] | null,
  
  "prohibitions": ["larangan 1", "larangan 2", ...] | null,
  "restrictions": ["batasan 1", "batasan 2", ...] | null,
  
  "penalties": [
    {
      "type": "potongan" | "hangus" | "suspend" | "void",
      "detail": "deskripsi",
      "percentage": number | null
    }
  ] | null,
  
  "authority_clause": "kalimat otoritas operator" | null,
  "terms_can_change": boolean | null,
  
  "terms_conditions": ["syarat 1", "syarat 2", ...] | null,
  
  "has_subcategories": boolean,
  "subcategories": [] | null
}

🚫 ATURAN KERAS:
1. Jika tidak yakin field ada → SET null
2. DILARANG mengisi field reward (bonus_percentage, max_bonus, cashback_rate, dll)
3. Kata "hadiah" di exchange table = loyalty_mechanism.exchange_table, BUKAN bonus
4. Kata "deposit tanpa potongan" = BUKAN ada bonus
5. "Syarat kredit untuk WD" ≠ turnover untuk DAPAT bonus

🚫 FIELD WAJIB null (TIDAK ADA DI POLICY):
- bonus_percentage: JANGAN ISI
- reward_type: JANGAN ISI
- max_bonus: JANGAN ISI (kecuali di exchange_table reward)
- turnover_for_reward: JANGAN ISI
- calculation_value: JANGAN ISI
- cashback_rate: JANGAN ISI
- payout_direction: JANGAN ISI
- calculation_base: JANGAN ISI
- calculation_method: JANGAN ISI

📤 OUTPUT: JSON VALID saja, tanpa markdown.
`;

// ============================================
// GET PROMPT BY CATEGORY
// ============================================

export function getExtractionPrompt(category: ProgramCategory): string {
  switch (category) {
    case 'A': return REWARD_EXTRACTION_PROMPT;
    case 'B': return EVENT_EXTRACTION_PROMPT;
    case 'C': return POLICY_EXTRACTION_PROMPT;
  }
}

export function getExtractorPromptVersion(category: ProgramCategory): string {
  return EXTRACTOR_PROMPT_VERSIONS[category];
}
