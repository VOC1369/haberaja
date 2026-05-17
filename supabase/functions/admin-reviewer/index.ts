// Admin Reviewer Edge Function — Phase 1
// Reads extractor signals (warnings / ambiguity_flags / contradiction_flags) plus
// minimal record context, calls Claude Sonnet 4.5, and returns AdminDecision[].
//
// Hard rules:
// - 0 signals => { decisions: [] } without calling Anthropic.
// - Output validated server-side. Malformed output => 502 INVALID_OUTPUT.
// - 429 / credit errors mapped to explicit envelopes.
// - No fallback to local grouping. No technical terms in user-facing fields
//   (enforced by post-validation guard).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5-20250929";
const MAX_TOKENS = 4000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Words that must never appear in user-facing AdminDecision fields.
// `decision_type` is exempt (it's an internal enum value, not rendered raw).
const FORBIDDEN_WORDS = [
  "field_path",
  "schema",
  "JSON",
  "engine",
  "severity",
  "flags",
  "source_text",
  "warning",
  "ambiguity",
  "contradiction",
];

const SYSTEM_PROMPT = `Anda adalah Admin Reviewer untuk knowledge base promo casino online.

TUGAS:
Anda menerima daftar masalah hasil deteksi otomatis pada data promo. Tugas Anda:
1. Baca SEMUA masalah sekaligus.
2. Gabungkan masalah-masalah yang sebenarnya membahas hal yang sama menjadi 1 keputusan.
3. Untuk setiap keputusan, buat 1 pertanyaan bisnis yang jelas untuk operator.
4. Setiap pertanyaan harus punya 3-5 opsi konkret + 1 opsi "Saya ingin menjelaskan manual".
5. Opsi harus spesifik (sebut nama varian / nilai konkret dari data), bukan generik.

BAHASA:
- Tulis untuk operator / customer service Indonesia, bukan untuk developer.
- DILARANG memakai kata-kata ini di title / explanation / question / options:
  field_path, schema, JSON, engine, severity, flags, source_text, warning, ambiguity, contradiction.
- Gunakan kata sederhana: "data saling bertentangan", "data tidak lengkap", "perlu konfirmasi".

OUTPUT:
Kembalikan HANYA JSON valid dengan bentuk:
{
  "decisions": [
    {
      "id": "decision_001",
      "decision_type": "contradiction" | "ambiguity" | "warning",
      "title": "string singkat (max 80 char)",
      "explanation": "string 1-3 kalimat menjelaskan apa yang ditemukan, dalam bahasa bisnis",
      "question": "string pertanyaan ke operator",
      "options": [
        { "label": "string spesifik", "value": "snake_case_id" }
      ],
      "manual_note_enabled": true,
      "related_signal_indices": {
        "warnings": [0, 1],
        "ambiguity_flags": [],
        "contradiction_flags": [0]
      }
    }
  ]
}

ATURAN KEPUTUSAN:
- 1 masalah bisnis = 1 decision. Jangan buat duplikat.
- Jika tidak ada keputusan yang bermakna untuk operator, kembalikan {"decisions": []}.
- Selalu sertakan opsi terakhir { "label": "Saya ingin menjelaskan manual", "value": "manual" }.
- decision_type adalah enum internal — boleh dipakai HANYA di field "decision_type", tidak boleh muncul di teks lain.

ATURAN OPSI HARUS BISA DITERAPKAN (WAJIB):
- Sistem hanya bisa mengubah data canonical yang diberikan di "context.canonical_editable".
- Baca "context.canonical_editable.allowed_actions" sebelum membuat opsi.
- JANGAN PERNAH menawarkan opsi yang tidak bisa dipetakan ke salah satu allowed_actions tersebut.
- Contoh terlarang: menawarkan "lanjutkan penomoran menjadi poin 9 dan 10" padahal "context.canonical_editable.terms_conditions" berisi item-item tanpa nomor eksplisit. Sistem tidak akan bisa menerapkannya.
- Contoh terlarang: menawarkan "tulis ulang seluruh Syarat & Ketentuan" — sistem tidak mengizinkan rewrite massal.
- Jika masalah yang terdeteksi memang tidak punya tindakan canonical yang cocok, buat opsi yang tetap aman, misalnya:
  1. "Abaikan masalah ini karena data tersimpan sudah benar."
  2. "Tandai sebagai catatan admin saja."
  3. "Saya ingin menjelaskan manual."
- Untuk opsi yang mengganti teks satu item Syarat & Ketentuan, pastikan teks lama yang dimaksud BENAR-BENAR muncul persis di "context.canonical_editable.terms_conditions".

Kembalikan HANYA objek JSON. Tanpa markdown. Tanpa komentar.`;

type Signals = {
  warnings?: unknown;
  ambiguity_flags?: unknown;
  contradiction_flags?: unknown;
};

type ReqBody = {
  record_id?: unknown;
  signals?: Signals;
  context?: unknown;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function countSignals(s: Signals | undefined): number {
  if (!s) return 0;
  return (
    asStringArray(s.warnings).length +
    asStringArray(s.ambiguity_flags).length +
    asStringArray(s.contradiction_flags).length
  );
}

function stripCodeFence(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function containsForbidden(text: string): string | null {
  const lower = text.toLowerCase();
  for (const w of FORBIDDEN_WORDS) {
    if (lower.includes(w.toLowerCase())) return w;
  }
  return null;
}

type AdminDecisionOption = { label: string; value: string };
type AdminDecision = {
  id: string;
  decision_type: "contradiction" | "ambiguity" | "warning";
  title: string;
  explanation: string;
  question: string;
  options: AdminDecisionOption[];
  manual_note_enabled: boolean;
  related_signal_indices: {
    warnings: number[];
    ambiguity_flags: number[];
    contradiction_flags: number[];
  };
};

function validateDecisions(raw: unknown): { ok: true; decisions: AdminDecision[] } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "not an object" };
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.decisions)) return { ok: false, reason: "decisions missing or not array" };
  const out: AdminDecision[] = [];
  for (let i = 0; i < obj.decisions.length; i++) {
    const d = obj.decisions[i] as Record<string, unknown> | null;
    if (!d || typeof d !== "object") return { ok: false, reason: `decisions[${i}] not object` };
    const id = typeof d.id === "string" && d.id.trim() ? d.id : `decision_${String(i + 1).padStart(3, "0")}`;
    const decision_type = d.decision_type;
    if (decision_type !== "contradiction" && decision_type !== "ambiguity" && decision_type !== "warning") {
      return { ok: false, reason: `decisions[${i}].decision_type invalid` };
    }
    const title = d.title;
    const explanation = d.explanation;
    const question = d.question;
    if (typeof title !== "string" || !title.trim()) return { ok: false, reason: `decisions[${i}].title missing` };
    if (typeof explanation !== "string" || !explanation.trim()) return { ok: false, reason: `decisions[${i}].explanation missing` };
    if (typeof question !== "string" || !question.trim()) return { ok: false, reason: `decisions[${i}].question missing` };
    if (!Array.isArray(d.options) || d.options.length < 2) return { ok: false, reason: `decisions[${i}].options must have >=2` };
    const options: AdminDecisionOption[] = [];
    for (let j = 0; j < d.options.length; j++) {
      const o = d.options[j] as Record<string, unknown> | null;
      if (!o || typeof o.label !== "string" || typeof o.value !== "string") {
        return { ok: false, reason: `decisions[${i}].options[${j}] invalid` };
      }
      options.push({ label: o.label, value: o.value });
    }
    // Forbidden-word guard on user-facing strings only.
    const userFacing = [title, explanation, question, ...options.map((o) => o.label)].join("\n");
    const bad = containsForbidden(userFacing);
    if (bad) return { ok: false, reason: `forbidden technical term in output: ${bad}` };

    const rsi = (d.related_signal_indices ?? {}) as Record<string, unknown>;
    const related = {
      warnings: Array.isArray(rsi.warnings) ? rsi.warnings.filter((n): n is number => typeof n === "number") : [],
      ambiguity_flags: Array.isArray(rsi.ambiguity_flags) ? rsi.ambiguity_flags.filter((n): n is number => typeof n === "number") : [],
      contradiction_flags: Array.isArray(rsi.contradiction_flags) ? rsi.contradiction_flags.filter((n): n is number => typeof n === "number") : [],
    };

    out.push({
      id,
      decision_type,
      title,
      explanation,
      question,
      options,
      manual_note_enabled: d.manual_note_enabled !== false,
      related_signal_indices: related,
    });
  }
  return { ok: true, decisions: out };
}

// Allow tests to inject a fake Anthropic transport.
type AnthropicCaller = (body: Record<string, unknown>) => Promise<Response>;

async function defaultAnthropicCall(body: Record<string, unknown>): Promise<Response> {
  return await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
}

export async function handleAdminReviewer(
  req: Request,
  anthropicCall: AnthropicCaller = defaultAnthropicCall,
): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return jsonResponse({ error: "METHOD_NOT_ALLOWED", message: "POST required" }, 405);
  }

  let body: ReqBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "BAD_REQUEST", message: "Body bukan JSON valid" }, 400);
  }

  const signals: Signals = {
    warnings: asStringArray(body.signals?.warnings),
    ambiguity_flags: asStringArray(body.signals?.ambiguity_flags),
    contradiction_flags: asStringArray(body.signals?.contradiction_flags),
  };
  const total = countSignals(signals);

  // Short-circuit: no signals => no decisions, no LLM call.
  if (total === 0) {
    return jsonResponse({ decisions: [] }, 200);
  }

  if (!ANTHROPIC_API_KEY && anthropicCall === defaultAnthropicCall) {
    return jsonResponse(
      { error: "REVIEWER_FAILED", message: "Reviewer gagal membuat pertanyaan. Coba ulang." },
      500,
    );
  }

  const userPayload = {
    record_id: typeof body.record_id === "string" ? body.record_id : "unknown",
    signals,
    context: body.context ?? {},
  };

  const anthropicBody = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.1,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Berikut data masalah dan konteks promo (JSON):\n\n${JSON.stringify(userPayload, null, 2)}\n\nKembalikan HANYA JSON sesuai skema yang diminta.`,
      },
    ],
  };

  let resp: Response;
  try {
    resp = await anthropicCall(anthropicBody);
  } catch (e) {
    return jsonResponse(
      { error: "REVIEWER_FAILED", message: "Reviewer gagal membuat pertanyaan. Coba ulang.", detail: String(e) },
      502,
    );
  }

  if (!resp.ok) {
    let errBody: Record<string, unknown> = {};
    try { errBody = await resp.json(); } catch { /* ignore */ }
    const errType = ((errBody as { error?: { type?: string } })?.error?.type) ?? "";

    if (resp.status === 429 && (errType === "credit_balance_exceeded" || errType === "rate_limit_error")) {
      // Anthropic groups credit-exhaustion under 429 — surface as CREDIT_EXHAUSTED.
      if (errType === "credit_balance_exceeded") {
        return jsonResponse(
          { error: "CREDIT_EXHAUSTED", message: "Kredit Anthropic habis." },
          402,
        );
      }
      return jsonResponse(
        { error: "RATE_LIMITED", message: "Terlalu banyak permintaan. Coba lagi sebentar." },
        429,
      );
    }
    if (resp.status === 429) {
      return jsonResponse(
        { error: "RATE_LIMITED", message: "Terlalu banyak permintaan. Coba lagi sebentar." },
        429,
      );
    }
    if (resp.status === 402) {
      return jsonResponse({ error: "CREDIT_EXHAUSTED", message: "Kredit Anthropic habis." }, 402);
    }
    return jsonResponse(
      { error: "REVIEWER_FAILED", message: "Reviewer gagal membuat pertanyaan. Coba ulang.", upstream_status: resp.status },
      502,
    );
  }

  let data: unknown;
  try {
    data = await resp.json();
  } catch {
    return jsonResponse({ error: "INVALID_OUTPUT", message: "Reviewer gagal membuat pertanyaan. Coba ulang." }, 502);
  }

  const content = (data as { content?: Array<{ type: string; text?: string }> })?.content ?? [];
  const text = content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();
  if (!text) {
    return jsonResponse({ error: "INVALID_OUTPUT", message: "Reviewer gagal membuat pertanyaan. Coba ulang." }, 502);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(text));
  } catch {
    return jsonResponse({ error: "INVALID_OUTPUT", message: "Reviewer gagal membuat pertanyaan. Coba ulang." }, 502);
  }

  const validated = validateDecisions(parsed);
  if (!validated.ok) {
    return jsonResponse(
      { error: "INVALID_OUTPUT", message: "Reviewer gagal membuat pertanyaan. Coba ulang.", detail: validated.reason },
      502,
    );
  }

  return jsonResponse({ decisions: validated.decisions }, 200);
}

// Defense-in-depth: also require an authenticated user session in code.
// `verify_jwt = true` (platform) blocks fully-anonymous requests, but accepts
// any valid JWT — including the public anon key. This extra check restricts
// the endpoint to real logged-in users only.
async function requireAuthenticatedUser(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "UNAUTHORIZED", message: "Login diperlukan." }, 401);
  }
  const token = authHeader.slice(7).trim();
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) {
    return jsonResponse(
      { error: "SERVER_MISCONFIGURED", message: "Reviewer gagal membuat pertanyaan. Coba ulang." },
      500,
    );
  }
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const sb = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await sb.auth.getClaims(token);
    const role = (data?.claims as { role?: string } | undefined)?.role;
    if (error || !data?.claims || role !== "authenticated") {
      return jsonResponse({ error: "UNAUTHORIZED", message: "Sesi tidak valid." }, 401);
    }
  } catch {
    return jsonResponse({ error: "UNAUTHORIZED", message: "Sesi tidak valid." }, 401);
  }
  return null;
}

// Only start the HTTP server when run as the entrypoint (not when imported by tests).
if (import.meta.main) {
  serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method === "POST") {
      const denied = await requireAuthenticatedUser(req);
      if (denied) return denied;
    }
    return handleAdminReviewer(req);
  });
}
