import { NextResponse } from "next/server";
import { desc, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { safeEqual } from "@/lib/auth/session";
import { editionFreshness } from "@/lib/jobs/runner";
export const dynamic = "force-dynamic";

/**
 * Read-only health snapshot for remote checks: counts, statuses and error messages only —
 * no article text, no summaries, no personal data. Guarded by DIAG_TOKEN.
 */
export async function GET(req: Request) {
  const expected = process.env.DIAG_TOKEN ?? "";
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (expected.length < 16 || !safeEqual(token, expected)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const since = new Date(Date.now() - 36 * 3600_000);
  const [fresh, jobs, editions, sources, items, briefings, agentRuns, logs] = await Promise.all([
    editionFreshness(),
    db.select({ stage: schema.jobRuns.stage, date: schema.jobRuns.editionDate, status: schema.jobRuns.status, trigger: schema.jobRuns.trigger, attempt: schema.jobRuns.attempt, started: schema.jobRuns.startedAt, finished: schema.jobRuns.finishedAt, error: schema.jobRuns.error, stats: schema.jobRuns.stats })
      .from(schema.jobRuns).where(gte(schema.jobRuns.createdAt, since)).orderBy(desc(schema.jobRuns.createdAt)).limit(40),
    db.select({ date: schema.editions.editionDate, version: schema.editions.version, status: schema.editions.status, current: schema.editions.isCurrent, mode: schema.editions.generationMode, completeness: schema.editions.completeness, published: schema.editions.publishedAt })
      .from(schema.editions).orderBy(desc(schema.editions.editionDate), desc(schema.editions.version)).limit(6),
    db.select({ status: schema.sourceProviders.lastStatus, n: sql<number>`count(*)::int`, last: sql<string>`max(${schema.sourceProviders.lastFetchedAt})::text` }).from(schema.sourceProviders).groupBy(schema.sourceProviders.lastStatus),
    db.select({ n: sql<number>`count(*)::int`, last24h: sql<number>`count(*) filter (where ${schema.sourceItems.retrievedAt} > now() - interval '24 hours')::int`, clusters: sql<number>`(select count(*) from story_clusters)::int` }).from(schema.sourceItems),
    db.select({ source: schema.briefings.source, date: schema.briefings.editionDate, updated: schema.briefings.updatedAt, hasHeadline: sql<boolean>`${schema.briefings.headline} is not null`, items: sql<number>`(select count(*) from briefing_items i where i.briefing_id = "briefings"."id")::int` })
      .from(schema.briefings).orderBy(desc(schema.briefings.updatedAt)).limit(12),
    db.select({ agent: schema.agentRuns.agentId, date: schema.agentRuns.editionDate, status: schema.agentRuns.status, provider: schema.agentRuns.providerId, error: schema.agentRuns.error })
      .from(schema.agentRuns).where(gte(schema.agentRuns.createdAt, since)).orderBy(desc(schema.agentRuns.createdAt)).limit(12),
    db.select({ level: schema.systemLogs.level, scope: schema.systemLogs.scope, message: schema.systemLogs.message, at: schema.systemLogs.createdAt })
      .from(schema.systemLogs).where(gte(schema.systemLogs.createdAt, since)).orderBy(desc(schema.systemLogs.createdAt)).limit(25),
  ]);
  const failing = await db.select({ id: schema.sourceProviders.id, status: schema.sourceProviders.lastStatus, error: schema.sourceProviders.lastError }).from(schema.sourceProviders).where(sql`${schema.sourceProviders.lastStatus} is distinct from 'ok'`).limit(40);
  return NextResponse.json({
    now: new Date().toISOString(), freshness: fresh.state, today: fresh.today, hasModelKey: !!process.env.ANTHROPIC_API_KEY,
    editions, jobs: jobs.map((j) => ({ ...j, stats: j.stage === "collect" || j.stage === "process" ? j.stats : undefined })), sources, failingSources: failing, items: items[0], briefings, agentRuns, logs,
  });
}
