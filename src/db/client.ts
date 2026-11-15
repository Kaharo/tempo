import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "postgres://tempo:tempo@localhost:5432/tempo";
export const hasDatabase = !!(process.env.DATABASE_URL ?? process.env.POSTGRES_URL);
const globalForDb = globalThis as unknown as { _pg?: ReturnType<typeof postgres> };
const sql = globalForDb._pg ?? postgres(url, { max: 5, prepare: false, connect_timeout: 10, idle_timeout: 20, onnotice: () => {} });
if (process.env.NODE_ENV !== "production") globalForDb._pg = sql;

export const db = drizzle(sql, { schema });
export { sql, schema };
