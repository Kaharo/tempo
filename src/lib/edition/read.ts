import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";

/** Full edition payload for the UI and API: everything resolved, with traceability. */
export async function getEdition(opts: { date?: string } = {}) {
  const ed = opts.date
    ? await db.query.editions.findFirst({ where: and(eq(schema.editions.editionDate, opts.date)), orderBy: desc(schema.editions.version) })
    : await db.query.editions.findFirst({ where: eq(schema.editions.isCurrent, true) });
  if (!ed) return null;
  const L = ed.layout;
  const articleIds = [L.leadArticleId, ...L.supportingArticleIds].filter((x): x is string => !!x);
  const arts = articleIds.length ? await db.select().from(schema.articles).where(inArray(schema.articles.id, articleIds)) : [];
  const persp = L.perspectiveIds.length ? await db.select().from(schema.perspectives).where(inArray(schema.perspectives.id, L.perspectiveIds)) : [];
  const runIds = [...arts.map((a) => a.agentRunId), ...persp.map((p) => p.agentRunId)];
  const runs = runIds.length ? await db.select({ id: schema.agentRuns.id, agentId: schema.agentRuns.agentId, providerId: schema.agentRuns.providerId, model: schema.agentRuns.model, configVersion: schema.agentRuns.configVersion, costUsd: schema.agentRuns.costUsd }).from(schema.agentRuns).where(inArray(schema.agentRuns.id, runIds)) : [];
  const world = L.worldClusterIds.length ? await db.select().from(schema.storyClusters).where(inArray(schema.storyClusters.id, L.worldClusterIds)) : [];
  const worldItems = world.length ? await db.select({ i: schema.sourceItems, p: schema.sourceProviders }).from(schema.sourceItems).innerJoin(schema.sourceProviders, eq(schema.sourceItems.providerId, schema.sourceProviders.id)).where(inArray(schema.sourceItems.clusterId, world.map((w) => w.id))) : [];
  const agents = await db.select().from(schema.agents);
  const integrations = await db.select().from(schema.integrations);
  const byId = <T extends { id: string }>(xs: T[], id: string) => xs.find((x) => x.id === id);
  const order = ["orbix", "apex", "meridian", "lexicon", "archive", "gaya"];
  return {
    edition: { id: ed.id, date: ed.editionDate, version: ed.version, status: ed.status, mode: ed.generationMode, publishedAt: ed.publishedAt, completeness: ed.completeness, notes: L.notes },
    lead: L.leadArticleId ? { ...byId(arts, L.leadArticleId)!, run: runs.find((r) => r.id === byId(arts, L.leadArticleId!)?.agentRunId) } : null,
    supporting: L.supportingArticleIds.map((id) => byId(arts, id)).filter(Boolean),
    perspectives: persp.sort((a, b) => order.indexOf(a.agentId) - order.indexOf(b.agentId)).map((p) => ({ ...p, agentName: agents.find((a) => a.id === p.agentId)?.name, run: runs.find((r) => r.id === p.agentRunId) })),
    world: world.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map((c) => ({ id: c.id, label: c.label, verification: c.verification, score: c.score, sources: worldItems.filter((w) => w.i.clusterId === c.id).map((w) => ({ title: w.i.title, url: w.i.url, publisher: w.p.name, publishedAt: w.i.publishedAt })) })),
    integrations: integrations.map((i) => ({ id: i.id, category: i.category, state: i.state, detail: i.detail })),
  };
}

export async function listEditions(limit = 60) {
  return db.select({ date: schema.editions.editionDate, version: schema.editions.version, status: schema.editions.status, isCurrent: schema.editions.isCurrent, mode: schema.editions.generationMode })
    .from(schema.editions).orderBy(desc(schema.editions.editionDate), desc(schema.editions.version)).limit(limit);
}
