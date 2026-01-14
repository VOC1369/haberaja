# Memory: features/data-architecture/turnover-consistency-bridge-v1-1
Updated: 2025-01-14

Implemented 'Turnover Consistency Bridge v1.1' to fix "Toggle ON but dropdown empty" bug for all promo types. 

**Root Cause**: System has two representations for turnover:
1. `turnover_multiplier` (number, canonical) e.g., `1`
2. `turnover_rule` (string, UI dropdown) e.g., `"1x"`

When `turnover_enabled` was set to `true` with a `turnover_multiplier` value, the `turnover_rule` string was sometimes not populated, causing the UI dropdown to appear empty despite the toggle being active.

**Solution** (3-layer approach):
1. **Extractor Layer** (`openai-extractor.ts`): Changed gating from `lockedFields?.mode === 'formula'` to `initialMode === 'formula'` to use post-Backstop B corrected mode for turnover extraction.

2. **Normalizer Layer** (`promo-field-normalizer.ts`): Added Step 3.2B "Turnover Consistency Bridge" that:
   - If `turnover_enabled` is true and `turnover_rule` is empty but `turnover_multiplier` exists → set `turnover_rule = "${n}x"`
   - If `turnover_rule` is raw number ("1") → normalize to "1x"
   - If `turnover_rule` has value but `turnover_multiplier` missing → parse and set

3. **Post-Extraction Normalizer** (`post-extraction-normalizer.ts`): Added Rule 7 `applyTurnoverConsistencyBridge()` that applies the same bridge logic to both root promo state AND all subcategories.

**Key Principle**: This is a global, adaptive fix that works for all promo types (Deposit Bonus, Withdraw Bonus, Cashback, etc.) - not a hardcoded fix for one specific promo.

**Unit Tests Added**: 
- `contract-of-thinking.test.ts` includes 4 new tests for Turnover Consistency Bridge verifying:
  - Withdraw Bonus detection with percentage
  - Bridge populates turnover_rule from turnover_multiplier
  - Raw number normalization to "Nx" format
  - String number normalization to "Nx" format
