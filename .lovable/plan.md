

# Fix: Persona Placeholder di Greeting Tidak Ter-resolve

## Problem

Greeting persona "Maya" menampilkan raw placeholder:
```
Selamat datang di {{A.website_name}}. Saya {{agent_name}}, siap membantu Kak hari ini.
```

Seharusnya:
```
Selamat datang di Spontan77. Saya Maya, siap membantu Kak hari ini.
```

## Root Cause

Di `compileRuntimePrompt()` (`src/lib/apbe-prompt-template.ts`), regex replace hanya berjalan **1 kali**. Saat `{{L.greetings.default}}` di-resolve menjadi text yang mengandung `{{A.website_name}}`, placeholder baru ini tidak diproses lagi.

Juga ada mismatch notasi: greeting template pakai `{{agent_name}}` (underscore) tapi config path yang valid adalah `agent.name` (dot).

## Fix

**File**: `src/lib/apbe-prompt-template.ts`

### 1. Tambah alias map untuk underscore notation

Sebelum regex replace, buat map alias:
```typescript
const ALIAS_MAP: Record<string, string> = {
  'agent_name': 'agent.name',
  'website_name': 'A.website_name',
  'group_name': 'A.group_name',
  'call_to_player': 'A.call_to_player',
  'slogan': 'A.slogan',
};
```

### 2. Tambah second pass di compileRuntimePrompt()

Setelah Step 4 (line 424-427), tambah **Step 5: Resolve nested placeholders**:

```typescript
// Step 5: Second pass - resolve nested placeholders
// (from greeting/closing templates that contain {{A.website_name}} etc)
prompt = prompt.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
  const trimmed = path.trim();
  // Check alias first (underscore notation)
  const resolvedPath = ALIAS_MAP[trimmed] || trimmed;
  return getConfigValue(workingConfig, resolvedPath);
});
```

Ini akan menangkap semua placeholder yang muncul dari hasil replace pertama, termasuk `{{agent_name}}` yang akan di-resolve via alias ke `agent.name`.

## Expected Result

| Sebelum | Sesudah |
|---------|---------|
| `{{A.website_name}}` | Spontan77 |
| `{{agent_name}}` | Maya |
| `{{agent.name}}` | Maya |

## Impact

| Item | Detail |
|------|--------|
| File | `apbe-prompt-template.ts` |
| Lines | ~15 lines ditambah |
| Breaking change | Zero -- hanya menambah second pass |
| Performance | Negligible -- 1 extra regex pass pada string |

