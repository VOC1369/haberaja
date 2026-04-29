/**
 * PROMO PRESENTATION POLISHER
 *
 * Tujuan: merapikan TAMPILAN hasil parser tanpa mengubah ISI/MAKNA.
 *
 * Architecture: Hybrid 2-step
 *   Step 1 (deterministik) — auto-jalan, no LLM, idempoten, ringan
 *   Step 2 (LLM enhance)  — manual via tombol Enhance, dengan integrity guardrail
 *
 * RULES — what polisher MAY do:
 *   - Hapus heading/judul duplikat persis
 *   - Normalize spacing (collapse trailing spaces, normalize blank lines)
 *   - Konsistenkan bullet (•, *, ·, ○ → -)
 *   - Konsistenkan numbering style
 *   - Beri jarak antar section/blok
 *   - Trim line whitespace
 *
 * RULES — what polisher MUST NEVER do:
 *   - Ubah angka, persentase, Rp, turnover, tanggal
 *   - Ubah/hapus nama provider/game
 *   - Tambah informasi baru
 *   - Inferensi / rewriting / summarisation
 *
 * Integrity check: extract semua "data tokens" (angka, %, Rp, dates, brand keywords)
 * dari raw vs polished. Kalau set berbeda → polished invalid → fallback raw.
 */

// ============================================================
// STEP 1 — DETERMINISTIC CLEANER
// ============================================================

export function deterministicPolish(raw: string): string {
  if (!raw || typeof raw !== "string") return raw;

  let text = raw;

  // 1. Normalize line endings
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 2. Trim trailing spaces per line
  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");

  // 3. Normalize bullet markers → "-"
  //    Cover: •, ●, ○, ·, *, ▪, ▫, ✦, ✓, ❖, ►, »
  text = text.replace(/^[ \t]*[•●○·▪▫✦❖►»][ \t]+/gm, "- ");
  //    Asterisk bullet (only when used as bullet, not bold marker)
  text = text.replace(/^[ \t]*\*[ \t]+(?!\*)/gm, "- ");

  // 4. Normalize numbering: "1)" / "1." → "1." (consistent dot style)
  text = text.replace(/^([ \t]*)(\d+)\)[ \t]+/gm, "$1$2. ");

  // 5. Hapus duplikat heading berturut-turut (dua baris identik non-kosong)
  //    Contoh:
  //      WELCOME BONUS UP TO Rp 15.000.000
  //      WELCOME BONUS HINGGA Rp 15.000.000
  //    HANYA hapus jika identik EXACT (bukan paraphrase) — kita tidak boleh menebak.
  text = dedupeConsecutiveIdenticalLines(text);

  // 6. Collapse 3+ blank lines → 2
  text = text.replace(/\n{3,}/g, "\n\n");

  // 7. Tambah blank line sebelum heading numerik major (1. , 2. , dst di awal baris)
  //    HANYA kalau line sebelumnya bukan kosong.
  text = addBlankLineBeforeMajorNumbering(text);

  // 8. Trim overall
  text = text.trim();

  return text;
}

function dedupeConsecutiveIdenticalLines(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let prevNormalized = "";
  for (const line of lines) {
    const norm = line.trim().toLowerCase();
    if (norm !== "" && norm === prevNormalized) {
      // skip duplicate
      continue;
    }
    out.push(line);
    prevNormalized = norm;
  }
  return out.join("\n");
}

function addBlankLineBeforeMajorNumbering(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isMajorHeading = /^\d+\.[ \t]+[A-ZÀ-Ÿ]/.test(line); // "1. WELCOME …"
    if (isMajorHeading && out.length > 0) {
      const prev = out[out.length - 1];
      if (prev.trim() !== "") out.push("");
    }
    out.push(line);
  }
  return out.join("\n");
}

// ============================================================
// INTEGRITY CHECK (DATA TOKEN EXTRACTION)
// ============================================================

export interface IntegrityReport {
  ok: boolean;
  missingInPolished: string[]; // tokens yang ada di raw, hilang di polished
  addedInPolished: string[]; // tokens baru di polished (pollisher mengarang)
  reason?: string;
}

/**
 * Extract "sensitive data tokens" from text:
 *  - Currency amounts (Rp 15.000.000, IDR, USD, RM, $)
 *  - Percentages (50%, 28%)
 *  - Multipliers / turnover (20x, 25x)
 *  - Standalone numbers >= 3 digits (deposit min, etc.)
 *  - Dates (DD-MMM-YYYY, DD/MM/YYYY)
 *  - Capitalized words 4+ chars (likely provider/game/brand names)
 */
export function extractDataTokens(text: string): Set<string> {
  const tokens = new Set<string>();
  if (!text) return tokens;

  // Currency: Rp / IDR / USD / RM / $ + amount (keep digits + separators)
  const currencyRe = /\b(?:Rp\.?|IDR|USD|RM|\$)\s*[\d.,]+/gi;
  for (const m of text.match(currencyRe) || []) {
    tokens.add(normalizeNumericToken(m));
  }

  // Percentages
  const pctRe = /\b\d+(?:[.,]\d+)?\s*%/g;
  for (const m of text.match(pctRe) || []) {
    tokens.add(m.replace(/\s+/g, "").toLowerCase());
  }

  // Multipliers (turnover): 20x, 25x, x20
  const multRe = /\b(?:\d+\s*x|x\s*\d+)\b/gi;
  for (const m of text.match(multRe) || []) {
    tokens.add(m.replace(/\s+/g, "").toLowerCase());
  }

  // Standalone numbers >= 3 digits (with separators)
  const numRe = /\b\d{1,3}(?:[.,]\d{3})+\b|\b\d{3,}\b/g;
  for (const m of text.match(numRe) || []) {
    tokens.add(`#${m.replace(/[.,]/g, "")}`);
  }

  // Dates: DD-MMM-YYYY, DD/MM/YYYY, DD-MM-YYYY
  const dateRe = /\b\d{1,2}[-/](?:\d{1,2}|[A-Za-z]{3,9})[-/]\d{2,4}\b/g;
  for (const m of text.match(dateRe) || []) {
    tokens.add(`@${m.toLowerCase()}`);
  }

  // ALL-CAPS words 3+ chars (likely brand / category / provider)
  const capsRe = /\b[A-Z]{3,}[A-Z0-9]*\b/g;
  for (const m of text.match(capsRe) || []) {
    tokens.add(`!${m}`);
  }

  return tokens;
}

function normalizeNumericToken(s: string): string {
  return s
    .replace(/\s+/g, "")
    .replace(/[.,]/g, "")
    .toLowerCase();
}

// ============================================================
// STEP 2 — POLISH LEVEL 2 (DETERMINISTIC, OPT-IN VIA "RESTRUCTURE")
// ============================================================
//
// Allowed:
//   1. Dedupe field-vs-title (e.g. baris "KODE PROMOSI: WELCOME 50%" tepat
//      di bawah judul "1. WELCOME 50% — CASINO" → drop baris field redundan).
//   2. Bold field labels (e.g. "KODE PROMOSI:" → "**KODE PROMOSI:**").
//   3. Conservative header injection — HANYA jika sinyal sangat eksplisit:
//      - Baris yang isinya "Contoh Perhitungan" / "Contoh Perhitungan Bonus"
//        → diganti jadi "## CONTOH PERHITUNGAN".
//      - Baris yang isinya "Syarat dan Ketentuan" / "S&K" → "## SYARAT DAN KETENTUAN".
//      - Header "## PAKET BONUS" hanya disisipkan kalau ada >= 2 numbered
//        bonus blocks ("1. ... KODE PROMOSI", "2. ... KODE PROMOSI", dst).
//
// Tetap diintegrity-check di pemanggil. Tidak menambah/menghapus data tokens.

const FIELD_LABELS = [
  "KODE PROMOSI",
  "KATEGORI",
  "MINIMAL DEPOSIT",
  "MINIMUM DEPOSIT",
  "MAKSIMAL BONUS",
  "MAKSIMUM BONUS",
  "MAX BONUS",
  "TURNOVER",
  "TO",
  "PERSENTASE BONUS",
  "BONUS",
  "PERIODE",
  "PROVIDER",
  "GAME",
  "SYARAT",
];

function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9% ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeFieldVsTitle(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let currentTitleNorm = "";

  for (const line of lines) {
    // Detect "major" title line: "1. WELCOME BONUS …" (numbered + caps-ish)
    const titleMatch = /^\s*\d+\.\s+(.+)$/.exec(line);
    if (titleMatch && /[A-ZÀ-Ÿ]{2,}/.test(titleMatch[1])) {
      currentTitleNorm = normalizeForCompare(titleMatch[1]);
      out.push(line);
      continue;
    }

    // Detect "FIELD: value" line
    const fieldMatch = /^\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿ &/]{2,}?)\s*:\s*(.+?)\s*$/.exec(line);
    if (fieldMatch && currentTitleNorm) {
      const value = fieldMatch[2];
      const valueNorm = normalizeForCompare(value);
      // Drop only if the field VALUE is contained in (or equals) the title.
      // Conservative: require valueNorm length >= 4 to avoid false positives.
      if (
        valueNorm.length >= 4 &&
        (currentTitleNorm === valueNorm || currentTitleNorm.includes(valueNorm))
      ) {
        continue; // drop redundant field
      }
    }

    out.push(line);
  }

  return out.join("\n");
}

function boldFieldLabels(text: string): string {
  // Only at line start; capture optional leading spaces.
  const labelAlt = FIELD_LABELS.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`^([ \\t]*)(${labelAlt})\\s*:`, "gm");
  return text.replace(re, (_m, lead, label) => `${lead}**${label}:**`);
}

function injectExplicitHeaders(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const norm = trimmed.toLowerCase().replace(/[:.\-–—]+$/g, "").trim();

    if (
      norm === "contoh perhitungan" ||
      norm === "contoh perhitungan bonus" ||
      norm === "contoh kalkulasi"
    ) {
      out.push("## CONTOH PERHITUNGAN");
      continue;
    }
    if (
      norm === "syarat dan ketentuan" ||
      norm === "syarat & ketentuan" ||
      norm === "s&k" ||
      norm === "syarat ketentuan" ||
      norm === "terms and conditions"
    ) {
      out.push("## SYARAT DAN KETENTUAN");
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

function injectPaketBonusHeader(text: string): string {
  // Count "numbered bonus blocks" — heuristic:
  //   line matches /^\s*\d+\.\s+.+/ AND within ~6 lines after has "KODE PROMOSI"
  const lines = text.split("\n");
  const numberedIdx: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\d+\.\s+\S/.test(lines[i])) {
      // look-ahead for KODE PROMOSI within next 6 lines
      const window = lines.slice(i + 1, i + 7).join("\n");
      if (/KODE\s+PROMOSI/i.test(window) || /KODE\s+PROMOSI/i.test(lines[i])) {
        numberedIdx.push(i);
      }
    }
  }
  if (numberedIdx.length < 2) return text;

  const insertAt = numberedIdx[0];
  // Avoid double-insert if previous non-empty line already a header
  for (let j = insertAt - 1; j >= 0; j--) {
    const t = lines[j].trim();
    if (t === "") continue;
    if (/^##\s+PAKET BONUS/i.test(t)) return text;
    break;
  }
  const before = lines.slice(0, insertAt);
  const after = lines.slice(insertAt);
  const sep = before.length > 0 && before[before.length - 1].trim() !== "" ? [""] : [];
  return [...before, ...sep, "## PAKET BONUS", "", ...after].join("\n");
}

export function polishLevel2(text: string): string {
  if (!text || typeof text !== "string") return text;
  let t = text;
  t = dedupeFieldVsTitle(t);
  t = injectExplicitHeaders(t);
  t = injectPaketBonusHeader(t);
  t = boldFieldLabels(t);
  // collapse stray triple blank lines that may appear after dedupe
  t = t.replace(/\n{3,}/g, "\n\n").trim();
  return t;
}

export function checkIntegrity(raw: string, polished: string): IntegrityReport {
  const rawTokens = extractDataTokens(raw);
  const polTokens = extractDataTokens(polished);

  const missing: string[] = [];
  const added: string[] = [];

  for (const t of rawTokens) {
    if (!polTokens.has(t)) missing.push(t);
  }
  for (const t of polTokens) {
    if (!rawTokens.has(t)) added.push(t);
  }

  const ok = missing.length === 0 && added.length === 0;
  return {
    ok,
    missingInPolished: missing,
    addedInPolished: added,
    reason: ok
      ? undefined
      : missing.length > 0
        ? `${missing.length} data token hilang di hasil polish`
        : `${added.length} data token baru muncul (kemungkinan inferensi)`,
  };
}

// ============================================================
// LEVEL 2 INTEGRITY HELPERS
// ============================================================

/**
 * Strip Level-2 polish markup before integrity comparison so that headers
 * and bold markers don't pollute the data token set.
 *  - "## CONTOH PERHITUNGAN" / "## SYARAT DAN KETENTUAN" / "## PAKET BONUS"
 *    → removed entirely (these are presentation-only injected headers).
 *  - "**LABEL:**" → "LABEL:" (strip bold).
 */
export function stripPolishMarkup(text: string): string {
  if (!text) return text;
  let t = text;
  t = t.replace(
    /^[ \t]*##\s+(CONTOH PERHITUNGAN|SYARAT DAN KETENTUAN|PAKET BONUS)[ \t]*$/gm,
    "",
  );
  t = t.replace(/\*\*(.+?)\*\*/g, "$1");
  return t;
}

/**
 * Integrity check tailored for Level-2 polish output: strips injected
 * markup before comparing data tokens against the raw baseline.
 */
export function checkIntegrityLevel2(raw: string, polished: string): IntegrityReport {
  return checkIntegrity(raw, stripPolishMarkup(polished));
}
