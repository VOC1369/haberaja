/**
 * @deprecated STEP 2 (V.10 migration): this contract surface is LEGACY V.09.
 * The active runtime path uses `extract-client.ts` → `PkV10Record` directly,
 * not this interface. Kept only as a historical reference until the V.10
 * extractor contract surface is defined (V.10.1 backlog).
 *
 * Do NOT add new consumers. Do NOT extend.
 *
 * EXTRACTOR CONTRACT — interface only (Gate 1, V.09 era).
 *
 * Versioned independently from schema and governance:
 *   - governance_version → ARD/policy
 *   - domain_version     → schema contract per domain
 *   - extractor_contract_version → THIS interface
 */

import type { PromoKnowledgeRecord } from "../schema/pk-06.0";

export const EXTRACTOR_CONTRACT_VERSION = "EX-PK-0.1.0" as const;

export type ExtractionSourceKind = "image" | "text" | "html" | "multimodal";

export interface ExtractionInput {
  source_kind: ExtractionSourceKind;
  source_url?: string;
  raw_text?: string;
  raw_html?: string;
  image_data_urls?: string[];
  client_id_hint?: string;
}

export interface ExtractionEvidence {
  field_path: string;     // e.g. "claim_engine.method_block.claim_method"
  evidence_text: string;  // verbatim snippet from source
  source_locator?: string; // optional positional info
}

export interface ExtractionResult {
  extractor_contract_version: typeof EXTRACTOR_CONTRACT_VERSION;
  record: PromoKnowledgeRecord;        // fully-shaped, ai_draft state
  evidence: ExtractionEvidence[];      // optional but recommended
  ai_latency_ms: number;
  ai_model: string;
  warnings: string[];
}

/**
 * The contract every extractor implementation must satisfy.
 * IMPLEMENTATION DEFERRED TO GATE 2.
 */
export interface PromoKnowledgeExtractor {
  readonly contractVersion: typeof EXTRACTOR_CONTRACT_VERSION;
  extract(input: ExtractionInput): Promise<ExtractionResult>;
}

/**
 * Stub — throws on call. Used only for type wiring during Gate 1.
 */
export const NOT_IMPLEMENTED_EXTRACTOR: PromoKnowledgeExtractor = {
  contractVersion: EXTRACTOR_CONTRACT_VERSION,
  async extract() {
    throw new Error(
      `[PromoKnowledgeExtractor] Implementation deferred to Gate 2 (contract ${EXTRACTOR_CONTRACT_VERSION}).`,
    );
  },
};
