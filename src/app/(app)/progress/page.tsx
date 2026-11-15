import { desc } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { PageHead } from "@/components/ui";
import { Bars } from "@/components/charts";
export const dynamic = "force-dynamic";
export default async function Progress() {
  const rows = await db.select().from(schema.progressSnapshots).orderBy(desc(schema.progressSnapshots.periodEnd)).limit(400);
  const by = new Map<string, typeof rows>(); for (const r of rows) by.set(r.indicator, [...(by.get(r.indicator) ?? []), r]);
  return (
    <div className="page">
      <PageHead kicker="Прогресс" title="Сравнение с прошлыми периодами" dek="Каждое сравнение считается из сохранённых замеров. Нет замеров — нет цифры." />
      {!rows.length && <p className="empty"><b>Нет наблюдений</b>Замеры начнут копиться после подключения проектов, календаря или каналов публикации.</p>}
      {[...by].map(([ind, rs]) => { const s = [...rs].reverse(); const d = s.length > 1 ? s.at(-1)!.value - s.at(-2)!.value : null; return (
        <section key={ind}><h2>{ind}</h2><div className="stat" style={{ marginTop: 16 }}>{s.at(-1)!.value}{d != null && <span className="stat-l"> · {d >= 0 ? "+" : "−"}{Math.abs(d)} к прошлому периоду</span>}</div><div style={{ maxWidth: 320 }}><Bars values={s.slice(-10).map((x) => x.value)} /></div></section>); })}
    </div>
  );
}
