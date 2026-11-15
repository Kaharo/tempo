import Anthropic from "@anthropic-ai/sdk";
import type { ModelProvider } from "../types";

export function anthropicProvider(id: string, apiKeyEnv: string): ModelProvider {
  return {
    id, kind: "anthropic",
    available: () => (process.env[apiKeyEnv] ? { ok: true } : { ok: false, reason: `${apiKeyEnv} is not set` }),
    async generate(req) {
      const client = new Anthropic({ apiKey: process.env[apiKeyEnv], maxRetries: 2 });
      const msg = await client.messages.create({
        model: req.model, max_tokens: req.maxTokens, system: req.system,
        ...(req.temperature != null ? { temperature: req.temperature } : {}),
        messages: [{ role: "user", content: req.user }],
      });
      const text = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
      return { text, inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens, model: msg.model };
    },
  };
}
