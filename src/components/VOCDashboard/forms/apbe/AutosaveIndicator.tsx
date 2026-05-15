/**
 * Autosave Indicator Component
 * Shows visual feedback for autosave status
 */

import { useState, useEffect } from "react";
import { CheckCircle2, Loader2, CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

interface AutosaveIndicatorProps {
  status: AutosaveStatus;
  className?: string;
}

export function AutosaveIndicator({ status, className }: AutosaveIndicatorProps) {
  const [displayStatus, setDisplayStatus] = useState<AutosaveStatus | "hidden">("hidden");
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout>;
    let hideTimer: ReturnType<typeof setTimeout>;

    if (status === "saving") {
      // Show "Menyimpan..." immediately
      setDisplayStatus("saving");
      setIsFadingOut(false);
    } else if (status === "saved") {
      // Show "Tersimpan" for 1.5s, then fade out
      setDisplayStatus("saved");
      setIsFadingOut(false);
      
      fadeTimer = setTimeout(() => {
        setIsFadingOut(true);
      }, 1500);
      
      hideTimer = setTimeout(() => {
        setDisplayStatus("hidden");
        setIsFadingOut(false);
      }, 1800); // 1.5s display + 0.3s fade
    } else if (status === "error") {
      setDisplayStatus("error");
      setIsFadingOut(false);
    } else if (status === "idle" && displayStatus !== "saving" && displayStatus !== "saved") {
      // Only hide if not in transition
      setDisplayStatus("hidden");
    }

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [status]);

  // Don't render if hidden
  if (displayStatus === "hidden") return null;

  return (
    <div 
      className={cn(
        "flex items-center gap-1.5 text-xs transition-opacity duration-300",
        isFadingOut && "opacity-0",
        className
      )}
    >
      {displayStatus === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Menyimpan...</span>
        </>
      )}
      {displayStatus === "saved" && (
        <>
          <CheckCircle2 className="h-3 w-3 text-success" />
          <span className="text-success">Tersimpan</span>
        </>
      )}
      {displayStatus === "error" && (
        <>
          <CloudOff className="h-3 w-3 text-destructive" />
          <span className="text-destructive">Gagal menyimpan</span>
        </>
      )}
    </div>
  );
}
