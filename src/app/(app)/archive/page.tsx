import Link from "next/link";
import { listEditions } from "@/lib/edition/read";
import { PageHead } from "@/components/ui";
export const dynamic = "force-dynamic";
const ST: Record<string, string> = { published: "опубликован", complete: "собран", incomplete: "неполный", superseded: "заменён новой версией", failed: "не собран", draft: "черновик", assembling: "собирается" };
export default async function Archive() {
  const eds = await listEditions(120);
  return (
    <div className="page">
      <PageHead kicker="Архив" title="Прошлые выпуски" />
      <ul className="list">{eds.map((e) => (
        <li key={`${e.date}-${e.version}`}><div className="proj-h">
          <Link className="t" href={`/?date=${e.date}`}>{e.date.split("-").reverse().join(".")} · версия {e.version}</Link>
          <span className={`tag${e.isCurrent ? " solid" : ""}`}>{e.isCurrent ? "текущий" : ST[e.status]}</span></div>
          {e.mode === "manual" && <p>Ручной режим</p>}
        </li>))}
      </ul>
    </div>
  );
}
