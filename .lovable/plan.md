
# Fix: distribution_mode Bypass untuk Chance-Based Promos

## Problem

Priority 0 di `normalizeRewardDistribution()` sudah benar return `setelah_syarat`, tapi hasilnya disimpan ke field `reward_distribution` (legacy). Di `promo-field-normalizer.ts` line 246, migrasi `reward_distribution` ke `distribution_mode` hanya terjadi jika `distribution_mode` masih inert (kosong). Jika LLM atau layer lain sudah mengisi `distribution_mode` langsung dengan `hari_tertentu`, Priority 0 kita di-bypass.

## Fix

**File 1**: `src/lib/promo-field-normalizer.ts`

Di sekitar line 245-248 (migrasi `reward_distribution` ke `distribution_mode`), tambahkan override untuk chance-based promos:

```
// 3.5: Migrate reward_distribution -> distribution_mode
if (hasMeaningfulValue(migrated.reward_distribution) && isInert(migrated.distribution_mode)) {
  migrated.distribution_mode = migrated.reward_distribution;
}

// 3.5b: Chance-based override — force setelah_syarat regardless
const promoName = String(migrated.promo_name || '').toLowerCase();
const promoType = String(migrated.promo_type || '').toLowerCase();
const chanceKeywords = ['lucky spin', 'lucky draw', 'gacha', 'spin', 'undian', 'wheel'];
const isChanceBased = chanceKeywords.some(k => promoName.includes(k) || promoType.includes(k));
if (isChanceBased && migrated.distribution_mode === 'hari_tertentu') {
  migrated.distribution_mode = 'setelah_syarat';
}
```

Ini adalah safety net: bahkan jika extraction atau LLM mengisi `distribution_mode` langsung, normalizer akan meng-override ke `setelah_syarat` untuk chance-based promos.

## Why Two Layers

| Layer | Fungsi | Sudah Ada |
|-------|--------|-----------|
| `normalizeRewardDistribution()` | Extraction-time normalization | Ya (Priority 0) |
| `promo-field-normalizer.ts` | Post-extraction canonical normalization | Belum |

Dua layer karena data bisa masuk dari extraction (LLM) atau dari manual edit / import. Normalizer adalah last line of defense.

## Impact

- 1 file diubah
- ~6 lines ditambahkan
- Zero breaking change
- Tidak mengubah logic lain

## Expected Result

Sebelum:
```json
"distribution_mode": "hari_tertentu"
```

Sesudah:
```json
"distribution_mode": "setelah_syarat"
```
