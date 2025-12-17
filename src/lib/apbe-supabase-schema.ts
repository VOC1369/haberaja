/**
 * APBE v1.3 Supabase Schema Reference (Provider-Class)
 * 
 * Dokumentasi struktur tabel untuk migrasi Supabase.
 * TIDAK CONNECT ke Supabase - ini hanya referensi arsitektur.
 * 
 * Table Structure:
 * 1. voc_clients → Multi-tenant client registry
 * 2. voc_client_members → User-client membership (RLS source of truth)
 * 3. voc_agent_persona → Core identity (A, agent, C, timezone) + multi-shift fields
 * 4. voc_agent_library → Templates (L)
 * 5. voc_agent_rules → Business logic (O, B_legacy, V)
 * 
 * v1.3 CRITICAL CHANGES:
 * - RLS uses membership-based auth (is_client_member), NOT auth.uid() = client_id
 * - get_user_client_id() is HELPER ONLY, NEVER use in RLS policies
 * - config_B renamed to config_B_legacy (read-only, migration only)
 * - Multi-shift persona: active_hours, priority, is_default
 * - Unique constraint: only 1 default persona per client
 * - A.group_name is INTERNAL ONLY - NEVER exposed in runtime/prompt/chat
 * 
 * User-Client Model:
 * - 1 Client = 1 Owner (Super Admin) + multiple Admins
 * - All admins scoped to 1 client
 * - RLS enforced via voc_client_members, not UID directly
 * - Provider uses service_role (bypasses RLS)
 * 
 * Naming Convention: config_* (Provider-Class standard)
 */

// ============================================================
// TABLE DEFINITIONS (Provider-Class v1.2)
// ============================================================

export const SUPABASE_TABLES = {
  /**
   * Tabel 1: Client Registry (Multi-tenant)
   * Provider creates clients manually - no self-signup
   */
  voc_clients: {
    columns: {
      id: "uuid PRIMARY KEY DEFAULT gen_random_uuid()",
      name: "text NOT NULL",
      slug: "text UNIQUE NOT NULL",
      is_active: "boolean DEFAULT true",
      created_at: "timestamptz DEFAULT now()",
      updated_at: "timestamptz DEFAULT now()",
    },
    indexes: [
      { name: "idx_clients_slug", columns: "(slug)", description: "Lookup by slug" },
    ],
    rls_policies: [
      "Members can read their own client record via is_client_member()",
      "Provider uses service_role to manage all",
    ],
  },

  /**
   * Tabel 2: User-Client Membership (RLS Source of Truth)
   * CRITICAL: All RLS policies MUST use is_client_member(client_id)
   * NEVER use auth.uid() = client_id or get_user_client_id() in policies
   */
  voc_client_members: {
    columns: {
      id: "uuid PRIMARY KEY DEFAULT gen_random_uuid()",
      user_id: "uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL",
      client_id: "uuid REFERENCES public.voc_clients(id) ON DELETE CASCADE NOT NULL",
      role: "client_role NOT NULL DEFAULT 'admin'", // owner | admin
      is_active: "boolean DEFAULT true",
      created_at: "timestamptz DEFAULT now()",
      updated_at: "timestamptz DEFAULT now()",
    },
    constraints: [
      "UNIQUE(user_id, client_id)", // One membership per user-client pair
    ],
    indexes: [
      { name: "idx_members_user", columns: "(user_id)", description: "Lookup by user" },
      { name: "idx_members_client", columns: "(client_id)", description: "Lookup by client" },
      { name: "idx_members_role", columns: "(client_id, role)", description: "Role lookup per client" },
    ],
    rls_policies: [
      "Members can read their own membership",
      "Owners can manage members of their client",
      "Provider uses service_role for full access",
    ],
    role_privileges: {
      owner: ["full_access", "create_admin", "remove_admin", "delete_persona", "publish_rules", "lock_rules"],
      admin: ["crud_persona", "crud_library", "crud_rules", "view_members"],
      // Provider bypasses RLS via service_role
    },
  },

  /**
   * Tabel 3: Core Persona (multi-shift enabled)
   * Contains: Brand Identity (A), Agent Persona (agent), Communication Engine (C), Timezone
   * v1.3: Added active_hours, priority, is_default for multi-shift routing
   * 
   * CRITICAL: A.group_name is INTERNAL ONLY - never in runtime prompt
   * active_hours evaluated against config_timezone, NOT server time
   */
  voc_agent_persona: {
    columns: {
      id: "uuid PRIMARY KEY DEFAULT gen_random_uuid()",
      client_id: "uuid REFERENCES voc_clients(id) NOT NULL",
      persona_name: "text NOT NULL",
      config_A: "jsonb NOT NULL",           // Brand Identity - group_name is INTERNAL ONLY
      config_agent: "jsonb NOT NULL",       // Agent Persona block
      config_C: "jsonb NOT NULL",           // Communication Engine block
      config_timezone: "jsonb NOT NULL DEFAULT '{\"source\": \"server\", \"default_zone\": \"Asia/Jakarta\", \"auto_detect\": true}'::jsonb",
      is_active: "boolean DEFAULT false",
      // Multi-shift fields (v1.3)
      active_hours: 'jsonb DEFAULT \'{"start": "00:00", "end": "23:59"}\'::jsonb', // Evaluated against config_timezone
      priority: "integer DEFAULT 1",         // Higher = more priority in overlap
      is_default: "boolean DEFAULT true",    // Fallback persona
      // Versioning
      schema_version: "text NOT NULL DEFAULT '1.3.0'",
      created_at: "timestamptz DEFAULT now()",
      version: "integer NOT NULL DEFAULT 1",
      updated_at: "timestamptz DEFAULT now()",
      created_by: "uuid REFERENCES auth.users(id)",
      updated_by: "uuid REFERENCES auth.users(id)",
    },
    constraints: [
      // CRITICAL: Only 1 default persona per client (prevents routing chaos)
      "UNIQUE(client_id) WHERE is_default = true", // Partial unique index
    ],
    indexes: [
      { name: "idx_persona_client_active", columns: "(client_id, is_active)", description: "Query active persona per client" },
      { name: "idx_persona_client_version", columns: "(client_id, version DESC)", description: "Version history lookup" },
      { name: "idx_persona_client_default", columns: "(client_id, is_default) WHERE is_default = true", description: "Fast default lookup" },
      { name: "idx_persona_priority", columns: "(client_id, priority DESC)", description: "Multi-shift routing order" },
    ],
    rls_policies: [
      "SELECT: public.is_client_member(client_id)",
      "INSERT: public.is_client_member(client_id)",
      "UPDATE: public.is_client_member(client_id)",
      "DELETE: public.is_client_owner(client_id)", // Only owner can delete
    ],
    notes: [
      "active_hours MUST be evaluated against config_timezone.default_zone, NOT server UTC",
      "When multiple personas active, use priority DESC to select",
      "is_default = true is fallback when no time-based match",
    ],
  },

  /**
   * Tabel 2: Interaction Library (8 kolom)
   * Contains: Greetings, Closings, Apologies, Empathy phrases
   * Update frequency: Sering (template wordsmithing)
   */
  voc_agent_library: {
    columns: {
      id: "uuid PRIMARY KEY DEFAULT gen_random_uuid()",
      client_id: "uuid REFERENCES voc_clients(id) NOT NULL", // Direct client_id for RLS
      persona_id: "uuid REFERENCES voc_agent_persona(id) ON DELETE CASCADE NOT NULL",
      greetings: "jsonb NOT NULL",          // L.greetings block
      closings: "jsonb NOT NULL",           // L.closings block
      apologies: "jsonb NOT NULL",          // L.apologies block
      empathy_phrases: "jsonb NOT NULL DEFAULT '[]'::jsonb", // Changed to jsonb for consistency
      updated_at: "timestamptz DEFAULT now()",
    },
    indexes: [
      { name: "idx_library_persona", columns: "(persona_id)", description: "Lookup by persona" },
      { name: "idx_library_client", columns: "(client_id)", description: "RLS fast query" },
    ],
    rls_policies: [
      "Clients can only read their own library (WHERE client_id = ...)",
      "No subquery needed - direct client_id check",
    ],
  },

  /**
   * Tabel 5: Agent Rules
   * Contains: SOP + Crisis unified (O), Behaviour Engine Legacy (B), VIP Logic (V)
   * 
   * CRITICAL: config_B_legacy is READ-ONLY (migration/backward compat only)
   * UI/API MUST reject writes to config_B_legacy
   */
  voc_agent_rules: {
    columns: {
      id: "uuid PRIMARY KEY DEFAULT gen_random_uuid()",
      client_id: "uuid REFERENCES voc_clients(id) NOT NULL",
      persona_id: "uuid REFERENCES voc_agent_persona(id) ON DELETE CASCADE NOT NULL",
      config_O: "jsonb NOT NULL",           // Full O block (admin_contact, escalation, crisis, risk, anti_hunter)
      config_B_legacy: "jsonb DEFAULT NULL", // DEPRECATED: Read-only, migration only. Use C.personalization + O.anti_hunter
      config_V: "jsonb NOT NULL",           // VIP Logic block
      archetype_ruleset_version: "text NOT NULL DEFAULT '1.3.0'",
      region: "text NOT NULL DEFAULT 'indonesia'",
      is_locked: "boolean DEFAULT false",
      updated_at: "timestamptz DEFAULT now()",
    },
    constraints: [
      // config_B_legacy write protection enforced at validation layer
    ],
    indexes: [
      { name: "idx_rules_persona", columns: "(persona_id)", description: "Lookup by persona" },
      { name: "idx_rules_client", columns: "(client_id)", description: "RLS fast query" },
      { name: "idx_rules_region", columns: "(region)", description: "Region-based filtering" },
    ],
    rls_policies: [
      "SELECT: public.is_client_member(client_id)",
      "INSERT: public.is_client_member(client_id)",
      "UPDATE: public.is_client_member(client_id) AND is_locked = false",
      "DELETE: public.is_client_owner(client_id)",
    ],
    deprecated_columns: {
      config_B_legacy: "Use C.personalization and O.anti_hunter instead. Read-only for migration.",
    },
  },
} as const;

// ============================================================
// MIGRATION SCRIPTS (Provider-Class v1.2)
// ============================================================

export const MIGRATION_SCRIPTS = {
  create_tables: `
-- VOC APBE v1.3 Schema Migration (Provider-Class)
-- WARNING: This is a reference script. Do not run directly.
-- 
-- CRITICAL v1.3 CHANGES:
-- 1. RLS uses membership-based auth via is_client_member()
-- 2. NEVER use auth.uid() = client_id in policies
-- 3. config_B renamed to config_B_legacy (read-only)
-- 4. Multi-shift persona support (active_hours, priority, is_default)
-- 5. Only 1 default persona per client (partial unique index)

-- 1. Create client_role enum
CREATE TYPE public.client_role AS ENUM ('owner', 'admin');

-- 2. Create clients table (parent)
CREATE TABLE IF NOT EXISTS public.voc_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Create client members table (RLS source of truth)
CREATE TABLE IF NOT EXISTS public.voc_client_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.voc_clients(id) ON DELETE CASCADE NOT NULL,
  role client_role NOT NULL DEFAULT 'admin',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, client_id)
);

-- 4. Create persona table with multi-shift support
CREATE TABLE IF NOT EXISTS public.voc_agent_persona (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.voc_clients(id) NOT NULL,
  persona_name text NOT NULL,
  config_A jsonb NOT NULL,
  config_agent jsonb NOT NULL,
  config_C jsonb NOT NULL,
  config_timezone jsonb NOT NULL DEFAULT '{"source": "server", "default_zone": "Asia/Jakarta", "auto_detect": true}'::jsonb,
  is_active boolean DEFAULT false,
  -- Multi-shift fields (v1.3)
  active_hours jsonb DEFAULT '{"start": "00:00", "end": "23:59"}'::jsonb,
  priority integer DEFAULT 1,
  is_default boolean DEFAULT true,
  -- Versioning
  schema_version text NOT NULL DEFAULT '1.3.0',
  created_at timestamptz DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

-- 5. Create library table
CREATE TABLE IF NOT EXISTS public.voc_agent_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.voc_clients(id) NOT NULL,
  persona_id uuid REFERENCES public.voc_agent_persona(id) ON DELETE CASCADE NOT NULL,
  greetings jsonb NOT NULL,
  closings jsonb NOT NULL,
  apologies jsonb NOT NULL,
  empathy_phrases jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- 6. Create rules table with config_B_legacy
CREATE TABLE IF NOT EXISTS public.voc_agent_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.voc_clients(id) NOT NULL,
  persona_id uuid REFERENCES public.voc_agent_persona(id) ON DELETE CASCADE NOT NULL,
  config_O jsonb NOT NULL,
  config_B_legacy jsonb DEFAULT NULL, -- DEPRECATED: Read-only, migration only
  config_V jsonb NOT NULL,
  archetype_ruleset_version text NOT NULL DEFAULT '1.3.0',
  region text NOT NULL DEFAULT 'indonesia',
  is_locked boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

-- 7. Create indexes
CREATE INDEX IF NOT EXISTS idx_clients_slug ON public.voc_clients(slug);
CREATE INDEX IF NOT EXISTS idx_members_user ON public.voc_client_members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_client ON public.voc_client_members(client_id);
CREATE INDEX IF NOT EXISTS idx_members_role ON public.voc_client_members(client_id, role);
CREATE INDEX IF NOT EXISTS idx_persona_client_active ON public.voc_agent_persona(client_id, is_active);
CREATE INDEX IF NOT EXISTS idx_persona_client_version ON public.voc_agent_persona(client_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_persona_priority ON public.voc_agent_persona(client_id, priority DESC);
CREATE INDEX IF NOT EXISTS idx_library_persona ON public.voc_agent_library(persona_id);
CREATE INDEX IF NOT EXISTS idx_library_client ON public.voc_agent_library(client_id);
CREATE INDEX IF NOT EXISTS idx_rules_persona ON public.voc_agent_rules(persona_id);
CREATE INDEX IF NOT EXISTS idx_rules_client ON public.voc_agent_rules(client_id);
CREATE INDEX IF NOT EXISTS idx_rules_region ON public.voc_agent_rules(region);

-- 8. Partial unique index: only 1 default persona per client
CREATE UNIQUE INDEX IF NOT EXISTS idx_persona_client_default 
  ON public.voc_agent_persona(client_id) 
  WHERE is_default = true;

-- 9. Enable RLS
ALTER TABLE public.voc_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voc_client_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voc_agent_persona ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voc_agent_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voc_agent_rules ENABLE ROW LEVEL SECURITY;
  `,

  security_functions: `
-- ============================================================
-- SECURITY DEFINER FUNCTIONS (v1.3)
-- ============================================================
-- CRITICAL: Use is_client_member() in RLS policies
-- NEVER use get_user_client_id() in RLS - helper only for runtime/n8n

-- Check if user is member of a client (USE THIS IN RLS)
CREATE OR REPLACE FUNCTION public.is_client_member(_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.voc_client_members
    WHERE user_id = auth.uid() 
      AND client_id = _client_id 
      AND is_active = true
  )
$$;

-- Check if user is owner of a client
CREATE OR REPLACE FUNCTION public.is_client_owner(_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.voc_client_members
    WHERE user_id = auth.uid() 
      AND client_id = _client_id 
      AND role = 'owner'
      AND is_active = true
  )
$$;

-- HELPER ONLY: Get client_id for current user (DO NOT use in RLS policies)
-- Use for: runtime logic, n8n workflows, API helpers
-- NEVER use in: RLS USING/WITH CHECK clauses
CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_id FROM public.voc_client_members 
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1
$$;
-- WARNING: This function assumes 1 user = 1 client (Phase-1 simplification)
-- For multi-client users (future), this logic must be revised
  `,

  rls_policies: `
-- ============================================================
-- RLS Policies for VOC APBE v1.3 (Membership-Based)
-- ============================================================
-- CRITICAL: All policies use is_client_member(client_id)
-- NEVER use auth.uid() = client_id directly

-- Client members table policies
CREATE POLICY "Members can read own membership"
  ON public.voc_client_members
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Owners can manage client members"
  ON public.voc_client_members
  FOR ALL
  USING (public.is_client_owner(client_id));

-- Clients table policies
CREATE POLICY "Members can read own client"
  ON public.voc_clients
  FOR SELECT
  USING (public.is_client_member(id));

-- Persona table policies
CREATE POLICY "Members can read client personas"
  ON public.voc_agent_persona
  FOR SELECT
  USING (public.is_client_member(client_id));

CREATE POLICY "Members can insert client personas"
  ON public.voc_agent_persona
  FOR INSERT
  WITH CHECK (public.is_client_member(client_id));

CREATE POLICY "Members can update client personas"
  ON public.voc_agent_persona
  FOR UPDATE
  USING (public.is_client_member(client_id));

CREATE POLICY "Owners can delete client personas"
  ON public.voc_agent_persona
  FOR DELETE
  USING (public.is_client_owner(client_id));

-- Library table policies
CREATE POLICY "Members can read client library"
  ON public.voc_agent_library
  FOR SELECT
  USING (public.is_client_member(client_id));

CREATE POLICY "Members can insert client library"
  ON public.voc_agent_library
  FOR INSERT
  WITH CHECK (public.is_client_member(client_id));

CREATE POLICY "Members can update client library"
  ON public.voc_agent_library
  FOR UPDATE
  USING (public.is_client_member(client_id));

-- Rules table policies
CREATE POLICY "Members can read client rules"
  ON public.voc_agent_rules
  FOR SELECT
  USING (public.is_client_member(client_id));

CREATE POLICY "Members can insert client rules"
  ON public.voc_agent_rules
  FOR INSERT
  WITH CHECK (public.is_client_member(client_id));

CREATE POLICY "Members can update client rules (if not locked)"
  ON public.voc_agent_rules
  FOR UPDATE
  USING (public.is_client_member(client_id) AND is_locked = false);

CREATE POLICY "Owners can delete client rules"
  ON public.voc_agent_rules
  FOR DELETE
  USING (public.is_client_owner(client_id));
  `,
} as const;

// ============================================================
// VERSION MANIFEST (v1.3.0)
// ============================================================

export const VERSION_MANIFEST = {
  schema_version: "1.3.0",
  locked_enums: true,
  locked_field_names: true,
  locked_json_shape: true,
  backward_compatible_from: "1.2.0",
  breaking_changes: [
    // v1.3 breaking changes
    "RLS now uses membership-based auth (is_client_member), NOT auth.uid() = client_id",
    "Added voc_client_members table for user-client relationship",
    "Removed global user_roles table - roles are client-scoped",
    "config_B renamed to config_B_legacy (read-only, migration only)",
    "Added multi-shift persona fields: active_hours, priority, is_default",
    "Partial unique index: only 1 default persona per client",
    // v1.2 changes retained
    "Renamed *_json columns to config_* (identity_json → config_A, etc.)",
    "Merged sop_json + crisis_json into single config_O",
  ],
  migration_notes: [
    "Provider-Class v1.3 architecture upgrade",
    "User-Client model: 1 Client = 1 Owner + multiple Admins",
    "All admins scoped to 1 client only (Phase-1)",
    "Provider uses service_role to bypass RLS",
    "First user created by Provider = Owner automatically",
    "RLS policies MUST use is_client_member(client_id), NEVER auth.uid() = client_id",
    "get_user_client_id() is HELPER ONLY - never use in RLS",
    "active_hours evaluated against config_timezone.default_zone, NOT server UTC",
    "config_B_legacy is READ-ONLY - UI/API must reject writes",
    "A.group_name is INTERNAL ONLY - never in runtime prompt/chat",
  ],
  user_client_model: {
    owner_privileges: ["full_access", "create_admin", "remove_admin", "delete_persona", "publish_rules", "lock_rules"],
    admin_privileges: ["crud_persona", "crud_library", "crud_rules", "view_members"],
    provider_access: "service_role (bypass RLS)",
    first_user_flow: "Provider creates user manually → first user = Owner",
  },
  deprecated_fields: [
    "config_B (use config_B_legacy for read-only migration, use C.personalization + O.anti_hunter for active)",
    "identity_json (use config_A)",
    "agent_json (use config_agent)",
    "communication_json (use config_C)",
    "timezone_json (use config_timezone)",
    "sop_json (merged into config_O)",
    "crisis_json (merged into config_O)",
    "behaviour_json (use config_B_legacy)",
    "vip_json (use config_V)",
    "greetings_json (use greetings)",
    "closings_json (use closings)",
    "apologies_json (use apologies)",
  ],
  new_fields: [
    // v1.3
    "voc_client_members table (user_id, client_id, role, is_active)",
    "active_hours (persona table - multi-shift routing)",
    "priority (persona table - multi-shift ordering)",
    "is_default (persona table - fallback persona)",
    "config_B_legacy (rules table - replaces config_B, read-only)",
    // v1.2
    "config_A, config_agent, config_C, config_timezone (persona table)",
    "client_id (library & rules tables)",
    "greetings, closings, apologies (library table - short names)",
    "config_O, config_V (rules table)",
    "archetype_ruleset_version (rules table)",
    "region (rules table)",
    "is_locked (rules table)",
  ],
  runtime_blacklist: [
    "A.group_name - NEVER inject to runtime prompt, chat, or player-facing content",
  ],
} as const;

// ============================================================
// JSON SHAPE REFERENCE (Provider-Class v1.3)
// ============================================================

/**
 * Expected shape of each JSONB column
 * Use this for validation before inserting to Supabase
 * 
 * CRITICAL: A.group_name is INTERNAL ONLY - never in runtime/prompt/chat
 */
export const JSON_SHAPES = {
  // ===== PERSONA TABLE =====
  config_A: {
    group_name: "string (REQUIRED - INTERNAL METADATA ONLY, never in runtime/prompt/chat)",
    website_name: "string (required - public brand name for player-facing content)",
    slogan: "string",
    archetype: "enum: jester|caregiver|hero|ruler|sage|explorer|innocent|magician|outlaw|lover|everyman|creator",
    lokasi: "enum: indonesia|malaysia|singapore|thailand|vietnam|philippines|cambodia|myanmar|laos|brunei",
    call_to_player: "string (required - e.g., 'Kak', 'Bos')",
  },
  
  config_agent: {
    name: "string (required - AI persona name)",
    gender: "enum: female|male|neutral",
    backstory: "string",
    tone: "enum: soft_warm|neutral|strict_efficient|cheerful_playful|gentle_supportive|elite_formal",
    style: "enum: friendly|professional|playful|formal|casual",
    speed: "enum: instant|fast|normal|relaxed",
    emoji_allowed: "string[]",
    emoji_forbidden: "string[]",
  },
  
  config_C: {
    empathy: "number 1-10",
    persuasion: "number 1-10",
    humor_usage: "enum: none|subtle|moderate|frequent",
    language_ratio: "{ indonesian: number, english: number }",
    dialect_allowed: "boolean",
    auto_switch: "boolean",
    boundary_rules: "{ default: BoundaryRule, custom: BoundaryRule[] }",
  },

  config_timezone: {
    source: "enum: server|client|auto",
    default_zone: "string (e.g., 'Asia/Jakarta')",
    auto_detect: "boolean",
  },
  
  // ===== LIBRARY TABLE =====
  greetings: {
    default: "string (required)",
    morning: "string",
    afternoon: "string",
    evening: "string",
    night: "string",
    vip: "string",
  },
  
  closings: {
    normal: "string (required)",
    vip: "string",
    soft_push: "string",
    neutral: "string",
    angry: "string",
  },
  
  apologies: {
    mild: "string",
    medium: "string",
    severe: "string",
  },

  empathy_phrases: "string[] (jsonb array)",
  
  // ===== RULES TABLE =====
  config_O: {
    admin_contact: "{ method: enum, value: string, active_hours: string }",
    escalation: "{ sop_style: enum, threshold_triggers: string[], ... }",
    crisis: "{ tone: enum, dictionary_red: string[], dictionary_yellow: string[], severity_weights: {...}, templates: {...}, toxic_severity: {...} }",
    risk: "{ appetite: number, preventive_bonus_allowed: boolean, ... }",
  },
  
  config_B: {
    personalization: "{ level: number, memory_enabled: boolean }",
    anti_hunter: "{ enabled: boolean, rules: AntiHunterRule[] }",
    // financial and multichannel removed - features deprecated
  },
  
  config_V: {
    active: "boolean",
    threshold: "{ type: enum, value: number, currency: string }",
    greeting: "string",
    closing: "string",
    tone_modifiers: "{ warmth: number, formality: number, speed: number }",
    priority_response: "boolean",
    svip_rules: "SVIPRule[]",
  },
} as const;

// ============================================================
// HELPER: Split APBEConfig for 3-table insert (Provider-Class)
// ============================================================

import { APBEConfig } from "@/types/apbe-config";

/**
 * Provider-Class data structure for 3-table insert
 * Uses config_* naming convention
 */
export interface SplitAPBEData {
  persona: {
    config_A: APBEConfig["A"];
    config_agent: APBEConfig["agent"];
    config_C: APBEConfig["C"];
    config_timezone: APBEConfig["timezone"];
  };
  library: {
    greetings: APBEConfig["L"]["greetings"];
    closings: APBEConfig["L"]["closings"];
    apologies: APBEConfig["L"]["apologies"];
    empathy_phrases: APBEConfig["L"]["empathy_phrases"];
  };
  rules: {
    config_O: APBEConfig["O"]; // Full O-block (unified SOP + Crisis)
    config_B: APBEConfig["B"];
    config_V: APBEConfig["V"];
  };
}

/**
 * Split single APBEConfig into 3-table structure
 * Use this before inserting to Supabase
 * 
 * Provider-Class: config_O contains full O-block (not split)
 */
export function splitConfigForSupabase(config: APBEConfig): SplitAPBEData {
  return {
    persona: {
      config_A: config.A,
      config_agent: config.agent,
      config_C: config.C,
      config_timezone: config.timezone,
    },
    library: {
      greetings: config.L.greetings,
      closings: config.L.closings,
      apologies: config.L.apologies,
      empathy_phrases: config.L.empathy_phrases,
    },
    rules: {
      config_O: config.O, // Full O-block unified
      config_B: config.B,
      config_V: config.V,
    },
  };
}

/**
 * Merge 3-table data back into single APBEConfig
 * Use this after fetching from Supabase
 * 
 * Provider-Class: config_O is full O-block (not split)
 */
export function mergeConfigFromSupabase(data: SplitAPBEData): APBEConfig {
  return {
    A: data.persona.config_A,
    agent: data.persona.config_agent,
    C: data.persona.config_C,
    L: {
      greetings: data.library.greetings,
      closings: data.library.closings,
      apologies: data.library.apologies,
      empathy_phrases: data.library.empathy_phrases,
    },
    O: data.rules.config_O, // Full O-block
    B: data.rules.config_B,
    V: data.rules.config_V,
    timezone: data.persona.config_timezone || {
      source: "server",
      default_zone: "Asia/Jakarta",
      auto_detect: true,
    },
  };
}

// ============================================================
// COLUMN COUNT VERIFICATION
// ============================================================

export const COLUMN_COUNTS = {
  voc_clients: 6,           // id, name, slug, is_active, created_at, updated_at
  voc_client_members: 7,    // id, user_id, client_id, role, is_active, created_at, updated_at (NEW v1.3)
  voc_agent_persona: 17,    // +3 multi-shift fields: active_hours, priority, is_default (v1.3)
  voc_agent_library: 8,     // id, client_id, persona_id, greetings, closings, apologies, empathy_phrases, updated_at
  voc_agent_rules: 10,      // id, client_id, persona_id, config_O, config_B_legacy, config_V, archetype_ruleset_version, region, is_locked, updated_at
  total: 48,                // 6 + 7 + 17 + 8 + 10 = 48
} as const;

// ============================================================
// VERSION
// ============================================================

export const SCHEMA_VERSION = "1.3.0" as const;
