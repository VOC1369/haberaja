/**
 * OpenAI Promo Extractor v4.2 — BLACKLIST PARSING FIX
 * 
 * FIXES APPLIED:
 * - Phase 1: Max Bonus & Turnover Rule prioritas TABEL (explicit)
 * - Phase 2: Confidence Assignment hierarchy yang jelas
 * - Phase 3: Smart Conflict Resolution (S&K silent = gunakan tabel)
 * - Phase 4: Blacklist Extraction Rules + PARSING FIX
 *   → "di slot: [GAMES]" = "di slot:" adalah header, [GAMES] adalah blacklist
 *   → Pisahkan games[] (nama spesifik) vs rules[] (aturan umum)
 * - Phase 5: Updated JSON Example dengan nilai explicit
 * 
 * ATURAN MUTLAK:
 * 1. Terms & Conditions = HUKUM TERTINGGI (jika ada konflik)
 * 2. TABLE = EXPLICIT source (jangan abaikan nilai tabel)
 * 3. S&K SILENT + Tabel ADA = gunakan tabel dengan "explicit"
 * 4. 7 confidence levels: explicit, explicit_from_terms, derived, unknown, ambiguous, missing, not_applicable
 */

// TEMPORARY API KEY - HAPUS SEBELUM PUBLISH
const OPENAI_API_KEY = "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";

// ============= CONFIDENCE LEVELS (EXPANDED + NOT_APPLICABLE) =============
export type ConfidenceLevel = 
  | 'explicit'           // tertulis jelas di halaman
  | 'explicit_from_terms' // dari S&K (source of truth tertinggi)
  | 'derived'            // inferensi logis ringan
  | 'unknown'            // tidak ada data
  | 'ambiguous'          // tidak jelas, butuh review
  | 'missing'            // field tidak ditemukan sama sekali
  | 'not_applicable';    // field tidak relevan untuk tipe promo ini

// Promo types yang tidak memiliki konsep turnover
export const PROMO_TYPES_WITHOUT_TURNOVER = [
  'point_reward',
  'cashback',
  'redeem',
  'merchandise',
  'loyalty_point',
  'referral'
] as const;

// ============= SUB KATEGORI (VARIAN) =============
export interface ExtractedPromoSubCategory {
  sub_name: string;
  
  // Core Calculation (WAJIB)
  calculation_base: 'deposit' | 'turnover' | 'win_loss' | 'bet_amount';
  calculation_method: 'percentage' | 'fixed';
  calculation_value: number;       // e.g., 100 (untuk 100%)
  minimum_base: number;            // e.g., 50000
  max_bonus: number | null;        // null = unlimited (explicit_from_terms)
  turnover_rule: number;           // e.g., 20 (untuk 20x)
  payout_direction: 'depan' | 'belakang';
  
  // Game Scope
  game_types: string[];            // e.g., ["slot"] or ["ALL"]
  game_providers: string[];        // e.g., ["ALL"] or ["Pragmatic Play", "PG Soft"]
  game_names: string[];
  
  // Blacklist per Sub (default behavior)
  blacklist: {
    enabled: boolean;
    providers: string[];
    games: string[];
    rules: string[];
  };
  
  // Confidence per field (WAJIB)
  confidence: {
    calculation_value: ConfidenceLevel;
    minimum_base: ConfidenceLevel;
    max_bonus: ConfidenceLevel;
    turnover_rule: ConfidenceLevel;
    payout_direction: ConfidenceLevel;
    game_types: ConfidenceLevel;
    game_providers: ConfidenceLevel;
  };
}

// ============= PARENT PROMO (PAYUNG) =============
// Parent TIDAK BOLEH punya nilai numerik (bonus, min, TO, payout)
export interface ExtractedPromo {
  // Parent Info ONLY
  promo_name: string;
  promo_type: 'combo' | 'welcome_bonus' | 'deposit_bonus' | 'cashback' | 'rollingan' | 'referral' | string;
  target_user: 'new_member' | 'all' | 'vip' | string;
  promo_mode: 'single' | 'multi';  // KRITIS: single atau multi-variant
  
  // Dates
  valid_from?: string;
  valid_until?: string;
  
  // Global blacklist — HANYA jika eksplisit "berlaku untuk semua"
  global_blacklist: {
    enabled: boolean;
    is_explicit: boolean;  // true = eksplisit tertulis, false = derived
    providers: string[];
    games: string[];
    rules: string[];
  };
  
  // Sub-categories (VARIAN)
  has_subcategories: boolean;
  subcategories: ExtractedPromoSubCategory[];
  expected_subcategory_count: number;  // Jumlah baris tabel yang terdeteksi
  
  // General terms
  terms_conditions: string[];
  claim_method?: string;
  
  // Metadata
  source_url?: string;
  raw_content?: string;
  
  // NEW: Extraction source marker for image confidence downgrade
  _extraction_source?: 'url' | 'html' | 'image';
  
  // Validation Status
  validation: {
    is_valid: boolean;
    status: 'draft' | 'draft_blocked' | 'ready';
    errors: string[];
    warnings: string[];
  };
  
  ready_to_commit: boolean;  // SELALU false sampai user confirm
}

// ============= VALIDATION =============
export interface ValidationResult {
  is_valid: boolean;
  status: 'draft' | 'draft_blocked' | 'ready';
  errors: string[];
  warnings: string[];
  can_commit: boolean;
}

const REQUIRED_SUB_FIELDS = [
  'calculation_value',
  'minimum_base', 
  'turnover_rule',
  'payout_direction'
] as const;

// Note: max_bonus is NOT in required fields because null = unlimited is valid

export function validateExtractedPromo(data: ExtractedPromo): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Rule 1: Multi-variant tapi hanya 1 sub → BLOCK
  if (data.promo_mode === 'multi' && data.subcategories.length < 2) {
    errors.push(`Promo multi-variant tapi hanya ${data.subcategories.length} sub kategori terdeteksi`);
  }
  
  // Rule 2: Mismatch jumlah sub dengan expected → BLOCK
  if (data.expected_subcategory_count > 0 && data.subcategories.length !== data.expected_subcategory_count) {
    errors.push(`Jumlah sub kategori (${data.subcategories.length}) tidak sesuai dengan baris tabel (${data.expected_subcategory_count})`);
  }
  
  // Rule 3: Check setiap sub kategori
  data.subcategories.forEach((sub, idx) => {
    const subLabel = sub.sub_name || `Sub ${idx + 1}`;
    
    // Check field wajib (excluding max_bonus and minimum_base which can be null)
    const checkFields = ['calculation_value', 'turnover_rule', 'payout_direction'] as const;
    checkFields.forEach(field => {
      const value = sub[field as keyof ExtractedPromoSubCategory];
      if (value === undefined || value === null || (typeof value === 'string' && value === '')) {
        errors.push(`${subLabel}: Field "${field}" kosong`);
      }
    });
    
    // Phase 1: Check minimum_base === max_bonus (likely extraction error)
    if (sub.minimum_base != null && sub.max_bonus != null && sub.minimum_base === sub.max_bonus) {
      warnings.push(`${subLabel}: Min Deposit (Rp ${sub.minimum_base.toLocaleString('id-ID')}) sama dengan Max Bonus — kemungkinan parsing error, perlu verifikasi manual`);
    }
    
    // Phase 5: SWAP Detection Warning - minimum_base tinggi + max_bonus null = likely swapped
    if (sub.minimum_base != null && sub.minimum_base >= 100000 && sub.max_bonus === null) {
      warnings.push(`${subLabel}: Min Deposit (Rp ${sub.minimum_base.toLocaleString('id-ID')}) tinggi tapi Max Bonus null — kemungkinan field tertukar (auto-fixed)`);
    }
    
    // Special handling for max_bonus: null is valid if confidence = explicit_from_terms
    if (sub.max_bonus === null) {
      if (sub.confidence?.max_bonus === 'explicit_from_terms') {
        // Valid - explicitly unlimited from terms, just add info
        warnings.push(`${subLabel}: Max bonus unlimited (dari S&K)`);
      } else if (sub.confidence?.max_bonus !== 'explicit') {
        warnings.push(`${subLabel}: Max bonus null tapi bukan dari S&K — perlu verifikasi`);
      }
    }
    
    // Check confidence — critical fields
    const criticalFields = ['calculation_value', 'turnover_rule', 'payout_direction'] as const;
    criticalFields.forEach(field => {
      const conf = sub.confidence?.[field];
      if (conf) {
        // explicit dan explicit_from_terms = trusted sources
        if (conf === 'explicit' || conf === 'explicit_from_terms') {
          // OK - trusted source
        } 
        // not_applicable = ALLOW (field memang tidak berlaku untuk tipe promo ini)
        else if (conf === 'not_applicable') {
          // OK - field tidak relevan (e.g., turnover untuk cashback/point_reward)
        }
        else if (conf === 'ambiguous' || conf === 'missing') {
          errors.push(`${subLabel}: Field "${field}" memiliki confidence "${conf}" — butuh review`);
        } else if (conf === 'unknown') {
          warnings.push(`${subLabel}: Field "${field}" tidak ditemukan data (unknown)`);
        } else if (conf === 'derived') {
          warnings.push(`${subLabel}: Field "${field}" adalah hasil parsing (derived)`);
        }
      }
    });
    
    // Check game_providers confidence for "ALL" special case
    if (sub.game_providers?.includes('ALL') && sub.confidence?.game_providers !== 'explicit_from_terms') {
      warnings.push(`${subLabel}: "Semua provider" sebaiknya dari S&K (explicit_from_terms)`);
    }
  });
  
  // Rule 4: Global blacklist tanpa eksplisit → warning
  if (data.global_blacklist?.enabled && !data.global_blacklist.is_explicit) {
    warnings.push('Global blacklist tidak eksplisit tertulis — mungkin seharusnya per-sub');
  }
  
  const is_valid = errors.length === 0;
  // not_applicable TIDAK dianggap ambiguous/blocking
  const hasAmbiguousCritical = data.subcategories.some(sub => {
    return ['calculation_value', 'turnover_rule', 'payout_direction'].some(
      f => {
        const conf = sub.confidence?.[f as keyof typeof sub.confidence];
        // not_applicable is OK, only ambiguous/missing blocks
        return conf === 'ambiguous' || conf === 'missing';
      }
    );
  });
  
  let status: 'draft' | 'draft_blocked' | 'ready';
  if (errors.length > 0 || hasAmbiguousCritical) {
    status = 'draft_blocked';
  } else if (warnings.length > 0) {
    status = 'draft';
  } else {
    status = 'ready';
  }
  
  return {
    is_valid,
    status,
    errors,
    warnings,
    can_commit: status === 'ready'
  };
}

// ============= EXTRACTION PROMPT v2 (SOURCE OF TRUTH HIERARCHY) =============
const EXTRACTION_PROMPT = `Kamu adalah Promo Knowledge Extractor (Pseudo Knowledge).
Tugas kamu HANYA mengekstrak dan memetakan promo ke schema Knowledge Base internal.
Kamu BUKAN pembuat promo, BUKAN penebak, dan DILARANG mengisi asumsi.

🧠 PRINSIP WAJIB (NON-NEGOTIABLE)

1️⃣ SOURCE OF TRUTH HIERARCHY (WAJIB TAAT)
Urutan kebenaran absolut:
1. Syarat & Ketentuan (Terms & Conditions) → HUKUM TERTINGGI
2. Tabel promo utama
3. Highlight / badge / banner
4. Meta / SEO / visual lain

📐 CONFLICT RESOLUTION (SMART RULES - PHASE 3 FIX)
1. S&K dan Tabel SAMA → gunakan nilai, confidence = "explicit"
2. S&K dan Tabel BERBEDA → S&K menang, confidence = "explicit_from_terms"
3. S&K SILENT, Tabel ADA → gunakan nilai tabel, confidence = "explicit"
4. Tabel SILENT, S&K ADA → gunakan S&K, confidence = "explicit_from_terms"
5. KEDUANYA SILENT → null, confidence = "unknown"

❌ JANGAN set null hanya karena S&K tidak menyebut field tersebut
✅ Null HANYA jika: explicit "unlimited" ATAU tidak ada data sama sekali

2️⃣ ANTI-HALLUCINATION RULE
❌ DILARANG:
- Menyimpulkan data yang tidak tertulis
- Mengisi default "masuk akal"
- Mengambil provider / max bonus dari visual jika S&K berbeda

Jika data tidak eksplisit:
- value = null
- confidence = "unknown"

🧩 RULE EKSTRAKSI KHUSUS (KRITIKAL)

🔹 Max Bonus — WAJIB AMBIL DARI KOLOM TABEL (PHASE 1+ FIX - CRITICAL)

ATURAN UTAMA (WAJIB):
- Untuk SETIAP row di tabel promo, kamu WAJIB extract nilai Max Bonus dari kolom yang sesuai.
- Jika cell Max Bonus di tabel berisi nilai numerik → JANGAN PERNAH set null.
- Nilai numerik di tabel = "explicit".

PETUNJUK KOLOM (umum di situs ID):
- Judul kolom bisa: "Max Bonus", "Maks Bonus", "Maksimal Bonus", "Max (Rp)", "Max Bonus (Rp)", "Max. Bonus".
- Jika di tabel tertulis "Rp 800.000" → max_bonus = 800000.

URUTAN PRIORITAS:
1) Jika TABEL menampilkan nilai numerik pada kolom Max Bonus untuk row tersebut:
   → "max_bonus": angka
   → "confidence.max_bonus": "explicit"

2) Jika S&K EKSPLISIT menyebut untuk row/varian itu "Unlimited" / "Tanpa batas" / "Tidak ada batas maksimum":
   → "max_bonus": null
   → "confidence.max_bonus": "explicit_from_terms"

3) HANYA jika tidak ada di tabel DAN tidak ada di S&K:
   → "max_bonus": null
   → "confidence.max_bonus": "unknown"

❌ JANGAN gunakan aturan S&K "unlimited" untuk semua varian jika tidak eksplisit
❌ JANGAN set null jika ada angka di tabel
✅ S&K silent + tabel ada angka = pakai angka tabel

🔹 Minimum Base (Min Deposit) — WAJIB BEDAKAN DARI MAX BONUS (SUPER CRITICAL!)

⚠️⚠️⚠️ PERBEDAAN KRITIS (HARUS DIPAHAMI):
- minimum_base = SYARAT MINIMAL deposit/turnover untuk IKUT promo (kolom "Min Deposit", "Min. DP", "Minimal Deposit")
- max_bonus = BATAS MAKSIMAL bonus yang bisa DIDAPAT (kolom "Max Bonus", "Maks Bonus")

INI DUA FIELD BERBEDA! JANGAN PERNAH TUKAR ATAU COPY!

⚠️⚠️⚠️ ANTI-SWAP RULE (SUPER CRITICAL - SERING TERJADI ERROR INI!):

PATTERN SALAH yang SERING TERJADI:
Tabel HANYA punya kolom "Max Bonus" TANPA kolom "Min Deposit"
→ AI SALAH: menaruh nilai Max Bonus ke minimum_base, lalu set max_bonus = null ❌

CONTOH TABEL (TANPA KOLOM MIN DEPOSIT):
| Bonus | Max Bonus |
| 50%   | Rp 800.000 |
| 30%   | Rp 15.000.000 |

OUTPUT SALAH (JANGAN!):
{
  "minimum_base": 800000,  ← SALAH! Ini nilai dari kolom Max Bonus!
  "max_bonus": null        ← SALAH! Harusnya 800000!
}

OUTPUT BENAR:
{
  "minimum_base": null,    ← Tidak ada kolom Min Deposit
  "max_bonus": 800000      ← Dari kolom Max Bonus
}

CHECK SEBELUM OUTPUT (WAJIB!):
1. Cari kolom dengan kata "Min" / "Minimal" / "Minimum" → ITU minimum_base
2. Cari kolom dengan kata "Max" / "Maks" / "Maksimal" → ITU max_bonus
3. Jika HANYA ada kolom Max, maka minimum_base = null!
4. JANGAN PERNAH taruh nilai Max ke field minimum_base!

⚠️⚠️⚠️ VALIDATION CHECK (WAJIB!):
Jika minimum_base == max_bonus untuk SATU varian, itu 99% PARSING ERROR!
- Biasanya minimum_base << max_bonus (JAUH lebih kecil)
- Contoh BENAR: minimum_base = 50.000, max_bonus = 1.000.000
- Contoh SALAH: minimum_base = 800.000, max_bonus = 800.000 ❌

CONTOH TABEL DENGAN KOLOM MIN DEPOSIT:
| Bonus | Min Deposit | Max Bonus |
| 100%  | Rp 50.000   | Rp 1.000.000 |
| 50%   | Rp 500.000  | Rp 800.000 |

OUTPUT BENAR:
Varian 1: "minimum_base": 50000, "max_bonus": 1000000 ✅
Varian 2: "minimum_base": 500000, "max_bonus": 800000 ✅

CONTOH TABEL TANPA KOLOM MIN DEPOSIT:
| Bonus | Max Bonus |
| 50%   | Rp 800.000 |
| 30%   | Rp 15.000.000 |

OUTPUT BENAR (NULL untuk minimum_base):
Varian 1: "minimum_base": null, "max_bonus": 800000, "confidence.minimum_base": "unknown" ✅
Varian 2: "minimum_base": null, "max_bonus": 15000000, "confidence.minimum_base": "unknown" ✅

❌❌❌ OUTPUT SALAH (JANGAN PERNAH!):
Varian 1: "minimum_base": 800000, "max_bonus": null ← SWAP ERROR!
Varian 2: "minimum_base": 15000000, "max_bonus": null ← SWAP ERROR!

PETUNJUK KOLOM minimum_base (umum di situs ID):
- "Min Deposit", "Min. DP", "Minimal Deposit", "Min Depo", "Syarat Deposit", "Minimal DP"

URUTAN PRIORITAS:
1) Jika TABEL menampilkan kolom Min Deposit dengan nilai → extract nilai tersebut
2) Jika S&K menyebut "minimal deposit Rp X" → extract nilai X
3) Jika cell Min Deposit berisi "-" atau kosong → minimum_base = null, confidence = "unknown"
4) Jika TIDAK ADA kolom Min Deposit sama sekali → minimum_base = null, confidence = "unknown"

❌❌❌ ATURAN KERAS:
- JANGAN PERNAH copy nilai max_bonus ke minimum_base!
- JANGAN PERNAH set minimum_base = max_bonus jika tidak ada data!
- Jika tidak ada data Min Deposit → SET NULL, BUKAN copy dari field lain!
- Jika minimum_base punya nilai TAPI max_bonus null → KEMUNGKINAN SWAP ERROR!


🔹 Turnover Rule — PRIORITAS TABEL (PHASE 1 FIX)
URUTAN PRIORITAS:
1. Jika TABEL menampilkan nilai turnover (e.g., "8x", "TO 10x", "20 kali"):
   → Extract nilai numerik
   → "turnover_rule": 8
   → "confidence.turnover_rule": "explicit"

2. Jika S&K menyebut nilai turnover:
   → Extract nilai dari S&K
   → "confidence.turnover_rule": "explicit_from_terms"

3. Jika S&K dan Tabel keduanya silent:
   → "turnover_rule": null
   → "confidence.turnover_rule": "unknown"

❌ JANGAN mark "derived" jika nilai tertulis di tabel
✅ Tabel dengan nilai = EXPLICIT

🔹 Game Provider
Jika S&K menyebut:
- "Semua provider slot"
- "Berlaku untuk semua provider"
- "Seluruh provider"

➡️ WAJIB:
"game_providers": ["ALL"]
"confidence.game_providers": "explicit_from_terms"

❌ Jangan override dengan daftar provider visual.
❌ Jangan list provider satu-satu jika S&K bilang "semua"

🔹 Rollingan Promo
Ciri-ciri rollingan:
- calculation_base = "turnover"
- payout_direction = "belakang"
- turnover_rule = 1 (kecuali disebut lain)

🔹 Welcome Bonus / Deposit Bonus
Ciri-ciri:
- calculation_base = "deposit"
- payout_direction = "depan" (diberikan sebelum main)
- turnover_rule = dari tabel/S&K (biasanya 5x-20x)

🚫 BLACKLIST EXTRACTION (PHASE 4 - GAME DIKECUALIKAN)

⚠️ PARSING KRITIS — PATTERN INDONESIA:
Contoh: "BONUS tidak di perbolehkan bermain di slot: HEROES, MONEY ROLL, GOLDEN BEAUTY"

PARSING BENAR:
- "di slot:" = HEADER/KATEGORI (bukan yang di-blacklist!)
- Setelah ":" = LIST GAMES yang di-blacklist
- Extract: games = ["HEROES", "MONEY ROLL", "GOLDEN BEAUTY"]

❌ SALAH: blacklist.games = ["slot"] 
✅ BENAR: blacklist.games = ["HEROES", "MONEY ROLL", "GOLDEN BEAUTY"]

PATTERN YANG HARUS DIPARSING:
1. "tidak di perbolehkan bermain di [kategori]: [GAME1], [GAME2]..."
   → [kategori] = header, [GAME1], [GAME2] = blacklisted games
   
2. "Kecuali: [GAME1], [GAME2]..."
   → Extract games setelah ":"
   
3. "Game yang tidak berlaku: [list]"
   → Extract list games
   
4. "Semua yang 3 Gambar / 3 Line / 1 Line" atau "Old game slot"
   → Ini adalah RULES, bukan nama game spesifik
   → Masukkan ke blacklist.rules[]

OUTPUT FORMAT:
"blacklist": {
  "enabled": true,
  "games": ["HEROES", "MONEY ROLL", "GOLDEN BEAUTY", "BRONCO SPIRIT", "SPACEMAN", "Master Chen's Fortune", "Prosperity Lion", "Card Games"],
  "providers": [],
  "rules": ["Semua yang 3 Gambar / 3 Line / 1 Line", "Old game slot"]
}

ATURAN PEMISAHAN:
- games[] = Nama game SPESIFIK (proper nouns, capitalized)
- providers[] = Nama provider jika disebut eksplisit dikecualikan
- rules[] = Aturan UMUM/KATEGORI (3 Line, Old game, RTP > 97%, etc.)

Jika TIDAK ADA pengecualian disebut:
"blacklist": {
  "enabled": false,
  "providers": [],
  "games": [],
  "rules": []
}

🧬 COMBO / MULTI VARIANT RULE
Jika tabel berisi >1 baris data promo:
- promo_mode = "multi"
- Setiap baris = 1 subcategory
- has_subcategories = true
- expected_subcategory_count = jumlah baris tabel

❌ Jangan digabung menjadi 1 varian
❌ Jangan disederhanakan
✅ 6 baris tabel = 6 subcategories

🧠 CONFIDENCE TAG — ATURAN ASSIGNMENT (PHASE 2 FIX - KRITIKAL!)

| Sumber Data            | Confidence Level      | Contoh                            |
|------------------------|-----------------------|-----------------------------------|
| Kolom/baris TABEL      | "explicit"            | Tabel: "Max Bonus: 1jt"           |
| Teks dalam S&K         | "explicit_from_terms" | S&K: "Maksimal bonus 1 juta"      |
| Inferensi dari konteks | "derived"             | Welcome → payout "depan" (umum)   |
| Tidak ada data         | "unknown"             | Field tidak disebut sama sekali   |
| Tidak relevan          | "not_applicable"      | Turnover untuk cashback           |
| Data tidak jelas       | "ambiguous"           | "Bonus besar" tanpa angka         |
| Field wajib kosong     | "missing"             | Kolom mandatory tidak ada         |

⚠️ KRITIS: 
- Data yang TERLIHAT di TABEL = "explicit", BUKAN "derived"
- Data yang TERLIHAT di S&K = "explicit_from_terms"
- "derived" HANYA untuk inferensi logis (BUKAN data tertulis)
- Jika tabel punya nilai, WAJIB extract dengan confidence "explicit"

🔹 TURNOVER RULE — CONTEXT AWARENESS (NOT_APPLICABLE)
Jika promo_type adalah salah satu dari:
- "point_reward"
- "cashback"
- "redeem"
- "merchandise"
- "loyalty_point"
- "referral"

DAN turnover_rule tidak ditemukan di konten:

➡️ WAJIB:
"turnover_rule": null
"confidence.turnover_rule": "not_applicable"

❌ JANGAN set "missing" atau "unknown"
✅ Promo jenis ini memang TIDAK memiliki konsep turnover

📐 FORMAT ANGKA INDONESIA (KRITIS!)
- Indonesia menggunakan TITIK sebagai pemisah ribuan
- "25.000" = 25000 (dua puluh lima ribu), BUKAN 25
- "1.000.000" = 1000000 (satu juta)
- "50.000" = 50000 (lima puluh ribu)
- JANGAN PERNAH mengartikan titik sebagai desimal dalam konteks Rupiah
- Semua nilai monetary HARUS dalam format angka bulat tanpa titik

🧾 OUTPUT FORMAT (STRICT JSON)
Output HARUS:
- Valid JSON
- TANPA komentar
- TANPA teks tambahan
- Field lengkap walau null

Return HANYA JSON valid tanpa markdown code block.

FORMAT OUTPUT (PHASE 5 - UPDATED EXAMPLE):
{
  "promo_name": "nama promo utama",
  "promo_type": "combo|welcome_bonus|deposit_bonus|cashback|rollingan|referral",
  "target_user": "new_member|all|vip",
  "promo_mode": "single|multi",
  "valid_from": "YYYY-MM-DD atau null",
  "valid_until": "YYYY-MM-DD atau null",
  "has_subcategories": true,
  "expected_subcategory_count": 6,
  "subcategories": [
    {
      "sub_name": "SLOT 100%",
      "calculation_base": "deposit",
      "calculation_method": "percentage",
      "calculation_value": 100,
      "minimum_base": 50000,
      "max_bonus": 1000000,
      "turnover_rule": 8,
      "payout_direction": "depan",
      "game_types": ["slot"],
      "game_providers": ["ALL"],
      "game_names": [],
      "blacklist": {
        "enabled": true,
        "providers": [],
        "games": ["Super Mega Win", "Old Slot 3 Line"],
        "rules": ["Game dengan RTP > 97% tidak berlaku"]
      },
      "confidence": {
        "calculation_value": "explicit",
        "minimum_base": "explicit",
        "max_bonus": "explicit",
        "turnover_rule": "explicit",
        "payout_direction": "explicit",
        "game_types": "derived",
        "game_providers": "explicit_from_terms"
      }
    }
  ],
  "global_blacklist": {
    "enabled": false,
    "is_explicit": false,
    "providers": [],
    "games": [],
    "rules": []
  },
  "terms_conditions": ["syarat dari S&K"],
  "claim_method": "cara klaim",
  "ready_to_commit": false,
  "validation": {
    "is_valid": true,
    "errors": [],
    "warnings": []
  }
}

JIKA PROMO SINGLE (tidak ada tabel multi-varian):
- promo_mode: "single"
- has_subcategories: true (tetap, dengan 1 sub)
- expected_subcategory_count: 1
- subcategories: [satu object dengan semua field]`;

// ============= IMAGE EXTRACTION WITH VISION (GPT-4o) =============

/**
 * Force confidence downgrade for image extraction
 * CRITICAL: All numeric fields from image extraction = "derived"
 */
function forceConfidenceDowngradeForImage(promo: ExtractedPromo): ExtractedPromo {
  // Mark source as image
  promo._extraction_source = 'image';
  
  // Downgrade all numeric field confidences
  if (promo.subcategories) {
    promo.subcategories = promo.subcategories.map(sub => {
      const updatedConfidence = { ...sub.confidence };
      
      // Force numeric fields to "derived" max (not "explicit")
      if (updatedConfidence.minimum_base === 'explicit') {
        updatedConfidence.minimum_base = 'derived';
      }
      if (updatedConfidence.max_bonus === 'explicit') {
        updatedConfidence.max_bonus = 'derived';
      }
      if (updatedConfidence.turnover_rule === 'explicit') {
        updatedConfidence.turnover_rule = 'derived';
      }
      if (updatedConfidence.calculation_value === 'explicit') {
        updatedConfidence.calculation_value = 'derived';
      }
      
      return { ...sub, confidence: updatedConfidence };
    });
  }
  
  return promo;
}

/**
 * Extract promo from image using GPT-4o Vision
 * 
 * CRITICAL: 
 * - Uses gpt-4o (NOT gpt-4o-mini) for vision capability
 * - All numeric confidence downgraded to "derived"
 */
export async function extractPromoFromImage(base64Image: string): Promise<ExtractedPromo> {
  if (!base64Image) {
    throw new Error("Image data tidak boleh kosong");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o", // WAJIB gpt-4o untuk vision capability
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${EXTRACTION_PROMPT}

⚠️ INSTRUKSI KHUSUS UNTUK IMAGE EXTRACTION:
Karena ini dari screenshot/image, SEMUA field numerik WAJIB menggunakan:
- confidence: "derived" (BUKAN "explicit")

Alasan: OCR dari image bisa salah baca. User akan verify via edit command jika perlu.

Kecuali jika:
- Angka sangat besar dan jelas terbaca
- Format tabel sangat clean dan high-resolution

Jika ragu, gunakan "derived" atau "unknown".

Ekstrak informasi promo dari screenshot berikut. Perhatikan tabel, angka, dan syarat & ketentuan yang terlihat.`
            },
            {
              type: "image_url",
              image_url: {
                url: base64Image,
                detail: "high" // High detail untuk baca tabel/angka kecil
              }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API Error: ${response.status}`);
  }

  const data = await response.json();
  const resultText = data.choices?.[0]?.message?.content || "";

  // Parse JSON dari response
  try {
    let cleanJson = resultText.trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
    }
    
    const parsed = JSON.parse(cleanJson) as ExtractedPromo;
    parsed.raw_content = "[Image extraction]";
    parsed.ready_to_commit = false;
    
    // Ensure defaults
    if (!parsed.global_blacklist) {
      parsed.global_blacklist = { enabled: false, is_explicit: false, providers: [], games: [], rules: [] };
    }
    if (!parsed.subcategories) {
      parsed.subcategories = [];
    }
    if (!parsed.terms_conditions) {
      parsed.terms_conditions = [];
    }
    if (parsed.expected_subcategory_count === undefined) {
      parsed.expected_subcategory_count = parsed.subcategories.length;
    }
    
    // Ensure each subcategory has blacklist and confidence
    parsed.subcategories = parsed.subcategories.map(sub => ({
      ...sub,
      blacklist: sub.blacklist || { enabled: false, providers: [], games: [], rules: [] },
      confidence: sub.confidence || {
        calculation_value: 'derived',
        minimum_base: 'derived',
        max_bonus: 'derived',
        turnover_rule: 'derived',
        payout_direction: 'derived',
        game_types: 'derived',
        game_providers: 'derived'
      }
    }));
    
    // CRITICAL: Force confidence downgrade for image source
    const downgraded = forceConfidenceDowngradeForImage(parsed);
    
    // Run validation
    const validationResult = validateExtractedPromo(downgraded);
    downgraded.validation = {
      is_valid: validationResult.is_valid,
      status: validationResult.status,
      errors: validationResult.errors,
      warnings: validationResult.warnings
    };
    
    return downgraded;
  } catch (parseError) {
    console.error("Failed to parse OpenAI Vision response:", resultText);
    throw new Error("Gagal parsing hasil ekstraksi dari image. Response bukan JSON valid.");
  }
}
export async function extractPromoFromContent(content: string, sourceUrl?: string): Promise<ExtractedPromo> {
  if (!content.trim()) {
    throw new Error("Konten tidak boleh kosong");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: `Ekstrak informasi promo dari konten berikut:\n\n${content}` }
      ],
      temperature: 0.1,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API Error: ${response.status}`);
  }

  const data = await response.json();
  const resultText = data.choices?.[0]?.message?.content || "";

  // Parse JSON dari response
  try {
    let cleanJson = resultText.trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
    }
    
    const parsed = JSON.parse(cleanJson) as ExtractedPromo;
    parsed.raw_content = content.substring(0, 1000);
    parsed.source_url = sourceUrl;
    parsed.ready_to_commit = false;
    
    // Ensure defaults
    if (!parsed.global_blacklist) {
      parsed.global_blacklist = { enabled: false, is_explicit: false, providers: [], games: [], rules: [] };
    }
    if (!parsed.subcategories) {
      parsed.subcategories = [];
    }
    if (!parsed.terms_conditions) {
      parsed.terms_conditions = [];
    }
    if (parsed.expected_subcategory_count === undefined) {
      parsed.expected_subcategory_count = parsed.subcategories.length;
    }
    
    // Phase 3: Debug logging - raw AI extraction response
    console.log("=== RAW AI EXTRACTION RESPONSE ===");
    console.log("Subcategories count:", parsed.subcategories?.length || 0);
    parsed.subcategories?.forEach((sub: any, idx: number) => {
      console.log(`Varian ${idx + 1} (${sub.sub_name}):`, {
        minimum_base: sub.minimum_base,
        max_bonus: sub.max_bonus,
        are_they_equal: sub.minimum_base != null && sub.max_bonus != null && sub.minimum_base === sub.max_bonus ? "⚠️ SAME VALUE - LIKELY ERROR" : "✅ Different"
      });
    });
    
    // Phase 4: Post-processing - auto-fix obvious extraction errors
    // Fix 1: If minimum_base === max_bonus, it's 99% a parsing error (AI copied wrong field)
    parsed.subcategories = parsed.subcategories?.map((sub: any) => {
      if (sub.minimum_base != null && sub.max_bonus != null && sub.minimum_base === sub.max_bonus) {
        console.warn(`⚠️ AUTO-FIX Varian "${sub.sub_name}": minimum_base (${sub.minimum_base}) === max_bonus — setting minimum_base to null`);
        return {
          ...sub,
          minimum_base: null,
          confidence: {
            ...sub.confidence,
            minimum_base: "unknown" as ConfidenceLevel
          }
        };
      }
      return sub;
    }) || [];
    
    // Fix 2: SWAP Detection - minimum_base has value, max_bonus is null, and minimum_base >= 100rb
    // This pattern indicates max_bonus value was wrongly placed in minimum_base
    parsed.subcategories = parsed.subcategories?.map((sub: any) => {
      const hasSuspiciousSwap = 
        sub.minimum_base !== null && 
        sub.minimum_base > 0 &&
        sub.max_bonus === null &&
        sub.minimum_base >= 100000; // Max bonus biasanya >= 100rb
      
      if (hasSuspiciousSwap) {
        console.warn(`⚠️ SWAP DETECTED "${sub.sub_name}": minimum_base=${sub.minimum_base}, max_bonus=null. Auto-swapping...`);
        return {
          ...sub,
          max_bonus: sub.minimum_base,           // Move value to max_bonus
          minimum_base: null,                     // Reset minimum_base to null
          confidence: {
            ...sub.confidence,
            max_bonus: sub.confidence?.minimum_base || 'derived', 
            minimum_base: 'unknown'               // No original data
          }
        };
      }
      return sub;
    }) || [];
    
    // Ensure each subcategory has blacklist and confidence
    parsed.subcategories = parsed.subcategories.map(sub => ({
      ...sub,
      blacklist: sub.blacklist || { enabled: false, providers: [], games: [], rules: [] },
      confidence: sub.confidence || {
        calculation_value: 'missing',
        minimum_base: 'missing',
        max_bonus: 'missing',
        turnover_rule: 'missing',
        payout_direction: 'missing',
        game_types: 'missing',
        game_providers: 'missing'
      }
    }));
    
    // Run validation
    const validationResult = validateExtractedPromo(parsed);
    parsed.validation = {
      is_valid: validationResult.is_valid,
      status: validationResult.status,
      errors: validationResult.errors,
      warnings: validationResult.warnings
    };
    
    return parsed;
  } catch (parseError) {
    console.error("Failed to parse OpenAI response:", resultText);
    throw new Error("Gagal parsing hasil ekstraksi. Response bukan JSON valid.");
  }
}

// CORS proxy fallback list
const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

// Helper untuk fetch URL via CORS proxy dengan fallback
export async function fetchUrlContent(url: string): Promise<string> {
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxyFn = CORS_PROXIES[i];
    try {
      const proxyUrl = proxyFn(url);
      console.log(`Trying CORS proxy ${i + 1}/${CORS_PROXIES.length}...`);
      
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        console.warn(`Proxy ${i + 1} returned status ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const content = data.contents || data || "";
      
      // Validasi konten adalah HTML yang valid (bukan error page)
      if (content && content.length > 500 && content.includes('<')) {
        console.log(`✅ CORS proxy ${i + 1} berhasil, content length: ${content.length}`);
        return content;
      }
      
      console.warn(`Proxy ${i + 1} returned invalid content (length: ${content.length})`);
    } catch (e) {
      console.warn(`Proxy ${i + 1} failed:`, e);
      continue;
    }
  }
  
  throw new Error("Semua CORS proxy gagal. Silakan paste konten HTML manual.");
}

// Helper untuk format currency
export function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}jt`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}rb`;
  }
  return value.toString();
}

// Helper untuk get confidence badge color (EXPANDED + NOT_APPLICABLE)
export function getConfidenceBadgeColor(confidence: ConfidenceLevel): string {
  switch (confidence) {
    case 'explicit': 
      return 'bg-success/20 text-success border-success/40';
    case 'explicit_from_terms': 
      return 'bg-emerald-600/20 text-emerald-400 border-emerald-600/40'; // Darker green = S&K source
    case 'derived': 
      return 'bg-button-hover/20 text-button-hover border-button-hover/40';
    case 'unknown': 
      return 'bg-slate-500/20 text-slate-400 border-slate-500/40'; // Gray = no data
    case 'ambiguous': 
      return 'bg-warning/20 text-warning border-warning/40';
    case 'missing': 
      return 'bg-destructive/20 text-destructive border-destructive/40';
    case 'not_applicable': 
      return 'bg-muted text-muted-foreground border-border'; // Neutral gray = field tidak relevan
    default: 
      return 'bg-muted text-muted-foreground';
  }
}

// Helper untuk format confidence label (Title Case + Indonesian for not_applicable)
export function formatConfidenceLabel(confidence: ConfidenceLevel): string {
  const labels: Record<ConfidenceLevel, string> = {
    'explicit': 'Explicit',
    'explicit_from_terms': 'From Terms',
    'derived': 'Derived',
    'unknown': 'Unknown',
    'ambiguous': 'Ambiguous',
    'missing': 'Missing',
    'not_applicable': 'Tidak Berlaku',
  };
  return labels[confidence] || confidence;
}

// Helper untuk get status badge
export function getStatusBadgeStyle(status: 'draft' | 'draft_blocked' | 'ready'): string {
  switch (status) {
    case 'ready': return 'bg-success/20 text-success border-success/40';
    case 'draft': return 'bg-warning/20 text-warning border-warning/40';
    case 'draft_blocked': return 'bg-destructive/20 text-destructive border-destructive/40';
    default: return 'bg-muted text-muted-foreground';
  }
}

export function getStatusLabel(status: 'draft' | 'draft_blocked' | 'ready'): string {
  switch (status) {
    case 'ready': return 'Ready';
    case 'draft': return 'Draft';
    case 'draft_blocked': return 'Draft Blocked';
    default: return 'Unknown';
  }
}

// ============= MAPPING TO PROMO FORM DATA =============
import type { PromoFormData, PromoSubCategory } from '@/components/VOCDashboard/PromoFormWizard/types';

/**
 * Map ExtractedPromo to PromoFormData for saving to Knowledge Base
 */
export function mapExtractedToPromoFormData(extracted: ExtractedPromo): PromoFormData {
  // Map promo type to Indonesian values
  const promoTypeMap: Record<string, string> = {
    'combo': 'Rollingan / Cashback',
    'welcome_bonus': 'Welcome Bonus',
    'deposit_bonus': 'Deposit Bonus',
    'cashback': 'Rollingan / Cashback',
    'rollingan': 'Rollingan / Cashback',
    'referral': 'Campaign / Informational',
  };

  // Map target user
  const targetUserMap: Record<string, string> = {
    'new_member': 'new_member',
    'all': 'all_users',
    'vip': 'vip_only',
  };

  // Helper to map game providers (handle "ALL" special case)
  const mapGameProviders = (providers: string[]): string[] => {
    if (providers?.includes('ALL')) {
      return ['Semua'];
    }
    return providers || [];
  };

  // Map subcategories
  const subcategories: PromoSubCategory[] = extracted.subcategories.map((sub, idx) => ({
    id: `sub_${Date.now()}_${idx}`,
    name: sub.sub_name || `Varian ${idx + 1}`,
    
    // Dasar Perhitungan
    calculation_base: sub.calculation_base || 'deposit',
    calculation_method: sub.calculation_method || 'percentage',
    calculation_value: sub.calculation_value || 0,
    minimum_base: sub.minimum_base || 0,
    minimum_base_enabled: sub.minimum_base > 0,
    turnover_rule: sub.turnover_rule ? `${sub.turnover_rule}x` : '0x',
    turnover_rule_enabled: sub.turnover_rule > 0,
    turnover_rule_custom: '',
    
    // Jenis Hadiah & Max Bonus
    jenis_hadiah_same_as_global: true,
    jenis_hadiah: 'Freechip',
    max_bonus_same_as_global: false, // Each sub has its own max
    // Handle null max_bonus = unlimited
    max_bonus: sub.max_bonus ?? 0,
    // Only use global if payout_direction is not specified
    payout_direction_same_as_global: !sub.payout_direction,
    payout_direction: sub.payout_direction === 'depan' ? 'before' : 'after',
    
    // Game whitelist (handle "ALL")
    game_types: sub.game_types?.includes('ALL') ? ['Semua'] : (sub.game_types || []),
    game_providers: mapGameProviders(sub.game_providers),
    game_names: sub.game_names || [],
    
    // Game blacklist
    game_blacklist_enabled: sub.blacklist?.enabled || false,
    game_types_blacklist: [],
    game_providers_blacklist: sub.blacklist?.providers || [],
    game_names_blacklist: sub.blacklist?.games || [],
    game_exclusion_rules: sub.blacklist?.rules || [],
    
    // Legacy fields
    dinamis_reward_type: 'Freechip',
    dinamis_reward_amount: 0,
    dinamis_max_claim: sub.max_bonus ?? 0,
    // null max_bonus = unlimited
    dinamis_max_claim_unlimited: sub.max_bonus === null,
    dinamis_min_claim: sub.minimum_base || 0,
    dinamis_min_claim_enabled: sub.minimum_base > 0,
  }));

  // Check if any subcategory has unlimited max_bonus
  const hasUnlimitedMaxBonus = extracted.subcategories.some(sub => sub.max_bonus === null);

  // Build base PromoFormData
  const promoData: PromoFormData = {
    // Step 1 - Identitas
    client_id: '',
    promo_name: extracted.promo_name || 'Promo Baru',
    promo_type: promoTypeMap[extracted.promo_type] || extracted.promo_type || 'Deposit Bonus',
    intent_category: 'bonus_claim',
    target_segment: targetUserMap[extracted.target_user] || 'all_users',
    trigger_event: 'user_request',

    // Step 2 - Reward Mode
    reward_mode: 'formula', // Dinamis mode for extracted promos
    
    // Fixed mode defaults
    reward_type: 'Freechip',
    reward_amount: 0,
    min_requirement: 0,
    max_claim: null,
    turnover_rule: '0x',
    turnover_rule_enabled: false,
    turnover_rule_custom: '',
    claim_frequency: 'sekali',
    claim_date_from: '',
    claim_date_until: '',

    // Tier mode defaults
    promo_unit: 'lp',
    exp_mode: 'level_up',
    lp_calc_method: 'fixed',
    exp_calc_method: 'fixed',
    lp_formula: '',
    exp_formula: '',
    lp_value: '',
    exp_value: '',
    tiers: [],
    fast_exp_missions: [],
    level_up_rewards: [],
    vip_multiplier: {
      enabled: false,
      min_daily_to: 0,
      tiers: [],
    },

    // Distribution
    reward_distribution: 'Langsung',
    distribution_day: '',
    distribution_time: '',
    distribution_date_from: '',
    distribution_date_until: '',
    distribution_time_enabled: false,
    distribution_time_from: '',
    distribution_time_until: '',
    distribution_day_time_enabled: false,
    custom_terms: extracted.terms_conditions?.join('; ') || '',
    special_requirements: [],

    // Dinamis mode - from first subcategory as base
    calculation_base: subcategories[0]?.calculation_base || 'deposit',
    calculation_method: subcategories[0]?.calculation_method || 'percentage',
    calculation_value: subcategories[0]?.calculation_value || 0,
    minimum_base: subcategories[0]?.minimum_base || 0,
    minimum_base_enabled: (subcategories[0]?.minimum_base || 0) > 0,
    
    dinamis_reward_type: 'Freechip',
    dinamis_reward_amount: 0,
    dinamis_max_claim: subcategories[0]?.max_bonus || 0,
    dinamis_max_claim_unlimited: hasUnlimitedMaxBonus,
    dinamis_min_claim: subcategories[0]?.minimum_base || 0,
    dinamis_min_claim_enabled: (subcategories[0]?.minimum_base || 0) > 0,
    conversion_formula: '',

    // Step 2 - Batasan & Akses
    platform_access: 'all',
    game_restriction: 'specific_game',
    game_types: subcategories[0]?.game_types || [],
    game_providers: subcategories[0]?.game_providers || [],
    game_names: subcategories[0]?.game_names || [],
    
    // Blacklist from global
    game_blacklist_enabled: extracted.global_blacklist?.enabled || false,
    game_types_blacklist: [],
    game_providers_blacklist: extracted.global_blacklist?.providers || [],
    game_names_blacklist: extracted.global_blacklist?.games || [],
    game_exclusion_rules: extracted.global_blacklist?.rules || [],
    
    valid_from: extracted.valid_from || new Date().toISOString().split('T')[0],
    valid_until: extracted.valid_until || '',
    valid_until_unlimited: !extracted.valid_until,
    status: 'draft',
    geo_restriction: '',
    require_apk: false,
    promo_risk_level: 'medium',

    // Contact Channel
    contact_channel_enabled: false,
    contact_channel: '',
    contact_link: '',

    // Global settings for subcategories
    global_jenis_hadiah_enabled: true,
    global_jenis_hadiah: 'Freechip',
    global_max_bonus_enabled: false,
    global_max_bonus: 0,
    global_payout_direction_enabled: true,
    global_payout_direction: subcategories[0]?.payout_direction === 'before' ? 'before' : 'after',

    // Subcategories
    has_subcategories: extracted.has_subcategories && subcategories.length > 1,
    subcategories: subcategories.length > 1 ? subcategories : [],

    // Step 4 - AI Templates (empty defaults)
    response_template_offer: '',
    response_template_requirement: '',
    response_template_instruction: '',
    ai_guidelines: '',
    default_behavior: '',
    completion_steps: '',
  };

  return promoData;
}
