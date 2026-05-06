import { Section, TextAreaField, MultiTagField } from "../primitives";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "@/lib/notify";
import { loadRecord } from "../../storage/local-storage";
import type { StepProps } from "./_types";

interface Step9Props extends StepProps {
  recordId?: string;
}

export function Step9Review({ state, update, recordId }: Step9Props) {
  const tm = state.terms_engine;

  const handleCopyFinal = async () => {
    if (!recordId) {
      toast.error("Tidak ada recordId", {
        description: "Buka wizard via draft V.10.1 yang sudah tersimpan.",
      });
      return;
    }
    const rec = loadRecord(recordId);
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

      <Section title="Local Wizard Preview (read-only)">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground">
            Snapshot state wizard di browser ini — bukan record final tersimpan.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyFinal}
            disabled={!recordId}
            title={recordId ? "Salin full PkV10Record dari pk:rec" : "Butuh recordId"}
          >
            <Copy className="h-4 w-4 mr-1" /> Copy Final JSON V.10.1
          </Button>
        </div>
        <pre className="text-[11px] bg-secondary/30 border border-border rounded-lg p-3 overflow-auto max-h-96 font-mono text-muted-foreground">
{JSON.stringify(state, null, 2)}
        </pre>
        <p className="text-xs text-muted-foreground">
          <strong>Local Wizard Preview</strong> ≠ <strong>Final Saved PkV10Record</strong>.
          Tombol <em>Copy Final JSON V.10.1</em> menyalin record lengkap (termasuk{" "}
          <code>record_id</code>, <code>meta_engine</code>, <code>variant_engine</code>,{" "}
          <code>_field_status</code>, <code>ai_confidence</code>) dari pk:rec via{" "}
          <code>loadRecord(recordId)</code>.
        </p>
      </Section>

      <Section title="Debug Metadata">
        <p className="text-xs text-muted-foreground">
          <code>_field_status</code>, <code>ai_confidence</code>, <code>readiness_engine</code>,{" "}
          <code>meta_engine.schema_block</code> — akan dirender read-only di Phase 2 setelah prefill aktif.
        </p>
      </Section>

      <Section title="Summary & Export">
        <p className="text-xs text-muted-foreground">
          Salin JSON final V.10.1 untuk validasi, debugging, atau handoff ke konsumen lain
          (Livechat / API / MCP). Sumber: <code>loadRecord(recordId)</code> dari{" "}
          <code>pk:rec</code> — bukan local wizard state.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={handleCopyFinal}
            disabled={!recordId}
            title={recordId ? "Salin full PkV10Record dari pk:rec" : "Butuh recordId — simpan draft terlebih dulu"}
          >
            <Copy className="h-4 w-4 mr-2" /> Copy Final JSON V.10.1
          </Button>
          {!recordId && (
            <span className="text-xs text-warning">
              Belum ada recordId. Simpan draft terlebih dulu agar tombol aktif.
            </span>
          )}
        </div>
      </Section>
    </>
  );
}
