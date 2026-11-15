import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/auth/session";
import { ingestBriefingItem } from "@/lib/briefings";
export const dynamic = "force-dynamic";

/**
 * Inbound channel for agents that run outside TEMPO (e.g. scheduled Claude tasks).
 * GET is supported on purpose: those agents can only issue GET requests to this app.
 * The token is write-only for summaries — it cannot read data or trigger anything else.
 *   /api/ingest/briefing?token=…&source=aimos-digest&headline=…
 *   /api/ingest/briefing?token=…&source=aimos-digest&n=1&title=…&text=…&url=…
 */
async function handle(req: Request) {
  const q = new URL(req.url).searchParams;
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const g = (k: string) => (body[k] != null ? String(body[k]) : q.get(k));
  const expected = process.env.INGEST_TOKEN ?? "";
  const token = g("token") ?? (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (expected.length < 16 || !safeEqual(token ?? "", expected)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const r = await ingestBriefingItem({ source: g("source") ?? "", date: g("date"), headline: g("headline"), n: g("n"), title: g("title"), text: g("text"), url: g("url") });
    return NextResponse.json(r, { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `storage error: ${(e as Error).message.slice(0, 200)}` }, { status: 503 });
  }
}
export { handle as GET, handle as POST };
