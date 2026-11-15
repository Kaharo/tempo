import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { loadPipelineDefaults, PipelineConfig } from "./config";

/** Pipeline config lives in DB (editable); YAML only seeds it. */
export async function getPipelineConfig(): Promise<PipelineConfig> {
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, "pipeline") });
  if (row) return PipelineConfig.parse(row.value);
  const defaults = loadPipelineDefaults();
  await db.insert(schema.settings).values({ key: "pipeline", value: defaults }).onConflictDoNothing();
  return defaults;
}

export async function updatePipelineConfig(patch: Partial<PipelineConfig>) {
  const merged = PipelineConfig.parse({ ...(await getPipelineConfig()), ...patch });
  await db.insert(schema.settings).values({ key: "pipeline", value: merged })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: merged, updatedAt: new Date() } });
  return merged;
}
