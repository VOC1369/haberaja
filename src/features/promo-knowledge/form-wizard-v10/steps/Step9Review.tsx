/**
 * Phase 2C — Step 9 Review & Final Gate.
 *
 * READ-ONLY review layer. Source of truth = PkV10Record loaded via
 * `loadRecord(recordId)` from pk:rec. NO mappedPreview / extractedPromo /
 * PromoFormData / V.09 anywhere.
 *
 * Capabilities:
 *  - Identity / Validation / Warnings / Variants / Audit summary
 *  - projection_engine labelled derived-only
 *  - Final Readiness Gate (UI-only — no Supabase, no publish)
 *  - Copy Final JSON V.10.1 = full canonical PkV10Record
 *
 * NEVER mutates pkRecord. Display-only derivations stay in component scope.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Section, TextAreaField, MultiTagField } from "../primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  History,
  Layers,
  RefreshCw,
  UploadCloud,
  Loader2,
  CloudOff,
} from "lucide-react";
import { toast } from "@/lib/notify";
import { loadRecord } from "../../storage/local-storage";
import { loadFinalPkRecordForCopy } from "../copy-final-json";
import { buildPublishBlockerDisplay } from "../publish-blocker-display";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import {
  canPublish,
  publishRecord,
  unpublishRecord,
} from "../../storage/supabase-publish";
import { supabase } from "@/integrations/supabase/client";
import type {
  PkV10Record,
  PkV10Subcategory,
} from "../../schema/pk-v10";
import type { StepProps } from "./_types";

export interface Step9PublishBridge {
  canPublish: boolean;
  publishing: boolean;
  published: boolean | null;
  hasRecord: boolean;
  handlePublish: () => void;
}

interface Step9Props extends StepProps {
  recordId?: string;
  onPublishBridge?: (bridge: Step9PublishBridge) => void;
}

interface OverrideEntry {
  field_path?: string;
  previous_value?: unknown;
  new_value?: unknown;
  previous_field_status?: string | null;
  previous_ai_confidence?: number | null;
  overridden_by?: string;
  timestamp?: string;
  source?: string;
}

const formatVal = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v === "" ? "—" : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

export function Step9Review({ state, update, recordId, onPublishBridge }: Step9Props) {
  const tm = state.terms_engine;

  // ── Live read from pk:rec (Phase 2C — single source of truth) ──────────
  const [liveRec, setLiveRec] = useState<PkV10Record | null>(() =>
    recordId ? loadRecord(recordId) : null,
  );

  const refreshLive = () => {
    if (!recordId) return;
    setLiveRec(loadRecord(recordId));
  };

  useEffect(() => {
    refreshLive();
    if (typeof window === "undefined") return;
    const handler = () => refreshLive();
    window.addEventListener("pk-v10-storage-updated", handler);
    return () => window.removeEventListener("pk-v10-storage-updated", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  // ── Phase 3C — Publish state ───────────────────────────────────────────
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [publishedFlag, setPublishedFlag] = useState<boolean | null>(null);
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const refreshPublishStatus = async () => {
    if (!recordId) return;
    const { data, error } = await supabase
      .from("promo_knowledge")
      .select("is_published, published_at")
      .eq("record_id", recordId)
      .maybeSingle();
    if (error) return;
    if (data) {
      setPublishedFlag(Boolean(data.is_published));
      setLastPublishedAt((data.published_at as string | null) ?? null);
    } else {
      setPublishedFlag(false);
      setLastPublishedAt(null);
    }
  };

  useEffect(() => {
    refreshPublishStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  const publishGate = useMemo(
    () =>
      liveRec
        ? canPublish(liveRec)
        : { ok: false, reasons: ["no record loaded"] as string[] },
    [liveRec],
  );

  const blockerDisplay = useMemo(
    () => buildPublishBlockerDisplay(liveRec, publishGate),
    [liveRec, publishGate],
  );

  const handlePublish = async () => {
    if (!liveRec) return;
    const gate = canPublish(liveRec);
    if (!gate.ok) {
      const display = buildPublishBlockerDisplay(liveRec, gate);
      const msg = display.shortSummary;
      setPublishError(msg);
      toast.error("Promo belum bisa dipublish", {
        description: "Selesaikan review item di Admin Verify terlebih dahulu.",
      });
      return;
    }
    setPublishing(true);
    setPublishError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const publishedBy = userData?.user?.email ?? userData?.user?.id ?? undefined;
      const result = await publishRecord(liveRec, publishedBy);
      if (!result.ok) {
        const msg = result.error ?? (result.reasons ?? []).join("; ") ?? "publish failed";
        setPublishError(msg);
        toast.error("Publish gagal", { description: msg });
      } else {
        toast.success("Record dipublish ke Supabase");
        await refreshPublishStatus();
        refreshLive();
      }
    } catch (e) {
      const msg = (e as Error).message;
      setPublishError(msg);
      toast.error("Publish error", { description: msg });
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!recordId) return;
    setUnpublishing(true);
    setPublishError(null);
    try {
      const result = await unpublishRecord(recordId);
      if (!result.ok) {
        const msg = result.error ?? "unpublish failed";
        setPublishError(msg);
        toast.error("Unpublish gagal", { description: msg });
      } else {
        toast.success("Record di-unpublish");
        await refreshPublishStatus();
      }
    } catch (e) {
      const msg = (e as Error).message;
      setPublishError(msg);
      toast.error("Unpublish error", { description: msg });
    } finally {
      setUnpublishing(false);
    }
  };

  // Push publish bridge to parent (FormWizardV10) so the bottom bar can
  // render the primary publish action without duplicating logic.
  useEffect(() => {
    if (!onPublishBridge) return;
    onPublishBridge({
      canPublish: publishGate.ok,
      publishing,
      published: publishedFlag,
      hasRecord: !!liveRec,
      handlePublish,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishGate.ok, publishing, publishedFlag, liveRec]);


  const handleCopyFinal = async () => {
    if (!recordId) {
      toast.error("Tidak ada recordId", {
        description: "Buka wizard via draft V.10.1 yang sudah tersimpan.",
      });
      return;
    }
    const rec = loadFinalPkRecordForCopy(recordId);
    if (!rec) {
      toast.error("Record tidak ditemukan di pk:rec");
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(rec, null, 2));
      toast.success("Final JSON V.10.1 disalin");
    } catch (e) {
      toast.error("Gagal menyalin JSON", { description: (e as Error).message });
    }
  };

  // ── Display-only derivations (NEVER written back) ──────────────────────
  const summary = useMemo(() => {
    if (!liveRec) return null;
    const id = liveRec.identity_engine ?? ({} as PkV10Record["identity_engine"]);
    const readiness = liveRec.readiness_engine ?? ({} as PkV10Record["readiness_engine"]);
    const risk = liveRec.risk_engine ?? ({} as PkV10Record["risk_engine"]);
    const variant = liveRec.variant_engine ?? ({} as PkV10Record["variant_engine"]);
    const subcategories: PkV10Subcategory[] =
      Array.isArray(variant.items_block?.subcategories)
        ? variant.items_block!.subcategories
        : [];
    const log: OverrideEntry[] = Array.isArray(
      (liveRec as unknown as { _human_override_log?: unknown[] })._human_override_log,
    )
      ? ((liveRec as unknown as { _human_override_log: OverrideEntry[] })._human_override_log)
      : [];

    const warnings = readiness.validation_block?.warnings ?? [];
    const ambiguity = readiness.observability_block?.ambiguity_flags ?? [];
    const contradictions = readiness.observability_block?.contradiction_flags ?? [];
    const reviewRequired = readiness.observability_block?.review_required === true;
    const status = readiness.validation_block?.status ?? "";
    const readyToCommit = readiness.commit_block?.ready_to_commit === true;
    const structurallyComplete =
      readiness.validation_block?.is_structurally_complete === true;

    const blockers: string[] = [];
    if (status === "needs_review") blockers.push("validation_block.status = needs_review");
    if (reviewRequired) blockers.push("observability_block.review_required = true");
    if (!readyToCommit) blockers.push("commit_block.ready_to_commit = false");
    if (contradictions.length > 0)
      blockers.push(`${contradictions.length} contradiction flag(s)`);

    const ready = blockers.length === 0;

    return {
      id,
      readiness,
      risk,
      variant,
      subcategories,
      log,
      warnings,
      ambiguity,
      contradictions,
      reviewRequired,
      status,
      readyToCommit,
      structurallyComplete,
      blockers,
      ready,
    };
  }, [liveRec]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Terms editor — last editable inputs */}
      <div ref={skEditorRef}>
        <Section title="Syarat & Ketentuan">
          {blockerDisplay.actions.some((a) => a.id === "sk_game_type_conflict") && (
            <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-foreground">
              <div className="font-semibold text-destructive mb-1 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Periksa kalimat tentang bonus khusus SLOT
              </div>
              <p className="text-muted-foreground">
                Kalimat ini konflik dengan varian Casino / Sports / Slot pada tabel paket.
                Perbaiki S&K agar konsisten, atau koreksi tabel varian jika S&K yang benar.
              </p>
            </div>
          )}
          <TextAreaField label="Syarat & Ketentuan"
            path="terms_engine.conditions_block.terms_conditions"
            rows={6}
            value={tm.conditions_block.terms_conditions}
            onChange={(v) => update("terms_engine", { conditions_block: { terms_conditions: v } })} />
          <MultiTagField label="Persyaratan Khusus"
            path="terms_engine.requirements_block.special_requirements"
            value={tm.requirements_block.special_requirements}
            onChange={(v) => update("terms_engine", { requirements_block: { special_requirements: v } })} />
        </Section>
      </div>

      {!recordId && (
        <Section title="Review">
          <p className="text-sm text-muted-foreground">
            Belum ada <code>recordId</code>. Simpan draft V.10.1 dulu agar Review &amp; Copy JSON aktif.
          </p>
        </Section>
      )}

      {recordId && !liveRec && (
        <Section title="Review">
          <p className="text-sm text-warning">
            Record <code>{recordId}</code> tidak ditemukan di <code>pk:rec</code>.
          </p>
        </Section>
      )}

      {liveRec && summary && (
        <>
          {/* ── Final Readiness Gate (compact summary only) ───────────── */}
          <Section title="Final Readiness Gate">
            <div
              className={`flex items-start gap-3 rounded-lg border p-3 ${
                summary.ready
                  ? "border-success/40 bg-success/10"
                  : "border-warning/40 bg-warning/10"
              }`}
            >
              {summary.ready ? (
                <ShieldCheck className="h-5 w-5 text-success mt-0.5 shrink-0" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-warning mt-0.5 shrink-0" />
              )}
              <div className="flex-1">
                <div className="text-sm font-semibold text-foreground">
                  {summary.ready ? "Promo siap dipublish" : "Promo belum bisa dipublish"}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {blockerDisplay.shortSummary}
                </p>
              </div>
            </div>
          </Section>

          {/* ── Phase 3C — Publish to Supabase (status + action only) ─── */}
          <Section title="Publish to Supabase">
            <div
              className={`flex items-start gap-3 rounded-lg border p-3 ${
                publishGate.ok
                  ? "border-success/40 bg-success/10"
                  : "border-warning/40 bg-warning/10"
              }`}
            >
              {publishGate.ok ? (
                <UploadCloud className="h-5 w-5 text-success mt-0.5 shrink-0" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-warning mt-0.5 shrink-0" />
              )}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {publishedFlag === true ? (
                    <Badge className="bg-success/15 text-success border-0">Sudah dipublish</Badge>
                  ) : (
                    <Badge className="bg-muted text-muted-foreground border-0">Belum dipublish</Badge>
                  )}
                  {lastPublishedAt && (
                    <span className="text-[11px] text-muted-foreground font-mono">
                      last: {lastPublishedAt}
                    </span>
                  )}
                </div>
                {!publishGate.ok && (
                  <p className="text-xs text-muted-foreground">
                    Selesaikan review dulu di kartu “Yang harus diperbaiki sebelum publish”.
                  </p>
                )}
                {publishError && (
                  <div className="text-xs text-destructive">{publishError}</div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={handlePublish}
                    disabled={!liveRec || !publishGate.ok || publishing}
                  >
                    {publishing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <UploadCloud className="h-4 w-4 mr-2" />
                    )}
                    Publish to Supabase
                  </Button>
                  {publishedFlag === true && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleUnpublish}
                      disabled={unpublishing || !recordId}
                    >
                      {unpublishing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CloudOff className="h-4 w-4 mr-2" />
                      )}
                      Unpublish
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={refreshPublishStatus}
                    disabled={!recordId}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" /> Refresh status
                  </Button>
                </div>
              </div>
            </div>
          </Section>

          {/* ── Yang harus diperbaiki sebelum publish (actionable) ────── */}
          {!publishGate.ok && blockerDisplay.actions.length > 0 && (
            <Section title="Yang harus diperbaiki sebelum publish">
              <div className="space-y-3">
                {blockerDisplay.actions.map((action) => {
                  const toneCls =
                    action.tone === "error"
                      ? "border-destructive/40 bg-destructive/10"
                      : action.tone === "warning"
                      ? "border-warning/40 bg-warning/10"
                      : "border-border bg-muted/30";
                  return (
                    <div
                      key={action.id}
                      className={`rounded-lg border p-3 ${toneCls}`}
                    >
                      <div className="flex items-start gap-2">
                        <Wrench className="h-4 w-4 mt-0.5 shrink-0 text-foreground" />
                        <div className="flex-1 space-y-1.5">
                          <div className="text-sm font-semibold text-foreground">
                            {action.title}
                          </div>
                          <p className="text-xs text-foreground/90">{action.description}</p>
                          {action.highlight && (
                            <div className="text-[11px] font-mono text-muted-foreground bg-background/50 border border-border rounded px-2 py-1 break-words">
                              {action.highlight}
                            </div>
                          )}
                          {action.suggestion && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-semibold text-foreground">Saran: </span>
                              {action.suggestion}
                            </p>
                          )}
                          {action.actionLabel && (
                            <div>
                              <Button
                                type="button"
                                size="sm"
                                variant="golden"
                                onClick={() => handleBlockerAction(action.actionTarget)}
                              >
                                {action.actionLabel}
                                <ArrowRight className="h-3.5 w-3.5 ml-1" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {blockerDisplay.technicalReasons.length > 0 && (
                  <Collapsible>
                    <CollapsibleTrigger className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 group">
                      <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
                      Detail teknis
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ul className="mt-1 text-[11px] text-muted-foreground list-disc pl-5 space-y-0.5 font-mono break-all">
                        {blockerDisplay.technicalReasons.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Tombol di sini hanya membuka editor terkait. Tidak ada perubahan data otomatis.
                  Publish tetap terkunci sampai semua review selesai.
                </p>
              </div>
            </Section>
          )}


          <Section title="Identity Summary">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 text-sm">
              <SummaryRow k="record_id" v={liveRec.record_id} mono />
              <SummaryRow k="updated_at" v={liveRec.updated_at} mono />
              <SummaryRow k="client_id" v={summary.id.client_block?.client_id} />
              <SummaryRow k="client_name" v={summary.id.client_block?.client_name} />
              <SummaryRow k="promo_name" v={summary.id.promo_block?.promo_name} />
              <SummaryRow k="promo_type" v={summary.id.promo_block?.promo_type} />
              <SummaryRow k="target_user" v={summary.id.promo_block?.target_user} />
              <SummaryRow k="promo_mode" v={summary.id.promo_block?.promo_mode} />
            </div>
          </Section>

          {/* ── Validation Summary ────────────────────────────────────── */}
          <div id="step9-review_list">
            <Section title="Validation Summary">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 text-sm">
                <SummaryRow k="status" v={summary.status} />
                <SummaryRow
                  k="is_structurally_complete"
                  v={String(summary.structurallyComplete)}
                />
                <SummaryRow k="ready_to_commit" v={String(summary.readyToCommit)} />
                <SummaryRow k="review_required" v={String(summary.reviewRequired)} />
              </div>
            </Section>
          </div>

          {/* ── Warnings / Risk ───────────────────────────────────────── */}
          <div id="step9-contradictions">
          <Section title="Warnings, Ambiguity & Contradictions">
            <div className="space-y-3">
              <FlagBlock
                icon={<AlertTriangle className="h-4 w-4" />}
                label="Warnings"
                items={summary.warnings}
                tone="warning"
              />
              <FlagBlock
                icon={<Info className="h-4 w-4" />}
                label="Ambiguity Flags"
                items={summary.ambiguity}
                tone="info"
              />
              <FlagBlock
                icon={<XCircle className="h-4 w-4" />}
                label="Contradiction Flags"
                items={summary.contradictions}
                tone="error"
              />
              <div className="text-sm">
                <span className="text-muted-foreground">promo_risk_level:</span>{" "}
                <span className="font-mono text-foreground">
                  {formatVal(summary.risk.level_block?.promo_risk_level)}
                </span>
              </div>
            </div>
          </Section>
          </div>

          {/* ── Variant Summary ───────────────────────────────────────── */}
          <div id="step9-variants">
          <Section title="Variant Summary">
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                <SummaryRow
                  k="has_subcategories"
                  v={String(summary.variant.summary_block?.has_subcategories)}
                />
                <SummaryRow
                  k="expected_count"
                  v={formatVal(summary.variant.summary_block?.expected_count)}
                />
                <SummaryRow
                  k="actual_count"
                  v={String(summary.subcategories.length)}
                />
                <SummaryRow
                  k="default_variant_id"
                  v={summary.variant.summary_block?.default_variant_id}
                />
              </div>
              {summary.subcategories.length > 0 && (
                <div className="pt-2">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                    <Layers className="h-3 w-3" /> Variants (read-only)
                  </div>
                  <ul className="space-y-1">
                    {summary.subcategories.map((sub, idx) => {
                      const s = sub as unknown as Record<string, unknown>;
                      const name = (s.variant_name ?? s.name ?? `variant-${idx}`) as string;
                      const vid = (s.variant_id ?? "") as string;
                      return (
                        <li
                          key={vid || idx}
                          className="text-xs flex items-center gap-2 px-2 py-1 rounded bg-muted/40"
                        >
                          <span className="font-mono text-muted-foreground">
                            {vid || `(no-id-${idx})`}
                          </span>
                          <span className="text-foreground">{name}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </Section>
          </div>

          {/* ── Human Override Log ────────────────────────────────────── */}
          <Section title="Human Override Log (audit)">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <History className="h-3 w-3" />
              {summary.log.length} entry — read-only audit trail.
            </div>
            {summary.log.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada perubahan manual.</p>
            ) : (
              <ul className="space-y-2 max-h-72 overflow-auto">
                {summary.log.map((e, i) => (
                  <li
                    key={i}
                    className="text-xs border border-border rounded p-2 bg-muted/30 space-y-1 font-mono"
                  >
                    <div className="text-foreground font-semibold">{e.field_path ?? "(no path)"}</div>
                    <div>
                      <span className="text-muted-foreground">prev:</span> {formatVal(e.previous_value)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">next:</span> {formatVal(e.new_value)}
                    </div>
                    <div className="flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
                      <span>by: {e.overridden_by ?? "—"}</span>
                      <span>at: {e.timestamp ?? "—"}</span>
                      <span>src: {e.source ?? "—"}</span>
                      <span>prev_status: {formatVal(e.previous_field_status)}</span>
                      <span>prev_conf: {formatVal(e.previous_ai_confidence)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* ── Projection Engine label ───────────────────────────────── */}
          <Section title="Projection Engine">
            <div className="flex items-start gap-2 text-xs">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-muted-foreground">
                <strong className="text-foreground">Projection Engine</strong> adalah{" "}
                <em>derived-only preview</em>. Ini bukan source of truth. Canonical
                truth tetap PkV10Record engines (identity, taxonomy, mechanics,
                reward, dst). Projection kosong tidak dianggap error — banyak record
                multi-variant memang menyimpan data utama di <code>variant_engine</code>.
              </p>
            </div>
          </Section>
        </>
      )}

      {/* ── Copy Final JSON ─────────────────────────────────────────── */}
      <Section title="Copy Final JSON V.10.1">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Button
            type="button"
            onClick={handleCopyFinal}
            disabled={!recordId}
            title={
              recordId
                ? "Salin full PkV10Record dari pk:rec"
                : "Butuh recordId — simpan draft terlebih dulu"
            }
          >
            <Copy className="h-4 w-4 mr-2" /> Copy Final JSON V.10.1
          </Button>
          {recordId && (
            <Button type="button" variant="outline" size="sm" onClick={refreshLive}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          )}
          {!recordId && (
            <Badge className="bg-warning/15 text-warning border-0">
              Belum ada recordId
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Sumber: <code>loadRecord(recordId)</code> dari <code>pk:rec</code> — full
          canonical PkV10Record termasuk <code>meta_engine.source_block.raw_content</code>,{" "}
          <code>variant_engine</code>, <code>ai_confidence</code>,{" "}
          <code>_field_status</code>, dan <code>_human_override_log</code>. Bukan dari
          form state, bukan dari mappedPreview, bukan dari extractedPromo, bukan dari V.09.
        </p>
      </Section>

      {/* Local wizard preview kept for debug parity, clearly labelled non-truth */}
      <Section title="Local Wizard Preview (debug, NOT source of truth)">
        <pre className="text-[11px] bg-secondary/30 border border-border rounded-lg p-3 overflow-auto max-h-72 max-w-full font-mono text-muted-foreground whitespace-pre-wrap break-words">
{JSON.stringify(state, null, 2)}
        </pre>
        <p className="text-[11px] text-muted-foreground">
          Snapshot wizard state di browser. Bukan record final tersimpan. Untuk
          canonical JSON gunakan tombol <em>Copy Final JSON V.10.1</em> di atas.
        </p>
      </Section>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Inline UI helpers (display-only, never mutate)
// ──────────────────────────────────────────────────────────────────────────

function SummaryRow({ k, v, mono }: { k: string; v: unknown; mono?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</span>
      <span className={mono ? "font-mono text-xs text-foreground break-all" : "text-foreground"}>
        {formatVal(v)}
      </span>
    </div>
  );
}

function FlagBlock({
  icon,
  label,
  items,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  items: string[];
  tone: "warning" | "info" | "error";
}) {
  const toneCls =
    tone === "error"
      ? "text-destructive"
      : tone === "warning"
      ? "text-warning"
      : "text-muted-foreground";
  return (
    <div>
      <div className={`flex items-center gap-1.5 text-xs font-semibold ${toneCls}`}>
        {icon}
        {label} ({items.length})
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
          <CheckCircle2 className="h-3 w-3 text-success" /> kosong
        </p>
      ) : (
        <ul className="mt-1 space-y-0.5 text-xs text-foreground list-disc pl-5">
          {items.map((it, i) => (
            <li key={i} className="font-mono">{it}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
