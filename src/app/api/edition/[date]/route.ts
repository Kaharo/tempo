import { NextResponse } from "next/server";
import { getEdition } from "@/lib/edition/read";
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "bad date" }, { status: 400 });
  const data = await getEdition({ date });
  return data ? NextResponse.json(data) : NextResponse.json({ error: "not found" }, { status: 404 });
}
