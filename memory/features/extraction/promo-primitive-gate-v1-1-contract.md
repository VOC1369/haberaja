# Memory: features/extraction/promo-primitive-gate-v1-1-contract
Updated: 2025-01-14

## PROMO PRIMITIVE GATE v1.1

### Arsitektur

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROMO PRIMITIVE GATE v1.1                     │
│                    (Single Source of Truth)                      │
├─────────────────────────────────────────────────────────────────┤
│  INPUT PRIMITIVES:                                               │
│  ├─ task_type: action | moment | state                           │
│  ├─ task_domain: platform | financial | gameplay | temporal      │
│  │              | ACCESS                                          │
│  ├─ state_change: string                                         │
│  └─ reward_nature: fixed | calculated | tiered | CHANCE          │
│                                                                  │
│  OUTPUT:                                                         │
│  ├─ mode: fixed | formula | tier                                 │
│  └─ constraints: { require_apk?, trigger_event?, ... }           │
└─────────────────────────────────────────────────────────────────┘
```

### Prinsip Kritis

1. **Regex = EVIDENCE, bukan DECISION**
   - Evidence Collector mengumpulkan hints dari teks
   - Primitive Gate yang MENENTUKAN mode berdasarkan logika

2. **APK = CONSTRAINT, bukan MODE DETERMINER**
   - `require_apk: true` adalah constraint terpisah
   - Mode ditentukan oleh task_domain × reward_nature
   - Contoh: APK Cashback 5% → mode = formula, require_apk = true

3. **Invariant sebagai System Assertion**
   - Invariant violations di-LOG dan THROW (development)
   - Bukan silent fix

### Decision Table (LOCKED)

| task_domain | reward_nature | → mode   | Example |
|-------------|---------------|----------|---------|
| platform    | fixed         | fixed    | APK Freechip |
| platform    | calculated    | formula  | APK Cashback 5% |
| financial   | fixed         | fixed    | Bonus Deposit 50rb |
| financial   | calculated    | formula  | Bonus Deposit 10% |
| financial   | tiered        | tier     | Event Turnover Mobil |
| gameplay    | calculated    | formula  | Rollingan 0.5% |
| temporal    | fixed         | fixed    | Birthday Bonus |
| access      | fixed         | fixed    | VIP Unlock Reward |
| access      | tiered        | tier     | VIP Level Up Tiers |
| any         | chance        | fixed    | Lucky Spin, Raffle |

### Type Definitions

```typescript
// Task Domain (Penguatan #1: +access)
type TaskDomain = 
  | 'platform'   // Install, download, register
  | 'financial'  // Deposit, withdraw, turnover, loss
  | 'gameplay'   // Bet, spin, scatter, win
  | 'temporal'   // Birthday, anniversary, daily
  | 'access';    // VIP unlock, room access, privilege

// Reward Nature (Penguatan #2: +chance)
type RewardNature = 
  | 'fixed'      // Nilai tetap, tidak dihitung
  | 'calculated' // Hasil perhitungan (%, dari basis)
  | 'tiered'     // Berbeda per threshold
  | 'chance';    // Non-deterministik (lucky spin, raffle)

// Canonical Mode
type CanonicalMode = 'fixed' | 'formula' | 'tier';
```

### Invariant Rules (Penguatan #3)

```typescript
// FIXED MODE
if (mode === 'fixed') {
  assert(calculation_basis === null);
  assert(turnover_enabled === false);
  assert(tier_count === 0);
}

// FORMULA MODE
if (mode === 'formula') {
  assert(calculation_basis !== null);
  assert(tier_count === 0);
}

// TIER MODE
if (mode === 'tier') {
  assert(tier_count > 0);
  assert(subcategories.length > 0 || tiers.length > 0);
}
```

### Files

- `src/lib/extractors/promo-primitive-gate.ts` - Core gate logic
- `src/lib/extractors/primitive-evidence-collector.ts` - Regex evidence
- `src/lib/extractors/primitive-invariant-checker.ts` - System assertions
- `src/lib/extractors/mechanic-router.ts` - Integrated with gate
- `src/lib/sanitize-by-mode.ts` - Invariant enforcement

### Usage Example

```typescript
import { collectPrimitiveEvidence, inferTaskDomain, inferRewardNature, hasApkConstraint } from './primitive-evidence-collector';
import { resolveModFromPrimitive } from './promo-primitive-gate';
import { checkModeInvariants } from './primitive-invariant-checker';

// 1. Collect evidence
const evidence = collectPrimitiveEvidence(promoContent);

// 2. Infer primitives from evidence
const taskDomain = inferTaskDomain(evidence, promoContent);
const rewardNature = inferRewardNature(evidence);

// 3. Resolve mode via gate
const result = resolveModFromPrimitive({
  task_type: 'action',
  task_domain: taskDomain,
  state_change: 'eligible',
  reward_nature: rewardNature,
});

// 4. Set APK as constraint (separate from mode)
const require_apk = hasApkConstraint(evidence);

// 5. Check invariants
const invariantResult = checkModeInvariants(result.mode, promoData);
if (!invariantResult.valid) {
  console.error(invariantResult.violations);
}
```

### Test Cases

1. **APK Freechip**
   - Evidence: platform_hints = ["pengguna apk"]
   - Inferred: task_domain = platform, reward_nature = fixed
   - Gate Result: **mode = fixed**, require_apk = true

2. **APK Cashback 5%**
   - Evidence: platform_hints + calculated_hints
   - Inferred: task_domain = financial, reward_nature = calculated
   - Gate Result: **mode = formula**, require_apk = true ✅

3. **Lucky Spin**
   - Evidence: chance_hints = ["lucky spin"]
   - Inferred: reward_nature = chance
   - Gate Result: **mode = fixed** (non-deterministic)

4. **Event Turnover Hadiah Mobil**
   - Evidence: financial_hints + tiered_hints
   - Inferred: task_domain = financial, reward_nature = tiered
   - Gate Result: **mode = tier**
