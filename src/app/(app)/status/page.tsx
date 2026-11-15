import { desc, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { editionFreshness } from "@/lib/jobs/runner";
import { PageHead, fmtDate } from "@/components/ui";
import { reassemble } from "./actions";
export const dynamic = "force-dynamic";
const FR: Record<string, string> = { fresh: "Сегодняшний выпуск опубликован", incomplete: "Сегодняшний выпуск неполный", delayed: "Сегодняшний выпуск задерживается", previous: "Сегодняшний выпуск ещё не вышел по расписанию", unavailable: "Выпусков нет" };
const STAGE: Record<string, string> = { collect: "Сбор", process: "Проверка", agents: "Редакторы", assemble: "Сборка", publish: "Публикация" };
const ST: Record<string, string> = { succeeded: "выполнено", failed: "ошибка", running: "идёт", queued: "в очереди", skipped: "пропущено", cancelled: "отменено" };
export default async function Status() {
  const [f, jobs, problems, runs] = await Promise.all([
    editionFreshness(),
    db.select().from(schema.jobRuns).orderBy(desc(schema.jobRuns.createdAt)).limit(40),
    db.select().from(schema.systemLogs).where(inArray(schema.systemLogs.level, ["warn", "error"])).orderBy(desc(schema.systemLogs.createdAt)).limit(15),
    db.select().from(schema.agentRuns).orderBy(desc(schema.agentRuns.createdAt)).limit(18),
  ]);
  const cost = runs.reduce((s, r) => s + (r.costUsd ?? 0), 0);
  return (
    <div className="page wide">
      <PageHead kicker="Уведомления" title={FR[f.state]} dek="Журнал этапов, ошибки и расходы. Всё, что требует внимания, появляется здесь." />
      <form action={reassemble}><button className="btn">Пересобрать сегодняшний выпуск</button></form>
      <p className="fine">Пересборка берёт уже готовые тексты и создаёт новую версию выпуска. Полный перезапуск с редакторами: npm run tempo -- run --force</p>
      <h2>Требует внимания</h2>
      {problems.length ? <ul className="list">{problems.map((l) => <li key={l.id}><div className="proj-h"><span style={{ fontWeight: 400 }}>{l.message}</span><span className={`tag${l.level === "error" ? " solid" : ""}`}>{l.level === "error" ? "ошибка" : "предупреждение"}</span></div><p className="cap">{l.scope} · {fmtDate(l.createdAt, true)}</p></li>)}</ul> : <p className="empty" style={{ padding: "18px 0" }}>Ничего.</p>}
      <h2>Этапы</h2>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Выпуск</th><th>Этап</th><th>Итог</th><th>Запуск</th><th>Когда</th><th>Подробности</th></tr></thead><tbody>
        {jobs.map((j) => <tr key={j.id}><td>{j.editionDate}</td><td>{STAGE[j.stage]}</td><td>{ST[j.status]}</td><td>{j.trigger === "schedule" ? "по расписанию" : j.trigger === "retry" ? `повтор ${j.attempt}` : "вручную"}</td><td>{fmtDate(j.startedAt, true)}</td><td className="cap">{j.error ?? ""}</td></tr>)}
      </tbody></table></div>
      <h2>Запуски редакторов · расходы ${cost.toFixed(2)}</h2>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Редактор</th><th>Выпуск</th><th>Итог</th><th>Модель</th><th>Замечания проверки</th></tr></thead><tbody>
        {runs.map((r) => <tr key={r.id}><td>{r.agentId.toUpperCase()}</td><td>{r.editionDate}</td><td>{ST[r.status]}</td><td>{r.providerId} · {r.model}</td><td className="cap">{r.validationErrors.join("; ") || r.error || ""}</td></tr>)}
      </tbody></table></div>
    </div>
  );
}
