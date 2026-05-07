/**
 * PR-18 — Extractor Issue → Admin Verify Question Adapter (CONTRACT ONLY).
 *
 * Goal:
 *   When the extractor records confusing / contradictory / ambiguous data
 *   under `readiness_engine.*` as free-text strings, surface those issues
 *   as Admin Verify questions EARLY — not at Step9 publish-blocked.
 *
 * Strict rules (locked by PR-18):
 *   1. NO regex / keyword matching as business logic.
 *   2. NO per-promo branching.
 *   3. NO live LLM call here. This module defines the contract only.
 *      A mocked resolver is provided for tests; the real LLM resolver lands
 *      in a separate PR.
 *   4. NEVER mutates the record.
 *   5. NEVER edits raw_content.
 *   6. NEVER auto-applies patches. All resolver output is preview-only.
 *   7. NEVER auto-clears flags or auto-sets ready_to_commit.
 *
 * Inputs (read-only):
 *   - readiness_engine.validation_block.warnings[]
 *   - readiness_engine.observability_block.ambiguity_flags[]
 *   - readiness_engine.observability_block.contradiction_flags[]
 *
 * Outputs:
 *   - ExtractorIssue[]            — raw issue items, deterministically derived
 *   - AdminVerifyIssueQuestion[]  — question candidates for Admin Verify
 *   - JsonPatchPreview            — preview emitted by the (future) LLM resolver
 *   - ResolveAdminAnswerResult    — wrapper returned to UI
 */

import type { PkV10Record } from "../schema/pk-v10";

// ─────────────────────────────────────────────────────────────────────────
// Types — public contract
// ─────────────────────────────────────────────────────────────────────────

export type ExtractorIssueSeverity = "warning" | "ambiguity" | "contradiction";

export interface ExtractorIssue {
  /** Stable, deterministic id derived from severity + index + text hash. */
  task_id: string;
  severity: ExtractorIssueSeverity;
  /** Original free-text from extractor — surfaced verbatim, never parsed. */
  source_text: string;
  /** JSON path of the array this issue came from (for governance trace). */
  source_path: string;
}

export type AdminAnswerMode =
  | "radio_with_explanation"
  | "free_text"
  | "manual_edit";

export interface AdminVerifyIssueQuestion {
  task_id: string;
  severity: ExtractorIssueSeverity;
  source_text: string;
  /** Generic, non-keyword summary. Real semantic summary belongs to the LLM. */
  issue_summary: string;
  /** Generic, non-keyword admin question. LLM may rewrite per-issue later. */
  admin_question: string;
  answer_mode: AdminAnswerMode;
  /** Optional. The contract permits options; deterministic adapter leaves empty. */
  options?: Array<{ label: string; value: string; meaning: string }>;
  /** Paths the resolver MAY target. Empty = LLM must propose. */
  affected_paths: string[];
  /** Evidence references (e.g. raw_content path). */
  evidence_paths: string[];
  /** Always true for issues coming from this adapter. */
  requires_llm_resolution: true;
}

export interface AdminNaturalAnswer {
  task_id: string;
  /** Natural language answer from the admin. */
  answer_text: string;
}

export type JsonPatchOperation =
  | "replace_text_in_array"
  | "set_value"
  | "append_note"
  | "mark_manual_review_needed";

export interface JsonPatchPreview {
  operation: JsonPatchOperation;
  target_path: string;
  old_value_preview: unknown;
  new_value_preview: unknown;
  reason: string;
}

export interface ResolveAdminAnswerResult {
  intent_summary: string;
  confidence: "high" | "medium" | "low";
  needs_confirmation: true;
  proposed_patches: JsonPatchPreview[];
  unresolved_questions?: string[];
  /** True when resolver cannot turn the answer into a confident patch. */
  needs_clarification?: boolean;
}

export interface ResolveAdminAnswerInput {
  record: PkV10Record;
  reviewTask: AdminVerifyIssueQuestion;
  adminAnswer: AdminNaturalAnswer;
  /** Read-only evidence — MUST never be edited. */
  rawContentReadonly: string | null;
  /** Whitelist of paths the resolver is allowed to target. */
  allowedTargetPaths: string[];
}

export type AdminAnswerResolver = (
  input: ResolveAdminAnswerInput,
) => Promise<ResolveAdminAnswerResult>;

// ─────────────────────────────────────────────────────────────────────────
// Deterministic adapter — extractor flags → issue/question candidates
// NO regex. NO keyword matching. NO per-promo logic.
// ─────────────────────────────────────────────────────────────────────────

const ISSUE_SUMMARY: Record<ExtractorIssueSeverity, string> = {
  warning: "Extractor mencatat sebuah peringatan pada data promo.",
  ambiguity: "Extractor menemukan data yang ambigu pada promo.",
  contradiction: "Extractor menemukan kemungkinan kontradiksi pada data promo.",
};

const ADMIN_QUESTION: Record<ExtractorIssueSeverity, string> = {
  warning:
    "Mohon jelaskan dengan kalimat Anda sendiri: apakah catatan ini benar, dan jika perlu diperbaiki, apa yang seharusnya?",
  ambiguity:
    "Mohon jelaskan dengan kalimat Anda sendiri: apa interpretasi yang benar untuk data ini?",
  contradiction:
    "Mohon jelaskan dengan kalimat Anda sendiri: bagian mana yang benar dan apa yang seharusnya tertulis?",
};

const SOURCE_PATHS: Record<ExtractorIssueSeverity, string> = {
  warning: "readiness_engine.validation_block.warnings",
  ambiguity: "readiness_engine.observability_block.ambiguity_flags",
  contradiction: "readiness_engine.observability_block.contradiction_flags",
};

/** Stable hash without crypto — short, collision-tolerant for task_id. */
function shortHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h) ^ input.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

function readArray(rec: PkV10Record, path: string[]): string[] {
  let cur: unknown = rec;
  for (const seg of path) {
    if (cur && typeof cur === "object" && seg in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return [];
    }
  }
  return Array.isArray(cur) ? (cur.filter((x) => typeof x === "string") as string[]) : [];
}

export function collectExtractorIssues(rec: PkV10Record | null): ExtractorIssue[] {
  if (!rec) return [];
  const out: ExtractorIssue[] = [];

  const groups: Array<{ sev: ExtractorIssueSeverity; path: string[] }> = [
    { sev: "warning", path: ["readiness_engine", "validation_block", "warnings"] },
    { sev: "ambiguity", path: ["readiness_engine", "observability_block", "ambiguity_flags"] },
    { sev: "contradiction", path: ["readiness_engine", "observability_block", "contradiction_flags"] },
  ];

  for (const g of groups) {
    const items = readArray(rec, g.path);
    items.forEach((text, idx) => {
      const task_id = `${g.sev}-${idx}-${shortHash(text)}`;
      out.push({
        task_id,
        severity: g.sev,
        source_text: text,
        source_path: SOURCE_PATHS[g.sev],
      });
    });
  }

  return out;
}

export function buildIssueQuestions(
  rec: PkV10Record | null,
): AdminVerifyIssueQuestion[] {
  return collectExtractorIssues(rec).map((iss) => ({
    task_id: iss.task_id,
    severity: iss.severity,
    source_text: iss.source_text,
    issue_summary: ISSUE_SUMMARY[iss.severity],
    admin_question: ADMIN_QUESTION[iss.severity],
    answer_mode: "free_text",
    affected_paths: [],
    evidence_paths: ["meta_engine.source_block.raw_content"],
    requires_llm_resolution: true,
  }));
}

// ─────────────────────────────────────────────────────────────────────────
// Mocked resolver — for tests + Storybook only.
// REAL LLM resolver lands in a separate PR. Do NOT wire this into prod.
// ─────────────────────────────────────────────────────────────────────────

export const mockedAdminAnswerResolver: AdminAnswerResolver = async (input) => {
  const { adminAnswer, reviewTask } = input;
  const trimmed = (adminAnswer.answer_text ?? "").trim();

  if (trimmed.length === 0) {
    return {
      intent_summary: "Jawaban admin masih kosong.",
      confidence: "low",
      needs_confirmation: true,
      proposed_patches: [],
      needs_clarification: true,
      unresolved_questions: ["Mohon isi jawaban terlebih dahulu."],
    };
  }

  // Mocked: never invents patches. Returns a placeholder that the test can
  // assert against. Real resolver replaces this output via LLM reasoning.
  return {
    intent_summary: `Resolver akan memproses jawaban admin untuk task ${reviewTask.task_id}.`,
    confidence: "medium",
    needs_confirmation: true,
    proposed_patches: [],
    needs_clarification: true,
    unresolved_questions: [
      "Resolver LLM belum aktif. Patch preview akan dihasilkan setelah PR resolver landing.",
    ],
  };
};
