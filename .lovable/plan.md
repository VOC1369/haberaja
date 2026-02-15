

# Livechat Test Console + Debug Mode (Dev Only)

## Overview

A standalone test console for simulating livechat conversations with the AI agent, using the existing APBE persona configuration and Promo KB data. Debug Mode reveals the AI's reasoning breakdown for every response -- user intent, JSON fields referenced, mismatch detection, confidence level, and KB consistency.

## Architecture

The system uses the existing OpenAI dev key (`config/openai.dev.ts`) for LLM calls, consistent with the current extraction architecture. No edge function needed since this is a dev-only tool.

```text
+-------------------+       +------------------+       +------------------+
|  LivechatConsole  | ----> | buildChatContext  | ----> |  OpenAI API      |
|  (UI Component)   |       | (system prompt +  |       |  (gpt-4o-mini)   |
|                   |       |  KB data + debug   |       |                  |
|  [Debug Toggle]   |       |  instructions)    |       |                  |
+-------------------+       +------------------+       +------------------+
        |                           |
        v                           v
  Debug Panel              APBE Prompt Template
  (collapsible)            + PromoKB Data
                           + Persona Bindings
```

## New Files

### 1. `src/lib/livechat-engine.ts`

Core chat engine that:
- Loads APBE config and compiles the runtime system prompt via `compileRuntimePrompt()`
- Loads all promo KB entries via `promoKB.getAll()` and serializes relevant fields as context
- Builds two system prompt variants:
  - **Normal mode**: persona prompt + KB context
  - **Debug mode**: persona prompt + KB context + debug instruction block (the structured debug format from the spec)
- Calls OpenAI API (streaming) using the existing `getOpenAIKey()` from `config/openai.dev.ts`
- Parses debug responses: splits AI output into `answer` and `debug` sections using a `---DEBUG---` delimiter marker injected via the system prompt

Key types:
```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  debug?: DebugBreakdown | null;
  timestamp: string;
}

interface DebugBreakdown {
  userIntent: string;
  jsonFieldsReferenced: string[];
  analysis: string;
  retrievalStatus: 'valid' | 'partial' | 'none';
  conflictCheck: string;
  confidence: string;
  finalValidation: string;
  raw: string; // full debug text for display
}
```

### 2. `src/components/VOCDashboard/LivechatTestConsole.tsx`

Main component containing:
- **Header bar**: Title "Livechat Test Console" + Debug Mode toggle (Switch component) + Promo selector dropdown (select which promo KB entry to test against)
- **Chat area**: ScrollArea with message bubbles (user = left/muted, agent = right/golden)
- **Debug panels**: Collapsible panel below each agent message (only visible when Debug ON), styled with monospace font, structured sections matching the spec format
- **Input area**: Text input + Send button, with loading state during streaming
- **Clear button**: Reset conversation

### 3. `src/components/VOCDashboard/DebugPanel.tsx`

Reusable collapsible debug panel component:
- Trigger shows "Debug" with a search icon
- Content renders the 7 debug sections in human-readable format:
  1. User Intent
  2. JSON Data Referenced (field = value format)
  3. Analysis (match/mismatch/ambiguity)
  4. Retrieval Status
  5. Conflict Check
  6. Confidence
  7. Final Validation
- Uses `Collapsible` from existing UI components
- Styled with `bg-muted/30 border rounded-lg font-mono text-xs`

## Modified Files

### 4. `src/pages/Dashboard.tsx`

Add the LivechatTestConsole as a new category option in the dashboard navigation. It will be accessible alongside the existing ChatSection but as a separate "Test Console" entry.

### 5. `src/components/VOCDashboard/CategoryNav.tsx`

Add a "Test Console" nav item (dev-only, conditionally rendered when `IS_DEV_MODE` is true).

## Technical Details

### System Prompt Construction (Debug Mode)

When Debug Mode is ON, the system prompt appends this instruction block after the persona prompt:

```text
After answering the user normally, you MUST produce a structured Debug section.
Separate your answer and debug with exactly this line: ---DEBUG---

The Debug section format:

[User Intent]
<summarize user intent in 1 sentence>

[JSON Data Referenced]
<list each field used as: field_name = value>
<if custom_terms: custom_terms -> poin X: "quote">
<if special_conditions: special_conditions -> "quote">

[Analysis]
<one of: Match ditemukan | Mismatch terdeteksi | Ambiguitas terdeteksi | Field kosong | Konflik antar field>
<brief explanation>

[Retrieval Status]
<valid | partial | none>

[Conflict Check]
<tidak ada | ada (list fields)>

[Confidence]
<sangat tinggi | tinggi | sedang | rendah>

[Final Validation]
<one of: Jawaban konsisten dengan KB | Jawaban berpotensi ambiguous | KB kurang lengkap | JSON conflict terdeteksi>
```

### KB Context Injection

For the selected promo, the engine serializes these fields into the system prompt as a JSON block:
- `promo_name`, `promo_type`, `reward_mode`, `reward_amount`, `min_deposit`, `max_bonus`, `turnover_multiplier`, `calculation_base`, `payout_direction`, `trigger_event`, `special_conditions`, `custom_terms`, `blacklisted_games`, `valid_from`, `valid_until`

Format in prompt:
```text
# KNOWLEDGE BASE — Active Promo
Promo: {name}
```json
{ field: value, ... }
```
```

### Response Parsing

The engine splits the streamed response at `---DEBUG---`:
- Everything before = normal answer (rendered as chat bubble)
- Everything after = parsed into `DebugBreakdown` struct using regex matching on `[Section Name]` headers

### OpenAI Call Pattern

Uses the same direct-call pattern as `openai-extractor.ts`:
```typescript
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${getOpenAIKey()}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [...],
    stream: true,
  }),
});
```

## Implementation Sequence

1. Create `src/lib/livechat-engine.ts` -- chat engine with KB loading, prompt building, streaming, debug parsing
2. Create `src/components/VOCDashboard/DebugPanel.tsx` -- collapsible debug display component
3. Create `src/components/VOCDashboard/LivechatTestConsole.tsx` -- main UI with chat, toggle, promo selector
4. Update `src/components/VOCDashboard/CategoryNav.tsx` -- add dev-only nav entry
5. Update `src/pages/Dashboard.tsx` -- wire up the new component to the category routing

## UI Layout

```text
+------------------------------------------------------------------+
| Livechat Test Console            [Promo: v] [Debug Mode: ON/OFF] |
+------------------------------------------------------------------+
|                                                                    |
|  [User bubble]  "Maksimal bonus berapa?"                          |
|                                                                    |
|                    [Agent bubble]  "Hai kak! Maksimal bonus..."   |
|                    +-- Debug (collapsible) ----------------------+|
|                    | User Intent: User menanyakan batas bonus     ||
|                    | JSON Data:                                   ||
|                    |   max_bonus = 50000                         ||
|                    |   special_conditions -> "Maks bonus 50.000" ||
|                    | Analysis: Match ditemukan                   ||
|                    | Retrieval: valid                            ||
|                    | Conflict: tidak ada                         ||
|                    | Confidence: sangat tinggi                   ||
|                    | Final: Jawaban konsisten dengan KB           ||
|                    +--------------------------------------------+|
|                                                                    |
+------------------------------------------------------------------+
| [Ketik pesan...                                        ] [Send]  |
+------------------------------------------------------------------+
```

