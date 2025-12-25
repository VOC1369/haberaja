import { useState } from "react";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BadgeInfo,
  Star,
  Wallet,
  ArrowUpFromLine,
  Dices,
  ScrollText,
  Target,
} from "lucide-react";

import {
  PolicyConfigData,
  PolicySubtype,
  initialPolicyData,
  PolicyIdentity,
  LoyaltyConfig,
  DepositConfig,
  WithdrawalConfig,
  BettingConfig,
  PolicyRules,
  PolicyScope,
} from "./policy-config";

interface Step4CPolicyProps {
  data?: PolicyConfigData;
  onChange?: (data: PolicyConfigData) => void;
  stepNumber?: number;
  stepTitle?: string;
}

// Section definitions matching Step4BEventConfig pattern
const SECTIONS = [
  {
    id: "identity",
    title: "Identitas Policy",
    icon: BadgeInfo,
    description: "Nama, tipe, dan deskripsi policy",
    alwaysShow: true,
  },
  {
    id: "loyalty",
    title: "Konfigurasi Loyalty Point",
    icon: Star,
    description: "Earning rule, exchange tiers, claim method",
    subtype: "loyalty_program" as PolicySubtype,
  },
  {
    id: "deposit",
    title: "Konfigurasi Deposit",
    icon: Wallet,
    description: "Min/max deposit, channel, potongan",
    subtype: "deposit_policy" as PolicySubtype,
  },
  {
    id: "withdrawal",
    title: "Konfigurasi Withdrawal",
    icon: ArrowUpFromLine,
    description: "Min/max WD, limit harian, syarat",
    subtype: "withdrawal_policy" as PolicySubtype,
  },
  {
    id: "betting",
    title: "Konfigurasi Betting Restriction",
    icon: Dices,
    description: "Max bet, excluded games, providers",
    subtype: "betting_restriction" as PolicySubtype,
  },
  {
    id: "rules",
    title: "Aturan & Ketentuan",
    icon: ScrollText,
    description: "Daftar aturan dan pemetaan penalti",
    alwaysShow: true,
  },
  {
    id: "scope",
    title: "Syarat Keberlakuan",
    icon: Target,
    description: "Game/provider yang terpengaruh, periode berlaku",
    alwaysShow: true,
  },
];

export function Step4CPolicy({ data: externalData, onChange, stepNumber = 4, stepTitle = "Konfigurasi Policy" }: Step4CPolicyProps) {
  const [internalData, setInternalData] = useState<PolicyConfigData>(initialPolicyData);
  const data = externalData || internalData;

  const [openSections, setOpenSections] = useState<string[]>(["identity"]);
  
  // Subtype switch confirmation dialog
  const [pendingSubtype, setPendingSubtype] = useState<PolicySubtype | null>(null);
  const [showSubtypeConfirm, setShowSubtypeConfirm] = useState(false);

  const updateData = (newData: PolicyConfigData) => {
    if (onChange) {
      onChange(newData);
    } else {
      setInternalData(newData);
    }
  };

  const handleUpdate = <K extends keyof PolicyConfigData>(
    section: K,
    updates: Partial<PolicyConfigData[K]>
  ) => {
    const newData = {
      ...data,
      [section]: { ...data[section], ...updates },
    };
    updateData(newData);
  };

  // Handle subtype change with reset confirmation
  const handleSubtypeChange = (newSubtype: PolicySubtype) => {
    const currentSubtype = data.identity.policy_subtype;
    
    // If changing from a specific subtype to another, confirm reset
    if (currentSubtype !== 'general_policy' && newSubtype !== currentSubtype) {
      setPendingSubtype(newSubtype);
      setShowSubtypeConfirm(true);
    } else {
      // Direct change without confirmation
      handleUpdate('identity', { policy_subtype: newSubtype });
    }
  };

  // Confirm subtype switch and reset related data
  const confirmSubtypeSwitch = () => {
    if (!pendingSubtype) return;

    // Reset the old subtype's data
    const resetData: PolicyConfigData = {
      ...data,
      identity: { ...data.identity, policy_subtype: pendingSubtype },
      loyalty: initialPolicyData.loyalty,
      deposit: initialPolicyData.deposit,
      withdrawal: initialPolicyData.withdrawal,
      betting: initialPolicyData.betting,
    };

    updateData(resetData);
    setShowSubtypeConfirm(false);
    setPendingSubtype(null);
    
    toast.info("Data konfigurasi sebelumnya telah di-reset.");
  };

  // Filter sections based on current subtype
  const visibleSections = SECTIONS.filter((section) => {
    if (section.alwaysShow) return true;
    if (section.subtype === data.identity.policy_subtype) return true;
    return false;
  });

  return (
    <div className="space-y-6">
      {/* Page Header - EXACT pattern from Step3Reward */}
      <div className="flex items-center gap-4 mb-6">
        <div className="icon-circle">
          <ScrollText className="icon-circle-icon" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-button-hover">Step {stepNumber} — {stepTitle}</h3>
          <p className="text-sm text-muted-foreground">
            Atur detail aturan, batasan, dan ketentuan yang berlaku.
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
                  <div className="w-10 h-10 rounded-full bg-button-hover/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-button-hover" />
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
                    onChange={(updates) => {
                      // Special handling for subtype changes
                      if (updates.policy_subtype && updates.policy_subtype !== data.identity.policy_subtype) {
                        handleSubtypeChange(updates.policy_subtype);
                      } else {
                        handleUpdate("identity", updates);
                      }
                    }}
                  />
                )}
                {section.id === "loyalty" && (
                  <LoyaltyConfig
                    data={data.loyalty}
                    onChange={(updates) => handleUpdate("loyalty", updates)}
                  />
                )}
                {section.id === "deposit" && (
                  <DepositConfig
                    data={data.deposit}
                    onChange={(updates) => handleUpdate("deposit", updates)}
                  />
                )}
                {section.id === "withdrawal" && (
                  <WithdrawalConfig
                    data={data.withdrawal}
                    onChange={(updates) => handleUpdate("withdrawal", updates)}
                  />
                )}
                {section.id === "betting" && (
                  <BettingConfig
                    data={data.betting}
                    onChange={(updates) => handleUpdate("betting", updates)}
                  />
                )}
                {section.id === "rules" && (
                  <PolicyRules
                    data={data.rules}
                    onChange={(updates) => handleUpdate("rules", updates)}
                  />
                )}
                {section.id === "scope" && (
                  <PolicyScope
                    data={data.scope}
                    onChange={(updates) => handleUpdate("scope", updates)}
                  />
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Subtype Switch Confirmation Dialog */}
      <AlertDialog open={showSubtypeConfirm} onOpenChange={setShowSubtypeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ganti Tipe Policy?</AlertDialogTitle>
            <AlertDialogDescription>
              Mengubah tipe policy akan menghapus data konfigurasi spesifik yang sudah diisi sebelumnya. 
              Data aturan dan syarat keberlakuan tetap disimpan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingSubtype(null)}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmSubtypeSwitch}>
              Ya, Ganti Tipe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { initialPolicyData };
export type { PolicyConfigData };
