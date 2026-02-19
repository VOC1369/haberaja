
# Fix: Canonical JSON Import → Form Hydration Konsisten

## Masalah
Saat import JSON canonical v2.1 (seperti Loyalty Point SPONTAN77), form hanya terisi sebagian:
- **Identitas Promo: 67%** — `promo_type` kosong (tidak diinfer dari context)
- **Konfigurasi Reward: 0%** — `reward_mode` kosong (`mode` tidak dimapping), `promo_unit` kosong, tiers tidak dikonversi

## Akar Masalah
`normalizePromoData()` tidak memiliki mapping untuk beberapa field canonical v2.1 ke form fields:

| Canonical Field | Value di JSON | Form Field | Status |
|---|---|---|---|
| `mode` | `"tier"` | `reward_mode` | TIDAK DIMAPPING |
| `tier_archetype` | `"point_store"` | `tier_archetype` = `"tier_point_store"` | VALUE SALAH |
| `platform_access` | `"apk_only"` | `platform_access` = `"apk"` | TIDAK DIMAPPING |
| `category` | `"C"` | `program_classification` = `"C"` | TIDAK DIMAPPING |
| `tiers[]` | format canonical (`lp_required`) | `tiers[]` format form (`minimal_point`) | TIDAK DIKONVERSI |
| `tiers[]` | - | `redeem_items[]` | TIDAK DIKONVERSI |
| `promo_type` | tidak ada di JSON | harus diinfer | TIDAK ADA LOGIC |
| `promo_unit` | tidak ada di JSON | harus diinfer dari `tier_archetype` | TIDAK ADA LOGIC |
| `claim_frequency` | `"monthly"` | `"bulanan"` | ENUM `bulanan` TIDAK ADA di CLAIM_FREQUENCIES |

## Solusi

### File: `src/components/VOCDashboard/PromoFormWizard/types.ts`

**A. Tambah `bulanan` ke `CLAIM_FREQUENCIES` enum** (~line 2321)
- Tambahkan `{ value: 'bulanan', label: 'Bulanan' }` ke array

**B. Tambah section baru di `normalizePromoData()` — "Section 0: Canonical v2.1 Hydration"** (sebelum section 1, ~line 1697)

8 mapping baru:

1. **`mode` → `reward_mode`**: Jika `reward_mode` kosong tapi `(data as any).mode` ada, copy langsung
2. **`tier_archetype` normalisasi**: Map value pendek ke value form:
   - `"point_store"` → `"tier_point_store"`
   - `"level"` → `"tier_level"`
   - `"network"` → `"tier_network"`
   - `"formula"` → `"tier_formula"`
3. **`platform_access` normalisasi**: Tambah `"apk_only"` → `"apk"` di section 11
4. **`category` → `program_classification`**: Map `"C"` → `"C"`, `"REWARD"` → `"A"`, `"EVENT"` → `"C"`
5. **`promo_type` inference**: Jika kosong, infer dari context:
   - `tier_archetype` contains `"point_store"` → `"Loyalty Point"`
   - `trigger_event` = `"Turnover"` + `mode` = `"tier"` → `"Event / Level Up"`
   - `calculation_basis` = `"loyalty_point"` → `"Loyalty Point"`
6. **`promo_unit` inference**: Jika kosong dan `tier_archetype` mengandung `"point_store"` → `"lp"`
7. **`tiers[]` konversi canonical → form**: Detect tiers tanpa field `type` (bukan format form), lalu konversi:
   - `lp_required` atau `requirement_value` → `minimal_point`
   - `reward_amount` atau `reward_value` → `reward`
   - `tier_name` → `type`
   - Default: `reward_type: "fixed"`, `jenis_hadiah: "credit_game"`
8. **`redeem_items[]` hydration**: Untuk `tier_point_store`, konversi tiers ke `redeem_items[]`:
   - `tier_name` → `nama_hadiah`
   - `reward_amount` → `nilai_hadiah`
   - `lp_required` → `biaya_lp`

### Dampak
- 1 file diubah: `types.ts`
- Tambah ~80 baris di `normalizePromoData()` (section 0)
- Tambah 1 item di `CLAIM_FREQUENCIES`
- Tambah 1 mapping di section 11 (platform_access)
- Tidak ada perubahan UI — completion percentage otomatis benar setelah field terisi
- Backward compatible — hanya trigger saat field canonical terdeteksi
