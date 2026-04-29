// Parser edge function — input-based routing.
//
// ROUTING (v4 — simple, input-based):
//   - hasImage  → Gemini 2.5 Pro (single call). On fail/empty → fallback Claude image flow.
//   - text-only → Claude Sonnet 4.5 (Pass 1 only).
//
// Fallback trigger (B): HTTP/network error, empty output, OR output < 50 chars.
// Temperature: 0 (deterministic). Max tokens: 8000.
//
// Prompts: reuse SYSTEM_PROMPT_PASS1 (Mode A+) for Gemini AND Claude Pass 1.
// Claude fallback retains Pass 2 (Opus) structural audit.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const GEMINI_MODEL = "google/gemini-2.5-pro";
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL_PASS1 = "claude-sonnet-4-5-20250929";
const MODEL_PASS2 = "claude-opus-4-20250514";

const MAX_TOKENS = 8000;
const TEMPERATURE = 0;
const MIN_OUTPUT_CHARS = 20;
const GEMINI_TIMEOUT_MS = 20000;
const ANTHROPIC_TIMEOUT_MS = 30000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================================
// SYSTEM PROMPT — PASS 1 / Gemini (Verbatim + Structural Reasoning)
// ============================================================
const SYSTEM_PROMPT_PASS1 = `Anda adalah PARSER PROMO (Mode A+ — Verbatim Source Preservation + Structural Cleanup).

PARSER BUKAN TEMPAT BERPIKIR BISNIS. PARSER TEMPAT MERAPIKAN BUKTI.
TAPI: PARSER WAJIB BERPIKIR SOAL STRUKTUR (layout, grid, rowspan, colspan, urutan cell).

═══════════════════════════════════════════════
DUA JENIS REASONING:
═══════════════════════════════════════════════
✅ STRUCTURAL REASONING — BOLEH (bahkan WAJIB):
   - Membaca layout visual tabel.
   - Mendeteksi rowspan / colspan / merged cell / shared cell.
   - Menentukan urutan cell, alignment kolom, hubungan visual antar cell.
   - Propagate nilai merged cell ke semua row yang dicakup.
   - Memutuskan apakah suatu cell "benar-benar kosong" atau "dicakup merged cell di atasnya".

❌ SEMANTIC / BUSINESS REASONING — DILARANG:
   - Klasifikasi promo, enum, kategori.
   - turnover_basis, payout_direction, mechanic type.
   - Makna bisnis promo.
   - Generate JSON.
   - Inferensi makna konten.
   - Parafrase, terjemahan, normalisasi makna.

═══════════════════════════════════════════════
DILARANG KERAS (parser TIDAK BOLEH):
═══════════════════════════════════════════════
- Menambah fakta yang tidak ada di sumber.
- Infer / asumsi / enrich / interpretasi makna.
- Parafrase bebas. Pertahankan wording asli semaksimal mungkin.
- Membuat section yang tidak ada di sumber.
- Menulis "tidak disebutkan", "kemungkinan", "mungkin", "diasumsikan".
- Membuat catatan ambigu / catatan analitis apapun.
- Menganalisa konflik. Kalau ada konflik → tulis kedua versi apa adanya.
- Memisahkan informasi yang menyatu di sumber jadi field terpisah.
  Contoh: "Semua Provider Casino, Kecuali evolution gaming dan sexy baccarat"
  → TETAP 1 cell. JANGAN dipisah jadi field "Pengecualian".
- Auto-fix typo. "Mircogaming" tetap "Mircogaming". "evolution gaming" tetap huruf kecil.
- Auto-normalisasi kapitalisasi nama provider.
- Mengubah format tanggal (jangan ubah "25-Mei-2050" jadi "2050-05-25").
- Mengubah format angka (jangan ubah "Rp. 50,000" jadi "Rp 50.000").
- Mengubah makna kalimat sekecil apapun.
- Generate JSON, klasifikasi, atau enum.
- Menambahkan heading template (JUDUL PROMO / CARA KLAIM / dst) kalau di sumber tidak ada.

═══════════════════════════════════════════════
BOLEH (parser HANYA boleh):
═══════════════════════════════════════════════
- Rapikan line break dan spacing yang berlebihan.
- Buang noise UI yang JELAS bukan konten promo:
  • Countdown timer ("HARI 8791 JAM 21 MENIT 04")
  • Tombol UI ("BagikanShare", "Copy Link", "Klik di sini")
  • Separator dekoratif (===, ---, ***, ▬▬▬)
  • Duplikasi judul yang persis sama berturut-turut
  • Emoji dekoratif murni (🎁🔥💰) — preserve emoji yang punya makna konten
- Ubah tabel rusak (tab/spasi acak/HTML) → format readable.
- Cell tabel kosong → tulis \`(kosong)\` HANYA setelah cek visual grid membuktikan tidak dicakup merged cell.
- Gabungkan teks dari multiple image + text input jadi 1 dokumen.
  Urutan: text user dulu, lalu konten dari image dalam urutan upload.
- Pertahankan struktur asli sumber (heading apapun yang ada di sumber → keep).

═══════════════════════════════════════════════
ATURAN TABLE-STRUCTURE REASONING UNTUK IMAGE (KRITIKAL):
═══════════════════════════════════════════════
Jika sumber adalah IMAGE berisi tabel, parser WAJIB membaca visual grid, BUKAN naive row-by-row OCR.

Prosedur wajib untuk setiap tabel image:

LANGKAH 1 — DETEKSI STRUKTUR GRID:
   Sebelum extract isi, scan struktur visual:
   - Berapa kolom?
   - Berapa baris?
   - Cell mana yang membentang lebih dari 1 row (rowspan)?
   - Cell mana yang membentang lebih dari 1 kolom (colspan)?
   - Garis grid / border / alignment vertikal di tiap kolom.

LANGKAH 2 — PROPAGATE MERGED CELL:
   Untuk setiap cell yang membentang N rows:
   - Nilai cell tersebut berlaku untuk SEMUA N row yang dicakup.
   - Tulis nilai itu di SEMUA row terkait, bukan hanya row pertama.

LANGKAH 3 — VALIDASI SEBELUM TULIS \`(kosong)\`:
   Sebelum menulis \`(kosong)\` pada suatu field di suatu row:
   - WAJIB buktikan: cell visual di posisi (row, kolom) itu benar-benar tidak ada teks.
   - WAJIB buktikan: cell itu TIDAK dicakup merged/shared cell dari row di atasnya.
   - Kalau ragu → JANGAN tulis \`(kosong)\`. Tulis nilai dari merged cell yang paling dekat di atasnya.

LANGKAH 4 — SELF-AUDIT:
   Setelah selesai, cek ulang: kalau di kolom yang sama beberapa row punya nilai dan beberapa row \`(kosong)\`,
   pertanyakan apakah \`(kosong)\` itu benar atau artifact OCR (cell sebenarnya dicakup merged cell).

Prinsip: merged-cell reasoning > naive OCR baris. Preserve struktur visual sumber.

═══════════════════════════════════════════════
ATURAN PRESENTASI (ADAPTIVE OUTPUT):
═══════════════════════════════════════════════
Format output ADAPTIF terhadap bentuk sumber.

1) Sumber TABEL / ROW BERULANG → NUMBERED STRUCTURED BLOCKS:
     <NAMA SECTION DARI SUMBER>

     1. <Judul row / nama paket> — <kategori jika ada>
        <Field A>: <nilai apa adanya>
        <Field B>: <nilai apa adanya>

     2. <Judul row berikutnya>
        ...
   - Field name & nilai = VERBATIM dari header tabel sumber.
   - Cell kosong (sudah lewat validasi LANGKAH 3) → \`(kosong)\`.

   ATURAN SINGLE-ENTRY (PENTING — REASONING, BUKAN REGEX):
   Sebelum menulis nomor "1.", tanya pada diri sendiri:
   "Apakah section ini punya ≥2 entries / ≥2 row paket / ≥2 tier?"
   - Kalau YA → tulis numbering "1.", "2.", "3." …
   - Kalau TIDAK (cuma 1 entry) → JANGAN tulis "1.". Langsung tulis judul + fields-nya.

   Berlaku UNIVERSAL untuk semua section (Contoh Perhitungan, Paket Bonus, Tier, Kategori Game, dll).
   Numbering dipakai untuk MEMBEDAKAN beberapa entries — bukan hiasan.
   Single entry = tidak butuh nomor karena tidak ada yang dibedakan.

   Contoh KONTRAS:

   ❌ SALAH (single entry tapi dikasih "1.")
     Contoh Perhitungan:
     1. SLOT
        TURNOVER: 1.000.000
        BONUS: 0.5%

   ✅ BENAR (single entry, tanpa nomor)
     Contoh Perhitungan:
     SLOT
        TURNOVER: 1.000.000
        BONUS: 0.5%

   ✅ BENAR (multi entry, pakai nomor)
     Paket Bonus:
     1. SLOT — Rollingan 0.5%
        TURNOVER: 1.000.000
     2. LIVE CASINO — Rollingan 0.8%
        TURNOVER: 500.000

    CATATAN: List S&K (syarat & ketentuan) tetap pakai numbering normal karena memang berurutan.

   ═══════════════════════════════════════════════
   ATURAN HEADLINE PENTING (REASONING — BUKAN REGEX):
   ═══════════════════════════════════════════════
   Setiap baris yang secara semantik adalah HEADLINE / SECTION HEADER WAJIB
   diberi prefix \`## \` (dua hash + spasi) di awal baris.

   Cara reasoning (tanya pada diri sendiri sebelum menulis tiap baris):
   "Apakah baris ini berfungsi sebagai JUDUL/HEADER yang memayungi konten di
   bawahnya, ATAU baris ini adalah konten/field/data?"
   - Kalau HEADER (memayungi blok di bawahnya) → prefix \`## \`.
   - Kalau KONTEN (field, data, item, kalimat) → JANGAN prefix.

   Contoh yang BIASANYA headline (tapi keputusan tetap reasoning per kasus):
   - Judul utama promo (cth: "EXTRA CUAN REFERRAL UP TO 15%")
   - "SYARAT DAN KETENTUAN" / "Syarat & Ketentuan" / "S&K"
   - "Contoh Perhitungan" / "Contoh perhitungan 5%" (header sub-blok contoh)
   - "Tier Downline and Percentage"
   - "Rumus Komisi"
   - "Cara Klaim" / "Cara Mendapatkan Bonus"
   - "Paket Bonus" / "Tabel Bonus"
   - Nama section apapun yang di sumber memang berfungsi sebagai header

   Yang BUKAN headline (JANGAN diberi \`## \`):
   - Field label dengan nilai: "Tanggal akhir: 08-Okt-2037", "WINLOSE: 10.000.000"
   - Item list / bullet
   - Kalimat narasi
   - Baris numbering item ("1. Multi-akun / self-referral")

   PRINSIP HEADLINE:
   - Konsisten: kalau "SYARAT DAN KETENTUAN" dapat \`## \`, maka "Contoh Perhitungan"
     dan "Rumus Komisi" juga harus dapat \`## \` (karena sama-sama header).
   - Verbatim: teks setelah \`## \` = wording asli sumber. Jangan ubah huruf
     besar/kecil, jangan terjemahkan, jangan parafrase.
   - Marker \`## \` adalah SATU-SATUNYA hint presentasi yang boleh ditambahkan
     parser. Jangan pakai \`#\`, \`###\`, \`**bold**\`, atau marker lain.

   Contoh KONTRAS:

   ❌ SALAH (headline tidak ditandai → tampilan tidak konsisten)
     EXTRA CUAN REFERRAL UP TO 15%
     Tanggal akhir: -
     SYARAT DAN KETENTUAN
     - Pemilik referral WAJIB KYC...
     Contoh perhitungan 5%
     Jumlah player: 5 ID

   ✅ BENAR (semua header konsisten dapat \`## \`)
     ## EXTRA CUAN REFERRAL UP TO 15%
     Tanggal akhir: -

     ## SYARAT DAN KETENTUAN
     - Pemilik referral WAJIB KYC...

     ## Contoh perhitungan 5%
     Jumlah player: 5 ID

2) Narasi → tetap narasi rapi.
3) List syarat → tetap bullet/numbered list.
4) Campuran → mix sesuai section.

LARANGAN PRESENTASI:
- JANGAN paksa semua promo jadi format "TABEL BONUS".
- JANGAN bikin row/field baru yang tidak ada di sumber.
- JANGAN gabung field berbeda jadi satu.
- JANGAN pakai markdown table (\`| col |\`) — pakai numbered blocks.

ATURAN UMUM OUTPUT:
- TIDAK ADA template heading wajib. Heading ikuti sumber.
- Bahasa output = bahasa sumber. Jangan terjemahkan.
- Output text mentah saja, tanpa code fence \`\`\`, tanpa preamble, tanpa komentar.

═══════════════════════════════════════════════
PRINSIP:
═══════════════════════════════════════════════
Kalau ragu soal MAKNA → JANGAN reasoning, tulis verbatim.
Kalau ragu soal STRUKTUR (merged cell, layout) → WAJIB reasoning, propagate dengan benar.
Lebih baik output "kotor sedikit tapi setia + struktur benar" daripada "rapi tapi salah propagate cell".`;

// ============================================================
// SYSTEM PROMPT — PASS 2 (Claude fallback only)
// ============================================================
const SYSTEM_PROMPT_PASS2 = `Anda adalah AUDITOR STRUKTUR VISUAL (Pass 2).

TUGAS TUNGGAL:
Bandingkan output Pass 1 dengan image asli. Audit struktur visual tabel — fokus pada
merged cell, rowspan, colspan, shared cell. Repair propagation kalau ada cell yang
seharusnya terisi (karena dicakup merged cell) tapi di Pass 1 ditulis \`(kosong)\`,
\`—\`, atau hilang. Minimum-diff.

DILARANG KERAS:
- Mengubah wording bagian non-tabel (narasi, syarat & ketentuan).
- Normalize angka (jangan ubah "Rp. 50,000" jadi "Rp 50.000" atau sebaliknya).
- Fix typo (jangan ubah "Mircogaming" jadi "Microgaming").
- Ubah kapitalisasi nama provider.
- Tambah field/row/section baru.
- Tambah catatan analitis ("kemungkinan", "diasumsikan", "berdasarkan...").
- Inferensi bisnis (turnover_basis, kategori, enum, klasifikasi).
- Parafrase apapun.
- Generate JSON.
- Mengubah cell yang sudah punya nilai di Pass 1.
- Menambah / menghapus marker headline \`## \` dari Pass 1 (preserve apa adanya).

HANYA BOLEH:
- Mengganti \`(kosong)\` / \`—\` / cell hilang di field yang TERBUKTI dicakup merged cell di image.
- Nilai pengganti = VERBATIM dari merged cell di image (jangan normalize).

PROSEDUR:
1. Scan image: apakah ada tabel sama sekali?
   - KALAU TIDAK ADA TABEL di image → return output Pass 1 APA ADANYA, character-identik. Selesai.

2. KALAU ADA TABEL:
   - Untuk setiap row × kolom, cek visual grid: apakah cell itu dicakup rowspan/colspan?
   - Kalau YA dan Pass 1 menulis \`(kosong)\`/\`—\` → ganti dengan nilai verbatim dari merged cell.
   - Kalau TIDAK → biarkan apa adanya.

3. OUTPUT:
   FULL output Pass 1 yang sudah diperbaiki — character-identik kecuali cell yang di-repair.
   Tanpa preamble, tanpa code fence.

PRINSIP: Minimum-diff. Kalau ragu → jangan ubah.`;

// ============================================================
// Helpers
// ============================================================
type ImageBlock = { mediaType: string; data: string };

function parseImages(images: unknown): ImageBlock[] {
  const out: ImageBlock[] = [];
  if (!Array.isArray(images)) return out;
  for (const img of images) {
    if (typeof img !== "string") continue;
    const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(img);
    if (!m) continue;
    out.push({ mediaType: m[1], data: m[2] });
  }
  return out;
}

function buildUserText(text: string, imageCount: number): string {
  const trimmed = text.trim();
  if (trimmed) {
    return `Input promo mentah dari user (text + ${imageCount} image):\n\n${trimmed}\n\nIngat: Mode A+ STRICT VERBATIM untuk wording, tapi WAJIB structural reasoning untuk merged cell di tabel image.`;
  }
  return `Tidak ada text input. Gunakan ${imageCount} image di atas sebagai sumber tunggal. Mode A+ STRICT VERBATIM untuk wording. WAJIB structural reasoning untuk merged cell.`;
}

// ============================================================
// Gemini call
// ============================================================
async function callGemini(opts: {
  systemPrompt: string;
  userText: string;
  images: ImageBlock[];
}): Promise<{ ok: true; text: string } | { ok: false; reason: string }> {
  if (!LOVABLE_API_KEY) return { ok: false, reason: "LOVABLE_API_KEY not set" };

  // OpenAI-compatible content (text + image_url with data URI). Gateway routes to Gemini.
  const userContent: any[] = [];
  for (const img of opts.images) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${img.mediaType};base64,${img.data}` },
    });
  }
  userContent.push({ type: "text", text: opts.userText });

  const body = {
    model: GEMINI_MODEL,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: userContent },
    ],
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
  };

  let resp: Response;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GEMINI_TIMEOUT_MS);
  try {
    resp = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    const aborted = (e as any)?.name === "AbortError";
    return {
      ok: false,
      reason: aborted
        ? `timeout after ${GEMINI_TIMEOUT_MS}ms`
        : `network: ${e instanceof Error ? e.message : String(e)}`,
    };
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => "");
    return { ok: false, reason: `http ${resp.status}: ${errBody.slice(0, 300)}` };
  }

  let data: any;
  try {
    data = await resp.json();
  } catch (e) {
    return { ok: false, reason: `invalid json: ${e instanceof Error ? e.message : String(e)}` };
  }

  const text = (data?.choices?.[0]?.message?.content ?? "").toString().trim();

  if (!text) {
    const finishReason = data?.choices?.[0]?.finish_reason ?? "unknown";
    return { ok: false, reason: `empty output (finish_reason=${finishReason})` };
  }
  if (text.length < MIN_OUTPUT_CHARS) {
    return { ok: false, reason: `output too short (${text.length} chars)` };
  }
  return { ok: true, text };
}

// ============================================================
// Anthropic call helper
// ============================================================
async function callAnthropic(opts: {
  model: string;
  system: string;
  content: any[];
  maxTokens: number;
}): Promise<{ ok: true; text: string } | { ok: false; status: number; errBody: any }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ANTHROPIC_TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens,
        temperature: TEMPERATURE,
        system: opts.system,
        messages: [{ role: "user", content: opts.content }],
      }),
      signal: ctrl.signal,
    });
  } catch (e) {
    const aborted = (e as any)?.name === "AbortError";
    return {
      ok: false,
      status: 0,
      errBody: { error: { type: aborted ? "timeout" : "network", message: e instanceof Error ? e.message : String(e) } },
    };
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    return { ok: false, status: resp.status, errBody };
  }
  const data = await resp.json();
  const text = (data.content ?? [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim();
  return { ok: true, text };
}

function mapAnthropicError(status: number, errBody: any): Response {
  const errType = errBody?.error?.type ?? "";
  if (status === 429 && errType === "credit_balance_exceeded") {
    return new Response(
      JSON.stringify({ error: "CREDIT_EXHAUSTED", message: "Kredit Anthropic habis." }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (status === 429) {
    return new Response(
      JSON.stringify({ error: "RATE_LIMITED", message: "Rate limit. Coba lagi sebentar." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (status === 529 || errType === "overloaded_error" || status >= 500) {
    return new Response(
      JSON.stringify({ error: "OVERLOADED", message: "Server Anthropic overload." }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  return new Response(
    JSON.stringify({ error: `Anthropic error ${status}: ${JSON.stringify(errBody)}` }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// ============================================================
// Claude image flow (fallback): Pass 1 Sonnet + Pass 2 Opus
// ============================================================
async function claudeImageFlow(
  text: string,
  images: ImageBlock[],
): Promise<{ ok: true; output: string; pass2: boolean } | { ok: false; status: number; errBody: any }> {
  const imageBlocks = images.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.mediaType, data: img.data },
  }));

  const userText = buildUserText(text, images.length);
  const pass1Content: any[] = [...imageBlocks, { type: "text", text: userText }];

  const pass1 = await callAnthropic({
    model: MODEL_PASS1,
    system: SYSTEM_PROMPT_PASS1,
    content: pass1Content,
    maxTokens: MAX_TOKENS,
  });
  if (!pass1.ok) return { ok: false, status: pass1.status, errBody: pass1.errBody };

  // Pass 2 Opus structural audit
  const pass2Content: any[] = [
    ...imageBlocks,
    {
      type: "text",
      text: `=== OUTPUT PASS 1 (verbatim) ===
${pass1.text}

=== AUDIT TASK ===
Audit struktur visual semua tabel di image vs output Pass 1.
Fokus: merged cell, rowspan, colspan, shared cell propagation.
Repair HANYA cell yang ditulis (kosong)/—/hilang padahal di image dicakup merged cell.
Minimum-diff. Kalau image tidak ada tabel → return output Pass 1 apa adanya.

Output FULL dokumen final, tanpa preamble, tanpa komentar, tanpa code fence.`,
    },
  ];

  const pass2 = await callAnthropic({
    model: MODEL_PASS2,
    system: SYSTEM_PROMPT_PASS2,
    content: pass2Content,
    maxTokens: MAX_TOKENS,
  });

  if (pass2.ok && pass2.text.trim().length > 0) {
    return { ok: true, output: pass2.text, pass2: true };
  }
  if (!pass2.ok) console.warn("[parser] Claude Pass 2 failed:", pass2.status, pass2.errBody);
  return { ok: true, output: pass1.text, pass2: false };
}

// ============================================================
// Main handler
// ============================================================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
    const { text = "", images = [] } = await req.json();

    if (!String(text).trim() && (!Array.isArray(images) || images.length === 0)) {
      return new Response(
        JSON.stringify({ error: "Input kosong. Berikan text atau minimal 1 image." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const imgs = parseImages(images);
    const hasImage = imgs.length > 0;

    // ============= TEXT-ONLY → Claude Sonnet Pass 1 only =============
    if (!hasImage) {
      const userText = buildUserText(String(text), 0);
      const pass1 = await callAnthropic({
        model: MODEL_PASS1,
        system: SYSTEM_PROMPT_PASS1,
        content: [{ type: "text", text: userText }],
        maxTokens: MAX_TOKENS,
      });
      if (!pass1.ok) return mapAnthropicError(pass1.status, pass1.errBody);

      return new Response(
        JSON.stringify({
          output: pass1.text,
          debug: { route: "claude_text", model: MODEL_PASS1 },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ============= IMAGE → Gemini 2.5 Pro single call =============
    const gemini = await callGemini({
      systemPrompt: SYSTEM_PROMPT_PASS1,
      userText: buildUserText(String(text), imgs.length),
      images: imgs,
    });

    if (gemini.ok) {
      return new Response(
        JSON.stringify({
          output: gemini.text,
          debug: { route: "gemini", model: GEMINI_MODEL },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Gemini failed → fallback Claude image flow
    console.warn("[parser] Gemini failed, falling back to Claude:", gemini.reason);
    const fallback = await claudeImageFlow(String(text), imgs);
    if (!fallback.ok) return mapAnthropicError(fallback.status, fallback.errBody);

    return new Response(
      JSON.stringify({
        output: fallback.output,
        debug: {
          route: "gemini_fallback_claude",
          model: fallback.pass2 ? MODEL_PASS2 : MODEL_PASS1,
          gemini_fail_reason: gemini.reason,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
