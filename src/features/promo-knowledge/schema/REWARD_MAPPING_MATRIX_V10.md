# Reward Mapping Matrix V10

**Status:** DESIGN LOCK — 2026-05-02
**Authority:** Step 6B follow-up. Locks the `reward_type` ↔ `reward_form` consistency contract that Invariant #2 will later enforce.
**Scope:** Design doc only. NO code changes. NO schema changes. NO extractor changes. NO validator activation.

---

## 1. Purpose

`PkV10RewardType` (in `reward_engine.reward_type`) describes **WHAT class of value** the user receives.
`PkV10RewardForm` (in `mechanics_engine.items[].data.reward_form`) describes **HOW the reward is delivered / executed**.

These two vocabularies overlap but are not identical. Without an explicit matrix, the extractor is free to produce nonsensical pairs (e.g. `reward_type = "physical"` + `reward_form = "cashback"`). This doc locks which pairings are semantically valid so Step 6B can wire Invariant #2 later **without re-debating the matrix**.

This is **validation-only**. It is NOT used by the extractor to infer `reward_form` from `reward_type`, nor vice versa.

---

## 2. Vocabularies (reference)

**`PkV10RewardType`** (subset relevant here):
`cash | lucky_spin | voucher | physical | freespin | ticket | credit_game | discount | combo`

**`PK_V10_REWARD_FORM`** (locked Step 6.3):
`spin_token | voucher_code | cashback | physical_item | freespin_token | credit_game | mystery_reward`

---

## 3. Final Mapping Table

| `reward_type` | Allowed `reward_form` values         | Notes |
|---------------|--------------------------------------|-------|
| `cash`        | `cashback`, `credit_game`            | Cash payout OR credited as in-game balance. |
| `lucky_spin`  | `spin_token`                         | Spin engine gating — uses external_system. |
| `voucher`     | `voucher_code`                       | Code-based redemption. |
| `physical`    | `physical_item`                      | Triggers `reward_identity_block` (Step 6 boundary). |
| `freespin`    | `freespin_token`                     | Slot-bound free spins. |
| `ticket`      | `mystery_reward`                     | Draw / undian / mystery-number entry. |
| `credit_game` | `credit_game`                        | Direct in-game credit issuance. |
| `discount`    | `voucher_code`                       | Discount delivered as a code. |
| `combo`       | **ALL values allowed (open)**        | Intentionally open until combo semantics are locked. |

---

## 4. Allowed Combinations (canonical examples)

- `cash` → `cashback` ✅ (e.g. weekly rollingan cashback)
- `cash` → `credit_game` ✅ (e.g. cash bonus credited as playable balance)
- `lucky_spin` → `spin_token` ✅ (e.g. Lucky Spin promo)
- `voucher` → `voucher_code` ✅
- `physical` → `physical_item` ✅ (e.g. iPhone giveaway)
- `freespin` → `freespin_token` ✅
- `ticket` → `mystery_reward` ✅ (e.g. undian berhadiah)
- `credit_game` → `credit_game` ✅
- `discount` → `voucher_code` ✅
- `combo` → any of the 7 reward_form values ✅ (open by design)

---

## 5. Invalid Combinations (canonical examples)

These MUST trigger Invariant #2 once activated:

- `lucky_spin` + `physical_item` ❌ — spin reward isn't a physical item itself; the prize behind the spin is a separate mechanic.
- `cash` + `spin_token` ❌ — cash payouts aren't gated by a spin engine.
- `physical` + `cashback` ❌ — physical merch is not cash.
- `voucher` + `spin_token` ❌ — voucher codes aren't spin tokens.
- `freespin` + `voucher_code` ❌ — freespins are slot-bound, not code-redeemed.
- `physical` + `voucher_code` ❌ — physical item delivery is not a code.
- `ticket` + `cashback` ❌ — ticket/draw entries are not direct cash.
- `lucky_spin` + `voucher_code` ❌ — spin tokens are not voucher codes.

---

## 6. Edge Cases

1. **Empty / unknown `reward_form`**
   Allowed. Many promos won't have an explicit mechanics-level `reward_form` populated. Validator treats missing/empty as PASS for Invariant #2 (Invariant #1 already enforces enum membership when present).

2. **`combo` reward_type**
   Intentionally open. A combo promo (e.g. cashback + freespin) cannot be reduced to a single `reward_form`. Until combo decomposition is locked (separate step), all reward_form values are allowed under `combo`. Validator MUST NOT warn on combo.

3. **`mystery_reward` semantics**
   Reserved for draw / undian / mystery-number / mystery-box style rewards where the actual prize is revealed later. Only valid under `ticket` reward_type. If the prize is later resolved to physical merch, that becomes a separate downstream record — not a re-mapping of this field.

4. **`cash` dual mapping**
   `cash` → `cashback` and `cash` → `credit_game` are both valid. The distinction:
   - `cashback` = withdrawable cash (or behaves as cash post-turnover).
   - `credit_game` = in-game playable credit, not directly withdrawable.
   Extractor decides based on evidence; validator does NOT prefer one over the other.

5. **`discount` → `voucher_code` only**
   A "discount" in iGaming context is almost always delivered as a redeemable code. If a future promo uses a different delivery (e.g. auto-applied discount), this row will be revisited.

6. **Multiple reward mechanics**
   A single record MAY have multiple `mechanic_type: "reward"` items. Each item's `reward_form` is checked independently against `reward_engine.reward_type`. If `reward_type === "combo"`, all pass.

7. **Reward_form present but reward_type empty**
   Allowed. Validator only fires when BOTH are populated. Missing `reward_type` is a separate concern (readiness scoring).

---

## 7. Proposed Validator Behavior (FUTURE — not implemented now)

When Invariant #2 is wired into `pk-v10-invariants.ts`:

### Phase A — Soft launch (initial activation)
- Severity: **WARNING**
- Rationale: real promo data may surface mappings we haven't catalogued. Warning-first avoids blocking publish during the calibration window.
- Trigger condition:
  - `reward_engine.reward_type` is non-empty AND
  - At least one `mechanics_engine.items[i]` with `mechanic_type === "reward"` has a non-empty `data.reward_form` AND
  - The pair is NOT in the allowed table above AND
  - `reward_type !== "combo"`.
- Message format: `"reward_form '{form}' is not a valid mapping for reward_type '{type}'. Allowed: [...]"`

### Phase B — Hardening (after real promo testing)
- Upgrade severity to **ERROR** only after:
  1. At least N real promos (target: 20+) have been processed with WARNING active.
  2. Zero false positives observed (i.e. every WARNING fired was a genuine extractor mistake, not a missing matrix entry).
  3. Matrix has been amended to cover any legitimate new pairings discovered.
- ERROR upgrade is a separate explicit step. Do NOT auto-upgrade.

### Non-behaviors (locked)
- Validator MUST NOT auto-fix or rewrite `reward_form`.
- Validator MUST NOT infer `reward_form` from `reward_type` (or vice versa).
- Validator MUST NOT touch `combo` records.
- Validator MUST NOT fire when either side is empty/null.

---

## 8. Out of Scope

- Extractor logic. Extractor follows Step 6.1 prompt rules; this matrix is read-only reference.
- Schema changes. `reward_form` enum is already locked (Step 6.3).
- UI display. Selectors and UI binding are unaffected.
- `reward_identity_block` boundary (covered by Invariant #5, separately).

---

## 9. Change Control

Amendments to this matrix require:
1. A real promo example that the current matrix mishandles.
2. Explicit user sign-off (matrix lock is intentional).
3. Update to this doc + corresponding test case in `validator-v10-invariants.test.ts` once Invariant #2 is wired.

No silent extensions. No keyword-based inference. No fallbacks.
