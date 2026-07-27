import { Pool, type PoolClient } from "pg";

type Queryable = Pick<PoolClient, "query">;
type Verification = { code: string; ids: string[]; detail: string };

const databaseUrl =
  process.env.MIGRATION_DATABASE_URL ??
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL;

export async function verifyBackfill(client: Queryable): Promise<Verification[]> {
  const failures: Verification[] = [];

  const invalidSets = await client.query<{ id: string }>(`
    SELECT id::text AS id
    FROM session_sets
    WHERE status NOT IN ('Pending', 'Completed', 'Skipped')
       OR (status = 'Completed' AND (
         (mode = 'Reps' AND (actual_reps IS NULL OR actual_reps NOT BETWEEN 1 AND 100 OR actual_seconds IS NOT NULL))
         OR (mode = 'Duration' AND (actual_seconds IS NULL OR actual_seconds NOT BETWEEN 1 AND 3600 OR actual_reps IS NOT NULL))
       ))
       OR (status IN ('Pending', 'Skipped') AND (actual_reps IS NOT NULL OR actual_seconds IS NOT NULL OR completed_at IS NOT NULL))
    ORDER BY id
  `);
  if (invalidSets.rows.length > 0) {
    failures.push({
      code: "INVALID_SET_STATUS",
      ids: invalidSets.rows.map((row) => row.id),
      detail: "Every set must have one explicit state and mode-compatible result fields.",
    });
  }

  const pendingEnded = await client.query<{ id: string }>(`
    SELECT DISTINCT s.id::text AS id
    FROM workout_sessions s
    JOIN session_exercises se ON se.session_id = s.id
    JOIN session_sets ss ON ss.session_exercise_id = se.id
    WHERE s.status IN ('Completed', 'Partial', 'Discarded')
      AND ss.status = 'Pending'
    ORDER BY id
  `);
  if (pendingEnded.rows.length > 0) {
    failures.push({
      code: "ENDED_WORKOUT_HAS_PENDING_SET",
      ids: pendingEnded.rows.map((row) => row.id),
      detail: "Map unfinished sets in ended legacy workouts to Skipped; do not leave Pending rows.",
    });
  }

  const unfrozen = await client.query<{ id: string }>(`
    SELECT se.id::text AS id
    FROM session_exercises se
    WHERE se.exercise_name IS NULL
       OR se.set_count < 1
       OR (se.mode = 'Reps' AND (se.reps_min IS NULL OR se.reps_max IS NULL OR se.target_seconds IS NOT NULL))
       OR (se.mode = 'Duration' AND (se.target_seconds IS NULL OR se.reps_min IS NOT NULL OR se.reps_max IS NOT NULL))
    ORDER BY se.id
  `);
  if (unfrozen.rows.length > 0) {
    failures.push({
      code: "SESSION_PLAN_NOT_FROZEN",
      ids: unfrozen.rows.map((row) => row.id),
      detail: "Each historical occurrence needs an immutable name, set count, mode, and mode-specific targets.",
    });
  }

  const badSessionStatus = await client.query<{ id: string }>(`
    SELECT id::text AS id
    FROM workout_sessions
    WHERE status NOT IN ('Active', 'Completed', 'Partial', 'Discarded')
       OR revision < 0
       OR controller_epoch < 1
    ORDER BY id
  `);
  if (badSessionStatus.rows.length > 0) {
    failures.push({
      code: "INVALID_WORKOUT_STATE",
      ids: badSessionStatus.rows.map((row) => row.id),
      detail: "Sessions must have an explicit status, non-negative revision, and positive controller epoch.",
    });
  }

  return failures;
}

export async function runVerification(pool: Pick<Pool, "connect">): Promise<number> {
  const client = await pool.connect();
  try {
    const failures = await verifyBackfill(client);
    if (failures.length === 0) {
      console.log("Workout backfill verification passed.");
      return 0;
    }
    console.error("Workout backfill verification failed. No rows were changed.");
    for (const failure of failures) {
      console.error(`\n[${failure.code}] ${failure.ids.join(", ")}\n${failure.detail}`);
    }
    return 1;
  } finally {
    client.release();
  }
}

async function main() {
  if (!databaseUrl) {
    throw new Error(
      "Set MIGRATION_DATABASE_URL or TEST_DATABASE_URL before running backfill verification."
    );
  }
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    process.exitCode = await runVerification(pool);
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.endsWith("verify-workout-backfill.ts")) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
