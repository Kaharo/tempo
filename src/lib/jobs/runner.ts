import { and, desc, eq, sum } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { getPipelineConfig } from "@/lib/settings";
import { localDate, localHHMM } from "@/lib/dates";
import { log } from "@/lib/log";
import { collect } from "@/lib/sources/collect";
import { processStories } from "@/lib/pipeline/process";
import { listAgentIds } from "@/lib/agents/config";
import { runAgent, type AgentRunResult } from "@/lib/agents/run";
import { assembleEdition, publishEdition } from "@/lib/edition/assemble";

export const STAGES = ["collect", "process", "agents", "assemble", "publish"] as const;
const SOFT_STAGES = new Set<string>(["collect"]);
export type Stage = (typeof STAGES)[number];
export type Trigger = "schedule" | "manual" | "retry";

const mode = () => (process.env.TEMPO_MODE === "manual" ? "manual" : "api") as "api" | "manual";

async function spentToday(editionDate: string) {
  const r = await db.select({ s: sum(schema.agentRuns.costUsd) }).from(schema.agentRuns).where(eq(schema.agentRuns.editionDate, editionDate));
  return Number(r[0]?.s ?? 0);
}

async function execute(stage: Stage, editionDate: string, force: boolean, jobRunId: string) {
  switch (stage) {
    case "collect": return collect({ force, jobRunId });
    case "process": return processStories({ jobRunId });
    case "agents": {
      const budget = Number(process.env.TEMPO_DAILY_BUDGET_USD ?? 3);
      const results: AgentRunResult[] = [];
      for (const id of listAgentIds()) {
        if ((await spentToday(editionDate)) >= budget) { results.push({ agentId: id, status: "skipped", detail: `daily budget $${budget} reached` }); continue; }
        results.push(await runAgent(id, editionDate, { jobRunId }));
      }
      const failed = results.filter((r) => r.status === "failed");
      const pending = results.filter((r) => r.status === "pending_manual");
      if (failed.length === results.length) throw new Error(`All agents failed: ${failed.map((f) => `${f.agentId}: ${f.detail}`).join(" | ")}`);
      return { results, failed: failed.length, pendingManual: pending.length, costUsd: results.reduce((s, r) => s + (r.costUsd ?? 0), 0) };
    }
    case "assemble": return (await assembleEdition(editionDate, { force, mode: mode(), jobRunId })).edition;
    case "publish": return publishEdition(editionDate, { jobRunId });
  }
}

/**
 * Idempotent stage execution with retries and job history.
 * Key = stage:date. A succeeded key is not re-run unless force=true (manual regeneration).
 */
export async function runStage(stage: Stage, editionDate: string, trigger: Trigger, force = false) {
  const key = `${stage}:${editionDate}`;
  const prior = await db.query.jobRuns.findFirst({ where: eq(schema.jobRuns.idempotencyKey, key), orderBy: desc(schema.jobRuns.createdAt) });
  if (!force && prior?.status === "succeeded") return { skipped: true, jobRun: prior };
  if (prior?.status === "running" && prior.startedAt && Date.now() - prior.startedAt.getTime() < 20 * 60_000) return { skipped: true, jobRun: prior, reason: "already running" };

  const cfg = await getPipelineConfig();
  const attempts = await db.select({ id: schema.jobRuns.id }).from(schema.jobRuns).where(and(eq(schema.jobRuns.idempotencyKey, key), eq(schema.jobRuns.status, "failed")));
  if (!force && attempts.length >= cfg.retry.max_attempts) return { skipped: true, jobRun: prior, reason: "max attempts reached — needs manual retry" };

  const [jr] = await db.insert(schema.jobRuns).values({ stage, editionDate, idempotencyKey: key, trigger, status: "running", attempt: attempts.length + 1, startedAt: new Date() }).returning();
  try {
    const result = await execute(stage, editionDate, force, jr.id);
    const stats = JSON.parse(JSON.stringify(result ?? {}));
    await db.update(schema.jobRuns).set({ status: "succeeded", finishedAt: new Date(), stats, costUsd: (result as { costUsd?: number })?.costUsd ?? 0 }).where(eq(schema.jobRuns.id, jr.id));
    return { skipped: false, jobRun: { ...jr, status: "succeeded" as const }, result };
  } catch (e) {
    const msg = (e as Error).message;
    await db.update(schema.jobRuns).set({ status: "failed", finishedAt: new Date(), error: msg.slice(0, 4000) }).where(eq(schema.jobRuns.id, jr.id));
    await log("error", `job:${stage}`, msg, undefined, jr.id);
    return { skipped: false, jobRun: { ...jr, status: "failed" as const }, error: msg };
  }
}

/** Run the full chain now (manual regeneration). */
export async function runAll(editionDate: string, trigger: Trigger = "manual", force = false) {
  const out = [];
  for (const s of STAGES) {
    const r = await runStage(s, editionDate, trigger, force);
    out.push({ stage: s, ...r });
    if ("error" in r && r.error) break;
  }
  return out;
}

/**
 * Scheduler tick — called every ~15 min by an external clock (GitHub Actions
 * or Vercel Cron). Runs every stage whose local time has passed and which has
 * not succeeded today, in order. Safe to call any number of times.
 * Failed stages are retried on later ticks after their backoff elapses.
 */
export async function tick(now = new Date()) {
  const cfg = await getPipelineConfig();
  const tz = process.env.TEMPO_TIMEZONE ?? cfg.timezone;
  const date = localDate(tz, now);
  const hhmm = localHHMM(tz, now);
  const ran: { stage: Stage; status: string; note?: string }[] = [];
  for (const stage of STAGES) {
    if (hhmm < cfg.schedule[stage]) break; // later stages not due yet
    const last = await db.query.jobRuns.findFirst({ where: eq(schema.jobRuns.idempotencyKey, `${stage}:${date}`), orderBy: desc(schema.jobRuns.createdAt) });
    if (last?.status === "succeeded") continue;
    if (last?.status === "failed") {
      const failures = (await db.select({ id: schema.jobRuns.id }).from(schema.jobRuns).where(and(eq(schema.jobRuns.idempotencyKey, `${stage}:${date}`), eq(schema.jobRuns.status, "failed")))).length;
      const wait = (cfg.retry.backoff_seconds[failures - 1] ?? cfg.retry.backoff_seconds.at(-1) ?? 600) * 1000;
      if (last.finishedAt && now.getTime() - last.finishedAt.getTime() < wait) {
        ran.push({ stage, status: "waiting_backoff" });
        if (SOFT_STAGES.has(stage)) continue;
        break;
      }
    }
    const r = await runStage(stage, date, last ? "retry" : "schedule");
    ran.push({ stage, status: r.skipped ? "skipped" : (r.jobRun?.status ?? "unknown"), note: (r as { reason?: string; error?: string }).reason ?? (r as { error?: string }).error });
    // Collection is "soft": later stages proceed with what was already gathered,
    // while collection keeps retrying on later ticks. Other failures stop the chain.
    if (!r.skipped && r.jobRun?.status !== "succeeded" && !SOFT_STAGES.has(stage)) break;
  }
  return { date, localTime: hhmm, tz, ran };
}

/** Freshness of the current edition, for the UI. */
export async function editionFreshness(now = new Date()) {
  const cfg = await getPipelineConfig();
  const tz = process.env.TEMPO_TIMEZONE ?? cfg.timezone;
  const today = localDate(tz, now); const hhmm = localHHMM(tz, now);
  const current = await db.query.editions.findFirst({ where: eq(schema.editions.isCurrent, true) });
  if (!current) return { state: "unavailable" as const, today, edition: null };
  if (current.editionDate === today) return { state: current.status === "incomplete" ? ("incomplete" as const) : ("fresh" as const), today, edition: current };
  return { state: hhmm >= cfg.schedule.publish ? ("delayed" as const) : ("previous" as const), today, edition: current };
}
