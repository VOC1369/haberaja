

## Fix: Seed Data Alignment + Banned Phrase Removal

### Problems Identified (from Claude's analysis)

1. **Duplicate category**: Seed rule #1 (Aggressive) and #5 (Fraud) both use `behavior_category: "toxic_heavy"` -- AI gets confused choosing between them
2. **Banned phrase in responseTemplateMapping**: The `boundary` mode templates contain "Komunikasi yang sopan diperlukan" and "komunikasi yang sopan" which the engine explicitly bans but the template legitimizes
3. **responseTemplateMapping still single-variant**: Auto-generate produces flat single-sentence templates while seed rules are multi-variant

### Important Note on Claude's Categories

Claude recommends categories like "Aggressive", "Technical Frustration", "Emotional Distress", "Fraudulent" -- but these are NOT valid V6 enums. The system validator would BLOCK them. We need to map Claude's intent to valid V6 values while fixing the real issues.

### Changes

**File: `src/components/VOCDashboard/BehavioralWizard/types.ts`**

#### 1. Fix Seed Rule #5 (Fraud) -- eliminate duplicate `toxic_heavy`

Change seed rule #5 from:
- `behavior_category: "toxic_heavy"` to `"high_pressure"` (closest valid enum for manipulation/fraud)
- `intent_perilaku: "testing_limits"` to `"testing_limits"` (keep -- still accurate)
- `mode_respons: "crisis"` to `"boundary"` (fraud needs firm boundary, not always crisis)
- `severity_level: 5` to `4` (boundary mode max is 4 per cluster lock)
- Update `rule_name` from `SEED_ToxicHeavy_Handoff` to `SEED_HighPressure_Firm`
- Update `handoff_protocol` to match firm approach (not crisis handoff)
- Add `pattern_trigger: { rapid_message: true, repetitive_complaint: true }` (matches high_pressure required patterns)

#### 2. Fix responseTemplateMapping -- remove ALL banned phrases

In `boundary` mode entries (lines 714-722):
- `default`: Remove "Komunikasi yang sopan diperlukan", replace with multi-variant format
- `marah_kasar`: Remove "komunikasi yang sopan diperlukan", replace with boundary-setting language that doesn't lecture

Upgrade ALL boundary entries to multi-variant format:
```
"[Variasi 1] ... [Variasi 2] ... [Variasi 3] ... [INSTRUKSI] ..."
```

#### 3. Upgrade remaining responseTemplateMapping modes to multi-variant

All modes (calming, high_empathy, assurance, short, assertive_clarity, warning, crisis) will be upgraded from single-sentence to multi-variant `[Variasi 1/2/3] + [INSTRUKSI]` format, matching seed rule quality.

### Impact

- No more duplicate `toxic_heavy` -- each seed rule has unique purpose
- Auto-generate (Auto AI toggle) produces templates WITHOUT banned phrases
- Auto-generated templates are multi-variant from the start, not flat
- V6 validator will pass all rules (no BLOCK)

