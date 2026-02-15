import { Search } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import type { DebugBreakdown } from "@/lib/livechat-engine";

interface DebugPanelProps {
  debug: DebugBreakdown;
}

export function DebugPanel({ debug }: DebugPanelProps) {
  const isClient = debug.source === 'client';

  return (
    <Collapsible className="mt-2">
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
        <Search className="h-3 w-3" />
        <span className="font-medium">🔎 Debug</span>
        <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${
          isClient
            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
        }`}>
          {isClient ? 'Client trace' : 'LLM trace'}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 p-3 bg-muted/30 border border-border rounded-lg font-mono text-xs space-y-3">
          {/* 0. KB Health Status (from engine, not UI-computed) */}
          {debug.kbHealth && (
            <div className="flex items-start gap-2">
              <span className="text-button-hover font-semibold">KB Status</span>
              {debug.kbHealth.status === 'READY' && (
                <Badge variant="success" size="xs">READY</Badge>
              )}
              {debug.kbHealth.status === 'NOT_READY' && (
                <div className="flex flex-col gap-0.5">
                  <Badge variant="warning" size="xs">NOT_READY</Badge>
                  {debug.kbHealth.missingKeys.length > 0 && (
                    <span className="text-foreground/70 pl-1">
                      Missing: {debug.kbHealth.missingKeys.join(', ')}
                    </span>
                  )}
                </div>
              )}
              {debug.kbHealth.status === 'UNKNOWN' && (
                <Badge variant="secondary" size="xs">UNKNOWN (archetype tidak terdeteksi)</Badge>
              )}
            </div>
          )}

          {/* 1. User Intent */}
          {debug.userIntent && (
            <div>
              <span className="text-button-hover font-semibold">User Intent</span>
              <p className="text-foreground/80 mt-0.5">{debug.userIntent}</p>
            </div>
          )}

          {/* 2. JSON Data Referenced */}
          {debug.jsonFieldsReferenced.length > 0 && (
            <div>
              <span className="text-button-hover font-semibold">JSON Data Referenced</span>
              <div className="mt-0.5 space-y-0.5">
                {debug.jsonFieldsReferenced.map((field, i) => (
                  <p key={i} className="text-foreground/80 pl-2">{field}</p>
                ))}
              </div>
            </div>
          )}

          {/* 3. Analysis */}
          {debug.analysis && (
            <div>
              <span className="text-button-hover font-semibold">Analysis</span>
              <p className="text-foreground/80 mt-0.5">{debug.analysis}</p>
            </div>
          )}

          {/* 4. Retrieval Status */}
          {debug.retrievalStatus && (
            <div>
              <span className="text-button-hover font-semibold">Retrieval Status</span>
              <span className="ml-2 text-foreground/80">{debug.retrievalStatus}</span>
            </div>
          )}

          {/* 5. Conflict Check */}
          {debug.conflictCheck && (
            <div>
              <span className="text-button-hover font-semibold">Conflict Check</span>
              <span className="ml-2 text-foreground/80">{debug.conflictCheck}</span>
            </div>
          )}

          {/* 6. Confidence */}
          {debug.confidence && (
            <div>
              <span className="text-button-hover font-semibold">Confidence</span>
              <span className="ml-2 text-foreground/80">{debug.confidence}</span>
            </div>
          )}

          {/* 7. Final Validation */}
          {debug.finalValidation && (
            <div>
              <span className="text-button-hover font-semibold">Final Validation</span>
              <p className="text-foreground/80 mt-0.5">{debug.finalValidation}</p>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
