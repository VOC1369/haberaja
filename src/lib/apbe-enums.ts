/**
 * APBE v1.2 CENTRALIZED ENUM SYSTEM
 * 
 * Satu sumber kebenaran untuk semua enum values.
 * LOCKED - Tidak bisa diubah dari UI.
 * Siap untuk migrasi Supabase.
 * 
 * V1.2 Changes:
 * - Removed financial_speech, multichannel enums
 * - lokasi_region replaces cultural_vibe
 * 
 * V1.1 Changes:
 * - Removed deprecated enums: cultural_vibe, persuasion_mode, emoji_style, 
 *   message_length, emoji_level, channel_style
 */

// ============================================================
// LOCKED ENUM VALUES (v1.2)
// Each enum is versioned and frozen for Supabase migration
// ============================================================

export const APBE_ENUMS = {
  // Contact Methods v1.0 - LOCKED (only 2 allowed)
  contact_method: ["whatsapp", "telegram"] as const,
  
  // Brand Identity v1.0 - LOCKED
  brand_archetype: [
    "jester", "caregiver", "hero", "sage", "everyman", 
    "ruler", "creator", "explorer", "rebel", "lover", 
    "magician", "innocent"
  ] as const,
  
  // Lokasi Region v1.2 - LOCKED (replaces cultural_vibe)
  lokasi_region: [
    "indonesia", "malaysia", "singapore", 
    "thailand", "vietnam", "philippines",
    "cambodia", "laos", "myanmar", "brunei"
  ] as const,
  
  // Agent Gender v1.0 - LOCKED
  agent_gender: ["female", "male", "neutral"] as const,
  
  // Agent Tone v1.0 - LOCKED
  agent_tone: [
    "soft_warm", "neutral", "strict_efficient", 
    "cheerful_playful", "gentle_supportive", "elite_formal"
  ] as const,
  
  // Agent Style v1.0 - LOCKED
  agent_style: [
    "friendly", "professional", "playful", 
    "caring", "formal", "energetic"
  ] as const,
  
  // Agent Speed v1.0 - LOCKED
  agent_speed: ["instant", "fast", "normal", "relaxed"] as const,
  
  // Humor Usage v1.0 - LOCKED
  humor_usage: ["none", "subtle", "moderate", "frequent"] as const,
  
  // SOP Style v1.0 - LOCKED
  sop_style: ["strict", "flexible", "adaptive"] as const,
  
  // Crisis Tone v1.0 - LOCKED
  crisis_tone: ["calm", "apologetic", "solution", "empathetic"] as const,
  
  // Crisis Style v1.0 - LOCKED (from Archetype Ruleset)
  crisis_style: [
    "authoritative_calm", "empathetic_soft", "solution_first", 
    "directive_solution", "empathetic_direct", "calm_direct",
    "cool_direct", "soothing_calm", "reassuring_soft"
  ] as const,
  
  // Tone Modifier v1.0 - LOCKED
  tone_modifier: ["warmer", "formal", "shorter", "longer", "neutral"] as const,
  
  // Issue Category v1.0 - LOCKED
  issue_category: [
    "deposit", "withdrawal", "account", "game", 
    "technical", "promo", "other"
  ] as const,
  
  // Hunter Response Style v1.0 - LOCKED
  hunter_response_style: ["formal_cold", "firm_polite", "redirect_admin"] as const,
  
  // VIP Threshold Type v1.0 - LOCKED
  vip_threshold_type: ["total_deposit", "turnover", "ggr"] as const,
  
  // Reward Type v1.0 - LOCKED (Canonical reward types for promo)
  reward_type: [
    "hadiah_fisik",   // Physical reward (gadgets, vehicles, etc.)
    "credit_game",    // In-game credit (freechip, freebet, bonus)
    "uang_tunai",     // Cash reward
    "voucher",        // Voucher (mapped to credit_game in logic)
    "other",          // Unknown/other (fallthrough)
  ] as const,
} as const;

// ============================================================
// TYPE EXPORTS (Derived from ENUMS)
// ============================================================

export type ContactMethod = typeof APBE_ENUMS.contact_method[number];
export type BrandArchetype = typeof APBE_ENUMS.brand_archetype[number];
export type AgentGender = typeof APBE_ENUMS.agent_gender[number];
export type AgentTone = typeof APBE_ENUMS.agent_tone[number];
export type AgentStyle = typeof APBE_ENUMS.agent_style[number];
export type AgentSpeed = typeof APBE_ENUMS.agent_speed[number];
export type HumorUsage = typeof APBE_ENUMS.humor_usage[number];
export type SOPStyle = typeof APBE_ENUMS.sop_style[number];
export type CrisisTone = typeof APBE_ENUMS.crisis_tone[number];
export type CrisisStyleEnum = typeof APBE_ENUMS.crisis_style[number];
export type ToneModifier = typeof APBE_ENUMS.tone_modifier[number];
export type IssueCategory = typeof APBE_ENUMS.issue_category[number];
export type HunterResponseStyle = typeof APBE_ENUMS.hunter_response_style[number];
export type VIPThresholdType = typeof APBE_ENUMS.vip_threshold_type[number];
export type RewardTypeEnum = typeof APBE_ENUMS.reward_type[number];

// ============================================================
// DISPLAY LABELS (Indonesian UI)
// ============================================================

export const ENUM_LABELS = {
  contact_method: {
    whatsapp: "WhatsApp",
    telegram: "Telegram",
  },
  
  brand_archetype: {
    jester: "Jester (Playful)",
    caregiver: "Caregiver (Caring)",
    hero: "Hero (Bold)",
    sage: "Sage (Wise)",
    everyman: "Everyman (Relatable)",
    ruler: "Ruler (Premium)",
    creator: "Creator (Innovative)",
    explorer: "Explorer (Adventurous)",
    rebel: "Rebel (Edgy)",
    lover: "Lover (Passionate)",
    magician: "Magician (Visionary)",
    innocent: "Innocent (Pure)",
  },
  
  agent_gender: {
    female: "Perempuan",
    male: "Laki-laki",
    neutral: "Netral",
  },
  
  agent_tone: {
    soft_warm: "Soft & Warm",
    neutral: "Netral",
    strict_efficient: "Strict & Efficient",
    cheerful_playful: "Cheerful & Playful",
    gentle_supportive: "Gentle & Supportive",
    elite_formal: "Elite & Formal",
  },
  
  agent_style: {
    friendly: "Ramah & Casual",
    professional: "Profesional",
    playful: "Ceria & Fun",
    caring: "Perhatian & Supportive",
    formal: "Formal & Sopan",
    energetic: "Energik & Semangat",
  },
  
  agent_speed: {
    instant: "Instant (<1 detik)",
    fast: "Fast (1-3 detik)",
    normal: "Normal (3-5 detik)",
    relaxed: "Relaxed (5-10 detik)",
  },
  
  humor_usage: {
    none: "Tidak Ada",
    subtle: "Subtle (Jarang)",
    moderate: "Sedang",
    frequent: "Sering",
  },
  
  sop_style: {
    strict: "Strict",
    flexible: "Flexible",
    adaptive: "Adaptive",
  },
  
  crisis_tone: {
    calm: "Tenang & Menenangkan",
    apologetic: "Banyak Minta Maaf",
    solution: "Fokus Solusi",
    empathetic: "Sangat Empati",
  },
  
  crisis_style: {
    authoritative_calm: "Tenang & Berwibawa",
    empathetic_soft: "Empati & Lembut",
    solution_first: "Fokus Solusi",
    directive_solution: "Solusi Terarah",
    empathetic_direct: "Empati Langsung",
    calm_direct: "Tenang & Langsung",
    cool_direct: "Cool & Langsung",
    soothing_calm: "Menenangkan",
    reassuring_soft: "Meyakinkan & Lembut",
  },
  
  tone_modifier: {
    warmer: "Lebih Hangat",
    formal: "Lebih Formal",
    shorter: "Lebih Pendek",
    longer: "Lebih Detail",
    neutral: "Netral",
  },
  
  issue_category: {
    deposit: "Deposit",
    withdrawal: "Withdrawal",
    account: "Akun",
    game: "Game",
    technical: "Teknis",
    promo: "Promo",
    other: "Lainnya",
  },
  
  hunter_response_style: {
    formal_cold: "Formal Dingin",
    firm_polite: "Tegas Tapi Sopan",
    redirect_admin: "Redirect ke Admin",
  },
  
  vip_threshold_type: {
    total_deposit: "Total Deposit",
    turnover: "Turnover",
    ggr: "GGR (Gross Gaming Revenue)",
  },
  
  reward_type: {
    hadiah_fisik: "Hadiah Fisik",
    credit_game: "Credit Game",
    uang_tunai: "Uang Tunai",
    voucher: "Voucher",
    other: "Lainnya",
  },
} as const;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get display label for enum value
 */
export function getEnumLabel<T extends keyof typeof ENUM_LABELS>(
  enumType: T,
  value: string
): string {
  const labels = ENUM_LABELS[enumType] as Record<string, string>;
  return labels[value] || value;
}

/**
 * Check if value is valid for enum type
 */
export function isValidEnumValue<T extends keyof typeof APBE_ENUMS>(
  enumType: T,
  value: string
): boolean {
  return (APBE_ENUMS[enumType] as readonly string[]).includes(value);
}

/**
 * Get all valid values for enum type
 */
export function getEnumValues<T extends keyof typeof APBE_ENUMS>(
  enumType: T
): readonly string[] {
  return APBE_ENUMS[enumType] as readonly string[];
}

/**
 * Get enum options for Select component
 */
export function getEnumOptions<T extends keyof typeof APBE_ENUMS>(
  enumType: T
): { value: string; label: string }[] {
  const values = APBE_ENUMS[enumType] as readonly string[];
  const labels = ENUM_LABELS[enumType as keyof typeof ENUM_LABELS] as Record<string, string> | undefined;
  
  return values.map(value => ({
    value,
    label: labels?.[value] || value,
  }));
}

// ============================================================
// VERSION LOCK
// ============================================================

export const ENUM_VERSION = "1.2.0" as const;
export const APBE_ENUMS_VERSION = "1.2.0" as const;
export const ENUM_LOCKED = true as const;
