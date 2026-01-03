/**
 * InheritedBadge Component
 * 
 * Visual indicator showing when a field value is inherited or overridden.
 * 
 * GUARDRAILS:
 * - Display-only component (no state mutation)
 * - Shows source of value via tooltip
 * - Subtle styling to not overwhelm UI
 */

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowDown, Settings, Globe, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ValueSource } from "@/hooks/use-promo-resolver";

interface InheritedBadgeProps {
  /** Source of the value */
  source: ValueSource;
  /** Human-readable source label for tooltip */
  sourceLabel: string;
  /** Optional: show only when inherited (not base) */
  showOnlyWhenInherited?: boolean;
  /** Is this value inherited from another context? */
  isInherited: boolean;
  /** Optional custom className */
  className?: string;
}

/**
 * Get icon for value source
 */
function getSourceIcon(source: ValueSource) {
  switch (source) {
    case 'fixed':
      return <Settings className="h-3 w-3" />;
    case 'global':
      return <Globe className="h-3 w-3" />;
    case 'subcategory':
      return <Layers className="h-3 w-3" />;
    case 'legacy':
      return <ArrowDown className="h-3 w-3" />;
    default:
      return null;
  }
}

/**
 * Get badge variant based on source
 */
function getBadgeStyle(source: ValueSource): string {
  switch (source) {
    case 'fixed':
      return 'bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400';
    case 'global':
      return 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400';
    case 'subcategory':
      return 'bg-purple-500/15 text-purple-600 border-purple-500/30 dark:text-purple-400';
    case 'legacy':
      return 'bg-orange-500/15 text-orange-600 border-orange-500/30 dark:text-orange-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

/**
 * Get short label for badge
 */
function getShortLabel(source: ValueSource): string {
  switch (source) {
    case 'fixed':
      return 'Fixed';
    case 'global':
      return 'Global';
    case 'subcategory':
      return 'Sub';
    case 'legacy':
      return 'Legacy';
    default:
      return '';
  }
}

export function InheritedBadge({
  source,
  sourceLabel,
  showOnlyWhenInherited = true,
  isInherited,
  className,
}: InheritedBadgeProps) {
  // Don't show if showOnlyWhenInherited is true and value is not inherited
  if (showOnlyWhenInherited && !isInherited) {
    return null;
  }
  
  const icon = getSourceIcon(source);
  const style = getBadgeStyle(source);
  const shortLabel = getShortLabel(source);
  
  // Don't show badge for base or default sources
  if (source === 'base' || source === 'default') {
    return null;
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0 h-4 gap-0.5 font-medium cursor-help",
              style,
              className
            )}
          >
            {icon}
            <span>{shortLabel}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>{sourceLabel}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Inline indicator for when effective ≠ base
 * Shows a subtle icon with tooltip explaining the inheritance
 */
interface InheritedIndicatorProps {
  source: ValueSource;
  sourceLabel: string;
  isInherited: boolean;
  className?: string;
}

export function InheritedIndicator({
  source,
  sourceLabel,
  isInherited,
  className,
}: InheritedIndicatorProps) {
  if (!isInherited || source === 'base' || source === 'default') {
    return null;
  }
  
  const icon = getSourceIcon(source);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center text-muted-foreground hover:text-foreground cursor-help ml-1",
              className
            )}
          >
            {icon}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>{sourceLabel}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
