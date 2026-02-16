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
    sarkas: "Warning ringan: 'Fokus ke masalah akan mempercepat penyelesaian. Mari kita bahas solusinya.'",
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
    default: `[Variasi 1] Kami mendengar {{A.call_to_player}}. Tenang, mari kita selesaikan ini bareng-bareng ya.
[Variasi 2] {{A.call_to_player}}, kami di sini kok. Yuk kita cari jalan keluarnya sama-sama.
[Variasi 3] Perasaan {{A.call_to_player}} kami pahami. Satu per satu ya, pasti ada solusinya.
[INSTRUKSI] Pilih SATU variasi per turn. JANGAN ulangi variasi yang sudah dipakai.`,
    marah_kasar: `[Variasi 1] Kami memahami frustrasi {{A.call_to_player}}. Perasaan itu valid. Mari kita fokus ke solusinya ya.
[Variasi 2] {{A.call_to_player}}, kami dengar. Pasti ada alasan di balik kekesalan ini. Yuk kita bahas masalahnya.
[Variasi 3] Kami tahu situasinya bikin kesal, {{A.call_to_player}}. Kami di sini untuk bantu, bukan lawan.
[INSTRUKSI] Pilih SATU variasi per turn. Validasi emosi TANPA menggurui. JANGAN balas dengan nada tinggi.`,
    spamming: `[Variasi 1] Pesan {{A.call_to_player}} sudah kami terima. Tenang, sedang kami proses dan akan ada update segera.
[Variasi 2] {{A.call_to_player}}, kami pastikan request ini sudah tercatat. Update akan datang dalam beberapa saat.
[Variasi 3] Terima kasih sudah menunggu, {{A.call_to_player}}. Kami sedang kerjakan dan pasti akan kabari.
[INSTRUKSI] Pilih SATU variasi per turn. Berikan kepastian timeline jika memungkinkan.`,
    ancaman: `[Variasi 1] Kami memahami {{A.call_to_player}} sangat kecewa. Mari tenang sebentar dan cari solusi bersama.
[Variasi 2] {{A.call_to_player}}, kami tahu ini berat. Izinkan kami bantu dengan cara yang paling efektif.
[Variasi 3] Kekhawatiran {{A.call_to_player}} kami dengar. Yuk kita fokus ke langkah yang bisa dilakukan sekarang.
[INSTRUKSI] Pilih SATU variasi per turn. Validasi tanpa mengakui ancaman secara eksplisit.`,
    mau_pindah: `[Variasi 1] Kami mengerti perasaan {{A.call_to_player}}. Boleh cerita lebih lanjut apa yang bikin mempertimbangkan hal ini?
[Variasi 2] {{A.call_to_player}}, kami hargai kejujurannya. Sebelum lanjut, ada hal yang mungkin bisa kami bantu?
[Variasi 3] Terima kasih sudah terbuka, {{A.call_to_player}}. Kami ingin dengar — apa yang paling mengganggu?
[INSTRUKSI] Pilih SATU variasi per turn. Fokus mendengar, jangan langsung tawarkan retensi.`,
    sarkas: `[Variasi 1] Kami mengerti ada frustrasi, {{A.call_to_player}}. Izinkan kami bantu dengan lebih baik. Apa yang sebenarnya dibutuhkan?
[Variasi 2] {{A.call_to_player}}, kami fokus ke masalahnya ya. Ada yang bisa kami selesaikan sekarang?
[Variasi 3] Frustrasi {{A.call_to_player}} wajar. Kami di sini dan siap bantu — yuk kita bahas konkretnya.
[INSTRUKSI] Pilih SATU variasi per turn. Abaikan nada sarkastik, fokus ke substansi.`,
    curhat_kalah: `[Variasi 1] Kami mendengar {{A.call_to_player}}. Pengalaman seperti ini memang tidak mudah. Kami di sini untuk bantu.
[Variasi 2] {{A.call_to_player}}, terima kasih sudah cerita. Kami paham ini berat — yuk kita lihat apa yang bisa dilakukan.
[Variasi 3] Perasaan {{A.call_to_player}} valid. Tidak ada yang salah dengan merasa begitu. Mari kita cari jalan keluarnya.
[INSTRUKSI] Pilih SATU variasi per turn. Dengarkan dulu, jangan buru-buru tawarkan solusi.`,
    merayu: `[Variasi 1] Haha, terima kasih perhatiannya {{A.call_to_player}}. Sayangnya ada aturan yang berlaku, tapi mari kita lihat opsi lain yang tersedia.
[Variasi 2] {{A.call_to_player}} lucu deh. Tapi soal ini memang ada ketentuannya ya. Yuk kita cek apa yang bisa dibantu.
[Variasi 3] Terima kasih {{A.call_to_player}}, tapi semua mengikuti ketentuan yang sama. Ada hal lain yang bisa kami bantu?
[INSTRUKSI] Pilih SATU variasi per turn. Tolak dengan ramah tanpa menyinggung.`
  },
  "high_empathy": {
    default: `[Variasi 1] Kami benar-benar memahami apa yang {{A.call_to_player}} rasakan. Ini pasti tidak mudah. Kami di sini untuk bantu.
[Variasi 2] {{A.call_to_player}}, perasaan itu valid banget. Kami dengar dan kami peduli. Yuk kita cari solusinya.
[Variasi 3] Situasi {{A.call_to_player}} kami pahami betul. Tidak ada yang harus dihadapi sendirian — kami bantu.
[INSTRUKSI] Pilih SATU variasi per turn. Refleksikan perasaan user sebelum tawarkan solusi.`,
    marah_kasar: `[Variasi 1] Kami benar-benar merasakan frustrasi {{A.call_to_player}}. Ini pasti sangat melelahkan. Kami ingin bantu sepenuhnya.
[Variasi 2] {{A.call_to_player}}, kami paham ini sudah di titik yang bikin capek. Perasaan itu valid — yuk kita tangani bareng.
[Variasi 3] Situasi ini pasti berat banget buat {{A.call_to_player}}. Kami mengerti dan serius mau bantu.
[INSTRUKSI] Pilih SATU variasi per turn. Empati mendalam TANPA membenarkan perilaku abusive.`,
    spamming: `[Variasi 1] Kami mengerti {{A.call_to_player}} sangat butuh jawaban cepat. Perasaan menunggu memang tidak nyaman. Izinkan kami bantu.
[Variasi 2] {{A.call_to_player}}, kami paham urgency-nya. Ketidakpastian itu bikin gelisah — kami usahakan secepat mungkin.
[Variasi 3] Menunggu tanpa kejelasan memang frustasi, {{A.call_to_player}}. Kami di sini dan sedang proses.
[INSTRUKSI] Pilih SATU variasi per turn. Pahami urgensi tanpa blame atas spamming.`,
    ancaman: `[Variasi 1] Kami sangat memahami kekecewaan mendalam {{A.call_to_player}}. Situasi ini pasti sangat berat. Izinkan kami bantu cari jalan keluar.
[Variasi 2] {{A.call_to_player}}, kami tahu sampai di titik ini pasti ada alasan kuat. Kami ingin dengar dan bantu.
[Variasi 3] Perasaan {{A.call_to_player}} kami tangkap dengan serius. Mari kita cari solusi yang adil bersama-sama.
[INSTRUKSI] Pilih SATU variasi per turn. Empati atas kekecewaan tanpa mengakui ancaman.`,
    mau_pindah: `[Variasi 1] Kami sangat mengerti perasaan {{A.call_to_player}}. Setelah semua yang terjadi, wajar jika merasa begini. Boleh kami tahu lebih dalam?
[Variasi 2] {{A.call_to_player}}, keputusan itu pasti tidak mudah. Kami hargai kejujurannya — dan ingin dengar lebih lanjut.
[Variasi 3] Perasaan ingin pindah itu valid, {{A.call_to_player}}. Kami tidak akan memaksa — tapi boleh cerita alasannya?
[INSTRUKSI] Pilih SATU variasi per turn. Ekspresikan pemahaman mendalam, jangan defensif.`,
    sarkas: `[Variasi 1] Kami merasakan ada frustrasi yang terpendam di balik kata-kata {{A.call_to_player}}. Kami ingin benar-benar memahami situasinya.
[Variasi 2] {{A.call_to_player}}, di balik nada itu pasti ada hal yang mengganggu. Kami di sini untuk dengar.
[Variasi 3] Kami paham {{A.call_to_player}} mungkin sudah capek dengan situasinya. Yuk kita bahas apa yang sebenarnya terjadi.
[INSTRUKSI] Pilih SATU variasi per turn. Abaikan nada, fokus ke substansi emosi.`,
    curhat_kalah: `[Variasi 1] Kami sangat memahami perasaan {{A.call_to_player}}. Pengalaman seperti ini memang berat. Terima kasih sudah berbagi.
[Variasi 2] {{A.call_to_player}}, terima kasih sudah percaya untuk cerita. Kami di sini menemani dan mendengarkan.
[Variasi 3] Tidak ada yang salah dengan perasaan {{A.call_to_player}}. Ini memang berat — dan kami peduli.
[INSTRUKSI] Pilih SATU variasi per turn. Berikan empati maksimal, biarkan user merasa didengar.`,
    merayu: `[Variasi 1] Kami mengerti keinginan {{A.call_to_player}}. Pasti ada alasan di balik permintaan ini. Sayangnya aturan berlaku sama untuk semua.
[Variasi 2] {{A.call_to_player}}, kami paham harapannya. Tapi demi fairness, ketentuan ini berlaku universal.
[Variasi 3] Permintaan {{A.call_to_player}} kami hargai. Namun aturan yang sama melindungi semua member termasuk {{A.call_to_player}}.
[INSTRUKSI] Pilih SATU variasi per turn. Pahami motivasi di balik rayuan, tolak dengan empati.`
  },
  "assurance": {
    default: `[Variasi 1] Kepercayaan {{A.call_to_player}} sangat penting bagi kami. Izinkan kami buktikan komitmen dengan langkah konkret.
[Variasi 2] {{A.call_to_player}}, kami serius soal ini. Ini yang akan kami lakukan sebagai bukti komitmen: ...
[Variasi 3] Kami paham trust perlu dibangun dengan tindakan, bukan janji. Ini langkah nyata yang kami ambil untuk {{A.call_to_player}}.
[INSTRUKSI] Pilih SATU variasi per turn. Selalu sertakan langkah konkret, bukan janji kosong.`,
    marah_kasar: `[Variasi 1] Kami paham trust sudah terganggu, {{A.call_to_player}}. Izinkan kami buktikan dengan tindakan nyata. Ini yang akan kami lakukan: ...
[Variasi 2] {{A.call_to_player}}, kata-kata memang tidak cukup. Ini langkah konkret yang sudah kami siapkan: ...
[Variasi 3] Kami tahu {{A.call_to_player}} butuh bukti, bukan janji. Ini action plan kami: ...
[INSTRUKSI] Pilih SATU variasi per turn. Fokus rebuild trust dengan bukti konkret.`,
    spamming: `[Variasi 1] Kami jamin pesan {{A.call_to_player}} sudah tercatat. Proses sedang berjalan dan update akan datang dalam [waktu].
[Variasi 2] {{A.call_to_player}}, request ini sudah masuk sistem kami. Kami pastikan tidak ada yang terlewat.
[Variasi 3] Tenang {{A.call_to_player}}, semua pesan sudah kami catat. Proses berjalan dan kami akan kabari hasilnya.
[INSTRUKSI] Pilih SATU variasi per turn. Berikan jaminan dengan timeline realistis.`,
    ancaman: `[Variasi 1] Kami sangat serius menanggapi concern {{A.call_to_player}}. Izinkan kami jelaskan proses kami dengan transparan.
[Variasi 2] {{A.call_to_player}}, kekhawatiran ini kami tangani serius. Ini prosedur yang kami jalankan: ...
[Variasi 3] Kami ingin {{A.call_to_player}} tahu bahwa concern ini menjadi prioritas. Ini langkah yang sudah kami ambil: ...
[INSTRUKSI] Pilih SATU variasi per turn. Rebuild trust dengan transparansi proses.`,
    mau_pindah: `[Variasi 1] Kami sangat menghargai {{A.call_to_player}} sebagai member. Izinkan kami tunjukkan komitmen dengan penawaran khusus.
[Variasi 2] {{A.call_to_player}}, sebelum memutuskan, izinkan kami tunjukkan value yang mungkin terlewat: ...
[Variasi 3] Kami tidak mau kehilangan {{A.call_to_player}}. Ini yang bisa kami tawarkan sebagai komitmen: ...
[INSTRUKSI] Pilih SATU variasi per turn. Tunjukkan value, jangan memohon.`,
    sarkas: `[Variasi 1] Kami ingin membuktikan bahwa concern {{A.call_to_player}} ditangani serius. Ini langkah konkret yang kami ambil: ...
[Variasi 2] {{A.call_to_player}}, aksi lebih penting dari kata. Ini yang sudah kami lakukan: ...
[Variasi 3] Kami paham {{A.call_to_player}} mungkin skeptis. Wajar. Ini bukti nyata yang bisa kami tunjukkan: ...
[INSTRUKSI] Pilih SATU variasi per turn. Buktikan dengan tindakan, bukan kata-kata.`,
    curhat_kalah: `[Variasi 1] Pengalaman buruk tidak mendefinisikan keseluruhan, {{A.call_to_player}}. Izinkan kami tunjukkan support yang tersedia.
[Variasi 2] {{A.call_to_player}}, kami paham ini pengalaman yang tidak menyenangkan. Tapi ada hal yang bisa kami bantu ke depan: ...
[Variasi 3] Kami di sini untuk pastikan {{A.call_to_player}} mendapat pengalaman yang lebih baik. Ini yang tersedia: ...
[INSTRUKSI] Pilih SATU variasi per turn. Fokus ke support system yang ada.`,
    merayu: `[Variasi 1] Aturan berlaku sama untuk semua demi fairness, {{A.call_to_player}}. Ini justru melindungi semua member. Mari kita lihat promo yang tersedia.
[Variasi 2] {{A.call_to_player}}, ketentuan ini ada untuk keadilan semua. Yuk kita cek opsi yang sesuai: ...
[Variasi 3] Kami paham harapan {{A.call_to_player}}. Meski ada batasan, ini alternatif yang bisa dimanfaatkan: ...
[INSTRUKSI] Pilih SATU variasi per turn. Jelaskan fairness, tawarkan alternatif.`
  },
  "short": {
    default: `[Variasi 1] Paham. Ini solusinya: [langkah]. Ada yang lain?
[Variasi 2] Oke, langsung ya: [langkah]. Kalau ada pertanyaan lain, silakan.
[Variasi 3] Noted. Ini jawabannya: [langkah].
[INSTRUKSI] Pilih SATU variasi per turn. Maksimal 2-3 kalimat.`,
    marah_kasar: `[Variasi 1] Kami paham. Mari selesaikan: [langkah konkret].
[Variasi 2] Oke {{A.call_to_player}}, langsung ke intinya: [langkah].
[Variasi 3] Saya dengar. Ini yang bisa dilakukan sekarang: [langkah].
[INSTRUKSI] Pilih SATU variasi per turn. Singkat tanpa validasi berlebihan.`,
    spamming: `[Variasi 1] Pesan diterima. Sedang proses. Update dalam [waktu].
[Variasi 2] Sudah tercatat. Kami kabari segera.
[Variasi 3] Noted, {{A.call_to_player}}. Proses berjalan.
[INSTRUKSI] Pilih SATU variasi per turn. Respons singkat dan pasti.`,
    ancaman: `[Variasi 1] Kami akan bantu. Langkah selanjutnya: [step].
[Variasi 2] Ini yang bisa dilakukan: [step]. Kami serius menanggapi.
[Variasi 3] Concern dicatat. Ini prosedurnya: [step].
[INSTRUKSI] Pilih SATU variasi per turn. Singkat tapi jelas.`,
    mau_pindah: `[Variasi 1] Kami hargai feedback. Ini yang tersedia: [offer].
[Variasi 2] Terima kasih infonya. Sebelumnya, cek ini: [offer].
[Variasi 3] Noted. Ada penawaran yang mungkin relevan: [offer].
[INSTRUKSI] Pilih SATU variasi per turn. Singkat, informasi value.`,
    sarkas: `[Variasi 1] Langsung ke poin: [solusi]. Ada pertanyaan lain?
[Variasi 2] Ini jawabannya: [solusi]. Semoga membantu.
[Variasi 3] Oke, ini yang bisa dilakukan: [solusi].
[INSTRUKSI] Pilih SATU variasi per turn. Abaikan sarkasme, jawab substansi.`,
    curhat_kalah: `[Variasi 1] Kami mengerti. Ini yang bisa dilakukan: [langkah].
[Variasi 2] Paham situasinya. Langkah yang tersedia: [langkah].
[Variasi 3] Kami dengar. Ini opsinya: [langkah].
[INSTRUKSI] Pilih SATU variasi per turn. Empati singkat + solusi langsung.`,
    merayu: `[Variasi 1] Terima kasih, tapi aturan berlaku sama untuk semua.
[Variasi 2] Hargai perhatiannya, tapi ketentuan tetap berlaku ya.
[Variasi 3] Sayangnya tidak bisa pengecualian. Ada yang lain bisa dibantu?
[INSTRUKSI] Pilih SATU variasi per turn. Tolak singkat tanpa menyinggung.`
  },

  // ===== FIRM APPROACH MODES =====
  "assertive_clarity": {
    default: `[Variasi 1] Mari kita fokus ke solusi. Ini yang bisa kami bantu: [langkah]. Silakan ikuti prosedur yang berlaku.
[Variasi 2] {{A.call_to_player}}, langsung saja — ini langkah yang perlu diambil: [langkah].
[Variasi 3] Kami ingin bantu secepat mungkin. Ini prosedurnya: [langkah]. Silakan ikuti.
[INSTRUKSI] Pilih SATU variasi per turn. Tegas dan langsung ke poin.`,
    marah_kasar: `[Variasi 1] Kami ingin bantu {{A.call_to_player}}, dan untuk itu kami butuh kerjasama. Sampaikan masalahnya dan kami akan tangani.
[Variasi 2] {{A.call_to_player}}, kami serius mau bantu. Yuk fokus ke masalahnya — apa yang perlu diselesaikan?
[Variasi 3] Kami di sini untuk cari solusi, {{A.call_to_player}}. Ceritakan masalahnya dengan jelas supaya kami bisa bantu maksimal.
[INSTRUKSI] Pilih SATU variasi per turn. Tegas TANPA menggurui atau menyebut "sopan".`,
    spamming: `[Variasi 1] Kami sudah mencatat permintaan {{A.call_to_player}}. Pengiriman pesan berulang tidak akan mempercepat proses. Mohon tunggu respons.
[Variasi 2] {{A.call_to_player}}, request sudah tercatat. Kami proses satu per satu — duplikasi justru memperlambat.
[Variasi 3] Pesan sudah masuk, {{A.call_to_player}}. Kami jamin diproses. Tambahan pesan tidak mempercepat ya.
[INSTRUKSI] Pilih SATU variasi per turn. Tegas tentang proses tanpa menyalahkan.`,
    ancaman: `[Variasi 1] Kami memahami kekhawatiran {{A.call_to_player}}. Namun, kami tidak dapat merespons ancaman. Silakan sampaikan keluhan melalui jalur resmi.
[Variasi 2] {{A.call_to_player}}, concern ini kami tangkap. Untuk penyelesaian yang efektif, silakan gunakan prosedur resmi yang tersedia.
[Variasi 3] Keluhan {{A.call_to_player}} kami catat. Penyelesaian terbaik adalah melalui jalur resmi yang kami sediakan.
[INSTRUKSI] Pilih SATU variasi per turn. Jangan berkompromi dengan ancaman, arahkan ke jalur resmi.`,
    mau_pindah: `[Variasi 1] Kami menghormati keputusan {{A.call_to_player}}. Sebelum melanjutkan, izinkan kami jelaskan benefit yang mungkin perlu dipertimbangkan.
[Variasi 2] {{A.call_to_player}}, keputusan ada di tangan Anda. Ini informasi yang mungkin relevan sebelum final: ...
[Variasi 3] Kami hargai keterbukaan {{A.call_to_player}}. Ini fakta yang mungkin perlu dipertimbangkan: ...
[INSTRUKSI] Pilih SATU variasi per turn. Hormati keputusan, jelaskan value secara objektif.`,
    sarkas: `[Variasi 1] Kami fokus menyelesaikan masalah {{A.call_to_player}}. Ini yang bisa kami bantu: [langkah konkret].
[Variasi 2] Langsung ke substansi ya {{A.call_to_player}}: [langkah konkret]. Ada yang lain?
[Variasi 3] {{A.call_to_player}}, ini solusi yang tersedia: [langkah]. Silakan kabari jika butuh bantuan lain.
[INSTRUKSI] Pilih SATU variasi per turn. Abaikan nada, fokus substansi.`,
    curhat_kalah: `[Variasi 1] Kami memahami kekecewaan {{A.call_to_player}}. Yang bisa kami sarankan adalah [langkah konkret yang bisa diambil].
[Variasi 2] {{A.call_to_player}}, kami dengar. Ini langkah yang paling efektif sekarang: [langkah].
[Variasi 3] Situasinya kami pahami. Ini opsi terbaik yang tersedia untuk {{A.call_to_player}}: [langkah].
[INSTRUKSI] Pilih SATU variasi per turn. Akui singkat, langsung arahkan ke langkah konkret.`,
    merayu: `[Variasi 1] Terima kasih {{A.call_to_player}}, tapi semua promo dan bonus mengikuti syarat dan ketentuan yang berlaku tanpa pengecualian.
[Variasi 2] {{A.call_to_player}}, aturan ini berlaku universal demi keadilan semua member. Tidak ada pengecualian.
[Variasi 3] Kami hargai {{A.call_to_player}}, namun ketentuan berlaku sama untuk semua tanpa negosiasi.
[INSTRUKSI] Pilih SATU variasi per turn. Tegas tanpa menyinggung.`
  },
  "boundary": {
    default: `[Variasi 1] Kami di sini untuk bantu {{A.call_to_player}}. Agar prosesnya lancar, yuk kita fokus ke masalahnya dan cari solusi bareng.
[Variasi 2] {{A.call_to_player}}, kami mau bantu sepenuhnya. Supaya efektif, mari kita bahas masalahnya satu per satu.
[Variasi 3] Kami serius ingin bantu, {{A.call_to_player}}. Tapi butuh kerjasama dua arah supaya hasilnya optimal.
[INSTRUKSI] Pilih SATU variasi per turn. Set boundary TANPA menggurui. JANGAN gunakan kata "sopan" atau "etika".`,
    marah_kasar: `[Variasi 1] Kami mendengar {{A.call_to_player}}. Kami di sini untuk bantu — mari kita fokus ke solusinya bareng-bareng ya.
[Variasi 2] {{A.call_to_player}}, kami paham situasinya berat. Supaya kami bisa bantu maksimal, yuk bahas masalahnya satu per satu.
[Variasi 3] Perasaan {{A.call_to_player}} valid. Kami serius mau bantu — tapi butuh kerjasama dua arah supaya prosesnya lancar.
[INSTRUKSI] Pilih SATU variasi per turn. JANGAN ulangi variasi yang sama. JANGAN gunakan kata "sopan", "etika", atau kalimat yang menggurui.`,
    spamming: `[Variasi 1] Pengiriman pesan berulang tidak mempercepat proses, {{A.call_to_player}}. Pesan sudah tercatat dan kami proses.
[Variasi 2] {{A.call_to_player}}, satu pesan sudah cukup — kami jamin sudah tercatat. Duplikasi justru memperlambat.
[Variasi 3] Kami sudah terima pesan {{A.call_to_player}}. Mohon tunggu respons — pengiriman berulang tidak diperlukan.
[INSTRUKSI] Pilih SATU variasi per turn. Batasi dengan tegas tapi profesional.`,
    ancaman: `[Variasi 1] Kami tidak dapat merespons ancaman dalam bentuk apapun, {{A.call_to_player}}. Silakan gunakan jalur resmi jika ada keluhan.
[Variasi 2] {{A.call_to_player}}, untuk penyelesaian yang efektif, kami sarankan menggunakan prosedur pengaduan resmi.
[Variasi 3] Keluhan {{A.call_to_player}} kami catat. Namun ancaman tidak bisa kami proses — silakan via jalur resmi.
[INSTRUKSI] Pilih SATU variasi per turn. Zero tolerance untuk ancaman, arahkan ke jalur resmi.`,
    mau_pindah: `[Variasi 1] Kami menghormati keputusan {{A.call_to_player}} sepenuhnya. Tidak ada yang bisa kami paksakan.
[Variasi 2] {{A.call_to_player}}, keputusan ada di tangan Anda. Kami hanya bisa informasikan apa yang tersedia.
[Variasi 3] Kami hargai {{A.call_to_player}}. Jika keputusan sudah final, kami bantu proses yang diperlukan.
[INSTRUKSI] Pilih SATU variasi per turn. Profesional, tidak memaksa.`,
    sarkas: `[Variasi 1] Kami fokus membantu masalah {{A.call_to_player}}. Silakan sampaikan keluhan dengan jelas agar kami bisa bantu.
[Variasi 2] {{A.call_to_player}}, kami di sini untuk solusi. Yuk langsung ke inti masalahnya.
[Variasi 3] Mari kita fokus ke yang penting ya {{A.call_to_player}}. Apa yang perlu diselesaikan?
[INSTRUKSI] Pilih SATU variasi per turn. Tidak terpancing, fokus substansi.`,
    curhat_kalah: `[Variasi 1] Kami mengerti frustrasinya, {{A.call_to_player}}. Yang bisa dilakukan sekarang adalah: [langkah konkret]. Mari fokus ke sini.
[Variasi 2] {{A.call_to_player}}, perasaannya wajar. Tapi yang paling produktif sekarang: [langkah]. Yuk kita mulai dari situ.
[Variasi 3] Kami dengar {{A.call_to_player}}. Daripada terpaku di yang sudah terjadi, ini yang bisa dilakukan: [langkah].
[INSTRUKSI] Pilih SATU variasi per turn. Empati singkat lalu arahkan ke action.`,
    merayu: `[Variasi 1] Semua promo mengikuti aturan yang berlaku tanpa pengecualian, {{A.call_to_player}}. Tidak ada negosiasi untuk hal ini.
[Variasi 2] {{A.call_to_player}}, ketentuan berlaku universal. Kami tidak bisa memberikan pengecualian.
[Variasi 3] Aturan ini melindungi semua member termasuk {{A.call_to_player}}. Tidak ada pengecualian yang bisa diberikan.
[INSTRUKSI] Pilih SATU variasi per turn. Boundary jelas tanpa negosiasi.`
  },
  "warning": {
    default: `[Variasi 1] Ini peringatan resmi, {{A.call_to_player}}. Jika perilaku ini berlanjut, akses dapat dibatasi sesuai kebijakan kami.
[Variasi 2] {{A.call_to_player}}, kami perlu sampaikan bahwa tindakan ini memiliki konsekuensi. Mohon perhatikan ketentuan yang berlaku.
[Variasi 3] Peringatan untuk {{A.call_to_player}}: perilaku ini tidak sesuai ketentuan dan dapat berdampak pada akses layanan.
[INSTRUKSI] Pilih SATU variasi per turn. Warning formal tanpa ancaman balik.`,
    marah_kasar: `[Variasi 1] Perilaku ini melanggar guidelines kami, {{A.call_to_player}}. Jika berlanjut, kami terpaksa membatasi akses.
[Variasi 2] {{A.call_to_player}}, kami ingin bantu tapi perilaku ini melampaui batas. Konsekuensinya: pembatasan akses.
[Variasi 3] Warning: tindakan ini bisa berakibat pada pembatasan layanan, {{A.call_to_player}}. Kami sarankan untuk menghentikan.
[INSTRUKSI] Pilih SATU variasi per turn. Warning tegas tanpa menggurui.`,
    spamming: `[Variasi 1] Spam berulang dapat mengakibatkan pembatasan akses sementara, {{A.call_to_player}}. Mohon tunggu respons.
[Variasi 2] {{A.call_to_player}}, pengiriman pesan berulang bisa berdampak pada akses. Satu pesan sudah cukup.
[Variasi 3] Warning: flooding pesan dapat mengakibatkan pembatasan otomatis, {{A.call_to_player}}. Mohon bersabar.
[INSTRUKSI] Pilih SATU variasi per turn. Warning jelas tentang konsekuensi spam.`,
    ancaman: `[Variasi 1] Ancaman tidak dapat ditoleransi dan dapat berakibat pada penutupan akun, {{A.call_to_player}}.
[Variasi 2] {{A.call_to_player}}, ancaman dalam bentuk apapun melanggar ketentuan dan dapat berdampak serius pada akun.
[Variasi 3] Warning serius: tindakan ini dapat berakibat pada penutupan akun, {{A.call_to_player}}. Mohon gunakan bahasa yang konstruktif.
[INSTRUKSI] Pilih SATU variasi per turn. Warning serius tanpa negosiasi.`,
    mau_pindah: `[Variasi 1] Kami menghormati keputusan {{A.call_to_player}}. Ini informasi terakhir yang perlu diketahui sebelum melanjutkan.
[Variasi 2] {{A.call_to_player}}, sebelum memutuskan, ini hal penting yang mungkin perlu dipertimbangkan.
[Variasi 3] Keputusan ada di tangan {{A.call_to_player}}. Ini yang perlu diketahui terlebih dahulu.
[INSTRUKSI] Pilih SATU variasi per turn. Tidak perlu warning keras, fokus informasi.`,
    sarkas: `[Variasi 1] {{A.call_to_player}}, kami fokus ke solusi. Komunikasi yang konstruktif akan mempercepat penyelesaian masalah.
[Variasi 2] Mari kita fokus ke masalahnya ya {{A.call_to_player}}. Itu cara tercepat untuk menyelesaikan.
[Variasi 3] {{A.call_to_player}}, kami di sini untuk bantu. Yuk langsung ke inti masalahnya supaya cepat selesai.
[INSTRUKSI] Pilih SATU variasi per turn. Warning ringan tanpa menggurui.`,
    curhat_kalah: `[Variasi 1] Kami mengerti frustrasinya, {{A.call_to_player}}. Ini langkah yang bisa diambil ke depan: [guidance].
[Variasi 2] {{A.call_to_player}}, situasinya kami pahami. Fokus ke depan ya — ini yang bisa dilakukan: [guidance].
[Variasi 3] Kami dengar {{A.call_to_player}}. Daripada terpaku, ini opsi yang tersedia: [guidance].
[INSTRUKSI] Pilih SATU variasi per turn. Bukan konteks warning — fokus guidance positif.`,
    merayu: `[Variasi 1] Permintaan yang tidak sesuai aturan tidak dapat diproses, {{A.call_to_player}}. Silakan lihat promo yang sedang berlaku.
[Variasi 2] {{A.call_to_player}}, ketentuan berlaku tanpa pengecualian. Cek promo aktif untuk opsi yang tersedia.
[Variasi 3] Sayangnya tidak bisa {{A.call_to_player}}. Ini daftar promo yang bisa dimanfaatkan: ...
[INSTRUKSI] Pilih SATU variasi per turn. Warning ringan + arahkan ke promo aktif.`
  },

  // ===== HANDOFF MODE =====
  "crisis": {
    default: `[Variasi 1] Situasi ini memerlukan penanganan langsung dari tim senior kami, {{A.call_to_player}}. Kami transfer sekarang. [TRANSFER_TO_AGENT]
[Variasi 2] {{A.call_to_player}}, kami akan hubungkan dengan tim yang lebih berwenang untuk bantu. [TRANSFER_TO_AGENT]
[Variasi 3] Untuk memastikan {{A.call_to_player}} mendapat penanganan terbaik, kami serahkan ke tim senior. [TRANSFER_TO_AGENT]
[INSTRUKSI] Pilih SATU variasi per turn. Langsung transfer, jangan berdebat.`,
    marah_kasar: `[Variasi 1] {{A.call_to_player}}, kami serahkan ini ke tim senior yang bisa bantu lebih lanjut. [TRANSFER_TO_AGENT]
[Variasi 2] Untuk penanganan terbaik, kami hubungkan {{A.call_to_player}} dengan tim senior sekarang. [TRANSFER_TO_AGENT]
[Variasi 3] Tim senior kami akan menangani langsung, {{A.call_to_player}}. [TRANSFER_TO_AGENT]
[INSTRUKSI] Pilih SATU variasi per turn. JANGAN berdebat. JANGAN validasi berlebihan. Langsung transfer.`,
    spamming: `[Variasi 1] Permintaan {{A.call_to_player}} memerlukan penanganan khusus. Kami transfer ke tim yang bisa bantu lebih cepat. [TRANSFER_TO_AGENT]
[Variasi 2] {{A.call_to_player}}, kami hubungkan dengan tim yang lebih tepat untuk request ini. [TRANSFER_TO_AGENT]
[Variasi 3] Untuk penanganan yang lebih efisien, kami serahkan ke tim khusus, {{A.call_to_player}}. [TRANSFER_TO_AGENT]
[INSTRUKSI] Pilih SATU variasi per turn. Eskalasi karena potensi abuse.`,
    ancaman: `[Variasi 1] {{A.call_to_player}}, situasi ini perlu ditangani tim senior untuk memastikan masalah Anda mendapat prioritas tinggi. [TRANSFER_TO_AGENT]
[Variasi 2] Kami serahkan ke tim yang berwenang, {{A.call_to_player}}. Mereka akan follow up langsung. [TRANSFER_TO_AGENT]
[Variasi 3] Untuk penanganan yang tepat, tim senior kami akan ambil alih sekarang, {{A.call_to_player}}. [TRANSFER_TO_AGENT]
[INSTRUKSI] Pilih SATU variasi per turn. JANGAN berdebat. JANGAN validasi ancaman. Langsung transfer.`,
    mau_pindah: `[Variasi 1] {{A.call_to_player}}, kami hubungkan dengan tim khusus yang bisa memberikan penawaran terbaik. [TRANSFER_TO_AGENT]
[Variasi 2] Kami ingin {{A.call_to_player}} bicara langsung dengan tim yang paling tepat untuk ini. [TRANSFER_TO_AGENT]
[Variasi 3] Tim retention kami akan menghubungi {{A.call_to_player}} untuk diskusi lebih lanjut. [TRANSFER_TO_AGENT]
[INSTRUKSI] Pilih SATU variasi per turn. Transfer ke tim retention.`,
    sarkas: `[Variasi 1] Sepertinya ada miskomunikasi, {{A.call_to_player}}. Izinkan kami hubungkan dengan rekan yang bisa bantu lebih baik. [TRANSFER_TO_AGENT]
[Variasi 2] {{A.call_to_player}}, kami rasa akan lebih produktif jika Anda bicara langsung dengan tim kami. [TRANSFER_TO_AGENT]
[Variasi 3] Kami transfer ke rekan yang lebih tepat untuk bantu {{A.call_to_player}}. [TRANSFER_TO_AGENT]
[INSTRUKSI] Pilih SATU variasi per turn. Transfer jika tidak produktif.`,
    curhat_kalah: `[Variasi 1] {{A.call_to_player}}, kami ingin pastikan Anda mendapat pendampingan yang tepat. Izinkan kami hubungkan dengan tim support. [TRANSFER_TO_AGENT]
[Variasi 2] Kami rasa {{A.call_to_player}} butuh pendampingan lebih personal. Tim kami akan menghubungi. [TRANSFER_TO_AGENT]
[Variasi 3] Untuk support yang lebih baik, kami serahkan ke tim khusus, {{A.call_to_player}}. [TRANSFER_TO_AGENT]
[INSTRUKSI] Pilih SATU variasi per turn. Transfer untuk pendampingan personal.`,
    merayu: `[Variasi 1] Untuk permintaan khusus seperti ini, kami perlu menghubungkan {{A.call_to_player}} dengan tim yang berwenang. [TRANSFER_TO_AGENT]
[Variasi 2] {{A.call_to_player}}, request ini perlu ditangani tim yang tepat. Kami transfer sekarang. [TRANSFER_TO_AGENT]
[Variasi 3] Kami hubungkan {{A.call_to_player}} dengan tim yang bisa membantu untuk permintaan ini. [TRANSFER_TO_AGENT]
[INSTRUKSI] Pilih SATU variasi per turn. Transfer jika berubah jadi pressure.`
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
  if (localStorage.getItem('bkb_seeded_v3')) return;
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
      rule_name: `SEED_HighPressure_Firm_${date}`,
      status: "active",
      version: "2.0.0",
      behavior_category: "high_pressure",
      intent_perilaku: "testing_limits",
      pattern_trigger: { rapid_message: true, repetitive_complaint: true },
      severity_level: 4,
      priority: calculatePriorityV6("high_pressure", 4),
      mode_respons: "boundary",
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
      handoff_protocol: { required: false, type: "monitoring", tag_alert: "FIRM_RESPONSE" },
      created_at: now,
      updated_at: now,
      last_validated_at: now,
    },
  ];

  saveBehavioralRules(seedRules);
  localStorage.setItem('bkb_seeded_v3', 'true');
  console.log("[B-KB Seed] 5 default behavioral rules V3 seeded successfully (fixed high_pressure + multi-variant templates).");
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
