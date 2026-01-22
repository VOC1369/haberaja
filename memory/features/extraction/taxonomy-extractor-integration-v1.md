# Memory: features/extraction/taxonomy-extractor-integration-v1
Updated: 2025-01-22

## Overview

Integrated VOC PROMO TAXONOMY v1.0 into `openai-extractor.ts` as the Single Source of Truth (SSoT) for all promo classification logic.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 mapExtractedToPromoFormData                      │
├─────────────────────────────────────────────────────────────────┤
│  Step 1: BUILD EVIDENCE                                          │
│  └── buildCleanedEvidence(extracted) → CleanedEvidence          │
│                                                                  │
│  Step 2: RUN TAXONOMY PIPELINE                                   │
│  └── runTaxonomyPipeline(evidence) → TaxonomyDecision           │
│                                                                  │
│  Step 3: CONFIDENCE GATE                                         │
│  └── shouldUseTaxonomy(decision)                                │
│      ├── TRUE → Taxonomy wins                                   │
│      └── FALSE → Fallback to legacy gate (UNKNOWN+low only)     │
│                                                                  │
│  Step 4: GATE DECISION                                           │
│  └── getGateDecision() — respects taxonomy                      │
│                                                                  │
│  Step 5: BUILD FORM DATA                                         │
│  └── ... existing mapping logic ...                             │
│                                                                  │
│  Step 6: FINAL LOCK (before return)                              │
│  └── if (useTaxonomy) → Force taxonomy fields                   │
└─────────────────────────────────────────────────────────────────┘
```

## Key Contracts

### 1. SSoT for 5 Core Fields
The taxonomy pipeline is the ONLY source of truth for these fields:
- `mode` / `reward_mode`
- `archetype`
- `calculation_basis`
- `payout_direction`
- `reward_nature`
- `trigger_event`

### 2. Confidence Gate
```typescript
const useTaxonomy = shouldUseTaxonomy(taxonomyDecision);
// TRUE unless: archetype === 'UNKNOWN' && confidence === 'low'
```

### 3. Extractor Role
- **BEFORE taxonomy**: Evidence collector (witness)
- **AFTER taxonomy**: CANNOT modify 5 core fields

### 4. Audit Trail
Every extraction now includes `_taxonomy_decision`:
```typescript
{
  archetype: string;
  confidence: 'high' | 'medium' | 'low';
  version: string;
  timestamp?: string;
  evidence?: string[];
  ambiguity_flags?: string[];
}
```

## Files Modified

1. `src/lib/openai-extractor.ts`
   - Added imports for taxonomy pipeline
   - Added `buildCleanedEvidence()` helper
   - Added `mergeWithTaxonomyLock()` helper
   - Modified `getGateDecision()` to respect taxonomy
   - Added final taxonomy lock before return

2. `src/components/VOCDashboard/PromoFormWizard/types.ts`
   - Added `_taxonomy_decision` to `PromoFormData`

## Forbidden Patterns

```typescript
// ❌ FORBIDDEN after taxonomy:
result.reward_mode = 'formula';        // VIOLATION!
result.calculation_base = 'deposit';   // VIOLATION!

// ✅ ALLOWED:
result.max_bonus = extracted.max_bonus; // Non-locked field
```

## Fallback Behavior

When taxonomy returns `UNKNOWN` with `low` confidence:
1. Legacy Primitive Gate takes over
2. `sanitize-by-mode.ts` runs as safety net
3. `keyword-rules.ts` may provide defaults

## Version

- Taxonomy Pipeline: v1.0.0
- Integration Date: 2025-01-22
