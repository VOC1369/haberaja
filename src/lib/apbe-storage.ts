/**
 * APBE v1.2 LocalStorage Persistence
 * 
 * Supabase-Ready: Includes client_id and schema_version for multi-tenant support.
 * TIDAK CONNECT ke Supabase - menggunakan localStorage untuk testing.
 */

import { APBEConfig, initialAPBEConfig, DEFAULT_VERIFICATION_FIELDS } from "@/types/apbe-config";

// ============================================================
// CONSTANTS - Supabase Ready
// ============================================================

export const CURRENT_SCHEMA_VERSION = "1.2.0";
export const DEFAULT_CLIENT_ID = "local_dev"; // Untuk localStorage testing

// ============================================================
// CLIENT-AWARE STORAGE KEYS (Multi-tenant safe)
// ============================================================

function getDraftKey(clientId: string = DEFAULT_CLIENT_ID): string {
  return `apbe_draft_${clientId}`;
}

function getPublishedKey(clientId: string = DEFAULT_CLIENT_ID): string {
  return `apbe_published_${clientId}`;
}

function getVersionsKey(clientId: string = DEFAULT_CLIENT_ID): string {
  return `apbe_versions_${clientId}`;
}

// Legacy keys for migration
const LEGACY_DRAFT_KEY = "apbe_draft_config";
const LEGACY_VERSIONS_KEY = "apbe_config_versions";

// UUID validation helper
function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

// ============================================================
// INTERFACES
// ============================================================

export interface APBEVersion {
  id: string;
  client_id: string;           // Multi-tenant support
  version: number;
  schema_version: string;      // For migrations
  persona_name: string;
  persona_json: APBEConfig;
  runtime_prompt?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by?: string;
}

// ============================================================
// DRAFT MANAGEMENT
// ============================================================

/**
 * Auto-fix emoji conflicts before saving
 * Removes emojis from allowed list if they exist in forbidden list
 */
function autoFixEmojiConflicts(config: APBEConfig): APBEConfig {
  const allowed = config.agent?.emoji_allowed || [];
  const forbidden = config.agent?.emoji_forbidden || [];
  
  if (allowed.length === 0 || forbidden.length === 0) return config;
  
  // Convert forbidden to lowercase for case-insensitive comparison
  const forbiddenSet = new Set(forbidden.map(e => e.toLowerCase()));
  
  // Filter out any allowed emojis that exist in forbidden
  const cleanedAllowed = allowed.filter(emoji => !forbiddenSet.has(emoji.toLowerCase()));
  
  // Only update if there were conflicts
  if (cleanedAllowed.length !== allowed.length) {
    const conflictCount = allowed.length - cleanedAllowed.length;
    console.log(`[APBE Storage] Auto-fixed ${conflictCount} emoji conflict(s)`);
    
    return {
      ...config,
      agent: {
        ...config.agent,
        emoji_allowed: cleanedAllowed,
      },
    };
  }
  
  return config;
}

export function saveAPBEDraft(config: APBEConfig, clientId: string = DEFAULT_CLIENT_ID): void {
  // Auto-fix emoji conflicts before saving
  const cleanedConfig = autoFixEmojiConflicts(config);
  
  const draft = {
    config: cleanedConfig,
    updated_at: new Date().toISOString(),
  };
  localStorage.setItem(getDraftKey(clientId), JSON.stringify(draft));
}

export function loadAPBEDraft(clientId: string = DEFAULT_CLIENT_ID): APBEConfig | null {
  // Try new key first, then legacy
  let data = localStorage.getItem(getDraftKey(clientId));
  if (!data && clientId === DEFAULT_CLIENT_ID) {
    data = localStorage.getItem(LEGACY_DRAFT_KEY);
  }
  if (!data) return null;
  
  try {
    const parsed = JSON.parse(data);
    return parsed.config || null;
  } catch {
    return null;
  }
}

export function clearAPBEDraft(clientId: string = DEFAULT_CLIENT_ID): void {
  localStorage.removeItem(getDraftKey(clientId));
  // Also clear legacy key if exists
  if (clientId === DEFAULT_CLIENT_ID) {
    localStorage.removeItem(LEGACY_DRAFT_KEY);
  }
}

// ============================================================
// PUBLISHED CONFIG MANAGEMENT
// ============================================================

export function publishAPBEConfig(
  config: APBEConfig, 
  runtimePrompt: string, 
  createdBy: string = "Admin",
  clientId: string = DEFAULT_CLIENT_ID
): APBEVersion {
  // Auto-fix emoji conflicts before publishing
  const cleanedConfig = autoFixEmojiConflicts(config);
  const versions = getConfigVersions(clientId);
  
  // Deactivate all existing versions for this client
  versions.forEach(v => {
    if (v.client_id === clientId) {
      v.is_active = false;
    }
  });
  
  // Create new version with persona_name from agent.name or group_name
  const personaName = config.agent?.name || config.A?.group_name || "Unnamed Persona";
  
  const newVersion: APBEVersion = {
    id: crypto.randomUUID(),
    client_id: clientId,
    version: versions.filter(v => v.client_id === clientId).length + 1,
    schema_version: CURRENT_SCHEMA_VERSION,
    persona_name: personaName,
    persona_json: config,
    runtime_prompt: runtimePrompt,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: createdBy,
  };
  
  versions.push(newVersion);
  
  // Save versions
  localStorage.setItem(getVersionsKey(clientId), JSON.stringify(versions));
  
  // Save active config
  localStorage.setItem(getPublishedKey(clientId), JSON.stringify(newVersion));
  
  // Clear draft after publish
  clearAPBEDraft(clientId);
  
  return newVersion;
}

// Update existing persona (for edit flow - replaces instead of creating new)
export function updateExistingPersona(
  personaId: string, 
  config: APBEConfig, 
  runtimePrompt: string, 
  updatedBy: string = "Admin",
  clientId: string = DEFAULT_CLIENT_ID
): APBEVersion | null {
  const versions = getConfigVersions(clientId);
  const existingIndex = versions.findIndex(v => v.id === personaId);
  
  if (existingIndex === -1) return null;
  
  const existing = versions[existingIndex];
  const personaName = config.agent?.name || config.A?.group_name || existing.persona_name;
  
  // Update the existing version with incremented version number
  const updatedVersion: APBEVersion = {
    ...existing,
    version: existing.version + 1,
    schema_version: CURRENT_SCHEMA_VERSION,
    persona_name: personaName,
    persona_json: config,
    runtime_prompt: runtimePrompt,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  };
  
  // Replace in array
  versions[existingIndex] = updatedVersion;
  
  // If this was active, update the published config too
  if (updatedVersion.is_active) {
    localStorage.setItem(getPublishedKey(clientId), JSON.stringify(updatedVersion));
  }
  
  // Save versions
  localStorage.setItem(getVersionsKey(clientId), JSON.stringify(versions));
  
  // Clear draft after update
  clearAPBEDraft(clientId);
  
  return updatedVersion;
}

export function getActiveConfig(clientId: string = DEFAULT_CLIENT_ID): APBEVersion | null {
  const versions = getConfigVersions(clientId);
  return versions.find(v => v.client_id === clientId && v.is_active) || null;
}

export function getConfigVersions(clientId?: string): APBEVersion[] {
  // Try client-specific key first
  const specificClientId = clientId || DEFAULT_CLIENT_ID;
  let data = localStorage.getItem(getVersionsKey(specificClientId));
  
  // Fall back to legacy key for migration
  if (!data && specificClientId === DEFAULT_CLIENT_ID) {
    data = localStorage.getItem(LEGACY_VERSIONS_KEY);
  }
  
  if (!data) return [];
  
  try {
    const versions: APBEVersion[] = JSON.parse(data);
    
    // Migrate old versions without client_id
    const migratedVersions = versions.map(v => ({
      ...v,
      client_id: v.client_id || DEFAULT_CLIENT_ID,
      schema_version: v.schema_version || "1.0.0",
    }));
    
    // Filter by client if specified
    if (clientId) {
      return migratedVersions.filter(v => v.client_id === clientId);
    }
    
    return migratedVersions;
  } catch {
    return [];
  }
}

export function activateVersion(versionId: string, clientId: string = DEFAULT_CLIENT_ID): boolean {
  const versions = getConfigVersions(clientId);
  const targetVersion = versions.find(v => v.id === versionId);
  
  if (!targetVersion) return false;
  
  // Deactivate all versions for this client, activate target
  versions.forEach(v => {
    if (v.client_id === targetVersion.client_id) {
      v.is_active = v.id === versionId;
    }
  });
  
  localStorage.setItem(getVersionsKey(clientId), JSON.stringify(versions));
  localStorage.setItem(getPublishedKey(clientId), JSON.stringify(targetVersion));
  
  return true;
}

export function deactivateVersion(versionId: string, clientId: string = DEFAULT_CLIENT_ID): boolean {
  const versions = getConfigVersions(clientId);
  const targetVersion = versions.find(v => v.id === versionId);
  
  if (!targetVersion) return false;
  
  // Deactivate target
  targetVersion.is_active = false;
  
  localStorage.setItem(getVersionsKey(clientId), JSON.stringify(versions));
  
  // Clear published if this was the active one
  const published = getActiveConfig(targetVersion.client_id);
  if (!published) {
    localStorage.removeItem(getPublishedKey(clientId));
  }
  
  return true;
}

export function deleteVersion(versionId: string, clientId: string = DEFAULT_CLIENT_ID): boolean {
  let versions = getConfigVersions(clientId);
  const targetVersion = versions.find(v => v.id === versionId);
  
  if (!targetVersion) return false;
  
  // Don't delete if it's the only active version for this client
  const clientVersions = versions.filter(v => v.client_id === targetVersion.client_id);
  if (targetVersion.is_active && clientVersions.length === 1) return false;
  
  versions = versions.filter(v => v.id !== versionId);
  
  // If deleted version was active, activate the latest for this client
  if (targetVersion.is_active) {
    const remainingClientVersions = versions.filter(v => v.client_id === targetVersion.client_id);
    if (remainingClientVersions.length > 0) {
      remainingClientVersions[remainingClientVersions.length - 1].is_active = true;
      localStorage.setItem(getPublishedKey(clientId), JSON.stringify(remainingClientVersions[remainingClientVersions.length - 1]));
    }
  }
  
  localStorage.setItem(getVersionsKey(clientId), JSON.stringify(versions));
  
  return true;
}

// Get version by ID
export function getVersionById(versionId: string, clientId: string = DEFAULT_CLIENT_ID): APBEVersion | null {
  const versions = getConfigVersions(clientId);
  return versions.find(v => v.id === versionId) || null;
}

// ============================================================
// INITIAL CONFIG LOADING
// ============================================================

// Load config on startup - prioritize draft, then published, then default
// WITH MIGRATION: Ensure new fields (like data_verification) are populated
export function loadInitialConfig(clientId: string = DEFAULT_CLIENT_ID): APBEConfig {
  const draft = loadAPBEDraft(clientId);
  const published = getActiveConfig(clientId);
  
  // Priority: draft > published > default
  const loadedConfig = draft || published?.persona_json || null;
  
  // If no saved config, return fresh default
  if (!loadedConfig) return initialAPBEConfig;
  
  // MIGRATION: Deep merge to ensure new fields exist with defaults
  const migratedConfig: APBEConfig = {
    ...initialAPBEConfig,
    ...loadedConfig,
    A: {
      ...initialAPBEConfig.A,
      ...loadedConfig.A,
    },
    agent: {
      ...initialAPBEConfig.agent,
      ...loadedConfig.agent,
    },
    C: {
      ...initialAPBEConfig.C,
      ...loadedConfig.C,
      // Ensure data_verification exists with defaults
      data_verification: {
        enabled: loadedConfig.C?.data_verification?.enabled ?? initialAPBEConfig.C.data_verification.enabled,
        fields: (loadedConfig.C?.data_verification?.fields?.length > 0)
          ? loadedConfig.C.data_verification.fields
          : DEFAULT_VERIFICATION_FIELDS,
        interaction_mode: loadedConfig.C?.data_verification?.interaction_mode ?? initialAPBEConfig.C.data_verification.interaction_mode,
      },
      // Ensure personalization exists
      personalization: {
        ...initialAPBEConfig.C.personalization,
        ...loadedConfig.C?.personalization,
      },
      // Ensure boundary_rules exists  
      boundary_rules: {
        ...initialAPBEConfig.C.boundary_rules,
        ...loadedConfig.C?.boundary_rules,
      },
    },
    O: {
      ...initialAPBEConfig.O,
      ...loadedConfig.O,
    },
    V: {
      ...initialAPBEConfig.V,
      ...loadedConfig.V,
    },
  };
  
  return migratedConfig;
}

// ============================================================
// MIGRATION HELPERS (for future Supabase migration)
// ============================================================

/**
 * Export all local data for migration to Supabase
 */
export function exportForMigration(clientId: string = DEFAULT_CLIENT_ID): {
  versions: APBEVersion[];
  draft: APBEConfig | null;
} {
  return {
    versions: getConfigVersions(clientId),
    draft: loadAPBEDraft(clientId),
  };
}

/**
 * Validate version data structure before save
 */
export function validateVersionData(version: APBEVersion): boolean {
  return !!(
    version.id &&
    version.client_id &&
    version.version >= 1 &&
    version.schema_version &&
    version.persona_name &&
    version.persona_json &&
    version.created_at &&
    version.created_by
  );
}

/**
 * Get statistics about stored data
 */
export function getStorageStats(clientId: string = DEFAULT_CLIENT_ID): {
  totalVersions: number;
  activeVersions: number;
  uniqueClients: number;
  hasDraft: boolean;
} {
  const versions = getConfigVersions(clientId);
  const uniqueClients = new Set(versions.map(v => v.client_id)).size;
  
  return {
    totalVersions: versions.length,
    activeVersions: versions.filter(v => v.is_active).length,
    uniqueClients,
    hasDraft: loadAPBEDraft(clientId) !== null,
  };
}
