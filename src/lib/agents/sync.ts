import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { loadAllAgents } from "./config";

/**
 * Registers each agent and records an immutable config version whenever the
 * YAML or any prompt file changes (content-hash based). Runs record the
 * version they used, so every output is traceable to exact instructions.
 */
export async function syncAgents() {
  const out: { id: string; version: number; changed: boolean }[] = [];
  for (const a of loadAllAgents()) {
    const c = a.config;
    await db.insert(schema.agents).values({ id: c.id, name: c.name, domain: c.domain, enabled: c.enabled })
      .onConflictDoUpdate({ target: schema.agents.id, set: { name: c.name, domain: c.domain, enabled: c.enabled } });
    const existing = await db.query.agentConfigs.findFirst({ where: and(eq(schema.agentConfigs.agentId, c.id), eq(schema.agentConfigs.contentHash, a.contentHash)) });
    let version = existing?.version;
    if (!existing) {
      const last = await db.query.agentConfigs.findFirst({ where: eq(schema.agentConfigs.agentId, c.id), orderBy: desc(schema.agentConfigs.version) });
      version = (last?.version ?? 0) + 1;
      await db.insert(schema.agentConfigs).values({
        agentId: c.id, version, contentHash: a.contentHash, config: c,
        systemPrompt: a.systemPrompt, editorialPolicy: a.editorialPolicy + "\n\n" + a.writingGuidelines,
      });
    }
    await db.update(schema.agents).set({ activeConfigVersion: version }).where(eq(schema.agents.id, c.id));
    out.push({ id: c.id, version: version!, changed: !existing });
  }
  return out;
}
