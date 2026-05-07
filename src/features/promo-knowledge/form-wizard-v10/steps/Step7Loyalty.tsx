import { Section, SelectField, TextField, PlaceholderBuilder, FieldGrid } from "../primitives";
import { L_POINT_NAME } from "../labels";
import type { StepProps } from "./_types";

export function Step7Loyalty({ state, update }: StepProps) {
  const lo = state.loyalty_engine;
  return (
    <>
      <Section title="Mekanisme Loyalitas">
        <FieldGrid>
          <SelectField label="Nama Poin" path="loyalty_engine.mechanism_block.point_name"
            value={lo.mechanism_block.point_name}
            onChange={(v) => update("loyalty_engine", { mechanism_block: { ...lo.mechanism_block, point_name: v } })}
            options={L_POINT_NAME} />
          <TextField label="Mode Loyalitas"
            path="loyalty_engine.mechanism_block.loyalty_mode"
            value={lo.mechanism_block.loyalty_mode}
            onChange={(v) => update("loyalty_engine", { mechanism_block: { ...lo.mechanism_block, loyalty_mode: v } })}
            placeholder="cth: cumulative / reset_per_period (F3 enum)" />
        </FieldGrid>
        <TextField label="Aturan Earn Poin"
          path="loyalty_engine.mechanism_block.earning_rule"
          value={lo.mechanism_block.earning_rule}
          onChange={(v) => update("loyalty_engine", { mechanism_block: { ...lo.mechanism_block, earning_rule: v } })} />
      </Section>

      <Section title="Penukaran & Reward Tier">
        <PlaceholderBuilder label="Grup Penukaran"
          path="loyalty_engine.exchange_block.exchange_groups"
          note="Builder grup penukaran — Phase 4." />
        <PlaceholderBuilder label="Tabel Tier Reward" path="(path TBD — V.10.1)"
          note="Tier reward table — Phase 4. Path canonical perlu konfirmasi." />
        <PlaceholderBuilder label="Level Up Rewards" path="(path TBD)"
          note="Builder Level Up Rewards — Phase 4." />
        <PlaceholderBuilder label="VIP Multiplier" path="(path TBD)"
          note="Builder VIP Multiplier — Phase 4." />
        <PlaceholderBuilder label="Fast EXP Missions" path="(path TBD)"
          note="Builder Fast EXP Missions — Phase 4." />
        <PlaceholderBuilder label="Redeem Items" path="(path TBD)"
          note="Builder Redeem Items — Phase 4." />
        <PlaceholderBuilder label="Referral Tiers" path="(path TBD)"
          note="Builder Referral Tiers — Phase 4." />
      </Section>
    </>
  );
}
