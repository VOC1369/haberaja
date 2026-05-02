/**
 * QUESTION RESOLVER — Reasoning-First Orchestrator
 *
 * Runs RESOLVER_RULES against a record and returns:
 *   - skipPaths: paths the Admin Verify UI should NOT ask about
 *   - pendingEntries: AiResolverLogEntry[] to commit on Apply
 *   - pendingValuePatches: deferred writes to apply on Apply
 *
 * NEVER mutates the input record. Pure function.
 *
 * Commit timing (Hybrid):
 *   - Load → resolver runs in memory only
 *   - Apply → atomic commit: admin answers + value patches + log append
 */

import type { PkV10Record } from "@/features/promo-knowledge/schema/pk-v10";
import { RESOLVER_RULES, type ResolverStatus } from "./resolver-rules";

export type ResolverClassification = "explicit" | "not_applicable" | "ambiguous";

export interface AiResolverLogEntry {
  field_path: string;
  resolved_status: ResolverStatus;
  /** Audit tag — orthogonal to status. Tells WHY this decision was made. */
  classification?: ResolverClassification;
  reasoning: string;
  resolved_at: string;
  resolved_by: "ai_resolver";
}

export interface ResolverValuePatch {
  path: string;
  /** Scalar replacement for normalized scalar fields. */
  scalarValue?: unknown;
  /** Array element patches for normalized list fields. */
  arrayPatches?: Array<{ index: number; field: string; canonical: string }>;
}

export interface ResolverOutput {
  /** Paths that resolver handled — UI should hide questions for these. */
  skipPaths: Set<string>;
  /** Entries to append to _ai_resolver_log on Apply. */
  pendingEntries: AiResolverLogEntry[];
  /** Deferred writes to apply on Apply (only for "normalized"). */
  pendingValuePatches: ResolverValuePatch[];
}

export function resolveRecord(record: PkV10Record): ResolverOutput {
  const rawLower = (
    record?.meta_engine?.source_block?.raw_content ?? ""
  ).toLowerCase();
  const promoType = (
    record?.identity_engine?.promo_block?.promo_type ?? ""
  ).toLowerCase();

  const ctx = { record, rawLower, promoType };

  const skipPaths = new Set<string>();
  const pendingEntries: AiResolverLogEntry[] = [];
  const pendingValuePatches: ResolverValuePatch[] = [];

  for (const rule of RESOLVER_RULES) {
    const decision = rule.resolve(ctx);
    if (!decision || decision.status === "ask") continue;

    skipPaths.add(rule.path);

    pendingEntries.push({
      field_path: rule.path,
      resolved_status: decision.status,
      reasoning: decision.reasoning,
      resolved_at: "", // filled at commit time for atomic timestamp
      resolved_by: "ai_resolver",
    });

    if (decision.status === "normalized") {
      pendingValuePatches.push({
        path: rule.path,
        scalarValue: decision.canonicalValue,
        arrayPatches: decision.arrayPatches,
      });
    }
  }

  return { skipPaths, pendingEntries, pendingValuePatches };
}

// ─────────────────────────────────────────────────────────────────────────
// Commit helper — atomically apply patches + log to a draft record
// ─────────────────────────────────────────────────────────────────────────

type AnyRec = Record<string, unknown>;

function setByPath(root: AnyRec, path: string, value: unknown): void {
  const segs = path.split(".");
  let cur: AnyRec = root;
  for (let i = 0; i < segs.length - 1; i++) {
    const next = cur[segs[i]];
    if (next === null || typeof next !== "object" || Array.isArray(next)) return;
    cur = next as AnyRec;
  }
  cur[segs[segs.length - 1]] = value;
}

function getByPath(root: AnyRec, path: string): unknown {
  const segs = path.split(".");
  let cur: unknown = root;
  for (const s of segs) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as AnyRec)[s];
  }
  return cur;
}

/**
 * Apply resolver patches + log to draft IN PLACE. Returns timestamp used.
 * Caller is responsible for cloning the record first (no implicit clone).
 */
export function commitResolverOutput(
  draft: PkV10Record,
  output: ResolverOutput,
  timestamp: string,
): void {
  if (output.pendingEntries.length === 0 && output.pendingValuePatches.length === 0) {
    return;
  }

  // 1. Apply value patches
  for (const patch of output.pendingValuePatches) {
    if (patch.arrayPatches && patch.arrayPatches.length > 0) {
      const arr = getByPath(draft as unknown as AnyRec, patch.path);
      if (Array.isArray(arr)) {
        for (const ap of patch.arrayPatches) {
          const item = arr[ap.index];
          if (item && typeof item === "object") {
            (item as AnyRec)[ap.field] = ap.canonical;
          }
        }
      }
    } else if (patch.scalarValue !== undefined) {
      setByPath(draft as unknown as AnyRec, patch.path, patch.scalarValue);
    }
  }

  // 2. Append to _ai_resolver_log (root sidecar)
  const draftAny = draft as PkV10Record & {
    _ai_resolver_log?: AiResolverLogEntry[];
  };
  const existing = Array.isArray(draftAny._ai_resolver_log)
    ? [...draftAny._ai_resolver_log]
    : [];
  for (const entry of output.pendingEntries) {
    existing.push({ ...entry, resolved_at: timestamp });
  }
  draftAny._ai_resolver_log = existing;
}
