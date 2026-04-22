/**
 * Wolf Parser V0.9 — Engine
 *
 * Public API:
 *   - runWolfParser(rawText): initial parse
 *   - applyOperatorAnswers(prev, answers, rawText): refine after operator answers gaps
 *
 * Output: strict ParserOutput per V0.9 contract.
 */
import { callAI, extractJSON } from "@/lib/ai-client";
import {
  WOLF_PARSER_PROMPT,
  WOLF_PARSER_REFINE_PROMPT,
} from "./wolf-parser-prompt";
import { validateAndNormalize } from "./wolf-parser-validator";
import type { ParserOutput, OperatorAnswer } from "./wolf-parser-types";

export async function runWolfParser(rawText: string): Promise<ParserOutput> {
  if (!rawText || !rawText.trim()) {
    throw new Error("Raw promo text kosong.");
  }

  const response = await callAI({
    type: "extract",
    system: WOLF_PARSER_PROMPT,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: `Parse promo berikut menjadi ParserOutput V0.9:\n\n${rawText.trim()}`,
      },
    ],
  });

  const raw = extractJSON<unknown>(response);
  return validateAndNormalize(raw);
}

export async function applyOperatorAnswers(
  prev: ParserOutput,
  answers: OperatorAnswer[],
  rawText: string,
): Promise<ParserOutput> {
  if (!answers.length) return prev;

  const answersBlock = answers
    .map((a) => `- ${a.field}: ${a.value}`)
    .join("\n");

  const userMessage = [
    "RAW PROMO TEXT:",
    rawText.trim(),
    "",
    "PARSER_JSON SEBELUMNYA:",
    JSON.stringify(prev, null, 2),
    "",
    "JAWABAN OPERATOR:",
    answersBlock,
    "",
    "Update parser_json mengikuti jawaban operator. Output JSON saja.",
  ].join("\n");

  const response = await callAI({
    type: "extract",
    system: WOLF_PARSER_REFINE_PROMPT,
    temperature: 0,
    messages: [{ role: "user", content: userMessage }],
  });

  const raw = extractJSON<unknown>(response);
  return validateAndNormalize(raw);
}

export type { ParserOutput, OperatorAnswer } from "./wolf-parser-types";
