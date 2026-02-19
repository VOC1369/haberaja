
# Fix: Round-Trip Integrity — Canonical JSON Import/Export Konsisten

## Masalah
Setelah import canonical JSON v2.1 lalu edit dan export, beberapa field hilang atau berubah nilai. Ini membuat data tidak round-trip safe.

## 6 Fixes

### File: `src/components/VOCDashboard/PromoFormWizard/types.ts`

**Fix 1 — `reward_unit` hardcoded "fixed"** (line ~1329)

Saat ini:
```
canonical.reward_unit = data.calculation_method === 'percentage' ? 'percent' : 'fixed';
```

Seharusnya: Preserve `data.reward_unit` jika sudah ada, baru fallback ke logic lama.
```
canonical.reward_unit = data.reward_unit || (data.calculation_method === 'percentage' ? 'percent' : 'fixed');
```

**Fix 2 — `special_conditions` field name mismatch** (line ~1430)

Saat ini:
```
canonical.special_conditions = data.special_requirements || [];
```

Seharusnya: Juga cek `data.special_conditions` (field canonical v2.1).
```
canonical.special_conditions = data.special_requirements || (data as any).special_conditions || [];
```

**Fix 3 — `calculation_basis` round-trip loss** (normalizePromoData section)

Pada saat import, `calculation_basis` dimapping ke `calculation_base` (form field). Tapi untuk tier_point_store, `calculation_basis = "loyalty_point"` tidak selalu dimapping dengan benar.

Di Section 0 (Canonical Hydration) tambahkan:
- Jika `calculation_basis` ada dan `calculation_base` kosong, copy langsung: `normalized.calculation_base = (normalized as any).calculation_basis`

**Fix 4 — `conversion_formula` round-trip loss** (normalizePromoData section)

`conversion_formula` sudah ada di canonical whitelist dan di form. Tapi saat import, field ini mungkin hilang karena tidak di-preserve. Pastikan di normalizePromoData:
- Jika `data.conversion_formula` ada, keep as-is (sudah handled di export line 1340, tapi perlu cek normalizer tidak menghapusnya)

**Fix 5 — `platform_access` vs `require_apk` kontradiksi** (buildCanonicalPayload, line ~1416-1418)

Tambahkan auto-sync: Jika `require_apk === true` dan `platform_access` bukan "apk"/"apk_only", set `platform_access = "apk"`.

```
canonical.platform_access = data.platform_access || '';
if (data.require_apk && !['apk', 'apk_only'].includes(canonical.platform_access)) {
  canonical.platform_access = 'apk';
}
```

**Fix 6 — Non-canonical fields bocor ke output**

Ini terjadi jika output JSON dibuat langsung dari form data tanpa melewati `enforceCanonicalGuard()`. Perlu memastikan semua export path selalu melalui canonical guard.

Cek apakah `savePromoDraft` atau export function langsung dump form data — jika iya, pastikan filter melalui `CANONICAL_EXPORT_WHITELIST`.

Kemungkinan fix: Di function yang menghasilkan JSON output yang user lihat, tambahkan whitelist filter sebelum return.

## Dampak
- 1 file utama diubah: `types.ts`
- ~15 baris perubahan total (5 fixes kecil + 1 cek export path)
- Backward compatible — hanya memperbaiki data yang sebelumnya hilang
- Semua canonical JSON yang diimport akan round-trip dengan benar
