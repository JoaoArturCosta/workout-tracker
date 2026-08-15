import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

import type { Database } from "@/lib/db";
import {
  exercises,
  restPeriods,
  sessionExercises,
  sessionSets,
  templateExercises,
  users,
  workoutDevices,
  workoutSessions,
  workoutTemplates,
} from "@/lib/db/schema";
import { createTestDatabase } from "@/test/db";
import { startWorkout } from "./start-workout";

const ids = {
  user: "30000000-0000-4000-8000-000000000001",
  template: "30000000-0000-4000-8000-000000000002",
  templateExercise: "30000000-0000-4000-8000-000000000003",
  exercise: "30000000-0000-4000-8000-000000000004",
  oldDevice: "30000000-0000-4000-8000-000000000005",
  oldSession: "30000000-0000-4000-8000-000000000006",
  oldOccurrence: "30000000-0000-4000-8000-000000000007",
  completedSet: "30000000-0000-4000-8000-000000000008",
  pendingSet: "30000000-0000-4000-8000-000000000009",
};

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "start workout replacement",
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
        email: "start-replacement@example.test",
      });
      await db.insert(workoutTemplates).values({
        id: ids.template,
        userId: ids.user,
        name: "Replacement test",
        dayNumber: 1,
      });
      await db.insert(exercises).values({
        id: ids.exercise,
        userId: ids.user,
        name: "Row",
        muscleGroup: "back",
        isCustom: true,
      });
      await db.insert(templateExercises).values({
        id: ids.templateExercise,
        templateId: ids.template,
        exerciseId: ids.exercise,
        orderIndex: 0,
        sets: 2,
        mode: "Reps",
        repsMin: 8,
        repsMax: 10,
        restTimeSeconds: 60,
      });
      await db.insert(workoutDevices).values({
        id: ids.oldDevice,
        userId: ids.user,
        deviceId: ids.oldDevice,
      });
      await db.insert(workoutSessions).values({
        id: ids.oldSession,
        userId: ids.user,
        templateId: ids.template,
        status: "Active",
        revision: 7,
        controllerEpoch: 2,
        controllerDeviceId: ids.oldDevice,
        templateName: "Replacement test",
        templateDayNumber: 1,
        startTime: new Date("2026-08-11T09:15:00.000Z"),
        completed: false,
      });
      await db.insert(sessionExercises).values({
        id: ids.oldOccurrence,
        sessionId: ids.oldSession,
        templateExerciseId: ids.templateExercise,
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
          id: ids.completedSet,
          sessionExerciseId: ids.oldOccurrence,
          setNumber: 1,
          status: "Completed",
          mode: "Reps",
          weight: "10",
          reps: 8,
          externalLoadKg: 10,
          actualReps: 8,
          completedAt: new Date("2026-08-11T09:30:00.000Z"),
          completed: true,
        },
        {
          id: ids.pendingSet,
          sessionExerciseId: ids.oldOccurrence,
          setNumber: 2,
          status: "Pending",
          mode: "Reps",
          weight: "0",
          reps: 0,
          externalLoadKg: 0,
          completed: false,
        },
      ]);
      await db.insert(restPeriods).values({
        sessionId: ids.oldSession,
        completedSetId: ids.completedSet,
        currentSetId: ids.pendingSet,
        status: "Scheduled",
        dueAt: new Date("2026-08-11T09:32:00.000Z"),
        controllerEpoch: 2,
      });
    });

    afterAll(async () => {
      await db?.delete(users).where(eq(users.id, ids.user));
      await pool?.end();
    });

    it("completes the old workout, cancels its rest, and starts the new one", async () => {
      const now = new Date("2026-08-11T10:30:00.000Z");
      const replacement = await startWorkout({
        db,
        userId: ids.user,
        templateId: ids.template,
        deviceId: "30000000-0000-4000-8000-000000000010",
        now,
      });

      expect(replacement.status).toBe("Active");
      expect(replacement.id).not.toBe(ids.oldSession);

      const [oldSession] = await db
        .select({
          status: workoutSessions.status,
          completed: workoutSessions.completed,
          endTime: workoutSessions.endTime,
          durationMinutes: workoutSessions.durationMinutes,
          revision: workoutSessions.revision,
          controllerEpoch: workoutSessions.controllerEpoch,
        })
        .from(workoutSessions)
        .where(eq(workoutSessions.id, ids.oldSession));
      expect(oldSession).toEqual({
        status: "Completed",
        completed: true,
        endTime: now,
        durationMinutes: 75,
        revision: 8,
        controllerEpoch: 3,
      });

      const [pendingSet] = await db
        .select({ status: sessionSets.status })
        .from(sessionSets)
        .where(eq(sessionSets.id, ids.pendingSet));
      expect(pendingSet.status).toBe("Pending");

      const [rest] = await db
        .select({ status: restPeriods.status, cancelledAt: restPeriods.cancelledAt })
        .from(restPeriods)
        .where(
          and(
            eq(restPeriods.sessionId, ids.oldSession),
            eq(restPeriods.currentSetId, ids.pendingSet)
          )
        );
      expect(rest.status).toBe("Cancelled");
      expect(rest.cancelledAt).toEqual(now);

      const activeSessions = await db
        .select({ id: workoutSessions.id })
        .from(workoutSessions)
        .where(
          and(
            eq(workoutSessions.userId, ids.user),
            eq(workoutSessions.status, "Active")
          )
        );
      expect(activeSessions).toEqual([{ id: replacement.id }]);
    });
  }
);
