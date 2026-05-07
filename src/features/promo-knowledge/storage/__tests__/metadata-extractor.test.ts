import { describe, it, expect } from "vitest";
import { extractPromoKnowledgeMetadata } from "../supabase-publish";
import { createInertPkV10Record } from "@/features/promo-knowledge/schema/pk-v10";

describe("extractPromoKnowledgeMetadata", () => {
  it("pulls all metadata from the canonical V.10.1 paths", () => {
    const rec = createInertPkV10Record("rec_meta_1");
    rec.identity_engine.client_block.client_id = "Liveboard";
    rec.identity_engine.client_block.client_name = "Liveboard Casino";
    rec.identity_engine.promo_block.promo_name = "Bonus Harian";
    rec.identity_engine.promo_block.promo_type = "deposit_bonus";
    rec.identity_engine.promo_block.promo_mode = "single";
    rec.readiness_engine.state_block.state = "human_finalized";
    rec.readiness_engine.validation_block.status = "ok";
    rec.readiness_engine.observability_block.review_required = false;

    const meta = extractPromoKnowledgeMetadata(rec);

    expect(meta.record_id).toBe("rec_meta_1");
    expect(meta.client_id).toBe("Liveboard");
    expect(meta.client_name).toBe("Liveboard Casino");
    expect(meta.promo_name).toBe("Bonus Harian");
    expect(meta.promo_type).toBe("deposit_bonus");
    expect(meta.promo_mode).toBe("single");
    expect(meta.schema_name).toBe("PKB_Wolfbrain");
    expect(meta.schema_version).toBe("V.10.1");
    expect(meta.state).toBe("human_finalized");
    expect(meta.validation_status).toBe("ok");
    expect(meta.review_required).toBe(false);
  });

  it("copies state as-is without normalization", () => {
    const rec = createInertPkV10Record("rec_meta_2");
    rec.readiness_engine.state_block.state = "ai_draft_WEIRD_CASING";
    const meta = extractPromoKnowledgeMetadata(rec);
    expect(meta.state).toBe("ai_draft_WEIRD_CASING");
  });
});
