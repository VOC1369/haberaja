const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const AI_PROXY_URL = `${SUPABASE_URL}/functions/v1/ai-proxy`;

export type AIProxyType = "extract" | "classify" | "reject_gate";

export async function callAI({ type, messages, system = undefined, temperature = 0 }: {
  type: AIProxyType;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  system?: string;
  temperature?: number;
}) {
  const response = await fetch(AI_PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ type, messages, system, temperature }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI proxy error: ${response.status} ${err}`);
  }
  return response.json();
}

export function extractText(response: any): string {
  return response.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");
}

export function extractJSON<T = unknown>(response: any): T {
  const text = extractText(response);
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
}
