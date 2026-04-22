/**
 * Wolfclaw Parser V0.9 — Engine (MODE 1: RAW TEXT)
 *
 * Reasoning-first LLM parser. Mode 1 only.
 * Operator-answer refinement (Mode 2) belongs to Step 5 — not implemented here.
 *
 * Pipeline:
 *   rawText → callAI(extract, sonnet-4.5, t=0.2) → extractJSON
 *           → validateAndNormalize(raw, "initial") → ParserOutput
 */

import { callAI, extractJSON } from "@/lib/ai-client";
import { WOLF_PARSER_PROMPT_MODE_1 } from "./wolf-parser-prompt";
import { validateAndNormalize } from "./wolf-parser-validator";
import type { ParserOutput, OperatorAnswer } from "./wolf-parser-types";

// Convenience re-exports for downstream consumers.
export type { ParserOutput, OperatorAnswer };

/**
 * Parse raw promo text into a partial ParserOutput V0.9.
 *
 * @throws Error if rawText is empty / whitespace-only.
 * @throws Error if the LLM response is not valid JSON.
 * @throws Error if the validator (mode=initial) rejects the output
 *               (e.g. critical fields unresolved but gaps[] empty).
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
    temperature: 0.2, // explicit per Step 2 lock
    messages: [
      {
        role: "user",
        content: rawText,
      },
    ],
    // NOTE: max_tokens (8000) is enforced server-side by ai-proxy MODEL_CONFIG.extract.
    // Step 2 verified the lock; ai-client does not currently accept a max_tokens override.
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
