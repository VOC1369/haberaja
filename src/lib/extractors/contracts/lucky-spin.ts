/**
 * Mechanic Contract: LUCKY_SPIN
 *
 * Structure: 3-layer (HARD INVARIANT / SOFT EXPECTATION / ESCAPE HATCH)
 *
 * Lucky Spin adalah DELIVERY MECHANISM — cara distribusi hadiah via roda putar.
 * Isi hadiahnya (reward_type) bisa berbeda per klien; yang di-lock adalah cara kerjanya.
 */

export const LUCKY_SPIN_CONTRACT = `
=== KONTRAK LUCKY SPIN MECHANIC ===

[HARD INVARIANT — cara kerja, tidak bisa berbeda]:
- Mechanic: player deposit → dapat tiket → tiket dipakai spin → hasil non-deterministic
- category: "EVENT" bukan "REWARD" — hasil spin tidak bisa dipastikan
- max_claim: WAJIB di-extract dari "Maksimal X Tiket per hari/periode" jika disebutkan
- claim_frequency: extract dari promo — biasanya "harian" karena tiket reset tiap hari
- turnover_enabled: false untuk tiket itu sendiri — TO requirement (jika ada) adalah untuk WD hasil spin, bukan untuk dapat tiket
- conversion_formula WAJIB: format "floor(deposit / THRESHOLD)"
  Contoh: "deposit 50.000 = 1 tiket" → conversion_formula: "floor(deposit / 50000)"
- Kalau LLM melanggar invariant ini → set extraction_confidence: low, flag untuk review

[SOFT EXPECTATION — isi hadiah, bisa berbeda per klien]:
- reward_type default: "lucky_spin_ticket" jika hadiah tidak disebutkan eksplisit
- reward_type actual jika disebutkan:
  → hadiah freechip/credit game → "credit_game"
  → hadiah uang tunai → "cash"
  → hadiah fisik (motor, mobil, gadget) → "merchandise" + physical_reward_name di extra_config
  → hadiah voucher → "voucher"
  → prize pool campuran → taruh di extra_config.prize_pool[]
- calculation_basis: "deposit" (default untuk tiket formula)
- mode: "formula" (karena tiket dihitung via rumus dari deposit)
- game_scope: biasanya "slot" atau "semua game" — extract dari promo, null jika tidak disebutkan

[ESCAPE HATCH — untuk Lucky Spin yang tidak standar]:
- Prize pool multiple hadiah (roda berisi 8 hadiah berbeda)
  → extra_config.prize_pool: [{reward_type, reward_value, probability}]
- Hadiah berbeda per tier spin (spin ke-1 berbeda dengan spin ke-10)
  → subcategories terpisah per tier
- Probabilitas hadiah disebutkan eksplisit
  → extra_config.prize_probability
- Constraint yang tidak masuk field standar
  → special_conditions sebagai string deskriptif

CONTOH OUTPUT YANG BENAR (patokan referensi — bukan template kaku):
{
  "category": "event",
  "mode": "formula",
  "reward_type": "lucky_spin_ticket",
  "calculation_basis": "deposit",
  "conversion_formula": "floor(deposit / 50000)",
  "max_claim": 10,
  "claim_frequency": "harian",
  "turnover_enabled": false,
  "game_scope": "slot"
}
=== END KONTRAK LUCKY SPIN ===
`;

/**
 * Keyword patterns that trigger Lucky Spin contract injection.
 * At least ONE title pattern OR TWO body patterns must match.
 */
export const LUCKY_SPIN_TITLE_PATTERNS = [
  /lucky\s*spin/i,
  /lucky\s*draw/i,
  /tiket\s*spin/i,
  /spin\s*gratis/i,
  /free\s*spin\s*ticket/i,
];

export const LUCKY_SPIN_BODY_PATTERNS = [
  /tiket\s*(lucky\s*)?(spin|draw)/i,
  /spin\s*(gratis|ticket|tiket)/i,
  /deposit.*tiket/i,
  /tiket.*deposit/i,
  /1\s*tiket\s*(per|setiap|untuk)/i,
  /mendapatkan\s*\d+\s*tiket/i,
  /floor\s*\(/i,
];
