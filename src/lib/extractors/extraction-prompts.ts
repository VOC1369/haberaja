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

📊 ATURAN PARSE TABEL (WAJIB):
Jika source data adalah TABEL dengan format:
| NO | NAMA/ITEM/CREDIT GAME | VALUE |
|----|-----------------------|-------|
| 1  | Item Pertama          | 100   |
| 2  | Item Kedua            | 200   |

MAKA:
- sub_name = ambil dari kolom NAMA/ITEM (kolom ke-2), BUKAN dari kolom NO (kolom ke-1)
- calculation_value = ambil dari kolom VALUE (kolom ke-3)
- JANGAN PERNAH menggunakan row number "1", "2", "3" sebagai nama varian!

🔹 GAME CATEGORY & PROVIDER NAMES (CRITICAL!):

⚠️ ATURAN NAMA KATEGORI — JANGAN TRANSLATE:
- "SABUNG AYAM" → game_types: ["sabung_ayam"] (BUKAN "cockfight"!)
- "SPORTSBOOK" → game_types: ["sportsbook"] (BUKAN "sports betting"!)
- "TEMBAK IKAN" → game_types: ["tembak_ikan"] (BUKAN "fish shooting"!)
- "TOGEL" → game_types: ["togel"] (BUKAN "lottery"!)
- "ARCADE" → game_types: ["arcade"]

⚠️ EXTRACT PROVIDER NAMES dari kurung:
Jika source menyebut kategori dengan provider dalam kurung, EXTRACT KEDUANYA:

Contoh 1: "Total LOSE dari produk SABUNG AYAM (SV388 & WS168)"
Output:
- game_types: ["sabung_ayam"]
- eligible_providers: ["SV388", "WS168"]

Contoh 2: "permainan SLOT (Pragmatic Play, PG Soft, Habanero)"
Output:
- game_types: ["slots"]
- eligible_providers: ["Pragmatic Play", "PG Soft", "Habanero"]

Contoh 3: "SPORTSBOOK" (tanpa provider spesifik)
Output:
- game_types: ["sportsbook"]
- eligible_providers: []

RULES:
- Provider names = proper nouns, keep ORIGINAL casing
- Jika tidak ada provider spesifik → eligible_providers: []
- Extract SEMUA provider dalam kurung atau list

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
  
  "game_types": ["sabung_ayam", "slots", "casino", "sportsbook", ...] | null,
  "eligible_providers": ["SV388", "WS168", "Pragmatic Play", ...] | [],
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
      "eligible_providers": string[],
      "game_providers": string[],
      "blacklist": { "enabled": boolean, "games": string[], "providers": string[], "rules": string[] },
      "reward_type": "hadiah_fisik" | "uang_tunai" | "credit_game" | "voucher" | "other",
      "physical_reward_name": "nama hadiah fisik" | null,
      "physical_reward_quantity": number | null,
      "cash_reward_amount": number | null
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

📊 ATURAN PARSE TABEL (WAJIB):
Jika source data adalah TABEL dengan format:
| NO | NAMA/ITEM | VALUE |
|----|-----------| ------|
| 1  | Item A    | 100   |

MAKA:
- sub_name / rank = ambil dari kolom NAMA (kolom ke-2), BUKAN dari kolom NO
- JANGAN PERNAH menggunakan row number sebagai nama!

🔹 GAME CATEGORY & PROVIDER NAMES (CRITICAL!):

⚠️ ATURAN NAMA KATEGORI — JANGAN TRANSLATE:
- "SABUNG AYAM" → game_types: ["sabung_ayam"] (BUKAN "cockfight"!)
- "SPORTSBOOK" → game_types: ["sportsbook"] (BUKAN "sports betting"!)
- "TEMBAK IKAN" → game_types: ["tembak_ikan"] (BUKAN "fish shooting"!)
- "TOGEL" → game_types: ["togel"] (BUKAN "lottery"!)
- "ARCADE" → game_types: ["arcade"]

⚠️ EXTRACT PROVIDER NAMES dari kurung:
Contoh: "SABUNG AYAM (SV388 & WS168)" → game_types: ["sabung_ayam"], eligible_providers: ["SV388", "WS168"]
Jika tidak ada provider spesifik → eligible_providers: []

🎁 JENIS HADIAH DETECTION (CRITICAL!):

PATTERN 1 - HADIAH FISIK:
- Kata kunci: "Grand Prize", "Hadiah Utama", nama produk (mobil, motor, HP, emas, laptop)
- Contoh: "MITSUBISHI PAJERO SPORT", "EMAS ANTAM 150 Gram", "IPHONE 17 PRO MAX"
- Deteksi jumlah: "2 unit", "3 pcs", "5 buah", "x2", "x3" dll
→ reward_type: "hadiah_fisik"
→ physical_reward_name: "[NAMA PRODUK]"
→ physical_reward_quantity: [JUMLAH UNIT] atau 1 jika tidak disebutkan

PATTERN 2 - UANG TUNAI:
- Kata kunci: "Uang Tunai", "Hadiah Uang Tunai sebesar Rp", "Cash"
- Contoh: "Hadiah Uang Tunai sebesar Rp. 15.000.000,-"
→ reward_type: "uang_tunai"
→ cash_reward_amount: 15000000

PATTERN 3 - CREDIT GAME (default):
- Kata kunci: "Credit Game", "Saldo", "Bonus", angka saja tanpa konteks
→ reward_type: "credit_game"
→ value: [angka]

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
    { 
      "rank": "1", 
      "prize": "deskripsi hadiah", 
      "value": number | null,
      "reward_type": "hadiah_fisik" | "uang_tunai" | "credit_game" | "voucher" | "other",
      "physical_reward_name": "MITSUBISHI PAJERO SPORT 2025" | null,
      "physical_reward_quantity": 1 | null,
      "cash_reward_amount": 15000000 | null
    }
  ] | null,
  "winner_count": number | null,
  "winner_selection": "highest_score" | "random_draw" | "first_come" | null,
  
  "game_types": ["sabung_ayam", "slots", "casino", ...] | null,
  "eligible_providers": ["SV388", "WS168", ...] | [],
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

⚠️ REMINDER PENTING: Dokumen ini MUNGKIN memiliki MULTIPLE TABLES. 
Kamu WAJIB extract SEMUA rows dari SEMUA tables yang relevan.
Jangan berhenti setelah tabel pertama!
Total subcategories harus = jumlah SEMUA rows dari SEMUA tables yang relevan.

📋 ATURAN MULTIPLE TABLES (SANGAT PENTING):
Banyak promo memiliki LEBIH DARI SATU TABEL dalam satu halaman.
Contoh: Loyalty Point sering memiliki:
- Tabel 1: "Paket Penukaran Reguler" (hadiah kecil)
- Tabel 2: "Hadiah Utama/Eksklusif" (hadiah besar)

INSTRUKSI WAJIB:
1. SCAN seluruh dokumen untuk menemukan SEMUA tabel yang relevan
2. EXTRACT semua rows dari SETIAP tabel yang ditemukan
3. GABUNGKAN semua hasil ke dalam SATU array subcategories
4. JANGAN berhenti setelah tabel pertama!
5. JANGAN skip tabel manapun!

CONTOH BENAR:
Jika dokumen memiliki:
- Tabel 1 dengan 4 rows (CREDIT GAME 5K, 10K, 15K, 20K)
- Tabel 2 dengan 7 rows (CREDIT GAME 25K, 50K, 100K, 200K, 500K, 1M, 2.5M)

Maka subcategories HARUS berisi 11 items:
[
  { "sub_name": "CREDIT GAME 5.000", "calculation_value": 250 },
  { "sub_name": "CREDIT GAME 10.000", "calculation_value": 1000 },
  { "sub_name": "CREDIT GAME 15.000", "calculation_value": 1500 },
  { "sub_name": "CREDIT GAME 20.000", "calculation_value": 2000 },
  { "sub_name": "CREDIT GAME 25.000", "calculation_value": 25000 },
  { "sub_name": "CREDIT GAME 50.000", "calculation_value": 45000 },
  { "sub_name": "CREDIT GAME 100.000", "calculation_value": 80000 },
  { "sub_name": "CREDIT GAME 200.000", "calculation_value": 150000 },
  { "sub_name": "CREDIT GAME 500.000", "calculation_value": 450000 },
  { "sub_name": "CREDIT GAME 1.000.000", "calculation_value": 750000 },
  { "sub_name": "CREDIT GAME 2.500.000", "calculation_value": 1800000 }
]

CONTOH SALAH (JANGAN LAKUKAN INI):
- Hanya extract 4 items dari tabel pertama ❌
- Hanya extract 7 items dari tabel kedua ❌
- Berhenti di tengah-tengah ❌

📊 ATURAN PARSE TABEL (WAJIB):
Jika source data adalah TABEL dengan format:
| NO | NAMA/ITEM/CREDIT GAME | VALUE |
|----|-----------------------|-------|
| 1  | Item Pertama          | 100   |
| 2  | Item Kedua            | 200   |

MAKA:
- sub_name = ambil dari kolom NAMA/ITEM (kolom ke-2), BUKAN dari kolom NO (kolom ke-1)
- calculation_value = ambil dari kolom VALUE (kolom ke-3)
- JANGAN PERNAH menggunakan row number "1", "2", "3" sebagai nama varian!

📌 CONTOH KHUSUS untuk Loyalty Point exchange:
Dari tabel:
| NO | CREDIT GAME        | LOYALTY POINT |
|----|--------------------|---------------|
| 1  | CREDIT GAME 5.000  | 250 LP        |
| 2  | CREDIT GAME 10.000 | 1.000 LP      |

Extract ke subcategories:
[
  { "sub_name": "CREDIT GAME 5.000", "calculation_value": 250 },
  { "sub_name": "CREDIT GAME 10.000", "calculation_value": 1000 }
]
⚠️ sub_name = nama item (CREDIT GAME 5.000), BUKAN nomor baris "1"!

🔹 GAME CATEGORY & PROVIDER NAMES (CRITICAL!):

⚠️ ATURAN NAMA KATEGORI — JANGAN TRANSLATE:
- "SABUNG AYAM" → game_types: ["sabung_ayam"] (BUKAN "cockfight"!)
- "SPORTSBOOK" → game_types: ["sportsbook"] (BUKAN "sports betting"!)
- "TEMBAK IKAN" → game_types: ["tembak_ikan"] (BUKAN "fish shooting"!)
- "TOGEL" → game_types: ["togel"] (BUKAN "lottery"!)

⚠️ EXTRACT PROVIDER NAMES dari kurung:
Contoh: "SABUNG AYAM (SV388 & WS168)" → game_types: ["sabung_ayam"], eligible_providers: ["SV388", "WS168"]
Jika tidak ada provider spesifik → eligible_providers: []

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
      { 
        "points": number, 
        "reward": "deskripsi",
        "reward_type": "hadiah_fisik" | "uang_tunai" | "credit_game",
        "physical_reward_name": "nama hadiah" | null,
        "physical_reward_quantity": number | null,
        "cash_reward_amount": number | null
      }
    ] | null,
    "tier_system": [
      { "tier_name": "Bronze", "requirement": "deskripsi" }
    ] | null
  } | null,
  
  "game_types": ["sabung_ayam", "slots", "casino", ...] | null,
  "eligible_providers": ["SV388", "WS168", ...] | [],
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
