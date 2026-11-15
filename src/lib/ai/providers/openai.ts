import type { ModelProvider } from "../types";

/** Works for OpenAI and any OpenAI-compatible /chat/completions endpoint. */
export function openaiProvider(id: string, kind: "openai" | "openai_compatible", apiKeyEnv: string, baseUrl: string | undefined): ModelProvider {
  return {
    id, kind,
    available: () => (!baseUrl ? { ok: false, reason: "base URL not configured" } : process.env[apiKeyEnv] ? { ok: true } : { ok: false, reason: `${apiKeyEnv} is not set` }),
    async generate(req) {
      const res = await fetch(`${baseUrl!.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env[apiKeyEnv]}` },
        body: JSON.stringify({
          model: req.model, max_completion_tokens: req.maxTokens, temperature: req.temperature, top_p: req.topP,
          ...(req.json ? { response_format: { type: "json_object" } } : {}),
          messages: [{ role: "system", content: req.system }, { role: "user", content: req.user }],
        }),
        signal: AbortSignal.timeout(300_000),
      });
      if (!res.ok) throw new Error(`${id} HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
      const j = await res.json();
      return { text: j.choices?.[0]?.message?.content ?? "", inputTokens: j.usage?.prompt_tokens ?? null, outputTokens: j.usage?.completion_tokens ?? null, model: j.model ?? req.model };
    },
  };
}
