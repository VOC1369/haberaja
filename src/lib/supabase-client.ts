/**
 * Supabase Client Configuration
 * 
 * Central client for all Supabase operations.
 * Used by: promo-storage, admin-storage, apbe-storage
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nuumqvmselbuzinajbde.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51dW1xdm1zZWxidXppbmFqYmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1ODYwMDIsImV4cCI6MjA4MDE2MjAwMn0.6qCPdQGXMxgD80AKM1nJp377MthYl5UirwpOOVnqjqQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Default client ID for single-brand mode (1 brand per client)
export const DEFAULT_CLIENT_ID = 'local_dev';

// Schema version for migrations
export const CURRENT_SCHEMA_VERSION = '1.2.0';

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
