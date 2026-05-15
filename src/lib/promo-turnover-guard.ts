import type { PromoFormData } from "@/components/VOCDashboard/PromoFormWizard/types";

/**
 * Turnover Semantic Guardrail - ENFORCES SEPARATION CONTRACT
 *
 * SEMANTIC CONTRACT (NON-NEGOTIABLE):
 * 1. Threshold (qualify) = min_calculation / fixed_min_calculation (angka Rupiah besar, e.g. 5.000.000)
 * 2. Multiplier WD = turnover_rule / fixed_turnover_rule (kelipatan kecil, e.g. "3x", "5x", max 100)
 * 
 * RULES:
 * - Threshold TIDAK BOLEH mengaktifkan WD toggle
 * - Multiplier > 100 = PASTI salah (threshold terbaca sebagai multiplier) → FORCE DISABLE
 * - Toggle WD tanpa multiplier = ERROR
 * - Threshold ≤ 100 = WARNING (kemungkinan tertukar)
 */

// Helper: Extract numeric value from multiplier string (e.g., "3x" → 3)
function parseMultiplier(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const str = String(raw).toLowerCase().trim();
  const match = str.match(/^(\d+)\s*[xX]?$/);
  if (match) {
    const num = parseInt(match[1], 10);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

// Helper: Check if value looks like a threshold (large Rupiah) misplaced as multiplier
function looksLikeThreshold(raw: string | undefined | null): boolean {
  if (!raw) return false;
  const num = parseMultiplier(raw);
  // If > 100, it's almost certainly a threshold (Rupiah), not a multiplier
  return num !== null && num > 100;
}

export function enforceTurnoverSemanticContract(
  data: PromoFormData
): { data: PromoFormData; warnings: string[] } {
  const warnings: string[] = [];
  let corrected = { ...data };

  // ==========================================
  // FIXED MODE (fixed_*)
  // ==========================================
  {
    const raw = corrected.fixed_turnover_rule;

    // RULE 1: Absurd multiplier (> 100) = FORCE DISABLE
    // This catches the SS01 bug where "5000000" was stored as multiplier
    if (corrected.fixed_turnover_rule_enabled && looksLikeThreshold(raw)) {
      const parsedNum = parseMultiplier(raw);
      warnings.push(
        `Syarat Main Sebelum WD DINONAKTIFKAN karena nilai "${raw}" (${parsedNum}) terlalu besar untuk kelipatan. ` +
        `Ini kemungkinan adalah threshold TO yang salah terbaca sebagai multiplier.`
      );
      corrected = {
        ...corrected,
        fixed_turnover_rule_enabled: false,
        fixed_turnover_rule: "",
        fixed_turnover_rule_custom: "",
      };
    }

    // RULE 2: If WD toggle OFF, clear the multiplier values (inert contract)
    if (!corrected.fixed_turnover_rule_enabled) {
      if (corrected.fixed_turnover_rule || corrected.fixed_turnover_rule_custom) {
        corrected = {
          ...corrected,
          fixed_turnover_rule: "",
          fixed_turnover_rule_custom: "",
        };
      }
    }

    // RULE 3: If WD toggle ON but no multiplier value, warn
    if (corrected.fixed_turnover_rule_enabled && !corrected.fixed_turnover_rule && !corrected.fixed_turnover_rule_custom) {
      warnings.push(
        "Syarat Main Sebelum WD aktif tapi nilai kelipatan kosong. Harap isi kelipatan (3x, 5x, dst)."
      );
    }

    // RULE 4: Threshold suspiciously low (anti-swap detection)
    if (
      corrected.fixed_min_calculation_enabled &&
      corrected.fixed_min_calculation != null &&
      corrected.fixed_min_calculation > 0 &&
      corrected.fixed_min_calculation <= 100
    ) {
      warnings.push(
        `Minimal Perhitungan = ${corrected.fixed_min_calculation} terlihat terlalu kecil untuk threshold Rupiah. ` +
        `Pastikan ini benar (bukan nilai multiplier yang tertukar).`
      );
    }
  }

  // ==========================================
  // FORMULA MODE (base fields: turnover_rule, min_calculation)
  // ==========================================
  {
    const raw = corrected.turnover_rule;

    // RULE 1: Absurd multiplier (> 100) = FORCE DISABLE
    if (corrected.turnover_rule_enabled && looksLikeThreshold(raw)) {
      const parsedNum = parseMultiplier(raw);
      warnings.push(
        `Syarat Main Sebelum WD (formula mode) DINONAKTIFKAN karena nilai "${raw}" (${parsedNum}) terlalu besar. ` +
        `Ini kemungkinan adalah threshold TO yang salah terbaca sebagai multiplier.`
      );
      corrected = {
        ...corrected,
        turnover_rule_enabled: false,
        turnover_rule: "",
        turnover_rule_custom: "",
      };
    }

    // RULE 2: If WD toggle OFF, clear the multiplier values
    if (!corrected.turnover_rule_enabled) {
      if (corrected.turnover_rule || corrected.turnover_rule_custom) {
        corrected = {
          ...corrected,
          turnover_rule: "",
          turnover_rule_custom: "",
        };
      }
    }

    // RULE 3: Threshold suspiciously low
    if (
      corrected.min_calculation_enabled &&
      corrected.min_calculation != null &&
      corrected.min_calculation > 0 &&
      corrected.min_calculation <= 100
    ) {
      warnings.push(
        `Minimal Perhitungan = ${corrected.min_calculation} terlihat terlalu kecil. ` +
        `Pastikan ini benar (bukan nilai multiplier yang tertukar).`
      );
    }
  }

  return { data: corrected, warnings };
}

/**
 * Migrate legacy turnover data where threshold was stored as multiplier.
 * Call this during normalization/load to fix old data.
 */
export function migrateLegacyTurnoverData(
  data: Partial<PromoFormData>
): { data: Partial<PromoFormData>; migrated: boolean } {
  let migrated = false;
  const corrected = { ...data };

  // FIXED MODE: Check if fixed_turnover_rule contains a threshold value
  if (corrected.fixed_turnover_rule && looksLikeThreshold(corrected.fixed_turnover_rule)) {
    const thresholdValue = parseMultiplier(corrected.fixed_turnover_rule);
    if (thresholdValue !== null) {
      console.log(`[TurnoverMigration] Migrating fixed_turnover_rule ${thresholdValue} → fixed_min_calculation`);
      
      // Move to threshold field if not already set
      if (!corrected.fixed_min_calculation || corrected.fixed_min_calculation === 0) {
        corrected.fixed_min_calculation = thresholdValue;
        corrected.fixed_min_calculation_enabled = true;
      }
      
      // Clear the wrongly-placed multiplier
      corrected.fixed_turnover_rule = "";
      corrected.fixed_turnover_rule_enabled = false;
      corrected.fixed_turnover_rule_custom = "";
      migrated = true;
    }
  }

  // FORMULA MODE: Same logic for base fields
  if (corrected.turnover_rule && looksLikeThreshold(String(corrected.turnover_rule))) {
    const thresholdValue = parseMultiplier(String(corrected.turnover_rule));
    if (thresholdValue !== null) {
      console.log(`[TurnoverMigration] Migrating turnover_rule ${thresholdValue} → min_calculation`);
      
      if (!corrected.min_calculation || corrected.min_calculation === 0) {
        corrected.min_calculation = thresholdValue;
        corrected.min_calculation_enabled = true;
      }
      
      corrected.turnover_rule = "";
      corrected.turnover_rule_enabled = false;
      corrected.turnover_rule_custom = "";
      migrated = true;
    }
  }

  return { data: corrected, migrated };
}
