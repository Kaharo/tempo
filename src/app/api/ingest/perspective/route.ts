import { NextResponse } from "next/server";
import { db, schema } from "@/db/client";
import { safeEqual } from "@/lib/auth/session";
import { listAgentIds, loadAgent } from "@/lib/agents/config";
import { AgentOutput, validateOutput } from "@/lib/agents/output";
import { buildPack, persistOutput } from "@/lib/agents/run";
import { syncAgents } from "@/lib/agents/sync";
import { assembleEdition, publishEdition } from "@/lib/edition/assemble";
import { getPipelineConfig } from "@/lib/settings";
import { localDate } from "@/lib/dates";
import { log } from "@/lib/log";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Manual-execution channel for editors: a short perspective written outside TEMPO
 * (e.g. by a Claude session) against today's source pack. It passes the same QA gate
 * as API runs — citations must exist in the pack — and is recorded as provider "manual".
 *   ?token=…&agent=orbix&cluster=<story id>&headline=…&body=…&refs=1,2[&publish=1]
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const expected = process.env.INGEST_TOKEN ?? "";
  if (expected.length < 16 || !safeEqual(q.get("token") ?? "", expected)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const agentId = q.get("agent") ?? "";
  if (!listAgentIds().includes(agentId)) return NextResponse.json({ ok: false, error: `agent must be one of ${listAgentIds().join(", ")}` }, { status: 400 });
  try {
    const cfg = await getPipelineConfig();
    const date = localDate(process.env.TEMPO_TIMEZONE ?? cfg.timezone);
    const agent = loadAgent(agentId);
    const pack = await buildPack(agent, date, cfg.ranking.max_clusters_per_agent);
    if (!pack.sources.length) return NextResponse.json({ ok: false, error: "no routed stories for this agent today" }, { status: 409 });
    const refs = (q.get("refs") ?? "").split(",").map((x) => Number.parseInt(x.trim(), 10)).filter((n) => Number.isFinite(n));
    const parsed = AgentOutput.safeParse({ cluster_id: q.get("cluster") ?? "", perspective: { headline: (q.get("headline") ?? "").trim(), body: (q.get("body") ?? "").trim(), refs }, article: null });
    if (!parsed.success) return NextResponse.json({ ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 422 });
    const v = validateOutput(parsed.data, agent.config, pack.sources.length, new Set(pack.clusterIds));
    // A citation must also belong to the story the perspective is about.
    const foreign = refs.filter((n) => pack.sources.find((s) => s.n === n)?.clusterId !== parsed.data.cluster_id);
    if (foreign.length) v.errors.push(`citations [${foreign.join(", ")}] belong to a different story`);
    if (v.errors.length) return NextResponse.json({ ok: false, errors: v.errors }, { status: 422 });

    const version = (await syncAgents()).find((a) => a.id === agentId)!.version;
    const [run] = await db.insert(schema.agentRuns).values({
      agentId, configVersion: version, editionDate: date, providerId: "manual", model: "claude-session", status: "succeeded",
      inputClusterIds: pack.clusterIds, inputSourceItemIds: pack.sources.map((s) => s.sourceItemId),
      rawOutput: JSON.stringify(parsed.data), validationErrors: v.warnings.map((w) => `warning: ${w}`), startedAt: new Date(), finishedAt: new Date(),
    }).returning();
    await persistOutput(parsed.data, agentId, run.id, date, pack);
    await log("info", `agent:${agentId}`, "Perspective received through manual channel", { warnings: v.warnings });
    let edition: { version: number; status: string } | null = null;
    if (q.get("publish") === "1") {
      const a = await assembleEdition(date, { force: true, mode: "manual" });
      await publishEdition(date);
      edition = { version: a.edition.version, status: a.edition.status };
    }
    return NextResponse.json({ ok: true, agent: agentId, date, warnings: v.warnings, edition });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message.slice(0, 300) }, { status: 500 });
  }
}
