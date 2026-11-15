/**
 * Stage B–D: deduplicate & cluster → verify → score → route.
 * Deterministic and model-free, so it is cheap, testable and repeatable.
 */
import { and, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { getPipelineConfig } from "@/lib/settings";
import { loadAllAgents, type LoadedAgent } from "@/lib/agents/config";
import { log } from "@/lib/log";
import { jaccard, titleTokens } from "./normalize";

type Item = typeof schema.sourceItems.$inferSelect & { tier: number };
type Cluster = { items: Item[]; tokens: string[]; context: Set<string> };

/** Tokens of title + summary, used for containment matching of short headlines. */
const contextTokens = (it: Pick<Item, "title" | "summary">) => new Set(titleTokens(`${it.title} ${it.summary ?? ""}`));

/**
 * Similarity between an item and a cluster:
 *  - title Jaccard (good for rewrites of the same headline), or
 *  - containment: share of the shorter headline's tokens found in the other side's
 *    title+summary (catches "Introducing X" vs "X lets agents do Y"). Requires ≥2
 *    shared distinctive tokens and reports within 72h to avoid false merges.
 */
export function similarity(it: Item, toks: string[], ctx: Set<string>, c: Cluster): number {
  const jac = jaccard(toks, c.tokens);
  const near = c.items.some((o) => Math.abs((o.publishedAt?.getTime() ?? 0) - (it.publishedAt?.getTime() ?? 0)) < 72 * 3600_000);
  if (!near) return jac;
  const fwd = toks.filter((t) => c.context.has(t));
  const back = c.tokens.filter((t) => ctx.has(t));
  const shared = Math.max(fwd.length, back.length);
  const containment = shared >= 2 ? Math.max(fwd.length / Math.max(1, toks.length), back.length / Math.max(1, c.tokens.length)) * 0.8 : 0;
  return Math.max(jac, containment);
}

// ---------- B. clustering ----------
export function clusterItems(items: Item[], threshold: number): Cluster[] {
  const sorted = [...items].sort((a, b) => (a.publishedAt?.getTime() ?? 0) - (b.publishedAt?.getTime() ?? 0));
  const clusters: Cluster[] = [];
  for (const it of sorted) {
    const toks = titleTokens(it.title);
    const ctx = contextTokens(it);
    let best: Cluster | null = null; let bestSim = 0;
    for (const c of clusters) {
      const sim = it.fingerprint === c.items[0].fingerprint ? 1 : similarity(it, toks, ctx, c);
      if (sim > bestSim) { bestSim = sim; best = c; }
    }
    if (best && bestSim >= threshold) {
      best.items.push(it);
      best.tokens = [...new Set([...best.tokens, ...toks])];
      ctx.forEach((t) => best!.context.add(t));
    } else clusters.push({ items: [it], tokens: toks, context: ctx });
  }
  return clusters;
}

// ---------- C. verification ----------
export function verifyCluster(items: Item[], now = new Date()) {
  const notes: string[] = [];
  const providers = new Set(items.map((i) => i.providerId));
  const bestTier = Math.min(...items.map((i) => i.tier));
  for (const i of items) {
    if (!i.publishedAt) notes.push(`No publication date: ${i.providerId}`);
    else if (i.publishedAt.getTime() > now.getTime() + 3600_000) notes.push(`Publication date in the future: ${i.providerId} (${i.publishedAt.toISOString()})`);
  }
  const dates = items.map((i) => i.publishedAt?.getTime()).filter((d): d is number => !!d);
  if (dates.length > 1 && Math.max(...dates) - Math.min(...dates) > 5 * 86400_000) notes.push("Reports span more than 5 days — check whether this is one event or several");
  let status: "corroborated" | "single_source" | "unverified";
  if (providers.size >= 2) status = "corroborated";
  else if (bestTier === 1) { status = "single_source"; notes.push("Single original/authoritative source — claims attributed to it, not independently confirmed"); }
  else { status = "unverified"; notes.push("Single secondary source — needs corroboration before use as a lead"); }
  return { status, notes, distinctProviders: providers.size, bestTier };
}

// ---------- D. scoring ----------
export type Prefs = { preferredTopics: string[]; mutedTopics: string[]; preferredSources: string[]; mutedSources: string[]; geographicInterests: string[] };

export function scoreCluster(c: Cluster, v: ReturnType<typeof verifyCluster>, prefs: Prefs, projectTerms: string[], longTerm: string[], weights: Record<string, number>, seenBefore: boolean, now = new Date()) {
  const topics = new Set(c.items.flatMap((i) => i.topics));
  const text = c.items.map((i) => `${i.title} ${i.summary ?? ""}`).join(" ").toLowerCase();
  const hit = (terms: string[]) => terms.filter((t) => topics.has(t) || text.includes(t.toLowerCase())).length;

  const interest = Math.min(1, (hit(prefs.preferredTopics) + hit(prefs.geographicInterests)) / 2 + (c.items.some((i) => prefs.preferredSources.includes(i.providerId)) ? 0.2 : 0));
  const importance = Math.min(1, (v.distinctProviders - 1) / 3 + (v.bestTier === 1 ? 0.35 : v.bestTier === 2 ? 0.15 : 0));
  const newest = Math.max(...c.items.map((i) => i.publishedAt?.getTime() ?? i.retrievedAt.getTime()));
  const ageH = Math.max(0, (now.getTime() - newest) / 3600_000);
  const novelty = (seenBefore ? 0.3 : 1) * Math.exp(-ageH / 36);
  const reliability = v.status === "corroborated" ? 1 : v.status === "single_source" ? 0.75 : 0.35;
  const projectRelevance = Math.min(1, hit(projectTerms) / 2);
  const longTermSig = Math.min(1, hit(longTerm) / 2);

  const signals: Record<string, number> = {
    personal_interest: interest, editorial_importance: importance, novelty, reliability,
    project_relevance: projectRelevance, long_term_significance: longTermSig,
  };
  let score = Object.entries(signals).reduce((s, [k, val]) => s + (weights[k] ?? 0) * val, 0);
  const muted = hit(prefs.mutedTopics) > 0 || c.items.every((i) => prefs.mutedSources.includes(i.providerId));
  if (muted) score *= 0.1;
  signals.muted = muted ? 1 : 0;
  return { score: Math.round(score * 1000) / 1000, signals };
}

// ---------- E. routing ----------
export function routeCluster(c: Cluster, agents: LoadedAgent[]): string[] {
  return routeWithFit(c, agents).map((x) => x.id);
}

/** Domain fit per agent: 2 per matching topic + 1 per matching keyword. ≥2 routes. Top 3 kept. */
export function routeWithFit(c: Cluster, agents: LoadedAgent[]): { id: string; s: number }[] {
  const topics = new Set(c.items.flatMap((i) => i.topics));
  const text = c.items.map((i) => `${i.title} ${i.summary ?? ""}`).join(" ").toLowerCase();
  const scored = agents.filter((a) => a.config.enabled).map((a) => {
    const topicHits = a.config.topics.filter((t) => topics.has(t)).length;
    const kwHits = a.config.keywords.filter((k) => new RegExp(`\\b${k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(text)).length;
    return { id: a.config.id, s: topicHits * 2 + kwHits };
  }).filter((x) => x.s >= 2).sort((a, b) => b.s - a.s);
  return scored.slice(0, 3); // multiple perspectives allowed, capped
}

// ---------- stage runner ----------
export async function processStories(opts: { jobRunId?: string } = {}) {
  const cfg = await getPipelineConfig();
  const since = new Date(Date.now() - cfg.clustering.window_hours * 3600_000);
  const rows = await db.select({ item: schema.sourceItems, tier: schema.sourceProviders.tier })
    .from(schema.sourceItems)
    .innerJoin(schema.sourceProviders, eq(schema.sourceItems.providerId, schema.sourceProviders.id))
    .where(or(gte(schema.sourceItems.publishedAt, since), and(isNull(schema.sourceItems.publishedAt), gte(schema.sourceItems.retrievedAt, since))));
  const items: Item[] = rows.map((r) => ({ ...r.item, tier: r.tier }));
  if (!items.length) { await log("warn", "process", "No source items in window"); return { items: 0, clusters: 0 }; }

  const user = await db.query.users.findFirst();
  const prefRow = user ? await db.query.preferences.findFirst({ where: eq(schema.preferences.userId, user.id) }) : undefined;
  const prefs: Prefs = prefRow ?? { preferredTopics: [], mutedTopics: [], preferredSources: [], mutedSources: [], geographicInterests: [] };
  const weights = { ...cfg.ranking.weights, ...(prefRow?.rankingWeights ?? {}) };
  const projects = await db.select().from(schema.projects);
  const projectTerms = projects.flatMap((p) => [p.name, p.slug]).filter(Boolean);
  const agents = loadAllAgents();

  // Items already assigned to a cluster that was featured earlier count as "seen".
  const featuredClusterIds = new Set((await db.select({ c: schema.perspectives.clusterId }).from(schema.perspectives)).map((r) => r.c).filter(Boolean));

  const clusters = clusterItems(items, cfg.clustering.title_similarity_threshold);
  let written = 0;
  for (const c of clusters) {
    const v = verifyCluster(c.items);
    const prior = c.items.map((i) => i.clusterId).find(Boolean) ?? null;
    const seen = prior ? featuredClusterIds.has(prior) : false;
    const { score, signals } = scoreCluster(c, v, prefs, projectTerms, cfg.ranking.long_term_topics, weights, seen);
    const fits = routeWithFit(c, agents);
    const routed = fits.map((f) => f.id);
    for (const f of fits) signals[`fit_${f.id}`] = f.s;
    const lead = [...c.items].sort((a, b) => a.tier - b.tier || (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))[0];
    const times = c.items.map((i) => (i.publishedAt ?? i.retrievedAt).getTime());
    const values = {
      label: lead.title, topics: [...new Set(c.items.flatMap((i) => i.topics))],
      firstSeenAt: new Date(Math.min(...times)), lastSeenAt: new Date(Math.max(...times)),
      itemCount: c.items.length, distinctProviders: v.distinctProviders, bestTier: v.bestTier,
      verification: v.status, verificationNotes: v.notes, score, scoreBreakdown: signals, routedAgents: routed, updatedAt: new Date(),
    } satisfies typeof schema.storyClusters.$inferInsert;
    let clusterId = prior;
    if (clusterId) await db.update(schema.storyClusters).set(values).where(eq(schema.storyClusters.id, clusterId));
    else clusterId = (await db.insert(schema.storyClusters).values(values).returning({ id: schema.storyClusters.id }))[0].id;
    await db.update(schema.sourceItems).set({ clusterId }).where(inArray(schema.sourceItems.id, c.items.map((i) => i.id)));
    written++;
  }
  // Remove clusters left empty by re-clustering, unless editorial output references them.
  await db.execute(sql`delete from story_clusters c where not exists (select 1 from source_items i where i.cluster_id = c.id)
    and not exists (select 1 from perspectives p where p.cluster_id = c.id) and not exists (select 1 from articles a where a.cluster_id = c.id)
    and not exists (select 1 from claims cl where cl.cluster_id = c.id)`);
  const stats = { items: items.length, clusters: written, multiSource: clusters.filter((c) => new Set(c.items.map((i) => i.providerId)).size > 1).length };
  await log("info", "process", `Clustered ${stats.items} items into ${stats.clusters} stories (${stats.multiSource} multi-source)`, stats, opts.jobRunId);
  return stats;
}
