/**
 * PR-22 — Humanize Admin Verify Issue (PRESENTATION ONLY).
 *
 * Pure mapper from {AdminVerifyIssueQuestion + PkV10Record context} to a
 * UI-only HumanizedIssue model. No backend logic. No JSON mutation.
 * No regex/keyword business logic on warning text.
 *
 * Consumer: AdminVerifySection's ExtractorIssueCard.
 *
 * Strict rules:
 *   - Read-only access to record (for context like variant_name, current_value).
 *   - Never edits raw_content.
 *   - Never invents categorization from source_text via regex.
 *   - Internal `value` of each option is a hidden hint for the resolver only;
 *     the admin-facing copy is `label` + optional `helper`.
 *   - When a card cannot show a concrete object, `shouldRenderAsAdminQuestion`
 *     becomes false so the UI can fall back to a low-priority debug card.
 */

import type { PkV10Record } from "../schema/pk-v10";
import type { AdminVerifyIssueQuestion } from "./extractor-issue-adapter";

// ─── Public model ──────────────────────────────────────────────────────

export interface HumanOption {
  /** Hidden internal hint passed to the resolver. NOT shown as main label. */
  value: string;
  /** Admin-facing label, plain Bahasa Indonesia, no jargon. */
  label: string;
  /** Optional one-line helper sentence under the label. */
  helper?: string;
}

export interface HumanizedIssue {
  /** Card title — admin-facing question framing. */
  title: string;
  /** One-sentence explanation of why the system is asking. */
  description: string;
  /** Optional reason tagline — e.g. "Sistem ragu karena ...". */
  reason?: string;
  /** Concrete object label — e.g. "Sistem menemukan:" / "Paket:". */
  objectLabel?: string;
  /** Concrete object value to show verbatim — source_text / current_value. */
  objectValue?: string;
  /** Optional context lines (key/value pairs) shown above the question. */
  contextLines?: Array<{ key: string; value: string }>;
  /** Specific question the admin answers. */
  mainQuestion: string;
  /** Radio options, or null when free-text only is appropriate. */
  options: HumanOption[] | null;
  /** Severity badge presentation. */
  badge: { label: string; variant: "warning" | "destructive" | "pending" };
  /**
   * False ⇒ card has no concrete object and should be rendered as a
   * low-priority debug card, not a normal admin question.
   */
  shouldRenderAsAdminQuestion: boolean;
}

// ─── Severity badges ───────────────────────────────────────────────────

const SEVERITY_HUMAN: Record<
  AdminVerifyIssueQuestion["severity"],
  { label: string; variant: "warning" | "destructive" | "pending" }
> = {
  warning: { label: "Perlu Dicek", variant: "warning" },
  ambiguity: { label: "Belum Jelas", variant: "pending" },
  contradiction: { label: "Tidak Konsisten", variant: "destructive" },
};

// ─── Option presets ────────────────────────────────────────────────────

export const RULE_TYPE_OPTIONS: HumanOption[] = [
  {
    value: "conditional",
    label: "Hanya untuk member baru setelah deposit pertama",
    helper: "Contoh: member baru + deposit pertama.",
  },
  {
    value: "threshold",
    label: "Berlaku setelah member mencapai batas tertentu",
    helper:
      "Contoh: minimal deposit, minimal turnover, atau nominal tertentu.",
  },
  {
    value: "compound",
    label: "Berlaku jika beberapa syarat digabung",
    helper: "Contoh: member baru + deposit pertama + pilih paket.",
  },
  {
    value: "sequential",
    label: "Syarat harus dipenuhi berurutan",
    helper: "Contoh: daftar → deposit → klaim.",
  },
  {
    value: "recurring",
    label: "Berlaku berulang",
    helper: "Contoh: bisa diklaim harian/mingguan/bulanan.",
  },
  {
    value: "manual",
    label: "Lainnya, saya jelaskan manual",
    helper: "Gunakan jika opsi di atas tidak cocok.",
  },
];

export const TURNOVER_FORMAT_OPTIONS: HumanOption[] = [
  {
    value: "multiplier",
    label: "Kelipatan dari deposit/bonus",
    helper: "Contoh: (Deposit + Bonus) x 20.",
  },
  {
    value: "min_rupiah",
    label: "Nominal minimum turnover",
    helper: "Contoh: wajib turnover minimal Rp500.000.",
  },
  {
    value: "manual",
    label: "Saya ingin menjelaskan manual",
    helper: "Gunakan jika kedua opsi di atas tidak cocok.",
  },
];

export const CURRENCY_OPTIONS: HumanOption[] = [
  { value: "IDR", label: "Rupiah Indonesia / IDR" },
  { value: "KHR", label: "Riel Kamboja / KHR" },
  { value: "PHP", label: "Peso Filipina / PHP" },
  { value: "manual", label: "Mata uang lain, saya jelaskan manual" },
  { value: "", label: "Tidak disebutkan di promo" },
];

export const GENERIC_CATEGORY_OPTIONS: HumanOption[] = [
  { value: "terms_conditions", label: "Masuk ke Syarat & Ketentuan" },
  { value: "variant_table", label: "Masuk ke tabel / paket bonus" },
  { value: "claim_method", label: "Masuk ke cara klaim" },
  { value: "turnover_rule", label: "Masuk ke aturan turnover / perhitungan" },
  { value: "providers_games", label: "Masuk ke provider / game yang berlaku" },
  { value: "wrong_promo", label: "Ini salah tempel dari promo lain" },
  { value: "discard", label: "Tidak perlu dimasukkan ke data promo" },
  { value: "manual", label: "Saya ingin menjelaskan manual" },
];

export const CONTRADICTION_RESOLUTION_OPTIONS: HumanOption[] = [
  {
    value: "trust_variant_table",
    label: "Tabel / struktur paket promo yang benar",
  },
  { value: "trust_terms", label: "Syarat & Ketentuan yang benar" },
  { value: "fix_both", label: "Keduanya perlu diperbaiki" },
  { value: "wrong_promo", label: "Ini salah tempel dari promo lain" },
  { value: "manual", label: "Saya ingin menjelaskan manual" },
];

// ─── Read helpers (read-only, no regex business logic) ─────────────────

function readPath(rec: unknown, dotted: string): unknown {
  const segs = dotted.split(/\.|\[|\]/).filter((s) => s.length > 0);
  let cur: unknown = rec;
  for (const s of segs) {
    if (cur && typeof cur === "object") {
      cur = (cur as Record<string, unknown>)[s];
    } else {
      return undefined;
    }
  }
  return cur;
}

function asString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function variantNameFromPath(rec: PkV10Record | null, path: string): string {
  // Accept both `subcategories[2].turnover_rule_format` and
  // `subcategories.2.turnover_rule_format`.
  const m = path.match(/subcategories\[?(\d+)\]?\./);
  if (!m || !rec) return "";
  const idx = Number(m[1]);
  const subs = readPath(rec, "variant_engine.items_block.subcategories");
  if (!Array.isArray(subs)) return "";
  const sub = subs[idx];
  if (!sub || typeof sub !== "object") return "";
  const r = sub as Record<string, unknown>;
  const name =
    r.variant_name ??
    r.subcategory_name ??
    r.product_name ??
    r.name ??
    "";
  return typeof name === "string" ? name : "";
}

// ─── Main mapper ───────────────────────────────────────────────────────

export function humanizeIssue(
  question: AdminVerifyIssueQuestion,
  record: PkV10Record | null,
): HumanizedIssue {
  const badge = SEVERITY_HUMAN[question.severity];
  const path = question.affected_paths[0] ?? "";

  // ── A. rule_type ─────────────────────────────────────────────────────
  if (path === "trigger_engine.trigger_rule_block.rule_type") {
    const triggerEvent = asString(
      readPath(record, "trigger_engine.trigger_rule_block.trigger_event"),
    );
    const conditions = (() => {
      const v = readPath(record, "trigger_engine.trigger_rule_block.conditions");
      if (Array.isArray(v)) return v.map(asString).filter(Boolean).join("; ");
      return asString(v);
    })();
    const targetUser = asString(
      readPath(record, "scope_engine.audience_block.target_user"),
    );
    const promoType = asString(
      readPath(record, "identity_engine.promo_block.promo_type"),
    );
    const ctx: Array<{ key: string; value: string }> = [];
    if (triggerEvent) ctx.push({ key: "Trigger", value: triggerEvent });
    if (conditions) ctx.push({ key: "Kondisi", value: conditions });
    if (targetUser) ctx.push({ key: "Target member", value: targetUser });
    if (promoType) ctx.push({ key: "Tipe promo", value: promoType });

    return {
      title: "Cara promo ini bisa diklaim perlu dikonfirmasi",
      description:
        "Sistem perlu memastikan kondisi apa yang membuat promo ini bisa diklaim.",
      contextLines: ctx.length > 0 ? ctx : undefined,
      mainQuestion: "Promo ini bisa diklaim dalam kondisi apa?",
      options: RULE_TYPE_OPTIONS,
      badge,
      shouldRenderAsAdminQuestion: true,
    };
  }

  // ── B. turnover_rule_format (per variant) ────────────────────────────
  if (path.includes(".turnover_rule_format")) {
    const variantName = variantNameFromPath(record, path);
    const currentValue = asString(readPath(record, path));
    return {
      title: "Cara hitung turnover untuk paket ini perlu dikonfirmasi",
      description:
        "Sistem menemukan aturan turnover yang masih perlu dipastikan.",
      objectLabel: variantName ? "Paket:" : "Sistem membaca aturan turnover:",
      objectValue: variantName || currentValue || "—",
      contextLines: variantName && currentValue
        ? [{ key: "Aturan turnover dibaca", value: currentValue }]
        : undefined,
      mainQuestion: "Turnover untuk paket ini dihitung dengan cara apa?",
      options: TURNOVER_FORMAT_OPTIONS,
      badge,
      shouldRenderAsAdminQuestion: !!(variantName || currentValue),
    };
  }

  // ── C. currency ──────────────────────────────────────────────────────
  if (path === "reward_engine.currency") {
    const currentValue = asString(readPath(record, path));
    return {
      title: "Mata uang promo perlu dikonfirmasi",
      description: "Sistem belum yakin mata uang yang dipakai promo ini.",
      objectLabel: currentValue ? "Sistem membaca mata uang:" : undefined,
      objectValue: currentValue || undefined,
      mainQuestion: "Mata uang yang dipakai promo ini apa?",
      options: CURRENCY_OPTIONS,
      badge,
      // Always renderable — even kosong tetap layak ditanya.
      shouldRenderAsAdminQuestion: true,
    };
  }

  // ── D. state / validation_status ─────────────────────────────────────
  if (
    path === "readiness_engine.state_block.state" ||
    path === "readiness_engine.validation_block.status"
  ) {
    const currentValue = asString(readPath(record, path));
    const STATE_OPTIONS: HumanOption[] = [
      { value: "draft", label: "Masih draft" },
      { value: "ready", label: "Siap diuji" },
      { value: "published", label: "Sudah dipublish" },
      { value: "rejected", label: "Ditolak / tidak dipakai" },
      { value: "manual", label: "Saya jelaskan manual" },
    ];
    return {
      title: "Status pengerjaan promo perlu dikonfirmasi",
      description: "Sistem menemukan status pengerjaan yang belum dikenali.",
      objectLabel: currentValue ? "Sistem membaca status:" : undefined,
      objectValue: currentValue || undefined,
      mainQuestion: "Status pengerjaan promo ini sekarang apa?",
      options: STATE_OPTIONS,
      badge,
      shouldRenderAsAdminQuestion: true,
    };
  }

  // ── E. Generic fallback (no structured affected_paths) ───────────────
  // Show source_text as the concrete object. Ask admin to classify.
  const isContradiction = question.severity === "contradiction";
  const source = (question.source_text ?? "").trim();

  if (isContradiction) {
    return {
      title: "Ada informasi promo yang saling bertentangan",
      description: "Sistem menemukan bagian promo yang tidak konsisten.",
      objectLabel: "Sistem menemukan:",
      objectValue: source || undefined,
      mainQuestion: "Bagian mana yang harus dijadikan acuan?",
      options: CONTRADICTION_RESOLUTION_OPTIONS,
      badge,
      shouldRenderAsAdminQuestion: source.length > 0,
    };
  }

  return {
    title: "Teks atau data dari extractor perlu dikonfirmasi",
    description:
      "Sistem menemukan teks/data berikut yang belum jelas cara memasukkannya ke data promo.",
    objectLabel: "Sistem menemukan:",
    objectValue: source || undefined,
    mainQuestion: "Teks/data di atas seharusnya diperlakukan sebagai apa?",
    options: GENERIC_CATEGORY_OPTIONS,
    badge,
    shouldRenderAsAdminQuestion: source.length > 0,
  };
}
