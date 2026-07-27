import { and, asc, desc, eq, inArray } from "drizzle-orm";

import type { Database } from "@/lib/db";
import {
  sessionExercises,
  sessionSets,
  restPeriods,
  workoutDevices,
  workoutSessions,
} from "@/lib/db/schema";
import type {
  SetStatus,
  WorkoutMode,
  WorkoutStatus,
} from "@/lib/workouts/contracts";

type ReadDatabase = Pick<Database, "select">;

export type WorkoutSetSnapshot = {
  id: string;
  setNumber: number;
  status: SetStatus;
  mode: WorkoutMode;
  externalLoadKg: number;
  actualReps: number | null;
  actualSeconds: number | null;
  rpe: number | null;
  completedAt: Date | null;
};

export type WorkoutOccurrenceSnapshot = {
  id: string;
  templateExerciseId: string | null;
  exerciseId: string;
  exerciseName: string;
  orderIndex: number;
  setCount: number;
  mode: WorkoutMode;
  repsMin: number | null;
  repsMax: number | null;
  targetSeconds: number | null;
  rpeTarget: number | null;
  restTimeSeconds: number;
  sets: WorkoutSetSnapshot[];
};

export type WorkoutSnapshot = {
  id: string;
  status: WorkoutStatus;
  revision: number;
  controllerEpoch: number;
  controllerDeviceId: string | null;
  templateId: string;
  templateName: string;
  templateDayNumber: number | null;
  startTime: Date;
  endTime: Date | null;
  durationMinutes: number | null;
  rest: {
    id: string;
    currentSetId: string | null;
    startedAt: Date;
    dueAt: Date;
  } | null;
  occurrences: WorkoutOccurrenceSnapshot[];
};

const loadSnapshot = async ({
  db,
  userId,
  sessionId,
}: {
  db: ReadDatabase;
  userId: string;
  sessionId: string;
}): Promise<WorkoutSnapshot | null> => {
  const [workout] = await db
    .select({
      id: workoutSessions.id,
      status: workoutSessions.status,
      revision: workoutSessions.revision,
      controllerEpoch: workoutSessions.controllerEpoch,
      controllerDeviceId: workoutDevices.deviceId,
      templateId: workoutSessions.templateId,
      templateName: workoutSessions.templateName,
      templateDayNumber: workoutSessions.templateDayNumber,
      startTime: workoutSessions.startTime,
      endTime: workoutSessions.endTime,
      durationMinutes: workoutSessions.durationMinutes,
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
    .limit(1);

  if (!workout) return null;

  const rows = await db
    .select({
      occurrence: sessionExercises,
      set: sessionSets,
    })
    .from(sessionExercises)
    .leftJoin(
      sessionSets,
      eq(sessionSets.sessionExerciseId, sessionExercises.id)
    )
    .where(eq(sessionExercises.sessionId, sessionId))
    .orderBy(
      asc(sessionExercises.orderIndex),
      asc(sessionSets.setNumber)
    );

  const [rest] =
    workout.status === "Active"
      ? await db
          .select({
            id: restPeriods.id,
            currentSetId: restPeriods.currentSetId,
            startedAt: restPeriods.createdAt,
            dueAt: restPeriods.dueAt,
          })
          .from(restPeriods)
          .where(
            and(
              eq(restPeriods.sessionId, sessionId),
              eq(restPeriods.status, "Scheduled")
            )
          )
          .limit(1)
      : [];

  const occurrences = new Map<string, WorkoutOccurrenceSnapshot>();
  for (const row of rows) {
    const occurrence =
      occurrences.get(row.occurrence.id) ??
      ({
        id: row.occurrence.id,
        templateExerciseId: row.occurrence.templateExerciseId,
        exerciseId: row.occurrence.exerciseId,
        exerciseName: row.occurrence.exerciseName ?? "Exercise",
        orderIndex: row.occurrence.orderIndex,
        setCount: row.occurrence.setCount,
        mode: row.occurrence.mode,
        repsMin: row.occurrence.repsMin,
        repsMax: row.occurrence.repsMax,
        targetSeconds: row.occurrence.targetSeconds,
        rpeTarget: row.occurrence.rpeTarget,
        restTimeSeconds: row.occurrence.restTimeSeconds,
        sets: [],
      } satisfies WorkoutOccurrenceSnapshot);

    if (row.set) {
      occurrence.sets.push({
        id: row.set.id,
        setNumber: row.set.setNumber,
        status: row.set.status,
        mode: row.set.mode,
        externalLoadKg: Number(row.set.externalLoadKg),
        actualReps: row.set.actualReps,
        actualSeconds: row.set.actualSeconds,
        rpe: row.set.rpe,
        completedAt: row.set.completedAt,
      });
    }
    occurrences.set(row.occurrence.id, occurrence);
  }

  return {
    ...workout,
    templateName: workout.templateName ?? "Workout",
    rest: rest ?? null,
    occurrences: [...occurrences.values()],
  };
};

export const getWorkoutSnapshot = loadSnapshot;

export const getActiveWorkoutSnapshot = async ({
  db,
  userId,
}: {
  db: ReadDatabase;
  userId: string;
}): Promise<WorkoutSnapshot | null> => {
  const [workout] = await db
    .select({ id: workoutSessions.id })
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.userId, userId),
        eq(workoutSessions.status, "Active")
      )
    )
    .limit(1);

  return workout
    ? loadSnapshot({ db, userId, sessionId: workout.id })
    : null;
};

export const getWorkoutHistory = async ({
  db,
  userId,
  limit,
}: {
  db: ReadDatabase;
  userId: string;
  limit: number;
}) =>
  db
    .select({
      id: workoutSessions.id,
      status: workoutSessions.status,
      templateId: workoutSessions.templateId,
      templateName: workoutSessions.templateName,
      templateDayNumber: workoutSessions.templateDayNumber,
      startTime: workoutSessions.startTime,
      endTime: workoutSessions.endTime,
      durationMinutes: workoutSessions.durationMinutes,
    })
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.userId, userId),
        inArray(workoutSessions.status, ["Completed", "Partial"])
      )
    )
    .orderBy(desc(workoutSessions.startTime))
    .limit(limit);

export const getPriorSetValues = async ({
  db,
  userId,
  exerciseId,
  mode,
  setNumber,
}: {
  db: ReadDatabase;
  userId: string;
  exerciseId: string;
  mode: WorkoutMode;
  setNumber: number;
}) => {
  const [prior] = await db
    .select({
      externalLoadKg: sessionSets.externalLoadKg,
      actualReps: sessionSets.actualReps,
      actualSeconds: sessionSets.actualSeconds,
    })
    .from(sessionSets)
    .innerJoin(
      sessionExercises,
      eq(sessionSets.sessionExerciseId, sessionExercises.id)
    )
    .innerJoin(
      workoutSessions,
      eq(sessionExercises.sessionId, workoutSessions.id)
    )
    .where(
      and(
        eq(workoutSessions.userId, userId),
        inArray(workoutSessions.status, ["Completed", "Partial"]),
        eq(sessionSets.status, "Completed"),
        eq(sessionExercises.exerciseId, exerciseId),
        eq(sessionExercises.mode, mode),
        eq(sessionSets.setNumber, setNumber)
      )
    )
    .orderBy(desc(workoutSessions.startTime))
    .limit(1);

  return prior
    ? {
        externalLoadKg: Number(prior.externalLoadKg),
        actualReps: prior.actualReps,
        actualSeconds: prior.actualSeconds,
      }
    : null;
};
