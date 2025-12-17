import { Building2, Bot, MessageSquare, BookOpen, Settings, ShieldAlert, Crown, ClipboardCheck, List, LucideIcon } from "lucide-react";

export interface SubCategory {
  key: string;
  name: string;
  icon: LucideIcon;
}

// APBE v1.2 - 7 Categories + Summary + Persona List (Behaviour Engine removed)
export const subCategories: SubCategory[] = [
  { key: "personaList", name: "Persona List", icon: List },
  { key: "brandIdentity", name: "Brand Identity", icon: Building2 },
  { key: "agentPersona", name: "Agent Persona", icon: Bot },
  { key: "communicationEngine", name: "Communication", icon: MessageSquare },
  { key: "operationalSOP", name: "Operational SOP", icon: Settings },
  { key: "safetyCrisis", name: "Safety & Crisis", icon: ShieldAlert },
  { key: "vipLogic", name: "VIP Logic", icon: Crown },
  { key: "interactionLibrary", name: "Interaction Library", icon: BookOpen },
  { key: "summaryReview", name: "Summary & Publish", icon: ClipboardCheck },
];
