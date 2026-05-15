# Liveboard / Wolfbrain — Extractor Workflow V.10.2

**Schema:** PKB_Wolfbrain V.10.2
**Document Status:** locked (dokumen ini sudah final)
**Schema Status (`meta_engine.schema_block.status`):** candidate_locked
**Type:** Referensi Pembelajaran Internal (AI Prompt Engineer / Lovable Developer / QA)
**Tanggal:** 15 Mei 2026
**Owner:** Habe Raja (Fux), WOLFGANK
**Companion:** F1 (Doctrine + Skeleton) + F2 (Field Definitions) + F3 (Enum Registry) + F4 (Form Mapping) + Governance Rules + Supabase Data Architecture

---

## Apa Dokumen Ini?

Dokumen ini berisi **workflow extractor PKB_Wolfbrain V.10.2** — cara LLM membaca promo mentah, melakukan reasoning, dan mengisi JSON V.10.2 yang siap dipakai Liveboard + Danila.

Anggap aja ini **cetak biru kerja extractor**. AI prompt engineer baca buat tau gimana prompt LLM harus dibangun. Lovable developer baca buat tau extractor output shape + admin question flow. QA baca buat tau apa yang harus divalidasi.

> **Audience:** AI prompt engineer, Lovable developer, QA reviewer, future Wolfclaw AI maintainer.

Dokumen ini berisi **2 case study konkret** (Rollingan Slot 0.5% + Welcome Bonus Multi-Variant Rp 15.000.000) dengan promo source real, mapping JSON lengkap, pertanyaan admin yang harus muncul, dan readiness output. Tujuannya: developer punya **referensi konkret**, bukan teori abstrak.

---

## Bedanya dengan dokumen lain?

| Dokumen | Fokus | Audience |
|---------|-------|----------|
| **F1 Doctrine** | Prinsip dasar Wolfbrain | Semua orang |
| **F2 Field Definitions** | Arti tiap field di JSON | Developer + QA |
| **F3 Enum Registry** | Nilai enum yang diizinkan | Developer + extractor AI |
| **F4 Form Mapping** | JSON ↔ Form Wizard UI | Frontend dev + designer |
| **Governance Rules** | Aturan operasional + enforcement | Developer + validator |
| **Supabase Data Architecture** | Struktur tabel Supabase + flow data | Backend programmer |
| **Extractor Workflow** *(doc ini)* | Cara LLM extractor kerja + case study konkret | AI prompt engineer + Lovable dev + QA |

**Aturan hierarki kalau ada konflik:**
- Konflik tentang **field/path/structure** → **Skeleton JSON menang**, doc ini di-patch
- Konflik tentang **aturan extractor** → **Governance Rules menang**
- Konflik tentang **enum value** → **F3 menang**
- Konflik tentang **definisi field** → **F2 menang**
- Doc ini hanya **mendokumentasikan cara kerja extractor**, bukan mendefinisikan schema.

---

## Hubungan dengan Doc Lainnya

Doc ini bagian dari ekosistem **10 file V.10.2**:

```
📂 CANONICAL SCHEMA (6 files)
   ├─ PKB_Wolfbrain_V10_2_skeleton.json  (FROZEN, source of truth)
   ├─ WB_F1_Doctrine_Skeleton_V10_2.md   (prinsip dasar)
   ├─ WB_F2_Field_Definitions_V10_2.md   (definisi field)
   ├─ WB_F3_Enum_Registry_V10_2.md       (vocabulary)
   ├─ WB_F4_Form_Mapping_V10_2.md        (UI mapping)
   └─ V10_2_Governance_Rules.md          (12 governance rules)

📂 COMPANION DOCS (4 files)
   ├─ Liveboard_Supabase_Data_Architecture_V_10_2.md  (database layer)
   ├─ Liveboard_Brand_Story_V_02.md                   (investor narrative)
   ├─ Livewolf_Mental_Playbook_V_10_2.md              (personal doctrine)
   └─ Liveboard_Extractor_Workflow_V_10_2.md          ⭐ (doc ini)
```

---

# Bagian 0 — Prinsip Utama

Yang **bodoh** selama ini bukan LLM-nya dan bukan promonya. Yang bodoh adalah **arsitektur lama yang tidak percaya LLM**, lalu memaksa promo masuk ke:

```
keyword-rules
category-classifier
taxonomy lama
sanitize-by-mode
PromoFormData
mappedPreview
V.09 mapper
```

Akibatnya LLM yang harusnya cukup baca promo dan isi JSON malah diperlakukan seperti mesin keyword. Itu yang bikin sistem terlihat bodoh.

## Definisi Resmi Extractor V.10.2

**Extractor bukan rule engine. Extractor adalah:**

```
LLM reasoning engine + JSON contract
```

## Alur yang Benar

```
Promo mentah / hasil parser
→ LLM membaca dan memahami promo
→ LLM mengisi PromoKnowledgeRecord V.10.2
→ LLM menandai gap / ambiguity / contradiction
→ Admin menjawab hanya bagian yang perlu
→ JSON final siap dipakai Liveboard / Danila
```

## Alur yang Salah (Legacy)

```
LLM membaca promo
→ output LLM dipaksa ulang oleh keyword/rules/mapper lama
→ berubah jadi V.09 shape
→ UI baca legacy
→ sistem bingung sendiri
```

## Keputusan V.10.2

```
LLM dipercaya untuk reasoning.
JSON V.10.2 mengunci struktur.
Governance mengunci aturan.
Admin hanya menjawab gap nyata.
```

Parser hanya membaca dan membersihkan input. Parser tidak menafsirkan promo. Extractor yang melakukan reasoning.

---

# Bagian 1 — Tujuan Extractor

Extractor bertugas mengubah promo mentah menjadi:

```
PromoKnowledgeRecord / PKB_Wolfbrain V.10.2
```

Record ini adalah **otak promo** untuk Liveboard dan Danila.

Extractor harus menghasilkan data yang:

```
- rapi
- konsisten
- evidence-based
- sesuai enum F3
- sesuai skeleton V.10.2
- siap ditampilkan di UI
- siap ditanya ulang jika ada gap
```

---

# Bagian 2 — Bahan Kerja LLM Extractor

LLM hanya butuh 6 pegangan:

```
1. Raw promo / hasil parser
2. Skeleton JSON V.10.2
3. F2 Field Definitions
4. F3 Enum Registry
5. Governance Rules
6. Prompt extraction reasoning
```

LLM **tidak butuh** (legacy yang harus dibuang):

```
keyword-rules
category-classifier
sanitize-by-mode
taxonomy-pipeline lama
PromoFormData
mappedPreview
extractedPromo
V.09 flat shape
```

Governance dan F1 sudah jelas: no regex, no keyword matcher, no hardcoded promo-type branching, no post-processing override, no default angka palsu. Extractor wajib reasoning-first dan evidence-based.

## Input Extractor

```
1. Teks promo mentah
2. Hasil parser dari image / PDF / screenshot
3. Raw content promo
4. Client / brand context jika tersedia
```

Parser hanya bertugas membaca dan membersihkan sumber.

Parser **tidak boleh menafsirkan promo**.

```
Parser  = baca / bersihkan
Extractor = pahami / isi JSON
```

---

# Bagian 3 — Output Wajib Extractor

Output wajib:

```
PromoKnowledgeRecord / PKB_Wolfbrain V.10.2
```

Extractor **tidak boleh output**:

```
PromoFormData
extractedPromo
mappedPreview
V.09 flat shape
legacy taxonomy output
projection_engine sebagai source utama
mechanics_engine sebagai source utama
```

## Typed Engines — 23 Destination

Output extractor harus mengisi engine sesuai kebutuhan promo. PKB_Wolfbrain V.10.2 punya **26 engine total**, dimana **23 engine** adalah destination extractor (PRIMARY + OPERATIONAL).

### PRIMARY engines (21) — Sumber kebenaran resmi

```
identity_engine
classification_engine
taxonomy_engine
period_engine
time_window_engine
trigger_engine
claim_engine
proof_engine
payment_engine
scope_engine
reward_engine
ticket_engine          ⭐ NEW V.10.2
loyalty_engine
referral_engine        ⭐ NEW V.10.2
result_event_engine    ⭐ NEW V.10.2
fulfillment_engine     ⭐ NEW V.10.2
variant_engine
dependency_engine
invalidation_engine
terms_engine
risk_engine
```

### OPERATIONAL engines (2) — Metadata + lifecycle

```
readiness_engine
meta_engine
```

### AUXILIARY engines (2) — Audit only, BUKAN source of truth

```
reasoning_engine
mechanics_engine
```

### DERIVED engines (1) — Auto-generated, extractor DILARANG tulis

```
projection_engine
```

> **Catatan:** Extractor TETAP boleh isi `mechanics_engine.items[]` sebagai audit trail kerjanya. Tapi itu BUKAN source of truth — Danila skip baca, Form Wizard skip display. Per Governance G9.

---

# Bagian 4 — Aturan Kerja Extractor

## 4.1 Yang Wajib

```
- reasoning-first
- evidence-based
- context-aware
- mengisi field berdasarkan makna promo
- memakai enum dari F3
- mengikuti placement rules dari Governance
- menandai gap / ambiguity / contradiction di readiness_engine
- mengisi mechanics_engine sebagai audit trail
- record_type WAJIB diisi (`promo` / `site_policy` / `informational`) — extractor harus reason dari content evidence promo, BUKAN auto-default sembarangan. Per Governance G7, default `"promo"` HANYA dipakai untuk migration record V.10.1 lama yang gak punya field ini. Untuk extractor V.10.2 baru, record_type wajib di-determine berdasarkan source promo.
```

## 4.2 Yang Dilarang

```
- regex
- keyword matcher
- hardcoded promo-type branching
- post-processing override
- default angka palsu
- output V.09
- mapper ke PromoFormData
- menulis ke projection_engine (DERIVED only)
- treat mechanics_engine sebagai source of truth (AUXILIARY only)
- min_withdraw di reward_engine.requirement_block (DELETED V.10.2)
```

## 4.3 Prinsip Inti — Decision Logic

```
Jika evidence jelas         → isi field langsung
Jika tidak disebut          → null / "" / [] sesuai skeleton
Jika ambigu                 → ambiguity_flags[]
Jika bertentangan           → contradiction_flags[]
Jika belum punya rumah      → meta_engine.unmodeled_evidence_block (audit only)
```

## 4.4 Contoh Placement Critical

**Contoh `min_withdraw` (per Governance G3):**

```
"Minimal WD 200.000 baru bisa claim"
→ claim_engine.claim_gate_block.min_withdraw_for_claim = 200000   ✅
```

**Bukan:**

```
reward_engine.requirement_block.min_withdraw = 200000              ❌ DELETED V.10.2
```

Karena min WD adalah **syarat klaim**, bukan reward requirement.

**Untuk multi-variant promo:**

```
variant_engine.items_block.subcategories[i].claim_gate_block.min_withdraw_for_claim   ✅
```

**Untuk projection (DERIVED, read-only):**

```
projection_engine.summary_block.min_withdraw   ← auto-generated, extractor TIDAK TULIS
```

Per Governance G3 — 3-path SSOT: global, per-variant, derived projection.

---

# Bagian 5 — Cara Extractor Mengambil Keputusan

## 5.1 Jika Evidence Jelas

Isi field langsung.

Contoh:

```
"Bonus 0.5% dari turnover"
→ calculation_basis = turnover
→ calculation_method = percentage
→ calculation_value = 0.5
```

## 5.2 Jika Tidak Disebut

Isi `null`, `""`, atau `[]` sesuai skeleton. Jangan isi default palsu.

## 5.3 Jika Ambigu

Tulis ke:

```
readiness_engine.observability_block.ambiguity_flags[]
readiness_engine.validation_block.warnings[]
review_required = true
```

## 5.4 Jika Kontradiksi

Tulis ke:

```
readiness_engine.observability_block.contradiction_flags[]
review_required = true
```

Kalau kontradiksi memengaruhi kebenaran promo, status harus block/needs_review.

> **Catatan implementasi contradiction_flag:** Doc ini mengusulkan pattern struktur `{field_path, reason, evidence[], severity}` untuk contradiction items. Per F2 V.10.2 saat ini, `contradiction_flags` cuma didefinisikan sebagai "daftar" tanpa item structure. Pattern ini bersifat **suggested implementation** — formalisasi struktur + enum severity bisa di-propose untuk amendment F2/F3 di V.10.3 kalau pattern terbukti useful.

## 5.5 Jika Tidak Ada Rumah di Schema

Masuk ke:

```
meta_engine.unmodeled_evidence_block
```

Tapi ini **audit-only**, bukan source of truth, dan **bukan dibaca Form/Danila** sebagai data resmi. Per Governance G4 promotion workflow — kalau pattern muncul di 3+ records dari 2+ brands, baru evaluasi promote ke typed engine field.

---

# Bagian 6 — Readiness & Pertanyaan Admin

Extractor harus sadar kalau ada gap. Jika data kurang, ambigu, atau bertentangan, extractor menulis ke:

```
readiness_engine.validation_block.warnings[]
readiness_engine.observability_block.ambiguity_flags[]
readiness_engine.observability_block.contradiction_flags[]
readiness_engine.observability_block.review_required
```

Dari sinilah **UI pertanyaan admin lahir**.

## Flow Pertanyaan Admin

```
Extractor tidak yakin
→ sistem tanya admin
→ admin jawab
→ jawaban jadi patch JSON
→ draft record diperbarui
```

## Aturan Pertanyaan

Extractor **boleh** bertanya:

```
- Hal yang tidak eksplisit di source
- Hal yang ambigu antara 2+ interpretasi
- Hal yang kontradiktif di source
- Hal operasional yang biasanya tahu admin (jam, timezone, provider list)
```

Extractor **DILARANG** bertanya:

```
- Hal yang sudah jelas eksplisit di source
- Hal yang sudah lengkap di tabel/source
- Hal yang bisa di-infer dari context
- Hal yang sudah dijawab di pertanyaan lain
```

Kalau extractor bertanya hal yang sudah eksplisit → berarti extractor belum reasoning. Itu pertanda extractor bekerja seperti keyword bot, bukan reasoning engine.

---

# Bagian 7 — Peran Mechanics dan Projection

Per Governance G9 — Authority Layers:

```
mechanics_engine    = AUXILIARY (audit only)
projection_engine   = DERIVED (auto-generated, read-only)
typed engines       = PRIMARY (sumber kebenaran resmi)
```

## Aturan Penggunaan

**`mechanics_engine`:**
- Extractor **TETAP isi** sebagai audit trail
- Danila **TIDAK baca** sebagai data resmi
- Form Wizard **TIDAK display** ke admin
- Validator **OPTIONAL** validate (boleh skip)
- Kalau bentrok dengan typed engines → **typed engines MENANG**

**`projection_engine`:**
- Extractor **DILARANG menulis**
- Auto-generated dari typed engines post-extraction
- Read-only untuk semua konsumer
- Validator **BLOCK COMMIT** kalau extractor write detected

Typed engines menang kalau ada konflik antara typed vs auxiliary vs derived.

---

# Bagian 8 — Case Study 1: ROLLINGAN SLOT 0.5% HARIAN

## 8.1 Source Promo

```
ROLLINGAN SLOT 0.5% HARIAN
Tanggal akhir: 08-Okt-2037

Contoh Perhitungan:
Permainan: SLOT
Turnover: 1.000.000
Bonus: 0.5%
Rollingan: 5.000
Maks. Bonus: TANPA BATAS

Syarat dan Ketentuan:
1. Bonus ini hanya berlaku untuk permainan SLOT
2. Untuk mendapatkan Bonus ini, dalam SEHARI permainan minimal
   mencapai TurnOver 1.000.000 dan minimal Bonus yang didapatkan 5.000
3. Bonus Rollingan SLOT akan dibagikan SETIAP HARI
4. Tidak ada batas maksimal untuk pemberian BONUS
5. Bonus akan dibatalkan apabila adanya indikasi kecurangan dari player
6. Syarat dan Ketentuan di LAUTAN77 berlaku
```

## 8.2 Apa yang Harus Langsung Diisi Extractor

Extractor harus langsung paham (tanpa tanya admin):

```
Jenis promo: rollingan
Game scope: slot
Basis hitung: turnover
Reward: 0.5%
Minimum turnover harian: 1.000.000
Minimum bonus: 5.000
Maximum bonus: tanpa batas
Distribusi: setiap hari
Tanggal akhir: 08 Oktober 2037
Fraud/kecurangan membatalkan bonus
```

## 8.3 Mapping ke JSON V.10.2

### Identity

```json
{
  "identity_engine": {
    "client_block": {
      "client_name": "LAUTAN77"
    },
    "promo_block": {
      "promo_name": "ROLLINGAN SLOT 0.5% HARIAN",
      "promo_type": "rollingan",
      "target_user": "all_member",
      "promo_mode": "single"
    }
  }
}
```

Catatan: `rollingan`, `all_member`, `single` ada di enum F3.

### Classification

```json
{
  "classification_engine": {
    "result_block": {
      "program_classification": "A",
      "secondary_classifications": [],
      "review_confidence": "high"
    }
  }
}
```

Alasan:

```
Ini reward program (A), bukan event kompetisi (B), bukan site policy (C).
Tidak ada ranking/leaderboard/random winner.
```

### Scope

```json
{
  "scope_engine": {
    "game_block": {
      "game_domain": "slot",
      "game_types": ["slot"],
      "eligible_providers": [],
      "included_games": [],
      "excluded_games": []
    }
  }
}
```

Evidence: *"Bonus ini hanya berlaku untuk permainan SLOT"*

### Period

```json
{
  "period_engine": {
    "validity_block": {
      "valid_until": "2037-10-08",
      "valid_until_unlimited": false
    },
    "distribution_block": {
      "claim_frequency": "daily",
      "calculation_period": "daily"
    }
  }
}
```

Evidence:
- *"Tanggal akhir: 08-Okt-2037"*
- *"dibagikan SETIAP HARI"*
- *"dalam SEHARI permainan minimal mencapai TurnOver..."*

### Trigger

```json
{
  "trigger_engine": {
    "primary_trigger_block": {
      "trigger_event": "turnover_reached",
      "action": "auto_calculate",
      "evidence": "dalam SEHARI permainan minimal mencapai TurnOver 1.000.000"
    },
    "trigger_rule_block": {
      "rule_type": "threshold",
      "logic_operator": "AND",
      "conditions": [
        {
          "field": "daily_turnover",
          "operator": "greater_than_or_equal",
          "value": 1000000,
          "unit": "IDR"
        }
      ]
    }
  }
}
```

### Reward

```json
{
  "reward_engine": {
    "requirement_block": {
      "min_deposit": null,
      "unlock_conditions": [
        {
          "condition_type": "turnover",
          "basis": "daily_turnover",
          "threshold_value": 1000000,
          "threshold_unit": "IDR"
        }
      ]
    },
    "calculation_basis": "turnover",
    "calculation_method": "percentage",
    "calculation_value": 0.5,
    "calculation_unit": "percent",
    "reward_type": "bonus_credit",
    "max_reward": null,
    "max_reward_unlimited": true,
    "currency": "IDR",
    "payout_direction": "backend"
  }
}
```

Evidence:
- *"Bonus: 0.5%"*
- *"Turnover: 1.000.000"*
- *"Maks. Bonus: TANPA BATAS"*

Catatan:

```
max_reward = null
max_reward_unlimited = true
karena source eksplisit menyebut TANPA BATAS.
```

### Claim / Distribution

```json
{
  "claim_engine": {
    "method_block": {
      "claim_method": "",
      "auto_credit": false
    }
  }
}
```

Kenapa belum langsung `auto_credit = true`?

Karena source bilang *"dibagikan setiap hari"*, tetapi **tidak eksplisit** bilang otomatis masuk saldo. Extractor harus tahan diri — tanya admin, bukan asumsi.

> ⚠️ **Important note tentang `auto_credit: false`:**
>
> Nilai `false` di sini **BUKAN berarti "manual claim sudah dikonfirmasi"**. Itu cuma default state karena auto-credit belum ter-evidence di source.
>
> Yang benar: state-nya adalah **AMBIGUOUS** — bisa auto-credit, bisa manual. Extractor harus:
> 1. Set `auto_credit: false` sebagai placeholder default state
> 2. WAJIB tambahkan entry di `readiness_engine.observability_block.ambiguity_flags[]` (lihat Bagian 8.6)
> 3. WAJIB trigger pertanyaan admin (Pertanyaan 2 di Bagian 8.4)
> 4. Admin yang konfirmasi: auto-credit atau manual
>
> Tanpa ambiguity flag + admin question, `false` ini bisa salah-interpreted sebagai fakta. Itu sama saja dengan asumsi/tebakan — melanggar prinsip "NULL > tebakan".

### Invalidation

```json
{
  "invalidation_engine": {
    "void_conditions_block": [
      {
        "condition_id": "vc_fraud_001",
        "condition_type": "fraud",
        "scope": "bonus_only",
        "description": "Bonus dibatalkan apabila ada indikasi kecurangan dari player.",
        "voids_bonus": true,
        "voids_winnings": false,
        "voids_full_balance": false,
        "evidence": "Bonus akan dibatalkan apabila adanya indikasi kecurangan dari player"
      }
    ]
  }
}
```

Catatan: `void_conditions_block` di V.10.2 adalah **array langsung** (per Governance), bukan object dengan `void_conditions[]` di dalamnya.

### Terms

```json
{
  "terms_engine": {
    "conditions_block": {
      "terms_conditions": [
        "Bonus hanya berlaku untuk permainan SLOT.",
        "Minimal turnover harian 1.000.000.",
        "Minimal bonus yang didapatkan 5.000.",
        "Bonus dibagikan setiap hari.",
        "Tidak ada batas maksimal bonus.",
        "Bonus dibatalkan jika ada indikasi kecurangan.",
        "Syarat dan Ketentuan LAUTAN77 berlaku."
      ]
    }
  }
}
```

## 8.4 Pertanyaan Admin yang HARUS Muncul

Extractor hanya bertanya yang tidak eksplisit.

### Pertanyaan 1 — Jam Pembagian

```
Promo menyebut bonus dibagikan setiap hari, tapi tidak menyebut jam pembagian.
Jam pembagian bonus rollingan dilakukan pukul berapa?
```

**Target field:**
```
time_window_engine.distribution_window_block.start_time
time_window_engine.distribution_window_block.end_time
```

### Pertanyaan 2 — Auto-credit atau Manual Claim

```
Promo menyebut bonus dibagikan setiap hari, tetapi tidak menjelaskan
apakah bonus otomatis dikreditkan atau harus diklaim manual.
Apakah bonus rollingan ini otomatis masuk ke akun member?
```

**Target field:**
```
claim_engine.method_block.claim_method
claim_engine.method_block.auto_credit
```

**Pilihan admin:**
```
1. Otomatis dikreditkan
2. Klaim manual via Livechat/CS
3. Klaim manual via WhatsApp
4. Tidak disebutkan / biarkan kosong
```

### Pertanyaan 3 — Provider Slot

```
Promo hanya menyebut permainan SLOT, tetapi tidak menyebut provider tertentu.
Apakah promo berlaku untuk semua provider slot?
```

**Target field:**
```
scope_engine.game_block.eligible_providers
```

**Pilihan admin:**
```
1. Semua provider slot
2. Provider tertentu
3. Tidak disebutkan
```

### Pertanyaan 4 — Timezone

```
Promo memiliki tanggal akhir 08-Okt-2037, tetapi timezone tidak disebutkan.
Apakah tanggal akhir mengikuti WIB / Asia/Jakarta?
```

**Target field:**
```
time_window_engine.timezone_block.timezone
time_window_engine.timezone_block.offset
```

## 8.5 Pertanyaan yang TIDAK BOLEH Muncul

Extractor **tidak boleh** bertanya:

```
Apa nama promo?
Berapa persen bonus?
Permainan apa yang berlaku?
Berapa minimal turnover?
Berapa minimal bonus?
Apakah maksimal bonus ada batas?
Kapan tanggal akhir?
Apakah ini promo rollingan?
```

Karena semua sudah jelas dari source.

**Kalau pertanyaan seperti ini muncul, berarti extractor belum reasoning. Itu pertanda extractor bekerja seperti keyword bot.**

## 8.6 Readiness Output

```json
{
  "readiness_engine": {
    "validation_block": {
      "is_structurally_complete": true,
      "status": "needs_review",
      "warnings": [
        {
          "field_path": "claim_engine.method_block.auto_credit",
          "message": "Promo menyebut bonus dibagikan setiap hari, tetapi tidak eksplisit menyebut auto-credit atau manual claim."
        },
        {
          "field_path": "scope_engine.game_block.eligible_providers",
          "message": "Promo menyebut SLOT, tetapi tidak menyebut provider."
        },
        {
          "field_path": "time_window_engine.timezone_block.timezone",
          "message": "Tanggal akhir disebut, tetapi timezone tidak eksplisit."
        }
      ]
    },
    "observability_block": {
      "ambiguity_flags": [
        {
          "field_path": "claim_engine.method_block.auto_credit",
          "reason": "Distribusi harian disebut, tetapi mekanisme kredit tidak eksplisit.",
          "evidence": "Bonus Rollingan SLOT akan dibagikan SETIAP HARI"
        },
        {
          "field_path": "scope_engine.game_block.eligible_providers",
          "reason": "Game domain slot jelas, tetapi provider tidak disebut.",
          "evidence": "Bonus ini hanya berlaku untuk permainan SLOT"
        }
      ],
      "contradiction_flags": [],
      "review_required": true
    }
  }
}
```

## 8.7 Kesimpulan Case 1

```
Auto-fill: ±90%
Admin question: ±10%
Commit status: needs_review (ringan)
```

Promo ini **harusnya mudah** untuk extractor reasoning-first. Field yang masih null hanya field operasional yang memang butuh konfirmasi admin.

---

# Bagian 9 — Case Study 2: WELCOME BONUS UP TO Rp 15.000.000

## 9.1 Source Promo

```
WELCOME BONUS UP TO Rp 15.000.000
Tanggal akhir: 25-Mei-2050

Promosi hanya untuk member baru.
Klaim satu kali setelah deposit pertama.
Klaim lewat halaman Klaim Bonus.

Tabel:
1. WELCOME BONUS 50% — CASINO — Max Bonus 800.000 — TO 20x
2. WELCOME BONUS 50% — SPORTS — Max Bonus 500.000 — TO 25x
3. WELCOME BONUS 30% — SLOT — Max Bonus 15.000.000 — TO 8x
4. WELCOME BONUS 28% — CASINO — Max Bonus 10.000.000 — TO 12x
5. WELCOME BONUS 20% — SPORTS — Max Bonus 6.000.000 — TO 15x

Min deposit visual/table: Rp 50.000.

S&K:
- hanya member baru LAUTAN77
- tidak bisa digabung promo lain
- bonus diberikan khusus permainan SLOT
- ada blacklist game/provider slot
- bonus & kemenangan dibatalkan jika Bonus Hunter, Hold Freespin, Kesamaan IP
- pergantian rekening membuat semua saldo hangus
```

## 9.2 Apa yang Harus Langsung Diisi Extractor

```
Ini welcome bonus multi-variant.
Target = new_member.
Claim = sekali setelah first deposit.
Ada 5 varian berdasarkan kategori produk.
Ada table-row data untuk percent, max bonus, turnover.
Ada min deposit yang tampak sebagai rowspan.
Ada KONTRADIKSI: tabel punya Casino/Sports/Slot, tapi S&K bilang bonus khusus SLOT.
Ada blacklist yang tampaknya khusus slot.
Ada invalidation fraud dan bank-account-change.
```

## 9.3 Mapping Utama ke JSON V.10.2

### Identity

```json
{
  "identity_engine": {
    "client_block": {
      "client_name": "LAUTAN77"
    },
    "promo_block": {
      "promo_name": "WELCOME BONUS UP TO Rp 15.000.000",
      "promo_type": "welcome_bonus",
      "target_user": "new_member",
      "promo_mode": "multi"
    }
  }
}
```

### Classification

```json
{
  "classification_engine": {
    "result_block": {
      "program_classification": "A",
      "secondary_classifications": [],
      "review_confidence": "high"
    }
  }
}
```

### Period

```json
{
  "period_engine": {
    "validity_block": {
      "valid_until": "2050-05-25",
      "valid_until_unlimited": false
    },
    "distribution_block": {
      "claim_frequency": "once"
    }
  }
}
```

### Trigger

```json
{
  "trigger_engine": {
    "primary_trigger_block": {
      "trigger_event": "first_deposit",
      "action": "manual_claim",
      "evidence": "Member dapat mengklaim bonus satu kali setelah melakukan deposit pertama"
    },
    "trigger_rule_block": {
      "rule_type": "compound",
      "logic_operator": "AND",
      "conditions": [
        {
          "field": "target_user",
          "operator": "equals",
          "value": "new_member"
        },
        {
          "field": "deposit_sequence",
          "operator": "equals",
          "value": "first_deposit"
        }
      ]
    }
  }
}
```

### Claim

```json
{
  "claim_engine": {
    "method_block": {
      "claim_method": "in_app_button",
      "auto_credit": false
    },
    "claim_gate_block": {
      "requires_deposit_before_claim": true,
      "min_deposit_for_claim": 50000,
      "claim_limit_per_period": 1,
      "claim_limit_scope": "per_user"
    },
    "instruction_block": {
      "claim_steps": [
        "Masuk ke halaman Klaim Bonus",
        "Pilih promo",
        "Klik Ambil Promosi ini",
        "Harus melakukan deposit terlebih dahulu"
      ]
    }
  }
}
```

Catatan: `in_app_button`, `first_deposit`, `manual_claim`, `compound`, `per_user` sesuai enum F3.

---

# Bagian 10 — Case 2: Variant Mapping

Skeleton V.10.2 menyediakan `variant_engine.items_block.subcategories[]` untuk multi-variant promo. Setiap variant punya field seperti `variant_id`, `variant_name`, `promo_code`, `calculation_basis`, `calculation_method`, `calculation_value`, `min_deposit`, `max_reward`, `turnover_multiplier`, `game_domain`, `game_types`, provider fields, blacklist, reward type, payout direction, currency, dan lainnya.

## Variant Summary

```json
{
  "variant_engine": {
    "summary_block": {
      "has_subcategories": true,
      "expected_count": 5,
      "default_variant_id": "welcome_slot_30"
    }
  }
}
```

## Variant 1 — Casino 50%

```json
{
  "variant_id": "welcome_casino_50",
  "variant_name": "WELCOME BONUS 50% CASINO",
  "promo_code": "WELCOME BONUS 50%",
  "calculation_basis": "first_deposit",
  "calculation_method": "percentage",
  "calculation_value": 50,
  "calculation_unit": "percent",
  "min_deposit": 50000,
  "max_reward": 800000,
  "turnover_multiplier": 20,
  "turnover_rule_format": "deposit_plus_bonus",
  "game_domain": "casino",
  "game_types": ["casino_live", "casino_table"],
  "eligible_providers": [],
  "excluded_providers": ["Evolution Gaming", "Sexy Baccarat"],
  "reward_type": "bonus_credit",
  "payout_direction": "upfront",
  "currency": "IDR"
}
```

## Variant 2 — Sports 50%

```json
{
  "variant_id": "welcome_sports_50",
  "variant_name": "WELCOME BONUS 50% SPORTS",
  "promo_code": "WELCOME BONUS 50%",
  "calculation_basis": "first_deposit",
  "calculation_method": "percentage",
  "calculation_value": 50,
  "calculation_unit": "percent",
  "min_deposit": 50000,
  "max_reward": 500000,
  "turnover_multiplier": 25,
  "turnover_rule_format": "deposit_plus_bonus",
  "game_domain": "sports",
  "game_types": ["sports_match"],
  "eligible_providers": [],
  "excluded_providers": [],
  "reward_type": "bonus_credit",
  "payout_direction": "upfront",
  "currency": "IDR"
}
```

## Variant 3 — Slot 30% (DEFAULT VARIANT)

```json
{
  "variant_id": "welcome_slot_30",
  "variant_name": "WELCOME BONUS 30% SLOT",
  "promo_code": "WELCOME BONUS 30%",
  "calculation_basis": "first_deposit",
  "calculation_method": "percentage",
  "calculation_value": 30,
  "calculation_unit": "percent",
  "min_deposit": 50000,
  "max_reward": 15000000,
  "turnover_multiplier": 8,
  "turnover_rule_format": "deposit_plus_bonus",
  "game_domain": "slot",
  "game_types": ["slot"],
  "eligible_providers": [],
  "excluded_providers": ["Mega888", "Microgaming", "Playtech", "Game Play"],
  "reward_type": "bonus_credit",
  "payout_direction": "upfront",
  "currency": "IDR",
  "blacklist": {
    "enabled": true,
    "types": ["game", "provider", "game_category"],
    "providers": ["Spadegaming", "Pragmatic", "PG Soft"],
    "games": [
      "HEROES",
      "MONEY ROLL",
      "GOLDEN BEAUTY",
      "BRONCO SPIRIT",
      "CARD GAMES",
      "SPACEMAN",
      "Master Chen Fortune",
      "Prosperity Lion"
    ],
    "rules": [
      "Semua yang 3 Gambar / 3 Line / 1 Line",
      "Old game slot"
    ],
    "note": "Blacklist appears in source after SLOT-specific terms."
  }
}
```

## Variant 4 — Casino 28%

```json
{
  "variant_id": "welcome_casino_28",
  "variant_name": "WELCOME BONUS 28% CASINO",
  "promo_code": "WELCOME BONUS 28%",
  "calculation_basis": "first_deposit",
  "calculation_method": "percentage",
  "calculation_value": 28,
  "calculation_unit": "percent",
  "min_deposit": 50000,
  "max_reward": 10000000,
  "turnover_multiplier": 12,
  "turnover_rule_format": "deposit_plus_bonus",
  "game_domain": "casino",
  "game_types": ["casino_live", "casino_table"],
  "eligible_providers": [],
  "excluded_providers": ["Evolution Gaming", "Sexy Baccarat"],
  "reward_type": "bonus_credit",
  "payout_direction": "upfront",
  "currency": "IDR"
}
```

## Variant 5 — Sports 20%

```json
{
  "variant_id": "welcome_sports_20",
  "variant_name": "WELCOME BONUS 20% SPORTS",
  "promo_code": "WELCOME BONUS 20%",
  "calculation_basis": "first_deposit",
  "calculation_method": "percentage",
  "calculation_value": 20,
  "calculation_unit": "percent",
  "min_deposit": 50000,
  "max_reward": 6000000,
  "turnover_multiplier": 15,
  "turnover_rule_format": "deposit_plus_bonus",
  "game_domain": "sports",
  "game_types": ["sports_match"],
  "eligible_providers": [],
  "excluded_providers": [],
  "reward_type": "bonus_credit",
  "payout_direction": "upfront",
  "currency": "IDR"
}
```

## Catatan Provider List

```
eligible_providers = []
```

Tidak diisi `"all"` karena provider list **bukan enum "all"** di F3. Kalau source bilang "Semua Provider", itu bisa disimpan sebagai evidence/terms atau nanti ditentukan apakah perlu convention khusus. **Jangan ngarang enum provider.**

## Catatan F3 Enum Alignment

```
"game_domain": "sports"      ← scope_engine domain (valid F3)
"game_types": ["sports_match"]  ← scope_engine types (valid F3)
```

⚠️ **Important:** F3 V.10.2 membedakan dua field di scope_engine:

- `game_domain` — top-level category (`slot`, `casino`, `sports`, `sportsbook`, `togel`, `arcade`, `mixed`, `all`)
- `game_types` — granular types (`sports_match`, `sports_parlay`, `casino_live`, `casino_table`, dll)

Kata `sportsbook` ada di `game_domain` enum, tapi **TIDAK ADA** di `game_types` enum. Extractor harus reason: untuk sports variant umum pakai `game_types: ["sports_match"]`. Kalau spesifik parlay, pakai `sports_parlay`. Kombinasi keduanya boleh kalau promo cover both (`["sports_match", "sports_parlay"]`).

Bentrok antara doc/source dengan F3 enum → **F3 menang**. Per aturan hierarki.

---

# Bagian 11 — Case 2: Dependency & Invalidation

## Dependency

```json
{
  "dependency_engine": {
    "stacking_block": {
      "stacking_allowed": false,
      "stacking_policy": "Promo ini tidak dapat digabungkan dengan promo lainnya."
    }
  }
}
```

## Invalidation

```json
{
  "invalidation_engine": {
    "void_conditions_block": [
      {
        "condition_id": "vc_bonus_hunter",
        "condition_type": "fraud",
        "scope": "bonus_only",
        "description": "Bonus dan kemenangan dibatalkan jika ditemukan indikasi Bonus Hunter.",
        "voids_bonus": true,
        "voids_winnings": true,
        "voids_full_balance": false,
        "evidence": "Bonus & Kemenangan di batalkan apabila ditemukan adanya indikasi kecurangan seperti Bonus Hunter"
      },
      {
        "condition_id": "vc_hold_freespin",
        "condition_type": "behavior",
        "scope": "bonus_only",
        "description": "Bonus dan kemenangan dibatalkan jika ditemukan Hold Freespin.",
        "voids_bonus": true,
        "voids_winnings": true,
        "voids_full_balance": false,
        "evidence": "Hold Freespin"
      },
      {
        "condition_id": "vc_same_ip",
        "condition_type": "fraud",
        "scope": "account_wide",
        "description": "Bonus dan kemenangan dibatalkan jika ditemukan kesamaan IP.",
        "voids_bonus": true,
        "voids_winnings": true,
        "voids_full_balance": false,
        "evidence": "Kesamaan IP"
      },
      {
        "condition_id": "vc_bank_account_change",
        "condition_type": "eligibility",
        "scope": "full_balance",
        "description": "Jika terjadi pergantian rekening maka semua saldo dihanguskan.",
        "voids_bonus": true,
        "voids_winnings": true,
        "voids_full_balance": true,
        "evidence": "Jika terjadi pergantian rekening maka semua saldo akan kami hanguskan"
      }
    ]
  }
}
```

Catatan: `fraud`, `behavior`, `eligibility`, `bonus_only`, `account_wide`, `full_balance` harus mengikuti F3 invalidation enum. Kalau nilai spesifik tidak ada di F3, jangan asal pakai: isi `description`/`evidence` dan flag enum gap.

---

# Bagian 12 — Case 2: Kontradiksi WAJIB Ditandai

Kontradiksi utama:

```
Tabel menyebut varian Casino, Sports, Slot.
S&K nomor 3 menyebut: "Bonus diberikan khusus permainan SLOT."
```

Extractor **TIDAK BOLEH diam**.

```json
{
  "readiness_engine": {
    "observability_block": {
      "contradiction_flags": [
        {
          "field_path": "variant_engine.items_block.subcategories",
          "reason": "Tabel promo mencantumkan varian Casino, Sports, dan Slot, tetapi S&K menyatakan bonus diberikan khusus permainan SLOT.",
          "evidence": [
            "Tabel berisi kategori CASINO, SPORTS, SLOT",
            "Bonus diberikan khusus permainan SLOT"
          ],
          "severity": "block_commit"
        }
      ],
      "review_required": true
    }
  }
}
```

Ini bukan ambiguity kecil. Ini **blocker** karena memengaruhi validitas varian.

> ⚠️ **Important note tentang `severity: "block_commit"`:**
>
> **Field `severity` ini adalah SUGGESTED PATTERN, BUKAN canonical V.10.2.**
>
> Per F2 V.10.2 saat ini, `contradiction_flags` cuma didefinisikan sebagai "daftar" tanpa item-level structure. Field `severity` dengan nilai `"block_commit"` adalah usulan dari doc ini untuk granularity (info / warning / block_commit). Formal extension ke F2 + F3 enum bisa di-propose untuk amendment V.10.3.
>
> **Yang penting untuk extractor V.10.2 sekarang:**
>
> **Presence of contradiction_flags entry = BLOCKER itself.**
>
> Artinya: kalau extractor menulis ke `contradiction_flags[]`, validator sudah harus treat itu sebagai block_commit secara default — gak peduli ada field `severity` atau tidak. Field `severity` cuma annotation tambahan untuk admin reviewer supaya tahu tingkat keparahan.
>
> Validator runtime V.10.2: **`contradiction_flags.length > 0` → review_required = true → block publish gate sampai admin resolve.**

---

# Bagian 13 — Case 2: Pertanyaan Admin yang HARUS Muncul

## Pertanyaan 1 — Kontradiksi Produk (CRITICAL)

```
Tabel promo mencantumkan varian Casino, Sports, dan Slot,
tetapi S&K menyatakan bonus diberikan khusus permainan SLOT.

Mana yang benar?
```

**Pilihan:**

```
1. Semua varian di tabel valid: Casino, Sports, Slot.
2. Hanya Slot yang valid; Casino dan Sports harus diabaikan.
3. Casino/Sports valid, tetapi S&K nomor 3 salah tulis.
4. Jelaskan manual.
```

**Target:**

```
variant_engine.items_block.subcategories
readiness_engine.observability_block.contradiction_flags
```

## Pertanyaan 2 — Min Deposit Table Rowspan

```
Nilai Min Deposit Rp 50.000 tampak berlaku untuk semua baris di tabel.

Apakah min deposit Rp 50.000 berlaku untuk semua varian bonus?
```

**Target:**

```
variant_engine.items_block.subcategories[].min_deposit
```

## Pertanyaan 3 — Blacklist Slot

```
Daftar game/provider yang dilarang muncul setelah bagian SLOT.

Apakah blacklist tersebut hanya berlaku untuk varian SLOT?
```

**Target:**

```
variant_engine.items_block.subcategories[slot].blacklist
scope_engine.blacklist_block
```

## Pertanyaan 4 — Timezone

```
Tanggal akhir 25-Mei-2050 disebut, tetapi timezone tidak disebut.

Apakah timezone mengikuti WIB / Asia/Jakarta?
```

**Target:**

```
time_window_engine.timezone_block.timezone
time_window_engine.timezone_block.offset
```

---

# Bagian 14 — Case 2: Yang TIDAK Perlu Ditanya

Extractor **tidak boleh** bertanya:

```
Nama promo apa?
Untuk member baru atau bukan?
Ada berapa varian?
Bonus percent berapa?
Max bonus berapa?
Turnover berapa?
Cara klaim ada atau tidak?
Bisa digabung promo lain atau tidak?
```

Semua sudah ada di source.

---

# Bagian 15 — Case 2: Readiness Output

```json
{
  "readiness_engine": {
    "validation_block": {
      "is_structurally_complete": true,
      "status": "needs_review",
      "warnings": [
        {
          "field_path": "variant_engine.items_block.subcategories[].min_deposit",
          "message": "Min Deposit Rp 50.000 terlihat sebagai rowspan untuk semua varian; perlu konfirmasi jika OCR/text parser kehilangan struktur tabel."
        },
        {
          "field_path": "variant_engine.items_block.subcategories[slot].blacklist",
          "message": "Blacklist provider/game tampaknya khusus slot, tetapi perlu konfirmasi placement."
        }
      ]
    },
    "observability_block": {
      "ambiguity_flags": [
        {
          "field_path": "variant_engine.items_block.subcategories[].min_deposit",
          "reason": "Tabel visual menunjukkan Min Deposit Rp 50.000 sebagai rowspan, tetapi text extraction bisa kehilangan struktur."
        },
        {
          "field_path": "time_window_engine.timezone_block.timezone",
          "reason": "Tanggal akhir disebut, timezone tidak eksplisit."
        }
      ],
      "contradiction_flags": [
        {
          "field_path": "variant_engine.items_block.subcategories",
          "reason": "Tabel mencantumkan Casino/Sports/Slot, tetapi S&K menyatakan bonus khusus SLOT.",
          "severity": "block_commit"
        }
      ],
      "review_required": true
    }
  }
}
```

## Kesimpulan Case 2

```
Auto-fill: ±80%
Admin question: ±20%
Commit status: BLOCK / needs_review sampai kontradiksi SLOT vs Casino/Sports dijawab.
```

---

# Bagian 16 — Final Extraction Flow

```
1. User paste promo
2. Parser membaca / membersihkan input
3. LLM extractor membaca raw promo + 6 bahan kerja V.10.2
4. LLM mengisi typed engines (21 PRIMARY + 2 OPERATIONAL)
5. LLM mengisi mechanics_engine sebagai audit trail (AUXILIARY)
6. LLM menandai gap / ambiguity / contradiction di readiness_engine
7. Admin menjawab hanya bagian yang perlu (via Admin Verify / Question UI)
8. Jawaban admin menjadi patch JSON
9. canPublish gate validation (G3, G5, G7, G11, projection write-protection)
10. projection_engine auto-generated (DERIVED, post-validation)
11. PromoKnowledgeRecord V.10.2 final
12. Publish to Supabase promo_knowledge table
```

---

# Bagian 17 — Legacy yang Harus Dibuang

Berikut artefak legacy yang **tidak boleh** dipakai lagi di jalur extractor V.10.2:

```
keyword-rules
category-classifier
sanitize-by-mode
promo-taxonomy lama
taxonomy-pipeline lama
mapExtractedToPromoFormData
PromoFormData
extractedPromo
mappedPreview
V.09 shape
```

Legacy ini membuat LLM tidak lagi bekerja sebagai reasoning engine.

Legacy membuat sistem bertanya pertanyaan salah:

```
"Ini keyword apa?"
"Ini kategori lama apa?"
"Ini harus dimap ke PromoFormData apa?"
"Ini masuk mappedPreview apa?"
```

Padahal pertanyaan yang benar hanya:

```
"Apa isi promo ini?"
"Field V.10.2 mana yang sesuai?"
"Apa evidence-nya?"
"Apa yang belum jelas?"
```

---

# Bagian 18 — Validator Rules untuk Extractor Output

Per Governance Rules V.10.2 — validator WAJIB cek setiap output extractor:

```
G3 — min_withdraw forbidden path:
  IF record.reward_engine.requirement_block.min_withdraw exists:
    BLOCK COMMIT — field DELETED V.10.2

G5 — Reward block anti-overlap:
  IF count(reward_block.enabled = true) > 1:
    BLOCK COMMIT — hanya 1 reward block utama per promo

G7 — record_type required:
  IF record.meta_engine.schema_block.record_type missing OR empty:
    BLOCK COMMIT — wajib diisi promo/site_policy/informational

G11 — No regex pattern:
  IF extractor session flagged SUSPICIOUS pattern (regex-like extraction):
    WARN admin — manual review recommended

Projection write-protection:
  IF extractor write detected di projection_engine paths:
    BLOCK COMMIT — projection_engine DERIVED ONLY
```

---

# Bagian 19 — Final Rule

```
Extractor tidak boleh menjadi template bot.
Extractor tidak boleh menjadi keyword bot.
Extractor tidak boleh menjadi mapper ke form lama.

Extractor harus membaca promo,
memahami makna promo,
mengisi JSON V.10.2,
dan menandai gap yang benar-benar perlu admin.
```

## Kalimat Final

```
Promo tidak dipaksa masuk rule lama.
Promo dibaca oleh LLM.
Hasilnya dikunci oleh JSON V.10.2.
Admin hanya menyelesaikan ketidakpastian.
```

---

# Changelog

## V.0.1 (15 Mei 2026) — Minor Wording + Enum Alignment Patch

**Type:** Patch — wording + enum alignment, no doctrine change
**Status:** Document locked / Schema candidate_locked
**Approved by:** Habe Raja (Fux), WOLFGANK

**5 patches applied (per Fux post-audit feedback):**

### Patch 1 — Form Wizard → Admin Verify / Question UI
- Bagian 16 step 7: ganti "via Form Wizard" → "via Admin Verify / Question UI"
- Reason: Form Wizard adalah UI publish, Admin Verify adalah UI gap-resolution. Step 7 spesifik di Admin Verify flow, bukan publish flow.

### Patch 2 — record_type clarification (G7 strict reading)
- Bagian 4.1: re-word `record_type` requirement
- Reason: Doc V.0 bilang "default `promo` per Governance G7" — tapi G7 specify default `"promo"` HANYA untuk migration V.10.1 records, bukan auto-default untuk extractor baru. Extractor V.10.2 wajib reason `record_type` dari source evidence.

### Patch 3 — F3 game_types enum alignment
- Variant 2 (Sports 50%) + Variant 5 (Sports 20%): `game_types: ["sportsbook"]` → `["sports_match"]`
- Reason: `sportsbook` valid di `game_domain` enum F3, TAPI **TIDAK valid di `game_types` enum F3**. F3 `game_types` punya `sports_match`, `sports_parlay`. Doc lo invent enum yang gak ada — fix per F3 canonical.
- Plus: tambah catatan "F3 Enum Alignment" di Bagian 10 jelasin perbedaan `game_domain` vs `game_types`.

### Patch 4 — auto_credit false ambiguity clarification
- Bagian 8.3 Claim/Distribution: tambah important note tentang `auto_credit: false`
- Reason: Nilai `false` bisa salah-interpreted sebagai "manual claim sudah dikonfirmasi". Yang benar: state AMBIGUOUS — wajib ada entry di `ambiguity_flags[]` + admin question. Tanpa flag, `false` = asumsi/tebakan (melanggar prinsip "NULL > tebakan").

### Patch 5 — severity block_commit as suggested pattern
- Bagian 12: tambah important note tentang `severity: "block_commit"`
- Reason: Field `severity` ini SUGGESTED PATTERN, bukan F2/F3 canonical. Per V.10.2, **presence of contradiction_flags entry itu sendiri sudah blocker** — gak peduli ada `severity` atau tidak. Validator rule: `contradiction_flags.length > 0 → block publish gate`.

**Files NOT touched:**
- Skeleton (FROZEN)
- F1 / F2 / F3 / F4 / Governance Rules
- Other companion docs (Supabase / Brand Story / Mental Playbook)

**Files touched:** Only this doc (Liveboard_Extractor_Workflow_V_10_2.md)

---

## V.0 (15 Mei 2026) — Initial Lock

**Type:** New document — first formal version
**Status:** Document locked / Schema candidate_locked
**Strategy:** Doctrine + 2 case study (Rollingan Slot + Welcome Bonus Multi-Variant)

**Konten:**

### A. Doctrine (Bagian 0-7)
- Prinsip "Extractor = LLM reasoning + JSON contract"
- 6 bahan kerja LLM
- 23 typed engine destination (21 PRIMARY + 2 OPERATIONAL)
- Aturan wajib + dilarang
- 5 decision logic patterns (evidence jelas / tidak disebut / ambigu / kontradiksi / tidak ada rumah)
- Mechanics + projection authority layer

### B. Case Study 1 — Rollingan Slot 0.5% Harian (Bagian 8)
- Simple promo, single variant
- ±90% auto-fill, ±10% admin question
- 4 pertanyaan admin valid (jam, auto-credit, provider, timezone)
- 7 pertanyaan TIDAK BOLEH muncul (sudah eksplisit di source)
- Status: needs_review (ringan)

### C. Case Study 2 — Welcome Bonus Multi-Variant Rp 15.000.000 (Bagian 9-15)
- Complex multi-variant (5 varian)
- ±80% auto-fill, ±20% admin question
- Kontradiksi BLOCK COMMIT (tabel vs S&K)
- 4 pertanyaan admin valid (kontradiksi produk, rowspan, blacklist, timezone)
- 8 pertanyaan TIDAK BOLEH muncul
- Status: BLOCK / needs_review

### D. Operational Reference (Bagian 16-19)
- Final extraction flow (12 steps)
- Legacy artifacts yang harus dibuang
- Validator rules per Governance (G3, G5, G7, G11, projection write-protection)
- Final rule + kalimat penutup

**Validation:**
- 36/36 skeleton paths verified vs PKB_Wolfbrain V.10.2 (SHA: 1732aafb92e4a87d)
- 40/41 enum values match F3 Enum Registry
- contradiction_flag struktur (severity field) flagged as suggested pattern, pending F2/F3 amendment V.10.3
- Brand naming: LAUTAN77 retained sebagai case study sample input (per HARD RULE brand naming — case study BOLEH sebut brand real untuk referensi developer)

**Approved by:** Habe Raja (Fux), WOLFGANK
**Date:** 15 Mei 2026
**Status:** Document locked / Schema candidate_locked

---

*Liveboard | Extractor Workflow V.10.2 | V.0 Initial Lock 15 Mei 2026 → V.0.1 Patch 15 Mei 2026 (wording + enum alignment) | Habe Raja*
