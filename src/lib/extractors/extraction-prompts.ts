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
  B: 'v1.1.0+2025-12-24',  // Added min_deposit field
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

⚠️ CRITICAL: ROLLINGAN/CASHBACK FIELD MAPPING:
Untuk promo tipe "cashback" atau "rebate" (Rollingan):
- "Minimal turnover 1.000.000" → turnover_rule: "min 1000000" (BUKAN minimum_base!)
- "Min TO 500rb" → turnover_rule: "min 500000" (BUKAN minimum_base!)
- minimum_base = syarat DEPOSIT, turnover_rule = syarat TURNOVER/LOSE
- Rollingan/Cashback biasanya TIDAK PUNYA min deposit, hanya min turnover!

JANGAN BINGUNG:
- "Minimal deposit" → minimum_base ✅
- "Minimal turnover" → turnover_rule ✅ (BUKAN minimum_base!)
- "Syarat TO" → turnover_rule ✅

⚠️ ATURAN JENIS HADIAH (reward_type) — CRITICAL:

DEFAULT RULES berdasarkan promo_type:
┌─────────────────────────────────────────────────────────────────────────┐
│ Cashback / Rebate / Rollingan  → reward_type: "credit_game" (BUKAN "uang_tunai"!)  │
│ Welcome Bonus / Deposit Bonus  → reward_type: "credit_game"                        │
│ Freebet / Freechip             → reward_type: "credit_game"                        │
│ Referral Bonus                 → reward_type: "credit_game"                        │
│ Turnover Bonus                 → reward_type: "credit_game"                        │
└─────────────────────────────────────────────────────────────────────────┘

EXCEPTION untuk "uang_tunai":
- HANYA jika ada kata EKSPLISIT: "tarik tunai langsung", "withdraw langsung", "transfer bank"
- "Cash Prize" di tournament/event bisa = uang_tunai

⛔ JANGAN SALAH PAHAM:
- "Cashback" ≠ "Cash" (uang tunai)!
- Cashback di iGaming = bonus credit yang DIKEMBALIKAN ke saldo game
- Rebate = persentase turnover yang dikreditkan ke akun
- Rollingan = sama dengan Rebate

🎂 BIRTHDAY / SPECIAL PROMO DETECTION (CRITICAL!):

📐 FORMAT ANGKA INDONESIA (BIRTHDAY - KRITIS!):

Birthday Bonus biasanya KECIL (< Rp 500.000). HATI-HATI parsing!

CONTOH BENAR:
- "Rp 100.000,-" → cash_reward_amount: 100000 (seratus ribu)
- "Rp 50.000,-" → cash_reward_amount: 50000 (lima puluh ribu)
- "Rp 500.000" → cash_reward_amount: 500000 (lima ratus ribu)

CONTOH SALAH (JANGAN!):
- "Rp 100.000,-" → cash_reward_amount: 100000000 ❌ (itu 100 juta!)
- "Rp 50.000,-" → cash_reward_amount: 50000000 ❌ (itu 50 juta!)

ATURAN:
- TITIK = pemisah ribuan di Indonesia
- "100.000" = 100 * 1000 = 100.000 (seratus ribu)
- Birthday bonus di Indonesia TIDAK PERNAH jutaan rupiah!

⚠️ BEDAKAN "Syarat Eligibility Historis" vs "Min Deposit Promo":

SYARAT ELIGIBILITY HISTORIS (→ special_requirements, BUKAN min_deposit!):
- "Total Turnover X bulan terakhir" → special_requirements: ["Minimum turnover Rp X dalam Y bulan terakhir"]
- "Minimal bermain 3 bulan" → special_requirements: ["Sudah bermain minimal 3 bulan"]
- "Sudah deposit minimal X kali" → special_requirements: ["Sudah deposit minimal X kali"]
- "Akun terdaftar minimal 6 bulan" → special_requirements: ["Akun terdaftar minimal 6 bulan"]
- "Verifikasi KTP/SIM" → special_requirements: ["Verifikasi KTP/SIM wajib"]

MIN DEPOSIT PROMO (→ min_deposit):
- "Deposit Rp X untuk klaim bonus" → min_deposit ✅
- "Minimal deposit Rp X" (untuk aksi claim) → min_deposit ✅

PATTERN EXTRACTION:
1. "Total Turnover Minimal Rp 5.000.000 dalam 3 BULAN Terakhir"
   → special_requirements: ["Minimum turnover Rp 5.000.000 dalam 3 bulan terakhir"]
   → min_deposit: null (BUKAN 5000000!)

2. "Klaim hanya di tanggal ulang tahun"
   → special_requirements: ["Klaim hanya pada tanggal ulang tahun"]

🔄 PAYOUT SPLIT DETECTION:

Jika ada pattern "Withdraw X% sisanya TO Y":
- "Bonus bisa di Withdraw 50% dan Sisanya Dikenai Syarat TO 3X"
  → special_requirements: ["Payout 50% langsung WD, 50% dengan TO 3x"]
  → turnover_rule: "3x" (untuk bagian yang kena TO)

- "30% bisa langsung WD, 70% syarat TO 5x"
  → special_requirements: ["Payout 30% langsung WD, 70% dengan TO 5x"]

🎯 MODE DETECTION (WAJIB TENTUKAN SEBELUM MENGISI FIELDS):

mode: Tentukan berdasarkan STRUKTUR MEKANIK promo, BUKAN namanya.
  "tier"    → ada MULTIPLE level reward dengan requirement BERBEDA
              Contoh: deposit 100rb bonus 20%, deposit 500rb bonus 30%, deposit 1jt bonus 40%
  "formula" → SATU formula kalkulasi berlaku untuk semua (persentase dari basis)
              Contoh: bonus 100% dari deposit, cashback 0.8% dari turnover, komisi 30% dari net
  "fixed"   → reward FLAT tanpa kalkulasi berbasis jumlah
              Contoh: freebet Rp 50.000, birthday bonus Rp 100.000

  ⚠️ PENTING: Jika promo punya multiple level/tier → mode WAJIB "tier", BUKAN "formula"!
  ⚠️ PENTING: Jika ada 1 persentase/formula berlaku universal → mode WAJIB "formula", BUKAN "fixed"!

  tier_archetype WAJIB diisi jika mode = "tier":
  - Tier dibedakan oleh LEVEL DEPOSIT nominal → "level"
  - Tier dibedakan oleh JUMLAH DOWNLINE/REFERRAL aktif → "referral"
  - Tier dibedakan oleh JUMLAH TIM dalam parlay → "parlay"
  - Tier dibedakan oleh SALDO POIN → "point_store"
  - Tier dibedakan oleh MEMBERSHIP LEVEL (Bronze/Silver/Gold) → "level"

📋 EXTRACT FIELDS:
{
  "promo_name": "nama promo",
  "promo_type": "welcome_bonus" | "deposit_bonus" | "cashback" | "rebate" | "reload_bonus" | "other",
  "client_id": "ID client jika disebutkan" | null,
  "target_user": "new_member" | "existing_member" | "vip" | "all",

  "mode": "fixed" | "formula" | "tier",
  "tier_archetype": "level" | "referral" | "parlay" | "point_store" | null,
  
  "calculation_base": "deposit" | "turnover" | "loss" | "bet",
  "calculation_method": "percentage" | "fixed" | "tiered",
  "calculation_value": number | null,

  "conversion_formula": "Formula kalkulasi reward utama. WAJIB DIISI jika ada mechanic perhitungan. Contoh deposit bonus: 'min(deposit × 100%, 500000)'. Contoh rollingan: 'total_turnover × 0.8%'. Contoh referral: 'net_winlose_downline × komisi%'. Contoh cashback: 'total_loss × cashback%'. Gunakan string kosong '' HANYA jika promo benar-benar tidak ada mechanic kalkulasi (misal freebet flat).",

  "turnover_basis": "Basis kalkulasi turnover requirement. Wajib diisi jika turnover_enabled = true. 'bonus_only' = TO dihitung dari nilai bonus saja. 'deposit_only' = TO dihitung dari nilai deposit saja. 'deposit_plus_bonus' = TO dari deposit + bonus (paling umum). null jika tidak ada syarat TO." | null,
  
  "minimum_base": number | null,
  "max_bonus": number | null,
  "min_deposit": number | null,
  "turnover_rule": "format: NxBO/NxDP atau 'min [angka]' untuk minimal turnover" | null,
  "payout_direction": "balance" | "withdrawable" | null,
  "claim_frequency": "sekali" | "harian" | "mingguan" | "bulanan" | null,
  
  "game_types": ["sabung_ayam", "slots", "casino", "sportsbook", ...] | null,
  "eligible_providers": ["SV388", "WS168", "Pragmatic Play", ...] | [],
  "game_providers": ["pragmatic", "pgsoft", ...] | null,
  "blacklist": ["togel", ...] | null,
  
  "valid_from": "YYYY-MM-DD" | null,
  "valid_until": "YYYY-MM-DD" | null,
  "claim_method": "auto" | "manual" | "code" | null,
  
  "terms_conditions": ["syarat 1", "syarat 2", ...] | null,
  "special_requirements": ["syarat eligibility khusus", "payout split info", ...] | [],
  
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
      "reward_type": "hadiah_fisik" | "uang_tunai" | "credit_game" | "voucher" | "ticket" | "lucky_spin" | "other",
      "physical_reward_name": "nama hadiah fisik" | null,
      "physical_reward_quantity": number | null,
      "cash_reward_amount": number | null,
      "reward_quantity": number | null,
      "voucher_kind": "deposit" | "lucky_spin" | "event_entry" | "discount" | "free_play" | "other" | null,
      "voucher_valid_from": "YYYY-MM-DD" | null,
      "voucher_valid_until": "YYYY-MM-DD" | null,
      "voucher_valid_unlimited": boolean | null,
      "lucky_spin_id": "ID lucky spin" | null,
      "lucky_spin_max_per_day": number | null
    }
  ] | null
}

🎫 VOUCHER / TICKET / LUCKY SPIN DETECTION (CRITICAL!):
Jika reward adalah voucher, ticket, atau lucky spin, WAJIB extract dengan pattern:

PATTERN - VOUCHER/TICKET:
- "Dapat 5 tiket per hari" → reward_type: "ticket", reward_quantity: 5
- "Bonus 10 voucher deposit" → reward_type: "voucher", voucher_kind: "deposit", reward_quantity: 10
- "Voucher berlaku 7 hari" → voucher_valid_until: [hitung dari valid_from + 7 hari]
- "Voucher tidak ada masa kadaluwarsa" → voucher_valid_unlimited: true
- "Berlaku sampai jam 00:00" → voucher_valid_note: "Reset harian"

PATTERN - LUCKY SPIN (PRIORITAS TINGGI):
Jika nama promo mengandung "Lucky Spin", "Spin", "Free Spin", "Tiket Spin":
→ reward_type: "lucky_spin" (WAJIB!)

Pola ekstraksi WAJIB:
- "Deposit 50.000 = 1 Tiket Lucky Spin" → 
    reward_type: "lucky_spin", min_deposit: 50000, reward_quantity: 1
- "Deposit 100rb dapet 2 spin" →
    reward_type: "lucky_spin", min_deposit: 100000, reward_quantity: 2
- "Maksimal Claim 10 Tiket" → lucky_spin_max_per_day: 10
- "Max 5 spin per hari" → lucky_spin_max_per_day: 5
- "Minimal Turnover 1X" → turnover_rule: 1
- "TO 1X Untuk Withdraw" → turnover_rule: 1
- "Tidak Berlaku Kelipatan" → [set kelipatan flag to false in terms]
- "Reset harian" → voucher_valid_note: "Reset harian"

⚠️ ATURAN max_claim / lucky_spin_max_per_day (KRITIS!):
- null → jika TIDAK disebutkan batas maksimal klaim (default: tidak ada batas)
- angka POSITIF → jika ada batas eksplisit ("Maksimal 10 Tiket", "Max 5 spin per hari")
- ❌ JANGAN generate 0 — 0 bukan nilai valid, gunakan null jika tidak ada batas!

⚠️ WALAUPUN reward_type bukan uang (voucher/ticket/lucky_spin):
- lucky_spin_max_per_day = BATAS MAKSIMAL CLAIM per hari (dari "Maksimal Claim X Tiket")
- reward_quantity = JUMLAH per deposit/trigger (dari "dapet X tiket" atau "= X Tiket")
- min_deposit WAJIB diisi dari "Minimal Deposit Rp X" atau "Deposit X"
- turnover_rule WAJIB diisi dari "Minimal Turnover X" atau "TO X"

🎰 LUCKY SPIN PRIZE LIST EXTRACTION (SECTION 6 AUTO-CASCADE):
Jika promo Lucky Spin memiliki daftar hadiah/prize, WAJIB extract ke lucky_spin_rewards:

PATTERN DETECTION:
- "Grand Prize: 1 unit Honda PCX" → lucky_spin_rewards: ["1 HONDA PCX"]
- "Hadiah: iPhone 16 Pro Max, Emas 100gr" → lucky_spin_rewards: ["1 IPHONE 16 PRO MAX", "1 EMAS 100GR"]
- Table format:
  | Hadiah | Jumlah |
  | Motor Honda | 1 unit |
  | HP Samsung | 5 unit |
  → lucky_spin_rewards: ["1 MOTOR HONDA", "5 HP SAMSUNG"]

OUTPUT FORMAT untuk lucky_spin_rewards:
- Array of strings: ["QUANTITY PRODUCT_NAME", ...]
- Quantity di depan (1, 2, 5, dll)
- Nama produk UPPERCASE
- Jika tidak ada jumlah, assume 1

FIELD TAMBAHAN untuk Lucky Spin Prize:
{
  "lucky_spin_rewards": ["1 HONDA PCX", "1 IPHONE 16 PRO MAX", "3 EMAS ANTAM 10GR", "100 SALDO 50RB"] | [],
  "ticket_exchange_enabled": true,
  "ticket_exchange_mode": "lucky_spin"
}

🚫 ATURAN:
1. Jika data tidak eksplisit → null
2. JANGAN mengarang angka
3. calculation_value harus angka, bukan string "%"
4. Jika ada tabel dengan multiple baris → has_subcategories = true
5. Untuk voucher/ticket/lucky_spin, reward_quantity WAJIB diisi jika ada di teks
6. Untuk Lucky Spin dengan hadiah fisik, WAJIB isi lucky_spin_rewards

## ⚠️ KONTRAK SEMANTIC: TASK vs FLOW (TRIGGER EVENT)

RULE WAJIB:
- trigger_event = TASK = aksi pemicu PERTAMA yang membuat user ELIGIBLE
- BUKAN seluruh flow klaim atau langkah redemption
- HANYA 1 aksi, BUKAN gabungan

Contoh BENAR:
- Download APK → trigger_event: "APK Download" ✅
- Deposit 50rb → trigger_event: "Deposit" ✅
- Kekalahan → trigger_event: "Loss" ✅

Contoh SALAH:
- Download APK lalu login dan klaim → trigger_event: "Download lalu klaim" ❌

🆕 FIELD BARU v2.2 (WAJIB EXTRACT jika ada di S&K):

📸 BUKTI & KLAIM:
- proof_required: true jika S&K menyebut player WAJIB kirim bukti (screenshot, foto struk, post sosmed) sebelum klaim. false jika tidak ada syarat bukti.
- proof_type: tipe bukti yang diminta.
  'screenshot' → "kirim screenshot", "foto tangkapan layar"
  'bill_share' → "foto struk", "share bukti pembayaran"
  'social_post' → "post di sosmed", "tag kami di Instagram", "share di Facebook"
  'none' → tidak ada syarat bukti (default jika proof_required=false)
- proof_destination: ke mana bukti dikirim.
  'livechat' → "kirim ke livechat", "hubungi CS"
  'whatsapp' → "kirim ke WhatsApp", "WA ke nomor"
  'telegram' → "kirim ke Telegram"
  'facebook' → "kirim ke Facebook", "DM Facebook"
  'none' → tidak disebutkan

⛔ PENALTY:
- penalty_type: jenis hukuman jika melanggar S&K.
  null → tidak ada hukuman eksplisit, atau hanya klausa umum ("berhak membatalkan")
  'bonus_cancel' → HANYA bonus dibatalkan ("bonus akan dibatalkan", "klaim hangus")
  'full_balance_void' → SELURUH saldo dihanguskan — wajib ada kata EKSPLISIT:
    "seluruh saldo dihanguskan", "saldo akan dihanguskan", "semua saldo hangus",
    "akun diblokir dan saldo hangus", "balance akan di-void"
  JANGAN gunakan 'full_balance_void' hanya dari kata "hangus" tanpa konteks "saldo/balance"!

🔗 CLAIM URL & PLATFORM:
- claim_url: URL form klaim jika claim_method='form'. null jika tidak ada URL.
- claim_platform: platform SPESIFIK untuk klaim jika ada restriksi eksplisit.
  'livechat' | 'whatsapp' | 'telegram' | 'form' | 'apk' | 'auto' | null

🎁 ITEM FISIK:
- reward_item_description: deskripsi detail item fisik jika reward_type='merchandise' atau 'physical_item'.
  Contoh: "Kaos eksklusif berlogo brand, ukuran M/L/XL, bahan cotton combed 30s"
  null jika reward bukan item fisik.

📊 TIER DIMENSION (untuk promo dengan tiers[]):
Untuk setiap tier yang di-extract, WAJIB tentukan tier_dimension:
- Tier dibedakan oleh level membership (Bronze/Silver/Gold/dll) → 'level'
- Tier dibedakan oleh jumlah downline/referral aktif → 'downline_count'
- Tier dibedakan oleh jumlah tim dalam parlay → 'team_count'
- Tier dibedakan oleh nominal deposit → 'deposit_amount'
- Tier dibedakan oleh total turnover → 'turnover_amount'
- Tier dibedakan oleh saldo poin (LP) → 'point_balance'

⚠️ MANDATORY TIER DIMENSION RULES:
- Jika tier_archetype = "referral" → SEMUA tier WAJIB punya tier_dimension = "downline_count"
- Jika tier_archetype = "level" → SEMUA tier WAJIB punya tier_dimension = "level"
- Jika tier_archetype = "point_store" → SEMUA tier WAJIB punya tier_dimension = "point_balance"
- Jika tier_archetype = "parlay" → SEMUA tier WAJIB punya tier_dimension = "team_count"

FORMAT JSON OUTPUT untuk setiap tier object (WAJIB sertakan 3 field ini):
{
  "tier_id": "t1",
  "tier_name": "Bronze",
  "tier_order": 1,
  "requirement_value": 1,
  "reward_value": 150000,
  "reward_type": "credit_game",
  "turnover_multiplier": 3,
  "tier_dimension": "downline_count",   // enum: level|downline_count|team_count|deposit_amount|turnover_amount|point_balance
  "min_dimension_value": 1,              // nilai minimum inklusif, null jika tidak ada batas bawah
  "max_dimension_value": 4,             // nilai maximum inklusif, null jika tier tertinggi (tanpa batas atas)
  "special_conditions": []              // array string kondisi khusus, [] jika tidak ada
}

📂 SUBCATEGORY FIELDS BARU:
Untuk setiap subcategory:
- subcategory_code: kode promo khusus sub-bonus ini jika disebutkan di S&K. null jika tidak ada.
- game_exclusions: array game/provider yang dikecualikan KHUSUS untuk sub-bonus ini ([] jika tidak ada).
- conversion_formula: formula perhitungan khusus subcategory ini. WAJIB DIISI jika ada mechanic.
  Contoh: "Cashback 5% × total loss minggu ini, maks 500rb"
  "" jika tidak ada formula spesifik.

Tambahkan field-field baru ini ke output JSON di bagian yang relevan.

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

🔹 MIN DEPOSIT DETECTION (CRITICAL!):
Cari pola "Minimal Deposit Rp. XX" atau "Min Depo XX":
- "Minimal Deposit Rp. 50.000,- Untuk 1 Tiket" → min_deposit: 50000, min_deposit_note: "Untuk 1 Tiket"
- "Min Depo 25rb" → min_deposit: 25000
- "Syarat deposit minimal 100.000" → min_deposit: 100000
- "Deposit minimal Rp 10.000 untuk ikut" → min_deposit: 10000

JANGAN masukkan angka ini ke qualification_rules sebagai string!
min_deposit adalah ANGKA (number), bukan string.

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
  
  "min_deposit": number | null,
  "min_deposit_note": "catatan tambahan seperti 'Untuk 1 Tiket'" | null,
  "participation_method": "auto" | "opt_in" | "deposit" | "turnover_based",
  "qualification_rules": ["syarat 1", "syarat 2", ...] | null,
  "scoring_system": "deskripsi sistem poin/ranking" | null,
  
  "prize_pool": number | null,
  "prizes": [
    { 
      "rank": "1", 
      "prize": "deskripsi hadiah", 
      "value": number | null,
      "reward_type": "hadiah_fisik" | "uang_tunai" | "credit_game" | "voucher" | "ticket" | "lucky_spin" | "other",
      "physical_reward_name": "MITSUBISHI PAJERO SPORT 2025" | null,
      "physical_reward_quantity": 1 | null,
      "cash_reward_amount": 15000000 | null,
      "reward_quantity": number | null,
      "voucher_kind": "deposit" | "lucky_spin" | "event_entry" | "discount" | "free_play" | "other" | null,
      "voucher_valid_until": "YYYY-MM-DD" | null,
      "voucher_valid_unlimited": boolean | null,
      "lucky_spin_max_per_day": number | null
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

🎫 VOUCHER / TICKET / LUCKY SPIN DETECTION (untuk Event):
Jika hadiah event adalah voucher, ticket, atau lucky spin, WAJIB extract:

PATTERN - VOUCHER/TICKET:
- "Hadiah 5 tiket undian" → reward_type: "ticket", reward_quantity: 5
- "Hadiah voucher deposit" → reward_type: "voucher", voucher_kind: "deposit"

PATTERN - LUCKY SPIN:
- "Hadiah 10 spin gratis" → reward_type: "lucky_spin", reward_quantity: 10
- "Max 5 spin per hari" → lucky_spin_max_per_day: 5

🔹 EVENT LEVEL UP / BONUS NALEN — SPECIFIC EXTRACTION:

Untuk promo dengan keyword "Level Up", "Nalen", "Kejar Level", "Naik Level":

EXTRACT ke subcategories dengan format khusus:
{
  "subcategories": [
    {
      "sub_name": "Bronze → Silver",
      "max_bonus": 50000,
      "unlock_condition": 100000,
      "reward_type": "credit_game",
      "minimum_base": null,
      "turnover_rule": null
    }
  ]
}

ATURAN KRITIS LEVEL UP:
1. "History Deposit Rp X" → unlock_condition: X (BUKAN min_deposit!)
2. Reward value → max_bonus (langsung dapat setelah unlock)
3. minimum_base = null (tidak ada syarat deposit per klaim)
4. turnover_rule = null (tidak ada TO untuk hadiah level)

CONTOH PARSING:
Input: "Level 1 (Bronze → Silver): Rp 50.000 - Syarat: History Deposit Rp 100.000"
Output:
{
  "sub_name": "Bronze → Silver",
  "max_bonus": 50000,
  "unlock_condition": 100000,
  "reward_type": "credit_game"
}

🚫 ATURAN:
1. Jika data tidak eksplisit → null
2. JANGAN mengarang tanggal atau hadiah
3. prizes harus array of objects dengan struktur di atas
4. Event HARUS punya valid_from atau valid_until (periode)
5. Untuk voucher/ticket/lucky_spin, reward_quantity WAJIB diisi jika ada di teks
6. Untuk Level Up, unlock_condition WAJIB diisi dari "History Deposit" atau sejenisnya

📤 OUTPUT: JSON VALID saja, tanpa markdown.
`;

// ============================================
// SYSTEM RULE EXTRACTION PROMPT (Category C)
// NOTE: System Rules are NOT promos - they are informational only
// ============================================

export const POLICY_EXTRACTION_PROMPT = `
Kamu adalah FIELD EXTRACTOR untuk System Rule iGaming.

🔒 KLASIFIKASI SUDAH DIKUNCI:
- program_classification: "C"
- program_classification_name: "System Rule"

Ini adalah ATURAN/KEBIJAKAN/SISTEM, BUKAN bonus/reward langsung.
PENTING: System Rule TIDAK dapat diklaim sebagai promo.

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

🆕 FIELD BARU v2.2 (WAJIB EXTRACT untuk Policy jika ada):

⛔ PENALTY (wajib extract dari bagian "Sanksi" / "Konsekuensi"):
- penalty_type: null | 'bonus_cancel' | 'full_balance_void'
  null → hanya klausa umum tanpa detail
  'bonus_cancel' → "bonus dibatalkan", "klaim hangus"
  'full_balance_void' → "seluruh saldo dihanguskan", "saldo akan di-void", "semua saldo hangus"
  CATATAN: 'full_balance_void' WAJIB ada kata "saldo/balance" secara eksplisit!

📸 BUKTI (untuk policy dengan syarat verifikasi):
- proof_required: true jika policy mensyaratkan bukti verifikasi
- proof_type: 'screenshot' | 'bill_share' | 'social_post' | 'none'
- proof_destination: 'livechat' | 'whatsapp' | 'telegram' | 'facebook' | 'none'

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
// CANONICAL OUTPUT PROMPT (INJECTED INTO ALL PROMPTS)
// ============================================

export const CANONICAL_OUTPUT_PROMPT = `
🔒 CANONICAL OUTPUT RULES (NON-NEGOTIABLE):

1. ONLY output fields that exist in the Canonical Contract v2.1
2. ALWAYS output FULL-SHAPE JSON (every field must exist)
3. Use "", null, false, or [] for non-applicable fields
4. Ignore UI-specific prefixes (fixed_, dinamis_, global_, etc.)

❌ HARD FAIL CONDITIONS (STOP OUTPUT):
- Missing schema_version
- mode = "tier" but tiers[] empty  
- Percentage reward without max_bonus or max_bonus_unlimited
- Unknown field name appears
- Engine logic placed outside extra_config

✅ TAXONOMY RULES (LOCKED VALUES):
- category: "reward" | "event" | ""
- mode: "fixed" | "dinamis" | "tier" | ""
- tier_archetype: "level" | "point" | "network" | null

🧯 ESCAPE HATCH:
- special_conditions[] → short textual requirements
- custom_terms → FULL S&K BACKUP
- extra_config → ALL advanced / engine logic

📦 OUTPUT FORMAT: JSON only, no explanation, no markdown
`;

// ============================================
// GET PROMPT BY CATEGORY
// ============================================

export function getExtractionPrompt(category: ProgramCategory): string {
  const basePrompt = (() => {
    switch (category) {
      case 'A': return REWARD_EXTRACTION_PROMPT;
      case 'B': return EVENT_EXTRACTION_PROMPT;
      case 'C': return POLICY_EXTRACTION_PROMPT;
    }
  })();
  
  // Inject canonical output rules at the end of every prompt
  return basePrompt + '\n\n' + CANONICAL_OUTPUT_PROMPT;
}

export function getExtractorPromptVersion(category: ProgramCategory): string {
  return EXTRACTOR_PROMPT_VERSIONS[category];
}
