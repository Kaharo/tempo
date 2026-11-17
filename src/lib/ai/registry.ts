import { z } from "zod";
import { readYaml } from "@/lib/config";
import type { ModelProvider } from "./types";
import { anthropicProvider } from "./providers/anthropic";
import { openaiProvider } from "./providers/openai";
import { geminiProvider } from "./providers/gemini";
import { manualProvider } from "./providers/manual";

const ProviderDef = z.object({
  kind: z.enum(["anthropic", "openai", "gemini", "openai_compatible", "manual"]),
  api_key_env: z.string().optional(),
  base_url: z.string().optional(),
  base_url_env: z.string().optional(),
});
const ModelsFile = z.object({
  providers: z.record(z.string(), ProviderDef),
  prices: z.record(z.string(), z.object({ input: z.number().nullable(), output: z.number().nullable() })).default({}),
});

export function loadModels() { return ModelsFile.parse(readYaml("config/models.yaml")); }

export function getProvider(id: string): ModelProvider {
  const def = loadModels().providers[id];
  if (!def) throw new Error(`Unknown model provider "${id}" (config/models.yaml)`);
  switch (def.kind) {
    case "anthropic": return anthropicProvider(id, def.api_key_env ?? "ANTHROPIC_API_KEY");
    case "openai": return openaiProvider(id, "openai", def.api_key_env ?? "OPENAI_API_KEY", def.base_url);
    case "openai_compatible": return openaiProvider(id, "openai_compatible", def.api_key_env ?? "COMPAT_API_KEY", def.base_url ?? (def.base_url_env ? process.env[def.base_url_env] : undefined));
    case "gemini": return geminiProvider(id, def.api_key_env ?? "GEMINI_API_KEY", def.base_url ?? "https://generativelanguage.googleapis.com/v1beta");
    case "manual": return manualProvider(id);
  }
}

export function estimateCost(model: string, inTok: number | null, outTok: number | null): number | null {
  const p = loadModels().prices[model.replace(/^manual:/, "")];
  if (!p || p.input == null || p.output == null || inTok == null || outTok == null) return null;
  return (inTok * p.input + outTok * p.output) / 1_000_000;
}

/**
 * Which provider and model an agent actually runs on:
 *  - TEMPO_MODE=manual → manual provider (no API keys needed)
 *  - TEMPO_MODEL_PROVIDER (+ TEMPO_MODEL) → one provider for every agent, without editing agent files
 *  - otherwise the agent's own `model:` block
 */
export function resolveModel(agentProvider: string, agentModel: string): { provider: ModelProvider; model: string } {
  if (process.env.TEMPO_MODE === "manual") return { provider: getProvider("manual"), model: agentModel };
  const override = process.env.TEMPO_MODEL_PROVIDER;
  if (override) return { provider: getProvider(override), model: process.env.TEMPO_MODEL || agentModel };
  return { provider: getProvider(agentProvider), model: agentModel };
}
export const resolveProvider = (preferred: string) => resolveModel(preferred, "").provider;
