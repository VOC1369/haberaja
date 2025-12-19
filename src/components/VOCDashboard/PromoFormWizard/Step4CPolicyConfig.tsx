import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FileText,
  CreditCard,
  ClipboardList,
  Gamepad2,
  Ban,
  AlertTriangle,
  Gift,
  Scale,
  Bot,
  Info,
} from "lucide-react";

import {
  PolicyConfigData,
  initialPolicyData,
  PolicyIdentity,
  DepositMethodRules,
  UsageRequirements,
  GameScope,
  RestrictionsProhibitions,
  PenaltiesConsequences,
  BonusExclusion,
  AuthorityDisclaimer,
  AIBehaviorGuard,
} from "./policy-config";

export interface Step4CPolicyConfigProps {
  data?: PolicyConfigData;
  onChange?: (data: PolicyConfigData) => void;
}

const SECTIONS = [
  {
    id: "identity",
    title: "Identitas Policy",
    icon: FileText,
    description: "Nama, tipe, dan status policy",
  },
  {
    id: "deposit_rules",
    title: "Aturan Deposit & Metode",
    icon: CreditCard,
    description: "Metode deposit dan provider yang berlaku",
    conditionalOn: "deposit_policy",
  },
  {
    id: "usage",
    title: "Syarat Penggunaan",
    icon: ClipboardList,
    description: "Requirement credit/turnover sebelum withdraw",
  },
  {
    id: "game_scope",
    title: "Cakupan Game",
    icon: Gamepad2,
    description: "Game yang berlaku dan dikecualikan",
  },
  {
    id: "restrictions",
    title: "Larangan & Batasan",
    icon: Ban,
    description: "Hal-hal yang tidak boleh dilakukan",
  },
  {
    id: "penalties",
    title: "Penalti & Konsekuensi",
    icon: AlertTriangle,
    description: "Konsekuensi jika melanggar aturan",
  },
  {
    id: "bonus_exclusion",
    title: "Status Bonus",
    icon: Gift,
    description: "Bonus yang tidak berlaku",
  },
  {
    id: "authority",
    title: "Otoritas & Disclaimer",
    icon: Scale,
    description: "Klausa keputusan mutlak",
  },
  {
    id: "ai_behavior",
    title: "AI Response Setting",
    icon: Bot,
    description: "Pengaturan perilaku AI (read-only)",
    isLocked: true,
  },
];

export function Step4CPolicyConfig({
  data: externalData,
  onChange,
}: Step4CPolicyConfigProps) {
  const [internalData, setInternalData] = useState<PolicyConfigData>(initialPolicyData);
  const data = externalData || internalData;

  const [openSections, setOpenSections] = useState<string[]>(["identity"]);

  const handleUpdate = <K extends keyof PolicyConfigData>(
    section: K,
    updates: Partial<PolicyConfigData[K]>
  ) => {
    const newData = {
      ...data,
      [section]: { ...data[section], ...updates },
    };
    if (onChange) {
      onChange(newData);
    } else {
      setInternalData(newData);
    }
  };

  // Filter sections based on policy type
  const visibleSections = SECTIONS.filter((section) => {
    if (section.conditionalOn === "deposit_policy") {
      return data.identity.policy_type === "deposit_policy";
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">
          Konfigurasi Policy Program
        </h2>
        <p className="text-sm text-muted-foreground">
          Atur detail aturan, syarat, larangan, dan konsekuensi kebijakan.
        </p>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
        <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-600">
            Policy Program adalah ATURAN/KEBIJAKAN, bukan bonus atau hadiah.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            AI hanya akan menjelaskan aturan dan konsekuensi, tidak akan menghitung reward.
          </p>
        </div>
      </div>

      {/* Accordion Sections */}
      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="space-y-4"
      >
        {visibleSections.map((section) => {
          const Icon = section.icon;
          return (
            <AccordionItem
              key={section.id}
              value={section.id}
              className="border border-border rounded-xl overflow-hidden bg-card"
            >
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    section.isLocked ? "bg-muted" : "bg-button-hover/20"
                  }`}>
                    <Icon className={`h-5 w-5 ${section.isLocked ? "text-muted-foreground" : "text-button-hover"}`} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-base font-medium text-foreground">
                      {section.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                {section.id === "identity" && (
                  <PolicyIdentity
                    data={data.identity}
                    onChange={(updates) => handleUpdate("identity", updates)}
                  />
                )}
                {section.id === "deposit_rules" && (
                  <DepositMethodRules
                    data={data.deposit_rules}
                    onChange={(updates) => handleUpdate("deposit_rules", updates)}
                  />
                )}
                {section.id === "usage" && (
                  <UsageRequirements
                    data={data.usage}
                    onChange={(updates) => handleUpdate("usage", updates)}
                  />
                )}
                {section.id === "game_scope" && (
                  <GameScope
                    data={data.game_scope}
                    onChange={(updates) => handleUpdate("game_scope", updates)}
                  />
                )}
                {section.id === "restrictions" && (
                  <RestrictionsProhibitions
                    data={data.restrictions}
                    onChange={(updates) => handleUpdate("restrictions", updates)}
                  />
                )}
                {section.id === "penalties" && (
                  <PenaltiesConsequences
                    data={data.penalties}
                    onChange={(updates) => handleUpdate("penalties", updates)}
                  />
                )}
                {section.id === "bonus_exclusion" && (
                  <BonusExclusion
                    data={data.bonus_exclusion}
                    onChange={(updates) => handleUpdate("bonus_exclusion", updates)}
                  />
                )}
                {section.id === "authority" && (
                  <AuthorityDisclaimer
                    data={data.authority}
                    onChange={(updates) => handleUpdate("authority", updates)}
                  />
                )}
                {section.id === "ai_behavior" && <AIBehaviorGuard />}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

export { initialPolicyData };
export type { PolicyConfigData };
