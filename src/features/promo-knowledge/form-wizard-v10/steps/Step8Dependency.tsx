import { Section, ToggleField, SelectField, TextField, MultiTagField, PlaceholderBuilder, FieldGrid } from "../primitives";
import { L_STACKING, L_VOID_ACTION, L_PENALTY_TYPE, L_PENALTY_SCOPE } from "../labels";
import type { StepProps } from "./_types";

export function Step8Dependency({ state, update }: StepProps) {
  const dp = state.dependency_engine;
  const iv = state.invalidation_engine;
  return (
    <>
      <Section title="Ketergantungan / Stacking">
        <ToggleField label="Bisa Digabung dengan Promo Lain?"
          path="dependency_engine.stacking_block.stacking_allowed"
          value={dp.stacking_block.stacking_allowed}
          onChange={(v) => update("dependency_engine", { stacking_block: { ...dp.stacking_block, stacking_allowed: v } })} />
        <SelectField label="Aturan Penggabungan"
          path="dependency_engine.stacking_block.stacking_policy"
          value={dp.stacking_block.stacking_policy}
          onChange={(v) => update("dependency_engine", { stacking_block: { ...dp.stacking_block, stacking_policy: v } })}
          options={L_STACKING} />
        <TextField label="Maksimal Promo Bersamaan" type="number"
          path="dependency_engine.stacking_block.max_concurrent"
          value={dp.stacking_block.max_concurrent}
          onChange={(v) => update("dependency_engine", { stacking_block: { ...dp.stacking_block, max_concurrent: v } })} />
        <MultiTagField label="Tidak Bisa Digabung dengan"
          path="dependency_engine.exclusion_block.mutually_exclusive_with"
          value={dp.exclusion_block.mutually_exclusive_with}
          onChange={(v) => update("dependency_engine", { exclusion_block: { ...dp.exclusion_block, mutually_exclusive_with: v } })} />
        <MultiTagField label="Boleh Digabung dengan"
          path="dependency_engine.exclusion_block.can_combine_with"
          value={dp.exclusion_block.can_combine_with}
          onChange={(v) => update("dependency_engine", { exclusion_block: { ...dp.exclusion_block, can_combine_with: v } })} />
      </Section>

      <Section title="Pembatalan / Invalidation">
        <PlaceholderBuilder label="Kondisi Pembatalan"
          path="invalidation_engine.void_conditions_block"
          note="Builder void conditions — Phase 2." />
        <SelectField label="Tindakan Jika Melanggar"
          path="invalidation_engine.penalty_block.void_action"
          value={iv.penalty_block.void_action}
          onChange={(v) => update("invalidation_engine", { penalty_block: { ...iv.penalty_block, void_action: v } })}
          options={L_VOID_ACTION} />
        <SelectField label="Jenis Hukuman"
          path="invalidation_engine.penalty_block.penalty_type"
          value={iv.penalty_block.penalty_type}
          onChange={(v) => update("invalidation_engine", { penalty_block: { ...iv.penalty_block, penalty_type: v } })}
          options={L_PENALTY_TYPE} />
        <SelectField label="Lingkup Hukuman"
          path="invalidation_engine.penalty_block.penalty_scope"
          value={iv.penalty_block.penalty_scope}
          onChange={(v) => update("invalidation_engine", { penalty_block: { ...iv.penalty_block, penalty_scope: v } })}
          options={L_PENALTY_SCOPE} />
      </Section>
    </>
  );
}
