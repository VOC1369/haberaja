# Mechanics Engine — `items[].data` Shape Doctrine (Step 5D)

**Status:** LOCKED 2026-05-01.  
**Authority:** WB_F1 §8.1 + Step 4F-tris final lock.  
**Scope:** Documentation only. NOT enforced at runtime in this step. Validator
will pick this up in Step 6B.

---

## Why this exists

`PkV10MechanicItem.data` is typed as `Record<string, unknown>` so the schema can
absorb shape evolution without breaking. But "open `data`" without a contract
becomes a polymorphic mess. This doc locks the conventions so the extractor
(Step 6A) and selectors (Step 7) can rely on a stable shape.

Per Step 4F-tris boundary lock:
- `mechanics_engine.items[]` = **execution truth** (HOW reward operates)
- `reward_engine` = **display summary** (WHAT user gets)

`data` shapes below describe HOW. They are read by selectors via the
`findMechanic(rec, type, scopeKey?, scopeValue?)` helper (Step 7).

---

## Convention by `mechanic_type`

### `mechanic_type: "reward"`

Describes a single reward instance the user receives, plus how it is executed
or redeemed against an external system.

```jsonc
{
  "mechanic_id": "M01",
  "mechanic_type": "reward",
  "evidence": "<extractor evidence string>",
  "confidence": 0.95,
  "ambiguity": false,
  "activation_rule": null,
  "data": {
    "reward_form": "lucky_spin",          // mirrors reward_engine.reward_type
                                          // (PkV10RewardType vocabulary)
    "external_system": {                  // OPTIONAL — present when reward
                                          // is gated by an external system
      "system": "spin_engine",            // PK_V10_EXTERNAL_SYSTEM enum
      "ref_id": "LS-001",                 // free-form string handle
      "redemption_method": "auto"         // PK_V10_REDEMPTION_METHOD enum
    },
    "execution": {                        // OPTIONAL — usage caps
      "max_per_day": 5,                   // number | null
      "max_per_period": null,             // number | null
      "consumption": "single_use"         // free-form, lock later if needed
    }
  }
}
```

**Rules:**
- `data.reward_form` MUST equal `reward_engine.reward_type` when both filled.
- `external_system.system === "none"` ↔ no external system gating
  (e.g. cash payout). When `system === "none"`, `ref_id` SHOULD be `""`.
- `external_system` MAY be omitted entirely for trivial cash rewards.
- `execution.max_per_day` / `max_per_period` use the unlimited convention from
  Step 5B if needed in the future: add sibling
  `max_per_day_unlimited: boolean`. NOT added in this step.

### `mechanic_type: "time_window"`

Describes a temporal constraint. Single source for "validity" semantics across
the record (no duplication into `reward_engine`, no duplication into
`period_engine` outside its own validity_block).

```jsonc
{
  "mechanic_id": "M02",
  "mechanic_type": "time_window",
  "evidence": "<extractor evidence string>",
  "confidence": 0.98,
  "ambiguity": false,
  "activation_rule": null,
  "data": {
    "scope": "reward_validity",          // PK_V10_TIME_WINDOW_SCOPE enum
    "validity": {
      "validity_mode": "absolute",        // PK_V10_VALIDITY_MODE enum
      "valid_until": "2026-12-31",        // ISO date | null
      "valid_until_unlimited": false,     // Step 5B sibling — true = unlimited
      "duration": null,                   // number | null
      "duration_unit": null               // PK_V10_VALIDITY_DURATION_UNIT | null
    }
  }
}
```

**Rules:**
- `scope` MUST be a value in `PK_V10_TIME_WINDOW_SCOPE`.
  - `reward_validity` → bounds the reward instance (e.g. spin valid until X).
  - `claim_window` → bounds when the user can claim.
  - `promo_period` → bounds the promo as a whole (mirror of
    `period_engine.validity_block`).
- `validity.valid_until_unlimited === true` MUST imply `valid_until === null`.
  Validator will enforce this in Step 6B.
- A single record MAY have multiple `time_window` items with different scopes.

### `mechanic_type: "control"` *(reference, not used in this step)*

Reserved for hard execution caps not tied to a single reward instance
(e.g. global daily claim cap). Shape will be locked in a later step if needed.
Listed here only so extractor authors do not invent ad-hoc shapes.

### Other `mechanic_type` values

`eligibility | trigger | calculation | claim | invalidator | distribution |
turnover | dependency | intent | scope | proof` — `data` shape NOT locked in
this step. Extractor MAY use `Record<string, unknown>` until each gets its
own doctrine slice.

---

## Selector contract (Step 7 preview — NOT implemented yet)

Selectors read mechanic data via a single helper:

```ts
// pseudo
sel.findMechanic(rec, type: PkV10MechanicType,
                 scopeKey?: string, scopeValue?: string): PkV10MechanicItem | null;
```

Public selectors built on top will be DIRECT, no fallback, no parsing:

```ts
sel.luckySpinId(rec)          // findMechanic(rec, "reward")
                              //   ?.data.external_system?.ref_id ?? null
sel.luckySpinMaxPerDay(rec)   // findMechanic(rec, "reward")
                              //   ?.data.execution?.max_per_day ?? null
sel.spinValidUntil(rec)       // findMechanic(rec, "time_window",
                              //   "scope", "reward_validity")
                              //   ?.data.validity?.valid_until ?? null
sel.spinValidUntilUnlimited(rec)
                              // same path, ".valid_until_unlimited" ?? false
```

---

## What this doctrine does NOT change

- No runtime schema change. `PkV10MechanicItem.data` remains `Record<string, unknown>`.
- No extractor change. Extractor still writes whatever it writes; alignment
  happens in Step 6A.
- No selector change. Selectors do not yet read these paths; wired in Step 7.
- No validator change. Invariants enforced in Step 6B.
- No UI change. UI rebind happens in Step 8.

This file is the contract that Steps 6A / 6B / 7 / 8 will obey.
