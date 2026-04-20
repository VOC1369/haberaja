/**
 * Supabase Client Configuration
 * 
 * Central client for all Supabase operations.
 * Used by: promo-storage, admin-storage, apbe-storage
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dgcfnhexutwzplgxebah.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnY2ZuaGV4dXR3enBsZ3hlYmFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyODc5NzQsImV4cCI6MjA4OTg2Mzk3NH0.13mkY4YkQKTGNN5pzAeU7vI8FoZG8b6e7AKHSUDKaqQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Default client ID for single-brand mode (1 brand per client)
export const DEFAULT_CLIENT_ID = 'Liveboard';

// Schema version for migrations
export const CURRENT_SCHEMA_VERSION = 'V.APR.09';

/**
 * Helper: Generate UUID
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Helper: Log Supabase errors consistently
 */
export function logSupabaseError(context: string, error: unknown): void {
  console.error(`[Supabase:${context}]`, error);
}
