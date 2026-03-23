/**
 * PROMO PRE-PROCESSOR
 *
 * Tujuan: Reduce noise dari raw promo input sebelum masuk ke Reject Gate.
 * Rules:
 * - Deterministik, no LLM
 * - Tidak mengubah makna konten
 * - Kalau ragu apakah sesuatu boleh di-strip — JANGAN strip
 * - Output selalu string
 *
 * @version 1.0
 */

/**
 * Preprocess raw promo input string.
 * Input: dirty string from user paste / scraper
 * Output: cleaner string (same meaning, less noise)
 */
export function preprocessPromoInput(raw: string): string {
  let text = raw;

  // 1. Strip emoji (unicode ranges)
  text = text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');

  // 2. Strip "Tanggal akhir" line
  text = text.replace(/tanggal akhir\s*:\s*[^\n]*/gi, '');

  // 3. Strip legal boilerplate — anchor dari kata kunci yang selalu ada
  text = text.replace(/[^\n]*bersifat mutlak[^\n]*/gi, '');
  text = text.replace(/[^\n]*tidak dapat diganggu gugat[^\n]*/gi, '');
  text = text.replace(/[^\n]*dapat berubah sewaktu-waktu tanpa pemberitahuan[^\n]*/gi, '');
  text = text.replace(/[^\n]*syarat[^\n]{0,30}dapat berubah[^\n]*/gi, '');

  // 4. Strip fraud warning standar — relaxed distance untuk accommodate brand names
  text = text.replace(/[^\n]*jika ditemukan[^\n]{0,150}berhak membatalkan[^\n]*/gi, '');
  text = text.replace(/[^\n]*indikasi kecurangan[^\n]*/gi, '');

  // 5. Strip separator dekoratif
  text = text.replace(/^[-=*]{3,}$/gm, '');

  // 6. Normalize angka Indonesia — HANYA yang jelas thousand separator
  // Format: digit.digit.digit (titik sebagai thousand separator, bukan desimal)
  text = text.replace(/\b(\d{1,3})\.(\d{3})\.(\d{3})\b/g, '$1$2$3');
  text = text.replace(/\b(\d{1,3})\.(\d{3})\b(?!\s*%)/g, '$1$2');

  // 7. Normalize ❌ sebagai bullet → "-" (preserve content setelah ❌)
  text = text.replace(/❌\s*/g, '- ');

  // 8. Normalize arrow symbols
  text = text.replace(/→/g, '->');
  text = text.replace(/–/g, '-');

  // 9. Collapse multiple blank lines
  text = text.replace(/\n{3,}/g, '\n\n');

  // 10. Trim each line (remove leading whitespace artifacts), then trim overall
  text = text.split('\n').map(line => line.trimStart()).join('\n');
  text = text.trim();

  return text;
}
