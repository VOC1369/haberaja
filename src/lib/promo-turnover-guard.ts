import type { PromoFormData } from "@/components/VOCDashboard/PromoFormWizard/types";

/**
 * Turnover semantic guardrail.
 *
 * Kontrak:
 * - Threshold (qualify) disimpan di min_calculation / fixed_min_calculation
 * - Multiplier WD disimpan di turnover_rule / fixed_turnover_rule
 * - Threshold TIDAK BOLEH diinterpretasi sebagai multiplier
 */
export function enforceTurnoverSemanticContract(
  data: PromoFormData
): { data: PromoFormData; warnings: string[] } {
  const warnings: string[] = [];

  // ---------- FIXED MODE (fixed_*) ----------
  {
    const raw = String(data.fixed_turnover_rule || "");
    const num = Number(raw.replace(/[^0-9]/g, ""));

    // Guard absurd multiplier (indikasi salah parsing threshold → multiplier)
    if (data.fixed_turnover_rule_enabled && raw && Number.isFinite(num) && num > 100) {
      warnings.push(
        "Syarat Main Sebelum WD dinonaktifkan karena nilai kelipatan tidak masuk akal (indikasi threshold TO terbaca sebagai multiplier)."
      );
      data = {
        ...data,
        fixed_turnover_rule_enabled: false,
        fixed_turnover_rule: "",
        fixed_turnover_rule_custom: "",
      };
    }

    // If toggle OFF, ensure value is inert
    if (!data.fixed_turnover_rule_enabled && raw) {
      data = { ...data, fixed_turnover_rule: "", fixed_turnover_rule_custom: "" };
    }

    // Threshold suspiciously low (anti swap)
    if (
      data.fixed_min_calculation_enabled &&
      data.fixed_min_calculation != null &&
      data.fixed_min_calculation > 0 &&
      data.fixed_min_calculation <= 100
    ) {
      warnings.push(
        "Minimal Perhitungan terlihat terlalu kecil; pastikan ini benar (bukan nilai multiplier yang tertukar)."
      );
    }
  }

  // ---------- FORMULA MODE (base turnover_rule / min_calculation) ----------
  {
    const raw = String(data.turnover_rule || "");
    const num = Number(raw.replace(/[^0-9]/g, ""));

    if (data.turnover_rule_enabled && raw && Number.isFinite(num) && num > 100) {
      warnings.push(
        "Syarat Main Sebelum WD dinonaktifkan karena nilai kelipatan tidak masuk akal (indikasi threshold terbaca sebagai multiplier)."
      );
      data = {
        ...data,
        turnover_rule_enabled: false,
        turnover_rule: "",
        turnover_rule_custom: "",
      };
    }

    if (!data.turnover_rule_enabled && raw) {
      data = { ...data, turnover_rule: "", turnover_rule_custom: "" };
    }

    if (data.min_calculation_enabled && data.min_calculation != null && data.min_calculation > 0 && data.min_calculation <= 100) {
      warnings.push(
        "Minimal Perhitungan terlihat terlalu kecil; pastikan ini benar (bukan nilai multiplier yang tertukar)."
      );
    }
  }

  return { data, warnings };
}
