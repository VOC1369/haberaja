

# Phase 2: Single Door Behavioral — Implementation Plan

## Ringkasan

Sentralisasi semua reaction logic ke B-KB. Hapus dari APBE prompt dan UI. Tambah `applicability_criteria` sebagai rule selection contract untuk LLM. Seed 5 default rules. Default B-KB ON.

**8 file diubah, 0 file baru, 0 perubahan schema TypeScript APBE.**

---

## CRITICAL: Enum Reconciliation

Context document menggunakan enum yang **TIDAK ADA** di codebase. Seed data HARUS pakai V6 snake_case enum yang sudah locked, atau akan ter-BLOCK oleh validator.

| Context Document | Codebase V6 (LOCKED) |
|---|---|
| "Aggressive" | `toxic_heavy` |
| "Technical Frustration" | `confusion` |
| "Emotional Distress" | `urgency` / `fear` |
| "Fraudulent" | `toxic_heavy` (closest) |
| "Intimidasi" | `testing_limits` |
| "Frustrasi Teknis" | `clarity_need` |
| "Curhat Emosional" | `emotional_validation` / `urgent_solution` |
| "Penipuan" | `testing_limits` (closest) |
| "Empathetic De-escalation" | `high_empathy` |
| "Firm Boundary Setting" | `boundary` |
| "Verification Request" | **TIDAK ADA** -- pakai `assurance` |
| "Educational Response" | **TIDAK ADA** -- pakai `short` |

Context document juga menyebut `allowed_actions` dan `mode_respons_ai` -- field ini **TIDAK ADA** di codebase. Field yang ada: `mode_respons`. `allowed_actions` TIDAK ditambahkan di phase ini.

---

## Perubahan per File

### 1. `src/components/VOCDashboard/BehavioralWizard/types.ts`

**Schema extension:**
- Tambah `applicability_criteria: string` ke `AILayerFields` (baris 71-85)
- Tambah `applicability_criteria: string` ke `WizardFormData` (baris 107-130)
- Tambah `applicability_criteria: ""` ke `initialWizardData` (baris 1121-1138)

**Update `extractAIPayload()` (baris 327-339):**
- TAMBAH `applicability_criteria` ke return
- EXCLUDE `pattern_trigger` dan `rule_name` (admin tools, bukan untuk LLM)
- Return type berubah -- buat inline type atau new type `AIPromptPayload`

```
Sebelum: return AILayerFields (9 fields termasuk pattern_trigger, rule_name)
Sesudah: return { behavior_category, intent_perilaku, applicability_criteria, severity_level, mode_respons, response_template, reasoning_guideline, handoff_protocol }
```

**Update `addBehavioralRule()` (baris 1015-1074):**
- Pass `applicability_criteria` dari WizardFormData ke BehavioralRuleItem

**Tambah `seedDefaultBehavioralRules()` function:**
- 5 rules langsung ke `saveBehavioralRules()` (bypass wizard pipeline karena seed tidak punya `scenario` yang match scenarioCards)
- Semua pakai V6 snake_case enum
- Guard: `getBehavioralRules().length === 0 && !localStorage.getItem('bkb_seeded_v1')`

Seed data yang V6-compliant:

| # | display_name | behavior_category | intent_perilaku | mode_respons | severity | handoff |
|---|---|---|---|---|---|---|
| 1 | Player Agresif / Marah Berat | `toxic_heavy` | `testing_limits` | `boundary` | 4 | monitoring, FIRM_RESPONSE |
| 2 | Gangguan Sistem / Error Teknis | `confusion` | `clarity_need` | `assurance` | 2 | monitoring |
| 3 | Masalah Pembayaran / Transaksi | `urgency` | `urgent_solution` | `high_empathy` | 3 | monitoring |
| 4 | Akun Terkunci / Masalah Akses | `fear` | `trust_issue` | `assurance` | 3 | monitoring |
| 5 | Deteksi Kecurangan / Manipulasi | `toxic_heavy` | `testing_limits` | `crisis` | 5 | required, active_handover, HIGH_PRIORITY |

Setiap rule mendapat `applicability_criteria`, `reasoning_guideline`, dan `response_template` sesuai context document (konten tetap sama, hanya enum yang di-map ke V6).

Rule name format: `SEED_ToxicHeavy_Firm_YYYYMMDD` (masih comply WIZ_ regex? Tidak -- SEED_ prefix. Solusi: seed langsung ke `saveBehavioralRules()` tanpa lewat `addBehavioralRule()` yang validate rule_name format).

### 2. `src/components/VOCDashboard/BehavioralKnowledgeSection.tsx`

- Import `seedDefaultBehavioralRules`
- Update useEffect mount: panggil seed sebelum loadItems

### 3. `src/components/VOCDashboard/BehavioralWizard/Step1Scenario.tsx`

- Import `Textarea` dari ui
- Tambah textarea untuk `applicability_criteria` setelah Auto-Mapping card
- Label: "Kriteria Penerapan"
- Placeholder: "Jelaskan dalam 1-3 kalimat kondisi apa yang membuat rule ini berlaku..."
- Hanya tampil jika `data.scenario` sudah dipilih
- Update `scenarioCards` mapping di types.ts: tambah default `applicability_criteria` per scenario

### 4. `src/components/VOCDashboard/BehavioralWizard/Step3Review.tsx`

- Tampilkan `applicability_criteria` di review card (setelah Detail Teknis, sebelum Response Template)

### 5. `src/lib/livechat-engine.ts`

- Update `buildBehavioralKBContext()` (baris 175-197):
  - `extractAIPayload()` sudah exclude pattern_trigger (dari perubahan #1)
  - Ubah prompt text: ganti "mendeteksi pola perilaku" menjadi "gunakan applicability_criteria untuk menentukan rule mana yang berlaku"
  - Tambah `applicability_criteria` dalam precedence instruction

### 6. `src/lib/apbe-prompt-template.ts`

Hapus dari `RUNTIME_PROMPT_TEMPLATE` (baris 281-307):
- Baris 285: `Threshold Triggers: {{O.escalation.threshold_triggers}}`
- Baris 292: `Yellow Dictionary (WARNING): {{O.crisis.dictionary_yellow}}`
- Baris 293: Ubah menjadi `Severity Weight Red: {{O.crisis.severity_weights.red}}`
- Baris 294-297: Hapus blok Toxicity Levels
- Baris 298-303: Hapus blok Crisis Templates
- Baris 305-307: Hapus blok ANTI-HUNTER RULES

Tetap: Crisis Tone, Red Dictionary, Red severity weight, Preventive Bonus, Escalation SOP fields.

### 7. `src/components/VOCDashboard/forms/apbe/SafetyCrisisForm.tsx`

Hapus:
- Yellow Dictionary UI section
- Section 3: Level Toksisitas (Level 1/2/3)
- Section 4: Anti-Hunter Rules
- Crisis Templates auto-generate logic
- Semua state, constants, functions terkait (responseStyleOptions, presetPatternTemplates, crisisTemplateMapping, newYellowWord, newLevel1/2/3Word, newRuleName, newPattern, autoToggles, semua add/remove functions)
- Unused imports (HunterResponseStyle, Tabs/*, Tooltip/*, AlertTriangle, Checkbox)

Sederhanakan:
- handleCleanDictionaries: hanya Red
- Section 2 Dictionary: full width Red
- Renumber: Section 1 (Dasar), Section 2 (Dictionary Red), Section 3 (Bonus Preventif)

### 8. `src/components/VOCDashboard/forms/apbe/OperationalSOPForm.tsx`

Hapus:
- Section "Trigger Eskalasi" (preset checkboxes + custom trigger input)
- Constants: escalationTriggerOptions
- State: newCustomTrigger, customTriggerError
- Watch/computed: escalationTriggers, presetTriggerIds, customTriggers
- Functions: addCustomTrigger, removeCustomTrigger, getCustomTriggerLabel
- Unused imports (Checkbox, Trash2 jika tidak dipakai lagi)

### 9. `src/components/VOCDashboard/LivechatTestConsole.tsx`

- Ubah default `behavioralKBEnabled` dari `false` ke `true`

---

## Urutan Eksekusi

1. Schema + seed function (types.ts)
2. Seed trigger (BehavioralKnowledgeSection.tsx)
3. Wizard UI update (Step1Scenario.tsx + Step3Review.tsx)
4. Engine update (livechat-engine.ts)
5. Prompt template cleanup (apbe-prompt-template.ts)
6. SafetyCrisisForm cleanup
7. OperationalSOPForm cleanup
8. LivechatTestConsole default ON

---

## Yang TIDAK Diubah

| File | Alasan |
|---|---|
| `src/types/apbe-config.ts` | Schema APBE tetap utuh |
| `src/lib/apbe-storage.ts` | Data localStorage tidak dihapus |
| V6 validator | Tidak diubah -- seed bypass validator |
| B-KB Wizard Step2 | Tidak terpengaruh |

---

## Keamanan

- Schema APBE tidak diubah -- backward compatible
- Data localStorage tidak dihapus -- rollback possible
- Seed data bypass validator tapi construct valid BehavioralRuleItem manually
- pattern_trigger tetap di schema, Wizard UI, dan validation -- hanya excluded dari LLM prompt
- Fallback: jika no B-KB match, Persona crisis.tone + default escalation berlaku

