/**
 * PR-19C — Live LLM Admin Answer → JSON Patch Preview Resolver.
 *
 * Strict rules (locked):
 *   - PREVIEW ONLY. NEVER applies the patch.
 *   - NEVER mutates the record.
 *   - NEVER edits raw_content.
 *   - NEVER clears warnings / contradiction_flags / ambiguity_flags.
 *   - NEVER sets ready_to_commit / review_required=false.
 *   - NEVER bypasses canPublish. Step9 remains the final gate.
 *   - Calls LLM through the existing approved AI client (`callAI` with
 *     `type: "intent"` against ai-proxy). NO new edge function. NO new
 *     model config. NO new secrets.
 *   - Enforces `allowedTargetPaths` AFTER the LLM responds. Patches whose
 *     `target_path` is not in the whitelist are dropped and surfaced as
 *     unresolved_questions — never silently applied.
 *   - NO regex / keyword business logic on warning text. The LLM is the
 *     reasoner; this module is plumbing + safety enforcement.
 *   - Strict JSON output only. Malformed → throws. UI must catch and show
 *     a hard error (no silent fallback to mock).
 */

import { callAI, extractJSON } from "@/lib/ai-client";
import type { PkV10Record } from "../schema/pk-v10";
import type {
  AdminAnswerResolver,
  JsonPatchOperation,
  JsonPatchPreview,
  ResolveAdminAnswerInput,
  ResolveAdminAnswerResult,
} from "./extractor-issue-adapter";

// Re-export for UI ergonomics.
export type {
  JsonPatchPreview,
  ResolveAdminAnswerInput,
  ResolveAdminAnswerResult,
} from "./extractor-issue-adapter";

const SYSTEM_PROMPT = `You convert an admin's natural-language answer into a JSON Patch PREVIEW for a PkV10Record (Pseudo Knowledge schema V.10.1).

STRICT RULES — VIOLATIONS WILL BE DROPPED:
- This is PREVIEW ONLY. You do NOT apply the patch. You do NOT publish.
- NEVER modify raw_content. NEVER reference editing it.
- NEVER invent fields. Only propose patches whose target_path appears in allowed_target_paths.
- For enum fields, only use values that comply with F3/F4 V.10.1 authority.
- If the admin answer is ambiguous, mention NO patch — instead set needs_clarification=true and propose unresolved_questions.
- NEVER set ready_to_commit, NEVER touch warnings, ambiguity_flags, contradiction_flags, review_required, or canPublish.
- Output STRICT JSON ONLY. No markdown fences. No commentary outside JSON.

OUTPUT SHAPE (exact keys):
{
  "intent_summary": string,
  "confidence": "high" | "medium" | "low",
  "needs_confirmation": boolean,
  "needs_clarification": boolean,
  "proposed_patches": [
    {
      "operation": "set_value" | "replace_text_in_array" | "append_note" | "mark_manual_review_needed",
      "target_path": string,
      "old_value_preview": any,
      "new_value_preview": any,
      "reason": string
    }
  ],
  "unresolved_questions": string[]
}`;

const VALID_OPERATIONS: ReadonlySet<JsonPatchOperation> = new Set<JsonPatchOperation>([
  "set_value",
  "replace_text_in_array",
  "append_note",
  "mark_manual_review_needed",
]);

/** Read a dotted path with `[idx]` segment support. Read-only. */
function readPath(rec: PkV10Record, dotted: string): unknown {
  const segs = dotted.split(/\.|\[|\]/).filter((s) => s.length > 0);
  let cur: unknown = rec;
  for (const s of segs) {
    if (cur && typeof cur === "object") {
      cur = (cur as Record<string, unknown>)[s];
    } else {
      return undefined;
    }
  }
  return cur;
}

function clampConfidence(v: unknown): "high" | "medium" | "low" {
  return v === "high" || v === "medium" || v === "low" ? v : "low";
}

/**
 * Live LLM resolver. Calls ai-proxy via `callAI({ type: "intent" })`.
 *
 * Throws on:
 *   - LLM transport failure (caller must catch and show hard error).
 *   - Non-JSON / unparseable LLM output.
 *
 * Never throws for "ambiguous answer" — that's a normal needs_clarification.
 */
export const liveAdminAnswerResolver: AdminAnswerResolver = async (input) => {
  const { record, reviewTask, adminAnswer, allowedTargetPaths } = input;

  const trimmed = (adminAnswer.answer_text ?? "").trim();
  if (trimmed.length === 0) {
    return {
      intent_summary: "Jawaban admin masih kosong.",
      confidence: "low",
      needs_confirmation: false,
      proposed_patches: [],
      needs_clarification: true,
      unresolved_questions: ["Mohon isi jawaban terlebih dahulu."],
    };
  }

  // Build a small, scoped context for the LLM. We deliberately do NOT send
  // the whole record — only current values for the allowed paths plus the
  // issue metadata. raw_content is never sent.
  const currentValues: Record<string, unknown> = {};
  for (const p of allowedTargetPaths) {
    currentValues[p] = readPath(record, p) ?? null;
  }

  const userPayload = {
    issue: {
      task_id: reviewTask.task_id,
      severity: reviewTask.severity,
      issue_summary: reviewTask.issue_summary,
      admin_question: reviewTask.admin_question,
      source_text: reviewTask.source_text,
    },
    admin_answer: trimmed,
    allowed_target_paths: allowedTargetPaths,
    current_values: currentValues,
  };

  const resp = await callAI({
    type: "intent",
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(userPayload) }],
    temperature: 0,
  });

  // extractJSON throws on malformed JSON — caller catches and shows error.
  const parsed = extractJSON<{
    intent_summary?: unknown;
    confidence?: unknown;
    needs_confirmation?: unknown;
    needs_clarification?: unknown;
    proposed_patches?: unknown;
    unresolved_questions?: unknown;
  }>(resp);

  // ── Post-LLM allowedTargetPaths enforcement ────────────────────────────
  const allowedSet = new Set(allowedTargetPaths);
  const rawPatches = Array.isArray(parsed.proposed_patches)
    ? (parsed.proposed_patches as Array<Record<string, unknown>>)
    : [];

  const acceptedPatches: JsonPatchPreview[] = [];
  const rejectedPaths: string[] = [];

  for (const p of rawPatches) {
    if (!p || typeof p !== "object") continue;
    const target = typeof p.target_path === "string" ? p.target_path : null;
    if (!target) continue;
    if (!allowedSet.has(target)) {
      rejectedPaths.push(target);
      continue;
    }
    const op =
      typeof p.operation === "string" && VALID_OPERATIONS.has(p.operation as JsonPatchOperation)
        ? (p.operation as JsonPatchOperation)
        : "set_value";
    acceptedPatches.push({
      operation: op,
      target_path: target,
      old_value_preview:
        p.old_value_preview !== undefined
          ? p.old_value_preview
          : (readPath(record, target) ?? null),
      new_value_preview: p.new_value_preview ?? null,
      reason: typeof p.reason === "string" ? p.reason : "",
    });
  }

  const unresolved: string[] = Array.isArray(parsed.unresolved_questions)
    ? (parsed.unresolved_questions as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : [];

  if (rejectedPaths.length > 0) {
    unresolved.push(
      `Resolver mengusulkan path di luar allowedTargetPaths dan diabaikan: ${rejectedPaths.join(", ")}.`,
    );
  }

  const needsClarification =
    !!parsed.needs_clarification ||
    (acceptedPatches.length === 0 && rejectedPaths.length > 0) ||
    acceptedPatches.length === 0;

  return {
    intent_summary:
      typeof parsed.intent_summary === "string"
        ? parsed.intent_summary
        : "Resolver memproses jawaban admin.",
    confidence: clampConfidence(parsed.confidence),
    needs_confirmation: !!parsed.needs_confirmation && acceptedPatches.length > 0,
    proposed_patches: acceptedPatches,
    needs_clarification: needsClarification,
    unresolved_questions: unresolved.length > 0 ? unresolved : undefined,
  };
};

/**
 * Public entrypoint used by Admin Verify UI.
 * Thin wrapper that derives `allowedTargetPaths` defensively from the
 * reviewTask if the caller didn't supply them.
 */
export async function resolveAdminAnswerToPatchPreview(
  input: ResolveAdminAnswerInput,
): Promise<ResolveAdminAnswerResult> {
  const safeInput: ResolveAdminAnswerInput = {
    ...input,
    allowedTargetPaths:
      input.allowedTargetPaths && input.allowedTargetPaths.length > 0
        ? input.allowedTargetPaths
        : input.reviewTask.affected_paths,
  };
  return liveAdminAnswerResolver(safeInput);
}
