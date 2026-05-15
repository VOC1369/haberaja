# Baseline JSON Snapshot — Pre-Refactor Lock

Snapshot date: 2026-04-25
Extractor: pk-extractor@claude-sonnet-4-5
Schema: V.09 (Pseudo Engine Schema v1.1)
Governance: V.06 | Domain: PK-06.0
Purpose: Regression guard for Batch Cepat refactor 
         (A.1 confidence path cleanup, A.2 field 
         status sync, A.4 reward range)

Test cases: 6 promos covering single / multi-variant 
            / tiered / loyalty / event-B / redemption 
            patterns (1 currently in pending)

Diff tool: TBD (Step #5 — automated regression)

## Folder Convention

- `baseline/`         → clean regression truth (read-only)
- `baseline_pending/` → known anomaly / unresolved cases
                        (NOT used in regression diff until promoted)

## Files (DO NOT MODIFY)

### baseline/ (clean — 5 saved)

| # | File | Pattern | record_id |
|---|------|---------|-----------|
| 01 | `01-cashback-slot25.json`              | Single, loss-based, Class A         | `9e39a6c1-...` |
| 02 | `02-welcome-bonus-lautan77.json`       | Multi-variant (5), Class A          | `b74ea03e-...` |
| 03 | `03-extra-cuan-referral-lautan77.json` | Tiered referral, Class A            | `5c4fdf21-...` |
| 04 | `04-kupon-loyalty-lautan77.json`       | 9-tier `point_redemption`, Class A  | `6a440fec-...` |
| 06 | `06-bonus-apk-freechip-lautan77.json`  | App install + redemption, Class B   | `15eb45c8-...` |

### baseline_pending/ (anomaly — 1 saved)

| # | File | Anomaly | record_id |
|---|------|---------|-----------|
| 05 | `05-event-level-up-lautan77.pending.json` | timezone = `WIB` (non-IANA) | `7116af79-...` |

### Numbering gap (intentional)

Slot **05** is reserved in `baseline/` for the level-up promo once it's
promoted out of `baseline_pending/` (see promotion criteria below).

## Promotion criteria (pending → baseline)

For `05-event-level-up-lautan77.pending.json`:
- timezone normalized from `WIB` → `Asia/Jakarta` (IANA)
- extraction stable across re-runs
- no UI wipe / state reset on render (see Bug #4)
- diff regression pass
- then move to `baseline/` as `05-event-level-up-lautan77.json`

## Rule

Files in `baseline/` are read-only by convention. Modifying them
invalidates regression diff against post-refactor output. If extraction
logic changes intentionally, create new baseline directory (e.g.
`baseline-v2/`) instead of modifying these files.

---

## Known Bugs (Documented for Batch Cepat)

These bugs were discovered during baseline extraction (2026-04-25) but 
are explicitly OUT OF SCOPE for Step #0. Documented here as test cases 
and reference for Batch Cepat refactor.

### BUG #1 — Authority Inversion Blind ke point_redemption

- **Severity:** High
- **Pipeline:** B (legacy mapExtractedToPromoFormData)
- **Trigger:** `tier_archetype = "point_redemption"` (V.09 canonical
  name; legacy code may still use "point_store"). Tier disimpan di
  `variant_engine.items_block.subcategories[]`, bukan di `tiers[]` array.
- **Effect:** primitive-invariant-checker throw "mode=fixed but 
  calculation_basis=point. IMPOSSIBLE STATE"
- **Root cause:** Authority logic legacy cuma cek `tiers[]` kosong → 
  conclude mode=fixed. Gak recognize `subcategories[]` dengan 
  `tier_dimension="point_balance"` sebagai valid tier source untuk 
  `point_redemption` archetype.
- **Terminology note:** V.09 extractor emits `tier_archetype: "point_redemption"`.
  Legacy mapper / KeywordRules may still reference `point_store`. Both
  names must be recognized during the migration window; canonical going
  forward is `point_redemption`.
- **Test case:** Kupon Loyalty Point LAUTAN77 (9 tier point redemption)
- **Fix scope:** Batch Cepat — recognize subcategories sebagai tier 
  source untuk `point_redemption` archetype, ATAU matikan legacy mapper
  dari flow Pseudo

### BUG #2 — KeywordRules False Positive

- **Severity:** Medium
- **Pipeline:** B (classifier override)
- **Trigger:** kata "Coupun" / "voucher" di source text
- **Effect:** Force override classification A → B (Reward Program → 
  Event Program)
- **Root cause:** KeywordRules gak respect `tier_archetype` context. 
  Loyalty point dengan kupon redemption bukan event program.
- **Note:** BUKAN penyebab crash utama. Cuma bikin noise di 
  classification.
- **Test case:** Kupon Loyalty Point LAUTAN77
- **Fix scope:** Batch Cepat — KeywordRules harus context-aware 
  (`point_redemption` ≠ event)

### BUG #3 — Legacy Mapper Failure Affect Pipeline A

- **Severity:** High (UX)
- **Pipeline:** B failure propagate ke Pipeline A output state
- **Effect:** Pipeline B crash bisa affect Pipeline A output meski 
  pkRecord udah sukses dibuat
- **Test case:** Kupon Loyalty Point (form gagal tapi pkRecord 
  survive di Copy JSON)
- **Fix scope:** Batch Cepat — isolate Pipeline A output dari 
  Pipeline B failure

### BUG #4 — useMemo Catch Block Wipes pkRecord

- **Severity:** CRITICAL (data loss risk)
- **Location:** src/components/VOCDashboard/PseudoKnowledgeSection.tsx 
  line 142-160 (mappedPreview useMemo)
- **Trigger:** mapExtractedToPromoFormData throw exception
- **Effect:** catch block calls setExtractedPromo(null) → pkRecord 
  wiped from state → Copy JSON unavailable
- **User experience:** "loading → mental ke awal" (UI reset ke 
  landing extractor)
- **Sequence verified from code:**
  1. Extract sukses → setExtractedPromo(result)
  2. React re-render → useMemo line 142 jalan
  3. mapExtractedToPromoFormData(result) throw exception
  4. catch block (line 153-158) → setExtractedPromo(null)
  5. UI conditional render → balik ke landing
- **Test case:** Event Kejar Level Up LAUTAN77 (4 tier level_based, 
  nominal besar 10jt) — currently in `baseline_pending/`
- **Hypothesis (timezone correlation):** The pending file's
  `time_window_engine.timezone_block.timezone = "WIB"` (non-IANA, all
  other baseline files use `"Asia/Jakarta"`). If the legacy mapper
  invokes `Intl.DateTimeFormat` or `Date` parsing on a non-IANA tz
  string, it throws → triggers the catch block → wipes pkRecord. This
  hypothesis must be verified with actual error stack capture before
  fix. Workaround in extractor: normalize WIB → Asia/Jakarta during
  V.09 emission.
- **Fix scope:** Batch Cepat — isolate Pipeline A state dari Pipeline 
  B failure (pkRecord harus survive walaupun mapper crash). Pisahkan 
  legacy mapper output dari pkRecord state lifecycle. Plus tz
  normalization guard at extractor boundary.
- **PRIORITY:** Critical karena data loss + UX impact (user kehilangan 
  Copy JSON access)

---

**Note untuk Batch Cepat planning:**

Bug #1, #2, #3, #4 semua nunjukin pattern yang sama: **legacy Pipeline 
B (Form Wizard mapping + classifier override) bocor ke Pipeline A 
(pk-extractor V.09 output)**. Fix doctrine: pisahkan kedua pipeline 
secara strict, atau matikan Pipeline B sampai V.09 fully migrated.
