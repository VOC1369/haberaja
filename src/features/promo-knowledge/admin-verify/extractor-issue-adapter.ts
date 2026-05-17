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
import { resolveCanonicalPath } from "./field-key-path-map";

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
  /**
   * Optional canonical field-key (e.g. "valid_until", "min_deposit").
   * Forward-compatible: extractor MAY emit this in structured warnings.
   * When present, used by routing to map to canonical V.10.1 path.
   */
  field_key?: string;
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
  /**
   * PR-22 — Optional internal hint emitted by the UI when the admin picks a
   * structured radio option. Resolver MAY use this as a non-binding signal to
   * disambiguate the admin's intent. Backward-compatible: when absent, the
   * resolver behaves exactly like before (answer_text only).
   */
  selected_internal_hint?: string;
  /** PR-22 — Admin-facing label of the selected option (for resolver context). */
  selected_label?: string;
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
  needs_confirmation: boolean;
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

/**
 * Severity priority for cross-bucket dedup.
 * contradiction (3) > ambiguity (2) > warning (1).
 */
const SEVERITY_PRIORITY: Record<ExtractorIssueSeverity, number> = {
  warning: 1,
  ambiguity: 2,
  contradiction: 3,
};

/**
 * Build a canonical dedup key for an extractor flag.
 * Pure structural normalization — NO keyword/regex business logic:
 *   - strip leading "dotted.path:" prefix (already used elsewhere)
 *   - lowercase
 *   - collapse all whitespace runs to a single space
 *   - trim
 * Severity is intentionally NOT part of the key, so the same fact
 * emitted to two buckets collapses into one issue.
 */
function dedupKey(text: string): string {
  if (typeof text !== "string") return "";
  const stripped = extractDottedPathPrefix(text)
    ? text.slice(text.indexOf(":") + 1)
    : text;
  // Whitespace normalization (structural, not keyword inference).
  const parts: string[] = [];
  let buf = "";
  for (let i = 0; i < stripped.length; i++) {
    const c = stripped.charCodeAt(i);
    const isWs = c === 32 || c === 9 || c === 10 || c === 13;
    if (isWs) {
      if (buf.length > 0) {
        parts.push(buf);
        buf = "";
      }
    } else {
      buf += stripped[i];
    }
  }
  if (buf.length > 0) parts.push(buf);
  return parts.join(" ").toLowerCase();
}

export function collectExtractorIssues(rec: PkV10Record | null): ExtractorIssue[] {
  if (!rec) return [];

  const groups: Array<{ sev: ExtractorIssueSeverity; path: string[] }> = [
    { sev: "warning", path: ["readiness_engine", "validation_block", "warnings"] },
    { sev: "ambiguity", path: ["readiness_engine", "observability_block", "ambiguity_flags"] },
    { sev: "contradiction", path: ["readiness_engine", "observability_block", "contradiction_flags"] },
  ];

  // Phase 1 — collect raw with original bucket index for stable task_id.
  type Raw = ExtractorIssue & { _key: string };
  const raw: Raw[] = [];
  for (const g of groups) {
    const items = readArray(rec, g.path);
    items.forEach((text, idx) => {
      const task_id = `${g.sev}-${idx}-${shortHash(text)}`;
      raw.push({
        task_id,
        severity: g.sev,
        source_text: text,
        source_path: SOURCE_PATHS[g.sev],
        _key: dedupKey(text),
      });
    });
  }

  // Phase 2 — dedup cross-bucket. Empty key (defensive) is never deduped.
  const winners = new Map<string, Raw>();
  const passthrough: Raw[] = [];
  for (const iss of raw) {
    if (iss._key.length === 0) {
      passthrough.push(iss);
      continue;
    }
    const prev = winners.get(iss._key);
    if (!prev) {
      winners.set(iss._key, iss);
      continue;
    }
    const prevPri = SEVERITY_PRIORITY[prev.severity];
    const curPri = SEVERITY_PRIORITY[iss.severity];
    if (curPri > prevPri) {
      // Higher severity wins. Preserve longest evidence text.
      const merged: Raw = {
        ...iss,
        source_text:
          iss.source_text.length >= prev.source_text.length
            ? iss.source_text
            : prev.source_text,
      };
      winners.set(iss._key, merged);
    } else if (curPri === prevPri) {
      // Same severity — keep the one with longer source_text.
      if (iss.source_text.length > prev.source_text.length) {
        winners.set(iss._key, iss);
      }
    } else {
      // Lower priority loses, but may upgrade the kept issue's evidence
      // if it's strictly longer.
      if (iss.source_text.length > prev.source_text.length) {
        winners.set(iss._key, { ...prev, source_text: iss.source_text });
      }
    }
  }

  const deduped: ExtractorIssue[] = [...winners.values(), ...passthrough].map(
    ({ _key: _omit, ...rest }) => rest,
  );
  return deduped;
}

export function buildIssueQuestions(
  rec: PkV10Record | null,
): AdminVerifyIssueQuestion[] {
  return collectExtractorIssues(rec).map((iss) => {
    // PATCH A — derive affected_paths deterministically.
    //   1) If extractor prefixed the message with "dotted.path: rest", use it.
    //   2) Else, resolve via canonical field-key map / token-in-source_text.
    //   3) Else, leave empty (resolver/LLM territory).
    const prefix = extractDottedPathPrefix(iss.source_text);
    const canonical =
      prefix ?? resolveCanonicalPath({ source_text: iss.source_text });
    const affected_paths = canonical ? [canonical] : [];
    return {
      task_id: iss.task_id,
      severity: iss.severity,
      source_text: iss.source_text,
      issue_summary: ISSUE_SUMMARY[iss.severity],
      admin_question: ADMIN_QUESTION[iss.severity],
      answer_mode: "free_text",
      affected_paths,
      evidence_paths: ["meta_engine.source_block.raw_content"],
      requires_llm_resolution: true,
    };
  });
}

/**
 * FINAL-PASS DEDUP for the merged AdminVerifyIssueQuestion[] (extractor + F3).
 *
 * The in-bucket dedup inside `collectExtractorIssues` is keyed on the raw
 * `source_text`. That collapses literal double-emits, but it does NOT collapse:
 *   (a) extractor + F3 referring to the same canonical path with different
 *       wording (e.g. F3 emits "Path: ...\nNilai saat ini: ...\nAllowed ...",
 *       extractor emits a free-text contradiction about the same path), or
 *   (b) two different worded flags about the same fact when one text is
 *       fully contained inside the other.
 *
 * Rules (pure structural — NO regex / keyword business logic):
 *   1. Primary key = `affected_paths[0]` when present.
 *      Two items with the same canonical path collapse into one. Higher
 *      severity wins (contradiction > ambiguity > warning); on tie, the
 *      item with the longer `source_text` wins.
 *   2. Path-less items are deduped by normalized `source_text`. Containment
 *      (one normalized text fully contained in the other) also collapses,
 *      with the longer text kept and the higher severity preserved.
 *   3. Order is preserved by first-seen-key.
 *
 * NEVER mutates inputs. NEVER touches the record. Presentation layer only.
 */
export function dedupIssueQuestions(
  items: AdminVerifyIssueQuestion[],
): AdminVerifyIssueQuestion[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  // ── Phase 1: path-keyed pass ─────────────────────────────────────────
  const byPath = new Map<string, AdminVerifyIssueQuestion>();
  const pathOrder: string[] = [];
  const pathless: AdminVerifyIssueQuestion[] = [];

  for (const q of items) {
    const p = (q.affected_paths && q.affected_paths[0]) || "";
    if (!p) {
      pathless.push(q);
      continue;
    }
    const prev = byPath.get(p);
    if (!prev) {
      byPath.set(p, q);
      pathOrder.push(p);
      continue;
    }
    byPath.set(p, pickWinner(prev, q));
  }

  // ── Phase 2: pathless pass with containment + token-overlap fold ─────
  // Token-overlap is STRUCTURAL similarity (split on non-alphanumeric,
  // lowercase, drop tokens shorter than 3 chars). It is NOT keyword/regex
  // business logic: no domain words are matched; we only count set overlap
  // between two flag strings. This catches paraphrases of the same fact
  // that text-equality / containment cannot see (e.g. extractor emitting
  // 3 differently worded sentences about the same S&K vs tabel issue).
  //
  // Fold rule: containment ratio = |A ∩ B| / min(|A|, |B|) ≥ 0.55, AND
  // min(|A|, |B|) ≥ 8 distinct tokens to avoid folding short distinct
  // messages. Higher severity wins, longer text wins on tie.
  const CONTAINMENT_THRESHOLD = 0.55;
  const MIN_TOKEN_OVERLAP_SIZE = 8;
  const keptPathless: AdminVerifyIssueQuestion[] = [];
  const keptTokens: Set<string>[] = [];
  for (const q of pathless) {
    const k = dedupKey(q.source_text ?? "");
    if (k.length === 0) {
      keptPathless.push(q);
      keptTokens.push(new Set());
      continue;
    }
    const tokens = tokenSet(q.source_text ?? "");
    let folded = false;
    for (let i = 0; i < keptPathless.length; i++) {
      const prev = keptPathless[i];
      const pk = dedupKey(prev.source_text ?? "");
      if (pk.length === 0) continue;
      if (pk === k || pk.includes(k) || k.includes(pk)) {
        keptPathless[i] = pickWinner(prev, q);
        // Pool tokens so subsequent paraphrases keep matching the cluster.
        for (const t of tokens) keptTokens[i].add(t);
        folded = true;
        break;
      }
      const prevTokens = keptTokens[i];
      const minSize = Math.min(prevTokens.size, tokens.size);
      if (minSize < MIN_TOKEN_OVERLAP_SIZE) continue;
      let shared = 0;
      const [small, large] =
        prevTokens.size <= tokens.size ? [prevTokens, tokens] : [tokens, prevTokens];
      for (const t of small) if (large.has(t)) shared++;
      const containment = shared / minSize;
      if (containment >= CONTAINMENT_THRESHOLD) {
        keptPathless[i] = pickWinner(prev, q);
        for (const t of tokens) keptTokens[i].add(t);
        folded = true;
        break;
      }
    }
    if (!folded) {
      keptPathless.push(q);
      keptTokens.push(tokens);
    }
  }

  return [...pathOrder.map((p) => byPath.get(p)!), ...keptPathless];
}

/**
 * Structural tokenizer: split on non-[A-Za-z0-9], lowercase, drop tokens
 * shorter than 3 chars. NOT a keyword matcher — no domain vocabulary is
 * inspected. Used only for set-overlap similarity in dedup.
 */
function tokenSet(text: string): Set<string> {
  const out = new Set<string>();
  if (typeof text !== "string" || text.length === 0) return out;
  let buf = "";
  const flush = () => {
    if (buf.length >= 3) out.add(buf.toLowerCase());
    buf = "";
  };
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    const isAlnum =
      (c >= 48 && c <= 57) ||
      (c >= 65 && c <= 90) ||
      (c >= 97 && c <= 122);
    if (isAlnum) buf += text[i];
    else flush();
  }
  flush();
  return out;
}

/** Severity + length tiebreak winner. Pure. */
function pickWinner(
  a: AdminVerifyIssueQuestion,
  b: AdminVerifyIssueQuestion,
): AdminVerifyIssueQuestion {
  const pa = SEVERITY_PRIORITY[a.severity] ?? 0;
  const pb = SEVERITY_PRIORITY[b.severity] ?? 0;
  if (pb > pa) return b;
  if (pa > pb) return a;
  return (b.source_text ?? "").length > (a.source_text ?? "").length ? b : a;
}

/**
 * Detect leading "dotted.path: rest" prefix on a flag string.
 * STRICT: no spaces, contains a dot, only [a-zA-Z0-9_.\[\]] chars. NOT a regex
 * keyword scan — this is structural identity, not wording inference.
 */
function extractDottedPathPrefix(text: string): string | null {
  if (typeof text !== "string") return null;
  const colon = text.indexOf(":");
  if (colon <= 0) return null;
  const head = text.slice(0, colon).trim();
  if (head.length === 0 || head.length > 200) return null;
  if (!head.includes(".")) return null;
  for (let i = 0; i < head.length; i++) {
    const c = head.charCodeAt(i);
    const ok =
      (c >= 48 && c <= 57) || // 0-9
      (c >= 65 && c <= 90) || // A-Z
      (c >= 97 && c <= 122) || // a-z
      c === 95 || c === 46 || c === 91 || c === 93; // _ . [ ]
    if (!ok) return null;
  }
  return head;
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
