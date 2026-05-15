/**
 * fetch-url-content — Phase 2C util netral
 * ────────────────────────────────────────────────────────────────────────────
 * Fetch raw HTML/text content dari URL via Supabase edge proxy.
 *
 * Kontrak:
 *  - Input: URL string
 *  - Output: string konten (HTML/text)
 *  - TIDAK parse promo, TIDAK classify, TIDAK mutate.
 *  - TIDAK import voc-wolf-extractor / extractor legacy lain.
 *
 * Dipindah dari `@/lib/voc-wolf-extractor` agar PseudoKnowledgeSection
 * tidak lagi menggantung pada legacy module.
 */

import { supabase } from "@/integrations/supabase/client";

export async function fetchUrlContent(url: string): Promise<string> {
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error("URL tidak valid");
  }

  const { data, error } = await supabase.functions.invoke("parser", {
    body: { url, mode: "fetch_only" },
  });

  if (error) {
    throw new Error(error.message ?? "Fetch URL gagal");
  }

  const content =
    typeof data === "string"
      ? data
      : typeof (data as { content?: unknown })?.content === "string"
        ? (data as { content: string }).content
        : typeof (data as { html?: unknown })?.html === "string"
          ? (data as { html: string }).html
          : "";

  if (!content) {
    throw new Error("Konten URL kosong");
  }

  return content;
}
