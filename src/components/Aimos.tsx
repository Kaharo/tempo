import { desc, ne } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { aimosSummary, fmtPct } from "@/lib/home";
import { Integrations, PageHead, fmtDate } from "@/components/ui";
import { saveDraft, setDraftStatus } from "@/app/(app)/publications/actions";

const ST: Record<string, string> = { draft: "Черновик", in_review: "Ждёт решения", approved: "Согласовано", rejected: "Отклонено", scheduled: "Запланировано", published: "Опубликовано", archived: "Архив" };
const Act = ({ id, to, label }: { id: string; to: string; label: string }) => (
  <form action={setDraftStatus} style={{ display: "inline" }}><input type="hidden" name="id" value={id} /><input type="hidden" name="to" value={to} />
    <button className="arrow" style={{ fontSize: 14, borderBottom: "1px solid currentColor", marginRight: 18 }}>{label}</button></form>
);

export default async function Aimos({ mode }: { mode: "publications" | "dashboard" }) {
  const [s, drafts, approvals, jobs] = await Promise.all([
    aimosSummary(),
    db.select().from(schema.publicationDrafts).where(ne(schema.publicationDrafts.status, "archived")).orderBy(desc(schema.publicationDrafts.updatedAt)).limit(50),
    db.select().from(schema.approvals).orderBy(desc(schema.approvals.createdAt)).limit(20),
    db.select().from(schema.distributionJobs).orderBy(desc(schema.distributionJobs.createdAt)).limit(20),
  ]);
  return (
    <div className="page wide">
      {mode === "publications"
        ? <PageHead kicker="Публикации" title="Черновики и согласование" dek="Черновик создаётся из статьи: факты и ссылки. Комментарий пишете вы. Наружу ничего не уходит без вашего решения." />
        : <PageHead kicker="AIMos" title="Производство и дистрибуция" dek="Состояние конвейера публикаций, каналов и аналитики — только по сохранённым данным." />}
      <div className="trio" style={{ borderTop: "1px solid var(--rule)" }}>
        <div><div className="stat">{s.published}</div><div className="stat-l">вышло</div></div>
        <div><div className="stat">{s.drafts}</div><div className="stat-l">в работе</div></div>
        <div><div className="stat">{s.pending}</div><div className="stat-l">ждёт решения · согласовано: {s.approved}</div></div>
      </div>
      <div className="line"><span>Охват</span><span className="val">{s.reachDelta == null ? <span className="muted">{s.hasReach ? "мало данных для сравнения" : "нет данных: аналитика каналов не подключена"}</span> : <><b>{fmtPct(s.reachDelta)}</b> за неделю</>}</span></div>

      <h2>Материалы</h2>
      {drafts.length === 0 && <p className="empty" style={{ padding: "18px 0" }}>Черновиков нет. Откройте статью и нажмите «Создать черновик в AIMos».</p>}
      <ul className="list">
        {drafts.map((d) => (
          <li key={d.id}>
            <div className="proj-h"><span>{d.title ?? "Без названия"}</span><span className={`tag${d.status === "in_review" ? " solid" : ""}`}>{ST[d.status]}</span></div>
            <p className="cap">{d.channel} · {d.language} · версия {d.version} · изменён {fmtDate(d.updatedAt, true)}</p>
            {d.status === "draft" || d.status === "rejected" ? (
              <form action={saveDraft} style={{ margin: "12px 0" }}>
                <input type="hidden" name="id" value={d.id} />
                <textarea name="body" defaultValue={d.body} rows={9} style={{ width: "100%", font: "inherit", fontSize: 14.5, padding: 12, border: "1px solid var(--ink)" }} />
                <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                  <select name="channel" defaultValue={d.channel} style={{ height: 40, font: "inherit", border: "1px solid var(--ink)", padding: "0 8px", background: "#fff" }}>
                    <option value="telegram">Telegram · RU</option><option value="linkedin">LinkedIn · EN</option><option value="x">X · EN</option>
                  </select>
                  <button className="btn">Сохранить</button>
                </div>
              </form>
            ) : <pre style={{ whiteSpace: "pre-wrap", font: "inherit", fontSize: 14.5, margin: "12px 0", color: "var(--ink-2)" }}>{d.body}</pre>}
            {d.status === "draft" && <Act id={d.id} to="in_review" label="Отправить на решение" />}
            {d.status === "in_review" && <><Act id={d.id} to="approved" label="Согласовать" /><Act id={d.id} to="rejected" label="Отклонить" /></>}
            <Act id={d.id} to="archived" label="В архив" />
            {d.status === "approved" && <p className="cap" style={{ marginTop: 8 }}>Согласована версия {d.version}. Канал не подключён — скопируйте текст и опубликуйте вручную.</p>}
          </li>
        ))}
      </ul>

      <h2>Каналы</h2>
      <Integrations categories={["publishing"]} />
      {mode === "dashboard" && <>
        <h2>Решения</h2>
        {approvals.length ? <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Когда</th><th>Решение</th><th>Канал</th><th>Версия</th></tr></thead><tbody>
          {approvals.map((a) => <tr key={a.id}><td>{fmtDate(a.createdAt, true)}</td><td>{a.decision === "approved" ? "согласовано" : "отклонено"}</td><td>{a.channel} · {a.language}</td><td>{a.draftVersion}</td></tr>)}
        </tbody></table></div> : <p className="empty" style={{ padding: "18px 0" }}>Решений пока не было.</p>}
        <h2>Отправки</h2>
        {jobs.length ? <ul className="list">{jobs.map((j) => <li key={j.id}>{j.channel} · {j.status} · {fmtDate(j.createdAt, true)}</li>)}</ul> : <p className="empty" style={{ padding: "18px 0" }}>Отправок не было: ни один канал публикации не подключён.</p>}
      </>}
    </div>
  );
}
