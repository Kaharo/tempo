import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { editionFreshness } from "@/lib/jobs/runner";
import { listEditions } from "@/lib/edition/read";
export const dynamic = "force-dynamic";
export async function GET() {
  const [fresh, jobs, sources, editions] = await Promise.all([
    editionFreshness(),
    db.select().from(schema.jobRuns).orderBy(desc(schema.jobRuns.createdAt)).limit(30),
    db.select({ id: schema.sourceProviders.id, status: schema.sourceProviders.lastStatus, error: schema.sourceProviders.lastError, at: schema.sourceProviders.lastFetchedAt }).from(schema.sourceProviders),
    listEditions(30),
  ]);
  return NextResponse.json({ freshness: fresh.state, today: fresh.today, jobs, sources, editions });
}
