import { NextResponse } from "next/server";
import { runStage, STAGES, type Stage } from "@/lib/jobs/runner";
import { localDate } from "@/lib/dates";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
/** Manual regeneration of one stage (owner only; protected by middleware). Creates a new edition version on assemble. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const stage = body.stage as Stage; const date = body.date ?? localDate(process.env.TEMPO_TIMEZONE ?? "Asia/Almaty");
  if (!STAGES.includes(stage)) return NextResponse.json({ error: `stage must be one of ${STAGES.join(", ")}` }, { status: 400 });
  return NextResponse.json(await runStage(stage, date, "manual", true));
}
