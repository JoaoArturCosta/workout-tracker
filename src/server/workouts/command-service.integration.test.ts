import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import type { Database } from "@/lib/db";
import {
  exercises,
  restPeriods,
  sessionExercises,
  sessionSets,
  users,
  workoutDevices,
  workoutSessions,
  workoutTemplates,
} from "@/lib/db/schema";
import { createTestDatabase } from "@/test/db";
import {
  WorkoutCommandError,
  executeWorkoutCommand,
} from "./command-service";
import { createDrizzleWorkoutCommandStore } from "./drizzle-stores";
import { getWorkoutSnapshot } from "./queries";

const ids = {
  user: "10000000-0000-4000-8000-000000000001",
  template: "10000000-0000-4000-8000-000000000002",
  exercise: "10000000-0000-4000-8000-000000000003",
  device: "10000000-0000-4000-8000-000000000004",
  deviceIdentity: "10000000-0000-4000-8000-000000000005",
  session: "10000000-0000-4000-8000-000000000006",
  occurrence: "10000000-0000-4000-8000-000000000007",
  firstSet: "10000000-0000-4000-8000-000000000008",
  secondSet: "10000000-0000-4000-8000-000000000009",
};

const command = (operationId: string) => ({
  operationId,
  sessionId: ids.session,
  deviceId: ids.deviceIdentity,
  controllerEpoch: 1,
  expectedRevision: 0,
  command: {
    type: "CompleteSet" as const,
    sessionSetId: ids.firstSet,
    result: {
      mode: "Reps" as const,
      externalLoadKg: 10,
      actualReps: 8,
      actualSeconds: null,
      rpe: null,
    },
  },
});

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "workout command database transaction",
  () => {
    let db: Database;
    let pool: ReturnType<typeof createTestDatabase>["pool"];

    beforeAll(() => {
      const testDatabase = createTestDatabase();
      db = testDatabase.db;
      pool = testDatabase.pool;
    });

    beforeEach(async () => {
      await db.delete(users).where(eq(users.id, ids.user));
      await db.insert(users).values({
        id: ids.user,
        email: "workout-command@example.test",
      });
      await db.insert(workoutTemplates).values({
        id: ids.template,
        userId: ids.user,
        name: "Command test",
        dayNumber: 1,
      });
      await db.insert(exercises).values({
        id: ids.exercise,
        userId: ids.user,
        name: "Row",
        muscleGroup: "back",
        isCustom: true,
      });
      await db.insert(workoutDevices).values({
        id: ids.device,
        userId: ids.user,
        deviceId: ids.deviceIdentity,
      });
      await db.insert(workoutSessions).values({
        id: ids.session,
        userId: ids.user,
        templateId: ids.template,
        status: "Active",
        revision: 0,
        controllerEpoch: 1,
        controllerDeviceId: ids.device,
        templateName: "Command test",
        templateDayNumber: 1,
      });
      await db.insert(sessionExercises).values({
        id: ids.occurrence,
        sessionId: ids.session,
        exerciseId: ids.exercise,
        exerciseName: "Row",
        orderIndex: 0,
        setCount: 2,
        mode: "Reps",
        repsMin: 8,
        repsMax: 10,
        restTimeSeconds: 60,
      });
      await db.insert(sessionSets).values([
        {
          id: ids.firstSet,
          sessionExerciseId: ids.occurrence,
          setNumber: 1,
          status: "Pending",
          mode: "Reps",
          weight: "0",
          reps: 0,
          externalLoadKg: 0,
        },
        {
          id: ids.secondSet,
          sessionExerciseId: ids.occurrence,
          setNumber: 2,
          status: "Pending",
          mode: "Reps",
          weight: "0",
          reps: 0,
          externalLoadKg: 0,
        },
      ]);
    });

    afterAll(async () => {
      if (db) {
        await db.delete(users).where(eq(users.id, ids.user));
      }
      await pool?.end();
    });

    it("deduplicates two concurrent sends of one operation", async () => {
      const envelope = command("20000000-0000-4000-8000-000000000001");
      const store = createDrizzleWorkoutCommandStore(db);

      const results = await Promise.all([
        executeWorkoutCommand({ store, userId: ids.user, envelope }),
        executeWorkoutCommand({ store, userId: ids.user, envelope }),
      ]);

      expect(results.map((result) => result.replayed).sort()).toEqual([
        false,
        true,
      ]);
      expect(results[0].result.revision).toBe(1);
      expect(results[1].result.revision).toBe(1);
    });

    it("rejects an out-of-order revision with a stable code", async () => {
      const store = createDrizzleWorkoutCommandStore(db);

      await expect(
        executeWorkoutCommand({
          store,
          userId: ids.user,
          envelope: {
            ...command("20000000-0000-4000-8000-000000000002"),
            expectedRevision: 2,
          },
        })
      ).rejects.toEqual(
        expect.objectContaining<Partial<WorkoutCommandError>>({
          code: "STALE_REVISION",
        })
      );
    });

    it("persists a saved skipped set as completed", async () => {
      const completedAt = new Date("2026-07-27T12:00:00.000Z");
      await db
        .update(sessionSets)
        .set({ status: "Skipped" })
        .where(eq(sessionSets.id, ids.secondSet));
      const store = createDrizzleWorkoutCommandStore(db);

      await executeWorkoutCommand({
        store,
        userId: ids.user,
        envelope: {
          ...command("20000000-0000-4000-8000-000000000003"),
          command: {
            type: "SaveSet",
            sessionSetId: ids.secondSet,
            result: {
              mode: "Reps",
              externalLoadKg: 25,
              actualReps: 10,
              actualSeconds: null,
              rpe: 8,
            },
          },
        },
        now: completedAt,
      });

      const [saved] = await db
        .select({
          status: sessionSets.status,
          completedAt: sessionSets.completedAt,
          externalLoadKg: sessionSets.externalLoadKg,
          actualReps: sessionSets.actualReps,
          rpe: sessionSets.rpe,
        })
        .from(sessionSets)
        .where(eq(sessionSets.id, ids.secondSet));
      expect(saved).toEqual({
        status: "Completed",
        completedAt,
        externalLoadKg: 25,
        actualReps: 10,
        rpe: 8,
      });
    });

    it("updates a completed set without replacing its completion time", async () => {
      const originalCompletedAt = new Date("2026-07-27T11:00:00.000Z");
      await db
        .update(sessionSets)
        .set({
          status: "Completed",
          completedAt: originalCompletedAt,
          externalLoadKg: 20,
          actualReps: 8,
        })
        .where(eq(sessionSets.id, ids.secondSet));
      const store = createDrizzleWorkoutCommandStore(db);

      await executeWorkoutCommand({
        store,
        userId: ids.user,
        envelope: {
          ...command("20000000-0000-4000-8000-000000000004"),
          command: {
            type: "SaveSet",
            sessionSetId: ids.secondSet,
            result: {
              mode: "Reps",
              externalLoadKg: 30,
              actualReps: 12,
              actualSeconds: null,
              rpe: null,
            },
          },
        },
        now: new Date("2026-07-27T13:00:00.000Z"),
      });

      const [saved] = await db
        .select({
          completedAt: sessionSets.completedAt,
          externalLoadKg: sessionSets.externalLoadKg,
          actualReps: sessionSets.actualReps,
        })
        .from(sessionSets)
        .where(eq(sessionSets.id, ids.secondSet));
      expect(saved).toEqual({
        completedAt: originalCompletedAt,
        externalLoadKg: 30,
        actualReps: 12,
      });
    });

    it("returns the Scheduled Rest period in the workout snapshot", async () => {
      const startedAt = new Date("2026-07-27T10:00:00.000Z");
      const dueAt = new Date("2026-07-27T10:01:00.000Z");
      const [rest] = await db
        .insert(restPeriods)
        .values({
          sessionId: ids.session,
          completedSetId: ids.firstSet,
          currentSetId: ids.secondSet,
          dueAt,
          controllerEpoch: 1,
          createdAt: startedAt,
        })
        .returning({ id: restPeriods.id });

      const snapshot = await getWorkoutSnapshot({
        db,
        userId: ids.user,
        sessionId: ids.session,
      });

      expect(snapshot?.rest).toEqual({
        id: rest.id,
        currentSetId: ids.secondSet,
        startedAt,
        dueAt,
      });
    });
  }
);
