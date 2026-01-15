# Memory: features/extraction/withdraw-bonus-semantic-logic-v1-3
Updated: 2025-01-15

## Architecture: Evidence-First (No Hardcode Defaults)

This version replaces v1.2 with a stricter, evidence-based architecture.

### Core Principle
`calculation_basis` MUST be inferred from EVIDENCE, never assumed.

**Anti-Pattern (v1.2 - DEPRECATED):**
```typescript
// ❌ WRONG: Hardcode default
if (isWithdrawBonus && !calculation_basis) {
  calculation_basis = 'withdraw';  // ASSUMPTION!
}
```

**Correct Pattern (v1.3):**
```typescript
// ✅ CORRECT: Evidence-first
if (isWithdrawBonus && !calculation_basis) {
  calculation_basis = null;
  confidence = 'low';
  flags.push('missing_calculation_evidence');
}
```

## Detection Priority

### For `calculation_basis`:

| Priority | Evidence Type | Confidence | Example |
|----------|--------------|------------|---------|
| 1 | Explicit Calculation Example | HIGH | `"WD 500.000 × 5% = 25.000"` |
| 2 | "dari X" Statement | MEDIUM | `"5% dari nilai WD"` |
| 3 | NO EVIDENCE | LOW | Flag for human review |

### Detection Patterns:

```typescript
// PRIORITY 1: Explicit calculation (HIGH confidence)
const withdrawCalcPattern = /(?:wd|withdraw|penarikan)\s*[\d.,]+\s*[×x]\s*\d+\s*%/i;
const turnoverCalcPattern = /(?:to|turnover)\s*[\d.,]+\s*[×x]\s*\d+\s*%/i;

// PRIORITY 2: "dari X" statements (MEDIUM confidence)
const dariWithdrawPattern = /(?:dari|berdasarkan)\s*(?:wd|withdraw|penarikan)/i;
const dariTurnoverPattern = /(?:dari|berdasarkan)\s*(?:to|turnover)/i;
```

## Payout Direction Rules (CONDITIONAL)

| calculation_basis | payout_direction | Reasoning |
|-------------------|------------------|-----------|
| `'withdraw'` | `'after'` (MANDATORY) | Bonus = f(WD), WD must happen first |
| `'turnover'` | Infer from S&K | WD is just gate, bonus can be before/after |
| `null` | `'after'` (default) | Conservative, but flagged LOW confidence |

### Semantic Distinction (v1.3 Critical Fix):

| Concept | Meaning | Example |
|---------|---------|---------|
| **Claim Timing** | When user requests bonus | "claim ke livechat **sebelum** isi form WD" |
| **Payout Direction** | When bonus is actually given | After WD succeeds (BELAKANG) |

**Pattern: "sebelum isi form WD" → Claim Timing, NOT Payout Direction**

## Integration with Taxonomy

This archetype is part of the Promo Pattern Taxonomy:

```yaml
WITHDRAW_BONUS:
  trigger_event: Withdraw
  task_domain: financial
  reward_nature: calculated (usually)
  
  calculation_basis:
    - 'withdraw': if explicit WD calculation evidence
    - 'turnover': if explicit TO calculation evidence
    - null: if no evidence (flag for review)
  
  payout_direction:
    - if basis='withdraw': 'after' (MANDATORY)
    - if basis='turnover': from S&K
    - if basis=null: 'after' (default, LOW confidence)
```

## Confidence Signaling

Every inference includes:
```typescript
interface WithdrawBonusInference {
  config: Partial<WithdrawBonusConfig>;
  confidence: 'high' | 'medium' | 'low';
  flags: string[];  // e.g., ['missing_calculation_evidence']
}
```

## Files Changed (v1.3)

| File | Change |
|------|--------|
| `src/lib/extractors/promo-primitive-gate.ts` | Added `confidence` and `ambiguity_flags` to interface |
| `src/lib/openai-extractor.ts` | Removed hardcode default, conditional payout |
| `src/lib/extractors/archetypes/withdraw-bonus.ts` | NEW - Archetype definition |

## Anti-Patterns (FORBIDDEN)

❌ Default `calculation_basis = 'withdraw'` tanpa evidence
❌ `payout_direction = 'after'` unconditionally for all WD promos
❌ Regex hunting without confidence scoring
❌ Treating claim timing as payout direction

## Expected Behavior

| Scenario | calculation_basis | payout_direction | confidence |
|----------|-------------------|------------------|------------|
| "WD 500.000 × 5%" | `'withdraw'` | `'after'` | HIGH |
| "TO 1jt × 5%, klaim saat WD" | `'turnover'` | from S&K | MEDIUM |
| "Bonus WD 5%" (no example) | `null` | `'after'` | LOW + flag |
| "5% dari nilai penarikan" | `'withdraw'` | `'after'` | MEDIUM |

## Change Log

- **v1.3** (2025-01-15): Evidence-First Architecture
  - Removed hardcode default for calculation_basis
  - Made payout_direction conditional on proven calculation_basis
  - Added confidence signaling to PrimitiveGateResult
  - Created dedicated archetype file
  - Integrated with taxonomy

- **v1.2.2** (2025-01-15): Bug fixes
  - Fixed tiered pattern false positive
  - Fixed claim timing vs payout direction confusion
  - Added min_calculation extraction

- **v1.2** (2025-01-15): Initial semantic separation
