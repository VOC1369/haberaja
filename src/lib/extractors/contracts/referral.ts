/**
 * Mechanic Contract: REFERRAL TIER — 3-Layer Structure
 *
 * Pattern: Player recruits downlines → earns commission % of downline net win/loss.
 * Multiple tiers based on active downline count.
 * 
 * Architecture: HARD INVARIANT / SOFT EXPECTATION / ESCAPE HATCH
 */

export const REFERRAL_CONTRACT = `
=== KONTRAK MECHANIC: REFERRAL TIER ===

[HARD INVARIANT — tidak bisa berbeda, violation → extraction_confidence: low + flag]:

1. SETIAP TIER WAJIB di-extract sebagai subcategory TERPISAH
   ❌ DILARANG collapse multiple tier ke 1 subcategory
   ✅ Jika ada 3 tier komisi → 3 subcategory
   ✅ Jika hanya 1 tier → 1 subcategory
   Kalau LLM collapse → set extraction_confidence: low, catat di special_conditions

2. minimum_base: null untuk SEMUA tier referral
   Threshold masuk tier adalah jumlah downline (min_downline), BUKAN deposit minimum.
   ❌ JANGAN isi minimum_base dari syarat referral

3. payout_direction: "belakang" — komisi dihitung setelah periode selesai
   Komisi tidak dibayar di muka. Selalu belakang.

4. Bedakan DUA angka berbeda dalam setiap tier:
   a) min_downline = jumlah downline MINIMUM untuk masuk tier (threshold masuk)
      → Ini syarat masuk, BUKAN reward!
   b) calculation_value = persentase komisi yang didapat (reward %)
      → Ini reward, BUKAN threshold!
   ❌ DILARANG menukar kedua angka ini

[SOFT EXPECTATION — pola umum, bisa berbeda per klien]:

- Threshold tier biasanya berdasarkan jumlah downline aktif
  → tapi bisa berbasis total deposit downline, hari aktif, atau metrik lain
  → Baca dari promo, jangan asumsi "pasti downline count"

- calculation_basis biasanya "net_loss" (komisi dari net winlose downline)
  → tapi bisa "turnover" atau basis lain jika disebutkan

- commission_percentage biasanya kecil (5–15%)
  → extract dari teks, jangan hardcode

- claim_frequency biasanya "bulanan" kecuali disebutkan lain
  → Bisa harian, mingguan — ikuti promo

- Cara mapping tier ke subcategory (pola umum "X ID aktif → komisi Y%"):
  "5 ID aktif → komisi 5%"
  → sub_name: "Komisi 5%"
  → min_downline: 1       (tier pertama dimulai dari 1 ID)
  → max_downline: 4       (sampai sebelum tier berikutnya = 5-1)
  → calculation_value: 5  (persentase komisi)

  "10 ID aktif → komisi 10%"
  → sub_name: "Komisi 10%"
  → min_downline: 5
  → max_downline: 9
  → calculation_value: 10

  "15 ID aktif → komisi 15%"
  → sub_name: "Komisi 15%"
  → min_downline: 10
  → max_downline: null    (tier terakhir = tidak ada batas atas)
  → calculation_value: 15

[ESCAPE HATCH — untuk outlier]:

- Tier berdasarkan metrik non-standar (win rate, lifetime value, tier VIP)
  → taruh di special_conditions: "tier_dimension: <metrik>"

- Hybrid referral + cashback (dapat komisi AND cashback personal)
  → taruh di extra_config sebagai string deskriptif

- Komisi per game category berbeda (slot: 5%, casino: 3%)
  → taruh di special_conditions per subcategory

- Constraint tidak masuk field standar → special_conditions
- Kalau mechanic tidak bisa dipetakan bersih → extraction_confidence: low, flag untuk human review

CONTOH OUTPUT YANG BENAR (3 tier):
[
  {
    "sub_name": "Komisi 5%",
    "calculation_basis": "net_loss",
    "calculation_value": 5,
    "conversion_formula": "net_winlose_downline * 0.05",
    "min_downline": 1,
    "max_downline": 4,
    "minimum_base": null,
    "turnover_enabled": false,
    "claim_frequency": "bulanan",
    "payout_direction": "belakang"
  },
  {
    "sub_name": "Komisi 10%",
    "calculation_basis": "net_loss",
    "calculation_value": 10,
    "conversion_formula": "net_winlose_downline * 0.10",
    "min_downline": 5,
    "max_downline": 9,
    "minimum_base": null,
    "turnover_enabled": false,
    "claim_frequency": "bulanan",
    "payout_direction": "belakang"
  },
  {
    "sub_name": "Komisi 15%",
    "calculation_basis": "net_loss",
    "calculation_value": 15,
    "conversion_formula": "net_winlose_downline * 0.15",
    "min_downline": 10,
    "max_downline": null,
    "minimum_base": null,
    "turnover_enabled": false,
    "claim_frequency": "bulanan",
    "payout_direction": "belakang"
  }
]

=== END KONTRAK REFERRAL TIER ===
`;

/**
 * MechanicType keys that map to this contract.
 * Used by CONTRACT_REGISTRY in contracts/index.ts.
 */
export const REFERRAL_MECHANIC_KEYS = [
  'referral_commission',
  'referral_bonus',
] as const;
