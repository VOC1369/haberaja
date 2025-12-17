import { FileText, Gift, Brain, Sparkles, LucideIcon } from "lucide-react";

export interface KnowledgeBaseSubCategory {
  key: string;
  name: string;
  icon: LucideIcon;
}

export const knowledgeBaseSubCategories: KnowledgeBaseSubCategory[] = [
  { key: "general", name: "General Knowledge", icon: FileText },
  { key: "promo", name: "Promo Knowledge", icon: Gift },
  { key: "behavioral", name: "Behavioral Knowledge", icon: Brain },
  { key: "pseudo", name: "Pseudo Knowledge", icon: Sparkles },
];
