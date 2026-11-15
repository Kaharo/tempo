import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";

export const AgentConfig = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  version: z.number().int().positive(),
  enabled: z.boolean().default(true),
  domain: z.string(),
  personality: z.string(),
  topics: z.array(z.string()).min(1),           // matched against source/provider topics
  keywords: z.array(z.string()).default([]),    // matched against titles/summaries
  source_preferences: z.object({
    prefer: z.array(z.string()).default([]),    // provider ids
    avoid: z.array(z.string()).default([]),
    min_tier_for_lead: z.number().int().min(1).max(3).default(2),
  }),
  model: z.object({
    provider: z.string(),                       // id in config/models.yaml
    name: z.string(),
    temperature: z.number().min(0).max(2).default(0.4),
    max_tokens: z.number().int().positive().default(4000),
    top_p: z.number().optional(),
    fallback: z.object({ provider: z.string(), name: z.string() }).optional(),
  }),
  prompts: z.object({
    system: z.string(),                          // relative to repo root
    editorial_policy: z.string(),
    writing_guidelines: z.string(),
  }),
  output: z.object({
    language: z.string().default("ru"),
    perspective_words: z.tuple([z.number(), z.number()]).default([60, 120]),
    article_words: z.tuple([z.number(), z.number()]).default([500, 1000]),
    write_article_when_score_at_least: z.number().default(0.55),
  }),
  research_workflow: z.array(z.string()).min(1),
  quality: z.object({
    banned_phrases: z.array(z.string()).default([]),
    min_citations_article: z.number().int().default(2),
    min_citations_perspective: z.number().int().default(1),
  }),
  schedule: z.enum(["daily", "weekdays", "manual"]).default("daily"),
});
export type AgentConfig = z.infer<typeof AgentConfig>;

const AGENTS_DIR = path.join(process.cwd(), "agents");

export type LoadedAgent = { config: AgentConfig; systemPrompt: string; editorialPolicy: string; writingGuidelines: string; contentHash: string };

export function loadAgent(id: string): LoadedAgent {
  const file = path.join(AGENTS_DIR, id, "agent.yaml");
  const config = AgentConfig.parse(YAML.parse(readFileSync(file, "utf8")));
  const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");
  const systemPrompt = read(config.prompts.system);
  const editorialPolicy = read(config.prompts.editorial_policy);
  const writingGuidelines = read(config.prompts.writing_guidelines);
  const contentHash = createHash("sha256").update(JSON.stringify(config) + systemPrompt + editorialPolicy + writingGuidelines).digest("hex").slice(0, 16);
  return { config, systemPrompt, editorialPolicy, writingGuidelines, contentHash };
}

export function listAgentIds(): string[] {
  return readdirSync(AGENTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "shared" && existsSync(path.join(AGENTS_DIR, d.name, "agent.yaml")))
    .map((d) => d.name).sort();
}

export const loadAllAgents = () => listAgentIds().map(loadAgent);
