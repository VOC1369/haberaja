/**
 * APBE Error Dictionary v1.0
 * 
 * Dual-Layer Error Messaging System:
 * - CODE LEVEL: Tetap pakai notasi teknis (C.boundary_rules, O.complaints, dll)
 * - UI LEVEL: Tampilkan bahasa manusia yang mudah dipahami user
 * 
 * Total: 47 Error Mappings
 */

// ============================================
// CRITICAL ERROR MAPPINGS (Tier 1 - Red)
// ============================================
export const UI_ERROR_MESSAGES: Record<string, string> = {
  // === C Block - Communication Engine ===
  "C.boundary_rules": "Aturan batasan perilaku AI belum dibuat. Tentukan apa saja yang tidak boleh dilakukan AI.",
  "C.boundary_rules.missing_preset": "Beberapa batasan standar belum diisi (bonus, internal, transaksi, kompetitor).",
  "C.empathy": "Nilai Empathy belum dipilih.",
  "C.persuasion": "Nilai Persuasion belum dipilih.",
  "C.humor_usage": "Pengaturan penggunaan humor belum dipilih.",
  
  // === C.boundary_rules.* - Boundary Rule Presets ===
  "C.boundary_rules.never_promise_money": 'Aturan batasan: "AI tidak boleh menjanjikan bonus/uang" belum diaktifkan.',
  "C.boundary_rules.never_confirm_transactions": 'Aturan batasan: "AI tidak boleh mengonfirmasi transaksi" belum diaktifkan.',
  "C.boundary_rules.never_share_internal_info": 'Aturan batasan: "Jangan bocorkan info internal" belum diatur.',
  "C.boundary_rules.never_discuss_competitors": 'Aturan: "Jangan bahas kompetitor" belum diberikan.',
  "C.boundary_rules.custom_boundaries.empty": "Tambahkan minimal satu batasan tambahan jika diperlukan.",
  
  
  // === O Block - Operational SOP: Crisis ===
  "O.crisis.tone": "Nada krisis belum diatur. Pilih nada tanggapan saat user marah.",
  "O.crisis.dictionary_red": "Daftar kata kasar berat (Level 3) belum diisi.",
  "O.crisis.dictionary_yellow": "Daftar kata kasar ringan/sedang belum diisi.",
  "O.crisis.toxic_severity": "Mapping level toksisitas belum lengkap. Isi kata-kata untuk setiap level: Ringan (1), Sedang (2), dan Berat (3).",
  "O.crisis.toxic_severity.array": "Mapping level toksisitas belum lengkap. Isi kata-kata untuk setiap level: Ringan (1), Sedang (2), dan Berat (3).",
  "O.crisis.toxic_severity.level_1_missing": "Level 1 toksisitas (Ringan) kosong. Isi kata untuk kategori ringan.",
  "O.crisis.toxic_severity.level_2_missing": "Level 2 toksisitas (Sedang) kosong. Isi kata untuk kategori sedang.",
  "O.crisis.toxic_severity.level_3_missing": "Level 3 toksisitas (Berat) kosong. Isi kata untuk kategori berat.",
  "O.crisis.templates": "Template krisis (respons marah) belum diisi. Minimal isi semua template wajib.",
  "O.crisis.templates.missing": "Template krisis (respons marah) belum diisi. Minimal isi semua template wajib.",
  "O.crisis.templates.low_quality": "Template krisis tidak memenuhi standar kualitas. Pastikan minimal 30 karakter dan gunakan personalisasi {{A.call_to_player}}.",
  "O.crisis.templates.quality": "Template krisis tidak memenuhi standar kualitas. Pastikan minimal 30 karakter dan gunakan personalisasi {{A.call_to_player}}.",
  
  // === O Block - Anti-Hunter (moved from B Block) ===
  "O.anti_hunter.rules.empty": "Belum ada aturan anti-bonus hunter. Buat minimal satu aturan.",
  "O.anti_hunter.patterns_empty": "Setiap aturan anti-hunter wajib memiliki minimal 1 pola deteksi.",
  // B.financial.* errors removed - feature deprecated
  
  // === V Block - VIP Logic ===
  "V.active_missing_fields": "Jika VIP diaktifkan, greeting dan closing khusus wajib diisi.",
  "V.threshold_missing": "Syarat threshold VIP belum diatur.",
  "V.svip_rules_empty": "Minimal satu aturan SVIP harus dibuat.",
  
  // === A Block - Brand Identity ===
  "A.group_name": "Nama grup brand (internal metadata) belum diisi. Field ini wajib tapi tidak akan muncul ke player.",
  "A.website_name": "Nama website belum diisi.",
  "A.slogan": "Slogan belum diisi.",
  "A.archetype": "Archetype belum dipilih.",
  "A.lokasi": "Lokasi/Region belum dipilih.",
  "A.call_to_player": "Sapaan ke player belum diisi.",
  
  // === L Block - Interaction Library ===
  "L.greetings": "Sapaan belum lengkap. Isi sapaan pagi/siang/sore/malam.",
  "L.closings": "Template penutup belum diisi lengkap.",
  "L.empathy_phrases": "Frasa empati minimal 3 belum diisi.",
  "L.apologies": "Template maaf belum diisi lengkap.",
};

// ============================================
// WARNING MAPPINGS (Tier 2 - Yellow)
// ============================================
export const UI_WARNING_MESSAGES: Record<string, string> = {
  // C Block Warnings
  "C.boundary_rules.all_off": "Semua aturan batasan dimatikan. AI tidak memiliki batasan perilaku aktif.",
  
  // O Block Warnings  
  "O.toxic_severity.level_empty": "Salah satu level toksisitas kosong. Tambahkan kata untuk deteksi yang lebih baik.",
  "O.toxic_severity.overlap": "Ada kata yang sama di beberapa level toksisitas. Ini bisa menyebabkan konflik.",
  "O.crisis.dictionary_red.empty": "Kamus kata merah (terlarang) kosong. AI tetap bisa jalan tapi kurang kaya.",
  "O.crisis.dictionary_yellow.empty": "Kamus kata kuning (peringatan) kosong.",
  
  
  // O Block Warnings - Anti-Hunter (moved from B Block)
  "O.anti_hunter.empty_rules": "Anti-hunter aktif tapi tidak ada pola yang dikonfigurasi. Tambahkan minimal 1 aturan.",
  // B.financial.* warnings removed - feature deprecated
  
  // V Block Warnings
  "V.tone_modifiers.default": "Tone modifier VIP menggunakan nilai default. Sesuaikan untuk pengalaman VIP yang lebih baik.",
  "V.svip_rules.incomplete": "Beberapa aturan SVIP belum lengkap.",
  
  // L Block Warnings
  "L.greetings.few": "Variasi sapaan masih sedikit. Tambahkan lebih banyak untuk interaksi lebih natural.",
  "L.closings.few": "Variasi penutup masih sedikit.",
  "L.empathy_phrases.few": "Frasa empati masih sedikit. Tambahkan variasi untuk respons lebih empatik.",
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract technical code from validator error message
 * Maps error text patterns to canonical code keys
 */
export function extractErrorCode(errorMessage: string): string | null {
  const msg = errorMessage.toLowerCase();
  
  // === C Block - Communication Engine ===
  if (msg.includes("boundary_rules") && msg.includes("off")) return "C.boundary_rules.all_off";
  if (msg.includes("boundary_rules") && msg.includes("preset")) return "C.boundary_rules.missing_preset";
  if (msg.includes("boundary_rules") && msg.includes("promise_money")) return "C.boundary_rules.never_promise_money";
  if (msg.includes("boundary_rules") && msg.includes("confirm_transaction")) return "C.boundary_rules.never_confirm_transactions";
  if (msg.includes("boundary_rules") && msg.includes("internal_info")) return "C.boundary_rules.never_share_internal_info";
  if (msg.includes("boundary_rules") && msg.includes("competitor")) return "C.boundary_rules.never_discuss_competitors";
  if (msg.includes("boundary_rules") && msg.includes("custom")) return "C.boundary_rules.custom_boundaries.empty";
  if (msg.includes("boundary_rules")) return "C.boundary_rules";
  if (msg.includes("empathy") && !msg.includes("phrases")) return "C.empathy";
  if (msg.includes("persuasion")) return "C.persuasion";
  if (msg.includes("humor_usage") || msg.includes("humor")) return "C.humor_usage";
  
  
  // === O Block - Crisis ===
  if (msg.includes("crisis") && msg.includes("tone")) return "O.crisis.tone";
  if (msg.includes("dictionary_red") || (msg.includes("dictionary") && msg.includes("red"))) return "O.crisis.dictionary_red";
  if (msg.includes("dictionary_yellow") || (msg.includes("dictionary") && msg.includes("yellow"))) return "O.crisis.dictionary_yellow";
  if (msg.includes("toxic_severity") && msg.includes("level_1") && !msg.includes("level_2")) return "O.crisis.toxic_severity.level_1_missing";
  if (msg.includes("toxic_severity") && msg.includes("level_2") && !msg.includes("level_1")) return "O.crisis.toxic_severity.level_2_missing";
  if (msg.includes("toxic_severity") && msg.includes("level_3") && !msg.includes("level_1")) return "O.crisis.toxic_severity.level_3_missing";
  if (msg.includes("toxic_severity") && msg.includes("array")) return "O.crisis.toxic_severity.array";
  if (msg.includes("toxic_severity") && (msg.includes("wajib") || msg.includes("level_1") && msg.includes("level_2"))) return "O.crisis.toxic_severity.array";
  if (msg.includes("toxic_severity") && msg.includes("overlap")) return "O.toxic_severity.overlap";
  if (msg.includes("toxic_severity")) return "O.crisis.toxic_severity";
  if (msg.includes("crisis") && msg.includes("templates") && (msg.includes("quality") || msg.includes("kualitas") || msg.includes("gagal validasi"))) return "O.crisis.templates.quality";
  if (msg.includes("crisis") && msg.includes("templates")) return "O.crisis.templates";
  
  // === O Block - Anti-Hunter (moved from B Block) ===
  if (msg.includes("anti_hunter") && msg.includes("rules") && msg.includes("empty")) return "O.anti_hunter.rules.empty";
  if (msg.includes("anti_hunter") && msg.includes("patterns")) return "O.anti_hunter.patterns_empty";
  if (msg.includes("anti_hunter") && msg.includes("aktif")) return "O.anti_hunter.empty_rules";
  // B.financial.* matching removed - feature deprecated
  
  // === V Block - VIP ===
  if (msg.includes("vip") && msg.includes("greeting") && msg.includes("closing")) return "V.active_missing_fields";
  if (msg.includes("threshold") && msg.includes("vip")) return "V.threshold_missing";
  if (msg.includes("svip") && msg.includes("rules")) return "V.svip_rules_empty";
  if (msg.includes("tone_modifiers") && msg.includes("vip")) return "V.tone_modifiers.default";
  
  // === A Block - Brand Identity ===
  if (msg.includes("group_name")) return "A.group_name";
  if (msg.includes("website_name")) return "A.website_name";
  if (msg.includes("slogan")) return "A.slogan";
  if (msg.includes("archetype")) return "A.archetype";
  if (msg.includes("lokasi") || msg.includes("region")) return "A.lokasi";
  if (msg.includes("call_to_player")) return "A.call_to_player";
  
  // === L Block - Interaction Library ===
  if (msg.includes("greetings") && msg.includes("few")) return "L.greetings.few";
  if (msg.includes("greetings")) return "L.greetings";
  if (msg.includes("closings") && msg.includes("few")) return "L.closings.few";
  if (msg.includes("closings")) return "L.closings";
  if (msg.includes("empathy_phrases") && msg.includes("few")) return "L.empathy_phrases.few";
  if (msg.includes("empathy_phrases")) return "L.empathy_phrases";
  if (msg.includes("apologies")) return "L.apologies";
  
  return null;
}

/**
 * Get user-friendly message from technical error
 * Falls back to original message if no mapping found
 */
export function getUIFriendlyError(technicalError: string): string {
  const code = extractErrorCode(technicalError);
  
  if (code) {
    // Check critical errors first
    if (UI_ERROR_MESSAGES[code]) {
      return UI_ERROR_MESSAGES[code];
    }
    // Then check warnings
    if (UI_WARNING_MESSAGES[code]) {
      return UI_WARNING_MESSAGES[code];
    }
  }
  
  // Fallback: return original with [X] block prefix removed for cleaner display
  return technicalError.replace(/^\[[A-Za-z.]+\]\s*/, "").trim();
}

/**
 * Get technical code for tooltip display (power users)
 */
export function getTechnicalCode(technicalError: string): string | null {
  return extractErrorCode(technicalError);
}

/**
 * Check if error is a critical error (Tier 1)
 */
export function isCriticalError(code: string): boolean {
  return code in UI_ERROR_MESSAGES;
}

/**
 * Check if error is a warning (Tier 2)
 */
export function isWarning(code: string): boolean {
  return code in UI_WARNING_MESSAGES;
}
