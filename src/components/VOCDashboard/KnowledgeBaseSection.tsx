import { GeneralKnowledgeSection } from "./GeneralKnowledgeSection";
import { PromoKnowledgeSection } from "./PromoKnowledgeSection";
import { BehavioralKnowledgeSection } from "./BehavioralKnowledgeSection";
import { PseudoKnowledgeSection } from "./PseudoKnowledgeSection";
import { ParserDataSection } from "./ParserDataSection";
import type { KnowledgeCategory } from "@/pages/Dashboard";

interface KnowledgeBaseSectionProps {
  activeCategory: KnowledgeCategory;
  forceResetKey?: number;
  onNavigateToPromo?: () => void;
}

export function KnowledgeBaseSection({ activeCategory, forceResetKey, onNavigateToPromo }: KnowledgeBaseSectionProps) {
  if (activeCategory === "parserData") {
    return <ParserDataSection />;
  }

  if (activeCategory === "general") {
    return <GeneralKnowledgeSection />;
  }

  if (activeCategory === "promo") {
    return <PromoKnowledgeSection forceResetKey={forceResetKey} />;
  }

  if (activeCategory === "behavioral") {
    return <BehavioralKnowledgeSection forceResetKey={forceResetKey} />;
  }

  if (activeCategory === "pseudo") {
    return <PseudoKnowledgeSection onNavigateToPromo={onNavigateToPromo} />;
  }

  return null;
}
