/**
 * Phase 3B — Promo Knowledge V.10.1 Supabase Publish Module
 *
 * Active table: public.promo_knowledge
 * Source of truth: record_json (FULL PkV10Record V.10.1)
 * Metadata columns: filter/list/search/status only.
 *
 * Rules:
 *  - Use @/integrations/supabase/client (NOT @/lib/supabase-client)
 *  - Never write to legacy promo_kb / promo_kb_audit_log
 *  - Never normalize readiness state, never flatten record_json
 */

import { supabase } from "@/integrations/supabase/client";
import {
  PK_V10_SCHEMA_VERSION,
  type PkV10Record,
} from "@/features/promo-knowledge/schema/pk-v10";

export interface CanPublishResult {
  ok: boolean;
  reasons: string[];
}

export interface PromoKnowledgeMetadata {
  record_id: string;
  client_id: string;
  client_name: string;
  promo_name: string;
  promo_type: string;
  promo_mode: string;
  schema_name: string;
  schema_version: string;
  state: string;
  validation_status: string;
  review_required: boolean;
}

export interface PublishResult {
  ok: boolean;
  reasons?: string[];
  error?: string;
  data?: unknown;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const nonEmptyString = (v: unknown): boolean =>
  typeof v === "string" && v.trim().length > 0;

/**
 * canPublish — runtime minimum invariant gate.
 * Does NOT import PR-13 helper. Self-contained.
 */
export function canPublish(rec: unknown): CanPublishResult {
  const reasons: string[] = [];

  if (!isObj(rec)) {
    return { ok: false, reasons: ["record is missing or not an object"] };
  }

  const r = rec as Record<string, unknown>;

  // record_id
  if (!nonEmptyString(r.record_id)) reasons.push("record_id missing");

  // identity_engine
  const identity = r.identity_engine as Record<string, unknown> | undefined;
  const clientBlock = identity?.client_block as Record<string, unknown> | undefined;
  const promoBlock = identity?.promo_block as Record<string, unknown> | undefined;

  if (!nonEmptyString(clientBlock?.client_id)) {
    reasons.push("identity_engine.client_block.client_id missing");
  }
  if (!nonEmptyString(promoBlock?.promo_name)) {
    reasons.push("identity_engine.promo_block.promo_name missing");
  }

  // meta_engine.schema_block.schema_version
  const meta = r.meta_engine as Record<string, unknown> | undefined;
  const schemaBlock = meta?.schema_block as Record<string, unknown> | undefined;
  if (schemaBlock?.schema_version !== PK_V10_SCHEMA_VERSION) {
    reasons.push(
      `meta_engine.schema_block.schema_version must be "${PK_V10_SCHEMA_VERSION}"`,
    );
  }

  // meta_engine.source_block.raw_content
  const sourceBlock = meta?.source_block as Record<string, unknown> | undefined;
  if (!nonEmptyString(sourceBlock?.raw_content)) {
    reasons.push("meta_engine.source_block.raw_content missing or empty");
  }

  // variant_engine
  if (!isObj(r.variant_engine)) reasons.push("variant_engine missing");

  // _field_status
  if (!isObj(r._field_status)) reasons.push("_field_status missing");

  // ai_confidence
  if (!isObj(r.ai_confidence)) reasons.push("ai_confidence missing");

  // readiness_engine gates
  const readiness = r.readiness_engine as Record<string, unknown> | undefined;
  const observability = readiness?.observability_block as
    | Record<string, unknown>
    | undefined;
  const validation = readiness?.validation_block as
    | Record<string, unknown>
    | undefined;
  const commit = readiness?.commit_block as Record<string, unknown> | undefined;

  if (observability?.review_required === true) {
    reasons.push("readiness_engine.observability_block.review_required is true");
  }
  if (validation?.status === "needs_review") {
    reasons.push(
      'readiness_engine.validation_block.status is "needs_review"',
    );
  }
  if (commit?.ready_to_commit === false) {
    reasons.push("readiness_engine.commit_block.ready_to_commit is false");
  }

  return { ok: reasons.length === 0, reasons };
}

/**
 * extractPromoKnowledgeMetadata — pulls the metadata columns from the
 * canonical V.10.1 paths. Does NOT mutate the record.
 */
export function extractPromoKnowledgeMetadata(
  rec: PkV10Record,
): PromoKnowledgeMetadata {
  const r = rec as unknown as Record<string, unknown>;
  const identity = (r.identity_engine ?? {}) as Record<string, unknown>;
  const clientBlock = (identity.client_block ?? {}) as Record<string, unknown>;
  const promoBlock = (identity.promo_block ?? {}) as Record<string, unknown>;
  const meta = (r.meta_engine ?? {}) as Record<string, unknown>;
  const schemaBlock = (meta.schema_block ?? {}) as Record<string, unknown>;
  const readiness = (r.readiness_engine ?? {}) as Record<string, unknown>;
  const stateBlock = (readiness.state_block ?? {}) as Record<string, unknown>;
  const validationBlock = (readiness.validation_block ?? {}) as Record<
    string,
    unknown
  >;
  const observabilityBlock = (readiness.observability_block ?? {}) as Record<
    string,
    unknown
  >;

  return {
    record_id: String(r.record_id ?? ""),
    client_id: String(clientBlock.client_id ?? ""),
    client_name: String(clientBlock.client_name ?? ""),
    promo_name: String(promoBlock.promo_name ?? ""),
    promo_type: String(promoBlock.promo_type ?? ""),
    promo_mode: String(promoBlock.promo_mode ?? ""),
    schema_name: String(schemaBlock.schema_name ?? ""),
    schema_version: String(schemaBlock.schema_version ?? ""),
    state: String(stateBlock.state ?? ""),
    validation_status: String(validationBlock.status ?? ""),
    review_required: Boolean(observabilityBlock.review_required),
  };
}

/**
 * PR-21 — Structural Supabase write gate.
 *
 * Answers: "Is this record structurally safe to write to promo_knowledge?"
 *
 * Hard structural blockers ONLY. Does NOT consider:
 *   - readiness_engine.observability_block.review_required
 *   - readiness_engine.commit_block.ready_to_commit
 *   - readiness_engine.validation_block.status === "needs_review"
 *   - validation_block.warnings
 *   - observability_block.ambiguity_flags
 *   - observability_block.contradiction_flags
 *
 * Those belong to the (display-only) Review Issues summary — admin
 * must acknowledge them, but they do NOT block writing to Supabase.
 */
export function canWriteToSupabase(rec: unknown): CanPublishResult {
  const reasons: string[] = [];

  if (!isObj(rec)) {
    return { ok: false, reasons: ["record is missing or not an object"] };
  }

  const r = rec as Record<string, unknown>;

  if (!nonEmptyString(r.record_id)) reasons.push("record_id missing");

  const identity = r.identity_engine as Record<string, unknown> | undefined;
  if (!isObj(identity)) reasons.push("identity_engine missing");
  const clientBlock = identity?.client_block as Record<string, unknown> | undefined;
  const promoBlock = identity?.promo_block as Record<string, unknown> | undefined;

  if (!nonEmptyString(clientBlock?.client_id)) {
    reasons.push("identity_engine.client_block.client_id missing");
  }
  if (!nonEmptyString(promoBlock?.promo_name)) {
    reasons.push("identity_engine.promo_block.promo_name missing");
  }

  const meta = r.meta_engine as Record<string, unknown> | undefined;
  const schemaBlock = meta?.schema_block as Record<string, unknown> | undefined;
  if (!isObj(schemaBlock)) reasons.push("meta_engine.schema_block missing");
  if (schemaBlock?.schema_version !== PK_V10_SCHEMA_VERSION) {
    reasons.push(
      `meta_engine.schema_block.schema_version must be "${PK_V10_SCHEMA_VERSION}"`,
    );
  }

  const sourceBlock = meta?.source_block as Record<string, unknown> | undefined;
  if (!nonEmptyString(sourceBlock?.raw_content)) {
    reasons.push("meta_engine.source_block.raw_content missing or empty");
  }

  if (!isObj(r.variant_engine)) reasons.push("variant_engine missing");
  if (!isObj(r._field_status)) reasons.push("_field_status missing");
  if (!isObj(r.ai_confidence)) reasons.push("ai_confidence missing");

  return { ok: reasons.length === 0, reasons };
}

export interface PublishReviewIssues {
  hasIssues: boolean;
  issues: string[];
  summary: string;
  counts: {
    warnings: number;
    ambiguity: number;
    contradictions: number;
  };
  reviewRequired: boolean;
  readyToCommit: boolean;
  validationStatus: string;
  warnings: string[];
  ambiguity: string[];
  contradictions: string[];
}

/**
 * PR-21 — Display-only review issue summary. Pure read, no regex,
 * no word matching, no mutation. Just surfaces extractor flags and
 * readiness booleans so the admin can acknowledge risk before publish.
 */
export function getPublishReviewIssues(rec: unknown): PublishReviewIssues {
  const empty: PublishReviewIssues = {
    hasIssues: false,
    issues: [],
    summary: "Tidak ada catatan review.",
    counts: { warnings: 0, ambiguity: 0, contradictions: 0 },
    reviewRequired: false,
    readyToCommit: true,
    validationStatus: "",
    warnings: [],
    ambiguity: [],
    contradictions: [],
  };
  if (!isObj(rec)) return empty;

  const readiness = (rec as Record<string, unknown>).readiness_engine as
    | Record<string, unknown>
    | undefined;
  const obs = (readiness?.observability_block ?? {}) as Record<string, unknown>;
  const val = (readiness?.validation_block ?? {}) as Record<string, unknown>;
  const commit = (readiness?.commit_block ?? {}) as Record<string, unknown>;

  const warnings = Array.isArray(val.warnings) ? (val.warnings as string[]) : [];
  const ambiguity = Array.isArray(obs.ambiguity_flags)
    ? (obs.ambiguity_flags as string[])
    : [];
  const contradictions = Array.isArray(obs.contradiction_flags)
    ? (obs.contradiction_flags as string[])
    : [];
  const reviewRequired = obs.review_required === true;
  const readyToCommit = commit.ready_to_commit === true;
  const validationStatus = typeof val.status === "string" ? (val.status as string) : "";

  const issues: string[] = [];
  if (reviewRequired) issues.push("Promo masih perlu review manual.");
  if (!readyToCommit) issues.push("Promo belum ditandai siap publish.");
  if (validationStatus === "needs_review") {
    issues.push("Status validasi masih needs_review.");
  }
  if (warnings.length > 0) issues.push(`Masih ada ${warnings.length} warning dari extractor.`);
  if (ambiguity.length > 0) issues.push(`Masih ada ${ambiguity.length} ambiguity dari extractor.`);
  if (contradictions.length > 0) {
    issues.push(`Masih ada ${contradictions.length} contradiction dari extractor.`);
  }

  const hasIssues = issues.length > 0;
  return {
    hasIssues,
    issues,
    summary: hasIssues
      ? "Promo masih memiliki catatan review yang perlu diperhatikan."
      : "Tidak ada catatan review.",
    counts: {
      warnings: warnings.length,
      ambiguity: ambiguity.length,
      contradictions: contradictions.length,
    },
    reviewRequired,
    readyToCommit,
    validationStatus,
    warnings,
    ambiguity,
    contradictions,
  };
}

export interface PublishOptions {
  /**
   * PR-21 — Admin has acknowledged the (display-only) review issues
   * surfaced via getPublishReviewIssues. When true, publish proceeds
   * with the structural gate only. When false (default) and the record
   * has review issues, publish is blocked with reason
   * "admin acknowledgement required".
   *
   * The strict canPublish gate is NOT used by this code path.
   */
  adminAcknowledgedReviewIssues?: boolean;
}

/**
 * publishRecord — Backwards-compatible publish.
 *
 * Default behaviour (no options) preserves the historical strict gate
 * (canPublish) so existing tests/callers keep working.
 *
 * PR-21 callers should pass `{ adminAcknowledgedReviewIssues: true }`
 * to publish with review issues present. In that mode, the structural
 * gate (canWriteToSupabase) is used and review issues are NOT blockers.
 */
export async function publishRecord(
  rec: PkV10Record,
  publishedBy?: string,
  options?: PublishOptions,
): Promise<PublishResult> {
  if (options && options.adminAcknowledgedReviewIssues !== undefined) {
    const structural = canWriteToSupabase(rec);
    if (!structural.ok) return { ok: false, reasons: structural.reasons };

    const review = getPublishReviewIssues(rec);
    if (review.hasIssues && options.adminAcknowledgedReviewIssues !== true) {
      return {
        ok: false,
        reasons: ["admin acknowledgement required for review issues", ...review.issues],
      };
    }
  } else {
    const gate = canPublish(rec);
    if (!gate.ok) return { ok: false, reasons: gate.reasons };
  }

  const meta = extractPromoKnowledgeMetadata(rec);
  const nowIso = new Date().toISOString();

  const row = {
    ...meta,
    is_published: true,
    record_json: rec as unknown as import("@/integrations/supabase/types").Json,
    published_at: nowIso,
    published_by: publishedBy ?? null,
  };

  const { data, error } = await supabase
    .from("promo_knowledge")
    .upsert([row], { onConflict: "record_id" })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

/**
 * unpublishRecord — flips is_published to false. Does not delete record_json.
 */
export async function unpublishRecord(
  recordId: string,
): Promise<PublishResult> {
  if (!nonEmptyString(recordId)) {
    return { ok: false, error: "recordId missing" };
  }

  const { data, error } = await supabase
    .from("promo_knowledge")
    .update({ is_published: false })
    .eq("record_id", recordId)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}
