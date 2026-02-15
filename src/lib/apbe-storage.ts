/**
 * APBE v1.4 Supabase Storage with localStorage Fallback
 * 
 * Full Supabase integration for 3-table architecture:
 * - voc_agent_persona (core identity)
 * - voc_agent_library (templates)
 * - voc_agent_rules (business logic)
 * 
 * v1.4: Added localStorage fallback when Supabase schema doesn't match.
 * All operations silently fall back to localStorage if Supabase returns
 * schema errors (PGRST204), preventing repeated error toasts.
 */

import { APBEConfig, initialAPBEConfig, DEFAULT_VERIFICATION_FIELDS } from "@/types/apbe-config";
import { supabase, DEFAULT_CLIENT_ID, CURRENT_SCHEMA_VERSION, generateUUID, logSupabaseError } from "./supabase-client";
import { splitConfigForSupabase, mergeConfigFromSupabase, SplitAPBEData } from "./apbe-supabase-schema";

// ============================================================
// LOCAL STORAGE FALLBACK LAYER
// ============================================================

const LS_KEYS = {
  DRAFT: (clientId: string) => `apbe_draft_${clientId}`,
  PUBLISHED: (clientId: string) => `apbe_published_${clientId}`,
  VERSIONS: (clientId: string) => `apbe_versions_${clientId}`,
};

// Track if Supabase schema is compatible (cached per session)
let _supabaseSchemaOk: boolean | null = null;

async function isSupabaseSchemaOk(): Promise<boolean> {
  if (_supabaseSchemaOk !== null) return _supabaseSchemaOk;
  
  try {
    // Test with a lightweight query that touches config_A
    const { error } = await supabase
      .from('voc_agent_persona')
      .select('id, config_A')
      .limit(1);
    
    if (error?.code === 'PGRST204' || error?.message?.includes('column')) {
      console.warn('[APBE Storage] Supabase schema mismatch — using localStorage fallback');
      _supabaseSchemaOk = false;
    } else {
      _supabaseSchemaOk = true;
    }
  } catch {
    _supabaseSchemaOk = false;
  }
  
  return _supabaseSchemaOk;
}

function lsSaveDraft(config: APBEConfig, clientId: string): void {
  try {
    localStorage.setItem(LS_KEYS.DRAFT(clientId), JSON.stringify(config));
  } catch (e) {
    console.warn('[APBE Storage] localStorage save failed', e);
  }
}

function lsLoadDraft(clientId: string): APBEConfig | null {
  try {
    const raw = localStorage.getItem(LS_KEYS.DRAFT(clientId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function lsClearDraft(clientId: string): void {
  localStorage.removeItem(LS_KEYS.DRAFT(clientId));
}

function lsGetVersions(clientId: string): APBEVersion[] {
  try {
    const raw = localStorage.getItem(LS_KEYS.VERSIONS(clientId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function lsSaveVersion(version: APBEVersion, clientId: string): void {
  try {
    const versions = lsGetVersions(clientId);
    // Deactivate all
    versions.forEach(v => v.is_active = false);
    versions.unshift(version);
    localStorage.setItem(LS_KEYS.VERSIONS(clientId), JSON.stringify(versions));
  } catch (e) {
    console.warn('[APBE Storage] localStorage save version failed', e);
  }
}

// ============================================================
// INTERFACES
// ============================================================

export interface APBEVersion {
  id: string;
  client_id: string;
  version: number;
  schema_version: string;
  persona_name: string;
  persona_json: APBEConfig;
  runtime_prompt?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by?: string;
}

// Re-export for backward compatibility
export { DEFAULT_CLIENT_ID, CURRENT_SCHEMA_VERSION };

// Draft identifier pattern
const DRAFT_PERSONA_PREFIX = "[DRAFT]";

function getDraftPersonaName(clientId: string): string {
  return `${DRAFT_PERSONA_PREFIX} ${clientId}`;
}

function isDraftPersona(personaName: string): boolean {
  return personaName.startsWith(DRAFT_PERSONA_PREFIX);
}

// ============================================================
// HELPER: Auto-fix emoji conflicts
// ============================================================

function autoFixEmojiConflicts(config: APBEConfig): APBEConfig {
  const allowed = config.agent?.emoji_allowed || [];
  const forbidden = config.agent?.emoji_forbidden || [];
  
  if (allowed.length === 0 || forbidden.length === 0) return config;
  
  const forbiddenSet = new Set(forbidden.map(e => e.toLowerCase()));
  const cleanedAllowed = allowed.filter(emoji => !forbiddenSet.has(emoji.toLowerCase()));
  
  if (cleanedAllowed.length !== allowed.length) {
    console.log(`[APBE Storage] Auto-fixed ${allowed.length - cleanedAllowed.length} emoji conflict(s)`);
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

// ============================================================
// DRAFT MANAGEMENT (Async)
// ============================================================

export async function saveAPBEDraft(config: APBEConfig, clientId: string = DEFAULT_CLIENT_ID): Promise<void> {
  const cleanedConfig = autoFixEmojiConflicts(config);
  
  // Check if Supabase schema is compatible
  if (!(await isSupabaseSchemaOk())) {
    lsSaveDraft(cleanedConfig, clientId);
    return;
  }
  
  const draftName = getDraftPersonaName(clientId);
  const splitData = splitConfigForSupabase(cleanedConfig);
  
  // Check if draft exists
  const { data: existingDraft } = await supabase
    .from('voc_agent_persona')
    .select('id')
    .eq('client_id', clientId)
    .eq('persona_name', draftName)
    .maybeSingle();
  
  if (existingDraft) {
    // Update existing draft
    const { error } = await supabase
      .from('voc_agent_persona')
      .update({
        config_A: splitData.persona.config_A,
        config_agent: splitData.persona.config_agent,
        config_C: splitData.persona.config_C,
        config_timezone: splitData.persona.config_timezone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingDraft.id);
    
    if (error) logSupabaseError('saveAPBEDraft:update', error);
  } else {
    // Insert new draft
    const { error } = await supabase
      .from('voc_agent_persona')
      .insert({
        id: generateUUID(),
        client_id: clientId,
        persona_name: draftName,
        config_A: splitData.persona.config_A,
        config_agent: splitData.persona.config_agent,
        config_C: splitData.persona.config_C,
        config_timezone: splitData.persona.config_timezone,
        is_active: false,
        version: 0,
        schema_version: CURRENT_SCHEMA_VERSION,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    
    if (error) logSupabaseError('saveAPBEDraft:insert', error);
  }
}

export async function loadAPBEDraft(clientId: string = DEFAULT_CLIENT_ID): Promise<APBEConfig | null> {
  if (!(await isSupabaseSchemaOk())) {
    return lsLoadDraft(clientId);
  }
  
  const draftName = getDraftPersonaName(clientId);
  
  const { data: draft, error } = await supabase
    .from('voc_agent_persona')
    .select('*')
    .eq('client_id', clientId)
    .eq('persona_name', draftName)
    .maybeSingle();
  
  if (error) {
    logSupabaseError('loadAPBEDraft', error);
    return null;
  }
  
  if (!draft) return null;
  
  // Reconstruct APBEConfig from persona data (draft doesn't have library/rules)
  const partialConfig: APBEConfig = {
    A: draft.config_A || initialAPBEConfig.A,
    agent: draft.config_agent || initialAPBEConfig.agent,
    C: draft.config_C || initialAPBEConfig.C,
    L: initialAPBEConfig.L,
    O: initialAPBEConfig.O,
    B: initialAPBEConfig.B,
    V: initialAPBEConfig.V,
    timezone: draft.config_timezone || initialAPBEConfig.timezone,
  };
  
  return partialConfig;
}

export async function clearAPBEDraft(clientId: string = DEFAULT_CLIENT_ID): Promise<void> {
  if (!(await isSupabaseSchemaOk())) {
    lsClearDraft(clientId);
    return;
  }
  
  const draftName = getDraftPersonaName(clientId);
  
  const { error } = await supabase
    .from('voc_agent_persona')
    .delete()
    .eq('client_id', clientId)
    .eq('persona_name', draftName);
  
  if (error) logSupabaseError('clearAPBEDraft', error);
}

// ============================================================
// PUBLISH & UPDATE (Async - 3 Table Insert)
// ============================================================

export async function publishAPBEConfig(
  config: APBEConfig,
  runtimePrompt: string,
  createdBy: string = "Admin",
  clientId: string = DEFAULT_CLIENT_ID
): Promise<APBEVersion | null> {
  const cleanedConfig = autoFixEmojiConflicts(config);
  
  // Fallback to localStorage if Supabase schema doesn't match
  if (!(await isSupabaseSchemaOk())) {
    const versions = lsGetVersions(clientId);
    const nextVersion = versions.length + 1;
    const personaName = config.agent?.name || config.A?.group_name || "Unnamed Persona";
    const now = new Date().toISOString();
    const version: APBEVersion = {
      id: generateUUID(),
      client_id: clientId,
      version: nextVersion,
      schema_version: CURRENT_SCHEMA_VERSION,
      persona_name: personaName,
      persona_json: cleanedConfig,
      runtime_prompt: runtimePrompt,
      is_active: true,
      created_at: now,
      updated_at: now,
      created_by: createdBy,
    };
    lsSaveVersion(version, clientId);
    lsClearDraft(clientId);
    return version;
  }
  
  const splitData = splitConfigForSupabase(cleanedConfig);
  
  // Get current version count for this client
  const { data: existingVersions } = await supabase
    .from('voc_agent_persona')
    .select('version')
    .eq('client_id', clientId)
    .not('persona_name', 'like', `${DRAFT_PERSONA_PREFIX}%`);
  
  const nextVersion = (existingVersions?.length || 0) + 1;
  const personaName = config.agent?.name || config.A?.group_name || "Unnamed Persona";
  const personaId = generateUUID();
  const now = new Date().toISOString();
  
  // 1. Deactivate all existing versions for this client
  await supabase
    .from('voc_agent_persona')
    .update({ is_active: false })
    .eq('client_id', clientId)
    .not('persona_name', 'like', `${DRAFT_PERSONA_PREFIX}%`);
  
  // 2. Insert persona
  const { error: personaError } = await supabase
    .from('voc_agent_persona')
    .insert({
      id: personaId,
      client_id: clientId,
      persona_name: personaName,
      config_A: splitData.persona.config_A,
      config_agent: splitData.persona.config_agent,
      config_C: splitData.persona.config_C,
      config_timezone: splitData.persona.config_timezone,
      is_active: true,
      version: nextVersion,
      schema_version: CURRENT_SCHEMA_VERSION,
      created_at: now,
      updated_at: now,
      created_by: createdBy,
    });
  
  if (personaError) {
    logSupabaseError('publishAPBEConfig:persona', personaError);
    return null;
  }
  
  // 3. Insert library
  const { error: libraryError } = await supabase
    .from('voc_agent_library')
    .insert({
      id: generateUUID(),
      client_id: clientId,
      persona_id: personaId,
      greetings: splitData.library.greetings,
      closings: splitData.library.closings,
      apologies: splitData.library.apologies,
      empathy_phrases: splitData.library.empathy_phrases,
      updated_at: now,
    });
  
  if (libraryError) {
    logSupabaseError('publishAPBEConfig:library', libraryError);
  }
  
  // 4. Insert rules
  const { error: rulesError } = await supabase
    .from('voc_agent_rules')
    .insert({
      id: generateUUID(),
      client_id: clientId,
      persona_id: personaId,
      config_O: splitData.rules.config_O,
      config_B_legacy: splitData.rules.config_B,
      config_V: splitData.rules.config_V,
      archetype_ruleset_version: CURRENT_SCHEMA_VERSION,
      region: 'indonesia',
      updated_at: now,
    });
  
  if (rulesError) {
    logSupabaseError('publishAPBEConfig:rules', rulesError);
  }
  
  // 5. Clear draft
  await clearAPBEDraft(clientId);
  
  // Return APBEVersion
  return {
    id: personaId,
    client_id: clientId,
    version: nextVersion,
    schema_version: CURRENT_SCHEMA_VERSION,
    persona_name: personaName,
    persona_json: cleanedConfig,
    runtime_prompt: runtimePrompt,
    is_active: true,
    created_at: now,
    updated_at: now,
    created_by: createdBy,
  };
}

export async function updateExistingPersona(
  personaId: string,
  config: APBEConfig,
  runtimePrompt: string,
  updatedBy: string = "Admin",
  clientId: string = DEFAULT_CLIENT_ID
): Promise<APBEVersion | null> {
  const cleanedConfig = autoFixEmojiConflicts(config);
  const splitData = splitConfigForSupabase(cleanedConfig);
  const now = new Date().toISOString();
  
  // Get existing version
  const { data: existing, error: fetchError } = await supabase
    .from('voc_agent_persona')
    .select('*')
    .eq('id', personaId)
    .maybeSingle();
  
  if (fetchError || !existing) {
    logSupabaseError('updateExistingPersona:fetch', fetchError);
    return null;
  }
  
  const personaName = config.agent?.name || config.A?.group_name || existing.persona_name;
  const newVersion = (existing.version || 0) + 1;
  
  // 1. Update persona
  const { error: personaError } = await supabase
    .from('voc_agent_persona')
    .update({
      persona_name: personaName,
      config_A: splitData.persona.config_A,
      config_agent: splitData.persona.config_agent,
      config_C: splitData.persona.config_C,
      config_timezone: splitData.persona.config_timezone,
      version: newVersion,
      schema_version: CURRENT_SCHEMA_VERSION,
      updated_at: now,
      updated_by: updatedBy,
    })
    .eq('id', personaId);
  
  if (personaError) {
    logSupabaseError('updateExistingPersona:persona', personaError);
    return null;
  }
  
  // 2. Upsert library
  const { data: existingLibrary } = await supabase
    .from('voc_agent_library')
    .select('id')
    .eq('persona_id', personaId)
    .maybeSingle();
  
  if (existingLibrary) {
    await supabase
      .from('voc_agent_library')
      .update({
        greetings: splitData.library.greetings,
        closings: splitData.library.closings,
        apologies: splitData.library.apologies,
        empathy_phrases: splitData.library.empathy_phrases,
        updated_at: now,
      })
      .eq('id', existingLibrary.id);
  } else {
    await supabase
      .from('voc_agent_library')
      .insert({
        id: generateUUID(),
        client_id: clientId,
        persona_id: personaId,
        greetings: splitData.library.greetings,
        closings: splitData.library.closings,
        apologies: splitData.library.apologies,
        empathy_phrases: splitData.library.empathy_phrases,
        updated_at: now,
      });
  }
  
  // 3. Upsert rules
  const { data: existingRules } = await supabase
    .from('voc_agent_rules')
    .select('id')
    .eq('persona_id', personaId)
    .maybeSingle();
  
  if (existingRules) {
    await supabase
      .from('voc_agent_rules')
      .update({
        config_O: splitData.rules.config_O,
        config_B_legacy: splitData.rules.config_B,
        config_V: splitData.rules.config_V,
        updated_at: now,
      })
      .eq('id', existingRules.id);
  } else {
    await supabase
      .from('voc_agent_rules')
      .insert({
        id: generateUUID(),
        client_id: clientId,
        persona_id: personaId,
        config_O: splitData.rules.config_O,
        config_B_legacy: splitData.rules.config_B,
        config_V: splitData.rules.config_V,
        archetype_ruleset_version: CURRENT_SCHEMA_VERSION,
        region: 'indonesia',
        updated_at: now,
      });
  }
  
  // 4. Clear draft
  await clearAPBEDraft(clientId);
  
  return {
    id: personaId,
    client_id: clientId,
    version: newVersion,
    schema_version: CURRENT_SCHEMA_VERSION,
    persona_name: personaName,
    persona_json: cleanedConfig,
    runtime_prompt: runtimePrompt,
    is_active: existing.is_active,
    created_at: existing.created_at,
    updated_at: now,
    created_by: existing.created_by,
    updated_by: updatedBy,
  };
}

// ============================================================
// QUERY FUNCTIONS (Async)
// ============================================================

export async function getActiveConfig(clientId: string = DEFAULT_CLIENT_ID): Promise<APBEVersion | null> {
  if (!(await isSupabaseSchemaOk())) {
    const versions = lsGetVersions(clientId);
    return versions.find(v => v.is_active) || null;
  }
  
  const { data: persona, error } = await supabase
    .from('voc_agent_persona')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .not('persona_name', 'like', `${DRAFT_PERSONA_PREFIX}%`)
    .maybeSingle();
  
  if (error || !persona) {
    if (error) logSupabaseError('getActiveConfig', error);
    return null;
  }
  
  // Fetch library and rules
  const [libraryResult, rulesResult] = await Promise.all([
    supabase.from('voc_agent_library').select('*').eq('persona_id', persona.id).maybeSingle(),
    supabase.from('voc_agent_rules').select('*').eq('persona_id', persona.id).maybeSingle(),
  ]);
  
  const splitData: SplitAPBEData = {
    persona: {
      config_A: persona.config_A,
      config_agent: persona.config_agent,
      config_C: persona.config_C,
      config_timezone: persona.config_timezone,
    },
    library: libraryResult.data || {
      greetings: initialAPBEConfig.L.greetings,
      closings: initialAPBEConfig.L.closings,
      apologies: initialAPBEConfig.L.apologies,
      empathy_phrases: initialAPBEConfig.L.empathy_phrases,
    },
    rules: {
      config_O: rulesResult.data?.config_O || initialAPBEConfig.O,
      config_B: rulesResult.data?.config_B_legacy || initialAPBEConfig.B,
      config_V: rulesResult.data?.config_V || initialAPBEConfig.V,
    },
  };
  
  return {
    id: persona.id,
    client_id: persona.client_id,
    version: persona.version,
    schema_version: persona.schema_version,
    persona_name: persona.persona_name,
    persona_json: mergeConfigFromSupabase(splitData),
    is_active: persona.is_active,
    created_at: persona.created_at,
    updated_at: persona.updated_at,
    created_by: persona.created_by,
    updated_by: persona.updated_by,
  };
}

export async function getConfigVersions(clientId?: string): Promise<APBEVersion[]> {
  const targetClientId = clientId || DEFAULT_CLIENT_ID;
  
  if (!(await isSupabaseSchemaOk())) {
    return lsGetVersions(targetClientId);
  }
  
  const { data: personas, error } = await supabase
    .from('voc_agent_persona')
    .select('*')
    .eq('client_id', targetClientId)
    .not('persona_name', 'like', `${DRAFT_PERSONA_PREFIX}%`)
    .order('version', { ascending: false });
  
  if (error || !personas) {
    if (error) logSupabaseError('getConfigVersions', error);
    return [];
  }
  
  // Fetch all libraries and rules for these personas
  const personaIds = personas.map(p => p.id);
  
  const [librariesResult, rulesResult] = await Promise.all([
    supabase.from('voc_agent_library').select('*').in('persona_id', personaIds),
    supabase.from('voc_agent_rules').select('*').in('persona_id', personaIds),
  ]);
  
  const librariesMap = new Map(librariesResult.data?.map(l => [l.persona_id, l]) || []);
  const rulesMap = new Map(rulesResult.data?.map(r => [r.persona_id, r]) || []);
  
  return personas.map(persona => {
    const library = librariesMap.get(persona.id);
    const rules = rulesMap.get(persona.id);
    
    const splitData: SplitAPBEData = {
      persona: {
        config_A: persona.config_A,
        config_agent: persona.config_agent,
        config_C: persona.config_C,
        config_timezone: persona.config_timezone,
      },
      library: library || {
        greetings: initialAPBEConfig.L.greetings,
        closings: initialAPBEConfig.L.closings,
        apologies: initialAPBEConfig.L.apologies,
        empathy_phrases: initialAPBEConfig.L.empathy_phrases,
      },
      rules: {
        config_O: rules?.config_O || initialAPBEConfig.O,
        config_B: rules?.config_B_legacy || initialAPBEConfig.B,
        config_V: rules?.config_V || initialAPBEConfig.V,
      },
    };
    
    return {
      id: persona.id,
      client_id: persona.client_id,
      version: persona.version,
      schema_version: persona.schema_version,
      persona_name: persona.persona_name,
      persona_json: mergeConfigFromSupabase(splitData),
      is_active: persona.is_active,
      created_at: persona.created_at,
      updated_at: persona.updated_at,
      created_by: persona.created_by,
      updated_by: persona.updated_by,
    };
  });
}

export async function getVersionById(versionId: string, clientId: string = DEFAULT_CLIENT_ID): Promise<APBEVersion | null> {
  const { data: persona, error } = await supabase
    .from('voc_agent_persona')
    .select('*')
    .eq('id', versionId)
    .maybeSingle();
  
  if (error || !persona) {
    if (error) logSupabaseError('getVersionById', error);
    return null;
  }
  
  // Fetch library and rules
  const [libraryResult, rulesResult] = await Promise.all([
    supabase.from('voc_agent_library').select('*').eq('persona_id', versionId).maybeSingle(),
    supabase.from('voc_agent_rules').select('*').eq('persona_id', versionId).maybeSingle(),
  ]);
  
  const splitData: SplitAPBEData = {
    persona: {
      config_A: persona.config_A,
      config_agent: persona.config_agent,
      config_C: persona.config_C,
      config_timezone: persona.config_timezone,
    },
    library: libraryResult.data || {
      greetings: initialAPBEConfig.L.greetings,
      closings: initialAPBEConfig.L.closings,
      apologies: initialAPBEConfig.L.apologies,
      empathy_phrases: initialAPBEConfig.L.empathy_phrases,
    },
    rules: {
      config_O: rulesResult.data?.config_O || initialAPBEConfig.O,
      config_B: rulesResult.data?.config_B_legacy || initialAPBEConfig.B,
      config_V: rulesResult.data?.config_V || initialAPBEConfig.V,
    },
  };
  
  return {
    id: persona.id,
    client_id: persona.client_id,
    version: persona.version,
    schema_version: persona.schema_version,
    persona_name: persona.persona_name,
    persona_json: mergeConfigFromSupabase(splitData),
    is_active: persona.is_active,
    created_at: persona.created_at,
    updated_at: persona.updated_at,
    created_by: persona.created_by,
    updated_by: persona.updated_by,
  };
}

// ============================================================
// ACTIVATION FUNCTIONS (Async)
// ============================================================

export async function activateVersion(versionId: string, clientId: string = DEFAULT_CLIENT_ID): Promise<boolean> {
  // 1. Deactivate all versions for this client
  await supabase
    .from('voc_agent_persona')
    .update({ is_active: false })
    .eq('client_id', clientId)
    .not('persona_name', 'like', `${DRAFT_PERSONA_PREFIX}%`);
  
  // 2. Activate target version
  const { error } = await supabase
    .from('voc_agent_persona')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', versionId);
  
  if (error) {
    logSupabaseError('activateVersion', error);
    return false;
  }
  
  return true;
}

export async function deactivateVersion(versionId: string, clientId: string = DEFAULT_CLIENT_ID): Promise<boolean> {
  const { error } = await supabase
    .from('voc_agent_persona')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', versionId);
  
  if (error) {
    logSupabaseError('deactivateVersion', error);
    return false;
  }
  
  return true;
}

// ============================================================
// DELETE FUNCTION (Async - CASCADE)
// ============================================================

export async function deleteVersion(versionId: string, clientId: string = DEFAULT_CLIENT_ID): Promise<boolean> {
  // Check if version exists and is not active
  const { data: version, error: fetchError } = await supabase
    .from('voc_agent_persona')
    .select('is_active')
    .eq('id', versionId)
    .maybeSingle();
  
  if (fetchError || !version) {
    logSupabaseError('deleteVersion:fetch', fetchError);
    return false;
  }
  
  if (version.is_active) {
    console.warn('[APBE Storage] Cannot delete active version');
    return false;
  }
  
  // Delete persona (CASCADE will delete library and rules)
  const { error } = await supabase
    .from('voc_agent_persona')
    .delete()
    .eq('id', versionId);
  
  if (error) {
    logSupabaseError('deleteVersion', error);
    return false;
  }
  
  return true;
}

// ============================================================
// INITIAL CONFIG LOADING (Async)
// ============================================================

export async function loadInitialConfig(clientId: string = DEFAULT_CLIENT_ID): Promise<APBEConfig> {
  // Try draft first
  const draft = await loadAPBEDraft(clientId);
  if (draft) return migrateConfig(draft);
  
  // Try active published
  const active = await getActiveConfig(clientId);
  if (active) return migrateConfig(active.persona_json);
  
  // Return default
  return initialAPBEConfig;
}

function migrateConfig(loadedConfig: APBEConfig): APBEConfig {
  return {
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
      data_verification: {
        enabled: loadedConfig.C?.data_verification?.enabled ?? initialAPBEConfig.C.data_verification.enabled,
        fields: (loadedConfig.C?.data_verification?.fields?.length > 0)
          ? loadedConfig.C.data_verification.fields
          : DEFAULT_VERIFICATION_FIELDS,
        interaction_mode: loadedConfig.C?.data_verification?.interaction_mode ?? initialAPBEConfig.C.data_verification.interaction_mode,
      },
      personalization: {
        ...initialAPBEConfig.C.personalization,
        ...loadedConfig.C?.personalization,
      },
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
}

// ============================================================
// MIGRATION & UTILITY FUNCTIONS
// ============================================================

export async function exportForMigration(clientId: string = DEFAULT_CLIENT_ID): Promise<{
  versions: APBEVersion[];
  draft: APBEConfig | null;
}> {
  const versions = await getConfigVersions(clientId);
  const draft = await loadAPBEDraft(clientId);
  return { versions, draft };
}

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

export async function getStorageStats(clientId: string = DEFAULT_CLIENT_ID): Promise<{
  totalVersions: number;
  activeVersions: number;
  uniqueClients: number;
  hasDraft: boolean;
}> {
  const versions = await getConfigVersions(clientId);
  const draft = await loadAPBEDraft(clientId);
  const uniqueClients = new Set(versions.map(v => v.client_id)).size;
  
  return {
    totalVersions: versions.length,
    activeVersions: versions.filter(v => v.is_active).length,
    uniqueClients,
    hasDraft: draft !== null,
  };
}
