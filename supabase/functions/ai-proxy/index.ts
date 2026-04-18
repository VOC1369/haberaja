import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// OFFICIAL: 1 LLM = Claude Sonnet 4.5 untuk semua type
const SONNET_MODEL = "claude-sonnet-4-5-20250929";

const MODEL_CONFIG: Record<string, { model: string; max_tokens: number }> = {
  extract:     { model: SONNET_MODEL, max_tokens: 8000 },
  classify:    { model: SONNET_MODEL, max_tokens: 500 },
  reject_gate: { model: SONNET_MODEL, max_tokens: 120 },
  intent:      { model: SONNET_MODEL, max_tokens: 800 },
  chat:        { model: SONNET_MODEL, max_tokens: 4000 },
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
    const { type, messages, system, temperature = 0, stream = false } = await req.json();
    if (!MODEL_CONFIG[type]) throw new Error(`Invalid type: ${type}`);
    const config = MODEL_CONFIG[type];
    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: config.max_tokens,
      temperature,
      messages,
    };
    if (system) body.system = system;
    if (stream) body.stream = true;

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

    // Stream passthrough (SSE) untuk chat
    if (stream && response.body) {
      return new Response(response.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
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
