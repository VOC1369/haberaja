/**
 * APBE v1.2 Field Usage Map
 * 
 * Klasifikasi 100+ field ke kategori penggunaan:
 * - ui_only: Hanya untuk display admin, tidak masuk AI prompt
 * - runtime: Masuk AI prompt untuk response generation
 * - rag: Digunakan untuk RAG/knowledge retrieval
 * - both: Dipakai UI dan Runtime
 * 
 * Juga mapping ke Supabase table untuk migrasi nanti.
 * TIDAK CONNECT ke Supabase - ini adalah referensi arsitektur.
 */

// ============================================================
// TYPES
// ============================================================

export type FieldUsage = "ui_only" | "runtime" | "rag" | "both";

export type SupabaseTable = "persona" | "library" | "rules";

export interface FieldDefinition {
  usage: FieldUsage;
  supabase_table: SupabaseTable;
  required: boolean;
  description: string;
  runtime_key?: string; // Key yang digunakan dalam prompt
}

// ============================================================
// FIELD USAGE MAP
// ============================================================

export const FIELD_USAGE_MAP: Record<string, FieldDefinition> = {
  // ============================================================
  // A. BRAND IDENTITY → voc_agent_persona
  // ============================================================
  "A.group_name": {
    usage: "ui_only",  // CRITICAL: NEVER use in runtime - internal metadata only
    supabase_table: "persona",
    required: true,
    description: "Internal group identifier - NEVER exposed in runtime prompt, chat, or player-facing content",
    // runtime_key intentionally omitted - this field is BLACKLISTED from runtime
  },
  "A.website_name": {
    usage: "both",
    supabase_table: "persona",
    required: true,
    description: "Public brand name used in AI greetings",
    runtime_key: "brand_name",
  },
  "A.slogan": {
    usage: "runtime",
    supabase_table: "persona",
    required: false,
    description: "Brand slogan for AI personality context",
    runtime_key: "slogan",
  },
  "A.archetype": {
    usage: "runtime",
    supabase_table: "persona",
    required: true,
    description: "Brand personality archetype for tone calibration",
    runtime_key: "archetype",
  },
  "A.lokasi": {
    usage: "runtime",
    supabase_table: "persona",
    required: true,
    description: "Geographic region for context (ASEAN)",
    runtime_key: "lokasi",
  },
  "A.call_to_player": {
    usage: "runtime",
    supabase_table: "persona",
    required: true,
    description: "How AI addresses players (Kak, Bos, etc)",
    runtime_key: "call_to_player",
  },

  // ============================================================
  // agent. AGENT PERSONA → voc_agent_persona
  // ============================================================
  "agent.name": {
    usage: "both",
    supabase_table: "persona",
    required: true,
    description: "AI agent character name",
    runtime_key: "agent_name",
  },
  "agent.gender": {
    usage: "runtime",
    supabase_table: "persona",
    required: true,
    description: "Agent gender for pronoun usage",
    runtime_key: "agent_gender",
  },
  "agent.backstory": {
    usage: "ui_only",
    supabase_table: "persona",
    required: false,
    description: "Agent backstory for admin reference only",
  },
  "agent.tone": {
    usage: "runtime",
    supabase_table: "persona",
    required: true,
    description: "Primary personality tone",
    runtime_key: "tone",
  },
  "agent.style": {
    usage: "runtime",
    supabase_table: "persona",
    required: true,
    description: "Communication style",
    runtime_key: "style",
  },
  "agent.speed": {
    usage: "runtime",
    supabase_table: "persona",
    required: true,
    description: "Response timing preference",
    runtime_key: "speed",
  },
  "agent.emoji_allowed": {
    usage: "runtime",
    supabase_table: "persona",
    required: false,
    description: "Allowed emojis list",
    runtime_key: "emoji_allowed",
  },
  "agent.emoji_forbidden": {
    usage: "runtime",
    supabase_table: "persona",
    required: false,
    description: "Forbidden emojis list",
    runtime_key: "emoji_forbidden",
  },

  // ============================================================
  // C. COMMUNICATION ENGINE → voc_agent_persona
  // ============================================================
  "C.empathy": {
    usage: "runtime",
    supabase_table: "persona",
    required: true,
    description: "Empathy level 1-10",
    runtime_key: "empathy",
  },
  "C.persuasion": {
    usage: "runtime",
    supabase_table: "persona",
    required: true,
    description: "Persuasion intensity 1-10",
    runtime_key: "persuasion",
  },
  "C.humor_usage": {
    usage: "runtime",
    supabase_table: "persona",
    required: true,
    description: "Humor frequency",
    runtime_key: "humor_usage",
  },
  "C.language_ratio": {
    usage: "runtime",
    supabase_table: "persona",
    required: true,
    description: "Indonesian vs English percentage",
    runtime_key: "language_ratio",
  },
  "C.dialect_allowed": {
    usage: "runtime",
    supabase_table: "persona",
    required: true,
    description: "Allow regional dialect usage",
    runtime_key: "dialect_allowed",
  },
  "C.auto_switch": {
    usage: "runtime",
    supabase_table: "persona",
    required: true,
    description: "Auto-switch language based on player",
    runtime_key: "auto_switch",
  },

  // ============================================================
  // L. INTERACTION LIBRARY → voc_agent_library
  // ============================================================
  "L.greetings.default": {
    usage: "runtime",
    supabase_table: "library",
    required: true,
    description: "Default greeting template",
    runtime_key: "greeting_default",
  },
  "L.greetings.morning": {
    usage: "runtime",
    supabase_table: "library",
    required: false,
    description: "Morning greeting template",
    runtime_key: "greeting_morning",
  },
  "L.greetings.afternoon": {
    usage: "runtime",
    supabase_table: "library",
    required: false,
    description: "Afternoon greeting template",
    runtime_key: "greeting_afternoon",
  },
  "L.greetings.evening": {
    usage: "runtime",
    supabase_table: "library",
    required: false,
    description: "Evening greeting template",
    runtime_key: "greeting_evening",
  },
  "L.greetings.night": {
    usage: "runtime",
    supabase_table: "library",
    required: false,
    description: "Night greeting template",
    runtime_key: "greeting_night",
  },
  "L.greetings.vip": {
    usage: "runtime",
    supabase_table: "library",
    required: false,
    description: "VIP greeting template",
    runtime_key: "greeting_vip",
  },
  "L.closings.normal": {
    usage: "runtime",
    supabase_table: "library",
    required: true,
    description: "Normal closing template",
    runtime_key: "closing_normal",
  },
  "L.closings.vip": {
    usage: "runtime",
    supabase_table: "library",
    required: false,
    description: "VIP closing template",
    runtime_key: "closing_vip",
  },
  "L.closings.soft_push": {
    usage: "runtime",
    supabase_table: "library",
    required: false,
    description: "Soft push closing template",
    runtime_key: "closing_soft_push",
  },
  "L.closings.neutral": {
    usage: "runtime",
    supabase_table: "library",
    required: false,
    description: "Neutral closing template",
    runtime_key: "closing_neutral",
  },
  "L.closings.angry": {
    usage: "runtime",
    supabase_table: "library",
    required: false,
    description: "Angry player closing template",
    runtime_key: "closing_angry",
  },
  "L.apologies.mild": {
    usage: "runtime",
    supabase_table: "library",
    required: false,
    description: "Mild apology template",
    runtime_key: "apology_mild",
  },
  "L.apologies.medium": {
    usage: "runtime",
    supabase_table: "library",
    required: false,
    description: "Medium apology template",
    runtime_key: "apology_medium",
  },
  "L.apologies.severe": {
    usage: "runtime",
    supabase_table: "library",
    required: false,
    description: "Severe apology template",
    runtime_key: "apology_severe",
  },
  "L.empathy_phrases": {
    usage: "runtime",
    supabase_table: "library",
    required: false,
    description: "Empathy phrase collection",
    runtime_key: "empathy_phrases",
  },

  // ============================================================
  // O. OPERATIONAL SOP → voc_agent_rules
  // ============================================================
  "O.admin_contact.method": {
    usage: "both",
    supabase_table: "rules",
    required: true,
    description: "Admin contact method (WA/Telegram)",
    runtime_key: "admin_contact_method",
  },
  "O.admin_contact.value": {
    usage: "runtime",
    supabase_table: "rules",
    required: true,
    description: "Admin contact value",
    runtime_key: "admin_contact",
  },
  "O.admin_contact.active_hours": {
    usage: "runtime",
    supabase_table: "rules",
    required: false,
    description: "Admin active hours",
    runtime_key: "admin_hours",
  },
  "O.escalation.sop_style": {
    usage: "runtime",
    supabase_table: "rules",
    required: true,
    description: "SOP escalation style",
    runtime_key: "sop_style",
  },
  "O.escalation.threshold_triggers": {
    usage: "runtime",
    supabase_table: "rules",
    required: false,
    description: "Escalation trigger keywords",
    runtime_key: "escalation_triggers",
  },
  "O.escalation.default_message": {
    usage: "runtime",
    supabase_table: "rules",
    required: false,
    description: "Default escalation message",
    runtime_key: "escalation_message",
  },
  "O.escalation.auto_escalate": {
    usage: "runtime",
    supabase_table: "rules",
    required: true,
    description: "Auto-escalate enabled",
    runtime_key: "auto_escalate",
  },
  "O.escalation.max_ai_attempts": {
    usage: "runtime",
    supabase_table: "rules",
    required: true,
    description: "Max AI attempts before escalation",
    runtime_key: "max_ai_attempts",
  },
  // O.complaints removed - feature deprecated (use General Knowledge Base instead)
  "O.crisis.tone": {
    usage: "runtime",
    supabase_table: "rules",
    required: true,
    description: "Crisis response tone",
    runtime_key: "crisis_tone",
  },
  "O.crisis.dictionary_red": {
    usage: "runtime",
    supabase_table: "rules",
    required: false,
    description: "Critical blocked words (red)",
    runtime_key: "dictionary_red",
  },
  "O.crisis.dictionary_yellow": {
    usage: "runtime",
    supabase_table: "rules",
    required: false,
    description: "Warning words (yellow)",
    runtime_key: "dictionary_yellow",
  },
  "O.crisis.severity_weights": {
    usage: "runtime",
    supabase_table: "rules",
    required: true,
    description: "Severity weights for dictionary",
    runtime_key: "severity_weights",
  },
  "O.crisis.templates": {
    usage: "runtime",
    supabase_table: "rules",
    required: false,
    description: "Crisis response templates",
    runtime_key: "crisis_templates",
  },
  "O.risk.appetite": {
    usage: "both",
    supabase_table: "rules",
    required: true,
    description: "Risk appetite level 0-100",
    runtime_key: "risk_appetite",
  },
  "O.risk.preventive_bonus_allowed": {
    usage: "runtime",
    supabase_table: "rules",
    required: true,
    description: "Preventive bonus enabled",
    runtime_key: "preventive_bonus",
  },

  // ============================================================
  // C. COMMUNICATION ENGINE (Continued) - Personalization (v1.2: Relocated from B)
  // ============================================================
  "C.personalization.level": {
    usage: "runtime",
    supabase_table: "persona",
    required: true,
    description: "Personalization level 1-10 (v1.2: relocated from B-block)",
    runtime_key: "personalization_level",
  },
  "C.personalization.memory_enabled": {
    usage: "runtime",
    supabase_table: "persona",
    required: true,
    description: "Memory enabled for context (v1.2: relocated from B-block)",
    runtime_key: "memory_enabled",
  },

  // ============================================================
  // O. OPERATIONAL SOP (Continued) - Anti-Hunter (v1.2: Relocated from B)
  // ============================================================
  "O.anti_hunter.enabled": {
    usage: "runtime",
    supabase_table: "rules",
    required: true,
    description: "Anti-hunter detection enabled (v1.2: relocated from B-block)",
    runtime_key: "anti_hunter_enabled",
  },
  "O.anti_hunter.rules": {
    usage: "runtime",
    supabase_table: "rules",
    required: false,
    description: "Anti-hunter detection rules (v1.2: relocated from B-block)",
    runtime_key: "anti_hunter_rules",
  },

  // ============================================================
  // B. BEHAVIOUR ENGINE (DEPRECATED in v1.2 - References kept for backward compatibility)
  // ============================================================
  /** @deprecated Use C.personalization.level instead */
  "B.personalization.level": {
    usage: "runtime",
    supabase_table: "rules",
    required: false,
    description: "[DEPRECATED] Personalization level 1-10 - Use C.personalization.level",
    runtime_key: "personalization_level",
  },
  /** @deprecated Use C.personalization.memory_enabled instead */
  "B.personalization.memory_enabled": {
    usage: "runtime",
    supabase_table: "rules",
    required: false,
    description: "[DEPRECATED] Memory enabled - Use C.personalization.memory_enabled",
    runtime_key: "memory_enabled",
  },
  /** @deprecated Use O.anti_hunter.enabled instead */
  "B.anti_hunter.enabled": {
    usage: "runtime",
    supabase_table: "rules",
    required: false,
    description: "[DEPRECATED] Anti-hunter enabled - Use O.anti_hunter.enabled",
    runtime_key: "anti_hunter_enabled",
  },
  /** @deprecated Use O.anti_hunter.rules instead */
  "B.anti_hunter.rules": {
    usage: "runtime",
    supabase_table: "rules",
    required: false,
    description: "[DEPRECATED] Anti-hunter rules - Use O.anti_hunter.rules",
    runtime_key: "anti_hunter_rules",
  },

  // ============================================================
  // V. VIP LOGIC → voc_agent_rules
  // ============================================================
  "V.active": {
    usage: "runtime",
    supabase_table: "rules",
    required: true,
    description: "VIP logic active",
    runtime_key: "vip_active",
  },
  "V.threshold": {
    usage: "both",
    supabase_table: "rules",
    required: true,
    description: "VIP threshold configuration",
    runtime_key: "vip_threshold",
  },
  "V.greeting": {
    usage: "runtime",
    supabase_table: "rules",
    required: false,
    description: "VIP greeting override",
    runtime_key: "vip_greeting",
  },
  "V.closing": {
    usage: "runtime",
    supabase_table: "rules",
    required: false,
    description: "VIP closing override",
    runtime_key: "vip_closing",
  },
  "V.tone_modifiers": {
    usage: "runtime",
    supabase_table: "rules",
    required: true,
    description: "VIP tone adjustment sliders",
    runtime_key: "vip_tone_modifiers",
  },
  "V.priority_response": {
    usage: "runtime",
    supabase_table: "rules",
    required: true,
    description: "Priority response enabled for VIP",
    runtime_key: "vip_priority",
  },
  "V.svip_rules": {
    usage: "both",
    supabase_table: "rules",
    required: false,
    description: "SVIP tier rules",
    runtime_key: "svip_rules",
  },
} as const;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get all fields by usage type
 */
export function getFieldsByUsage(usage: FieldUsage): string[] {
  return Object.entries(FIELD_USAGE_MAP)
    .filter(([_, def]) => def.usage === usage || def.usage === "both")
    .map(([key]) => key);
}

/**
 * Get all fields by Supabase table
 */
export function getFieldsByTable(table: SupabaseTable): string[] {
  return Object.entries(FIELD_USAGE_MAP)
    .filter(([_, def]) => def.supabase_table === table)
    .map(([key]) => key);
}

/**
 * Get all required fields
 */
export function getRequiredFields(): string[] {
  return Object.entries(FIELD_USAGE_MAP)
    .filter(([_, def]) => def.required)
    .map(([key]) => key);
}

/**
 * Get all runtime fields (for prompt injection)
 */
export function getRuntimeFields(): string[] {
  return Object.entries(FIELD_USAGE_MAP)
    .filter(([_, def]) => def.usage === "runtime" || def.usage === "both")
    .map(([key]) => key);
}

/**
 * Get field definition
 */
export function getFieldDefinition(fieldPath: string): FieldDefinition | undefined {
  return FIELD_USAGE_MAP[fieldPath];
}

/**
 * Check if field is required
 */
export function isFieldRequired(fieldPath: string): boolean {
  return FIELD_USAGE_MAP[fieldPath]?.required ?? false;
}

/**
 * Get runtime key for field
 */
export function getRuntimeKey(fieldPath: string): string | undefined {
  return FIELD_USAGE_MAP[fieldPath]?.runtime_key;
}

// ============================================================
// STATISTICS
// ============================================================

export function getFieldStats(): {
  total: number;
  ui_only: number;
  runtime: number;
  rag: number;
  both: number;
  required: number;
  by_table: Record<SupabaseTable, number>;
} {
  const entries = Object.entries(FIELD_USAGE_MAP);
  
  return {
    total: entries.length,
    ui_only: entries.filter(([_, d]) => d.usage === "ui_only").length,
    runtime: entries.filter(([_, d]) => d.usage === "runtime").length,
    rag: entries.filter(([_, d]) => d.usage === "rag").length,
    both: entries.filter(([_, d]) => d.usage === "both").length,
    required: entries.filter(([_, d]) => d.required).length,
    by_table: {
      persona: entries.filter(([_, d]) => d.supabase_table === "persona").length,
      library: entries.filter(([_, d]) => d.supabase_table === "library").length,
      rules: entries.filter(([_, d]) => d.supabase_table === "rules").length,
    },
  };
}

// ============================================================
// VERSION
// ============================================================

export const FIELD_MAP_VERSION = "1.2.0" as const;
