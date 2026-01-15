# Memory: features/extraction/promo-taxonomy-v1-0-locked
Updated: 2025-01-15

Implemented VOC PROMO TAXONOMY MODE v1.0 as the **Single Source of Truth** for all promo classification and field resolution. This architecture replaces per-promo logic with evidence-based archetype detection.

## 4 Architectural Locks

### Lock #1: ARCHETYPE_RULES = Constraints, Not Fixed Values
- `locked_fields`: Always true for archetype (e.g., CASHBACK trigger = Loss)
- `derived_fields`: From evidence with constraints (e.g., WITHDRAW_BONUS mode = fixed|formula)
- `optional_fields`: May or may not exist based on T&C

### Lock #2: Detector = Positive + Negative + Disqualifier
- `positive_cues`: Adds score (+10 each)
- `negative_cues`: Reduces score (-5 each)
- `disqualifiers`: Hard reject (score = -Infinity)
- Detection flow: Patterns PROPOSE → Invariants CONFIRM → Return UNKNOWN if no valid candidate

### Lock #3: Invariant Conflict → UNKNOWN, Not Throw
- `impossible_states`: Schema violations → throw Error in dev (e.g., tier_count < 0)
- `misclassification_conflicts`: Archetype mismatch → downgrade to UNKNOWN (e.g., CASHBACK with trigger=Deposit)

### Lock #4: UI = Archetype-Driven, Not Mode-Driven
- UI renders fields based on `archetype.field_applicability`
- Mode is read-only output derived from archetype + evidence
- `useArchetypeContext` provides all rendering decisions

## 11 Canonical Archetypes

| Archetype | Trigger | Mode | Basis | Key Invariants |
|-----------|---------|------|-------|----------------|
| DEPOSIT_BONUS | Deposit | fixed/formula | deposit | trigger=Deposit |
| WITHDRAW_BONUS | Withdraw | fixed/formula | withdraw/turnover | trigger=Withdraw |
| CASHBACK | Loss | formula | loss | trigger=Loss, payout=after |
| ROLLINGAN | Turnover | formula | turnover | trigger=Turnover |
| REFERRAL | Referral | tier | referral_turnover | trigger=Referral |
| PLATFORM_REWARD | APK/Registration | fixed | null | require_apk=true |
| TEMPORAL_REWARD | Login | fixed | null | claim_frequency=tahunan |
| COMPETITION | Milestone | tier | turnover | tier_count>0 |
| LUCKY_DRAW | Event | fixed | null | mode=fixed, no basis |
| ACCESS_REWARD | Level Up | fixed/tier | null | flexible |
| UNKNOWN | - | - | - | Flag for review |

## Files Created

1. `src/lib/extractors/promo-taxonomy.ts` - Canonical archetype registry
2. `src/lib/extractors/archetype-detector.ts` - Evidence-based detection
3. `src/lib/extractors/archetype-invariant-validator.ts` - Hard + soft validation
4. `src/lib/extractors/field-derivation-engine.ts` - Derive fields from evidence
5. `src/hooks/use-archetype-context.tsx` - UI archetype context

## Anti-Patterns (FORBIDDEN)

1. ❌ Per-promo logic (e.g., "if promo name contains X, set Y")
2. ❌ Hardcoded defaults without evidence
3. ❌ Mode-driven UI rendering (check mode first, then render)
4. ❌ Throwing errors for misclassification (use UNKNOWN instead)
5. ❌ Adding regex patterns for single promo cases

## Expected Behavior

| Input | Archetype | Mode | Confidence |
|-------|-----------|------|------------|
| "Bonus Deposit 10%" | DEPOSIT_BONUS | formula | high |
| "Freechip APK 5K-20K" | PLATFORM_REWARD | fixed | high |
| "Cashback Kekalahan 5%" | CASHBACK | formula | high |
| "Bonus WD 5%" | WITHDRAW_BONUS | formula | medium (basis from evidence) |
| "Lucky Spin Natal" | LUCKY_DRAW | fixed | high |
| "Event Turnover Mobil" | COMPETITION | tier | high |
| "Random promo text" | UNKNOWN | - | low |

## Integration Points

- `openai-extractor.ts`: Use `detectArchetype()` and `deriveFieldsForArchetype()`
- `Step3Reward.tsx`: Use `useArchetypeContext()` for field rendering
- `sanitize-by-mode.ts`: Validate against archetype invariants
- `PseudoKnowledgeSection.tsx`: Display archetype badge
