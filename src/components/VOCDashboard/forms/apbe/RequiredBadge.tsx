/**
 * Required/Optional Badge Component
 * Shows visual indicator for field requirement status
 */

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RequiredBadgeProps {
  required?: boolean;
  className?: string;
}

export function RequiredBadge({ required = true, className }: RequiredBadgeProps) {
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "text-[10px] font-medium px-1.5 py-0 h-4 ml-1.5",
        required 
          ? "bg-destructive/10 text-destructive border-destructive/30" 
          : "bg-muted text-muted-foreground border-muted-foreground/30",
        className
      )}
    >
      {required ? "Wajib" : "Opsional"}
    </Badge>
  );
}

/**
 * Form Label with Required Indicator
 */
interface FormLabelWithBadgeProps {
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}

export function FormLabelWithBadge({ children, required, className }: FormLabelWithBadgeProps) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      {children}
      {required !== undefined && <RequiredBadge required={required} />}
    </span>
  );
}
