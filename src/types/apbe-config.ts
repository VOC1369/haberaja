/**
 * AI PERSONA BLUEPRINT ENGINE (APBE v1.2)
 * Full Type Definitions for Multi-Tenant SaaS VOC System
 * 
 * JSON Keys:
 * A = Brand Identity
 * agent = Agent Persona
 * C = Communication Engine
 * L = Interaction Library (auto-generated)
 * O = Operational SOP (includes Safety & Crisis)
 * B = Behaviour Engine (deprecated - relocated to C and O)
 * V = VIP Logic
 * 
 * IMPORTANT: ContactMethod is LOCKED to "whatsapp" | "telegram" only.
 * All enum types should be imported from apbe-enums.ts for consistency.
 * 
 * V1.2 Changes:
 * - Removed financial_speech, multichannel, cultural_vibe, lane_rules
 * - Interaction Library now auto-generated (not user-filled)
 * - Behaviour Engine merged into Communication Engine and Safety/Crisis
 * - Personalization relocated to Communication Engine
 * - Anti-Hunter relocated to Safety/Crisis
 * 
 * V1.1 Changes:
 * - Removed legacy fields (formality, warmth, persuasion_mode, emoji_style, lane_rules)
 * - Removed deprecated types (PersuasionMode, EmojiStyle, LaneRules, LaneConfig)
 * - Simplified BoundaryRules interface
 */

// ============================================================
// A. BRAND IDENTITY
// ============================================================
export interface BrandIdentity {
  group_name: string;           // ex: "ACG77" - Nama Group
  website_name: string;         // ex: "ACG" - Nama Website
  slogan: string;               // ex: "Your Lucky Game"
  archetype: BrandArchetype;    // ex: "jester", "caregiver"
  lokasi: LokasiRegion;         // ex: "indonesia" - Region untuk IP/timezone
  call_to_player: string;       // ex: "Kak", "Bos", "Bro", "Sis"
}

export type LokasiRegion = 
  | "indonesia"
  | "malaysia"
  | "singapore"
  | "thailand"
  | "vietnam"
  | "philippines"
  | "cambodia"
  | "myanmar"
  | "laos"
  | "brunei";

export type BrandArchetype = 
  | "jester"      // Playful, fun
  | "caregiver"   // Caring, supportive
  | "hero"        // Bold, confident
  | "sage"        // Wise, knowledgeable
  | "everyman"    // Relatable, friendly
  | "ruler"       // Premium, authoritative
  | "creator"     // Innovative, creative
  | "explorer"    // Adventurous, free-spirited
  | "rebel"       // Edgy, unconventional
  | "lover"       // Passionate, intimate
  | "magician"    // Transformative, visionary
  | "innocent";   // Pure, optimistic

// ============================================================
// agent. AGENT PERSONA
// ============================================================
export interface AgentPersona {
  name: string;                 // ex: "Danila"
  gender: AgentGender;          // ex: "female"
  backstory: string;            // Deskripsi karakter agent
  tone: AgentTone;              // Tone kepribadian utama
  style: AgentStyle;            // ex: "friendly", "professional"
  speed: AgentSpeed;            // ex: "normal", "fast"
  emoji_allowed: string[];      // ex: ["😊", "🙏", "👍"]
  emoji_forbidden: string[];    // ex: ["💀", "🖕", "😈"]
}

export type AgentGender = "female" | "male" | "neutral";

export type AgentTone = 
  | "soft_warm"          // Soft & Warm
  | "neutral"            // Neutral
  | "strict_efficient"   // Strict & Efficient
  | "cheerful_playful"   // Cheerful & Playful
  | "gentle_supportive"  // Gentle & Supportive
  | "elite_formal";      // Elite & Formal

export type AgentStyle = 
  | "friendly"      // Ramah & casual
  | "professional"  // Profesional
  | "playful"       // Ceria & fun
  | "caring"        // Perhatian & supportive
  | "formal"        // Formal & sopan
  | "energetic";    // Energik & semangat

export type AgentSpeed = 
  | "instant"   // < 1 detik
  | "fast"      // 1-3 detik
  | "normal"    // 3-5 detik
  | "relaxed";  // 5-10 detik

// ============================================================
// C. COMMUNICATION ENGINE (v1.2 - Includes Personalization from B)
// ============================================================
export interface CommunicationEngine {
  empathy: number;              // 1-10 scale - seberapa lembut & memahami
  persuasion: number;           // 1-10 scale - seberapa kuat mengajak ke aksi
  humor_usage: HumorUsage;
  language_ratio: LanguageRatio;
  dialect_allowed: boolean;     // AI boleh pakai bahasa gaul / dialek lokal
  auto_switch: boolean;         // Auto-switch bahasa mengikuti user
  boundary_rules?: BoundaryRules; // AI behavioral hard limits
  personalization: PersonalizationConfig; // v1.2: Moved from B-block
  data_verification?: DataVerificationConfig; // v1.3: User data collection settings
}

export type HumorUsage = "none" | "subtle" | "moderate" | "frequent";

export interface LanguageRatio {
  indonesian: number;  // Persentase Bahasa Indonesia (0-100)
  english: number;     // Persentase Bahasa Inggris (0-100)
}

// Boundary Rules - Simplified structure
export interface BoundaryRules {
  default_rules: string[];      // Non-editable default rules
  custom_rules: string[];       // User-added custom rules
}

// Personalization Config (v1.2: Relocated from B-block to C-block)
export interface PersonalizationConfig {
  level: number;              // 1-10
  memory_enabled: boolean;
}

// Data Verification Config (v1.3: User data collection settings)
// Simple badge-based configuration - ALL fields removable by admin
export interface DataVerificationConfig {
  enabled: boolean;
  fields: string[];     // Simple string array - all removable
  interaction_mode: DataVerificationMode;
}

export type DataVerificationMode = "step_by_step" | "form" | "adaptive";

// Default verification fields (pre-filled, all removable)
export const DEFAULT_VERIFICATION_FIELDS: string[] = [
  "User ID / Username",
  "Nama di rekening",
  "Bank",
  "Nomor rekening",
  "Nomor WA aktif",
];

// ============================================================
// L. INTERACTION LIBRARY
// ============================================================
export interface InteractionLibrary {
  greetings: GreetingTemplates;
  closings: ClosingTemplates;
  apologies: ApologyTemplates;
  empathy_phrases: string[];
}

export interface GreetingTemplates {
  default: string;
  morning: string;      // 05:00 - 11:00
  afternoon: string;    // 11:00 - 15:00
  evening: string;      // 15:00 - 18:00
  night: string;        // 18:00 - 05:00
  vip: string;          // Special for VIP
}

export interface ClosingTemplates {
  normal: string;       // Penutup biasa
  vip: string;          // Penutup VIP
  soft_push: string;    // Ajak lanjutan, sangat halus
  neutral: string;      // Tidak ajak apa pun
  angry: string;        // Saat player marah
}

export interface ApologyTemplates {
  mild: string;         // Minor error, mis-info kecil
  medium: string;       // Pending singkat, kendala teknis
  severe: string;       // WD lama, saldo hilang, marah level 8+
}

// ============================================================
// O. OPERATIONAL SOP (includes Safety & Crisis + Anti-Hunter from v1.2)
// ============================================================
export interface OperationalSOP {
  admin_contact: AdminContact;
  escalation: EscalationConfig;
  crisis: CrisisConfig;
  risk: RiskConfig;
  anti_hunter: AntiHunterConfig; // v1.2: Moved from B-block
}

export interface AdminContact {
  method: ContactMethod;
  value: string;              // ex: "+6281234567890" or "@username"
  active_hours: string;       // ex: "08:00 - 22:00 WIB"
  backup_contact?: string;    // Kontak cadangan
}

/**
 * LOCKED: ContactMethod hanya WhatsApp dan Telegram
 * Tidak boleh ditambah dari UI
 */
export type ContactMethod = "whatsapp" | "telegram";

export interface EscalationConfig {
  sop_style: SOPStyle;
  threshold_triggers: string[];
  default_message: string;
  auto_escalate: boolean;
  max_ai_attempts: number;    // Maks percobaan AI sebelum eskalasi
}

export type SOPStyle = "strict" | "flexible" | "adaptive";

export interface CrisisConfig {
  tone: CrisisTone;
  dictionary_red: string[];
  dictionary_yellow: string[];
  severity_weights: SeverityWeights;
  templates: CrisisTemplates;
  toxic_severity?: ToxicSeverity;  // Granular toxic detection levels
}

export interface SeverityWeights {
  red: number;      // 0.5 - 1.0
  yellow: number;   // 0.1 - 0.9
}

export type CrisisTone = 
  | "calm"        // Tenang & menenangkan
  | "apologetic"  // Banyak minta maaf
  | "solution"    // Fokus solusi
  | "empathetic"; // Sangat empati

export interface CrisisTemplates {
  angry_player: string;
  system_error: string;
  payment_issue: string;
  account_locked: string;
  fraud_detected: string;
}

// Toxic Severity - Granular toxicity level detection
export interface ToxicSeverity {
  level_1: string[];  // Mild - yellowish words, gentle warning
  level_2: string[];  // Moderate - border red, firm response
  level_3: string[];  // Severe - instant escalation required
}

export interface RiskConfig {
  appetite: number;           // 0-100
  preventive_bonus_allowed: boolean;
  preventive_bonus_limit?: number;
  preventive_bonus_max_total?: number;
  preventive_bonus_cooldown?: number;
  preventive_bonus_approval?: boolean;
}

// ============================================================
// ANTI-HUNTER CONFIG (v1.2: Relocated to O-block, kept here for type export)
// ============================================================
export interface AntiHunterConfig {
  enabled: boolean;
  rules: AntiHunterRule[];
}

export interface AntiHunterRule {
  name: string;                 // ex: "Freebet Hunter"
  patterns: string[];           // Detection patterns (combined for backward compat)
  manualPatterns?: string[];    // Manually added patterns
  presetPatterns?: string[];    // Preset template patterns
  response_style: HunterResponseStyle;
  allow_blacklist: boolean;
  auto_escalate: boolean;
}

export type HunterResponseStyle = 
  | "formal_cold"       // Formal dingin
  | "firm_polite"       // Tegas tapi sopan
  | "redirect_admin";   // Redirect ke admin

// ============================================================
// B. BEHAVIOUR ENGINE (DEPRECATED in v1.2 - READ-ONLY for backward compatibility)
// Fields relocated: personalization → C, anti_hunter → O
// 
// CRITICAL v1.3: config_B renamed to config_B_legacy
// UI/API MUST reject writes to this block
// Only allowed values: null, migration data, read for audit
// ============================================================
/**
 * @deprecated v1.2+ - READ ONLY for backward compatibility
 * Use C.personalization and O.anti_hunter instead
 * UI MUST NOT write to this block - validation layer will reject
 */
export interface BehaviourEngine {
  /** @deprecated Use C.personalization instead */
  personalization: PersonalizationConfig;
  /** @deprecated Use O.anti_hunter instead */
  anti_hunter: AntiHunterConfig;
}

// ============================================================
// V. VIP LOGIC
// ============================================================
export interface VIPLogic {
  active: boolean;
  threshold: VIPThreshold;
  greeting: string;
  closing: string;
  tone_modifiers: VIPToneModifiers;
  priority_response: boolean;
  svip_rules: SVIPRule[];
}

export interface VIPThreshold {
  type: VIPThresholdType;
  value: number;
  currency: string;
}

export type VIPThresholdType = 
  | "total_deposit"     // Total deposit
  | "turnover"          // Total turnover
  | "ggr";              // Gross Gaming Revenue

export interface VIPToneModifiers {
  warmth: number;       // -3 to +3
  formality: number;    // -3 to +3
  speed: number;        // -3 to +3
}

export interface SVIPRule {
  tier_name: string;           // ex: "Diamond VIP"
  threshold: number;           // ex: 50000000
  notes: string;               // Perbedaan utama
}

// ============================================================
// TIMEZONE CONFIGURATION
// ============================================================
export interface TimezoneConfig {
  source: TimezoneSource;        // Where to get timezone from
  default_zone: string;          // Default timezone (IANA format, e.g., "Asia/Jakarta")
  auto_detect: boolean;          // Allow auto-detection from player
}

export type TimezoneSource = "server" | "client" | "player_detected";

// ============================================================
// MULTI-SHIFT PERSONA SCHEDULE (v1.3)
// ============================================================
/**
 * Multi-shift persona routing configuration
 * Used by runtime/n8n to select persona based on time
 * 
 * CRITICAL: active_hours is evaluated against config_timezone.default_zone
 * NOT server UTC time
 */
export interface PersonaSchedule {
  active_hours: { start: string; end: string }; // HH:MM format
  priority: number;        // Higher = more priority in overlap
  is_default: boolean;     // Fallback when no time match
}

// ============================================================
// CLIENT MEMBERSHIP (v1.3)
// ============================================================
export type ClientRole = "owner" | "admin";

// ============================================================
// META CONFIGURATION (V1.1)
// ============================================================
export interface APBEMeta {
  schema_version: string;              // APBE schema version (e.g., "1.1.0")
  archetype_ruleset_version: string;   // Version of archetype ruleset used
  created_at: string;                  // ISO timestamp
  updated_at: string;                  // ISO timestamp
  created_by: string;                  // Admin who created
  updated_by: string;                  // Admin who last updated
  client_id?: string;                  // Multi-tenant client identifier
  region?: string;                     // V1.1: Target market region for multi-market support
}

// ============================================================
// FULL APBE CONFIG (COMBINED)
// ============================================================
export interface APBEConfig {
  A: BrandIdentity;
  agent: AgentPersona;
  C: CommunicationEngine;
  L: InteractionLibrary;
  O: OperationalSOP;
  B: BehaviourEngine;
  V: VIPLogic;
  timezone: TimezoneConfig;      // Timezone handling for time-based greetings
  _meta?: APBEMeta;              // V1.0.1: Version tracking & audit metadata
}

// ============================================================
// DEFAULT/INITIAL VALUES
// ============================================================
export const initialAPBEConfig: APBEConfig = {
  A: {
    group_name: "",
    website_name: "",
    slogan: "",
    archetype: "caregiver",
    lokasi: "indonesia",
    call_to_player: "Kak",
  },
  timezone: {
    source: "server",
    default_zone: "Asia/Jakarta",
    auto_detect: true,
  },
  agent: {
    name: "",
    gender: "female",
    backstory: "",
    tone: "soft_warm",
    style: "friendly",
    speed: "normal",
    emoji_allowed: ["😊", "🙏", "👍", "💪", "🎉", "❤️", "✨"],
    emoji_forbidden: [],
  },
  C: {
    empathy: 7,
    persuasion: 6,
    humor_usage: "subtle",
    language_ratio: { indonesian: 90, english: 10 },
    dialect_allowed: true,
    auto_switch: true,
    boundary_rules: {
      default_rules: ["AI dilarang menjawab pertanyaan di luar Knowledge Base"],
      custom_rules: [],
    },
    personalization: {
      level: 7,
      memory_enabled: true,
    },
    data_verification: {
      enabled: false,
      fields: [
        "User ID / Username",
        "Nama di rekening",
        "Bank",
        "Nomor rekening",
        "Nomor WA aktif",
      ],
      interaction_mode: "step_by_step",
    },
  },
  L: {
    greetings: {
      default: "Selamat datang di {{A.website_name}}. Saya {{agent.name}}, siap membantu {{A.call_to_player}} hari ini. 🙏",
      morning: "Selamat pagi, {{A.call_to_player}}. Ada yang bisa saya bantu di {{A.website_name}}? 🙏",
      afternoon: "Selamat siang, {{A.call_to_player}}. Bagaimana saya dapat membantu? 🙏",
      evening: "Selamat sore, {{A.call_to_player}}. Saya siap membantu. 🙏",
      night: "Selamat malam, {{A.call_to_player}}. Ada yang bisa saya bantu? 🙏",
      vip: "Selamat datang kembali, {{A.call_to_player}}. Sebagai member VIP di {{A.website_name}}, kehormatan bagi kami untuk melayani Anda. ⭐",
    },
    closings: {
      normal: "Terima kasih atas kepercayaan {{A.call_to_player}}. Semoga hari Anda menyenangkan. 🙏",
      vip: "Terima kasih banyak {{A.call_to_player}}. Sebagai member VIP, Anda selalu menjadi prioritas kami. ⭐",
      soft_push: "Terima kasih {{A.call_to_player}}. Jangan lupa cek promo terbaru kami di {{A.website_name}}. 🙏",
      neutral: "Terima kasih {{A.call_to_player}}. 🙏",
      angry: "Mohon maaf atas ketidaknyamanan yang {{A.call_to_player}} alami. Kami akan pastikan tidak terulang. 🙏",
    },
    apologies: {
      mild: "Mohon maaf atas ketidaknyamanan kecil ini {{A.call_to_player}} 🙏",
      medium: "Mohon maaf {{A.call_to_player}}, sedang ada kendala teknis. Tim kami sedang proses ya 🙏",
      severe: "Kami sangat menyesal atas ketidaknyamanan yang {{A.call_to_player}} alami. Tim prioritas kami sedang tangani sekarang 🙏",
    },
    empathy_phrases: [
      "Kami mengerti perasaan {{A.call_to_player}}",
      "Kami paham situasinya {{A.call_to_player}}",
      "Tenang {{A.call_to_player}}, kami bantu ya",
    ],
  },
  O: {
    admin_contact: {
      method: "whatsapp",
      value: "",
      active_hours: "08:00 - 22:00 WIB",
    },
    escalation: {
      sop_style: "adaptive",
      threshold_triggers: [],
      default_message: "Akan kami hubungkan dengan admin yang bertugas ya Kak 🙏",
      auto_escalate: true,
      max_ai_attempts: 3,
    },
    crisis: {
      tone: "calm",
      dictionary_red: [],
      dictionary_yellow: [],
      severity_weights: {
        red: 1.0,
        yellow: 0.6,
      },
      templates: {
        angry_player: "",
        system_error: "",
        payment_issue: "",
        account_locked: "",
        fraud_detected: "",
      },
      toxic_severity: {
        level_1: ["kesal", "bete", "sebel", "cape", "kecewa"],
        level_2: ["goblok", "tolol", "bodoh", "idiot"],
        level_3: ["anjing", "babi", "bangsat", "penipu", "scam"],
      },
    },
    risk: {
      appetite: 50,
      preventive_bonus_allowed: false,
      preventive_bonus_limit: 50000,
      preventive_bonus_max_total: 500000,
      preventive_bonus_cooldown: 24,
      preventive_bonus_approval: true,
    },
    anti_hunter: {
      enabled: false,
      rules: [],
    },
  },
  // B-block deprecated in v1.2 - kept for backward compatibility
  B: {
    personalization: {
      level: 7,
      memory_enabled: true,
    },
    anti_hunter: {
      enabled: false,
      rules: [],
    },
  },
  V: {
    active: false,
    threshold: {
      type: "total_deposit",
      value: 10000000,
      currency: "IDR",
    },
    greeting: "Selamat datang kembali, {{A.call_to_player}}. Sebagai member VIP di {{A.website_name}}, kehormatan bagi kami untuk melayani Anda. ⭐",
    closing: "Terima kasih banyak {{A.call_to_player}}. Sebagai member VIP, Anda selalu menjadi prioritas kami. ⭐",
    tone_modifiers: {
      warmth: 2,
      formality: -1,
      speed: 2,
    },
    priority_response: true,
    svip_rules: [],
  },
  _meta: {
    schema_version: "1.2.0",
    archetype_ruleset_version: "1.2.0",
    created_at: "",
    updated_at: "",
    created_by: "",
    updated_by: "",
  },
};
