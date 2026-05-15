# Governance Rules V.10.2

**Schema:** PKB_Wolfbrain V.10.2
**Document Status:** locked (dokumen ini sudah final)
**Schema Status (`meta_engine.schema_block.status`):** candidate_locked
**Tanggal:** 15 Mei 2026
**Owner:** Habe Raja (Fux), WOLFGANK
**Companion:** F1 (Doctrine + Skeleton) + F2 (Field Definitions) + F3 (Enum Registry)

---

## Apa Dokumen Ini?

Dokumen ini berisi **12 aturan operasional** yang ngatur cara Wolfbrain dijalanin sehari-hari.

Bedanya dengan F1 (Doctrine)?

| F1 Doctrine | Governance Rules |
|-------------|------------------|
| Filosofi sistem ("AI bukan mesin tebak-tebakan") | Aturan operasional ("Validator BLOCK commit kalau...") |
| Audience: semua orang | Audience: validator, extractor, developer |
| Jarang berubah | Update per version |
| Abstract / prinsip | Konkret / enforcement |

Analogi: F1 = Pancasila. Governance = KUHP.

**Hierarchy kalau ada konflik (berbeda domain — bukan vertikal):**

| Domain | Canonical Source |
|--------|------------------|
| **Field / path / structure** (apa yang ada di JSON) | **Skeleton JSON** |
| **Behavior / enforcement** (cara pakai, aturan operasional) | **Governance Rules** |
| **Vocabulary** (nilai enum yang diizinkan) | **F3 Enum Registry** |
| **Definisi field** (deskripsi tiap field) | **F2 Field Definitions** |

**Penjelasan:** Skeleton adalah canonical untuk **"apa"** (structure). Governance adalah canonical untuk **"bagaimana"** (behavior). F3 canonical untuk **"nilai apa saja"** (vocabulary). F2 canonical untuk **"arti tiap field"** (definition).

Mereka **tidak saling override** — mereka menjawab pertanyaan yang berbeda. Aturan resolusi konflik:

- Jika ada konflik tentang **field/path/structure** (misal: F2 nyebut field X, Skeleton gak punya) → **Skeleton menang**, F2 di-patch.
- Jika ada konflik tentang **cara pakai/enforcement** (misal: validator rule beda dengan Skeleton implicit) → **Governance menang**, validator ikuti Governance.
- Jika ada konflik tentang **enum value** (misal: F2 nyebut enum X, F3 gak punya) → **F3 menang**, F2 di-patch.

Code (TypeScript, validator, extractor) ikut ke 4 sumber di atas, bukan jadi sumber sendiri.

---

## Daftar 12 Aturan

| ID | Nama | Topik |
|----|------|-------|
| G1 | AI Schema Patch Prohibition | Larangan AI tools ubah schema tanpa approval |
| G2 | Versioning Discipline | 5 tipe amendment yang valid |
| G3 | min_withdraw 3-Path SSOT | Field WD threshold 3 lokasi resmi |
| G4 | unmodeled_evidence_block Discipline | Aturan pakai escape hatch |
| G5 | Reward Block Placement | Anti-overlap reward blocks |
| G6 | Coverage Claim Discipline | Jangan klaim "X promo Y brand" tanpa audit trail |
| G7 | record_type Discipline | 3 jenis record + behavior |
| G8 | Doctrine-Code Sync Sequence | Urutan update 15-step |
| G9 | Authority Layers | PRIMARY / OPERATIONAL / AUXILIARY / DERIVED |
| G10 | event_block Placement | Anti dumping ke event_block |
| G11 | Extractor No-Regex Doctrine | Larangan keras regex/keyword matcher |
| G12 | Status Lifecycle | 5-state transition |

---

# Rule G1 — AI Schema Patch Prohibition

**Masalah:** AI tools (Lovable, Claude session baru, Cursor, agent apapun) suka **patch schema diam-diam** waktu kerja. Akibatnya schema drift dari approved doctrine.

**Aturan:**

> **AI tools DILARANG patch schema tanpa:**
> 1. Approval eksplisit Habe Raja
> 2. F2 doctrine update FIRST
> 3. Schema_version bump
> 4. Coverage justification minimal 3 promo sample

### Yang masuk kategori "patch schema"
- Tambah field baru di engine existing
- Hapus field
- Rename field
- Tambah block baru
- Tambah engine baru
- Ubah type field (e.g. string → number)
- Tambah enum value baru

### Yang BUKAN patch schema (boleh tanpa approval)
- Fix typo di doctrine
- Improve documentation
- Tambah example di doctrine
- Reformat dokumen

### Violation Handling

Kalau AI tool patch schema tanpa approval:
1. **Revert** semua perubahan
2. **Audit** scope perubahan
3. **Report** ke Habe Raja
4. Restart kerja dari last approved state

### Cerita lesson learned (Phase D5.1)

Di session sebelumnya, extractor pakai prompt rule untuk paksa `min_withdraw` di-extract. Tapi field tetap drop karena schema gak define field-nya.

**Lesson:** Jangan bandaid via prompt engineering. Fix root cause di schema/doctrine.

---

# Rule G2 — Versioning Discipline

**Masalah:** Tanpa disiplin versi, dokumen bisa drift dari schema. Atau ada perubahan besar yang di-label "patch" sehingga skip review.

**Aturan:** Setiap perubahan schema HARUS pakai salah satu dari 5 amendment_type berikut:

| Amendment Type | Scope | Contoh | Requires |
|----------------|-------|--------|----------|
| `patch` | Bug fix, typo, dokumentasi | Fix typo di F2 | Self-approve |
| `minor_substantive` | Tambah enum value, klarifikasi semantik | Tambah `streak_ladder` ke F3 | Approval Habe Raja |
| `major_minor_version` | Naming cleanup, duplicate removal | V.10 → V.10.1 | Approval Habe Raja + F2 update |
| `major_schema_expansion` | Tambah engine baru, block baru | V.10.1 → V.10.2 | Approval Habe Raja + F2 update + coverage justification 3+ promo |
| `major_breaking` | Hapus field, rename field, ubah type | V.10 → V.11 (hypothetical) | Approval Habe Raja + migration plan + backward compatibility note |

**V.10.2 = `major_schema_expansion`.** Backward compatible strictly additive — semua field V.10.1 tetap berlaku.

### Anti-pattern

❌ **Label perubahan besar sebagai "patch"** untuk skip review process.
❌ **Bump version tanpa change documentation** di CHANGELOG.
❌ **Multiple amendment types dalam 1 release** (bingung audience).

---

# Rule G3 — min_withdraw 3-Path SSOT

**Masalah:** Di V.10.1, field `min_withdraw` ada di `reward_engine.requirement_block`. Tapi semantically aneh — min WD itu syarat **klaim**, bukan syarat reward.

Akibatnya: bingung sendiri. Danila baca dari mana? Extractor isi yang mana?

**Aturan:**

> Di V.10.2, `min_withdraw_for_claim` ada di **3 path resmi**. Field lama di `reward_engine.requirement_block` **DIHAPUS**.

### 3 Path Resmi

| Path | Semantik | Authority |
|------|----------|-----------|
| `claim_engine.claim_gate_block.min_withdraw_for_claim` | GLOBAL claim gate | PRIMARY |
| `variant_engine.items_block.subcategories[i].claim_gate_block.min_withdraw_for_claim` | PER-VARIANT (override global) | PRIMARY |
| `projection_engine.summary_block.min_withdraw` | DERIVED — AI dilarang tulis langsung | DERIVED |

### Forbidden Path

❌ **`reward_engine.requirement_block.min_withdraw`** — DELETED V.10.2.

Validator **BLOCK commit** kalau field ini ada di JSON.

### Decision Tree untuk Extractor

```
Promo mention "minimal WD X biar bisa claim"?
├─ Single-mode promo?
│   └─ Isi: claim_engine.claim_gate_block.min_withdraw_for_claim
│
└─ Multi-variant promo?
    ├─ Min WD sama untuk semua varian?
    │   └─ Isi: claim_engine.claim_gate_block.min_withdraw_for_claim (global)
    │
    └─ Min WD beda per varian?
        └─ Isi: subcategories[i].claim_gate_block.min_withdraw_for_claim (per-varian)
            (Per-variant menang atas global.)
```

### Projection Derivation Rule

`projection_engine.summary_block.min_withdraw` di-derive otomatis:

```
IF variant_engine.summary_block.has_subcategories = true:
    1. subcategories[default_variant_id].claim_gate_block.min_withdraw_for_claim
    2. Fallback: claim_engine.claim_gate_block.min_withdraw_for_claim
ELSE:
    1. claim_engine.claim_gate_block.min_withdraw_for_claim
    2. Fallback: null
```

**Validator BLOCK commit** kalau extractor write detected di projection path.

---

# Rule G4 — unmodeled_evidence_block Discipline

**Masalah:** Kalau AI nemu data di promo tapi belum ada field di skema, dia harus taruh di mana?

Di V.10.1, jawabannya: `_extensions: {}` per engine. Masalahnya: jadi tempat sampah, gak ada governance.

**Aturan V.10.2:**

> `_extensions` per engine DIHAPUS. Diganti dengan **`meta_engine.unmodeled_evidence_block`** yang centralized + structured + ada workflow.

### Lokasi

`meta_engine.unmodeled_evidence_block.items[]`

### Schema item

```json
{
  "evidence_id": "",
  "captured_at": "",
  "captured_by": "",
  "field_candidate": "",
  "source_text": "",
  "reason_not_modeled": "",
  "suggested_engine": "",
  "suggested_path": "",
  "occurrence_count": null,
  "requires_schema_review": true,
  "review_status": "pending",
  "promoted_to_field": ""
}
```

### 10 Hard Constraints

1. **BUKAN** sumber kebenaran — Danila gak baca, Form Wizard gak tampilin
2. **HANYA** untuk audit + temporary capture sebelum schema promotion
3. AI extractor **DILARANG** nulis ke `unmodeled_evidence_block` otomatis tanpa Human override
4. Setiap write WAJIB di-log di `_human_override_log[]`
5. **GAK** ada `_extensions` per engine di V.10.2 — semua data centralized di sini
6. `field_candidate` WAJIB diisi (mau jadi field apa kalau di-promote)
7. `source_text` WAJIB diisi (kutipan verbatim dari promo)
8. `reason_not_modeled` WAJIB diisi (kenapa gak fit ke field existing)
9. `occurrence_count` di-track untuk promotion decision
10. `promoted_to_field` diisi setelah promotion approved + jadi field di V.X.Y

### Promotion Workflow

| Frequency | Action |
|-----------|--------|
| 1-2 records | Stay (anekdot, gak action) |
| 3+ records, 1 brand | Stay (brand-specific) |
| **3+ records, 2+ brand** | **TRIGGER promotion review** → Habe Raja review → approve/reject |

Kalau approved → jadi field resmi di V.X.Y berikutnya, `promoted_to_field` diisi.

---

# Rule G5 — Reward Block Placement (Anti-Overlap)

**Masalah:** `reward_engine` punya 7 block reward (`event_block`, `combo_reward_block`, `reward_table_block`, `matrix_reward_block`, `conditional_reward_block`, `unit_reward_block`, `turnover_tier_by_deposit_block`). Plus 1 block tier di engine lain (`taxonomy_engine.tier_threshold_block`). Tanpa governance, extractor bisa enable 2-3 block bersamaan untuk 1 promo → conflicting data.

> **Catatan placement:** `tier_threshold_block` ada di `taxonomy_engine` (BUKAN `reward_engine`). Itu untuk simple tier/range logic — placement-nya di taxonomy karena dia bagian dari struktur taxonomy promo, bukan reward calculation langsung.

**Aturan:**

> Untuk 1 promo, **HANYA 1 reward block utama** yang boleh enabled.
>
> Block yang punya `enabled` flag (boolean): `tier_threshold_block`, `reward_table_block`, `matrix_reward_block`, `unit_reward_block`, `turnover_tier_by_deposit_block`.
>
> Block tanpa `enabled` flag tapi dianggap "enabled" kalau isinya non-empty: `event_block` (cek `event_rewards` / `prizes` non-empty), `combo_reward_block` (cek `combo_items` non-empty), `conditional_reward_block` (cek `conditions` non-empty).
>
> Validator **BLOCK commit** kalau detected 2+ reward block dianggap aktif (baik via `enabled = true` atau isi non-empty).

### 5.1 — Decision Tree

```
Reward pattern apa?
├─ Fixed value (50k cashback)
│   └─ Cuma `event_block` aja, semua block lain disabled
│
├─ 1-dim ladder (turnover → reward)
│   └─ `reward_table_block` enabled
│
├─ 2-dim matrix (stake × symbol)
│   └─ `matrix_reward_block` enabled
│
├─ Per-unit additive (per kartu merah)
│   └─ `unit_reward_block` enabled
│
├─ Simple tier (cashback 5/7/10%)
│   └─ `taxonomy_engine.tier_threshold_block` enabled
│
├─ Combo (mobil + cash)
│   └─ `combo_reward_block` enabled
│
├─ Conditional (JIKA/MAKA)
│   └─ `conditional_reward_block` enabled
│
└─ Turnover tier by deposit
    └─ `turnover_tier_by_deposit_block` enabled
```

### 5.2 — Forbidden Combinations

❌ `reward_table_block.enabled = true` + `matrix_reward_block.enabled = true`
❌ `unit_reward_block.enabled = true` + `reward_table_block.enabled = true`
❌ `tier_threshold_block.enabled = true` + `reward_table_block.enabled = true`

### 5.3 — Validator Rule

```
IF count(reward_block.enabled = true) > 1:
    BLOCK COMMIT
    ERROR: "Multiple reward blocks enabled — only 1 allowed per promo"
```

### 5.4 — Edge Case: Multi-Variant

Kalau `promo_mode = "multi"` dan varian beda punya reward pattern beda → tetap **1 block utama di reward_engine** (sebagai default), variants override via `subcategories[i]`.

### 5.5 — Examples (corpus-validated)

| Promo | Block | Reason |
|-------|-------|--------|
| PRESIDENSLOT Turnover Slot (15 tier reward) | `reward_table_block` | 1-dim ladder |
| OLXTOTO Scatter Mahjong (stake × scatter) | `matrix_reward_block` | 2-dim matrix |
| CITRA77 Welcome Bonus (6 variants) | `variant_engine.subcategories[]` | User-choice variants |
| TARUHANBOLA Red Card | `unit_reward_block` | Per-unit accumulative |
| OLXTOTO Cashback Live (5/7/10%) | `tier_threshold_block` | Simple 1-input → 1-output |
| CITRA77 Loyalty Point Exchange | `loyalty_engine.exchange_block` | Point redemption |
| CITRA77 Referral 15% | `referral_engine` | Commission structured |
| OLXTOTO Mystery Number | `result_event_engine.prize_block` | Lottery result match |
| BOSTONTOTO Referral Togel 0.5% | `referral_engine.commission_rule_block` | Per-market commission |
| TARUHANBOLA Winstreak Bola Jalan | `reward_table_block` (streak_ladder) | 1-dim streak ladder — see Section 5.6 |

### 5.6 — Note on Winstreak/Losestreak Events (V.10.2)

**Locked decision:** Winstreak dan losestreak events di V.10.2 **WAJIB** dimodelkan menggunakan `reward_engine.reward_table_block`, **BUKAN** engine terpisah.

**Konfigurasi yang benar:**

```
reward_engine.reward_table_block:
  enabled: true
  table_type: "streak_ladder"
  basis: "streak_count" / "winstreak_count" / "losestreak_count"
  rows[]:
    trigger_count: <streak length>
    trigger_count_unit: "consecutive_wins" / "consecutive_losses"
    reward_amount: <per tier reward>
```

**Qualification rules (min_stake, min_odds, allowed markets):**
- `scope_engine.bet_configuration_block.min_stake`
- `scope_engine.odds_constraint_block.min_odds` / `max_odds`
- `scope_engine.game_block.market_types[]` / `bet_types[]`

**Reset condition** (e.g., "streak reset kalau kalah/seri") → dokumentasi di `terms_engine.conditions_block.terms_conditions[]` (narrative).

**Larangan keras:**
- ❌ JANGAN tambah `streak_engine`, `sequence_engine`, atau engine terpisah lainnya untuk winstreak di V.10.2 (violate G1)
- ❌ JANGAN paksa winstreak ke `unit_reward_block` (winstreak bukan per-unit additive — ada loncatan non-linear)
- ❌ JANGAN paksa winstreak ke `result_event_engine` (winstreak bukan event tunggal — adalah sequence)

**Roadmap V.10.3 (conditional):**

`streak_engine` atau `sequence_engine` cuma dipertimbangkan masuk V.10.3 kalau:
- Pattern winstreak/losestreak muncul di **3+ promo**
- Across **2+ brand**
- Dengan complexity yang **gak fit** di `reward_table_block` existing

Per G4 promotion workflow — saat ini baru 1 promo dari TARUHANBOLA → belum cukup evidence.

---

# Rule G6 — Coverage Claim Discipline

**Masalah:** Klaim *"X promo across Y brand"* tanpa audit trail = gak bisa diverifikasi.

**Aturan:**

1. **Jangan tulis angka validasi** di `amendment_reason` kecuali ada Coverage Map yang shipped sebagai deliverable.
2. **Kalau ada Coverage Map:** reference path-nya di field metadata `schema_block`.
3. **Kalau gak ada:** pakai phrasing deskriptif tanpa angka.

### V.10.2 Status

V.10.2 stress-tested 78 promos × 4 brand (PRESIDENSLOT 11, CITRA77 14, OLXTOTO 25, TARUHANBOLA 28) + BOSTONTOTO cross-validation. Coverage map gak shipped sebagai file terpisah — angka 78 cuma audit trail di session, gak masuk schema metadata.

`meta_engine.schema_block.amendment_reason` di V.10.2 pakai phrasing deskriptif:
*"Coverage expansion via 4 new engines + 12 new blocks + governance structural changes"*

---

# Rule G7 — record_type Discipline

**Masalah:** Beberapa konten yang masuk extractor sebenarnya **bukan promo** — kayak "Syarat & Ketentuan Bermain" yang content informational/policy. Tanpa field khusus, dia masuk daftar promo dan bikin Danila bingung.

**Aturan:**

> Setiap record WAJIB punya `meta_engine.schema_block.record_type` dengan 3 enum.

### 3 Enum

| Value | Meaning | Behavior |
|-------|---------|----------|
| `"promo"` | Standard promo record | Default. Displayed in promo listing. Available to Danila. |
| `"site_policy"` | Brand-wide policy (bukan promo) | GAK displayed di promo listing. Bisa di-reference Danila untuk policy questions. |
| `"informational"` | Content informational (transparency, anti-scam posts) | Future use. GAK displayed di promo listing. |

### Migration

- V.10.1 records (yang gak punya `record_type`) → default `"promo"`
- TARUHANBOLA #1 (*"Syarat & Ketentuan Bermain"*) → kandidat re-classify ke `"site_policy"`

### Downstream Behavior

| record_type | Promo listing | Search index | Form Wizard | Danila baca? |
|-------------|---------------|--------------|-------------|--------------|
| `promo` | YES | YES | YES | YES (default behavior) |
| `site_policy` | NO | YES (separate index) | NO | YES (untuk policy questions) |
| `informational` | NO | TBD | NO | TBD |

---

# Rule G8 — Doctrine-Code Sync Sequence

**Masalah:** Kalau update schema dilakukan secara acak (kadang code dulu, kadang doctrine dulu), ujungnya drift.

**Aturan:** Setiap schema update WAJIB ikutin 15-step sequence ini:

```
1.  F2 Field Definitions — update first
2.  Skeleton JSON — sync dengan F2
3.  Governance Rules — update kalau ada rule baru/revisi
4.  F3 Enum Registry — sync enum baru
5.  F4 Form Mapping — update form mapping
6.  TypeScript schema — generate dari Skeleton
7.  Extractor JSON schema — sync dengan Skeleton
8.  Contract files (extractors/contracts/) — update kalau ada hard invariant baru
9.  Selectors — update read path
10. Validator rules — sync dengan Governance
11. Form Wizard UI — sync dengan F4 + Skeleton
12. Sample test — bikin 5+ promo per brand di V.X.Y
13. Manual QA — Habe Raja review sample
14. Production deploy — kalau QA pass
15. Promote `candidate_locked` → `locked` — Habe Raja stamp final
```

### V.10.2 Progress

| Step | Status |
|------|--------|
| 1. F2 Field Definitions | ✅ DONE |
| 2. Skeleton JSON | ✅ FROZEN (SHA 1732aafb92e4a87d) |
| 3. Governance Rules | ✅ DONE (this document) |
| 4. F3 Enum Registry | ✅ DONE |
| 5. F4 Form Mapping | ⏳ NEXT |
| 6-13. Code sync & deploy | ⏳ PENDING |
| 14. Production deploy | ⏳ PENDING |
| 15. `locked` stamp | ⏳ PENDING |

---

# Rule G9 — Authority Layers

**Masalah:** Tanpa hierarchy yang jelas, Danila bingung baca dari mana. Form Wizard tampilin yang mana. Validator validate yang mana.

**Aturan:** 4-layer hierarchy LOCKED.

### 4 Authority Layers

| Layer | Engines | Role | Behavior |
|-------|---------|------|----------|
| **PRIMARY** (21 engines) | identity, classification, taxonomy, period, time_window, trigger, claim, proof, payment, scope, reward, ticket, loyalty, referral, result_event, fulfillment, variant, dependency, invalidation, terms, risk | Sumber kebenaran resmi | Danila baca dari sini. Form Wizard display dari sini. Validator validasi di sini. |
| **OPERATIONAL** | readiness, meta | Lifecycle + metadata | Bukan business data. Untuk operator/sistem. |
| **AUXILIARY** | reasoning, **mechanics** | Catatan kerja (audit/debug) | Danila GAK baca. Form Wizard GAK display. Kalau bentrok dengan PRIMARY → PRIMARY menang. |
| **DERIVED** | projection | Hasil hitungan otomatis (read-only) | Read-only. Extractor DILARANG nulis langsung. |

### 9.1 — mechanics_engine = AUXILIARY (perubahan dari V.10.1)

V.10.1 dulu bilang `mechanics_engine = truth #1`. V.10.2 pindah ke AUXILIARY.

**Kenapa?**
- Goal V.10.2: Supabase `record_json` jadi canonical brain dengan **single source of truth per question**
- Kalau Danila baca dari mechanics + reward + claim + variant paralel → confused
- Dengan mechanics di AUXILIARY, Danila punya read path jelas: typed engines

Analogi: kayak corat-coret kasir di balik struk. Ada gunanya untuk audit, tapi yang resmi tetap struk-nya.

### 9.2 — Behavior LOCKED

| Aspek | V.10.1 | V.10.2 |
|-------|--------|--------|
| Authority `mechanics_engine` | Truth #1 | **AUXILIARY** |
| Danila baca? | YA | **GAK** |
| Form Wizard tampilin? | YA | **GAK** |
| Validator wajib? | YA | **OPTIONAL** |
| `items: []` kosong? | Warning | **Allowed** |
| Bentrok dengan typed engine? | mechanics menang | **typed engine MENANG** |

### 9.3 — Reasoning Engine

`reasoning_engine` di V.10.1 sudah AUXILIARY. V.10.2 lock konsisten — jejak pemikiran AI, audit trail, BUKAN data bisnis.

### 9.4 — Projection Engine

`projection_engine` adalah **DERIVED ONLY**. AI extractor **DILARANG** tulis langsung ke projection paths.

Generated post-extraction dari engine PRIMARY.

**Validator BLOCK commit** kalau extractor write detected di projection paths.

---

# Rule G10 — event_block Placement (Anti-Dumping)

**Masalah:** `reward_engine.event_block` dulu suka jadi tempat sampah karena namanya generic ("event"). Extractor enable apa aja masuk situ.

**Aturan:**

> `event_block` HANYA untuk **reward utama berbentuk daftar event spesifik** (e.g., event name + reward per event).
>
> Untuk pola reward lain (ladder, matrix, unit, tier), pakai block yang dedicated.

### Decision Tree

```
Pola reward apa?
├─ Daftar event dengan reward per event spesifik?
│   └─ `event_block.event_rewards[]` + `prizes[]`
│
├─ 1-dim ladder?
│   └─ `reward_table_block`
│
├─ 2-dim matrix?
│   └─ `matrix_reward_block`
│
├─ Per-unit additive?
│   └─ `unit_reward_block`
│
├─ Simple tier?
│   └─ `taxonomy_engine.tier_threshold_block`
│
└─ Other → cek 8 reward block lain di G5
```

### Anti-Pattern

❌ Enable `event_block` + `reward_table_block` bersamaan untuk 1 promo (violate G5)
❌ Pakai `event_block` untuk simple cashback 5% (over-engineering)
❌ Pakai `event_block` untuk 1-dim ladder (pakai `reward_table_block`)

---

# Rule G11 — Extractor No-Regex Doctrine

**Masalah:** Kalau extractor pakai regex/keyword matcher, dia jadi mesin pattern matching — bukan reasoning. Hasilnya: brittle, mudah salah, gak scalable.

**Aturan:**

> Extractor baca promo dengan **SEMANTIC UNDERSTANDING**, bukan pattern matching. Cross-reference: F1 Aturan 8.2.

### 11.1 — Hard Constraints

DILARANG KERAS:
- ❌ No regex untuk extraction logic
- ❌ No keyword matcher untuk klasifikasi
- ❌ No hardcoded promo-type branching
- ❌ No post-processing override (ubah output AI setelah extraction)
- ❌ No default angka palsu (field gak boleh diisi 0/default kalau gak disebut)
- ❌ No kalkulasi kecuali eksplisit (cuma kalau promo memang ngasih kalkulasi)
- ❌ No prompt-engineering hack untuk paksa output

WAJIB:
- ✅ Reasoning-first
- ✅ Evidence-based (verbatim quote)
- ✅ Context-aware
- ✅ Null > guessing

### 11.2 — Validator Detection

Validator BOLEH flag extractor session sebagai **SUSPICIOUS** kalau:

| Pattern | Threshold |
|---------|-----------|
| Output field match regex pattern yang sama persis dengan source | 3+ field per session |
| Multiple promo dengan structure berbeda tapi output identik | 2+ promo |
| Field di-isi tanpa evidence text di companion log | 1+ field |

### 11.3 — Anti-Pattern (D5.1 Lesson Learned)

Di Phase D5.1 sebelumnya, extractor pakai prompt rule R5(a) untuk paksa `min_withdraw` di-extract via keyword. Tapi field tetap drop di output.

**Root cause:** schema gak define field — bukan prompt issue.

**Lesson:** **jangan bandaid dengan prompt engineering atau regex**. Fix root cause di schema/doctrine.

### 11.4 — Apply ke Engine V.10.2

Semua engine V.10.2 — terutama yang punya structured data complexity:

| Engine | Risk Area |
|--------|-----------|
| `claim_engine.claim_gate_block` | Claim gate evidence harus semantic, bukan keyword "WD" / "TO" / "deposit" |
| `reward_engine.reward_table_block` | Tabel reward harus dipahami struktur, bukan regex row parsing |
| `referral_engine.commission_rule_block` | Commission rule harus dipahami per game_type/market, bukan keyword "referral 5%" |
| `result_event_engine.prize_block` | Prize differentiation (main vs consolation) harus dipahami eligibility-nya, bukan keyword "hadiah utama" |

---

# Rule G12 — Status Lifecycle

**Masalah:** Tanpa lifecycle yang jelas, susah audit di tahap mana schema sekarang.

**Aturan:** Schema status WAJIB pakai 5-state lifecycle berikut.

### 5 States

```
draft → candidate_locked → review_pending → locked → deprecated
```

| State | Meaning | Allowed Actions |
|-------|---------|-----------------|
| `draft` | Work-in-progress, struktur belum stable | Modify freely |
| `candidate_locked` | Struktur locked, butuh QA + Habe Raja review | Patch bug ONLY (no structural change) |
| `review_pending` | QA pass, menunggu Habe Raja sign-off final | No modification |
| `locked` | Production-ready, deployed | Cuma `patch` amendment_type yang diizinkan |
| `deprecated` | Diganti versi baru, read-only mode | No write |

### V.10.2 Current State

V.10.2 saat ini di state `candidate_locked`.

**Transition workflow:**
- `candidate_locked` → `review_pending`: Setelah F4 selesai + sample test 5+ promo per brand pass
- `review_pending` → `locked`: Habe Raja sign-off final + production deploy
- `locked` → `deprecated`: Diganti V.10.3 atau V.11

### Forbidden Transitions

❌ `draft` → `locked` (skip review)
❌ `locked` → `candidate_locked` (rollback)
❌ Skip `review_pending`

---

# Changelog

## V.10.2 (15 Mei 2026)

Versi pertama Governance Rules document.

**12 rules locked:**

| Rule | Topic |
|------|-------|
| G1 | AI Schema Patch Prohibition |
| G2 | Versioning Discipline |
| G3 | min_withdraw 3-Path SSOT |
| G4 | unmodeled_evidence_block Discipline |
| G5 | Reward Block Placement (+ Section 5.6 Winstreak Note added Decision 001) |
| G6 | Coverage Claim Discipline |
| G7 | record_type Discipline |
| G8 | Doctrine-Code Sync Sequence |
| G9 | Authority Layers |
| G10 | event_block Placement |
| G11 | Extractor No-Regex Doctrine |
| G12 | Status Lifecycle |

**Approved by:** Habe Raja (Fux), WOLFGANK
**Date:** 15 Mei 2026
**Status:** locked

---

*PKB_Wolfbrain | Governance Rules V.10.2 | 15 Mei 2026 | Habe Raja*
