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
  read: (rec: PkV10Record) => unknown;
  write: (draft: PkV10Record, answer: AdminAnswer) => void;
}

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
    ],
    read: (r) => r.period_engine?.validity_block?.valid_until,
    write: (d, a) => {
      d.period_engine.validity_block.valid_until =
        a.choice === "no_expiry" ? (null as never) : ((a.customValue ?? "") as never);
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
