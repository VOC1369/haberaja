/**
 * Mechanic Contract: ROLLINGAN (Turnover Commission)
 *
 * Structure: 3-layer (HARD INVARIANT / SOFT EXPECTATION / ESCAPE HATCH)
 *
 * HARD INVARIANT  — field yang tidak boleh berbeda, apapun konteksnya.
 * SOFT EXPECTATION — pola umum yang bisa berbeda per klien; extract dari promo.
 * ESCAPE HATCH    — outlier yang tidak masuk field standar → special_conditions.
 */

export const ROLLINGAN_CONTRACT = `
=== MECHANIC CONTRACT: ROLLINGAN / KOMISI TURNOVER ===

[HARD INVARIANT — tidak bisa berbeda]:
- turnover_enabled: false — rollingan adalah reward dari TO, tidak punya syarat TO tambahan setelah bonus cair
- reward_type: bukan "deposit_bonus" — ini rolling commission, bukan bonus deposit
- payout_direction: "belakang" — rollingan selalu dibayarkan setelah periode selesai, tidak pernah "depan"
- JANGAN campur min_calculation (threshold minimum TO) dengan turnover_rule (multiplier WD — tidak berlaku di sini)
  ❌ DILARANG: "Minimal TO X" → turnover_rule atau minimum_base
  ✅ WAJIB: "Minimal TO X" → min_calculation: X
- Kalau LLM menyimpang dari invariant ini, catat alasan di special_conditions dan set confidence: low

[SOFT EXPECTATION — pola umum, bisa berbeda per klien]:
- calculation_basis biasanya "turnover" — tapi bisa "net_loss" untuk cashback hybrid; baca dari promo
- Rate biasanya 0.3%–1% — extract dari teks promo, jangan asumsi nilai default
- Periode biasanya mingguan — bisa harian atau bulanan; extract dari "mingguan", "per minggu", "bulanan"
- distribution_schedule = hari pembagian (contoh: "dibagikan setiap Senin" → "senin"); null jika tidak disebutkan
- conversion_formula: format "total_turnover * rate%" atau "total_net_loss * rate%"
  Contoh: "Rollingan 0.5%" → "total_turnover * 0.005"
- max_bonus: null kecuali S&K eksplisit menyebut batas maksimum bonus
- max_bonus_unlimited: true jika promo menyebut frasa:
    "tidak ada maksimal bonus" / "unlimited" / "tanpa batas maksimal"
    ATAU jika tidak disebutkan batas maksimum sama sekali (default untuk rollingan)

[ESCAPE HATCH — untuk outlier yang tidak masuk field standar]:
- Cap per provider atau per game type → taruh di special_conditions sebagai string deskriptif
- Tier rollingan (rate berbeda per level turnover) → masing-masing tier sebagai subcategory terpisah
- Rollingan dengan struktur cashback hybrid → beri catatan di special_conditions, set extraction_confidence rendah
- Mechanic tidak bisa dipetakan bersih ke field standar → set extraction_confidence: 0.5 dan flag untuk human review

CONTOH OUTPUT YANG BENAR (patokan referensi — bukan template kaku):
{
  "calculation_basis": "turnover",
  "conversion_formula": "total_turnover * 0.005",
  "calculation_value": 0.5,
  "min_calculation": 500000,
  "turnover_enabled": false,
  "claim_frequency": "mingguan",
  "distribution_schedule": "senin",
  "payout_direction": "belakang",
  "max_bonus": null
}

=== END CONTRACT: ROLLINGAN ===
`;

/**
 * MechanicType keys that map to this contract.
 * Used by CONTRACT_REGISTRY in contracts/index.ts.
 */
export const ROLLINGAN_MECHANIC_KEYS = [
  'rollingan_turnover',
  'komisi_turnover',
] as const;
