import { Section, SelectField, RadioCardField, TextField, ToggleField, PlaceholderBuilder, MultiTagField, FieldGrid } from "../primitives";
import { L_TRIGGER_EVENT, L_LOGIC, L_VALIDITY_MODE, L_DURATION_UNIT, L_CLAIM_FREQUENCY, L_DAY, L_RESET_FREQ } from "../labels";
import type { StepProps } from "./_types";

export function Step3Trigger({ state, update }: StepProps) {
  const tr = state.trigger_engine;
  const pe = state.period_engine;
  const tw = state.time_window_engine;
  const isRelative = pe.validity_block.validity_mode === "relative";
  const unlimited = pe.validity_block.valid_until_unlimited;

  return (
    <>
      <Section title="Trigger">
        <FieldGrid>
          <SelectField
            label="Event Pemicu"
            path="trigger_engine.primary_trigger_block.trigger_event"
            value={tr.primary_trigger_block.trigger_event}
            onChange={(v) => update("trigger_engine", { primary_trigger_block: { trigger_event: v } })}
            options={L_TRIGGER_EVENT}
          />
          <RadioCardField
            label="Logika Kondisi"
            path="trigger_engine.trigger_rule_block.logic_operator"
            value={tr.trigger_rule_block.logic_operator}
            onChange={(v) => update("trigger_engine", { trigger_rule_block: { ...tr.trigger_rule_block, logic_operator: v } })}
            options={L_LOGIC}
          />
        </FieldGrid>
        <PlaceholderBuilder
          label="Kondisi Tambahan (field/operator/value)"
          path="trigger_engine.trigger_rule_block.conditions"
          note="Builder kondisi multi-row akan dibuat di Phase 2. Saat ini placeholder."
        />
      </Section>

      <Section title="Periode Berlaku">
        <FieldGrid>
          <TextField
            label="Tanggal Mulai Berlaku"
            path="period_engine.validity_block.valid_from"
            type="date"
            value={pe.validity_block.valid_from}
            onChange={(v) => update("period_engine", { validity_block: { ...pe.validity_block, valid_from: v } })}
          />
          <TextField
            label="Tanggal Berakhir"
            path="period_engine.validity_block.valid_until"
            type="date"
            disabled={unlimited}
            value={pe.validity_block.valid_until}
            onChange={(v) => update("period_engine", { validity_block: { ...pe.validity_block, valid_until: v } })}
          />
        </FieldGrid>
        <ToggleField
          label="Tanpa Batas Waktu"
          path="period_engine.validity_block.valid_until_unlimited"
          value={unlimited}
          onChange={(v) => update("period_engine", { validity_block: { ...pe.validity_block, valid_until_unlimited: v } })}
        />
        <RadioCardField
          label="Mode Berlaku"
          path="period_engine.validity_block.validity_mode"
          value={pe.validity_block.validity_mode}
          onChange={(v) => update("period_engine", { validity_block: { ...pe.validity_block, validity_mode: v } })}
          options={L_VALIDITY_MODE}
        />
        {isRelative && (
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Durasi Aktif"
              path="period_engine.validity_block.validity_duration_value"
              type="number"
              value={pe.validity_block.validity_duration_value}
              onChange={(v) => update("period_engine", { validity_block: { ...pe.validity_block, validity_duration_value: v } })}
            />
            <SelectField
              label="Satuan"
              path="period_engine.validity_block.validity_duration_unit"
              value={pe.validity_block.validity_duration_unit}
              onChange={(v) => update("period_engine", { validity_block: { ...pe.validity_block, validity_duration_unit: v } })}
              options={L_DURATION_UNIT}
            />
          </div>
        )}
      </Section>

      <Section title="Distribusi">
        <FieldGrid>
          <SelectField
            label="Frekuensi Klaim"
            path="period_engine.distribution_block.claim_frequency"
            value={pe.distribution_block.claim_frequency}
            onChange={(v) => update("period_engine", { distribution_block: { ...pe.distribution_block, claim_frequency: v } })}
            options={L_CLAIM_FREQUENCY}
          />
          <SelectField
            label="Hari Pembagian Reward"
            path="period_engine.distribution_block.distribution_day"
            value={pe.distribution_block.distribution_day}
            onChange={(v) => update("period_engine", { distribution_block: { ...pe.distribution_block, distribution_day: v } })}
            options={L_DAY}
          />
        </FieldGrid>
      </Section>

      <Section title="Jam Distribusi">
        <ToggleField
          label="Aktifkan Window Distribusi"
          path="time_window_engine.distribution_window_block.enabled"
          value={tw.distribution_window_block.enabled}
          onChange={(v) => update("time_window_engine", { distribution_window_block: { ...tw.distribution_window_block, enabled: v } })}
        />
        {tw.distribution_window_block.enabled && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Mulai" path="...start_time" type="time"
                value={tw.distribution_window_block.start_time}
                onChange={(v) => update("time_window_engine", { distribution_window_block: { ...tw.distribution_window_block, start_time: v } })}
              />
              <TextField label="Selesai" path="...end_time" type="time"
                value={tw.distribution_window_block.end_time}
                onChange={(v) => update("time_window_engine", { distribution_window_block: { ...tw.distribution_window_block, end_time: v } })}
              />
            </div>
            <MultiTagField
              label="Hari Berlaku"
              path="time_window_engine.distribution_window_block.days"
              value={tw.distribution_window_block.days}
              onChange={(v) => update("time_window_engine", { distribution_window_block: { ...tw.distribution_window_block, days: v } })}
              options={L_DAY}
            />
          </>
        )}
      </Section>

      <Section title="Batasan Jam Klaim">
        <ToggleField
          label="Aktifkan Window Klaim"
          path="time_window_engine.claim_window_block.enabled"
          value={tw.claim_window_block.enabled}
          onChange={(v) => update("time_window_engine", { claim_window_block: { ...tw.claim_window_block, enabled: v } })}
        />
        {tw.claim_window_block.enabled && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Mulai" path="...start_time" type="time"
                value={tw.claim_window_block.start_time}
                onChange={(v) => update("time_window_engine", { claim_window_block: { ...tw.claim_window_block, start_time: v } })}
              />
              <TextField label="Selesai" path="...end_time" type="time"
                value={tw.claim_window_block.end_time}
                onChange={(v) => update("time_window_engine", { claim_window_block: { ...tw.claim_window_block, end_time: v } })}
              />
            </div>
            <MultiTagField
              label="Hari Berlaku"
              path="time_window_engine.claim_window_block.days"
              value={tw.claim_window_block.days}
              onChange={(v) => update("time_window_engine", { claim_window_block: { ...tw.claim_window_block, days: v } })}
              options={L_DAY}
            />
          </>
        )}
      </Section>

      <Section title="Waktu Reset">
        <ToggleField
          label="Aktifkan Reset"
          path="time_window_engine.reset_block.enabled"
          value={tw.reset_block.enabled}
          onChange={(v) => update("time_window_engine", { reset_block: { ...tw.reset_block, enabled: v } })}
        />
        {tw.reset_block.enabled && (
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Jam Reset" path="time_window_engine.reset_block.reset_time" type="time"
              value={tw.reset_block.reset_time}
              onChange={(v) => update("time_window_engine", { reset_block: { ...tw.reset_block, reset_time: v } })}
            />
            <SelectField
              label="Frekuensi Reset"
              path="time_window_engine.reset_block.reset_frequency"
              value={tw.reset_block.reset_frequency}
              onChange={(v) => update("time_window_engine", { reset_block: { ...tw.reset_block, reset_frequency: v } })}
              options={L_RESET_FREQ}
            />
          </div>
        )}
      </Section>
    </>
  );
}
