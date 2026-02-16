

# Quick Fix — Explicit Rule Selection Instructions for B-KB

## Problem
LLM menerima 5 behavioral rules sekaligus tapi instruksi saat ini terlalu longgar:
- Tidak ada perintah "pilih SATU rule"
- Tidak ada enforcement untuk pakai `response_template`
- Tidak ada severity-based tiebreaker
- LLM blend atau fallback ke generic response

## Solution
Update `buildBehavioralKBContext()` di `src/lib/livechat-engine.ts` (lines 182-197) dengan instruksi yang jauh lebih explicit.

## File: `src/lib/livechat-engine.ts`

**Replace** the return string in `buildBehavioralKBContext()` (lines 182-197) with:

```text
# BEHAVIORAL RULES (Reaction Engine)
Berikut {N} behavioral rules aktif.

```json
[...aiPayloads...]
```

# BEHAVIORAL RULE SELECTION — WAJIB DIPATUHI

STEP 1: Analisis pesan player terhadap SETIAP rule's applicability_criteria.
STEP 2: Pilih SATU rule yang paling match. Jika ada tie, pilih yang severity_level tertinggi.
STEP 3: Sebutkan secara internal rule mana yang kamu pilih (rule_name).
STEP 4: Gunakan response_template dari rule yang dipilih sebagai BASIS jawaban kamu. JANGAN generate dari nol.
STEP 5: Terapkan reasoning_guideline untuk tone dan pendekatan.
STEP 6: Escalation ikuti handoff_protocol dari rule tersebut.

LARANGAN:
- JANGAN blend multiple rules dalam satu jawaban.
- JANGAN gunakan respons generik jika ada rule yang match.
- JANGAN abaikan response_template — itu WAJIB dipakai sebagai dasar.
- JANGAN gunakan kalimat "Komunikasi yang sopan diperlukan" kecuali itu ada di template.

JIKA TIDAK ADA rule yang match:
- Gunakan Persona default behavior seperti biasa.
- Crisis tone dan escalation dari Persona tetap berlaku penuh.
```

## What Changes
- Added explicit 6-step selection process
- Added "LARANGAN" block to prevent blending and generic fallback
- Added severity-based tiebreaker instruction
- Added explicit ban on the repetitive phrase "Komunikasi yang sopan diperlukan"
- Template enforcement: LLM WAJIB pakai `response_template` sebagai basis

## What Does NOT Change
- No schema changes
- No new files
- No dependency changes
- Only 1 function body updated (~15 lines replaced)

## Expected Impact
- LLM akan pilih satu rule, bukan blend
- "nipu" -> Emotional Distress rule (payment context) -> template spesifik
- "taiklah" -> Aggressive Player rule (severity 4) -> template escalation
- Response berbeda karena template berbeda

