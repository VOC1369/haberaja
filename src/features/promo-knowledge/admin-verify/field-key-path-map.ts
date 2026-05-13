/**
 * Field Key → Canonical V.10.1 Path Map
 *
 * STRICT CONTRACT:
 *   - Map identitas field internal (token canonical) → path JSON V.10.1.
 *   - BUKAN regex/keyword matching wording promo.
 *   - BUKAN per-promo logic.
 *   - Hanya substring identity check terhadap canonical field-key token.
 *
 * Identity sources (in priority order):
 *   1. issue.affected_paths[0]              (canonical V.10.1 path — strongest)
 *   2. issue.field_key                      (forward-compat — extractor MAY emit later)
 *   3. canonical field-key token in source_text (boundary-checked, no regex)
 *
 * Cara menambah field baru: tambahkan entry di FIELD_KEY_TO_PATH.
 * Tidak ada side-effect lain.
 */

export const FIELD_KEY_TO_PATH: Record<string, string> = {
  valid_until: "period_engine.validity_block.valid_until",
  valid_from: "period_engine.validity_block.valid_from",
  min_deposit: "reward_engine.requirement_block.min_deposit",
  stacking_policy: "dependency_engine.stacking_block.stacking_policy",
  geo_restriction: "scope_engine.geo_block.geo_restriction",
  claim_method: "claim_engine.method_block.claim_method",
  trigger_event: "trigger_engine.primary_trigger_block.trigger_event",
  rule_type: "trigger_engine.trigger_rule_block.rule_type",
  calculation_period: "period_engine.distribution_block.calculation_period",
  // turnover_rule_format is per-variant — handled separately by F3 adapter.
};

const KNOWN_KEYS = Object.keys(FIELD_KEY_TO_PATH).sort(
  (a, b) => b.length - a.length, // longer first to prevent prefix collision
);

const isWordChar = (c: string): boolean =>
  (c >= "a" && c <= "z") ||
  (c >= "0" && c <= "9") ||
  c === "_";

/**
 * Scan text for a canonical field-key token (boundary-checked, NO RegExp).
 * Returns the first matching canonical key, or null.
 *
 * This is IDENTITY matching against schema field-key vocabulary —
 * NOT wording inference. "tanggal akhir" → null. "valid_until" → match.
 */
export function findFieldKeyToken(text: string | null | undefined): string | null {
  if (!text || typeof text !== "string") return null;
  const lower = text.toLowerCase();
  for (const key of KNOWN_KEYS) {
    let from = 0;
    while (from <= lower.length - key.length) {
      const idx = lower.indexOf(key, from);
      if (idx === -1) break;
      const before = idx === 0 ? "" : lower[idx - 1];
      const after = lower[idx + key.length] ?? "";
      if (!isWordChar(before) && !isWordChar(after)) return key;
      from = idx + 1;
    }
  }
  return null;
}

/**
 * Resolve canonical V.10.1 path from issue identity.
 * Priority: affected_paths[0] → field_key → field-key-token-in-source_text.
 *
 * Returns null when no identity is available (truly unclassified text).
 */
export function resolveCanonicalPath(issue: {
  affected_paths?: string[];
  field_key?: string;
  source_text?: string;
}): string | null {
  const fromPath = issue.affected_paths?.[0];
  if (fromPath && fromPath.trim().length > 0) return fromPath;

  const fk = issue.field_key?.trim();
  if (fk && FIELD_KEY_TO_PATH[fk]) return FIELD_KEY_TO_PATH[fk];

  const token = findFieldKeyToken(issue.source_text);
  if (token) return FIELD_KEY_TO_PATH[token];

  return null;
}
