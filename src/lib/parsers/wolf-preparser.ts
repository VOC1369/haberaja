/**
 * Wolfclaw PreParser V1.0 — Engine
 *
 * Single mode: runWolfPreParser(rawText) → PreParserOutput
 *
 * Uses Sonnet 4.5 @ temperature 0.2 via existing ai-proxy "extract" route
 * (per Q2 decision A — no new AIProxyType added in this scaffolding step).
 */

import { callAI, extractJSON } from "@/lib/ai-client";
import { WOLF_PREPARSER_PROMPT } from "./wolf-preparser-prompt";
import { validatePreParserOutput } from "./wolf-parser-validator";
import type { PreParserOutput } from "./wolf-preparser-types";

// Convenience re-export for downstream consumers.
export type { PreParserOutput };

/**
 * Run the PreParser on raw promo text.
 *
 * @throws Error if rawText is empty / whitespace-only.
 * @throws Error if the LLM response is not valid JSON.
 *
 * Validation note: the validator coerces invalid shapes to null + warns;
 * it does NOT throw. If the LLM returns garbage, this function will throw
 * during JSON parse (above), but never on shape validation.
 */
export async function runWolfPreParser(
  rawText: string,
): Promise<PreParserOutput> {
  if (typeof rawText !== "string" || rawText.trim().length === 0) {
    throw new Error(
      "[wolf-preparser] rawText is empty — PreParser requires non-empty promo text.",
    );
  }

  const response = await callAI({
    type: "extract",
    system: WOLF_PREPARSER_PROMPT,
    temperature: 0.2,
    messages: [{ role: "user", content: rawText }],
  });

  let raw: unknown;
  try {
    raw = extractJSON(response);
  } catch (err) {
    throw new Error(
      `[wolf-preparser] Failed to parse LLM JSON output: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  // validatePreParserOutput returns a fully-shaped PreParserOutput; if the
  // LLM emitted something unrecognisable, the validator will substitute a
  // safe fallback ({shape: "invalid", parseability: "reject", ...}) and warn.
  const validated = validatePreParserOutput(raw);
  if (validated === null) {
    // Should never happen — validator returns null only when used as the
    // top-level coercion helper inside ParserOutput. Defensive guard.
    throw new Error(
      "[wolf-preparser] Validator returned null — unexpected state.",
    );
  }
  return validated;
}
