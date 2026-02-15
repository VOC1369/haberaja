

# Fix Extractor + Sanitizer: Adaptable untuk Semua Archetype — ✅ IMPLEMENTED

Semua perbaikan dirancang **universal** -- bukan patch untuk 1 promo, tapi rule engine yang berlaku untuk ribuan tipe promo sekarang dan masa depan.

## Status: ✅ ALL 6 FIXES IMPLEMENTED

### Fix 1: ✅ Universal `max_claim_unlimited` rule (`sanitize-by-mode.ts`)
- Both taxonomy and legacy paths now force `max_claim = null` when `unlimited === true`
- Works for ALL modes (event, fixed, tier, formula)

### Fix 2-5: ✅ Shared enrichment helpers (`openai-extractor.ts`)
- `detectTurnoverBasis()` — universal TO basis detection with ambiguity flag
- `extractClaimChannels()` — terms scanning for telegram/livechat/whatsapp/line/cs
- `extractProofRequirements()` — screenshot/bukti/proof detection
- `extractDepositRequirement()` — accumulative deposit detection
- All helpers called by LUCKY_DRAW, COMPETITION, and generic fallback
- New archetypes get enrichment automatically

### Fix 6: ✅ Canonical pass-through (`types.ts`)
- `turnover_basis`, `archetype_payload`, `archetype_invariants` now exported in canonical JSON

## Tests: ✅ 29/29 passing
