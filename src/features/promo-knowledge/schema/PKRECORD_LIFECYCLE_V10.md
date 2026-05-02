# pkRecord Lifecycle & UI Read Contract V10

**Status:** DESIGN ONLY — no implementation in this pass.
**Pre-req for:** Step 8 (UI Rebind to V10 selectors).
**Owner section:** `src/components/VOCDashboard/PseudoKnowledgeSection.tsx`.

---

## 1. Why this exists

UI display saat ini membaca leaf dari `mappedPreview` (V.09 `PromoFormData`).
Selector V10 (`luckySpinRefId`, `physicalItemName`, dll) butuh `PkV10Record`.
Sebelum rebind, kita harus jelas:

- Kapan `pkRecord` dianggap **siap** dibaca selector.
- Kapan UI boleh render hasil selector vs. tampil loading / empty state.
- Di layer mana validator dijalankan, dan apakah hasil validator gating UI.

Tanpa kontrak ini, rebind akan menghasilkan `-` di mana-mana, atau diam-diam
fallback ke `mappedPreview` (melanggar single source of truth).

---

## 2. State machine — `pkStatus`

Sumber: `PseudoKnowledgeSection.tsx` (sudah ada, tidak perlu diubah).

```
type PkStatus = "idle" | "loading" | "ready" | "failed";
```

| State      | `pkRecord` | Trigger                                        | UI behaviour (current)                         |
|------------|-----------|------------------------------------------------|------------------------------------------------|
| `idle`     | `null`    | initial mount, atau setelah `reset()`         | nothing PK-related rendered                    |
| `loading`  | `null`    | extractor dipanggil, belum balik               | timer + "PK-extractor masih jalan…" badge     |
| `ready`    | `PkV10Record` | extractor sukses, `setPkRecord(pk.record)` | gate: `pkRecord && pkStatus === "ready"`       |
| `failed`   | `null`    | extractor error / reject-gate                  | error badge, fallback message                  |

**Inv:** Hanya `ready` ⇒ `pkRecord !== null`. Sudah dipatuhi existing code
(`setPkRecord(null)` di `idle`/`failed`).

---

## 3. New phases — semantic only (no code)

Step 8 perlu **dua phase tambahan** yang sudah implicit di existing flow,
tapi belum diberi nama. Kita berikan nama supaya selector-vs-mappedPreview
keputusan jelas:

```
idle → loading → ready ──► (validated) ──► (ready_for_ui)
                  │
                  └──► failed
```

| Phase         | Definition                                                                                  | Computed from                              |
|---------------|---------------------------------------------------------------------------------------------|---------------------------------------------|
| `validated`   | `pkRecord !== null` AND `validatePkV10Invariants(pkRecord).ok === true` (no ERROR-severity).| run validator on each `pkRecord` change.    |
| `ready_for_ui`| `pkStatus === "ready"` AND `validated === true`.                                            | derived gate; no new state variable needed. |

**Penting:**
- `validated` TIDAK dipublikasi sebagai state variable baru. Dia adalah
  **derived value** dari `validatePkV10Invariants(pkRecord)`.
- `ready_for_ui` TIDAK dipublikasi. Dia adalah **gate condition** yang
  selector consumer cek inline.
- WARNING-severity invariants TIDAK menutup gate. Hanya ERROR-severity yang
  menutup.

---

## 4. Selector read contract

### Rule A — When to call selector

```
if (pkStatus === "ready" && pkRecord !== null) {
  // selector boleh dipanggil
  const v = sel.physicalItemName(pkRecord);
}
```

### Rule B — When to render selector result

```
ready_for_ui = pkStatus === "ready"
            && pkRecord !== null
            && validatorErrorsForLeafPath(path) === 0;
```

Per leaf, kalau invariant ERROR menyentuh path tersebut → render `-` atau
empty state, jangan render value yang tahu-tahu salah.

### Rule C — Fallback policy

**ZERO fallback ke `mappedPreview` di leaf yang sudah di-rebind.**
Kalau selector return `null`:
- string → `"-"`
- number → `"-"`
- boolean unlimited flags → `false` (selector sudah default false)

`mappedPreview` boleh tetap dipakai untuk leaf yang BELUM di-rebind di Step 8.

---

## 5. Validator placement

| Layer                    | When validator runs                                  | Severity routed where                |
|--------------------------|------------------------------------------------------|--------------------------------------|
| Extractor result handler | Once after `setPkRecord(pk.record)`                  | log + display warnings panel         |
| Pre-render (UI)          | Memoized per `pkRecord` change                       | gate `ready_for_ui` (ERROR only)     |
| Pre-publish              | Hard gate sebelum write ke storage                   | block jika ERROR > 0                 |

Step 8 **hanya** menggunakan layer "Pre-render". Layer "Pre-publish" sudah
sebagian ada di `handleSave` (PHASE 2 commit), tidak diubah di Step 8.

---

## 6. UI gate matrix (ringkas)

| Condition                                            | UI shows                          |
|------------------------------------------------------|-----------------------------------|
| `pkStatus === "idle"`                                | nothing PK                        |
| `pkStatus === "loading"`                             | loading badge                     |
| `pkStatus === "failed"`                              | error badge                       |
| `pkStatus === "ready"` & `pkRecord === null`         | impossible (invariant)            |
| `pkStatus === "ready"` & validator ok                | render via selectors (no fallback)|
| `pkStatus === "ready"` & validator ERROR on leaf X   | leaf X → `-`; siblings tetap render |

---

## 7. Leaf 1:1 mapping audit (8 leaf dari Step 8 scope) — REVISED

**Revision note (post-review):** Klasifikasi sebelumnya keliru menggabungkan
3 kasus ke "AMBIGUOUS". Setelah dibedah, hanya 2 yang benar-benar ambiguous
(spin validity); sisanya adalah **semantic-layer separation** yang sudah
deterministic begitu rule berikut diadopsi:

### 7.1 Semantic UI Rules (LOCKED)

**Rule SEM-1 — "Waktu Berlaku" tidak boleh satu label untuk dua konsep.**
Label tunggal "Waktu Berlaku" wajib dipecah menjadi 2 label berbeda di UI:

| UI label                 | Source V10                                                     | Layer          |
|--------------------------|----------------------------------------------------------------|----------------|
| **"Promo Berlaku"**      | `period_engine.validity_block.valid_until` (+ `_unlimited`)    | promo-level    |
| **"Reward Berlaku"**     | `mechanics_engine.items[scope==="reward_validity"].validity.*` | reward-level   |

Sampai UI dipecah, **jangan rebind** spin/reward validity.

**Rule SEM-2 — `physicalQuantity` adalah DIRECT + GUARDED.**
Bukan ambiguous. Selector dipanggil dengan guard:
```
if (rewardType !== "physical") return null;
return sel.physicalQuantity(rec);
```

**Rule SEM-3 — `validUntilUnlimited` adalah promo-level, BUKAN reward-level.**
- `sel.validUntilUnlimited` → `period_engine` ONLY (promo "Promo Berlaku").
- `sel.spinValidUntilUnlimited` → `mechanics_engine` ONLY (reward "Reward Berlaku").
Dua selector berbeda, dua label berbeda, tidak boleh dicampur.

### 7.2 Final classification table

| # | Leaf / UI                              | V10 selector                 | Class                  | Guard / Note                                                  |
|---|----------------------------------------|------------------------------|------------------------|---------------------------------------------------------------|
| 1 | "ID Lucky Spin"                        | `sel.luckySpinRefId`         | **DIRECT**             | Gate JSX `rewardType === 'lucky_spin'` (sudah ada).           |
| 2 | "Max Spin/Hari"                        | `sel.luckySpinMaxPerDay`     | **DIRECT**             | Same gate.                                                    |
| 3 | "Hadiah Fisik" name                    | `sel.physicalItemName`       | **DIRECT**             | Gate JSX `rewardType === 'physical'`.                         |
| 4 | "Hadiah Fisik" quantity                | `sel.physicalQuantity`       | **AMBIGUOUS — TUNDA**  | Lihat catatan §7.4. Tidak ada leaf JSX physical quantity.     |
| 5 | `max_reward_unlimited` flag            | `sel.maxRewardUnlimited`     | **AMBIGUOUS — TUNDA**  | Lihat catatan §7.5. Tidak ada leaf JSX record-level total cap.|
| 6 | "Promo Berlaku" unlimited (period)     | `sel.validUntilUnlimited`    | **AMBIGUOUS — TUNDA**  | Lihat catatan §7.6. Tidak ada leaf JSX promo-level "Promo Berlaku". |
| 7 | "Reward Berlaku" date (spin)           | `sel.spinValidUntil`         | **AMBIGUOUS — TUNDA**  | Tunggu UI dipecah per Rule SEM-1.                             |
| 8 | "Reward Berlaku" unlimited (spin)      | `sel.spinValidUntilUnlimited`| **AMBIGUOUS — TUNDA**  | Tunggu UI dipecah per Rule SEM-1.                             |

### 7.3 Verdict scope Step 8 — CLOSED

**SUCCESS (rebound to V10 selectors):**
1. `sel.luckySpinRefId` ✅ (Step 8A done)
2. `sel.luckySpinMaxPerDay` ✅ (Step 8B done)

**TUNDA (deferred — UI semantic slot belum tersedia):**
3. `sel.physicalItemName` (Step 8C — SKIPPED, tidak ada DIRECT leaf record-level)
4. `sel.physicalQuantity` (Step 8D — SKIPPED, lihat §7.4)
5. `sel.maxRewardUnlimited` (Step 8E — SKIPPED, lihat §7.5)
6. `sel.validUntilUnlimited` (Step 8F — SKIPPED, lihat §7.6)
7. `sel.spinValidUntil` — tunggu UI dipecah per Rule SEM-1
8. `sel.spinValidUntilUnlimited` — tunggu UI dipecah per Rule SEM-1

**Alasan umum TUNDA:** Selector layer sudah benar dan typed. Yang belum ada
adalah **semantic slot** di UI: layout saat ini tidak menyediakan leaf JSX
yang sesuai untuk konsep promo-level (Promo Berlaku, Max Total Reward) dan
physical-reward detail (item name + quantity di branch `rewardType === 'physical'`).

Block ini di-unblock setelah leaf JSX yang sesuai ditambahkan di **next phase:
"Design UI semantic layer"** (separate design pass, di luar Step 8).

### 7.4 Catatan: kenapa `physicalQuantity` direklasifikasi (Step 8D — SKIP)

"Jumlah Reward" di UI saat ini (line ~1175 `PseudoKnowledgeSection.tsx`)
merepresentasikan **unit-based quantity** (lucky_spin, voucher, ticket),
bukan physical quantity. Branch JSX ini di-gate oleh `isUnitBased`, yang
secara eksplisit **mengecualikan** `rewardType === 'physical'`.

`sel.physicalQuantity` (V10) adalah jumlah item fisik (`reward_type === 'physical'`)
dan belum memiliki leaf JSX yang sesuai di layout saat ini.

Untuk menggunakan `sel.physicalQuantity`:
- Dibutuhkan **leaf baru** di branch `rewardType === 'physical'`.
- **Tidak dilakukan di Step 8** (no layout change rule).

Konsekuensi: Rule SEM-2 (lihat §7.1) tetap valid sebagai kontrak selector
guard, tapi tidak ada consumer UI di Step 8 yang memanggilnya.

### 7.5 Catatan: kenapa `maxRewardUnlimited` direklasifikasi (Step 8E — SKIP)

`maxRewardUnlimited` = **record-level total reward cap** (apakah jumlah total
reward yang bisa dibagikan di promo ini unlimited).

UI saat ini **tidak punya leaf 1:1** untuk konsep itu. Kandidat yang ditolak:
- **Line 938** → `max_per_day` / rate limit (per hari), bukan total cap.
- **Line 962–967** → per-sub max bonus / unlimited (sub-level APK flags),
  bukan record-level engine flag.
- **Line 977** → fallback string literal, bukan flag-driven source.

Force-rebind ke salah satu line di atas akan melanggar SEM rule (semantic
collision: rate-limit vs total-cap, sub-level vs record-level).

Untuk menggunakan `sel.maxRewardUnlimited`:
- Dibutuhkan **leaf baru record-level** seperti "Max Total Reward".
- **Tidak dilakukan di Step 8** (no layout change rule).

### 7.6 Catatan: kenapa `validUntilUnlimited` direklasifikasi (Step 8F — SKIP)

`validUntilUnlimited` adalah **promo-level** (`period_engine.validity_block`),
bukan reward-level. UI saat ini hanya memiliki leaf "Waktu Berlaku" di
**dalam loop reward**, yang membaca voucher/spin validity (reward-level).
Tidak ada leaf promo-level untuk "Promo Berlaku".

Force-rebind ke leaf yang ada akan melanggar:
- **SEM-1** — "Promo Berlaku" ≠ "Reward Berlaku" (label collision).
- **SEM-3** — period validity ≠ reward validity (layer collision).

Untuk menggunakan `sel.validUntilUnlimited`:
- Dibutuhkan **leaf baru promo-level** "Promo Berlaku" di header / period
  section (di luar reward loop).
- **Tidak dilakukan di Step 8** (no layout change rule).

---

## 8. Anti-patterns (Step 8 hard rules)

- ❌ Tidak boleh dual-read (selector OR mappedPreview). Pilih satu per leaf.
- ❌ Tidak boleh fallback ke `mappedPreview` kalau selector return null.
- ❌ Tidak boleh refactor `mappedPreview` itself di Step 8.
- ❌ Tidak boleh ubah `pkStatus` state machine.
- ❌ Tidak boleh tambah state variable baru (`validated`, `ready_for_ui` adalah derived).
- ❌ Tidak boleh sentuh leaf AMBIGUOUS (#7, #8).
- ❌ Tidak boleh pakai 1 label "Waktu Berlaku" untuk dua konsep (Rule SEM-1).
- ❌ Tidak boleh panggil `physicalQuantity` tanpa guard `rewardType === "physical"` (Rule SEM-2).
- ❌ Tidak boleh tukar `validUntilUnlimited` ↔ `spinValidUntilUnlimited` (Rule SEM-3).

---

## 9. Status & Step 8 entry criteria

1. ✅ Lifecycle phases (`validated`, `ready_for_ui` sebagai derived) — APPROVED.
2. ✅ Zero-fallback policy — APPROVED.
3. ✅ Semantic UI rules SEM-1 / SEM-2 / SEM-3 — LOCKED.
4. ✅ Final classification: **DIRECT executable = 3 (8A, 8B, 8F), SKIPPED = 3 (8C, 8D, 8E), AMBIGUOUS = 2 (spin validity)**.
5. ⏳ Step 8 execution: per-leaf, incremental, diff kecil. Lanjut Step 8F (`validUntilUnlimited`).
6. ⏳ Lokasi exact `validUntilUnlimited` di JSX akan dikonfirmasi via grep saat Step 8F mulai.

Step 8 sekarang **deterministic dan aman dieksekusi** untuk leaf DIRECT yang tersisa.
