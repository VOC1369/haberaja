/**
 * ADMIN VERIFY SECTION — Phase 1
 *
 * Auto-generates targeted questions from a PkV10Record using:
 *   Priority A — value missing OR _field_status === "not_stated"
 *   Priority B — _field_status === "inferred" OR ai_confidence < 0.7
 *   (Priority C — ambiguity — DEFERRED to Phase 2)
 *
 * Admin answers are kept in local state. On "Terapkan Jawaban":
 *   - merged into a deep-cloned PkV10Record
 *   - _field_status[path] := "explicit"  (closest existing enum; gap noted)
 *   - ai_confidence[path] removed
 *   - updated_at bumped
 *   - parent receives the new record via onApply (NO auto-save)
 *
 * Hard rules:
 *   - No parser/extractor changes
 *   - No new schema enums invented
 *   - Reuses existing UI primitives only
 */

import { useMemo, useState } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PK_V10_CLAIM_METHOD,
  PK_V10_PAYOUT_DIRECTION,
  PK_V10_GAME_PROVIDER,
  PK_V10_GEO_RESTRICTION,
  PK_V10_STACKING_POLICY,
  PK_V10_VOID_TRIGGER,
  PK_V10_TURNOVER_BASIS,
} from "@/features/promo-knowledge/schema/pk-v10";
import type { PkV10Record } from "@/features/promo-knowledge/schema/pk-v10";

// Threshold mirror dari schema (PK_V10_AI_CONFIDENCE_QUESTION_THRESHOLD = 0.7)
const CONFIDENCE_THRESHOLD = 0.7;

type Priority = "A" | "B";
type InputKind = "text" | "number" | "date" | "select" | "multi-csv";

interface FieldSpec {
  path: string;                 // dot/bracket path used as key for _field_status & ai_confidence
  label: string;                // Field label (engine — block.field)
  question: string;             // Short question for admin
  kind: InputKind;
  enumOptions?: readonly string[];
  /** Read current value from record */
  read: (rec: PkV10Record) => unknown;
  /** Write parsed answer into a draft record (mutates draft) */
  write: (draft: PkV10Record, value: unknown) => void;
  /** Custom emptiness check; defaults to null/""/[] */
  isEmpty?: (v: unknown) => boolean;
}

const isEmptyDefault = (v: unknown): boolean => {
  if (v === null || v === undefined) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
};

// ─────────────────────────────────────────────────────────────────────────
// FIELD MAPPING — 10 priority fields (paths verified against pk-v10.ts)
// ─────────────────────────────────────────────────────────────────────────
const FIELD_SPECS: FieldSpec[] = [
  {
    path: "period_engine.validity_block.valid_until",
    label: "period_engine — validity.valid_until",
    question: "Sampai kapan promo ini berlaku? (ISO date, mis. 2026-12-31)",
    kind: "date",
    read: (r) => r.period_engine?.validity_block?.valid_until,
    write: (d, v) => {
      d.period_engine.validity_block.valid_until = (v as string) || null as never;
    },
  },
  {
    path: "claim_engine.method_block.claim_method",
    label: "claim_engine — method.claim_method",
    question: "Bagaimana admin/member mengklaim promo ini?",
    kind: "select",
    enumOptions: PK_V10_CLAIM_METHOD,
    read: (r) => r.claim_engine?.method_block?.claim_method,
    write: (d, v) => {
      d.claim_engine.method_block.claim_method = String(v ?? "");
    },
  },
  {
    path: "reward_engine.payout_direction",
    label: "reward_engine — payout_direction",
    question: "Bonus dibayar di depan (upfront) atau di belakang (backend)?",
    kind: "select",
    enumOptions: PK_V10_PAYOUT_DIRECTION,
    read: (r) => r.reward_engine?.payout_direction,
    write: (d, v) => {
      d.reward_engine.payout_direction = String(v ?? "");
    },
  },
  {
    path: "scope_engine.game_block.eligible_providers",
    label: "scope_engine — game.eligible_providers",
    question: "Provider game mana saja yang eligible? (pisahkan koma)",
    kind: "multi-csv",
    enumOptions: PK_V10_GAME_PROVIDER,
    read: (r) => r.scope_engine?.game_block?.eligible_providers,
    write: (d, v) => {
      d.scope_engine.game_block.eligible_providers = v as string[];
    },
  },
  {
    path: "scope_engine.geo_block.geo_restriction",
    label: "scope_engine — geo.geo_restriction",
    question: "Pembatasan geografis promo?",
    kind: "select",
    enumOptions: PK_V10_GEO_RESTRICTION,
    read: (r) => r.scope_engine?.geo_block?.geo_restriction,
    write: (d, v) => {
      d.scope_engine.geo_block.geo_restriction = String(v ?? "");
    },
  },
  {
    path: "dependency_engine.stacking_block.stacking_policy",
    label: "dependency_engine — stacking.stacking_policy",
    question: "Promo ini boleh di-stack dengan promo lain?",
    kind: "select",
    enumOptions: PK_V10_STACKING_POLICY,
    read: (r) => r.dependency_engine?.stacking_block?.stacking_policy,
    write: (d, v) => {
      d.dependency_engine.stacking_block.stacking_policy = String(v ?? "");
    },
  },
  {
    path: "invalidation_engine.void_conditions_block",
    label: "invalidation_engine — void_conditions",
    question: "Trigger void / blacklist yang berlaku? (pisahkan koma — nama trigger saja)",
    kind: "multi-csv",
    enumOptions: PK_V10_VOID_TRIGGER,
    read: (r) =>
      (r.invalidation_engine?.void_conditions_block ?? []).map((c) => c?.trigger_name).filter(Boolean),
    write: (d, v) => {
      const names = (v as string[]) ?? [];
      d.invalidation_engine.void_conditions_block = names.map((n) => ({
        trigger_name: n,
        trigger_type: "",
        trigger_evidence: "",
        detection_method: "",
        consequence: "",
      }));
    },
  },
  {
    path: "reward_engine.requirement_block.min_deposit",
    label: "reward_engine — requirement.min_deposit",
    question: "Minimum deposit untuk eligible? (IDR, angka saja)",
    kind: "number",
    read: (r) => r.reward_engine?.requirement_block?.min_deposit,
    write: (d, v) => {
      d.reward_engine.requirement_block.min_deposit =
        v === "" || v === null || v === undefined ? null : Number(v);
    },
  },
  {
    path: "taxonomy_engine.logic_block.turnover_basis",
    label: "taxonomy_engine — logic.turnover_basis",
    question: "Basis perhitungan turnover (TO)?",
    kind: "select",
    enumOptions: PK_V10_TURNOVER_BASIS,
    read: (r) => r.taxonomy_engine?.logic_block?.turnover_basis,
    write: (d, v) => {
      d.taxonomy_engine.logic_block.turnover_basis = String(v ?? "");
    },
  },
  {
    path: "reward_engine.max_reward",
    label: "reward_engine — max_reward",
    question: "Reward maksimal (cap)? (IDR, kosongkan jika tidak ada)",
    kind: "number",
    read: (r) => r.reward_engine?.max_reward,
    write: (d, v) => {
      d.reward_engine.max_reward =
        v === "" || v === null || v === undefined ? null : Number(v);
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────
// QUESTION GENERATOR
// ─────────────────────────────────────────────────────────────────────────

interface GeneratedQuestion {
  spec: FieldSpec;
  priority: Priority;
  reason: string;
  currentValue: unknown;
}

function generateQuestions(record: PkV10Record): GeneratedQuestion[] {
  const status = record._field_status ?? {};
  const conf = record.ai_confidence ?? {};
  const out: GeneratedQuestion[] = [];

  for (const spec of FIELD_SPECS) {
    const val = spec.read(record);
    const isEmpty = (spec.isEmpty ?? isEmptyDefault)(val);
    const fieldStatus = status[spec.path];
    const fieldConf = conf[spec.path];

    // Priority A — wajib
    if (isEmpty || fieldStatus === "not_stated") {
      out.push({
        spec,
        priority: "A",
        reason: isEmpty ? "value kosong" : "field_status: not_stated",
        currentValue: val,
      });
      continue;
    }

    // Priority B — perlu konfirmasi
    if (
      fieldStatus === "inferred" ||
      (typeof fieldConf === "number" && fieldConf < CONFIDENCE_THRESHOLD)
    ) {
      const reason =
        fieldStatus === "inferred"
          ? "field_status: inferred"
          : `ai_confidence ${fieldConf?.toFixed(2)} < ${CONFIDENCE_THRESHOLD}`;
      out.push({ spec, priority: "B", reason, currentValue: val });
    }
  }

  // Sort: A before B, preserve mapping order within priority
  return out.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "A" ? -1 : 1));
}

// ─────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────

export interface AdminVerifySectionProps {
  record: PkV10Record | null;
  onApply: (next: PkV10Record) => void;
}

export function AdminVerifySection({ record, onApply }: AdminVerifySectionProps) {
  const [adminAnswers, setAdminAnswers] = useState<Record<string, unknown>>({});

  const questions = useMemo<GeneratedQuestion[]>(() => {
    if (!record) return [];
    return generateQuestions(record);
  }, [record]);

  if (!record) return null;

  const answeredCount = Object.values(adminAnswers).filter(
    (v) => !isEmptyDefault(v),
  ).length;

  // Empty state — clean & compact
  if (questions.length === 0) {
    return (
      <Card className="p-4 border-border bg-card/60">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-success" />
          <span className="font-medium text-foreground">Verifikasi Admin</span>
          <span>· Tidak ada verifikasi tambahan.</span>
        </div>
      </Card>
    );
  }

  const handleAnswerChange = (path: string, value: unknown) => {
    setAdminAnswers((prev) => ({ ...prev, [path]: value }));
  };

  const handleApply = () => {
    // Deep clone (record is plain JSON-shaped data)
    const draft: PkV10Record = JSON.parse(JSON.stringify(record));
    draft._field_status = { ...(draft._field_status ?? {}) };
    draft.ai_confidence = { ...(draft.ai_confidence ?? {}) };

    // Sidecar audit log — root-level, append-only.
    // Pola konsisten dengan `_field_status` & `ai_confidence` (governance, bukan engine).
    // Type cast lokal: schema V10 status "locked" — tidak menyentuh interface PkV10Record.
    const draftAny = draft as PkV10Record & { _human_override_log?: HumanOverrideEntry[] };
    const existingLog: HumanOverrideEntry[] = Array.isArray(draftAny._human_override_log)
      ? [...draftAny._human_override_log]
      : [];
    const ts = new Date().toISOString();

    for (const q of questions) {
      const raw = adminAnswers[q.spec.path];
      if (isEmptyDefault(raw)) continue;

      const previousValue = q.spec.read(draft);
      q.spec.write(draft, raw);
      const newValue = q.spec.read(draft);

      draft._field_status[q.spec.path] = "explicit";
      delete draft.ai_confidence[q.spec.path];

      // Append-only — semua jawaban admin dilog (mengisi kosong / replace / fix typo)
      existingLog.push({
        field_path: q.spec.path,
        previous_value: previousValue ?? null,
        new_value: newValue ?? null,
        overridden_by: "admin",
        timestamp: ts,
      });
    }

    draftAny._human_override_log = existingLog;
    draft.updated_at = ts;
    onApply(draft);
    setAdminAnswers({});
  };

  const handleSkip = () => setAdminAnswers({});

  return (
    <Card className="p-4 border-border bg-card/60 space-y-3">
      {/* Header — kept low-key vs main extraction card */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Verifikasi Admin</h3>
          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
            {questions.length} pertanyaan
          </Badge>
          {answeredCount > 0 && (
            <Badge className="bg-success/15 text-success border-0 text-[10px] font-mono px-1.5 py-0">
              {answeredCount} terisi
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Phase 1 · jawaban di-merge ke draft, tidak auto-save
        </p>
      </div>

      {/* Question rows */}
      <div className="space-y-2">
        {questions.map((q) => {
          const answered = !isEmptyDefault(adminAnswers[q.spec.path]);
          const Icon = q.priority === "A" ? AlertCircle : AlertTriangle;
          const priColor =
            q.priority === "A" ? "text-destructive" : "text-warning";

          return (
            <div
              key={q.spec.path}
              className="rounded-md border border-border bg-background/40 p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${priColor}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground truncate">
                        {q.spec.label}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 py-0 ${priColor} border-current`}
                      >
                        {q.priority === "A" ? "wajib" : "konfirmasi"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{q.reason}</span>
                    </div>
                    <p className="text-xs text-foreground mt-1">{q.spec.question}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      current:{" "}
                      <span className="font-mono">
                        {isEmptyDefault(q.currentValue)
                          ? "—"
                          : Array.isArray(q.currentValue)
                            ? `[${(q.currentValue as unknown[]).join(", ")}]`
                            : String(q.currentValue)}
                      </span>
                    </p>
                  </div>
                </div>
                {answered ? (
                  <Badge className="bg-success/15 text-success border-0 text-[10px] gap-1 shrink-0">
                    <CheckCircle2 className="w-3 h-3" /> answered
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-muted-foreground border-border shrink-0"
                  >
                    pending
                  </Badge>
                )}
              </div>

              {/* Input control */}
              <QuestionInput
                spec={q.spec}
                value={adminAnswers[q.spec.path]}
                onChange={(v) => handleAnswerChange(q.spec.path, v)}
              />
            </div>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={handleSkip} disabled={answeredCount === 0}>
          Lewati Dulu
        </Button>
        <Button size="sm" onClick={handleApply} disabled={answeredCount === 0}>
          Terapkan Jawaban {answeredCount > 0 ? `(${answeredCount})` : ""}
        </Button>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// INPUT CONTROL (auto-pick by kind)
// ─────────────────────────────────────────────────────────────────────────

function QuestionInput({
  spec,
  value,
  onChange,
}: {
  spec: FieldSpec;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (spec.kind === "select" && spec.enumOptions) {
    const v = typeof value === "string" ? value : "";
    return (
      <Select value={v} onValueChange={(val) => onChange(val)}>
        <SelectTrigger className="h-9 text-xs">
          <SelectValue placeholder="Pilih nilai…" />
        </SelectTrigger>
        <SelectContent>
          {spec.enumOptions.map((opt) => (
            <SelectItem key={opt} value={opt} className="text-xs font-mono">
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (spec.kind === "multi-csv") {
    const v = Array.isArray(value) ? (value as string[]).join(", ") : "";
    return (
      <Textarea
        value={v}
        placeholder={
          spec.enumOptions
            ? `mis. ${spec.enumOptions.slice(0, 3).join(", ")}…`
            : "pisahkan koma"
        }
        onChange={(e) => {
          const parts = e.target.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          onChange(parts);
        }}
        className="min-h-[60px] text-xs font-mono"
      />
    );
  }

  if (spec.kind === "number") {
    const v = value === null || value === undefined ? "" : String(value);
    return (
      <Input
        type="number"
        value={v}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        placeholder="angka saja"
        className="h-9 text-xs"
      />
    );
  }

  // text / date — date picker tidak ada, fallback ke text (sesuai brief)
  const v = typeof value === "string" ? value : "";
  return (
    <Input
      type={spec.kind === "date" ? "date" : "text"}
      value={v}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 text-xs"
    />
  );
}
