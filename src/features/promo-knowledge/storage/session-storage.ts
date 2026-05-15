/**
 * PKB_WOLFBRAIN V.10.2 — SESSION STORAGE
 *
 * Transient sessionStorage helper for the extractor UI.
 * V.10-only payload: { pkRecord, mode/inputMode, lastInput, imagePreview }.
 *
 * NO V.09 fields. NO ExtractedPromo. NO PromoFormData. NO editHistory.
 * NO import from `@/lib/legacy-promo-v09-storage` or `@/lib/extractors/*`.
 *
 * Session key kept identical to legacy ('pseudo_extractor_session') so that
 * an in-flight V.10 record survives the cut-over without forcing the user to
 * re-extract. Legacy V.09 fields, if present in an old payload, are simply
 * ignored on read.
 */

import type { PkV10Record } from "../schema/pk-v10";

export type InputMode = "url" | "html" | "image" | "text" | "hybrid";

const SESSION_KEY = "pseudo_extractor_session";

/**
 * Bumped whenever the V.10 session shape changes in a way that makes prior
 * payloads unsafe to restore. Mismatched payloads are dropped on load.
 */
const PK_SESSION_VERSION = "v10.2-2026-05-15";

export interface PkSessionData {
  pkRecord: PkV10Record | null;
  inputMode: InputMode;
  lastInput: string;
  imagePreview: string | null;
  timestamp: number;
  _pk_session_version?: string;
}

function defaults(): PkSessionData {
  return {
    pkRecord: null,
    inputMode: "url",
    lastInput: "",
    imagePreview: null,
    timestamp: Date.now(),
    _pk_session_version: PK_SESSION_VERSION,
  };
}

export const pkSession = {
  save(data: Partial<PkSessionData>): void {
    try {
      const current = pkSession.load() ?? defaults();
      const updated: PkSessionData = {
        ...current,
        ...data,
        timestamp: Date.now(),
        _pk_session_version: PK_SESSION_VERSION,
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("[pkSession] Failed to save:", e);
    }
  },

  load(): PkSessionData | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as Partial<PkSessionData> & {
        _pk_session_version?: string;
        _keyword_override_version?: string;
      };

      // Drop payloads written by the legacy V.09 extractorSession (those
      // carry `_keyword_override_version` instead of `_pk_session_version`)
      // or by an older V.10 session shape.
      if (
        parsed._keyword_override_version !== undefined ||
        parsed._pk_session_version !== PK_SESSION_VERSION
      ) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }

      return {
        pkRecord: (parsed.pkRecord as PkV10Record | null) ?? null,
        inputMode: (parsed.inputMode as InputMode) ?? "url",
        lastInput: parsed.lastInput ?? "",
        imagePreview: parsed.imagePreview ?? null,
        timestamp: parsed.timestamp ?? Date.now(),
        _pk_session_version: PK_SESSION_VERSION,
      };
    } catch {
      console.error("[pkSession] Failed to load");
      return null;
    }
  },

  clear(): void {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {
      console.error("[pkSession] Failed to clear:", e);
    }
  },
};
