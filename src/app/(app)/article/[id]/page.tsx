import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { AGENT_KICKER, VERIFY_LABEL, readMinutes } from "@/lib/home";
import { Refs, Sources, fmtDate } from "@/components/ui";
import { createDraft } from "../../publications/actions";

export const dynamic = "force-dynamic";
export default async function Article({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const a = await db.query.articles.findFirst({ where: eq(schema.articles.id, id) });
  if (!a) notFound();
  const run = await db.query.agentRuns.findFirst({ where: eq(schema.agentRuns.id, a.agentRunId) });
  const cluster = a.clusterId ? await db.query.storyClusters.findFirst({ where: eq(schema.storyClusters.id, a.clusterId) }) : null;
  return (
    <article className="page">
      <div className="kicker">{AGENT_KICKER[a.agentId] ?? a.agentId}</div>
      <h1>{a.headline}</h1>
      <p className="dek">{a.dek}</p>
      <p className="cap" style={{ marginBottom: 28 }}>
        {a.agentId.toUpperCase()} · выпуск {fmtDate(`${a.editionDate}T12:00:00Z`)} · {readMinutes(a.body)} мин · {cluster ? VERIFY_LABEL[cluster.verification] : ""}
      </p>
      <div className="prose">{a.body.map((b, i) => <p key={i}>{b.text} <Refs refs={b.refs} /></p>)}</div>
      {a.interpretation.length > 0 && <><h2>Интерпретация автора</h2><ul className="plain">{a.interpretation.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
      {a.uncertainties.length > 0 && <><h2>Чего мы не знаем</h2><ul className="plain">{a.uncertainties.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
      <h2>Проверяемые факты</h2><ul className="plain">{a.facts.map((x, i) => <li key={i}>{x}</li>)}</ul>
      <h2>Источники</h2><Sources cits={a.citations} />
      <p className="fine" style={{ marginTop: 28 }}>
        Как подготовлено: редактор {a.agentId.toUpperCase()}, конфигурация v{run?.configVersion}, провайдер {run?.providerId}, модель {run?.model}
        {run?.providerId === "manual" && " (ручной режим, без вызова API)"}{run?.costUsd != null && ` · стоимость $${run.costUsd.toFixed(3)}`}.
      </p>
      <form action={createDraft} style={{ marginTop: 28 }}>
        <input type="hidden" name="articleId" value={a.id} />
        <button className="btn" type="submit">Создать черновик в AIMos</button>
      </form>
    </article>
  );
}
