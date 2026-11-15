"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
export async function deleteBriefing(form: FormData) {
  const id = String(form.get("id"));
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  await db.delete(schema.briefings).where(eq(schema.briefings.id, id));
  revalidatePath("/briefings"); revalidatePath("/");
}
