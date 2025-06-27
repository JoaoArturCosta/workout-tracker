import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/env.mjs";
import * as schema from "./schema";

// Create a connection pool
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Create the Drizzle database instance
export const db = drizzle(pool, { schema });

// Export types for convenience
export type Database = typeof db;
export * from "./schema";
