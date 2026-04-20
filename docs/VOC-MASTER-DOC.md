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

## Known Gaps (belum difix)

1. canonical_projection tidak ter-generate di output
2. mechanics[] tersimpan di _mechanics_v31 bukan di field mechanics resmi
3. legacy_flat masih ada di LLM output (belum pure v3.1)
4. Validation engine ada tapi belum di-wire ke Publish button
5. Form Wizard → Supabase flow belum diverifikasi end-to-end

## Decisions Locked

- JSON yang masuk Supabase = output Form Wizard (bukan raw LLM extraction)
