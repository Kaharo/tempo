import { db, schema } from "@/db/client";

type Level = "debug" | "info" | "warn" | "error";
export async function log(level: Level, scope: string, message: string, data?: unknown, jobRunId?: string) {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${scope}: ${message}`;
  (level === "error" ? console.error : console.log)(line);
  try {
    await db.insert(schema.systemLogs).values({ level, scope, message, data: data as object, jobRunId });
  } catch { /* logging must never break the pipeline */ }
}
