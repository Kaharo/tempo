import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/auth/session";
import { listAgentIds, loadAgent } from "@/lib/agents/config";
import { buildPack } from "@/lib/agents/run";
import { getPipelineConfig } from "@/lib/settings";
import { localDate } from "@/lib/dates";
export const dynamic = "force-dynamic";

/** Read-only: the numbered source pack an editor would receive today (public news metadata only). */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const expected = process.env.DIAG_TOKEN ?? "";
  if (expected.length < 16 || !safeEqual(q.get("token") ?? "", expected)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const agentId = q.get("agent") ?? "";
  if (!listAgentIds().includes(agentId)) return NextResponse.json({ error: `agent must be one of ${listAgentIds().join(", ")}` }, { status: 400 });
  const cfg = await getPipelineConfig();
  const date = localDate(process.env.TEMPO_TIMEZONE ?? cfg.timezone);
  const pack = await buildPack(loadAgent(agentId), date, cfg.ranking.max_clusters_per_agent);
  return NextResponse.json({ agent: agentId, date, sources: pack.sources.length, pack: pack.text });
}
