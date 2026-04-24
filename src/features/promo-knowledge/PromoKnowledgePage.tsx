/**
 * /promo-knowledge — Gate 1 first vertical slice workspace.
 *
 * Demo loop:
 *   1. Load sample → fresh inert record + fixture data for claim_engine
 *   2. Edit in form → live validation
 *   3. Save Draft → localStorage with D-6 governance re-injected
 *   4. Reload → list shows record, click Open → form rehydrates
 *   5. Mark Reviewed → lifecycle state advances
 *   6. Debug panel shows everything end-to-end
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ClaimEngineForm } from "@/features/promo-knowledge/form/ClaimEngineForm";
import { DebugPanel } from "@/features/promo-knowledge/debug/DebugPanel";
import { ParityTab } from "@/features/promo-knowledge/parity";
import {
  createDraftRecord,
  saveRecord,
  loadRecord,
  listRecords,
  deleteRecord,
  STORAGE_LIMITS,
  type PkIndexEntry,
} from "@/features/promo-knowledge/storage/local-storage";
import { validatePromoKnowledge } from "@/features/promo-knowledge/validator";
import { buildSamplePromo } from "@/features/promo-knowledge/fixtures/sample-claim-engine";
import { PK_REGISTRY } from "@/features/promo-knowledge/registry";
import type { PromoKnowledgeRecord, LifecycleState } from "@/features/promo-knowledge/schema/pk-06.0";

const NEXT_STATE: Partial<Record<LifecycleState, LifecycleState>> = {
  ai_draft: "reviewed",
  reviewed: "finalized",
  finalized: "published",
  published: "archived",
};

export default function PromoKnowledgePage() {
  const [record, setRecord] = useState<PromoKnowledgeRecord>(() => createDraftRecord());
  const [list, setList] = useState<PkIndexEntry[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refreshList = useCallback(() => setList(listRecords()), []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  // Native SEO (no helmet dependency)
  useEffect(() => {
    document.title = "Promo Knowledge — Gate 1 Slice";
    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    setMeta(
      "description",
      "PK-06.0 first vertical slice workspace. Schema-driven form, live validation, observability.",
    );
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", `${window.location.origin}/promo-knowledge`);
  }, []);

  const validation = useMemo(() => validatePromoKnowledge(record), [record]);

  const handleLoadSample = () => {
    setRecord(buildSamplePromo());
  };

  const handleNew = () => {
    setRecord(createDraftRecord());
  };

  const handleSave = () => {
    try {
      const saved = saveRecord(record);
      setRecord(saved);
      refreshList();
      setSaveError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(`Save failed: ${msg}`);
    }
  };

  const handleOpen = (id: string) => {
    const r = loadRecord(id);
    if (r) setRecord(r);
  };

  const handleDelete = (id: string) => {
    deleteRecord(id);
    refreshList();
    if (record.record_id === id) {
      setRecord(createDraftRecord());
    }
  };

  const handleAdvanceState = () => {
    const cur = record.readiness_engine.state_block.state;
    const next = NEXT_STATE[cur];
    if (!next) return;
    if (next !== "ai_draft" && !validation.ok) {
      alert(`Cannot advance to "${next}" — fix ${validation.errorCount} error(s) first.`);
      return;
    }
    setRecord({
      ...record,
      readiness_engine: {
        ...record.readiness_engine,
        state_block: {
          state: next,
          state_changed_at: new Date().toISOString(),
          state_changed_by: "human:local",
        },
      },
    });
  };

  const stateColor = (s: string) =>
    s === "ai_draft"
      ? "bg-secondary text-secondary-foreground"
      : s === "reviewed"
        ? "bg-warning/15 text-warning border border-warning/30"
        : s === "finalized" || s === "published"
          ? "bg-primary/15 text-primary border border-primary/30"
          : "bg-muted text-muted-foreground";

  return (
    <>
      <main className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border bg-card">
          <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Promo Knowledge</h1>
              <p className="text-xs text-muted-foreground font-mono">
                {PK_REGISTRY.governance_version} · {PK_REGISTRY.domain_version} · {PK_REGISTRY.domain}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px]">Gate 1 first vertical slice</Badge>
              <Badge variant="outline" className="font-mono text-[10px]">claim_engine</Badge>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-6 grid gap-6 lg:grid-cols-[260px_1fr_340px]">
          {/* Sidebar — record list */}
          <aside className="space-y-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Records</CardTitle>
                <CardDescription className="text-xs">
                  localStorage, max {STORAGE_LIMITS.MAX_RECORDS} (oldest evicted)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-col gap-2">
                  <Button size="sm" onClick={handleNew}>+ New Draft</Button>
                  <Button size="sm" variant="outline" onClick={handleLoadSample}>Load Sample</Button>
                </div>
                <Separator />
                {list.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No saved records.</p>
                ) : (
                  <ul className="space-y-1.5 max-h-[420px] overflow-auto">
                    {list.map((e) => (
                      <li
                        key={e.record_id}
                        className={`group rounded-md border border-border p-2 text-xs cursor-pointer hover:bg-muted/50 ${
                          e.record_id === record.record_id ? "bg-muted" : ""
                        }`}
                        onClick={() => handleOpen(e.record_id)}
                      >
                        <div className="font-medium truncate">{e.promo_name || "(untitled)"}</div>
                        <div className="flex items-center justify-between mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${stateColor(e.state)}`}>{e.state}</span>
                          <button
                            className="opacity-0 group-hover:opacity-100 text-destructive text-[10px]"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              handleDelete(e.record_id);
                            }}
                          >
                            delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </aside>

          {/* Main — form */}
          <section className="space-y-4">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">claim_engine</CardTitle>
                  <CardDescription className="text-xs font-mono">
                    record_id: {record.record_id.slice(0, 12)}…
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-1 rounded font-mono ${stateColor(record.readiness_engine.state_block.state)}`}>
                    {record.readiness_engine.state_block.state}
                  </span>
                  <Button size="sm" variant="outline" onClick={handleAdvanceState} disabled={!NEXT_STATE[record.readiness_engine.state_block.state]}>
                    advance →
                  </Button>
                  <Button size="sm" onClick={handleSave}>Save Draft</Button>
                </div>
              </CardHeader>
            </Card>

            {saveError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              >
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1">{saveError}</div>
                <button
                  onClick={() => setSaveError(null)}
                  className="text-destructive/70 hover:text-destructive"
                  aria-label="Dismiss save error"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {validation.issues.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    Validation
                    <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                      {validation.errorCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-destructive">
                          <AlertCircle className="h-3 w-3" /> {validation.errorCount} error{validation.errorCount > 1 ? "s" : ""}
                        </span>
                      )}
                      {validation.warningCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-warning">
                          <AlertTriangle className="h-3 w-3" /> {validation.warningCount} warning{validation.warningCount > 1 ? "s" : ""}
                        </span>
                      )}
                      {validation.infoCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Info className="h-3 w-3" /> {validation.infoCount} info
                        </span>
                      )}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-1.5 max-h-48 overflow-auto">
                    {validation.issues.map((iss, idx) => {
                      const color =
                        iss.severity === "error"
                          ? "text-destructive"
                          : iss.severity === "warning"
                            ? "text-warning"
                            : "text-muted-foreground";
                      const Icon = iss.severity === "error" ? AlertCircle : iss.severity === "warning" ? AlertTriangle : Info;
                      return (
                        <li key={idx} className="flex items-start gap-2 text-xs">
                          <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${color}`} />
                          <div className="flex-1 min-w-0">
                            <div className={`font-medium ${color}`}>{iss.message}</div>
                            <div className="font-mono text-[10px] text-muted-foreground truncate">
                              {iss.path} · {iss.code}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}

            <ClaimEngineForm
              value={record.claim_engine}
              onChange={(next) => setRecord({ ...record, claim_engine: next })}
              validation={validation}
              aiConfidence={record.ai_confidence}
            />
          </section>

          {/* Right — debug panel */}
          <aside>
            <DebugPanel record={record} validation={validation} />
          </aside>
        </div>
      </main>
    </>
  );
}
