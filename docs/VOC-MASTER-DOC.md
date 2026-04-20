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

REMAINING MINOR:

- promo_summary selalu null (LLM belum generate meskipun instruksi ada)
- target_segment: "all" harusnya "Semua" (konsistensi bahasa)
- meta field tidak ada di raw extraction (schema_version, human_verified)

PENDING MAJOR:

- legacy_flat masih ada di LLM output (ditahan — Form Wizard masih butuh)
- Form Wizard → Supabase flow belum diverifikasi end-to-end
- Validation engine belum di-wire ke Publish button

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
3. Fix promo_summary (selalu null)
4. Wire validation engine ke Publish button
