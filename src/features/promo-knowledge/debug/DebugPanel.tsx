/**
 * DEV-MODE OBSERVABILITY PANEL
 * Displays:
 *   - governance_version / domain_version / domain (D-6)
 *   - lifecycle_state (readiness_engine.state_block.state)
 *   - extractor_contract_version
 *   - per-field ai_confidence (sorted lowest first)
 *   - contradiction_flags[] / ambiguity_flags[]
 *   - validation summary (errors / warnings / info)
 *
 * Hidden in production unless IS_DEV_MODE=true.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { IS_DEV_MODE } from "@/lib/config/dev-mode";
import { EXTRACTOR_CONTRACT_VERSION } from "../extractor/contract";
import type { PromoKnowledgeRecord } from "../schema/pk-06.0";
import type { ValidationReport } from "../validator";

interface Props {
  record: PromoKnowledgeRecord;
  validation: ValidationReport;
}

export function DebugPanel({ record, validation }: Props) {
  if (!IS_DEV_MODE) return null;

  const confEntries = Object.entries(record.ai_confidence).sort(([, a], [, b]) => a - b);
  const obs = record.readiness_engine.observability_block;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          Observability
          <Badge variant="outline" className="text-[10px] font-mono">dev-only</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* Governance */}
        <section>
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Governance (D-6)</h4>
          <dl className="grid grid-cols-[140px_1fr] gap-y-1 text-xs font-mono">
            <dt className="text-muted-foreground">governance_version</dt>
            <dd>{record.governance_version}</dd>
            <dt className="text-muted-foreground">domain_version</dt>
            <dd>{record.domain_version}</dd>
            <dt className="text-muted-foreground">domain</dt>
            <dd>{record.domain}</dd>
            <dt className="text-muted-foreground">_schema.version</dt>
            <dd className="text-muted-foreground">{record._schema.version} <span className="text-[10px]">(spec-historical alias)</span></dd>
            <dt className="text-muted-foreground">extractor_contract</dt>
            <dd>{EXTRACTOR_CONTRACT_VERSION}</dd>
          </dl>
        </section>

        <Separator />

        {/* Lifecycle */}
        <section>
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Lifecycle</h4>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono">{record.readiness_engine.state_block.state}</Badge>
            <span className="text-xs text-muted-foreground">
              changed_at: {record.readiness_engine.state_block.state_changed_at || "—"}
            </span>
          </div>
        </section>

        <Separator />

        {/* Validation summary */}
        <section>
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Validation</h4>
          <div className="flex gap-2 mb-2">
            <Badge className="bg-destructive/15 text-destructive border-destructive/30" variant="outline">
              {validation.errorCount} errors
            </Badge>
            <Badge className="bg-warning/15 text-warning border-warning/30" variant="outline">
              {validation.warningCount} warnings
            </Badge>
            <Badge variant="outline">{validation.infoCount} info</Badge>
          </div>
          {validation.issues.length > 0 && (
            <ScrollArea className="h-32 rounded-md border border-border p-2">
              <ul className="space-y-1 text-xs font-mono">
                {validation.issues.map((i, idx) => (
                  <li key={idx}>
                    <span
                      className={
                        i.severity === "error"
                          ? "text-destructive"
                          : i.severity === "warning"
                            ? "text-warning"
                            : "text-muted-foreground"
                      }
                    >
                      [{i.severity}] {i.code}
                    </span>{" "}
                    <span className="text-muted-foreground">@</span> {i.path}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </section>

        <Separator />

        {/* Observability flags */}
        <section>
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Observability flags</h4>
          <dl className="grid grid-cols-[160px_1fr] gap-y-1 text-xs">
            <dt className="text-muted-foreground">contradiction_flags</dt>
            <dd>{obs.contradiction_flags.length === 0 ? <span className="text-muted-foreground">[]</span> : obs.contradiction_flags.join(", ")}</dd>
            <dt className="text-muted-foreground">ambiguity_flags</dt>
            <dd>{obs.ambiguity_flags.length === 0 ? <span className="text-muted-foreground">[]</span> : obs.ambiguity_flags.join(", ")}</dd>
            <dt className="text-muted-foreground">review_required</dt>
            <dd>{String(obs.review_required)}</dd>
          </dl>
        </section>

        <Separator />

        {/* AI Confidence */}
        <section>
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            AI Confidence ({confEntries.length} fields)
          </h4>
          {confEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground">No per-field confidence captured.</p>
          ) : (
            <ScrollArea className="h-40 rounded-md border border-border p-2">
              <ul className="space-y-1 text-xs font-mono">
                {confEntries.map(([path, score]) => (
                  <li key={path} className="flex items-center justify-between gap-3">
                    <span className="truncate">{path}</span>
                    <span
                      className={
                        score >= 0.85
                          ? "text-primary"
                          : score >= 0.6
                            ? "text-foreground"
                            : "text-destructive"
                      }
                    >
                      {Math.round(score * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
