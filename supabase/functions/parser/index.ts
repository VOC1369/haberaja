// Parser edge function — calls Anthropic via shared key.
// Cleans raw promo text (+ optional images) into structured human-readable text.
//
// TWO-PASS PARSING (v2):
//   Pass 1: Standard parse (text + image) → readable output.
//   Pass 2 (selective audit): Triggered only if image present AND Pass 1 output
//          shows numbered/table-like blocks with `(kosong)` cells in fields that
//          have values in other rows (suspect merged-cell artifact).
//          Pass 2 re-sends full image + Pass 1 output + suspect field list,
//          asks Opus to repair ONLY merged-cell propagation. No wording/normalization.
//
// Model routing:
//   - Pass 1: Sonnet 4.5 (default, cheap, fast).
//   - Pass 2: Claude Opus 4 (vision + structural reasoning for merged cells).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL_PASS1 = "claude-sonnet-4-5-20250929";
const MODEL_PASS2 = "claude-opus-4-20250514";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================================
// SYSTEM PROMPT — PASS 1 (Verbatim + Structural Reasoning)
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
- Output text mentah saja, tanpa code fence \`\`\`.

═══════════════════════════════════════════════
PRINSIP:
═══════════════════════════════════════════════
Kalau ragu soal MAKNA → JANGAN reasoning, tulis verbatim.
Kalau ragu soal STRUKTUR (merged cell, layout) → WAJIB reasoning, propagate dengan benar.
Lebih baik output "kotor sedikit tapi setia + struktur benar" daripada "rapi tapi salah propagate cell".`;

// ============================================================
// SYSTEM PROMPT — PASS 2 (Selective Merged-Cell Audit Only)
// ============================================================
const SYSTEM_PROMPT_PASS2 = `Anda adalah AUDITOR TABEL MERGED-CELL (Pass 2).

TUGAS TUNGGAL:
Periksa output Pass 1 vs image asli. Cari field yang ditulis \`(kosong)\` atau \`—\` yang
SEBENARNYA dicakup merged cell / shared cell di image. Perbaiki HANYA cell tersebut.

═══════════════════════════════════════════════
DILARANG KERAS:
═══════════════════════════════════════════════
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

═══════════════════════════════════════════════
HANYA BOLEH:
═══════════════════════════════════════════════
- Mengganti \`(kosong)\` atau \`—\` di field yang TERBUKTI dicakup merged cell di image.
- Nilai pengganti = VERBATIM dari merged cell di image (jangan normalize).

═══════════════════════════════════════════════
PROSEDUR:
═══════════════════════════════════════════════
1. Untuk SETIAP field suspect yang dilaporkan, lihat image:
   - Cek visual grid: apakah cell di posisi (row, kolom) itu dicakup rowspan/colspan?
   - Kalau YA → ambil nilai dari merged cell, tulis verbatim.
   - Kalau TIDAK → biarkan \`(kosong)\`.

2. Output FORMAT:
   Kembalikan FULL output Pass 1 yang sudah diperbaiki — character-identik dengan input
   kecuali cell-cell suspect yang berhasil diisi dari merged cell.

3. JANGAN tambah komentar, JANGAN tambah preamble, JANGAN tulis "berikut hasil audit:".
   Langsung output text final saja, tanpa code fence.

PRINSIP: Minimum-diff repair. Kalau ragu → jangan ubah.`;

// ============================================================
// SUSPECT DETECTOR — Pure regex/string analysis on Pass 1 output
// ============================================================
interface SuspectReport {
  trigger: boolean;
  blockCount: number;
  emptyFields: Array<{ blockIndex: number; blockTitle: string; field: string }>;
  suspectFields: string[]; // unique field names that have empty in some rows AND value in others
}

function detectSuspectMergedCells(output: string): SuspectReport {
  const report: SuspectReport = { trigger: false, blockCount: 0, emptyFields: [], suspectFields: [] };

  // Split into numbered blocks: lines starting with "N. " (1-indexed)
  // Block boundary = blank line followed by "N. " OR start of file.
  const lines = output.split("\n");
  type Block = { index: number; title: string; fields: Map<string, string> };
  const blocks: Block[] = [];
  let current: Block | null = null;

  const blockHeaderRe = /^(\d+)\.\s+(.+?)\s*$/;
  // Field line: indented, "FIELD NAME: value"
  const fieldRe = /^\s+([A-Za-z][A-Za-z0-9 _\-/()]*?):\s*(.*)$/;

  for (const line of lines) {
    const bh = blockHeaderRe.exec(line);
    if (bh) {
      if (current) blocks.push(current);
      current = { index: parseInt(bh[1], 10), title: bh[2].trim(), fields: new Map() };
      continue;
    }
    if (current) {
      const f = fieldRe.exec(line);
      if (f) {
        const fname = f[1].trim();
        const fval = f[2].trim();
        // Only first occurrence per block
        if (!current.fields.has(fname)) current.fields.set(fname, fval);
      }
    }
  }
  if (current) blocks.push(current);

  report.blockCount = blocks.length;
  if (blocks.length < 2) return report;

  // Aggregate per-field: which rows are empty, which have values
  const fieldStats = new Map<string, { empty: number[]; filled: number[] }>();
  const isEmpty = (v: string) =>
    v === "" || /^\(kosong\)$/i.test(v) || v === "—" || v === "-" || /^n\/?a$/i.test(v);

  for (const b of blocks) {
    for (const [fname, fval] of b.fields.entries()) {
      if (!fieldStats.has(fname)) fieldStats.set(fname, { empty: [], filled: [] });
      const st = fieldStats.get(fname)!;
      if (isEmpty(fval)) {
        st.empty.push(b.index);
        report.emptyFields.push({ blockIndex: b.index, blockTitle: b.title, field: fname });
      } else {
        st.filled.push(b.index);
      }
    }
  }

  for (const [fname, st] of fieldStats.entries()) {
    if (st.empty.length > 0 && st.filled.length > 0) {
      report.suspectFields.push(fname);
    }
  }

  report.trigger = report.suspectFields.length > 0;
  return report;
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
  const resp = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens,
      temperature: 0,
      system: opts.system,
      messages: [{ role: "user", content: opts.content }],
    }),
  });

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

    // Build image content blocks (reused for Pass 1 and Pass 2)
    const imageBlocks: any[] = [];
    if (Array.isArray(images)) {
      for (const img of images) {
        const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(img);
        if (!match) continue;
        imageBlocks.push({
          type: "image",
          source: { type: "base64", media_type: match[1], data: match[2] },
        });
      }
    }

    const hasImage = imageBlocks.length > 0;

    // ============= PASS 1 =============
    const pass1Content: any[] = [...imageBlocks];
    pass1Content.push({
      type: "text",
      text: text.trim()
        ? `Input promo mentah dari user (text + ${imageBlocks.length} image):\n\n${text.trim()}\n\nIngat: Mode A+ STRICT VERBATIM untuk wording, tapi WAJIB structural reasoning untuk merged cell di tabel image.`
        : `Tidak ada text input. Gunakan ${imageBlocks.length} image di atas sebagai sumber tunggal. Mode A+ STRICT VERBATIM untuk wording. WAJIB structural reasoning untuk merged cell.`,
    });

    const pass1 = await callAnthropic({
      model: MODEL_PASS1,
      system: SYSTEM_PROMPT_PASS1,
      content: pass1Content,
      maxTokens: 4000,
    });
    if (!pass1.ok) return mapAnthropicError(pass1.status, pass1.errBody);

    let finalOutput = pass1.text;
    let pass2Triggered = false;
    let pass2Reason = "";
    let suspectReport: SuspectReport | null = null;

    // ============= PASS 2 (selective audit) =============
    if (hasImage) {
      suspectReport = detectSuspectMergedCells(pass1.text);
      if (suspectReport.trigger) {
        pass2Triggered = true;
        pass2Reason = `Detected ${suspectReport.suspectFields.length} suspect field(s) with mixed empty/filled values across ${suspectReport.blockCount} blocks.`;

        const suspectListText = suspectReport.suspectFields
          .map((f) => `  - "${f}"`)
          .join("\n");
        const emptyCellListText = suspectReport.emptyFields
          .filter((e) => suspectReport!.suspectFields.includes(e.field))
          .map((e) => `  - Block #${e.blockIndex} ("${e.blockTitle}") → field "${e.field}" = (kosong)`)
          .join("\n");

        const pass2Content: any[] = [...imageBlocks];
        pass2Content.push({
          type: "text",
          text: `=== OUTPUT PASS 1 (verbatim) ===
${pass1.text}

=== AUDIT TASK ===
Field-field berikut punya nilai di sebagian row tapi (kosong) di row lain — kemungkinan
artifact merged-cell tidak ter-propagate. WAJIB cek image untuk setiap cell suspect.

Field suspect:
${suspectListText}

Cell suspect (yang ditulis kosong di Pass 1):
${emptyCellListText}

Untuk SETIAP cell suspect, lihat image:
- Kalau cell visual di posisi itu dicakup merged/shared cell (rowspan/colspan) → ganti
  (kosong) dengan nilai verbatim dari merged cell.
- Kalau tidak → biarkan (kosong).

JANGAN ubah apapun selain cell-cell di atas. Output FULL dokumen Pass 1 dengan
hanya cell suspect yang diperbaiki. Tanpa preamble, tanpa komentar, tanpa code fence.`,
        });

        const pass2 = await callAnthropic({
          model: MODEL_PASS2,
          system: SYSTEM_PROMPT_PASS2,
          content: pass2Content,
          maxTokens: 4000,
        });

        if (pass2.ok && pass2.text.trim().length > 0) {
          finalOutput = pass2.text;
        } else if (!pass2.ok) {
          // Pass 2 failed → keep Pass 1 output, log reason
          pass2Reason += ` | Pass 2 call failed (status ${pass2.status}); keeping Pass 1 output.`;
          console.warn("[parser] Pass 2 failed:", pass2.status, pass2.errBody);
        }
      }
    }

    return new Response(
      JSON.stringify({
        output: finalOutput,
        debug: {
          pass2Triggered,
          pass2Reason,
          suspectFields: suspectReport?.suspectFields ?? [],
          blockCount: suspectReport?.blockCount ?? 0,
          modelPass1: MODEL_PASS1,
          modelPass2: pass2Triggered ? MODEL_PASS2 : null,
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
