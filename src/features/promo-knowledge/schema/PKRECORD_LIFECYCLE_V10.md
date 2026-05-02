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

## 7. Leaf 1:1 mapping audit (8 leaf dari Step 8 scope)

Klasifikasi per requested leaf:

- **DIRECT 1:1** — boleh rebind di Step 8.
- **AMBIGUOUS** — semantik V10 ↔ V.09 belum jelas, jangan rebind.
- **MISSING** — V10 source belum ada, jangan rebind.

| # | UI display location                            | V.09 source (current)                      | V10 selector              | Class       | Note                                                                 |
|---|------------------------------------------------|--------------------------------------------|---------------------------|-------------|----------------------------------------------------------------------|
| 1 | "ID Lucky Spin" (line ~1189)                   | `mappedPreview.fixed_lucky_spin_id`        | `sel.luckySpinRefId`      | DIRECT 1:1  | Predicate `reward_form==="spin_token"` + `external_system.ref_id`.   |
| 2 | "Max Spin/Hari" (line ~1183)                   | `mappedPreview.fixed_lucky_spin_max_per_day` | `sel.luckySpinMaxPerDay`| DIRECT 1:1  | Same predicate; `execution.max_per_day` numeric.                     |
| 3 | "Waktu Berlaku" → `fixed_voucher_valid_until`  | `mappedPreview.fixed_voucher_valid_until`  | `sel.spinValidUntil`      | AMBIGUOUS   | UI mencampur voucher validity & spin validity di satu blok. Selector V10 hanya cover spin-validity (`scope==="reward_validity"`). |
| 4 | "Waktu Berlaku" → `fixed_voucher_valid_unlimited` | `mappedPreview.fixed_voucher_valid_unlimited` | `sel.spinValidUntilUnlimited` / `sel.validUntilUnlimited` | AMBIGUOUS | Dua selector berbeda (mechanic spin vs period_engine). UI tidak tahu mana yang dimaksud. |
| 5 | "Hadiah Fisik" name (line ~998)                | `mappedPreview.fixed_physical_reward_name` | `sel.physicalItemName`    | DIRECT 1:1  | `reward_engine.reward_identity_block.item_name`.                     |
| 6 | "Hadiah Fisik" quantity (line ~1175)           | `mappedPreview.fixed_reward_quantity`      | `sel.physicalQuantity`    | AMBIGUOUS   | UI field generic "reward quantity"; V10 selector hanya valid kalau `reward_type==="physical"` (gated by Invariant #5). Perlu guard `rewardType === "physical"` sebelum rebind. |
| 7 | `max_reward_unlimited` flag (di `Max Bonus` blok) | `mappedPreview.max_reward_unlimited` (jika ada) | `sel.maxRewardUnlimited` | DIRECT 1:1 | Boolean flag, sudah default false di selector.                       |
| 8 | `valid_until_unlimited` flag (period)          | `mappedPreview.fixed_voucher_valid_unlimited` (overlap) | `sel.validUntilUnlimited` | AMBIGUOUS | Overlap dengan #4. Butuh penegasan: period_engine validity vs reward validity. |

### Verdict scope Step 8

**Boleh rebind sekarang (DIRECT 1:1):**
1. `sel.luckySpinRefId` → "ID Lucky Spin" (gated by `rewardType === 'lucky_spin'` yang sudah ada di JSX).
2. `sel.luckySpinMaxPerDay` → "Max Spin/Hari" (same gate).
3. `sel.physicalItemName` → "Hadiah Fisik" name (gated by `rewardType === 'physical'`).
5. `sel.maxRewardUnlimited` → max-reward unlimited flag (jika dipakai di JSX; perlu cek lokasi exact).

**TUNDA (AMBIGUOUS / butuh design lanjut):**
3. "Waktu Berlaku" untuk lucky-spin vs voucher → butuh keputusan: blok ini mau dipecah jadi 2 blok (spin vs voucher) atau tetap 1 blok dengan branching `rewardType`?
4. `physicalQuantity` → butuh konfirmasi: UI "fixed_reward_quantity" sekarang generic untuk semua reward type; V10 hanya untuk physical. Pisah atau tidak?
6. `validUntilUnlimited` (period) vs `spinValidUntilUnlimited` (mechanic) → mana yang dimaksud "Waktu Berlaku"?

---

## 8. Anti-patterns (Step 8 hard rules)

- ❌ Tidak boleh dual-read (selector OR mappedPreview). Pilih satu per leaf.
- ❌ Tidak boleh fallback ke `mappedPreview` kalau selector return null.
- ❌ Tidak boleh refactor `mappedPreview` itself di Step 8.
- ❌ Tidak boleh ubah `pkStatus` state machine.
- ❌ Tidak boleh tambah state variable baru (`validated`, `ready_for_ui` adalah derived).
- ❌ Tidak boleh sentuh leaf AMBIGUOUS / MISSING.

---

## 9. Output yang dibutuhkan untuk Step 8 next

Sebelum Step 8 mulai, user perlu konfirmasi:

1. ✅ Approve lifecycle phases (`validated`, `ready_for_ui` sebagai derived).
2. ✅ Approve fallback policy (zero fallback per rebound leaf).
3. ⏳ Decision untuk 3 AMBIGUOUS leaf:
   - "Waktu Berlaku" — pisah blok atau branching?
   - `physicalQuantity` — gate by `rewardType==='physical'`?
   - `valid_until_unlimited` — period_engine atau mechanic?
4. ⏳ Konfirmasi lokasi exact `maxRewardUnlimited` di JSX (perlu grep saat Step 8).

Setelah ini clear, Step 8 boleh dieksekusi **per leaf** (bukan bulk),
dengan diff kecil per perubahan.
