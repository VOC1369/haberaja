// General Knowledge Types
export interface GeneralKnowledgeItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  knowledgeType: string;
  createdAt: string;
  updatedAt: string;
}

// Behavioral Knowledge Types (B-KB Document)
export interface BehavioralRuleItem {
  id: string;
  behaviorCategory: string;
  intentPerilaku: string;
  patternTrigger: string[];
  modeResponsAI: string;
  severityLevel: number;
  priority: number;
  responseTemplate: string;
  reasoningGuideline: string;
  allowedActions: string[];
  createdAt: string;
  updatedAt: string;
}

// General Knowledge Categories
export const generalCategories = [
  "FAQ",
  "Product Info",
  "Policy",
  "Tutorial",
  "Troubleshooting",
  "Other"
];

export const generalKnowledgeTypes = [
  "Static",
  "Dynamic",
  "Contextual"
];

// Behavioral Categories (12 types from B-KB Document)
export const behaviorCategories = [
  "Aggressive",
  "Manipulative",
  "Fraudulent",
  "Spam/Abuse",
  "Emotional Distress",
  "Confusion",
  "VIP Entitlement",
  "Regulatory Concern",
  "Technical Frustration",
  "Social Engineering",
  "Addiction Indicator",
  "Normal Inquiry"
];

// Intent Perilaku (12 intents from B-KB Document)
export const intentPerilakuOptions = [
  "Intimidasi",
  "Negosiasi Paksa",
  "Penipuan",
  "Spam Berulang",
  "Curhat Emosional",
  "Kebingungan Sistem",
  "Klaim VIP",
  "Ancaman Hukum",
  "Frustrasi Teknis",
  "Phishing",
  "Pola Adiksi",
  "Pertanyaan Umum"
];

// Pattern Trigger (7 detectors from B-KB Document)
export const patternTriggerOptions = [
  "Keyword Match",
  "Sentiment Analysis",
  "Frequency Detection",
  "Time Pattern",
  "Escalation Pattern",
  "Contradiction Detection",
  "Behavioral Sequence"
];

// Mode Respons AI (9 modes from B-KB Document)
export const modeResponsAIOptions = [
  "Empathetic De-escalation",
  "Firm Boundary Setting",
  "Immediate Escalation",
  "Soft Redirect",
  "Educational Response",
  "Verification Request",
  "VIP Acknowledgment",
  "Cooling Period",
  "Standard Response"
];

// Allowed Actions (from B-KB Document)
export const allowedActionsOptions = [
  "Escalate to Human",
  "Send Warning",
  "Temporary Block",
  "Permanent Block",
  "Flag for Review",
  "Auto-respond",
  "Delay Response",
  "Request Verification",
  "Log Only"
];

// LocalStorage Keys
const GENERAL_KNOWLEDGE_KEY = "voc_general_knowledge";
const BEHAVIORAL_RULES_KEY = "voc_behavioral_rules";

// General Knowledge Helpers
export function getGeneralKnowledge(): GeneralKnowledgeItem[] {
  const data = localStorage.getItem(GENERAL_KNOWLEDGE_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveGeneralKnowledge(items: GeneralKnowledgeItem[]): void {
  localStorage.setItem(GENERAL_KNOWLEDGE_KEY, JSON.stringify(items));
}

export function addGeneralKnowledge(item: Omit<GeneralKnowledgeItem, "id" | "createdAt" | "updatedAt">): GeneralKnowledgeItem {
  const items = getGeneralKnowledge();
  const newItem: GeneralKnowledgeItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  items.push(newItem);
  saveGeneralKnowledge(items);
  return newItem;
}

export function updateGeneralKnowledge(id: string, updates: Partial<GeneralKnowledgeItem>): void {
  const items = getGeneralKnowledge();
  const index = items.findIndex(item => item.id === id);
  if (index !== -1) {
    items[index] = { ...items[index], ...updates, updatedAt: new Date().toISOString() };
    saveGeneralKnowledge(items);
  }
}

export function deleteGeneralKnowledge(id: string): void {
  const items = getGeneralKnowledge().filter(item => item.id !== id);
  saveGeneralKnowledge(items);
}

// Behavioral Rules Helpers
export function getBehavioralRules(): BehavioralRuleItem[] {
  const data = localStorage.getItem(BEHAVIORAL_RULES_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveBehavioralRules(items: BehavioralRuleItem[]): void {
  localStorage.setItem(BEHAVIORAL_RULES_KEY, JSON.stringify(items));
}

export function addBehavioralRule(item: Omit<BehavioralRuleItem, "id" | "createdAt" | "updatedAt">): BehavioralRuleItem {
  const items = getBehavioralRules();
  const newItem: BehavioralRuleItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  items.push(newItem);
  saveBehavioralRules(items);
  return newItem;
}

// Legacy migration helper - converts old format to new format
export function migrateLegacyBehavioralRules(): void {
  const items = getBehavioralRules();
  const migratedItems = items.map((item: BehavioralRuleItem) => {
    const legacyItem = item as any;
    // Check if item has old format fields
    if ('behaviorType' in legacyItem && !('behaviorCategory' in legacyItem)) {
      return {
        id: item.id,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        behaviorCategory: legacyItem.behaviorType || "Normal Inquiry",
        intentPerilaku: "Pertanyaan Umum",
        patternTrigger: legacyItem.triggerKeywords || [],
        modeResponsAI: legacyItem.modeOverride || "Standard Response",
        severityLevel: 1,
        priority: legacyItem.priority || 50,
        responseTemplate: legacyItem.responseTemplate || "",
        reasoningGuideline: legacyItem.aiGuidelines || "",
        allowedActions: ["Auto-respond"],
      } as BehavioralRuleItem;
    }
    return item;
  });
  saveBehavioralRules(migratedItems);
}

export function updateBehavioralRule(id: string, updates: Partial<BehavioralRuleItem>): void {
  const items = getBehavioralRules();
  const index = items.findIndex(item => item.id === id);
  if (index !== -1) {
    items[index] = { ...items[index], ...updates, updatedAt: new Date().toISOString() };
    saveBehavioralRules(items);
  }
}

export function deleteBehavioralRule(id: string): void {
  const items = getBehavioralRules().filter(item => item.id !== id);
  saveBehavioralRules(items);
}
