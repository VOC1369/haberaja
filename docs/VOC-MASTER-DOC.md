# VOC Wolf Extractor V.APR.09

# VOC Promo KB — Master Documentation

## Flow Resmi

INPUT → PSEUDO EXTRACTOR → DRAFT LIST → FORM WIZARD → HUMAN AUDIT → SUPABASE

## JSON Schema

- Raw extraction (Copy JSON): flat + _mechanics_v31, untuk debugging only
- Final JSON (Supabase): output Form Wizard setelah human approve

## Fixes Applied (April 2026)

1. Vision fix — image extraction menggunakan Anthropic native format
2. Dual envelope unwrap di image path (line 2390)
3. Opening prompt → reasoning-first (analis iGaming berpengalaman)
4. Hybrid conflict rule → 3-layer (TEXT/IMAGE/AMBIGUITY)
5. Canonical projection instruksi ditambahkan setelah 10 mechanic primitives
6. Min Turnover field mapping untuk Rollingan (turnover_rule_format: min_rupiah)
7. promo_name fallback chain di UI (line 1142)

## Known Gaps (updated April 2026)

RESOLVED:

- canonical_projection tidak ter-generate → FIXED
- mechanics[] tersimpan di _mechanics_v31 → FIXED (sekarang ada di kedua field)
- File bernama openai-extractor.ts → RENAMED ke voc-wolf-extractor.ts
- Min Turnover kosong untuk image extraction → FIXED (session Apr 20)
- promo_risk_level hardcoded 'medium' → FIXED (session Apr 20)
- promo_summary selalu null → FIXED (session Apr 20)
- primary_claim_method null untuk referral → FIXED (session Apr 20)
- promo_summary kosong di Form Wizard canonical → FIXED (session Apr 20)
- primary_claim_method / primary_claim_platform kosong di referral → FIXED (session Apr 21)
- promo_risk_level tidak carry-over dari extraction ke PromoFormData → FIXED (session Apr 21)

REMAINING MINOR:

- target_segment: "all" harusnya "Semua" (konsistensi bahasa)
- meta field tidak ada di raw extraction (schema_version, human_verified)

PENDING MAJOR:

- legacy_flat masih ada di LLM output (ditahan — Form Wizard masih butuh)
- Form Wizard → Supabase flow belum diverifikasi end-to-end
- Validation engine belum di-wire ke Publish button

CANONICAL PROJECTION GAPS (updated Apr 21):

- main_reward_percent: tidak tier-aware, ambil calculation pertama saja
  Fix: iterate subcategories[] → format "min% – max%"
- promo_summary tidak ada di UI Step 4 untuk review/edit
- referral_proof_notes autofill mengambil field name (e.g. "media_penyebaran_info")
  bukan deskripsi human-friendly
  Root cause: claimM.data.proof_type berisi machine key, bukan natural language
  Fix: tambah proof_type → human text mapping di mapExtractedToPromoFormData
       (atau minta LLM output proof_description sebagai sentence)

## Decisions Locked

- JSON yang masuk Supabase = output Form Wizard (bukan raw LLM extraction)

## Decision: legacy_flat retention

legacy_flat DIPERTAHANKAN sampai Form Wizard di-rewrite untuk consume mechanics[] langsung.

Alasan: 3 area tidak bisa di-derive dari mechanics[] saja:

- subcategories[] — multi-variant promo
- Point store engine config (lp_earn_*, vip_multiplier, fast_exp_missions)
- Granular distribution schedule (distribution_day, calculation_period_start/end)

Blueprint rewrite sudah ada: fromV31Row() di promo-storage.ts line 641-883.

Status: PENDING — tidak dikerjakan sekarang.

## Next Fix Queue (priority order)

1. canonical_projection — derive dari mechanics[], tambah ke output extraction → DONE ✅
2. Rename _mechanics_v31 → mechanics di raw extraction output (Copy JSON) → DONE ✅
3. Form Wizard → Supabase flow verification — PENDING
4. Validation engine wire ke Publish button — PENDING

## Session Progress (April 20, 2026)

### Fixes Completed Today

1. Vision fix — image extraction pakai Anthropic native format (bukan OpenAI image_url)
2. Dual envelope unwrap di image path — semua field dari legacy_flat sekarang ter-extract
3. Opening prompt → reasoning-first (analis iGaming berpengalaman, bukan rule engine)
4. Hybrid conflict rule → 3-layer (LAYER 1: TEXT, LAYER 2: IMAGE, LAYER 3: AMBIGUITY)
5. Canonical projection instruksi di EXTRACTION_PROMPT
6. Min Turnover field mapping untuk Rollingan (turnover_rule_format: min_rupiah + min_calculation)
7. promo_name fallback chain di UI
8. deriveCanonicalProjection() — generate canonical_projection dari mechanics[]
9. mechanics field resmi di-expose di output (sebelumnya hanya _mechanics_v31)
10. File renamed: openai-extractor.ts → voc-wolf-extractor.ts
11. Mechanic-to-flat sync untuk min_calculation
    - deriveCanonicalProjection() sekarang sync min_turnover dari m_eligibility.data ke subcategories[0].min_calculation
    - Guard: hanya jalan jika min_calculation & minimum_base kosong DAN calculation_base = 'turnover'
    - Lookup chain: 7 field alias untuk handle LLM naming inconsistency
12. Auto-derive promo_risk_level
    - Function deriveRiskLevel() — HIGH→MEDIUM→LOW→NO logic
    - Hardcoded 'medium' dihapus dari seluruh codebase
    - Override: derivation hanya jalan jika field kosong/null
13. generatePromoSummary() extended untuk referral tier
    - PromoSummaryContext interface ditambahkan (tier_archetype, promo_type, subcategories)
    - Referral branch: format "5% – 15%" dari subcategories[]
    - Aggregate min downline + verifikasi flag dari claim mechanic
    - 14/14 tests pass (4 referral tests baru ditambahkan)
    - Wired ke deriveCanonicalProjection() sebagai fallback ketika parsed.promo_summary kosong
19. promo_summary fix di buildCanonicalProjectionFromMechanics()
    - Root cause: buildCanonicalPayload() adalah dead code untuk Form Wizard
    - Real path: toV31Row → buildCanonicalProjectionFromMechanics (promo-storage.ts)
    - Fix: import generatePromoSummary + 3-priority fallback chain
    - Priority 1: p.promo_summary jika ada
    - Priority 2: generate dari referral_tiers[] untuk referral
    - Priority 3: generate dari subcategories[] untuk non-referral
    - buildCanonicalPayload() di types.ts ditandai @deprecated

### Verified Working (tested dengan real promo)

- Image extraction: Rollingan SLOT 0.5% ✅
- Text extraction: Rollingan SLOT 0.5% ✅
- canonical_projection ter-populate dari mechanics ✅
- mechanics[] dan _mechanics_v31 keduanya ada di output ✅
- promo_name ter-extract dari image ✅
- Min Turnover ter-extract dari image ✅
- ambiguity flagging bekerja (m_claim_1 ambiguity: true dengan reason) ✅

### Not Yet Tested

- Hybrid extraction (text + image sekaligus)
- Referral tier promo (multi-tier formula)
- Form Wizard → Supabase end-to-end flow

### Next Session Priority

1. Test hybrid extraction dengan referral tier promo
2. Verify Form Wizard → Supabase flow
3. Fix primary_claim_method/platform untuk referral (UI field di Step3Reward)
4. Wire validation engine ke Publish button
5. Multiple image attachment support di Pseudo Knowledge
   - Saat ini hanya support 1 image + 1 text
   - Dibutuhkan untuk promo kompleks (referral multi-halaman, promo dengan banyak banner)
   - Referensi: Claude chat UI yang support multiple file attachment
   - Approach: queue multiple images, process sequentially atau concatenate sebagai multi-part content
