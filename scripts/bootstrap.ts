/**
 * Build-time bootstrap (Vercel build step). Safe to run on every build:
 *  1. no database configured → skip with a notice (the app shows a "not connected" state)
 *  2. apply migrations
 *  3. on an empty database, load the first edition export from data/seed
 *  4. seed structural rows, sync sources and agents
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, sql, hasDatabase } from "@/db/client";

async function main() {
  if (!hasDatabase) { console.log("[bootstrap] DATABASE_URL is not set — skipping migrations."); return; }
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  console.log("[bootstrap] migrations applied");
  const [{ n }] = await sql<{ n: number }[]>`select (select count(*) from editions)::int + (select count(*) from source_providers)::int as n`;
  if (n === 0) {
    const dir = path.join(process.cwd(), "data", "seed");
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
      // pg_dump preamble pins search_path to ''; keep statements, restore the path afterwards.
      // Drop psql meta-commands and the search_path reset from the pg_dump preamble; load atomically.
      const dump = readFileSync(path.join(dir, f), "utf8").replace(/^\\(un)?restrict .*$/gm, "").replace(/^SELECT pg_catalog\.set_config\('search_path'.*$/gm, "");
      await sql.unsafe(`begin;\n${dump}\ncommit;`).simple();
      console.log(`[bootstrap] loaded ${f}`);
    }
  }
  const { seed } = await import("@/lib/seed");
  const { syncSourceRegistry } = await import("@/lib/sources/collect");
  const { syncAgents } = await import("@/lib/agents/sync");
  await seed(); await syncSourceRegistry(); await syncAgents();
  console.log("[bootstrap] seed and registries synced");
}
main().catch((e) => { console.error("[bootstrap] failed:", e); process.exitCode = 1; }).finally(() => sql.end({ timeout: 5 }));
