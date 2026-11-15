import { asc, gte } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { Integrations, PageHead, fmtDate } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function Cal() {
  const ev = await db.select().from(schema.calendarEvents).where(gte(schema.calendarEvents.startsAt, new Date(Date.now() - 3600_000))).orderBy(asc(schema.calendarEvents.startsAt)).limit(40);
  return (
    <div className="page"><PageHead kicker="Календарь" title="Ближайшие события" />
      {ev.length ? <ul className="list">{ev.map((e) => <li key={e.id}><h3 style={{ marginTop: 0 }}>{e.title}</h3><p>{fmtDate(e.startsAt, true)}{e.location && ` · ${e.location}`}</p></li>)}</ul>
        : <p className="empty"><b>Календарь не подключён</b>События не показываются, пока нет источника.</p>}
      <h2>Источник</h2><Integrations categories={["calendar"]} />
    </div>
  );
}
