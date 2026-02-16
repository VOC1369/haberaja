

# Fix Remaining 2 Items — Wizard UI for applicability_criteria

## File 1: `src/components/VOCDashboard/BehavioralWizard/Step1Scenario.tsx`

**Changes:**
- Import `Textarea` from `@/components/ui/textarea`
- Import `Label` (already imported)
- Update `handleScenarioSelect` to also set `applicability_criteria` from `scenario.mapping.default_applicability_criteria`
- Add a new Card section after the "Auto-Mapping Aktif" card (after line 82), visible only when `data.scenario` is selected:
  - Label: "Kriteria Penerapan (Applicability Criteria)"
  - Textarea bound to `data.applicability_criteria`
  - Placeholder: "Jelaskan dalam 1-3 kalimat kondisi apa yang membuat rule ini berlaku..."
  - Help text explaining this is used by LLM for rule selection

## File 2: `src/components/VOCDashboard/BehavioralWizard/Step3Review.tsx`

**Changes:**
- Add a new Card after the "Detail Teknis" card (after line 300) and before the "Template Respons" card:
  - CardTitle: "Kriteria Penerapan"
  - Display `data.applicability_criteria` in a styled div
  - Show placeholder text if empty

## Technical Details

- No new dependencies
- No schema changes
- Both files are small, straightforward additions
- `default_applicability_criteria` already exists in all 7 `scenarioCards` mappings -- just needs to be wired to `handleScenarioSelect`

