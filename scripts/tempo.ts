/**
 * TEMPO CLI.
 *   npm run tempo -- tick                     # scheduler tick (what GitHub Actions calls)
 *   npm run tempo -- run [date] [--force]     # full chain now (manual regeneration)
 *   npm run tempo -- stage <stage> [date] [--force]
 *   npm run tempo -- agent <id> [date]
 *   npm run tempo -- sync                     # sources + agents registry
 *   npm run tempo -- ingest-manual <file.json>
 *   npm run tempo -- status
 */
import { readFileSync } from "node:fs";
import { desc } from "drizzle-orm";
import { db, schema, sql } from "@/db/client";
import { tick, runAll, runStage, STAGES, editionFreshness, type Stage } from "@/lib/jobs/runner";
import { runAgent } from "@/lib/agents/run";
import { syncAgents } from "@/lib/agents/sync";
import { syncSourceRegistry, ingestManual } from "@/lib/sources/collect";
import { seed } from "@/lib/seed";
import { localDate } from "@/lib/dates";

const args = process.argv.slice(2);
const force = args.includes("--force");
const pos = args.filter((a) => !a.startsWith("--"));
const today = () => localDate(process.env.TEMPO_TIMEZONE ?? "Asia/Almaty");

async function main() {
  await seed();
  const [cmd, a1, a2] = pos;
  let out: unknown;
  switch (cmd) {
    case "tick": out = await tick(); break;
    case "run": out = await runAll(a1 ?? today(), "manual", force); break;
    case "stage": if (!STAGES.includes(a1 as Stage)) throw new Error(`stage must be one of ${STAGES.join(", ")}`); out = await runStage(a1 as Stage, a2 ?? today(), "manual", force); break;
    case "agent": out = await runAgent(a1, a2 ?? today()); break;
    case "sync": out = { sources: await syncSourceRegistry(), agents: await syncAgents() }; break;
    case "ingest-manual": out = { inserted: await ingestManual(JSON.parse(readFileSync(a1, "utf8"))) }; break;
    case "status": {
      const f = await editionFreshness();
      const jobs = await db.select().from(schema.jobRuns).orderBy(desc(schema.jobRuns.createdAt)).limit(10);
      out = { freshness: { state: f.state, today: f.today, edition: f.edition && { date: f.edition.editionDate, v: f.edition.version, status: f.edition.status } }, recentJobs: jobs.map((j) => `${j.editionDate} ${j.stage} ${j.status} ${j.error ?? ""}`) };
      break;
    }
    default: throw new Error("Unknown command. See scripts/tempo.ts header.");
  }
  console.log(JSON.stringify(out, null, 2));
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => sql.end());
