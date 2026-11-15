import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { PageHead } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function Ideas() {
  const ideas = await db.select().from(schema.articles).where(eq(schema.articles.section, "ideas")).orderBy(desc(schema.articles.createdAt)).limit(50);
  const hooks = await db.select().from(schema.articles).orderBy(desc(schema.articles.createdAt)).limit(12);
  return (
    <div className="page">
      <PageHead kicker="Идеи" title="Заметки и темы для публикаций" />
      {!ideas.length && <p className="empty"><b>Заметок пока нет</b>Ниже — выводы редакторов из последних разборов: готовые зацепки для собственных текстов.</p>}
      <ul className="list">{ideas.map((a) => <li key={a.id}><h3><Link className="t" href={`/article/${a.id}`}>{a.headline}</Link></h3><p>{a.dek}</p></li>)}</ul>
      <h2>Выводы редакторов</h2>
      <ul className="list">{hooks.flatMap((a) => a.interpretation.map((t, i) => <li key={a.id + i}><p style={{ color: "var(--ink)", fontSize: 16 }}>{t}</p><p className="cap" style={{ marginTop: 4 }}>{a.agentId.toUpperCase()} · <Link className="t" href={`/article/${a.id}`}>{a.headline}</Link></p></li>))}</ul>
    </div>
  );
}
