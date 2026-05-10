/**
 * PR-20 — Admin-confirmed patch apply for canonical PkV10Record.
 *
 * Hard rules (do not relax without governance PR):
 *   - All-or-nothing apply. Any invalid patch in the batch → no mutation.
 *   - Input record is never mutated. Returns a deep-cloned updated record.
 *   - Path whitelist (SAFE_EDITABLE_PATH_RULES). Anything outside is rejected.
 *   - Operation whitelist per path.
 *   - Type/enum validation per path.
 *   - Forbidden paths (raw_content, schema, governance, readiness flags…)
 *     are rejected even if they slip into a "match" — defense in depth.
 *   - On success: appends to `_human_override_log`, sets
 *     `_field_status[path] = "explicit"`, bumps `updated_at`.
 *   - NEVER auto-clears warnings/contradictions/ambiguity flags.
 *   - NEVER touches `ready_to_commit`, `review_required`,
 *     `validation_block.status`, `validation_block.warnings`,
 *     `observability_block.contradiction_flags`,
 *     `observability_block.ambiguity_flags`, `meta_engine.*`,
 *     `record_id`, `domain`, `schema_version`, `created_at`,
 *     `ai_confidence`.
 *
 * No regex / keyword matching as business logic. Only structural validation
 * of patches that an admin has already approved on screen.
 */
import type { PkV10Record } from "../schema/pk-v10";
import type {
  JsonPatchOperation,
  JsonPatchPreview,
} from "./extractor-issue-adapter";

// ─────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────

export interface AppliedPatchSummary {
  target_path: string;
  operation: JsonPatchOperation;
  previous_value: unknown;
  new_value: unknown;
}

export interface ApplyAdminPatchInput {
  record: PkV10Record;
  /** Patches the admin saw and confirmed on screen (preview cards). */
  patches: JsonPatchPreview[];
  /** Whitelist already enforced by the resolver; re-enforced here. */
  allowedTargetPaths: string[];
  /** Audit only. */
  actor?: string;
  /** Audit only — who/what produced the patch. */
  source?: string;
  /** Audit only — admin-facing reason. */
  reason?: string;
}

export interface ApplyAdminPatchResult {
  ok: boolean;
  record?: PkV10Record;
  errors?: string[];
  applied_patches?: AppliedPatchSummary[];
}

// ─────────────────────────────────────────────────────────────────────────
// Path rule registry
// ─────────────────────────────────────────────────────────────────────────

type Validator = (value: unknown) => string | null; // returns error or null

interface PathRule {
  /** Either a literal dotted path or a regex matching with `[idx]`. */
  match: { kind: "literal"; path: string } | { kind: "regex"; re: RegExp };
  allowedOps: ReadonlySet<JsonPatchOperation>;
  /** Validator for `set_value` new value. */
  setValueValidator?: Validator;
  /** Validator for `replace_text_in_array` new string. */
  replaceTextValidator?: Validator;
}

const RULE_TYPE_ENUM = new Set([
  "simple",
  "compound",
  "sequential",
  "conditional",
  "threshold",
  "recurring",
]);

const TURNOVER_FORMAT_ENUM = new Set(["multiplier", "min_rupiah"]);

const enumValidator = (allowed: Set<string>): Validator => (v) => {
  if (typeof v !== "string") return "value must be string";
  if (!allowed.has(v)) return `value must be one of: ${[...allowed].join(", ")}`;
  return null;
};

const currencyValidator: Validator = (v) => {
  if (v === null) return null;
  if (typeof v !== "string") return "currency must be string or null";
  if (v.length === 0) return null;
  if (!/^[A-Z]{3}$/.test(v)) return "currency must be 3-letter ISO code (uppercase)";
  return null;
};

const nonEmptyStringValidator: Validator = (v) => {
  if (typeof v !== "string" || v.trim().length === 0) {
    return "value must be a non-empty string";
  }
  return null;
};

/**
 * SAFE EDITABLE PATHS for PR-20.
 * Sensitive readiness flags are intentionally NOT included — they belong
 * to a future Review Resolution PR.
 */
export const SAFE_EDITABLE_PATH_RULES: PathRule[] = [
  {
    match: { kind: "literal", path: "trigger_engine.trigger_rule_block.rule_type" },
    allowedOps: new Set(["set_value"]),
    setValueValidator: enumValidator(RULE_TYPE_ENUM),
  },
  {
    match: {
      kind: "regex",
      re: /^variant_engine\.items_block\.subcategories\[\d+\]\.turnover_rule_format$/,
    },
    allowedOps: new Set(["set_value"]),
    setValueValidator: enumValidator(TURNOVER_FORMAT_ENUM),
  },
  {
    match: { kind: "literal", path: "reward_engine.currency" },
    allowedOps: new Set(["set_value"]),
    setValueValidator: currencyValidator,
  },
  {
    match: { kind: "literal", path: "terms_engine.conditions_block.terms_conditions" },
    allowedOps: new Set(["replace_text_in_array"]),
    replaceTextValidator: nonEmptyStringValidator,
  },
];

/**
 * Forbidden path prefixes — defense in depth. A path that starts with any of
 * these is rejected even if some future rule accidentally matches.
 */
const FORBIDDEN_PATH_PREFIXES: readonly string[] = [
  "meta_engine.source_block.raw_content",
  "meta_engine.schema_block",
  "record_id",
  "domain",
  "schema_version",
  "created_at",
  "ai_confidence",
  "_field_status",
  "_human_override_log",
  "readiness_engine.commit_block.ready_to_commit",
  "readiness_engine.observability_block.review_required",
  "readiness_engine.observability_block.contradiction_flags",
  "readiness_engine.observability_block.ambiguity_flags",
  "readiness_engine.validation_block.warnings",
  "readiness_engine.validation_block.status",
];

function isForbidden(path: string): boolean {
  return FORBIDDEN_PATH_PREFIXES.some(
    (p) => path === p || path.startsWith(p + ".") || path.startsWith(p + "["),
  );
}

function findRule(path: string): PathRule | null {
  for (const r of SAFE_EDITABLE_PATH_RULES) {
    if (r.match.kind === "literal" && r.match.path === path) return r;
    if (r.match.kind === "regex" && r.match.re.test(path)) return r;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Path traversal — supports `a.b[0].c`
// ─────────────────────────────────────────────────────────────────────────

type Seg = { kind: "key"; key: string } | { kind: "index"; idx: number };

function parsePath(path: string): Seg[] | null {
  const segs: Seg[] = [];
  let i = 0;
  while (i < path.length) {
    if (path[i] === ".") {
      i++;
      continue;
    }
    if (path[i] === "[") {
      const close = path.indexOf("]", i);
      if (close < 0) return null;
      const num = path.slice(i + 1, close);
      if (!/^\d+$/.test(num)) return null;
      segs.push({ kind: "index", idx: Number(num) });
      i = close + 1;
      continue;
    }
    let j = i;
    while (j < path.length && path[j] !== "." && path[j] !== "[") j++;
    const key = path.slice(i, j);
    if (key.length === 0) return null;
    segs.push({ kind: "key", key });
    i = j;
  }
  return segs;
}

function readByPath(root: unknown, segs: Seg[]): { ok: boolean; value: unknown } {
  let cur: unknown = root;
  for (const s of segs) {
    if (cur === null || cur === undefined) return { ok: false, value: undefined };
    if (s.kind === "key") {
      if (typeof cur !== "object") return { ok: false, value: undefined };
      cur = (cur as Record<string, unknown>)[s.key];
    } else {
      if (!Array.isArray(cur)) return { ok: false, value: undefined };
      if (s.idx < 0 || s.idx >= cur.length) return { ok: false, value: undefined };
      cur = cur[s.idx];
    }
  }
  return { ok: true, value: cur };
}

/**
 * Write into a deeply cloned object. Refuses to create new branches when
 * a parent is missing (returns false). The root must be an already-cloned
 * mutable object owned by the caller.
 */
function writeByPath(root: unknown, segs: Seg[], value: unknown): boolean {
  if (segs.length === 0) return false;
  let cur: unknown = root;
  for (let k = 0; k < segs.length - 1; k++) {
    const s = segs[k];
    if (cur === null || cur === undefined) return false;
    if (s.kind === "key") {
      if (typeof cur !== "object") return false;
      const next = (cur as Record<string, unknown>)[s.key];
      if (next === undefined || next === null) return false;
      cur = next;
    } else {
      if (!Array.isArray(cur)) return false;
      if (s.idx < 0 || s.idx >= cur.length) return false;
      cur = cur[s.idx];
    }
  }
  const last = segs[segs.length - 1];
  if (cur === null || cur === undefined) return false;
  if (last.kind === "key") {
    if (typeof cur !== "object") return false;
    (cur as Record<string, unknown>)[last.key] = value;
    return true;
  }
  if (!Array.isArray(cur)) return false;
  if (last.idx < 0 || last.idx >= cur.length) return false;
  cur[last.idx] = value;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────

interface ValidatedPatch {
  patch: JsonPatchPreview;
  segs: Seg[];
  rule: PathRule;
  previous: unknown;
  /** For replace_text_in_array: index of item to replace. */
  arrayItemIndex?: number;
}

function validatePatch(
  record: PkV10Record,
  patch: JsonPatchPreview,
  allowedSet: Set<string>,
): { ok: true; v: ValidatedPatch } | { ok: false; error: string } {
  const path = patch.target_path;
  if (!path || typeof path !== "string") {
    return { ok: false, error: "patch.target_path is required" };
  }
  if (isForbidden(path)) {
    return { ok: false, error: `target_path is forbidden: ${path}` };
  }
  if (!allowedSet.has(path)) {
    return { ok: false, error: `target_path not in allowedTargetPaths: ${path}` };
  }
  const rule = findRule(path);
  if (!rule) {
    return { ok: false, error: `target_path not in safe editable registry: ${path}` };
  }
  if (!rule.allowedOps.has(patch.operation)) {
    return {
      ok: false,
      error: `operation '${patch.operation}' not allowed for ${path}`,
    };
  }
  const segs = parsePath(path);
  if (!segs) return { ok: false, error: `unparseable target_path: ${path}` };

  const read = readByPath(record, segs);
  if (!read.ok) {
    return { ok: false, error: `target_path does not exist in record: ${path}` };
  }

  if (patch.operation === "set_value") {
    const validator = rule.setValueValidator;
    if (validator) {
      const err = validator(patch.new_value_preview);
      if (err) return { ok: false, error: `${path}: ${err}` };
    }
    return {
      ok: true,
      v: { patch, segs, rule, previous: read.value },
    };
  }

  if (patch.operation === "replace_text_in_array") {
    if (!Array.isArray(read.value)) {
      return { ok: false, error: `${path}: target is not an array` };
    }
    const arr = read.value as unknown[];
    if (!arr.every((x) => typeof x === "string")) {
      return { ok: false, error: `${path}: array must contain only strings` };
    }
    const validator = rule.replaceTextValidator;
    if (validator) {
      const err = validator(patch.new_value_preview);
      if (err) return { ok: false, error: `${path}: ${err}` };
    }
    if (typeof patch.old_value_preview !== "string") {
      return { ok: false, error: `${path}: old_value_preview must be string` };
    }
    const idx = (arr as string[]).indexOf(patch.old_value_preview);
    if (idx < 0) {
      return {
        ok: false,
        error: `${path}: old_value_preview not found in array`,
      };
    }
    return {
      ok: true,
      v: { patch, segs, rule, previous: arr[idx], arrayItemIndex: idx },
    };
  }

  // append_note / mark_manual_review_needed are NOT enabled for any path
  // in PR-20. Reject explicitly.
  return {
    ok: false,
    error: `operation '${patch.operation}' not enabled in PR-20`,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Apply
// ─────────────────────────────────────────────────────────────────────────

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

export function applyAdminPatchPreviewToPkRecord(
  input: ApplyAdminPatchInput,
): ApplyAdminPatchResult {
  const {
    record,
    patches,
    allowedTargetPaths,
    actor = "admin",
    source = "admin_verify_llm_patch_preview",
    reason,
  } = input;

  if (!Array.isArray(patches) || patches.length === 0) {
    return { ok: false, errors: ["no patches to apply"] };
  }

  const allowedSet = new Set(allowedTargetPaths);

  // Phase 1 — validate ALL patches first. All-or-nothing.
  const validated: ValidatedPatch[] = [];
  const errors: string[] = [];
  for (const p of patches) {
    const r = validatePatch(record, p, allowedSet);
    if (r.ok === false) errors.push(r.error);
    else validated.push(r.v);
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Phase 2 — clone record once and apply patches into the clone.
  const clone = JSON.parse(JSON.stringify(record)) as PkV10Record;
  const cloneAny = clone as PkV10Record & {
    _human_override_log?: HumanOverrideEntry[];
  };

  const fieldStatus: Record<string, string> = {
    ...(clone._field_status as Record<string, string> | undefined ?? {}),
  };
  const aiConf = (clone.ai_confidence ?? {}) as Record<string, unknown>;
  const log: HumanOverrideEntry[] = Array.isArray(cloneAny._human_override_log)
    ? [...cloneAny._human_override_log]
    : [];
  const ts = new Date().toISOString();
  const applied: AppliedPatchSummary[] = [];

  for (const v of validated) {
    const path = v.patch.target_path;
    let ok = false;
    let newValue: unknown;

    if (v.patch.operation === "set_value") {
      newValue = v.patch.new_value_preview;
      ok = writeByPath(clone, v.segs, newValue);
    } else if (v.patch.operation === "replace_text_in_array") {
      // Re-read from clone (after previous patches in batch).
      const read = readByPath(clone, v.segs);
      if (!read.ok || !Array.isArray(read.value)) {
        return { ok: false, errors: [`${path}: target became invalid mid-apply`] };
      }
      const arr = read.value as string[];
      const idx = arr.indexOf(v.patch.old_value_preview as string);
      if (idx < 0) {
        return {
          ok: false,
          errors: [`${path}: old_value_preview no longer present`],
        };
      }
      arr[idx] = v.patch.new_value_preview as string;
      newValue = arr[idx];
      ok = true;
    }

    if (!ok) {
      return { ok: false, errors: [`${path}: write failed`] };
    }

    const prevStatus =
      typeof fieldStatus[path] === "string" ? (fieldStatus[path] as string) : null;
    const prevConfRaw = aiConf[path];
    const prevConf = typeof prevConfRaw === "number" ? prevConfRaw : null;

    const entry: HumanOverrideEntry = {
      field_path: path,
      previous_value: v.previous ?? null,
      new_value: newValue ?? null,
      previous_field_status: prevStatus,
      previous_ai_confidence: prevConf,
      overridden_by: actor,
      timestamp: ts,
      source,
    };
    if (reason && reason.trim()) entry.reason = reason.trim();
    else if (v.patch.reason && v.patch.reason.trim()) {
      entry.reason = v.patch.reason.trim();
    }
    log.push(entry);

    fieldStatus[path] = "explicit";
    applied.push({
      target_path: path,
      operation: v.patch.operation,
      previous_value: v.previous ?? null,
      new_value: newValue ?? null,
    });
  }

  clone._field_status = fieldStatus;
  cloneAny._human_override_log = log;
  clone.updated_at = ts;
  // created_at intentionally left untouched.

  return { ok: true, record: clone, applied_patches: applied };
}
