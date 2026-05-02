/**
 * RESOLVER RULES — Reasoning-First (Phase 1, 5 fields)
 *
 * Each rule receives the full record + raw_content (lowercased convenience
 * string) and returns a ResolverDecision.
 *
 * Decisions:
 *   - "ask"            → cannot resolve, show as Admin Verify question
 *   - "inferred"       → empty value but reasonable to infer from context
 *   - "not_applicable" → field doesn't apply for this promo type
 *   - "normalized"     → value present but inconsistent, map to canonical
 *
 * Hard rules:
 *   - Pure functions, no side effects
 *   - Never mutate record
 *   - Return canonicalValue ONLY for "normalized" decisions
 *   - Reasoning string is human-readable Bahasa Indonesia
 */

import type { PkV10Record } from "@/features/promo-knowledge/schema/pk-v10";

export type ResolverStatus = "ask" | "inferred" | "not_applicable" | "normalized";

/**
 * Audit tag — orthogonal to status. Classification explains WHY a decision
 * was made, independent of the orchestrator action (skip vs ask).
 *
 *   - "explicit"        → field already filled by extractor; resolver respects it
 *   - "not_applicable"  → pkRecord state proves field doesn't apply
 *   - "ambiguous"       → cannot decide from pkRecord alone; admin must answer
 */
export type ResolverClassification = "explicit" | "not_applicable" | "ambiguous";

export interface ResolverDecision {
  status: ResolverStatus;
  reasoning: string;
  /** Audit tag. Optional for legacy rules; required for field-first rules. */
  classification?: ResolverClassification;
  /** Only set when status === "normalized". The canonical value to write. */
  canonicalValue?: unknown;
  /** Only set for "normalized" of an array (e.g. void_conditions): index→canonical map. */
  arrayPatches?: Array<{ index: number; field: string; canonical: string }>;
}

export interface ResolverContext {
  record: PkV10Record;
  /** Lowercased meta_engine.source_block.raw_content for keyword reasoning. */
  rawLower: string;
  promoType: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

const isEmpty = (v: unknown): boolean => {
  if (v === null || v === undefined) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
};

const containsAny = (hay: string, needles: string[]): boolean =>
  needles.some((n) => hay.includes(n));

// ─────────────────────────────────────────────────────────────────────────
// Rule — scope_engine.game_block.eligible_providers (FIELD-FIRST)
// ─────────────────────────────────────────────────────────────────────────
// PURE pkRecord field check. ZERO raw_text, ZERO regex, ZERO inference.
// Only reads:
//   - scope_engine.game_block.game_domain    (canonical enum / string)
//   - scope_engine.game_block.eligible_providers (array)
//
// Decision matrix:
//   game_domain ∈ {null, "", "all", "none"}    → not_applicable / not_applicable
//   game_domain specific + providers non-empty → not_applicable / explicit
//   game_domain specific + providers empty     → ask            / ambiguous
const GAME_DOMAIN_NA_VALUES = new Set(["", "all", "none"]);

export const RULE_PROVIDER_FIELD_FIRST = {
  path: "scope_engine.game_block.eligible_providers",
  resolve(ctx: ResolverContext): ResolverDecision | null {
    const gb = ctx.record.scope_engine?.game_block;
    const domainRaw = gb?.game_domain;
    const providers = gb?.eligible_providers;

    const domainNorm =
      domainRaw === null || domainRaw === undefined
        ? ""
        : String(domainRaw).trim().toLowerCase();

    // Case 1: game_domain absent or canonical "all"/"none" → not applicable
    if (GAME_DOMAIN_NA_VALUES.has(domainNorm)) {
      return {
        status: "not_applicable",
        classification: "not_applicable",
        reasoning: `game_domain="${domainNorm || "null"}" → provider scope tidak relevan.`,
      };
    }

    // Case 2: specific game_domain + providers already filled → explicit
    if (Array.isArray(providers) && providers.length > 0) {
      return {
        status: "not_applicable",
        classification: "explicit",
        reasoning: `eligible_providers sudah terisi (${providers.length} item) untuk game_domain="${domainNorm}".`,
      };
    }

    // Case 3: specific game_domain + providers empty → ambiguous, ASK admin
    return {
      status: "ask",
      classification: "ambiguous",
      reasoning: `game_domain="${domainNorm}" tapi eligible_providers kosong → admin harus tentukan.`,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Rule — taxonomy_engine.logic_block.turnover_basis (FIELD-FIRST)
// ─────────────────────────────────────────────────────────────────────────
// PURE field read. Resolver bukan reasoning engine kedua.
// Hanya baca turnover_basis. Jika extractor tidak menentukan, itu ASK admin.
//
// Decision matrix:
//   turnover_basis non-empty → not_applicable / explicit  (extractor sudah jawab)
//   turnover_basis empty     → ask            / ambiguous (extractor gagal/diam)
export const RULE_TURNOVER_FIELD_FIRST = {
  path: "taxonomy_engine.logic_block.turnover_basis",
  resolve(ctx: ResolverContext): ResolverDecision | null {
    const tb = ctx.record.taxonomy_engine?.logic_block?.turnover_basis;

    if (!isEmpty(tb)) {
      return {
        status: "not_applicable",
        classification: "explicit",
        reasoning: `turnover_basis="${tb}" sudah ditentukan extractor.`,
      };
    }

    return {
      status: "ask",
      classification: "ambiguous",
      reasoning:
        "turnover_basis kosong → resolver tidak menebak; admin harus konfirmasi applicability.",
    };
  },
};


// ─────────────────────────────────────────────────────────────────────────
// Rule 2 — dependency_engine.stacking_block.stacking_policy
// ─────────────────────────────────────────────────────────────────────────
// IMPORTANT: PARTIAL_STACKING must be checked BEFORE FULL_NO_STACKING.
// Partial phrases often contain full phrases as substring
// (e.g. "tidak bisa digabung dengan promo tertentu" contains "tidak bisa digabung").
// Reversing this order will misclassify partial as full. Do not reorder.
const PARTIAL_STACKING = [
  "tidak bisa digabung dengan promo tertentu",
  "tidak dapat digabung dengan beberapa promo",
  "kecuali promo",
  "terkecuali",
];

const FULL_NO_STACKING = [
  "tidak bisa digabung",
  "tidak dapat digabung",
  "tidak boleh digabung",
  "hanya satu promo",
  "hanya 1 promo",
  "tidak dapat digabungkan",
  "no stacking",
  "cannot be combined",
];

export const RULE_STACKING_POLICY = {
  path: "dependency_engine.stacking_block.stacking_policy",
  resolve(ctx: ResolverContext): ResolverDecision | null {
    const current = ctx.record.dependency_engine?.stacking_block?.stacking_policy ?? "";
    const raw = ctx.rawLower;

    // Already filled correctly → no resolver action
    if (!isEmpty(current) && current !== "no_stacking") return null;

    // Partial first — substring of full phrases would otherwise misfire
    if (containsAny(raw, PARTIAL_STACKING)) {
      return null; // ambiguous, biarkan admin yang putuskan
    }

    // Full no-stacking → normalize to canonical
    if (containsAny(raw, FULL_NO_STACKING)) {
      if (current === "no_stacking") return null; // already canonical
      return {
        status: "normalized",
        reasoning:
          'Source menyebut larangan menggabung promo secara penuh → di-map ke canonical "no_stacking".',
        canonicalValue: "no_stacking",
      };
    }

    // Empty + no signal → genuinely missing, ask admin
    return null;
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Rule 3 — claim_engine.method_block.claim_method
// ─────────────────────────────────────────────────────────────────────────
const AUTO_CLAIM_PHRASES = [
  "otomatis",
  "auto credit",
  "auto-credit",
  "langsung masuk saldo",
  "langsung masuk ke saldo",
  "dibagikan setiap hari",
  "dibagikan otomatis",
  "akan dikreditkan otomatis",
];

export const RULE_CLAIM_METHOD = {
  path: "claim_engine.method_block.claim_method",
  resolve(ctx: ResolverContext): ResolverDecision | null {
    const current = ctx.record.claim_engine?.method_block?.claim_method ?? "";
    if (!isEmpty(current)) return null; // already set

    if (containsAny(ctx.rawLower, AUTO_CLAIM_PHRASES)) {
      return {
        status: "inferred",
        reasoning:
          'Source menyebut bonus otomatis/langsung masuk saldo → diinferensikan claim_method="auto" (perlu dicek admin, bukan wajib).',
      };
    }
    return null;
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Rule 4 — reward_engine.requirement_block.min_deposit
// ─────────────────────────────────────────────────────────────────────────
export const RULE_MIN_DEPOSIT = {
  path: "reward_engine.requirement_block.min_deposit",
  resolve(ctx: ResolverContext): ResolverDecision | null {
    const current = ctx.record.reward_engine?.requirement_block?.min_deposit;
    if (!isEmpty(current)) return null;

    const t = ctx.promoType;

    // Rollingan / cashback turnover-based promos: min_deposit is not the qualifier
    if (t.includes("rolling") || t.includes("cashback")) {
      // But only if turnover_basis is something other than deposit_only
      const tb = (ctx.record.taxonomy_engine?.logic_block?.turnover_basis ?? "")
        .toLowerCase();
      if (tb && tb !== "deposit_only") {
        return {
          status: "not_applicable",
          reasoning: `Promo type "${t}" dengan turnover_basis="${tb}" → kualifikasi via turnover, bukan min_deposit.`,
        };
      }
    }

    // Merchandise / loyalty redemption: no deposit gate
    if (t.includes("merchandise") || t.includes("loyalty") || t.includes("level_up")) {
      return {
        status: "not_applicable",
        reasoning: `Promo type "${t}" tidak menggunakan min_deposit sebagai gate.`,
      };
    }

    return null;
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Rule 5 — invalidation_engine.void_conditions_block (normalize trigger names)
// ─────────────────────────────────────────────────────────────────────────
const VOID_TRIGGER_NORMALIZATION: Array<{ patterns: string[]; canonical: string }> = [
  {
    patterns: ["bonus hunter", "bonus_hunter", "bonushunter"],
    canonical: "bonus_hunter",
  },
  {
    patterns: ["kecurangan", "fraud", "fraud_detected", "deposit fraud", "deposit_fraud"],
    canonical: "deposit_fraud",
  },
  {
    patterns: ["multi accounting", "multi_accounting", "multi-account", "akun ganda"],
    canonical: "multi_accounting",
  },
  {
    patterns: ["safety bet", "safety_bet", "hedging"],
    canonical: "safety_bet",
  },
  {
    patterns: ["self referral", "self_referral", "referral diri sendiri"],
    canonical: "self_referral",
  },
];

const normalizeVoidTrigger = (raw: string): string | null => {
  const low = raw.toLowerCase().trim();
  if (!low) return null;
  for (const { patterns, canonical } of VOID_TRIGGER_NORMALIZATION) {
    if (low === canonical) return null; // already canonical
    if (patterns.some((p) => low === p || low.includes(p))) return canonical;
  }
  return null;
};

export const RULE_VOID_TRIGGER_NORMALIZATION = {
  path: "invalidation_engine.void_conditions_block",
  resolve(ctx: ResolverContext): ResolverDecision | null {
    const conds = ctx.record.invalidation_engine?.void_conditions_block ?? [];
    if (!Array.isArray(conds) || conds.length === 0) return null;

    const patches: Array<{ index: number; field: string; canonical: string }> = [];
    conds.forEach((c, i) => {
      const canonical = normalizeVoidTrigger(c?.trigger_name ?? "");
      if (canonical && canonical !== c?.trigger_name) {
        patches.push({ index: i, field: "trigger_name", canonical });
      }
    });

    if (patches.length === 0) return null;

    return {
      status: "normalized",
      reasoning: `Normalisasi ${patches.length} void trigger ke canonical enum V10 (${patches
        .map((p) => p.canonical)
        .join(", ")}).`,
      arrayPatches: patches,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// REGISTRY
// ─────────────────────────────────────────────────────────────────────────

export const RESOLVER_RULES = [
  RULE_PROVIDER_FIELD_FIRST,
  RULE_TURNOVER_FIELD_FIRST,
  RULE_STACKING_POLICY,
  RULE_CLAIM_METHOD,
  RULE_MIN_DEPOSIT,
  RULE_VOID_TRIGGER_NORMALIZATION,
] as const;
