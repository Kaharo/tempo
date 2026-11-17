import type { ModelProvider } from "../types";

type Chunk = { model?: string; choices?: { delta?: { content?: string | null }; message?: { content?: string | null } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } | null };

/** Reads an OpenAI-style SSE stream and returns the concatenated answer text and usage. Exported for tests. */
export async function readSse(body: ReadableStream<Uint8Array>): Promise<{ text: string; inputTokens: number | null; outputTokens: number | null; model: string | null }> {
  const reader = body.getReader(); const dec = new TextDecoder();
  let buf = ""; let text = ""; let inTok: number | null = null; let outTok: number | null = null; let model: string | null = null;
  const take = (line: string) => {
    const l = line.trim();
    if (!l.startsWith("data:")) return;
    const data = l.slice(5).trim();
    if (!data || data === "[DONE]") return;
    let j: Chunk; try { j = JSON.parse(data); } catch { return; }
    if (j.model) model = j.model;
    // Only the answer channel is kept; reasoning deltas, if the model emits them, are ignored.
    const piece = j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content;
    if (typeof piece === "string") text += piece;
    if (j.usage) { inTok = j.usage.prompt_tokens ?? inTok; outTok = j.usage.completion_tokens ?? outTok; }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buf += dec.decode(value, { stream: true });
    const lines = buf.split(/\r?\n/); buf = lines.pop() ?? "";
    lines.forEach(take);
    if (done) break;
  }
  if (buf) take(buf);
  return { text, inputTokens: inTok, outputTokens: outTok, model };
}

/** Works for OpenAI and any OpenAI-compatible /chat/completions endpoint (Together, vLLM, OpenRouter…). */
export function openaiProvider(id: string, kind: "openai" | "openai_compatible", apiKeyEnv: string, baseUrl: string | undefined): ModelProvider {
  return {
    id, kind,
    available: () => (!baseUrl ? { ok: false, reason: "base URL not configured" } : process.env[apiKeyEnv] ? { ok: true } : { ok: false, reason: `${apiKeyEnv} is not set` }),
    async generate(req) {
      // Streaming is used everywhere: some hosted models accept nothing else, and it avoids idle timeouts on long answers.
      const call = (json: boolean) => fetch(`${baseUrl!.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env[apiKeyEnv]}` },
        body: JSON.stringify({
          model: req.model, temperature: req.temperature, top_p: req.topP, stream: true, stream_options: { include_usage: true },
          // OpenAI's own API names the limit max_completion_tokens; compatible servers expect max_tokens.
          ...(kind === "openai" ? { max_completion_tokens: req.maxTokens } : { max_tokens: req.maxTokens }),
          ...(json ? { response_format: { type: "json_object" } } : {}),
          messages: [{ role: "system", content: req.system }, { role: "user", content: req.user }],
        }),
        signal: AbortSignal.timeout(240_000),
      });
      let res = await call(!!req.json);
      // Some compatible models reject JSON mode; the prompt already demands JSON, so retry once without it.
      if (res.status === 400 && req.json) res = await call(false);
      if (!res.ok || !res.body) throw new Error(`${id} HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
      const r = await readSse(res.body);
      if (!r.text.trim()) throw new Error(`${id}: the model returned an empty answer`);
      return { text: r.text, inputTokens: r.inputTokens, outputTokens: r.outputTokens, model: r.model ?? req.model };
    },
  };
}
