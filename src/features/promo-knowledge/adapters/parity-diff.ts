// @sunset-on-cutover
/**
 * Parity Diff Engine
 * ──────────────────
 * Pure, read-only field-level diff across three transformer outputs:
 *
 *   - preview   : what the Form Wizard JSON Preview shows (buildPKBPayload)
 *   - persisted : what storage writes to Supabase (toV31Row)
 *   - pk06      : candidate output from legacyFormToPK06Candidate
 *
 * Output is a flat table: one row per discovered field path with the three
 * column values + a status. No nested rendering. Sunset-friendly.
 */

export type ParityStatus =
  | "match"        // all three present and equal
  | "diff"         // present in 2+ but values differ
  | "preview_only"
  | "persisted_only"
  | "pk06_only"
  | "missing";     // none have it (shouldn't appear; defensive)

export interface ParityRow {
  path: string;
  preview: unknown;
  persisted: unknown;
  pk06: unknown;
  status: ParityStatus;
}

export interface ParitySummary {
  total: number;
  matches: number;
  diffs: number;
  previewOnly: number;
  persistedOnly: number;
  pk06Only: number;
}

export interface ParityResult {
  rows: ParityRow[];
  summary: ParitySummary;
}

const MAX_DEPTH = 6;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    Object.getPrototypeOf(v) === Object.prototype
  );
}

/** Recursively flatten an object into "a.b.c" → leaf-value pairs. Arrays are leaves. */
function flatten(input: unknown, prefix = "", depth = 0, out: Record<string, unknown> = {}) {
  if (depth > MAX_DEPTH || !isPlainObject(input)) {
    if (prefix) out[prefix] = input;
    return out;
  }
  const keys = Object.keys(input);
  if (keys.length === 0 && prefix) {
    out[prefix] = input;
    return out;
  }
  for (const k of keys) {
    const next = prefix ? `${prefix}.${k}` : k;
    const v = input[k];
    if (isPlainObject(v) && depth < MAX_DEPTH) {
      flatten(v, next, depth + 1, out);
    } else {
      out[next] = v;
    }
  }
  return out;
}

const PRESENT = Symbol("present");
const ABSENT = Symbol("absent");
type Cell = typeof PRESENT | typeof ABSENT;

function presence(map: Record<string, unknown>, key: string): Cell {
  return Object.prototype.hasOwnProperty.call(map, key) ? PRESENT : ABSENT;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((x, i) => valuesEqual(x, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every((k) => valuesEqual(a[k], b[k]));
  }
  // Numeric/string coercion is intentionally NOT done — strict.
  return false;
}

export function computeParity(
  preview: unknown,
  persisted: unknown,
  pk06: unknown,
): ParityResult {
  const fPrev = flatten(preview);
  const fPers = flatten(persisted);
  const fPk06 = flatten(pk06);

  const allKeys = new Set<string>([
    ...Object.keys(fPrev),
    ...Object.keys(fPers),
    ...Object.keys(fPk06),
  ]);

  const rows: ParityRow[] = [];
  let matches = 0;
  let diffs = 0;
  let previewOnly = 0;
  let persistedOnly = 0;
  let pk06Only = 0;

  for (const path of Array.from(allKeys).sort()) {
    const cPrev = presence(fPrev, path);
    const cPers = presence(fPers, path);
    const cPk = presence(fPk06, path);
    const presentCount =
      (cPrev === PRESENT ? 1 : 0) + (cPers === PRESENT ? 1 : 0) + (cPk === PRESENT ? 1 : 0);

    let status: ParityStatus = "missing";
    if (presentCount === 1) {
      if (cPrev === PRESENT) {
        status = "preview_only";
        previewOnly++;
      } else if (cPers === PRESENT) {
        status = "persisted_only";
        persistedOnly++;
      } else {
        status = "pk06_only";
        pk06Only++;
      }
    } else if (presentCount >= 2) {
      const presentVals: unknown[] = [];
      if (cPrev === PRESENT) presentVals.push(fPrev[path]);
      if (cPers === PRESENT) presentVals.push(fPers[path]);
      if (cPk === PRESENT) presentVals.push(fPk06[path]);
      const allEqual = presentVals.every((v) => valuesEqual(v, presentVals[0]));
      if (allEqual && presentCount === 3) {
        status = "match";
        matches++;
      } else {
        status = "diff";
        diffs++;
      }
    }

    rows.push({
      path,
      preview: cPrev === PRESENT ? fPrev[path] : undefined,
      persisted: cPers === PRESENT ? fPers[path] : undefined,
      pk06: cPk === PRESENT ? fPk06[path] : undefined,
      status,
    });
  }

  return {
    rows,
    summary: {
      total: rows.length,
      matches,
      diffs,
      previewOnly,
      persistedOnly,
      pk06Only,
    },
  };
}
