/**
 * Mechanic Contract: LUCKY_SPIN
 * 
 * Pattern: Player deposit X → dapat N tiket spin.
 * Formula: floor(deposit / threshold) tiket per session.
 * Tiket TIDAK carry TO — TO hanya untuk withdraw.
 */

export const LUCKY_SPIN_CONTRACT = `
=== KONTRAK MECHANIC: LUCKY SPIN ===
Promo ini adalah EXCHANGE mechanic — deposit → tiket spin, BUKAN bonus langsung.

ATURAN KERAS (WAJIB IKUT):
- reward_type WAJIB: "lucky_spin_ticket"
- mode WAJIB: "formula" (bukan tier, bukan fixed)
- calculation_basis WAJIB: "deposit"
- conversion_formula WAJIB: format "floor(deposit / THRESHOLD)"
  Contoh: "deposit 50.000 = 1 tiket" → conversion_formula: "floor(deposit / 50000)"
- turnover_enabled WAJIB: false (tiket TIDAK punya TO sendiri)
- claim_frequency: "harian" jika disebutkan reset/hari
- max_claim: angka tiket maksimal per hari jika ada

FIELD YANG BOLEH NULL (jika tidak disebutkan):
- game_scope (tapi biasanya ada: "slot", "semua game", dll)
- min_deposit (sudah tercover di conversion_formula)

DILARANG:
- turnover_enabled: true
- reward_type selain "lucky_spin_ticket"
- mode: "tier" atau "fixed"

CONTOH OUTPUT YANG BENAR:
{
  "reward_type": "lucky_spin_ticket",
  "mode": "formula",
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
