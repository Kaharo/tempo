import { desc, eq, gte, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { VERIFY_LABEL } from "@/lib/home";
import { PageHead, fmtDate } from "@/components/ui";
export const dynamic = "force-dynamic";
const TOPIC: Record<string, string> = { ai: "ИИ и технологии", technology: "ИИ и технологии", geopolitics: "Геополитика", kazakhstan: "Казахстан и Центральная Азия", "central-asia": "Казахстан и Центральная Азия", economics: "Экономика", climate: "Климат и энергетика", energy: "Климат и энергетика", science: "Наука", history: "Культура и общество", culture: "Культура и общество", philosophy: "Культура и общество" };
export default async function World() {
  const clusters = await db.select().from(schema.storyClusters).where(gte(schema.storyClusters.lastSeenAt, new Date(Date.now() - 5 * 86400_000))).orderBy(desc(schema.storyClusters.score)).limit(80);
  const items = clusters.length ? await db.select({ i: schema.sourceItems, p: schema.sourceProviders }).from(schema.sourceItems).innerJoin(schema.sourceProviders, eq(schema.sourceItems.providerId, schema.sourceProviders.id)).where(inArray(schema.sourceItems.clusterId, clusters.map((c) => c.id))) : [];
  const groups = new Map<string, typeof clusters>();
  for (const c of clusters) { const g = TOPIC[c.topics.find((t) => TOPIC[t]) ?? ""] ?? "Другое"; groups.set(g, [...(groups.get(g) ?? []), c]); }
  return (
    <div className="page">
      <PageHead kicker="Мир" title="События по темам" dek="Заголовки первоисточников на языке оригинала. Рядом — сколько независимых источников подтверждают событие." />
      {!clusters.length && <p className="empty">За последние дни событий не собрано.</p>}
      {[...groups].map(([g, cs]) => (
        <section key={g}><h2>{g}</h2>
          <ul className="list">{cs.map((c) => { const its = items.filter((x) => x.i.clusterId === c.id); return (
            <li key={c.id}>
              <h3 style={{ marginTop: 0 }}><a className="t" href={its[0]?.i.url} target="_blank" rel="noreferrer">{c.label}</a></h3>
              <p className="src">{its.map((x, k) => <span key={x.i.id}>{k > 0 && " · "}<a href={x.i.url} target="_blank" rel="noreferrer">{x.p.name}</a></span>)} — {fmtDate(c.lastSeenAt)} · {VERIFY_LABEL[c.verification]}</p>
            </li>); })}</ul>
        </section>
      ))}
    </div>
  );
}
