/**
 * Phase 1 — Reusable UI primitives for V.10.1 Form Wizard skeleton.
 * Pure presentation. No schema validation, no storage.
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
    <Card className="p-6 space-y-4 bg-card border-border">
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

export function Field({ label, hint, path, children }: { label: string; hint?: string; path?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-sm">{label}</Label>
        {path && <code className="text-[10px] text-muted-foreground/70 font-mono">{path}</code>}
      </div>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {Object.entries(props.options).map(([v, l]) => {
          const active = props.value === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => props.onChange(v)}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                active
                  ? "border-button-hover bg-button-hover/10 text-foreground"
                  : "border-border bg-background hover:bg-secondary/30 text-muted-foreground"
              }`}
            >
              <div className="font-medium">{l}</div>
              <code className="text-[10px] opacity-60">{v}</code>
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
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <Label className="text-sm">{props.label}</Label>
        {props.path && <div><code className="text-[10px] text-muted-foreground/70 font-mono">{props.path}</code></div>}
        {props.hint && <p className="text-xs text-muted-foreground mt-0.5">{props.hint}</p>}
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
        <div className="flex flex-wrap gap-1 mt-2">
          {Object.entries(props.options).map(([v, l]) => {
            const active = props.value.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() =>
                  props.onChange(active ? props.value.filter((x) => x !== v) : [...props.value, v])
                }
                className={`text-xs px-2 py-1 rounded-full border ${
                  active ? "bg-button-hover/20 border-button-hover text-button-hover" : "border-border text-muted-foreground"
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
              className="cursor-pointer"
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
        🛠️ {note}
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
