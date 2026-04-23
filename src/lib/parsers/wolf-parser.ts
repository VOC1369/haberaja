/**
 * Wolfclaw Parser V0.9 — Engine
 *
 * Mode 1 (RAW TEXT): runWolfParser(rawText) → ParserOutput
 * Mode 2 (LENGKAPI DATA): applyOperatorAnswers(prev, answers, rawText) → ParserOutput
 *
 * Both modes use Sonnet 4.5 @ temperature 0.2, max_tokens enforced server-side
 * by ai-proxy MODEL_CONFIG.extract.
 */

import { callAI, extractJSON } from "@/lib/ai-client";
import {
  WOLF_PARSER_PROMPT_MODE_1,
  WOLF_PARSER_PROMPT_MODE_2,
} from "./wolf-parser-prompt";
import { validateAndNormalize } from "./wolf-parser-validator";
import type { ParserOutput, OperatorAnswer } from "./wolf-parser-types";

// Convenience re-exports for downstream consumers.
export type { ParserOutput, OperatorAnswer };

// ---------------------------------------------------------------------------
// MODE 1 — Raw text → partial ParserOutput
// ---------------------------------------------------------------------------

/**
 * Parse raw promo text into a partial ParserOutput V0.9.
 *
 * @throws Error if rawText is empty / whitespace-only.
 * @throws Error if the LLM response is not valid JSON.
 * @throws Error if the validator (mode=initial) rejects the output.
 */
export async function runWolfParser(rawText: string): Promise<ParserOutput> {
  if (typeof rawText !== "string" || rawText.trim().length === 0) {
    throw new Error(
      "[wolf-parser] rawText is empty — Mode 1 requires non-empty promo text.",
    );
  }

  const response = await callAI({
    type: "extract",
    system: WOLF_PARSER_PROMPT_MODE_1,
    temperature: 0.2,
    messages: [
      {
        role: "user",
        content: rawText,
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

  return validateAndNormalize(raw, "initial");
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
Target gaps[] kosong, tapi honest residual ambiguity boleh tetap ada.`;
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

  return validateAndNormalize(raw, "refine");
}
