import { readFileSync } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";

const root = process.cwd();
export const readYaml = (rel: string) => YAML.parse(readFileSync(path.join(root, rel), "utf8"));

export const SourceDef = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  kind: z.enum(["rss", "atom", "api", "manual"]),
  url: z.string().url(),
  homepage: z.string().url().optional(),
  tier: z.number().int().min(1).max(3),
  topics: z.array(z.string()).default([]),
  language: z.string().default("en"),
  enabled: z.boolean().default(true),
});
export type SourceDef = z.infer<typeof SourceDef>;

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
export const PipelineConfig = z.object({
  timezone: z.string(),
  schedule: z.object({ collect: hhmm, process: hhmm, agents: hhmm, assemble: hhmm, publish: hhmm }),
  retry: z.object({ max_attempts: z.number().int().min(1), backoff_seconds: z.array(z.number()) }),
  collection: z.object({
    lookback_hours: z.number(), max_items_per_source: z.number(), request_timeout_ms: z.number(),
    user_agent: z.string(), min_interval_minutes_per_source: z.number(),
  }),
  clustering: z.object({ window_hours: z.number(), title_similarity_threshold: z.number() }),
  ranking: z.object({
    weights: z.record(z.string(), z.number()),
    long_term_topics: z.array(z.string()),
    max_clusters_per_agent: z.number().int(),
  }),
  edition: z.object({ perspectives: z.number(), supporting_articles: z.number(), world_items: z.number() }),
});
export type PipelineConfig = z.infer<typeof PipelineConfig>;

export function loadSources(): SourceDef[] {
  return z.array(SourceDef).parse(readYaml("config/sources.yaml").sources);
}
export function loadPipelineDefaults(): PipelineConfig {
  return PipelineConfig.parse(readYaml("config/pipeline.yaml"));
}
