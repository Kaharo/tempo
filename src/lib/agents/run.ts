import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { and, desc, eq, gte, inArray, sql as dsql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { Citation, ArticleBlock } from "@/db/schema";
import { getPipelineConfig } from "@/lib/settings";
import { log } from "@/lib/log";
import { estimateCost, resolveProvider } from "@/lib/ai/registry";
import { ManualResponsePending } from "@/lib/ai/types";
import { loadAgent, type LoadedAgent } from "./config";
import { AgentOutput, extractJson, validateOutput } from "./output";
import { syncAgents } from "./sync";

export type PackSource = { n: number; sourceItemId: string; clusterId: string; url: string; title: string; publisher: string; publishedAt: string | null; summary: string | null };
export type Pack = { text: string; sources: PackSource[]; clusterIds: string[] };

/** Select the stories routed to this agent and render them as a numbered source pack. */
export async function buildPack(agent: LoadedAgent, editionDate: string, maxClusters: number): Promise<Pack> {
  const since = new Date(Date.now() - (await getPipelineConfig()).clustering.window_hours * 3600_000);
  const routed = await db.select().from(schema.storyClusters)
    .where(and(gte(schema.storyClusters.lastSeenAt, since), dsql`${schema.storyClusters.routedAgents} ? ${agent.config.id}`))
    .orderBy(desc(schema.storyClusters.score)).limit(maxClusters * 3)
    .then((rows) => rows
      // Rank by importance plus how squarely the story sits in this agent's domain.
      .map((c) => ({ c, r: (c.score ?? 0) + 0.04 * Math.min(6, Number(c.scoreBreakdown?.[`fit_${agent.config.id}`] ?? 0)) }))
      .sort((a, b) => b.r - a.r).slice(0, maxClusters).map((x) => x.c));
  if (!routed.length) return { text: "", sources: [], clusterIds: [] };

  const items = await db.select({ i: schema.sourceItems, p: schema.sourceProviders })
    .from(schema.sourceItems).innerJoin(schema.sourceProviders, eq(schema.sourceItems.providerId, schema.sourceProviders.id))
    .where(inArray(schema.sourceItems.clusterId, routed.map((c) => c.id)));
  const prefer = new Set(agent.config.source_preferences.prefer);
  const avoid = new Set(agent.config.source_preferences.avoid);

  const sources: PackSource[] = [];
  const blocks: string[] = [];
  for (const c of routed) {
    const its = items.filter((r) => r.i.clusterId === c.id && !avoid.has(r.p.id))
      .sort((a, b) => Number(prefer.has(b.p.id)) - Number(prefer.has(a.p.id)) || a.p.tier - b.p.tier)
      .slice(0, 5);
    const lines = its.map((r) => {
      const n = sources.length + 1;
      sources.push({ n, sourceItemId: r.i.id, clusterId: c.id, url: r.i.url, title: r.i.title, publisher: r.p.name, publishedAt: r.i.publishedAt?.toISOString() ?? null, summary: r.i.summary });
      return `[${n}] ${r.p.name} (tier ${r.p.tier}) — published ${r.i.publishedAt?.toISOString() ?? "date unknown"}\n    Title: ${r.i.title}\n    URL: ${r.i.url}\n    Excerpt: ${(r.i.summary ?? "(no excerpt)").slice(0, 1500)}`;
    });
    blocks.push(`## STORY ${c.id}\nscore: ${c.score} · verification: ${c.verification} · sources: ${c.distinctProviders}\nnotes: ${c.verificationNotes.join("; ") || "none"}\n${lines.join("\n")}`);
  }
  const text = `EDITION DATE: ${editionDate} (timezone Asia/Almaty)\nARTICLE THRESHOLD: score ≥ ${agent.config.output.write_article_when_score_at_least}\nPERSPECTIVE LENGTH: ${agent.config.output.perspective_words.join("–")} words · ARTICLE LENGTH: ${agent.config.output.article_words.join("–")} words · LANGUAGE: ${agent.config.output.language}\n\n# SOURCE PACK\n\n${blocks.join("\n\n")}`;
  return { text, sources, clusterIds: routed.map((c) => c.id) };
}

export function systemPromptFor(a: LoadedAgent) {
  const contract = readFileSync(path.join(process.cwd(), "agents/shared/output.md"), "utf8");
  return [a.systemPrompt, a.editorialPolicy, a.writingGuidelines, contract].join("\n\n---\n\n");
}

export type AgentRunResult = { agentId: string; status: "succeeded" | "failed" | "skipped" | "pending_manual"; runId?: string; detail?: string; costUsd?: number | null };

export async function runAgent(agentId: string, editionDate: string, opts: { jobRunId?: string } = {}): Promise<AgentRunResult> {
  const cfg = await getPipelineConfig();
  const versions = await syncAgents();
  const agent = loadAgent(agentId);
  const version = versions.find((v) => v.id === agentId)!.version;
  if (!agent.config.enabled || agent.config.schedule === "manual") return { agentId, status: "skipped", detail: "disabled or manual schedule" };

  // Idempotency: one successful run per agent per edition date unless regenerated.
  const done = await db.query.agentRuns.findFirst({ where: and(eq(schema.agentRuns.agentId, agentId), eq(schema.agentRuns.editionDate, editionDate), eq(schema.agentRuns.status, "succeeded")) });
  if (done) return { agentId, status: "succeeded", runId: done.id, detail: "already done" };

  const pack = await buildPack(agent, editionDate, cfg.ranking.max_clusters_per_agent);
  if (!pack.sources.length) {
    await log("warn", `agent:${agentId}`, "No routed stories — skipped", undefined, opts.jobRunId);
    return { agentId, status: "skipped", detail: "no routed stories" };
  }
  const provider = resolveProvider(agent.config.model.provider);
  const avail = provider.available();
  if (!avail.ok) return { agentId, status: "failed", detail: `provider ${provider.id} unavailable: ${avail.reason}` };

  // Supersede stale unfinished runs for this agent/date (e.g. earlier manual requests).
  await db.update(schema.agentRuns).set({ status: "cancelled", finishedAt: new Date() })
    .where(and(eq(schema.agentRuns.agentId, agentId), eq(schema.agentRuns.editionDate, editionDate), inArray(schema.agentRuns.status, ["queued", "running"])));
  const system = systemPromptFor(agent);
  // Stable run id per (agent, date, pack) so manual responses map to the same request.
  const promptHash = createHash("sha256").update(system + pack.text).digest("hex").slice(0, 16);
  const runKey = `${editionDate}-${agentId}-${promptHash.slice(0, 8)}`;
  const [run] = await db.insert(schema.agentRuns).values({
    agentId, configVersion: version, editionDate, providerId: provider.id, model: agent.config.model.name,
    status: "running", inputClusterIds: pack.clusterIds, inputSourceItemIds: pack.sources.map((s) => s.sourceItemId),
    promptHash, startedAt: new Date(),
  }).returning();

  let user = pack.text;
  let lastErrors: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await provider.generate({ model: agent.config.model.name, system, user, temperature: agent.config.model.temperature, topP: agent.config.model.top_p, maxTokens: agent.config.model.max_tokens, json: true, runId: attempt === 1 ? runKey : `${runKey}-repair` });
      const cost = estimateCost(res.model, res.inputTokens, res.outputTokens);
      let parsed: AgentOutput;
      try { parsed = AgentOutput.parse(extractJson(res.text)); }
      catch (e) { lastErrors = [`schema: ${(e as Error).message.slice(0, 600)}`]; parsed = null as never; }
      const v = parsed ? validateOutput(parsed, agent.config, pack.sources.length, new Set(pack.clusterIds)) : { errors: lastErrors, warnings: [] };
      await db.update(schema.agentRuns).set({
        rawOutput: res.text, inputTokens: (run.inputTokens ?? 0) + (res.inputTokens ?? 0), outputTokens: (run.outputTokens ?? 0) + (res.outputTokens ?? 0),
        costUsd: cost, validationErrors: [...v.errors, ...v.warnings.map((w) => `warning: ${w}`)], model: res.model,
      }).where(eq(schema.agentRuns.id, run.id));
      if (v.errors.length) {
        lastErrors = v.errors;
        // One repair round: return the validator's findings to the model.
        user = `${pack.text}\n\n# YOUR PREVIOUS ANSWER FAILED EDITORIAL QA\n${v.errors.map((e) => `- ${e}`).join("\n")}\n\nReturn a corrected JSON object only.`;
        continue;
      }
      await persistOutput(parsed, agentId, run.id, editionDate, pack);
      await db.update(schema.agentRuns).set({ status: "succeeded", finishedAt: new Date() }).where(eq(schema.agentRuns.id, run.id));
      await log("info", `agent:${agentId}`, `Run succeeded (article: ${parsed.article ? "yes" : "no"})`, { warnings: v.warnings }, opts.jobRunId);
      return { agentId, status: "succeeded", runId: run.id, costUsd: cost };
    } catch (e) {
      if (e instanceof ManualResponsePending) {
        await db.update(schema.agentRuns).set({ status: "queued", error: e.message }).where(eq(schema.agentRuns.id, run.id));
        return { agentId, status: "pending_manual", runId: run.id, detail: e.requestPath };
      }
      lastErrors = [(e as Error).message];
      break;
    }
  }
  await db.update(schema.agentRuns).set({ status: "failed", finishedAt: new Date(), error: lastErrors.join("; ").slice(0, 2000) }).where(eq(schema.agentRuns.id, run.id));
  await log("error", `agent:${agentId}`, "Run failed", { errors: lastErrors }, opts.jobRunId);
  return { agentId, status: "failed", runId: run.id, detail: lastErrors.join("; ") };
}

export async function persistOutput(o: AgentOutput, agentId: string, runId: string, editionDate: string, pack: Pack) {
  const byN = new Map(pack.sources.map((s) => [s.n, s]));
  // Renumber citations densely per text so the reader sees [1], [2], … in order.
  const citationsFor = (nums: number[]) => {
    const uniq = [...new Set(nums)];
    const map = new Map(uniq.map((n, i) => [n, i + 1]));
    const cits: Citation[] = uniq.map((n) => { const s = byN.get(n)!; return { ref: map.get(n)!, sourceItemId: s.sourceItemId, url: s.url, title: s.title, publisher: s.publisher, publishedAt: s.publishedAt }; });
    return { cits, map };
  };
  const p = citationsFor(o.perspective.refs);
  await db.insert(schema.perspectives).values({
    agentId, agentRunId: runId, editionDate, clusterId: o.cluster_id,
    headline: o.perspective.headline, body: o.perspective.body, language: "ru", citations: p.cits,
  });
  if (o.article) {
    const a = o.article;
    const { cits, map } = citationsFor([...a.paragraphs.flatMap((x) => x.refs), ...a.facts.flatMap((f) => f.refs)]);
    const body: ArticleBlock[] = a.paragraphs.map((x) => ({ type: "p", text: x.text, refs: x.refs.map((r) => map.get(r)!) }));
    await db.insert(schema.articles).values({
      agentId, agentRunId: runId, editionDate, clusterId: a.cluster_id, section: "analytics",
      headline: a.headline, dek: a.dek, body, citations: cits, language: "ru",
      facts: a.facts.map((f) => f.statement), interpretation: a.interpretation, uncertainties: a.uncertainties,
    });
    for (const f of a.facts) {
      const ids = f.refs.map((r) => byN.get(r)!.sourceItemId);
      const multi = new Set(f.refs.map((r) => byN.get(r)!.publisher)).size > 1;
      await db.insert(schema.claims).values({
        clusterId: a.cluster_id, agentRunId: runId, statement: f.statement, kind: "fact", sourceItemIds: ids,
        eventDate: f.event_date && /^\d{4}-\d{2}-\d{2}$/.test(f.event_date) ? f.event_date : null,
        status: multi ? "corroborated" : "single_source",
      });
    }
  }
}
