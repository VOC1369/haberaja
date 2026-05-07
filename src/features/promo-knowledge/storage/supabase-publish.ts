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
 * publishRecord — gate then upsert into promo_knowledge keyed on record_id.
 */
export async function publishRecord(
  rec: PkV10Record,
  publishedBy?: string,
): Promise<PublishResult> {
  const gate = canPublish(rec);
  if (!gate.ok) return { ok: false, reasons: gate.reasons };

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
