/**
 * fetch-url-content — Phase 2C util netral
 * ────────────────────────────────────────────────────────────────────────────
 * Fetch raw HTML content dari URL via CORS proxy fallback list.
 *
 * Kontrak:
 *  - Input: URL string
 *  - Output: string konten HTML
 *  - TIDAK parse promo, TIDAK classify, TIDAK mutate.
 *  - TIDAK import voc-wolf-extractor / extractor legacy lain.
 *
 * Dipindah dari `@/lib/voc-wolf-extractor` (Phase 2C cleanup) agar
 * PseudoKnowledgeSection tidak lagi menggantung pada legacy module.
 */

const CORS_PROXIES: ((url: string) => string)[] = [
  (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

export async function fetchUrlContent(url: string): Promise<string> {
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxyFn = CORS_PROXIES[i];
    try {
      const proxyUrl = proxyFn(url);
      console.log(`[fetchUrlContent] Trying CORS proxy ${i + 1}/${CORS_PROXIES.length}…`);

      const response = await fetch(proxyUrl);
      if (!response.ok) {
        console.warn(`[fetchUrlContent] Proxy ${i + 1} returned status ${response.status}`);
        continue;
      }

      const data = await response.json();
      const content: string =
        (data && typeof data.contents === "string" && data.contents) ||
        (typeof data === "string" ? data : "") ||
        "";

      if (content && content.length > 500 && content.includes("<")) {
        console.log(`[fetchUrlContent] ✅ Proxy ${i + 1} OK, ${content.length} chars`);
        return content;
      }

      console.warn(`[fetchUrlContent] Proxy ${i + 1} returned invalid content (length: ${content.length})`);
    } catch (e) {
      console.warn(`[fetchUrlContent] Proxy ${i + 1} threw:`, e);
      continue;
    }
  }

  throw new Error("Semua CORS proxy gagal. Silakan paste konten HTML manual.");
}
