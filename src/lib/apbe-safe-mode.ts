/**
 * APBE Safe Mode Runtime Fallback v2.0
 * 
 * SIMPLIFIED - Only provides essential fallbacks.
 * 
 * Safe mode only applies:
 * - boundary_rules missing → Inject default rule
 * 
 * All other fields are OPTIONAL - no safe mode injection needed.
 */

import { 
  APBEConfig, 
  BoundaryRules
} from "@/types/apbe-config";

// ============================================================
// SAFE MODE DEFAULTS
// ============================================================

export const DEFAULT_BOUNDARY_RULES: BoundaryRules = {
  default_rules: ["AI dilarang menjawab pertanyaan di luar Knowledge Base"],
  custom_rules: [],
};

// ============================================================
// SAFE MODE REPORT
// ============================================================

export interface SafeModeActivation {
  field: string;
  reason: string;
  fallbackApplied: string;
  timestamp: string;
}

export interface SafeModeReport {
  isActive: boolean;
  activations: SafeModeActivation[];
  warnings: string[];
  configPatched: APBEConfig;
}

// ============================================================
// SAFE MODE ENGINE (SIMPLIFIED)
// ============================================================

/**
 * Apply safe mode fallbacks to config
 * Returns patched config + activation report
 */
export function applySafeMode(config: APBEConfig): SafeModeReport {
  const activations: SafeModeActivation[] = [];
  const warnings: string[] = [];
  
  // Deep clone config to avoid mutation
  const patchedConfig: APBEConfig = JSON.parse(JSON.stringify(config));
  
  // ========================================
  // 1. Check Boundary Rules (ONLY CRITICAL CHECK)
  // ========================================
  if (!patchedConfig.C.boundary_rules) {
    activations.push({
      field: "C.boundary_rules",
      reason: "Boundary rules tidak dikonfigurasi",
      fallbackApplied: "DEFAULT_BOUNDARY_RULES",
      timestamp: new Date().toISOString(),
    });
    patchedConfig.C.boundary_rules = { ...DEFAULT_BOUNDARY_RULES };
    warnings.push("[SAFE MODE] Boundary rules menggunakan fallback default");
  } else if (!patchedConfig.C.boundary_rules.default_rules || patchedConfig.C.boundary_rules.default_rules.length === 0) {
    activations.push({
      field: "C.boundary_rules.default_rules",
      reason: "Default boundary rule tidak ada",
      fallbackApplied: "DEFAULT_BOUNDARY_RULES.default_rules",
      timestamp: new Date().toISOString(),
    });
    patchedConfig.C.boundary_rules.default_rules = [...DEFAULT_BOUNDARY_RULES.default_rules];
    warnings.push("[SAFE MODE] Default boundary rule diinjeksi");
  }
  
  // All other fields are OPTIONAL - no safe mode needed
  // Lane rules, crisis templates, toxic severity, etc. are user's choice
  
  return {
    isActive: activations.length > 0,
    activations,
    warnings,
    configPatched: patchedConfig,
  };
}

/**
 * Quick check if config needs safe mode
 */
export function needsSafeMode(config: APBEConfig): boolean {
  // Only check boundary rules - everything else is optional
  if (!config.C?.boundary_rules) return true;
  if (!config.C.boundary_rules.default_rules || config.C.boundary_rules.default_rules.length === 0) return true;
  
  return false;
}

/**
 * Get safe mode summary for logging
 */
export function getSafeModeSummary(report: SafeModeReport): string {
  if (!report.isActive) {
    return "✅ Safe Mode tidak aktif - konfigurasi lengkap";
  }
  
  const lines = [
    `⚠️ Safe Mode AKTIF - ${report.activations.length} fallback diterapkan:`,
    ...report.activations.map(a => `  • ${a.field}: ${a.reason}`),
  ];
  
  return lines.join("\n");
}

// ============================================================
// VERSION
// ============================================================

export const SAFE_MODE_VERSION = "2.0.0" as const;
