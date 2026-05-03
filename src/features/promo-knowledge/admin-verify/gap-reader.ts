/**
 * GAP READER — pure JSON-driven question source
 *
 * Replaces the legacy `generateQuestions(record)` rule engine.
 *
 * DECISION RULES (locked):
 *   _field_status:
 *     explicit          → skip
 *     not_applicable    → skip
 *     derived           → skip
 *     propagated        → skip
 *     inferred          → confirm ONLY if accompanied by warning /
 *                         ambiguity / contradiction OR ai_confidence < 0.5
 *     not_stated        → ask
 *     (missing)         → ask  (treat absence as not_stated)
 *
 *   Sidecar flags (any path mentioned, even if status is explicit):
 *     _warnings[]            → confirm
 *     _ambiguity_flags[]     → ask
 *     _contradiction_flags[] → ask
 *
 *   ai_confidence: SECONDARY signal only. Never the primary driver.
 *     Used as a safety net (< 0.5) to upgrade an "inferred" field to confirm.
 *
 * HARD RULES:
 *   - No regex, no LLM, no per-promo branching, no template lookup
 *   - Pure function, never mutates record
 *   - Only emits questions for paths present in FIELD_REGISTRY (critical
 *     operational scope). Paths outside that scope are silently ignored.
 */

import type { PkV10Record } from "@/features/promo-knowledge/schema/pk-v10";
import { FIELD_REGISTRY_INDEX } from "./field-registry";

export type GapAction = "ask" | "confirm";
export type GapPriority = "blocker" | "confirm" | "optional";
export type GapSource =
  | "field_status"
  | "ambiguity_flag"
  | "warning"
  | "contradiction_flag";

export interface GapQuestion {
  path: string;
  action: GapAction;
  priority: GapPriority;
  reason: string;
  currentValue?: unknown;
  fieldStatus?: string;
  source: GapSource;
}

const VERY_LOW_CONFIDENCE = 0.5;

interface FlagEntry {
  path?: string;
  field_path?: string;
  reason?: string;
  message?: string;
}

const readFlagArray = (record: PkV10Record, key: string): FlagEntry[] => {
  const v = (record as unknown as Record<string, unknown>)[key];
  return Array.isArray(v) ? (v as FlagEntry[]) : [];
};

const flagPath = (f: FlagEntry): string | undefined => f.path ?? f.field_path;
const flagReason = (f: FlagEntry, fallback: string): string =>
  f.reason ?? f.message ?? fallback;

/**
 * Pure JSON gap reader. Returns a flat list of GapQuestions for paths
 * known to FIELD_REGISTRY. UI layer is free to group / sort.
 */
export function readGapsFromJson(record: PkV10Record): GapQuestion[] {
  if (!record) return [];

  const status = (record._field_status ?? {}) as Record<string, string>;
  const conf = (record.ai_confidence ?? {}) as Record<string, number>;

  const warnings = readFlagArray(record, "_warnings");
  const ambiguities = readFlagArray(record, "_ambiguity_flags");
  const contradictions = readFlagArray(record, "_contradiction_flags");

  // Bucket flags by path for O(1) lookup
  const warnByPath = new Map<string, FlagEntry>();
  for (const w of warnings) {
    const p = flagPath(w);
    if (p) warnByPath.set(p, w);
  }
  const ambByPath = new Map<string, FlagEntry>();
  for (const a of ambiguities) {
    const p = flagPath(a);
    if (p) ambByPath.set(p, a);
  }
  const contraByPath = new Map<string, FlagEntry>();
  for (const c of contradictions) {
    const p = flagPath(c);
    if (p) contraByPath.set(p, c);
  }

  const out: GapQuestion[] = [];

  for (const [path, entry] of FIELD_REGISTRY_INDEX) {
    const fStatus = status[path];
    const currentValue = entry.read(record);
    const fConf = conf[path];

    // 1. Contradiction — always ask, highest priority signal
    if (contraByPath.has(path)) {
      const c = contraByPath.get(path)!;
      out.push({
        path,
        action: "ask",
        priority: "blocker",
        reason: flagReason(c, "Contradiction terdeteksi pada field ini."),
        currentValue,
        fieldStatus: fStatus,
        source: "contradiction_flag",
      });
      continue;
    }

    // 2. Ambiguity — ask
    if (ambByPath.has(path)) {
      const a = ambByPath.get(path)!;
      out.push({
        path,
        action: "ask",
        priority: "blocker",
        reason: flagReason(a, "Ambiguity terdeteksi pada field ini."),
        currentValue,
        fieldStatus: fStatus,
        source: "ambiguity_flag",
      });
      continue;
    }

    // 3. Status-driven decisions
    switch (fStatus) {
      case "explicit":
      case "not_applicable":
      case "derived":
      case "propagated":
        // Warning still surfaces a confirm even on otherwise-resolved fields
        if (warnByPath.has(path)) {
          const w = warnByPath.get(path)!;
          out.push({
            path,
            action: "confirm",
            priority: "confirm",
            reason: flagReason(w, "Warning tercatat untuk field ini."),
            currentValue,
            fieldStatus: fStatus,
            source: "warning",
          });
        }
        continue;

      case "inferred": {
        const hasWarning = warnByPath.has(path);
        const veryLowConf =
          typeof fConf === "number" && fConf < VERY_LOW_CONFIDENCE;

        if (hasWarning) {
          const w = warnByPath.get(path)!;
          out.push({
            path,
            action: "confirm",
            priority: "confirm",
            reason: flagReason(w, "Inferred + warning → mohon konfirmasi."),
            currentValue,
            fieldStatus: fStatus,
            source: "warning",
          });
        } else if (veryLowConf) {
          out.push({
            path,
            action: "confirm",
            priority: "optional",
            reason: `Inferred dengan confidence sangat rendah (${fConf}).`,
            currentValue,
            fieldStatus: fStatus,
            source: "field_status",
          });
        }
        // inferred + no warning + confidence OK → skip
        continue;
      }

      case "not_stated":
      default:
        // not_stated OR missing status → ask
        out.push({
          path,
          action: "ask",
          priority: "blocker",
          reason:
            fStatus === "not_stated"
              ? "Field tidak disebutkan di sumber — admin perlu menentukan."
              : "Field belum memiliki status — admin perlu menentukan.",
          currentValue,
          fieldStatus: fStatus ?? "not_stated",
          source: "field_status",
        });
        continue;
    }
  }

  return out;
}
