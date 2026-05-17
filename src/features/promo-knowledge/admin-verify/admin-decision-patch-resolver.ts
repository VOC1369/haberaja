/**
 * Phase 4 — Admin Decision → JSON Patch Preview Resolver (LLM-backed).
 *
 * Input  : AdminDecision + admin's selection + optional note + record context.
 * Output : Strictly validated JsonPatchPreview[] ready for the safe applier.
 *
 * Hard rules:
 *   - The Admin Reviewer (Phase 1) NEVER emits target_path. That job lives
 *     here so reviewer can stay a pure "human question writer".
 *   - No regex/keyword business logic. The LLM reasons; this module enforces
 *     allowlist + shape.
 *   - PREVIEW only. This module never mutates the record.
 *   - On malformed LLM output → throws. Caller surfaces a hard error;
 *     never silently fallback to dummy patches.
 *   - Empty / un-actionable selection → returns an empty patch list and a
 *     `needs_clarification` reason. Apply orchestrator treats that as an
 *     error and does NOT mutate the record.
 */
import { callAI, extractJSON } from "@/lib/ai-client";
import type { PkV10Record } from "../schema/pk-v10";
import type {
  JsonPatchOperation,
  JsonPatchPreview,
} from "./extractor-issue-adapter";
import type { AdminDecision } from "./admin-decision-types";

const VALID_OPS: ReadonlySet<JsonPatchOperation> = new Set<JsonPatchOperation>([
  "set_value",
  "replace_text_in_array",
]);

const SYSTEM_PROMPT = `You convert an admin's structured decision into a JSON Patch PREVIEW for a PkV10Record (Pseudo Knowledge schema V.10.2).

STRICT RULES:
- Output STRICT JSON ONLY. No markdown fences. No prose.
- ONLY propose patches whose "target_path" appears in allowed_target_paths.
- Allowed operations: "set_value", "replace_text_in_array".
- For "replace_text_in_array": "old_value_preview" must be a string that currently exists in the target array (use current_values).
- For enum fields, only use values listed in the option payload OR values already valid for that field. NEVER invent enum values.
- If the admin's selection is ambiguous or no safe patch fits, return proposed_patches = [] and explain in unresolved_questions.
- NEVER touch raw_content. NEVER touch readiness flags. NEVER touch schema.
- The reason field MUST be short and admin-readable (no technical jargon).

OUTPUT SHAPE (exact keys):
{
  "intent_summary": string,
  "proposed_patches": [
    {
      "operation": "set_value" | "replace_text_in_array",
      "target_path": string,
      "old_value_preview": any,
      "new_value_preview": any,
      "reason": string
    }
  ],
  "unresolved_questions": string[]
}`;

export interface ResolveDecisionInput {
  record: PkV10Record;
  decision: AdminDecision;
  selectedValue: string;
  selectedLabel: string;
  note: string;
  allowedTargetPaths: string[];
}

export interface ResolveDecisionResult {
  intent_summary: string;
  proposed_patches: JsonPatchPreview[];
  unresolved_questions: string[];
}

export type DecisionPatchResolver = (
  input: ResolveDecisionInput,
) => Promise<ResolveDecisionResult>;

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

/**
 * Derive allowed target paths from the record. Currently mirrors the
 * SAFE_EDITABLE_PATH_RULES registry literal paths plus per-variant
 * turnover_rule_format entries. Kept here (rather than importing from
 * admin-patch-apply) so this module stays a pure resolver contract.
 */
export function deriveAllowedTargetPaths(record: PkV10Record): string[] {
  const paths: string[] = [
    "trigger_engine.trigger_rule_block.rule_type",
    "reward_engine.currency",
    "terms_engine.conditions_block.terms_conditions",
  ];
  const subs = (
    record as unknown as {
      variant_engine?: {
        items_block?: { subcategories?: unknown[] };
      };
    }
  ).variant_engine?.items_block?.subcategories;
  if (Array.isArray(subs)) {
    for (let i = 0; i < subs.length; i++) {
      paths.push(
        `variant_engine.items_block.subcategories[${i}].turnover_rule_format`,
      );
    }
  }
  return paths;
}

/** Real LLM-backed resolver. */
export const liveDecisionPatchResolver: DecisionPatchResolver = async (
  input,
) => {
  const { record, decision, selectedValue, selectedLabel, note, allowedTargetPaths } =
    input;

  const trimmedSel = (selectedValue ?? "").trim();
  if (trimmedSel.length === 0) {
    return {
      intent_summary: "Admin belum memilih opsi.",
      proposed_patches: [],
      unresolved_questions: ["Pilih salah satu opsi terlebih dahulu."],
    };
  }

  const currentValues: Record<string, unknown> = {};
  for (const p of allowedTargetPaths) {
    currentValues[p] = readPath(record, p) ?? null;
  }

  const userPayload = {
    decision: {
      id: decision.id,
      title: decision.title,
      question: decision.question,
      explanation: decision.explanation,
      options: decision.options,
    },
    admin_selection: {
      value: trimmedSel,
      label: selectedLabel || "",
      note: (note ?? "").trim() || null,
    },
    allowed_target_paths: allowedTargetPaths,
    current_values: currentValues,
  };

  const resp = await callAI({
    type: "intent",
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(userPayload) }],
    temperature: 0,
  });

  const parsed = extractJSON<{
    intent_summary?: unknown;
    proposed_patches?: unknown;
    unresolved_questions?: unknown;
  }>(resp);

  const allowedSet = new Set(allowedTargetPaths);
  const accepted: JsonPatchPreview[] = [];
  const rejected: string[] = [];

  const raw = Array.isArray(parsed.proposed_patches)
    ? (parsed.proposed_patches as Array<Record<string, unknown>>)
    : [];

  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const target = typeof p.target_path === "string" ? p.target_path : null;
    if (!target) continue;
    if (!allowedSet.has(target)) {
      rejected.push(target);
      continue;
    }
    const op =
      typeof p.operation === "string" && VALID_OPS.has(p.operation as JsonPatchOperation)
        ? (p.operation as JsonPatchOperation)
        : null;
    if (!op) continue;
    accepted.push({
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

  if (rejected.length > 0) {
    unresolved.push("Beberapa usulan tidak aman diterapkan dan diabaikan.");
  }

  return {
    intent_summary:
      typeof parsed.intent_summary === "string"
        ? parsed.intent_summary
        : "Resolver memproses jawaban admin.",
    proposed_patches: accepted,
    unresolved_questions: unresolved,
  };
};
