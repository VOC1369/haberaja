import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

const MODEL_CONFIG = {
  extract: { model: "claude-sonnet-4-20250514", max_tokens: 4000 },
  classify: { model: "claude-haiku-4-5-20251001", max_tokens: 500 },
  reject_gate: { model: "claude-haiku-4-5-20251001", max_tokens: 120 },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
    const { type, messages, system, temperature = 0 } = await req.json();
    if (!MODEL_CONFIG[type]) throw new Error(`Invalid type: ${type}`);
    const config = MODEL_CONFIG[type];
    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: config.max_tokens,
      temperature,
      messages,
    };
    if (system) body.system = system;
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const errorType = errorBody?.error?.type ?? "";

      // Credit habis
      if (
        response.status === 429 &&
        (errorType === "credit_balance_exceeded" || errorType === "rate_limit_error")
      ) {
        return new Response(
          JSON.stringify({ error: "CREDIT_EXHAUSTED", message: "Kredit Anthropic habis. Silakan top-up di console.anthropic.com." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Rate limit biasa
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "RATE_LIMITED", message: "Terlalu banyak request. Coba lagi sebentar." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Anthropic error: ${response.status} ${JSON.stringify(errorBody)}`);
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
