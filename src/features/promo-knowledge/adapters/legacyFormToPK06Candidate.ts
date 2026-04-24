// @sunset-on-cutover
/**
 * legacyFormToPK06Candidate
 * ─────────────────────────
 * READ-ONLY parity adapter. Maps a legacy PromoFormData (or PromoItem) into a
 * candidate PromoKnowledgeRecord (PK-06.0) for diff-only comparison.
 *
 * RULES (Gate 1.5 hardening):
 *   - No writes. No side effects. No storage. No events.
 *   - Output is NOT storage authority. Used only by the Parity tab.
 *   - Starts from createInertPromoKnowledgeRecord() and overlays only safe
 *     fields whose mapping is unambiguous (claim slice + identity + readiness).
 *   - When in doubt, leave the inert value alone (do not guess).
 *
 * SUNSET: This adapter exists temporarily until the legacy → PK-06 cutover is
 * signed off. See ./SUNSET.md.
 */

import type { PromoFormData } from "@/components/VOCDashboard/PromoFormWizard/types";
import { createInertPromoKnowledgeRecord } from "../schema/inert";
import {
  CLAIM_METHOD_ENUM,
  CLAIM_CHANNEL_ENUM,
  PROOF_TYPE_ENUM,
  PROOF_DESTINATION_ENUM,
  type ClaimMethod,
  type ClaimChannel,
  type ProofType,
  type ProofDestination,
  type PromoKnowledgeRecord,
} from "../schema/pk-06.0";

type AnyForm = Partial<PromoFormData> & Record<string, unknown> & { id?: string };

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asBool(v: unknown): boolean {
  return v === true;
}

function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function coerceClaimMethod(v: unknown): ClaimMethod {
  const s = asString(v).toLowerCase();
  // Best-effort safe mapping. Anything not in enum → "" (inert).
  if (s === "auto") return "auto";
  if (s === "manual" || s === "manual_livechat") return "manual_livechat";
  if (s === "manual_whatsapp") return "manual_whatsapp";
  if (s === "manual_telegram") return "manual_telegram";
  if (s === "in_app_button" || s === "in_app") return "in_app_button";
  if (s === "form_submission" || s === "form") return "form_submission";
  if (s === "cs_request" || s === "cs_approval") return "cs_approval";
  return (CLAIM_METHOD_ENUM as readonly string[]).includes(s) ? (s as ClaimMethod) : "";
}

function coerceChannels(v: unknown): ChannelArr {
  const allowed = new Set<string>(CLAIM_CHANNEL_ENUM as readonly string[]);
  return asArray<unknown>(v)
    .map((x) => asString(x).toLowerCase())
    .filter((x) => allowed.has(x)) as ChannelArr;
}
type ChannelArr = ClaimChannel[];

function coerceProofTypes(v: unknown): ProofType[] {
  const allowed = new Set<string>(PROOF_TYPE_ENUM as readonly string[]);
  return asArray<unknown>(v)
    .map((x) => asString(x).toLowerCase())
    .filter((x) => allowed.has(x)) as ProofType[];
}

function coerceProofDestinations(v: unknown): ProofDestination[] {
  const allowed = new Set<string>(PROOF_DESTINATION_ENUM as readonly string[]);
  return asArray<unknown>(v)
    .map((x) => asString(x).toLowerCase())
    .filter((x) => allowed.has(x)) as ProofDestination[];
}

/**
 * Build a candidate PK-06.0 record from a legacy form/draft.
 * Pure function — no IO, no globals.
 */
export function legacyFormToPK06Candidate(form: AnyForm): PromoKnowledgeRecord {
  const recordId = (form.id as string) || "candidate-preview";
  const base = createInertPromoKnowledgeRecord(recordId);

  // ── identity_engine (safe surface mapping only) ────────────────
  base.identity_engine = {
    client_block: {
      client_id: asString(form.client_id),
      client_id_field_status: asString(form.client_id) ? "set" : "",
      client_name: asString(form.client_name),
    },
    promo_block: {
      promo_name: asString(form.promo_name),
      promo_type: asString(form.promo_type),
      target_user: asString(form.target_segment),
      promo_mode: asString(form.reward_mode),
    },
  };

  // ── claim_engine (FIRST VERTICAL SLICE — fully typed) ──────────
  const channels = coerceChannels(form.claim_channels ?? form.claim_platform_list);
  const priorityRaw = coerceChannels(form.claim_priority_order);
  // priority_order MUST be subset of channels (validator enforces this) — drop
  // anything that isn't whitelisted by `channels`. If empty, leave as channels.
  const channelSet = new Set(channels);
  const priority_order = priorityRaw.filter((c) => channelSet.has(c));

  base.claim_engine = {
    method_block: {
      claim_method: coerceClaimMethod(form.claim_method),
      auto_credit: asBool(form.auto_credit),
    },
    channels_block: {
      channels,
      priority_order,
    },
    proof_requirement_block: {
      proof_required: asBool(form.proof_required),
      proof_types: coerceProofTypes(form.proof_types ?? form.proof_type),
      proof_destinations: coerceProofDestinations(
        form.proof_destinations ?? form.proof_destination,
      ),
    },
    instruction_block: {
      claim_steps: asArray<string>(form.claim_steps).filter((s) => typeof s === "string"),
      claim_url: asString(form.claim_url),
    },
  };

  // ── readiness_engine (state passthrough; default stays ai_draft) ─
  // We DO NOT promote state from legacy status — that's a cutover decision.
  // Status mirror only, observability stays inert.
  base.readiness_engine = {
    ...base.readiness_engine,
    validation_block: {
      is_structurally_complete: false,
      status: asString(form.status) === "active" ? "published" : "",
      warnings: [],
    },
  };

  return base;
}
