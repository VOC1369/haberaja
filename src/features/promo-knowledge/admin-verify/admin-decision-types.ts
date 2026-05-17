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

export interface AdminReviewerContext {
  promo_name?: string;
  promo_type?: string;
  variants_summary?: string;
  raw_content_excerpt?: string;
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

export type AdminDecisionsState =
  | "idle"
  | "empty"
  | "loading"
  | "ready"
  | "error";
