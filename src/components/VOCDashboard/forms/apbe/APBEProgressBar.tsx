import { cn } from "@/lib/utils";
import { 
  Building2,
  User,
  MessageSquare,
  BookOpen,
  Settings,
  Shield,
  Crown,
  ClipboardCheck,
  LucideIcon
} from "lucide-react";

const STEPS: { id: number; key: string; title: string; icon: LucideIcon }[] = [
  { id: 1, key: "brandIdentity", title: "Brand Identity", icon: Building2 },
  { id: 2, key: "agentPersona", title: "Agent Persona", icon: User },
  { id: 3, key: "communicationEngine", title: "Communication", icon: MessageSquare },
  { id: 4, key: "interactionLibrary", title: "Interaction", icon: BookOpen },
  { id: 5, key: "operationalSOP", title: "Operational", icon: Settings },
  { id: 6, key: "safetyCrisis", title: "Safety", icon: Shield },
  { id: 7, key: "vipLogic", title: "VIP Logic", icon: Crown },
  { id: 8, key: "summaryReview", title: "Summary", icon: ClipboardCheck },
];

interface APBEProgressBarProps {
  currentStep: number;
  onStepClick: (step: number) => void;
}

export const APBEProgressBar = ({ currentStep, onStepClick }: APBEProgressBarProps) => {
  const totalSteps = 8;

  const getStepState = (stepId: number) => {
    if (stepId < currentStep) return "completed";
    if (stepId === currentStep) return "current";
    return "pending";
  };

  // Calculate progress line width - ends at center of current step icon
  const getProgressWidth = () => {
    if (currentStep === 1) return '0%';
    // Total span = 87.5% (from center icon 1 at 6.25% to center icon 8 at 93.75%)
    // 7 segments between 8 steps, each segment = 87.5% / 7 = 12.5%
    const totalSpan = 87.5;
    const segmentWidth = totalSpan / (totalSteps - 1); // 12.5% per segment
    return `${(currentStep - 1) * segmentWidth}%`;
  };

  return (
    <div className="page-wrapper">
      <div className="bg-card border border-border rounded-xl p-6 pt-8 mb-6">
        <div className="relative pt-2">
          {/* Connecting Line Background - spans from center of first icon to center of last icon */}
          <div 
            className="absolute top-[28px] h-1 bg-muted rounded-full"
            style={{ 
              left: 'calc(100% / 16)',   // center of first column (6.25%)
              right: 'calc(100% / 16)'   // center of last column (6.25%)
            }}
          />
          
          {/* Connecting Line Progress - gold line showing completion */}
          <div 
            className="absolute top-[28px] h-1 bg-button-hover rounded-full transition-all duration-300"
            style={{ 
              left: 'calc(100% / 16)',
              width: getProgressWidth()
            }}
          />

          {/* Steps */}
          <div className="relative grid grid-cols-8 gap-2">
            {STEPS.map((step) => {
              const state = getStepState(step.id);
              const Icon = step.icon;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onStepClick(step.id)}
                  className="flex flex-col items-center cursor-pointer group"
                >
                  {/* Icon Circle - ALWAYS uses original icon, never replaced */}
                  <div
                    className={cn(
                      "relative z-10 h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all",
                      state === "completed" && "bg-button-hover border-button-hover",
                      state === "current" && "bg-background border-button-hover ring-4 ring-button-hover/20",
                      state === "pending" && "bg-background border-muted group-hover:border-muted-foreground"
                    )}
                  >
                    {/* Icon ALWAYS stays the same - only style changes */}
                    <Icon
                      className={cn(
                        "h-5 w-5 transition-colors",
                        state === "completed" && "text-button-hover-foreground",
                        state === "current" && "text-button-hover",
                        state === "pending" && "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                  </div>

                  {/* Title */}
                  <span
                    className={cn(
                      "text-xs mt-6 text-center font-medium transition-colors",
                      state === "completed" && "text-foreground",
                      state === "current" && "text-button-hover",
                      state === "pending" && "text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    {step.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
