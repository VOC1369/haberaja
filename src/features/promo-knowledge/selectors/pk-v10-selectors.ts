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

import type {
  PkV10Record,
  PkV10Subcategory,
  PkV10MechanicItem,
} from "../schema/pk-v10";

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
function rewardMode(rec: PkV10Record): "fixed" | "dinamis" | null {
  const mode = rec?.taxonomy_engine?.mode_block?.mode;
  if (mode === "fixed") return "fixed";
  if (mode === "dinamis") return "dinamis";
  return null;
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
// Per-variant DIRECT selectors (Step 3.2)
// ────────────────────────────────────────────────────────────────────────────
// Read `variant_engine.items_block.subcategories[i]`, cast as `PkV10Subcategory`
// for opt-in typing, and return the leaf value at the requested path.
//
// STRICT CONTRACT (same as record-level selectors):
//  - Out-of-range index → null (or [] for list selectors).
//  - Empty / missing field → null (or []).
//  - NO fallback to `reward_engine.*` or any record-level engine.
//  - NO default values, NO transforms, NO string→number parsing.
// ──────────────────────────────────────────────────────────────────────────

/** Internal: get the i-th subcategory entry, cast for opt-in typing. */
function subAt(rec: PkV10Record, i: number): PkV10Subcategory | null {
  const list = arr(rec?.variant_engine?.items_block?.subcategories);
  if (i < 0 || i >= list.length) return null;
  return list[i] as PkV10Subcategory;
}

/** sub.variant_id */
function subVariantId(rec: PkV10Record, i: number): string | null {
  return s(subAt(rec, i)?.variant_id);
}

/** sub.variant_name */
function subVariantName(rec: PkV10Record, i: number): string | null {
  return s(subAt(rec, i)?.variant_name);
}

/** sub.game_category */
function subGameCategory(rec: PkV10Record, i: number): string | null {
  return s(subAt(rec, i)?.game_category);
}

/** sub.game_providers */
function subGameProviders(rec: PkV10Record, i: number): string[] {
  return arr(subAt(rec, i)?.game_providers);
}

/** sub.game_exclusions */
function subGameExclusions(rec: PkV10Record, i: number): string[] {
  return arr(subAt(rec, i)?.game_exclusions);
}

/** sub.min_deposit */
function subMinDeposit(rec: PkV10Record, i: number): number | null {
  return n(subAt(rec, i)?.min_deposit);
}

/** sub.max_bonus */
function subMaxBonus(rec: PkV10Record, i: number): number | null {
  return n(subAt(rec, i)?.max_bonus);
}

/** sub.bonus_percentage */
function subBonusPercentage(rec: PkV10Record, i: number): number | null {
  return n(subAt(rec, i)?.bonus_percentage);
}

/** sub.turnover_multiplier — number only, no string parsing */
function subTurnoverMultiplier(rec: PkV10Record, i: number): number | null {
  return n(subAt(rec, i)?.turnover_multiplier);
}

/** sub.currency */
function subCurrency(rec: PkV10Record, i: number): string | null {
  return s(subAt(rec, i)?.currency);
}

// ──────────────────────────────────────────────────────────────────────────
// Step 7 — mechanics_engine helper + selectors
// ──────────────────────────────────────────────────────────────────────────
//
// CONTRACT:
//  - `findMechanic` walks `mechanics_engine.items_block.items[]` in order and
//    returns the FIRST item whose `mechanic_type` matches AND, when a
//    predicate is supplied, whose `data` satisfies the predicate.
//  - Predicate is the disambiguation channel. Selectors MUST NOT rely on
//    `mechanic_type` alone — e.g. "reward" can be lucky_spin, cashback,
//    physical, voucher, etc. The predicate filters on `data.reward_form`
//    or another data-level discriminator.
//  - No fallback, no default, no transform. Missing → null (or false for
//    boolean unlimited flags, per Step 5B sibling convention).

type MechanicData = Record<string, unknown>;

/**
 * Find the first mechanic item matching `mechanic_type` and (optionally) a
 * `data` predicate. Returns `null` when no item matches.
 */
function findMechanic(
  rec: PkV10Record,
  mechanic_type: string,
  predicate?: (data: MechanicData) => boolean,
): PkV10MechanicItem | null {
  const items = arr(rec?.mechanics_engine?.items_block?.items);
  for (const it of items) {
    if (!it || it.mechanic_type !== mechanic_type) continue;
    const data = (it.data ?? {}) as MechanicData;
    if (predicate && !predicate(data)) continue;
    return it;
  }
  return null;
}

// Predicate: lucky-spin reward instance.
const isSpinTokenReward = (d: MechanicData): boolean =>
  (d as { reward_form?: unknown }).reward_form === "spin_token";

// Predicate: time_window scoped to reward validity (lucky-spin validity).
const isRewardValidityWindow = (d: MechanicData): boolean =>
  (d as { scope?: unknown }).scope === "reward_validity";

/** 16. Lucky-spin external ref id (mechanics_engine, predicate-disambiguated). */
function luckySpinRefId(rec: PkV10Record): string | null {
  const m = findMechanic(rec, "reward", isSpinTokenReward);
  const ext = (m?.data as { external_system?: { ref_id?: unknown } } | undefined)
    ?.external_system;
  const v = ext?.ref_id;
  return typeof v === "string" ? s(v) : null;
}

/** 17. Lucky-spin max-per-day cap (mechanics_engine, predicate-disambiguated). */
function luckySpinMaxPerDay(rec: PkV10Record): number | null {
  const m = findMechanic(rec, "reward", isSpinTokenReward);
  const exec = (m?.data as { execution?: { max_per_day?: unknown } } | undefined)
    ?.execution;
  const v = exec?.max_per_day;
  return typeof v === "number" ? n(v) : null;
}

/** 18. Spin validity (time_window scope=reward_validity). */
function spinValidUntil(rec: PkV10Record): string | null {
  const m = findMechanic(rec, "time_window", isRewardValidityWindow);
  const validity = (m?.data as { validity?: { valid_until?: unknown } } | undefined)
    ?.validity;
  const v = validity?.valid_until;
  return typeof v === "string" ? s(v) : null;
}

/** 19. Spin validity unlimited flag — Step 5B sibling. Defaults to false. */
function spinValidUntilUnlimited(rec: PkV10Record): boolean {
  const m = findMechanic(rec, "time_window", isRewardValidityWindow);
  const validity = (
    m?.data as { validity?: { valid_until_unlimited?: unknown } } | undefined
  )?.validity;
  return validity?.valid_until_unlimited === true;
}

// ──────────────────────────────────────────────────────────────────────────
// Reward identity + record-level unlimited flags (flat engine paths).
// These do NOT need `findMechanic` — they live on `reward_engine` /
// `period_engine` directly.
// ──────────────────────────────────────────────────────────────────────────

/** 20. Physical item name — `reward_engine.reward_identity_block.item_name`. */
function physicalItemName(rec: PkV10Record): string | null {
  return s(rec?.reward_engine?.reward_identity_block?.item_name);
}

/** 21. Physical item quantity — `reward_engine.reward_identity_block.quantity`. */
function physicalQuantity(rec: PkV10Record): number | null {
  return n(rec?.reward_engine?.reward_identity_block?.quantity);
}

/** 22. Max-reward unlimited flag — Step 5B sibling. Defaults to false. */
function maxRewardUnlimited(rec: PkV10Record): boolean {
  return rec?.reward_engine?.max_reward_unlimited === true;
}

/** 23. Promo validity unlimited flag — Step 5B sibling. Defaults to false. */
function validUntilUnlimited(rec: PkV10Record): boolean {
  return rec?.period_engine?.validity_block?.valid_until_unlimited === true;
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
  // Per-variant DIRECT (Step 3.2)
  subVariantId,
  subVariantName,
  subGameCategory,
  subGameProviders,
  subGameExclusions,
  subMinDeposit,
  subMaxBonus,
  subBonusPercentage,
  subTurnoverMultiplier,
  subCurrency,
} as const;

export type PkV10Selectors = typeof sel;
