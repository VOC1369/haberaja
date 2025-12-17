/**
 * Promo Guard Rules - Single Source of Truth
 * Authority boundary & wording discipline untuk AI layer
 * 
 * @version 1.0.0
 * @description Guard rules untuk mencegah AI melakukan hal-hal yang seharusnya
 *              dilakukan oleh sistem internal atau human agent.
 */

// ============================================================================
// GUARD RULE CONSTANTS
// ============================================================================

/**
 * Formula Guard - Formula adalah DESKRIPTIF, bukan executable
 */
export const FORMULA_GUARD = {
  key: 'formula_descriptive',
  title: 'Formula = Deskriptif',
  description: 'Formula adalah deskripsi aturan, BUKAN kalkulator yang dieksekusi.',
  rules: [
    'AI tidak boleh menghitung hasil formula',
    'Formula hanya menjelaskan BAGAIMANA reward dihitung',
    'Hasil akhir ditentukan oleh sistem internal saat klaim',
  ],
  forbidden_phrases: [
    'kamu akan dapat',
    'bonus kamu adalah',
    'hasil perhitungan',
    'total reward kamu',
  ],
} as const;

/**
 * Tier Guard - Tier ditentukan saat klaim oleh sistem
 */
export const TIER_GUARD = {
  key: 'tier_system_determined',
  title: 'Tier = Referensi, Bukan Decision Table',
  description: 'Tier ditentukan saat klaim oleh sistem internal, bukan oleh AI.',
  rules: [
    'AI tidak boleh mengklaim tier final user',
    'Tabel tier hanya sebagai REFERENSI',
    'VIP multiplier dihitung oleh sistem, bukan AI',
    'Level up rewards diklaim via sistem, bukan dijanjikan AI',
  ],
  forbidden_phrases: [
    'tier kamu adalah',
    'kamu masuk tier',
    'bonus tier kamu',
    'multiplier kamu',
  ],
} as const;

/**
 * Status Guard - Status vs Waktu Aktif
 */
export const STATUS_GUARD = {
  key: 'status_vs_badge',
  title: 'Status = Niat Admin, Badge = Computed View',
  description: 'Status adalah keputusan admin, badge adalah tampilan berdasarkan waktu.',
  rules: [
    'status = niat admin (active/paused/draft/expired)',
    'badge = computed view berdasarkan status + valid_from + valid_until',
    'Jika status=active tapi waktu belum mulai → badge=Upcoming',
    'Jika status=active tapi waktu sudah lewat → badge=Expired',
  ],
  status_meanings: {
    active: 'Admin bermaksud mengaktifkan promo',
    paused: 'Admin sengaja menonaktifkan sementara',
    draft: 'Masih dalam tahap penyusunan',
    expired: 'Sudah tidak berlaku',
  },
} as const;

/**
 * AI Template Guard - Konten discipline untuk Step 4
 */
export const AI_TEMPLATE_GUARD = {
  key: 'ai_content_discipline',
  title: 'AI Wording Discipline - 3 Larangan Utama',
  description: 'Tiga larangan absolut untuk AI saat menjelaskan promo.',
  rules: [
    '❌ Mengklaim "bonus kamu minggu ini X" (klaim spesifik)',
    '❌ Mengambil / mengasumsikan data akun user',
    '❌ Menutup klaim tanpa verifikasi sistem atau human',
  ],
  // Larangan 1: Klaim bonus spesifik user
  // Larangan 2: Asumsi data akun user
  // Larangan 3: Klaim tanpa verifikasi
  forbidden_phrases: [
    // Larangan 1 - Klaim spesifik
    'bonus kamu', 'bonus anda', 'kamu dapat', 'anda mendapat',
    'bonus minggu ini', 'hasil bonus kamu',
    // Larangan 2 - Asumsi data akun
    'turnover kamu', 'deposit kamu', 'saldo kamu',
    'akun kamu menunjukkan', 'data kamu',
    // Larangan 3 - Klaim tanpa verifikasi
    'sudah ditransfer', 'sudah masuk', 'bonus sudah dikirim',
    'sudah dikreditkan', 'sudah diproses',
  ],
  // Yang BOLEH dilakukan AI
  allowed_phrases: [
    'promo ini memberikan', 'persentase bonus adalah',
    'misalnya', 'ilustrasi', 'contoh perhitungan',
    'silakan cek di dashboard akun', 'akan diverifikasi',
    'hubungi CS untuk konfirmasi',
  ],
} as const;

// ============================================================================
// DEFAULT AI GUIDELINES
// ============================================================================

/**
 * Default AI Guidelines untuk pre-fill field ai_guidelines
 */
export const DEFAULT_AI_GUIDELINES = `⚠️ AI GUARD RULES (WAJIB DIPATUHI):

1. FORMULA = DESKRIPSI
   • Formula adalah penjelasan aturan, BUKAN kalkulator
   • AI tidak boleh menghitung hasil reward
   • Hasil akhir ditentukan sistem saat klaim

2. TIER = REFERENSI
   • Tier ditentukan saat klaim oleh sistem
   • AI tidak boleh mengklaim tier final user
   • Tabel tier hanya sebagai referensi informasi

3. JANGAN BILANG "PASTI DAPAT"
   • Hindari janji absolut tentang reward
   • Selalu gunakan framing kondisional
   • Akhiri dengan arahan ke CS/sistem

4. FRAMING YANG BENAR:
   ✅ "Dengan ketentuan X, Anda berkesempatan mendapat Y"
   ✅ "Silakan hubungi CS untuk verifikasi"
   ✅ "Syarat dan ketentuan berlaku"
   
   ❌ "Bonus Anda adalah X"
   ❌ "Kamu pasti dapat Y"
   ❌ "Sudah ditransfer ke akun"`;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if text contains forbidden phrases
 */
export function containsForbiddenPhrases(text: string): string[] {
  const allForbidden = [
    ...FORMULA_GUARD.forbidden_phrases,
    ...TIER_GUARD.forbidden_phrases,
    ...AI_TEMPLATE_GUARD.forbidden_phrases,
  ];
  
  const lowered = text.toLowerCase();
  return allForbidden.filter(phrase => lowered.includes(phrase.toLowerCase()));
}

/**
 * Check if text has proper framing (uses allowed phrases instead of required)
 */
export function hasProperFraming(text: string): boolean {
  const lowered = text.toLowerCase();
  return AI_TEMPLATE_GUARD.allowed_phrases.some(
    phrase => lowered.includes(phrase.toLowerCase())
  );
}

/**
 * Validate AI template content
 */
export function validateAITemplate(text: string): {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  
  const forbidden = containsForbiddenPhrases(text);
  if (forbidden.length > 0) {
    issues.push(`Mengandung frasa terlarang: ${forbidden.join(', ')}`);
  }
  
  if (!hasProperFraming(text) && text.length > 50) {
    suggestions.push('Tambahkan framing verifikasi seperti "Silakan hubungi CS untuk konfirmasi"');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    suggestions,
  };
}

// ============================================================================
// GUARD RULE COLLECTION
// ============================================================================

export const ALL_GUARD_RULES = [
  FORMULA_GUARD,
  TIER_GUARD,
  STATUS_GUARD,
  AI_TEMPLATE_GUARD,
] as const;

export type GuardRuleKey = typeof ALL_GUARD_RULES[number]['key'];
