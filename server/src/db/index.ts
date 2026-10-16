import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

export const sql = postgres(env.DATABASE_URL, { max: 10, transform: { undefined: null } });
export const db = drizzle(sql, { schema });
export type Db = typeof db;
export { schema };
