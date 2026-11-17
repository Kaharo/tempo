import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { listAgentIds, loadAgent } from "./config";
import { AgentOutput, validateOutput } from "./output";
import { buildPack, persistOutput } from "./run";
import { syncAgents } from "./sync";
import { getPipelineConfig } from "@/lib/settings";
import { log } from "@/lib/log";

export type PerspectiveInput = { agent: string; cluster: string; headline: string; body: string; refs: number[] };
export type SubmitResult = { ok: true; warnings: string[]; duplicate?: boolean } | { ok: false; status: number; errors: string[] };

/**
 * Manual-execution channel: a perspective written outside TEMPO against today's source pack.
 * Same QA gate as API runs (citations must exist in the pack and belong to the story);
 * recorded as provider "manual".
 */
export async function submitPerspective(p: PerspectiveInput, date: string): Promise<SubmitResult> {
  if (!listAgentIds().includes(p.agent)) return { ok: false, status: 400, errors: [`agent must be one of ${listAgentIds().join(", ")}`] };
  const dup = await db.query.perspectives.findFirst({ where: and(eq(schema.perspectives.agentId, p.agent), eq(schema.perspectives.editionDate, date), eq(schema.perspectives.headline, p.headline.trim())) });
  if (dup) return { ok: true, warnings: [], duplicate: true };
  const cfg = await getPipelineConfig();
  const agent = loadAgent(p.agent);
  const pack = await buildPack(agent, date, cfg.ranking.max_clusters_per_agent);
  if (!pack.sources.length) return { ok: false, status: 409, errors: ["no routed stories for this agent today"] };
  const parsed = AgentOutput.safeParse({ cluster_id: p.cluster, perspective: { headline: p.headline.trim(), body: p.body.trim(), refs: p.refs }, article: null });
  if (!parsed.success) return { ok: false, status: 422, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const v = validateOutput(parsed.data, agent.config, pack.sources.length, new Set(pack.clusterIds));
  const foreign = p.refs.filter((n) => pack.sources.find((s) => s.n === n)?.clusterId !== parsed.data.cluster_id);
  if (foreign.length) v.errors.push(`citations [${foreign.join(", ")}] belong to a different story`);
  if (v.errors.length) return { ok: false, status: 422, errors: v.errors };

  const version = (await syncAgents()).find((a) => a.id === p.agent)!.version;
  const [run] = await db.insert(schema.agentRuns).values({
    agentId: p.agent, configVersion: version, editionDate: date, providerId: "manual", model: "claude-session", status: "succeeded",
    inputClusterIds: pack.clusterIds, inputSourceItemIds: pack.sources.map((s) => s.sourceItemId),
    rawOutput: JSON.stringify(parsed.data), validationErrors: v.warnings.map((w) => `warning: ${w}`), startedAt: new Date(), finishedAt: new Date(),
  }).returning();
  await persistOutput(parsed.data, p.agent, run.id, date, pack);
  await log("info", `agent:${p.agent}`, "Perspective received through manual channel", { warnings: v.warnings });
  return { ok: true, warnings: v.warnings };
}
