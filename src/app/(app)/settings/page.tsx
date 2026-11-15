import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { getPipelineConfig } from "@/lib/settings";
import { loadAllAgents } from "@/lib/agents/config";
import { getProvider } from "@/lib/ai/registry";
import { Integrations, PageHead, fmtDate } from "@/components/ui";
import { savePreferences, saveSchedule } from "./actions";
export const dynamic = "force-dynamic";
const STAGE: Record<string, string> = { collect: "Сбор источников", process: "Дедупликация и проверка", agents: "Редакторы", assemble: "Сборка выпуска", publish: "Публикация" };
const W: Record<string, string> = { personal_interest: "Личные интересы", editorial_importance: "Редакционная важность", novelty: "Новизна", reliability: "Надёжность", project_relevance: "Связь с проектами", long_term_significance: "Долгосрочная значимость" };
const SRC: Record<string, string> = { ok: "работает", error: "ошибка", blocked: "закрыт robots.txt", skipped: "пропущен" };
export default async function Settings() {
  const cfg = await getPipelineConfig();
  const user = await db.query.users.findFirst();
  const prefs = user ? await db.query.preferences.findFirst({ where: eq(schema.preferences.userId, user.id) }) : null;
  const agents = loadAllAgents();
  const versions = await db.select().from(schema.agents);
  const sources = await db.select().from(schema.sourceProviders);
  const inp = { height: 40, font: "inherit", border: "1px solid var(--ink)", padding: "0 10px", background: "#fff", width: "100%" } as const;
  const F = ({ name, label, value }: { name: string; label: string; value: string[] }) => <label className="field">{label}<input name={name} defaultValue={value.join(", ")} /></label>;
  return (
    <div className="page wide">
      <PageHead kicker="Профиль и настройки" title="Что и как собирает TEMPO" />
      <h2>Интересы</h2>
      <form action={savePreferences} style={{ marginTop: 18, maxWidth: 640 }}>
        <F name="preferredTopics" label="Темы в приоритете (через запятую)" value={prefs?.preferredTopics ?? []} />
        <F name="geographicInterests" label="География" value={prefs?.geographicInterests ?? []} />
        <F name="mutedTopics" label="Скрытые темы" value={prefs?.mutedTopics ?? []} />
        <F name="preferredSources" label="Предпочтительные источники (id)" value={prefs?.preferredSources ?? []} />
        <F name="mutedSources" label="Скрытые источники (id)" value={prefs?.mutedSources ?? []} />
        <label className="field">Глубина<select name="editorialDepth" defaultValue={prefs?.editorialDepth} style={{ ...inp, marginTop: 6, height: 44 }}><option value="brief">Кратко</option><option value="standard">Стандартно</option><option value="deep">Подробно</option></select></label>
        <button className="btn">Сохранить интересы</button>
      </form>

      <h2>Расписание и ранжирование · {cfg.timezone}</h2>
      <form action={saveSchedule} style={{ marginTop: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 14 }}>
          {Object.entries(cfg.schedule).map(([k, v]) => <label key={k} className="field" style={{ margin: 0 }}>{STAGE[k]}<input type="time" name={k} defaultValue={v} /></label>)}
          {Object.entries(cfg.ranking.weights).map(([k, v]) => <label key={k} className="field" style={{ margin: 0 }}>{W[k] ?? k}<input type="number" step="0.05" min="0" max="1" name={`w_${k}`} defaultValue={v} /></label>)}
        </div>
        <button className="btn" style={{ marginTop: 16 }}>Сохранить расписание и веса</button>
      </form>

      <h2>Редакторы N4U[42]</h2>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Редактор</th><th>Область</th><th>Модель</th><th>Версия</th><th>Состояние</th></tr></thead><tbody>
        {agents.map((a) => { const av = getProvider(a.config.model.provider).available(); return (
          <tr key={a.config.id}><td><b>{a.config.name}</b></td><td>{a.config.domain}</td><td>{a.config.model.provider} · {a.config.model.name}<br /><span className="cap">t={a.config.model.temperature} · до {a.config.model.max_tokens} токенов</span></td>
            <td>v{versions.find((v) => v.id === a.config.id)?.activeConfigVersion ?? "—"}</td><td>{!a.config.enabled ? "выключен" : av.ok ? "готов" : `нет доступа: ${av.reason}`}</td></tr>); })}
      </tbody></table></div>
      <p className="fine">Личность, модель и правила каждого редактора лежат в папке agents/ репозитория; любое изменение создаёт новую версию.</p>

      <h2>Подключения</h2><Integrations categories={["calendar", "projects", "finance", "publishing"]} />

      <h2>Источники новостей · {sources.length}</h2>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Источник</th><th>Уровень</th><th>Темы</th><th>Последний сбор</th></tr></thead><tbody>
        {sources.sort((a, b) => a.id.localeCompare(b.id)).map((s) => <tr key={s.id}><td><a href={s.homepage ?? s.url} target="_blank" rel="noreferrer">{s.name}</a><br /><span className="cap">{s.id}</span></td><td>{s.tier}</td><td>{s.topics.join(", ")}</td>
          <td>{s.lastStatus ? `${SRC[s.lastStatus]} · ${fmtDate(s.lastFetchedAt, true)}` : "ещё не собирался"}{s.lastError && <><br /><span className="cap">{s.lastError}</span></>}</td></tr>)}
      </tbody></table></div>

      <form method="post" action="/api/logout" style={{ marginTop: 40 }}><button className="arrow" style={{ borderBottom: "1px solid currentColor" }}>Выйти</button></form>
    </div>
  );
}
