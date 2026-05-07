/**
 * Phase 3C UX — Display-only mapper for publish blockers.
 *
 * PURE / READ-ONLY. Never mutates record. Never bypasses canPublish.
 * Translates technical canPublish reasons + readiness flags into
 * admin-friendly Indonesian copy for iGaming admins.
 */
import type { PkV10Record } from "../schema/pk-v10";

export interface PublishBlockerDisplay {
  blocked: boolean;
  title: string;
  subtitle: string;
  reasons: string[];        // human-readable bullets ("Yang perlu dicek")
  nextSteps: string[];      // actionable guidance ("Langkah berikutnya")
  technicalReasons: string[]; // raw canPublish reasons (for collapsible)
  contradictions: string[];
  warnings: string[];
  ambiguity: string[];
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
  if (publishGate.ok) {
    // not blocked
  } else {
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

  return {
    blocked: !publishGate.ok,
    title: publishGate.ok ? "Promo siap dipublish" : "Promo belum bisa dipublish",
    subtitle: publishGate.ok
      ? "Semua gate lulus. Klik Publish untuk kirim ke Supabase."
      : "Selesaikan review berikut sebelum publish ke Supabase.",
    reasons,
    nextSteps,
    technicalReasons: technical,
    contradictions,
    warnings,
    ambiguity,
  };
}
