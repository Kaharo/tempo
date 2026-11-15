import Link from "next/link";
import { db, schema } from "@/db/client";
import { inArray } from "drizzle-orm";
import type { Citation } from "@/db/schema";

export const fmtDate = (d: Date | string | null | undefined, withTime = false) =>
  d ? new Intl.DateTimeFormat("ru-RU", { timeZone: process.env.TEMPO_TIMEZONE ?? "Asia/Almaty", day: "numeric", month: "long", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(new Date(d)) : "—";

export function Sources({ cits }: { cits: Citation[] }) {
  return (
    <ol className="plain src">
      {cits.map((c) => (
        <li key={c.ref} id={`s${c.ref}`} value={c.ref}>
          <a href={c.url} target="_blank" rel="noreferrer">{c.title}</a> — {c.publisher}{c.publishedAt && `, опубликовано ${fmtDate(c.publishedAt)}`}
        </li>
      ))}
    </ol>
  );
}
export function Refs({ refs }: { refs?: number[] }) {
  return refs?.length ? <sup>{refs.map((r) => <a key={r} href={`#s${r}`}>[{r}]</a>)}</sup> : null;
}
const STATE_RU: Record<string, string> = { connected: "подключено", disconnected: "не подключено", export_only: "только экспорт и ручной ввод", error: "ошибка" };

/** Explicit integration states for a category — shown instead of invented data. */
export async function Integrations({ categories }: { categories: string[] }) {
  const rows = await db.select().from(schema.integrations).where(inArray(schema.integrations.category, categories));
  return (
    <ul className="list">
      {rows.map((i) => (
        <li key={i.id}>
          <div className="proj-h"><span>{i.id}</span><span className={`tag${i.state === "connected" ? " solid" : ""}`}>{STATE_RU[i.state]}</span></div>
          <p>{i.detail}</p>
        </li>
      ))}
    </ul>
  );
}
export function PageHead({ kicker, title, dek }: { kicker: string; title: string; dek?: string }) {
  return <><div className="kicker">{kicker}</div><h1>{title}</h1>{dek && <p className="dek">{dek}</p>}</>;
}
export { Link };
