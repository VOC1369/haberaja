/**
 * CLAIM ENGINE FORM — first vertical slice (hardcoded, intentionally).
 *
 * Schema-driven renderer is deferred until pattern is clear from real usage
 * (Build Principle #2 from prompt). This form mirrors Schema V.06 §4.9
 * structure 1:1 across 4 blocks.
 *
 * Validation runs on every change AND on submit. Severity colors come from
 * design tokens (no raw colors).
 */

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  CLAIM_METHOD_ENUM,
  CLAIM_CHANNEL_ENUM,
  PROOF_TYPE_ENUM,
  PROOF_DESTINATION_ENUM,
  type ClaimEngine,
  type ClaimChannel,
  type ProofType,
  type ProofDestination,
  type ClaimMethod,
} from "../schema/pk-06.0";
import type { ValidationReport } from "../validator";

interface Props {
  value: ClaimEngine;
  onChange: (next: ClaimEngine) => void;
  validation: ValidationReport;
  aiConfidence: Record<string, number>;
}

function ConfidencePill({ score }: { score?: number }) {
  if (score === undefined) return null;
  const pct = Math.round(score * 100);
  const tone =
    score >= 0.85
      ? "bg-primary/15 text-primary border-primary/30"
      : score >= 0.6
        ? "bg-secondary text-secondary-foreground border-border"
        : "bg-destructive/15 text-destructive border-destructive/30";
  return (
    <span
      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${tone}`}
      title={`AI confidence: ${pct}%`}
    >
      {pct}%
    </span>
  );
}

function FieldIssues({ path, validation }: { path: string; validation: ValidationReport }) {
  const here = validation.issues.filter((i) => i.path === path);
  if (here.length === 0) return null;
  return (
    <div className="space-y-0.5 mt-1">
      {here.map((i, idx) => (
        <p
          key={idx}
          className={
            i.severity === "error"
              ? "text-xs text-destructive"
              : i.severity === "warning"
                ? "text-xs text-warning"
                : "text-xs text-muted-foreground"
          }
        >
          {i.severity.toUpperCase()}: {i.message}
        </p>
      ))}
    </div>
  );
}

export function ClaimEngineForm({ value, onChange, validation, aiConfidence }: Props) {
  const set = <K extends keyof ClaimEngine>(block: K, patch: Partial<ClaimEngine[K]>) =>
    onChange({ ...value, [block]: { ...value[block], ...patch } });

  const channelToggle = (c: ClaimChannel, on: boolean) => {
    const cur = value.channels_block.channels;
    const next = on ? Array.from(new Set([...cur, c])) : cur.filter((x) => x !== c);
    // priority_order auto-prune
    const prio = value.channels_block.priority_order.filter((p) => next.includes(p));
    set("channels_block", { channels: next, priority_order: prio });
  };

  const priorityToggle = (c: ClaimChannel, on: boolean) => {
    const cur = value.channels_block.priority_order;
    const next = on ? Array.from(new Set([...cur, c])) : cur.filter((x) => x !== c);
    set("channels_block", { priority_order: next });
  };

  const proofTypeToggle = (t: ProofType, on: boolean) => {
    const cur = value.proof_requirement_block.proof_types;
    const next = on ? Array.from(new Set([...cur, t])) : cur.filter((x) => x !== t);
    set("proof_requirement_block", { proof_types: next });
  };

  const proofDestToggle = (d: ProofDestination, on: boolean) => {
    const cur = value.proof_requirement_block.proof_destinations;
    const next = on ? Array.from(new Set([...cur, d])) : cur.filter((x) => x !== d);
    set("proof_requirement_block", { proof_destinations: next });
  };

  const stepsText = useMemo(() => value.instruction_block.claim_steps.join("\n"), [value.instruction_block.claim_steps]);

  return (
    <div className="space-y-4">
      {/* method_block */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            method_block
            <Badge variant="outline" className="text-[10px] font-mono">block</Badge>
          </CardTitle>
          <CardDescription>Schema V.06 §4.9 — claim method + auto-credit flag</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label htmlFor="claim_method">claim_method</Label>
              <ConfidencePill score={aiConfidence["claim_engine.method_block.claim_method"]} />
            </div>
            <Select
              value={value.method_block.claim_method || undefined}
              onValueChange={(v) => set("method_block", { claim_method: v as ClaimMethod })}
            >
              <SelectTrigger id="claim_method">
                <SelectValue placeholder="-- pilih method --" />
              </SelectTrigger>
              <SelectContent>
                {CLAIM_METHOD_ENUM.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldIssues path="claim_engine.method_block.claim_method" validation={validation} />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label htmlFor="auto_credit" className="cursor-pointer">auto_credit</Label>
              <p className="text-xs text-muted-foreground">Bonus auto kredit tanpa intervensi manual.</p>
            </div>
            <div className="flex items-center gap-2">
              <ConfidencePill score={aiConfidence["claim_engine.method_block.auto_credit"]} />
              <Switch
                id="auto_credit"
                checked={value.method_block.auto_credit}
                onCheckedChange={(c) => set("method_block", { auto_credit: c })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* channels_block */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            channels_block
            <Badge variant="outline" className="text-[10px] font-mono">block</Badge>
          </CardTitle>
          <CardDescription>Channels yang menerima klaim. Priority order = subset urutan tunggal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>channels</Label>
              <ConfidencePill score={aiConfidence["claim_engine.channels_block.channels"]} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {CLAIM_CHANNEL_ENUM.map((c) => {
                const on = value.channels_block.channels.includes(c);
                return (
                  <label key={c} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 cursor-pointer hover:bg-muted/50">
                    <Checkbox checked={on} onCheckedChange={(v) => channelToggle(c, !!v)} />
                    <span className="text-xs">{c}</span>
                  </label>
                );
              })}
            </div>
            <FieldIssues path="claim_engine.channels_block.channels" validation={validation} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>priority_order (subset of channels)</Label>
              <ConfidencePill score={aiConfidence["claim_engine.channels_block.priority_order"]} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {value.channels_block.channels.length === 0 ? (
                <p className="text-xs text-muted-foreground col-span-full">Pilih channels dulu.</p>
              ) : (
                value.channels_block.channels.map((c) => {
                  const on = value.channels_block.priority_order.includes(c);
                  return (
                    <label key={c} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 cursor-pointer hover:bg-muted/50">
                      <Checkbox checked={on} onCheckedChange={(v) => priorityToggle(c, !!v)} />
                      <span className="text-xs">{c}</span>
                    </label>
                  );
                })
              )}
            </div>
            <FieldIssues path="claim_engine.channels_block.priority_order" validation={validation} />
          </div>
        </CardContent>
      </Card>

      {/* proof_requirement_block */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            proof_requirement_block
            <Badge variant="outline" className="text-[10px] font-mono">block</Badge>
          </CardTitle>
          <CardDescription>Cross-field rule: proof_required=true ⇒ proof_types[] tidak boleh kosong.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label htmlFor="proof_required" className="cursor-pointer">proof_required</Label>
              <p className="text-xs text-muted-foreground">Wajib mengirim bukti saat klaim.</p>
            </div>
            <div className="flex items-center gap-2">
              <ConfidencePill score={aiConfidence["claim_engine.proof_requirement_block.proof_required"]} />
              <Switch
                id="proof_required"
                checked={value.proof_requirement_block.proof_required}
                onCheckedChange={(c) => set("proof_requirement_block", { proof_required: c })}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>proof_types</Label>
              <ConfidencePill score={aiConfidence["claim_engine.proof_requirement_block.proof_types"]} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {PROOF_TYPE_ENUM.map((t) => {
                const on = value.proof_requirement_block.proof_types.includes(t);
                return (
                  <label key={t} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 cursor-pointer hover:bg-muted/50">
                    <Checkbox checked={on} onCheckedChange={(v) => proofTypeToggle(t, !!v)} />
                    <span className="text-xs">{t}</span>
                  </label>
                );
              })}
            </div>
            <FieldIssues path="claim_engine.proof_requirement_block.proof_types" validation={validation} />
          </div>

          <div>
            <Label className="mb-2 block">proof_destinations</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {PROOF_DESTINATION_ENUM.map((d) => {
                const on = value.proof_requirement_block.proof_destinations.includes(d);
                return (
                  <label key={d} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 cursor-pointer hover:bg-muted/50">
                    <Checkbox checked={on} onCheckedChange={(v) => proofDestToggle(d, !!v)} />
                    <span className="text-xs">{d}</span>
                  </label>
                );
              })}
            </div>
            <FieldIssues path="claim_engine.proof_requirement_block.proof_destinations" validation={validation} />
          </div>
        </CardContent>
      </Card>

      {/* instruction_block */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            instruction_block
            <Badge variant="outline" className="text-[10px] font-mono">block</Badge>
          </CardTitle>
          <CardDescription>Langkah-langkah klaim + URL referensi.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="claim_steps" className="mb-1.5 block">claim_steps (one per line)</Label>
            <Textarea
              id="claim_steps"
              rows={4}
              value={stepsText}
              onChange={(e) =>
                set("instruction_block", {
                  claim_steps: e.target.value.split("\n").map((s) => s.trimEnd()).filter((s) => s.length > 0),
                })
              }
              placeholder={"Login ke akun\nHubungi Livechat\n..."}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label htmlFor="claim_url">claim_url</Label>
              <ConfidencePill score={aiConfidence["claim_engine.instruction_block.claim_url"]} />
            </div>
            <Input
              id="claim_url"
              type="url"
              value={value.instruction_block.claim_url}
              onChange={(e) => set("instruction_block", { claim_url: e.target.value })}
              placeholder="https://..."
            />
            <FieldIssues path="claim_engine.instruction_block.claim_url" validation={validation} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
