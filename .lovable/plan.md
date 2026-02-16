

## Fix: Auto-Generate Fields on Mount When Auto is ON

### Problem
The "Auto" toggle for Template Respons and Reasoning Guideline is ON by default, but the fields remain empty because auto-generation only triggers on user interaction (click reaction, change mode, toggle switch). There is no logic to generate content when the component first renders.

### Solution
Add a `useEffect` in `Step2Reaction.tsx` that checks on mount (and when relevant dependencies change): if auto is enabled AND the field is empty AND a reaction + mode are already selected, then auto-generate the content.

### Technical Changes

**File: `src/components/VOCDashboard/BehavioralWizard/Step2Reaction.tsx`**

Add a `useEffect` after the existing state declarations (around line 27):

```typescript
import { useState, useEffect } from "react";

// After line 26 (autoReasoning state), add:
useEffect(() => {
  if (autoTemplate && !data.response_template && data.mode_respons && data.scenario) {
    const autoContent = getTemplateForMode(data.mode_respons, data.scenario);
    if (autoContent) {
      onChange({ response_template: autoContent });
    }
  }
  if (autoReasoning && !data.reasoning_guideline && data.mode_respons && data.scenario) {
    const autoContent = getReasoningForMode(data.mode_respons, data.scenario);
    if (autoContent) {
      onChange({ reasoning_guideline: autoContent });
    }
  }
}, [data.mode_respons, data.scenario]);
```

This ensures:
- When Step 2 renders with a scenario already selected from Step 1, and a default mode is set, the fields auto-populate immediately
- It only fills empty fields (won't overwrite user edits)
- It re-triggers if scenario or mode changes

