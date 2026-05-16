/**
 * FIELD_REGISTRY — metadata + UI descriptors only
 *
 * STRICT CONTRACT (locked):
 *   ALLOWED:  path, label, question, inputKind, options, read, write,
 *             placeholder, helpText
 *   FORBIDDEN: isCritical, criticalWhen, rule branching, generate logic,
 *              per-promo conditions, regex, threshold drivers
 *
 * This module answers ONE question: "How does the UI render and write
 * field X?" — nothing else. All decisions about WHETHER to ask are owned
 * by gap-reader.ts (JSON-driven from _field_status + flags).
 *
 * Coverage scope: critical operational fields only. Projection / meta /
 * debug / propagation fields are intentionally absent.
 */

import type { PkV10Record } from "@/features/promo-knowledge/schema/pk-v10";
import {
  PK_V10_CLAIM_METHOD,
  PK_V10_GEO_RESTRICTION,
  PK_V10_STACKING_POLICY,
  PK_V10_TIER_ARCHETYPE,
  PK_V10_TURNOVER_BASIS,
} from "@/features/promo-knowledge/schema/pk-v10";

// ─────────────────────────────────────────────────────────────────────────
// Answer / option types
// ─────────────────────────────────────────────────────────────────────────

export interface ChoiceOption {
  value: string;
  label: string;
}

export interface AdminAnswer {
  choice: string;
  customValue?: string;
  customSelection?: string[];
  note?: string;
}

export const CUSTOM = "__custom__";
export const NONE = "__none__";

export type FieldInputKind =
  | "radio"
  | "select-large"
  | "multi-chip"
  | "radio-with-date"
  | "radio-with-number";

export interface FieldRegistryEntry {
  path: string;
  /** Short label (chip/badge use). */
  label: string;
  /** Full question text shown to admin. */
  question: string;
  inputKind: FieldInputKind;
  options?: ChoiceOption[];
  multiOptions?: readonly string[];
  placeholder?: string;
  helpText?: string;
  /**
   * Optional sibling boolean path that mirrors the "unlimited / no-limit"
   * semantic of this field. When set, the entry MUST also implement
   * `writeSibling()` and the AdminVerify commit logic will:
   *   - mutate sibling via writeSibling()
   *   - mark _field_status[siblingPath] = "explicit"
   *   - log to _human_override_log only if value changed
   */
  unlimitedSiblingPath?: string;
  readSibling?: (rec: PkV10Record) => unknown;
  writeSibling?: (draft: PkV10Record, answer: AdminAnswer) => void;
  read: (rec: PkV10Record) => unknown;
  write: (draft: PkV10Record, answer: AdminAnswer) => void;
  /**
   * Optional admin_note resolver. When it returns a non-empty string,
   * AdminVerify uses it as the entry's `admin_note` (overriding `a.note`).
   * Used by options that carry a fixed semantic note (e.g.
   * "not_stated_confirmed") or that pipe `customValue` into admin_note
   * (e.g. "manual_note"). Does NOT change schema or _field_status.
   */
  getAdminNote?: (answer: AdminAnswer) => string | undefined;
  /**
   * Optional relevance gate. Used ONLY by gap-reader for the
   * not_stated / missing branch (authority gate still wins for
   * explicit / inferred / propagated / derived).
   *
   * Contract:
   *   - Pure function over structured JSON (NO raw_content, NO regex,
   *     NO keyword scan).
   *   - Return false  → field is operationally not applicable for this
   *                     promo → gap-reader will SKIP the question.
   *   - Return true   → field is relevant → gap-reader behaves as before.
   *   - Field without isRelevant → treated as relevant (backward compatible).
   */
  isRelevant?: (rec: PkV10Record) => boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Relevance helpers — structured-JSON only (no raw_content, no regex)
// ─────────────────────────────────────────────────────────────────────────

const REFERRAL_PROMO_TYPES = new Set(["referral", "affiliate"]);
const DOWNLINE_BASES = new Set(["downline_winlose", "downline_commission"]);
const DOWNLINE_TRIGGERS = new Set(["downline_activity", "referral_signup"]);
const DEPOSIT_TRIGGERS = new Set(["first_deposit", "deposit"]);
const DEPOSIT_BASES = new Set(["deposit", "deposit_plus_bonus"]);
const NON_MONETARY_REWARD_TYPES = new Set([
  "physical",
  "voucher",
  "merchandise",
  "item",
  "lucky_spin",
  "chance",
]);

const getPromoType = (r: PkV10Record): string =>
  (r.identity_engine?.promo_block?.promo_type ?? "").toString();
const getCalcBasis = (r: PkV10Record): string =>
  (r.reward_engine?.calculation_basis ?? "").toString();
const getTriggerEvent = (r: PkV10Record): string =>
  (r.trigger_engine?.primary_trigger_block?.trigger_event ?? "").toString();
const getRewardType = (r: PkV10Record): string =>
  (r.reward_engine?.reward_type ?? "").toString();

/** True if structured JSON shows this is a downline/commission referral. */
const isDownlineReferral = (r: PkV10Record): boolean => {
  const pt = getPromoType(r);
  const cb = getCalcBasis(r);
  const te = getTriggerEvent(r);
  return (
    REFERRAL_PROMO_TYPES.has(pt) &&
    (DOWNLINE_BASES.has(cb) || DOWNLINE_TRIGGERS.has(te))
  );
};

/** True if structured JSON shows deposit-driven trigger/basis. */
const hasDepositSignal = (r: PkV10Record): boolean => {
  return (
    DEPOSIT_TRIGGERS.has(getTriggerEvent(r)) ||
    DEPOSIT_BASES.has(getCalcBasis(r))
  );
};

/** True if any subcategory shows a turnover_multiplier. */
const hasVariantTurnover = (r: PkV10Record): boolean => {
  const subs = (r.variant_engine?.items_block?.subcategories ?? []) as Array<
    Record<string, unknown>
  >;
  return subs.some((s) => {
    const tm = s?.turnover_multiplier;
    return typeof tm === "number" && tm > 0;
  });
};

/** True if any subcategory carries an explicit max_reward cap. */
const hasVariantMaxReward = (r: PkV10Record): boolean => {
  const subs = (r.variant_engine?.items_block?.subcategories ?? []) as Array<
    Record<string, unknown>
  >;
  return subs.some(
    (s) => typeof s?.max_reward === "number" && (s.max_reward as number) > 0,
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Label map + helpers (UI-only, no decision logic)
// ─────────────────────────────────────────────────────────────────────────

const ID_LABELS: Record<string, string> = {
  no_stacking: "Tidak bisa digabung",
  stack_with_whitelist: "Bisa digabung (whitelist)",
  stack_freely: "Bisa digabung bebas",
  conditional_stack: "Bersyarat",
  auto: "Otomatis",
  manual_livechat: "Manual via Livechat",
  manual_whatsapp: "Manual via WhatsApp",
  manual_telegram: "Manual via Telegram",
  in_app_button: "Tombol di Aplikasi",
  form_submission: "Form",
  cs_approval: "Approval CS",
  deposit_only: "Deposit",
  bonus_only: "Bonus",
  deposit_plus_bonus: "Deposit + Bonus",
  total_bet: "Total Taruhan",
  total_loss: "Total Kekalahan",
  indonesia: "Indonesia",
  jakarta: "Jakarta",
  sea: "Asia Tenggara",
  global: "Semua wilayah",
};

const naturalize = (s: string): string =>
  s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();

const enumToOptions = (values: readonly string[]): ChoiceOption[] =>
  values.map((v) => ({ value: v, label: ID_LABELS[v] ?? naturalize(v) }));

// ─────────────────────────────────────────────────────────────────────────
// REGISTRY — critical operational fields ONLY
// ─────────────────────────────────────────────────────────────────────────

export const FIELD_REGISTRY: FieldRegistryEntry[] = [
  {
    path: "period_engine.validity_block.valid_until",
    label: "Masa berlaku",
    question: "Sampai kapan promo ini berlaku?",
    inputKind: "radio-with-date",
    options: [
      { value: "no_expiry", label: "Tidak ada batas waktu" },
      { value: CUSTOM, label: "Tanggal tertentu" },
      { value: "not_stated_confirmed", label: "Tidak disebutkan di sumber" },
      { value: "manual_note", label: "Jelaskan manual" },
    ],
    read: (r) => r.period_engine?.validity_block?.valid_until,
    write: (d, a) => {
      if (a.choice === "no_expiry") {
        d.period_engine.validity_block.valid_until = null as never;
      } else if (a.choice === "not_stated_confirmed" || a.choice === "manual_note") {
        // Admin confirms absence / explains manually — no fabricated date,
        // no unlimited flag. Audit trail lives in _human_override_log via getAdminNote.
        d.period_engine.validity_block.valid_until = null as never;
      } else {
        d.period_engine.validity_block.valid_until = ((a.customValue ?? "") as never);
      }
    },
    unlimitedSiblingPath: "period_engine.validity_block.valid_until_unlimited",
    readSibling: (r) => r.period_engine?.validity_block?.valid_until_unlimited,
    writeSibling: (d, a) => {
      // Only "no_expiry" implies unlimited. The two new admin-confirmation
      // options explicitly do NOT flip this flag (per doctrine).
      d.period_engine.validity_block.valid_until_unlimited =
        a.choice === "no_expiry";
    },
    getAdminNote: (a) => {
      if (a.choice === "not_stated_confirmed") {
        return "Admin confirmed valid_until is not stated in source";
      }
      if (a.choice === "manual_note") {
        const v = (a.customValue ?? "").trim();
        return v.length > 0 ? v : undefined;
      }
      return undefined;
    },
  },
  {
    path: "claim_engine.method_block.claim_method",
    label: "Metode klaim",
    question: "Bagaimana member mengklaim promo ini?",
    inputKind: "radio",
    options: enumToOptions(PK_V10_CLAIM_METHOD),
    read: (r) => r.claim_engine?.method_block?.claim_method,
    write: (d, a) => {
      d.claim_engine.method_block.claim_method = a.choice;
    },
  },
  {
    path: "reward_engine.payout_direction",
    label: "Arah payout",
    question: "Bonus dibayar kapan?",
    inputKind: "radio",
    options: [
      { value: "upfront", label: "Di depan (langsung saat klaim)" },
      { value: "backend", label: "Di belakang (setelah syarat tercapai)" },
    ],
    read: (r) => r.reward_engine?.payout_direction,
    write: (d, a) => {
      d.reward_engine.payout_direction = a.choice;
    },
  },
  {
    path: "taxonomy_engine.logic_block.turnover_basis",
    label: "Turnover basis",
    question: "Hitungan turnover dari mana?",
    inputKind: "radio",
    options: enumToOptions(PK_V10_TURNOVER_BASIS),
    read: (r) => r.taxonomy_engine?.logic_block?.turnover_basis,
    write: (d, a) => {
      d.taxonomy_engine.logic_block.turnover_basis = a.choice;
    },
    isRelevant: (r) => {
      // Skip when promo is downline-referral (no member-side wagering).
      if (isDownlineReferral(r)) return false;
      // Relevant if any structured signal of turnover/wagering exists.
      const tm = (r.taxonomy_engine?.logic_block as Record<string, unknown> | undefined)
        ?.turnover_multiplier;
      if (typeof tm === "number" && tm > 0) return true;
      if (hasVariantTurnover(r)) return true;
      // Default: assume relevant (backward compatible — admin can still answer).
      return true;
    },
  },
  {
    path: "dependency_engine.stacking_block.stacking_policy",
    label: "Stacking",
    question: "Boleh digabung dengan promo lain?",
    inputKind: "radio",
    options: enumToOptions(PK_V10_STACKING_POLICY),
    read: (r) => r.dependency_engine?.stacking_block?.stacking_policy,
    write: (d, a) => {
      d.dependency_engine.stacking_block.stacking_policy = a.choice;
    },
  },
  {
    path: "reward_engine.requirement_block.min_deposit",
    label: "Min deposit",
    question: "Minimum deposit untuk eligible?",
    inputKind: "radio-with-number",
    options: [
      { value: "0", label: "Tanpa minimum" },
      { value: "25000", label: "25.000" },
      { value: "50000", label: "50.000" },
      { value: "100000", label: "100.000" },
      { value: CUSTOM, label: "Lainnya" },
    ],
    read: (r) => r.reward_engine?.requirement_block?.min_deposit,
    write: (d, a) => {
      const raw = a.choice === CUSTOM ? a.customValue : a.choice;
      d.reward_engine.requirement_block.min_deposit =
        raw === "" || raw === undefined ? null : Number(raw);
    },
    isRelevant: (r) => {
      // If structured JSON shows a deposit signal, ALWAYS relevant —
      // even for referral promos that also gate on deposit.
      if (hasDepositSignal(r)) return true;
      // Skip downline-referral with no deposit signal.
      if (isDownlineReferral(r)) return false;
      return true;
    },
  },
  {
    path: "reward_engine.max_reward",
    label: "Max reward",
    question: "Ada batas maksimum bonus?",
    inputKind: "radio-with-number",
    options: [
      { value: NONE, label: "Tidak ada batas" },
      { value: "100000", label: "100.000" },
      { value: "500000", label: "500.000" },
      { value: "1000000", label: "1.000.000" },
      { value: CUSTOM, label: "Lainnya" },
    ],
    read: (r) => r.reward_engine?.max_reward,
    write: (d, a) => {
      if (a.choice === NONE) {
        d.reward_engine.max_reward = null;
        return;
      }
      const raw = a.choice === CUSTOM ? a.customValue : a.choice;
      d.reward_engine.max_reward =
        raw === "" || raw === undefined ? null : Number(raw);
    },
    unlimitedSiblingPath: "reward_engine.max_reward_unlimited",
    readSibling: (r) => r.reward_engine?.max_reward_unlimited,
    writeSibling: (d, a) => {
      d.reward_engine.max_reward_unlimited = a.choice === NONE;
    },
    isRelevant: (r) => {
      // Unlimited cap explicitly set → no need to ask.
      if (r.reward_engine?.max_reward_unlimited === true) return false;
      // Non-monetary reward types don't carry a numeric cap.
      const rt = getRewardType(r);
      if (rt && NON_MONETARY_REWARD_TYPES.has(rt)) return false;
      // Multi-mode: cap lives per-variant — root max_reward not applicable.
      const mode = (r.identity_engine?.promo_block?.promo_mode ?? "").toString();
      if (mode === "multi" && hasVariantMaxReward(r)) return false;
      return true;
    },
  },
  {
    path: "scope_engine.geo_block.geo_restriction",
    label: "Geo",
    question: "Berlaku untuk wilayah mana?",
    inputKind: "select-large",
    options: enumToOptions(PK_V10_GEO_RESTRICTION),
    read: (r) => r.scope_engine?.geo_block?.geo_restriction,
    write: (d, a) => {
      d.scope_engine.geo_block.geo_restriction = a.choice;
    },
  },
];

export const FIELD_REGISTRY_INDEX: Map<string, FieldRegistryEntry> = new Map(
  FIELD_REGISTRY.map((e) => [e.path, e]),
);
