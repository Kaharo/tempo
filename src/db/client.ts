import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "postgres://tempo:tempo@localhost:5432/tempo";
const globalForDb = globalThis as unknown as { _pg?: ReturnType<typeof postgres> };
const sql = globalForDb._pg ?? postgres(url, { max: 5, prepare: false });
if (process.env.NODE_ENV !== "production") globalForDb._pg = sql;

export const db = drizzle(sql, { schema });
export { sql, schema };
