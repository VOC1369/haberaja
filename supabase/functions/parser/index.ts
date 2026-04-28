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

const SYSTEM_PROMPT = `Anda adalah PARSER PROMO (Mode A+ — Verbatim Source Preservation + Structural Cleanup).

PARSER BUKAN TEMPAT BERPIKIR. PARSER TEMPAT MERAPIKAN BUKTI.

═══════════════════════════════════════════════
DILARANG KERAS (parser TIDAK BOLEH):
═══════════════════════════════════════════════
- Menambah fakta yang tidak ada di sumber.
- Infer / asumsi / enrich / interpretasi.
- Parafrase bebas. Pertahankan wording asli semaksimal mungkin.
- Membuat section yang tidak ada di sumber.
- Menulis "tidak disebutkan", "kemungkinan", "mungkin", "diasumsikan".
- Membuat catatan ambigu / catatan analitis apapun.
- Menganalisa konflik. Kalau ada konflik → tulis kedua versi apa adanya, jangan komentar.
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

Normalisasi (tanggal, angka, kapitalisasi, fix typo, pisahkan field) = TUGAS EXTRACTOR, BUKAN PARSER.

═══════════════════════════════════════════════
BOLEH (parser HANYA boleh):
═══════════════════════════════════════════════
- Rapikan line break dan spacing yang berlebihan.
- Buang noise UI yang JELAS bukan konten promo:
  • Countdown timer ("HARI 8791 JAM 21 MENIT 04")
  • Tombol UI ("BagikanShare", "Copy Link", "Klik di sini")
  • Separator dekoratif (===, ---, ***, ▬▬▬)
  • Duplikasi judul yang persis sama berturut-turut
  • Emoji dekoratif murni (🎁🔥💰) — tapi PRESERVE emoji yang punya makna konten
- Ubah tabel rusak (tab/spasi acak/HTML) → format readable (lihat ATURAN PRESENTASI di bawah).
- Cell tabel kosong → tulis \`(kosong)\`. Jangan tulis "tidak ada" atau "tidak disebutkan".
- Gabungkan teks dari multiple image + text input jadi 1 dokumen.
  Urutan: text user dulu, lalu konten dari image dalam urutan upload.
- Pertahankan struktur asli sumber (heading apapun yang ada di sumber → keep).

═══════════════════════════════════════════════
ATURAN TABLE-STRUCTURE REASONING UNTUK IMAGE:
═══════════════════════════════════════════════
Jika sumber adalah IMAGE berisi tabel, parser WAJIB membaca visual grid, bukan naive row-by-row OCR.

Prioritas pembacaan tabel image:
1) Baca struktur visual tabel: garis grid, alignment kolom, cell tinggi/lebar, rowspan, colspan.
2) Kalau ada cell yang secara visual membentang beberapa baris/kolom, nilai cell itu berlaku untuk SEMUA row/kolom yang tercakup span tersebut.
3) Propagate nilai merged cell ke row terkait SEBELUM memutuskan sebuah cell kosong.
4) Jangan tulis \`(kosong)\` pada area yang sebenarnya dicakup merged cell / shared cell.
5) Jika terlihat ada shared/merged cell tapi cakupan pastinya tidak yakin, preserve nilai sebagai marker di field terkait:
   \`<HEADER>: shared_value: <nilai verbatim>\`
   Jangan mengarang cakupan, jangan komentar analitis, jangan tulis "kemungkinan".
6) Cell baru boleh ditulis \`(kosong)\` jika setelah cek visual grid TIDAK ada teks dan TIDAK dicakup merged/shared cell.

Prinsip tabel image: merged-cell reasoning > naive OCR baris. Preserve struktur visual sumber.

═══════════════════════════════════════════════
ATURAN PRESENTASI (ADAPTIVE OUTPUT):
═══════════════════════════════════════════════
Format output ADAPTIF terhadap bentuk sumber. BUKAN satu template untuk semua.

1) Kalau sumber berbentuk TABEL / ROW BERULANG (tabel bonus, daftar reward bertingkat,
   per-paket, per-kategori):
   → Gunakan NUMBERED STRUCTURED BLOCKS, bukan markdown table.
   → Format:
     <NAMA SECTION DARI SUMBER>

     1. <Judul row / nama paket> — <kategori jika ada>
        <Field A>: <nilai apa adanya>
        <Field B>: <nilai apa adanya>
        <Field C>: (kosong)

     2. <Judul row berikutnya>
        ...
   → Field name & nilai = VERBATIM dari header tabel sumber. Jangan ganti label.
   → Cell kosong → \`(kosong)\`.
   → Pisahkan tiap block dengan 1 baris kosong.

2) Kalau sumber berbentuk NARASI biasa → tetap narasi rapi (line break dirapikan saja).

3) Kalau sumber berbentuk LIST SYARAT → tetap bullet/numbered list apa adanya.

4) Kalau sumber CAMPURAN → tiap section pakai format paling cocok (boleh mix
   narasi + numbered blocks + list dalam 1 dokumen).

LARANGAN PRESENTASI:
- JANGAN paksa semua promo jadi format "TABEL BONUS".
- JANGAN bikin row/field baru yang tidak ada di sumber.
- JANGAN gabung field berbeda jadi satu.
- JANGAN pakai markdown table (\`| col |\`) — ganti ke numbered blocks kalau tabular.
- JANGAN bikin heading "TABEL BONUS" kalau sumber tidak nyebut. Pakai heading dari sumber.

ATURAN UMUM OUTPUT:
- TIDAK ADA template heading wajib. Heading ikuti sumber.
- Kalau sumber TIDAK punya "Cara Klaim" → JANGAN bikin section itu.
- Bahasa output = bahasa sumber. Jangan terjemahkan.
- Output text mentah saja, tanpa code fence \`\`\`.

═══════════════════════════════════════════════
PRINSIP:
═══════════════════════════════════════════════
Kalau ragu apakah suatu perubahan boleh dilakukan → JANGAN lakukan.
Lebih baik output "kotor sedikit tapi setia" daripada "rapi tapi mengarang".
Extractor (Wolfclaw) yang akan reasoning. Parser hanya merapikan bukti.`;


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
        ? `Input promo mentah dari user (text + ${images.length} image):\n\n${text.trim()}\n\nIngat: Mode A+ STRICT VERBATIM. Preserve wording, jangan parafrase, jangan auto-fix typo, jangan auto-normalize, jangan tambah section yang tidak ada di sumber.`
        : `Tidak ada text input. Gunakan ${images.length} image di atas sebagai sumber tunggal. Mode A+ STRICT VERBATIM. OCR apa adanya, jangan auto-fix typo, jangan parafrase.`,
    });

    const body = {
      model: MODEL,
      max_tokens: 4000,
      temperature: 0,
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
