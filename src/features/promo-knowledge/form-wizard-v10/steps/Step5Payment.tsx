import { Section, SelectField, TextField, MultiTagField, FieldGrid } from "../primitives";
import { L_DEPOSIT_METHOD } from "../labels";
import type { StepProps } from "./_types";

export function Step5Payment({ state, update }: StepProps) {
  const pm = state.payment_engine;
  return (
    <>
      <Section title="Deposit">
        <SelectField label="Metode Deposit"
          path="payment_engine.deposit_block.deposit_method"
          value={pm.deposit_block.deposit_method}
          onChange={(v) => update("payment_engine", { deposit_block: { ...pm.deposit_block, deposit_method: v } })}
          options={L_DEPOSIT_METHOD} />
        <TextField label="Rate Deposit"
          path="payment_engine.deposit_block.deposit_rate" type="number"
          value={pm.deposit_block.deposit_rate}
          onChange={(v) => update("payment_engine", { deposit_block: { ...pm.deposit_block, deposit_rate: v } })} />
        <MultiTagField label="Provider Deposit"
          path="payment_engine.deposit_block.deposit_method_providers"
          value={pm.deposit_block.deposit_method_providers}
          onChange={(v) => update("payment_engine", { deposit_block: { ...pm.deposit_block, deposit_method_providers: v } })} />
      </Section>

      <Section title="Whitelist">
        <MultiTagField label="Metode Diizinkan"
          path="payment_engine.method_whitelist_block.methods"
          value={pm.method_whitelist_block.methods}
          onChange={(v) => update("payment_engine", { method_whitelist_block: { ...pm.method_whitelist_block, methods: v } })}
          options={L_DEPOSIT_METHOD} />
        <MultiTagField label="Provider Diizinkan"
          path="payment_engine.method_whitelist_block.providers"
          value={pm.method_whitelist_block.providers}
          onChange={(v) => update("payment_engine", { method_whitelist_block: { ...pm.method_whitelist_block, providers: v } })} />
      </Section>

      <Section title="Blacklist">
        <MultiTagField label="Metode Dilarang"
          path="payment_engine.method_blacklist_block.methods"
          value={pm.method_blacklist_block.methods}
          onChange={(v) => update("payment_engine", { method_blacklist_block: { ...pm.method_blacklist_block, methods: v } })}
          options={L_DEPOSIT_METHOD} />
        <MultiTagField label="Provider Dilarang"
          path="payment_engine.method_blacklist_block.providers"
          value={pm.method_blacklist_block.providers}
          onChange={(v) => update("payment_engine", { method_blacklist_block: { ...pm.method_blacklist_block, providers: v } })} />
      </Section>
    </>
  );
}
