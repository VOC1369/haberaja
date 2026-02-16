

# Phase 1: Behavioral KB Injection — 100% Additive, Toggle-Gated

## Prinsip

Tidak ada yang dihapus. Tidak ada yang diubah dari behavior existing. Hanya menambahkan 1 toggle baru dan 1 blok injection baru. Default OFF sehingga runtime lama 100% tidak terpengaruh.

---

## Perubahan

### 1. `src/lib/livechat-engine.ts` — Tambah B-KB injection

**Tambah ke `BuildSystemPromptOptions`:**
- `behavioralKBEnabled?: boolean`

**Tambah fungsi baru `buildBehavioralKBContext()`:**
- Load rules via `getBehavioralRules()` dari `src/components/VOCDashboard/BehavioralWizard/types.ts` (versi V6 dengan auto-sanitization)
- Filter hanya `status === "active"`
- Extract AI-layer fields saja via `extractAIPayload()` (rule_name, behavior_category, severity_level, mode_respons, response_template, reasoning_guideline, handoff_protocol, pattern_trigger, intent_perilaku)
- Return formatted string block

**Di `buildSystemPrompt()`, setelah Promo KB dan sebelum Debug instruction:**
- Jika `behavioralKBEnabled === true`, inject blok B-KB context
- Inject **Precedence Contract** hanya ketika B-KB ON:

```
# BEHAVIORAL RULES (Reaction Engine)
[...active rules as JSON...]

# BEHAVIORAL PRECEDENCE RULE
Jika ada rule Behavioral yang match dengan pesan player:
- Gunakan response_template dari rule tersebut sebagai dasar jawaban
- Tone dan gaya bahasa TETAP mengikuti Persona identity di atas
- Escalation mengikuti handoff_protocol dari rule
Jika TIDAK ada rule yang match:
- Gunakan Persona default behavior seperti biasa
- Crisis tone dan escalation dari Persona tetap berlaku penuh
```

**Injection order (final):**
1. Persona identity (existing, tidak berubah)
2. Language firewall (existing, tidak berubah)
3. General KB (existing, toggle-gated)
4. Promo KB (existing, toggle-gated)
5. **Behavioral KB + Precedence Contract (NEW, toggle-gated, default OFF)**
6. Debug instructions (existing, toggle-gated)

### 2. `src/components/VOCDashboard/LivechatTestConsole.tsx` — Tambah toggle B-KB

**State baru:**
- `behavioralKBEnabled` (boolean, default `false`)

**UI di header (setelah General KB toggle, sebelum Debug toggle):**
- Icon: `Shield` dari lucide-react
- Label: "B-KB"
- Switch component (sama style dengan General KB dan Debug)

**Di `executeSend`:**
- Pass `behavioralKBEnabled` ke `buildSystemPrompt` options

---

## Yang TIDAK Diubah

| Item | Status |
|------|--------|
| APBE schema (`apbe-config.ts`) | Tidak disentuh |
| APBE prompt template (`apbe-prompt-template.ts`) | Tidak disentuh |
| APBE forms (SafetyCrisis, Operational) | Tidak disentuh |
| APBE storage | Tidak disentuh |
| Behavioral KB schema/wizard | Tidak disentuh |
| Promo KB | Tidak disentuh |
| General KB | Tidak disentuh |

## Keamanan

- **Toggle OFF = 100% behavior lama.** Tidak ada perubahan runtime sama sekali.
- **Toggle ON = additive context.** APBE crisis templates, anti_hunter, yellow dictionary tetap ter-inject seperti biasa. B-KB ditambahkan sebagai layer tambahan dengan precedence hint.
- **Fallback guard built-in:** Precedence contract secara eksplisit bilang "jika tidak ada rule match, gunakan Persona default behavior."
- **Tidak ada authority vacuum:** Karena tidak ada yang dihapus, safety net APBE tetap utuh.

