import { briefingSources, listBriefings } from "@/lib/briefings";
import { PageHead, fmtDate } from "@/components/ui";
import { deleteBriefing } from "./actions";
export const dynamic = "force-dynamic";
export default async function Briefings() {
  const [all, sources] = [await listBriefings(60), briefingSources()];
  const dates = [...new Set(all.map((b) => b.date))];
  return (
    <div className="page">
      <PageHead kicker="Сводки агентов" title="Что прислали ваши агенты" dek="Сводки задач, которые работают по расписанию вне TEMPO. Текст — от агента, как прислан." />
      {!all.length && <p className="empty"><b>Сводок пока нет</b>Подключены источники: {sources.map((s) => s.name).join(", ")}. Первая сводка появится после ближайшего запуска.</p>}
      {dates.map((d) => (
        <section key={d}>
          <h2>{fmtDate(`${d}T12:00:00Z`)}</h2>
          {all.filter((b) => b.date === d).map((b) => (
            <div key={b.id} id={b.source} style={{ padding: "22px 0 6px", scrollMarginTop: 24 }}>
              <div className="kicker">{b.name}</div>
              {b.headline && <h3 style={{ fontSize: 20, fontWeight: 650, lineHeight: 1.3, margin: "8px 0 4px" }}>{b.headline}</h3>}
              <ul className="list">{b.items.map((i) => (
                <li key={i.n}>
                  <h3 style={{ marginTop: 0 }}>{i.url ? <a className="t" href={i.url} target="_blank" rel="noreferrer">{i.title}</a> : i.title}</h3>
                  {i.body && <p style={{ whiteSpace: "pre-line" }}>{i.body}</p>}
                </li>))}
              </ul>
              <form action={deleteBriefing} className="fine"><input type="hidden" name="id" value={b.id} />Получено {fmtDate(b.updatedAt, true)} · <button style={{ borderBottom: "1px solid currentColor" }}>удалить</button></form>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
