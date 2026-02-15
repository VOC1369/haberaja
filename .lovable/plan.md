

# Implementasi Archetype Payload Layer v1.0 (FINAL + 6 Koreksi)

Zero breaking change. Zero UI wizard change. Schema tetap v2.1.

## 3 Field Universal (Root-Level Only)

```text
turnover_basis       : 'bonus_only' | 'deposit_plus_bonus' | 'deposit_only' | null   (default: null)
archetype_payload    : Record<string, unknown>                                         (default: {})
archetype_invariants : Record<string, unknown>                                         (default: {})
```

SSoT Rule: `turnover_basis` HANYA di root. Dilarang di `archetype_payload` dalam bentuk apapun.

## 6 Koreksi yang Diterapkan

1. **Archetype resolve order** (bukan hardcode 1 path): `extra_config._taxonomy_decision?.archetype` -> fallback `extra_config._taxonomy?.archetype` -> else `null` (status UNKNOWN)
2. **SSoT enforcement cek 4 pola**: `archetype_payload.turnover_basis`, `.withdraw_rule.turnover_basis`, `.turnover.basis`, `.post_reward_rules.turnover_basis`
3. **WARNING "turnover ambiguous"** tetap warning, tidak escalate di runtime -- hanya label "Ambiguous TO basis" di debug
4. **Stable lookup map**: export `getPayloadContract(archetype)` helper dari `promo-taxonomy.ts` (bukan scan array tiap message)
5. **KB_HEALTH format rigid** (bukan free-text append):
```text
# KB_HEALTH
status: READY|NOT_READY|UNKNOWN
missing_required_payload_keys: [...]
priority_rule: archetype_payload > custom_terms for lifecycle logic
```
6. **DebugPanel hanya render** data dari engine (`kbHealth` di DebugBreakdown), tidak hitung ulang

## KB_HEALTH Visibility Decision

- **Selalu dihitung** di `buildKBContext()` (AI selalu tahu ada gap, even tanpa debug mode)
- **Hanya ditampilkan di UI** saat Debug ON (via DebugPanel)
- Alasan: AI perlu awareness untuk jawab akurat; user tidak perlu noise di non-debug

## File Changes (5 file)

### 1. `src/components/VOCDashboard/PromoFormWizard/types.ts`

**PKB_FIELD_WHITELIST** (line 185-188, setelah `extra_config`):
- Tambah 3 entry: `'turnover_basis'`, `'archetype_payload'`, `'archetype_invariants'`

**PromoFormData interface** (sekitar line 530, setelah escape hatch fields):
- Tambah 3 optional field:
  - `turnover_basis?: 'bonus_only' | 'deposit_plus_bonus' | 'deposit_only' | null`
  - `archetype_payload?: Record<string, unknown>`
  - `archetype_invariants?: Record<string, unknown>`

### 2. `src/lib/canonical-promo-schema.ts`

**CanonicalPromoKB interface** (line 172-175, sebelum `extra_config`):
- Tambah 3 field:
  - `turnover_basis: string | null`
  - `archetype_payload: Record<string, unknown>`
  - `archetype_invariants: Record<string, unknown>`

**CANONICAL_INERT** (line 347-350, sebelum `extra_config: {}`):
- Tambah defaults:
  - `turnover_basis: null`
  - `archetype_payload: {}`
  - `archetype_invariants: {}`

**validateCanonicalPromo()** (line 377-429) -- tambah 3 rule baru:

Rule 1 -- ERROR (SSoT violation): Deep-check `archetype_payload` untuk 4 pola:
- `archetype_payload.turnover_basis`
- `archetype_payload.withdraw_rule?.turnover_basis`
- `archetype_payload.turnover?.basis`
- `archetype_payload.post_reward_rules?.turnover_basis`

Rule 2 -- WARNING: `turnover_enabled === true` dan `turnover_basis === null` -> "Ambiguous TO basis"

Rule 3 -- WARNING: Archetype lifecycle-heavy dan `archetype_payload` kosong `{}`. Resolve archetype via:
- `extra_config._taxonomy_decision?.archetype` (primary)
- `extra_config._taxonomy?.archetype` (fallback legacy)
- Lifecycle-heavy archetypes: `LUCKY_DRAW`, `COMPETITION`

### 3. `src/lib/extractors/promo-taxonomy.ts`

**ArchetypeSemanticRule interface** (line 89-139) -- tambah optional field:
```
payload_contract?: {
  required_keys: string[];
  optional_keys: string[];
}
```

**Export helper function** (baru, setelah ARCHETYPE_RULES):
```
export function getPayloadContract(archetype: string): { required_keys: string[]; optional_keys: string[] } | null
```
Lookup dari `ARCHETYPE_RULES[archetype]?.payload_contract` -- stable, O(1), tidak scan array.

**COMPETITION rule** (line 696, applicable_fields line 763-766):
- Tambah ke `applicable_fields`: `'archetype_payload'`, `'archetype_invariants'`, `'turnover_basis'`
- Tambah `payload_contract`:
  - `required_keys`: `['event_period', 'prize_structure']`
  - `optional_keys`: `['leaderboard_rules', 'reset_rules', 'claim_channels', 'notes']`

**LUCKY_DRAW rule** (line 776, applicable_fields line 838-841):
- Tambah ke `applicable_fields`: `'archetype_payload'`, `'archetype_invariants'`, `'turnover_basis'`
- Tambah `payload_contract`:
  - `required_keys`: `['daily_reset_time', 'claim_window', 'deposit_requirement', 'spin_limit', 'collection_mechanic']`
  - `optional_keys`: `['claim_channels', 'notes']`

### 4. `src/lib/livechat-engine.ts`

**DebugBreakdown interface** (line 26-36) -- tambah optional field:
```
kbHealth?: {
  status: 'READY' | 'NOT_READY' | 'UNKNOWN';
  missingKeys: string[];
}
```

**KB_FIELDS array** (line 42-50):
- Tambah: `'turnover_basis'`, `'archetype_payload'`, `'archetype_invariants'`

**buildKBContext()** (line 52-67) -- setelah JSON block, tambah:
1. Resolve archetype: `extra_config._taxonomy_decision?.archetype` -> fallback `extra_config._taxonomy?.archetype` -> else `null`
2. Import dan call `getPayloadContract(archetype)` dari taxonomy
3. Compute missing required keys
4. Append rigid meta block:
```text
# KB_HEALTH
status: READY|NOT_READY|UNKNOWN
missing_required_payload_keys: [key1, key2]
priority_rule: archetype_payload > custom_terms for lifecycle logic
```
5. Return `kbHealth` object bersama context string (untuk DebugPanel)

**buildSystemPrompt()** (line 114-135):
- Tambah comment/instruction ke system prompt: "PRIORITAS: Jika data tersedia di archetype_payload, gunakan archetype_payload. custom_terms hanya untuk narasi S&K yang tidak terstruktur."
- KB_HEALTH selalu di-inject ke context (bukan hanya saat debug ON) -- supaya AI selalu aware

**parseDebugSection()** (line 141-158):
- Pass through `kbHealth` data yang sudah dihitung di `buildKBContext()`

### 5. `src/components/VOCDashboard/DebugPanel.tsx`

**Props update**: `DebugBreakdown` sudah include `kbHealth` dari perubahan di livechat-engine

**Render KB Health** (bagian atas debug panel, sebelum User Intent):
- Jika `debug.kbHealth` tersedia:
  - `READY`: badge hijau "KB Status: READY"
  - `NOT_READY`: badge amber "KB Status: NOT_READY" + list missing keys
  - `UNKNOWN`: badge abu "KB Status: UNKNOWN (archetype tidak terdeteksi)"
- Panel ini hanya muncul di Debug ON (karena DebugPanel sendiri hanya render saat debugMode)

## Yang TIDAK Diubah (Konfirmasi Eksplisit)

- Primitive Gate (`promo-primitive-gate.ts`) -- TIDAK DISENTUH
- `sanitizeByMode` (`sanitize-by-mode.ts`) -- TIDAK DISENTUH
- Taxonomy Pipeline detection flow -- TIDAK DISENTUH
- UI Wizard Steps (Step1-Step4) -- TIDAK DISENTUH
- `promoKB.add()` / `promoKB.update()` -- TIDAK DISENTUH
- 88 canonical fields existing -- TIDAK DIMODIFIKASI
- `schema_version` tetap `'2.1'`
- `PromoKnowledgeSection.tsx` handleJsonImport -- tidak perlu ubah (sudah pass-through semua fields)

## Urutan Implementasi

1. Types: `PromoFormData` + `PKB_FIELD_WHITELIST` (types.ts)
2. Schema: `CanonicalPromoKB` + `CANONICAL_INERT` + validation rules (canonical-promo-schema.ts)
3. Taxonomy: interface + payload_contract + `getPayloadContract()` helper (promo-taxonomy.ts)
4. Livechat: `KB_FIELDS` + `DebugBreakdown.kbHealth` + `buildKBContext()` health check + system prompt priority rule (livechat-engine.ts)
5. Debug UI: KB health status badge display (DebugPanel.tsx)

