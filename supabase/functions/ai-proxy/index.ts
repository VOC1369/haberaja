import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// OFFICIAL: 1 LLM = Claude Sonnet 4.5 untuk semua type
const SONNET_MODEL = "claude-sonnet-4-5-20250929";

const MODEL_CONFIG: Record<string, { model: string; max_tokens: number; default_temperature: number; allow_tools?: boolean }> = {
  // Parser/extractor reasoning path — slight flexibility for natural language operator input
  extract:     { model: SONNET_MODEL, max_tokens: 8000,  default_temperature: 0.2 },
  classify:    { model: SONNET_MODEL, max_tokens: 500,   default_temperature: 0 },
  reject_gate: { model: SONNET_MODEL, max_tokens: 120,   default_temperature: 0 },
  intent:      { model: SONNET_MODEL, max_tokens: 800,   default_temperature: 0 },
  chat:        { model: SONNET_MODEL, max_tokens: 4000,  default_temperature: 0 },
  // PK V.09 extractor — large structured output via tool calling.
  // max_tokens HARDCODED 16k. Caller cannot override. tools/tool_choice passthrough.
  extract_pk:  { model: SONNET_MODEL, max_tokens: 16000, default_temperature: 0.1, allow_tools: true },
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
    const requestBody = await req.json();
    const { type, messages, system, temperature, stream = false, tools, tool_choice } = requestBody;
    if (!MODEL_CONFIG[type]) throw new Error(`Invalid type: ${type}`);
    const config = MODEL_CONFIG[type];
    // Per-type default temperature; caller can still override explicitly
    const effectiveTemperature =
      typeof temperature === "number" ? temperature : config.default_temperature;
    // max_tokens is HARDCODED per type. Caller-provided max_tokens is ignored.
    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: config.max_tokens,
      temperature: effectiveTemperature,
      messages,
    };
    if (system) body.system = system;
    if (stream) body.stream = true;

    // Tools / tool_choice passthrough — only for types that explicitly allow it.
    if (config.allow_tools) {
      if (Array.isArray(tools) && tools.length > 0) body.tools = tools;
      if (tool_choice) body.tool_choice = tool_choice;
    }

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

      // Server overloaded (529) atau 5xx upstream → transient, retryable
      if (response.status === 529 || errorType === "overloaded_error" || response.status >= 500) {
        return new Response(
          JSON.stringify({
            error: "OVERLOADED",
            message: "Server Anthropic sedang overload. Coba lagi sebentar.",
            upstream_status: response.status,
          }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
