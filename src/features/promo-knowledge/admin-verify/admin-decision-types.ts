/**
 * Admin Reviewer — Type contract
 *
 * Mirrors the response shape of the `admin-reviewer` edge function (Phase 1).
 * Never embedded into PkV10Record. Cache lives in a separate localStorage namespace.
 */

export type AdminDecisionType = "contradiction" | "ambiguity" | "warning";

export interface AdminDecisionOption {
  label: string;
  value: string;
}

export interface AdminDecisionRelatedSignals {
  warnings: number[];
  ambiguity_flags: number[];
  contradiction_flags: number[];
}

export interface AdminDecision {
  id: string;
  decision_type: AdminDecisionType;
  title: string;
  explanation: string;
  question: string;
  options: AdminDecisionOption[];
  manual_note_enabled: boolean;
  related_signal_indices: AdminDecisionRelatedSignals;
}

export interface AdminReviewerSignals {
  warnings: string[];
  ambiguity_flags: string[];
  contradiction_flags: string[];
}

/**
 * Snapshot of canonical fields the patcher is actually allowed to touch.
 * Sent to the reviewer so it cannot invent options that have nothing to
 * map onto in the stored record (e.g. "renumber poin 7/8" when the
 * canonical array stores items without explicit numbering).
 */
export interface AdminReviewerCanonicalEditable {
  /** Current items of `terms_engine.conditions_block.terms_conditions`. */
  terms_conditions?: string[];
  /** Current value of `trigger_engine.trigger_rule_block.rule_type`. */
  trigger_rule_type?: string | null;
  /** Current value of `reward_engine.currency`. */
  reward_currency?: string | null;
  /** Per-variant turnover_rule_format values. */
  variant_turnover_rule_formats?: Array<string | null>;
  /**
   * Plain-language list of what the patcher can actually do. The reviewer
   * MUST only propose options that map to one of these actions.
   */
  allowed_actions?: string[];
}

export interface AdminReviewerContext {
  promo_name?: string;
  promo_type?: string;
  variants_summary?: string;
  raw_content_excerpt?: string;
  canonical_editable?: AdminReviewerCanonicalEditable;
}

export interface AdminReviewerRequest {
  record_id: string;
  signals: AdminReviewerSignals;
  context?: AdminReviewerContext;
}

export interface AdminReviewerSuccess {
  ok: true;
  decisions: AdminDecision[];
}

export interface AdminReviewerError {
  ok: false;
  error:
    | "UNAUTHORIZED"
    | "RATE_LIMITED"
    | "CREDIT_EXHAUSTED"
    | "INVALID_OUTPUT"
    | "REVIEWER_FAILED"
    | "NETWORK_ERROR"
    | "NO_SESSION"
    | "BAD_REQUEST"
    | string;
  message: string;
  status?: number;
}

export type AdminReviewerResponse = AdminReviewerSuccess | AdminReviewerError;

export function isAdminReviewerError(
  r: AdminReviewerResponse,
): r is AdminReviewerError {
  return r.ok === false;
}

export type AdminDecisionsState =
  | "idle"
  | "empty"
  | "loading"
  | "ready"
  | "error";
