/**
 * APBE v1.2 Export/Import Utilities
 * 
 * V1.2 Changes:
 * - Updated config_version to 1.2.0
 * - Removed deprecated fields from export
 * 
 * V1.1 Changes:
 * - Added config_version to exported JSON
 * - Added checksum for integrity validation
 * - Added brand mismatch validation on import
 * - Added required:true/false metadata for future-proofing
 */

import { APBEConfig, initialAPBEConfig } from "@/types/apbe-config";
import { generateChecksum, generateIntegrityData, validateIntegrity, IntegrityData } from "./apbe-checksum";
import { CURRENT_SCHEMA_VERSION } from "./apbe-storage";

// ========================
// EXPORT METADATA INTERFACE (V1.1)
// ========================
export interface APBEExportMeta {
  export_date: string;
  exported_by: string;
  schema_version: string;
  config_version: string;        // NEW: APBE config version
  persona_name: string;
  persona_version: number;
  source: string;
  brand_identity: {              // NEW: For brand mismatch validation
    website_name: string;
    group_name: string;
  };
  integrity: IntegrityData;      // NEW: Checksum & integrity data
  field_metadata: {              // NEW: Required/optional field info
    total_fields: number;
    required_fields: number;
    optional_fields: number;
  };
}

export interface APBEExportFile {
  _meta: APBEExportMeta;
  A: APBEConfig["A"];
  agent: APBEConfig["agent"];
  C: APBEConfig["C"];
  L: APBEConfig["L"];
  O: APBEConfig["O"];
  B: APBEConfig["B"];
  V: APBEConfig["V"];
  timezone: APBEConfig["timezone"];
}

// ========================
// VALIDATION RESULT INTERFACE
// ========================
export interface ImportValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  config: APBEConfig | null;
  meta: APBEExportMeta | null;
}

// Required blocks for valid import
const REQUIRED_BLOCKS = ["A", "agent", "C", "L", "O", "B", "V"] as const;

// ========================
// FIELD METADATA CONSTANTS
// ========================
const REQUIRED_FIELD_COUNT = 45;  // Based on APBE v1.0 spec
const OPTIONAL_FIELD_COUNT = 32;  // Based on APBE v1.0 spec

// ========================
// EXPORT FUNCTION (V1.1)
// ========================
export function exportAPBEConfig(
  config: APBEConfig,
  personaName: string,
  version: number = 1,
  exportedBy: string = "Admin"
): void {
  // Generate integrity data
  const integrityData = generateIntegrityData(config);
  
  const exportData: APBEExportFile = {
    _meta: {
      export_date: new Date().toISOString(),
      exported_by: exportedBy,
      schema_version: CURRENT_SCHEMA_VERSION,
      config_version: "1.2.0",
      persona_name: personaName,
      persona_version: version,
      source: "lovable-voc",
      brand_identity: {
        website_name: config.A?.website_name || "",
        group_name: config.A?.group_name || "",
      },
      integrity: integrityData,
      field_metadata: {
        total_fields: REQUIRED_FIELD_COUNT + OPTIONAL_FIELD_COUNT,
        required_fields: REQUIRED_FIELD_COUNT,
        optional_fields: OPTIONAL_FIELD_COUNT,
      },
    },
    A: config.A,
    agent: config.agent,
    C: config.C,
    L: config.L,
    O: config.O,
    B: config.B,
    V: config.V,
    timezone: config.timezone,
  };

  // Generate filename
  const dateStr = new Date().toISOString().split("T")[0];
  const safeName = personaName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  const filename = `${safeName}_v${version}_${dateStr}.json`;

  // Create blob and trigger download
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ========================
// BRAND MISMATCH VALIDATION
// ========================
export interface BrandMismatchResult {
  hasMismatch: boolean;
  currentBrand: { website_name: string; group_name: string };
  importBrand: { website_name: string; group_name: string };
  message: string;
}

export function checkBrandMismatch(
  currentConfig: APBEConfig,
  importedMeta: APBEExportMeta | null
): BrandMismatchResult {
  const currentBrand = {
    website_name: currentConfig.A?.website_name || "",
    group_name: currentConfig.A?.group_name || "",
  };
  
  const importBrand = importedMeta?.brand_identity || {
    website_name: "",
    group_name: "",
  };
  
  // Check for mismatch (only if both have values)
  const hasMismatch = 
    (currentBrand.website_name && importBrand.website_name && 
     currentBrand.website_name !== importBrand.website_name) ||
    (currentBrand.group_name && importBrand.group_name && 
     currentBrand.group_name !== importBrand.group_name);
  
  let message = "";
  if (hasMismatch) {
    message = `Brand mismatch: Importing config from "${importBrand.website_name || importBrand.group_name}" into current brand "${currentBrand.website_name || currentBrand.group_name}"`;
  }
  
  return {
    hasMismatch,
    currentBrand,
    importBrand,
    message,
  };
}

// ========================
// IMPORT VALIDATION FUNCTION (V1.1)
// ========================
export function validateImportedConfig(
  json: unknown,
  currentConfig?: APBEConfig
): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if json is an object
  if (!json || typeof json !== "object") {
    return {
      isValid: false,
      errors: ["File bukan JSON yang valid"],
      warnings: [],
      config: null,
      meta: null,
    };
  }

  const data = json as Record<string, unknown>;

  // Extract meta if exists (V1.1 compatible)
  let meta: APBEExportMeta | null = null;
  if (data._meta && typeof data._meta === "object") {
    const metaData = data._meta as Record<string, unknown>;
    const brandIdentity = (metaData.brand_identity as { website_name?: string; group_name?: string }) || {};
    const integrity = (metaData.integrity as IntegrityData) || {
      checksum: "",
      generated_at: "",
      config_hash_length: 0,
      version: "1.0.0",
    };
    const fieldMeta = (metaData.field_metadata as { total_fields?: number; required_fields?: number; optional_fields?: number }) || {};
    
    meta = {
      export_date: String(metaData.export_date || ""),
      exported_by: String(metaData.exported_by || "Unknown"),
      schema_version: String(metaData.schema_version || "1.0.0"),
      config_version: String(metaData.config_version || "1.0.0"),
      persona_name: String(metaData.persona_name || "Imported Persona"),
      persona_version: Number(metaData.persona_version) || 1,
      source: String(metaData.source || "unknown"),
      brand_identity: {
        website_name: String(brandIdentity.website_name || ""),
        group_name: String(brandIdentity.group_name || ""),
      },
      integrity,
      field_metadata: {
        total_fields: fieldMeta.total_fields || 0,
        required_fields: fieldMeta.required_fields || 0,
        optional_fields: fieldMeta.optional_fields || 0,
      },
    };

    // Check schema version compatibility
    if (meta.schema_version && !meta.schema_version.startsWith("1.")) {
      warnings.push(`Schema version ${meta.schema_version} mungkin tidak kompatibel`);
    }
    
    // Brand mismatch check
    if (currentConfig) {
      const brandCheck = checkBrandMismatch(currentConfig, meta);
      if (brandCheck.hasMismatch) {
        warnings.push(`⚠️ ${brandCheck.message}`);
      }
    }
  } else {
    warnings.push("Metadata tidak ditemukan, menggunakan nilai default");
  }

  // Check required blocks
  for (const block of REQUIRED_BLOCKS) {
    if (!data[block]) {
      errors.push(`Block "${block}" tidak ditemukan`);
    } else if (typeof data[block] !== "object") {
      errors.push(`Block "${block}" bukan object yang valid`);
    }
  }

  // If critical errors, return early
  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      warnings,
      config: null,
      meta,
    };
  }

  // Validate Brand Identity (A)
  const A = data.A as Record<string, unknown>;
  if (!A.website_name) {
    warnings.push("A.website_name kosong");
  }

  // Validate Agent Persona
  const agent = data.agent as Record<string, unknown>;
  if (!agent.name) {
    warnings.push("agent.name kosong");
  }

  // Validate Communication Engine (C)
  const C = data.C as Record<string, unknown>;
  if (typeof C.empathy !== "number" || C.empathy < 1 || C.empathy > 10) {
    warnings.push("C.empathy harus angka 1-10");
  }

  // Validate Interaction Library (L)
  const L = data.L as Record<string, unknown>;
  if (!L.greetings || typeof L.greetings !== "object") {
    warnings.push("L.greetings tidak valid");
  }
  if (!L.closings || typeof L.closings !== "object") {
    warnings.push("L.closings tidak valid");
  }

  // Check for unknown fields
  const knownFields = ["_meta", "A", "agent", "C", "L", "O", "B", "V", "timezone"];
  for (const key of Object.keys(data)) {
    if (!knownFields.includes(key)) {
      warnings.push(`Field "${key}" tidak dikenali dan akan diabaikan`);
    }
  }

  // Sanitize and build config
  const config = sanitizeImportedConfig(data);
  
  // Validate checksum if integrity data exists
  if (meta?.integrity?.checksum) {
    const integrityResult = validateIntegrity(config, meta.integrity);
    if (!integrityResult.isValid) {
      warnings.push(`⚠️ Checksum mismatch - file mungkin telah dimodifikasi`);
    }
  }

  return {
    isValid: true,
    errors,
    warnings,
    config,
    meta,
  };
}

// ========================
// SANITIZE IMPORTED CONFIG
// ========================
export function sanitizeImportedConfig(data: Record<string, unknown>): APBEConfig {
  const defaults = initialAPBEConfig;

  // Helper to merge with defaults
  const mergeWithDefaults = <T>(source: unknown, defaultValue: T): T => {
    if (!source || typeof source !== "object") return defaultValue;
    return { ...defaultValue, ...(source as T) };
  };

  // Build sanitized config
  const config: APBEConfig = {
    A: mergeWithDefaults(data.A, defaults.A),
    agent: {
      ...defaults.agent,
      ...(data.agent as object),
      // Ensure arrays are arrays
      emoji_allowed: Array.isArray((data.agent as Record<string, unknown>)?.emoji_allowed) 
        ? (data.agent as Record<string, string[]>).emoji_allowed 
        : defaults.agent.emoji_allowed,
      emoji_forbidden: Array.isArray((data.agent as Record<string, unknown>)?.emoji_forbidden)
        ? (data.agent as Record<string, string[]>).emoji_forbidden
        : defaults.agent.emoji_forbidden,
    },
    C: {
      ...defaults.C,
      ...(data.C as object),
      language_ratio: mergeWithDefaults(
        (data.C as Record<string, unknown>)?.language_ratio,
        defaults.C.language_ratio
      ),
    },
    L: {
      ...defaults.L,
      greetings: mergeWithDefaults(
        (data.L as Record<string, unknown>)?.greetings,
        defaults.L.greetings
      ),
      closings: mergeWithDefaults(
        (data.L as Record<string, unknown>)?.closings,
        defaults.L.closings
      ),
      apologies: mergeWithDefaults(
        (data.L as Record<string, unknown>)?.apologies,
        defaults.L.apologies
      ),
      empathy_phrases: Array.isArray((data.L as Record<string, unknown>)?.empathy_phrases)
        ? (data.L as Record<string, string[]>).empathy_phrases
        : defaults.L.empathy_phrases,
    },
    O: mergeWithDefaults(data.O, defaults.O),
    B: mergeWithDefaults(data.B, defaults.B),
    V: mergeWithDefaults(data.V, defaults.V),
    timezone: mergeWithDefaults(data.timezone, defaults.timezone),
  };

  return config;
}

// ========================
// READ FILE AS JSON
// ========================
export function readFileAsJSON(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const json = JSON.parse(content);
        resolve(json);
      } catch (error) {
        reject(new Error("File bukan JSON yang valid"));
      }
    };
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsText(file);
  });
}
