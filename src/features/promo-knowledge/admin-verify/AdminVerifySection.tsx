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
import {
  PK_V10_CLAIM_METHOD,
  PK_V10_GEO_RESTRICTION,
  PK_V10_STACKING_POLICY,
  PK_V10_TURNOVER_BASIS,
} from "@/features/promo-knowledge/schema/pk-v10";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import type { PkV10Record } from "@/features/promo-knowledge/schema/pk-v10";
import {
  resolveRecord,
  commitResolverOutput,
  type ResolverOutput,
} from "./question-resolver";

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

const CONFIDENCE_THRESHOLD = 0.7;

// ─────────────────────────────────────────────────────────────────────────
// ANSWER VALUE TYPES — every input is a discrete choice
// ─────────────────────────────────────────────────────────────────────────

/**
 * Choice option visible to admin.
 * `value` is the string we hand to FieldSpec.write().
 * Special sentinel "__custom__" means "admin will type a number/date below".
 */
interface ChoiceOption {
  value: string;
  label: string;
}

interface AdminAnswer {
  choice: string;            // the radio/select value chosen
  customValue?: string;      // for date / number when choice === "__custom__"
  customSelection?: string[];// for multi-select chips
  note?: string;             // optional textarea note (hidden until choice picked)
}

const CUSTOM = "__custom__";
const NONE = "__none__";

type FieldSpec = {
  path: string;
  question: string;          // human-readable, no jargon, no field_path
  inputKind: "radio" | "select-large" | "multi-chip" | "radio-with-date" | "radio-with-number";
  options?: ChoiceOption[];          // for radio / select-large
  multiOptions?: readonly string[];  // for multi-chip
  /** Read current value from record (for Priority B pre-fill display). */
  read: (rec: PkV10Record) => unknown;
  /** Write the chosen answer back into a draft record. */
  write: (draft: PkV10Record, answer: AdminAnswer) => void;
  isCritical: (rec: PkV10Record) => boolean;
};

const isEmpty = (v: unknown): boolean => {
  if (v === null || v === undefined) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
};

// ─────────────────────────────────────────────────────────────────────────
// CRITICAL CLASSIFICATION HELPERS
// ─────────────────────────────────────────────────────────────────────────
const ALWAYS = () => true;
const NEVER = () => false;

const promoTypeOf = (r: PkV10Record): string =>
  (r.identity_engine?.promo_block?.promo_type ?? "").toLowerCase();

const isDepositLike = (r: PkV10Record) => {
  const t = promoTypeOf(r);
  return t.includes("deposit") || t.includes("cashback") || t.includes("rolling");
};
const isUpfront = (r: PkV10Record) =>
  (r.reward_engine?.payout_direction ?? "").toLowerCase() === "upfront";

// ─────────────────────────────────────────────────────────────────────────
// FIELD SPECS — radio-first, no jargon labels
// ─────────────────────────────────────────────────────────────────────────

/** ID label map — Bahasa Indonesia untuk semua opsi enum. */
const ID_LABELS: Record<string, string> = {
  // Stacking policy
  no_stacking: "Tidak bisa digabung",
  stack_with_whitelist: "Bisa digabung (whitelist)",
  stack_freely: "Bisa digabung bebas",
  conditional_stack: "Bersyarat",
  // Claim method
  auto: "Otomatis",
  manual_livechat: "Manual via Livechat",
  manual_whatsapp: "Manual via WhatsApp",
  manual_telegram: "Manual via Telegram",
  in_app_button: "Tombol di Aplikasi",
  form_submission: "Form",
  cs_approval: "Approval CS",
  // Turnover basis
  deposit_only: "Deposit",
  bonus_only: "Bonus",
  deposit_plus_bonus: "Deposit + Bonus",
  total_bet: "Total Taruhan",
  total_loss: "Total Kekalahan",
  // Geo restriction
  indonesia: "Indonesia",
  jakarta: "Jakarta",
  sea: "Asia Tenggara",
  global: "Semua wilayah",
};

/** Fallback: capitalize, strip underscores. */
const naturalize = (s: string): string =>
  s
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

const enumToOptions = (values: readonly string[]): ChoiceOption[] =>
  values.map((v) => ({ value: v, label: ID_LABELS[v] ?? naturalize(v) }));

const FIELD_SPECS: FieldSpec[] = [
  // 1. Validity
  {
    path: "period_engine.validity_block.valid_until",
    question: "Sampai kapan promo ini berlaku?",
    inputKind: "radio-with-date",
    options: [
      { value: "no_expiry", label: "Tidak ada batas waktu" },
      { value: CUSTOM, label: "Tanggal tertentu" },
    ],
    read: (r) => r.period_engine?.validity_block?.valid_until,
    write: (d, a) => {
      d.period_engine.validity_block.valid_until =
        a.choice === "no_expiry" ? null as never : ((a.customValue ?? "") as never);
    },
    isCritical: ALWAYS,
  },

  // 2. Claim method
  {
    path: "claim_engine.method_block.claim_method",
    question: "Bagaimana member mengklaim promo ini?",
    inputKind: "radio",
    options: enumToOptions(PK_V10_CLAIM_METHOD),
    read: (r) => r.claim_engine?.method_block?.claim_method,
    write: (d, a) => {
      d.claim_engine.method_block.claim_method = a.choice;
    },
    isCritical: ALWAYS,
  },

  // 3. Payout direction
  {
    path: "reward_engine.payout_direction",
    question: "Bonus dibayar kapan?",
    inputKind: "radio",
    options: [
      { value: "upfront", label: "Di depan (langsung saat klaim)" },
      { value: "backend", label: "Di belakang (setelah syarat tercapai)" },
    ],
    read: (r) => r.reward_engine?.payout_direction,
    write: (d, a) => {
      d.reward_engine.payout_direction = a.choice;
    },
    isCritical: ALWAYS,
  },

  // 4. Turnover basis
  {
    path: "taxonomy_engine.logic_block.turnover_basis",
    question: "Hitungan turnover dari mana?",
    inputKind: "radio",
    options: enumToOptions(PK_V10_TURNOVER_BASIS),
    read: (r) => r.taxonomy_engine?.logic_block?.turnover_basis,
    write: (d, a) => {
      d.taxonomy_engine.logic_block.turnover_basis = a.choice;
    },
    isCritical: ALWAYS,
  },

  // 5. Stacking
  {
    path: "dependency_engine.stacking_block.stacking_policy",
    question: "Boleh digabung dengan promo lain?",
    inputKind: "radio",
    options: enumToOptions(PK_V10_STACKING_POLICY),
    read: (r) => r.dependency_engine?.stacking_block?.stacking_policy,
    write: (d, a) => {
      d.dependency_engine.stacking_block.stacking_policy = a.choice;
    },
    isCritical: ALWAYS,
  },

  // 6. Min deposit (conditional)
  {
    path: "reward_engine.requirement_block.min_deposit",
    question: "Minimum deposit untuk eligible?",
    inputKind: "radio-with-number",
    options: [
      { value: "0", label: "Tanpa minimum" },
      { value: "25000", label: "25.000" },
      { value: "50000", label: "50.000" },
      { value: "100000", label: "100.000" },
      { value: CUSTOM, label: "Lainnya" },
    ],
    read: (r) => r.reward_engine?.requirement_block?.min_deposit,
    write: (d, a) => {
      const raw = a.choice === CUSTOM ? a.customValue : a.choice;
      d.reward_engine.requirement_block.min_deposit =
        raw === "" || raw === undefined ? null : Number(raw);
    },
    isCritical: isDepositLike,
  },

  // 7. Max reward (conditional)
  {
    path: "reward_engine.max_reward",
    question: "Ada batas maksimum bonus?",
    inputKind: "radio-with-number",
    options: [
      { value: NONE, label: "Tidak ada batas" },
      { value: "100000", label: "100.000" },
      { value: "500000", label: "500.000" },
      { value: "1000000", label: "1.000.000" },
      { value: CUSTOM, label: "Lainnya" },
    ],
    read: (r) => r.reward_engine?.max_reward,
    write: (d, a) => {
      if (a.choice === NONE) {
        d.reward_engine.max_reward = null;
        return;
      }
      const raw = a.choice === CUSTOM ? a.customValue : a.choice;
      d.reward_engine.max_reward =
        raw === "" || raw === undefined ? null : Number(raw);
    },
    isCritical: isUpfront,
  },

  // 8. Eligible providers — moved to dedicated ProviderVerifyCard (custom flow).
  //    See PROVIDER_FIELD_PATH constant + ProviderVerifyCard component below.

  // 9. Geo restriction (conditional)
  {
    path: "scope_engine.geo_block.geo_restriction",
    question: "Berlaku untuk wilayah mana?",
    inputKind: "select-large",
    options: enumToOptions(PK_V10_GEO_RESTRICTION),
    read: (r) => r.scope_engine?.geo_block?.geo_restriction,
    write: (d, a) => {
      d.scope_engine.geo_block.geo_restriction = a.choice;
    },
    // Critical only if there's already a non-empty hint (i.e. extractor flagged it)
    isCritical: (r) => !isEmpty(r.scope_engine?.geo_block?.geo_restriction),
  },

  // 10. Void conditions — never critical at Admin Verify
  // (kept out of FIELD_SPECS intentionally per locked spec)
];

// ─────────────────────────────────────────────────────────────────────────
// QUESTION GENERATOR (priority-based)
// ─────────────────────────────────────────────────────────────────────────

type Priority = "A" | "B";

interface GeneratedQuestion {
  spec: FieldSpec;
  priority: Priority;
  currentValue: unknown;
  /** AI draft pre-fill for Priority B (string match against an option). */
  prefillChoice?: string;
}

function generateQuestions(
  record: PkV10Record,
  skipPaths: Set<string>,
): GeneratedQuestion[] {
  const status = record._field_status ?? {};
  const conf = record.ai_confidence ?? {};
  const out: GeneratedQuestion[] = [];

  for (const spec of FIELD_SPECS) {
    // Resolver handled this field — skip the question entirely
    if (skipPaths.has(spec.path)) continue;

    const val = spec.read(record);
    const empty = isEmpty(val);
    const fStatus = status[spec.path];
    const fConf = conf[spec.path];

    // Priority A — critical AND empty
    if (empty) {
      if (spec.isCritical(record)) {
        out.push({ spec, priority: "A", currentValue: val });
      }
      // Non-critical empty → ignored (no Priority A, no Priority B trigger)
      continue;
    }

    // Priority B — has value but low confidence or inferred
    const lowConf = typeof fConf === "number" && fConf < CONFIDENCE_THRESHOLD;
    const inferred = fStatus === "inferred";
    if (lowConf || inferred) {
      out.push({
        spec,
        priority: "B",
        currentValue: val,
        prefillChoice: typeof val === "string" ? val : undefined,
      });
    }
  }

  // A first, B after; preserve declared order within priority
  return out.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "A" ? -1 : 1));
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
 * Trigger condition:
 *   - game_domain empty                                 → no card
 *   - eligible_providers filled                         → no card
 *   - eligible empty + blacklist empty  → show "all vs custom" radio
 *   - eligible empty + blacklist filled → show custom mode prefilled (review)
 */
function evaluateProviderTrigger(record: PkV10Record): {
  show: boolean;
  domain: string;
  prefilledBlacklist: string[];
  initialMode: ProviderMode;
} {
  const domain = (record.scope_engine?.game_block?.game_domain ?? "").trim();
  const whitelist = record.scope_engine?.game_block?.eligible_providers ?? [];
  const blacklist = record.scope_engine?.blacklist_block?.providers ?? [];

  if (!domain) return { show: false, domain, prefilledBlacklist: [], initialMode: "" };
  if (whitelist.length > 0)
    return { show: false, domain, prefilledBlacklist: [], initialMode: "" };

  if (blacklist.length > 0) {
    return { show: true, domain, prefilledBlacklist: blacklist, initialMode: "custom" };
  }
  return { show: true, domain, prefilledBlacklist: [], initialMode: "" };
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

  const resolverOutput = useMemo<ResolverOutput>(
    () =>
      record
        ? resolveRecord(record)
        : { skipPaths: new Set(), pendingEntries: [], pendingValuePatches: [] },
    [record],
  );

  const questions = useMemo<GeneratedQuestion[]>(
    () => (record ? generateQuestions(record, resolverOutput.skipPaths) : []),
    [record, resolverOutput],
  );

  if (!record) return null;

  const answeredCount = Object.values(answers).filter((a) => a && a.choice).length;
  const criticalQuestions = questions.filter((q) => q.priority === "A");
  const unansweredCritical = criticalQuestions.filter((q) => !answers[q.spec.path]?.choice);
  const hasResolverPending =
    resolverOutput.pendingEntries.length > 0 ||
    resolverOutput.pendingValuePatches.length > 0;
  // Provider verify is "answered" when admin picked "all" OR picked "custom" with at least 1 whitelist provider
  const providerAnswered =
    providerTrigger.show &&
    (providerState.mode === "all" ||
      (providerState.mode === "custom" && providerState.whitelist.length > 0));
  const providerPendingRequired = providerTrigger.show && !providerAnswered;
  // Hybrid: Apply enabled if (admin answered AND no critical missing) OR resolver has pending output
  const canApply =
    ((answeredCount > 0 || providerAnswered) &&
      unansweredCritical.length === 0 &&
      !providerPendingRequired) ||
    (hasResolverPending && !providerPendingRequired);

  // Empty state — only when truly nothing to do
  if (questions.length === 0 && !hasResolverPending && !providerTrigger.show) {
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
    if (providerTrigger.show && providerAnswered) {
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

    // Atomic commit: apply resolver patches + append _ai_resolver_log
    // (after admin answers so admin choice always wins on shared paths — though
    //  resolver paths are excluded from FIELD_SPECS via skipPaths, so no overlap)
    commitResolverOutput(draft, resolverOutput, ts);

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
        {providerTrigger.show && (
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
            number={idx + 1 + (providerTrigger.show ? 1 : 0)}
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
  question: GeneratedQuestion;
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
          <Badge variant={priority === "A" ? "destructive" : "warning"} size="sm">
            {priority === "A" ? "Wajib" : "Konfirmasi"}
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
  question: GeneratedQuestion;
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
