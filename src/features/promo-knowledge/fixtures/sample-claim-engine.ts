/**
 * SAMPLE FIXTURE — represents one realistic AI-extracted draft for the
 * Gate 1 demo loop. Used by the form's "Load Sample" action.
 */

import { createDraftRecord } from "../storage/local-storage";
import type { PromoKnowledgeRecord } from "../schema/pk-06.0";

export function buildSamplePromo(): PromoKnowledgeRecord {
  const rec = createDraftRecord();

  // identity hint (permissive engine, narrow shape known from inert)
  (rec.identity_engine as { promo_block: { promo_name: string; promo_type: string } }).promo_block.promo_name =
    "Bonus Cashback Slot Mingguan";
  (rec.identity_engine as { promo_block: { promo_name: string; promo_type: string } }).promo_block.promo_type =
    "cashback";

  // claim_engine — typed slice
  rec.claim_engine = {
    method_block: {
      claim_method: "manual_livechat",
      auto_credit: false,
    },
    channels_block: {
      channels: ["livechat", "whatsapp", "telegram"],
      priority_order: ["livechat", "whatsapp"],
    },
    proof_requirement_block: {
      proof_required: true,
      proof_types: ["screenshot_bill"],
      proof_destinations: ["livechat"],
    },
    instruction_block: {
      claim_steps: [
        "Login ke akun member",
        "Hubungi Livechat",
        "Sebutkan ID member dan kirim screenshot bill",
      ],
      claim_url: "https://example.com/promo/cashback-slot",
    },
  };

  // ai_confidence map (per-field, populated by extractor in real use)
  rec.ai_confidence = {
    "claim_engine.method_block.claim_method": 0.92,
    "claim_engine.method_block.auto_credit": 0.88,
    "claim_engine.channels_block.channels": 0.81,
    "claim_engine.channels_block.priority_order": 0.65,
    "claim_engine.proof_requirement_block.proof_required": 0.95,
    "claim_engine.proof_requirement_block.proof_types": 0.78,
    "claim_engine.instruction_block.claim_url": 0.99,
  };

  // observability flags (extractor-emitted, illustrative)
  rec.readiness_engine.observability_block.ambiguity_flags = [];
  rec.readiness_engine.observability_block.contradiction_flags = [];
  rec.readiness_engine.observability_block.review_required = false;

  return rec;
}
