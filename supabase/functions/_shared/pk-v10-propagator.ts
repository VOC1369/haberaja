/**
 * STRUCTURAL POST-PASS PROPAGATOR (Single-Brain compliant)
 *
 * Scope: propagate `not_applicable` decisions ALREADY MADE by the LLM
 *        to structurally-related fields. Pure structural sweep.
 *
 * HARD LIMITS:
 *   - No raw_content access
 *   - No regex / keyword
 *   - No promo-type detection
 *   - No new applicability decisions from scratch
 *   - Never override "explicit" / "inferred" / "derived" / "propagated"
 *   - Only propagate from LLM-declared `not_applicable` anchors
 */

type FieldStatus =
  | "explicit"
  | "inferred"
  | "derived"
  | "propagated"
  | "not_stated"
  | "not_applicable";

type AnyRec = Record<string, unknown>;

// --------------------------------------------------------------
// Static mirror map: canonical path → projection_engine mirror(s)
// (Structural mapping only — no business semantics.)
// --------------------------------------------------------------
const MIRROR_MAP: Record<string, string[]> = {
  "taxonomy_engine.logic_block.turnover_basis": [
    "projection_engine.summary_block.turnover_basis",
    "projection_engine.summary_block.turnover_multiplier",
  ],
  "taxonomy_engine.logic_block.conversion_formula": [],
  "reward_engine.calculation_value": [
    "projection_engine.summary_block.main_reward_value",
    "projection_engine.summary_block.main_reward_percent",
  ],
  "reward_engine.calculation_unit": [
    "projection_engine.summary_block.main_reward_unit",
  ],
  "reward_engine.calculation_basis": [],
  "reward_engine.max_reward": [
    "projection_engine.summary_block.max_bonus",
  ],
  "reward_engine.requirement_block.min_deposit": [
    "projection_engine.summary_block.min_base",
  ],
  "reward_engine.payout_direction": [
    "projection_engine.summary_block.payout_direction",
  ],
};

// Mutually-exclusive reward shape blocks (structural, not semantic).
const REWARD_SHAPE_BLOCKS = [
  "reward_engine.combo_reward_block",
  "reward_engine.matrix_reward_block",
  "reward_engine.conditional_reward_block",
  "reward_engine.event_block",
  "reward_engine.reward_identity_block",
];

// --------------------------------------------------------------
// helpers
// --------------------------------------------------------------
function getAt(obj: unknown, path: string): unknown {
  const parts = path.split(/\.|\[|\]/).filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as AnyRec)[p];
  }
  return cur;
}

function isLeafEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function* leafPaths(
  obj: unknown,
  base: string,
): Generator<[string, unknown]> {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    yield [base, obj];
    return;
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      yield [base, obj];
      return;
    }
    for (let i = 0; i < obj.length; i++) {
      yield* leafPaths(obj[i], `${base}[${i}]`);
    }
    return;
  }
  const keys = Object.keys(obj as AnyRec).filter((k) => !k.startsWith("_"));
  if (keys.length === 0) {
    yield [base, obj];
    return;
  }
  for (const k of keys) {
    yield* leafPaths((obj as AnyRec)[k], base ? `${base}.${k}` : k);
  }
}

function isOverwritable(status: FieldStatus | undefined): boolean {
  // Only propagate INTO "not_stated" or unset entries.
  // NEVER touch explicit / inferred / derived / propagated / not_applicable.
  return status === undefined || status === "not_stated";
}

// --------------------------------------------------------------
// main
// --------------------------------------------------------------
export interface PropagationStats {
  mirror_promoted: number;
  block_promoted: number;
  shape_promoted: number;
  parent_anchored: number;
  parent_paths_promoted: string[];
}

export function propagateNotApplicable(
  record: AnyRec,
  fieldStatus: Record<string, FieldStatus>,
): { fieldStatus: Record<string, FieldStatus>; stats: PropagationStats } {
  const fs = { ...fieldStatus };
  const stats: PropagationStats = {
    mirror_promoted: 0,
    block_promoted: 0,
    shape_promoted: 0,
  };

  // (1) MIRROR PROPAGATION
  for (const [src, mirrors] of Object.entries(MIRROR_MAP)) {
    if (fs[src] !== "not_applicable") continue;
    for (const m of mirrors) {
      if (isOverwritable(fs[m])) {
        fs[m] = "not_applicable";
        stats.mirror_promoted++;
      }
    }
  }

  // (2) BLOCK PROPAGATION
  // If LLM marked a block path itself "not_applicable", cascade to its empty leaves.
  const naAnchors = Object.entries(fs)
    .filter(([, s]) => s === "not_applicable")
    .map(([p]) => p);
  for (const anchor of naAnchors) {
    const sub = getAt(record, anchor);
    if (sub === null || typeof sub !== "object" || Array.isArray(sub)) continue;
    for (const [path, val] of leafPaths(sub, anchor)) {
      if (path === anchor) continue;
      if (!isLeafEmpty(val)) continue;
      if (isOverwritable(fs[path])) {
        fs[path] = "not_applicable";
        stats.block_promoted++;
      }
    }
  }

  // (3) SHAPE EXCLUSIVITY (reward shapes only)
  const shapeInfo = REWARD_SHAPE_BLOCKS.map((b) => {
    const sub = getAt(record, b);
    let hasContent = false;
    if (sub !== undefined) {
      for (const [, v] of leafPaths(sub, b)) {
        if (!isLeafEmpty(v)) { hasContent = true; break; }
      }
    }
    return { block: b, hasContent, sub };
  });
  const anchorExists = shapeInfo.some((s) => s.hasContent);
  if (anchorExists) {
    for (const { block, hasContent, sub } of shapeInfo) {
      if (hasContent) continue;
      if (sub === undefined) continue;
      for (const [path, val] of leafPaths(sub, block)) {
        if (!isLeafEmpty(val)) continue;
        if (isOverwritable(fs[path])) {
          fs[path] = "not_applicable";
          stats.shape_promoted++;
        }
      }
    }
  }

  return { fieldStatus: fs, stats };
}
