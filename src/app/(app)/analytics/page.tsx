import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { AGENT_KICKER, readMinutes } from "@/lib/home";
import { PageHead, fmtDate } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function Analytics() {
  const arts = await db.select().from(schema.articles).orderBy(desc(schema.articles.editionDate), desc(schema.articles.createdAt)).limit(60);
  return (
    <div className="page">
      <PageHead kicker="Аналитика" title="Разборы редакторов" />
      {!arts.length && <p className="empty">Статей пока нет.</p>}
      <ul className="list">{arts.map((a) => (
        <li key={a.id}>
          <div className="kicker">{AGENT_KICKER[a.agentId]} · {a.agentId.toUpperCase()}</div>
          <h3><Link className="t" href={`/article/${a.id}`}>{a.headline}</Link></h3>
          <p>{a.dek}</p>
          <p className="cap" style={{ marginTop: 6 }}>{fmtDate(`${a.editionDate}T12:00:00Z`)} · {readMinutes(a.body)} мин · источников: {a.citations.length}</p>
        </li>
      ))}</ul>
    </div>
  );
}
