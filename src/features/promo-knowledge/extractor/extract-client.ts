/**
 * EXTRACTOR CLIENT — V10 NATIVE
 *
 * Edge function `pk-extractor` already returns a full-shape PkV10Record.
 * This client is now a thin pass-through: invoke + validate envelope + cast.
 *
 * NO V.09 conversion. NO mergeEnginesIntoRecord. NO silent fallback.
 */

import { supabase } from "@/integrations/supabase/client";
import type { PkV10Record } from "../schema/pk-v10";

export interface ExtractRequest {
  text: string;
  images: string[]; // data URLs or https URLs
  client_id_hint?: string;
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

  const { data, error } = await supabase.functions.invoke("pk-extractor", {
    body: {
      text: req.text ?? "",
      images: req.images ?? [],
      client_id_hint: req.client_id_hint ?? "",
    },
  });

  if (error) {
    console.error("[extractPromoV10] invoke error:", error);
    return { ok: false, error: "INVOKE_ERROR", message: error.message ?? String(error) };
  }
  if (!data || data.error) {
    return {
      ok: false,
      error: data?.error ?? "UNKNOWN",
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
    schema_version: typeof data.schema_version === "string" ? data.schema_version : "V.10",
  };
}

/**
 * @deprecated Use extractPromoV10. Kept as alias for transitional consumers.
 */
export const extractPromoV09 = extractPromoV10;
