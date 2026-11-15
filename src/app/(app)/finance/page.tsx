import { financeSummary, fmtPct } from "@/lib/home";
import { Integrations, PageHead, fmtDate } from "@/components/ui";
import { Sparkline } from "@/components/charts";
export const dynamic = "force-dynamic";
export default async function Fin() {
  const f = await financeSummary();
  return (
    <div className="page"><PageHead kicker="Финансы" title="Изменения за день и неделю" />
      {f ? <><div className="stat-row"><div><div className="stat">{f.day == null ? "—" : fmtPct(f.day)}</div><div className="stat-l">за день</div></div><div><div className="stat">{f.week == null ? "—" : fmtPct(f.week)}</div><div className="stat-l">за неделю</div></div></div>
        <div style={{ maxWidth: 360 }}><Sparkline values={f.series} /></div><p className="note">{f.instrument} · {f.source} · на {fmtDate(f.asOf, true)}</p></>
        : <p className="empty"><b>Нет данных</b>Источник котировок не выбран. Цифры появятся только из сохранённых наблюдений.</p>}
      <h2>Источник</h2><Integrations categories={["finance"]} />
    </div>
  );
}
