import { getEdition } from "@/lib/edition/read";
import { PageHead, Sources } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function N4U({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const data = await getEdition({ date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined });
  return (
    <div className="page">
      <PageHead kicker="N4U[42]" title="Точки зрения" dek="Шесть редакторов, шесть областей. Это мнения авторов; факты в них привязаны к источникам." />
      {!data?.perspectives.length && <p className="empty">В выпуске нет точек зрения.</p>}
      {data?.perspectives.map((p) => (
        <section key={p.id} id={p.agentId} style={{ scrollMarginTop: 24 }}>
          <h2>{p.agentName} — {p.headline}</h2>
          <div className="prose" style={{ marginTop: 18 }}><p>{p.body}</p></div>
          <Sources cits={p.citations} />
        </section>
      ))}
    </div>
  );
}
