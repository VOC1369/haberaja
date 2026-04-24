# SUNSET CHECKLIST — Legacy ↔ PK-06 Bridge

> Status: **ACTIVE BRIDGE** — Gate 1.5 (parity verification phase).
> Cutover trigger: manual sign-off based on the Parity tab (no numeric threshold).

This folder exists temporarily to verify parity between the three live JSON
shapes before routing `Copy JSON` and `Save Draft` to PK-06.0 output.

## Files marked `// @sunset-on-cutover`

Grep for the marker to find every file/symbol scheduled for removal:

```bash
grep -rn "@sunset-on-cutover" src/
```

Currently expected hits:

- `src/features/promo-knowledge/adapters/legacyFormToPK06Candidate.ts`
- `src/features/promo-knowledge/adapters/parity-diff.ts`
- `src/features/promo-knowledge/parity/ParityTab.tsx`
- `src/features/promo-knowledge/parity/index.ts`

## Cutover preconditions (manual sign-off)

Tick each item before promoting PK-06 to authority:

- [ ] Live Form Draft parity reviewed against ≥ 5 representative promos
- [ ] Saved Draft parity reviewed against ≥ 5 historical drafts
- [ ] All `diff` rows in the Parity tab classified as either:
  - intentional (whitelisted/expected), or
  - resolved in the adapter
- [ ] No critical-field `preview_only` or `persisted_only` rows for: identity,
      claim, period, reward primitives
- [ ] Decision recorded by user (no automated gate)

## Cutover steps (do NOT execute until sign-off)

1. Promote `legacyFormToPK06Candidate` → official `legacyFormToPK06Record`
   (rename + remove "candidate" semantics).
2. Route `PseudoKnowledgeSection.handleCopyJSON` to the PK-06 output.
3. Route `Step4Review` Copy JSON canonical to the PK-06 output.
4. Route `localDraftKB.save` / `toV31Row` writes through the adapter so storage
   carries D-6 governance metadata.
5. Delete the Parity tab + `parity-diff.ts` + this file.
6. Remove all `@sunset-on-cutover` markers (grep should return zero hits).

## Non-goals (explicitly out of scope while bridge is active)

- No replacement of `buildPKBPayload` / `toV31Row` yet.
- No write path through PK-06 yet.
- No Supabase schema change.
- No removal of `_mechanics_v31` duplication yet.
