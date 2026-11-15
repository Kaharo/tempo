import { getEdition } from "@/lib/edition/read";
import { editionFreshness } from "@/lib/jobs/runner";
import type { Citation } from "@/db/schema";

/**
 * Unstyled content preview — verifies data end-to-end.
 * Deliberately NOT a design: the approved TEMPO layout replaces this once the
 * screenshots are provided (see docs/DESIGN_SYSTEM.md).
 */
const FRESH: Record<string, string> = { fresh: "свежий выпуск", incomplete: "выпуск неполный", delayed: "выпуск задерживается", previous: "показан предыдущий выпуск", unavailable: "выпуск недоступен" };
const Refs = ({ refs, cits }: { refs?: number[]; cits: Citation[] }) =>
  refs?.length ? <sup>{refs.map((r) => { const c = cits.find((x) => x.ref === r); return c ? <a key={r} href={c.url} title={`${c.publisher}: ${c.title}`}>[{r}]</a> : null; })}</sup> : null;
const Sources = ({ cits }: { cits: Citation[] }) => (
  <ol style={{ fontSize: 13 }}>{cits.map((c) => <li key={c.ref} value={c.ref}><a href={c.url}>{c.title}</a> — {c.publisher}{c.publishedAt ? `, опубл. ${c.publishedAt.slice(0, 10)}` : ""}</li>)}</ol>
);

export default async function EditionPreview({ date }: { date?: string }) {
  const [data, fresh] = await Promise.all([getEdition({ date }), editionFreshness()]);
  if (!data) return <main style={{ padding: 24 }}><p>Выпусков пока нет. Запустите конвейер: <code>npm run tempo -- run</code>.</p></main>;
  const { edition: e, lead, perspectives, world, integrations } = data;
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 24, fontFamily: "system-ui", lineHeight: 1.55 }}>
      <p style={{ fontSize: 12, border: "1px solid", padding: 8 }}>
        Предпросмотр контента без дизайна. Выпуск {e.date} · v{e.version} · {e.status} · {FRESH[date ? "fresh" : fresh.state] ?? fresh.state}
        {e.mode === "manual" && " · режим ручного выполнения (без API модели)"}
      </p>
      {lead && (
        <article>
          <h1>{lead.headline}</h1>
          <p><em>{lead.dek}</em></p>
          <p style={{ fontSize: 13 }}>{lead.agentId.toUpperCase()} · {lead.run?.providerId}/{lead.run?.model} · config v{lead.run?.configVersion}</p>
          {lead.body.map((b, i) => <p key={i}>{b.text} <Refs refs={b.refs} cits={lead.citations} /></p>)}
          {lead.uncertainties.length > 0 && <><h3>Чего мы не знаем</h3><ul>{lead.uncertainties.map((u, i) => <li key={i}>{u}</li>)}</ul></>}
          <h3>Источники</h3><Sources cits={lead.citations} />
        </article>
      )}
      <h2>N4U[42]</h2>
      {perspectives.map((p) => (
        <section key={p.id}>
          <h3>{p.agentName} — {p.headline}</h3>
          <p>{p.body}</p>
          <Sources cits={p.citations} />
        </section>
      ))}
      {data.supporting.length > 0 && <><h2>Аналитика</h2>{data.supporting.map((a) => a && (
        <article key={a.id}><h3>{a.headline}</h3><p><em>{a.dek}</em></p>{a.body.map((b, i) => <p key={i}>{b.text} <Refs refs={b.refs} cits={a.citations} /></p>)}<Sources cits={a.citations} /></article>
      ))}</>}
      <h2>Мир</h2>
      <ul>{world.map((w) => <li key={w.id}>{w.label} <small>({w.verification})</small> — {w.sources.map((s, i) => <a key={i} href={s.url}>{s.publisher}</a>)}</li>)}</ul>
      <h2>Данные</h2>
      <ul>{integrations.map((i) => <li key={i.id}>{i.category} / {i.id}: <strong>{i.state === "connected" ? "подключено" : i.state === "export_only" ? "только экспорт" : "не подключено"}</strong> — {i.detail}</li>)}</ul>
    </main>
  );
}
