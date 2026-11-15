import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";

export const AGENT_KICKER: Record<string, string> = { orbix: "Технологии", apex: "Геополитика", meridian: "Экономика", lexicon: "Наука", archive: "Культура", gaya: "Энергетика и климат" };
export const VERIFY_LABEL: Record<string, string> = { corroborated: "подтверждено несколькими источниками", single_source: "один первоисточник", unverified: "один вторичный источник", conflicting: "источники расходятся", rejected: "отклонено" };
export const readMinutes = (blocks: { text: string }[]) => Math.max(1, Math.round(blocks.reduce((s, b) => s + b.text.split(/\s+/).length, 0) / 180));
export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
}
export const fmtPct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1).replace(".", ",")} %`;

/** Finance block: only from stored observations. Returns null when there are none. */
export async function financeSummary() {
  const top = await db.select({ instrument: schema.financialObservations.instrument, n: sql<number>`count(*)::int` })
    .from(schema.financialObservations).groupBy(schema.financialObservations.instrument).orderBy(desc(sql`count(*)`)).limit(1);
  if (!top.length) return null;
  const obs = (await db.select().from(schema.financialObservations).where(eq(schema.financialObservations.instrument, top[0].instrument))
    .orderBy(desc(schema.financialObservations.observedAt)).limit(60)).reverse();
  const last = obs.at(-1)!;
  const before = (ms: number) => [...obs].reverse().find((o) => last.observedAt.getTime() - o.observedAt.getTime() >= ms);
  const chg = (o?: typeof last) => (o && o.value ? ((last.value - o.value) / o.value) * 100 : null);
  return { instrument: last.instrument, source: last.source, asOf: last.observedAt, day: chg(before(20 * 3600_000)), week: chg(before(6.5 * 86400_000)), series: obs.slice(-10).map((o) => o.value) };
}

/** Projects with their latest observed snapshot. */
export async function projectsSummary(limit = 3) {
  const ps = await db.select().from(schema.projects).where(eq(schema.projects.active, true));
  const out = [];
  for (const p of ps) {
    const s = await db.query.projectSnapshots.findFirst({ where: eq(schema.projectSnapshots.projectId, p.id), orderBy: desc(schema.projectSnapshots.observedAt) });
    const kind = s?.blockers.length ? "blocker" : s?.decisions.length ? "decision" : s?.nextSteps.length ? "step" : s?.developments.length ? "update" : null;
    const text = s ? (s.blockers[0] ?? s.decisions[0] ?? s.nextSteps[0] ?? s.developments[0] ?? s.status ?? null) : null;
    out.push({ id: p.id, slug: p.slug, name: p.name, kind, text, observedAt: s?.observedAt ?? null, snapshot: s ?? null });
  }
  return out.sort((a, b) => (b.observedAt?.getTime() ?? 0) - (a.observedAt?.getTime() ?? 0)).slice(0, limit);
}

/** Progress: latest indicator vs previous period, computed from stored snapshots. */
export async function progressSummary() {
  const latest = await db.query.progressSnapshots.findFirst({ orderBy: desc(schema.progressSnapshots.periodEnd) });
  if (!latest) return null;
  const rows = (await db.select().from(schema.progressSnapshots).where(eq(schema.progressSnapshots.indicator, latest.indicator)).orderBy(desc(schema.progressSnapshots.periodEnd)).limit(10)).reverse();
  const prev = rows.at(-2);
  return { indicator: latest.indicator, value: latest.value, delta: prev ? latest.value - prev.value : null, series: rows.map((r) => r.value) };
}

/** AIMos: real workflow counts. Reach only from stored analytics observations. */
export async function aimosSummary() {
  const rows = await db.select({ status: schema.publicationDrafts.status, n: sql<number>`count(*)::int` }).from(schema.publicationDrafts).groupBy(schema.publicationDrafts.status);
  const n = (...s: string[]) => rows.filter((r) => s.includes(r.status)).reduce((a, r) => a + r.n, 0);
  const reach = await db.select({ wk: sql<string>`date_trunc('week', ${schema.analyticsObservations.observedAt})::date::text`, v: sql<number>`sum(${schema.analyticsObservations.value})::float` })
    .from(schema.analyticsObservations).where(eq(schema.analyticsObservations.metric, "impressions")).groupBy(sql`1`).orderBy(desc(sql`1`)).limit(2);
  const reachDelta = reach.length === 2 && reach[1].v ? ((reach[0].v - reach[1].v) / reach[1].v) * 100 : null;
  const channels = await db.select().from(schema.integrations).where(eq(schema.integrations.category, "publishing"));
  return { published: n("published"), drafts: n("draft", "rejected"), pending: n("in_review"), approved: n("approved", "scheduled"), reachDelta, hasReach: reach.length > 0, channels };
}
