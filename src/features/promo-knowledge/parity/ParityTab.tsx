// @sunset-on-cutover
/**
 * Parity Tab
 * ──────────
 * Dev-only panel inside /promo-knowledge.
 * Compares three transformer outputs side-by-side for a single legacy form
 * draft, WITHOUT changing any storage or routing behavior.
 *
 *   - preview   : buildPKBPayload(form)              (Form Wizard JSON Preview)
 *   - persisted : toV31RowForParity(form)            (what storage would write)
 *   - pk06      : legacyFormToPK06Candidate(form)    (parity candidate)
 *
 * Source toggle:
 *   - Live Form Draft  = most-recently-updated localStorage draft
 *                        (proxy for "current in-memory form state" — the wizard
 *                         writes to this on every save).
 *   - Saved Draft      = pick any saved draft from the list.
 *
 * Same comparison engine for both modes (computeParity).
 */

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { localDraftKB } from "@/lib/promo-storage";
import { toV31RowForParity } from "@/lib/promo-storage";
import { buildPKBPayload } from "@/components/VOCDashboard/PromoFormWizard/types";
import type { PromoItem, PromoFormData } from "@/components/VOCDashboard/PromoFormWizard/types";
import { legacyFormToPK06Candidate } from "../adapters/legacyFormToPK06Candidate";
import { computeParity, type ParityRow, type ParityStatus } from "../adapters/parity-diff";

type SourceMode = "live" | "saved";

function statusTone(s: ParityStatus): string {
  switch (s) {
    case "match":
      return "bg-primary/10 text-primary border-primary/30";
    case "diff":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "preview_only":
    case "persisted_only":
    case "pk06_only":
      return "bg-warning/10 text-warning border-warning/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function fmtCell(v: unknown): string {
  if (v === undefined) return "—";
  if (v === null) return "null";
  if (typeof v === "string") return v === "" ? '""' : v;
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 80 ? s.slice(0, 77) + "…" : s;
  } catch {
    return String(v);
  }
}

export default function ParityTab() {
  const [mode, setMode] = useState<SourceMode>("live");
  const [drafts, setDrafts] = useState<PromoItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "diff_only">("all");

  const refresh = () => {
    const list = localDraftKB.getAll();
    setDrafts(list);
    if (mode === "saved" && list.length > 0 && !selectedId) {
      setSelectedId(list[0].id);
    }
  };

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("promo-storage-updated", handler);
    return () => window.removeEventListener("promo-storage-updated", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeDraft: PromoItem | null = useMemo(() => {
    if (drafts.length === 0) return null;
    if (mode === "live") return drafts[0]; // most-recent (getAll sorts desc)
    return drafts.find((d) => d.id === selectedId) ?? drafts[0];
  }, [mode, selectedId, drafts]);

  const parity = useMemo(() => {
    if (!activeDraft) return null;
    const form = activeDraft as unknown as PromoFormData;
    let preview: unknown = null;
    let persisted: unknown = null;
    let pk06: unknown = null;
    try {
      preview = buildPKBPayload(form);
    } catch (e) {
      preview = { __error: String(e) };
    }
    try {
      persisted = toV31RowForParity(form, activeDraft.id, "parity-tab");
    } catch (e) {
      persisted = { __error: String(e) };
    }
    try {
      pk06 = legacyFormToPK06Candidate(form as unknown as Record<string, unknown> & { id?: string });
    } catch (e) {
      pk06 = { __error: String(e) };
    }
    return computeParity(preview, persisted, pk06);
  }, [activeDraft]);

  const visibleRows: ParityRow[] = useMemo(() => {
    if (!parity) return [];
    if (filter === "diff_only") {
      return parity.rows.filter((r) => r.status !== "match");
    }
    return parity.rows;
  }, [parity, filter]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              Parity
              <Badge variant="outline" className="font-mono text-[10px]">
                dev-only
              </Badge>
              <Badge variant="outline" className="font-mono text-[10px]">
                @sunset-on-cutover
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Field-level diff: <span className="font-mono">preview</span> ·{" "}
              <span className="font-mono">persisted</span> ·{" "}
              <span className="font-mono">pk06</span>. Read-only. No routing change.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={refresh}>
            Refresh
          </Button>
        </div>

        {/* Source mode toggle */}
        <div className="flex flex-wrap items-center gap-2 pt-3">
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setMode("live")}
              className={`px-3 py-1 text-xs ${
                mode === "live"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted"
              }`}
            >
              Live Form Draft
            </button>
            <button
              type="button"
              onClick={() => setMode("saved")}
              className={`px-3 py-1 text-xs border-l border-border ${
                mode === "saved"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted"
              }`}
            >
              Saved Draft
            </button>
          </div>

          {mode === "saved" && drafts.length > 0 && (
            <select
              value={selectedId ?? drafts[0].id}
              onChange={(e) => setSelectedId(e.target.value)}
              className="text-xs px-2 py-1 rounded-md border border-border bg-background"
            >
              {drafts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.promo_name || "(untitled)"} — {d.id.slice(0, 8)}
                </option>
              ))}
            </select>
          )}

          <div className="ml-auto inline-flex rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-3 py-1 text-xs ${
                filter === "all" ? "bg-secondary" : "bg-background hover:bg-muted"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter("diff_only")}
              className={`px-3 py-1 text-xs border-l border-border ${
                filter === "diff_only" ? "bg-secondary" : "bg-background hover:bg-muted"
              }`}
            >
              Diff only
            </button>
          </div>
        </div>

        {activeDraft && (
          <p className="text-[11px] text-muted-foreground font-mono pt-2">
            source: {mode === "live" ? "live (most-recent local draft)" : "saved"} ·{" "}
            id: {activeDraft.id.slice(0, 12)}… · name: {activeDraft.promo_name || "(untitled)"}
          </p>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {!activeDraft ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            No local drafts found. Open the legacy Pseudo Extractor / Form Wizard
            and save a draft to populate this view.
          </div>
        ) : !parity ? null : (
          <>
            {/* Summary */}
            <div className="flex flex-wrap gap-2 mb-3 text-xs">
              <span className="px-2 py-0.5 rounded border border-border font-mono">
                total {parity.summary.total}
              </span>
              <span className="px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary font-mono">
                match {parity.summary.matches}
              </span>
              <span className="px-2 py-0.5 rounded border border-destructive/30 bg-destructive/10 text-destructive font-mono">
                diff {parity.summary.diffs}
              </span>
              <span className="px-2 py-0.5 rounded border border-warning/30 bg-warning/10 text-warning font-mono">
                preview-only {parity.summary.previewOnly}
              </span>
              <span className="px-2 py-0.5 rounded border border-warning/30 bg-warning/10 text-warning font-mono">
                persisted-only {parity.summary.persistedOnly}
              </span>
              <span className="px-2 py-0.5 rounded border border-warning/30 bg-warning/10 text-warning font-mono">
                pk06-only {parity.summary.pk06Only}
              </span>
            </div>

            {/* Field table */}
            <div className="border border-border rounded-md overflow-hidden">
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 sticky top-0">
                    <tr className="text-left">
                      <th className="px-2 py-1.5 font-mono w-[28%]">path</th>
                      <th className="px-2 py-1.5 font-mono w-[20%]">preview</th>
                      <th className="px-2 py-1.5 font-mono w-[20%]">persisted</th>
                      <th className="px-2 py-1.5 font-mono w-[20%]">pk06</th>
                      <th className="px-2 py-1.5 font-mono w-[12%]">status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">
                          No rows match the current filter.
                        </td>
                      </tr>
                    ) : (
                      visibleRows.map((r) => (
                        <tr key={r.path} className="border-t border-border align-top">
                          <td className="px-2 py-1 font-mono text-[11px] break-all">{r.path}</td>
                          <td className="px-2 py-1 font-mono text-[11px] break-all">
                            {fmtCell(r.preview)}
                          </td>
                          <td className="px-2 py-1 font-mono text-[11px] break-all">
                            {fmtCell(r.persisted)}
                          </td>
                          <td className="px-2 py-1 font-mono text-[11px] break-all">
                            {fmtCell(r.pk06)}
                          </td>
                          <td className="px-2 py-1">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-mono ${statusTone(
                                r.status,
                              )}`}
                            >
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground mt-3">
              Manual sign-off: review diffs above before promoting PK-06 to
              storage authority. See{" "}
              <span className="font-mono">
                src/features/promo-knowledge/adapters/SUNSET.md
              </span>
              .
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
