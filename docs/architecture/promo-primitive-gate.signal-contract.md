# PROMO PRIMITIVE GATE v1.2.1 — SIGNAL CONTRACT

## ⚠️ THIS IS A SYSTEM CONTRACT — VERSION LOCKED

**Any logic change requires a versioned update to this document.**
**Do NOT add regex or mode logic without updating this contract first.**

| Property | Value |
|----------|-------|
| Last Updated | 2025-01-14 |
| Version | v1.2.1 (FROZEN) |
| Status | LOCKED |

---

## 📊 ARCHITECTURE FLOW

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ REGEX EVIDENCE  │ ──▶ │   PRIMITIVES    │ ──▶ │   MODE GATE     │
│ (hints only)    │     │ (domain+nature) │     │ (decision)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
  primitive-               inferTaskDomain()      resolveModFromPrimitive()
  evidence-                inferRewardNature()         │
  collector.ts                  │                      ▼
        │                       │               ┌─────────────────┐
        ▼                       ▼               │  CanonicalMode  │
  PrimitiveEvidence      task_domain           │ fixed/formula/  │
  {platform_hints,       reward_nature          │    tier         │
   financial_hints,            │               └─────────────────┘
   ...}                        │                       │
                               ▼                       │
                        ┌─────────────────┐            │
                        │   CONSTRAINTS   │◀───────────┘
                        │ (require_apk,   │
                        │  trigger_event) │
                        └─────────────────┘
```

---

## 🔒 SINGLE SOURCE OF TRUTH

**File**: `src/lib/extractors/promo-primitive-gate.ts`

This is the ONLY file that decides mode. All other files:

| File | Role | Can Assign Mode? |
|------|------|------------------|
| `primitive-evidence-collector.ts` | Evidence collection | ❌ NO |
| `primitive-invariant-checker.ts` | Validation | ❌ NO |
| `mechanic-router.ts` | Routing (delegates) | ❌ NO |
| `promo-intent-reasoner.ts` | Intent inference | ❌ NO |
| `sanitize-by-mode.ts` | Enforcement | ❌ NO |
| `openai-extractor.ts` | Extraction | ❌ NO |
| **`promo-primitive-gate.ts`** | **Mode Decision** | ✅ YES |

---

## 📋 DECISION TABLE (20/20 Coverage)

| task_domain | reward_nature | → mode   | Status      | Example                    |
|-------------|---------------|----------|-------------|----------------------------|
| platform    | fixed         | fixed    | EXPLICIT    | APK Freechip 20rb          |
| platform    | calculated    | formula  | EXPLICIT    | APK Cashback 5%            |
| platform    | tiered        | tier     | VIA RULE 1  | APK tier rewards           |
| platform    | chance        | fixed    | VIA RULE 0  | APK Lucky Spin             |
| financial   | fixed         | fixed    | **EXPLICIT**| Bonus Deposit 50rb         |
| financial   | calculated    | formula  | EXPLICIT    | Bonus Deposit 10%          |
| financial   | tiered        | tier     | EXPLICIT    | Event Turnover Mobil       |
| financial   | chance        | fixed    | VIA RULE 0  | Deposit Lucky Spin         |
| gameplay    | fixed         | fixed    | VIA RULE 6  | Scatter Bonus 100k         |
| gameplay    | calculated    | formula  | EXPLICIT    | Rollingan 0.5%             |
| gameplay    | tiered        | tier     | VIA RULE 1  | Tournament tiers           |
| gameplay    | chance        | fixed    | VIA RULE 0  | Scatter Gacha              |
| temporal    | fixed         | fixed    | EXPLICIT    | Birthday Bonus 50k         |
| temporal    | calculated    | formula  | EXPLICIT    | Birthday Cashback 10%      |
| temporal    | tiered        | tier     | VIA RULE 1  | Anniversary tier rewards   |
| temporal    | chance        | fixed    | VIA RULE 0  | Birthday Lucky Spin        |
| access      | fixed         | fixed    | EXPLICIT    | VIP Level 5 bonus          |
| access      | calculated    | formula  | EXPLICIT    | VIP Cashback %             |
| access      | tiered        | tier     | VIA RULE 1  | VIP Level 1-10 table       |
| access      | chance        | fixed    | VIA RULE 0  | VIP Lucky Wheel            |

**Coverage: 17/20 EXPLICIT + 3/20 via early returns = 100%**

---

## 🚫 CONSTRAINT vs MODE

**APK = CONSTRAINT, not mode determinant**

```
✅ CORRECT:
   "Cashback 5% khusus APK" → mode: formula, require_apk: true

❌ WRONG:
   "Cashback 5% khusus APK" → mode: event (because APK)
```

APK can appear in ANY mode:
- APK Freechip → fixed (given reward)
- APK Cashback 5% → formula (calculated reward)
- APK tier rewards → tier (tiered reward)

---

## 📊 CONFIDENCE SIGNALING

```typescript
interface PrimitiveInference {
  task_domain: TaskDomain;
  reward_nature: RewardNature;
  confidence: 'high' | 'medium' | 'low';
  ambiguity_flags: string[];
}
```

**Confidence Rules:**
- `high`: Clear evidence, no conflicts
- `medium`: Conflicting signals or minimal hints
- `low`: No evidence or empty content

**Ambiguity Flags:**
- `platform_financial_conflict` — APK + Deposit/Cashback
- `access_tiered_overlap` — VIP level vs tier table
- `access_single_level_reward` — Single VIP level (might be tier in disguise)
- `calculated_chance_conflict` — Shouldn't happen
- `no_evidence` — Empty or meaningless content
- `minimal_hints` — Only 1-2 hints found

---

## 🔒 INVARIANT RULES (v1.2.1)

### FIXED MODE
- `calculation_basis` MUST be null ✓
- `tier_count` MUST be 0 ✓
- `turnover_enabled` CAN be true (for WD requirement) ✓ **RELAXED**

### FORMULA MODE
- `calculation_basis` MUST NOT be null ✓
- `tier_count` MUST be 0 ✓

### TIER MODE
- `tier_count` MUST be > 0 ✓
- `tiers[]` or `subcategories[]` MUST have items ✓

---

## 🚫 FORBIDDEN PATTERNS

### ❌ Regex as Decision
```typescript
// FORBIDDEN
if (/apk|aplikasi/.test(content)) {
  mode = 'event'; // NO! Regex ≠ decision
}
```

### ❌ Mode Assignment Outside Gate
```typescript
// FORBIDDEN in any file except promo-primitive-gate.ts
out.mode = 'formula'; // NO! Use resolveModFromPrimitive()
```

### ❌ Fallback Without Reasoning
```typescript
// FORBIDDEN
return { mode: 'fixed' }; // NO! Must include reasoning
```

### ❌ Implicit Fallback
```typescript
// FORBIDDEN
if (!result) return 'fixed'; // NO! This is "lucky" fallback
```

---

## ✅ ALLOWED PATTERNS

### ✅ Evidence Collection (Regex)
```typescript
// ALLOWED in primitive-evidence-collector.ts
platform_hints: extractMatches(lower, [/apk/, /download/])
```

### ✅ Primitive Inference
```typescript
// ALLOWED in primitive-evidence-collector.ts
if (evidence.financial_hints.length > 0) return 'financial';
```

### ✅ Mode Decision (Gate Only)
```typescript
// ALLOWED ONLY in promo-primitive-gate.ts
if (task_domain === 'financial' && reward_nature === 'calculated') {
  return { mode: 'formula', reasoning: '...' };
}
```

### ✅ Mode Enforcement (Not Decision)
```typescript
// ALLOWED in sanitize-by-mode.ts
if (mode === 'event') {
  out.calculation_basis = null; // Enforce, not decide
}
```

---

## 🧪 GOLDEN TEST SET (Required)

**🚫 CI GATE — ALL TESTS MUST PASS**
If any test fails, PR should be BLOCKED.
Do NOT add auto-fix or silent sanitize to make tests pass.

10 tests MUST pass for v1.2.1 compliance:

1. **T1**: Cashback 5% khusus APK → formula, require_apk=true
2. **T2**: Bonus Deposit 50rb → fixed (EXPLICIT rule)
3. **T3**: Freechip APK, TO 1x → fixed, turnover_enabled=true ALLOWED
4. **T4**: VIP Level 5 bonus 50k → fixed
5. **T5**: VIP Level 1-10 rewards → tier
6. **T6**: Lucky Spin Deposit → fixed (chance → fixed)
7. **T7**: Download APK dapat 20rb → fixed, require_apk=true
8. **T8**: Bonus Deposit 10% → formula
9. **T9**: Ambiguous case → confidence=medium
10. **T10**: No evidence → confidence=low

---

## 🛡️ STOP CONDITION

After v1.2.1, the following is FORBIDDEN:

| Action | Allowed? |
|--------|----------|
| Add regex to fix single promo | ❌ NO |
| Fallback without reasoning | ❌ NO |
| UI/helper decides mode | ❌ NO |
| Mode assignment outside gate | ❌ NO |

The following is ALLOWED (via contract update):

| Action | Allowed? |
|--------|----------|
| Add new domain/reward_nature | ✅ YES |
| Add evidence pattern (signal only) | ✅ YES |
| Update decision table in gate | ✅ YES |

---

## 📝 CHANGE LOG

### v1.2.1 (2025-01-14) — HARD FREEZE
- Moved to `docs/architecture/` (permanent location)
- Added SYSTEM CONTRACT header
- Added `access_single_level_reward` ambiguity flag
- Added decision trace logging (dev only)
- Added regex inflation warning
- Marked as FROZEN

### v1.2.0 (2025-01-14)
- Added EXPLICIT rule for `financial + fixed`
- Split "level" pattern: access vs tiered
- RELAXED invariant: fixed mode CAN have turnover_enabled=true
- Expanded SPECIAL CASE for APK + financial detection
- Added confidence scoring + ambiguity flags

### v1.1.0 (2025-01-14)
- Initial implementation
- APK treated as CONSTRAINT
- 16/20 explicit decision table coverage
