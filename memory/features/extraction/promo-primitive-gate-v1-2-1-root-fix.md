# Memory: features/extraction/promo-primitive-gate-v1-2-1-root-fix
Updated: just now

## ROOT FIX: PROMO PRIMITIVE GATE v1.2.1 — SINGLE SOURCE OF TRUTH

Implemented the ROOT FIX for mode determination by wiring `promo-primitive-gate.ts` as the SINGLE SOURCE OF TRUTH.

### Changes Made

**1. `src/lib/openai-extractor.ts`:**
- Added imports for Gate functions: `resolveModFromPrimitive`, `PromoPrimitive`, `CanonicalMode`, `PRIMITIVE_GATE_VERSION`
- Added imports for Evidence Collector: `collectPrimitiveEvidence`, `inferTaskDomain`, `inferRewardNature`, `hasApkConstraint`, `inferPrimitivesWithConfidence`
- Added import for Invariant Checker: `assertModeFromGate`
- **DELETED** entire `detectRewardMode()` function (legacy parallel system that defaulted to `formula`)
- **DELETED** BACKSTOP B override (forced `formula` for withdraw+%)
- **DELETED** APK manual override to `event` mode (lines 2925-2929)
- **ADDED** `getGateDecision()` function that:
  - Builds promo content from `promo_name`, `promo_type`, `terms_conditions`, `subcategories`
  - Runs Evidence Collector → Primitive Inference → Gate Decision
  - Returns `{ mode, constraints.require_apk, confidence, reasoning }`
- **ADDED** backwards-compatible `modeDetection` object from Gate output
- **ADDED** `assertModeFromGate()` call for fail-loud invariant enforcement

**2. `src/lib/extractors/mechanic-router.ts`:**
- **DELETED** hardcoded mechanics-to-mode arrays (`formulaMechanics`, `fixedMechanics`, `tierMechanics`, `eventMechanics`)
- **REPLACED** `determineMode()` to delegate to Gate via Evidence Collector + `resolveModFromPrimitive()`
- Router no longer makes mode decisions; it only passes through Gate output

**3. `src/lib/extractors/primitive-invariant-checker.ts`:**
- **ADDED** `assertModeFromGate()` function for fail-loud invariant enforcement:
  - `mode=formula` + `calculation_basis=empty` → THROW in dev
  - `mode=fixed/event` + `calculation_basis=present` → THROW in dev
- Updated version to `v1.2.1+2025-01-14`

### System Laws (ENFORCED)

1. **MODE AUTHORITY**: Mode ONLY comes from `resolveModFromPrimitive()` in `promo-primitive-gate.ts`
2. **APK IS CONSTRAINT**: `require_apk=true` is a constraint, NOT a mode determinant (APK ≠ event)
3. **FIXED vs FORMULA**: Fixed = no calculation_basis; Formula = MUST have calculation_basis
4. **VARIANTS**: "5K-20K" is VARIANT/OPTION → `subcategories[]`, NOT `max_bonus` range

### Expected Result

**Input:**
```
"DOWNLOAD APLIKASI DAPAT FREECHIP
Pilih Credit 5rb atau 20rb
Khusus pengguna APK"
```

**Output:**
```json
{
  "mode": "fixed",
  "require_apk": true,
  "calculation_basis": null,
  "reward_is_percentage": false,
  "has_subcategories": true,
  "subcategories": [
    { "reward_amount": 5000 },
    { "reward_amount": 20000 }
  ]
}
```

### Forbidden After This Fix

- ❌ Mode assignment outside Gate (`mode =` anywhere else)
- ❌ Hardcoded mechanics → mode mapping
- ❌ Default `mode = 'formula'` as fallback
- ❌ Manual override based on `trigger_event`
- ❌ Silent sanitizer fixes for impossible states
