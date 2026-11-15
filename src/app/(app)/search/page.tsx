import Link from "next/link";
import { desc, ilike, or, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { PageHead } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  const [arts, persp, items] = q.length < 2 ? [[], [], []] : await Promise.all([
    db.select().from(schema.articles).where(or(ilike(schema.articles.headline, like), ilike(schema.articles.dek, like), sql`${schema.articles.body}::text ilike ${like}`)).orderBy(desc(schema.articles.createdAt)).limit(20),
    db.select().from(schema.perspectives).where(or(ilike(schema.perspectives.headline, like), ilike(schema.perspectives.body, like))).orderBy(desc(schema.perspectives.createdAt)).limit(20),
    db.select().from(schema.sourceItems).where(or(ilike(schema.sourceItems.title, like), ilike(schema.sourceItems.summary, like))).orderBy(desc(schema.sourceItems.publishedAt)).limit(20),
  ]);
  const n = arts.length + persp.length + items.length;
  return (
    <div className="page"><PageHead kicker="Поиск" title="По выпускам и источникам" />
      <form style={{ display: "flex", gap: 12 }}><input name="q" defaultValue={q} placeholder="Слово или фраза" autoFocus style={{ flex: 1, height: 44, font: "inherit", border: "1px solid var(--ink)", padding: "0 12px" }} /><button className="btn" style={{ height: 44 }}>Найти</button></form>
      {q.length >= 2 && n === 0 && <p className="empty" style={{ marginTop: 24 }}>Ничего не найдено по запросу «{q}».</p>}
      {arts.length > 0 && <><h2>Статьи</h2><ul className="list">{arts.map((a) => <li key={a.id}><h3 style={{ marginTop: 0 }}><Link className="t" href={`/article/${a.id}`}>{a.headline}</Link></h3><p>{a.dek}</p></li>)}</ul></>}
      {persp.length > 0 && <><h2>Точки зрения</h2><ul className="list">{persp.map((p) => <li key={p.id}><h3 style={{ marginTop: 0 }}><Link className="t" href={`/n4u?date=${p.editionDate}#${p.agentId}`}>{p.agentId.toUpperCase()} — {p.headline}</Link></h3></li>)}</ul></>}
      {items.length > 0 && <><h2>Источники</h2><ul className="list">{items.map((i) => <li key={i.id}><h3 style={{ marginTop: 0 }}><a className="t" href={i.url} target="_blank" rel="noreferrer">{i.title}</a></h3><p>{i.providerId}</p></li>)}</ul></>}
    </div>
  );
}
