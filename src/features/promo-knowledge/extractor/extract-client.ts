/**
 * EXTRACTOR CLIENT — V10 NATIVE
 *
 * Edge function `pk-extractor` already returns a full-shape PkV10Record.
 * This client is now a thin pass-through: invoke + validate envelope + cast.
 *
 * NO V.09 conversion. NO mergeEnginesIntoRecord. NO silent fallback.
 *
 * NOTE: Uses raw `fetch` (not supabase.functions.invoke) because the
 * supabase-js invoke wrapper does not forward AbortSignal natively.
 * We need real network cancellation for the Cancel button + client timeout.
 */

import { supabase } from "@/integrations/supabase/client";
import type { PkV10Record } from "../schema/pk-v10";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export interface ExtractRequest {
  text: string;
  images: string[]; // data URLs or https URLs
  client_id_hint?: string;
  signal?: AbortSignal;
}

export interface ExtractResponse {
  ok: boolean;
  record?: PkV10Record;
  extraction_source?: "plain_text" | "image" | "multimodal";
  model?: string;
  schema_version?: string;
  error?: string;
  message?: string;
}

export async function extractPromoV10(req: ExtractRequest): Promise<ExtractResponse> {
  if (!req.text?.trim() && (!req.images || req.images.length === 0)) {
    return { ok: false, error: "EMPTY_INPUT", message: "Isi text atau upload gambar dulu" };
  }

  // Build Authorization from the current session if available; fall back to anon key.
  let authToken = SUPABASE_ANON_KEY;
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) authToken = data.session.access_token;
  } catch {
    /* ignore — fall back to anon */
  }

  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/pk-extractor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        text: req.text ?? "",
        images: req.images ?? [],
        client_id_hint: req.client_id_hint ?? "",
      }),
      signal: req.signal,
    });
  } catch (err) {
    // Surface abort as a typed error so caller can branch on it.
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }
    console.error("[extractPromoV10] network error:", err);
    return {
      ok: false,
      error: "NETWORK_ERROR",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    return {
      ok: false,
      error: "INVALID_RESPONSE",
      message: `Edge function tidak return JSON (HTTP ${response.status})`,
    };
  }

  if (!response.ok || !data || data.error) {
    return {
      ok: false,
      error: data?.error ?? `HTTP_${response.status}`,
      message: data?.message ?? "Extractor gagal",
    };
  }

  const record = data.record as PkV10Record | undefined;
  if (!record || typeof record !== "object") {
    return { ok: false, error: "INVALID_RESPONSE", message: "Edge function tidak return record" };
  }

  return {
    ok: true,
    record,
    extraction_source: data.extraction_source,
    model: typeof data.model === "string" ? data.model : "",
    schema_version: typeof data.schema_version === "string" ? data.schema_version : "V.10.2",
  };
}
