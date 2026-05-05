import { Section, RadioCardField, SelectField, TextField, ToggleField, TextAreaField, PlaceholderBuilder } from "../primitives";
import {
  L_TAXONOMY_MODE, L_TIER_ARCHETYPE, L_REWARD_TYPE, L_VOUCHER_KIND,
  L_PAYOUT_DIR, L_CALC_BASIS, L_CALC_METHOD, L_CALC_UNIT, L_TURNOVER_BASIS,
} from "../labels";
import type { StepProps } from "./_types";

export function Step4Reward({ state, update }: StepProps) {
  const tx = state.taxonomy_engine;
  const rw = state.reward_engine;
  const isTier = tx.mode_block.mode === "tier";
  const isVoucher = rw.reward_type === "voucher";
  const unlimited = rw.max_reward_unlimited;

  return (
    <>
      <Section title="Mode & Tipe">
        <RadioCardField
          label="Mode Struktur"
          path="taxonomy_engine.mode_block.mode"
          value={tx.mode_block.mode}
          onChange={(v) => update("taxonomy_engine", { mode_block: { ...tx.mode_block, mode: v } })}
          options={L_TAXONOMY_MODE}
        />
        {isTier && (
          <SelectField
            label="Tipe Tier"
            path="taxonomy_engine.mode_block.tier_archetype"
            value={tx.mode_block.tier_archetype}
            onChange={(v) => update("taxonomy_engine", { mode_block: { ...tx.mode_block, tier_archetype: v } })}
            options={L_TIER_ARCHETYPE}
          />
        )}
        <SelectField
          label="Tipe Reward"
          path="reward_engine.reward_type"
          value={rw.reward_type}
          onChange={(v) => update("reward_engine", { reward_type: v })}
          options={L_REWARD_TYPE}
        />
        {isVoucher && (
          <SelectField
            label="Jenis Voucher"
            path="reward_engine.voucher_kind"
            value={rw.voucher_kind}
            onChange={(v) => update("reward_engine", { voucher_kind: v })}
            options={L_VOUCHER_KIND}
          />
        )}
      </Section>

      <Section title="Reward Cap">
        <TextField label="Mata Uang" path="reward_engine.currency"
          value={rw.currency}
          onChange={(v) => update("reward_engine", { currency: v })} />
        <TextField label="Maksimal Reward" path="reward_engine.max_reward" type="number"
          disabled={unlimited}
          value={rw.max_reward}
          onChange={(v) => update("reward_engine", { max_reward: v })} />
        <ToggleField
          label="Maksimal Reward Tanpa Batas?"
          path="reward_engine.max_reward_unlimited"
          value={unlimited}
          onChange={(v) => update("reward_engine", { max_reward_unlimited: v })}
        />
        <RadioCardField
          label="Arah Pembayaran"
          path="reward_engine.payout_direction"
          value={rw.payout_direction}
          onChange={(v) => update("reward_engine", { payout_direction: v })}
          options={L_PAYOUT_DIR}
        />
      </Section>

      <Section title="Perhitungan">
        <SelectField label="Basis Perhitungan" path="reward_engine.calculation_basis"
          value={rw.calculation_basis}
          onChange={(v) => update("reward_engine", { calculation_basis: v })}
          options={L_CALC_BASIS} />
        <SelectField label="Metode Perhitungan" path="reward_engine.calculation_method"
          value={rw.calculation_method}
          onChange={(v) => update("reward_engine", { calculation_method: v })}
          options={L_CALC_METHOD} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Nilai" path="reward_engine.calculation_value" type="number"
            value={rw.calculation_value}
            onChange={(v) => update("reward_engine", { calculation_value: v })} />
          <SelectField label="Satuan" path="reward_engine.calculation_unit"
            value={rw.calculation_unit}
            onChange={(v) => update("reward_engine", { calculation_unit: v })}
            options={L_CALC_UNIT} />
        </div>
        <TextField label="Minimal Deposit" path="reward_engine.requirement_block.min_deposit" type="number"
          value={rw.requirement_block.min_deposit}
          onChange={(v) => update("reward_engine", { requirement_block: { min_deposit: v } })} />
        <SelectField label="Basis Turnover" path="taxonomy_engine.logic_block.turnover_basis"
          value={tx.logic_block.turnover_basis}
          onChange={(v) => update("taxonomy_engine", { logic_block: { ...tx.logic_block, turnover_basis: v } })}
          options={L_TURNOVER_BASIS} />
        <TextAreaField label="Formula Perhitungan (read-only display)"
          path="taxonomy_engine.logic_block.conversion_formula"
          value={tx.logic_block.conversion_formula}
          onChange={(v) => update("taxonomy_engine", { logic_block: { ...tx.logic_block, conversion_formula: v } })} />
      </Section>

      <Section title="Admin Fee">
        <ToggleField label="Aktifkan Admin Fee"
          path="(path TBD — perlu konfirmasi V.10.1)"
          value={rw.admin_fee_enabled}
          onChange={(v) => update("reward_engine", { admin_fee_enabled: v })}
          hint="Path canonical untuk admin fee belum dikonfirmasi di V.10.1 — placeholder UI saja."
        />
        {rw.admin_fee_enabled && (
          <TextField label="Nilai Admin Fee" type="number"
            value={rw.admin_fee_value}
            onChange={(v) => update("reward_engine", { admin_fee_value: v })} />
        )}
      </Section>

      <Section title="Sub Kategori / Varian">
        <PlaceholderBuilder
          label="Variants"
          path="variant_engine.items_block.subcategories"
          note="Variant editor akan dibuat di Phase 4. Saat ini hanya placeholder."
        />
      </Section>
    </>
  );
}
