/**
 * ADMIN VERIFY SECTION — Decision Constraint System
 *
 * Strict design system V1.1 compliance. All inputs are radio/select-first.
 * Open text is FORBIDDEN as primary input. An optional "tambahan catatan"
 * Textarea appears only AFTER admin selects a radio option (controlled flexibility).
 *
 * Question generation (dynamic priority-based):
 *   Priority A — critical field is empty           → required, blocks Apply
 *   Priority B — ai_confidence < 0.7 OR inferred   → optional confirmation
 *   Priority C — value present + confident         → not shown
 *
 * Critical classification:
 *   Default critical:    validity, claim_method, payout_direction,
 *                        turnover_basis, stacking_policy
 *   Conditional critical:
 *     - min_deposit       → critical if promo_type ∈ {deposit-bonus, cashback, rolling}
 *     - max_reward        → critical if payout_direction === "upfront"
 *     - eligible_providers→ critical if promo_type ∈ {rolling, cashback}
 *     - geo_restriction   → critical only if a non-null hint exists
 *   Never critical (in Admin Verify):
 *     - void_conditions
 *
 * Skip semantics (LOCKED):
 *   NO ACTION ≠ CONFIRMATION. NO ACTION ≠ VERIFICATION.
 *   - Admin no-action → ZERO log entry, ZERO status change
 *   - ai_confidence preserved untouched
 *   - _field_status[path] = "explicit" ONLY on explicit admin action
 *   - _human_override_log appended ONLY on explicit admin action
 *
 * Hard rules:
 *   - No schema changes, no new enums
 *   - Reuses existing UI primitives only (Card, Badge, Button, RadioGroup, Select, Textarea)
 *   - Strict V1.1 tokens — zero custom colors / sizes / opacity
 */

import { useMemo, useState } from "react";
import { ShieldCheck, CheckCircle2, Sparkles, AlertTriangle, HelpCircle, GitCompareArrows } from "lucide-react";
import {
  buildIssueQuestions,
  type AdminVerifyIssueQuestion,
} from "./extractor-issue-adapter";
import { buildF3ComplianceQuestions } from "./f3-compliance-adapter";
import { resolveAdminAnswerToPatchPreview } from "./admin-answer-llm-resolver";
import type { ResolveAdminAnswerResult } from "./extractor-issue-adapter";
import { applyAdminPatchPreviewToPkRecord } from "./admin-patch-apply";
import {
  applyDeterministicRegistryAnswer,
  isDeterministicHint,
} from "./deterministic-apply";
import { saveRecord as savePkRecord } from "@/features/promo-knowledge/storage/local-storage";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import type { PkV10Record } from "@/features/promo-knowledge/schema/pk-v10";
import {
  normalizeRecord,
  commitNormalizerOutput,
  type NormalizerOutput,
} from "./enum-normalizer";
import {
  FIELD_REGISTRY,
  FIELD_REGISTRY_INDEX,
  CUSTOM,
  NONE,
  type FieldRegistryEntry,
  type AdminAnswer,
} from "./field-registry";
// V.10.2 REBUILD — gap-reader BYPASSED from runtime path.
// Admin questions now come EXCLUSIVELY from extractor reasoning
// (warnings / ambiguity_flags / contradiction_flags) and F3 compliance.
// `gap-reader.ts` is retained on disk for legacy tests but never imported here.
// `resolveCanonicalPath` no longer needed — no dedupe vs gap-reader.
import type { GapQuestion } from "./gap-reader";

// ─────────────────────────────────────────────────────────────────────────
// AUDIT LOG TYPE — sidecar at root, not in schema
// ─────────────────────────────────────────────────────────────────────────
interface HumanOverrideEntry {
  field_path: string;
  previous_value: unknown;
  new_value: unknown;
  previous_ai_confidence: number | null;
  previous_field_status: string | null;
  overridden_by: "admin";
  timestamp: string;
  /** Optional admin note (controlled flexibility for edge cases). */
  admin_note?: string;
}

// CONFIDENCE_THRESHOLD removed — confidence is no longer a primary driver.
// Decisions are owned by gap-reader.ts (JSON-driven from _field_status + flags).
// FIELD_SPECS removed — replaced by FIELD_REGISTRY (./field-registry).
// V.10.2 — generateQuestions / gap-reader removed from runtime path.

/** Render-time view: GapQuestion joined with its UI descriptor. */
type RenderQuestion = GapQuestion & { spec: FieldRegistryEntry };

const isEmpty = (v: unknown): boolean => {
  if (v === null || v === undefined) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
};

/**
 * PATCH 2 — Path-based flag clearer.
 *
 * Hapus item dari warnings[] / ambiguity_flags[] yang stringnya MENGANDUNG
 * salah satu canonical path yang baru saja di-patch admin. Path adalah token
 * dotted yang sangat spesifik (mis. `scope_engine.game_block.eligible_providers`)
 * sehingga substring match tidak akan false-positive ke kalimat umum.
 *
 * Contradiction TIDAK pernah dibersihkan via path. Contradiction hanya boleh
 * di-clear via exact source_text match di Jalur B (lihat onConfirmApply).
 *
 * Tidak ada regex / keyword logic. Murni equality + includes terhadap path.
 */
function clearFlagsByPatchedPaths(
  draft: PkV10Record,
  patchedPaths: string[],
): void {
  if (patchedPaths.length === 0) return;
  const ob = draft.readiness_engine?.observability_block;
  const vb = draft.readiness_engine?.validation_block;
  const matches = (s: string) =>
    patchedPaths.some((p) => p.length > 0 && s.includes(p));

  if (vb && Array.isArray(vb.warnings)) {
    vb.warnings = vb.warnings.filter((s) => !matches(s));
  }
  if (ob && Array.isArray(ob.ambiguity_flags)) {
    ob.ambiguity_flags = ob.ambiguity_flags.filter((s) => !matches(s));
  }
  // contradiction_flags: NOT cleared by path. Only via Jalur B exact match.
}

/**
 * PATCH 2 — Exact-string flag clearer for Jalur B.
 * Removes the precise `source_text` from its severity bucket.
 */
function clearFlagByExactSource(
  draft: PkV10Record,
  severity: "warning" | "ambiguity" | "contradiction",
  sourceText: string,
): void {
  const ob = draft.readiness_engine?.observability_block;
  const vb = draft.readiness_engine?.validation_block;
  if (severity === "warning" && vb && Array.isArray(vb.warnings)) {
    vb.warnings = vb.warnings.filter((s) => s !== sourceText);
  } else if (severity === "ambiguity" && ob && Array.isArray(ob.ambiguity_flags)) {
    ob.ambiguity_flags = ob.ambiguity_flags.filter((s) => s !== sourceText);
  } else if (
    severity === "contradiction" &&
    ob &&
    Array.isArray(ob.contradiction_flags)
  ) {
    ob.contradiction_flags = ob.contradiction_flags.filter((s) => s !== sourceText);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────

export interface AdminVerifySectionProps {
  record: PkV10Record | null;
  onApply: (next: PkV10Record) => void;
}

// ─────────────────────────────────────────────────────────────────────────
// PROVIDER VERIFY — custom flow (V10 paths only, no hardcoded list)
// ─────────────────────────────────────────────────────────────────────────
const PROVIDER_WHITELIST_PATH = "scope_engine.game_block.eligible_providers";
const PROVIDER_BLACKLIST_PATH = "scope_engine.blacklist_block.providers";

type ProviderMode = "" | "all" | "custom";

interface ProviderState {
  mode: ProviderMode;
  whitelist: string[];
  blacklist: string[];
}

/**
 * VISUAL-ONLY helper. Reads display-only context for the provider card
 * (domain label, blacklist prefill). Has ZERO authority over whether the
 * card is shown — that decision is owned exclusively by gap-reader.
 *
 * Do NOT read this function's output to drive show/hide, priority, or
 * required state. (gap-reader is DROPPED in V.10.2 runtime.)
 */
function readProviderVisualContext(record: PkV10Record): {
  domain: string;
  prefilledBlacklist: string[];
  initialMode: ProviderMode;
} {
  const domain = (record.scope_engine?.game_block?.game_domain ?? "").trim();
  const blacklist = record.scope_engine?.blacklist_block?.providers ?? [];
  const initialMode: ProviderMode = blacklist.length > 0 ? "custom" : "";
  return { domain, prefilledBlacklist: [...blacklist], initialMode };
}

export function AdminVerifySection({ record, onApply }: AdminVerifySectionProps) {
  const [answers, setAnswers] = useState<Record<string, AdminAnswer>>({});
  const [issueAnswers, setIssueAnswers] = useState<Record<string, string>>({});
  // PR-22 — internal hint + label per issue (from radio selection). Travel
  // alongside answer_text to the resolver as `selected_internal_hint`.
  const [issueAnswerMeta, setIssueAnswerMeta] = useState<
    Record<string, { hint?: string; label?: string; note?: string }>
  >({});
  const [savedIssueAnswers, setSavedIssueAnswers] = useState<Record<string, string>>({});
  const [issuePreviews, setIssuePreviews] = useState<Record<string, ResolveAdminAnswerResult>>({});
  const [issuePreviewLoading, setIssuePreviewLoading] = useState<Record<string, boolean>>({});
  const [issuePreviewErrors, setIssuePreviewErrors] = useState<Record<string, string>>({});
  const [issueApplyLoading, setIssueApplyLoading] = useState<Record<string, boolean>>({});
  const [issueApplyErrors, setIssueApplyErrors] = useState<Record<string, string>>({});
  const [issueApplied, setIssueApplied] = useState<Record<string, boolean>>({});

  // PR-19A — Extractor issue questions (warnings/ambiguity/contradictions).
  // Local UI state ONLY. Never mutates the record. Live LLM resolver lands in PR-19B.
  //
  // PATH-FIRST ROUTING (V.10.1):
  //   Jika issue punya `affected_paths[0]` yang dikenal FIELD_REGISTRY,
  //   suppress dari Jalur B — Jalur A (gap-reader) sudah meng-handle path
  //   tersebut via warning/ambiguity bucket dengan question/options humanize
  //   resmi dari FIELD_REGISTRY. Tidak ada regex/keyword matching; murni
  //   path-equality check terhadap FIELD_REGISTRY_INDEX.
  // Visual context only — does NOT decide whether the card is shown.
  const providerVisual = useMemo(
    () =>
      record
        ? readProviderVisualContext(record)
        : { domain: "", prefilledBlacklist: [] as string[], initialMode: "" as ProviderMode },
    [record],
  );

  // V.10.2 REBUILD — gap-reader DROPPED. No null-check / registry-iteration
  // questions. The only source of admin questions is extractor reasoning.
  const gaps = useMemo<GapQuestion[]>(() => [], []);

  // V.10.2 — Sumber pertanyaan tunggal:
  //   1. readiness_engine.validation_block.warnings[]
  //   2. readiness_engine.observability_block.ambiguity_flags[]
  //   3. readiness_engine.observability_block.contradiction_flags[]
  //   4. F3 V.10.2 compliance issues (invalid enum / shape)
  // NO template wording. NO null-check. NO field-registry iteration.
  const issueQuestions = useMemo<AdminVerifyIssueQuestion[]>(() => {
    if (!record) return [];
    const merged = [
      ...buildIssueQuestions(record),
      ...buildF3ComplianceQuestions(record),
    ];
    const seen = new Set<string>();
    return merged.filter((q) => {
      if (seen.has(q.task_id)) return false;
      seen.add(q.task_id);
      return true;
    });
  }, [record]);


  // V.10.1 diagnostic — verifies record freshness for Admin Verify gate.
  // Logs whether geo_restriction is being correctly skipped per _field_status.
  useMemo(() => {
    if (!record) return;
    const geoPath = "scope_engine.geo_block.geo_restriction";
    // eslint-disable-next-line no-console
    console.debug("[AdminVerify V.10.1]", {
      record_id: record.record_id,
      schema_version: record.meta_engine?.schema_block?.schema_version,
      promo_name: record.identity_engine?.promo_block?.promo_name,
      created_at: record.created_at,
      updated_at: record.updated_at,
      geo_value: record.scope_engine?.geo_block?.geo_restriction,
      geo_field_status: (record._field_status ?? {})[geoPath],
      geo_in_gaps: gaps.some((g) => g.path === geoPath),
    });
  }, [record, gaps]);

  // V.10.2 — Provider card visibility = strictly derived from extractor
  // reasoning. Card shows ONLY when an extractor issue (warning / ambiguity
  // / contradiction / F3) explicitly references a provider canonical path
  // via `affected_paths`. NO "field kosong" trigger. Path-equality only.
  const providerIssue = useMemo(
    () =>
      issueQuestions.find((q) =>
        q.affected_paths.some(
          (p) => p === PROVIDER_WHITELIST_PATH || p === PROVIDER_BLACKLIST_PATH,
        ),
      ),
    [issueQuestions],
  );
  const showProviderCard = !!providerIssue;
  const providerPriority: "blocker" | "confirm" | "optional" =
    providerIssue?.severity === "contradiction" ? "blocker" : "confirm";

  const triggerKey = `${showProviderCard}|${providerVisual.domain}|${providerVisual.prefilledBlacklist.join(",")}|${providerVisual.initialMode}`;
  const [providerState, setProviderState] = useState<ProviderState>({
    mode: providerVisual.initialMode,
    whitelist: [],
    blacklist: [...providerVisual.prefilledBlacklist],
  });
  // Reset when underlying record changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    setProviderState({
      mode: providerVisual.initialMode,
      whitelist: [],
      blacklist: [...providerVisual.prefilledBlacklist],
    });
  }, [triggerKey]);

  const normalizerOutput = useMemo<NormalizerOutput>(
    () =>
      record
        ? normalizeRecord(record)
        : { pendingEntries: [], pendingValuePatches: [] },
    [record],
  );

  // V.10.2 — Registry-driven render list DROPPED. No question is generated
  // from FIELD_REGISTRY iteration. All admin questions render through the
  // ExtractorIssueSection (Jalur B). Provider card has its own dedicated UI.
  const questions = useMemo<RenderQuestion[]>(() => [], []);

  if (!record) return null;

  const answeredCount = Object.values(answers).filter((a) => a && a.choice).length;
  const criticalQuestions = questions.filter((q) => q.priority === "blocker");
  const unansweredCritical = criticalQuestions.filter((q) => !answers[q.spec.path]?.choice);
  const hasNormalizerPending =
    normalizerOutput.pendingEntries.length > 0 ||
    normalizerOutput.pendingValuePatches.length > 0;
  // Provider verify is "answered" when admin picked "all" OR picked "custom" with at least 1 whitelist provider
  const providerAnswered =
    showProviderCard &&
    (providerState.mode === "all" ||
      (providerState.mode === "custom" && providerState.whitelist.length > 0));
  // Only required-to-answer when gap-reader marked the provider gap as a blocker.
  const providerPendingRequired =
    showProviderCard && providerPriority === "blocker" && !providerAnswered;
  // PATCH 3 — Contradiction = critical. Verifikasi tidak boleh dianggap
  // selesai selama contradiction_flags masih ada di JSON.
  const contradictionFlags =
    record.readiness_engine?.observability_block?.contradiction_flags ?? [];
  const hasContradictions = contradictionFlags.length > 0;

  // Apply enabled if (admin answered AND no critical missing) OR normalizer has pending enum patches
  const canApply =
    !hasContradictions &&
    (((answeredCount > 0 || providerAnswered) &&
      unansweredCritical.length === 0 &&
      !providerPendingRequired) ||
      (hasNormalizerPending && !providerPendingRequired));

  // Empty state — only when truly nothing to do (and no critical contradictions)
  if (
    questions.length === 0 &&
    issueQuestions.length === 0 &&
    !hasNormalizerPending &&
    !showProviderCard &&
    !hasContradictions
  ) {
    return (
      <Card className="bg-card border border-border rounded-xl p-8">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-6 w-6 text-success" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-button-hover">Verifikasi Admin</h3>
            <p className="text-sm text-muted-foreground">
              Tidak ada verifikasi tambahan. Semua field penting sudah lengkap.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const setAnswer = (path: string, patch: Partial<AdminAnswer>) => {
    setAnswers((prev) => {
      const current = prev[path] ?? { choice: "" };
      return { ...prev, [path]: { ...current, ...patch } };
    });
  };

  const clearAnswer = (path: string) => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
  };

  const handleApply = () => {
    const draft: PkV10Record = JSON.parse(JSON.stringify(record));
    draft._field_status = { ...(draft._field_status ?? {}) };
    draft.ai_confidence = { ...(draft.ai_confidence ?? {}) };
    const patchedPaths: string[] = [];

    const draftAny = draft as PkV10Record & { _human_override_log?: HumanOverrideEntry[] };
    const log: HumanOverrideEntry[] = Array.isArray(draftAny._human_override_log)
      ? [...draftAny._human_override_log]
      : [];
    const ts = new Date().toISOString();

    for (const q of questions) {
      const a = answers[q.spec.path];
      // Skip semantics: NO ACTION = no log, no status change.
      if (!a || !a.choice) continue;
      // Custom value required but empty? Skip silently (no log).
      if (
        (q.spec.inputKind === "radio-with-date" || q.spec.inputKind === "radio-with-number") &&
        a.choice === CUSTOM &&
        (!a.customValue || a.customValue.trim() === "")
      ) {
        continue;
      }
      // manual_note option requires a non-empty admin explanation.
      if (a.choice === "manual_note" && (!a.customValue || a.customValue.trim() === "")) {
        continue;
      }
      if (q.spec.inputKind === "multi-chip" && (!a.customSelection || a.customSelection.length === 0)) {
        continue;
      }

      // Snapshot BEFORE mutation
      const previousValue = q.spec.read(draft);
      const prevConfRaw = draft.ai_confidence[q.spec.path];
      const previousAiConfidence: number | null =
        typeof prevConfRaw === "number" ? prevConfRaw : null;
      const previousFieldStatus: string | null =
        typeof draft._field_status[q.spec.path] === "string"
          ? (draft._field_status[q.spec.path] as string)
          : null;

      q.spec.write(draft, a);
      const newValue = q.spec.read(draft);

      // _field_status = "explicit" means the field has a clear/final value.
      // Human verification is tracked SOLELY by _human_override_log.
      // ai_confidence is preserved as AI-draft provenance and never touched.
      draft._field_status[q.spec.path] = "explicit";
      patchedPaths.push(q.spec.path);

      const entry: HumanOverrideEntry = {
        field_path: q.spec.path,
        previous_value: previousValue ?? null,
        new_value: newValue ?? null,
        previous_ai_confidence: previousAiConfidence,
        previous_field_status: previousFieldStatus,
        overridden_by: "admin",
        timestamp: ts,
      };
      // Registry-driven admin_note (e.g. "not_stated_confirmed" fixed string,
      // "manual_note" pipes customValue) takes precedence over freeform a.note.
      const registryNote = q.spec.getAdminNote?.(a);
      if (registryNote && registryNote.trim()) {
        entry.admin_note = registryNote.trim();
      } else if (a.note && a.note.trim()) {
        entry.admin_note = a.note.trim();
      }
      log.push(entry);

      // ── Semantic-pair sibling commit (e.g. *_unlimited boolean) ──
      // When a registry entry declares `unlimitedSiblingPath`, mirror the
      // admin's intent into the sibling boolean and mark its status explicit.
      // Log only if the sibling value actually changed (avoid duplicate spam).
      if (
        q.spec.unlimitedSiblingPath &&
        q.spec.readSibling &&
        q.spec.writeSibling
      ) {
        const siblingPath = q.spec.unlimitedSiblingPath;
        const prevSibling = q.spec.readSibling(draft);
        const prevSibConfRaw = draft.ai_confidence[siblingPath];
        const prevSibConf: number | null =
          typeof prevSibConfRaw === "number" ? prevSibConfRaw : null;
        const prevSibStatus: string | null =
          typeof draft._field_status[siblingPath] === "string"
            ? (draft._field_status[siblingPath] as string)
            : null;

        q.spec.writeSibling(draft, a);
        const newSibling = q.spec.readSibling(draft);

        draft._field_status[siblingPath] = "explicit";
        patchedPaths.push(siblingPath);

        if (prevSibling !== newSibling) {
          log.push({
            field_path: siblingPath,
            previous_value: prevSibling ?? null,
            new_value: newSibling ?? null,
            previous_ai_confidence: prevSibConf,
            previous_field_status: prevSibStatus,
            overridden_by: "admin",
            timestamp: ts,
          });
        }
      }
    }

    // ── Provider verify commit ─────────────────────────────────────────
    if (showProviderCard && providerAnswered) {
      const prevWhitelist = draft.scope_engine?.game_block?.eligible_providers ?? [];
      const prevBlacklist = draft.scope_engine?.blacklist_block?.providers ?? [];
      const prevWConfRaw = draft.ai_confidence[PROVIDER_WHITELIST_PATH];
      const prevWConf: number | null =
        typeof prevWConfRaw === "number" ? prevWConfRaw : null;
      const prevWStatus: string | null =
        typeof draft._field_status[PROVIDER_WHITELIST_PATH] === "string"
          ? (draft._field_status[PROVIDER_WHITELIST_PATH] as string)
          : null;

      if (providerState.mode === "all") {
        // eligible_providers stays [] AND blacklist stays []
        // Explicit log entry distinguishes "all confirmed" from "not yet filled".
        draft._field_status[PROVIDER_WHITELIST_PATH] = "explicit";
        patchedPaths.push(PROVIDER_WHITELIST_PATH);
        log.push({
          field_path: PROVIDER_WHITELIST_PATH,
          previous_value: [...prevWhitelist],
          new_value: [],
          previous_ai_confidence: prevWConf,
          previous_field_status: prevWStatus,
          overridden_by: "admin",
          timestamp: ts,
          admin_note: "admin confirmed: all providers allowed",
        });
      } else if (providerState.mode === "custom") {
        const newWhitelist = [...providerState.whitelist];
        const newBlacklist = [...providerState.blacklist];
        draft.scope_engine.game_block.eligible_providers = newWhitelist as never;
        draft.scope_engine.blacklist_block.providers = newBlacklist as never;
        draft._field_status[PROVIDER_WHITELIST_PATH] = "explicit";
        patchedPaths.push(PROVIDER_WHITELIST_PATH);
        log.push({
          field_path: PROVIDER_WHITELIST_PATH,
          previous_value: [...prevWhitelist],
          new_value: newWhitelist,
          previous_ai_confidence: prevWConf,
          previous_field_status: prevWStatus,
          overridden_by: "admin",
          timestamp: ts,
        });
        // Only log blacklist if it actually changed
        const blacklistChanged =
          prevBlacklist.length !== newBlacklist.length ||
          prevBlacklist.some((v, i) => v !== newBlacklist[i]);
        if (blacklistChanged) {
          const prevBConfRaw = draft.ai_confidence[PROVIDER_BLACKLIST_PATH];
          const prevBConf: number | null =
            typeof prevBConfRaw === "number" ? prevBConfRaw : null;
          const prevBStatus: string | null =
            typeof draft._field_status[PROVIDER_BLACKLIST_PATH] === "string"
              ? (draft._field_status[PROVIDER_BLACKLIST_PATH] as string)
              : null;
          draft._field_status[PROVIDER_BLACKLIST_PATH] = "explicit";
          patchedPaths.push(PROVIDER_BLACKLIST_PATH);
          log.push({
            field_path: PROVIDER_BLACKLIST_PATH,
            previous_value: [...prevBlacklist],
            new_value: newBlacklist,
            previous_ai_confidence: prevBConf,
            previous_field_status: prevBStatus,
            overridden_by: "admin",
            timestamp: ts,
          });
        }
      }
    }

    draftAny._human_override_log = log;

    // Atomic commit: apply enum normalizer patches + append _ai_resolver_log
    // (pure value-level normalization on existing fields, no question authority)
    commitNormalizerOutput(draft, normalizerOutput, ts);

    // PATCH 2 — Bersihkan warning/ambiguity yang field-nya baru di-patch admin.
    // Contradiction tidak ikut dibersihkan via path (lihat Jalur B).
    clearFlagsByPatchedPaths(draft, patchedPaths);

    draft.updated_at = ts;

    // PATCH 1 — Persist canonical V.10.2 ke localStorage agar Jalur A
    // setara dengan Jalur B: state = session = localStorage.
    const saved = savePkRecord(draft);
    onApply(saved);
    setAnswers({});
  };

  const handleSkipAll = () => setAnswers({});

  return (
    <Card className="bg-card border border-border rounded-xl p-8 space-y-6">
      {/* Header — V1.1 standard */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-button-hover/20 flex items-center justify-center shrink-0">
          <ShieldCheck className="h-6 w-6 text-button-hover" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-button-hover">Verifikasi Admin</h3>
          <p className="text-sm text-muted-foreground">
            {issueQuestions.length > 0
              ? `${issueQuestions.length} pertanyaan dari reasoning extractor V.10.2.`
              : hasContradictions
                ? "Kontradiksi wajib diselesaikan sebelum publish."
                : "Tidak ada verifikasi tambahan."}
          </p>
        </div>
        {answeredCount > 0 && (
          <Badge variant="success" size="sm">
            {answeredCount} terisi
          </Badge>
        )}
      </div>

      {/* Questions stacked full-width; radio options inside use 2 cols when ≥3 */}
      <div className="space-y-6">
        {hasContradictions && (
          <div className="bg-destructive/10 border border-destructive/40 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="text-sm font-semibold text-destructive">
                Kontradiksi terdeteksi — wajib diselesaikan
              </div>
              <p className="text-xs text-muted-foreground">
                Verifikasi tidak dapat diselesaikan selama kontradiksi berikut belum di-resolve oleh admin.
              </p>
              <ul className="list-disc list-inside text-xs text-foreground space-y-1">
                {contradictionFlags.map((f, i) => (
                  <li key={`${i}-${f}`}>{f}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {showProviderCard && (
          <ProviderVerifyCard
            domain={providerVisual.domain}
            prefilledFromBlacklist={providerVisual.prefilledBlacklist.length > 0}
            priority={providerPriority}
            state={providerState}
            onChange={setProviderState}
          />
        )}
        {questions.map((q, idx) => (
          <QuestionCard
            key={q.spec.path}
            number={idx + 1 + (showProviderCard ? 1 : 0)}
            question={q}
            answer={answers[q.spec.path]}
            onChange={(patch) => setAnswer(q.spec.path, patch)}
            onClear={() => clearAnswer(q.spec.path)}
          />
        ))}
      </div>

      {/* V.10.2 REBUILD — Jalur B is now the ONLY question source.
          Questions come exclusively from extractor reasoning:
          warnings[] / ambiguity_flags[] / contradiction_flags[] + F3 V.10.2. */}
      {issueQuestions.length > 0 && (
        <ExtractorIssueSection
          record={record}
          issues={issueQuestions}
          drafts={issueAnswers}
          saved={savedIssueAnswers}
          previews={issuePreviews}
          loading={issuePreviewLoading}
          errors={issuePreviewErrors}
          onDraftChange={(taskId, value, meta) => {
            setIssueAnswers((prev) => ({ ...prev, [taskId]: value }));
            setIssueAnswerMeta((prev) => ({ ...prev, [taskId]: meta ?? {} }));
          }}
          onSave={(taskId) =>
            setSavedIssueAnswers((prev) => ({
              ...prev,
              [taskId]: issueAnswers[taskId] ?? "",
            }))
          }
          onGeneratePreview={async (q) => {
            const meta = issueAnswerMeta[q.task_id] ?? {};
            const path = q.affected_paths[0];
            const entry = path ? FIELD_REGISTRY_INDEX.get(path) : undefined;

            // PATCH B — Deterministic registry shortcut.
            // Skip LLM resolver entirely when admin picked a structured
            // radio option that maps to a registry writer. Authority:
            // admin's structured answer + FIELD_REGISTRY.
            if (entry && isDeterministicHint(meta.hint)) {
              setIssueApplyLoading((p) => ({ ...p, [q.task_id]: true }));
              setIssueApplyErrors((e) => {
                const n = { ...e };
                delete n[q.task_id];
                return n;
              });
              setIssuePreviewErrors((e) => {
                const n = { ...e };
                delete n[q.task_id];
                return n;
              });
              try {
                const result = applyDeterministicRegistryAnswer({
                  record,
                  entry,
                  hint: meta.hint as string,
                  note: meta.note,
                  severity: q.severity,
                  sourceText: q.source_text,
                  actor: "admin",
                  reason: q.issue_summary,
                });
                if (!result.ok || !result.record) {
                  throw new Error(result.error ?? "Patch tidak valid.");
                }
                const saved = savePkRecord(result.record);
                onApply(saved);
                setIssueApplied((a) => ({ ...a, [q.task_id]: true }));
                toast.success("Perubahan tersimpan", {
                  description:
                    "Status review masih perlu dicek ulang sebelum publish.",
                });
              } catch (err) {
                const msg =
                  err instanceof Error
                    ? err.message
                    : "Gagal menyimpan perubahan.";
                setIssueApplyErrors((e) => ({ ...e, [q.task_id]: msg }));
              } finally {
                setIssueApplyLoading((p) => ({ ...p, [q.task_id]: false }));
              }
              return;
            }

            setIssuePreviewLoading((p) => ({ ...p, [q.task_id]: true }));
            setIssuePreviewErrors((e) => {
              const next = { ...e };
              delete next[q.task_id];
              return next;
            });
            try {
              // PR-19C: live LLM resolver via ai-proxy (type=intent).
              // PR-22: pass selected_internal_hint + selected_label alongside
              // answer_text. Backward-compatible — resolver may ignore them.
              const result = await resolveAdminAnswerToPatchPreview({
                record,
                reviewTask: q,
                adminAnswer: {
                  task_id: q.task_id,
                  answer_text: issueAnswers[q.task_id] ?? "",
                  selected_internal_hint: meta.hint,
                  selected_label: meta.label,
                },
                rawContentReadonly:
                  record.meta_engine?.source_block?.raw_content ?? null,
                allowedTargetPaths: q.affected_paths,
              });
              setIssuePreviews((prev) => ({ ...prev, [q.task_id]: result }));
            } catch (err) {
              const msg =
                err instanceof Error
                  ? err.message
                  : "Resolver LLM gagal. Coba lagi.";
              setIssuePreviewErrors((e) => ({ ...e, [q.task_id]: msg }));
              // Keep previous preview cleared so admin sees error, not stale data.
              setIssuePreviews((prev) => {
                const next = { ...prev };
                delete next[q.task_id];
                return next;
              });
            } finally {
              setIssuePreviewLoading((p) => ({ ...p, [q.task_id]: false }));
            }
          }}
          applyLoading={issueApplyLoading}
          applyErrors={issueApplyErrors}
          applied={issueApplied}
          onConfirmApply={async (q) => {
            const preview = issuePreviews[q.task_id];
            if (!preview || preview.proposed_patches.length === 0) return;
            setIssueApplyLoading((p) => ({ ...p, [q.task_id]: true }));
            setIssueApplyErrors((e) => {
              const next = { ...e };
              delete next[q.task_id];
              return next;
            });
            try {
              const result = applyAdminPatchPreviewToPkRecord({
                record,
                patches: preview.proposed_patches,
                allowedTargetPaths: q.affected_paths,
                actor: "admin",
                source: "admin_verify_llm_patch_preview",
                reason: q.issue_summary,
              });
              if (!result.ok || !result.record) {
                throw new Error(
                  (result.errors ?? ["Patch tidak valid."]).join("\n"),
                );
              }
              // PATCH 2 — Clear the exact flag string admin just resolved.
              // Match by severity bucket + exact source_text (no fuzzy/keyword).
              clearFlagByExactSource(result.record, q.severity, q.source_text);
              const saved = savePkRecord(result.record);
              onApply(saved);
              setIssueApplied((a) => ({ ...a, [q.task_id]: true }));
              toast.success("Perubahan tersimpan", {
                description:
                  "Status review masih perlu dicek ulang sebelum publish.",
              });
            } catch (err) {
              const msg =
                err instanceof Error
                  ? err.message
                  : "Gagal menyimpan perubahan.";
              setIssueApplyErrors((e) => ({ ...e, [q.task_id]: msg }));
            } finally {
              setIssueApplyLoading((p) => ({ ...p, [q.task_id]: false }));
            }
          }}
        />
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
        <div className="text-sm text-muted-foreground">
          {unansweredCritical.length > 0
            ? `Masih ada ${unansweredCritical.length} pertanyaan wajib`
            : answeredCount > 0
              ? "Siap diterapkan"
              : "Pilih jawaban untuk mulai"}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSkipAll} disabled={answeredCount === 0}>
            Reset
          </Button>
          <Button onClick={handleApply} disabled={!canApply}>
            Terapkan Jawaban
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// QUESTION CARD
// ─────────────────────────────────────────────────────────────────────────

function QuestionCard({
  number,
  question,
  answer,
  onChange,
  onClear,
}: {
  number: number;
  question: RenderQuestion;
  answer: AdminAnswer | undefined;
  onChange: (patch: Partial<AdminAnswer>) => void;
  onClear: () => void;
}) {
  const { spec, priority } = question;
  const isAnswered = !!answer?.choice;
  const showNoteField = isAnswered;

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground">
            {number}. {spec.question}
          </h4>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={priority === "blocker" ? "destructive" : "warning"} size="sm">
            {priority === "blocker" ? "Wajib" : "Konfirmasi"}
          </Badge>
          {isAnswered && (
            <Badge variant="success" size="sm">
              <CheckCircle2 className="h-3 w-3" />
              Terjawab
            </Badge>
          )}
        </div>
      </div>

      {/* Input — radio/select/multi-chip only */}
      <QuestionInput question={question} answer={answer} onChange={onChange} />

      {/* Optional note — hidden until answered */}
      {showNoteField && (
        <div className="space-y-2 pt-2 border-t border-border">
          <Label className="text-sm font-medium text-muted-foreground">
            Tambahan catatan (opsional)
          </Label>
          <Textarea
            value={answer?.note ?? ""}
            placeholder="Catatan untuk edge case atau konteks tambahan…"
            onChange={(e) => onChange({ note: e.target.value })}
            className="min-h-[60px]"
          />
        </div>
      )}

      {isAnswered && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClear}>
            Hapus jawaban
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// INPUT (radio / select-large / multi-chip / radio-with-date / radio-with-number)
// ─────────────────────────────────────────────────────────────────────────

function QuestionInput({
  question,
  answer,
  onChange,
}: {
  question: RenderQuestion;
  answer: AdminAnswer | undefined;
  onChange: (patch: Partial<AdminAnswer>) => void;
}) {
  const { spec } = question;
  const choice = answer?.choice ?? "";

  // Multi-chip
  if (spec.inputKind === "multi-chip" && spec.multiOptions) {
    const selected = answer?.customSelection ?? [];
    const toggle = (opt: string) => {
      const next = selected.includes(opt)
        ? selected.filter((s) => s !== opt)
        : [...selected, opt];
      onChange({ customSelection: next, choice: next.length > 0 ? "multi" : "" });
    };
    return (
      <div className="flex flex-wrap gap-2">
        {spec.multiOptions.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={
                active
                  ? "inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-button-hover/20 text-button-hover border border-button-hover/40"
                  : "inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-background text-muted-foreground border border-border hover:border-button-hover/40 transition-colors"
              }
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  // Select-large (>6 enum options)
  if (spec.inputKind === "select-large" && spec.options) {
    return (
      <Select value={choice} onValueChange={(v) => onChange({ choice: v })}>
        <SelectTrigger>
          <SelectValue placeholder="Pilih wilayah…" />
        </SelectTrigger>
        <SelectContent>
          {spec.options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Radio (with optional date/number for CUSTOM)
  if (!spec.options) return null;

  const useTwoCols = spec.options.length >= 3;

  return (
    <div className="space-y-3">
      <RadioGroup
        value={choice}
        onValueChange={(v) =>
          onChange({
            choice: v,
            customValue:
              v === CUSTOM || v === "manual_note" ? answer?.customValue : undefined,
          })
        }
        className={useTwoCols ? "grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2" : "grid gap-2"}
      >
        {spec.options.map((opt) => {
          const id = `${spec.path}-${opt.value}`;
          return (
            <div key={opt.value} className="flex items-center gap-3">
              <RadioGroupItem value={opt.value} id={id} />
              <Label htmlFor={id} className="cursor-pointer text-sm font-normal text-foreground">
                {opt.label}
              </Label>
            </div>
          );
        })}
      </RadioGroup>

      {/* Inline custom input — only when CUSTOM picked */}
      {choice === CUSTOM && spec.inputKind === "radio-with-date" && (
        <div className="pl-8">
          <input
            type="date"
            value={answer?.customValue ?? ""}
            onChange={(e) => onChange({ customValue: e.target.value })}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
          />
        </div>
      )}
      {choice === CUSTOM && spec.inputKind === "radio-with-number" && (
        <div className="pl-8">
          <input
            type="number"
            value={answer?.customValue ?? ""}
            onChange={(e) => onChange({ customValue: e.target.value })}
            placeholder="Masukkan angka (IDR)"
            className="flex h-10 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
          />
        </div>
      )}
      {choice === "manual_note" && (
        <div className="pl-8">
          <Textarea
            value={answer?.customValue ?? ""}
            onChange={(e) => onChange({ customValue: e.target.value })}
            placeholder="Jelaskan kondisi masa berlaku promo ini…"
            rows={3}
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PROVIDER VERIFY CARD — custom block (V10 paths only, no hardcoded list)
// ─────────────────────────────────────────────────────────────────────────

function ProviderVerifyCard({
  domain,
  prefilledFromBlacklist,
  priority,
  state,
  onChange,
}: {
  domain: string;
  prefilledFromBlacklist: boolean;
  priority: "blocker" | "confirm" | "optional";
  state: ProviderState;
  onChange: (next: ProviderState) => void;
}) {
  const isAnswered =
    state.mode === "all" || (state.mode === "custom" && state.whitelist.length > 0);

  const setMode = (m: ProviderMode) => onChange({ ...state, mode: m });
  const setWhitelist = (w: string[]) => onChange({ ...state, whitelist: w });
  const setBlacklist = (b: string[]) => onChange({ ...state, blacklist: b });

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground">
            1. Apakah promo ini berlaku untuk semua provider {domain || "ini"}?
          </h4>
          {prefilledFromBlacklist && (
            <p className="text-xs text-muted-foreground mt-1">
              Sistem mendeteksi blacklist provider sudah terisi. Mohon review aturan
              provider khusus di bawah.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={priority === "blocker" ? "destructive" : "warning"} size="sm">
            {priority === "blocker" ? "Wajib" : "Konfirmasi"}
          </Badge>
          {isAnswered && (
            <Badge variant="success" size="sm">
              <CheckCircle2 className="h-3 w-3" />
              Terjawab
            </Badge>
          )}
        </div>
      </div>

      {!prefilledFromBlacklist && (
        <RadioGroup
          value={state.mode}
          onValueChange={(v) => setMode(v as ProviderMode)}
          className="grid gap-2"
        >
          <div className="flex items-center gap-3">
            <RadioGroupItem value="all" id="provider-all" />
            <Label htmlFor="provider-all" className="cursor-pointer text-sm font-normal text-foreground">
              Ya, semua provider
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <RadioGroupItem value="custom" id="provider-custom" />
            <Label htmlFor="provider-custom" className="cursor-pointer text-sm font-normal text-foreground">
              Tidak, ada aturan provider khusus
            </Label>
          </div>
        </RadioGroup>
      )}

      {state.mode === "custom" && (
        <div className="space-y-4 pt-2 border-t border-border">
          <TagInput
            label="Provider yang boleh"
            placeholder="Ketik nama provider, tekan Enter…"
            tags={state.whitelist}
            onChange={setWhitelist}
          />
          <TagInput
            label="Provider yang diblokir (opsional)"
            placeholder="Ketik nama provider, tekan Enter…"
            tags={state.blacklist}
            onChange={setBlacklist}
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// TAG INPUT — minimal free-text tag input (no hardcoded list)
// ─────────────────────────────────────────────────────────────────────────

function TagInput({
  label,
  placeholder,
  tags,
  onChange,
}: {
  label: string;
  placeholder?: string;
  tags: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const addTag = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (tags.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...tags, v]);
    setDraft("");
  };

  const removeTag = (t: string) => onChange(tags.filter((x) => x !== t));

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-button-hover/20 text-button-hover border border-button-hover/40"
            >
              {t}
              <button
                type="button"
                onClick={() => removeTag(t)}
                aria-label={`Hapus ${t}`}
                className="hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTag(draft);
          } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
            removeTag(tags[tags.length - 1]);
          }
        }}
        onBlur={() => draft && addTag(draft)}
        placeholder={placeholder}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// EXTRACTOR ISSUE SECTION — Humanized presentation
// Same backend contract (extractor-issue-adapter + f3-compliance-adapter +
// admin-answer-llm-resolver). Only copy + interaction model changed:
//   - friendly titles & badges (no raw enum jargon in body)
//   - radio-first input when options are known per affected_paths[0]
//   - optional textarea ("Penjelasan tambahan")
//   - all internal terms (path/severity/source_text/allowed enum) hidden
//     under a collapsible "Lihat detail teknis"
// No schema, no resolver, no extractor changes.
// ─────────────────────────────────────────────────────────────────────────

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import {
  humanizeIssue,
  type HumanizedIssue,
  type HumanOption,
} from "./humanize-issue";


function ExtractorIssueSection({
  record,
  issues,
  drafts,
  saved,
  previews,
  loading,
  errors,
  onDraftChange,
  onSave,
  onGeneratePreview,
  applyLoading,
  applyErrors,
  applied,
  onConfirmApply,
}: {
  record: PkV10Record;
  issues: AdminVerifyIssueQuestion[];
  drafts: Record<string, string>;
  saved: Record<string, string>;
  previews: Record<string, ResolveAdminAnswerResult>;
  loading: Record<string, boolean>;
  errors: Record<string, string>;
  onDraftChange: (taskId: string, value: string, meta?: { hint?: string; label?: string; note?: string }) => void;
  onSave: (taskId: string) => void;
  onGeneratePreview: (q: AdminVerifyIssueQuestion) => Promise<void> | void;
  applyLoading: Record<string, boolean>;
  applyErrors: Record<string, string>;
  applied: Record<string, boolean>;
  onConfirmApply: (q: AdminVerifyIssueQuestion) => Promise<void> | void;
}) {
  return (
    <div className="space-y-4 pt-2 border-t border-border">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5 text-warning" />
        </div>
        <div className="flex-1">
          <h4 className="text-base font-semibold text-foreground">
            Konfirmasi sebelum publish
          </h4>
          <p className="text-sm text-muted-foreground">
            Ada {issues.length} hal yang perlu Anda konfirmasi sebelum promo dipublikasikan.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background/50 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Jawaban Anda hanya menjadi saran perubahan. Data promo tidak akan
          berubah sebelum Anda menyetujuinya.
        </p>
      </div>

      <div className="space-y-4">
        {issues.map((q) => (
          <ExtractorIssueCard
            key={q.task_id}
            record={record}
            question={q}
            draft={drafts[q.task_id] ?? ""}
            savedValue={saved[q.task_id]}
            preview={previews[q.task_id]}
            isLoading={!!loading[q.task_id]}
            errorMessage={errors[q.task_id]}
            isApplying={!!applyLoading[q.task_id]}
            applyErrorMessage={applyErrors[q.task_id]}
            isApplied={!!applied[q.task_id]}
            onDraftChange={(v, meta) => onDraftChange(q.task_id, v, meta)}
            onSave={() => onSave(q.task_id)}
            onGeneratePreview={() => onGeneratePreview(q)}
            onConfirmApply={() => onConfirmApply(q)}
          />
        ))}
      </div>
    </div>
  );
}

function ExtractorIssueCard({
  record,
  question,
  draft,
  savedValue,
  preview,
  isLoading,
  errorMessage,
  isApplying,
  applyErrorMessage,
  isApplied,
  onDraftChange,
  onSave,
  onGeneratePreview,
  onConfirmApply,
}: {
  record: PkV10Record;
  question: AdminVerifyIssueQuestion;
  draft: string;
  savedValue: string | undefined;
  preview: ResolveAdminAnswerResult | undefined;
  isLoading: boolean;
  errorMessage?: string;
  isApplying: boolean;
  applyErrorMessage?: string;
  isApplied: boolean;
  onDraftChange: (v: string, meta?: { hint?: string; label?: string }) => void;
  onSave: () => void;
  onGeneratePreview: () => void;
  onConfirmApply: () => void;
}) {
  const human = useMemo<HumanizedIssue>(
    () => humanizeIssue(question, record),
    [question, record],
  );
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [extraNote, setExtraNote] = useState<string>("");
  const [techOpen, setTechOpen] = useState(false);

  // PR-22.1 — Fallback for issues without concrete object/context.
  // Render a low-priority debug card. No radio, no LLM preview, no save.
  if (!human.shouldRenderAsAdminQuestion) {
    return (
      <div className="bg-card border border-dashed border-border rounded-xl p-5 space-y-3 opacity-90">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <h5 className="text-sm font-medium text-muted-foreground">
              Catatan sistem (tidak bisa ditanyakan ke admin)
            </h5>
            <p className="text-sm text-foreground">
              Masalah ini belum memiliki konteks yang cukup untuk ditanyakan ke admin.
            </p>
          </div>
          <Badge variant={human.badge.variant} size="sm">
            {human.badge.label}
          </Badge>
        </div>
        <Collapsible open={techOpen} onOpenChange={setTechOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown
                className={`h-3 w-3 transition-transform ${techOpen ? "rotate-180" : ""}`}
              />
              {techOpen ? "Sembunyikan detail teknis" : "Lihat detail teknis"}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 rounded-lg border border-border bg-background/50 px-4 py-3 space-y-1">
              <p className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">
                {question.source_text || "(tidak ada source_text)"}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                severity: {question.severity}
              </p>
              {question.affected_paths.length > 0 && (
                <p className="text-[10px] font-mono text-muted-foreground/70 break-all">
                  {question.affected_paths.join(", ")}
                </p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  }

  // Compose the natural-language answer for the LLM resolver. The internal
  // hint (`value`) is NEVER embedded in answer_text — it travels separately
  // via onDraftChange meta as `selected_internal_hint` (PR-22).
  const composeDraft = (opt: string, note: string): string => {
    if (human.options) {
      if (!opt) return note.trim();
      const lbl = human.options.find((o) => o.value === opt)?.label ?? opt;
      return note.trim() ? `${lbl}. Catatan: ${note.trim()}` : lbl;
    }
    return note.trim();
  };

  const emitDraft = (opt: string, note: string) => {
    const text = composeDraft(opt, note);
    const hint = opt || undefined;
    const label = opt
      ? human.options?.find((o) => o.value === opt)?.label
      : undefined;
    onDraftChange(text, { hint, label, note: note.trim() || undefined });
  };

  const handleOptionChange = (v: string) => {
    setSelectedOption(v);
    emitDraft(v, extraNote);
  };
  const handleNoteChange = (v: string) => {
    setExtraNote(v);
    emitDraft(selectedOption, v);
  };


  const isSaved = typeof savedValue === "string" && savedValue.trim().length > 0;
  const isDirty = draft !== (savedValue ?? "");
  const canSave = draft.trim().length > 0 && isDirty;
  const canPreview = draft.trim().length > 0 && !isLoading;

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <h5 className="text-base font-semibold text-foreground">
            {human.title}
          </h5>
          <p className="text-sm text-muted-foreground">{human.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={human.badge.variant} size="sm">
            {human.badge.label}
          </Badge>
          {isSaved && !isDirty && (
            <Badge variant="success" size="sm">
              <CheckCircle2 className="h-3 w-3" />
              Tersimpan
            </Badge>
          )}
        </div>
      </div>

      {/* PR-22 — Concrete object: source_text / current_value / variant_name */}
      {(human.objectValue || (human.contextLines && human.contextLines.length > 0)) && (
        <div className="rounded-lg border border-border bg-background/50 px-4 py-3 space-y-2">
          {human.objectValue && (
            <>
              {human.objectLabel && (
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {human.objectLabel}
                </p>
              )}
              <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                “{human.objectValue}”
              </p>
            </>
          )}
          {human.contextLines && human.contextLines.length > 0 && (
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
              {human.contextLines.map((c, i) => (
                <div key={i} className="contents">
                  <dt className="text-muted-foreground">{c.key}</dt>
                  <dd className="text-foreground break-words">{c.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {human.options ? (
        <div className="space-y-3">
          <Label className="text-sm font-medium text-foreground">
            {human.mainQuestion}
          </Label>
          <RadioGroup value={selectedOption} onValueChange={handleOptionChange} className="gap-2">
            {human.options.map((opt) => (
              <div
                key={opt.value}
                className="flex items-start gap-3 rounded-lg border border-border bg-background/50 px-4 py-3 hover:border-button-hover transition-colors"
              >
                <RadioGroupItem value={opt.value} id={`${question.task_id}-${opt.value}`} className="mt-0.5" />
                <Label
                  htmlFor={`${question.task_id}-${opt.value}`}
                  className="flex-1 cursor-pointer space-y-0.5"
                >
                  <div className="text-sm font-medium text-foreground">{opt.label}</div>
                  {opt.helper && (
                    <div className="text-xs text-muted-foreground font-normal">{opt.helper}</div>
                  )}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Penjelasan tambahan (opsional)
            </Label>
            <Textarea
              value={extraNote}
              onChange={(e) => handleNoteChange(e.target.value)}
              placeholder="Tambahkan konteks bila perlu…"
              className="min-h-[64px]"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            {human.mainQuestion}
          </Label>
          <Textarea
            value={extraNote}
            onChange={(e) => handleNoteChange(e.target.value)}
            placeholder="Tulis penjelasan singkat dengan kalimat Anda sendiri…"
            className="min-h-[88px]"
          />
        </div>
      )}

      <Collapsible open={techOpen} onOpenChange={setTechOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={`h-3 w-3 transition-transform ${techOpen ? "rotate-180" : ""}`}
            />
            {techOpen ? "Sembunyikan detail teknis" : "Lihat detail teknis"}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 rounded-lg border border-border bg-background/50 px-4 py-3 space-y-1">
            <p className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">
              {question.source_text}
            </p>
            {question.affected_paths.length > 0 && (
              <p className="text-[10px] font-mono text-muted-foreground/70 break-all">
                path: {question.affected_paths.join(", ")}
              </p>
            )}
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
              severity: {question.severity}
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">
          Data promo tidak berubah sebelum Anda menyetujui saran perubahan.
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onSave} disabled={!canSave}>
            Simpan jawaban sementara
          </Button>
          <Button
            size="sm"
            variant="golden"
            onClick={onGeneratePreview}
            disabled={!canPreview}
          >
            {isLoading
              ? "Menyiapkan saran…"
              : errorMessage
                ? "Coba lagi"
                : "Lihat saran perubahan"}
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 space-y-1">
          <p className="text-sm font-medium text-destructive">
            Sistem belum bisa menyiapkan saran perubahan
          </p>
          <p className="text-xs text-destructive/90 break-words">{errorMessage}</p>
          <p className="text-xs text-muted-foreground">
            Data promo tidak berubah. Jawaban Anda tetap tersimpan.
          </p>
        </div>
      )}

      {preview && !errorMessage && (
        <div className="rounded-lg border border-border bg-background/50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h6 className="text-sm font-semibold text-foreground">
              Tinjau saran perubahan di bawah ini
            </h6>
            <Badge
              variant={
                preview.confidence === "high"
                  ? "success"
                  : preview.confidence === "medium"
                    ? "warning"
                    : "pending"
              }
              size="sm"
            >
              {preview.confidence === "high"
                ? "Sistem yakin"
                : preview.confidence === "medium"
                  ? "Cukup yakin"
                  : "Belum yakin"}
            </Badge>
          </div>
          <p className="text-sm text-foreground">{preview.intent_summary}</p>

          {preview.needs_clarification && (
            <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
              <p className="text-xs text-warning-foreground">
                Jawaban masih belum cukup jelas. Mohon pilih salah satu opsi
                atau jelaskan lebih spesifik.
              </p>
            </div>
          )}

          {preview.proposed_patches.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Saran perubahan ({preview.proposed_patches.length})
              </Label>
              {preview.proposed_patches.map((p, idx) => (
                <div
                  key={`${p.target_path}-${idx}`}
                  className="rounded-md border border-border bg-card px-3 py-2 space-y-1"
                >
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <span className="text-destructive line-through break-all">
                      {String(p.old_value_preview ?? "—")}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-success font-medium break-all">
                      {String(p.new_value_preview ?? "—")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.reason}</p>
                  <details className="text-[10px] text-muted-foreground/70">
                    <summary className="cursor-pointer hover:text-muted-foreground">
                      Lihat detail teknis
                    </summary>
                    <p className="font-mono break-all pt-1">{p.target_path}</p>
                  </details>
                </div>
              ))}
            </div>
          )}

          {preview.unresolved_questions && preview.unresolved_questions.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
              {preview.unresolved_questions.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          )}

          {(() => {
            const hasPatches = preview.proposed_patches.length > 0;
            const blocked =
              !hasPatches ||
              !!preview.needs_clarification ||
              preview.confidence === "low" ||
              isApplying ||
              isApplied;
            return (
              <div className="space-y-2 pt-1">
                {applyErrorMessage && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
                    <p className="text-xs font-medium text-destructive">
                      Perubahan tidak dapat disimpan
                    </p>
                    <p className="text-[11px] text-destructive/90 break-words whitespace-pre-wrap">
                      {applyErrorMessage}
                    </p>
                  </div>
                )}
                {isApplied && (
                  <div className="rounded-md border border-success/40 bg-success/10 px-3 py-2">
                    <p className="text-xs font-medium text-success">
                      Perubahan sudah disimpan
                    </p>
                    <p className="text-[11px] text-success/90">
                      Status review masih perlu dicek ulang sebelum publish.
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-end">
                  <Button
                    size="sm"
                    variant="golden"
                    onClick={onConfirmApply}
                    disabled={blocked}
                  >
                    {isApplied
                      ? "Tersimpan"
                      : isApplying
                        ? "Menyimpan…"
                        : "Setujui & Simpan"}
                  </Button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
