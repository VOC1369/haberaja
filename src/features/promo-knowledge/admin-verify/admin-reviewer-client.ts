/**
 * Admin Reviewer — Client
 *
 * Responsibilities:
 *   1. Extract reviewer signals from a PkV10Record (read-only).
 *   2. Build a deterministic cache signature for signals.
 *   3. Read / write cached AdminReviewerResponse in localStorage
 *      under `admin_decisions:${record_id}:${signature}`.
 *   4. Invoke the `admin-reviewer` edge function with the user's auth session.
 *
 * Hard rules:
 *   - Never mutate `PkV10Record`. Cache lives in a separate namespace.
 *   - No fallback to local grouping on error — surface the envelope.
 *   - Signature is for cache-key stability only, NOT security.
 */

import { supabase } from "@/integrations/supabase/client";
import type { PkV10Record } from "../schema/pk-v10";
import type {
  AdminReviewerContext,
  AdminReviewerRequest,
  AdminReviewerResponse,
  AdminReviewerSignals,
} from "./admin-decision-types";

const SUPABASE_URL = (import.meta as unknown as { env: Record<string, string> })
  .env?.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = (import.meta as unknown as { env: Record<string, string> })
  .env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const CACHE_PREFIX = "admin_decisions";
const MAX_RAW_EXCERPT = 2000;

// ---------------------------------------------------------------------------
// Signal extraction
// ---------------------------------------------------------------------------

export function extractAdminReviewerSignals(
  record: PkV10Record | null | undefined,
): AdminReviewerSignals {
  const re = record?.readiness_engine;
  const warnings = re?.validation_block?.warnings ?? [];
  const ambiguity = re?.observability_block?.ambiguity_flags ?? [];
  const contradiction = re?.observability_block?.contradiction_flags ?? [];
  return {
    warnings: Array.isArray(warnings) ? warnings.filter(isNonEmptyString) : [],
    ambiguity_flags: Array.isArray(ambiguity)
      ? ambiguity.filter(isNonEmptyString)
      : [],
    contradiction_flags: Array.isArray(contradiction)
      ? contradiction.filter(isNonEmptyString)
      : [],
  };
}

export function countSignals(s: AdminReviewerSignals): number {
  return (
    s.warnings.length + s.ambiguity_flags.length + s.contradiction_flags.length
  );
}

export function extractAdminReviewerContext(
  record: PkV10Record | null | undefined,
): AdminReviewerContext {
  if (!record) return {};
  const promo = record.identity_engine?.promo_block;
  const raw = record.meta_engine?.source_block?.raw_content ?? "";
  const variants = summarizeVariants(record);
  return {
    promo_name: promo?.promo_name || undefined,
    promo_type: promo?.promo_type || undefined,
    variants_summary: variants || undefined,
    raw_content_excerpt: raw ? raw.slice(0, MAX_RAW_EXCERPT) : undefined,
  };
}

function summarizeVariants(record: PkV10Record): string {
  try {
    const tv = (record as unknown as {
      time_window_engine?: {
        schedule_variant_block?: { variants?: Array<{ label?: string }> };
      };
    }).time_window_engine?.schedule_variant_block?.variants;
    if (Array.isArray(tv) && tv.length > 0) {
      return tv
        .map((v, i) => v?.label || `variant_${i + 1}`)
        .slice(0, 12)
        .join(", ");
    }
  } catch {
    /* ignore */
  }
  return "";
}

// ---------------------------------------------------------------------------
// Signature (deterministic, not security-grade)
// ---------------------------------------------------------------------------

/** Deterministic FNV-1a 32-bit hex over canonical signal payload. */
export function signalsSignature(signals: AdminReviewerSignals): string {
  const canonical = JSON.stringify({
    w: [...signals.warnings].sort(),
    a: [...signals.ambiguity_flags].sort(),
    c: [...signals.contradiction_flags].sort(),
  });
  return fnv1aHex(canonical);
}

function fnv1aHex(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// ---------------------------------------------------------------------------
// Cache (localStorage)
// ---------------------------------------------------------------------------

export function cacheKey(recordId: string, signature: string): string {
  return `${CACHE_PREFIX}:${recordId}:${signature}`;
}

function safeStorage(): Storage | null {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    /* SSR / restricted */
  }
  return null;
}

export function loadCached(
  recordId: string,
  signature: string,
): AdminReviewerResponse | null {
  const ls = safeStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(cacheKey(recordId, signature));
    if (!raw) return null;
    return JSON.parse(raw) as AdminReviewerResponse;
  } catch {
    return null;
  }
}

export function saveCached(
  recordId: string,
  signature: string,
  response: AdminReviewerResponse,
): void {
  const ls = safeStorage();
  if (!ls) return;
  try {
    ls.setItem(cacheKey(recordId, signature), JSON.stringify(response));
  } catch {
    /* quota — ignore */
  }
}

export function clearCached(recordId: string, signature: string): void {
  const ls = safeStorage();
  if (!ls) return;
  try {
    ls.removeItem(cacheKey(recordId, signature));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Invoke
// ---------------------------------------------------------------------------

export async function invokeAdminReviewer(
  req: AdminReviewerRequest,
  opts?: { signal?: AbortSignal; fetchImpl?: typeof fetch },
): Promise<AdminReviewerResponse> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      ok: false,
      error: "REVIEWER_FAILED",
      message: "Reviewer gagal membuat pertanyaan. Coba ulang.",
    };
  }

  let accessToken: string | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token ?? null;
  } catch {
    /* ignore */
  }
  if (!accessToken) {
    return {
      ok: false,
      error: "NO_SESSION",
      message: "Sesi tidak ditemukan. Silakan login ulang.",
    };
  }

  const doFetch = opts?.fetchImpl ?? fetch;
  let resp: Response;
  try {
    resp = await doFetch(`${SUPABASE_URL}/functions/v1/admin-reviewer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(req),
      signal: opts?.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    return {
      ok: false,
      error: "NETWORK_ERROR",
      message:
        err instanceof Error
          ? err.message
          : "Reviewer gagal membuat pertanyaan. Coba ulang.",
    };
  }

  let body: unknown = null;
  try {
    body = await resp.json();
  } catch {
    return {
      ok: false,
      error: "INVALID_OUTPUT",
      message: "Reviewer gagal membuat pertanyaan. Coba ulang.",
      status: resp.status,
    };
  }

  if (!resp.ok) {
    const b = (body ?? {}) as { error?: string; message?: string };
    return {
      ok: false,
      error: b.error ?? `HTTP_${resp.status}`,
      message: b.message ?? "Reviewer gagal membuat pertanyaan. Coba ulang.",
      status: resp.status,
    };
  }

  const decisions = (body as { decisions?: unknown }).decisions;
  if (!Array.isArray(decisions)) {
    return {
      ok: false,
      error: "INVALID_OUTPUT",
      message: "Reviewer gagal membuat pertanyaan. Coba ulang.",
      status: resp.status,
    };
  }

  return {
    ok: true,
    decisions: decisions as AdminReviewerSuccessDecisions,
  };
}

type AdminReviewerSuccessDecisions =
  AdminReviewerResponse extends { ok: true; decisions: infer D } ? D : never;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
