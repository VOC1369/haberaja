
# Fix: `distribution_mode` Semantic Precision untuk Daily-Cycle Promos

## Problem

Promo Lucky Spin dengan daily reset (`claim_frequency: "harian"`, `daily_reset_time: "23:59 WIB"`) menghasilkan `distribution_mode: "hari_tertentu"`. Ini salah secara semantik:

- `hari_tertentu` = bonus dibagikan pada hari spesifik (Senin, Jumat, dll)
- Lucky Spin = bonus diklaim kapan saja setelah syarat terpenuhi, dengan cycle harian

Nilai yang benar: `setelah_syarat` — karena player klaim sendiri setelah deposit + spin, bukan sistem yang distribute di hari tertentu.

## Root Cause

Di `src/lib/openai-extractor.ts` line ~4078, fungsi `normalizeRewardDistribution()` memetakan `claim_frequency: "harian"` ke `otomatis_setelah_periode`. Tapi sebelum itu, jika LLM mengembalikan `distribution_day` (bahkan secara tidak sengaja), Priority 1 (line 4037) langsung return `hari_tertentu`.

Untuk archetype Lucky Spin / Chance-based, distribusi selalu "setelah syarat" — player klaim, bukan sistem yang push.

## Fix

**File**: `src/lib/openai-extractor.ts`

**Lokasi**: `normalizeRewardDistribution()` (~line 4030)

Tambahkan Priority 0 sebelum semua logic: jika archetype adalah chance-based (Lucky Spin, Gacha, dll), langsung return `setelah_syarat` karena secara definisi player yang klaim.

```typescript
// Priority 0: Chance-based promos = always setelah_syarat
// Lucky Spin, Gacha, dll → player claims after meeting requirements
// Never "hari_tertentu" or "otomatis_setelah_periode"
const chanceTypes = ['lucky spin', 'lucky draw', 'gacha', 'spin', 'undian', 'wheel'];
if (chanceTypes.some(t => promoType.includes(t)) || 
    extracted.collection_mechanic?.toLowerCase() === 'spin') {
  return 'setelah_syarat';
}
```

Ini disisipkan sebelum Priority 1 (line 4036), sehingga chance-based promos tidak pernah salah map ke `hari_tertentu`.

## Expected Result

Sebelum:
```json
"distribution_mode": "hari_tertentu",
"distribution_schedule": ""
```

Sesudah:
```json
"distribution_mode": "setelah_syarat",
"distribution_schedule": ""
```

## Summary

| Item | Detail |
|------|--------|
| File | `src/lib/openai-extractor.ts` |
| Fungsi | `normalizeRewardDistribution()` |
| Perubahan | Tambah Priority 0 untuk chance-based archetype |
| Impact | 1 block, ~6 lines |
