import { and, desc, eq, gte, inArray, ne } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { EditionLayout } from "@/db/schema";
import { getPipelineConfig } from "@/lib/settings";
import { listAgentIds } from "@/lib/agents/config";
import { log } from "@/lib/log";

/** Stage F: build a coherent edition from stored outputs. No model calls. */
export async function assembleEdition(editionDate: string, opts: { force?: boolean; mode: "api" | "manual"; jobRunId?: string }) {
  const cfg = await getPipelineConfig();
  const existing = await db.query.editions.findFirst({ where: eq(schema.editions.editionDate, editionDate), orderBy: desc(schema.editions.version) });
  if (existing && !opts.force && ["complete", "published"].includes(existing.status)) return { edition: existing, created: false };

  const okRuns = await db.select({ id: schema.agentRuns.id }).from(schema.agentRuns)
    .where(and(eq(schema.agentRuns.editionDate, editionDate), eq(schema.agentRuns.status, "succeeded")));
  const runIds = okRuns.map((r) => r.id);
  const persp = runIds.length ? await db.select().from(schema.perspectives).where(inArray(schema.perspectives.agentRunId, runIds)).orderBy(desc(schema.perspectives.createdAt)) : [];
  const arts = runIds.length ? await db.select().from(schema.articles).where(inArray(schema.articles.agentRunId, runIds)) : [];

  // One perspective per agent, in canonical agent order.
  const agentOrder = ["orbix", "apex", "meridian", "lexicon", "archive", "gaya"].filter((a) => listAgentIds().includes(a));
  const perspectiveIds = agentOrder.map((a) => persp.find((p) => p.agentId === a)?.id).filter((x): x is string => !!x);

  const clusterIds = [...new Set([...arts.map((a) => a.clusterId), ...persp.map((p) => p.clusterId)].filter((x): x is string => !!x))];
  const clusters = clusterIds.length ? await db.select().from(schema.storyClusters).where(inArray(schema.storyClusters.id, clusterIds)) : [];
  const cScore = new Map(clusters.map((c) => [c.id, c]));

  // Lead: strongest article on a verified story; avoid two articles on the same story.
  const rankA = (a: typeof arts[number]) => {
    const c = a.clusterId ? cScore.get(a.clusterId) : undefined;
    const bonus = c?.verification === "corroborated" ? 0.15 : c?.verification === "single_source" ? 0.05 : -0.3;
    return (c?.score ?? 0) + bonus + Math.min(0.1, a.citations.length * 0.02);
  };
  const sorted = [...arts].sort((x, y) => rankA(y) - rankA(x));
  const seenClusters = new Set<string>();
  const unique = sorted.filter((a) => { const k = a.clusterId ?? a.id; if (seenClusters.has(k)) return false; seenClusters.add(k); return true; });
  const lead = unique[0] ?? null;
  const supporting = unique.slice(1, 1 + cfg.edition.supporting_articles).map((a) => a.id);

  // World: top verified stories of the last 36h not already covered.
  const covered = new Set([...seenClusters, ...persp.map((p) => p.clusterId).filter(Boolean) as string[]]);
  const world = await db.select({ id: schema.storyClusters.id }).from(schema.storyClusters)
    .where(and(gte(schema.storyClusters.lastSeenAt, new Date(Date.now() - 36 * 3600_000)), ne(schema.storyClusters.verification, "rejected")))
    .orderBy(desc(schema.storyClusters.score)).limit(cfg.edition.world_items * 3);
  const worldIds = world.map((w) => w.id).filter((id) => !covered.has(id)).slice(0, cfg.edition.world_items);

  const integrations = await db.select().from(schema.integrations);
  const st = (cat: string) => integrations.filter((i) => i.category === cat).some((i) => i.state === "connected") ? "connected" : "unavailable";
  const completeness: Record<string, string> = {
    lead: lead ? "ok" : "missing",
    perspectives: `${perspectiveIds.length}/${agentOrder.length}`,
    world: `${worldIds.length}`,
    finance: st("finance"), projects: st("projects"), calendar: st("calendar"), aimos: st("publishing"),
  };
  const notes: string[] = [];
  const missingAgents = agentOrder.filter((a) => !persp.some((p) => p.agentId === a));
  if (missingAgents.length) notes.push(`Нет мнения от: ${missingAgents.map((a) => a.toUpperCase()).join(", ")}`);
  if (!okRuns.length) notes.splice(0, notes.length, "Редакторы не запускались: нет доступа к модели");
  // Without a long article the overview leads with the strongest editor perspective ("news of the day").
  if (!lead && perspectiveIds.length) completeness.lead = "from_perspective";
  const full = perspectiveIds.length === agentOrder.length && (lead || perspectiveIds.length > 0);
  const status = full ? "complete" : lead || perspectiveIds.length || worldIds.length ? "incomplete" : "failed";

  const layout: EditionLayout = { leadArticleId: lead?.id ?? null, supportingArticleIds: supporting, perspectiveIds, worldClusterIds: worldIds, ideaArticleIds: [], notes };
  const [edition] = await db.insert(schema.editions).values({
    editionDate, version: (existing?.version ?? 0) + 1, status, leadArticleId: lead?.id ?? null, layout, completeness,
    generationMode: opts.mode, assembledAt: new Date(),
  }).returning();
  await log(status === "complete" ? "info" : "warn", "assemble", `Edition ${editionDate} v${edition.version}: ${status}`, completeness, opts.jobRunId);
  return { edition, created: true };
}

/** Stage G: make the newest assembled version current; keep history. */
export async function publishEdition(editionDate: string, opts: { jobRunId?: string } = {}) {
  const ed = await db.query.editions.findFirst({ where: eq(schema.editions.editionDate, editionDate), orderBy: desc(schema.editions.version) });
  if (!ed) throw new Error(`No assembled edition for ${editionDate}`);
  if (ed.status === "failed") throw new Error(`Edition ${editionDate} v${ed.version} failed assembly; not publishing`);
  if (ed.isCurrent && ed.status === "published") return ed;
  await db.transaction(async (tx) => {
    await tx.update(schema.editions).set({ isCurrent: false }).where(eq(schema.editions.isCurrent, true));
    await tx.update(schema.editions).set({ status: "superseded" }).where(and(eq(schema.editions.editionDate, editionDate), ne(schema.editions.id, ed.id), eq(schema.editions.status, "published")));
    await tx.update(schema.editions).set({ isCurrent: true, status: ed.status === "incomplete" ? "incomplete" : "published", publishedAt: new Date() }).where(eq(schema.editions.id, ed.id));
  });
  await log("info", "publish", `Published edition ${editionDate} v${ed.version}`, undefined, opts.jobRunId);
  return ed;
}
