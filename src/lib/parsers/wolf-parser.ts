/**
 * Wolfclaw Parser V0.9 — Engine
 *
 * Mode 1 (RAW TEXT): runWolfParser(rawText, preparser?, images?) → ParserOutput
 * Mode 2 (LENGKAPI DATA): applyOperatorAnswers(prev, answers, rawText, images?) → ParserOutput
 *
 * Both modes use Sonnet 4.5 @ temperature 0.2, max_tokens enforced server-side
 * by ai-proxy MODEL_CONFIG.extract.
 *
 * V0.9 + PreParser scaffolding (additive, schema_version stays "0.9"):
 * - runWolfParser accepts optional PreParserOutput; when provided and
 *   routing_hints.capture_lines = true, the parser is instructed to emit
 *   captured_lines[] (the actual extraction is delegated to the LLM via
 *   prompt context — engine here only plumbs metadata in/out).
 * - When preparser is null, parser falls back to V0.9 flat behavior:
 *   captured_lines stays [] and a warning is logged.
 *
 * V0.9 + Multimodal evidence (additive):
 * - Both modes accept optional `images: AIContentBlock[]` (image/base64).
 *   When provided, images are attached to the user message AFTER the text
 *   block. The LLM is instructed to treat image table structure as visual
 *   authority that can outrank flattened text. Images are ephemeral (not
 *   persisted) and forwarded as-is to the Anthropic Messages API.
 */

import { callAI, extractJSON, type AIContentBlock } from "@/lib/ai-client";
import {
  WOLF_PARSER_PROMPT_MODE_1,
  WOLF_PARSER_PROMPT_MODE_2,
} from "./wolf-parser-prompt";
import { validateAndNormalize } from "./wolf-parser-validator";
import type { ParserOutput, OperatorAnswer } from "./wolf-parser-types";
import type { PreParserOutput } from "./wolf-preparser-types";

// Convenience re-exports for downstream consumers.
export type { ParserOutput, OperatorAnswer, PreParserOutput };

// ---------------------------------------------------------------------------
// Helper — build multimodal user content (text + optional images)
// ---------------------------------------------------------------------------
function buildUserContent(
  text: string,
  images: AIContentBlock[] | undefined,
): string | AIContentBlock[] {
  if (!images || images.length === 0) return text;
  // Anthropic convention: text block first, then images.
  return [{ type: "text", text }, ...images];
}

// ---------------------------------------------------------------------------
// MODE 1 — Raw text → partial ParserOutput
// ---------------------------------------------------------------------------

/**
 * Build the user message for Mode 1.
 *
 * If a PreParser output is provided, its metadata is appended as context
 * so the LLM can honor routing hints (parse_parent / capture_lines) and
 * surface structural conflicts already detected upstream.
 */
function buildMode1Message(
  rawText: string,
  preparser: PreParserOutput | null,
  hasImages: boolean,
): string {
  const trimmed = rawText.trim();

  const imageNote = hasImages
    ? `\n\n==================================================\nSUMBER VISUAL — IMAGE EVIDENCE TER-LAMPIR:\n==================================================\nAda 1+ gambar promo (screenshot) ter-attach setelah text ini.\nGambar adalah VISUAL AUTHORITY: tabel di gambar (kolom + baris)\nKALAHKAN flatten raw text karena struktur kolom preserved di visual.\nCross-reference gambar + text. Kalau visual kontradiksi text, prioritaskan\nvisual + log alasan di reasoning (evidence prefix \`derived from: visual ...\`).\n`
    : "";

  if (!preparser) {
    return trimmed + imageNote;
  }
  return `==================================================
SUMBER 1 — RAW PROMO TEXT:
==================================================
${trimmed}

==================================================
SUMBER 2 — PREPARSER METADATA (structural reasoning):
==================================================
${JSON.stringify(preparser, null, 2)}
${imageNote}
==================================================
INSTRUCTION:
==================================================
- Parse parsed_promo (28 fields) parent-level seperti biasa.
- Hormati _preparser.routing_hints:
  - parse_parent=true → extract parent fields normal.
  - capture_lines=true → emit captured_lines[] dengan row mentah.
  - capture_lines=false → captured_lines: [].
- Sertakan _preparser apa adanya di output (sibling top-level).
- JANGAN tambah variant/tier ke parsed_promo.

==================================================
CAPTURED_LINES SCHEMA (kalau capture_lines=true):
==================================================

Tiap item di captured_lines[] WAJIB punya struktur PERSIS ini:

\`\`\`json
{
  "line_id": "line_1",
  "line_type": "table_row",
  "label": "Welcome 50% Casino",
  "raw_fragment": "Welcome 50% Casino | Min Deposit Rp 50.000 | Max Bonus Rp 5.000.000 | TO 10x",
  "fields": {
    "category": "casino",
    "product_scope": "casino",
    "min_deposit": 50000,
    "max_bonus": 5000000,
    "turnover_requirement": 10,
    "calculation_value": 50,
    "reward_type_hint": "percentage"
  },
  "source_evidence_map": {
    "min_deposit": "Min Deposit Rp 50.000",
    "max_bonus": "Max Bonus Rp 5.000.000",
    "turnover_requirement": "TO 10x",
    "calculation_value": "Welcome 50% Casino"
  },
  "ambiguity_flags": []
}
\`\`\`

### Field rules — PATUHI KETAT:

1. \`line_id\`: string format \`"line_1"\`, \`"line_2"\`, dst (sequential).

2. \`line_type\`: WAJIB salah satu dari 4 enum berikut (TIDAK boleh value lain):
   - \`"table_row"\` — row dari tabel (Welcome bonus varian, dll)
   - \`"list_item"\` — item dari bullet list yang punya parameter
   - \`"threshold"\` — threshold tier (referral 5%/10%/15%, dll)
   - \`"redeem_option"\` — opsi redeem (loyalty point ladder, dll)

3. \`label\`: string nama/kode row (boleh empty string \`""\` kalau tidak ada
   label eksplisit, TAPI key wajib ada).

4. \`raw_fragment\`: string potongan raw text asli dari baris ini (verbatim).

5. \`fields\`: object dengan TEPAT 7 keys berikut, TIDAK BOLEH tambah/ubah:
   - \`category\` (string | null)
   - \`product_scope\` (string | null)
   - \`min_deposit\` (number | null)
   - \`max_bonus\` (number | null)
   - \`turnover_requirement\` (number | null)
   - \`calculation_value\` (number | null)
   - \`reward_type_hint\` (string | null)

   Kalau value tidak diketahui → \`null\` (BUKAN omit, BUKAN string kosong).
   JANGAN bikin key baru di luar 7 keys di atas.
   JANGAN improvise struktur \`fields\` atau tambah field extension.

6. \`source_evidence_map\`: \`Record<string, string>\` —
   - key = nama field (dari 7 keys \`fields\` di atas)
   - value = evidence location string (POTONGAN raw text, BUKAN array)
   - Hanya isi key untuk field yang punya evidence; field null skip saja.

7. \`ambiguity_flags\`: \`string[]\` — list ambiguity yang lo deteksi di row
   ini (boleh \`[]\` kalau clean).

### DROP AMBIGUITY:
- Kalau lo tidak yakin sama value field, isi \`null\`.
- JANGAN tebak.
- JANGAN merge 2 row jadi 1.
- JANGAN split 1 row jadi 2.
- Jumlah captured_lines HARUS sama dengan jumlah row aktual di raw text
  (sesuai \`_preparser.structure.line_count\`).`;
}

/**
 * Parse raw promo text into a partial ParserOutput V0.9.
 *
 * @param rawText - raw promo text (must be non-empty / non-whitespace).
 * @param preparser - optional PreParser output to inform parsing strategy.
 *   When null, parser falls back to flat V0.9 behavior.
 * @param images - optional array of AIContentBlock (image base64) — visual
 *   evidence ephemerally attached to the LLM call. Treated as visual
 *   authority that outranks flattened text on table structure conflicts.
 *
 * @throws Error if rawText is empty / whitespace-only.
 * @throws Error if the LLM response is not valid JSON.
 * @throws Error if the validator (mode=initial) rejects the output.
 */
export async function runWolfParser(
  rawText: string,
  preparser: PreParserOutput | null = null,
  images: AIContentBlock[] = [],
): Promise<ParserOutput> {
  if (typeof rawText !== "string" || rawText.trim().length === 0) {
    throw new Error(
      "[wolf-parser] rawText is empty — Mode 1 requires non-empty promo text.",
    );
  }

  if (preparser === null) {
    console.warn(
      "[wolf-parser] PreParser metadata missing — fallback to flat parse mode (captured_lines will be []).",
    );
  }

  const hasImages = Array.isArray(images) && images.length > 0;
  const userText = buildMode1Message(rawText, preparser, hasImages);
  const userContent = buildUserContent(userText, hasImages ? images : undefined);

  const response = await callAI({
    type: "extract",
    system: WOLF_PARSER_PROMPT_MODE_1,
    temperature: 0.2,
    messages: [
      {
        role: "user",
        content: userContent,
      },
    ],
  });

  let raw: unknown;
  try {
    raw = extractJSON(response);
  } catch (err) {
    throw new Error(
      `[wolf-parser] Failed to parse LLM JSON output: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  const validated = validateAndNormalize(raw, "initial");

  // Plumb preparser metadata through: if caller supplied one but the LLM
  // didn't echo it (or echoed a malformed version that got coerced to null),
  // fall back to the caller's authoritative copy.
  if (preparser && validated._preparser === null) {
    validated._preparser = preparser;
  }

  return validated;
}

// ---------------------------------------------------------------------------
// MODE 2 — Lengkapi data & analisa gabungan
// ---------------------------------------------------------------------------

/**
 * Build the user message for Mode 2 reasoning.
 *
 * Injects today's date in GMT+7 (Asia/Jakarta) so the model can compute
 * relative dates ("besok", "kemarin", "lusa") deterministically.
 *
 * Date format: YYYY-MM-DD via toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }).
 */
function buildRefineMessage(
  prev: ParserOutput,
  answers: OperatorAnswer[],
  rawText: string,
  hasImages: boolean,
): string {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta",
  });

  const imageNote = hasImages
    ? `\n==================================================
SUMBER 4 — IMAGE EVIDENCE TER-LAMPIR:
==================================================
Ada 1+ gambar promo (screenshot) ter-attach setelah text ini.
Gambar adalah VISUAL AUTHORITY: tabel di gambar (kolom + baris)
KALAHKAN flatten raw text karena struktur kolom preserved di visual.
Cross-reference gambar + text + operator answers. Kalau visual kontradiksi
text/answer, prioritaskan visual + log alasan di reasoning (evidence prefix
\`derived from: visual ...\`).
`
    : "";

  return `TANGGAL HARI INI: ${today}
TIMEZONE: GMT+7 (Asia/Jakarta — Jakarta/Bangkok/Hanoi)

==================================================
SUMBER 1 — RAW PROMO TEXT:
==================================================
${rawText.trim()}

==================================================
SUMBER 2 — PARSER_JSON MODE 1:
==================================================
${JSON.stringify(prev, null, 2)}

==================================================
SUMBER 3 — OPERATOR ANSWERS:
==================================================
${JSON.stringify(answers, null, 2)}
${imageNote}
==================================================
TUGAS:
==================================================
Reasoning gabungan ${hasImages ? "4" : "3"} sumber. Update JSON. Regenerate clean_text.
Tanggal relative WAJIB berbasis TANGGAL HARI INI di GMT+7.
Target gaps[] kosong, tapi honest residual ambiguity boleh tetap ada.
PRESERVE _preparser dan captured_lines apa adanya kalau tidak ada
informasi baru yang mengubahnya.`;
}

/**
 * Combine Mode 1 output + raw text + operator answers into a refined
 * ParserOutput V0.9.
 *
 * @param prev - previous Mode 1 ParserOutput.
 * @param answers - operator answers per gap.
 * @param rawText - original raw promo text.
 * @param images - optional array of AIContentBlock (image base64) — visual
 *   evidence ephemerally attached to the LLM call. Includes original Mode 1
 *   images (auto-carry) plus any new images uploaded at gap-answering time.
 *
 * @throws Error if prev is invalid (missing/wrong schema_version).
 * @throws Error if answers is not an array.
 * @throws Error if rawText is empty.
 * @throws Error if the LLM response is not valid JSON.
 * @throws Error if the validator (mode=refine) rejects the output.
 */
export async function applyOperatorAnswers(
  prev: ParserOutput,
  answers: OperatorAnswer[],
  rawText: string,
  images: AIContentBlock[] = [],
): Promise<ParserOutput> {
  if (!prev || prev.schema_version !== "0.9") {
    throw new Error(
      "[wolf-parser] applyOperatorAnswers: prev invalid (missing schema_version 0.9)",
    );
  }
  if (!Array.isArray(answers)) {
    throw new Error(
      "[wolf-parser] applyOperatorAnswers: answers must be an array",
    );
  }
  if (typeof rawText !== "string" || rawText.trim().length === 0) {
    throw new Error(
      "[wolf-parser] applyOperatorAnswers: rawText is empty",
    );
  }

  const hasImages = Array.isArray(images) && images.length > 0;
  const userText = buildRefineMessage(prev, answers, rawText, hasImages);
  const userContent = buildUserContent(userText, hasImages ? images : undefined);

  const response = await callAI({
    type: "extract",
    system: WOLF_PARSER_PROMPT_MODE_2,
    temperature: 0.2,
    messages: [{ role: "user", content: userContent }],
  });

  let raw: unknown;
  try {
    raw = extractJSON(response);
  } catch (err) {
    throw new Error(
      `[wolf-parser] Mode 2 JSON parse fail: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  const validated = validateAndNormalize(raw, "refine");

  // Preserve PreParser metadata across Mode 2 if LLM dropped it.
  if (prev._preparser && validated._preparser === null) {
    validated._preparser = prev._preparser;
  }
  // Preserve captured_lines if LLM dropped them and we had some.
  if (
    Array.isArray(prev.captured_lines) &&
    prev.captured_lines.length > 0 &&
    validated.captured_lines.length === 0
  ) {
    validated.captured_lines = prev.captured_lines;
  }

  return validated;
}
