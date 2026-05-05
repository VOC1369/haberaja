import { Section, TextAreaField, MultiTagField } from "../primitives";
import type { StepProps } from "./_types";

export function Step9Review({ state, update }: StepProps) {
  const tm = state.terms_engine;
  return (
    <>
      <Section title="Syarat & Ketentuan">
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

      <Section title="Preview JSON / Projection (read-only)">
        <pre className="text-[11px] bg-secondary/30 border border-border rounded-lg p-3 overflow-auto max-h-96 font-mono text-muted-foreground">
{JSON.stringify(state, null, 2)}
        </pre>
        <p className="text-xs text-muted-foreground">
          Phase 1 — preview lokal saja. Tidak ada save ke pk:rec, tidak ada Supabase, tidak ada bridge ke V.09.
        </p>
      </Section>

      <Section title="Debug Metadata">
        <p className="text-xs text-muted-foreground">
          <code>_field_status</code>, <code>ai_confidence</code>, <code>readiness_engine</code>,{" "}
          <code>meta_engine.schema_block</code> — akan dirender read-only di Phase 2 setelah prefill aktif.
        </p>
      </Section>
    </>
  );
}
