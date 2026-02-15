

# Fix Extractor + Sanitizer: Adaptable untuk Semua Archetype

Semua perbaikan dirancang **universal** -- bukan patch untuk 1 promo, tapi rule engine yang berlaku untuk ribuan tipe promo sekarang dan masa depan.

## Prinsip Desain: Universal, Bukan Per-Promo

Setiap fix menggunakan **pattern detection** (regex/field check), bukan hardcoded promo name. Jadi promo Lucky Spin SPONTAN77, Lucky Draw SITUS-X, atau Competition BRAND-Y semuanya mendapat perlakuan yang sama secara otomatis.

## 6 Perbaikan di 3 File

### Fix 1: `max_claim: 0` + `max_claim_unlimited: true` (SEMUA mode)

**File**: `src/lib/sanitize-by-mode.ts`

Saat ini sanitizer hanya handle konflik ini untuk `mode: event` (line 231-235). Untuk mode lain (`fixed`, `formula`, `tier`), `max_claim: 0` lolos padahal `unlimited = true`.

**Solusi**: Tambah rule universal di KEDUA path (taxonomy dan legacy), setelah section value normalization:
```
if (out.max_claim_unlimited === true && (out.max_claim === 0 || out.max_claim !== null)) {
  out.max_claim = null;
}
```

Berlaku untuk: deposit bonus, cashback, lucky draw, referral, competition -- semua.

---

### Fix 2-5: Enrichment `archetype_payload` dari Terms (SEMUA archetype)

**File**: `src/lib/openai-extractor.ts`

Saat ini `buildArchetypePayloadFromExtracted()` hanya handle `LUCKY_DRAW` dan `COMPETITION`. Enrichment (turnover detection, channel scan, proof scan, accumulative detection) di-hardcode per archetype.

**Solusi**: Refactor menjadi **shared enrichment functions** yang dipanggil oleh SEMUA archetype:

**a) `detectTurnoverBasis(extracted, termsText)`** -- universal helper
- Cek `extracted.turnover_multiplier` ada atau terms menyebut TO
- Scan terms untuk pattern: "deposit + bonus", "bonus saja", "deposit only"
- Jika ada TO tapi basis tidak terdeteksi: return `null` + set `turnover_ambiguity: true`
- Berlaku untuk: Lucky Draw, Competition, Deposit Bonus, Cashback -- semua yang punya turnover

**b) `extractClaimChannels(termsText, extracted)`** -- universal helper
- Scan terms untuk: telegram, livechat, whatsapp, line, cs, customer service
- Merge dengan `extracted.claim_method` jika ada
- Return array unik
- Berlaku untuk: semua archetype (claim channels bukan eksklusif Lucky Draw)

**c) `extractProofRequirements(termsText)`** -- universal helper
- Scan terms untuk: screenshot, bukti, ss, foto, proof
- Return array seperti `['screenshot_prize']`, `['screenshot_deposit']`
- Berlaku untuk: semua archetype

**d) `extractDepositRequirement(extracted, termsText)`** -- universal helper
- Ambil `min_deposit` dari extracted
- Scan terms untuk "akumulatif/kumulatif/accumulated"
- Return structured object `{ amount, note, is_accumulative }`
- Berlaku untuk: semua archetype yang punya deposit requirement

Lalu di setiap archetype block (`LUCKY_DRAW`, `COMPETITION`, dan future archetypes), panggil helper-helper ini:
```
// Di LUCKY_DRAW block:
const turnoverBasis = detectTurnoverBasis(extracted, termsText);
payload.claim_channels = extractClaimChannels(termsText, extracted);
payload.proof_required = extractProofRequirements(termsText);
payload.deposit_requirement = extractDepositRequirement(extracted, termsText);

// Di COMPETITION block (sama):
const turnoverBasis = detectTurnoverBasis(extracted, termsText);
payload.claim_channels = extractClaimChannels(termsText, extracted);
// ... dst
```

Ketika archetype baru ditambah (misal REFERRAL payload_contract), tinggal panggil helper yang sama -- zero duplication.

---

### Fix 6: `buildCanonicalPayload` Pass-Through 3 Field Baru

**File**: `src/components/VOCDashboard/PromoFormWizard/types.ts`

Saat ini `buildCanonicalPayload()` tidak meng-assign `turnover_basis`, `archetype_payload`, dan `archetype_invariants` ke output canonical. Field ini hilang saat export.

**Solusi**: Tambah 3 baris sebelum section SUBCATEGORIES (setelah `extra_config` assignment, sekitar line 1471):
```
canonical.turnover_basis = data.turnover_basis ?? null;
canonical.archetype_payload = data.archetype_payload ?? {};
canonical.archetype_invariants = data.archetype_invariants ?? {};
```

---

## Kenapa Ini Adaptable

| Aspek | Sebelum | Sesudah |
|-------|---------|---------|
| Turnover detection | Hardcode null untuk Lucky Draw | Universal `detectTurnoverBasis()` -- works for ALL 11 archetypes |
| Channel extraction | Hanya dari `claim_method` (1 string) | Scan terms + merge -- works for any promo with channels in T&C |
| Proof requirement | Tidak ada | Universal scan -- works for any promo requiring screenshot/bukti |
| Deposit context | Flat `min_deposit` number | Structured object with `is_accumulative` flag -- works for any deposit-triggered promo |
| max_claim consistency | Hanya fix untuk event mode | Universal rule -- works for ALL modes |
| Payload pass-through | Lost at export | Always preserved in canonical JSON |

## Urutan Implementasi

1. `sanitize-by-mode.ts` -- Fix 1 (max_claim universal rule)
2. `openai-extractor.ts` -- Fix 2-5 (4 shared helpers + refactor both archetype blocks)
3. `types.ts` -- Fix 6 (3-line pass-through)

## Yang TIDAK Diubah

- Primitive Gate, Taxonomy Pipeline, Archetype Rules -- tidak disentuh
- `mode: 'fixed'` untuk Lucky Spin -- tetap benar
- UI Wizard Steps -- tidak disentuh
- Existing 88 canonical fields -- tidak dimodifikasi
- Schema version tetap `'2.1'`

