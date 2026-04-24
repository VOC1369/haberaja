/**
 * Json Schema Contract V.09 — WRAPPER (fase sekarang)
 *
 * Bridge minimal di atas `ExtractedPromo` (sumber existing dari voc-wolf-extractor).
 *
 * Tujuan:
 * - Standarkan SHAPE output extractor (versi, meta, source)
 * - TIDAK rewrite ExtractedPromo
 * - TIDAK bikin shape paralel baru
 * - Lossless: `data` = ExtractedPromo apa adanya
 *
 * Aturan tegas:
 * - Wrapper ini = bridge fase sekarang.
 * - Bukan alasan untuk pertahankan chaos selamanya.
 * - Begitu `ExtractedPromo` dirombak, `data` shape boleh berubah; `meta` tetap.
 */

import type { ExtractedPromo } from "@/lib/voc-wolf-extractor";

export const JSON_SCHEMA_V09_VERSION = "v09" as const;

export type V09ExtractionSource = "url" | "text" | "image" | "multimodal";

export interface JsonSchemaV09Meta {
  schema_version: typeof JSON_SCHEMA_V09_VERSION;
  extracted_at: string;            // ISO timestamp
  source: V09ExtractionSource;     // mode input
  source_label?: string;           // optional: original URL / filename / "paste"
  extractor: string;               // identifier extractor pipeline
}

export interface JsonSchemaV09<T = ExtractedPromo> {
  meta: JsonSchemaV09Meta;
  data: T;
}

export interface WrapV09Options {
  source: V09ExtractionSource;
  source_label?: string;
  extractor?: string;
  extracted_at?: string;
}

/**
 * Bungkus ExtractedPromo jadi Json Schema V.09.
 * Lossless — `data` = referensi langsung ke ExtractedPromo.
 */
export function wrapV09(
  data: ExtractedPromo,
  opts: WrapV09Options,
): JsonSchemaV09 {
  return {
    meta: {
      schema_version: JSON_SCHEMA_V09_VERSION,
      extracted_at: opts.extracted_at ?? new Date().toISOString(),
      source: opts.source,
      source_label: opts.source_label,
      extractor: opts.extractor ?? "voc-wolf-extractor",
    },
    data,
  };
}

/**
 * Ambil ExtractedPromo dari wrapper. Jika input bukan wrapper, return apa adanya
 * (untuk kompatibilitas data lama yang masih raw ExtractedPromo).
 */
export function unwrapV09(input: unknown): ExtractedPromo | null {
  if (!input || typeof input !== "object") return null;
  if (isV09(input)) return (input as JsonSchemaV09).data;
  // legacy: raw ExtractedPromo
  return input as ExtractedPromo;
}

export function isV09(input: unknown): input is JsonSchemaV09 {
  if (!input || typeof input !== "object") return false;
  const obj = input as Record<string, unknown>;
  const meta = obj.meta as Record<string, unknown> | undefined;
  return !!meta && meta.schema_version === JSON_SCHEMA_V09_VERSION && "data" in obj;
}
