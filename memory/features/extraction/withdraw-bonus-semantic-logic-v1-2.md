# Memory: features/extraction/withdraw-bonus-semantic-logic-v1-2
Updated: 2025-01-15

Implemented a 'Calculation vs. Multiplier' semantic separation for Withdraw Bonus promos.

## Core Principle
`calculation_basis` and `turnover_multiplier` are **completely independent concepts** and must never be conflated:

| Concept | Field | Meaning | Example Pattern |
|---------|-------|---------|-----------------|
| **Calculation Basis** | `calculation_basis` | What the bonus is **calculated from** | `"WD 500.000 × 5% = 25.000"` |
| **Turnover Multiplier** | `turnover_multiplier` | Play requirement **before withdrawal** | `"minimal to x 1"`, `"syarat TO 1x"` |

## Detection Logic (Priority Order)

### For `calculation_basis`:
1. **PRIORITY 1**: Explicit calculation examples in S&K
   - `hasWithdrawCalculationExample`: `/(?:wd|withdraw|penarikan)\s*[\d.,]+\s*[×x]\s*\d+\s*%/i`
   - `hasTurnoverCalculationExample`: `/(?:to|turnover)\s*[\d.,]+\s*[×x]\s*\d+\s*%/i`

2. **PRIORITY 2**: Explicit "dari X" statements
   - `"dari turnover"` → `calculation_basis: "turnover"`
   - `"dari WD"` / `"dari penarikan"` → `calculation_basis: "withdraw"`

3. **PRIORITY 3**: Default for Withdraw Bonus = `"withdraw"`
   - Most WD bonus promos calculate from withdrawal amount

### For `turnover_multiplier`:
- Pattern: `/(?:to|turnover)\s*x\s*(\d+)/i` or `/minimal\s*to\s*x\s*(\d+)/i`
- These patterns **NEVER** influence `calculation_basis`

## Bug Fixed (v1.2.2)

### Bug #1: False Positive Tier Detection
**Before**: Pattern `/minimal.*dapat/` incorrectly matched "Minimal WD sebesar 200.000 bar dapat melakukan claim" as a tier indicator.

**After**: Pattern removed from `tiered_hints` in `primitive-evidence-collector.ts`. Eligibility thresholds are not tier indicators.

### Bug #2: Claim Timing vs Payout Direction Confusion
**Before**: Pattern "sebelum isi form wd" incorrectly set `payout_direction: "before"` (DEPAN).

**After**: This pattern refers to **CLAIM timing** (when to request bonus), not **PAYOUT timing** (when bonus is given). For Withdraw Bonus where `calculation_basis = 'withdraw'`, `payout_direction` is **always 'after' (BELAKANG)** because the bonus is calculated FROM the WD amount.

### Semantic Distinction:
| Concept | Meaning | Example |
|---------|---------|---------|
| **Claim Timing** | When user requests bonus | "claim ke livechat sebelum isi form WD" |
| **Payout Direction** | When bonus is given | After WD succeeds (BELAKANG) |

## Expected Output for "BONUS EXTRA WD 5%"
```json
{
  "calculation_basis": "withdraw",     // From "Player wd 500.000 × 5% = 25.000"
  "payout_direction": "after",         // BELAKANG - bonus given AFTER WD
  "turnover_multiplier": 1,            // From "minimal to x 1"
  "turnover_enabled": true,            // Toggle ON
  "min_calculation": 200000            // Min WD threshold
}
```

## Anti-Regression Tests
Unit tests in `contract-of-thinking.test.ts` verify:
1. `"minimal to x 1"` does NOT influence `calculation_basis`
2. `"WD 500.000 × 5%"` → `calculation_basis: "withdraw"`
3. Withdraw Bonus without clear evidence defaults to `"withdraw"`
4. `turnover_multiplier` and `calculation_basis` remain independent
5. `payout_direction` is ALWAYS 'after' for withdraw-based calculations
