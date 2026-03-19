/**
 * Mechanic Contract: REFERRAL TIER
 *
 * Pattern: Player recruits downlines → earns commission % of downline net win/loss.
 * Multiple tiers based on active downline count.
 */

export const REFERRAL_CONTRACT = `
=== KONTRAK MECHANIC: REFERRAL TIER ===

ATURAN KERAS (WAJIB IKUT — TIDAK BOLEH DILANGGAR):

1. SETIAP TIER harus jadi SUBCATEGORY TERPISAH
   ❌ DILARANG collapse multiple tier ke 1 subcategory
   ✅ Jika ada 3 tier komisil → 3 subcategory

2. Bedakan DUA angka berbeda dalam setiap tier:
   a) min_downline = jumlah downline MINIMUM untuk masuk tier ini (threshold)
      Ini adalah syarat masuk, bukan reward!
   b) calculation_value = persentase komisi yang didapat (reward %)
      Ini adalah reward, bukan threshold!

   ❌ DILARANG menukar kedua angka ini
   ❌ JANGAN jadikan min_downline sebagai calculation_value
   ❌ JANGAN jadikan calculation_value sebagai min_downline

3. Cara mapping tier ke subcategory:
   Format tabel: "5 ID aktif → komisi 5%"
   → sub_name: "Komisi 5%"
   → min_downline: 1       (tier pertama dimulai dari 1 ID)
   → max_downline: 4       (sampai sebelum tier berikutnya = 5-1)
   → calculation_value: 5  (persentase komisi)

   Format tabel: "10 ID aktif → komisi 10%"
   → sub_name: "Komisi 10%"
   → min_downline: 5       (dari setelah tier sebelumnya)
   → max_downline: 9
   → calculation_value: 10

   Format tabel: "15 ID aktif → komisi 15%"
   → sub_name: "Komisi 15%"
   → min_downline: 10
   → max_downline: null    (tier terakhir = tidak ada batas atas)
   → calculation_value: 15

4. calculation_basis: "net_loss" (komisi dari net winlose downline)
   conversion_formula: "net_winlose_downline * komisi%"

5. turnover_enabled: false, minimum_base: null
   Referral tidak punya threshold deposit. Threshold = jumlah downline aktif.

6. claim_frequency: "bulanan" kecuali disebutkan lain

7. payout_direction: "belakang" (komisi dihitung setelah periode selesai)

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
