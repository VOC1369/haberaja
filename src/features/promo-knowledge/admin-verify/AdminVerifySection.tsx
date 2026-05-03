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
import { ShieldCheck, CheckCircle2 } from "lucide-react";
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
import { readGapsFromJson, type GapQuestion } from "./gap-reader";

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
// generateQuestions removed — replaced by readGapsFromJson (./gap-reader).

/** Render-time view: GapQuestion joined with its UI descriptor. */
type RenderQuestion = GapQuestion & { spec: FieldRegistryEntry };

const isEmpty = (v: unknown): boolean => {
  if (v === null || v === undefined) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
};

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
 * required state. Use `readGapsFromJson(record)` instead.
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

  const providerTrigger = useMemo(
    () =>
      record
        ? evaluateProviderTrigger(record)
        : { show: false, domain: "", prefilledBlacklist: [] as string[], initialMode: "" as ProviderMode },
    [record],
  );
  const triggerKey = `${providerTrigger.show}|${providerTrigger.domain}|${providerTrigger.prefilledBlacklist.join(",")}|${providerTrigger.initialMode}`;
  const [providerState, setProviderState] = useState<ProviderState>({
    mode: providerTrigger.initialMode,
    whitelist: [],
    blacklist: [...providerTrigger.prefilledBlacklist],
  });
  // Reset when underlying record changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    setProviderState({
      mode: providerTrigger.initialMode,
      whitelist: [],
      blacklist: [...providerTrigger.prefilledBlacklist],
    });
  }, [triggerKey]);

  const normalizerOutput = useMemo<NormalizerOutput>(
    () =>
      record
        ? normalizeRecord(record)
        : { pendingEntries: [], pendingValuePatches: [] },
    [record],
  );

  // Provider card visibility is owned solely by the JSON-driven trigger.
  // Resolver-based skipPaths override has been retired (see enum-normalizer.ts).
  const showProviderCard = providerTrigger.show;

  // GapQuestion (JSON-driven) joined with FieldRegistryEntry for UI rendering.
  // No resolver overrides — gap-reader is the single source of truth.
  const questions = useMemo<RenderQuestion[]>(() => {
    if (!record) return [];
    const gaps = readGapsFromJson(record);
    const out: RenderQuestion[] = [];
    for (const g of gaps) {
      const spec = FIELD_REGISTRY_INDEX.get(g.path);
      if (!spec) continue;
      out.push({ ...g, spec });
    }
    const rank: Record<string, number> = { blocker: 0, confirm: 1, optional: 2 };
    return out.sort((a, b) => rank[a.priority] - rank[b.priority]);
  }, [record]);

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
  const providerPendingRequired = showProviderCard && !providerAnswered;
  // Apply enabled if (admin answered AND no critical missing) OR normalizer has pending enum patches
  const canApply =
    ((answeredCount > 0 || providerAnswered) &&
      unansweredCritical.length === 0 &&
      !providerPendingRequired) ||
    (hasNormalizerPending && !providerPendingRequired);

  // Empty state — only when truly nothing to do
  if (questions.length === 0 && !hasNormalizerPending && !showProviderCard) {
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

      const entry: HumanOverrideEntry = {
        field_path: q.spec.path,
        previous_value: previousValue ?? null,
        new_value: newValue ?? null,
        previous_ai_confidence: previousAiConfidence,
        previous_field_status: previousFieldStatus,
        overridden_by: "admin",
        timestamp: ts,
      };
      if (a.note && a.note.trim()) entry.admin_note = a.note.trim();
      log.push(entry);
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

    draft.updated_at = ts;
    onApply(draft);
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
            {criticalQuestions.length > 0
              ? `${criticalQuestions.length} pertanyaan wajib dijawab. ${
                  questions.length - criticalQuestions.length
                } konfirmasi opsional.`
              : `${questions.length} pertanyaan konfirmasi opsional.`}
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
        {showProviderCard && (
          <ProviderVerifyCard
            domain={providerTrigger.domain}
            prefilledFromBlacklist={providerTrigger.prefilledBlacklist.length > 0}
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
        onValueChange={(v) => onChange({ choice: v, customValue: v === CUSTOM ? answer?.customValue : undefined })}
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PROVIDER VERIFY CARD — custom block (V10 paths only, no hardcoded list)
// ─────────────────────────────────────────────────────────────────────────

function ProviderVerifyCard({
  domain,
  prefilledFromBlacklist,
  state,
  onChange,
}: {
  domain: string;
  prefilledFromBlacklist: boolean;
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
          <Badge variant="destructive" size="sm">
            Wajib
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
