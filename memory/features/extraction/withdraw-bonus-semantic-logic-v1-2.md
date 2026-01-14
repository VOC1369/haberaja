# Memory: features/extraction/withdraw-bonus-semantic-logic-v1-2
Updated: 2025-01-14

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

## Bug Fixed
**Before**: Patterns like `"minimal to x 1"` incorrectly set `calculation_basis: "turnover"` because regex `/(?:to|turnover)\s*x\s*\d/i` was used as "turnover evidence" for calculation basis.

**After**: These patterns are now correctly isolated to `turnover_multiplier` detection only. The `calculation_basis` detection uses explicit calculation examples (e.g., `"WD 500.000 × 5%"`) as the source of truth.

## Expected Output for "BONUS EXTRA WD 5%"
```json
{
  "calculation_basis": "withdraw",     // From "Player wd 500.000 × 5% = 25.000"
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
