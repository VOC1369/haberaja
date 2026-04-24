/**
 * PK-06.0 VALIDATOR — pure function, severity-tiered.
 *
 * Severity:
 *   error   → blocks finalize/publish (form may still allow draft save)
 *   warning → non-blocking, surfaced in debug panel
 *   info    → informational (e.g. spec-historical alias mismatch)
 *
 * Coverage (Gate 1 vertical slice):
 *   1. D-6 governance metadata presence + value match
 *   2. claim_engine — enum check, cross-field rule (proof_required → types non-empty),
 *      url shape check, channel-priority subset check
 *   3. readiness_engine — state enum check
 *   4. _schema.version informational drift
 */

import { PK_REGISTRY } from "../registry";
import {
  CLAIM_METHOD_ENUM,
  CLAIM_CHANNEL_ENUM,
  PROOF_TYPE_ENUM,
  PROOF_DESTINATION_ENUM,
  LIFECYCLE_STATE_ENUM,
  type PromoKnowledgeRecord,
} from "../schema/pk-06.0";

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  severity: ValidationSeverity;
  path: string;
  code: string;
  message: string;
}

export interface ValidationReport {
  ok: boolean; // true when zero errors
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

const issue = (
  severity: ValidationSeverity,
  path: string,
  code: string,
  message: string,
): ValidationIssue => ({ severity, path, code, message });

const isUrlish = (v: string): boolean => {
  if (!v) return true; // empty allowed
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

export function validatePromoKnowledge(rec: PromoKnowledgeRecord): ValidationReport {
  const issues: ValidationIssue[] = [];

  // ---- D-6 governance metadata (MANDATORY, top-level) ----
  if (rec.governance_version !== PK_REGISTRY.governance_version) {
    issues.push(
      issue(
        "error",
        "governance_version",
        "D6_GOV_VERSION_MISMATCH",
        `governance_version must be "${PK_REGISTRY.governance_version}", got "${String(rec.governance_version)}"`,
      ),
    );
  }
  if (rec.domain_version !== PK_REGISTRY.domain_version) {
    issues.push(
      issue(
        "error",
        "domain_version",
        "D6_DOMAIN_VERSION_MISMATCH",
        `domain_version must be "${PK_REGISTRY.domain_version}", got "${String(rec.domain_version)}"`,
      ),
    );
  }
  if (rec.domain !== PK_REGISTRY.domain) {
    issues.push(
      issue(
        "error",
        "domain",
        "D6_DOMAIN_MISMATCH",
        `domain must be "${PK_REGISTRY.domain}", got "${String(rec.domain)}"`,
      ),
    );
  }

  // ---- Spec-historical alias (info-only) ----
  const specVersion = rec._schema?.version;
  if (specVersion && specVersion !== PK_REGISTRY.spec_historical_alias) {
    issues.push(
      issue(
        "info",
        "_schema.version",
        "SPEC_HISTORICAL_DRIFT",
        `_schema.version is "${specVersion}", expected legacy alias "${PK_REGISTRY.spec_historical_alias}". This is informational only; runtime authority is governance_version.`,
      ),
    );
  }

  // ---- claim_engine: method enum ----
  const ce = rec.claim_engine;
  if (ce?.method_block) {
    const m = ce.method_block.claim_method;
    if (m !== "" && !CLAIM_METHOD_ENUM.includes(m as typeof CLAIM_METHOD_ENUM[number])) {
      issues.push(
        issue(
          "error",
          "claim_engine.method_block.claim_method",
          "ENUM_INVALID",
          `claim_method "${m}" is not a valid CLAIM_METHOD enum value.`,
        ),
      );
    }
    if (m === "" ) {
      issues.push(
        issue(
          "warning",
          "claim_engine.method_block.claim_method",
          "REQUIRED_EMPTY",
          "claim_method is empty — required before finalize.",
        ),
      );
    }
  }

  // ---- claim_engine: channels ----
  if (ce?.channels_block) {
    for (const c of ce.channels_block.channels ?? []) {
      if (!CLAIM_CHANNEL_ENUM.includes(c)) {
        issues.push(
          issue(
            "error",
            "claim_engine.channels_block.channels",
            "ENUM_INVALID",
            `channel "${c}" is not a valid CLAIM_CHANNEL enum value.`,
          ),
        );
      }
    }
    // priority_order must be subset of channels
    const channelSet = new Set(ce.channels_block.channels ?? []);
    for (const p of ce.channels_block.priority_order ?? []) {
      if (!channelSet.has(p)) {
        issues.push(
          issue(
            "warning",
            "claim_engine.channels_block.priority_order",
            "PRIORITY_NOT_SUBSET",
            `priority_order entry "${p}" is not present in channels[].`,
          ),
        );
      }
    }
  }

  // ---- claim_engine: proof requirement (cross-field rule) ----
  if (ce?.proof_requirement_block) {
    const prb = ce.proof_requirement_block;
    if (prb.proof_required === true) {
      if ((prb.proof_types ?? []).length === 0) {
        issues.push(
          issue(
            "error",
            "claim_engine.proof_requirement_block.proof_types",
            "CROSSFIELD_PROOF_TYPES_REQUIRED",
            "proof_required=true but proof_types[] is empty.",
          ),
        );
      }
      if ((prb.proof_destinations ?? []).length === 0) {
        issues.push(
          issue(
            "warning",
            "claim_engine.proof_requirement_block.proof_destinations",
            "CROSSFIELD_PROOF_DEST_RECOMMENDED",
            "proof_required=true but no proof_destinations[] specified.",
          ),
        );
      }
    }
    for (const t of prb.proof_types ?? []) {
      if (!PROOF_TYPE_ENUM.includes(t)) {
        issues.push(
          issue(
            "error",
            "claim_engine.proof_requirement_block.proof_types",
            "ENUM_INVALID",
            `proof_type "${t}" is not a valid PROOF_TYPE enum value.`,
          ),
        );
      }
    }
    for (const d of prb.proof_destinations ?? []) {
      if (!PROOF_DESTINATION_ENUM.includes(d)) {
        issues.push(
          issue(
            "error",
            "claim_engine.proof_requirement_block.proof_destinations",
            "ENUM_INVALID",
            `proof_destination "${d}" is not a valid PROOF_DESTINATION enum value.`,
          ),
        );
      }
    }
  }

  // ---- claim_engine: instruction url shape ----
  if (ce?.instruction_block) {
    if (!isUrlish(ce.instruction_block.claim_url)) {
      issues.push(
        issue(
          "warning",
          "claim_engine.instruction_block.claim_url",
          "URL_SHAPE_INVALID",
          `claim_url "${ce.instruction_block.claim_url}" does not look like a valid http(s) URL.`,
        ),
      );
    }
  }

  // ---- readiness_engine: state enum ----
  const st = rec.readiness_engine?.state_block?.state;
  if (st && !LIFECYCLE_STATE_ENUM.includes(st)) {
    issues.push(
      issue(
        "error",
        "readiness_engine.state_block.state",
        "ENUM_INVALID",
        `lifecycle state "${st}" is not a valid LIFECYCLE_STATE enum value.`,
      ),
    );
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;

  return {
    ok: errorCount === 0,
    issues,
    errorCount,
    warningCount,
    infoCount,
  };
}
