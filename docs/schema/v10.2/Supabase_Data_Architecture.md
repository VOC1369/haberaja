# Liveboard / Wolfbrain — Supabase Data Architecture V.10.2

**Schema:** PKB_Wolfbrain V.10.2
**Document Status:** locked (dokumen ini sudah final)
**Schema Status (`meta_engine.schema_block.status`):** candidate_locked
**Type:** Referensi Pembelajaran Internal (Programmer / Designer)
**Active Phase:** Phase 3A → Phase 3B (Supabase Migration)
**Tanggal:** 15 Mei 2026
**Owner:** Habe Raja (Fux), WOLFGANK
**Companion:** F1 (Doctrine + Skeleton) + F2 (Field Definitions) + F3 (Enum Registry) + F4 (Form Mapping) + Governance Rules

---

## Apa Dokumen Ini?

Dokumen ini berisi **arsitektur Supabase** untuk menyimpan promo knowledge PKB_Wolfbrain V.10.2 — struktur tabel, mapping JSON ke kolom, aturan publish, dan kontrak baca untuk Danila AI.

Anggap aja ini **cetak biru database**. Programmer baca buat tau cara kerja Supabase. Designer baca buat tau struktur data yang lo render di UI.

> **Audience:** Programmer (migration, publish module, integrasi runtime) + Designer (UI yang baca/tulis ke promo_knowledge).

---

## Bedanya dengan dokumen lain?

| Dokumen | Fokus | Audience |
|---------|-------|----------|
| **F1 Doctrine** | Prinsip dasar Wolfbrain | Semua orang |
| **F2 Field Definitions** | Arti tiap field di JSON | Developer + QA |
| **F3 Enum Registry** | Nilai enum yang diizinkan | Developer + extractor AI |
| **F4 Form Mapping** | JSON ↔ Form Wizard UI | Frontend dev + designer |
| **Governance Rules** | Aturan operasional + enforcement | Developer + validator |
| **Supabase Data Architecture** *(doc ini)* | Struktur tabel Supabase + flow data | Backend programmer + designer |

**Aturan hierarki kalau ada konflik:**
- Konflik tentang **field/path/structure** → **Skeleton JSON menang**, doc ini di-patch
- Konflik tentang **cara pakai/enforcement** → **Governance Rules menang**
- Konflik tentang **enum value** → **F3 menang**
- Konflik tentang **definisi field** → **F2 menang**
- Konflik tentang **table schema** → **doc ini menang** (canonical untuk Supabase layer)

Doc ini hanya **mendokumentasikan** struktur Supabase, bukan **mendefinisikan** schema bisnis.

---

## Hubungan dengan V.10.1 doc lama

Dokumen V.10.1 (`Liveboard_Supabase_Data_Architecture_V_10.1`) sudah **superseded** oleh dokumen ini. Tapi 90% content tetap berlaku — V.10.1 → V.10.2 itu **strictly additive**, bukan breaking change.

Yang berubah di V.10.2:
- Engine count: **22 → 26** (4 engine baru: ticket, referral, result_event, fulfillment)
- `mechanics_engine` status: **AUXILIARY** (per Governance G9) — tidak lagi Truth #1
- Field baru di `meta_engine.schema_block`: `record_type`, `previous_version`, `amendment_type`
- Block baru: `unmodeled_evidence_block` (replaces per-engine `_extensions`)
- `void_conditions_block` jadi array langsung (bukan object)
- 12 governance rules locked

Semua field V.10.1 tetap valid. Migration V.10.1 → V.10.2 = additive only.

---

# Bagian 1 — Doctrine Inti

Sebelum baca section teknis, internalisasi 6 doctrine berikut. Tanpa ini, doc selanjutnya tidak akan masuk akal.

## 1.1 `record_json` = source of truth

Seluruh "kepintaran" promo ada di `record_json`. Tidak ada di tempat lain.

```
record_json = full PkV10Record V.10.2 (469 fields, 26 engines)
metadata columns = filter / listing / search / status only
```

Konsekuensi:
- Jangan rekonstruksi jawaban Danila dari metadata columns
- Jangan bikin "shadow column" yang menduplikasi field di `record_json`
- Kalau butuh field baru di runtime, baca dari `record_json` — **jangan tambah column**

## 1.2 Tidak ada flattening JSON ke ratusan kolom

PkV10Record V.10.2 punya struktur nested + dinamis dengan **469 leaf fields**. Kalau di-flatten:
- Ratusan kolom sparse (sebagian besar null per row)
- Schema drift tinggi (setiap perubahan V.10.x = ALTER TABLE)
- Multi-variant `subcategories[]` susah direpresentasikan di kolom flat
- Audit log array (`_human_override_log`, `_ai_resolver_log`) tidak fit ke kolom flat
- Maintenance tinggi, rawan partial data

Solusi: **JSONB column tunggal** untuk seluruh JSON, plus metadata columns kecil untuk operasional.

## 1.3 Tidak ada `PromoFormData` di publish path

`PromoFormData` adalah state Form Wizard legacy V.09. **Tidak boleh masuk ke Supabase dalam bentuk apapun.**

Yang masuk ke `record_json`: **`PkV10Record` saja**.

## 1.4 Tidak ada V.09 bridge

Tabel legacy `promo_kb` dan `promo_kb_audit_log` adalah artefak V.09. **Tidak digunakan untuk V.10.2.** Tidak di-write oleh runtime V.10.2. Tidak dibaca oleh Danila V.10.2.

Drop policy diatur terpisah (lihat Bagian 13).

## 1.5 `mechanics_engine` = AUXILIARY (V.10.2 LOCKED, per Governance G9)

**Perubahan V.10.2 yang penting:** `mechanics_engine` di V.10.1 dulu Truth #1. Di V.10.2, **demoted ke AUXILIARY** (audit/debug only).

**Konsekuensi untuk Supabase:**
- Danila **GAK** baca `mechanics_engine` saat menjawab member
- Form Wizard **GAK** display `mechanics_engine.items[]` ke admin
- Validator **OPTIONAL** validate mechanics (boleh skip)
- Kalau bentrok dengan typed engines (reward_engine, claim_engine, dll) → **typed engines MENANG**

Analogi: kayak corat-coret kasir di balik struk. Ada gunanya untuk audit, tapi yang resmi tetap struk-nya.

## 1.6 `projection_engine` = DERIVED only

`projection_engine` adalah **derived-only output**. Extractor / Form Wizard / admin **DILARANG** menulis langsung. Generated post-extraction dari engine PRIMARY.

**Validator BLOCK commit kalau extractor write detected di projection paths.**

---

# Bagian 2 — Arsitektur Tabel (Hybrid Model)

## 2.1 Kenapa Hybrid?

Ada 3 model arsitektur tabel yang bisa dipilih:

| Model | Pro | Kontra |
|-------|-----|--------|
| **Pure flat** (semua field jadi kolom) | Query column native cepat | Schema drift, kolom sparse, susah multi-variant |
| **Pure JSONB** (cuma 1 kolom JSONB) | Zero schema drift, fleksibel | Filter/list lambat, butuh GIN index untuk semua query |
| **Hybrid** (metadata flat + JSONB) | Filter cepat di metadata, full JSON tetap utuh | Harus jaga konsistensi metadata vs JSON saat publish |

Liveboard pilih **hybrid** karena:
1. Beban filter/list di Promo Knowledge UI tinggi (per-client, per-status, per-published)
2. Beban runtime Danila tinggi (per-client + is_published filter)
3. Field "stable" di JSON cocok dijadikan metadata column
4. Field "nested + dinamis" tetap di JSONB

## 2.2 Pembagian Tanggung Jawab

```
Metadata columns (19)         record_json (1 JSONB — 469 fields, 26 engines)
─────────────────────         ──────────────────────────────────────────────
client_id                     full identity_engine
promo_name                    full classification_engine
promo_type                    full taxonomy_engine (+ tier_threshold_block)
promo_mode                    full period_engine (+ schedule_variant_block)
record_type ⭐ NEW            full time_window_engine
schema_version                full trigger_engine
state                         full claim_engine (+ claim_gate_block)
is_published                  full proof_engine (+ document_proof_block)
review_required               full payment_engine
validation_status             full scope_engine (+ odds_constraint + bet_configuration)
...                           full reward_engine (+ 5 typed blocks)
                              full ticket_engine ⭐ NEW V.10.2
                              full loyalty_engine (+ exchange typed)
                              full referral_engine ⭐ NEW V.10.2
                              full result_event_engine ⭐ NEW V.10.2
                              full fulfillment_engine ⭐ NEW V.10.2
                              full variant_engine (+ per-variant claim_gate)
                              full dependency_engine
                              full invalidation_engine (+ void_conditions typed array)
                              full terms_engine
                              full readiness_engine
                              full reasoning_engine (AUXILIARY)
                              full mechanics_engine (AUXILIARY — G9)
                              full projection_engine (DERIVED)
                              full risk_engine
                              full meta_engine (+ unmodeled_evidence_block)
                              full _field_status
                              full _human_override_log
                              full _ai_resolver_log
                              ai_confidence
─────────────────────         ──────────────────────────────────────────────
Tujuan: filter cepat          Tujuan: source of truth (canonical brain Danila)
```

---

# Bagian 3 — Tabel Aktif `promo_knowledge`

## 3.1 Konsep

```
1 row = 1 promo
record_id = canonical app-level ID (immutable, lahir di extractor)
record_json = full PkV10Record V.10.2 (469 fields, 26 engines)
metadata columns = filter/list/search/status
```

## 3.2 Contoh Visualisasi

Sebuah brand contoh (`BRAND_A`) punya 13 promo, maka di `promo_knowledge`:

```
row 1  | BRAND_A | Welcome Bonus       | promo         | published | record_json={...26 engines...}
row 2  | BRAND_A | Cashback Slot       | promo         | published | record_json={...}
row 3  | BRAND_A | Rollingan Casino    | promo         | published | record_json={...}
row 4  | BRAND_A | Lucky Spin Harian   | promo         | published | record_json={...}
row 5  | BRAND_A | Mystery Number      | promo         | published | record_json={...}
row 6  | BRAND_A | Referral 0.5%       | promo         | published | record_json={...}
row 7  | BRAND_A | Syarat Bermain      | site_policy   | published | record_json={...}
...
row 13 | BRAND_A | Birthday Bonus      | promo         | draft     | record_json={...}
```

13 row, masing-masing punya `record_json` lengkap dengan 26 engines.

## 3.3 19 Kolom Definitif (V.10.2)

| # | Column | Type | Required | Purpose |
|---|--------|------|----------|---------|
| 1 | `id` | `uuid` | yes | Primary key Supabase (auto-generated) |
| 2 | `record_id` | `text` | yes, unique | Canonical app-level ID dari `PkV10Record.record_id` |
| 3 | `client_id` | `text` | yes | Tenant guard — promo milik brand mana |
| 4 | `client_name` | `text` | no | Display name brand untuk UI |
| 5 | `promo_name` | `text` | yes | Nama promo (untuk search & list) |
| 6 | `promo_type` | `text` | no | Filter by tipe promo (welcome/cashback/dll) |
| 7 | `promo_mode` | `text` | no | `single` / `multi` — penting untuk multi-variant |
| 8 | **`record_type`** ⭐ NEW V.10.2 | `text` | yes | `promo` / `site_policy` / `informational` |
| 9 | `schema_name` | `text` | yes | `PKB_Wolfbrain` |
| 10 | `schema_version` | `text` | yes | `V.10.2` |
| 11 | `state` | `text` | no | Lifecycle state (di-copy as-is dari readiness_engine) |
| 12 | `validation_status` | `text` | no | `ready` / `needs_review` / `rejected` |
| 13 | `review_required` | `boolean` | yes | Gate review oleh admin |
| 14 | `is_published` | `boolean` | yes | **Runtime gate utama untuk Danila** |
| 15 | `record_json` | `jsonb` | yes | **Source of truth — full PkV10Record V.10.2** |
| 16 | `created_at` | `timestamptz` | yes | DB created |
| 17 | `updated_at` | `timestamptz` | yes | DB updated |
| 18 | `published_at` | `timestamptz` | no | Timestamp publish pertama |
| 19 | `published_by` | `text` | no | Admin/user yang publish |

## 3.4 Penjelasan Kolom Kritis

### `id` vs `record_id`

- `id` = UUID database, auto-generated, tidak punya makna bisnis
- `record_id` = canonical app-level ID, lahir di extractor saat JSON pertama dibuat, **tidak pernah berubah**

`record_id` jadi key untuk upsert. Database `id` untuk join internal dan referensi DB.

### `record_type` (BARU di V.10.2)

Per Governance G7. Field ini mengkategorikan **tipe record**:
- `promo` — Standard promo record. Default. Displayed in promo listing. Danila baca.
- `site_policy` — Kebijakan brand-wide (bukan promo). GAK displayed di promo listing. Danila baca untuk policy questions.
- `informational` — Content informational (transparency, anti-scam posts). Future use.

**Migration:** V.10.1 records (tanpa `record_type`) → default `"promo"`.

### `state` vs `validation_status` vs `is_published`

Tiga gate yang berbeda fungsi:

- `state` = **deskriptif**, di-copy as-is dari `readiness_engine.state_block.state`. Tidak menentukan apa-apa di runtime.
- `validation_status` = status hasil validasi (`ready` / `needs_review` / `rejected`). Bisa block publish.
- `is_published` = **flag runtime utama**. Danila hanya baca row dengan `is_published = true`.

**Aturan Phase 3B:** `state` di-copy as-is, **tidak di-normalize**. Saat publish, jangan paksa `state = "published"`. Yang menentukan promo aktif di runtime adalah `is_published`, bukan `state`.

### `record_json`

Kolom paling penting di tabel ini. Berisi seluruh PkV10Record V.10.2 (469 fields, 26 engines). **Jangan publish row dengan `record_json` partial atau kosong.**

---

# Bagian 4 — Anatomi `record_json` V.10.2

`record_json` berisi **full PkV10Record V.10.2**. Struktur engine-nya sebagai berikut.

## 4.1 Root-level Fields

| Field | Tipe | Keterangan |
|-------|------|------------|
| `domain` | string | Selalu `"promo_knowledge"` |
| `record_id` | string | Canonical app-level ID — **harus match** dengan kolom `record_id` di tabel |
| `created_at` | timestamp | Saat record pertama lahir di extractor |
| `updated_at` | timestamp | Last update — bisa beda dengan `updated_at` kolom DB |

## 4.2 Engine Blocks (26 engine V.10.2)

Per Governance G9 — 4 authority layers:

### PRIMARY (21 engines) — Sumber kebenaran resmi

| Engine | Tanggung Jawab |
|--------|----------------|
| `identity_engine` | Identitas promo: client, nama, tipe, mode (single/multi) |
| `classification_engine` | Klasifikasi A/B/C + reasoning Q1–Q4 |
| `taxonomy_engine` | Mode struktur (fixed/formula/tier/matrix) + tier_archetype + **tier_threshold_block** |
| `period_engine` | Validitas (tanggal mulai/akhir) + frekuensi distribusi + **schedule_variant_block** |
| `time_window_engine` | Jam klaim, jam distribusi, waktu reset |
| `trigger_engine` | Event pemicu + kondisi tambahan + logic operator |
| `claim_engine` | Cara klaim, saluran, langkah-langkah + **claim_gate_block (23 fields)** |
| `proof_engine` | Sosial proof + **document_proof_block** |
| `payment_engine` | Metode deposit, whitelist/blacklist, rate |
| `scope_engine` | Platform, geo, game domain, provider, blacklist + **odds_constraint + bet_configuration** |
| `reward_engine` | Tipe reward, voucher, max reward, basis perhitungan + **5 typed blocks** (reward_table, matrix, unit, turnover_tier, dst) |
| **`ticket_engine`** ⭐ NEW V.10.2 | Lucky spin / raffle / ticket-based draw |
| `loyalty_engine` | LP/EXP, exchange groups (typed), tier system |
| **`referral_engine`** ⭐ NEW V.10.2 | Referral commission structured (per game/market) |
| **`result_event_engine`** ⭐ NEW V.10.2 | Event berbasis hasil (lottery result match) |
| **`fulfillment_engine`** ⭐ NEW V.10.2 | Physical reward fulfillment (shipping) |
| `variant_engine` | `subcategories[]` untuk multi-variant promo + **per-variant claim_gate_block** |
| `dependency_engine` | Stacking rules, mutually exclusive, can combine |
| `invalidation_engine` | **`void_conditions_block` (array langsung, typed)** + penalty + anti-fraud |
| `terms_engine` | T&C, special requirements |
| `risk_engine` | Promo risk level (low/medium/high/critical) |

### OPERATIONAL (2 engines) — Lifecycle + metadata

| Engine | Tanggung Jawab |
|--------|----------------|
| `readiness_engine` | State machine + validation status + observability flags |
| `meta_engine` | Source URL, raw_content, schema metadata + **record_type** + **unmodeled_evidence_block** |

### AUXILIARY (2 engines) — Catatan kerja, BUKAN sumber kebenaran

| Engine | Tanggung Jawab |
|--------|----------------|
| `reasoning_engine` | AI reasoning trail (intent, mechanic_type, locked_fields) — Danila GAK baca |
| `mechanics_engine` ⚠️ V.10.2 demoted | Mechanic primitives (filled by AI extractor) — Danila GAK baca, Form Wizard GAK display |

### DERIVED (1 engine) — Read-only

| Engine | Tanggung Jawab |
|--------|----------------|
| `projection_engine` | **Derived only** — auto-generated dari engine PRIMARY post-extraction. Extractor DILARANG tulis. |

## 4.3 Audit & Status Fields

| Field | Tipe | Keterangan |
|-------|------|------------|
| `ai_confidence` | object | Confidence score per field (auto-calculated) |
| `_field_status` | object | Status per path: `explicit` / `inferred` / `derived` / `propagated` / `not_stated` / `not_applicable` |
| `_propagation_stats` | object | Statistik propagasi field (debug) |
| `_human_override_log` | array | Append-only log: tiap kali admin override answer |
| `_ai_resolver_log` | array | Append-only log: tiap kali AI resolve ambiguity |

## 4.4 Catatan Penting V.10.2

- **`projection_engine` = derived only**. Extractor / Form Wizard **tidak boleh** menulis langsung. Auto-generated dari engine lain post-extraction.
- **`mechanics_engine.items[]`** diisi oleh AI extractor sebagai audit trail. Operator tidak edit. Danila tidak baca. (V.10.2 LOCKED sebagai AUXILIARY per G9.)
- **Audit array** (`_human_override_log`, `_ai_resolver_log`) bersifat append-only. Jangan replace, hanya append.
- **`_field_status`** berubah saat Admin Verify menjawab gap → status `not_stated` jadi `explicit`.
- **`meta_engine.unmodeled_evidence_block.items[]`** (BARU V.10.2) — tempat AI catat hal yang belum punya rumah di skema. **BUKAN** dibaca Danila. Audit only.
- **`record_type`** (BARU V.10.2) — wajib diisi: `promo` / `site_policy` / `informational`.

---

# Bagian 5 — Source Path Mapping

Saat publish, metadata columns diisi **dari path tertentu di `record_json`**. Mapping ini **wajib** diikuti supaya konsistensi terjaga.

| Column | Source Path di `record_json` |
|--------|------------------------------|
| `record_id` | `record.record_id` |
| `client_id` | `record.identity_engine.client_block.client_id` |
| `client_name` | `record.identity_engine.client_block.client_name` |
| `promo_name` | `record.identity_engine.promo_block.promo_name` |
| `promo_type` | `record.identity_engine.promo_block.promo_type` |
| `promo_mode` | `record.identity_engine.promo_block.promo_mode` |
| **`record_type`** ⭐ NEW V.10.2 | `record.meta_engine.schema_block.record_type` |
| `schema_name` | `record.meta_engine.schema_block.schema_name` (`"PKB_Wolfbrain"`) |
| `schema_version` | `record.meta_engine.schema_block.schema_version` (`"V.10.2"`) |
| `state` | `record.readiness_engine.state_block.state` |
| `validation_status` | `record.readiness_engine.validation_block.status` |
| `review_required` | `record.readiness_engine.observability_block.review_required` |
| `record_json` | full `record` object |

## Aturan Mapping

1. **Read-only saat publish.** Metadata diisi dari `record_json` saat publish, **bukan sebaliknya**. Jangan modifikasi `record_json` setelah baca metadata.
2. **`state` di-copy as-is.** Jangan normalize. Jangan paksa jadi `"published"`.
3. **`record_json` berisi `record` lengkap**, termasuk semua 26 engines + audit array + field status.
4. **Field optional yang null** di metadata column boleh, tapi `record_json` tetap harus complete.
5. **`record_type` WAJIB diisi.** Default `"promo"` kalau tidak disebutkan. Per Governance G7.

---

# Bagian 6 — Flow Data V.10.2

Ini flow resmi V.10.2. Programmer harus paham ini sebelum touch `promo_knowledge`.

```
┌──────────────────────────────────────────────────────────────────┐
│                    FLOW DATA V.10.2                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. INPUT PROMO (text/image/PDF/URL)                             │
│     ↓                                                            │
│  2. AI EXTRACTOR (Wolfclaw)                                      │
│     - Reasoning-first extraction (NO regex per G11)              │
│     - Generate PkV10Record V.10.2 (26 engines, 469 fields)       │
│     - record_id LAHIR di sini (immutable)                        │
│     - record_type ditentukan (promo/site_policy/informational)   │
│     - _field_status set per path                                 │
│     - ai_confidence set per path                                 │
│     - mechanics_engine.items[] (AUXILIARY trail)                 │
│     ↓                                                            │
│  3. ADMIN VERIFY (Gap Checker)                                   │
│     - Tanya gap yang relevant (not_stated + critical)            │
│     - SKIP field not_applicable                                  │
│     - Admin jawab → update PkV10Record                           │
│     - _field_status: not_stated → explicit                       │
│     - _human_override_log: append entry                          │
│     - Validator check: G3 (3-path min_withdraw), G5 (reward      │
│       block anti-overlap), G7 (record_type), G11 (no regex)      │
│     ↓                                                            │
│  4. GUNAKAN PROMO                                                │
│     - saveRecord(pkRecord) → localStorage                        │
│     - pk:rec:<record_id> + pk:index                              │
│     - dispatchEvent("pk-v10-storage-updated")                    │
│     ↓                                                            │
│  5. PROMO KNOWLEDGE LIST (V.10.2 active table)                   │
│     - Read pk:index + pk:rec:*                                   │
│     - Filter by record_type (promo / site_policy / informational)│
│     - V.09 + V.10.1 quarantined — tidak muncul                   │
│     - Actions: Review JSON / Copy JSON / Delete / Publish        │
│     ↓                                                            │
│  6. FORM WIZARD V.10.2 (9-step + conditional sections)           │
│     - Read PkV10Record → pre-fill form                           │
│     - Conditional sections muncul per promo_type                 │
│       (ticket/referral/result_event/fulfillment)                 │
│     - Admin edit fields                                          │
│     - Save → update PkV10Record di pk:rec:*                      │
│     ↓                                                            │
│  7. REVIEW & FINAL                                               │
│     - All critical fields explicit / not_applicable              │
│     - canPublish gate check (Bagian 7)                           │
│     - T&C auto-generated                                         │
│     - projection_engine derived (auto)                           │
│     ↓                                                            │
│  8. PUBLISH SUPABASE                                             │
│     - Source: loadRecord(record_id) dari pk:rec:*                │
│     - Upsert ke promo_knowledge BY record_id                     │
│     - Metadata columns diisi dari path mapping (Bagian 5)        │
│     - record_json = full PkV10Record V.10.2                      │
│     - is_published = true                                        │
│     - state di-copy as-is                                        │
│     - record_type di-copy from meta_engine                       │
│     ↓                                                            │
│  9. DANILA RUNTIME                                               │
│     - Query promo_knowledge WHERE is_published=true              │
│     - Filter record_type by query context                        │
│     - Read record_json (typed engines only)                      │
│     - SKIP mechanics_engine + reasoning_engine + projection      │
│       + unmodeled_evidence_block                                 │
│     - Answer member dari typed engines                           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Aturan Kritis Flow

- **Source publish ke Supabase = `pk:rec:*` localStorage**. Bukan dari Form Wizard state, bukan dari extractor langsung, bukan dari `mappedPreview`.
- **`record_id` lahir di extractor** (step 2), bukan di Supabase. Saat sampai ke step 8, `record_id` sudah harus ada.
- **Danila tidak membaca dari localStorage**. Danila hanya membaca dari Supabase `promo_knowledge`. Selama promo belum di-publish, Danila tidak tahu promo itu ada.
- **Danila SKIP 4 layer non-PRIMARY:** mechanics, reasoning, projection, unmodeled_evidence — semua audit/derived, bukan sumber kebenaran.

---

# Bagian 7 — Publish Gate Rules V.10.2

Promo hanya boleh di-publish ke `promo_knowledge` kalau **lulus semua gate berikut**.

## 7.1 Hard Requirements (V.10.2 LOCKED)

```
record exists
record_id exists & non-empty
client_id exists
promo_name exists
record_type exists (default "promo") ⭐ NEW V.10.2
schema_version === "V.10.2"
meta_engine.source_block.raw_content exists
variant_engine exists (boleh empty subcategories untuk single mode)
_field_status exists
ai_confidence exists
review_required !== true
validation_status !== "needs_review"
ready_to_commit !== false
```

## 7.2 Governance Validator Rules (V.10.2 BARU)

Selain hard requirements di atas, validator WAJIB check:

```
G3 — min_withdraw forbidden path:
  IF record.reward_engine.requirement_block.min_withdraw exists:
    BLOCK COMMIT — field DELETED V.10.2, pindah ke claim_gate_block

G5 — Reward block anti-overlap:
  IF count(reward_block.enabled = true) > 1:
    BLOCK COMMIT — hanya 1 reward block utama per promo
  Reward blocks dengan enabled flag: tier_threshold_block, reward_table_block,
    matrix_reward_block, unit_reward_block, turnover_tier_by_deposit_block

G7 — record_type required:
  IF record.meta_engine.schema_block.record_type missing OR empty:
    BLOCK COMMIT — wajib diisi promo/site_policy/informational

G11 — No regex in extractor output:
  IF extractor session flagged SUSPICIOUS pattern (regex-like extraction):
    WARN admin — manual review recommended

Projection write-protection:
  IF extractor write detected di projection_engine paths:
    BLOCK COMMIT — projection_engine DERIVED ONLY
```

## 7.3 Path Validation (Critical)

Path raw content yang **benar**:

```
record.meta_engine.source_block.raw_content   ✓
```

Path yang **salah** (jangan dipakai):

```
record.raw_content                             ✗
```

## 7.4 canPublish Function

Implementasi `canPublish()` harus return:

- `{ ok: true }` — semua gate lulus, boleh publish
- `{ ok: false, reasons: [...] }` — array reason kenapa gagal, untuk display ke admin

Jangan publish row dengan `record_json` yang tidak lengkap. Lebih baik fail dengan reason jelas daripada partial publish.

---

# Bagian 8 — Upsert Behavior

## 8.1 Aturan Upsert V.10.2

Publish menggunakan **upsert by `record_id`**:

```sql
INSERT INTO promo_knowledge (
  record_id, client_id, client_name,
  promo_name, promo_type, promo_mode,
  record_type,  -- ⭐ NEW V.10.2
  schema_name, schema_version,
  state, validation_status, review_required, is_published,
  record_json,
  published_at, published_by
)
VALUES (...)
ON CONFLICT (record_id) DO UPDATE SET
  record_json = EXCLUDED.record_json,
  record_type = EXCLUDED.record_type,
  -- update all metadata columns
  updated_at = NOW(),
  published_at = NOW(),
  published_by = $1;
```

## 8.2 Yang Boleh & Yang Tidak

**Boleh:**
- Insert baru kalau `record_id` belum ada
- Update full row kalau `record_id` sudah ada — termasuk `record_json` di-overwrite penuh
- Update `published_at` & `published_by` setiap publish ulang
- Update `record_type` (e.g., promo → site_policy kalau reklasifikasi)

**Tidak boleh:**
- Insert duplikat dengan `record_id` sama
- Update sebagian (`record_json` partial)
- Generate `record_id` baru di Supabase — `record_id` immutable dari extractor

## 8.3 Source untuk Upsert

Hanya satu source yang sah:

```
loadRecord(recordId) dari pk:rec:*
```

**Bukan** dari:
- Wizard state (mungkin belum disimpan)
- `projection_engine` saja (derived, bukan source)
- `mappedPreview` (intermediate, bukan canonical)
- `extractedPromo` (sebelum admin verify)
- `PromoFormData` (legacy V.09)
- Object V.09 / V.10.1 yang belum migrate

---

# Bagian 9 — Danila Read Contract V.10.2

Danila adalah AI livechat persona yang menjawab pertanyaan member. Dia membaca dari `promo_knowledge` dengan kontrak ketat.

## 9.1 Query Wajib

```sql
SELECT record_json
FROM promo_knowledge
WHERE client_id = $1
  AND is_published = true
  AND review_required = false
  AND schema_version = 'V.10.2'
  AND record_type IN ('promo', 'site_policy');  -- ⭐ NEW V.10.2
```

## 9.2 Aturan Baca

1. **Danila hanya baca `record_json`**, bukan metadata column lain selain untuk filter di WHERE clause.
2. **Tenant guard wajib** (`client_id = $1`) — tidak boleh cross-tenant.
3. **Filter runtime** (`is_published = true`, `review_required = false`) wajib — promo draft tidak boleh nyangkut ke Danila.
4. **Filter schema version** (`schema_version = 'V.10.2'`) wajib — backward compat dengan V.09 + V.10.1 di-prevent.
5. **Filter record_type** (BARU V.10.2) — Danila baca `promo` + `site_policy`. SKIP `informational` (future use).

## 9.3 Engine Read Order (per Governance G9)

Saat Danila reasoning untuk menjawab member, urutan baca engine:

```
1. PRIMARY engines (21) — sumber kebenaran resmi
   Contoh: min deposit? → reward_engine.requirement_block.min_deposit
           min WD claim? → claim_engine.claim_gate_block.min_withdraw_for_claim
2. OPERATIONAL (2) — metadata + lifecycle (jarang dibaca untuk content)
3. SKIP AUXILIARY (2): reasoning_engine, mechanics_engine
4. SKIP DERIVED (1): projection_engine (kecuali pre-computed summary)
5. SKIP audit: unmodeled_evidence_block, _human_override_log, _ai_resolver_log
```

**Bentrok antara PRIMARY dan AUXILIARY?** → PRIMARY MENANG. Per G9.

## 9.4 Yang Tidak Boleh

- Danila baca dari metadata column untuk content jawaban (e.g., baca `promo_name` doang lalu jawab dari situ)
- Danila bypass filter `is_published`
- Danila baca dari tabel legacy `promo_kb`
- Danila baca dari `pk:rec:*` localStorage (itu staging, bukan runtime)
- Danila baca dari `mechanics_engine.items[]` untuk content reasoning (AUXILIARY)
- Danila baca dari `unmodeled_evidence_block` (audit only)

## 9.5 Metadata Columns: Hanya untuk WHERE & ORDER

Metadata columns digunakan **hanya** untuk:

```
filter (WHERE)
listing (ORDER BY)
search (LIKE / full-text)
status (boolean check)
tenant guard
record_type filter
```

**Bukan** untuk content reasoning. Content reasoning ada di `record_json` (typed engines).

---

# Bagian 10 — Tabel Legacy (Status & Policy)

## 10.1 Tabel Legacy Existing

```
promo_kb              — V.09 / V.APR.09
promo_kb_audit_log    — V.09 audit log
```

## 10.2 Status Sekarang V.10.2

| Aspek | Status |
|-------|--------|
| Source of truth V.10.2 | ❌ Bukan |
| Dipakai Danila V.10.2 | ❌ Tidak |
| Di-write oleh runtime V.10.2 | ❌ Tidak |
| Di-drop sekarang | ❌ Belum |
| Posisi di V.10.2 flow | Frozen / quarantined / retired |

## 10.3 Drop Procedure

Sebelum drop, **wajib** cek:

```
1. Confirm row count = 0 (atau sudah di-archive)
2. Confirm audit log table irrelevant / empty
3. Search seluruh codebase untuk referensi runtime
4. Confirm tidak ada active code path depend
5. Buat separate cleanup migration (tidak digabung dengan migration lain)
6. Drop urutan: promo_kb_audit_log dulu, baru promo_kb
```

Sampai semua step di atas selesai, **biarkan tabel legacy ada tapi frozen** — jangan write, jangan baca dari V.10.2 flow.

## 10.4 Aturan Saat Ini

```
V.10.2 flow tidak menyentuh promo_kb / promo_kb_audit_log
V.10.2 menulis hanya ke promo_knowledge
Drop migration = task terpisah, bukan bagian Phase 3B
```

---

# Bagian 11 — Knowledge Family (Future)

Liveboard akan mengembangkan **knowledge family** ke depan. Ini blueprint, **belum diimplementasikan**.

## 11.1 `persona_knowledge` (Future)

**Tujuan:** Menyimpan konfigurasi & behavior persona AI (Danila, Riri, Maya).

**Struktur (rencana):**

```
1 row = 1 persona profile/version
record_json = full Persona JSON
metadata = persona_name, client_id, version, state, is_active
```

## 11.2 `behavioral_knowledge` (Future)

**Tujuan:** Menyimpan behavior rules — customer patterns, escalation rules, tone policies, operational heuristics.

**Struktur (rencana):**

```
1 row = 1 behavioral rule set
record_json = full Behavioral JSON
metadata = client_id, category, version, state, is_active
```

## 11.3 `general_knowledge` (Future)

**Tujuan:** Menyimpan non-promo brand knowledge — info umum bisnis, FAQ, kebijakan.

**Struktur (rencana):**

```
1 row = 1 general KB entry / document
record_json = full General Knowledge JSON
metadata = client_id, topic, category, version, state, is_active
```

## 11.4 Naming Principle (Locked)

Semua future tables ikut convention naming yang sama:

```
promo_knowledge        ✓ (active)
persona_knowledge      ✓ (future)
behavioral_knowledge   ✓ (future)
general_knowledge      ✓ (future)
```

**Ditolak:**

```
promo_knowledge_records   ✗
promo_kb                  ✗
promos                    ✗
promotion_records         ✗
```

Alasan: nama harus pendek, jelas, dan mencerminkan **knowledge domain** secara langsung.

---

# Bagian 12 — RLS & Security

## 12.1 Phase 3B Policy (Sekarang)

Untuk Phase 3B, ikut pattern project saat ini:

```
authenticated full access
USING true
WITH CHECK true
```

Acceptable karena Liveboard masih single-tenant / internal.

## 12.2 Multi-Tenant RLS (Future)

Saat Liveboard buka untuk multi-client production, RLS harus diketatkan:

```sql
-- Future RLS (belum diimplementasikan)
CREATE POLICY promo_knowledge_tenant_guard
  ON promo_knowledge
  FOR ALL
  USING (client_id = auth.jwt()->>'client_id')
  WITH CHECK (client_id = auth.jwt()->>'client_id');
```

## 12.3 Supabase Client Rule

Hanya boleh pakai satu client integration:

```
@/integrations/supabase/client    ✓ (use this)
```

**Jangan** pakai:

```
@/lib/supabase-client             ✗ (legacy, mungkin point ke project lain)
```

Project saat ini punya dual Supabase client. Yang legacy bisa point ke Supabase project yang salah. Phase 3B wajib pakai active managed integration client saja.

## 12.4 Recommended Indexes V.10.2

```sql
CREATE UNIQUE INDEX idx_promo_knowledge_record_id
  ON public.promo_knowledge(record_id);

CREATE INDEX idx_promo_knowledge_client_pub
  ON public.promo_knowledge(client_id, is_published);

CREATE INDEX idx_promo_knowledge_schema_version
  ON public.promo_knowledge(schema_version);

CREATE INDEX idx_promo_knowledge_state
  ON public.promo_knowledge(state);

CREATE INDEX idx_promo_knowledge_updated_at
  ON public.promo_knowledge(updated_at DESC);

-- ⭐ NEW V.10.2 — filter by record_type
CREATE INDEX idx_promo_knowledge_record_type
  ON public.promo_knowledge(record_type);

-- ⭐ NEW V.10.2 — composite for Danila runtime query
CREATE INDEX idx_promo_knowledge_danila_runtime
  ON public.promo_knowledge(client_id, is_published, schema_version, record_type)
  WHERE is_published = true;
```

GIN index untuk `record_json` **belum diperlukan** di migration pertama. Tambah kalau ada query content-based yang lambat:

```sql
-- Optional, tambah nanti kalau perlu
CREATE INDEX idx_promo_knowledge_record_json_gin
  ON public.promo_knowledge USING GIN (record_json jsonb_path_ops);
```

---

# Bagian 13 — Rules untuk Programmer V.10.2

Ringkasan aturan teknis. Print, tempel di monitor.

## 13.1 Yang Wajib

| # | Rule |
|---|------|
| 1 | Pakai `@/integrations/supabase/client` (bukan `@/lib/supabase-client`) |
| 2 | Source publish hanya dari `loadRecord(record_id)` di `pk:rec:*` |
| 3 | Upsert by `record_id` (bukan `id`) |
| 4 | `record_json` selalu berisi full PkV10Record V.10.2 (469 fields, 26 engines) |
| 5 | Metadata columns diisi dari path mapping di Bagian 5 |
| 6 | `state` di-copy as-is dari `readiness_engine.state_block.state` |
| 7 | `is_published` adalah runtime gate utama Danila |
| 8 | canPublish gate wajib lulus sebelum publish (Bagian 7) |
| 9 | Schema version validation: `schema_version === "V.10.2"` |
| 10 | `record_type` WAJIB diisi (per G7) — default `"promo"` |
| 11 | Governance validators WAJIB run: G3, G5, G7, G11, projection write-protection |
| 12 | RLS pattern Phase 3B: `authenticated full access` |

## 13.2 Yang Dilarang

| # | Rule |
|---|------|
| 1 | Jangan flatten JSON ke ratusan kolom |
| 2 | Jangan publish dari Form Wizard state langsung |
| 3 | Jangan publish dari `mappedPreview` / `extractedPromo` / `projection_engine` saja |
| 4 | Jangan generate `record_id` baru di Supabase |
| 5 | Jangan normalize `state` (e.g., paksa jadi `"published"`) |
| 6 | Jangan write ke `promo_kb` / `promo_kb_audit_log` (legacy) |
| 7 | Jangan baca `record_json` dari localStorage di runtime Danila |
| 8 | Jangan bridge V.10 → V.09 |
| 9 | Jangan publish row dengan `record_json` partial / kosong |
| 10 | Jangan drop tabel legacy tanpa cleanup migration terpisah |
| 11 | Jangan write ke `projection_engine` paths (DERIVED only) |
| 12 | Jangan write ke `meta_engine.unmodeled_evidence_block` otomatis tanpa Human override (per G4) |
| 13 | Jangan baca `mechanics_engine` untuk content reasoning Danila (AUXILIARY) |

---

# Bagian 14 — Rules untuk Designer V.10.2

Aturan untuk designer yang merancang UI yang baca/tulis ke `promo_knowledge`.

## 14.1 Saat Design List / Filter UI

- Filter UI **boleh** pakai metadata columns: `client_id`, `promo_type`, `record_type` ⭐ NEW, `is_published`, `state`, `validation_status`, `created_at`
- Filter UI **tidak boleh** ekspose field di `record_json` sebagai filter primer (filter dalam JSONB lambat tanpa GIN index)
- Search by `promo_name` boleh; search by content promo (deskripsi, syarat, dll) **tidak boleh** sebagai default — itu butuh design khusus

## 14.2 Saat Design Detail UI

- Detail UI **wajib** baca dari `record_json`, bukan dari metadata columns
- Field yang tidak ada di metadata column **harus** dibaca dari path JSON yang sesuai
- Multi-variant promo: baca dari `record_json.variant_engine.items_block.subcategories[]`, **bukan** dari kolom flat (tidak ada)
- **V.10.2: Per-variant claim_gate_block** — kalau ada, override global claim_engine.claim_gate_block

## 14.3 Saat Design Publish UI

- Publish button **wajib** check `canPublish()` dulu sebelum enable
- Tampilkan reason kalau gagal (dari `canPublish().reasons[]`)
- Confirm dialog wajib menampilkan: nama promo, client, record_type, schema version, jumlah variant
- Setelah publish: update UI berdasarkan `is_published = true` & `published_at`

## 14.4 Saat Design Status / Badge

- **Lifecycle badge** → baca `state` (deskriptif)
- **Validation badge** → baca `validation_status`
- **Runtime badge** → baca `is_published` (ini yang paling penting untuk designer)
- **Review badge** → baca `review_required`
- **Record type badge** ⭐ NEW V.10.2 → baca `record_type` (promo/site_policy/informational)

Jangan campur status. Misal: jangan tampilkan "Published" cuma karena `state = "published"` kalau `is_published = false`.

## 14.5 Saat Design Multi-Variant

- Tampilkan variant list dari `record_json.variant_engine.items_block.subcategories[]`
- Setiap variant punya field sendiri (lihat F2 / F4 untuk detail)
- Jangan asumsikan multi-variant = identik per row di tabel; satu row Supabase = satu promo (bisa berisi multi variant di JSONB)
- **V.10.2: Per-variant claim_gate_block** — highlight kalau override global

## 14.6 Saat Design Audit / History

- Audit history baca dari `_human_override_log[]` di `record_json`
- AI resolver history dari `_ai_resolver_log[]`
- `_field_status` untuk display per-field status (`explicit` / `inferred` / `derived` / `propagated` / `not_stated` / `not_applicable`)
- Jangan rekonstruksi history dari metadata columns — tidak akan akurat
- **V.10.2: unmodeled_evidence_block** — kalau mau debug pattern yang belum punya rumah, baca dari `record_json.meta_engine.unmodeled_evidence_block.items[]`

## 14.7 Saat Design Conditional Sections (V.10.2 BARU)

Per Governance G5 + F4 conditional rendering rules:

- **Ticket section** muncul kalau `promo_type IN [lucky_draw, lucky_spin]`
- **Referral section** muncul kalau `promo_type = referral`
- **Result Event section** muncul kalau `promo_type = mystery_number`
- **Fulfillment section** muncul kalau `reward_type IN [physical, merchandise]`
- **Reward block selector** WAJIB — operator pilih 1 reward block utama (anti-overlap per G5)

---

# Bagian 15 — Glossary V.10.2

Istilah yang sering muncul, supaya programmer dan designer punya pemahaman seragam.

| Istilah | Penjelasan |
|---------|------------|
| **`record_id`** | Canonical app-level ID untuk satu PkV10Record. Lahir di extractor, immutable, dipakai untuk upsert. |
| **`id` (UUID)** | Primary key database Supabase, auto-generated. Tidak punya makna bisnis. |
| **PkV10Record** | Record canonical V.10.2 sesuai PKB_Wolfbrain schema. Isi `record_json`. 469 fields, 26 engines. |
| **`pk:rec:*`** | LocalStorage key pattern untuk draft V.10.2. Source publish ke Supabase. |
| **`pk:index`** | Index entry list LocalStorage untuk Promo Knowledge UI. |
| **Metadata columns** | 18 kolom di `promo_knowledge` selain `record_json`. Untuk filter/list/search/status. |
| **`record_json`** | JSONB column berisi full PkV10Record V.10.2. Source of truth untuk Danila. |
| **`is_published`** | Runtime gate utama. Danila hanya baca row dengan `is_published = true`. |
| **`record_type`** ⭐ NEW V.10.2 | `promo` / `site_policy` / `informational`. Wajib diisi per Governance G7. |
| **`state`** | Lifecycle state deskriptif, di-copy as-is dari `readiness_engine.state_block.state`. Tidak menentukan runtime gate. |
| **`validation_status`** | Status hasil validasi: `ready` / `needs_review` / `rejected`. |
| **`review_required`** | Boolean flag — apakah promo perlu admin review sebelum publish. |
| **canPublish gate** | Function yang validate apakah row boleh di-publish. Lihat Bagian 7. |
| **Upsert** | Insert kalau belum ada, update kalau sudah ada (by `record_id`). |
| **Hybrid model** | Kombinasi metadata columns flat + JSONB column. Lihat Bagian 2. |
| **Knowledge family** | Grup tabel: `promo_knowledge`, `persona_knowledge`, `behavioral_knowledge`, `general_knowledge`. |
| **Legacy V.09** | Tabel `promo_kb` & `promo_kb_audit_log`. Frozen, tidak dipakai V.10.2. |
| **F1 / F2 / F3 / F4** | Doctrine / Field / Enum / Form Mapping spec untuk PKB_Wolfbrain V.10.2. |
| **Governance Rules** | 12 rules locked (G1-G12) — aturan operasional + enforcement. |
| **Danila** | AI livechat persona yang membaca dari `promo_knowledge` untuk menjawab member. |
| **AUXILIARY engines** | reasoning_engine + mechanics_engine — audit only, Danila tidak baca. Per G9. |
| **DERIVED engines** | projection_engine — auto-generated, extractor dilarang tulis. |
| **unmodeled_evidence_block** ⭐ NEW V.10.2 | Centralized escape hatch di `meta_engine` untuk data yang belum punya rumah di skema. Audit only. Per G4. |
| **3-path SSOT min_withdraw** | Per G3 — `min_withdraw_for_claim` ada di 3 path: global claim_gate, per-variant claim_gate, projection (derived). |
| **Phase 3A / 3B** | 3A = planning Supabase migration. 3B = execution: migration + publish module + tests. |

---

# Changelog

## V.10.1 → V.10.2 (15 Mei 2026)

**Type:** `major_schema_expansion` — additive Supabase architecture extension untuk align dengan V.10.2 schema.
**Status:** Document locked / Schema candidate_locked
**Backward compatibility:** Strictly additive — semua V.10.1 architecture tetap berlaku.

**Trigger:** PKB_Wolfbrain schema V.10.1 → V.10.2 expansion (4 engine baru + 12 block baru + governance rules) butuh update Supabase doc.

**Yang berubah:**

### A. Schema References Updated
- `schema_version === "V.10.1"` → `schema_version === "V.10.2"`
- 22 engines → **26 engines** (4 BARU: ticket, referral, result_event, fulfillment)
- 18 metadata columns → **19 metadata columns** (+1: `record_type`)
- 280 fields → **469 leaf fields** (V.10.2 expansion)

### B. New Concepts Documented
- **`record_type`** field di metadata + path mapping (per G7)
- **`mechanics_engine = AUXILIARY`** (per G9) — Danila gak baca, Form Wizard gak display
- **`projection_engine = DERIVED only`** (formalized) — extractor dilarang tulis
- **`unmodeled_evidence_block`** di meta_engine — replaces per-engine `_extensions`
- **Per-variant `claim_gate_block`** override behavior
- **12 Governance Rules** referenced (G1-G12)

### C. Validator Rules BARU (per Governance V.10.2)
- G3: min_withdraw forbidden path validation
- G5: Reward block anti-overlap
- G7: record_type required
- G11: No regex extraction (SUSPICIOUS pattern detection)
- Projection write-protection

### D. Indexes BARU V.10.2
- `idx_promo_knowledge_record_type` — filter by record_type
- `idx_promo_knowledge_danila_runtime` — composite for Danila runtime query

### E. Danila Read Contract Updates
- Query WAJIB filter `schema_version = 'V.10.2'`
- Query WAJIB filter `record_type IN ('promo', 'site_policy')`
- Engine read order: PRIMARY → OPERATIONAL → SKIP AUXILIARY → SKIP DERIVED
- Bentrok PRIMARY vs AUXILIARY → PRIMARY MENANG (per G9)

### F. Yang gak berubah dari V.10.1
- Hybrid model architecture (metadata + JSONB) — masih correct
- `record_json` as source of truth — masih correct
- Upsert by `record_id` — masih correct
- canPublish gate philosophy — masih correct
- Knowledge family naming convention — masih correct
- Legacy V.09 quarantine policy — masih correct

**Approved by:** Habe Raja (Fux), WOLFGANK
**Date:** 15 Mei 2026
**Status:** Document locked / Schema candidate_locked

---

**FINAL LOCK**

```
Liveboard Supabase Data Architecture V.10.2
Active Table: promo_knowledge
Source of Truth: record_json (full PkV10Record V.10.2)
Engines: 26 (21 PRIMARY + 2 OPERATIONAL + 2 AUXILIARY + 1 DERIVED)
Phase: 3A → 3B
Status: Document locked / Schema candidate_locked
```

---

*Liveboard | Supabase Data Architecture V.10.2 | 7 Mei 2026 (V.10.1) → 15 Mei 2026 (V.10.2 Document locked) | Habe Raja*
