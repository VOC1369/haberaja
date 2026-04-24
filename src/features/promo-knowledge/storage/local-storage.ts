/**
 * PK-06.0 LOCAL STORAGE ADAPTER
 *
 * Rules:
 *   - 50-record cap, oldest evicted by updated_at ASC (D-3 APPROVED)
 *   - On every save: re-inject governance metadata from Registry (D-6 enforced
 *     even if caller forgot/tampered)
 *   - Bump updated_at automatically
 *   - Index kept under PK_INDEX_KEY for cheap listing without parsing every record
 *
 * NO Supabase, NO server roundtrip — Gate 1 is localStorage-only.
 */

import { buildGovernanceMetadata } from "../registry";
import { createInertPromoKnowledgeRecord } from "../schema/inert";
import type { PromoKnowledgeRecord } from "../schema/pk-06.0";

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

function indexEntryFor(rec: PromoKnowledgeRecord): PkIndexEntry {
  const promo_name =
    (rec.identity_engine as { promo_block?: { promo_name?: string } })?.promo_block?.promo_name ?? "";
  return {
    record_id: rec.record_id,
    promo_name,
    state: rec.readiness_engine.state_block.state,
    updated_at: rec.updated_at,
  };
}

function genId(): string {
  // crypto.randomUUID is widely supported; fall back if not available.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Create a fresh inert record (NOT yet persisted).
 */
export function createDraftRecord(): PromoKnowledgeRecord {
  return createInertPromoKnowledgeRecord(genId());
}

/**
 * Save (upsert) a record. Re-injects governance metadata + bumps updated_at.
 * Evicts oldest if cap exceeded.
 */
export function saveRecord(rec: PromoKnowledgeRecord): PromoKnowledgeRecord {
  const gov = buildGovernanceMetadata();
  const stamped: PromoKnowledgeRecord = {
    ...rec,
    ...gov, // D-6 enforcement: always re-inject from registry
    updated_at: new Date().toISOString(),
  };

  localStorage.setItem(RECORD_PREFIX + stamped.record_id, JSON.stringify(stamped));

  // update index
  const idx = readIndex().filter((e) => e.record_id !== stamped.record_id);
  idx.push(indexEntryFor(stamped));

  // evict oldest if over cap
  if (idx.length > MAX_RECORDS) {
    idx.sort((a, b) => a.updated_at.localeCompare(b.updated_at)); // oldest first
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

export function loadRecord(record_id: string): PromoKnowledgeRecord | null {
  try {
    const raw = localStorage.getItem(RECORD_PREFIX + record_id);
    return raw ? (JSON.parse(raw) as PromoKnowledgeRecord) : null;
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
