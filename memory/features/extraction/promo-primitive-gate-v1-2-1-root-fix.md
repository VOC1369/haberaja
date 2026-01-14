# Memory: features/extraction/promo-primitive-gate-v1-2-1-root-fix
Updated: 2025-01-14

## ROOT FIX: PROMO PRIMITIVE GATE v1.2.1 — SINGLE SOURCE OF TRUTH

Implemented the ROOT FIX for mode determination by wiring `promo-primitive-gate.ts` as the SINGLE SOURCE OF TRUTH.

### ROOT CAUSE IDENTIFIED (14 Jan 2025)

The `isEventLuckySpinPrize` condition was TOO BROAD:
```typescript
// ❌ OLD (ILLEGAL):
const isEventLuckySpinPrize = hasMultipleSubcategories && hasNonSpinRewards;
```
This incorrectly treated APK Freechip (2 varian) as Lucky Spin Prize and forced `reward_mode: 'formula'`, overriding the Gate decision.

### FIXES IMPLEMENTED

**FIX 1: Refined `isEventLuckySpinPrize` Condition (line 3835)**
```typescript
// ✅ NEW (LEGAL):
const isApkPromo = 
  gateDecision.constraints.require_apk === true ||
  /apk|download|aplikasi|freechip|freebet/i.test(extracted.promo_name || '');

const isEventLuckySpinPrize = 
  !isApkPromo &&                    // GUARD: APK promos excluded
  isLuckySpinPromo &&               // MUST be Lucky Spin promo
  gateDecision.mode === 'formula' && // Gate-approved only
  hasMultipleSubcategories && 
  hasNonSpinRewards;
```

**FIX 2: REMOVED ILLEGAL OVERRIDE (line 5514)**
```typescript
// ❌ DELETED:
...(isEventLuckySpinPrize && {
  reward_mode: 'formula' as const,  // ILLEGAL - overrides Gate
  ...
})

// ✅ KEPT (ancillary fields only):
...(isEventLuckySpinPrize && {
  // NO reward_mode - Mode comes from Gate
  dinamis_reward_type: 'voucher',
  ticket_exchange_enabled: true,
  ...
})
```

**FIX 3: HARD GUARD - Architecture Violation Check**
```typescript
if (process.env.NODE_ENV === 'development' || import.meta.env?.DEV) {
  const finalMode = sanitizedData.reward_mode || sanitizedData.mode;
  if (finalMode && finalMode !== gateDecision.mode) {
    throw new Error(
      `[ARCHITECTURE VIOLATION] reward_mode was "${finalMode}" but Gate decided "${gateDecision.mode}".`
    );
  }
}
```

### Previous Changes

**1. `src/lib/openai-extractor.ts`:**
- Added imports for Gate functions: `resolveModFromPrimitive`, `PromoPrimitive`, `CanonicalMode`, `PRIMITIVE_GATE_VERSION`
- Added imports for Evidence Collector: `collectPrimitiveEvidence`, `inferTaskDomain`, `inferRewardNature`, `hasApkConstraint`, `inferPrimitivesWithConfidence`
- Added import for Invariant Checker: `assertModeFromGate`
- **DELETED** entire `detectRewardMode()` function (legacy parallel system that defaulted to `formula`)
- **DELETED** BACKSTOP B override (forced `formula` for withdraw+%)
- **DELETED** APK manual override to `event` mode (lines 2925-2929)
- **ADDED** `getGateDecision()` function that runs Evidence Collector → Primitive Inference → Gate Decision

**2. `src/lib/extractors/mechanic-router.ts`:**
- **DELETED** hardcoded mechanics-to-mode arrays
- **REPLACED** `determineMode()` to delegate to Gate

**3. `src/lib/extractors/primitive-invariant-checker.ts`:**
- **ADDED** `assertModeFromGate()` function for fail-loud invariant enforcement

### INVARIANT RULES (v1.2.1 FROZEN)

1. `reward_mode` MUST come ONLY from `resolveModFromPrimitive()`
2. NO condition may override `reward_mode` AFTER Gate decision
3. APK is a CONSTRAINT, NEVER a mode determinant
4. Multiple fixed variants (e.g. 5K & 20K) ≠ formula ≠ tier
5. UI labels MUST reflect final `reward_mode`, not infer it

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
  "has_subcategories": true,
  "subcategories": [
    { "reward_amount": 5000 },
    { "reward_amount": 20000 }
  ]
}
```

### Forbidden After This Fix

- ❌ Mode assignment outside Gate (`mode =` anywhere else)
- ❌ `reward_mode:` override after Gate decision
- ❌ Hardcoded mechanics → mode mapping
- ❌ Default `mode = 'formula'` as fallback
- ❌ `isEventLuckySpinPrize` without APK guard
