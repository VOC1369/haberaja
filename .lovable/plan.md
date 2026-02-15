

# Fix: Debug Panel Not Showing in Livechat Test Console

## Root Cause

There is a feedback loop in the chat engine:

1. LLM responds with answer + `---DEBUG---` section
2. The `updateAssistant` callback strips `---DEBUG---` from the displayed content and saves to `messages` state
3. On the next user message, `apiMessages` is built from `messages` state -- which contains the **stripped** content
4. LLM sees its previous responses had no debug sections, so it stops including them
5. After a few turns, the LLM completely stops producing `---DEBUG---`

## Solution

Store the **full raw response** (including debug section) on each message, and use that when building the API message history. The display remains stripped, but the LLM always sees its own debug sections in history.

## Changes

### 1. Update `ChatMessage` type (livechat-engine.ts)

Add a `rawContent` field to store the unstripped full response:

```ts
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;       // display content (stripped)
  rawContent?: string;   // full content including debug (for API history)
  debug?: DebugBreakdown | null;
  timestamp: string;
}
```

### 2. Update `LivechatTestConsole.tsx` - Store raw content

- After streaming completes and debug is parsed, save `rawContent` on the assistant message
- When building `apiMessages`, use `rawContent` (if available) instead of `content`

```ts
// Building API messages - use rawContent for assistant messages
const apiMessages = [...messages, userMsg].map(m => ({
  role: m.role,
  content: m.rawContent || m.content,
}));
```

- In the streaming flow, after `onDone`, attach the full `assistantContent` (before stripping) as `rawContent` on the message

### 3. Update streaming callback flow

In `handleSend`, track the full unstripped content and save it to the message:

- Keep a `fullRawContent` variable that accumulates all chunks (same as current `assistantContent`)
- After stream ends, update the final assistant message to include `rawContent: fullRawContent`

## Technical Details

### Files Modified
- `src/lib/livechat-engine.ts` -- add `rawContent` to `ChatMessage` interface
- `src/components/VOCDashboard/LivechatTestConsole.tsx` -- store raw content, use it for API history

### No Breaking Changes
- `rawContent` is optional, so existing messages without it gracefully fall back to `content`
- Display behavior unchanged -- users still see clean responses
- Debug panel behavior unchanged -- parsed from `---DEBUG---` section as before

