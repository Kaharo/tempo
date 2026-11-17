import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/auth/session";
import { estimateCost, resolveModel } from "@/lib/ai/registry";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** One tiny request to the configured model, to confirm the key and model name work. */
export async function GET(req: Request) {
  const expected = process.env.DIAG_TOKEN ?? "";
  if (expected.length < 16 || !safeEqual(new URL(req.url).searchParams.get("token") ?? "", expected)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { provider, model } = resolveModel("anthropic", "claude-sonnet-5-5");
  const a = provider.available();
  if (!a.ok) return NextResponse.json({ ok: false, provider: provider.id, model, error: a.reason });
  try {
    const r = await provider.generate({ model, system: "Ты отвечаешь строго в формате JSON.", user: 'Верни JSON-объект {"ok": true, "lang": "ru", "word": "<одно русское слово>"}', maxTokens: 400, temperature: 0, json: true, runId: "diag" });
    return NextResponse.json({ ok: true, provider: provider.id, model: r.model, reply: r.text.slice(0, 300), inputTokens: r.inputTokens, outputTokens: r.outputTokens, costUsd: estimateCost(model, r.inputTokens, r.outputTokens) });
  } catch (e) {
    return NextResponse.json({ ok: false, provider: provider.id, model, error: (e as Error).message.slice(0, 400) });
  }
}
