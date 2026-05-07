import { Section, TextField, SelectField, RadioCardField, FieldGrid } from "../primitives";
import { L_PROMO_TYPE, L_TARGET_USER, L_PROMO_MODE } from "../labels";
import type { StepProps } from "./_types";

export function Step1Identity({ state, update }: StepProps) {
  const id = state.identity_engine;
  return (
    <Section title="Identitas Promo" description="Informasi dasar untuk identifikasi promo.">
      <FieldGrid>
        <TextField
          label="Kode Website / Client ID"
          path="identity_engine.client_block.client_id"
          value={id.client_block.client_id}
          onChange={(v) => update("identity_engine", { client_block: { ...id.client_block, client_id: v } })}
          placeholder="cth: liveboard"
        />
        <TextField
          label="Nama Brand"
          path="identity_engine.client_block.client_name"
          value={id.client_block.client_name}
          onChange={(v) => update("identity_engine", { client_block: { ...id.client_block, client_name: v } })}
        />
      </FieldGrid>
      <TextField
        label="Nama Promo"
        path="identity_engine.promo_block.promo_name"
        value={id.promo_block.promo_name}
        onChange={(v) => update("identity_engine", { promo_block: { ...id.promo_block, promo_name: v } })}
      />
      <FieldGrid>
        <SelectField
          label="Tipe Promo"
          path="identity_engine.promo_block.promo_type"
          value={id.promo_block.promo_type}
          onChange={(v) => update("identity_engine", { promo_block: { ...id.promo_block, promo_type: v } })}
          options={L_PROMO_TYPE}
        />
        <SelectField
          label="Target User"
          path="identity_engine.promo_block.target_user"
          value={id.promo_block.target_user}
          onChange={(v) => update("identity_engine", { promo_block: { ...id.promo_block, target_user: v } })}
          options={L_TARGET_USER}
        />
      </FieldGrid>
      <RadioCardField
        label="Mode Promo"
        path="identity_engine.promo_block.promo_mode"
        value={id.promo_block.promo_mode}
        onChange={(v) => update("identity_engine", { promo_block: { ...id.promo_block, promo_mode: v } })}
        options={L_PROMO_MODE}
      />
    </Section>
  );
}
