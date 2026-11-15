import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { Integrations, PageHead, fmtDate } from "@/components/ui";
import { addSnapshot, archiveProject } from "./actions";
export const dynamic = "force-dynamic";
const K: [keyof typeof schema.projectSnapshots.$inferSelect, string, boolean][] = [["blockers", "Блокер", true], ["decisions", "Решение", false], ["nextSteps", "Шаг", false], ["developments", "Новое", false]];
export default async function Projects() {
  const ps = await db.select().from(schema.projects).where(eq(schema.projects.active, true));
  const snaps = await db.select().from(schema.projectSnapshots).orderBy(desc(schema.projectSnapshots.observedAt)).limit(300);
  const inp = { height: 44, font: "inherit", border: "1px solid var(--ink)", padding: "0 12px", background: "#fff" } as const;
  return (
    <div className="page">
      <PageHead kicker="Проекты" title="Статусы, решения, блокеры" dek="Здесь только то, что записано вами или пришло из подключённых систем." />
      {!ps.length && <p className="empty"><b>Проекты не заведены</b>Добавьте первую запись ниже — она появится и в обзоре дня.</p>}
      {ps.map((p) => (
        <section key={p.id}><h2 style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>{p.name}
          <form action={archiveProject}><input type="hidden" name="id" value={p.id} /><button className="cap">в архив</button></form></h2>
          <ul className="list">{snaps.filter((s) => s.projectId === p.id).slice(0, 12).flatMap((s) => K.flatMap(([k, label, solid]) => (s[k] as string[]).map((t, i) => (
            <li key={`${s.id}${k}${i}`}><div className="proj-h"><span style={{ fontWeight: 400 }}>{t}</span><span className={`tag${solid ? " solid" : ""}`}>{label}</span></div><p className="cap">{fmtDate(s.observedAt, true)} · {s.source === "manual" ? "запись вручную" : s.source}</p></li>
          ))))}</ul>
        </section>
      ))}
      <h2>Новая запись</h2>
      <form action={addSnapshot} style={{ display: "grid", gap: 12, marginTop: 18 }}>
        <input name="name" placeholder="Проект" required list="pnames" style={inp} /><datalist id="pnames">{ps.map((p) => <option key={p.id} value={p.name} />)}</datalist>
        <select name="kind" style={inp}><option value="decision">Решение</option><option value="blocker">Блокер</option><option value="step">Следующий шаг</option><option value="update">Новое</option></select>
        <input name="text" placeholder="Что произошло — одной фразой" required style={inp} />
        <div><button className="btn">Записать</button></div>
      </form>
      <h2>Источники данных</h2><Integrations categories={["projects"]} />
    </div>
  );
}
