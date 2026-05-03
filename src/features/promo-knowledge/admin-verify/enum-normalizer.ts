/**
 * ENUM NORMALIZER — Pure post-extraction canonical mapping.
 *
 * SCOPE (locked):
 *   - Maps existing enum-like field VALUES to their canonical V10 form.
 *   - Pure functions on pkRecord field values. ZERO raw_content access.
 *   - ZERO reasoning, ZERO inference, ZERO question generation.
 *   - Never decides what to ASK — that is gap-reader.ts only.
 *
 * RETIREMENT NOTE:
 *   Replaces question-resolver.ts + resolver-rules.ts as part of the
 *   "Align at Source" cleanup. Authority for question generation now
 *   lives entirely in extractor JSON (_field_status) → gap-reader.ts.
 *
 *   Keyword-based rules (RULE_STACKING_POLICY, RULE_CLAIM_METHOD,
 *   RULE_MIN_DEPOSIT) and field-first ASK rules (RULE_PROVIDER_FIELD_FIRST,
 *   RULE_TURNOVER_FIELD_FIRST) are RETIRED. Their job is now done by the
 *   extractor populating _field_status; gap-reader reads that JSON truth.
 */

import type { PkV10Record } from "@/features/promo-knowledge/schema/pk-v10";

export type NormalizerStatus = "normalized";

export interface NormalizerLogEntry {
  field_path: string;
  resolved_status: NormalizerStatus;
  reasoning: string;
  resolved_at: string;
  resolved_by: "ai_resolver";
}

export interface NormalizerArrayPatch {
  index: number;
  field: string;
  canonical: string;
}

export interface NormalizerValuePatch {
  path: string;
  arrayPatches?: NormalizerArrayPatch[];
}

export interface NormalizerOutput {
  /** Audit entries to append to _ai_resolver_log on Apply. */
  pendingEntries: NormalizerLogEntry[];
  /** Deferred writes to apply on Apply. */
  pendingValuePatches: NormalizerValuePatch[];
}

// ─────────────────────────────────────────────────────────────────────────
// Canonical enum maps (pure value→value)
// ─────────────────────────────────────────────────────────────────────────

const VOID_TRIGGER_NORMALIZATION: Array<{ patterns: string[]; canonical: string }> = [
  { patterns: ["bonus hunter", "bonus_hunter", "bonushunter"], canonical: "bonus_hunter" },
  { patterns: ["kecurangan", "fraud", "fraud_detected", "deposit fraud", "deposit_fraud"], canonical: "deposit_fraud" },
  { patterns: ["multi accounting", "multi_accounting", "multi-account", "akun ganda"], canonical: "multi_accounting" },
  { patterns: ["safety bet", "safety_bet", "hedging"], canonical: "safety_bet" },
  { patterns: ["self referral", "self_referral", "referral diri sendiri"], canonical: "self_referral" },
];

const normalizeVoidTrigger = (raw: string): string | null => {
  const low = (raw ?? "").toLowerCase().trim();
  if (!low) return null;
  for (const { patterns, canonical } of VOID_TRIGGER_NORMALIZATION) {
    if (low === canonical) return null;
    if (patterns.some((p) => low === p || low.includes(p))) return canonical;
  }
  return null;
};

// ─────────────────────────────────────────────────────────────────────────
// Main entry — pure, no mutation
// ─────────────────────────────────────────────────────────────────────────

export function normalizeRecord(record: PkV10Record): NormalizerOutput {
  const pendingEntries: NormalizerLogEntry[] = [];
  const pendingValuePatches: NormalizerValuePatch[] = [];

  // Void condition trigger names
  const conds = record.invalidation_engine?.void_conditions_block ?? [];
  if (Array.isArray(conds) && conds.length > 0) {
    const patches: NormalizerArrayPatch[] = [];
    conds.forEach((c, i) => {
      const canonical = normalizeVoidTrigger((c as { trigger_name?: string })?.trigger_name ?? "");
      if (canonical && canonical !== (c as { trigger_name?: string })?.trigger_name) {
        patches.push({ index: i, field: "trigger_name", canonical });
      }
    });
    if (patches.length > 0) {
      pendingValuePatches.push({
        path: "invalidation_engine.void_conditions_block",
        arrayPatches: patches,
      });
      pendingEntries.push({
        field_path: "invalidation_engine.void_conditions_block",
        resolved_status: "normalized",
        reasoning: `Normalisasi ${patches.length} void trigger ke canonical enum V10 (${patches.map((p) => p.canonical).join(", ")}).`,
        resolved_at: "",
        resolved_by: "ai_resolver",
      });
    }
  }

  return { pendingEntries, pendingValuePatches };
}

// ─────────────────────────────────────────────────────────────────────────
// Commit helper — apply patches + audit log to draft IN PLACE
// ─────────────────────────────────────────────────────────────────────────

type AnyRec = Record<string, unknown>;

function getByPath(root: AnyRec, path: string): unknown {
  const segs = path.split(".");
  let cur: unknown = root;
  for (const s of segs) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as AnyRec)[s];
  }
  return cur;
}

export function commitNormalizerOutput(
  draft: PkV10Record,
  output: NormalizerOutput,
  timestamp: string,
): void {
  if (output.pendingEntries.length === 0 && output.pendingValuePatches.length === 0) return;

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
    }
  }

  const draftAny = draft as PkV10Record & { _ai_resolver_log?: NormalizerLogEntry[] };
  const existing = Array.isArray(draftAny._ai_resolver_log) ? [...draftAny._ai_resolver_log] : [];
  for (const entry of output.pendingEntries) {
    existing.push({ ...entry, resolved_at: timestamp });
  }
  draftAny._ai_resolver_log = existing;
}
