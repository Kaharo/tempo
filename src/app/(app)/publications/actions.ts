"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";

/** Seeds a draft from an article: facts and links only. The owner's commentary is written by the owner. */
export async function createDraft(form: FormData) {
  const a = await db.query.articles.findFirst({ where: eq(schema.articles.id, String(form.get("articleId"))) });
  if (!a) return;
  const body = `${a.headline}\n\n${a.dek ?? ""}\n\n[Ваш комментарий]\n\nИсточники:\n${a.citations.map((c) => `— ${c.publisher}: ${c.url}`).join("\n")}`;
  await db.insert(schema.publicationDrafts).values({ channel: "telegram", language: "ru", title: a.headline, body, originArticleId: a.id, sourceItemIds: a.citations.map((c) => c.sourceItemId) });
  revalidatePath("/publications");
  redirect("/publications");
}

export async function saveDraft(form: FormData) {
  const id = String(form.get("id")); const d = await db.query.publicationDrafts.findFirst({ where: eq(schema.publicationDrafts.id, id) });
  if (!d) return;
  const body = String(form.get("body") ?? d.body); const channel = String(form.get("channel") ?? d.channel);
  const changed = body !== d.body || channel !== d.channel;
  // Any edit creates a new version and voids review state: approvals are bound to a version.
  await db.update(schema.publicationDrafts).set({ body, channel, language: channel === "telegram" ? "ru" : "en", version: changed ? d.version + 1 : d.version, status: changed ? "draft" : d.status, updatedAt: new Date() }).where(eq(schema.publicationDrafts.id, id));
  revalidatePath("/publications");
}

export async function setDraftStatus(form: FormData) {
  const id = String(form.get("id")); const to = String(form.get("to"));
  const d = await db.query.publicationDrafts.findFirst({ where: eq(schema.publicationDrafts.id, id) });
  if (!d) return;
  if (to === "in_review" && d.status === "draft") await db.update(schema.publicationDrafts).set({ status: "in_review", updatedAt: new Date() }).where(eq(schema.publicationDrafts.id, id));
  if ((to === "approved" || to === "rejected") && d.status === "in_review") {
    await db.insert(schema.approvals).values({ draftId: d.id, draftVersion: d.version, channel: d.channel, language: d.language, decision: to, decidedBy: process.env.TEMPO_ADMIN_EMAIL ?? "owner" });
    await db.update(schema.publicationDrafts).set({ status: to, updatedAt: new Date() }).where(eq(schema.publicationDrafts.id, id));
  }
  if (to === "archived") await db.update(schema.publicationDrafts).set({ status: "archived", updatedAt: new Date() }).where(eq(schema.publicationDrafts.id, id));
  revalidatePath("/publications");
}
