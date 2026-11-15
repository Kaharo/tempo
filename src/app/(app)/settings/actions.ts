"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { getPipelineConfig, updatePipelineConfig } from "@/lib/settings";

const list = (v: FormDataEntryValue | null) => String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export async function savePreferences(form: FormData) {
  const user = await db.query.users.findFirst(); if (!user) return;
  await db.update(schema.preferences).set({
    preferredTopics: list(form.get("preferredTopics")), mutedTopics: list(form.get("mutedTopics")),
    geographicInterests: list(form.get("geographicInterests")), preferredSources: list(form.get("preferredSources")), mutedSources: list(form.get("mutedSources")),
    editorialDepth: String(form.get("editorialDepth") ?? "standard"), updatedAt: new Date(),
  }).where(eq(schema.preferences.userId, user.id));
  revalidatePath("/settings");
}
export async function saveSchedule(form: FormData) {
  const cfg = await getPipelineConfig();
  const schedule = { ...cfg.schedule };
  for (const k of Object.keys(schedule) as (keyof typeof schedule)[]) { const v = String(form.get(k) ?? ""); if (/^\d{2}:\d{2}$/.test(v)) schedule[k] = v; }
  const weights = { ...cfg.ranking.weights };
  for (const k of Object.keys(weights)) { const v = Number(form.get(`w_${k}`)); if (Number.isFinite(v) && v >= 0 && v <= 1) weights[k] = v; }
  await updatePipelineConfig({ schedule, ranking: { ...cfg.ranking, weights } });
  revalidatePath("/settings");
}
