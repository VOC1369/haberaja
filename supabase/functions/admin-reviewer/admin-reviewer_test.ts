// Phase 1 tests for admin-reviewer edge function.
// Run via supabase--test_edge_functions. Uses injected fake Anthropic caller.

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleAdminReviewer } from "./index.ts";

function makeReq(body: unknown): Request {
  return new Request("http://local/admin-reviewer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function fakeAnthropic(text: string, status = 200, jsonBody?: unknown) {
  return async (_body: Record<string, unknown>) => {
    if (status !== 200) {
      return new Response(JSON.stringify(jsonBody ?? {}), { status });
    }
    const payload = {
      content: [{ type: "text", text }],
    };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}

Deno.test("0 signals => 0 decisions, Anthropic not called", async () => {
  let called = false;
  const caller = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };
  const req = makeReq({ record_id: "pk_x", signals: { warnings: [], ambiguity_flags: [], contradiction_flags: [] } });
  const resp = await handleAdminReviewer(req, caller);
  assertEquals(resp.status, 200);
  const body = await resp.json();
  assertEquals(body.decisions, []);
  assertEquals(called, false);
});

Deno.test("SLOT vs Casino/Sports contradiction => 1 decision with specific options", async () => {
  const llmText = JSON.stringify({
    decisions: [
      {
        id: "decision_001",
        decision_type: "contradiction",
        title: "Data promo saling bertentangan",
        explanation: "Tabel promo menyebut Casino, Sports, dan Slot. Tetapi Syarat & Ketentuan menyebut bonus hanya berlaku untuk Slot.",
        question: "Mana yang benar?",
        options: [
          { label: "Ikuti tabel — Casino, Sports, dan Slot semua berlaku", value: "trust_table" },
          { label: "Ikuti S&K — hanya Slot yang berlaku", value: "trust_terms" },
          { label: "Saya ingin menjelaskan manual", value: "manual" },
        ],
        manual_note_enabled: true,
        related_signal_indices: { warnings: [], ambiguity_flags: [], contradiction_flags: [0] },
      },
    ],
  });
  const req = makeReq({
    record_id: "pk_x",
    signals: { warnings: [], ambiguity_flags: [], contradiction_flags: ["scope mismatch table vs terms"] },
    context: { promo_name: "Bonus 100%", variants: [{ name: "SLOT", max_bonus: "30%" }] },
  });
  const resp = await handleAdminReviewer(req, fakeAnthropic(llmText));
  assertEquals(resp.status, 200);
  const body = await resp.json();
  assertEquals(body.decisions.length, 1);
  assertEquals(body.decisions[0].decision_type, "contradiction");
  assertEquals(body.decisions[0].options.length, 3);
  assertExists(body.decisions[0].options.find((o: { value: string }) => o.value === "manual"));
});

Deno.test("Two distinct problems => 2 decisions", async () => {
  const llmText = JSON.stringify({
    decisions: [
      {
        id: "decision_001",
        decision_type: "contradiction",
        title: "Cakupan game tidak konsisten",
        explanation: "Tabel dan Syarat & Ketentuan menyebut cakupan game berbeda.",
        question: "Mana yang benar?",
        options: [
          { label: "Pilih tabel", value: "trust_table" },
          { label: "Pilih S&K", value: "trust_terms" },
          { label: "Saya ingin menjelaskan manual", value: "manual" },
        ],
        manual_note_enabled: true,
        related_signal_indices: { warnings: [], ambiguity_flags: [], contradiction_flags: [0] },
      },
      {
        id: "decision_002",
        decision_type: "ambiguity",
        title: "Batas klaim per pemain belum jelas",
        explanation: "Tidak disebutkan berapa kali bonus ini bisa diklaim per pemain.",
        question: "Berapa kali maksimal klaim?",
        options: [
          { label: "1 kali per pemain", value: "once_per_user" },
          { label: "1 kali per hari", value: "once_per_day" },
          { label: "Tidak ada batas", value: "unlimited" },
          { label: "Saya ingin menjelaskan manual", value: "manual" },
        ],
        manual_note_enabled: true,
        related_signal_indices: { warnings: [], ambiguity_flags: [0], contradiction_flags: [] },
      },
    ],
  });
  const req = makeReq({
    record_id: "pk_x",
    signals: {
      warnings: [],
      ambiguity_flags: ["claim limit unspecified"],
      contradiction_flags: ["scope mismatch"],
    },
  });
  const resp = await handleAdminReviewer(req, fakeAnthropic(llmText));
  assertEquals(resp.status, 200);
  const body = await resp.json();
  assertEquals(body.decisions.length, 2);
});

Deno.test("Malformed LLM output => 502 INVALID_OUTPUT", async () => {
  const req = makeReq({
    record_id: "pk_x",
    signals: { warnings: ["x"], ambiguity_flags: [], contradiction_flags: [] },
  });
  const resp = await handleAdminReviewer(req, fakeAnthropic("not json at all"));
  assertEquals(resp.status, 502);
  const body = await resp.json();
  assertEquals(body.error, "INVALID_OUTPUT");
});

Deno.test("Anthropic 429 => RATE_LIMITED envelope", async () => {
  const req = makeReq({
    record_id: "pk_x",
    signals: { warnings: ["x"], ambiguity_flags: [], contradiction_flags: [] },
  });
  const resp = await handleAdminReviewer(req, fakeAnthropic("", 429, { error: { type: "rate_limit_error" } }));
  assertEquals(resp.status, 429);
  const body = await resp.json();
  assertEquals(body.error, "RATE_LIMITED");
});

Deno.test("Anthropic credit_balance_exceeded => CREDIT_EXHAUSTED envelope", async () => {
  const req = makeReq({
    record_id: "pk_x",
    signals: { warnings: ["x"], ambiguity_flags: [], contradiction_flags: [] },
  });
  const resp = await handleAdminReviewer(req, fakeAnthropic("", 429, { error: { type: "credit_balance_exceeded" } }));
  assertEquals(resp.status, 402);
  const body = await resp.json();
  assertEquals(body.error, "CREDIT_EXHAUSTED");
});

Deno.test("UI-text guard: forbidden technical word in title => INVALID_OUTPUT", async () => {
  const llmText = JSON.stringify({
    decisions: [
      {
        id: "decision_001",
        decision_type: "warning",
        title: "field_path mismatch in schema", // contains forbidden words
        explanation: "ok",
        question: "ok?",
        options: [
          { label: "Ya", value: "yes" },
          { label: "Saya ingin menjelaskan manual", value: "manual" },
        ],
        manual_note_enabled: true,
        related_signal_indices: { warnings: [0], ambiguity_flags: [], contradiction_flags: [] },
      },
    ],
  });
  const req = makeReq({
    record_id: "pk_x",
    signals: { warnings: ["x"], ambiguity_flags: [], contradiction_flags: [] },
  });
  const resp = await handleAdminReviewer(req, fakeAnthropic(llmText));
  assertEquals(resp.status, 502);
  const body = await resp.json();
  assertEquals(body.error, "INVALID_OUTPUT");
});
