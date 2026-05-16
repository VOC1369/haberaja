/**
 * PATCH B — Deterministic registry-driven apply for admin radio answers.
 *
 * Bypasses the LLM resolver when the admin picks a structured radio option
 * that is already defined in FIELD_REGISTRY. The registry IS the authority:
 *   - entry.write(draft, answer)              → primary value
 *   - entry.writeSibling(draft, answer)       → sibling boolean (e.g. unlimited)
 *   - entry.getAdminNote(answer)              → audit note
 *
 * Hard rules:
 *   - Input record is never mutated. Returns a deep-cloned updated record.
 *   - Sets `_field_status[path] = "explicit"` and same for sibling path.
 *   - Appends `_human_override_log` entry.
 *   - Clears the exact source_text flag from its severity bucket.
 *   - NEVER touches contradiction_flags by path (exact-source clear only).
 *   - NEVER mutates raw_content / schema / meta_engine / readiness flags
 *     other than the targeted bucket clear.
 *   - NEVER uses regex / keyword logic. Pure structural writes via registry.
 *
 * Out of scope: free-text (`manual_note`), custom date/number (`CUSTOM`) →
 * caller MUST fall through to the LLM resolver for those.
 */
import type { PkV10Record } from "../schema/pk-v10";
import {
  CUSTOM,
  type AdminAnswer,
  type FieldRegistryEntry,
} from "./field-registry";

export interface DeterministicApplyInput {
  record: PkV10Record;
  entry: FieldRegistryEntry;
  /** Internal hint coming from the radio (registry option `value`). */
  hint: string;
  /** Free-text note typed below the radio (optional). */
  note?: string;
  severity: "warning" | "ambiguity" | "contradiction";
  /** Exact extractor flag text — used to clear that single flag entry. */
  sourceText: string;
  actor?: string;
  reason?: string;
}

export interface DeterministicApplyResult {
  ok: boolean;
  record?: PkV10Record;
  error?: string;
  applied_paths?: string[];
}

const FREE_TEXT_HINTS = new Set<string>([
  CUSTOM,
  "manual_note",
  "__manual__",
  "__custom__",
]);

export function isDeterministicHint(hint: string | undefined | null): boolean {
  if (!hint || typeof hint !== "string") return false;
  if (FREE_TEXT_HINTS.has(hint)) return false;
  return true;
}

interface HumanOverrideEntry {
  field_path: string;
  previous_value: unknown;
  new_value: unknown;
  previous_field_status: string | null;
  previous_ai_confidence: number | null;
  overridden_by: string;
  timestamp: string;
  source: string;
  reason?: string;
}

function readPath(root: unknown, dotted: string): unknown {
  const segs = dotted.split(".").filter(Boolean);
  let cur: unknown = root;
  for (const s of segs) {
    if (cur && typeof cur === "object") {
      cur = (cur as Record<string, unknown>)[s];
    } else {
      return undefined;
    }
  }
  return cur;
}

function clearFlagByExactSource(
  draft: PkV10Record,
  severity: "warning" | "ambiguity" | "contradiction",
  sourceText: string,
): void {
  const ob = draft.readiness_engine?.observability_block;
  const vb = draft.readiness_engine?.validation_block;
  if (severity === "warning" && vb && Array.isArray(vb.warnings)) {
    vb.warnings = vb.warnings.filter((s) => s !== sourceText);
  } else if (
    severity === "ambiguity" &&
    ob &&
    Array.isArray(ob.ambiguity_flags)
  ) {
    ob.ambiguity_flags = ob.ambiguity_flags.filter((s) => s !== sourceText);
  } else if (
    severity === "contradiction" &&
    ob &&
    Array.isArray(ob.contradiction_flags)
  ) {
    ob.contradiction_flags = ob.contradiction_flags.filter(
      (s) => s !== sourceText,
    );
  }
}

export function applyDeterministicRegistryAnswer(
  input: DeterministicApplyInput,
): DeterministicApplyResult {
  const {
    record,
    entry,
    hint,
    note,
    severity,
    sourceText,
    actor = "admin",
    reason,
  } = input;

  if (!isDeterministicHint(hint)) {
    return { ok: false, error: "hint is free-text — resolver required" };
  }

  const answer: AdminAnswer = {
    choice: hint,
    customValue: note,
    note,
  };

  const clone = JSON.parse(JSON.stringify(record)) as PkV10Record;
  const cloneAny = clone as PkV10Record & {
    _human_override_log?: HumanOverrideEntry[];
  };

  const path = entry.path;
  const previous = readPath(clone, path);

  try {
    entry.write(clone, answer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "registry write failed";
    return { ok: false, error: `${path}: ${msg}` };
  }

  const fieldStatus: Record<string, string> = {
    ...((clone._field_status as Record<string, string> | undefined) ?? {}),
  };
  const aiConf = (clone.ai_confidence ?? {}) as Record<string, unknown>;
  const log: HumanOverrideEntry[] = Array.isArray(cloneAny._human_override_log)
    ? [...cloneAny._human_override_log]
    : [];

  const ts = new Date().toISOString();
  const adminNote = entry.getAdminNote?.(answer) ?? reason;
  const appliedPaths: string[] = [path];

  const pushLog = (
    p: string,
    prev: unknown,
    next: unknown,
  ): void => {
    const prevStatus =
      typeof fieldStatus[p] === "string" ? fieldStatus[p] : null;
    const prevConfRaw = aiConf[p];
    const prevConf =
      typeof prevConfRaw === "number" ? prevConfRaw : null;
    const entryLog: HumanOverrideEntry = {
      field_path: p,
      previous_value: prev ?? null,
      new_value: next ?? null,
      previous_field_status: prevStatus,
      previous_ai_confidence: prevConf,
      overridden_by: actor,
      timestamp: ts,
      source: "admin_verify_deterministic_registry",
    };
    if (adminNote && adminNote.trim()) entryLog.reason = adminNote.trim();
    log.push(entryLog);
    fieldStatus[p] = "explicit";
  };

  pushLog(path, previous, readPath(clone, path));

  // Sibling (unlimited flag, etc.)
  if (entry.unlimitedSiblingPath && entry.writeSibling) {
    const siblingPath = entry.unlimitedSiblingPath;
    const prevSibling = readPath(clone, siblingPath);
    try {
      entry.writeSibling(clone, answer);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "registry writeSibling failed";
      return { ok: false, error: `${siblingPath}: ${msg}` };
    }
    const newSibling = readPath(clone, siblingPath);
    pushLog(siblingPath, prevSibling, newSibling);
    appliedPaths.push(siblingPath);
  }

  // Clear the precise extractor flag the admin just resolved.
  clearFlagByExactSource(clone, severity, sourceText);

  clone._field_status = fieldStatus;
  cloneAny._human_override_log = log;
  clone.updated_at = ts;

  return { ok: true, record: clone, applied_paths: appliedPaths };
}
