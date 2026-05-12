/**
 * PR-19A.1 — F3 Compliance Issue Adapter (CONTRACT ONLY).
 *
 * Reads canonical PkV10Record paths and emits AdminVerifyIssueQuestion entries
 * when a value violates the F3 V.10.1 enum authority.
 *
 * Strict rules:
 *   - Deterministic and path-based. NO regex over warning text.
 *   - NO keyword/promo branching.
 *   - NO mutation of the record. Read-only.
 *   - NO live LLM call. NO auto-fix. NO normalization.
 *   - Currency stays extensible (only shape-checked, not closed enum).
 *   - Output shape compatible with PR-19A's <ExtractorIssueSection>.
 */

import type { PkV10Record } from "../schema/pk-v10";
import type { AdminVerifyIssueQuestion } from "./extractor-issue-adapter";
import { hasResolvedStructuredConditions } from "./condition-summary";

// ─── F3 V.10.1 closed enums (authority) ────────────────────────────────
const ALLOWED_RULE_TYPE = [
  "simple",
  "compound",
  "sequential",
  "conditional",
  "threshold",
  "recurring",
] as const;

const ALLOWED_TURNOVER_RULE_FORMAT = ["multiplier", "min_rupiah"] as const;

const ALLOWED_STATE = ["draft", "ready", "published", "rejected"] as const;

const ALLOWED_VALIDATION_STATUS = [
  "draft",
  "ready",
  "needs_review",
  "rejected",
] as const;

// ─── helpers ───────────────────────────────────────────────────────────
function shortHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h) ^ input.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

function readPath(rec: unknown, path: string[]): unknown {
  let cur: unknown = rec;
  for (const seg of path) {
    if (cur && typeof cur === "object" && seg in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return cur;
}

function isCurrencyShapeValid(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const t = v.trim();
  if (t.length === 0) return true; // empty = skip
  // Extensible but should look like 3-letter ISO uppercase code.
  return /^[A-Z]{3}$/.test(t);
}

function makeQuestion(args: {
  kind: string;
  severity: "warning" | "contradiction";
  path: string;
  invalidValue: unknown;
  allowed: readonly string[] | null;
  issueSummary: string;
  adminQuestion: string;
}): AdminVerifyIssueQuestion {
  const valuePreview =
    typeof args.invalidValue === "string"
      ? args.invalidValue
      : JSON.stringify(args.invalidValue);
  const source_text = args.allowed
    ? `Path: ${args.path}\nNilai saat ini: ${valuePreview}\nAllowed F3 V.10.1: [${args.allowed.join(", ")}]`
    : `Path: ${args.path}\nNilai saat ini: ${valuePreview}`;
  return {
    task_id: `f3-${args.kind}-${shortHash(`${args.path}|${valuePreview}`)}`,
    severity: args.severity,
    source_text,
    issue_summary: args.issueSummary,
    admin_question: args.adminQuestion,
    answer_mode: "free_text",
    affected_paths: [args.path],
    evidence_paths: [],
    requires_llm_resolution: true,
  };
}

// ─── main ──────────────────────────────────────────────────────────────
export function buildF3ComplianceQuestions(
  rec: PkV10Record | null,
): AdminVerifyIssueQuestion[] {
  if (!rec) return [];
  const out: AdminVerifyIssueQuestion[] = [];

  // 1) trigger_engine.trigger_rule_block.rule_type
  //    GATING (general logic, not per-promo): if structured conditions are
  //    already present and well-formed, the trigger semantics are explicit
  //    from data — do NOT force the admin to classify rule_type. The value
  //    can still be normalized downstream by the LLM/governance layer.
  {
    const path = "trigger_engine.trigger_rule_block.rule_type";
    const v = readPath(rec, ["trigger_engine", "trigger_rule_block", "rule_type"]);
    if (typeof v === "string" && v.trim().length > 0) {
      if (!(ALLOWED_RULE_TYPE as readonly string[]).includes(v)) {
        const conditionsResolved = hasResolvedStructuredConditions(rec);
        if (!conditionsResolved) {
          out.push(
            makeQuestion({
              kind: "rule_type",
              severity: "contradiction",
              path,
              invalidValue: v,
              allowed: ALLOWED_RULE_TYPE,
              issueSummary: "Jenis aturan trigger tidak sesuai F3 V.10.1.",
              adminQuestion: `Nilai saat ini adalah '${v}'. Pilih jenis aturan yang paling sesuai (simple, compound, sequential, conditional, threshold, atau recurring).`,
            }),
          );
        }
      }
    }
  }

  // 2) variant_engine.items_block.subcategories[].turnover_rule_format
  {
    const subs = readPath(rec, [
      "variant_engine",
      "items_block",
      "subcategories",
    ]);
    if (Array.isArray(subs)) {
      subs.forEach((sub, idx) => {
        const v =
          sub && typeof sub === "object"
            ? (sub as Record<string, unknown>).turnover_rule_format
            : undefined;
        if (typeof v === "string" && v.trim().length > 0) {
          if (!(ALLOWED_TURNOVER_RULE_FORMAT as readonly string[]).includes(v)) {
            const path = `variant_engine.items_block.subcategories[${idx}].turnover_rule_format`;
            out.push(
              makeQuestion({
                kind: `turnover_rule_format_${idx}`,
                severity: "contradiction",
                path,
                invalidValue: v,
                allowed: ALLOWED_TURNOVER_RULE_FORMAT,
                issueSummary: "Format aturan turnover varian tidak sesuai F3 V.10.1.",
                adminQuestion:
                  "Nilai saat ini terlihat seperti formula teks. Apakah format turnover ini multiplier atau min_rupiah?",
              }),
            );
          }
        }
      });
    }
  }

  // 3) readiness_engine.state_block.state
  {
    const path = "readiness_engine.state_block.state";
    const v = readPath(rec, ["readiness_engine", "state_block", "state"]);
    if (typeof v === "string" && v.trim().length > 0) {
      if (!(ALLOWED_STATE as readonly string[]).includes(v)) {
        out.push(
          makeQuestion({
            kind: "state",
            severity: "contradiction",
            path,
            invalidValue: v,
            allowed: ALLOWED_STATE,
            issueSummary: "State readiness tidak sesuai F3 V.10.1.",
            adminQuestion: `Nilai state saat ini adalah '${v}'. Pilih state yang valid (draft, ready, published, atau rejected).`,
          }),
        );
      }
    }
  }

  // 4) readiness_engine.validation_block.status
  {
    const path = "readiness_engine.validation_block.status";
    const v = readPath(rec, ["readiness_engine", "validation_block", "status"]);
    if (typeof v === "string" && v.trim().length > 0) {
      if (!(ALLOWED_VALIDATION_STATUS as readonly string[]).includes(v)) {
        out.push(
          makeQuestion({
            kind: "validation_status",
            severity: "contradiction",
            path,
            invalidValue: v,
            allowed: ALLOWED_VALIDATION_STATUS,
            issueSummary: "Status validation tidak sesuai F3 V.10.1.",
            adminQuestion: `Nilai status validation saat ini adalah '${v}'. Pilih status yang valid (draft, ready, needs_review, atau rejected).`,
          }),
        );
      }
    }
  }

  // 5) currency shape (extensible — only warn on obvious malformed value).
  {
    const path = "reward_engine.currency";
    const v = readPath(rec, ["reward_engine", "currency"]);
    if (v !== undefined && v !== null) {
      if (!isCurrencyShapeValid(v)) {
        out.push(
          makeQuestion({
            kind: "currency_shape",
            severity: "warning",
            path,
            invalidValue: v,
            allowed: null,
            issueSummary: "Format currency tidak terlihat seperti kode ISO 3-huruf.",
            adminQuestion:
              "Currency biasanya berupa kode ISO 3-huruf kapital (mis. IDR, KHR, PHP). Mohon konfirmasi nilai currency yang benar.",
          }),
        );
      }
    }
  }

  return out;
}
