import { and, asc, eq } from "drizzle-orm";

import type { Database } from "@/lib/db";
import {
  operationReceipts,
  deliveryEvents,
  restPeriods,
  sessionExercises,
  sessionSets,
  workoutDevices,
  workoutSessions,
} from "@/lib/db/schema";
import type {
  CommandResult,
  CommandSet,
  CommandSetResult,
  WorkoutCommandStore,
} from "./command-service";
import type {
  ControllerStore,
  ControllerWorkout,
} from "./controller-service";

type JsonReceipt = {
  result: CommandResult;
  postCommitEffect?: unknown;
};

const hydrateResult = (result: CommandResult): CommandResult => ({
  ...result,
  sets: result.sets.map((set) => ({
    ...set,
    completedAt: set.completedAt ? new Date(set.completedAt) : null,
  })),
});

const resultFromRow = ({
  mode,
  externalLoadKg,
  actualReps,
  actualSeconds,
  rpe,
}: {
  mode: "Reps" | "Duration";
  externalLoadKg: number;
  actualReps: number | null;
  actualSeconds: number | null;
  rpe: number | null;
}): CommandSetResult =>
  mode === "Reps"
    ? {
        mode,
        externalLoadKg,
        actualReps: actualReps ?? 0,
        actualSeconds: null,
        rpe,
      }
    : {
        mode,
        externalLoadKg,
        actualReps: null,
        actualSeconds: actualSeconds ?? 0,
        rpe,
      };

export const createDrizzleWorkoutCommandStore = (
  db: Database
): WorkoutCommandStore => ({
  transaction: (run) =>
    db.transaction(async (tx) =>
      run({
        findReceipt: async ({ operationId, sessionId, userId }) => {
          const [row] = await tx
            .select({ result: operationReceipts.result })
            .from(operationReceipts)
            .innerJoin(
              workoutSessions,
              eq(operationReceipts.sessionId, workoutSessions.id)
            )
            .where(
              and(
                eq(operationReceipts.operationId, operationId),
                eq(operationReceipts.sessionId, sessionId),
                eq(workoutSessions.userId, userId)
              )
            )
            .limit(1);
          if (!row) return null;
          const stored = row.result as JsonReceipt;
          return {
            ...stored,
            result: hydrateResult(stored.result),
          };
        },
        lockWorkout: async ({ sessionId, userId }) => {
          const [row] = await tx
            .select({
              session: workoutSessions,
              controllerDeviceId: workoutDevices.deviceId,
            })
            .from(workoutSessions)
            .leftJoin(
              workoutDevices,
              eq(workoutSessions.controllerDeviceId, workoutDevices.id)
            )
            .where(
              and(
                eq(workoutSessions.id, sessionId),
                eq(workoutSessions.userId, userId)
              )
            )
            .for("update", { of: workoutSessions })
            .limit(1);
          if (!row) return null;

          const setRows = await tx
            .select({ set: sessionSets })
            .from(sessionSets)
            .innerJoin(
              sessionExercises,
              eq(sessionSets.sessionExerciseId, sessionExercises.id)
            )
            .where(eq(sessionExercises.sessionId, sessionId))
            .orderBy(
              asc(sessionExercises.orderIndex),
              asc(sessionSets.setNumber)
            );

          const sets: CommandSet[] = setRows.map(({ set }) => ({
            id: set.id,
            exerciseOccurrenceId: set.sessionExerciseId,
            mode: set.mode,
            status: set.status,
            completedAt: set.completedAt,
            result:
              set.status === "Completed"
                ? resultFromRow({
                    mode: set.mode,
                    externalLoadKg: set.externalLoadKg,
                    actualReps: set.actualReps,
                    actualSeconds: set.actualSeconds,
                    rpe: set.rpe,
                  })
                : null,
          }));

          return {
            id: row.session.id,
            userId: row.session.userId,
            status: row.session.status,
            revision: row.session.revision,
            controllerDeviceId: row.controllerDeviceId,
            controllerEpoch: row.session.controllerEpoch,
            startTime: row.session.startTime,
            endTime: row.session.endTime,
            durationMinutes: row.session.durationMinutes,
            sets,
          };
        },
        saveWorkout: async (workout) => {
          await tx
            .update(workoutSessions)
            .set({
              status: workout.status,
              revision: workout.revision,
              endTime: workout.endTime,
              durationMinutes: workout.durationMinutes,
              completed: workout.status === "Completed",
            })
            .where(eq(workoutSessions.id, workout.id));

          for (const set of workout.sets) {
            const result = set.result;
            await tx
              .update(sessionSets)
              .set({
                status: set.status,
                externalLoadKg: result?.externalLoadKg ?? 0,
                actualReps:
                  result?.mode === "Reps" ? result.actualReps : null,
                actualSeconds:
                  result?.mode === "Duration" ? result.actualSeconds : null,
                rpe: result?.rpe ?? null,
                completedAt: set.completedAt,
                completed: set.status === "Completed",
                weight: String(result?.externalLoadKg ?? 0),
                reps:
                  result?.mode === "Reps" ? result.actualReps : 0,
              })
              .where(eq(sessionSets.id, set.id));
          }
        },
        saveReceipt: async ({
          operationId,
          sessionId,
          controllerEpoch,
          expectedRevision,
          commandType,
          result,
          postCommitEffect,
        }) => {
          await tx.insert(operationReceipts).values({
            operationId,
            sessionId,
            controllerEpoch,
            expectedRevision,
            commandType,
            result: { result, postCommitEffect } satisfies JsonReceipt,
          });
        },
        cancelScheduledRest: async (sessionId, now) => {
          await tx
            .update(restPeriods)
            .set({
              status: "Cancelled",
              cancelledAt: now,
              updatedAt: now,
            })
            .where(
              and(
                eq(restPeriods.sessionId, sessionId),
                eq(restPeriods.status, "Scheduled")
              )
            );
        },
        scheduleRest: async ({
          sessionId,
          completedSetId,
          currentSetId,
          controllerEpoch,
          now,
        }) => {
          const [completed] = await tx
            .select({ restTimeSeconds: sessionExercises.restTimeSeconds })
            .from(sessionSets)
            .innerJoin(
              sessionExercises,
              eq(sessionSets.sessionExerciseId, sessionExercises.id)
            )
            .where(eq(sessionSets.id, completedSetId))
            .limit(1);
          const [current] = await tx
            .select({
              exerciseName: sessionExercises.exerciseName,
              setNumber: sessionSets.setNumber,
              setCount: sessionExercises.setCount,
              mode: sessionExercises.mode,
              repsMin: sessionExercises.repsMin,
              repsMax: sessionExercises.repsMax,
              targetSeconds: sessionExercises.targetSeconds,
            })
            .from(sessionSets)
            .innerJoin(
              sessionExercises,
              eq(sessionSets.sessionExerciseId, sessionExercises.id)
            )
            .where(
              and(
                eq(sessionSets.id, currentSetId),
                eq(sessionExercises.sessionId, sessionId),
                eq(sessionSets.status, "Pending")
              )
            )
            .limit(1);
          if (!completed || !current) return null;

          const dueAt = new Date(
            now.getTime() + completed.restTimeSeconds * 1_000
          );
          const [rest] = await tx
            .insert(restPeriods)
            .values({
              sessionId,
              completedSetId,
              currentSetId,
              status: "Scheduled",
              dueAt,
              controllerEpoch,
              nextExerciseName: current.exerciseName,
              nextSetNumber: current.setNumber,
              nextSetCount: current.setCount,
              nextMode: current.mode,
              nextRepsMin: current.repsMin,
              nextRepsMax: current.repsMax,
              nextTargetSeconds: current.targetSeconds,
            })
            .returning({
              restId: restPeriods.id,
              token: restPeriods.token,
              dueAt: restPeriods.dueAt,
            });
          await tx.insert(deliveryEvents).values({
            restPeriodId: rest.restId,
            eventType: "Due",
            occurredAt: rest.dueAt,
          });
          return rest;
        },
      })
    ),
});

export const createDrizzleControllerStore = (
  db: Database
): ControllerStore => ({
  transaction: (run) =>
    db.transaction(async (tx) =>
      run({
        lockWorkout: async ({ sessionId, userId }) => {
          const [row] = await tx
            .select({
              session: workoutSessions,
              controllerDeviceId: workoutDevices.deviceId,
            })
            .from(workoutSessions)
            .leftJoin(
              workoutDevices,
              eq(workoutSessions.controllerDeviceId, workoutDevices.id)
            )
            .where(
              and(
                eq(workoutSessions.id, sessionId),
                eq(workoutSessions.userId, userId)
              )
            )
            .for("update", { of: workoutSessions })
            .limit(1);
          if (!row) return null;
          return {
            id: row.session.id,
            userId: row.session.userId,
            status: row.session.status,
            revision: row.session.revision,
            controllerDeviceId: row.controllerDeviceId,
            controllerEpoch: row.session.controllerEpoch,
          };
        },
        userOwnsDevice: async ({ deviceId, userId }) => {
          const [device] = await tx
            .select({ id: workoutDevices.id })
            .from(workoutDevices)
            .where(
              and(
                eq(workoutDevices.userId, userId),
                eq(workoutDevices.deviceId, deviceId)
              )
            )
            .limit(1);
          return Boolean(device);
        },
        saveController: async (workout: ControllerWorkout) => {
          const [device] = await tx
            .select({ id: workoutDevices.id })
            .from(workoutDevices)
            .where(
              and(
                eq(workoutDevices.userId, workout.userId),
                eq(workoutDevices.deviceId, workout.controllerDeviceId ?? "")
              )
            )
            .limit(1);
          if (!device) {
            throw new Error("Controller device not found");
          }
          await tx
            .update(workoutSessions)
            .set({
              controllerDeviceId: device.id,
              controllerEpoch: workout.controllerEpoch,
              revision: workout.revision,
            })
            .where(eq(workoutSessions.id, workout.id));
        },
        cancelScheduledRest: async (sessionId, now) => {
          await tx
            .update(restPeriods)
            .set({
              status: "Cancelled",
              cancelledAt: now,
              updatedAt: now,
            })
            .where(
              and(
                eq(restPeriods.sessionId, sessionId),
                eq(restPeriods.status, "Scheduled")
              )
            );
        },
      })
    ),
});
