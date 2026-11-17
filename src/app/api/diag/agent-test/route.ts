import { NextResponse, after } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { safeEqual } from "@/lib/auth/session";
import { listAgentIds, loadAgent } from "@/lib/agents/config";
import { AgentOutput, extractJson, validateOutput } from "@/lib/agents/output";
import { buildPack, systemPromptFor } from "@/lib/agents/run";
import { estimateCost, resolveModel } from "@/lib/ai/registry";
import { getPipelineConfig } from "@/lib/settings";
import { localDate } from "@/lib/dates";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Dry run of one editor on today's pack: calls the model, runs the QA gate, publishes nothing.
 * The model can take minutes, so `?start=1` launches the run in the background and a plain call returns the last result.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const expected = process.env.DIAG_TOKEN ?? "";
  if (expected.length < 16 || !safeEqual(q.get("token") ?? "", expected)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const agentId = q.get("agent") ?? "";
  if (!listAgentIds().includes(agentId)) return NextResponse.json({ error: `agent must be one of ${listAgentIds().join(", ")}` }, { status: 400 });
  const key = `diag:agent-test:${agentId}`;
  const save = (value: unknown) => db.insert(schema.settings).values({ key, value: value as object }).onConflictDoUpdate({ target: schema.settings.key, set: { value: value as object, updatedAt: new Date() } });
  if (q.get("start") !== "1") {
    const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, key) });
    return NextResponse.json(row ? { updatedAt: row.updatedAt, ...(row.value as object) } : { state: "never run" });
  }
  await save({ state: "running", startedAt: new Date().toISOString() });
  after(async () => { await save(await dryRun(agentId).catch((e) => ({ ok: false, error: (e as Error).message.slice(0, 400) }))); });
  return NextResponse.json({ state: "started" });
}

async function dryRun(agentId: string): Promise<Record<string, unknown>> {
  const cfg = await getPipelineConfig();
  const agent = loadAgent(agentId);
  const pack = await buildPack(agent, localDate(process.env.TEMPO_TIMEZONE ?? cfg.timezone), cfg.ranking.max_clusters_per_agent);
  const { provider, model } = resolveModel(agent.config.model.provider, agent.config.model.name);
  const a = provider.available();
  if (!a.ok) return { ok: false, error: a.reason };
  const t0 = Date.now();
  try {
    const r = await provider.generate({ model, system: systemPromptFor(agent), user: pack.text, temperature: agent.config.model.temperature, maxTokens: agent.config.model.max_tokens, json: true, runId: "diag" });
    let parsed: AgentOutput | null = null; let errors: string[] = []; let warnings: string[] = [];
    try { parsed = AgentOutput.parse(extractJson(r.text)); const v = validateOutput(parsed, agent.config, pack.sources.length, new Set(pack.clusterIds)); errors = v.errors; warnings = v.warnings; }
    catch (e) { errors = [`schema: ${(e as Error).message.slice(0, 500)}`]; }
    return { state: "done", ok: errors.length === 0, model: r.model, seconds: Math.round((Date.now() - t0) / 1000), inputTokens: r.inputTokens, outputTokens: r.outputTokens, costUsd: estimateCost(model, r.inputTokens, r.outputTokens), errors, warnings,
      perspective: parsed?.perspective ?? null, article: parsed?.article ? { headline: parsed.article.headline, dek: parsed.article.dek, paragraphs: parsed.article.paragraphs, uncertainties: parsed.article.uncertainties } : null, raw: parsed ? undefined : r.text.slice(0, 1500) };
  } catch (e) {
    return { state: "done", ok: false, seconds: Math.round((Date.now() - t0) / 1000), error: (e as Error).message.slice(0, 400) };
  }
}
