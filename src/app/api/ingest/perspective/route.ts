import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/auth/session";
import { submitPerspective } from "@/lib/agents/submit";
import { assembleEdition, publishEdition } from "@/lib/edition/assemble";
import { getPipelineConfig } from "@/lib/settings";
import { localDate } from "@/lib/dates";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** ?token=…&agent=orbix&cluster=<story id>&headline=…&body=…&refs=1,2[&publish=1] — see src/lib/agents/submit.ts */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const expected = process.env.INGEST_TOKEN ?? "";
  if (expected.length < 16 || !safeEqual(q.get("token") ?? "", expected)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const date = localDate(process.env.TEMPO_TIMEZONE ?? (await getPipelineConfig()).timezone);
    const refs = (q.get("refs") ?? "").split(",").map((x) => Number.parseInt(x.trim(), 10)).filter((n) => Number.isFinite(n));
    const r = await submitPerspective({ agent: q.get("agent") ?? "", cluster: q.get("cluster") ?? "", headline: q.get("headline") ?? "", body: q.get("body") ?? "", refs }, date);
    if (!r.ok) return NextResponse.json(r, { status: r.status });
    let edition: { version: number; status: string } | null = null;
    if (q.get("publish") === "1") {
      const a = await assembleEdition(date, { force: true, mode: "manual" });
      await publishEdition(date);
      edition = { version: a.edition.version, status: a.edition.status };
    }
    return NextResponse.json({ ...r, date, edition });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message.slice(0, 300) }, { status: 500 });
  }
}
