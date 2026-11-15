"use server";
import { revalidatePath } from "next/cache";
import { runStage } from "@/lib/jobs/runner";
import { localDate } from "@/lib/dates";
/** Re-assemble and re-publish today's edition from stored outputs (no model calls). Keeps history as a new version. */
export async function reassemble() {
  const date = localDate(process.env.TEMPO_TIMEZONE ?? "Asia/Almaty");
  const a = await runStage("assemble", date, "manual", true);
  if (!("error" in a && a.error)) await runStage("publish", date, "manual", true);
  revalidatePath("/"); revalidatePath("/status");
}
