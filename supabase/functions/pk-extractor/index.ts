/**
 * pk-extractor — PKB_WOLFBRAIN V.10.1 NATIVE EXTRACTOR
 *
 * V10.1-only. Zero V.09 fallback. Zero conversion layer.
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
import { propagateNotApplicable } from "../_shared/pk-v10-propagator.ts";

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
const SYSTEM_PROMPT = `Anda adalah Wolfclaw Extractor V.10.1 — extractor PKB_Wolfbrain V.10.1.

TUGAS
Ekstrak konten promo (teks dan/atau gambar) ke struktur PkV10Record (V.10.1) via
tool '${TOOL_NAME}'. WAJIB panggil tool. JANGAN balas teks biasa.

PRINSIP UTAMA (F1 + F2 + F3 V.10.1):

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

================================================================
JSON STRUCTURE UNDERSTANDING (WAJIB — align WB_F2)
================================================================

Bagian ini mengikat. JANGAN sederhanakan struktur, JANGAN gabungkan
data berbeda, JANGAN buat interpretasi sendiri di luar struktur.

S1. GLOBAL vs VARIANT (INTI)
   Sebelum mengisi field, tanya:
     "Nilai ini berlaku untuk SELURUH promo, atau hanya sebagian paket?"
   - Berlaku semua  → isi field global.
   - Berbeda antar paket → JANGAN isi global. Simpan di
     variant_engine.items_block.subcategories (per variant).
   DILARANG: ambil nilai terbesar, ambil baris pertama, atau merge
   nilai berbeda jadi satu nilai global.

S2. VARIANT / MULTI-PACKAGE
   Jika promo berbentuk: tabel bonus, list paket, pilihan produk
   (slot/casino/sports), atau tier dengan aturan berbeda:
     → promo_mode = "multi"
     → setiap baris/paket = 1 variant
     → WAJIB simpan di variant_engine, JANGAN digabung.

S3. TABLE STRUCTURE
   Jika sumber berupa tabel: setiap row = 1 unit data.
   - Pertahankan struktur row-by-row.
   - Ambil semua field per row.
   DILARANG: flatten tabel, ringkas jadi summary, atau menghilangkan
   variasi antar row.

S4. EMPTY VALUE (SANGAT PENTING)
   Jika cell berisi "(kosong)", "-", atau cell kosong eksplisit:
     → field ADA, tapi nilainya kosong.
   Maka:
     - value = null / "" (sesuai tipe)
     - _field_status = "explicit"
     - ai_confidence tinggi
   DILARANG: ubah jadi not_stated, anggap missing, isi dari row lain,
   atau jadikan kandidat pertanyaan ke Admin.
   PRINSIP: "kosong" = data valid, bukan data hilang.

S5. GLOBAL FIELD RULE
   Field global hanya diisi jika nilainya SAMA untuk semua variant.
   Jika berbeda antar variant:
     - global field = null / "" / []
     - _field_status = "not_applicable" di level global
     - nilai sebenarnya hidup di variant-level.

S6. AUTHORITY (ringkas)
   Urutan kebenaran struktural:
     1. mechanics_engine.items[]    ← PALING UTAMA (structural truth)
     2. taxonomy_engine
     3. engine lain (trigger, claim, scope)
     4. reward_engine               ← HANYA summary/display
   JANGAN isi reward_engine tanpa data padanan di mechanics_engine.

S7. ANTI-HARDCODE
   DILARANG default tanpa evidence eksplisit untuk:
     currency, timezone, target_user, claim_method, payout_direction.
   Jika tidak jelas → kosongkan + _field_status = "not_stated".

S8. GAP RULE (singkat — selaras 4.1 di bawah)
   - relevan + tidak ada di sumber → not_stated (gap)
   - tidak relevan untuk promo ini → not_applicable
   - kosong eksplisit di sumber    → explicit (bukan gap)

PRINSIP AKHIR: satu promo bisa punya banyak aturan (per paket).
Extractor WAJIB menjaga struktur itu. JANGAN memaksa satu jawaban
untuk data yang berbeda.

================================================================

4.1 APPLICABILITY DECISION

    Before assigning any field value or field_status:

    Step 1 — Applicability
      Ask: "Does this field have a logical role in explaining this promotion?"

      If NO:
        - set _field_status[path] = "not_applicable"
        - leave value null or use the canonical neutral value
        - DO NOT mark as not_stated
        - STOP for this field

    Step 2 — Evidence
      If YES, classify evidence:
        - explicit:   directly stated
        - inferred:   logically derived
        - derived:    deterministic from other fields
        - propagated: from system/client context
        - not_stated: relevant but missing/ambiguous

    Core distinction:
      - not_applicable = field has no logical role
      - not_stated     = field is relevant but unknown

    DO NOT decide applicability from:
      - promo type labels
      - keyword matching
      - regex
      - templates
    Use semantic reasoning only.

4.2 APPLICABILITY CONSISTENCY CHECK (MANDATORY)

    After filling all fields:

    A. Coverage
       - Every relevant field MUST appear in _field_status.
       - Do not omit paths.

    B. Not Applicable Enforcement
       - If text implies absence of a requirement
         → all related fields MUST be not_applicable.

    C. Not Stated Discipline
       - Use only when relevant but unknown.
       - NEVER use for irrelevant fields.

    D. Consistency Sweep
       - If one field is not_applicable
         → check related fields for alignment.

    E. Confidence Rule
       - "inferred" MUST include ai_confidence.

    F. Final Self-Check
       Ask: "Did I incorrectly use not_stated instead of not_applicable?"
       Fix before output.

4.3 PROPAGATION CONSISTENCY (MANDATORY)

    After applicability decisions:

    A. Mirror Propagation
       If a canonical field is not_applicable:
         → all projection mirror fields MUST also be not_applicable.
       Example:
         taxonomy_engine.logic_block.turnover_basis = not_applicable
         → projection_engine.summary_block.turnover_basis      = not_applicable
         → projection_engine.summary_block.turnover_multiplier = not_applicable

    B. Block-Level Propagation (WITH ANCHOR — MANDATORY)
       If a block has no logical role:
         - Mark ALL child leaf fields as not_applicable.
         - ALSO mark the parent block path itself as not_applicable
           (MANDATORY ANCHOR — required for downstream propagation).
       Example:
         reward_engine.combo_reward_block.combo_items = not_applicable
         → reward_engine.combo_reward_block            = not_applicable
       INVALID state (do NOT produce):
         - parent missing from _field_status
         - children = not_applicable
       Both must be present and consistent.

    C. Shape Exclusivity
       If one structure is used:
         → all alternative empty structures MUST be not_applicable.
       ONLY if:
         - they have no content
         - they are not explicitly defined.

    D. No Partial Applicability
       Do NOT mix:
         - parent = not_applicable
         - child  = not_stated
       All related fields must be consistent.

    E. Final Sweep (MANDATORY)
       Before returning output, scan entire JSON and ensure no:
         - mirror mismatch
         - block inconsistency
         - partial applicability
       Fix BEFORE output.

    This is NOT template logic. This is structural consistency of the JSON.

FINAL ASSERTION (before output)
    Confirm:
      - All irrelevant fields are marked not_applicable
      - All relevant unknown fields are not_stated
      - All mirrors and blocks are consistent
      - No partial propagation exists
    If not, fix before returning.

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

9. ANOMALY REASONING (REASONING-FIRST — BUKAN PATTERN MATCHING).
   Selama membaca sumber, gunakan reasoning untuk mendeteksi 3 jenis
   anomali. JANGAN gunakan regex/keyword. JANGAN perbaiki data sumber.
   JANGAN menghapus tanpa jejak. Setiap anomali WAJIB tercatat.

   9.A KONTRADIKSI ANTAR BAGIAN (contradiction_flags)
       Jika terdapat konflik antar bagian promo (mis. tabel paket vs
       Syarat & Ketentuan, header vs body, gambar vs teks):
         - JANGAN diam-diam pilih salah satu.
         - JANGAN hapus salah satu sisi konflik.
         - Isi field utama dengan nilai yang PALING KONSISTEN secara
           keseluruhan dan memiliki evidence paling kuat.
         - WAJIB catat di readiness_engine.observability_block
           .contradiction_flags[] dengan deskripsi konflik yang jelas
           (sebut kedua sisi).
         - Jika konflik berdampak pada interpretasi promo:
           set readiness_engine.observability_block.review_required = true.

   9.B SOURCE CONTAMINATION / TEKS NYASAR (warnings)
       Jika ada potongan teks yang:
         - tidak konsisten dengan konteks utama promo, ATAU
         - menyebut mekanik/konsep promo lain (mis. "Level Up" muncul
           di tengah Welcome Bonus),
       maka:
         - JANGAN gunakan sebagai data utama / variant / mechanics.
         - JANGAN hapus tanpa jejak.
         - WAJIB catat di readiness_engine.validation_block.warnings[]
           (PATH WAJIB — bukan observability_block) dengan indikasi
           "kemungkinan source contamination" beserta kutipan singkat
           dari teks yang mencurigakan.

   9.C ANOMALI NILAI DALAM TABEL (ambiguity_flags)
       Jika nilai sel tidak sesuai tipe/konteks kolomnya
       (mis. nominal Rp pada kolom yang seharusnya berisi nama produk):
         - JANGAN koreksi sendiri.
         - JANGAN tebak nilai yang "seharusnya".
         - Simpan nilai apa adanya pada variant terkait.
         - WAJIB catat di readiness_engine.observability_block
           .ambiguity_flags[] dengan penjelasan kolom mana, variant mana,
            dan kenapa dianggap anomali.

    9.D EXTRACTION HARDENING — REASONING-ONLY (MANDATORY)

        PRINSIP GLOBAL:
          - Reasoning berbasis konteks, BUKAN keyword/regex match.
          - Jangan asumsi tanpa evidence.
          - Jika tidak jelas → tandai, jangan tebak.
          - System tidak menciptakan truth baru; hanya menyimpan & menandai.

        ────────────────────────────────────────────────────────────
        H1. PLACEHOLDER VS DATA NYATA
        ────────────────────────────────────────────────────────────
        Untuk setiap field, tanyakan:
          "Apakah nilai ini memberikan informasi operasional yang
           bisa digunakan?"

        - YA  → treat sebagai data nyata (explicit/inferred sesuai evidence).
        - TIDAK → treat sebagai placeholder.

        Contoh placeholder (ILUSTRASI, bukan trigger mekanis):
          tanda hubung tunggal, "N/A", "TBA", "TBD", "?", titik-titik,
          sel berisi spasi saja, "akan diumumkan", atau nilai yang
          tidak sesuai konteks kolom (mis. nominal Rp di kolom nama
          produk). Gunakan PENALARAN KONTEKSTUAL — JANGAN regex.

        H1-A. JIKA PLACEHOLDER TERDETEKSI (field DISEBUT tapi tidak bermakna):
          1) VALUE
             - value = null (atau "" untuk string).
             - _field_status[path] = "not_stated".
          2) CONFIDENCE
             - Turunkan ai_confidence[path] secara natural (rendah).
             - JANGAN pakai angka tetap; biarkan reasoning yang menentukan.
          3) AUDIT (WAJIB) — tulis ke ROOT sidecar _ambiguity_flags[]:
             {
               "path": "<field_path>",
               "reason": "Field disebut di sumber tetapi nilainya tidak
                          memberikan informasi operasional yang bermakna
                          (placeholder: '<token verbatim singkat>').
                          Perlu konfirmasi admin."
             }
             JANGAN tulis ke readiness_engine.validation_block.warnings.
             JANGAN tulis ke readiness_engine.observability_block.

        ────────────────────────────────────────────────────────────
        H2. UNLIMITED INTERPRETATION (GENERAL)
        ────────────────────────────────────────────────────────────
        Berlaku untuk SEMUA field dengan pasangan *_unlimited:
          - period_engine.validity_block.valid_until_unlimited
          - reward_engine.max_reward_unlimited
          - dan field sejenis.

        Hanya jika sumber EKSPLISIT menyatakan tanpa batas
        (mis. "tanpa batas", "no limit", "unlimited", "lifetime",
         "selamanya", "permanent", "no expiry"):
          - value utama = null
          - *_unlimited = true
          - _field_status[path *_unlimited] = "explicit"

        Jika TIDAK eksplisit:
          - JANGAN set *_unlimited = true.
          - Treat sebagai nilai normal atau placeholder (H1-A).

        Placeholder ("-", "N/A", kosong) BUKAN unlimited.

        ────────────────────────────────────────────────────────────
        H3. STACKING CONSISTENCY
        ────────────────────────────────────────────────────────────
        Jika sumber menyatakan promo tidak dapat digabung:
          - dependency_engine.stacking_block.stacking_policy = "no_stacking"
          - Jangan partial. Jangan infer jika tidak disebut.

        ────────────────────────────────────────────────────────────
        H4. REWARD SEMANTIC CONSISTENCY
        ────────────────────────────────────────────────────────────
        Pisahkan dengan jelas:
          - reward_type        → jenis (cash, spin, voucher, ...)
          - reward_form        → bentuk distribusi (balance_credit, credit_game, ...)
          - calculation_method → cara hitung (percentage, fixed, ...)
        Jangan pakai label perhitungan (mis. "cashback") sebagai reward_form.
        primary_action = aksi nyata user, bukan label marketing.

        ────────────────────────────────────────────────────────────
        H5. ANTI OVER-INFERENCE
        ────────────────────────────────────────────────────────────
        JANGAN isi tanpa evidence jelas:
          - timezone, claim_window detail, payout_direction,
            geo restriction, platform restriction.
        Tanpa evidence → kosongkan + _field_status sesuai
        (not_stated, atau inferred jika reasoning sangat kuat).

        ────────────────────────────────────────────────────────────
        H6. CHANNEL DISCIPLINE (KRITIS)
        ────────────────────────────────────────────────────────────
        A) PER-FIELD → ROOT sidecars:
           - _ambiguity_flags[]      → nilai tidak jelas / placeholder
           - _warnings[]             → anomali ringan (nilai tidak sesuai kolom)
           - _contradiction_flags[]  → konflik antar bagian teks
           Setiap entry WAJIB punya { "path": "...", "reason": "..." }.

        B) GLOBAL / STRUKTURAL → readiness_engine.validation_block.warnings
           (mis. source contamination, schema-level issue).

        JANGAN:
          - Taruh issue per-field di validation_block.warnings.
          - Duplikasi issue ke beberapa channel.
          - Simpan reasoning tanpa path.

        ────────────────────────────────────────────────────────────
        H7. FINAL CONSISTENCY CHECK
        ────────────────────────────────────────────────────────────
        Sebelum set readiness_engine.observability_block.review_required = false,
        WAJIB pastikan:
          - _ambiguity_flags kosong
          - _contradiction_flags kosong
          - tidak ada placeholder pada field penting
          - tidak ada nilai yang tidak bermakna
        Jika salah satu tidak terpenuhi → review_required = true.

        ────────────────────────────────────────────────────────────
        H8. PRINSIP AKHIR
        ────────────────────────────────────────────────────────────
        Jika nilai tidak memberi informasi operasional yang bisa
        dipakai: jangan menebak, jangan anggap aman, jangan anggap
        final. Tandai sebagai ambiguity dan serahkan ke admin.

        SEL KOSONG DALAM TABEL VARIANT:
          Sel yang memang kosong di kolom tabel variant (tanpa
          placeholder apa pun) = explicit empty untuk variant itu —
          bukan placeholder. Jangan ambiguity_flag kecuali header
          kolomnya sendiri placeholder.

     PRINSIP: jangan asumsi tanpa evidence; jangan perbaiki sumber;
     jangan hapus tanpa catatan; semua keputusan harus dapat dijelaskan.

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

================================================================
V.10.1 HARD RULES (HEADER vs VARIANT, FORBIDDEN FIELDS, PROJECTION)
================================================================

V10.1-R1. SINGLE vs MULTI (HEADER vs VARIANT — KERAS).
   Tentukan promo_mode lebih dulu (single | multi).

   - promo_mode = "single":
     * reward_engine = source of truth untuk nilai reward/calculation/payout.
     * variant_engine.summary_block.has_subcategories = false
     * variant_engine.summary_block.expected_count = 1 (atau null)
     * variant_engine.items_block.subcategories = []  ← WAJIB kosong.
     DILARANG bikin satu varian dummy hanya untuk merefleksikan reward_engine.

   - promo_mode = "multi":
     * variant_engine.items_block.subcategories[] = source of truth per-varian.
     * variant_engine.summary_block.has_subcategories = true
     * variant_engine.summary_block.expected_count = jumlah varian sebenarnya.
     * reward_engine HANYA untuk nilai shared/global yang BENAR-BENAR sama
       di SEMUA varian. Kalau berbeda antar varian → reward_engine field itu
       kosong + _field_status="not_applicable" di level global.
     * reward_engine TIDAK BOLEH override data per-varian.
     * Setiap subcategory WAJIB punya variant_id unik (mis. "v_1", "v_2", ...)
       dan variant_name verbatim dari sumber.

V10.1-R2. LEGACY FIELDS DILARANG (V.10.1 schema).
   JANGAN PERNAH menulis path/key berikut di output (sudah dihapus dari schema):
     - reward_engine.max_bonus           (gunakan reward_engine.max_reward)
     - reward_engine.bonus_percentage    (gunakan calculation_value+calculation_unit)
     - scope_engine.game_block.game_category   (gunakan game_domain)
     - scope_engine.game_block.game_providers  (gunakan eligible_providers)
     - scope_engine.game_block.game_exclusions (gunakan blacklist_block)
     - reward_engine.requirement_block.min_base (gunakan min_deposit)
     - reward_engine.payout_threshold
     - subcategories[].confidence
     - period_engine.validity_block.valid_from_unlimited
   Field-field tersebut akan di-strip server. Tetap JANGAN dikirim — itu noise.

V10.1-R3. PROJECTION ENGINE — DERIVED ONLY.
   Extractor TIDAK BOLEH menulis projection_engine sama sekali.
   - JANGAN isi projection_engine.summary_block.* dengan apa pun.
   - JANGAN isi projection_engine.blacklist_summary.*
   - JANGAN tulis _field_status untuk path projection_engine.*
   Server akan menurunkan projection_engine post-extraction dari
   reward_engine + variant_engine + scope_engine.
   Setiap key projection_engine yang dikirim LLM akan di-drop.

V10.1-R4. SUBCATEGORY SHAPE (ringkas — detail di tool schema).
   Field per subcategory mengikuti skeleton V.10.1:
     variant_id, variant_name, promo_code,
     calculation_basis, calculation_method, calculation_value, calculation_unit,
     min_deposit, max_reward, max_reward_unlimited, min_claim,
     turnover_multiplier, turnover_rule_format,
     game_domain, eligible_providers, game_names,
     blacklist {enabled, types[], providers[], games[], rules[], note},
     reward_type, payout_direction, currency,
     physical_reward_name, physical_reward_quantity,
     cash_reward_amount, reward_quantity,
     voucher_kind, voucher_valid_from, voucher_valid_until, voucher_valid_unlimited,
     lucky_spin_id, lucky_spin_max_per_day,
     product_note.
   Tidak boleh ada key di luar daftar ini.

OUTPUT
Panggil tool '${TOOL_NAME}' dengan input PkV10Record V.10.1 (boleh partial — server
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
              default_variant_id: { type: "string" },
            },
          },
          items_block: {
            type: "object", additionalProperties: false,
            properties: {
              subcategories: { type: "array", items: subcategoryShape() },
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

// V.10.1 — Subcategory shape (per-variant). Strict: additionalProperties=false.
// Mirrors PkV10Subcategory in src/features/promo-knowledge/schema/pk-v10.ts.
function subcategoryShape(): JSONSchema {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      variant_id: { type: ["string", "null"] },
      variant_name: { type: ["string", "null"] },
      promo_code: { type: ["string", "null"] },
      calculation_basis: enumStrNullable("calculation_basis"),
      calculation_method: enumStrNullable("calculation_method"),
      calculation_value: { type: ["number", "null"] },
      calculation_unit: enumStrNullable("calculation_unit"),
      min_deposit: { type: ["number", "null"] },
      max_reward: { type: ["number", "null"] },
      max_reward_unlimited: { type: "boolean" },
      min_claim: { type: ["number", "null"] },
      turnover_multiplier: { type: ["number", "null"] },
      turnover_rule_format: { type: ["string", "null"] },
      game_domain: enumStrNullable("game_domain"),
      eligible_providers: { type: "array", items: { type: "string" } },
      game_names: { type: "array", items: { type: "string" } },
      blacklist: {
        type: "object",
        additionalProperties: false,
        properties: {
          enabled: { type: "boolean" },
          types: { type: "array", items: { type: "string" } },
          providers: { type: "array", items: { type: "string" } },
          games: { type: "array", items: { type: "string" } },
          rules: { type: "array", items: { type: "string" } },
          note: { type: "string" },
        },
      },
      reward_type: enumStrNullable("reward_type"),
      payout_direction: enumStrNullable("payout_direction"),
      currency: { type: ["string", "null"] },
      physical_reward_name: { type: ["string", "null"] },
      physical_reward_quantity: { type: ["number", "null"] },
      cash_reward_amount: { type: ["number", "null"] },
      reward_quantity: { type: ["number", "null"] },
      voucher_kind: enumStrNullable("voucher_kind"),
      voucher_valid_from: { type: ["string", "null"] },
      voucher_valid_until: { type: ["string", "null"] },
      voucher_valid_unlimited: { type: "boolean" },
      lucky_spin_id: { type: ["string", "null"] },
      lucky_spin_max_per_day: { type: ["number", "null"] },
      product_note: { type: ["string", "null"] },
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
// V.10.1 SCRUB — drop legacy fields & projection_engine before merge
// ============================================================
type ScrubStats = {
  dropped_paths: string[];
  projection_engine_dropped: boolean;
  legacy_field_status_dropped: number;
};

function scrubV101LegacyAndProjection(input: AnyObj): { cleaned: AnyObj; stats: ScrubStats } {
  const cleaned: AnyObj = JSON.parse(JSON.stringify(input ?? {}));
  const stats: ScrubStats = {
    dropped_paths: [],
    projection_engine_dropped: false,
    legacy_field_status_dropped: 0,
  };

  // 1) projection_engine — extractor must NOT write this.
  if (cleaned.projection_engine !== undefined) {
    delete cleaned.projection_engine;
    stats.projection_engine_dropped = true;
    stats.dropped_paths.push("projection_engine");
  }

  // 2) Legacy V.10 reward_engine fields
  const reward = cleaned.reward_engine as AnyObj | undefined;
  if (reward && typeof reward === "object") {
    for (const k of ["max_bonus", "bonus_percentage", "payout_threshold"]) {
      if (k in reward) {
        delete reward[k];
        stats.dropped_paths.push(`reward_engine.${k}`);
      }
    }
    const req = reward.requirement_block as AnyObj | undefined;
    if (req && typeof req === "object" && "min_base" in req) {
      delete req.min_base;
      stats.dropped_paths.push("reward_engine.requirement_block.min_base");
    }
  }

  // 3) Legacy scope_engine.game_block fields
  const scope = cleaned.scope_engine as AnyObj | undefined;
  const gameBlock = scope?.game_block as AnyObj | undefined;
  if (gameBlock && typeof gameBlock === "object") {
    for (const k of ["game_category", "game_providers", "game_exclusions"]) {
      if (k in gameBlock) {
        delete gameBlock[k];
        stats.dropped_paths.push(`scope_engine.game_block.${k}`);
      }
    }
  }

  // 4) Legacy period_engine.validity_block.valid_from_unlimited
  const period = cleaned.period_engine as AnyObj | undefined;
  const validity = period?.validity_block as AnyObj | undefined;
  if (validity && typeof validity === "object" && "valid_from_unlimited" in validity) {
    delete validity.valid_from_unlimited;
    stats.dropped_paths.push("period_engine.validity_block.valid_from_unlimited");
  }

  // 5) Strip subcategories[].confidence
  const variant = cleaned.variant_engine as AnyObj | undefined;
  const items = variant?.items_block as AnyObj | undefined;
  const subs = Array.isArray(items?.subcategories) ? (items!.subcategories as AnyObj[]) : null;
  if (subs) {
    for (const s of subs) {
      if (s && typeof s === "object" && "confidence" in s) {
        delete (s as AnyObj).confidence;
        stats.dropped_paths.push("variant_engine.items_block.subcategories[].confidence");
      }
    }
  }

  // 6) Strip _field_status entries pointing to projection_engine.* or legacy paths
  const fs = cleaned._field_status as Record<string, unknown> | undefined;
  if (fs && typeof fs === "object") {
    const legacyPaths = new Set([
      "reward_engine.max_bonus",
      "reward_engine.bonus_percentage",
      "reward_engine.payout_threshold",
      "reward_engine.requirement_block.min_base",
      "scope_engine.game_block.game_category",
      "scope_engine.game_block.game_providers",
      "scope_engine.game_block.game_exclusions",
      "period_engine.validity_block.valid_from_unlimited",
    ]);
    for (const key of Object.keys(fs)) {
      if (key.startsWith("projection_engine") || legacyPaths.has(key)) {
        delete fs[key];
        stats.legacy_field_status_dropped++;
      }
    }
  }

  return { cleaned, stats };
}

// ============================================================
// V.10.1 SINGLE vs MULTI ENFORCEMENT (post-merge)
// ============================================================
type VariantEnforceResult = {
  promo_mode: string;
  subcategories_cleared: boolean;
  has_subcategories_set: boolean | null;
  expected_count_set: number | null;
};

function enforceSingleVsMulti(record: AnyObj): VariantEnforceResult {
  const result: VariantEnforceResult = {
    promo_mode: "",
    subcategories_cleared: false,
    has_subcategories_set: null,
    expected_count_set: null,
  };
  const idEngine = record.identity_engine as AnyObj | undefined;
  const promoBlock = idEngine?.promo_block as AnyObj | undefined;
  const promoMode = typeof promoBlock?.promo_mode === "string" ? promoBlock.promo_mode : "";
  result.promo_mode = promoMode;

  const variant = record.variant_engine as AnyObj | undefined;
  if (!variant || typeof variant !== "object") return result;
  const summary = variant.summary_block as AnyObj | undefined;
  const items = variant.items_block as AnyObj | undefined;
  const subs = Array.isArray(items?.subcategories) ? (items!.subcategories as AnyObj[]) : [];

  if (promoMode === "single") {
    if (subs.length > 0) {
      (items as AnyObj).subcategories = [];
      result.subcategories_cleared = true;
    }
    if (summary && typeof summary === "object") {
      summary.has_subcategories = false;
      result.has_subcategories_set = false;
      if (summary.expected_count == null) {
        summary.expected_count = 1;
        result.expected_count_set = 1;
      }
    }
  } else if (promoMode === "multi") {
    if (summary && typeof summary === "object") {
      summary.has_subcategories = true;
      result.has_subcategories_set = true;
      summary.expected_count = subs.length;
      result.expected_count_set = subs.length;
    }
  }
  return result;
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
    // V.10.1 SCRUB — strip forbidden legacy fields + projection_engine
    // from llmInput BEFORE merge. Single-brain rule: extractor never
    // writes projection_engine, never emits legacy V.10 paths.
    // ============================================================
    const v101Scrub = scrubV101LegacyAndProjection(llmInput);

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
    const merged = mergeIntoInert(inert, v101Scrub.cleaned);

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
    // V.10.1 SINGLE vs MULTI ENFORCEMENT (header vs variant)
    // promo_mode=single → subcategories WAJIB []; multi → has_subcategories=true.
    // No new decisions: derived from promo_mode chosen by LLM.
    // ============================================================
    const variantEnforce = enforceSingleVsMulti(merged);

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
    // Structural NA propagation (single-brain compliant — no new decisions)
    const { fieldStatus: propagated, stats: propStats } = propagateNotApplicable(
      merged as AnyObj,
      fieldStatus as Record<string, "explicit"|"inferred"|"derived"|"propagated"|"not_stated"|"not_applicable">,
    );
    merged._field_status = propagated;

    // ============================================================
    // GAP #2 — Multi-variant summary hygiene (structural only)
    // ------------------------------------------------------------
    // IF variant_engine.items_block.subcategories.length > 1
    // AND projection_engine.summary_block has no explicit/inferred values
    // THEN mark all summary_block leaf paths as not_applicable.
    //
    // Reason: record-level single summary cannot represent multiple
    // variants without guessing. Canonical detail remains in
    // variant_engine. JSON remains source of truth.
    // ============================================================
    try {
      const variantEngine = (merged.variant_engine as AnyObj) ?? {};
      const itemsBlock = (variantEngine.items_block as AnyObj) ?? {};
      const subs = Array.isArray(itemsBlock.subcategories) ? itemsBlock.subcategories : [];
      if (subs.length > 1) {
        const projEngine = (merged.projection_engine as AnyObj) ?? {};
        const summary = (projEngine.summary_block as AnyObj) ?? {};
        const fs = merged._field_status as Record<string, string>;
        // Check no explicit/inferred values exist under summary_block
        let hasAuthored = false;
        for (const [k, v] of Object.entries(summary)) {
          if (k.startsWith("_")) continue;
          const path = `projection_engine.summary_block.${k}`;
          const status = fs[path];
          if (status === "explicit" || status === "inferred" || status === "derived") {
            hasAuthored = true;
            break;
          }
          // Also treat non-empty value as authored even if status missing
          if (v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)) {
            // Only count as authored if status isn't already not_applicable/propagated
            if (status !== "not_applicable" && status !== "propagated") {
              hasAuthored = true;
              break;
            }
          }
        }
        if (!hasAuthored) {
          let demoted = 0;
          for (const k of Object.keys(summary)) {
            if (k.startsWith("_")) continue;
            const path = `projection_engine.summary_block.${k}`;
            const cur = fs[path];
            if (cur === "explicit" || cur === "inferred" || cur === "derived" || cur === "propagated") continue;
            fs[path] = "not_applicable";
            demoted++;
          }
          summary._summary_skipped_reason = "record_level_summary_not_applicable_data_in_variant_engine";
          (propStats as unknown as AnyObj).summary_demoted_multi_variant = demoted;
        }
      }
    } catch (e) {
      console.warn("[pk-extractor V10] multi-variant summary hygiene skipped:", e instanceof Error ? e.message : String(e));
    }

    // GAP #1 — attach propagation stats as observability metadata
    (merged as AnyObj)._propagation_stats = propStats;

    console.log("[pk-extractor V10.1] OK", {
      model: modelUsed,
      stop_reason: stopReason,
      extraction_source,
      latency_ms: latencyMs,
      mechanics_items: _a(_o((merged.mechanics_engine as AnyObj).items_block).items).length,
      ai_confidence_keys: Object.keys(aiConfidence).length,
      field_status_keys: Object.keys(propagated).length,
      propagation_stats: propStats,
      v101_scrub: v101Scrub.stats,
      variant_enforce: variantEnforce,
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
        schema_version: "V.10.1",
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
