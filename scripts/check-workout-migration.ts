import { Pool, type PoolClient } from "pg";

type Issue = { code: string; ids: string[]; fix: string };

type Queryable = Pick<PoolClient, "query">;

const databaseUrl =
  process.env.MIGRATION_DATABASE_URL ??
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL;

export async function findMigrationIssues(client: Queryable): Promise<Issue[]> {
  const issues: Issue[] = [];

  const duplicateTemplates = await client.query<{ id: string }>(`
    SELECT string_agg(id::text, ', ' ORDER BY id) AS id
    FROM template_exercises
    GROUP BY template_id, exercise_id, COALESCE(mode::text, 'Reps')
    HAVING count(*) > 1
  `);
  if (duplicateTemplates.rows.length > 0) {
    issues.push({
      code: "DUPLICATE_TEMPLATE_OCCURRENCE",
      ids: duplicateTemplates.rows.map((row) => row.id),
      fix: "Choose one occurrence per template, exercise, and mode, then rerun the preflight. Do not merge rows automatically.",
    });
  }

  const duplicateSetPositions = await client.query<{ id: string }>(`
    SELECT string_agg(id::text, ', ' ORDER BY id) AS id
    FROM session_sets
    GROUP BY session_exercise_id, set_number
    HAVING count(*) > 1
  `);
  if (duplicateSetPositions.rows.length > 0) {
    issues.push({
      code: "DUPLICATE_SET_POSITION",
      ids: duplicateSetPositions.rows.map((row) => row.id),
      fix: "Assign each set a unique position within its frozen exercise occurrence before applying the set-position index.",
    });
  }

  const activeSessions = await client.query<{ id: string }>(`
    SELECT string_agg(id::text, ', ' ORDER BY id) AS id
    FROM workout_sessions
    -- The expand migration defaults every legacy row to Active. Use the
    -- legacy terminal fields until the explicit status backfill runs.
    WHERE COALESCE(completed, FALSE) = FALSE AND end_time IS NULL
    GROUP BY user_id
    HAVING count(*) > 1
  `);
  if (activeSessions.rows.length > 0) {
    issues.push({
      code: "MULTIPLE_ACTIVE_WORKOUTS",
      ids: activeSessions.rows.map((row) => row.id),
      fix: "End or discard all but one active workout for each account before applying the active-workout index.",
    });
  }

  const invalidSets = await client.query<{ id: string }>(`
    SELECT id::text AS id
    FROM session_sets
    WHERE (
      -- status defaults to Pending during expand, so completed is the
      -- reliable source for legacy rows. Keep explicit Completed for reruns.
      (completed = TRUE OR status::text = 'Completed')
      AND (
        (COALESCE(mode::text, 'Reps') = 'Reps' AND
          (COALESCE(actual_reps, reps) NOT BETWEEN 1 AND 100 OR
            CASE WHEN status::text = 'Completed' THEN external_load_kg ELSE weight END
              NOT BETWEEN 0 AND 1000))
        OR (COALESCE(mode::text, 'Reps') = 'Duration' AND
          (COALESCE(actual_seconds, reps) NOT BETWEEN 1 AND 3600 OR
            COALESCE(external_load_kg, weight, 0) NOT BETWEEN 0 AND 1000))
        OR rpe IS NOT NULL AND rpe NOT BETWEEN 6 AND 10
      )
    )
    ORDER BY id
  `);
  if (invalidSets.rows.length > 0) {
    issues.push({
      code: "INVALID_COMPLETED_SET",
      ids: invalidSets.rows.map((row) => row.id),
      fix: "Correct the completed result, RPE, or external load before applying state checks. Pending/Skipped rows must not carry a result.",
    });
  }

  const cannotFreeze = await client.query<{ id: string }>(`
    SELECT se.id::text AS id
    FROM session_exercises se
    LEFT JOIN exercises e ON e.id = se.exercise_id
    LEFT JOIN template_exercises te
      ON te.template_id = (SELECT template_id FROM workout_sessions WHERE id = se.session_id)
     AND te.exercise_id = se.exercise_id
    WHERE e.id IS NULL
       OR (COALESCE(se.exercise_name, e.name) IS NULL)
       OR te.id IS NULL
    ORDER BY se.id
  `);
  if (cannotFreeze.rows.length > 0) {
    issues.push({
      code: "SESSION_CANNOT_FREEZE",
      ids: cannotFreeze.rows.map((row) => row.id),
      fix: "Restore the referenced exercise or template occurrence, then rerun the preflight. Historical rows need a frozen exercise label and targets.",
    });
  }

  return issues;
}

export async function runPreflight(pool: Pick<Pool, "connect">): Promise<number> {
  const client = await pool.connect();
  try {
    const issues = await findMigrationIssues(client);
    if (issues.length === 0) {
      console.log("Workout migration preflight passed: no unsafe rows found.");
      return 0;
    }

    console.error("Workout migration preflight failed. No rows were changed.");
    for (const issue of issues) {
      console.error(`\n[${issue.code}] ${issue.ids.join(", ")}\nFix: ${issue.fix}`);
    }
    return 1;
  } finally {
    client.release();
  }
}

async function main() {
  if (!databaseUrl) {
    throw new Error(
      "Set MIGRATION_DATABASE_URL or TEST_DATABASE_URL before running the migration preflight."
    );
  }
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    process.exitCode = await runPreflight(pool);
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.endsWith("check-workout-migration.ts")) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
