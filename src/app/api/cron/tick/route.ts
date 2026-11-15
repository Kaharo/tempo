import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/auth/session";
import { tick } from "@/lib/jobs/runner";
import { seed } from "@/lib/seed";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
/** Backup clock (Vercel Cron). Primary clock is the GitHub Actions workflow running the CLI. */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await seed();
  return NextResponse.json(await tick());
}
