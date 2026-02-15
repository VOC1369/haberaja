

# Fix: JSON Import Autofill untuk Konfigurasi Reward

## Problem

Saat user import JSON promo via "Upload JSON", data masuk ke list tapi **Konfigurasi Reward (Step 4) kosong 0%**. Ini terjadi karena field-field di JSON yang diimport menggunakan nama yang berbeda dari yang diharapkan form wizard.

Contoh dari JSON user:
```json
{
  "calculation_percentage": 0.5,
  "calculation_basis": "slot_turnover",
  "archetype_invariants": { "mode_must_be": "formula", "percentage_required": true },
  "archetype_payload": { "min_turnover_required": 1000000 }
}
```

Form wizard mengharapkan:
```
calculation_value = 0.5
calculation_method = "percentage"
calculation_base = "turnover"
reward_mode = "formula"
```

`normalizePromoData()` tidak menangani mapping ini, sehingga reward config tetap kosong.

## Root Cause

Ada 3 gap di `normalizePromoData()` (file `src/components/VOCDashboard/PromoFormWizard/types.ts`):

1. **`calculation_percentage`** tidak dimapping ke `calculation_value` + `calculation_method: 'percentage'`
2. **`calculation_basis`** (canonical v2.1) tidak dimapping ke `calculation_base` (form field)
3. **`archetype_invariants.mode_must_be`** tidak digunakan untuk set `reward_mode`
4. **`archetype_payload`** fields (min_turnover_required, dll) tidak di-unpack ke form fields

## Fix

**File**: `src/components/VOCDashboard/PromoFormWizard/types.ts`

**Lokasi**: Di `normalizePromoData()`, tambah section baru **sebelum** section 5 (reward_mode normalization), karena reward_mode logic bergantung pada field yang perlu di-resolve dulu.

### Section 4.5: JSON Import Field Hydration

```typescript
// ============================================
// 4.5. Hydrate from JSON import fields
// Maps alternative/canonical field names to form fields
// ============================================

// calculation_percentage → calculation_value + calculation_method
if (!normalized.calculation_value && (normalized as any).calculation_percentage) {
  normalized.calculation_value = (normalized as any).calculation_percentage;
  if (!normalized.calculation_method) {
    normalized.calculation_method = 'percentage';
  }
}

// calculation_basis (canonical v2.1) → calculation_base (form field)
if (!normalized.calculation_base && (normalized as any).calculation_basis) {
  const basisRaw = String((normalized as any).calculation_basis).toLowerCase();
  // Map common variants
  if (basisRaw.includes('turnover') || basisRaw.includes('slot_turnover')) {
    normalized.calculation_base = 'turnover';
  } else if (basisRaw.includes('loss')) {
    normalized.calculation_base = 'loss';
  } else if (basisRaw.includes('deposit')) {
    normalized.calculation_base = 'deposit';
  } else if (basisRaw.includes('withdraw')) {
    normalized.calculation_base = 'withdraw';
  } else {
    normalized.calculation_base = basisRaw;
  }
}

// archetype_invariants.mode_must_be → reward_mode
const invariants = (normalized as any).archetype_invariants;
if (invariants && typeof invariants === 'object') {
  if (invariants.mode_must_be && !normalized.reward_mode) {
    normalized.reward_mode = invariants.mode_must_be;
  }
  if (invariants.percentage_required && !normalized.calculation_method) {
    normalized.calculation_method = 'percentage';
  }
}

// archetype_payload → unpack to form fields
const payload = (normalized as any).archetype_payload;
if (payload && typeof payload === 'object') {
  if (payload.min_turnover_required && !normalized.min_calculation) {
    normalized.min_calculation = payload.min_turnover_required;
  }
  if (payload.calculation_percentage && !normalized.calculation_value) {
    normalized.calculation_value = payload.calculation_percentage;
  }
  if (payload.calculation_basis && !normalized.calculation_base) {
    normalized.calculation_base = String(payload.calculation_basis)
      .replace('slot_', '').toLowerCase();
  }
  if (payload.automatic_distribution !== undefined) {
    // Map to distribution_mode
    if (payload.automatic_distribution === true && !normalized.distribution_mode) {
      normalized.distribution_mode = 'setelah_syarat';
    }
  }
}
```

## Expected Result

Sebelum fix:
- Konfigurasi Reward: **0%** (semua field kosong)
- Mode Reward: tidak terpilih

Sesudah fix:
- Mode Reward: **Dinamis** (formula) -- auto-selected
- Calculation Value: **0.5** (0.5%)
- Calculation Base: **turnover**
- Min Calculation: **1,000,000**
- Readiness score naik dari 58 ke ~80+

## Impact

| Item | Detail |
|------|--------|
| File | `types.ts` (normalizePromoData) |
| Lines | ~25 lines ditambahkan |
| Breaking change | Zero -- hanya menambah fallback mapping |
| Existing flow | Tidak terpengaruh (guard `if (!field)` di setiap mapping) |

