import { Section, SelectField, ToggleField, MultiTagField, TextField, TextAreaField, PlaceholderBuilder, FieldGrid } from "../primitives";
import {
  L_CLAIM_METHOD, L_CHANNEL, L_PROOF_TYPE, L_PROOF_DEST, L_SOCIAL_PLATFORM,
} from "../labels";
import type { StepProps } from "./_types";

export function Step6Claim({ state, update }: StepProps) {
  const cl = state.claim_engine;
  const pr = state.proof_engine;
  return (
    <>
      <Section title="Klaim">
        <SelectField label="Cara Klaim" path="claim_engine.method_block.claim_method"
          value={cl.method_block.claim_method}
          onChange={(v) => update("claim_engine", { method_block: { ...cl.method_block, claim_method: v } })}
          options={L_CLAIM_METHOD} />
        <ToggleField label="Reward Langsung Masuk?" path="claim_engine.method_block.auto_credit"
          value={cl.method_block.auto_credit}
          onChange={(v) => update("claim_engine", { method_block: { ...cl.method_block, auto_credit: v } })} />
        <MultiTagField label="Saluran Klaim" path="claim_engine.channels_block.channels"
          value={cl.channels_block.channels}
          onChange={(v) => update("claim_engine", { channels_block: { channels: v } })}
          options={L_CHANNEL} />
        <PlaceholderBuilder label="Langkah Klaim"
          path="claim_engine.instruction_block.claim_steps"
          note="Step list builder akan dibuat di Phase 2. Saat ini placeholder." />
        <TextField label="Link Form Klaim" path="claim_engine.instruction_block.claim_url"
          value={cl.instruction_block.claim_url}
          onChange={(v) => update("claim_engine", { instruction_block: { ...cl.instruction_block, claim_url: v } })} />
      </Section>

      <Section title="Bukti">
        <ToggleField label="Wajib Upload Bukti?"
          path="claim_engine.proof_requirement_block.proof_required"
          value={cl.proof_requirement_block.proof_required}
          onChange={(v) => update("claim_engine", { proof_requirement_block: { ...cl.proof_requirement_block, proof_required: v } })} />
        {cl.proof_requirement_block.proof_required && (
          <>
            <MultiTagField label="Jenis Bukti"
              path="claim_engine.proof_requirement_block.proof_types"
              value={cl.proof_requirement_block.proof_types}
              onChange={(v) => update("claim_engine", { proof_requirement_block: { ...cl.proof_requirement_block, proof_types: v } })}
              options={L_PROOF_TYPE} />
            <MultiTagField label="Kirim Bukti ke"
              path="claim_engine.proof_requirement_block.proof_destinations"
              value={cl.proof_requirement_block.proof_destinations}
              onChange={(v) => update("claim_engine", { proof_requirement_block: { ...cl.proof_requirement_block, proof_destinations: v } })}
              options={L_PROOF_DEST} />
          </>
        )}
      </Section>

      <Section title="Sosial Media">
        <MultiTagField label="Platform Sosial Media"
          path="proof_engine.social_proof_block.platforms"
          value={pr.social_proof_block.platforms}
          onChange={(v) => update("proof_engine", { social_proof_block: { ...pr.social_proof_block, platforms: v } })}
          options={L_SOCIAL_PLATFORM} />
        <MultiTagField label="Hashtag Wajib"
          path="proof_engine.social_proof_block.hashtags"
          value={pr.social_proof_block.hashtags}
          onChange={(v) => update("proof_engine", { social_proof_block: { ...pr.social_proof_block, hashtags: v } })} />
        <TextAreaField label="Konten yang Harus Ada"
          path="proof_engine.social_proof_block.content_requirements"
          value={pr.social_proof_block.content_requirements}
          onChange={(v) => update("proof_engine", { social_proof_block: { ...pr.social_proof_block, content_requirements: v } })} />
      </Section>
    </>
  );
}
