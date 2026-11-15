"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";

/** Owner-entered observation. Stored as a snapshot; history is never overwritten. */
export async function addSnapshot(form: FormData) {
  const name = String(form.get("name") ?? "").trim(); const text = String(form.get("text") ?? "").trim(); const kind = String(form.get("kind") ?? "update");
  if (!name || !text) return;
  const slug = name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "project";
  const [p] = await db.insert(schema.projects).values({ slug, name }).onConflictDoUpdate({ target: schema.projects.slug, set: { name } }).returning();
  await db.insert(schema.projectSnapshots).values({
    projectId: p.id, observedAt: new Date(), source: "manual",
    blockers: kind === "blocker" ? [text] : [], decisions: kind === "decision" ? [text] : [], nextSteps: kind === "step" ? [text] : [], developments: kind === "update" ? [text] : [],
  });
  revalidatePath("/projects"); revalidatePath("/");
}
export async function archiveProject(form: FormData) {
  await db.update(schema.projects).set({ active: false }).where(eq(schema.projects.id, String(form.get("id"))));
  revalidatePath("/projects"); revalidatePath("/");
}
