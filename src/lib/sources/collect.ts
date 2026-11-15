import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { loadSources } from "@/lib/config";
import { getPipelineConfig } from "@/lib/settings";
import { log } from "@/lib/log";
import { canonicalUrl, fingerprint } from "@/lib/pipeline/normalize";
import { adapters } from "./adapters";
import { robotsAllows } from "./robots";

/** Upsert registry YAML into source_providers (YAML is the source of truth for definitions). */
export async function syncSourceRegistry() {
  const defs = loadSources();
  for (const d of defs) {
    await db.insert(schema.sourceProviders).values({ ...d, homepage: d.homepage ?? null })
      .onConflictDoUpdate({
        target: schema.sourceProviders.id,
        set: { name: d.name, kind: d.kind, url: d.url, homepage: d.homepage ?? null, tier: d.tier, topics: d.topics, language: d.language, enabled: d.enabled },
      });
  }
  return defs.length;
}

export type CollectStats = { sources: number; ok: number; errors: number; blocked: number; skipped: number; newItems: number; failures: { id: string; error: string }[] };

export async function collect(opts: { force?: boolean; only?: string[]; jobRunId?: string } = {}): Promise<CollectStats> {
  await syncSourceRegistry();
  const cfg = await getPipelineConfig();
  const c = cfg.collection;
  let providers = await db.select().from(schema.sourceProviders).where(eq(schema.sourceProviders.enabled, true));
  if (opts.only?.length) providers = providers.filter((p) => opts.only!.includes(p.id));
  const stats: CollectStats = { sources: providers.length, ok: 0, errors: 0, blocked: 0, skipped: 0, newItems: 0, failures: [] };
  const cutoff = Date.now() - c.lookback_hours * 3600_000;

  // Bounded concurrency: polite to sources, fast enough for ~30 feeds.
  const queue = [...providers];
  const worker = async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      const adapter = adapters[p.kind];
      if (!adapter) { stats.skipped++; continue; }
      if (!opts.force && p.lastFetchedAt && Date.now() - p.lastFetchedAt.getTime() < c.min_interval_minutes_per_source * 60_000) { stats.skipped++; continue; }
      if (!(await robotsAllows(p.url, c.user_agent))) {
        stats.blocked++;
        await db.update(schema.sourceProviders).set({ lastStatus: "blocked", lastError: "Disallowed by robots.txt", lastFetchedAt: new Date() }).where(eq(schema.sourceProviders.id, p.id));
        continue;
      }
      const r = await adapter.fetch({ url: p.url, etag: p.etag, lastModified: p.lastModified, timeoutMs: c.request_timeout_ms, userAgent: c.user_agent, maxItems: c.max_items_per_source });
      await db.update(schema.sourceProviders).set({
        lastStatus: r.status, lastError: r.error ?? null, lastFetchedAt: new Date(),
        ...(r.status === "ok" ? { etag: r.etag ?? null, lastModified: r.lastModified ?? null } : {}),
      }).where(eq(schema.sourceProviders.id, p.id));
      if (r.status !== "ok") { stats.errors++; stats.failures.push({ id: p.id, error: r.error ?? r.status }); continue; }
      stats.ok++;
      const fresh = r.items.filter((i) => !i.publishedAt || i.publishedAt.getTime() >= cutoff);
      if (!fresh.length) continue;
      const rows = fresh.map((i) => ({
        providerId: p.id, url: i.url, canonicalUrl: canonicalUrl(i.url), title: i.title, summary: i.summary,
        author: i.author, publishedAt: i.publishedAt, retrievalMethod: "rss", language: p.language,
        topics: p.topics, fingerprint: fingerprint(i.title),
      }));
      const inserted = await db.insert(schema.sourceItems).values(rows).onConflictDoNothing({ target: schema.sourceItems.canonicalUrl }).returning({ id: schema.sourceItems.id });
      stats.newItems += inserted.length;
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  if (stats.sources > 0 && stats.ok === 0 && stats.errors > 0) {
    await log("error", "collect", "All sources failed", stats, opts.jobRunId);
    throw new Error(`All ${stats.errors} sources failed (first: ${stats.failures[0]?.id}: ${stats.failures[0]?.error})`);
  }
  await log(stats.errors ? "warn" : "info", "collect", `Collected ${stats.newItems} new items from ${stats.ok}/${stats.sources} sources`, stats, opts.jobRunId);
  return stats;
}

/** Manual ingestion path: used in manual mode when items are retrieved by a human/assistant with web tools. */
export async function ingestManual(items: { providerId: string; url: string; title: string; summary?: string; author?: string; publishedAt?: string | null; topics?: string[] }[]) {
  await syncSourceRegistry();
  const ids = [...new Set(items.map((i) => i.providerId))];
  const known = await db.select({ id: schema.sourceProviders.id, topics: schema.sourceProviders.topics, language: schema.sourceProviders.language })
    .from(schema.sourceProviders).where(inArray(schema.sourceProviders.id, ids));
  const byId = new Map(known.map((k) => [k.id, k]));
  const missing = ids.filter((i) => !byId.has(i));
  if (missing.length) throw new Error(`Unknown providers (add to config/sources.yaml): ${missing.join(", ")}`);
  const rows = items.map((i) => ({
    providerId: i.providerId, url: i.url, canonicalUrl: canonicalUrl(i.url), title: i.title, summary: i.summary ?? null,
    author: i.author ?? null, publishedAt: i.publishedAt ? new Date(i.publishedAt) : null, retrievalMethod: "manual_webfetch",
    language: byId.get(i.providerId)!.language, topics: [...new Set([...(byId.get(i.providerId)!.topics ?? []), ...(i.topics ?? [])])],
    fingerprint: fingerprint(i.title),
  }));
  const ins = await db.insert(schema.sourceItems).values(rows).onConflictDoNothing({ target: schema.sourceItems.canonicalUrl }).returning({ id: schema.sourceItems.id });
  return ins.length;
}
