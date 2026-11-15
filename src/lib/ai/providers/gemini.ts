import type { ModelProvider } from "../types";

export function geminiProvider(id: string, apiKeyEnv: string, baseUrl: string): ModelProvider {
  return {
    id, kind: "gemini",
    available: () => (process.env[apiKeyEnv] ? { ok: true } : { ok: false, reason: `${apiKeyEnv} is not set` }),
    async generate(req) {
      const res = await fetch(`${baseUrl}/models/${encodeURIComponent(req.model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": process.env[apiKeyEnv]! },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: "user", parts: [{ text: req.user }] }],
          generationConfig: { temperature: req.temperature, topP: req.topP, maxOutputTokens: req.maxTokens, ...(req.json ? { responseMimeType: "application/json" } : {}) },
        }),
        signal: AbortSignal.timeout(300_000),
      });
      if (!res.ok) throw new Error(`${id} HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
      const j = await res.json();
      const text = (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
      return { text, inputTokens: j.usageMetadata?.promptTokenCount ?? null, outputTokens: j.usageMetadata?.candidatesTokenCount ?? null, model: req.model };
    },
  };
}
