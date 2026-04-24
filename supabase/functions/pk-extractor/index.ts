/**
 * pk-extractor — Json Schema Draft V.09 extractor
 *
 * Multimodal LLM extraction:
 *   - Input: text (raw promo content) + optional image (base64 / url)
 *   - LLM: google/gemini-2.5-pro (vision + text + reasoning)
 *   - Output: Json Schema Draft V.09 (full inert shape, 22 engines)
 *
 * Uses Lovable AI Gateway. NO keyword matching. NO regex parsing.
 * Pure LLM reasoning end-to-end.
 *
 * State on output: ai_draft. NOT persisted server-side. Returned to client.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-pro";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Anda adalah Promo Knowledge Extractor V.09.

TUGAS: Ekstrak konten promo (teks dan/atau gambar) ke struktur Json Schema Draft V.09.

PRINSIP UTAMA:
1. REASONING-FIRST. Anda BUKAN bot keyword. Pahami semantic, bukan cocok kata.
2. HYBRID INPUT. Jika text dan image dua-duanya ada, gabungkan info dari kedua sumber.
   - Image bisa lebih lengkap dari text (logo, badge, tabel reward).
   - Text bisa lebih lengkap dari image (S&K detail, mekanisme klaim).
   - Saling melengkapi, bukan saling konflik.
3. JUJUR TENTANG KETIDAKTAHUAN. Jika field tidak disebut di sumber:
   - String → "" (set tapi kosong)
   - Number → null
   - Array → []
   - Boolean → false (default)
   - Object opsional (mis. activation_rule) → null. JANGAN PERNAH {} kosong.
   Jangan pernah mengarang nilai.
4. PROVENANCE. Untuk SETIAP field penting, isi:
   - ai_confidence[path] = 0.0 - 1.0 (1.0 = explicit di sumber, 0.0 = tidak ada)
   - field_status[path] = "explicit" | "inferred" | "derived" | "unknown"
5. STATE. Output WAJIB readiness_engine.state_block.state = "ai_draft".
6. ENUM STRICT. Gunakan HANYA value yang ada di enum spec. Jika ragu → "" / null.

STRUKTUR OUTPUT: Lihat tool schema 'extract_promo_v09'. WAJIB isi semua 22 engine
(boleh kosong sesuai aturan poin 3, tapi shape harus utuh).

ENUM REFERENSI (subset, lihat tool schema untuk full list):
- promo_type: welcome_bonus, deposit_bonus, cashback, rollingan, referral, lucky_spin, lucky_draw, freechip, freespin_bonus, parlay_protection, birthday_bonus, level_up, loyalty_point, merchandise, event_ranking, event_turnover_ladder, event_slot_specific, mystery_number, extra_withdraw, payment_discount, new_member_bonus
- promo_mode: single, tiered, multi_variant. WAJIB diisi:
   - "single" = 1 reward formula tanpa tier/varian
   - "tiered" = ada tier/level (mis. Bronze/Silver/Gold) dgn reward berbeda
   - "multi_variant" = beberapa varian paralel (mis. per game type)
- target_user: new_member, existing_member, vip, all_member
- program_classification: A (Reward Program), B (Event Program), C (System Rule)
- claim_method: auto, manual_livechat, manual_whatsapp, manual_telegram, in_app_button, form_submission, cs_approval
- calculation_basis: deposit, turnover, loss, win, bet, payout, downline_winlose, level_up_reward, fixed, rank_position, stake_amount
- payout_direction: upfront (sebelum main), backend (setelah main, mis. cashback)
- reward_type: physical, cash, credit_game, voucher, ticket, lucky_spin, discount, freespin, combo
- void_trigger: bonus_hunter, safety_bet, invest, ip_duplicate, data_duplicate, deposit_fraud, hold_freespin, multi_accounting, self_referral, account_change, claim_timeout, wrong_bank_info, screenshot_missing, game_category_violation, cashout_partial
- game_domain: slot, casino, live_casino, sports, sportsbook, togel, sabung_ayam, e_lottery, arcade, mixed, all
- intent_category: acquisition (akuisisi), retention (retensi), reactivation, engagement, virality, upsell

REASONING TIPS:
- "Cashback" → primary_action: lose_to_cashback, calculation_basis: loss, payout_direction: backend, intent_category: retention
- "Bonus Deposit" → primary_action: deposit_to_bonus, calculation_basis: deposit, payout_direction: upfront, intent_category: acquisition (jika new_member) atau retention
- "Rollingan" → primary_action: bet_to_rollingan, calculation_basis: turnover, payout_direction: backend
- "Referral" → primary_action: refer_to_commission, intent_category: virality

IDENTITY (PENTING — JANGAN KOSONGKAN):
- client_block.client_id: Slug client (mis. "slot25", "haberaja"). Ekstrak dari URL, brand mark,
  atau header sumber. Kalau tidak ada → "" dan field_status="unknown".
- client_block.client_id_field_status: status pengisian client_id ("explicit"/"inferred"/"unknown").
- promo_block.promo_mode: WAJIB salah satu dari single | tiered | multi_variant. Gunakan reasoning,
  jangan kosong kalau ada konten promo.

CLASSIFICATION ANSWER (LOCKED):
- classification_engine.question_block.q1..q4 .answer WAJIB pakai "ya" atau "tidak" (HURUF KECIL,
  Bahasa Indonesia). JANGAN "Yes"/"No"/"Iya"/"Tidak". Konsisten satu konvensi di seluruh schema.

MECHANICS (WAJIB ISI items[].data):
mechanics_engine.items[] WAJIB DIISI dgn detail per-unit-logika. JANGAN kosongkan
kalau ada konten promo. Pecah promo jadi unit-unit semantik:
  - 1 item per trigger event (apa yg memicu promo)
  - 1 item per eligibility/syarat (siapa yg boleh, threshold)
  - 1 item per calculation (rumus, persen, basis)
  - 1 item per reward (bentuk hadiah)
  - 1 item per distribution (kapan/cara dikirim)
  - 1 item per control (anti-stack, anti-fraud rule umum)
  - 1 item per invalidator (kondisi pembatalan, void)

Setiap item HARUS punya: evidence (kutipan), confidence, activation_rule (object atau null —
JANGAN {} kosong), data (object detail TERISI — JANGAN {} kosong).

CONTOH data per mechanic_type (contoh, bukan exhaustive):
- trigger        → { trigger_event, period_type, calculation_window, calculation_basis }
- eligibility    → { user_segment, min_threshold, threshold_unit, currency }
- calculation    → { calculation_basis, calculation_method, percentage, max_reward, currency }
- reward         → { reward_type, reward_form, reward_unit, voucher_kind }
- distribution   → { distribution_method, distribution_day, distribution_window, auto_credit }
- control        → { control_type, stacking_policy, max_concurrent }
- invalidator    → { void_trigger, void_action, penalty_scope }
- constraint     → { constraint_type, value, currency }
Pilih field yg relevan dgn isi promo. JANGAN kirim {} kosong — kalau benar2 tidak ada
detail untuk mechanic itu, jangan buat itemnya sama sekali.

activation_rule:
- null         → kalau mechanic ini aktif tanpa syarat tambahan
- object       → kalau ada kondisi: { condition_type, threshold_value?, threshold_unit?,
                  period_start?, period_end?, schedule_day?, violation_types? }
NEVER kirim {} kosong.

PROJECTION:
projection_engine JANGAN diisi sendiri. Akan di-derive otomatis post-extraction
dari engine lain. Cukup isi dgn nilai default kosong sesuai schema (summary: "",
intent_category: ""). Server akan overwrite.

ai_confidence (WAJIB TERISI):
Map dari field path → score 0..1. WAJIB isi MINIMUM 10 path penting yg sudah Anda ekstrak,
contoh path:
  "identity_engine.promo_block.promo_name"
  "identity_engine.promo_block.promo_type"
  "identity_engine.promo_block.target_user"
  "identity_engine.promo_block.promo_mode"
  "reward_engine.calculation_basis"
  "reward_engine.calculation_value"
  "reward_engine.payout_direction"
  "reward_engine.reward_type"
  "trigger_engine.trigger_event"
  "claim_engine.method_block.claim_method"
  "scope_engine.game_domain"
  "period_engine.valid_from"
  "period_engine.valid_until"
JANGAN kirim {} kosong. Kalau field tidak ada di sumber → confidence 0.0, tetap dimasukkan.

field_status sama: WAJIB minimal 10 path, value "explicit"/"inferred"/"derived"/"unknown".

Output via tool call WAJIB dipanggil. JANGAN balas teks biasa.`;

// JSON Schema for tool calling — matches PromoKnowledgeRecord shape
function getToolSchema() {
  return {
    type: "function",
    function: {
      name: "extract_promo_v09",
      description: "Extract promo content into Json Schema Draft V.09 format",
      parameters: {
        type: "object",
        properties: {
          identity_engine: {
            type: "object",
            properties: {
              client_block: {
                type: "object",
                properties: {
                  client_id: { type: "string", description: "Slug client (mis. 'slot25', 'haberaja'). Empty string kalau benar-benar tidak ada." },
                  client_name: { type: "string" },
                  client_id_field_status: {
                    type: "string",
                    description: "Status pengisian client_id: 'explicit' (tertulis di sumber), 'inferred' (disimpulkan dari URL/brand), 'unknown' (tidak ada).",
                  },
                },
                required: ["client_id", "client_name", "client_id_field_status"],
                additionalProperties: false,
              },
              promo_block: {
                type: "object",
                properties: {
                  promo_name: { type: "string" },
                  promo_type: { type: "string" },
                  target_user: { type: "string" },
                  promo_mode: {
                    type: "string",
                    description: "WAJIB salah satu dari 'single' | 'tiered' | 'multi_variant'. Empty string hanya kalau benar-benar tidak ada konten promo.",
                  },
                },
                required: ["promo_name", "promo_type", "target_user", "promo_mode"],
                additionalProperties: false,
              },
            },
            required: ["client_block", "promo_block"],
            additionalProperties: false,
          },
          classification_engine: {
            type: "object",
            properties: {
              result_block: {
                type: "object",
                properties: {
                  program_classification: { type: "string", description: "A | B | C | empty string if unknown" },
                  review_confidence: { type: "string", description: "high | medium | low | empty if unknown" },
                },
                required: ["program_classification", "review_confidence"],
                additionalProperties: false,
              },
              question_block: {
                type: "object",
                properties: {
                  q1: { type: "object", properties: { answer: { type: "string", enum: ["ya", "tidak", ""] }, reasoning: { type: "string" } }, required: ["answer", "reasoning"], additionalProperties: false },
                  q2: { type: "object", properties: { answer: { type: "string", enum: ["ya", "tidak", ""] }, reasoning: { type: "string" } }, required: ["answer", "reasoning"], additionalProperties: false },
                  q3: { type: "object", properties: { answer: { type: "string", enum: ["ya", "tidak", ""] }, reasoning: { type: "string" } }, required: ["answer", "reasoning"], additionalProperties: false },
                  q4: { type: "object", properties: { answer: { type: "string", enum: ["ya", "tidak", ""] }, reasoning: { type: "string" } }, required: ["answer", "reasoning"], additionalProperties: false },
                },
                required: ["q1", "q2", "q3", "q4"],
                additionalProperties: false,
              },
            },
            required: ["result_block", "question_block"],
            additionalProperties: false,
          },
          taxonomy_engine: {
            type: "object",
            properties: {
              mode: { type: "string" },
              tier_archetype: { type: ["string", "null"] },
              turnover_basis: { type: ["string", "null"] },
            },
            required: ["mode", "tier_archetype", "turnover_basis"],
            additionalProperties: false,
          },
          period_engine: {
            type: "object",
            properties: {
              valid_from: { type: "string" },
              valid_until: { type: "string" },
              claim_frequency: { type: "string" },
              calculation_period: { type: "string" },
              distribution_day: { type: "string" },
              reward_distribution: { type: "string" },
            },
            required: ["valid_from", "valid_until", "claim_frequency", "calculation_period", "distribution_day", "reward_distribution"],
            additionalProperties: false,
          },
          time_window_engine: {
            type: "object",
            properties: {
              timezone: { type: "string" },
              offset: { type: "string" },
              open_ended: { type: "boolean" },
            },
            required: ["timezone", "offset", "open_ended"],
            additionalProperties: false,
          },
          trigger_engine: {
            type: "object",
            properties: {
              trigger_event: { type: "string" },
              logic_operator: { type: "string" },
              conditions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    field: { type: "string" },
                    operator: { type: "string" },
                    value: { type: "string", description: "Stringify number kalau perlu. Empty string kalau ga ada." },
                    currency: { type: "string" },
                  },
                  required: ["field", "operator", "value", "currency"],
                  additionalProperties: false,
                },
              },
            },
            required: ["trigger_event", "logic_operator", "conditions"],
            additionalProperties: false,
          },
          claim_engine: {
            type: "object",
            properties: {
              method_block: {
                type: "object",
                properties: {
                  claim_method: { type: "string" },
                  auto_credit: { type: "boolean" },
                },
                required: ["claim_method", "auto_credit"],
                additionalProperties: false,
              },
              channels_block: {
                type: "object",
                properties: {
                  channels: { type: "array", items: { type: "string" } },
                  priority_order: { type: "array", items: { type: "string" } },
                },
                required: ["channels", "priority_order"],
                additionalProperties: false,
              },
              proof_requirement_block: {
                type: "object",
                properties: {
                  proof_required: { type: "boolean" },
                  proof_types: { type: "array", items: { type: "string" } },
                  proof_destinations: { type: "array", items: { type: "string" } },
                },
                required: ["proof_required", "proof_types", "proof_destinations"],
                additionalProperties: false,
              },
              instruction_block: {
                type: "object",
                properties: {
                  claim_steps: { type: "array", items: { type: "string" } },
                  claim_url: { type: "string" },
                },
                required: ["claim_steps", "claim_url"],
                additionalProperties: false,
              },
            },
            required: ["method_block", "channels_block", "proof_requirement_block", "instruction_block"],
            additionalProperties: false,
          },
          proof_engine: {
            type: "object",
            properties: {
              proof_required: { type: "boolean" },
              proof_types: { type: "array", items: { type: "string" } },
              proof_destinations: { type: "array", items: { type: "string" } },
              hashtag_requirement: { type: "string" },
            },
            required: ["proof_required", "proof_types", "proof_destinations", "hashtag_requirement"],
            additionalProperties: false,
          },
          payment_engine: {
            type: "object",
            properties: {
              deposit_method: { type: "string" },
              deposit_providers: { type: "array", items: { type: "string" } },
            },
            required: ["deposit_method", "deposit_providers"],
            additionalProperties: false,
          },
          scope_engine: {
            type: "object",
            properties: {
              game_domain: { type: "string" },
              game_providers: { type: "array", items: { type: "string" } },
              blacklist_categories: { type: "array", items: { type: "string" } },
            },
            required: ["game_domain", "game_providers", "blacklist_categories"],
            additionalProperties: false,
          },
          reward_engine: {
            type: "object",
            properties: {
              calculation_basis: { type: ["string", "null"] },
              calculation_method: { type: "string" },
              calculation_value: { type: ["number", "null"] },
              calculation_unit: { type: "string" },
              payout_direction: { type: ["string", "null"] },
              reward_type: { type: "string" },
              voucher_kind: { type: ["string", "null"] },
              min_base: { type: ["number", "null"] },
              max_reward: { type: ["number", "null"] },
              currency: { type: "string" },
            },
            required: ["calculation_basis", "calculation_method", "calculation_value", "calculation_unit", "payout_direction", "reward_type", "voucher_kind", "min_base", "max_reward", "currency"],
            additionalProperties: false,
          },
          loyalty_engine: {
            type: "object",
            properties: {
              point_name: { type: ["string", "null"] },
              tier_name: { type: ["string", "null"] },
            },
            required: ["point_name", "tier_name"],
            additionalProperties: false,
          },
          variant_engine: {
            type: "object",
            properties: {
              tier_dimension: { type: ["string", "null"] },
              turnover_rule_format: { type: ["string", "null"] },
              variants: { type: "array", items: { type: "object", additionalProperties: true } },
            },
            required: ["tier_dimension", "turnover_rule_format", "variants"],
            additionalProperties: false,
          },
          dependency_engine: {
            type: "object",
            properties: {
              stacking_policy: { type: "string" },
              stack_whitelist: { type: "array", items: { type: "string" } },
              stack_blacklist: { type: "array", items: { type: "string" } },
            },
            required: ["stacking_policy", "stack_whitelist", "stack_blacklist"],
            additionalProperties: false,
          },
          invalidation_engine: {
            type: "object",
            properties: {
              void_triggers: { type: "array", items: { type: "string" } },
              void_actions: { type: "array", items: { type: "string" } },
              penalty_type: { type: "string" },
              penalty_scope: { type: "string" },
            },
            required: ["void_triggers", "void_actions", "penalty_type", "penalty_scope"],
            additionalProperties: false,
          },
          terms_engine: {
            type: "object",
            properties: {
              raw_terms: { type: "array", items: { type: "string" } },
            },
            required: ["raw_terms"],
            additionalProperties: false,
          },
          reasoning_engine: {
            type: "object",
            properties: {
              primary_action: { type: "string" },
              reward_nature: { type: "string" },
              distribution_path: { type: "string" },
              value_shape: { type: "string" },
            },
            required: ["primary_action", "reward_nature", "distribution_path", "value_shape"],
            additionalProperties: false,
          },
          mechanics_engine: {
            type: "object",
            description: "Per-mechanic detail. items[] WAJIB diisi dengan tiap unit mekanik yg terdeteksi (trigger/eligibility/calculation/reward/distribution/control/invalidator/etc). JANGAN kosongkan kalau ada konten.",
            properties: {
              mechanic_source: { type: "string", description: "e.g. llm_text_extraction, llm_image_extraction, llm_multimodal_extraction" },
              items: {
                type: "array",
                description: "Setiap mechanic = 1 unit logika promo. Pecah jadi item terpisah utk tiap trigger/syarat/perhitungan/reward/distribusi/aturan/invalidator. Untuk Cashback biasanya minimal 6 item: 1 trigger, 1 eligibility, 1 calculation, 1 reward, 1 distribution, 1+ invalidator.",
                items: {
                  type: "object",
                  properties: {
                    mechanic_id: { type: "string", description: "format: m_<type>_<idx>, e.g. m_trigger_1" },
                    mechanic_type: {
                      type: "string",
                      enum: ["trigger", "eligibility", "calculation", "reward", "distribution", "control", "invalidator", "constraint", "other"],
                    },
                    evidence: { type: "string", description: "kutipan persis dari sumber yg jadi basis mechanic ini" },
                    confidence: { type: "number", description: "0..1" },
                    ambiguity: { type: "boolean" },
                    ambiguity_reason: { type: ["string", "null"] },
                    activation_rule: {
                      type: ["object", "null"],
                      description: "kondisi pengaktifan: { condition_type, threshold_value?, period_start?, period_end?, schedule_day?, violation_types?, ... }. null kalau ga relevan.",
                      additionalProperties: true,
                    },
                    data: {
                      type: "object",
                      description: "detail spesifik mechanic. Bebas struktur, isi field yg relevan: trigger_event, calculation_base, percentage, reward_type, distribution_method, void_action, dst.",
                      additionalProperties: true,
                    },
                  },
                  required: ["mechanic_id", "mechanic_type", "evidence", "confidence", "ambiguity", "ambiguity_reason", "activation_rule", "data"],
                  additionalProperties: false,
                },
              },
            },
            required: ["mechanic_source", "items"],
            additionalProperties: false,
          },
          projection_engine: {
            type: "object",
            properties: {
              intent_category: { type: "string" },
              summary: { type: "string" },
            },
            required: ["intent_category", "summary"],
            additionalProperties: false,
          },
          risk_engine: {
            type: "object",
            properties: {
              promo_risk_level: { type: "string" },
            },
            required: ["promo_risk_level"],
            additionalProperties: false,
          },
          ai_confidence: {
            type: "object",
            description: "Map of field path → confidence score (0..1). Path format: 'engine.block.field'",
            additionalProperties: { type: "number" },
          },
          field_status: {
            type: "object",
            description: "Map of field path → status: explicit | inferred | derived | unknown",
            additionalProperties: { type: "string" },
          },
          extraction_notes: {
            type: "object",
            properties: {
              ambiguity_flags: { type: "array", items: { type: "string" } },
              contradiction_flags: { type: "array", items: { type: "string" } },
              warnings: { type: "array", items: { type: "string" } },
            },
            required: ["ambiguity_flags", "contradiction_flags", "warnings"],
            additionalProperties: false,
          },
        },
        required: [
          "identity_engine", "classification_engine", "taxonomy_engine",
          "period_engine", "time_window_engine", "trigger_engine",
          "claim_engine", "proof_engine", "payment_engine", "scope_engine",
          "reward_engine", "loyalty_engine", "variant_engine", "dependency_engine",
          "invalidation_engine", "terms_engine", "reasoning_engine",
          "mechanics_engine", "projection_engine", "risk_engine",
          "ai_confidence", "field_status", "extraction_notes",
        ],
        additionalProperties: false,
      },
    },
  };
}

// ============================================================
// PROJECTION DERIVATION (deterministic, post-extraction)
// projection_engine = DERIVED ONLY. Build dari engine lain.
// LLM TIDAK BOLEH isi langsung — di-overwrite di sini.
// ============================================================
type AnyObj = Record<string, unknown>;
const _o = (v: unknown): AnyObj => (v && typeof v === "object" ? (v as AnyObj) : {});
const _s = (v: unknown): string => (typeof v === "string" ? v : "");
const _a = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const _n = (v: unknown): number | null =>
  typeof v === "number" && !Number.isNaN(v) ? v : null;
const _b = (v: unknown): boolean => v === true;

function deriveProjection(engines: AnyObj): AnyObj {
  const identity = _o(engines.identity_engine);
  const promo = _o(identity.promo_block);
  const taxonomy = _o(engines.taxonomy_engine);
  const reward = _o(engines.reward_engine);
  const trigger = _o(engines.trigger_engine);
  const claim = _o(engines.claim_engine);
  const claimMethod = _o(claim.method_block);
  const claimChannels = _o(claim.channels_block);
  const proofReq = _o(claim.proof_requirement_block);
  const scope = _o(engines.scope_engine);
  const reasoning = _o(engines.reasoning_engine);
  const dependency = _o(engines.dependency_engine);
  const period = _o(engines.period_engine);
  const variant = _o(engines.variant_engine);

  const promoName = _s(promo.promo_name);
  const promoType = _s(promo.promo_type);
  const targetUser = _s(promo.target_user);
  const calcBasis = _s(reward.calculation_basis);
  const calcMethod = _s(reward.calculation_method);
  const calcValue = _n(reward.calculation_value);
  const calcUnit = _s(reward.calculation_unit);
  const payoutDir = _s(reward.payout_direction);
  const rewardType = _s(reward.reward_type);
  const maxReward = _n(reward.max_reward);
  const minBase = _n(reward.min_base);
  const turnoverBasis = _s(taxonomy.turnover_basis);
  const channels = _a<string>(claimChannels.channels);
  const priority = _a<string>(claimChannels.priority_order);
  const channelsArr = priority.length > 0 ? priority : channels;

  // Auto-summary
  const valueStr =
    calcValue !== null
      ? calcMethod === "percentage" || calcUnit === "%" || calcUnit === "percent"
        ? `${calcValue}%`
        : `${calcValue}${calcUnit ? ` ${calcUnit}` : ""}`
      : "";
  const basisLabel = calcBasis ? ` dari ${calcBasis}` : "";
  const summary = promoName
    ? `${promoName}${valueStr ? ` — ${valueStr}` : ""}${basisLabel}.`.trim()
    : "";

  // Target segment label
  const targetLabel =
    targetUser === "all_member" || targetUser === "all"
      ? "Semua"
      : targetUser === "new_member"
        ? "Member Baru"
        : targetUser === "vip"
          ? "VIP"
          : targetUser === "existing_member"
            ? "Member Lama"
            : targetUser || "";

  // Stateful = mengandung tier/level/state akumulasi
  const tierArche = _s(taxonomy.tier_archetype);
  const variants = _a(_o(variant).variants);
  const stateful = !!tierArche || variants.length > 1;

  return {
    _description: "DERIVED ONLY. Generated post-extraction. Extractor must NOT write directly.",
    summary_block: {
      summary,
      promo_summary: summary,
      main_trigger: _s(trigger.trigger_event),
      main_reward_form: rewardType,
      main_reward_percent: calcMethod === "percentage" ? calcValue : null,
      main_reward_value: calcValue,
      main_reward_unit: calcUnit,
      max_bonus: maxReward,
      min_base: minBase,
      payout_direction: payoutDir,
      turnover_multiplier: null,
      turnover_basis: turnoverBasis || null,
      stateful,
    },
    claim_summary_block: {
      primary_claim_method: _s(claimMethod.claim_method),
      primary_claim_platform: channelsArr[0] ?? "",
      claim_channels: channelsArr,
      auto_credit: _b(claimMethod.auto_credit),
      proof_required: _b(proofReq.proof_required),
      claim_frequency: _s(period.claim_frequency),
      distribution_day: _s(period.distribution_day),
    },
    scope_summary_block: {
      game_domain: _s(_o(scope.game_block).game_domain) || _s(scope.game_domain),
      game_types: _a<string>(_o(scope.game_block).markets ?? scope.markets ?? []),
      game_providers: _a<string>(
        _o(scope.game_block).eligible_providers ?? scope.game_providers ?? [],
      ),
      game_exclusions: _a<string>(
        _o(scope.blacklist_block).providers ?? scope.blacklist_categories ?? [],
      ),
      stacking_policy: _s(_o(dependency).stacking_policy ?? dependency.stacking_policy),
    },
    intent_summary_block: {
      intent_category: _s(reasoning.intent_category) || _s((engines.projection_engine as AnyObj | undefined)?.intent_category as unknown),
      primary_action: _s(reasoning.primary_action),
      reward_nature: _s(reasoning.reward_nature),
      distribution_path: _s(reasoning.distribution_path),
      value_shape: _s(reasoning.value_shape),
      target_segment: targetLabel,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(
        JSON.stringify({ error: "INVALID_BODY", message: "Body harus JSON object" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const text: string = typeof body.text === "string" ? body.text.trim() : "";
    const images: string[] = Array.isArray(body.images)
      ? body.images.filter((i: unknown) => typeof i === "string" && i.length > 0)
      : [];
    const model: string = typeof body.model === "string" && body.model ? body.model : DEFAULT_MODEL;

    if (!text && images.length === 0) {
      return new Response(
        JSON.stringify({
          error: "EMPTY_INPUT",
          message: "Minimal salah satu: text atau images harus diisi",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build multimodal user message
    const userContent: Array<Record<string, unknown>> = [];

    // Context / instruction
    const contextParts: string[] = [];
    if (text) {
      contextParts.push(`KONTEN PROMO (TEKS):\n\n${text}`);
    }
    if (images.length > 0) {
      contextParts.push(
        `KONTEN PROMO (GAMBAR): ${images.length} gambar disertakan. Baca konten visual: judul, persentase, nominal, syarat, badge, dan elemen UI promo.`,
      );
    }
    contextParts.push(
      "\n\nINSTRUKSI: Ekstrak ke Json Schema Draft V.09 via tool call 'extract_promo_v09'. Hybrid mode: text + image saling melengkapi.",
    );

    userContent.push({ type: "text", text: contextParts.join("\n\n") });

    for (const img of images) {
      userContent.push({
        type: "image_url",
        image_url: { url: img },
      });
    }

    const tool = getToolSchema();

    const gatewayBody = {
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "extract_promo_v09" } },
      temperature: 0.1,
    };

    const aiResp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(gatewayBody),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text().catch(() => "");
      console.error("[pk-extractor] Gateway error:", aiResp.status, errText);

      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "RATE_LIMITED", message: "Terlalu banyak request, coba lagi sebentar" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "PAYMENT_REQUIRED", message: "Lovable AI credits habis, top up di Settings → Workspace → Usage" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Gateway ${aiResp.status}: ${errText}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== "extract_promo_v09") {
      console.error("[pk-extractor] No tool call in response:", JSON.stringify(aiData).slice(0, 500));
      return new Response(
        JSON.stringify({
          error: "NO_TOOL_CALL",
          message: "LLM tidak mengikuti tool schema. Coba ulang.",
          raw: aiData?.choices?.[0]?.message?.content ?? null,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("[pk-extractor] Tool args not valid JSON:", e);
      return new Response(
        JSON.stringify({
          error: "INVALID_TOOL_ARGS",
          message: "Tool arguments bukan JSON valid",
          raw: toolCall.function.arguments,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Determine extraction_source
    let extraction_source = "text";
    if (text && images.length > 0) extraction_source = "multimodal";
    else if (images.length > 0) extraction_source = "image";

    // DERIVED: overwrite projection_engine deterministically (LLM hint discarded)
    parsed.projection_engine = deriveProjection(parsed);

    return new Response(
      JSON.stringify({
        ok: true,
        model,
        extraction_source,
        engines: parsed,
        usage: aiData?.usage ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[pk-extractor] Unhandled:", msg);
    return new Response(
      JSON.stringify({ error: "INTERNAL", message: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
