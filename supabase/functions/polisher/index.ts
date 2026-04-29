/**
 * PRESENTATION POLISHER (Step 2 — LLM Enhance)
 *
 * Tujuan: merapikan TAMPILAN parser output via LLM (Gemini 2.5 Pro via Lovable Gateway).
 *
 * STRICT CONTRACT:
 *  - HANYA boleh ubah formatting/spacing/heading/bullet/numbering
 *  - DILARANG ubah angka, %, Rp, turnover, nama provider/game, tanggal, wording penting
 *  - DILARANG menambah informasi atau melakukan inferensi
 *  - Output = plain text saja (BUKAN JSON / markdown code block)
 *
 * Guardrail data integrity dilakukan di client (promo-polisher.ts → checkIntegrity).
 * Edge function ini hanya bertanggung jawab memanggil LLM dan return text.
 */

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM_PROMPT = `Anda adalah PRESENTATION POLISHER untuk text promo casino/sportsbook.

TUGAS ANDA HANYA SATU: merapikan TAMPILAN text agar lebih nyaman dibaca.

YANG BOLEH ANDA LAKUKAN:
- Hapus baris judul yang duplikat persis
- Rapikan spacing antar paragraf/section
- Buat bullet (-) dan numbering (1. 2. 3.) konsisten
- Tambah jarak antar blok paket bonus
- Pastikan setiap section punya heading yang jelas (kalau heading sudah ada di source — JANGAN buat baru)
- Trim whitespace berlebih
- Pastikan list item rapi dan sejajar

YANG DILARANG KERAS:
- JANGAN ubah angka apa pun (nominal Rp, persentase, turnover xN, tanggal, deposit minimum)
- JANGAN ubah/translate nama provider, nama game, nama brand
- JANGAN tambah informasi yang tidak ada di source
- JANGAN menyimpulkan, parafrase, atau merangkum
- JANGAN buat heading baru yang tidak ada di source
- JANGAN ubah urutan paket bonus / fakta penting
- JANGAN output JSON, JANGAN bungkus dengan code block (\`\`\`)
- JANGAN tambah komentar / penjelasan / pembuka / penutup

PRINSIP: Anggap konten = sakral. Hanya tata letak yang Anda atur.

OUTPUT: plain text rapi saja, langsung. Tidak ada preamble.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text : "";

    if (!text.trim()) {
      return new Response(
        JSON.stringify({ error: "Input text kosong" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (text.length > 50_000) {
      return new Response(
        JSON.stringify({ error: "Input terlalu besar (>50k chars)" }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY tidak ter-configure" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Retry up to 3x on transient upstream 5xx (Cloudflare 502/503/504)
    let resp: Response | null = null;
    let lastErrSnippet = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        resp = await fetch(LOVABLE_AI_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-pro",
            temperature: 0,
            max_tokens: 8000,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: text },
            ],
          }),
        });
      } catch (netErr) {
        lastErrSnippet = netErr instanceof Error ? netErr.message : String(netErr);
        console.error(`Polisher fetch attempt ${attempt} network error:`, lastErrSnippet);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 400 * attempt));
        continue;
      }

      if (resp.ok) break;

      // Don't retry on auth/quota/client errors
      if (resp.status === 429 || resp.status === 402 || (resp.status >= 400 && resp.status < 500)) {
        break;
      }

      // 5xx — retry with backoff
      try { lastErrSnippet = (await resp.text()).slice(0, 200); } catch { /* ignore */ }
      console.error(`Polisher LLM attempt ${attempt} status ${resp.status}:`, lastErrSnippet);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * attempt));
    }

    if (!resp) {
      // Total network failure → fallback signal (200 so client can revert to raw cleanly)
      return new Response(
        JSON.stringify({ error: "UPSTREAM_NETWORK_FAILED", fallback: true, message: "Tidak bisa menghubungi LLM. Hasil tetap pakai versi asli." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (resp.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit. Coba lagi sebentar.", fallback: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (resp.status === 402) {
      return new Response(
        JSON.stringify({ error: "Lovable AI credits habis. Top-up di Settings → Workspace → Usage.", fallback: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!resp.ok) {
      console.error("Polisher LLM final error:", resp.status, lastErrSnippet);
      // Soft-fail: return 200 + fallback so frontend gracefully degrades to raw
      return new Response(
        JSON.stringify({
          error: `LLM_UPSTREAM_${resp.status}`,
          fallback: true,
          message: resp.status >= 500
            ? "Server LLM sedang sibuk (502/503). Coba lagi sebentar — hasil tetap pakai versi asli."
            : `LLM error (HTTP ${resp.status})`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await resp.json();
    let output: string = data?.choices?.[0]?.message?.content ?? "";

    // Strip accidental markdown code fences
    output = output.replace(/^```[a-zA-Z]*\n?/m, "").replace(/```\s*$/m, "").trim();

    if (!output || output.length < 20) {
      return new Response(
        JSON.stringify({ error: "Polisher mengembalikan output kosong / terlalu pendek" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ output }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("Polisher error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
