import { asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { readYaml } from "@/lib/config";
import { localDate } from "@/lib/dates";

const Sources = z.array(z.object({ id: z.string().regex(/^[a-z0-9-]+$/), name: z.string(), slot: z.enum(["aimos", "finance", "day"]) }));
export const briefingSources = () => Sources.parse(readYaml("config/briefings.yaml").sources);

const clean = (s: string | null, max: number) => (s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max) || null;

/** Idempotent upsert of one summary item: key = (source, date, position). */
export async function ingestBriefingItem(p: { source: string; date?: string | null; headline?: string | null; n?: string | null; title?: string | null; text?: string | null; url?: string | null }) {
  const src = briefingSources().find((s) => s.id === p.source);
  if (!src) return { ok: false as const, status: 400, error: `unknown source; allowed: ${briefingSources().map((s) => s.id).join(", ")}` };
  const date = p.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : localDate(process.env.TEMPO_TIMEZONE ?? "Asia/Almaty");
  const headline = clean(p.headline ?? null, 200); const title = clean(p.title ?? null, 200); const body = clean(p.text ?? null, 2000);
  const position = Number.parseInt(p.n ?? "", 10);
  let url = clean(p.url ?? null, 600);
  if (url && !/^https?:\/\//i.test(url)) url = null; // only web links are stored
  if (!headline && !title) return { ok: false as const, status: 400, error: "send headline, or n + title (+ text, url)" };
  if (title && !(position >= 1 && position <= 12)) return { ok: false as const, status: 400, error: "n must be 1..12" };

  const [b] = await db.insert(schema.briefings).values({ source: src.id, editionDate: date, headline })
    .onConflictDoUpdate({ target: [schema.briefings.source, schema.briefings.editionDate], set: { ...(headline ? { headline } : {}), updatedAt: new Date() } }).returning();
  if (title) {
    await db.insert(schema.briefingItems).values({ briefingId: b.id, position, title, body, url })
      .onConflictDoUpdate({ target: [schema.briefingItems.briefingId, schema.briefingItems.position], set: { title, body, url } });
  }
  const items = await db.select({ n: schema.briefingItems.position }).from(schema.briefingItems).where(eq(schema.briefingItems.briefingId, b.id));
  return { ok: true as const, source: src.id, date, headline: b.headline, items: items.map((i) => i.n).sort((a, c) => a - c) };
}

export type BriefingView = { id: string; source: string; name: string; slot: string; date: string; headline: string | null; updatedAt: Date; items: { n: number; title: string; body: string | null; url: string | null }[] };

async function hydrate(rows: (typeof schema.briefings.$inferSelect)[]): Promise<BriefingView[]> {
  if (!rows.length) return [];
  const items = await db.select().from(schema.briefingItems).where(inArray(schema.briefingItems.briefingId, rows.map((r) => r.id))).orderBy(asc(schema.briefingItems.position));
  const srcs = briefingSources();
  return rows.map((r) => { const s = srcs.find((x) => x.id === r.source); return { id: r.id, source: r.source, name: s?.name ?? r.source, slot: s?.slot ?? "day", date: r.editionDate, headline: r.headline, updatedAt: r.updatedAt, items: items.filter((i) => i.briefingId === r.id).map((i) => ({ n: i.position, title: i.title, body: i.body, url: i.url })) }; });
}
/** Latest summary per source, optionally pinned to one date (archive view). */
export async function latestBriefings(date?: string) {
  const rows = await db.select().from(schema.briefings).where(date ? eq(schema.briefings.editionDate, date) : undefined).orderBy(desc(schema.briefings.editionDate), desc(schema.briefings.updatedAt)).limit(60);
  const seen = new Set<string>();
  return hydrate(rows.filter((r) => (seen.has(r.source) ? false : (seen.add(r.source), true))));
}
export async function listBriefings(limit = 40) {
  return hydrate(await db.select().from(schema.briefings).orderBy(desc(schema.briefings.editionDate), desc(schema.briefings.updatedAt)).limit(limit));
}
