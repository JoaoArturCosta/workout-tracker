import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/lib/db/schema";

config({ path: ".env.local" });

export function assertTestDatabaseUrl(
  testDatabaseUrl = process.env.TEST_DATABASE_URL,
  databaseUrl = process.env.DATABASE_URL,
): asserts testDatabaseUrl is string {
  if (!testDatabaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL is required for database tests; refusing to use DATABASE_URL.",
    );
  }

  if (databaseUrl && testDatabaseUrl === databaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL must not equal DATABASE_URL; refusing to run against the main database.",
    );
  }
}

export function createTestDatabase() {
  assertTestDatabaseUrl();

  const pool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    max: 5,
  });

  return {
    db: drizzle(pool, { schema }),
    pool,
  };
}
