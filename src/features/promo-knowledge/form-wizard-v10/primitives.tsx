/**
 * Phase 1 — Reusable UI primitives for V.10.1 Form Wizard skeleton.
 * Pure presentation. No schema validation, no storage.
 *
 * PR-3A visual polish only:
 *   - card rhythm aligned with V.09 visual language (dark + yellow accent)
 *   - tighter typography hierarchy
 *   - responsive 2-column grid wrapper for short fields
 *   - radio card option polish
 *   - NO prop signature changes, NO behavior changes.
 */
import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="p-6 space-y-5 bg-card border-border shadow-sm">
      <div className="border-b border-border/60 pb-3">
        <h3 className="text-base font-semibold text-foreground tracking-tight">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>}
      </div>
      <div className="space-y-5">{children}</div>
    </Card>
  );
}

/**
 * FieldGrid — responsive 2-column wrapper for short fields.
 * Drop full-width children directly outside this wrapper (textarea, lists, builders).
 */
export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">{children}</div>;
}

export function Field({ label, hint, path, children }: { label: string; hint?: string; path?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-sm font-medium">{label}</Label>
        {path && <code className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-[60%]">{path}</code>}
      </div>
      {children}
      {hint && <p className="text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

export function TextField(props: {
  label: string; path?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <Field label={props.label} path={props.path}>
      <Input
        type={props.type || "text"}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
      />
    </Field>
  );
}

export function SelectField(props: {
  label: string; path?: string; value: string;
  onChange: (v: string) => void;
  options: Record<string, string>;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Field label={props.label} path={props.path}>
      <Select value={props.value || undefined} onValueChange={props.onChange} disabled={props.disabled}>
        <SelectTrigger><SelectValue placeholder={props.placeholder || "Pilih..."} /></SelectTrigger>
        <SelectContent>
          {Object.entries(props.options).map(([v, l]) => (
            <SelectItem key={v} value={v}>
              <span className="flex items-center gap-2">
                {l}
                <code className="text-[10px] text-muted-foreground/60">{v}</code>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function RadioCardField(props: {
  label: string; path?: string; value: string;
  onChange: (v: string) => void;
  options: Record<string, string>;
}) {
  return (
    <Field label={props.label} path={props.path}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
        {Object.entries(props.options).map(([v, l]) => {
          const active = props.value === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => props.onChange(v)}
              className={`rounded-lg border p-3 text-left text-sm transition-all duration-150 ${
                active
                  ? "border-button-hover bg-button-hover/10 text-foreground shadow-[var(--focus-glow)]"
                  : "border-border bg-background hover:border-button-hover/60 hover:bg-secondary/30 text-muted-foreground"
              }`}
            >
              <div className="font-medium leading-tight">{l}</div>
              <code className="text-[10px] opacity-60 mt-1 block">{v}</code>
            </button>
          );
        })}
      </div>
    </Field>
  );
}

export function ToggleField(props: {
  label: string; path?: string; value: boolean; onChange: (v: boolean) => void; hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 px-3 rounded-lg border border-border/60 bg-background/40">
      <div className="min-w-0">
        <Label className="text-sm font-medium">{props.label}</Label>
        {props.path && <div><code className="text-[10px] text-muted-foreground/60 font-mono">{props.path}</code></div>}
        {props.hint && <p className="text-xs text-muted-foreground mt-1">{props.hint}</p>}
      </div>
      <Switch checked={props.value} onCheckedChange={props.onChange} />
    </div>
  );
}

export function MultiTagField(props: {
  label: string; path?: string; value: string[];
  onChange: (v: string[]) => void; placeholder?: string;
  options?: Record<string, string>;
}) {
  return (
    <Field label={props.label} path={props.path} hint="Tekan Enter untuk menambah. Klik chip untuk hapus.">
      <Input
        placeholder={props.placeholder || "Tambah lalu Enter..."}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const v = (e.target as HTMLInputElement).value.trim();
            if (v && !props.value.includes(v)) props.onChange([...props.value, v]);
            (e.target as HTMLInputElement).value = "";
          }
        }}
      />
      {props.options && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {Object.entries(props.options).map(([v, l]) => {
            const active = props.value.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() =>
                  props.onChange(active ? props.value.filter((x) => x !== v) : [...props.value, v])
                }
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  active
                    ? "bg-button-hover/15 border-button-hover text-button-hover"
                    : "border-border text-muted-foreground hover:border-button-hover/50"
                }`}
              >
                {l} <code className="opacity-60">{v}</code>
              </button>
            );
          })}
        </div>
      )}
      {props.value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {props.value.map((v) => (
            <Badge
              key={v}
              variant="secondary"
              className="cursor-pointer border-0"
              onClick={() => props.onChange(props.value.filter((x) => x !== v))}
            >
              {v} ✕
            </Badge>
          ))}
        </div>
      )}
    </Field>
  );
}

export function PlaceholderBuilder({ label, path, note }: { label: string; path?: string; note: string }) {
  return (
    <Field label={label} path={path}>
      <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-4 text-xs text-muted-foreground">
        {note}
      </div>
    </Field>
  );
}

export function TextAreaField(props: {
  label: string; path?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <Field label={props.label} path={props.path}>
      <Textarea
        rows={props.rows || 3}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
      />
    </Field>
  );
}
