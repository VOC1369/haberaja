import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CategoryNav } from "@/components/VOCDashboard/CategoryNav";
import { subCategories } from "@/components/VOCDashboard/SubCategoryTabs";
import { ticketSubCategories } from "@/components/VOCDashboard/TicketSubCategories";
import { KnowledgeBaseSection } from "@/components/VOCDashboard/KnowledgeBaseSection";
import { TicketList } from "@/components/VOCDashboard/TicketList";
import { AdminRoleSection } from "@/components/VOCDashboard/AdminRoleSection";
import { ChatSection } from "@/components/VOCDashboard/ChatSection";
import { AccountSection } from "@/components/VOCDashboard/AccountSection";
import { APIDataSection } from "@/components/VOCDashboard/APIDataSection";
import { LegalSupportSection } from "@/components/VOCDashboard/LegalSupportSection";
import { LivechatTestConsole } from "@/components/VOCDashboard/LivechatTestConsole";
import { TicketCategory } from "@/types/ticket";
import { toast } from "@/lib/notify";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";

// APBE v1.2 Forms
import {
  BrandIdentityForm,
  AgentPersonaForm,
  CommunicationEngineForm,
  InteractionLibraryForm,
  OperationalSOPForm,
  SafetyCrisisForm,
  VIPLogicForm,
  APBESummaryReview,
  APBEJSONPreview,
  APBERuntimePrompt,
  APBEPersonaList,
  APBEProgressBar,
  AutosaveIndicator,
  AutosaveStatus,
} from "@/components/VOCDashboard/forms/apbe";

// Step mapping for progress bar (8 steps after removing Behaviour Engine)
const categoryToStep: Record<string, number> = {
  brandIdentity: 1,
  agentPersona: 2,
  communicationEngine: 3,
  operationalSOP: 4,
  safetyCrisis: 5,
  vipLogic: 6,
  interactionLibrary: 7,
  summaryReview: 8,
};

const stepToCategory = [
  "brandIdentity", "agentPersona", "communicationEngine",
  "operationalSOP", "safetyCrisis", "vipLogic",
  "interactionLibrary", "summaryReview"
];
import { APBEConfig, initialAPBEConfig } from "@/types/apbe-config";
// APBE Storage & Prompt
import { 
  loadInitialConfig, 
  saveAPBEDraft, 
  publishAPBEConfig,
  updateExistingPersona,
  APBEVersion
} from "@/lib/apbe-storage";
import { compileRuntimePrompt } from "@/lib/apbe-prompt-template";

// Legacy imports for Account/API sections
import { VOCConfig } from "@/types/voc-config";

// Validation penalty hook
import { useValidationPenalty } from "@/hooks/use-validation-penalty";

export type KnowledgeCategory = "general" | "promo" | "behavioral" | "pseudo";

type ViewMode = "form" | "json" | "prompt" | "list";

const Dashboard = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("inputData");
  const [activeCategory, setActiveCategory] = useState("personaList");
  const [activeTicketCategory, setActiveTicketCategory] = useState<TicketCategory>("general");
  const [activeKnowledgeCategory, setActiveKnowledgeCategory] = useState<KnowledgeCategory>("general");
  const [knowledgeResetKey, setKnowledgeResetKey] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);
  const [editingPersonaName, setEditingPersonaName] = useState<string | null>(null);
  const [isEditingFromSummary, setIsEditingFromSummary] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("idle");
  const [searchQuery, setSearchQuery] = useState("");

  // Auth guard
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/", { replace: true });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate("/", { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  
  // Ref for main scrollable area - to reset scroll on navigation
  const mainRef = useRef<HTMLElement>(null);
  
  // Validation penalty monitoring
  const { checkPenalty } = useValidationPenalty();
  
  const apbeForm = useForm<APBEConfig>({
    defaultValues: initialAPBEConfig,
    mode: "onChange"
  });

  // Load existing config on mount
  useEffect(() => {
    const loadConfig = async () => {
      const savedConfig = await loadInitialConfig();
      apbeForm.reset(savedConfig);
    };
    loadConfig();
  }, []);

  // Debounced save function with status indicator
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedSave = useCallback((data: APBEConfig) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setAutosaveStatus("saving");
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveAPBEDraft(data);
        setAutosaveStatus("saved");
      } catch (e) {
        setAutosaveStatus("error");
      }
    }, 400);
  }, []);

  // Auto-save draft on form change (debounced) + Penalty monitoring
  useEffect(() => {
    const subscription = apbeForm.watch((data) => {
      if (activeSection === "inputData" && data) {
        debouncedSave(data as APBEConfig);
        // Check for validation penalty (real-time popup)
        checkPenalty(data as APBEConfig);
      }
    });
    return () => {
      subscription.unsubscribe();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [apbeForm.watch, activeSection, debouncedSave, checkPenalty]);

  // Reset viewMode when category changes
  useEffect(() => {
    if (viewMode !== "form" && viewMode !== "list" && activeCategory !== "summaryReview") {
      setViewMode("form");
    }
  }, [activeCategory]);

  // --------------------------------------------------------------
  // SCROLL ENGINE v2.0 — Anti-Lovable, Anti-Multi-Scroll, Deterministic
  // --------------------------------------------------------------
  useEffect(() => {
    const containers = [
      mainRef.current,
      document.scrollingElement,
      document.documentElement,
      document.body
    ];

    const hardReset = () => {
      containers.forEach(el => {
        if (!el) return;
        el.scrollTop = 0;
        try {
          el.scrollTo({ top: 0, behavior: "instant" });
        } catch (e) {}
      });
      // Force window scroll reset
      window.scrollTo({ top: 0, behavior: "instant" });
    };

    // Multi-phase rendering stabilization
    hardReset();
    setTimeout(hardReset, 0);   // After paint
    setTimeout(hardReset, 30);  // After layout reflow
    setTimeout(hardReset, 80);  // After Lovable wrapper resolves

  }, [activeCategory, activeSection]);

  // Reset viewMode when section changes
  useEffect(() => {
    if (activeSection !== "inputData" && (viewMode === "json" || viewMode === "prompt")) {
      setViewMode("form");
    }
  }, [activeSection]);

  // Legacy form for Account/API sections
  const legacyForm = useForm<Pick<VOCConfig, 'account' | 'apiData'>>({
    defaultValues: {
      account: { userName: "", whatsappNumber: "", email: "", position: "" },
      apiData: { supabaseApi: "", chatGptApi: "", debounceSeconds: 3 }
    },
    mode: "onChange"
  });

  const onSubmit = (data: APBEConfig) => {
    console.log("APBE Config:", data);
    toast.success("Configuration saved successfully!");
  };

  // Handle publish persona
  const handlePublish = async (adminName: string) => {
    const config = apbeForm.getValues();
    const runtimePrompt = compileRuntimePrompt(config);
    const currentAdmin = adminName || "Admin";
    
    let result: APBEVersion | null;
    
    if (editingPersonaId) {
      // Update existing persona (version increment, same row)
      result = await updateExistingPersona(editingPersonaId, config, runtimePrompt, currentAdmin);
      if (result) {
        toast.success(`Persona "${result.persona_name}" updated to v${result.version}!`);
      } else {
        toast.error("Gagal mengupdate persona");
        return;
      }
    } else {
      // Create new persona
      result = await publishAPBEConfig(config, runtimePrompt, currentAdmin);
      if (result) {
        toast.success(`Persona "${result.persona_name}" v${result.version} berhasil dipublish!`);
      } else {
        toast.error("Gagal publish persona");
        return;
      }
    }
    
    // Reset editing state
    setEditingPersonaId(null);
    
    // Navigate to persona list
    setActiveCategory("personaList");
    setViewMode("list");
  };

  // Handle Edit from Persona List
  const handleEditPersona = (version: APBEVersion) => {
    apbeForm.reset(version.persona_json);
    // Track which persona we're editing
    setEditingPersonaId(version.id);
    setEditingPersonaName(`${version.persona_name} v${version.version}`);
    // Navigate to summary review for quick edits
    setActiveCategory("summaryReview");
    setViewMode("form");
    toast.info(`Editing: ${version.persona_name} v${version.version}`);
  };

  // Handle edit section from Summary (go to form and return back after save)
  const handleEditSectionFromSummary = (sectionKey: string) => {
    setIsEditingFromSummary(true);
    setActiveCategory(sectionKey);
  };

  // Handle return to summary after form save
  const handleReturnToSummary = () => {
    setIsEditingFromSummary(false);
    setActiveCategory("summaryReview");
  };

  // Handle Create New Persona
  const handleCreateNewPersona = () => {
    apbeForm.reset(initialAPBEConfig);
    // Clear editing state (this is a new persona)
    setEditingPersonaId(null);
    setEditingPersonaName(null);
    setIsEditingFromSummary(false);
    setViewMode("form");
    setActiveCategory("brandIdentity");
  };

  // Handle Load Sample Persona
  const handleLoadSamplePersona = (config: APBEConfig, name: string) => {
    apbeForm.reset(config);
    // Clear editing state (this starts a new persona from template)
    setEditingPersonaId(null);
    setEditingPersonaName(null);
    setIsEditingFromSummary(false);
    setViewMode("form");
    setActiveCategory("brandIdentity");
  };

  // Handle Import Config from file
  const handleImportConfig = (config: APBEConfig, meta: { persona_name?: string } | null) => {
    apbeForm.reset(config);
    // Clear editing state (this is imported, not edit)
    setEditingPersonaId(null);
    setEditingPersonaName(null);
    setIsEditingFromSummary(false);
    setViewMode("form");
    // Navigate to summary to review imported data
    setActiveCategory("summaryReview");
  };

  // Handle Back from Persona List
  const handleBackFromList = () => {
    setActiveSection("inputData");
    setActiveCategory("personaList");
  };

  // Handle step navigation from progress bar
  const handleStepNavigation = (step: number) => {
    if (step >= 1 && step <= 8) {
      setActiveCategory(stepToCategory[step - 1]);
    }
  };

  const currentIndex = subCategories.findIndex(cat => cat.key === activeCategory);
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < subCategories.length - 1;
  const previousCategory = canGoPrevious ? subCategories[currentIndex - 1] : null;
  const nextCategory = canGoNext ? subCategories[currentIndex + 1] : null;

  const goToPrevious = () => {
    if (canGoPrevious) setActiveCategory(subCategories[currentIndex - 1].key);
  };

  const goToNext = () => {
    if (canGoNext) setActiveCategory(subCategories[currentIndex + 1].key);
  };

  const getSectionName = (key: string) => {
    const sectionNames: Record<string, string> = {
      inputData: "Input Persona AI",
      knowledgeBase: "Knowledge Base",
      ticket: "Ticket",
      user: "User",
      adminRole: "Admin Role",
      liveChat: "Live Chat",
      testConsole: "Test Console",
      account: "Account",
      apiData: "API & Settings",
      legalSupport: "Legal & Support"
    };
    return sectionNames[key] || key;
  };

  const getCategoryName = (key: string) => {
    if (activeSection === "inputData") {
      const category = subCategories.find(cat => cat.key === key);
      return category?.name || key;
    }
    if (activeSection === "ticket") {
      const category = ticketSubCategories.find(cat => cat.key === key);
      return category?.name || key;
    }
    return key;
  };

  const handleSave = () => {
    toast.success("Settings saved!");
  };

  const renderContent = () => {
    // Handle Persona List view
    if (activeSection === "inputData" && activeCategory === "personaList") {
      return (
        <APBEPersonaList 
          onBack={handleBackFromList}
          onCreateNew={handleCreateNewPersona}
          onEdit={handleEditPersona}
          onLoadSample={handleLoadSamplePersona}
          onImport={handleImportConfig}
          searchQuery={searchQuery}
        />
      );
    }

    // Handle JSON Preview mode
    if (viewMode === "json") {
      return <APBEJSONPreview config={apbeForm.getValues()} onClose={() => setViewMode("form")} />;
    }

    // Handle Runtime Prompt mode
    if (viewMode === "prompt") {
      return (
        <APBERuntimePrompt 
          config={apbeForm.getValues()} 
          onClose={() => setViewMode("form")} 
        />
      );
    }

    if (activeSection === "knowledgeBase") {
      return <KnowledgeBaseSection
        activeCategory={activeKnowledgeCategory}
        forceResetKey={knowledgeResetKey}
        onNavigateToPromo={() => {
          setActiveKnowledgeCategory("promo");
          setKnowledgeResetKey(prev => prev + 1);
        }}
      />;
    }
    if (activeSection === "ticket") return <TicketList category={activeTicketCategory} />;
    if (activeSection === "adminRole") return <AdminRoleSection />;
    if (activeSection === "liveChat") return <ChatSection />;
    if (activeSection === "testConsole") return <LivechatTestConsole />;
    if (activeSection === "account") return <AccountSection form={legacyForm as any} onSave={handleSave} />;
    if (activeSection === "apiData") return <APIDataSection form={legacyForm as any} onSave={handleSave} />;
    if (activeSection === "legalSupport") return <LegalSupportSection />;

    // APBE v1.0 - 7 Categories + Summary (Behaviour Engine removed)
    switch (activeCategory) {
      case "brandIdentity": return <BrandIdentityForm form={apbeForm} isEditingFromSummary={isEditingFromSummary} onSaveAndReturn={handleReturnToSummary} />;
      case "agentPersona": return <AgentPersonaForm form={apbeForm} isEditingFromSummary={isEditingFromSummary} onSaveAndReturn={handleReturnToSummary} />;
      case "communicationEngine": return <CommunicationEngineForm form={apbeForm} isEditingFromSummary={isEditingFromSummary} onSaveAndReturn={handleReturnToSummary} />;
      case "interactionLibrary": return <InteractionLibraryForm form={apbeForm} isEditingFromSummary={isEditingFromSummary} onSaveAndReturn={handleReturnToSummary} />;
      case "operationalSOP": return <OperationalSOPForm form={apbeForm} isEditingFromSummary={isEditingFromSummary} onSaveAndReturn={handleReturnToSummary} />;
      case "safetyCrisis": return <SafetyCrisisForm form={apbeForm} isEditingFromSummary={isEditingFromSummary} onSaveAndReturn={handleReturnToSummary} />;
      case "vipLogic": return <VIPLogicForm form={apbeForm} isEditingFromSummary={isEditingFromSummary} onSaveAndReturn={handleReturnToSummary} />;
      case "summaryReview": return (
        <APBESummaryReview 
          form={apbeForm} 
          onEditSection={handleEditSectionFromSummary}
          onGenerateJSON={() => setViewMode("json")}
          onGeneratePrompt={() => setViewMode("prompt")}
          onPublish={handlePublish}
          onViewPersonaList={() => {
            setActiveCategory("personaList");
            setViewMode("list");
            setEditingPersonaId(null);
            setEditingPersonaName(null);
          }}
          onBack={() => {
            setActiveCategory("personaList");
            setViewMode("list");
          }}
          editingPersonaName={editingPersonaName || undefined}
        />
      );
      default: return <BrandIdentityForm form={apbeForm} />;
    }
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        <CategoryNav
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          activeTicketCategory={activeTicketCategory}
          onTicketCategoryChange={(key) => setActiveTicketCategory(key as TicketCategory)}
          activeKnowledgeCategory={activeKnowledgeCategory}
          onKnowledgeCategoryChange={(key) => {
            setActiveKnowledgeCategory(key as KnowledgeCategory);
            setKnowledgeResetKey(prev => prev + 1); // Trigger reset in child components
          }}
        />

        <div className="flex-1 flex flex-col min-h-0">
          <header className="shrink-0 h-[57px] bg-card border-b border-border px-6 flex items-center">
            <div className="flex items-center justify-between gap-4 w-full">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                {/* Autosave Indicator */}
                {activeSection === "inputData" && activeCategory !== "personaList" && (
                  <AutosaveIndicator status={autosaveStatus} />
                )}
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink className="cursor-pointer">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    {(activeSection === "inputData" || activeSection === "ticket") ? (
                      <>
                        <BreadcrumbItem>
                          <BreadcrumbLink className="cursor-pointer text-muted-foreground">{getSectionName(activeSection)}</BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        {/* Show JSON/Prompt in breadcrumb */}
                        {activeSection === "inputData" && (viewMode === "json" || viewMode === "prompt") ? (
                          <>
                            <BreadcrumbItem>
                              <BreadcrumbLink className="cursor-pointer text-muted-foreground">
                                {getCategoryName(activeCategory)}
                              </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                              <BreadcrumbPage>
                                {viewMode === "json" ? "JSON Output" : "Runtime Prompt"}
                              </BreadcrumbPage>
                            </BreadcrumbItem>
                          </>
                        ) : (
                          <BreadcrumbItem>
                            <BreadcrumbPage>
                              {activeSection === "inputData" ? getCategoryName(activeCategory) : getCategoryName(activeTicketCategory)}
                            </BreadcrumbPage>
                          </BreadcrumbItem>
                        )}
                      </>
                    ) : (
                      <BreadcrumbItem>
                        <BreadcrumbPage>{getSectionName(activeSection)}</BreadcrumbPage>
                      </BreadcrumbItem>
                    )}
                  </BreadcrumbList>
                </Breadcrumb>
              </div>

              <div className="relative max-w-[220px] w-full flex-shrink-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search..." 
                  className="pl-9 h-9 bg-secondary/30 border-border rounded-full" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </header>

          <main ref={mainRef} id="apbe-scroll" data-scroll="apbe-main" className={`flex-1 bg-background min-h-0 h-full max-h-full ${viewMode === "json" || viewMode === "prompt" ? "!overflow-hidden" : "overflow-y-auto"}`}>
            <div className={`flex flex-col ${viewMode === "json" || viewMode === "prompt" ? "h-full overflow-hidden" : `p-6 pt-8 min-h-full ${activeSection === "inputData" && activeCategory !== "personaList" && activeCategory !== "summaryReview" && !isEditingFromSummary ? "pb-[90px]" : "pb-8"}`}`}>
              <Form {...apbeForm}>
                {activeSection === "inputData" || activeSection === "account" || activeSection === "apiData" ? (
                  <form onSubmit={apbeForm.handleSubmit(onSubmit)} className="space-y-6">
                    {/* APBE Progress Bar - Only show in Input Persona AI forms (not Persona List, JSON, or Prompt views) */}
                    {activeSection === "inputData" && activeCategory !== "personaList" && viewMode !== "json" && viewMode !== "prompt" && (
                      <APBEProgressBar 
                        currentStep={categoryToStep[activeCategory] || 1}
                        onStepClick={handleStepNavigation}
                      />
                    )}
                    {renderContent()}
                  </form>
                ) : (
                  renderContent()
                )}
              </Form>
            </div>
          </main>

          {activeSection === "inputData" && activeCategory !== "personaList" && activeCategory !== "summaryReview" && !isEditingFromSummary && (
            <footer className="footer-bar">
              <div className="footer-bar-content">
                <Button variant="outline" onClick={goToPrevious} disabled={!canGoPrevious} className="min-w-[140px] justify-between gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="truncate">{previousCategory ? previousCategory.name : "Previous"}</span>
                </Button>
                <span className="text-sm text-muted-foreground">
                  {currentIndex + 1} of {subCategories.length}
                </span>
                <Button onClick={goToNext} disabled={!canGoNext} className="min-w-[140px] justify-between gap-2">
                  <span className="truncate">{nextCategory ? nextCategory.name : "Next"}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </footer>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
