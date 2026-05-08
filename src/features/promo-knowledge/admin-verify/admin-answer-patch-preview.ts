/**
 * PR-19B — Admin Natural Answer → JSON Patch Preview (MOCKED RESOLVER).
 *
 * Strict rules:
 *   - Deterministic, NO live LLM call, NO fetch, NO ai-proxy, NO edge function.
 *   - NEVER mutates the record.
 *   - NEVER applies the patch — output is preview-only.
 *   - NO regex over warning/contradiction free text.
 *   - Allowed: structured enum extraction from admin answer for fields whose
 *     `affected_paths` are known F3 enum paths (rule_type, turnover_rule_format).
 *     This uses an exact, lowercased token-membership test against the closed
 *     enum set — not keyword matching against arbitrary text.
 *
 * Real LLM resolver lands in a later PR and must replace this module without
 * changing the contract types below.
 */
import type { PkV10Record } from "../schema/pk-v10";
import type {
  AdminVerifyIssueQuestion,
  JsonPatchPreview,
  ResolveAdminAnswerResult,
  AdminNaturalAnswer,
} from "./extractor-issue-adapter";

export type {
  JsonPatchPreview,
  ResolveAdminAnswerResult,
  AdminNaturalAnswer,
} from "./extractor-issue-adapter";

const RULE_TYPE_PATH = "trigger_engine.trigger_rule_block.rule_type";
const TURNOVER_FORMAT_LEAF = "turnover_rule_format";

const ALLOWED_RULE_TYPE = new Set([
  "simple",
  "compound",
  "sequential",
  "conditional",
  "threshold",
  "recurring",
]);

const ALLOWED_TURNOVER_RULE_FORMAT = new Set(["multiplier", "min_rupiah"]);

/** Tokenize answer into lowercased word tokens. Structural, not semantic. */
function tokenize(text: string): string[] {
  const out: string[] = [];
  let buf = "";
  const lower = text.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    const isWord = (ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9") || ch === "_";
    if (isWord) {
      buf += ch;
    } else if (buf.length > 0) {
      out.push(buf);
      buf = "";
    }
  }
  if (buf.length > 0) out.push(buf);
  return out;
}

function pickFromEnum(text: string, allowed: Set<string>): string | null {
  const tokens = tokenize(text);
  const hits: string[] = [];
  for (const t of tokens) {
    if (allowed.has(t) && !hits.includes(t)) hits.push(t);
  }
  // Bigram support for "min_rupiah" written as "min rupiah".
  for (let i = 0; i < tokens.length - 1; i++) {
    const bg = `${tokens[i]}_${tokens[i + 1]}`;
    if (allowed.has(bg) && !hits.includes(bg)) hits.push(bg);
  }
  if (hits.length === 1) return hits[0];
  return null; // ambiguous (0 or >1) → no confident pick
}

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
 * Mocked resolver. Pure function. Does not touch `record`.
 */
export async function mockedAdminAnswerToPatchPreview(input: {
  record: PkV10Record;
  reviewTask: AdminVerifyIssueQuestion;
  adminAnswer: AdminNaturalAnswer;
}): Promise<ResolveAdminAnswerResult> {
  const { record, reviewTask, adminAnswer } = input;
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

  const patches: JsonPatchPreview[] = [];

  for (const path of reviewTask.affected_paths) {
    if (path === RULE_TYPE_PATH) {
      const pick = pickFromEnum(trimmed, ALLOWED_RULE_TYPE);
      if (pick) {
        patches.push({
          operation: "set_value",
          target_path: path,
          old_value_preview: readPath(record, path) ?? null,
          new_value_preview: pick,
          reason: `Admin memilih nilai enum '${pick}' yang sesuai F3 V.10.1 untuk ${path}.`,
        });
      }
      continue;
    }
    if (path.endsWith(`.${TURNOVER_FORMAT_LEAF}`)) {
      const pick = pickFromEnum(trimmed, ALLOWED_TURNOVER_RULE_FORMAT);
      if (pick) {
        patches.push({
          operation: "set_value",
          target_path: path,
          old_value_preview: readPath(record, path) ?? null,
          new_value_preview: pick,
          reason: `Admin memilih format turnover '${pick}' yang sesuai F3 V.10.1.`,
        });
      }
      continue;
    }
    // Unknown affected_path → mocked resolver tidak mengarang patch.
  }

  if (patches.length === 0) {
    return {
      intent_summary:
        "Jawaban belum dapat dipetakan secara pasti ke nilai enum yang valid.",
      confidence: "low",
      needs_confirmation: false,
      proposed_patches: [],
      needs_clarification: true,
      unresolved_questions: [
        "Mohon sebutkan satu nilai enum yang valid sesuai F3 V.10.1.",
      ],
    };
  }

  return {
    intent_summary: `Sistem memahami jawaban Anda sebagai ${patches.length} perubahan nilai canonical.`,
    confidence: "medium",
    needs_confirmation: true,
    proposed_patches: patches,
  };
}
