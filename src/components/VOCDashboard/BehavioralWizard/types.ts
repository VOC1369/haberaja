// B-KB V6.1 Data Types — Behavior Rule Validator + Blueprint Schema

// ========== V6.1: LOCKED ENUMS (Source of Truth) ==========
export const V6_BEHAVIOR_CATEGORIES = [
  "anger", "annoyed", "fear", "confusion", "disappointment",
  "urgency", "toxic_light", "toxic_heavy", "churn_threat",
  "passive_aggressive", "bargaining", "high_pressure"
] as const;

export const V6_INTENT_PERILAKU = [
  "certainty", "fairness", "emotional_validation", "trust_issue",
  "clarity_need", "priority_pain", "urgent_solution", "testing_limits",
  "quit_intent", "reward_defense", "guidance", "promo_validation"
] as const;

export const V6_MODE_RESPONS = [
  "calming", "high_empathy", "assurance", "short",
  "assertive_clarity", "boundary", "warning", "crisis"
] as const;

// V6.1: Required patterns per behavior_category (OR logic)
export const V6_REQUIRED_PATTERNS: Record<string, string[]> = {
  toxic_heavy: ["capslock", "short_phrases", "threat_pattern"],
  high_pressure: ["rapid_message", "repetitive_complaint"],
  churn_threat: ["repetitive_complaint"],
  disappointment: ["emoji_intensity"],
  toxic_light: ["sarcasm_markers"]  // optional, bisa kosong
};

// V6.1: Default intent per behavior_category (untuk WARNING)
export const V6_DEFAULT_INTENTS: Record<string, string> = {
  toxic_heavy: "testing_limits",
  high_pressure: "urgent_solution",
  churn_threat: "quit_intent",
  disappointment: "emotional_validation",
  fear: "trust_issue",
  confusion: "clarity_need",
  anger: "emotional_validation",
  annoyed: "priority_pain",
  urgency: "urgent_solution",
  passive_aggressive: "testing_limits",
  bargaining: "reward_defense"
};

// V6.1: Scenario Weight for priority calculation
export const V6_SCENARIO_WEIGHTS: Record<string, number> = {
  toxic_heavy: 15,
  threat_pattern: 15,  // alias check for pattern-based scenarios
  churn_threat: 10,
  high_pressure: 8,
  disappointment: 5,
  anger: 5,
  fear: 3,
  urgency: 3,
  annoyed: 2,
  toxic_light: 2,
  passive_aggressive: 2,
  bargaining: 1,
  confusion: 1
};

// ========== LAYER 1: UI FIELDS (Tidak dipakai AI) ==========
export interface UILayerFields {
  display_name: string;      // User-friendly name (bebas spasi, emoji, bahasa Indonesia)
  created_by?: string;       // Admin yang membuat
  notes_admin?: string;      // Catatan internal admin
  tags?: string[];           // Untuk filter/grouping di UI
}

// ========== LAYER 2: AI BEHAVIOR LAYER (Otak B-KB) ==========
export interface AILayerFields {
  rule_name: string;         // System-generated (WIZ_{Scenario}_{Mode}_{Date})
  behavior_category: string; // Enum: ToxicHeavy, Anger, etc.
  intent_perilaku: string;   // snake_case enum: testing_limits, etc.
  pattern_trigger: Record<string, boolean>;
  severity_level: number;    // 1-5
  mode_respons: string;      // snake_case enum: calming, high_empathy, etc.
  response_template: string; // What AI says
  reasoning_guideline: string; // How AI thinks
  applicability_criteria: string; // NEW: When this rule applies (natural language)
  handoff_protocol: {
    required: boolean;
    type: "active_handover" | "silent_handover" | "monitoring";
    tag_alert: string;
  };
}

// ========== AI PROMPT PAYLOAD (subset of AILayerFields for LLM) ==========
export interface AIPromptPayload {
  behavior_category: string;
  intent_perilaku: string;
  applicability_criteria: string;
  severity_level: number;
  mode_respons: string;
  response_template: string;
  reasoning_guideline: string;
  handoff_protocol: {
    required: boolean;
    type: "active_handover" | "silent_handover" | "monitoring";
    tag_alert: string;
  };
}

// ========== LAYER 3: SYSTEM/PRIORITY LAYER ==========
export interface SystemLayerFields {
  id: string;                // UUID
  client_id?: string;        // Multi-tenant support
  status: "active" | "draft" | "expired";
  version: string;           // Semantic versioning
  priority: number;          // 1-100, auto-calculated
  manual_priority_override?: boolean;  // V5.2.1: Flag untuk PM tuning
  brand_tone: "Formal" | "Semi-Formal" | "Casual";
  created_at: string;        // ISO timestamp
  updated_at: string;        // ISO timestamp
  last_validated_at?: string;          // V5.2.1: Warning lifecycle
  auto_fixed_fields?: string[];        // V5.2.1: Fields yang di-auto-fix
  expires_at?: string | null;
}

// ========== COMPLETE RULE = UI + AI + SYSTEM ==========
export interface BehavioralRuleItem extends UILayerFields, AILayerFields, SystemLayerFields {}

// ========== WIZARD FORM DATA ==========
export interface WizardFormData {
  scenario: string;
  reaction: "soft" | "firm" | "handoff";
  brand_tone: "Formal" | "Semi-Formal" | "Casual";
  response_template: string;
  reasoning_guideline: string;
  severity_level: number;
  priority: number;
  expires_at?: string | null;
  handoff_type?: "active_handover" | "silent_handover";
  
  // V5.2: Dual Naming System
  display_name: string;       // User-friendly name (bebas)
  
  // V5.2.1: UI Layer (optional)
  notes_admin?: string;
  tags?: string[];
  
  // Auto-mapped from scenario
  behavior_category: string;
  intent_perilaku: string;
  pattern_trigger: Record<string, boolean>;
  mode_respons: string;
  
  // Phase 2: Rule selection contract
  applicability_criteria: string;
}

// ========== VALIDATION GUARD V6.1 ==========
export interface ValidationResult {
  isValid: boolean;
  violations: string[];
  autoFixed?: Partial<BehavioralRuleItem>;
}

// V6.1: Enhanced Validation Result with BLOCK mechanism
export interface ValidationResultV6 {
  isValid: boolean;
  isBlocked: boolean;  // BLOCK mechanism - cannot save
  violations: string[];
  warnings: string[];  // Separate warnings (non-blocking)
  autoFixed?: Partial<BehavioralRuleItem>;
}

// V6: Derive reaction from mode_respons enum (snake_case)
export function derivedReactionFromMode(modeEnum: string): "soft" | "firm" | "handoff" {
  const normalized = modeEnum.toLowerCase().replace(/\s+/g, "_");
  
  // V6 Cluster Lock: short bisa di SOFT atau FIRM
  const softModes = ["calming", "high_empathy", "assurance", "short"];
  const firmModes = ["assertive_clarity", "boundary", "warning", "short"];
  const handoffModes = ["crisis"];
  
  if (handoffModes.includes(normalized)) return "handoff";
  // Firm check sebelum soft untuk short (default firm jika ambigu)
  if (firmModes.includes(normalized) && !["calming", "high_empathy", "assurance"].includes(normalized)) {
    // short defaults to soft if context unclear
    if (normalized === "short") return "soft";
    return "firm";
  }
  if (softModes.includes(normalized)) return "soft";
  
  // Fallback dengan warning
  console.warn(`[B-KB V6 Guard] Unknown mode: ${modeEnum}, defaulting to soft`);
  return "soft";
}

// V6.1: Official Priority Calculation Formula
// priority = (severity_level × 15) + scenario_weight + 10
export function calculatePriorityV6(behavior_category: string, severity: number): number {
  const scenarioWeight = V6_SCENARIO_WEIGHTS[behavior_category] || 1;
  return Math.min(100, Math.max(10, (severity * 15) + scenarioWeight + 10));
}

// V6.1: Validate rule_name format - WIZ_{ScenarioEngPascal}_{ReactionCamel}_{YYYYMMDD}
// Also allows SEED_ prefix for seed data
export function validateRuleNameFormat(ruleName: string): boolean {
  const ruleNameRegex = /^(WIZ|SEED)_[A-Z][a-zA-Z]+_(Soft|Firm|Handoff)_\d{8}$/;
  return ruleNameRegex.test(ruleName);
}

// V6.1: MAIN VALIDATOR - Full compliance check
export function validateBehavioralRuleV6(rule: BehavioralRuleItem): ValidationResultV6 {
  const violations: string[] = [];
  const warnings: string[] = [];
  const autoFixed: Partial<BehavioralRuleItem> = {};
  let isBlocked = false;

  // 🔒1: display_name is IGNORED (tidak digunakan dalam validasi)

  // 🔒3: Validate rule_name format
  if (rule.rule_name && !validateRuleNameFormat(rule.rule_name)) {
    violations.push(`Invalid rule_name format: "${rule.rule_name}" (expected: WIZ_{ScenarioEngPascal}_{Reaction}_{YYYYMMDD})`);
    isBlocked = true; // BLOCK
  }

  // 🔒4: Validate ENUM exact match - behavior_category
  if (!V6_BEHAVIOR_CATEGORIES.includes(rule.behavior_category as typeof V6_BEHAVIOR_CATEGORIES[number])) {
    violations.push(`Invalid behavior_category: "${rule.behavior_category}" (must be one of: ${V6_BEHAVIOR_CATEGORIES.join(", ")})`);
    isBlocked = true; // BLOCK
  }

  // 🔒4: Validate ENUM exact match - intent_perilaku
  if (!V6_INTENT_PERILAKU.includes(rule.intent_perilaku as typeof V6_INTENT_PERILAKU[number])) {
    violations.push(`Invalid intent_perilaku: "${rule.intent_perilaku}" (must be one of: ${V6_INTENT_PERILAKU.join(", ")})`);
    isBlocked = true; // BLOCK
  }

  // 🔒4: Validate ENUM exact match - mode_respons
  if (!V6_MODE_RESPONS.includes(rule.mode_respons as typeof V6_MODE_RESPONS[number])) {
    violations.push(`Invalid mode_respons: "${rule.mode_respons}" (must be one of: ${V6_MODE_RESPONS.join(", ")})`);
    isBlocked = true; // BLOCK
  }

  // 🔒5: Cluster Lock validation with AUTO-FIX
  const softModes = ["calming", "high_empathy", "assurance", "short"];
  const firmModes = ["assertive_clarity", "boundary", "warning", "short"];
  const crisisModes = ["crisis"];

  // Soft Cluster: severity WAJIB 1-3
  if (softModes.includes(rule.mode_respons) && !crisisModes.includes(rule.mode_respons)) {
    if (rule.severity_level > 3) {
      warnings.push(`Soft cluster mode "${rule.mode_respons}" has severity ${rule.severity_level} > 3. AUTO-FIX to 3.`);
      autoFixed.severity_level = 3;
    }
  }

  // Firm Cluster: severity WAJIB 2-4
  if (firmModes.includes(rule.mode_respons) && !softModes.includes(rule.mode_respons)) {
    if (rule.severity_level < 2) {
      warnings.push(`Firm cluster mode "${rule.mode_respons}" has severity ${rule.severity_level} < 2. AUTO-FIX to 2.`);
      autoFixed.severity_level = 2;
    }
    if (rule.severity_level > 4) {
      warnings.push(`Firm cluster mode "${rule.mode_respons}" has severity ${rule.severity_level} > 4. AUTO-FIX to 4.`);
      autoFixed.severity_level = 4;
    }
  }

  // Crisis Cluster: severity WAJIB 4-5
  if (crisisModes.includes(rule.mode_respons)) {
    if (rule.severity_level < 4) {
      warnings.push(`Crisis mode has severity ${rule.severity_level} < 4. AUTO-FIX to 4.`);
      autoFixed.severity_level = 4;
    }
  }

  // 🔒6: Handoff Protocol validation
  if (rule.mode_respons === "crisis") {
    if (!rule.handoff_protocol?.required) {
      violations.push("Crisis mode requires handoff_protocol.required = true");
      autoFixed.handoff_protocol = { 
        ...rule.handoff_protocol, 
        required: true, 
        type: rule.handoff_protocol?.type === "active_handover" || rule.handoff_protocol?.type === "silent_handover" 
          ? rule.handoff_protocol.type 
          : "active_handover",
        tag_alert: rule.handoff_protocol?.tag_alert || "HIGH_PRIORITY"
      };
    }
    if (rule.handoff_protocol && !["active_handover", "silent_handover"].includes(rule.handoff_protocol.type)) {
      violations.push(`Crisis mode handoff_protocol.type must be "active_handover" or "silent_handover", got: "${rule.handoff_protocol.type}"`);
      autoFixed.handoff_protocol = {
        ...rule.handoff_protocol,
        required: true,
        type: "active_handover",
        tag_alert: rule.handoff_protocol.tag_alert || "HIGH_PRIORITY"
      };
    }
  }

  // 🔒7: Pattern Trigger validation (WARNING, not BLOCK)
  const requiredPatterns = V6_REQUIRED_PATTERNS[rule.behavior_category];
  if (requiredPatterns && requiredPatterns.length > 0) {
    const hasAnyPattern = requiredPatterns.some(p => rule.pattern_trigger?.[p] === true);
    // Special case: toxic_light patterns are optional
    if (!hasAnyPattern && rule.behavior_category !== "toxic_light") {
      warnings.push(`behavior_category "${rule.behavior_category}" expects at least one of: ${requiredPatterns.join(", ")}`);
    }
  }

  // 🔒8: Intent default logic (WARNING, not BLOCK)
  const expectedIntent = V6_DEFAULT_INTENTS[rule.behavior_category];
  if (expectedIntent && rule.intent_perilaku !== expectedIntent) {
    warnings.push(`intent "${rule.intent_perilaku}" may not match behavior_category "${rule.behavior_category}" (expected: ${expectedIntent})`);
  }

  // 🔒9: Priority calculation check
  const effectiveSeverity = autoFixed.severity_level ?? rule.severity_level;
  const expectedPriority = calculatePriorityV6(rule.behavior_category, effectiveSeverity);
  if (Math.abs(rule.priority - expectedPriority) > 10) {
    if (!rule.manual_priority_override) {
      warnings.push(`Priority ${rule.priority} differs from calculated (${expectedPriority}). AUTO-FIX.`);
      autoFixed.priority = expectedPriority;
    } else {
      warnings.push(`Priority ${rule.priority} differs from calculated (${expectedPriority}) - manual override aktif.`);
    }
  }

  return {
    isValid: violations.length === 0 && warnings.length === 0,
    isBlocked,
    violations,
    warnings,
    autoFixed: Object.keys(autoFixed).length > 0 ? autoFixed : undefined
  };
}

// V6.1: Legacy wrapper for backward compatibility
export function validateBehavioralRule(rule: BehavioralRuleItem): ValidationResult {
  const v6Result = validateBehavioralRuleV6(rule);
  return {
    isValid: v6Result.isValid,
    violations: [...v6Result.violations, ...v6Result.warnings],
    autoFixed: v6Result.autoFixed
  };
}

// ========== LAYER EXTRACTION HELPERS ==========

// Phase 2: Extract AI payload for LLM prompt — excludes admin-only fields
export function extractAIPayload(rule: BehavioralRuleItem): AIPromptPayload {
  return {
    behavior_category: rule.behavior_category,
    intent_perilaku: rule.intent_perilaku,
    applicability_criteria: rule.applicability_criteria || "",
    severity_level: rule.severity_level,
    mode_respons: rule.mode_respons,
    response_template: rule.response_template,
    reasoning_guideline: rule.reasoning_guideline,
    handoff_protocol: rule.handoff_protocol,
    // pattern_trigger EXCLUDED — admin workflow tool, not for LLM
    // rule_name EXCLUDED — system identifier, not relevant for LLM
  };
}

export function extractUIPayload(rule: BehavioralRuleItem): UILayerFields {
  return {
    display_name: rule.display_name,
    created_by: rule.created_by,
    notes_admin: rule.notes_admin,
    tags: rule.tags
  };
}

export function extractSystemPayload(rule: BehavioralRuleItem): SystemLayerFields {
  return {
    id: rule.id,
    client_id: rule.client_id,
    status: rule.status,
    version: rule.version,
    priority: rule.priority,
    manual_priority_override: rule.manual_priority_override,
    brand_tone: rule.brand_tone,
    created_at: rule.created_at,
    updated_at: rule.updated_at,
    last_validated_at: rule.last_validated_at,
    auto_fixed_fields: rule.auto_fixed_fields,
    expires_at: rule.expires_at
  };
}

// ========== KATEGORI & OPTIONS ==========

// V6: 12 Kategori Perilaku (snake_case enums)
export const behaviorCategories = [
  "Kemarahan (Anger)",           // → anger
  "Kesal / Frustrasi (Annoyed)", // → annoyed
  "Curiga / Takut Discam (Fear)",// → fear
  "Bingung (Confusion)",         // → confusion
  "Kecewa Berat (Disappointment)",// → disappointment
  "Mendesak / Panik (Urgency)",  // → urgency
  "Toxic Ringan (ToxicLight)",   // → toxic_light
  "Toxic Berat (ToxicHeavy)",    // → toxic_heavy
  "Ancaman Pergi (ChurnThreat)", // → churn_threat
  "Pasif-Agresif (PassiveAggressive)", // → passive_aggressive
  "Bargaining / Nego (Bargaining)", // → bargaining
  "High-Pressure (HighPressure)" // → high_pressure
];

// 13 Intent User (V5.1: Added BoundaryTest)
export const intentPerilakuOptions = [
  "Mencari Kepastian",
  "Mencari Keadilan",
  "Butuh Validasi Emosi",
  "Takut Discam / Trust Issue",
  "Ingin Penjelasan",
  "Merasa Tidak Diprioritaskan",
  "Butuh Solusi Cepat",
  "Menguji AI / Menggertak",
  "Menguji Batas / Dominasi", // V5.1: BoundaryTest for ToxicHeavy
  "Ingin Kabur / Quit",
  "Menuntut Keadilan Reward",
  "Ingin Diarahkan",
  "Konfirmasi Validitas Promo"
];

// 7 Pattern Trigger
export const patternTriggerOptions = [
  { key: "rapid_message", label: "Rapid Message (Spamming/Flood)" },
  { key: "capslock", label: "Capslock (Teriakan)" },
  { key: "repetitive_complaint", label: "Repetitive Complaint (Looping)" },
  { key: "short_phrases", label: "Short Phrases (Marah pendek)" },
  { key: "sarcasm_markers", label: "Sarcasm Markers (Nada sindiran)" },
  { key: "emoji_intensity", label: "Emoji Intensity (Marah visual)" },
  { key: "threat_pattern", label: "Threat Pattern (Ancaman sebar data)" }
];

// V6: 8 Mode Respons (UI Labels) - Removed Expansion & Retention
export const modeResponsOptions = [
  "Menenangkan (Calming)",
  "Empati Tinggi (High Empathy)",
  "Tegas & Jelas (Assertive Clarity)",
  "Penjelasan Ringkas (Short)",
  "Anti-Toxic (Boundary)",
  "Crisis Handling (Crisis)",
  "Trust Rebuild (Assurance)",
  "Penalty Warning (Warning)"
];

// Brand Tone Options
export const brandToneOptions: Array<"Formal" | "Semi-Formal" | "Casual"> = [
  "Formal",
  "Semi-Formal", 
  "Casual"
];

// V6: Mode Respons Locked per Reaksi (Cluster Lock)
export const reactionModeMapping: Record<"soft" | "firm" | "handoff", string[]> = {
  // V6 Soft Cluster: calming, high_empathy, assurance, short
  soft: [
    "Menenangkan (Calming)", 
    "Empati Tinggi (High Empathy)", 
    "Trust Rebuild (Assurance)",
    "Penjelasan Ringkas (Short)"
  ],
  // V6 Firm Cluster: assertive_clarity, boundary, warning, short
  firm: [
    "Tegas & Jelas (Assertive Clarity)", 
    "Anti-Toxic (Boundary)", 
    "Penjelasan Ringkas (Short)",
    "Penalty Warning (Warning)"
  ],
  // V6 Crisis Cluster: crisis only
  handoff: ["Crisis Handling (Crisis)"]
};

// ========== Severity Ranges ==========
export const scenarioSeverityRange: Record<string, { default: number; min: number; max: number; locked?: boolean }> = {
  marah_kasar: { default: 4, min: 3, max: 5 },
  spamming: { default: 2, min: 1, max: 3 },
  ancaman: { default: 5, min: 5, max: 5, locked: true },
  mau_pindah: { default: 4, min: 3, max: 5 },
  sarkas: { default: 1, min: 1, max: 2 },
  curhat_kalah: { default: 2, min: 1, max: 3 },
  merayu: { default: 1, min: 1, max: 2 }
};

// V5.2.1: Severity Range per REACTION (Double-Lock)
export const reactionSeverityRange: Record<"soft" | "firm" | "handoff", { min: number; max: number }> = {
  soft: { min: 1, max: 3 },
  firm: { min: 2, max: 4 },
  handoff: { min: 4, max: 5 }
};

// V6: English Mapping for Rule Name (PascalCase for rule_name format)
export const scenarioEnglishMapping: Record<string, string> = {
  marah_kasar: "ToxicHeavy",
  spamming: "HighPressure",    // V6: maps to high_pressure
  ancaman: "Threat",
  mau_pindah: "ChurnThreat",
  sarkas: "ToxicLight",        // V6: maps to toxic_light
  curhat_kalah: "Disappointment",
  merayu: "ToxicLight"         // V6: maps to toxic_light (same as sarkas)
};

// ========== V6: ENUM MAPPINGS (snake_case - LOCKED) ==========

// V6: Behavior Category: UI Label → snake_case Enum
export const behaviorCategoryEnumMapping: Record<string, string> = {
  "Kemarahan (Anger)": "anger",
  "Kesal / Frustrasi (Annoyed)": "annoyed",
  "Curiga / Takut Discam (Fear)": "fear",
  "Bingung (Confusion)": "confusion",
  "Kecewa Berat (Disappointment)": "disappointment",
  "Mendesak / Panik (Urgency)": "urgency",
  "Toxic Ringan (ToxicLight)": "toxic_light",
  "Toxic Berat (ToxicHeavy)": "toxic_heavy",
  "Ancaman Pergi (ChurnThreat)": "churn_threat",
  "Pasif-Agresif (PassiveAggressive)": "passive_aggressive",
  "Bargaining / Nego (Bargaining)": "bargaining",
  "High-Pressure (HighPressure)": "high_pressure"
};

// V6: Intent Perilaku: UI Label → snake_case Enum (LOCKED)
export const intentEnumMapping: Record<string, string> = {
  "Mencari Kepastian": "certainty",
  "Mencari Keadilan": "fairness",
  "Butuh Validasi Emosi": "emotional_validation",
  "Takut Discam / Trust Issue": "trust_issue",
  "Ingin Penjelasan": "clarity_need",
  "Merasa Tidak Diprioritaskan": "priority_pain",
  "Butuh Solusi Cepat": "urgent_solution",
  "Menguji AI / Menggertak": "testing_limits",
  "Menguji Batas / Dominasi": "testing_limits",
  "Ingin Kabur / Quit": "quit_intent",
  "Menuntut Keadilan Reward": "reward_defense",
  "Ingin Diarahkan": "guidance",
  "Konfirmasi Validitas Promo": "promo_validation"
};

// V6: Mode Respons: UI Label → snake_case Enum (8 modes only - LOCKED)
export const modeResponsEnumMapping: Record<string, string> = {
  "Menenangkan (Calming)": "calming",
  "Empati Tinggi (High Empathy)": "high_empathy",
  "Tegas & Jelas (Assertive Clarity)": "assertive_clarity",
  "Penjelasan Ringkas (Short)": "short",
  "Anti-Toxic (Boundary)": "boundary",
  "Crisis Handling (Crisis)": "crisis",
  "Trust Rebuild (Assurance)": "assurance",
  "Penalty Warning (Warning)": "warning"
};

// V5.2.1: Reverse mapping for lookups (snake_case → UI Label)
export const modeResponsReverseMapping: Record<string, string> = Object.fromEntries(
  Object.entries(modeResponsEnumMapping).map(([k, v]) => [v, k])
);

// ========== V5.2.1: PRIORITY CALCULATION (Explicit Formula) ==========
export function calculatePriority(scenario: string, reaction: string, severity: number): number {
  const severityBase = severity * 10;
  
  const reactionModifier = reaction === "handoff" ? 25 : 
                           reaction === "firm" ? 15 : 
                           5;
  
  const highRiskScenarios = ["ancaman", "marah_kasar"];
  const mediumRiskScenarios = ["mau_pindah"];
  
  const scenarioModifier = highRiskScenarios.includes(scenario) ? 10 : 
                           mediumRiskScenarios.includes(scenario) ? 5 : 
                           0;
  
  return Math.min(100, Math.max(10, severityBase + reactionModifier + scenarioModifier));
}

// ========== V5.2.1: REASONING GUIDELINES (snake_case keys) ==========
export const reasoningGuidelinesMapping: Record<string, Record<string, string>> = {
  // ===== SOFT APPROACH MODES =====
  "calming": {
    default: "Fokus menenangkan. Validasi emosi dengan kalimat pendek. Jangan langsung tawarkan solusi, pastikan user merasa didengar dulu.",
    marah_kasar: "Prioritaskan validasi emosi TANPA meminta maaf kepada perilaku abusive. Jangan membalas kata kasar. Fokus menenangkan dengan kalimat singkat dan empati.",
    spamming: "Tenangkan dengan memberikan kepastian timeline. Jelaskan bahwa pesan sudah diterima dan sedang diproses.",
    ancaman: "Validasi kekhawatiran tanpa mengakui ancaman. Tetap tenang dan tawarkan solusi alternatif dengan empati.",
    mau_pindah: "Tunjukkan empati dan apresiasi. Fokus menenangkan dulu sebelum tawarkan solusi. Jangan memaksa atau defensif.",
    sarkas: "Jangan terpancing nada sarkastik. Balas dengan ketenangan dan profesionalisme tinggi.",
    curhat_kalah: "Berikan validasi emosi penuh. Dengarkan curhatnya. Fokus empati, jangan buru-buru solusi.",
    merayu: "Tolak dengan ramah dan tenang. Jelaskan batasan dengan cara yang tidak menyinggung."
  },
  "high_empathy": {
    default: "Berikan empati maksimal. Dengarkan lebih dari berbicara. Refleksikan perasaan user. Tunjukkan bahwa Anda benar-benar memahami situasinya.",
    marah_kasar: "Validasi emosi dengan empati tinggi. Akui bahwa situasi ini pasti sangat melelahkan. Tunjukkan pemahaman mendalam tanpa membenarkan perilaku abusive.",
    spamming: "Pahami urgensi user. Tunjukkan bahwa Anda mengerti mengapa mereka frustrasi menunggu. Berikan empati atas ketidakpastian.",
    ancaman: "Tunjukkan empati atas kekecewaan mendalam. Pahami dari sudut pandang user mengapa mereka sampai di titik ini.",
    mau_pindah: "Ekspresikan pemahaman mendalam tentang kekecewaan mereka. Tunjukkan bahwa perasaan ingin pindah itu valid.",
    sarkas: "Abaikan nada, fokus ke substansi emosi di balik sarkasme. Tunjukkan empati atas frustrasi yang terpendam.",
    curhat_kalah: "Berikan empati maksimal. Ini momen untuk benar-benar mendengarkan. Biarkan user merasa ditemani.",
    merayu: "Pahami bahwa di balik rayuan mungkin ada kebutuhan nyata. Tunjukkan empati sambil tetap jelas dengan batasan."
  },
  "assurance": {
    default: "Fokus membangun kembali kepercayaan. Berikan jaminan konkret. Tunjukkan komitmen dengan bukti, bukan janji kosong.",
    marah_kasar: "Fokus rebuild trust. Jelaskan langkah konkret yang akan diambil. Buktikan dengan tindakan, bukan kata-kata.",
    spamming: "Berikan kepastian dan jaminan bahwa permintaan sudah tercatat. Jelaskan timeline yang realistis.",
    ancaman: "Rebuild trust dengan transparansi. Jelaskan proses dan kebijakan dengan jelas. Tunjukkan komitmen.",
    mau_pindah: "Tunjukkan value yang telah diberikan. Berikan jaminan perbaikan. Tawarkan bukti komitmen.",
    sarkas: "Buktikan dengan tindakan bahwa concern mereka ditangani serius. Jangan hanya bicara, tunjukkan.",
    curhat_kalah: "Berikan assurance bahwa pengalaman buruk tidak mendefinisikan keseluruhan. Tunjukkan support system yang ada.",
    merayu: "Jelaskan bahwa aturan berlaku sama untuk semua demi fairness. Tunjukkan bahwa ini justru melindungi mereka."
  },
  "short": {
    default: "Jawab singkat dan to the point. Maksimal 2-3 kalimat. Tidak perlu elaborasi panjang.",
    marah_kasar: "Jawab singkat. Tidak perlu validasi panjang. Langsung ke inti: 'Saya paham. Mari kita selesaikan.'",
    spamming: "Respons singkat: 'Pesan diterima. Sedang diproses. Update dalam X menit.'",
    ancaman: "Singkat tapi jelas: 'Kami akan bantu. Ini langkah selanjutnya: ...'",
    mau_pindah: "Singkat: 'Kami hargai feedback Anda. Ini yang bisa kami tawarkan: ...'",
    sarkas: "Abaikan sarkasme, jawab substansi dengan singkat dan langsung.",
    curhat_kalah: "Singkat tapi empati: 'Saya mengerti. Ini yang bisa dilakukan: ...'",
    merayu: "Singkat: 'Terima kasih, tapi aturan berlaku sama untuk semua.'"
  },

  // ===== FIRM APPROACH MODES =====
  "assertive_clarity": {
    default: "Sampaikan dengan tegas dan jelas. Tidak bertele-tele. Langsung ke poin. Tidak perlu terlalu banyak empati, fokus ke solusi atau batasan.",
    marah_kasar: "Tetapkan batasan komunikasi dengan tegas. Jangan meminta maaf pada perilaku abusive. Arahkan ke jalur sopan atau hentikan.",
    spamming: "Tegaskan bahwa flooding tidak mempercepat proses. Berikan satu warning jelas. Batasi respons jika berlanjut.",
    ancaman: "Jangan berkompromi dengan ancaman. Tegaskan kebijakan dan konsekuensi dengan jelas tanpa negosiasi.",
    mau_pindah: "Hormati keputusan. Jelaskan value yang akan hilang secara objektif. Tidak perlu memohon.",
    sarkas: "Abaikan nada sindiran. Fokus ke substansi masalah dengan jawaban langsung dan tegas.",
    curhat_kalah: "Akui perasaannya singkat, lalu arahkan ke langkah konkret yang bisa diambil.",
    merayu: "Tegaskan bahwa aturan berlaku tanpa pengecualian. Tidak ada negosiasi untuk hal ini."
  },
  "boundary": {
    default: "Tetapkan batasan keras. Jelaskan bahwa perilaku tertentu tidak bisa ditoleransi. Berikan warning jelas tentang konsekuensi.",
    marah_kasar: "Batasan keras: 'Saya ingin membantu, namun komunikasi sopan diperlukan.' Jika berlanjut: 'Percakapan tidak dapat dilanjutkan.'",
    spamming: "Batasan jelas: 'Pengiriman pesan berulang tidak ditoleransi. Satu pesan sudah cukup.' Warning jika berlanjut.",
    ancaman: "Zero tolerance untuk ancaman. 'Kami tidak dapat merespons ancaman. Silakan gunakan jalur resmi jika ada keluhan.'",
    mau_pindah: "Tetap profesional tapi tegas. Tidak perlu memelas. 'Kami menghormati keputusan Anda.'",
    sarkas: "Tidak terpancing. 'Saya fokus membantu masalah Anda. Silakan sampaikan keluhan dengan jelas.'",
    curhat_kalah: "Empati singkat, lalu boundary: 'Saya mengerti frustrasinya. Tapi yang bisa dilakukan sekarang adalah: ...'",
    merayu: "Boundary jelas: 'Terima kasih, tapi semua promo mengikuti aturan tanpa pengecualian.'"
  },
  "warning": {
    default: "Berikan warning formal tentang konsekuensi. Jelaskan langkah selanjutnya jika perilaku berlanjut.",
    marah_kasar: "Warning formal: 'Perilaku ini melanggar guidelines komunikasi. Jika berlanjut, akses dapat dibatasi.'",
    spamming: "Warning: 'Spam berulang dapat mengakibatkan pembatasan akses sementara. Mohon tunggu respons.'",
    ancaman: "Warning serius: 'Ancaman tidak bisa ditoleransi dan dapat berakibat pada penutupan akun.'",
    mau_pindah: "Tidak perlu warning keras. Fokus ke informasi terakhir yang perlu diketahui.",
    sarkas: "Warning ringan: 'Komunikasi yang sopan akan mempercepat penyelesaian masalah Anda.'",
    curhat_kalah: "Bukan konteks untuk warning. Fokus ke guidance positif.",
    merayu: "Warning ringan: 'Permintaan yang tidak sesuai aturan tidak dapat diproses.'"
  },

  // ===== HANDOFF MODE =====
  "crisis": {
    default: "CRITICAL: Jangan berdebat. Jangan validasi berlebihan. Langsung transfer ke agen manusia dengan tag HIGH_PRIORITY.",
    marah_kasar: "Situasi berbahaya. Jangan berdebat. Jangan validasi. Jangan meminta maaf. Langsung transfer ke agen dengan tag HIGH_PRIORITY.",
    spamming: "Eskalasi karena potensi abuse sistem. Transfer dengan catatan pattern spamming.",
    ancaman: "CRITICAL: Jangan berdebat. Jangan validasi ancaman. Langsung transfer ke manusia. [TRANSFER_TO_AGENT]",
    mau_pindah: "User sudah final. Transfer ke tim retention untuk penanganan khusus.",
    sarkas: "Jika sarkas berlanjut dan tidak produktif, transfer ke manusia untuk de-escalation.",
    curhat_kalah: "Jika menunjukkan tanda distress berat, transfer ke agen untuk pendampingan personal.",
    merayu: "Jika rayuan berubah jadi pressure atau harassment, transfer ke manusia."
  },
};

// ========== V5.2.1: RESPONSE TEMPLATES (snake_case keys) ==========
export const responseTemplateMapping: Record<string, Record<string, string>> = {
  // ===== SOFT APPROACH MODES =====
  "calming": {
    default: "Saya mendengar Anda. Tenang, mari kita selesaikan ini bersama. Apa yang bisa saya bantu?",
    marah_kasar: "Saya memahami frustrasi Anda. Perasaan Anda valid. Mari kita selesaikan masalah ini bersama dengan tenang...",
    spamming: "Saya sudah menerima pesan Anda. Tenang, saya sedang memproses. Anda akan mendapat update segera.",
    ancaman: "Saya memahami Anda sangat kecewa. Mari tenang sebentar dan cari solusi bersama...",
    mau_pindah: "Saya mengerti perasaan Anda. Boleh cerita lebih lanjut apa yang membuat Anda mempertimbangkan hal ini?",
    sarkas: "Saya mengerti ada frustrasi. Tenang, izinkan saya membantu dengan lebih baik. Apa yang sebenarnya Anda butuhkan?",
    curhat_kalah: "Saya mendengar Anda. Pengalaman seperti ini memang tidak mudah. Saya di sini untuk membantu...",
    merayu: "Haha, terima kasih atas perhatiannya. Sayangnya saya tidak bisa memberikan pengecualian, tapi mari kita lihat apa yang bisa saya bantu..."
  },
  "high_empathy": {
    default: "Saya benar-benar memahami apa yang Anda rasakan. Ini pasti tidak mudah. Saya di sini untuk membantu Anda.",
    marah_kasar: "Saya benar-benar merasakan frustrasi Anda. Ini pasti sangat melelahkan. Perasaan Anda valid dan saya ingin membantu...",
    spamming: "Saya mengerti Anda sangat butuh jawaban cepat. Perasaan menunggu memang tidak nyaman. Izinkan saya bantu...",
    ancaman: "Saya sangat memahami kekecewaan Anda yang mendalam. Situasi ini pasti sangat berat. Izinkan saya bantu mencari jalan keluar...",
    mau_pindah: "Saya sangat mengerti perasaan Anda. Setelah semua yang terjadi, wajar jika Anda merasa begini. Boleh saya tahu lebih dalam?",
    sarkas: "Saya merasakan ada frustrasi yang terpendam di balik kata-kata Anda. Saya ingin benar-benar memahami apa yang Anda alami...",
    curhat_kalah: "Saya sangat memahami perasaan Anda. Pengalaman seperti ini memang berat. Terima kasih sudah berbagi dengan saya...",
    merayu: "Saya mengerti keinginan Anda. Pasti ada alasan di balik permintaan ini. Sayangnya aturan berlaku sama untuk semua..."
  },
  "assurance": {
    default: "Kepercayaan Anda sangat penting bagi kami. Izinkan saya membuktikan komitmen kami dengan langkah konkret.",
    marah_kasar: "Saya paham trust sudah terganggu. Izinkan saya membuktikan dengan tindakan nyata. Ini yang akan saya lakukan: ...",
    spamming: "Saya jamin pesan Anda sudah tercatat. Proses sedang berjalan dan Anda akan mendapat update dalam [waktu].",
    ancaman: "Kami sangat serius menanggapi concern Anda. Izinkan saya jelaskan proses kami dengan transparan...",
    mau_pindah: "Kami sangat menghargai Anda sebagai member. Izinkan saya tunjukkan komitmen kami dengan penawaran khusus...",
    sarkas: "Saya ingin membuktikan bahwa concern Anda ditangani serius. Ini langkah konkret yang akan saya ambil: ...",
    curhat_kalah: "Pengalaman buruk tidak mendefinisikan keseluruhan. Izinkan saya tunjukkan support yang tersedia untuk Anda...",
    merayu: "Aturan berlaku sama untuk semua demi fairness. Ini justru melindungi Anda juga. Mari kita lihat promo yang tersedia..."
  },
  "short": {
    default: "Paham. Ini solusinya: [langkah]. Ada yang lain?",
    marah_kasar: "Saya paham. Mari selesaikan: [langkah konkret].",
    spamming: "Pesan diterima. Sedang proses. Update dalam [waktu].",
    ancaman: "Kami akan bantu. Langkah selanjutnya: [step].",
    mau_pindah: "Kami hargai feedback. Ini yang tersedia: [offer].",
    sarkas: "Langsung ke poin: [solusi]. Ada pertanyaan lain?",
    curhat_kalah: "Saya mengerti. Ini yang bisa dilakukan: [langkah].",
    merayu: "Terima kasih, tapi aturan berlaku sama untuk semua."
  },

  // ===== FIRM APPROACH MODES =====
  "assertive_clarity": {
    default: "Mari kita fokus ke solusi. Ini yang bisa saya bantu: [langkah]. Silakan ikuti prosedur yang berlaku.",
    marah_kasar: "Saya ingin membantu, namun saya memerlukan komunikasi yang lebih sopan agar percakapan dapat dilanjutkan. Sampaikan masalah Anda dengan jelas.",
    spamming: "Saya sudah mencatat permintaan Anda. Pengiriman pesan berulang tidak akan mempercepat proses. Mohon tunggu respons.",
    ancaman: "Kami memahami kekhawatiran Anda. Namun, kami tidak dapat merespons ancaman. Silakan sampaikan keluhan melalui jalur resmi.",
    mau_pindah: "Kami menghormati keputusan Anda. Sebelum melanjutkan, izinkan saya jelaskan benefit yang mungkin perlu dipertimbangkan.",
    sarkas: "Saya fokus menyelesaikan masalah Anda. Ini yang bisa saya bantu: [langkah konkret].",
    curhat_kalah: "Saya memahami kekecewaan Anda. Yang bisa saya sarankan adalah [langkah konkret yang bisa diambil].",
    merayu: "Terima kasih, tapi semua promo dan bonus mengikuti syarat dan ketentuan yang berlaku tanpa pengecualian."
  },
  "boundary": {
    default: "Komunikasi yang sopan diperlukan untuk melanjutkan percakapan ini. Silakan sampaikan keluhan dengan cara yang konstruktif.",
    marah_kasar: "Saya ingin membantu, namun komunikasi yang sopan diperlukan agar percakapan dapat dilanjutkan. Jika berlanjut, saya tidak dapat melayani.",
    spamming: "Pengiriman pesan berulang tidak akan mempercepat proses dan dapat dianggap sebagai spam. Mohon tunggu respons saya.",
    ancaman: "Kami tidak dapat merespons ancaman dalam bentuk apapun. Silakan gunakan jalur resmi jika ada keluhan.",
    mau_pindah: "Kami menghormati keputusan Anda sepenuhnya. Tidak ada yang bisa kami paksakan.",
    sarkas: "Saya fokus membantu masalah Anda. Silakan sampaikan keluhan dengan jelas agar saya dapat membantu.",
    curhat_kalah: "Saya mengerti frustrasinya. Yang bisa dilakukan sekarang adalah [langkah konkret]. Mari fokus ke sini.",
    merayu: "Semua promo mengikuti aturan yang berlaku tanpa pengecualian. Tidak ada negosiasi untuk hal ini."
  },
  "warning": {
    default: "Ini adalah peringatan resmi. Jika perilaku ini berlanjut, akses Anda dapat dibatasi sesuai kebijakan kami.",
    marah_kasar: "Perilaku ini melanggar guidelines komunikasi kami. Jika berlanjut, kami terpaksa membatasi akses Anda.",
    spamming: "Pengiriman spam berulang dapat mengakibatkan pembatasan akses sementara. Mohon bersabar menunggu respons.",
    ancaman: "Ancaman tidak dapat ditoleransi dan dapat berakibat pada penutupan akun. Mohon gunakan bahasa yang sopan.",
    mau_pindah: "Kami menghormati keputusan Anda. Ini informasi terakhir yang perlu Anda ketahui sebelum melanjutkan.",
    sarkas: "Komunikasi yang sopan akan mempercepat penyelesaian masalah Anda. Mari fokus ke solusi.",
    curhat_kalah: "Saya mengerti frustrasinya. Ini langkah yang bisa diambil ke depan: [guidance].",
    merayu: "Permintaan yang tidak sesuai aturan tidak dapat diproses. Silakan lihat promo yang sedang berlaku."
  },

  // ===== HANDOFF MODE =====
  "crisis": {
    default: "Situasi ini memerlukan penanganan langsung dari tim senior. Saya transfer sekarang. [TRANSFER_TO_AGENT]",
    marah_kasar: "Situasi ini memerlukan penanganan langsung dari tim senior. Saya transfer sekarang. [TRANSFER_TO_AGENT]",
    spamming: "Permintaan Anda memerlukan penanganan khusus. Saya transfer ke tim yang dapat membantu lebih cepat. [TRANSFER_TO_AGENT]",
    ancaman: "Situasi ini memerlukan penanganan langsung dari tim senior untuk memastikan masalah Anda ditangani dengan prioritas tinggi. [TRANSFER_TO_AGENT]",
    mau_pindah: "Saya akan menghubungkan Anda dengan tim khusus kami yang dapat memberikan penawaran terbaik. [TRANSFER_TO_AGENT]",
    sarkas: "Sepertinya ada miskomunikasi. Izinkan saya menghubungkan Anda dengan rekan yang mungkin bisa menjelaskan lebih baik. [TRANSFER_TO_AGENT]",
    curhat_kalah: "Saya ingin memastikan Anda mendapat pendampingan yang tepat. Izinkan saya menghubungkan dengan tim support kami. [TRANSFER_TO_AGENT]",
    merayu: "Untuk permintaan khusus seperti ini, saya perlu menghubungkan Anda dengan tim yang berwenang. [TRANSFER_TO_AGENT]"
  },
};

// V5.2.1: Helper function untuk get reasoning dengan snake_case key
export function getReasoningForMode(mode: string, scenario: string): string {
  // Convert UI label to snake_case enum if needed
  const modeKey = modeResponsEnumMapping[mode] || mode.toLowerCase().replace(/\s+/g, "_");
  
  return reasoningGuidelinesMapping[modeKey]?.[scenario] 
      || reasoningGuidelinesMapping[modeKey]?.["default"] 
      || "";
}

// V5.2.1: Helper function untuk get template dengan snake_case key
export function getTemplateForMode(mode: string, scenario: string): string {
  // Convert UI label to snake_case enum if needed
  const modeKey = modeResponsEnumMapping[mode] || mode.toLowerCase().replace(/\s+/g, "_");
  
  return responseTemplateMapping[modeKey]?.[scenario] 
      || responseTemplateMapping[modeKey]?.["default"] 
      || "";
}

// ========== SCENARIO & REACTION CARDS ==========

export interface ScenarioCard {
  id: string;
  icon: string;
  label: string;
  description: string;
  mapping: {
    behavior_category: string;
    intent_perilaku: string;
    pattern_trigger: Record<string, boolean>;
    suggested_mode: string;
    default_severity: number;
    default_applicability_criteria: string; // Phase 2: default criteria per scenario
  };
}

export const scenarioCards: ScenarioCard[] = [
  {
    id: "marah_kasar",
    icon: "🔥",
    label: "Marah Kasar",
    description: "User menggunakan kata-kata kasar atau menyerang",
    mapping: {
      behavior_category: "Toxic Berat (ToxicHeavy)",
      intent_perilaku: "Menguji Batas / Dominasi",
      pattern_trigger: { capslock: true, short_phrases: true },
      suggested_mode: "Anti-Toxic (Boundary)",
      default_severity: 4,
      default_applicability_criteria: "Berlaku jika user menggunakan hinaan, kata kasar, ancaman verbal, nada menyerang, capslock berlebihan, atau tanda seru berlebihan."
    }
  },
  {
    id: "spamming",
    icon: "📢",
    label: "Spamming",
    description: "User mengirim pesan berulang-ulang dengan cepat",
    mapping: {
      behavior_category: "High-Pressure (HighPressure)",
      intent_perilaku: "Butuh Solusi Cepat",
      pattern_trigger: { rapid_message: true, repetitive_complaint: true },
      suggested_mode: "Tegas & Jelas (Assertive Clarity)",
      default_severity: 2,
      default_applicability_criteria: "Berlaku jika user mengirim pesan berulang-ulang, flooding chat, atau mengulangi pertanyaan yang sama berkali-kali."
    }
  },
  {
    id: "ancaman",
    icon: "🛑",
    label: "Ancaman",
    description: "User mengancam akan sebar data atau lapor",
    mapping: {
      behavior_category: "Toxic Berat (ToxicHeavy)",
      intent_perilaku: "Takut Discam / Trust Issue",
      pattern_trigger: { threat_pattern: true },
      suggested_mode: "Crisis Handling (Crisis)",
      default_severity: 5,
      default_applicability_criteria: "Berlaku jika user mengancam akan menyebarkan data, melaporkan ke pihak berwajib, atau mengancam keselamatan."
    }
  },
  {
    id: "mau_pindah",
    icon: "🏃",
    label: "Mau Pindah",
    description: "User mengancam akan pindah ke kompetitor",
    mapping: {
      behavior_category: "Ancaman Pergi (ChurnThreat)",
      intent_perilaku: "Ingin Kabur / Quit",
      pattern_trigger: { repetitive_complaint: true },
      suggested_mode: "Trust Rebuild (Assurance)",
      default_severity: 4,
      default_applicability_criteria: "Berlaku jika user menyatakan ingin pindah ke kompetitor, mengancam berhenti, atau menunjukkan niat churn."
    }
  },
  {
    id: "sarkas",
    icon: "😏",
    label: "Sarkas",
    description: "User menggunakan nada sarkastik atau sindiran",
    mapping: {
      behavior_category: "Toxic Ringan (ToxicLight)",
      intent_perilaku: "Menguji AI / Menggertak",
      pattern_trigger: { sarcasm_markers: true },
      suggested_mode: "Empati Tinggi (High Empathy)",
      default_severity: 1,
      default_applicability_criteria: "Berlaku jika user menggunakan nada sarkastik, sindiran halus, atau komentar pasif-agresif."
    }
  },
  {
    id: "curhat_kalah",
    icon: "😭",
    label: "Curhat Kalah",
    description: "User curhat tentang kekalahan dan butuh validasi",
    mapping: {
      behavior_category: "Kecewa Berat (Disappointment)",
      intent_perilaku: "Butuh Validasi Emosi",
      pattern_trigger: { emoji_intensity: true },
      suggested_mode: "Empati Tinggi (High Empathy)",
      default_severity: 2,
      default_applicability_criteria: "Berlaku jika user curhat tentang kekalahan, kekecewaan, atau butuh validasi emosional."
    }
  },
  {
    id: "merayu",
    icon: "❤️",
    label: "Merayu",
    description: "User mencoba merayu untuk dapat bonus/promo",
    mapping: {
      behavior_category: "Toxic Ringan (ToxicLight)",
      intent_perilaku: "Menguji Batas / Dominasi",
      pattern_trigger: {},
      suggested_mode: "Tegas & Jelas (Assertive Clarity)",
      default_severity: 1,
      default_applicability_criteria: "Berlaku jika user mencoba merayu, membujuk, atau menggunakan taktik personal untuk mendapatkan bonus atau pengecualian."
    }
  }
];

export interface ReactionOption {
  id: "soft" | "firm" | "handoff";
  icon: string;
  label: string;
  description: string;
  color: string;
  handoff_protocol: {
    required: boolean;
    type: "active_handover" | "silent_handover" | "monitoring";
    tag_alert: string;
  };
  suggested_modes: string[];
}

export const reactionOptions: ReactionOption[] = [
  {
    id: "soft",
    icon: "💚",
    label: "Soft Approach",
    description: "Validasi perasaan user, menenangkan dengan empati tinggi",
    color: "bg-green-500/20 border-green-500/50 hover:bg-green-500/30",
    handoff_protocol: {
      required: false,
      type: "monitoring",
      tag_alert: ""
    },
    suggested_modes: ["Menenangkan (Calming)", "Empati Tinggi (High Empathy)", "Trust Rebuild (Assurance)"]
  },
  {
    id: "firm",
    icon: "🟠",
    label: "Firm Approach",
    description: "Tegas dengan batasan jelas, tidak berkompromi",
    color: "bg-orange-500/20 border-orange-500/50 hover:bg-orange-500/30",
    handoff_protocol: {
      required: false,
      type: "monitoring",
      tag_alert: "FIRM_RESPONSE"
    },
    suggested_modes: ["Tegas & Jelas (Assertive Clarity)", "Anti-Toxic (Boundary)", "Penjelasan Ringkas (Short)", "Penalty Warning (Warning)"]
  },
  {
    id: "handoff",
    icon: "🔴",
    label: "Human Handoff",
    description: "AI berhenti, langsung transfer ke agen manusia",
    color: "bg-red-500/20 border-red-500/50 hover:bg-red-500/30",
    handoff_protocol: {
      required: true,
      type: "active_handover",
      tag_alert: "HIGH_PRIORITY"
    },
    suggested_modes: ["Crisis Handling (Crisis)"]
  }
];

// ========== LOCALSTORAGE & HELPER FUNCTIONS ==========

export const BEHAVIORAL_RULES_KEY = "voc_behavioral_rules_v6";

// V6.1: Get rules with auto-sanitization using V6.1 validator
export function getBehavioralRules(): BehavioralRuleItem[] {
  const data = localStorage.getItem(BEHAVIORAL_RULES_KEY);
  if (!data) return [];
  
  const items: BehavioralRuleItem[] = JSON.parse(data);
  let hasChanges = false;
  
  // V6.1: Validate and auto-fix legacy data using V6.1 validator
  const sanitizedItems = items.map(item => {
    const validation = validateBehavioralRuleV6(item);
    
    // Log blocked rules (critical errors)
    if (validation.isBlocked) {
      console.error(`[B-KB V6.1 BLOCKED] Rule "${item.rule_name}" has critical violations:`, validation.violations);
    }
    
    // Auto-fix non-blocking issues
    if (validation.autoFixed) {
      console.warn(`[B-KB V6.1 Guard] Auto-fixing rule "${item.rule_name}":`, {
        violations: validation.violations,
        warnings: validation.warnings,
        autoFixed: validation.autoFixed
      });
      hasChanges = true;
      return { 
        ...item, 
        ...validation.autoFixed, 
        updated_at: new Date().toISOString(),
        last_validated_at: new Date().toISOString(),
        auto_fixed_fields: Object.keys(validation.autoFixed)
      };
    }
    
    return item;
  });
  
  // Save sanitized data back to localStorage
  if (hasChanges) {
    saveBehavioralRules(sanitizedItems);
    console.log("[B-KB V6.1 Guard] Legacy data auto-fixed and saved.");
  }
  
  return sanitizedItems;
}

export function saveBehavioralRules(items: BehavioralRuleItem[]): void {
  localStorage.setItem(BEHAVIORAL_RULES_KEY, JSON.stringify(items));
}

// V5.2: Generate System Rule Name (tanpa spasi, backend-safe)
export function generateRuleName(scenario: string, reaction: string): string {
  const scenarioEng = scenarioEnglishMapping[scenario] || scenario;
  const reactionEng = reaction.charAt(0).toUpperCase() + reaction.slice(1);
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  return `WIZ_${scenarioEng}_${reactionEng}_${date}`;
}

// V5.2: Generate Default Display Name (user-friendly, bahasa Indonesia)
export function generateDisplayName(scenario: string, reaction: string): string {
  const scenarioCard = scenarioCards.find(s => s.id === scenario);
  const scenarioLabel = scenarioCard?.label || scenario;
  
  const reactionLabel = reaction === "soft" ? "Tenangkan" 
    : reaction === "firm" ? "Tegas" 
    : "Handoff";
  
  return `${scenarioLabel} – Mode ${reactionLabel}`;
}

// V6.1: Add rule with pre-save validation (BLOCK invalid rules)
export function addBehavioralRule(data: WizardFormData): BehavioralRuleItem | { blocked: true; violations: string[] } {
  const items = getBehavioralRules();
  
  const systemRuleName = generateRuleName(data.scenario, data.reaction);
  const userDisplayName = data.display_name.trim() || generateDisplayName(data.scenario, data.reaction);
  
  // V6.1: Use new priority formula
  const behaviorCategoryEnum = behaviorCategoryEnumMapping[data.behavior_category] || data.behavior_category;
  const autoPriority = calculatePriorityV6(behaviorCategoryEnum, data.severity_level);
  
  const newItem: BehavioralRuleItem = {
    id: crypto.randomUUID(),
    display_name: userDisplayName,
    rule_name: systemRuleName,
    status: "active",
    version: "1.0.0",
    behavior_category: behaviorCategoryEnum,
    intent_perilaku: intentEnumMapping[data.intent_perilaku] || data.intent_perilaku,
    pattern_trigger: data.pattern_trigger,
    severity_level: data.severity_level,
    priority: autoPriority,
    mode_respons: modeResponsEnumMapping[data.mode_respons] || data.mode_respons,
    brand_tone: data.brand_tone,
    response_template: data.response_template,
    reasoning_guideline: data.reasoning_guideline,
    applicability_criteria: data.applicability_criteria || "",
    handoff_protocol: data.reaction === "handoff" 
      ? { required: true, type: data.handoff_type || "active_handover", tag_alert: "HIGH_PRIORITY" }
      : data.reaction === "firm"
      ? { required: false, type: "monitoring", tag_alert: "FIRM_RESPONSE" }
      : { required: false, type: "monitoring", tag_alert: "" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_validated_at: new Date().toISOString(),
    expires_at: data.expires_at || null,
    notes_admin: data.notes_admin,
    tags: data.tags
  };
  
  // V6.1: Pre-save validation - BLOCK if critical errors
  const validation = validateBehavioralRuleV6(newItem);
  
  if (validation.isBlocked) {
    console.error("[B-KB V6.1 BLOCKED] Cannot save rule - critical violations:", validation.violations);
    return { blocked: true, violations: validation.violations };
  }
  
  // Apply auto-fixes if any
  const finalItem = validation.autoFixed 
    ? { ...newItem, ...validation.autoFixed, auto_fixed_fields: Object.keys(validation.autoFixed) }
    : newItem;
  
  // Log warnings for monitoring
  if (validation.warnings.length > 0) {
    console.warn("[B-KB V6.1] Rule saved with warnings:", validation.warnings);
  }
  
  items.push(finalItem);
  saveBehavioralRules(items);
  return finalItem;
}

// V6.1: Update rule with validation (BLOCK if critical errors)
export function updateBehavioralRule(id: string, data: Partial<BehavioralRuleItem>): { success: true } | { success: false; violations: string[] } {
  const items = getBehavioralRules();
  const index = items.findIndex(item => item.id === id);
  
  if (index === -1) {
    return { success: false, violations: ["Rule not found"] };
  }
  
  const updatedItem: BehavioralRuleItem = { 
    ...items[index], 
    ...data, 
    updated_at: new Date().toISOString(),
    last_validated_at: new Date().toISOString(),
    auto_fixed_fields: undefined // Clear auto-fix indicator on manual update
  };
  
  // V6.1: Validate updated rule
  const validation = validateBehavioralRuleV6(updatedItem);
  
  if (validation.isBlocked) {
    console.error("[B-KB V6.1 BLOCKED] Cannot update rule - critical violations:", validation.violations);
    return { success: false, violations: validation.violations };
  }
  
  // Apply auto-fixes if any
  const finalItem = validation.autoFixed 
    ? { ...updatedItem, ...validation.autoFixed, auto_fixed_fields: Object.keys(validation.autoFixed) }
    : updatedItem;
  
  // Log warnings for monitoring
  if (validation.warnings.length > 0) {
    console.warn("[B-KB V6.1] Rule updated with warnings:", validation.warnings);
  }
  
  items[index] = finalItem;
  saveBehavioralRules(items);
  return { success: true };
}

export function deleteBehavioralRule(id: string): void {
  const items = getBehavioralRules().filter(item => item.id !== id);
  saveBehavioralRules(items);
}

// ========== SEED DEFAULT BEHAVIORAL RULES ==========
// Phase 2: Prevent authority vacuum after APBE reaction logic removed

export function seedDefaultBehavioralRules(): void {
  // Guard 1: Already seeded
  if (localStorage.getItem('bkb_seeded_v2')) return;
  // Guard 2: Admin already created rules manually
  if (getBehavioralRules().length > 0) return;

  const now = new Date().toISOString();
  const date = now.split('T')[0].replace(/-/g, '');

  const seedRules: BehavioralRuleItem[] = [
    {
      id: crypto.randomUUID(),
      display_name: "Player Agresif / Marah Berat",
      rule_name: `SEED_ToxicHeavy_Firm_${date}`,
      status: "active",
      version: "2.0.0",
      behavior_category: "toxic_heavy",
      intent_perilaku: "testing_limits",
      pattern_trigger: { capslock: true, short_phrases: true, threat_pattern: true },
      severity_level: 4,
      priority: calculatePriorityV6("toxic_heavy", 4),
      mode_respons: "boundary",
      brand_tone: "Formal",
      response_template: `[Variasi 1] Kami mendengar {{A.call_to_player}}. Kami di sini untuk bantu — mari kita fokus cari solusinya bareng-bareng ya.
[Variasi 2] {{A.call_to_player}}, kami paham situasinya bikin frustrasi. Supaya bisa bantu maksimal, yuk kita bahas dengan tenang.
[Variasi 3] Perasaan {{A.call_to_player}} valid. Kami serius mau bantu — tapi butuh komunikasi dua arah yang baik supaya prosesnya lancar.
[INSTRUKSI] Pilih SATU variasi per turn. JANGAN ulangi variasi yang sudah dipakai di turn sebelumnya. Boleh parafrase dengan gaya natural.`,
      reasoning_guideline: `Player menunjukkan emosi tinggi. Analisis konteks:
- Apakah ini frustrasi pertama atau sudah berulang?
- Apakah ada masalah konkret di balik kemarahannya?

PENDEKATAN BERTINGKAT:
Turn 1 → Validasi emosi, tunjukkan empati genuine. Fokus ke "kami dengar kamu."
Turn 2 → Jika masih kasar, set boundary TANPA meninggikan nada. Fokus ke "kami butuh kerjasama."
Turn 3+ → Jika ancaman fisik/hukum muncul, eskalasi langsung. Jangan debat.

LARANGAN: Jangan menggurui. Jangan gunakan kata "sopan" atau "etika". Jangan balas sarkasme.`,
      applicability_criteria: "Berlaku jika user menggunakan hinaan, kata kasar, ancaman verbal, nada menyerang, capslock berlebihan, tanda seru berlebihan, atau sarkasme yang merendahkan.",
      handoff_protocol: { required: false, type: "monitoring", tag_alert: "FIRM_RESPONSE" },
      created_at: now,
      updated_at: now,
      last_validated_at: now,
    },
    {
      id: crypto.randomUUID(),
      display_name: "Gangguan Sistem / Error Teknis",
      rule_name: `SEED_Confusion_Soft_${date}`,
      status: "active",
      version: "2.0.0",
      behavior_category: "confusion",
      intent_perilaku: "clarity_need",
      pattern_trigger: {},
      severity_level: 2,
      priority: calculatePriorityV6("confusion", 2),
      mode_respons: "assurance",
      brand_tone: "Semi-Formal",
      response_template: `[Variasi 1] Wah, maaf banget ya {{A.call_to_player}} soal gangguan ini. Tim teknis udah handle — biasanya pulih dalam beberapa menit.
[Variasi 2] {{A.call_to_player}}, kami tahu ini ganggu. Kabar baiknya, tim sudah tahu dan sedang perbaiki. Coba refresh sekitar 5-10 menit lagi ya.
[Variasi 3] Terima kasih sudah lapor, {{A.call_to_player}}. Masalah ini sudah kami eskalasi ke tim teknis. Sementara ini, bisa coba clear cache atau pakai browser lain.
[INSTRUKSI] Pilih SATU variasi per turn. JANGAN ulangi variasi yang sudah dipakai. Sesuaikan dengan detail error yang dilaporkan user.`,
      reasoning_guideline: `Player melaporkan masalah teknis — mereka butuh KEPASTIAN, bukan tutorial panjang.

PENDEKATAN:
1. Acknowledge masalahnya REAL (jangan bilang "coba lagi" tanpa konteks)
2. Berikan estimasi waktu JIKA memungkinkan
3. Tawarkan workaround praktis (clear cache, browser lain, mobile app)
4. Jika player report masalah yang sama >2x → eskalasi ke admin

JANGAN: Blame user, jawab "dari sisi kami normal", atau minta screenshot berlebihan di awal.`,
      applicability_criteria: "Berlaku jika user melaporkan error, loading lama, halaman stuck, fitur tidak berfungsi, sistem tidak merespons, atau tampilan rusak/berantakan.",
      handoff_protocol: { required: false, type: "monitoring", tag_alert: "" },
      created_at: now,
      updated_at: now,
      last_validated_at: now,
    },
    {
      id: crypto.randomUUID(),
      display_name: "Masalah Pembayaran / Transaksi",
      rule_name: `SEED_Urgency_Soft_${date}`,
      status: "active",
      version: "2.0.0",
      behavior_category: "urgency",
      intent_perilaku: "urgent_solution",
      pattern_trigger: {},
      severity_level: 3,
      priority: calculatePriorityV6("urgency", 3),
      mode_respons: "high_empathy",
      brand_tone: "Semi-Formal",
      response_template: `[Variasi 1] Kami paham ini penting banget, {{A.call_to_player}}. Biar bisa langsung cek, boleh kasih tahu ID transaksi atau waktu kira-kira transfernya?
[Variasi 2] {{A.call_to_player}}, soal dana itu pasti bikin khawatir. Kami mau bantu tracking — bisa info nominal dan metode pembayarannya?
[Variasi 3] Tenang ya {{A.call_to_player}}, kami treat ini sebagai prioritas. Untuk percepat pengecekan, tolong siapkan bukti transfer atau ID transaksinya.
[INSTRUKSI] Pilih SATU variasi per turn. Selalu minta data spesifik di turn pertama. Di turn selanjutnya, update progress jangan ulang pertanyaan yang sama.`,
      reasoning_guideline: `Player khawatir tentang UANG — ini HIGH URGENCY, perlakukan seserius mungkin.

PENDEKATAN BERTINGKAT:
Turn 1 → Empati + minta data spesifik (ID transaksi, waktu, jumlah, metode)
Turn 2 → Jika data sudah diberikan, konfirmasi sedang diproses. JANGAN minta data ulang.
Turn 3 → Jika belum resolved, eskalasi ke admin dengan catatan lengkap.

ATURAN KETAT:
- JANGAN janji timeline spesifik ("pasti 10 menit") — gunakan "secepat mungkin"
- JANGAN bilang "sabar ya" — itu dismissive untuk masalah uang
- Jika pending > 1 jam berdasarkan cerita user → langsung eskalasi`,
      applicability_criteria: "Berlaku jika user menyebut deposit belum masuk, withdraw pending, transfer gagal, saldo hilang, potongan tidak jelas, atau bonus yang dijanjikan belum diterima.",
      handoff_protocol: { required: false, type: "monitoring", tag_alert: "" },
      created_at: now,
      updated_at: now,
      last_validated_at: now,
    },
    {
      id: crypto.randomUUID(),
      display_name: "Akun Terkunci / Masalah Akses",
      rule_name: `SEED_Fear_Soft_${date}`,
      status: "active",
      version: "2.0.0",
      behavior_category: "fear",
      intent_perilaku: "trust_issue",
      pattern_trigger: {},
      severity_level: 3,
      priority: calculatePriorityV6("fear", 3),
      mode_respons: "assurance",
      brand_tone: "Formal",
      response_template: `[Variasi 1] {{A.call_to_player}}, kami mengerti ini bikin panik. Tenang, data dan saldo aman. Untuk proses unlock, kami perlu verifikasi — boleh kasih tahu username dan nomor HP terdaftar?
[Variasi 2] Jangan khawatir {{A.call_to_player}}, akun yang terkunci bukan berarti hilang. Ini prosedur keamanan standar. Kami bantu buka — siapkan data verifikasinya ya.
[Variasi 3] {{A.call_to_player}}, keamanan akun adalah prioritas kami. Agar bisa bantu secepat mungkin, tolong konfirmasi: username, email terdaftar, dan nomor HP.
[INSTRUKSI] Pilih SATU variasi per turn. Prioritaskan menenangkan user DULU sebelum minta data. Jangan terkesan interogasi.`,
      reasoning_guideline: `Player dalam kondisi CEMAS — mereka takut kehilangan akun/uang.

PENDEKATAN:
1. TENANGKAN dulu — "data aman", "ini prosedur standar"
2. Jelaskan KENAPA verifikasi diperlukan (keamanan, bukan curiga)
3. Minta data verifikasi SATU-SATU, jangan bombardir sekaligus
4. Jika akun di-hack → prioritas tertinggi, eskalasi segera

JANGAN: Langsung unlock tanpa verifikasi. Minta terlalu banyak data sekaligus. Bilang "salah password" tanpa konteks.`,
      applicability_criteria: "Berlaku jika user tidak bisa login, akun suspended, akun banned, akun dikunci, merasa akun di-hack, atau menerima notifikasi keamanan yang tidak dikenali.",
      handoff_protocol: { required: false, type: "monitoring", tag_alert: "" },
      created_at: now,
      updated_at: now,
      last_validated_at: now,
    },
    {
      id: crypto.randomUUID(),
      display_name: "Deteksi Kecurangan / Manipulasi",
      rule_name: `SEED_ToxicHeavy_Handoff_${date}`,
      status: "active",
      version: "2.0.0",
      behavior_category: "toxic_heavy",
      intent_perilaku: "testing_limits",
      pattern_trigger: { threat_pattern: true },
      severity_level: 5,
      priority: calculatePriorityV6("toxic_heavy", 5),
      mode_respons: "crisis",
      brand_tone: "Formal",
      response_template: `[Variasi 1] {{A.call_to_player}}, terima kasih sudah menghubungi. Kami perlu melakukan pengecekan tambahan terkait permintaan ini. Tim khusus kami akan follow up segera.
[Variasi 2] Mohon maaf {{A.call_to_player}}, untuk permintaan ini kami perlu verifikasi lebih lanjut demi keamanan bersama. Rekan kami akan segera menghubungi.
[Variasi 3] {{A.call_to_player}}, demi keamanan akun, permintaan ini perlu ditinjau oleh tim kami. Mohon tunggu sebentar — kami akan menghubungi dalam waktu dekat.
[INSTRUKSI] Pilih SATU variasi per turn. Tetap NETRAL — jangan menuduh. Jangan berikan informasi sensitif apapun. Segera trigger handoff.`,
      reasoning_guideline: `ALERT: Pola mencurigakan terdeteksi. PROTOCOL KETAT:

1. Respons NETRAL dan PROFESIONAL — tidak menuduh, tidak memberi clue
2. JANGAN berikan data sensitif (saldo, history, detail akun lain)
3. JANGAN approve request apapun (bonus, withdraw, perubahan data)
4. JANGAN terpancing oleh pressure tactics atau urgency buatan
5. SEGERA eskalasi ke admin dengan log percakapan lengkap

TANDA BAHAYA:
- Klaim bonus berulang dengan alasan berbeda-beda
- Informasi kontradiktif antar pesan
- Menyebut "teman" atau "akun lain" secara mencurigakan
- Tekanan untuk proses cepat tanpa verifikasi`,
      applicability_criteria: "Berlaku jika user menunjukkan pola klaim bonus berulang dengan alasan berbeda, informasi kontradiktif, hints multiple account, pressure tactics untuk keuntungan tidak sah, atau social engineering attempts.",
      handoff_protocol: { required: true, type: "active_handover", tag_alert: "HIGH_PRIORITY" },
      created_at: now,
      updated_at: now,
      last_validated_at: now,
    },
  ];

  saveBehavioralRules(seedRules);
  localStorage.setItem('bkb_seeded_v2', 'true');
  console.log("[B-KB Seed] 5 default behavioral rules V2 seeded successfully.");
}

export const initialWizardData: WizardFormData = {
  scenario: "",
  reaction: "soft",
  brand_tone: "Formal",
  response_template: "",
  reasoning_guideline: "",
  severity_level: 3,
  priority: 50,
  expires_at: null,
  handoff_type: "active_handover",
  display_name: "",
  behavior_category: "",
  intent_perilaku: "",
  pattern_trigger: {},
  mode_respons: "",
  notes_admin: "",
  tags: [],
  applicability_criteria: "",
};
