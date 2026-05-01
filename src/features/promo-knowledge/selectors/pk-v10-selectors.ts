/**
 * PK V.10 SELECTORS — Phase 2, Step 3
 * ────────────────────────────────────────────────────────────────────────────
 * Read-only path getters for `PkV10Record`.
 *
 * STRICT CONTRACT:
 *  - Read a path → return the exact value at that path.
 *  - Empty / missing field → return `null` (or `[]` for list selectors).
 *  - NO default values.
 *  - NO fallback paths.
 *  - NO transforms (except the explicitly-mandated `rewardMode` mapping below).
 *  - NO recomputation, no enum/label rewriting, no summary synthesis.
 *  - NO legacy imports (no voc-wolf-extractor, no mapExtractedToPromoFormData,
 *    no mappedPreview, no extractedPromo).
 *
 * The 3 mechanic-data discriminators (`PkV10MechanicCalcData`,
 * `PkV10MechanicRewardData`, `PkV10MechanicTurnoverData`) are intentionally
 * NOT consumed in this file — Step 3 selectors all read flat engine paths
 * which are already strongly typed by `PkV10Record`. Discriminators remain
 * available for future per-mechanic selectors.
 *
 * NOTE on `rewardMode`:
 *  Authority is `taxonomy_engine.mode_block.mode` ONLY.
 *  Never read `reward_mode` from `mechanics_engine.items[].data` or from
 *  `PkV10MechanicRewardData`. Mapping: "fixed" → "fixed", else → "dinamis".
 */

import type { PkV10Record } from "../schema/pk-v10";

// ──────────────────────────────────────────────────────────────────────────
// Internal helpers (read-only)
// ──────────────────────────────────────────────────────────────────────────

/** Empty string → null. No trimming, no transform. */
function s(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return v === "" ? null : v;
}

/** Number passthrough. null/undefined → null. No coercion. */
function n(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  return v;
}

/** Array passthrough. null/undefined → []. No filtering. */
function arr<T>(v: T[] | null | undefined): T[] {
  return Array.isArray(v) ? v : [];
}

// ──────────────────────────────────────────────────────────────────────────
// Selectors
// ──────────────────────────────────────────────────────────────────────────

/** 1. Promo name — `identity_engine.promo_block.promo_name` */
function promoName(rec: PkV10Record): string | null {
  return s(rec?.identity_engine?.promo_block?.promo_name);
}

/** 2. Client id — `identity_engine.client_block.client_id` */
function clientId(rec: PkV10Record): string | null {
  return s(rec?.identity_engine?.client_block?.client_id);
}

/** 3. Validation status — `readiness_engine.validation_block.status` */
function validationStatus(rec: PkV10Record): string | null {
  return s(rec?.readiness_engine?.validation_block?.status);
}

/** 4. Validation warnings — `readiness_engine.validation_block.warnings` */
function validationWarnings(rec: PkV10Record): string[] {
  return arr(rec?.readiness_engine?.validation_block?.warnings);
}

/**
 * 5. Reward mode — AUTHORITY: `taxonomy_engine.mode_block.mode`.
 *    Mapping (the ONLY allowed transform in this file):
 *      "fixed"  → "fixed"
 *      else     → "dinamis"
 *    Never read `reward_mode` from mechanics_engine or any legacy source.
 */
function rewardMode(rec: PkV10Record): "fixed" | "dinamis" {
  const mode = rec?.taxonomy_engine?.mode_block?.mode;
  return mode === "fixed" ? "fixed" : "dinamis";
}

/** 6. Calculation value — `reward_engine.calculation_value` */
function calculationValue(rec: PkV10Record): number | null {
  return n(rec?.reward_engine?.calculation_value);
}

/** 7. Max reward — `reward_engine.max_reward` */
function maxReward(rec: PkV10Record): number | null {
  return n(rec?.reward_engine?.max_reward);
}

/** 8. Min deposit — `reward_engine.requirement_block.min_deposit` */
function minDeposit(rec: PkV10Record): number | null {
  return n(rec?.reward_engine?.requirement_block?.min_deposit);
}

/** 9. Payout direction — `reward_engine.payout_direction` */
function payoutDirection(rec: PkV10Record): string | null {
  return s(rec?.reward_engine?.payout_direction);
}

/** 10. Reward type — `reward_engine.reward_type` */
function rewardType(rec: PkV10Record): string | null {
  return s(rec?.reward_engine?.reward_type);
}

/** 11. Voucher kind — `reward_engine.voucher_kind` */
function voucherKind(rec: PkV10Record): string | null {
  return s(rec?.reward_engine?.voucher_kind);
}

/**
 * 12. Game blacklist — `scope_engine.blacklist_block`.
 *     Returns providers / games / rules as-is. `types[]` is intentionally
 *     not surfaced here (not requested by the contract).
 */
function gameBlacklist(rec: PkV10Record): {
  providers: string[];
  games: string[];
  rules: string[];
} {
  const blk = rec?.scope_engine?.blacklist_block;
  return {
    providers: arr(blk?.providers),
    games: arr(blk?.games),
    rules: arr(blk?.rules),
  };
}

/** 13. APK required — `scope_engine.platform_block.apk_required` */
function apkRequired(rec: PkV10Record): boolean {
  return rec?.scope_engine?.platform_block?.apk_required === true;
}

/** 14. Trigger event — `trigger_engine.primary_trigger_block.trigger_event` */
function triggerEvent(rec: PkV10Record): string | null {
  return s(rec?.trigger_engine?.primary_trigger_block?.trigger_event);
}

/** 15. Subcategory count — length of `variant_engine.items_block.subcategories` */
function subcategoryCount(rec: PkV10Record): number {
  return arr(rec?.variant_engine?.items_block?.subcategories).length;
}

// ──────────────────────────────────────────────────────────────────────────
// Public selector namespace
// ──────────────────────────────────────────────────────────────────────────

export const sel = {
  promoName,
  clientId,
  validationStatus,
  validationWarnings,
  rewardMode,
  calculationValue,
  maxReward,
  minDeposit,
  payoutDirection,
  rewardType,
  voucherKind,
  gameBlacklist,
  apkRequired,
  triggerEvent,
  subcategoryCount,
} as const;

export type PkV10Selectors = typeof sel;
