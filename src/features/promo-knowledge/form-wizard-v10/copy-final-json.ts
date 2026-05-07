/**
 * PR-7 — Copy Final JSON source helper (read-only).
 *
 * Single source of truth for the Step9 "Copy Final JSON V.10.1" button.
 * Reads the full canonical PkV10Record from pk:rec via loadRecord().
 *
 * NO transformation. NO normalization. NO sanitization. NO fallback to
 * wizard state / projection_engine / mappedPreview / extractedPromo / V.09.
 */

import { loadRecord } from "../storage/local-storage";
import type { PkV10Record } from "../schema/pk-v10";

export function loadFinalPkRecordForCopy(recordId: string | null | undefined): PkV10Record | null {
  if (!recordId) return null;
  return loadRecord(recordId);
}
