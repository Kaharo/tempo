import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getEdition } from "@/lib/edition/read";
import { editionFreshness } from "@/lib/jobs/runner";
import { AGENT_KICKER, aimosSummary, financeSummary, fmtPct, plural, progressSummary, projectsSummary, readMinutes } from "@/lib/home";
import { Bars, Sparkline } from "@/components/charts";
import { latestBriefings } from "@/lib/briefings";

export const dynamic = "force-dynamic";
const TZ = process.env.TEMPO_TIMEZONE ?? "Asia/Almaty";
const STATE: Record<string, string> = { fresh: "", incomplete: "выпуск неполный", delayed: "сегодняшний выпуск задерживается", previous: "сегодняшний выпуск ещё не вышел", unavailable: "выпуск недоступен" };
const TAG: Record<string, { label: string; solid?: boolean }> = { blocker: { label: "Блокер", solid: true }, decision: { label: "Решение" }, step: { label: "Шаг" }, update: { label: "Новое" } };

function dateLine(d: Date) {
  const s = new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, weekday: "short", day: "numeric", month: "long" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function Home({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : undefined;
  const [data, fresh, fin, projects, progress, aimos, briefs] = await Promise.all([getEdition({ date }), editionFreshness(), financeSummary(), projectsSummary(), progressSummary(), aimosSummary(), latestBriefings(date)]);
  const slot = (s: string) => briefs.find((b) => b.slot === s);
  const [bDay, bFin, bAimos] = [slot("day"), slot("finance"), slot("aimos")];
  const dm = (d: string) => d.split("-").reverse().slice(0, 2).join(".");
  const state = date ? `архивный выпуск ${date.split("-").reverse().join(".")}` : STATE[data ? fresh.state : "unavailable"];

  if (!data) {
    return (
      <>
        <div className="dateline">{dateLine(new Date())} · Астана · {state}{bDay && <> · <Link href="/briefings#morning-brief" className="u">{bDay.headline ?? bDay.name} →</Link></>}</div>
        <div className="page"><div className="kicker">Обзор дня</div><h1>Выпуска пока нет</h1>
          <p className="dek">Конвейер ещё не собрал ни одного выпуска. Состояние этапов и ошибки — в разделе «Уведомления».</p>
          <Link className="btn" href="/status">Открыть состояние <ArrowRight size={16} /></Link></div>
      </>
    );
  }
  const { edition: e, lead, supporting, perspectives, world } = data;
  // Up to three side stories: other analyses first, then top verified world stories.
  const side = [
    ...supporting.filter(Boolean).map((a) => ({ key: a!.id, href: `/article/${a!.id}`, kicker: AGENT_KICKER[a!.agentId] ?? a!.agentId, title: a!.headline, text: a!.dek ?? "", ext: false })),
    ...world.map((w) => ({ key: w.id, href: w.sources[0]?.url ?? "/world", kicker: w.sources[0]?.publisher ?? "Мир", title: w.label, text: "", ext: true })),
  ].slice(0, 3);
  const sourcesN = lead?.citations.length ?? 0;
  const mins = lead ? readMinutes(lead.body) : 0;
  const published = e.publishedAt ? new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(e.publishedAt)) : null;

  return (
    <>
      <div className={`dateline${state || bDay ? "" : " wide-hidden"}`}>{dateLine(new Date(`${e.date}T12:00:00Z`))} · Астана{state && ` · ${state}`}{bDay && <> · <Link href="/briefings#morning-brief" className="u">{bDay.headline ?? bDay.name} →</Link></>}</div>
      <div className="home">
        <section className="lead-area">
          {lead ? (
            <article className="lead">
              <div className="kicker">{AGENT_KICKER[lead.agentId] ?? lead.agentId}</div>
              <h1><Link href={`/article/${lead.id}`}>{lead.headline}</Link></h1>
              <p className="dek">{lead.dek}</p>
              <div className="body">{lead.body.slice(0, 2).map((b, i) => <p key={i}>{b.text}</p>)}</div>
              <div className="lead-meta">
                <Link href={`/article/${lead.id}`} className="arrow"><span>Читать<span className="m-only"> · {mins} {plural(mins, "минута", "минуты", "минут")}</span></span><ArrowRight size={18} strokeWidth={1.75} /></Link>
                <span className="m">Факты: {sourcesN} {plural(sourcesN, "источник", "источника", "источников")}</span>
                <span className="m">Анализ: {lead.agentId.toUpperCase()}</span>
                <span className="m time">{mins} {plural(mins, "минута", "минуты", "минут")}</span>
              </div>
            </article>
          ) : (
            <div className="lead"><div className="kicker">Обзор дня</div><h1>Главной статьи в этом выпуске нет</h1><p className="dek">{e.notes.join(" · ") || "Редакторы не подготовили материал, прошедший проверку."}</p></div>
          )}
          <div className="stories">
            {side.map((s) => (
              <Link key={s.key} href={s.href} className="story" {...(s.ext ? { target: "_blank", rel: "noreferrer" } : {})}>
                <div className="kicker">{s.kicker}</div>
                <h3>{s.title}</h3>
                {s.text && <p>{s.text}</p>}
                <ArrowRight className="go" size={16} strokeWidth={1.75} />
              </Link>
            ))}
          </div>
        </section>

        <section className="data-area">
          <div className="data-col">
            <h2 className="h-sec"><Link href="/finance">Финансы</Link></h2>
            {fin ? (
              <>
                <div className="stat-row">
                  <div><div className="stat">{fin.day == null ? "—" : fmtPct(fin.day)}</div><div className="stat-l">за день</div></div>
                  <div><div className="stat">{fin.week == null ? "—" : fmtPct(fin.week)}</div><div className="stat-l">за неделю</div></div>
                </div>
                <Sparkline values={fin.series} />
                <p className="note">{fin.instrument} · {fin.source}</p>
              </>
            ) : bFin ? (
              <p className="empty"><b>{bFin.headline ?? bFin.items[0]?.title ?? bFin.name}</b>{bFin.items[0]?.body && <>{bFin.items[0].body.slice(0, 180)}{bFin.items[0].body.length > 180 && "…"} </>}<Link href="/briefings#investment">Сводка ассистента от {dm(bFin.date)}</Link></p>
            ) : <p className="empty"><b>Нет данных</b>Источник котировок не подключён, поэтому изменений показать нечего. <Link href="/finance">Подробнее</Link></p>}
          </div>
          <div className="data-col">
            <h2 className="h-sec"><Link href="/projects">Проекты</Link></h2>
            {projects.length ? projects.map((p) => (
              <Link key={p.id} href="/projects" className="proj" style={{ display: "block" }}>
                <div className="proj-h"><span>{p.name}</span>{p.kind && <span className={`tag${TAG[p.kind].solid ? " solid" : ""}`}>{TAG[p.kind].label}</span>}</div>
                <p className="note">{p.text ?? "Наблюдений пока нет."}</p>
              </Link>
            )) : <p className="empty"><b>Проекты не заведены</b>Статусы появятся после первой записи или подключения репозитория. <Link href="/projects">Подробнее</Link></p>}
          </div>
          <div className="data-col">
            <h2 className="h-sec"><Link href="/progress">Прогресс</Link></h2>
            {progress ? (
              <>
                <div className="stat">{progress.delta == null ? progress.value : `${progress.delta >= 0 ? "+" : "−"}${Math.abs(progress.delta)}`}</div>
                <div className="stat-l">{progress.indicator}{progress.delta != null && " · к прошлому периоду"}</div>
                <Bars values={progress.series} />
              </>
            ) : <p className="empty"><b>Нет наблюдений</b>Сравнения считаются только из сохранённых замеров; их пока нет. <Link href="/progress">Подробнее</Link></p>}
          </div>
        </section>

        <aside className="views-area">
          <h2 className="h-side">N4U[42] — точки зрения</h2>
          {perspectives.map((p) => (
            <Link key={p.id} href={`/n4u${date ? `?date=${date}` : ""}#${p.agentId}`} className="view">
              <div className="who">{p.agentName}</div>
              <div className="say">{p.headline}</div>
            </Link>
          ))}
          {!perspectives.length && <p className="empty" style={{ padding: "16px 0" }}>В этом выпуске нет точек зрения.</p>}
          <p className="fine">Мнения авторов, не проверенные факты.{e.notes.length > 0 && ` ${e.notes.join(" · ")}.`}</p>

          <div className="aimos">
            <h2 className="h-side"><Link href="/aimos">AIMos — публикации</Link></h2>
            <div className="trio">
              <div><div className="stat">{aimos.published}</div><div className="stat-l">вышло</div></div>
              <div><div className="stat">{aimos.drafts}</div><div className="stat-l">{plural(aimos.drafts, "черновик", "черновика", "черновиков")}</div></div>
              <div><div className="stat">{aimos.pending}</div><div className="stat-l">ждёт решения</div></div>
            </div>
            {bAimos && <Link href="/briefings#aimos-digest" className="line"><span>Подборка от {dm(bAimos.date)}</span><span className="val"><b>{bAimos.items.length}</b> {plural(bAimos.items.length, "новость", "новости", "новостей")} <ArrowRight size={14} strokeWidth={1.75} /></span></Link>}
            <Link href="/aimos" className="line"><span>Охват</span><span className="val">{aimos.reachDelta == null ? <span className="muted">нет данных</span> : <><b>{fmtPct(aimos.reachDelta)}</b> за неделю</>} <ArrowRight size={14} strokeWidth={1.75} /></span></Link>
            <Link href="/publications" className="line strong"><span>Согласовать публикацию</span><ArrowRight size={16} strokeWidth={1.75} /></Link>
          </div>
        </aside>
      </div>
      <p className="edition-note">
        Выпуск {e.date.split("-").reverse().join(".")} · версия {e.version}{published && ` · опубликован ${published}`}
        {e.mode === "manual" && " · подготовлен в ручном режиме, без вызова модели по API"} · <Link href="/archive" style={{ borderBottom: "1px solid currentColor" }}>архив выпусков</Link>
      </p>
    </>
  );
}
