-- Backfill legacy rows without deleting or merging data. Every statement is
-- deterministic so a rehearsal can safely run this file more than once.
UPDATE "workout_templates"
SET "archived_at" = NULL
WHERE "archived_at" IS NULL;
--> statement-breakpoint

UPDATE "template_exercises"
SET "mode" = 'Reps', "target_seconds" = NULL
WHERE "mode" IS NULL;
--> statement-breakpoint

UPDATE "session_exercises" AS se
SET
  "template_exercise_id" = te."id",
  "exercise_name" = e."name",
  "set_count" = te."sets",
  "mode" = te."mode",
  "reps_min" = te."reps_min",
  "reps_max" = te."reps_max",
  "target_seconds" = te."target_seconds",
  "rpe_target" = te."rpe_target",
  "rest_time_seconds" = COALESCE(te."rest_time_seconds", 120)
FROM "workout_sessions" AS ws,
  "template_exercises" AS te,
  "exercises" AS e
WHERE se."session_id" = ws."id"
  AND te."template_id" = ws."template_id"
  AND te."exercise_id" = se."exercise_id"
  AND e."id" = se."exercise_id";
--> statement-breakpoint

UPDATE "session_sets" AS ss
SET
  "status" = CASE
    WHEN ss."completed" THEN 'Completed'::"set_status"
    ELSE 'Pending'::"set_status"
  END,
  "mode" = COALESCE(se."mode", 'Reps'),
  "external_load_kg" = COALESCE(ss."weight", 0),
  "actual_reps" = CASE WHEN ss."completed" THEN ss."reps" ELSE NULL END,
  "actual_seconds" = NULL,
  "completed_at" = CASE
    WHEN ss."completed" THEN COALESCE(ss."completed_at", ws."start_time")
    ELSE NULL
  END
FROM "session_exercises" AS se
JOIN "workout_sessions" AS ws ON ws."id" = se."session_id"
WHERE ss."session_exercise_id" = se."id";
--> statement-breakpoint

UPDATE "workout_sessions" AS ws
SET
  "template_name" = wt."name",
  "template_day_number" = wt."day_number",
  "revision" = 0,
  "controller_epoch" = 1,
  "status" = CASE
    WHEN ws."end_time" IS NULL AND COALESCE(ws."completed", FALSE) = FALSE
      THEN 'Active'::"workout_status"
    WHEN NOT EXISTS (
      SELECT 1
      FROM "session_exercises" AS se
      JOIN "session_sets" AS ss ON ss."session_exercise_id" = se."id"
      WHERE se."session_id" = ws."id" AND ss."status" <> 'Completed'
    ) THEN 'Completed'::"workout_status"
    ELSE 'Partial'::"workout_status"
  END
FROM "workout_templates" AS wt
WHERE wt."id" = ws."template_id";
--> statement-breakpoint

-- Ended legacy workouts cannot retain Pending sets. Skipped remains distinct
-- from Completed and is excluded from analytics by later sprints.
UPDATE "session_sets" AS ss
SET "status" = 'Skipped'
FROM "session_exercises" AS se
JOIN "workout_sessions" AS ws ON ws."id" = se."session_id"
WHERE ss."session_exercise_id" = se."id"
  AND ss."status" = 'Pending'
  AND (ws."end_time" IS NOT NULL OR ws."completed" = TRUE);
--> statement-breakpoint

UPDATE "workout_sessions" AS ws
SET "status" = CASE
  WHEN ws."end_time" IS NULL AND COALESCE(ws."completed", FALSE) = FALSE
    THEN 'Active'::"workout_status"
  WHEN EXISTS (
    SELECT 1
    FROM "session_exercises" AS se
    JOIN "session_sets" AS ss ON ss."session_exercise_id" = se."id"
    WHERE se."session_id" = ws."id" AND ss."status" = 'Skipped'
  ) THEN 'Partial'::"workout_status"
  ELSE 'Completed'::"workout_status"
END;
--> statement-breakpoint

-- Add cross-row invariants only after the legacy rows have valid values.
DO $$ BEGIN
  ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_mode_targets_check" CHECK ((
    ("mode" = 'Reps' AND "reps_min" BETWEEN 1 AND 100 AND
      "reps_max" BETWEEN 1 AND 100 AND "reps_min" <= "reps_max" AND
      "target_seconds" IS NULL)
    OR
    ("mode" = 'Duration' AND "target_seconds" BETWEEN 1 AND 3600 AND
      "reps_min" IS NULL AND "reps_max" IS NULL)
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "session_sets" ADD CONSTRAINT "session_sets_status_result_check" CHECK ((
    ("status" IN ('Pending', 'Skipped') AND "actual_reps" IS NULL AND
      "actual_seconds" IS NULL AND "completed_at" IS NULL)
    OR
    ("status" = 'Completed' AND "external_load_kg" BETWEEN 0 AND 1000 AND
      (("mode" = 'Reps' AND "actual_reps" BETWEEN 1 AND 100 AND
        "actual_seconds" IS NULL) OR
       ("mode" = 'Duration' AND "actual_seconds" BETWEEN 1 AND 3600 AND
        "actual_reps" IS NULL)))
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "session_sets" ADD CONSTRAINT "session_sets_rpe_check" CHECK (
    "rpe" IS NULL OR "rpe" BETWEEN 6 AND 10
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "template_exercises" ADD CONSTRAINT "template_exercises_mode_targets_check" CHECK ((
    ("mode" = 'Reps' AND "reps_min" BETWEEN 1 AND 100 AND
      "reps_max" BETWEEN 1 AND 100 AND "reps_min" <= "reps_max" AND
      "target_seconds" IS NULL)
    OR
    ("mode" = 'Duration' AND "target_seconds" BETWEEN 1 AND 3600 AND
      "reps_min" IS NULL AND "reps_max" IS NULL)
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_revision_check"
    CHECK ("revision" >= 0 AND "controller_epoch" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "uq_session_exercises_session_order"
  ON "session_exercises" USING btree ("session_id", "order_index");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_session_sets_exercise_set_number"
  ON "session_sets" USING btree ("session_exercise_id", "set_number");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_template_exercises_template_exercise_mode"
  ON "template_exercises" USING btree ("template_id", "exercise_id", "mode");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_workout_sessions_one_active_user"
  ON "workout_sessions" USING btree ("user_id")
  WHERE "status" = 'Active';
