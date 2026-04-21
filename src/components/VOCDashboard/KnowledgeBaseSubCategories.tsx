import { FileText, Gift, Brain, Sparkles, FileSearch, LucideIcon } from "lucide-react";

export interface KnowledgeBaseSubCategory {
  key: string;
  name: string;
  icon: LucideIcon;
}

export const knowledgeBaseSubCategories: KnowledgeBaseSubCategory[] = [
  { key: "parserData", name: "Parser Data", icon: FileSearch },
  { key: "pseudo", name: "Pseudo Extractor", icon: Sparkles },
  { key: "promo", name: "Promo Knowledge", icon: Gift },
  { key: "general", name: "General Knowledge", icon: FileText },
  { key: "behavioral", name: "Behavioral Knowledge", icon: Brain },
];
