import { NextResponse } from "next/server";
import { getEdition } from "@/lib/edition/read";
import { editionFreshness } from "@/lib/jobs/runner";
export const dynamic = "force-dynamic";
export async function GET() {
  const [data, fresh] = await Promise.all([getEdition(), editionFreshness()]);
  return NextResponse.json({ freshness: fresh.state, today: fresh.today, ...(data ?? { edition: null }) });
}
