import { Section, SelectField, ToggleField, MultiTagField, RadioCardField, FieldGrid } from "../primitives";
import { L_PLATFORM_ACCESS, L_GEO, L_GAME_DOMAIN, L_RISK } from "../labels";
import type { StepProps } from "./_types";

export function Step2Access({ state, update }: StepProps) {
  const sc = state.scope_engine;
  return (
    <>
      <Section title="Platform & Wilayah">
        <FieldGrid>
          <SelectField
            label="Platform Akses"
            path="scope_engine.platform_block.platform_access"
            value={sc.platform_block.platform_access}
            onChange={(v) => update("scope_engine", { platform_block: { ...sc.platform_block, platform_access: v } })}
            options={L_PLATFORM_ACCESS}
          />
          <SelectField
            label="Wilayah"
            path="scope_engine.geo_block.geo_restriction"
            value={sc.geo_block.geo_restriction}
            onChange={(v) => update("scope_engine", { geo_block: { geo_restriction: v } })}
            options={L_GEO}
          />
        </FieldGrid>
        <ToggleField
          label="Wajib APK?"
          path="scope_engine.platform_block.apk_required"
          value={sc.platform_block.apk_required}
          onChange={(v) => update("scope_engine", { platform_block: { ...sc.platform_block, apk_required: v } })}
        />
      </Section>

      <Section title="Game & Provider">
        <SelectField
          label="Domain Game"
          path="scope_engine.game_block.game_domain"
          value={sc.game_block.game_domain}
          onChange={(v) => update("scope_engine", { game_block: { ...sc.game_block, game_domain: v } })}
          options={L_GAME_DOMAIN}
        />
        <MultiTagField
          label="Provider Game (Eligible)"
          path="scope_engine.game_block.eligible_providers"
          value={sc.game_block.eligible_providers}
          onChange={(v) => update("scope_engine", { game_block: { ...sc.game_block, eligible_providers: v } })}
          placeholder="cth: Pragmatic Play"
        />
        <MultiTagField
          label="Blacklist Provider"
          path="scope_engine.blacklist_block.providers"
          value={sc.blacklist_block.providers}
          onChange={(v) => update("scope_engine", { blacklist_block: { ...sc.blacklist_block, providers: v } })}
        />
        <MultiTagField
          label="Blacklist Game"
          path="scope_engine.blacklist_block.games"
          value={sc.blacklist_block.games}
          onChange={(v) => update("scope_engine", { blacklist_block: { ...sc.blacklist_block, games: v } })}
        />
      </Section>

      <Section title="Risiko">
        <RadioCardField
          label="Tingkat Risiko"
          path="risk_engine.level_block.promo_risk_level"
          value={state.risk_engine.level_block.promo_risk_level}
          onChange={(v) => update("risk_engine", { level_block: { promo_risk_level: v } })}
          options={L_RISK}
        />
      </Section>
    </>
  );
}
