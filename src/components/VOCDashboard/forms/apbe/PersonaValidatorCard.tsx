/**
 * PersonaValidatorCard Component v2.1
 * 
 * Blueprint-compliant validation display with:
 * - Critical Errors section (RED, default open)
 * - Warnings section (YELLOW)
 * - Clickable errors → navigate to form section
 * - DUAL-LAYER ERROR MESSAGING: Human-friendly UI + Technical tooltips
 */

import { useState, useEffect } from "react";
import { APBEConfig } from "@/types/apbe-config";
import { validatePersonaJSON, PersonaValidationResult, BlockStatus } from "@/lib/apbe-persona-validator";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ChevronDown,
  Edit2,
  Shield,
  AlertCircle,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getUIFriendlyError, getTechnicalCode } from "@/lib/apbe-error-dictionary";

interface PersonaValidatorCardProps {
  config: APBEConfig;
  onEditSection?: (sectionKey: string) => void;
}

// Block name mapping for display
const blockDisplayNames: Record<string, string> = {
  A: "Brand Identity",
  agent: "Agent Persona",
  C: "Communication",
  L: "Interaction Library",
  O: "Operational SOP",
  "O.crisis": "Safety & Crisis",
  B: "Behaviour Engine",
  V: "VIP Logic",
};

// Section key mapping for edit navigation
const blockToSectionKey: Record<string, string> = {
  A: "brandIdentity",
  agent: "agentPersona",
  C: "communicationEngine",
  L: "interactionLibrary",
  O: "operationalSOP",
  "O.crisis": "safetyCrisis",
  B: "behaviourEngine",
  V: "vipLogic",
};

// Helper to determine section from error/warning text (works with both technical & friendly messages)
const getSectionKeyFromText = (text: string): string | null => {
  const lowerText = text.toLowerCase();
  
  // Brand Identity patterns
  if (lowerText.includes("group_name") || lowerText.includes("website_name") ||
      lowerText.includes("slogan") || lowerText.includes("archetype") ||
      lowerText.includes("lokasi") || lowerText.includes("call_to_player") ||
      lowerText.includes("nama grup") || lowerText.includes("nama group") ||
      lowerText.includes("nama website") || lowerText.includes("sapaan ke player")) {
    return "brandIdentity";
  }
  
  // Agent Persona patterns
  if (lowerText.includes("agent") || lowerText.includes("persona") ||
      lowerText.includes("nama agent") || lowerText.includes("gender") ||
      lowerText.includes("tone") || lowerText.includes("style") || lowerText.includes("speed")) {
    return "agentPersona";
  }
  
  // Communication Engine patterns
  if (lowerText.includes("boundary") || 
      lowerText.includes("empathy") || lowerText.includes("persuasion") ||
      lowerText.includes("humor") || lowerText.includes("emoji") ||
      lowerText.includes("batasan perilaku") || lowerText.includes("language") ||
      lowerText.includes("personalization") || lowerText.includes("personalisasi")) {
    return "communicationEngine";
  }
  
  // Operational SOP / Admin Contact patterns - MUST be before Crisis patterns
  if (lowerText.includes("admin_contact") || lowerText.includes("kontak admin") ||
      lowerText.includes("kontak") || lowerText.includes("whatsapp") || 
      lowerText.includes("telegram") || lowerText.includes("eskalasi") ||
      lowerText.includes("o.admin")) {
    return "operationalSOP";
  }
  
  // Safety & Crisis patterns
  if (lowerText.includes("complaints") || lowerText.includes("komplain") ||
      lowerText.includes("toxic") || lowerText.includes("crisis") ||
      lowerText.includes("krisis") || lowerText.includes("toksisitas") ||
      lowerText.includes("dictionary") || lowerText.includes("kata kasar") ||
      lowerText.includes("anti_hunter") || lowerText.includes("anti-hunter") ||
      lowerText.includes("bonus hunter") || lowerText.includes("o.crisis") ||
      lowerText.includes("o.risk")) {
    return "safetyCrisis";
  }
  
  // Interaction Library patterns
  if (lowerText.includes("greetings") || lowerText.includes("closings") ||
      lowerText.includes("empathy_phrases") || lowerText.includes("apologies") ||
      lowerText.includes("sapaan") || lowerText.includes("penutup") ||
      lowerText.includes("frasa empati") || lowerText.includes("template maaf")) {
    return "interactionLibrary";
  }
  
  // VIP Logic patterns
  if (lowerText.includes("vip") || lowerText.includes("svip") ||
      lowerText.includes("threshold")) {
    return "vipLogic";
  }
  
  return null;
};

// Score Ring Component
const ScoreRing = ({ score, hasCriticalErrors }: { score: number; hasCriticalErrors: boolean }) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(score);
    }, 100);
    return () => clearTimeout(timer);
  }, [score]);

  // Color based on critical errors first, then score
  const getScoreColor = () => {
    if (hasCriticalErrors) return "text-destructive";
    if (score >= 90) return "text-success";
    if (score >= 70) return "text-yellow-500";
    return "text-destructive";
  };

  const getStrokeColor = () => {
    if (hasCriticalErrors) return "#EF4444"; // red
    if (score >= 90) return "#22C55E"; // green
    if (score >= 70) return "#EAB308"; // yellow
    return "#EF4444"; // red
  };

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  return (
    <div className="relative w-28 h-28 flex-shrink-0">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={getStrokeColor()}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-2xl font-bold", getScoreColor())}>{score}</span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
    </div>
  );
};

// Block Completion Card
const BlockCard = ({ 
  blockKey, 
  result, 
  status,
  onEdit 
}: { 
  blockKey: string; 
  result: { 
    name: string;
    isComplete: boolean;
    completedFields: number;
    totalFields: number;
    percentage: number;
    missingFields: string[];
  };
  status: BlockStatus;
  onEdit?: () => void;
}) => {
  const percentage = result.percentage;

  const getStatusStyles = () => {
    switch (status) {
      case "complete":
        return { ring: "", progress: "bg-success", icon: CheckCircle2, iconColor: "text-success" };
      case "error":
        return { ring: "", progress: "bg-destructive", icon: XCircle, iconColor: "text-destructive" };
      case "warning":
      default:
        return { ring: "", progress: "bg-yellow-500", icon: AlertCircle, iconColor: "text-yellow-500" };
    }
  };

  const styles = getStatusStyles();
  const StatusIcon = styles.icon;

  return (
    <div 
      className={cn(
        "bg-muted rounded-lg p-3 flex flex-col gap-2 cursor-pointer transition-all hover:bg-muted/80",
        styles.ring
      )}
      onClick={onEdit}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground truncate">
          {blockDisplayNames[blockKey] || blockKey}
        </span>
        <StatusIcon className={cn("h-3.5 w-3.5 flex-shrink-0", styles.iconColor)} />
      </div>
      <div className="h-1.5 bg-background rounded-full overflow-hidden">
        <div 
          className={cn("h-full transition-all duration-500", styles.progress)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={cn(
        "text-xs",
        status === "complete" ? "text-success" : status === "error" ? "text-destructive" : "text-muted-foreground"
      )}>
        {percentage}%
      </span>
    </div>
  );
};

export function PersonaValidatorCard({ config, onEditSection }: PersonaValidatorCardProps) {
  const [validation, setValidation] = useState<PersonaValidationResult | null>(null);
  const [criticalOpen, setCriticalOpen] = useState(true); // Default OPEN for critical
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [missingOpen, setMissingOpen] = useState(false);

  useEffect(() => {
    const result = validatePersonaJSON(config);
    setValidation(result);
  }, [config]);

  if (!validation) return null;

  const { 
    score, 
    isReady, 
    canPublish, 
    criticalErrors, 
    warnings, 
    blockStatus, 
    blockResults, 
    missingFields, 
    summary 
  } = validation;

  const hasCriticalErrors = criticalErrors.length > 0;

  // Get readiness status - Critical errors override everything
  const getReadinessStatus = () => {
    if (hasCriticalErrors) {
      return { 
        label: "Not Ready", 
        icon: XCircle, 
        color: "text-destructive", 
        bg: "bg-destructive/10", 
        border: "border-destructive/30" 
      };
    }
    if (isReady) {
      return { 
        label: "Production Ready", 
        icon: CheckCircle2, 
        color: "text-success", 
        bg: "bg-transparent", 
        border: "border-2 border-success" 
      };
    }
    if (score >= 70) {
      return { 
        label: "Almost Ready", 
        icon: AlertTriangle, 
        color: "text-yellow-500", 
        bg: "bg-yellow-500/10", 
        border: "border-yellow-500/30" 
      };
    }
    return { 
      label: "Not Ready", 
      icon: XCircle, 
      color: "text-destructive", 
      bg: "bg-destructive/10", 
      border: "border-destructive/30" 
    };
  };

  const status = getReadinessStatus();
  const StatusIcon = status.icon;

  return (
    <Card className="bg-card border border-border rounded-xl p-6 mb-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="icon-circle">
            <Shield className="icon-circle-icon" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-button-hover">Persona Readiness</h3>
            <p className="text-sm text-muted-foreground">Validasi kelengkapan konfigurasi persona</p>
          </div>
        </div>
        {/* Status Badge - Top Right */}
        <Badge 
          variant="outline"
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-full",
            status.bg, status.color, status.border
          )}
        >
          <StatusIcon className="h-4 w-4 mr-2" />
          {status.label}
        </Badge>
      </div>

      {/* Score and Status Row */}
      <div className="flex items-center gap-6">
        <ScoreRing score={score} hasCriticalErrors={hasCriticalErrors} />
        
        <div className="flex-1" />
      </div>

      {/* Block Completion Grid */}
      <div>
        <p className="text-sm font-medium text-foreground mb-3">Block Completion</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(blockResults).map(([blockKey, result]) => (
            <BlockCard
              key={blockKey}
              blockKey={blockKey}
              result={result}
              status={blockStatus[blockKey] || "warning"}
              onEdit={onEditSection ? () => onEditSection(blockToSectionKey[blockKey] || blockKey) : undefined}
            />
          ))}
        </div>
      </div>

      {/* CRITICAL ERRORS Collapsible - RED, Default Open */}
      {criticalErrors.length > 0 && (
        <Collapsible open={criticalOpen} onOpenChange={setCriticalOpen} className="mb-3">
          <CollapsibleTrigger className="w-full">
            <div className={cn(
              "flex items-center justify-between p-3 bg-destructive/10 border border-destructive/30 hover:bg-destructive/20 transition-colors",
              criticalOpen ? "rounded-t-lg" : "rounded-lg"
            )}>
              <span className="text-sm font-medium text-foreground">Critical Errors</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                  {criticalErrors.length}
                </Badge>
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  criticalOpen && "rotate-180"
                )} />
              </div>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="bg-destructive/5 border border-t-0 border-destructive/30 rounded-b-lg p-4 space-y-1">
              {criticalErrors.map((error, idx) => {
                const friendlyMessage = getUIFriendlyError(error);
                const technicalCode = getTechnicalCode(error);
                const sectionKey = getSectionKeyFromText(friendlyMessage) || getSectionKeyFromText(error);
                
                return (
                  <div 
                    key={idx} 
                    className={cn(
                      "flex items-start gap-2 text-sm p-2 rounded-lg",
                      onEditSection && sectionKey && "cursor-pointer hover:bg-destructive/10 transition-colors"
                    )}
                    onClick={() => {
                      if (onEditSection && sectionKey) {
                        onEditSection(sectionKey);
                      }
                    }}
                  >
                    <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
                    <span className="text-foreground flex-1">{friendlyMessage}</span>
                    
                    {/* Technical Code Tooltip for Power Users */}
                    {technicalCode && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-destructive/50 flex-shrink-0 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs bg-card border border-border">
                            <p className="text-xs font-mono text-muted-foreground">{technicalCode}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    
                    {onEditSection && sectionKey && (
                      <Edit2 className="h-4 w-4 text-destructive flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* WARNINGS Collapsible - YELLOW */}
      {warnings.length > 0 && (
        <Collapsible open={warningsOpen} onOpenChange={setWarningsOpen} className="mb-3">
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/20 transition-colors">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium text-yellow-500">Warnings</span>
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                  {warnings.length}
                </Badge>
              </div>
              <ChevronDown className={cn(
                "h-4 w-4 text-yellow-500 transition-transform",
                warningsOpen && "rotate-180"
              )} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="bg-yellow-500/5 border border-t-0 border-yellow-500/20 rounded-b-lg p-4 space-y-1">
              {warnings.map((warning, idx) => {
                const friendlyMessage = getUIFriendlyError(warning);
                const technicalCode = getTechnicalCode(warning);
                const sectionKey = getSectionKeyFromText(friendlyMessage) || getSectionKeyFromText(warning);
                
                return (
                  <div 
                    key={idx} 
                    className={cn(
                      "flex items-start gap-2 text-sm p-2 rounded-lg",
                      onEditSection && sectionKey && "cursor-pointer hover:bg-yellow-500/10 transition-colors"
                    )}
                    onClick={() => {
                      if (onEditSection && sectionKey) {
                        onEditSection(sectionKey);
                      }
                    }}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span className="text-foreground flex-1">{friendlyMessage}</span>
                    
                    {/* Technical Code Tooltip for Power Users */}
                    {technicalCode && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-yellow-500/50 flex-shrink-0 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs bg-card border border-border">
                            <p className="text-xs font-mono text-muted-foreground">{technicalCode}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    
                    {onEditSection && sectionKey && (
                      <Edit2 className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Missing Fields Collapsible */}
      {missingFields.length > 0 && (
        <Collapsible open={missingOpen} onOpenChange={setMissingOpen}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Missing Fields</span>
                <Badge variant="outline" className="text-muted-foreground">
                  {missingFields.length}
                </Badge>
              </div>
              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                missingOpen && "rotate-180"
              )} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="bg-muted/50 border border-t-0 border-border rounded-b-lg p-4 space-y-1">
              {missingFields.map((field, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm p-1">
                  <span className="text-muted-foreground">•</span>
                  <span className="text-foreground">{field}</span>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

    </Card>
  );
}
