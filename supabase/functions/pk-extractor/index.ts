/**
 * pk-extractor — PKB_WOLFBRAIN V.10 NATIVE EXTRACTOR
 *
 * V10-only. Zero V.09 fallback. Zero conversion layer.
 *
 * Input  : { text?: string, images?: string[], client_id_hint?: string }
 * Output : { ok: true, record: PkV10Record, model, extraction_source, ... }
 *
 * Pipeline:
 *   1. Build Anthropic multimodal user message (image-first, then text).
 *   2. Call ai-proxy with V10 SYSTEM_PROMPT + Wolfclaw_Extractor_V10 tool.
 *   3. Receive tool_use.input → partial PkV10Record-shaped object.
 *   4. mergeIntoInert() → guarantee full-shape PkV10Record.
 *   5. computeFieldStatus() → tag every leaf path (explicit | inferred | not_stated).
 *   6. Return record. NO downgrade to V.09. NO silent fallback.
 *
 * Source of truth: WB_F1 (skeleton) + WB_F2 (field defs) + WB_F3 (enums V10).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  ENUMS,
  PK_V10_AI_CONFIDENCE_QUESTION_THRESHOLD,
  PK_V10_PROMPT_VERSION,
} from "../_shared/pk-v10-enums.ts";
import {
  createInertPkV10Record,
  mergeIntoInert,
  computeFieldStatus,
  type AnyObj,
} from "../_shared/pk-v10-inert.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const AI_PROXY_TYPE = "extract_pk";
const TOOL_NAME = "Wolfclaw_Extractor_V10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================================
// V10 SYSTEM PROMPT
// ============================================================
const SYSTEM_PROMPT = `Anda adalah Wolfclaw Extractor V.10 — extractor PKB_Wolfbrain V.10.

TUGAS
Ekstrak konten promo (teks dan/atau gambar) ke struktur PkV10Record via
tool '${TOOL_NAME}'. WAJIB panggil tool. JANGAN balas teks biasa.

PRINSIP UTAMA (F1 + F2 + F3 V.10):

1. REASONING-FIRST. Anda BUKAN bot keyword. Pahami semantic, bukan cocok kata.

2. HYBRID INPUT. Text + image saling melengkapi.
   - Image bisa lebih lengkap dari text (logo, badge, tabel reward).
   - Text bisa lebih lengkap dari image (S&K detail, mekanisme klaim).

3. JUJUR TENTANG KETIDAKTAHUAN (F1 §8.1 INERT CONTRACT).
   Field tidak disebut di sumber:
   - String → "" (set tapi kosong, JANGAN dihilangkan)
   - Number → null (untuk field nullable) atau 0 (jangan tebak)
   - Array  → []
   - Boolean → false (default)
   - Object opsional → null kalau memang nullable, kalau tidak isi sub-block dgn defaults blank.
   JANGAN PERNAH mengarang nilai. JANGAN PERNAH kirim {} kosong untuk sub-block.

4. PROVENANCE (F3 §1.21).
   - ai_confidence[path] = 0.0–1.0  (1.0 = explicit di sumber, 0.0 = tebakan)
   - _field_status[path] ∈ { "explicit" | "inferred" | "derived" | "propagated" | "not_stated" | "not_applicable" }
     * explicit       → ada bukti jelas di sumber
     * inferred       → reasoning kuat, tidak literal
     * derived        → diturunkan dari field lain
     * propagated     → diisi otomatis dari context (mis. client_id dari URL)
     * not_stated     → tidak ada di sumber TAPI field ini RELEVAN untuk promo ini
     * not_applicable → field ini TIDAK RELEVAN untuk promo ini (apapun isi sumber)
   Threshold ai_confidence untuk kandidat pertanyaan ke Admin: < ${PK_V10_AI_CONFIDENCE_QUESTION_THRESHOLD}.

4.1 APPLICABILITY DECISION

    Before assigning any field value or field_status, decide whether the
    field is applicable to the promotion mechanism.

    Step 1 — Applicability
      Ask: "Does this field have a logical role in explaining this promotion?"

      If NO:
        - set _field_status[path] = "not_applicable"
        - leave value null or use the canonical neutral value if defined by schema
        - do not mark it as not_stated

    Step 2 — Evidence
      If YES, then classify evidence:
        - explicit:   directly stated in source
        - inferred:   logically derived from source context
        - derived:    deterministically computed from other fields
        - propagated: system/client context
        - not_stated: applicable, but source does not provide enough information

    Core distinction:
      - not_applicable = field has no logical role in this promotion
      - not_stated     = field is relevant, but the source does not say enough

    Do not decide applicability from promo type labels.
    Do not use keyword or regex.
    Do not use archetype templates.
    Use semantic reasoning from the actual promotion mechanism.

    Output requirement:
       If a field is not_applicable, include its path explicitly in _field_status.
       Do not omit it.

4.2 APPLICABILITY CONSISTENCY CHECK (MANDATORY)

    After filling all fields and _field_status, run this checklist BEFORE
    finalizing output. This is an internal self-audit — do not skip.

    A. Coverage
       - For every relevant field path, there MUST be an entry in _field_status.
       - Do not omit paths. If unsure, choose a status explicitly.

    B. Not Applicable Enforcement
       - If any statement implies the absence of a requirement
         (e.g., no wagering, no provider restriction, no deposit requirement),
         then ALL related fields MUST be marked _field_status = "not_applicable".
       - Do NOT use "not_stated" for fields that are logically irrelevant.

    C. Not Stated Discipline
       - "not_stated" is ONLY for fields that are relevant BUT the source
         provides insufficient or ambiguous information.
       - If the field has no logical role → it is NOT "not_stated",
         it is "not_applicable".

    D. Consistency Sweep
       - If one field is marked not_applicable, check all sibling/related
         fields and align them.
         (Example: if wagering is not applicable → all turnover-related
         fields must be not_applicable.)

    E. Confidence Sanity
       - If you used "inferred", you MUST include ai_confidence.
       - Do not use "inferred" when "not_applicable" is logically correct.

    F. Final Assertion (internal)
       - Ask: "Have I used not_stated anywhere I should have used not_applicable?"
       - If YES → correct before output.

    Output must include explicit _field_status entries for all relevant paths.
    Do not rely on server-side defaults to guess applicability.

4.3 PROPAGATION CONSISTENCY (MANDATORY)

    After determining not_applicable for any field, you MUST propagate that
    decision to all related fields.

    A. Mirror Propagation
       If a canonical field is not_applicable:
         - All projection_engine mirror fields MUST also be not_applicable.
       Example:
         If taxonomy_engine.logic_block.turnover_basis = not_applicable
         Then ALL projection turnover fields MUST also be not_applicable.

    B. Block-Level Propagation
       If an entire block has no logical role:
         - ALL leaf fields in that block MUST be not_applicable.
       Examples of blocks:
         - reward_engine.combo_reward_block
         - reward_engine.matrix_reward_block
         - reward_engine.conditional_reward_block
         - proof_engine.social_proof_block
         - time_window_engine.*
         - loyalty_engine.exchange_block
       Do not leave any child field as not_stated in such blocks.

    C. Shape Exclusivity
       If one reward structure is used:
         - All alternative reward structures MUST be not_applicable.
       Example:
         If flat/tier reward is used:
           combo, matrix, conditional, event reward structures → not_applicable.

    D. Consistency Check (MANDATORY)
       Before finalizing output:
         - Scan for any field marked not_stated.
         - Ask: "Is this field actually irrelevant?"
         - If YES → convert to not_applicable.

    E. No Partial Applicability
       Do not mix:
         - parent = not_applicable
         - child  = not_stated
       This is invalid. All related fields must be consistent.

    This is NOT template logic.
    This is structural consistency of the JSON.

5. STATE (F1 §1).
   readiness_engine.state_block.state = "draft" (default — server akan stamp).

6. ENUM STRICT (F3).
   - Gunakan HANYA value yang ada di enum spec di tool schema.
   - Ragu → kosongkan ("" / null) dan beri _field_status="not_stated".
   - Naming convention:
     * System values  → snake_case (mis. "deposit_bonus")
     * Bank/eWallet/Pulsa providers → UPPERCASE (mis. "BCA", "DANA")
     * Game providers → Title Case (mis. "Pragmatic Play")
   - Timezone WAJIB IANA: "Asia/Jakarta" | "Asia/Makassar" | "Asia/Jayapura".
     JANGAN "WIB"/"WITA"/"WIT" — itu alias legacy DI-REJECT.

7. AUTHORITY ORDER (F2 ATURAN KEBENARAN DATA).
   Truth structural ada di mechanics_engine.items[]. Field flat di reward_engine
   adalah display summary saja. Kalau ada conflict, mechanics_engine menang.

8. PROJECTION ENGINE (F1 §projection).
   JANGAN isi projection_engine — ini DERIVED only. Biarkan blank.
   (Server akan generate post-extraction.)

ENGINE WAJIB DIISI (jika ada konten):

A. identity_engine.client_block
   - client_id: slug client dari URL/brand mark/header (mis. "slot25", "haberaja").
     Kosong → "" + _field_status="not_stated".
   - client_id_field_status: "explicit" | "inferred" | "propagated" (F3 §1.1).
   - client_name: nama brand sebagaimana ditulis sumber.

B. identity_engine.promo_block
   - promo_name (verbatim dari sumber)
   - promo_type ∈ enum F3 §1.1 (welcome_bonus, deposit_bonus, cashback, ...)
   - target_user ∈ { new_member | existing_member | vip | all_member }
   - promo_mode ∈ { single | multi }

C. classification_engine
   - result_block.program_classification ∈ { A | B | C }
     * A = Reward Program, B = Event Program, C = System Rule
   - question_block.q1..q4 .answer ∈ { "ya" | "tidak" } HURUF KECIL.
     JANGAN "Yes"/"No"/"Iya"/"Tidak" (kapital).

D. mechanics_engine.items[] — STRUKTURAL TRUTH (F2 authority #1).
   WAJIB pecah promo jadi unit-unit semantik:
     * 1 item per trigger event
     * 1 item per eligibility/syarat
     * 1 item per calculation (rumus, persen, basis)
     * 1 item per reward (bentuk hadiah)
     * 1 item per distribution (kapan/cara dikirim)
     * 1 item per control (anti-stack, anti-fraud rule umum)
     * 1 item per invalidator (kondisi pembatalan, void)
   Setiap item HARUS punya:
     - mechanic_id: format "m_<type>_<idx>" (mis. "m_trigger_1")
     - mechanic_type ∈ enum F3 §1.18
     - evidence: kutipan persis dari sumber (atau "" kalau tidak ada)
     - confidence: 0.0–1.0
     - ambiguity: boolean
     - ambiguity_reason: string atau null
     - activation_rule: object kondisi atau null. JANGAN {} kosong.
     - data: object detail per type. JANGAN {} kosong — kalau benar-benar
       tidak ada data spesifik, JANGAN buat itemnya sama sekali.

   Contoh data per mechanic_type:
     trigger      → { trigger_event, period_type?, calculation_window?, calculation_basis? }
     eligibility  → { user_segment, min_threshold?, threshold_unit?, currency? }
     calculation  → { calculation_basis, calculation_method, percentage?, max_reward?, currency? }
     reward       → { reward_type, reward_form?, reward_unit?, voucher_kind? }
     distribution → { distribution_method, distribution_day?, distribution_window?, auto_credit? }
     control      → { control_type, stacking_policy?, max_concurrent? }
     invalidator  → { void_trigger, void_action, penalty_scope }

E. reward_engine FLAT FIELDS (display summary, F2 authority #4).
   - calculation_basis, calculation_method, calculation_value, calculation_unit
   - payout_direction (upfront | backend)
   - reward_type, voucher_kind, max_reward, currency
   Truth tetap di mechanics_engine — flat field di sini hanya ringkasan utama.

F. trigger_engine.primary_trigger_block
   - trigger_event ∈ enum F3 §1.6
   - action: deskripsi singkat aksi user
   - evidence: kutipan dari sumber

G. claim_engine
   - method_block.claim_method ∈ enum F3 §1.7
   - channels_block.channels[] ∈ enum F3 §1.7
   - proof_requirement_block (proof_required, proof_types[], proof_destinations[])

H. scope_engine
   - game_block.game_domain ∈ enum F3 §1.10
   - game_block.eligible_providers[] ∈ enum F3 §1.10 (Title Case)
   - platform_block.platform_access, geo_block.geo_restriction

I. period_engine, time_window_engine — kalau ada di sumber, isi. Kalau tidak,
   biarkan blank dan _field_status="not_stated".

J. reasoning_engine.intent_block
   - primary_action ∈ enum F3 §1.17
   - reward_nature, distribution_path, value_shape
   Reasoning tips:
     * "Cashback"   → primary_action: lose_to_cashback, payout_direction: backend
     * "Bonus Depo" → primary_action: deposit_to_bonus, payout_direction: upfront
     * "Rollingan"  → primary_action: bet_to_rollingan, payout_direction: backend
     * "Referral"   → primary_action: refer_to_commission

K. ai_confidence MAP (WAJIB minimal 10 path penting).
   Format: { "engine.block.field": 0.85, ... }
   Path-path penting yang biasanya dinilai:
     identity_engine.promo_block.promo_name
     identity_engine.promo_block.promo_type
     identity_engine.promo_block.target_user
     identity_engine.promo_block.promo_mode
     identity_engine.client_block.client_id
     reward_engine.calculation_basis
     reward_engine.calculation_value
     reward_engine.payout_direction
     reward_engine.reward_type
     trigger_engine.primary_trigger_block.trigger_event
     claim_engine.method_block.claim_method
     scope_engine.game_block.game_domain
     period_engine.validity_block.valid_from
     period_engine.validity_block.valid_until

L. _field_status MAP (WAJIB).
   Format: { "engine.block.field": "explicit" | "inferred" | "not_applicable" | ... }
   - WAJIB isi minimal 10 path utama (lihat list di section K).
   - WAJIB isi SEMUA path yang Anda nilai "not_applicable" via decision tree §4.1.
     Ini krusial: server tidak bisa menebak applicability — hanya LLM yang tahu.
   - Path yang tidak Anda sebut akan dihitung server sebagai "not_stated" (default).
     Maka untuk field tidak relevan, WAJIB sebut eksplisit dengan "not_applicable".

M. MECHANICS DATA SHAPE DOCTRINE (Step 5D — Step 6.1 prompt-only).
   Aturan tambahan untuk isi 'data' blob di mechanics_engine.items[].
   Tool schema BELUM di-tighten — 'data' masih open (additionalProperties),
   jadi field di bawah ini DIIZINKAN dan AKAN diabsorb tanpa rejection.
   Aturan ini ADDITIVE: tidak menggantikan contoh data per mechanic_type
   di section D — ia memperkaya bentuk untuk dua tipe spesifik.

   M.1  mechanic_type = "reward"
        Selain field dasar (reward_type, reward_form, reward_unit,
        voucher_kind), tambahkan SUB-OBJECT berikut bila evidence ada:

        data.external_system = {
          system: <PK_V10_EXTERNAL_SYSTEM>,
                  // "spin_engine" | "voucher_system" | "reward_catalog"
                  // | "manual_ops" | "none"
          ref_id: <string>,            // handle di sistem itu (mis. "LS-001",
                                       // "VCH-CASHBACK-25"). "" kalau tidak ada.
          redemption_method: <PK_V10_REDEMPTION_METHOD>
                  // "auto" | "manual" | "claim_required"
        }

        Aturan:
        - system === "none" ↔ tidak ada sistem eksternal yang gating reward
          (mis. cash payout langsung). Untuk kasus ini ref_id = "".
        - Boleh diomit seluruh sub-object kalau memang reward trivial cash
          tanpa ref eksternal. JANGAN tulis {} kosong.
        - JANGAN tebak system. Ragu → omit, set ai_confidence rendah pada
          path mechanics_engine yang relevan.

        data.execution = {
          max_per_day: <number | null>,
          max_per_period: <number | null>,
          consumption: <string>          // mis. "single_use", "multi_use"
        }

        Aturan:
        - Hanya isi field yang explicit di sumber. Sisanya null / omit.
        - JANGAN duplikasi nilai ini ke reward_engine flat — flat hanya
          ringkasan utama; truth ada di sini.

        data.reward_form  [Step 6.3 — DETERMINISTIC ENUM]
          WAJIB salah satu dari PK_V10_REWARD_FORM:
            "spin_token"     → lucky spin / putaran berhadiah
            "voucher_code"   → voucher / kupon redeemable
            "cashback"       → cashback / pengembalian kekalahan
            "physical_item"  → hadiah fisik / merchandise
            "freespin_token" → free spin slot
            "credit_game"    → kredit game / saldo bonus game
            "mystery_reward" → hadiah acak / mystery box

          Aturan KERAS:
          - DILARANG membuat nilai baru di luar enum.
            Contoh SALAH: "lucky_spin", "spin", "spin_ticket", "voucher",
            "kupon", "freespin", "merchandise", "cash", "credit".
            Contoh BENAR: "spin_token", "voucher_code", "freespin_token".
          - Mapping wajib: lucky spin → "spin_token" (BUKAN "lucky_spin").
          - Jika ragu / tidak yakin → OMIT field. JANGAN isi bebas.
          - Tool schema akan reject nilai di luar enum.

   M.2  mechanic_type = "time_window"
        Item ini adalah SUMBER TUNGGAL untuk semantik validity di luar
        period_engine.validity_block. Bentuk:

        data.scope = <PK_V10_TIME_WINDOW_SCOPE>
                  // "reward_validity" | "claim_window" | "promo_period"
                  //   | "trigger_window" | "calculation_window"

        data.validity = {
          validity_mode: <PK_V10_VALIDITY_MODE>,   // "absolute" | "relative"
          valid_until: <ISO date string | null>,
          duration: <number | null>,
          duration_unit: <PK_V10_VALIDITY_DURATION_UNIT | null>
        }

        Aturan:
        - Boleh ada >1 item time_window dalam satu record dengan scope berbeda
          (mis. satu untuk reward_validity spin, satu untuk claim_window).
        - JANGAN duplikasi promo_period ke sini kalau period_engine sudah
          mengikatnya — gunakan scope="promo_period" hanya jika sumber
          eksplisit memisahkan window promo dari validity_block.

   M.3  CARRY-OVER ke Step 6.2 (JANGAN populate sekarang).
        Field-field berikut sudah masuk schema TS PkV10Record tapi tool
        schema Anthropic BELUM dibuka (additionalProperties: false di
        sub-engine terkait). Mengisi sekarang akan kena schema rejection.
        Aturan reasoning-nya tetap dicatat di sini supaya doctrine align,
        tapi extractor TIDAK BOLEH menulis field-field ini di Step 6.1:

        - reward_engine.reward_identity_block
            [CARRIES OVER TO STEP 6.2]
            Hanya untuk reward_type === "physical".
            Bentuk: { item_name: <string|null>, quantity: <number|null> }.
            Untuk reward_type lain (cashback, lucky_spin, voucher, dll)
            block ini WAJIB null. Detail item lucky-spin / voucher / dll
            TIDAK boleh masuk ke sini — mereka pergi ke
            mechanics_engine.items[] (reward + external_system).

        - reward_engine.max_reward_unlimited
            [CARRIES OVER TO STEP 6.2]
            true HANYA jika sumber EKSPLISIT menyatakan tidak ada batas
            atas reward DAN ada evidence string yang mendukung. Tidak ada
            keyword/regex detection. Default false. Saat true, max_reward
            harus null.

        - period_engine.validity_block.valid_until_unlimited
            [CARRIES OVER TO STEP 6.2]
            true HANYA jika sumber EKSPLISIT menyatakan promo berlaku
            tanpa batas waktu (mis. "berlaku selamanya"). Default false.
            Saat true, valid_until harus null.

        Catatan implementasi:
        - Step 6.1 = validasi reasoning Claude pada data blob mechanics.
        - Step 6.2 = tool schema additive untuk 3 field carry-over di atas.
        - Step 6B = validator enforcement (max_reward_unlimited ↔ max_reward
          null, valid_until_unlimited ↔ valid_until null, identity_block
          hanya bila reward_type=physical).

OUTPUT
Panggil tool '${TOOL_NAME}' dengan input PkV10Record (boleh partial — server
akan merge ke inert full-shape). JANGAN balas teks. JANGAN mark-down.`;

// ============================================================
// TOOL SCHEMA — built from shared enum constants
// ============================================================
type JSONSchema = AnyObj;

const enumStr = (key: keyof typeof ENUMS, allowEmpty = true): JSONSchema =>
  allowEmpty
    ? { type: "string", enum: ["", ...(ENUMS[key] as string[])] }
    : { type: "string", enum: [...(ENUMS[key] as string[])] };

const enumStrNullable = (key: keyof typeof ENUMS): JSONSchema => ({
  type: ["string", "null"],
  enum: [null, "", ...(ENUMS[key] as string[])],
});

const enumStrArray = (key: keyof typeof ENUMS): JSONSchema => ({
  type: "array",
  items: { type: "string", enum: [...(ENUMS[key] as string[])] },
});

function buildExtractorToolSchema(): AnyObj {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      identity_engine: {
        type: "object", additionalProperties: false,
        properties: {
          client_block: {
            type: "object", additionalProperties: false,
            properties: {
              client_id: { type: "string" },
              client_id_field_status: enumStr("client_id_field_status"),
              client_name: { type: "string" },
            },
          },
          promo_block: {
            type: "object", additionalProperties: false,
            properties: {
              promo_name: { type: "string" },
              promo_type: enumStr("promo_type"),
              target_user: enumStr("target_user"),
              promo_mode: enumStr("promo_mode"),
            },
          },
        },
      },
      classification_engine: {
        type: "object", additionalProperties: false,
        properties: {
          result_block: {
            type: "object", additionalProperties: false,
            properties: {
              program_classification: enumStr("program_classification"),
              secondary_classifications: { type: "array", items: { type: "string" } },
              review_confidence: enumStr("review_confidence"),
            },
          },
          question_block: {
            type: "object", additionalProperties: false,
            properties: {
              q1: questionShape(), q2: questionShape(),
              q3: questionShape(), q4: questionShape(),
            },
          },
          meta_block: {
            type: "object", additionalProperties: false,
            properties: {
              quality_flags: enumStrArray("quality_flag"),
              evidence_count: { type: "integer", minimum: 0 },
              override: { type: "boolean" },
              latency_ms: { type: ["integer", "null"] },
            },
          },
        },
      },
      taxonomy_engine: {
        type: "object", additionalProperties: false,
        properties: {
          mode_block: {
            type: "object", additionalProperties: false,
            properties: {
              mode: enumStr("taxonomy_mode"),
              tier_archetype: enumStrNullable("tier_archetype"),
            },
          },
          logic_block: {
            type: "object", additionalProperties: false,
            properties: {
              conversion_formula: { type: "string" },
              turnover_basis: enumStrNullable("turnover_basis"),
            },
          },
        },
      },
      period_engine: {
        type: "object", additionalProperties: false,
        properties: {
          validity_block: {
            type: "object", additionalProperties: false,
            properties: {
              valid_from: { type: ["string", "null"] },
              valid_until: { type: ["string", "null"] },
              validity_mode: enumStr("validity_mode"),
              validity_duration_value: { type: ["number", "null"] },
              validity_duration_unit: enumStr("validity_duration_unit"),
              // Step 6.2 additive — Step 5B unlimited sibling for valid_until.
              // true ⇒ valid_until MUST be null. Validator enforcement = Step 6B.
              valid_until_unlimited: { type: "boolean" },
            },
          },
          distribution_block: {
            type: "object", additionalProperties: false,
            properties: {
              claim_frequency: enumStr("claim_frequency"),
              calculation_period: { type: "string" },
              distribution_day: enumStr("distribution_day"),
            },
          },
        },
      },
      time_window_engine: {
        type: "object", additionalProperties: false,
        properties: {
          timezone_block: {
            type: "object", additionalProperties: false,
            properties: {
              timezone: enumStr("timezone"),
              offset: enumStr("offset"),
            },
          },
          claim_window_block: timeWindowSlotShape(),
          distribution_window_block: timeWindowSlotShape(),
          reset_block: {
            type: "object", additionalProperties: false,
            properties: {
              enabled: { type: "boolean" },
              reset_time: { type: "string" },
              reset_frequency: enumStr("reset_frequency"),
            },
          },
        },
      },
      trigger_engine: {
        type: "object", additionalProperties: false,
        properties: {
          primary_trigger_block: {
            type: "object", additionalProperties: false,
            properties: {
              trigger_event: enumStr("trigger_event"),
              action: { type: "string" },
              evidence: { type: "string" },
            },
          },
          trigger_rule_block: {
            type: "object", additionalProperties: false,
            properties: {
              rule_type: { type: "string" },
              conditions: { type: "array", items: triggerConditionShape() },
              logic_operator: enumStr("logic_operator"),
            },
          },
          alternative_triggers_block: {
            type: "object", additionalProperties: false,
            properties: {
              or_conditions: { type: "array", items: triggerConditionShape() },
              and_conditions: { type: "array", items: triggerConditionShape() },
            },
          },
        },
      },
      claim_engine: {
        type: "object", additionalProperties: false,
        properties: {
          method_block: {
            type: "object", additionalProperties: false,
            properties: {
              claim_method: enumStr("claim_method"),
              auto_credit: { type: "boolean" },
            },
          },
          channels_block: {
            type: "object", additionalProperties: false,
            properties: {
              channels: enumStrArray("channel"),
              priority_order: { type: "array", items: { type: "string" } },
            },
          },
          proof_requirement_block: {
            type: "object", additionalProperties: false,
            properties: {
              proof_required: { type: "boolean" },
              proof_types: enumStrArray("proof_type"),
              proof_destinations: enumStrArray("proof_destination"),
            },
          },
          instruction_block: {
            type: "object", additionalProperties: false,
            properties: {
              claim_steps: { type: "array", items: { type: "string" } },
              claim_url: { type: "string" },
            },
          },
        },
      },
      proof_engine: {
        type: "object", additionalProperties: false,
        properties: {
          social_proof_block: {
            type: "object", additionalProperties: false,
            properties: {
              platforms: { type: "array", items: { type: "string" } },
              hashtags: { type: "array", items: { type: "string" } },
              content_requirements: { type: "array", items: { type: "string" } },
            },
          },
          screenshot_proof_block: {
            type: "object", additionalProperties: false,
            properties: {
              ss_targets: { type: "array", items: { type: "string" } },
              rules: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
      payment_engine: {
        type: "object", additionalProperties: false,
        properties: {
          deposit_block: {
            type: "object", additionalProperties: false,
            properties: {
              deposit_method: enumStr("deposit_method"),
              deposit_rate: { type: ["number", "null"] },
            },
          },
          method_whitelist_block: providersBlockShape(),
          method_blacklist_block: providersBlockShape(),
        },
      },
      scope_engine: {
        type: "object", additionalProperties: false,
        properties: {
          game_block: {
            type: "object", additionalProperties: false,
            properties: {
              game_domain: enumStr("game_domain"),
              markets: { type: "array", items: { type: "string" } },
              eligible_providers: enumStrArray("game_provider"),
            },
          },
          platform_block: {
            type: "object", additionalProperties: false,
            properties: {
              platform_access: enumStr("platform_access"),
              apk_required: { type: "boolean" },
            },
          },
          geo_block: {
            type: "object", additionalProperties: false,
            properties: {
              geo_restriction: enumStr("geo_restriction"),
            },
          },
          blacklist_block: {
            type: "object", additionalProperties: false,
            properties: {
              types: { type: "array", items: { type: "string" } },
              providers: { type: "array", items: { type: "string" } },
              games: { type: "array", items: { type: "string" } },
              rules: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
      reward_engine: {
        type: "object", additionalProperties: false,
        properties: {
          event_block: {
            type: "object", additionalProperties: false,
            properties: {
              event_rewards: { type: "array", items: { type: "object", additionalProperties: true } },
              prizes: { type: "array", items: { type: "object", additionalProperties: true } },
            },
          },
          requirement_block: {
            type: "object", additionalProperties: false,
            properties: {
              min_deposit: { type: ["number", "null"] },
              unlock_conditions: { type: "array", items: { type: "object", additionalProperties: true } },
            },
          },
          combo_reward_block: {
            type: "object", additionalProperties: false,
            properties: {
              combo_items: { type: "array", items: { type: "object", additionalProperties: true } },
            },
          },
          matrix_reward_block: {
            type: "object", additionalProperties: false,
            properties: {
              axis_x_label: { type: "string" },
              axis_y_label: { type: "string" },
              matrix_cells: { type: "array", items: { type: "object", additionalProperties: true } },
            },
          },
          conditional_reward_block: {
            type: "object", additionalProperties: false,
            properties: {
              conditions: { type: "array", items: { type: "object", additionalProperties: true } },
              default_reward: { type: ["object", "null"], additionalProperties: true },
            },
          },
          calculation_basis: enumStr("calculation_basis"),
          calculation_method: enumStr("calculation_method"),
          calculation_value: { type: ["number", "null"] },
          calculation_unit: enumStr("calculation_unit"),
          payout_direction: enumStr("payout_direction"),
          reward_type: enumStr("reward_type"),
          voucher_kind: enumStrNullable("voucher_kind"),
          max_reward: { type: ["number", "null"] },
          currency: { type: ["string", "null"] },
          // Step 6.2 additive — Step 5B unlimited sibling for max_reward.
          // true ⇒ max_reward MUST be null. Validator enforcement = Step 6B.
          max_reward_unlimited: { type: "boolean" },
          // Step 6.2 additive — Step 4F-tris reward_identity_block.
          // STRICT BOUNDARY: only populated when reward_type = "physical".
          // For all other reward_type values, both fields MUST be null.
          // Validator enforcement = Step 6B.
          reward_identity_block: {
            type: "object", additionalProperties: false,
            properties: {
              item_name: { type: ["string", "null"] },
              quantity: { type: ["number", "null"] },
            },
          },
        },
      },
      loyalty_engine: {
        type: "object", additionalProperties: false,
        properties: {
          mechanism_block: {
            type: "object", additionalProperties: false,
            properties: {
              point_name: enumStr("point_name"),
              earning_rule: { type: "string" },
              loyalty_mode: enumStr("loyalty_mode"),
            },
          },
          exchange_block: {
            type: "object", additionalProperties: false,
            properties: {
              exchange_groups: { type: "array", items: { type: "object", additionalProperties: true } },
            },
          },
          tier_block: {
            type: "object", additionalProperties: false,
            properties: {
              tier_system: { type: "array", items: { type: "object", additionalProperties: true } },
            },
          },
        },
      },
      variant_engine: {
        type: "object", additionalProperties: false,
        properties: {
          summary_block: {
            type: "object", additionalProperties: false,
            properties: {
              has_subcategories: { type: "boolean" },
              expected_count: { type: ["integer", "null"] },
            },
          },
          items_block: {
            type: "object", additionalProperties: false,
            properties: {
              subcategories: { type: "array", items: { type: "object", additionalProperties: true } },
            },
          },
        },
      },
      dependency_engine: {
        type: "object", additionalProperties: false,
        properties: {
          exclusion_block: {
            type: "object", additionalProperties: false,
            properties: {
              mutually_exclusive_with: { type: "array", items: { type: "string" } },
              can_combine_with: { type: "array", items: { type: "string" } },
            },
          },
          stacking_block: {
            type: "object", additionalProperties: false,
            properties: {
              stacking_allowed: { type: "boolean" },
              stacking_policy: enumStr("stacking_policy"),
              rules: { type: "array", items: { type: "string" } },
              max_concurrent: { type: ["integer", "null"], minimum: 1 },
            },
          },
          prerequisite_block: {
            type: "object", additionalProperties: false,
            properties: {
              requires_promo: { type: "array", items: { type: "string" } },
              requires_achievement: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
      invalidation_engine: {
        type: "object", additionalProperties: false,
        properties: {
          void_conditions_block: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: true,
              properties: {
                trigger_type: enumStr("invalidator_trigger_type"),
                trigger: enumStr("void_trigger"),
                description: { type: "string" },
              },
            },
          },
          penalty_block: {
            type: "object", additionalProperties: false,
            properties: {
              void_action: enumStr("void_action"),
              penalty_type: enumStr("penalty_type"),
              penalty_scope: enumStr("penalty_scope"),
            },
          },
          anti_fraud_block: {
            type: "object", additionalProperties: false,
            properties: {
              anti_fraud_rules: { type: "array", items: { type: "string" } },
              detection_methods: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
      terms_engine: {
        type: "object", additionalProperties: false,
        properties: {
          conditions_block: {
            type: "object", additionalProperties: false,
            properties: {
              terms_conditions: { type: "array", items: { type: "string" } },
            },
          },
          requirements_block: {
            type: "object", additionalProperties: false,
            properties: {
              special_requirements: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
      readiness_engine: {
        type: "object", additionalProperties: false,
        properties: {
          state_block: {
            type: "object", additionalProperties: false,
            properties: {
              state: enumStr("readiness_state"),
              state_changed_at: { type: "string" },
              state_changed_by: { type: "string" },
            },
          },
          commit_block: {
            type: "object", additionalProperties: false,
            properties: { ready_to_commit: { type: "boolean" } },
          },
          validation_block: {
            type: "object", additionalProperties: false,
            properties: {
              is_structurally_complete: { type: "boolean" },
              status: enumStr("validation_status"),
              warnings: { type: "array", items: { type: "string" } },
            },
          },
          observability_block: {
            type: "object", additionalProperties: false,
            properties: {
              ambiguity_flags: { type: "array", items: { type: "string" } },
              contradiction_flags: { type: "array", items: { type: "string" } },
              review_required: { type: "boolean" },
            },
          },
        },
      },
      reasoning_engine: {
        type: "object", additionalProperties: false,
        properties: {
          intent_block: {
            type: "object", additionalProperties: false,
            properties: {
              primary_action: enumStr("primary_action"),
              reward_nature: enumStr("reward_nature"),
              distribution_path: enumStr("distribution_path"),
              value_shape: enumStr("value_shape"),
            },
          },
          selection_block: {
            type: "object", additionalProperties: false,
            properties: {
              mechanic_type: enumStr("mechanic_type"),
              locked_fields: { type: "array", items: { type: "string" } },
              invariant_violations: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
      mechanics_engine: {
        type: "object", additionalProperties: false,
        properties: {
          source_block: {
            type: "object", additionalProperties: false,
            properties: { source: enumStr("mechanics_source") },
          },
          items_block: {
            type: "object", additionalProperties: false,
            properties: {
              items: {
                type: "array",
                items: mechanicItemShape(),
              },
            },
          },
        },
      },
      risk_engine: {
        type: "object", additionalProperties: false,
        properties: {
          level_block: {
            type: "object", additionalProperties: false,
            properties: { promo_risk_level: enumStr("risk_level") },
          },
        },
      },
      meta_engine: {
        type: "object", additionalProperties: false,
        properties: {
          source_block: {
            type: "object", additionalProperties: false,
            properties: {
              source_url: { type: "string" },
              raw_content: { type: "string" },
              extraction_source: enumStr("extraction_source"),
              source_type: enumStr("source_type"),
            },
          },
          extraction_block: {
            type: "object", additionalProperties: false,
            properties: {
              has_rowspan_tables: { type: "boolean" },
              html_was_normalized: { type: "boolean" },
              client_id_source: enumStrNullable("client_id_field_status"),
              propagated_fields: { type: "array", items: { type: "string" } },
              ambiguous_blacklists: { type: "integer", minimum: 0 },
              classification_overridden: { type: "boolean" },
              classification_override_reason: { type: "string" },
              original_llm_category: { type: "string" },
            },
          },
        },
      },
      ai_confidence: {
        type: "object",
        description: "Map field path → 0..1. WAJIB minimal 10 path penting.",
        additionalProperties: { type: "number", minimum: 0, maximum: 1 },
      },
      _field_status: {
        type: "object",
        description: "Map field path → field_status enum. WAJIB minimal 10 path.",
        additionalProperties: enumStr("field_status", false),
      },
    },
  };
}

function questionShape(): JSONSchema {
  return {
    type: "object", additionalProperties: false,
    properties: {
      answer: { type: "string", enum: ["", "ya", "tidak"] },
      reasoning: { type: "string" },
      evidence: { type: "string" },
    },
  };
}

function timeWindowSlotShape(): JSONSchema {
  return {
    type: "object", additionalProperties: false,
    properties: {
      enabled: { type: "boolean" },
      start_time: { type: "string" },
      end_time: { type: "string" },
      days: enumStrArray("distribution_day"),
    },
  };
}

function triggerConditionShape(): JSONSchema {
  return {
    type: "object", additionalProperties: true,
    properties: {
      field: { type: "string" },
      operator: enumStr("condition_operator"),
      value: { type: ["string", "number", "null"] },
      currency: { type: "string" },
    },
  };
}

function providersBlockShape(): JSONSchema {
  return {
    type: "object", additionalProperties: false,
    properties: {
      methods: { type: "array", items: { type: "string" } },
      providers: { type: "array", items: { type: "string" } },
    },
  };
}

function mechanicItemShape(): JSONSchema {
  return {
    type: "object", additionalProperties: false,
    properties: {
      mechanic_id: { type: "string" },
      mechanic_type: enumStr("mechanic_type", false),
      evidence: { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      ambiguity: { type: "boolean" },
      ambiguity_reason: { type: ["string", "null"] },
      activation_rule: { type: ["object", "null"], additionalProperties: true },
      // Step 6.3 — narrow `reward_form` to PK_V10_REWARD_FORM enum.
      // `data` stays open (additionalProperties: true) so other shape fields
      // (external_system, execution, validity, scope, etc.) remain free,
      // but `reward_form`, when present, MUST match the locked vocabulary.
      data: {
        type: "object",
        additionalProperties: true,
        properties: {
          reward_form: {
            type: "string",
            enum: [...(ENUMS.reward_form as string[])],
          },
        },
      },
    },
  };
}

// ============================================================
// HELPERS
// ============================================================
const _o = (v: unknown): AnyObj => (v && typeof v === "object" ? (v as AnyObj) : {});
const _s = (v: unknown): string => (typeof v === "string" ? v : "");
const _a = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function toAnthropicImage(img: string): AnyObj | null {
  if (!img) return null;
  const trimmed = img.trim();
  if (trimmed.startsWith("data:")) {
    const m = trimmed.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return null;
    return {
      type: "image",
      source: { type: "base64", media_type: m[1], data: m[2] },
    };
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return { type: "image", source: { type: "url", url: trimmed } };
  }
  return {
    type: "image",
    source: { type: "base64", media_type: "image/png", data: trimmed },
  };
}

// ============================================================
// HANDLER
// ============================================================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured");
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
    const clientIdHint: string =
      typeof body.client_id_hint === "string" ? body.client_id_hint.trim() : "";

    if (!text && images.length === 0) {
      return new Response(
        JSON.stringify({
          error: "EMPTY_INPUT",
          message: "Minimal salah satu: text atau images harus diisi",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build user content (image-first, then text)
    const userContent: Array<Record<string, unknown>> = [];
    const contextParts: string[] = [];
    if (text) contextParts.push(`KONTEN PROMO (TEKS):\n\n${text}`);
    if (images.length > 0) {
      contextParts.push(
        `KONTEN PROMO (GAMBAR): ${images.length} gambar disertakan. Baca konten visual: judul, persentase, nominal, syarat, badge, dan elemen UI promo.`,
      );
    }
    if (clientIdHint) {
      contextParts.push(`CLIENT_ID HINT (dari caller): "${clientIdHint}". Pakai sebagai propagated default jika tidak ada di sumber, dan tandai client_id_field_status="propagated".`);
    }
    contextParts.push(
      `\nINSTRUKSI: Ekstrak ke PkV10Record via tool '${TOOL_NAME}'. WAJIB panggil tool — JANGAN balas teks. Hybrid mode: text + image saling melengkapi.`,
    );

    for (const img of images) {
      const block = toAnthropicImage(img);
      if (block) userContent.push(block);
    }
    userContent.push({ type: "text", text: contextParts.join("\n\n") });

    // Build proxy request
    const tool = {
      name: TOOL_NAME,
      description: "Ekstrak konten promo ke PKB_Wolfbrain V.10 (PkV10Record).",
      input_schema: buildExtractorToolSchema(),
    };

    const proxyBody = {
      type: AI_PROXY_TYPE,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
      tools: [tool],
      tool_choice: { type: "tool", name: TOOL_NAME },
      temperature: 0.1,
    };

    const startedAt = Date.now();
    const aiResp = await fetch(`${SUPABASE_URL}/functions/v1/ai-proxy`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(proxyBody),
    });
    const latencyMs = Date.now() - startedAt;

    if (!aiResp.ok) {
      const errText = await aiResp.text().catch(() => "");
      console.error("[pk-extractor V10] ai-proxy error:", aiResp.status, errText);
      let upstreamError: AnyObj = {};
      try { upstreamError = JSON.parse(errText); } catch { /* keep empty */ }

      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "PAYMENT_REQUIRED", message: _s(upstreamError.message) || "Anthropic credits habis." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "RATE_LIMITED", message: _s(upstreamError.message) || "Terlalu banyak request." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 503) {
        return new Response(
          JSON.stringify({ error: "OVERLOADED", message: _s(upstreamError.message) || "Anthropic overload." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error(`ai-proxy ${aiResp.status}: ${errText}`);
    }

    const aiData = await aiResp.json();
    const modelUsed = _s(aiData.model);
    const stopReason = _s(aiData.stop_reason);

    const contentArr = _a<AnyObj>(aiData.content);
    const toolUse = contentArr.find(
      (b) => _s(b.type) === "tool_use" && _s(b.name) === TOOL_NAME,
    );

    if (!toolUse) {
      const textReply = contentArr
        .filter((b) => _s(b.type) === "text")
        .map((b) => _s(b.text))
        .join("\n").slice(0, 2000);
      console.error("[pk-extractor V10] NO_TOOL_CALL — Claude reply:", textReply || "(empty)");
      return new Response(
        JSON.stringify({
          error: "NO_TOOL_CALL",
          message: "Claude reply tanpa tool_use.",
          raw_text: textReply,
          stop_reason: stopReason,
          model: modelUsed,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const llmInput: AnyObj =
      toolUse.input && typeof toolUse.input === "object"
        ? (toolUse.input as AnyObj)
        : {};

    if (Object.keys(llmInput).length === 0) {
      console.error("[pk-extractor V10] tool_use.input empty");
      return new Response(
        JSON.stringify({
          error: "INVALID_TOOL_ARGS",
          message: "Tool input kosong",
          stop_reason: stopReason,
          model: modelUsed,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ============================================================
    // SERVER MERGE: build full-shape PkV10Record
    // ============================================================
    let extraction_source = "plain_text";
    if (text && images.length > 0) extraction_source = "multimodal";
    else if (images.length > 0) extraction_source = "image";

    const now = new Date().toISOString();
    const inert = createInertPkV10Record(genId(), now);

    // Pre-fill server-authoritative blocks BEFORE merge so LLM can override
    // semantic fields but not stamps.
    const meta = inert.meta_engine as AnyObj;
    (meta.source_block as AnyObj).extraction_source = extraction_source;
    (meta.source_block as AnyObj).source_type =
      extraction_source === "image" || extraction_source === "multimodal"
        ? "image_upload"
        : "text_paste";
    (meta.extraction_block as AnyObj).extracted_at = now;

    // Apply propagated client_id from hint if LLM left it blank — handled
    // post-merge so LLM-supplied value (if any) wins.
    const merged = mergeIntoInert(inert, llmInput);

    // Stamp authoritative fields AFTER merge (LLM cannot override these).
    const mEngine = merged.meta_engine as AnyObj;
    (mEngine.source_block as AnyObj).source_url = "";
    (mEngine.source_block as AnyObj).raw_content = text.slice(0, 4000);
    (mEngine.extraction_block as AnyObj).extracted_at = now;
    mEngine.schema_block = (inert.meta_engine as AnyObj).schema_block;

    const cEngine = merged.classification_engine as AnyObj;
    (cEngine.meta_block as AnyObj).prompt_version = PK_V10_PROMPT_VERSION;
    (cEngine.meta_block as AnyObj).latency_ms = latencyMs;

    // Propagate client_id_hint if LLM didn't set client_id
    const idEngine = merged.identity_engine as AnyObj;
    const clientBlock = idEngine.client_block as AnyObj;
    if (clientIdHint && !_s(clientBlock.client_id)) {
      clientBlock.client_id = clientIdHint;
      clientBlock.client_id_field_status = "propagated";
    }

    // ============================================================
    // FIELD STATUS COMPUTATION
    // ============================================================
    const aiConfidence = (merged.ai_confidence as Record<string, number>) ?? {};
    const llmFieldStatus = (merged._field_status as Record<string, unknown>) ?? {};
    const fieldStatus = computeFieldStatus(
      merged,
      llmFieldStatus,
      aiConfidence,
      PK_V10_AI_CONFIDENCE_QUESTION_THRESHOLD,
    );
    merged._field_status = fieldStatus;

    console.log("[pk-extractor V10] OK", {
      model: modelUsed,
      stop_reason: stopReason,
      extraction_source,
      latency_ms: latencyMs,
      mechanics_items: _a(_o((merged.mechanics_engine as AnyObj).items_block).items).length,
      ai_confidence_keys: Object.keys(aiConfidence).length,
      field_status_keys: Object.keys(fieldStatus).length,
      schema_version: ((merged.meta_engine as AnyObj).schema_block as AnyObj).schema_version,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        model: modelUsed,
        extraction_source,
        record: merged,
        usage: aiData?.usage ?? null,
        latency_ms: latencyMs,
        stop_reason: stopReason,
        schema_version: "V.10",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[pk-extractor V10] Unhandled:", msg);
    return new Response(
      JSON.stringify({ error: "INTERNAL", message: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
