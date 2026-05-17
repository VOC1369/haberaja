/**
 * useAdminDecisions — React hook
 *
 * Drives the LLM Admin Reviewer lifecycle for a given PkV10Record:
 *   idle    → no record
 *   empty   → record present but zero signals (no LLM call)
 *   loading → invoking edge function
 *   ready   → decisions available (from cache or fresh)
 *   error   → reviewer failed; user can retry()
 *
 * Cache key: `admin_decisions:${record_id}:${signature}`.
 * Cache is NEVER stored on PkV10Record.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PkV10Record } from "../schema/pk-v10";
import type {
  AdminDecision,
  AdminDecisionsState,
  AdminReviewerError,
  AdminReviewerResponse,
} from "./admin-decision-types";
import {
  clearCached,
  countSignals,
  extractAdminReviewerContext,
  extractAdminReviewerSignals,
  invokeAdminReviewer,
  loadCached,
  saveCached,
  signalsSignature,
} from "./admin-reviewer-client";

export interface UseAdminDecisionsResult {
  state: AdminDecisionsState;
  decisions: AdminDecision[];
  error: AdminReviewerError | null;
  signature: string | null;
  retry: () => void;
}

export function useAdminDecisions(
  record: PkV10Record | null | undefined,
): UseAdminDecisionsResult {
  const [state, setState] = useState<AdminDecisionsState>("idle");
  const [decisions, setDecisions] = useState<AdminDecision[]>([]);
  const [error, setError] = useState<AdminReviewerError | null>(null);
  const [nonce, setNonce] = useState(0);

  const signals = useMemo(() => extractAdminReviewerSignals(record), [record]);
  const signature = useMemo(
    () => (record ? signalsSignature(signals) : null),
    [record, signals],
  );

  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!record) {
      setState("idle");
      setDecisions([]);
      setError(null);
      return;
    }

    const total = countSignals(signals);
    if (total === 0) {
      setState("empty");
      setDecisions([]);
      setError(null);
      return;
    }

    const recordId = record.record_id;
    const sig = signature!;
    const cached = loadCached(recordId, sig);
    if (cached && cached.ok) {
      setState("ready");
      setDecisions(cached.decisions);
      setError(null);
      return;
    }

    setState("loading");
    setError(null);
    setDecisions([]);

    const ac = new AbortController();
    const context = extractAdminReviewerContext(record);

    invokeAdminReviewer(
      { record_id: recordId, signals, context },
      { signal: ac.signal },
    )
      .then((resp: AdminReviewerResponse) => {
        if (!aliveRef.current) return;
        if (resp.ok) {
          saveCached(recordId, sig, resp);
          setDecisions(resp.decisions);
          setError(null);
          setState("ready");
        } else {
          // Never cache errors — let retry hit the network again.
          setError(resp);
          setDecisions([]);
          setState("error");
        }
      })
      .catch((err: unknown) => {
        if (!aliveRef.current) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError({
          ok: false,
          error: "REVIEWER_FAILED",
          message: "Reviewer gagal membuat pertanyaan. Coba ulang.",
        });
        setDecisions([]);
        setState("error");
      });

    return () => {
      ac.abort();
    };
    // `nonce` forces a re-run on retry().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, signature, nonce]);

  const retry = useCallback(() => {
    if (record && signature) {
      clearCached(record.record_id, signature);
    }
    setNonce((n) => n + 1);
  }, [record, signature]);

  return { state, decisions, error, signature, retry };
}
