/**
 * Phase 3C UX — Display-only mapper for publish blockers.
 *
 * PURE / READ-ONLY. Never mutates record. Never bypasses canPublish.
 * Translates technical canPublish reasons + readiness flags into
 * admin-friendly Indonesian copy + actionable items for iGaming admins.
 */
import type { PkV10Record } from "../schema/pk-v10";

export type BlockerActionTarget =
  | "sk_editor"
  | "review_list"
  | "contradictions"
  | "variants"
  | "none";

export interface BlockerActionItem {
  id: string;
  title: string;
  description: string;
  suggestion?: string;
  actionLabel?: string;
  actionTarget: BlockerActionTarget;
  tone: "warning" | "error" | "info";
  /** Optional excerpt of the offending item (e.g. the S&K sentence). */
  highlight?: string;
}

export interface PublishBlockerDisplay {
  blocked: boolean;
  title: string;
  subtitle: string;
  /** Compact one-liner used by Final Readiness Gate. */
  shortSummary: string;
  reasons: string[];           // human-readable bullets
  nextSteps: string[];
  technicalReasons: string[];
  contradictions: string[];
  warnings: string[];
  ambiguity: string[];
  /** Deduped, ordered actionable items for the "Yang harus diperbaiki" card. */
  actions: BlockerActionItem[];
}

const REASON_MAP: Array<{ match: RegExp; human: string }> = [
  { match: /^no record loaded/i, human: "Draft promo belum termuat. Simpan atau refresh draft terlebih dahulu." },
  { match: /^record is missing/i, human: "Draft promo belum termuat. Simpan atau refresh draft terlebih dahulu." },
  { match: /^record_id missing/i, human: "ID promo belum tersedia." },
  { match: /client_block\.client_id missing/i, human: "Kode brand / client ID belum lengkap." },
  { match: /promo_block\.promo_name missing/i, human: "Nama promo belum lengkap." },
  { match: /schema_version must be/i, human: "Versi data promo tidak sesuai V.10.1." },
  { match: /raw_content missing or empty/i, human: "Source promo asli belum tersedia." },
  { match: /^variant_engine missing/i, human: "Data varian promo belum lengkap." },
  { match: /^_field_status missing/i, human: "Status field belum lengkap." },
  { match: /^ai_confidence missing/i, human: "Skor keyakinan AI belum tersedia." },
  { match: /observability_block\.review_required is true/i, human: "Promo masih perlu review manual." },
  { match: /validation_block\.status is "needs_review"/i, human: "Status validasi masih membutuhkan review." },
  { match: /commit_block\.ready_to_commit is false/i, human: "Promo belum ditandai siap publish." },
];

const humanizeReason = (raw: string): string => {
  for (const { match, human } of REASON_MAP) {
    if (match.test(raw)) return human;
  }
  return raw;
};

/** Detect "S&K vs game-type" contradictions (slot/casino/sports). */
function detectSkGameTypeConflict(contradictions: string[]): string | null {
  for (const c of contradictions) {
    const lower = c.toLowerCase();
    const mentionsSk = /(s&k|s\.k|syarat|terms|t&c)/i.test(c);
    const mentionsSlot = /slot/i.test(lower);
    const mentionsOther = /(casino|sport|sportsbook|live\s*casino)/i.test(lower);
    if ((mentionsSk && mentionsSlot) || (mentionsSlot && mentionsOther)) {
      return c;
    }
  }
  return null;
}

function detectProductAmbiguity(ambiguity: string[]): string | null {
  for (const a of ambiguity) {
    if (/(produk|product|rp\s*50\.?000|paket)/i.test(a)) return a;
  }
  return null;
}

export function buildPublishBlockerDisplay(
  rec: PkV10Record | null,
  publishGate: { ok: boolean; reasons: string[] },
): PublishBlockerDisplay {
  const technical = publishGate.reasons ?? [];
  const readiness = (rec?.readiness_engine ?? {}) as Record<string, any>;
  const obs = (readiness.observability_block ?? {}) as Record<string, any>;
  const val = (readiness.validation_block ?? {}) as Record<string, any>;

  const contradictions: string[] = Array.isArray(obs.contradiction_flags) ? obs.contradiction_flags : [];
  const warnings: string[] = Array.isArray(val.warnings) ? val.warnings : [];
  const ambiguity: string[] = Array.isArray(obs.ambiguity_flags) ? obs.ambiguity_flags : [];

  const humanReasons = new Set<string>();
  for (const r of technical) humanReasons.add(humanizeReason(r));
  if (contradictions.length > 0) humanReasons.add("Ada aturan yang saling bertentangan.");

  const reasons = Array.from(humanReasons);

  const nextSteps: string[] = [];
  if (!publishGate.ok) {
    if (warnings.length > 0 || ambiguity.length > 0 || contradictions.length > 0) {
      nextSteps.push("Buka bagian Warnings / Ambiguity / Contradictions di bawah.");
    }
    if (contradictions.length > 0) {
      nextSteps.push("Tentukan sumber yang benar (mis. tabel paket vs S&K) dan perbaiki konflik.");
    }
    if (technical.some((r) => /review_required is true/.test(r))) {
      nextSteps.push("Setelah review selesai, tandai promo siap publish.");
    }
    if (technical.some((r) => /ready_to_commit is false/.test(r))) {
      nextSteps.push("Tandai promo siap publish setelah semua data dicek.");
    }
    if (technical.some((r) => /raw_content/.test(r))) {
      nextSteps.push("Pastikan source promo asli (raw content) sudah terisi.");
    }
    if (nextSteps.length === 0) {
      nextSteps.push("Periksa data promo lalu simpan ulang draft.");
    }
  }

  // ── Build actionable items (deduped, ordered) ──────────────────────────
  const actions: BlockerActionItem[] = [];
  const skConflict = detectSkGameTypeConflict(contradictions);
  if (skConflict) {
    actions.push({
      id: "sk_game_type_conflict",
      title: "S&K tidak konsisten dengan tabel paket",
      description:
        "S&K menyebut bonus khusus SLOT, tetapi tabel paket promo mencakup Casino, Sports, dan Slot.",
      suggestion:
        "Perbaiki kalimat S&K agar sesuai dengan tabel paket, atau koreksi tabel varian jika S&K yang benar.",
      actionLabel: "Perbaiki S&K",
      actionTarget: "sk_editor",
      tone: "error",
      highlight: skConflict,
    });
  }

  // Generic remaining contradictions (excluding the S&K-specific one above)
  const otherContradictions = contradictions.filter((c) => c !== skConflict);
  if (otherContradictions.length > 0) {
    actions.push({
      id: "contradictions_generic",
      title: "Ada aturan yang saling bertentangan",
      description: `Ditemukan ${otherContradictions.length} konflik antar field. Periksa dan tentukan sumber yang benar.`,
      actionLabel: "Lihat konflik",
      actionTarget: "contradictions",
      tone: "error",
    });
  }

  if (technical.some((r) => /review_required is true/.test(r))) {
    actions.push({
      id: "review_required",
      title: "Promo masih perlu review manual",
      description:
        "Setelah memperbaiki S&K, simpan draft lalu jalankan review ulang / tandai review selesai.",
      actionLabel: "Lihat daftar review",
      actionTarget: "review_list",
      tone: "warning",
    });
  }

  if (technical.some((r) => /ready_to_commit is false/.test(r))) {
    actions.push({
      id: "ready_to_commit",
      title: "Promo belum ditandai siap publish",
      description:
        "Setelah semua item review selesai, tandai promo siap publish (ready_to_commit).",
      actionLabel: "Selesaikan semua item review",
      actionTarget: "review_list",
      tone: "warning",
    });
  }

  const productAmb = detectProductAmbiguity(ambiguity);
  if (productAmb) {
    actions.push({
      id: "ambiguity_product",
      title: "Ada data produk yang mencurigakan",
      description:
        "Editor varian penuh belum tersedia. Untuk saat ini gunakan review manual untuk memverifikasi data paket.",
      actionLabel: "Periksa varian paket",
      actionTarget: "variants",
      tone: "warning",
      highlight: productAmb,
    });
  }

  // Compact short summary used by Final Readiness Gate
  const itemCount = actions.length || reasons.length;
  const shortSummary = publishGate.ok
    ? "Semua gate lulus."
    : itemCount > 0
    ? `Masih ada ${itemCount} hal yang perlu dicek sebelum publish.`
    : "Masih ada review yang perlu diselesaikan sebelum publish.";

  return {
    blocked: !publishGate.ok,
    title: publishGate.ok ? "Promo siap dipublish" : "Promo belum bisa dipublish",
    subtitle: publishGate.ok
      ? "Semua gate lulus. Klik Publish untuk kirim ke Supabase."
      : "Selesaikan review berikut sebelum publish ke Supabase.",
    shortSummary,
    reasons,
    nextSteps,
    technicalReasons: technical,
    contradictions,
    warnings,
    ambiguity,
    actions,
  };
}
