/**
 * Wolfclaw Parser V0.9 — Engine
 *
 * Mode 1 (RAW TEXT): runWolfParser(rawText, preparser?) → ParserOutput
 * Mode 2 (LENGKAPI DATA): applyOperatorAnswers(prev, answers, rawText) → ParserOutput
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
 */

import { callAI, extractJSON } from "@/lib/ai-client";
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
): string {
  const trimmed = rawText.trim();
  if (!preparser) {
    return trimmed;
  }
  return `==================================================
SUMBER 1 — RAW PROMO TEXT:
==================================================
${trimmed}

==================================================
SUMBER 2 — PREPARSER METADATA (structural reasoning):
==================================================
${JSON.stringify(preparser, null, 2)}

==================================================
INSTRUCTION:
==================================================
- Parse parsed_promo (28 fields) parent-level seperti biasa.
- Hormati _preparser.routing_hints:
  - parse_parent=true → extract parent fields normal.
  - capture_lines=true → emit captured_lines[] dengan row mentah
    (line_id, line_type, label, raw_fragment, fields, evidence).
  - capture_lines=false → captured_lines: [].
- Sertakan _preparser apa adanya di output (sibling top-level).
- JANGAN tambah variant/tier ke parsed_promo.`;
}

/**
 * Parse raw promo text into a partial ParserOutput V0.9.
 *
 * @param rawText - raw promo text (must be non-empty / non-whitespace).
 * @param preparser - optional PreParser output to inform parsing strategy.
 *   When null, parser falls back to flat V0.9 behavior.
 *
 * @throws Error if rawText is empty / whitespace-only.
 * @throws Error if the LLM response is not valid JSON.
 * @throws Error if the validator (mode=initial) rejects the output.
 */
export async function runWolfParser(
  rawText: string,
  preparser: PreParserOutput | null = null,
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

  const userMessage = buildMode1Message(rawText, preparser);

  const response = await callAI({
    type: "extract",
    system: WOLF_PARSER_PROMPT_MODE_1,
    temperature: 0.2,
    messages: [
      {
        role: "user",
        content: userMessage,
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
): string {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta",
  });

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

==================================================
TUGAS:
==================================================
Reasoning gabungan 3 sumber. Update JSON. Regenerate clean_text.
Tanggal relative WAJIB berbasis TANGGAL HARI INI di GMT+7.
Target gaps[] kosong, tapi honest residual ambiguity boleh tetap ada.
PRESERVE _preparser dan captured_lines apa adanya kalau tidak ada
informasi baru yang mengubahnya.`;
}

/**
 * Combine Mode 1 output + raw text + operator answers into a refined
 * ParserOutput V0.9.
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

  const userMessage = buildRefineMessage(prev, answers, rawText);

  const response = await callAI({
    type: "extract",
    system: WOLF_PARSER_PROMPT_MODE_2,
    temperature: 0.2,
    messages: [{ role: "user", content: userMessage }],
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
