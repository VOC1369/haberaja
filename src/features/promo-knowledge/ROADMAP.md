# Promo Knowledge — Typing Roadmap

**Current (Gate 1):** `claim_engine` + `readiness_engine` are strictly typed.
All other engines are loosely typed (`Record<string, unknown>`-ish) so the inert
shape compiles without committing to schema details we have not yet verified.

## Tightening order (post Gate 1 sign-off)

1. `identity_engine` — small, used everywhere (promo_name surfaces in list view).
2. `classification_engine` — well-defined Q1–Q4 block, low risk.
3. `period_engine` + `time_window_engine` — date/timezone validation lands here.
4. `trigger_engine` — needed before extractor proof (Gate 2).
5. `reward_engine` / `mechanics_engine` / `variant_engine` — last. High variance,
   touch only after extractor reasoning is locked.

## Rules

- One engine per PR. No big-bang typing pass.
- Each engine gets its own validator section + tests, mirroring `claim_engine`.
- D-6 governance stays in the Registry. Never duplicate or hardcode.
- `_schema.version "1.1"` remains spec-historical alias only.
