/**
 * PKB_WOLFBRAIN V.10 LOCAL STORAGE ADAPTER
 *
 * STEP 2 — V.10 NATIVE.
 *   - Storage now operates on `PkV10Record` directly.
 *   - Dumb upsert: NO D-6 re-injection. V.10 carries its own version stamp
 *     inside `meta_engine.schema_block` (schema_name / schema_version /
 *     locked_at / created_by / status / extractor) — no top-level legacy
 *     governance fields are bolted on at save time.
 *   - 50-record cap, oldest evicted by `updated_at` ASC.
 *   - `updated_at` bumped on every save.
 *   - Index kept under PK_INDEX_KEY for cheap listing.
 *
 * NO Supabase, NO server roundtrip — localStorage-only.
 * NO V.09 conversion. NO silent fallback.
 */

import { createInertPkV10Record } from "../schema/pk-v10";
import type { PkV10Record } from "../schema/pk-v10";

const RECORD_PREFIX = "pk:rec:";
const PK_INDEX_KEY = "pk:index";
const MAX_RECORDS = 50;

export interface PkIndexEntry {
  record_id: string;
  promo_name: string;
  state: string;
  updated_at: string;
}

function readIndex(): PkIndexEntry[] {
  try {
    const raw = localStorage.getItem(PK_INDEX_KEY);
    return raw ? (JSON.parse(raw) as PkIndexEntry[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(entries: PkIndexEntry[]) {
  localStorage.setItem(PK_INDEX_KEY, JSON.stringify(entries));
}

function indexEntryFor(rec: PkV10Record): PkIndexEntry {
  const promo_name = rec.identity_engine?.promo_block?.promo_name ?? "";
  const state = rec.readiness_engine?.state_block?.state ?? "draft";
  return {
    record_id: rec.record_id,
    promo_name,
    state,
    updated_at: rec.updated_at,
  };
}

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Create a fresh inert V.10 record (NOT yet persisted).
 */
export function createDraftRecord(): PkV10Record {
  return createInertPkV10Record(genId());
}

/**
 * Save (upsert) a V.10 record. Bumps `updated_at`. Evicts oldest if cap exceeded.
 *
 * IMPORTANT: This is a dumb upsert. No legacy governance fields are injected.
 * V.10 records carry their schema stamp in `meta_engine.schema_block`.
 */
export function saveRecord(rec: PkV10Record): PkV10Record {
  const stamped: PkV10Record = {
    ...rec,
    updated_at: new Date().toISOString(),
  };

  localStorage.setItem(RECORD_PREFIX + stamped.record_id, JSON.stringify(stamped));

  const idx = readIndex().filter((e) => e.record_id !== stamped.record_id);
  idx.push(indexEntryFor(stamped));

  if (idx.length > MAX_RECORDS) {
    idx.sort((a, b) => a.updated_at.localeCompare(b.updated_at));
    while (idx.length > MAX_RECORDS) {
      const evict = idx.shift();
      if (evict) {
        localStorage.removeItem(RECORD_PREFIX + evict.record_id);
      }
    }
  }

  writeIndex(idx);
  return stamped;
}

export function loadRecord(record_id: string): PkV10Record | null {
  try {
    const raw = localStorage.getItem(RECORD_PREFIX + record_id);
    return raw ? (JSON.parse(raw) as PkV10Record) : null;
  } catch {
    return null;
  }
}

export function listRecords(): PkIndexEntry[] {
  return readIndex().sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function deleteRecord(record_id: string) {
  localStorage.removeItem(RECORD_PREFIX + record_id);
  writeIndex(readIndex().filter((e) => e.record_id !== record_id));
}

export const STORAGE_LIMITS = {
  MAX_RECORDS,
  RECORD_PREFIX,
  PK_INDEX_KEY,
} as const;
