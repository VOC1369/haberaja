# Memory: features/data-architecture/authority-inversion-implementation-v1

Updated: 2026-03-30

## Overview

Implemented Authority Inversion v1.0 — `_mechanics_v31` is now the single authority for `mode` and `tier_archetype` when structurally valid.

## Key Design: Two Strictly Separated Functions

1. **`isMechanicsAuthoritative()`** — Structural only. Checks: exists, array, non-empty, every node has `mechanic_type` (string) and `data` (object). No domain reasoning.

2. **`deriveModeFromMechanics()`** — Semantic. Derives mode and tier_archetype from mechanics content. Rules: state.tiers[] → tier, calculation.formula → formula, else → fixed. Reads `tier_archetype` from `state.data.tier_archetype` first.

**Principle**: Validity decides trust. Derivation decides meaning. Never mix the two.

## Files Changed

### 1. `src/lib/mechanics-authority.ts` (NEW)
- `isMechanicsAuthoritative()` — structural validator
- `deriveModeFromMechanics()` → `MechanicsAuthority` — semantic deriver

### 2. `src/lib/openai-extractor.ts`
- Import mechanics-authority utilities
- Before `getGateDecision()`: derive `mechanicsAuthority` from `_mechanics_v31`
- `getGateDecision()`: early return with mechanics values when authoritative (skips taxonomy + legacy gate entirely)
- Spread overrides (referral, eventLevelUp, depositBonusTier): guarded with `&& !mechanicsAuthority`
- Deposit Tier Converter rescue: guarded with `&& !mechanicsAuthority`
- Added `[AUTHORITY TRACE]` log showing which path determined mode/tier_archetype

### 3. `src/lib/promo-storage.ts`
- `buildMechanicsFromFormData()` (state mechanic): added `tier_archetype` to `data` object for round-trip persistence
- `fromV31Row()`: reads `stateData.tier_archetype` first, falls back to heuristic only if not present

## Authority Flow

```
_mechanics_v31 exists & valid?
  ├─ YES → derive mode + tier_archetype from mechanics
  │        getGateDecision() early-returns mechanics values
  │        legacy spread overrides SKIPPED
  │        output.reward_mode = mechanics.mode
  │        output.tier_archetype = mechanics.tier_archetype
  │
  └─ NO  → legacy path (unchanged)
           taxonomy → gate → lockedFields → spread overrides
```

## Round-Trip Fix
- `toV31Row`: now stores `tier_archetype` in state mechanic's `data` object
- `fromV31Row`: reads `data.tier_archetype` → no re-inference needed
- Parlay, referral, point_store, etc. all survive DB round-trip
