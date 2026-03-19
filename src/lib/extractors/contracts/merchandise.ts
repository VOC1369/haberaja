/**
 * Mechanic Contract: MERCHANDISE
 * 
 * Pattern: Player penuhi syarat (deposit + TO) → klaim hadiah fisik via form/CS.
 * Reward adalah physical item, bukan credit game atau nominal Rupiah.
 */

export const MERCHANDISE_CONTRACT = `
=== KONTRAK MECHANIC: MERCHANDISE (HADIAH FISIK) ===
Promo ini adalah PHYSICAL REWARD mechanic — player penuhi syarat, klaim item fisik.

ATURAN KERAS (WAJIB IKUT):
- reward_type WAJIB: "merchandise"
- mode WAJIB: "fixed" (reward flat, bukan kalkulasi)
- proof_required WAJIB: true
- conversion_formula WAJIB: null (DILARANG isi formula untuk hadiah fisik)
- max_bonus WAJIB: null (hadiah fisik tidak punya nominal Rupiah)

FIELD WAJIB DI-EXTRACT (jika ada di S&K):
- physical_reward_name: nama item (contoh: "T-Shirt Eksklusif", "Kaos Brand X")
- claim_url: URL form klaim jika ada (contoh: link Google Form di S&K)
- claim_platform: "form" jika ada Google Form/link, "livechat" jika via CS
- distribution_schedule: jadwal pengiriman (contoh: "tanggal 16 dan 31 setiap bulan")
- min_deposit: syarat deposit minimum (jika disebutkan)
- turnover_multiplier: syarat TO (jika disebutkan, contoh: 1 untuk "TO x1")

DILARANG:
- conversion_formula: apapun selain null
- max_bonus: nilai numerik (hadiah fisik tidak punya max_bonus)
- reward_type selain "merchandise"
- mode: "formula" atau "tier"

CONTOH OUTPUT YANG BENAR:
{
  "reward_type": "merchandise",
  "mode": "fixed",
  "proof_required": true,
  "conversion_formula": null,
  "max_bonus": null,
  "physical_reward_name": "T-Shirt Eksklusif Citra77",
  "claim_url": "https://docs.google.com/forms/xxx",
  "claim_platform": "form",
  "distribution_schedule": "tanggal 16 dan 31",
  "min_deposit": 100000,
  "turnover_multiplier": 1
}
=== END KONTRAK MERCHANDISE ===
`;

/**
 * Keyword patterns that trigger Merchandise contract injection.
 * At least ONE title pattern OR TWO body patterns must match.
 */
export const MERCHANDISE_TITLE_PATTERNS = [
  /merchandise/i,
  /hadiah\s*fisik/i,
  /kaos\s*(eksklusif|brand|promo)/i,
  /t-shirt/i,
  /paket\s*hadiah/i,
];

export const MERCHANDISE_BODY_PATTERNS = [
  /merchandise/i,
  /kaos/i,
  /t-shirt/i,
  /hadiah\s*fisik/i,
  /dikirim(kan)?/i,
  /pengiriman/i,
  /google\s*form|docs\.google\.com/i,
  /physical\s*reward/i,
  /klaim\s*(via|melalui)\s*(form|link)/i,
  /tanggal\s*\d+\s*(dan|&|\+)\s*\d+/i,
];
