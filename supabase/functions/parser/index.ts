// Parser edge function — calls Anthropic via shared key.
// Cleans raw promo text (+ optional images) into structured human-readable text.
// NO JSON V.10. NO classification. NO Supabase write.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5-20250929";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Anda adalah PARSER PROMO. Tugas: rapikan input promo mentah (text + image) menjadi text terstruktur yang mudah dibaca manusia.

ATURAN KETAT:
- Jangan generate JSON.
- Jangan mengklasifikasi promo.
- Jangan mengarang data. Jika tidak ada → tulis "Tidak disebutkan".
- Pertahankan SEMUA fakta penting (angka, syarat, persen, nominal, game type, provider).
- Gabungkan informasi dari text + semua image.
- Jika ada konflik antara text dan image, catat di bagian "CATATAN AMBIGU".
- Perbaiki line break, rapikan tabel jadi list bernomor.
- Output bahasa Indonesia.

FORMAT OUTPUT WAJIB (gunakan persis section heading di bawah):

JUDUL PROMO:
<judul promo>

DESKRIPSI:
<deskripsi singkat 1-3 kalimat>

TABEL BONUS / REWARD:
1. <item>
2. <item>

CONTOH PERHITUNGAN:
<contoh perhitungan jika ada, atau "Tidak disebutkan">

SYARAT & KETENTUAN:
1. <syarat>
2. <syarat>

CARA KLAIM:
<langkah klaim>

PENGECUALIAN / BLACKLIST:
- <item, atau "Tidak disebutkan">

CATATAN AMBIGU:
- <data tidak jelas / konflik text vs image>
- Jika tidak ada: tulis "Tidak ada catatan ambigu."`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
    const { text = "", images = [] } = await req.json();

    if (!text.trim() && (!Array.isArray(images) || images.length === 0)) {
      return new Response(
        JSON.stringify({ error: "Input kosong. Berikan text atau minimal 1 image." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build content blocks
    const content: any[] = [];
    if (Array.isArray(images)) {
      for (const img of images) {
        // img: data URL like "data:image/png;base64,XXXX"
        const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(img);
        if (!match) continue;
        content.push({
          type: "image",
          source: { type: "base64", media_type: match[1], data: match[2] },
        });
      }
    }
    content.push({
      type: "text",
      text: text.trim()
        ? `Berikut input promo mentah dari user:\n\n${text.trim()}\n\nRapikan sesuai format wajib.`
        : `Tidak ada text — gunakan semua image di atas. Rapikan sesuai format wajib.`,
    });

    const body = {
      model: MODEL,
      max_tokens: 4000,
      temperature: 0.1,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    };

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const errType = errBody?.error?.type ?? "";
      if (response.status === 429 && errType === "credit_balance_exceeded") {
        return new Response(
          JSON.stringify({ error: "CREDIT_EXHAUSTED", message: "Kredit Anthropic habis." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "RATE_LIMITED", message: "Rate limit. Coba lagi sebentar." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 529 || errType === "overloaded_error" || response.status >= 500) {
        return new Response(
          JSON.stringify({ error: "OVERLOADED", message: "Server Anthropic overload." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Anthropic error ${response.status}: ${JSON.stringify(errBody)}`);
    }

    const data = await response.json();
    const outputText = (data.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();

    return new Response(JSON.stringify({ output: outputText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
